import { mkdir, writeFile, appendFile } from "fs/promises";
import path from "path";
import { chromium, Browser, Page } from "playwright";
import { v4 as uuidv4 } from "uuid";
import { intentSchema, type Intent } from "../parser/intentSchema";
import env from "../config/env";
import logger from "../utils/logger";

export interface StepResult {
  intent: Intent;
  status: "passed" | "failed";
  error?: string;
  attempts: number;
  durationMs: number;
}

export interface RunResult {
  runId: string;
  status: "passed" | "failed";
  startedAt: string;
  durationMs: number;
  steps: StepResult[];
  artifacts: {
    screenshot?: string;
    video?: string;
    har?: string;
    log: string;
    result: string;
  };
}

export interface RunnerOptions {
  runId?: string;
  headless?: boolean;
  artifactRoot?: string;
  defaultTimeoutMs?: number;
}

const RETRY_LIMIT = 3;

async function resolveLocator(page: Page, target: string) {
  if (target.startsWith("css=")) {
    return page.locator(target.replace("css=", ""));
  }

  if (target.startsWith("role=")) {
    const [rolePart, namePart] = target.split("[");
    const role = rolePart.replace("role=", "");
    if (namePart?.endsWith("]")) {
      const name = namePart.slice(0, -1).replace("name=", "");
      return page.getByRole(role as never, { name });
    }
    return page.getByRole(role as never);
  }

  if (/^[#\.\[]/.test(target)) {
    return page.locator(target);
  }

  const testIdLocator = page.getByTestId(target);
  if (await testIdLocator.count()) {
    return testIdLocator.first();
  }

  const textLocator = page.getByText(target, { exact: true });
  if (await textLocator.count()) {
    return textLocator.first();
  }

  return page.locator(target);
}

async function executeIntent(page: Page, intent: Intent, timeout: number) {
  switch (intent.action) {
    case "open":
      await page.goto(intent.target, { waitUntil: "networkidle", timeout });
      return;
    case "click": {
      const locator = await resolveLocator(page, intent.target);
      await locator.waitFor({ state: "visible", timeout });
      await locator.click({ timeout });
      await page.waitForLoadState("networkidle", { timeout }).catch(() => undefined);
      return;
    }
    case "type": {
      if (intent.target === "keyboard") {
        await page.keyboard.type(intent.value ?? "", { delay: 50 });
        return;
      }
      const locator = await resolveLocator(page, intent.target);
      await locator.waitFor({ state: "visible", timeout });
      await locator.fill(intent.value ?? "", { timeout });
      return;
    }
    case "assert": {
      if (intent.target === "title") {
        const pageTitle = await page.title();
        const expectedValue = intent.value ?? "";
        const expectation = intent.expect ?? "includes";
        if (expectation === "includes") {
          if (!pageTitle.includes(expectedValue)) {
            throw new Error(`Expected page title to include "${expectedValue}" but received "${pageTitle}"`);
          }
          return;
        }
        if (expectation === "equals") {
          if (pageTitle !== expectedValue) {
            throw new Error(`Expected page title to equal "${expectedValue}" but received "${pageTitle}"`);
          }
          return;
        }
        throw new Error(`Unsupported assertion expectation: ${expectation}`);
      }

      const locator = await resolveLocator(page, intent.target);
      const expectation = intent.expect ?? "visible";
      await locator.waitFor({ state: "visible", timeout });

      if (expectation === "visible") {
        return;
      }

      if (!intent.value) {
        throw new Error("Assertion expects a comparison value");
      }

      const textContent = await locator.innerText();
      if (expectation === "includes") {
        if (!textContent.includes(intent.value)) {
          throw new Error(`Expected text to include "${intent.value}" but received "${textContent}"`);
        }
        return;
      }
      if (expectation === "equals") {
        if (textContent.trim() !== intent.value) {
          throw new Error(`Expected text to equal "${intent.value}" but received "${textContent}"`);
        }
        return;
      }
      throw new Error(`Unsupported assertion expectation: ${expectation}`);
    }
    default:
      throw new Error(`Unsupported action ${(intent as Intent).action}`);
  }
}

async function executeWithRetry(page: Page, intent: Intent, defaultTimeoutMs?: number): Promise<StepResult> {
  const stepStart = Date.now();
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt += 1) {
    try {
      const candidate = { ...intent };
      if (defaultTimeoutMs !== undefined && candidate.timeout === undefined) {
        candidate.timeout = defaultTimeoutMs;
      }
      const parsedIntent = intentSchema.parse(candidate);
      await executeIntent(page, parsedIntent, parsedIntent.timeout ?? 5000);
      const durationMs = Date.now() - stepStart;
      return {
        intent: parsedIntent,
        status: "passed",
        attempts: attempt,
        durationMs,
      };
    } catch (error) {
      const delay = Math.pow(2, attempt - 1) * 250;
      if (attempt >= RETRY_LIMIT) {
        const durationMs = Date.now() - stepStart;
        return {
          intent,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          attempts: attempt,
          durationMs,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    intent,
    status: "failed",
    attempts: RETRY_LIMIT,
    durationMs: Date.now() - stepStart,
    error: "Unknown execution failure",
  };
}

export async function runIntents(intents: Intent[], options: RunnerOptions = {}): Promise<RunResult> {
  const runId = options.runId ?? uuidv4();
  const artifactRoot = options.artifactRoot ?? env.artifactRoot;
  const artifactDir = path.join(artifactRoot, runId);
  const startedAt = new Date();
  await mkdir(artifactDir, { recursive: true });

  const logPath = path.join(artifactDir, "log.jsonl");
  const browser: Browser = await chromium.launch({ headless: options.headless ?? env.headless });
  const videoDir = path.join(artifactDir, "video");
  await mkdir(videoDir, { recursive: true });

  const context = await browser.newContext({
    recordVideo: { dir: videoDir },
    recordHar: { path: path.join(artifactDir, "network.har"), mode: "minimal" },
  });
  const page = await context.newPage();

  const steps: StepResult[] = [];
  for (const intent of intents) {
    logger.info({ runId, intent }, "Executing step");
    const result = await executeWithRetry(page, intent, options.defaultTimeoutMs);
    steps.push(result);
    await appendFile(logPath, `${JSON.stringify({ timestamp: new Date().toISOString(), runId, intent: result.intent, result: result.status, error: result.error ?? null })}\n`);
    if (result.status === "failed") {
      break;
    }
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const screenshotPath = path.join(artifactDir, "screenshot.png");
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

  const pageVideo = page.video();
  const videoPath = pageVideo ? await pageVideo.path().catch(() => undefined) : undefined;

  await context.close();
  await browser.close();

  const runStatus = steps.every((step) => step.status === "passed") ? "passed" : "failed";
  const resultPath = path.join(artifactDir, "result.json");
  const resultPayload = {
    status: runStatus,
    runId,
    durationMs,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    steps,
    artifacts: {
      screenshot: screenshotPath,
      video: videoPath,
      har: path.join(artifactDir, "network.har"),
      log: logPath,
    },
  };
  await writeFile(resultPath, JSON.stringify(resultPayload, null, 2));

  return {
    runId,
    status: runStatus,
    startedAt: startedAt.toISOString(),
    durationMs,
    steps,
    artifacts: {
      screenshot: screenshotPath,
      video: videoPath,
      har: path.join(artifactDir, "network.har"),
      log: logPath,
      result: resultPath,
    },
  };
}
