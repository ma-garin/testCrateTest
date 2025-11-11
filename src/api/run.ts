import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { parseJapaneseDsl } from "../parser/japaneseParser";
import { validateRun } from "../executor/validator";
import type { RunQueue } from "../executor/playwrightWorker";

interface RunBody {
  dsl?: unknown;
  steps?: unknown;
  intents?: unknown;
  metadata?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

function extractDslSource(body: RunBody | string): unknown {
  if (typeof body === "string") {
    return body;
  }
  if (body.dsl) return body.dsl;
  if (body.steps) return body.steps;
  if (body.intents) return body.intents;
  return body;
}

export default async function runRoutes(fastify: FastifyInstance & { runQueue: RunQueue }) {
  fastify.addContentTypeParser("text/plain", { parseAs: "string" }, async (_request, body) => body);

  fastify.post("/run", async (request, reply) => {
    const body = (request.body ?? {}) as RunBody | string;
    const metadata = typeof body === "object" && body !== null && "metadata" in body ? (body as RunBody).metadata ?? {} : {};
    const options = typeof body === "object" && body !== null && "options" in body ? (body as RunBody).options ?? {} : undefined;

    const dslSource = extractDslSource(body);
    const intents = parseJapaneseDsl(dslSource);
    if (!intents.length) {
      return reply.status(400).send({ error: "No steps provided" });
    }

    const validated = validateRun(intents, metadata, options ?? {});
    const runId = (validated.metadata.runId as string) ?? uuidv4();

    const result = await fastify.runQueue.enqueue({
      runId,
      intents: validated.intents,
      metadata: validated.metadata,
      options: {
        headless: validated.options.headless,
        artifactRoot: validated.options.artifactRoot,
        defaultTimeoutMs: validated.options.timeoutMs,
      },
    });

    return reply.send({
      status: result.status,
      runId: result.runId,
      durationMs: result.durationMs,
      steps: result.steps,
      artifacts: result.artifacts,
    });
  });
}
