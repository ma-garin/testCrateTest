import { Queue, Worker, QueueScheduler, JobsOptions } from "bullmq";
import { runIntents, type RunResult, type RunnerOptions } from "./runner";
import env from "../config/env";
import logger from "../utils/logger";
import type { Intent } from "../parser/intentSchema";

export interface RunJobData {
  runId: string;
  intents: Intent[];
  metadata?: Record<string, unknown>;
  options?: RunnerOptions;
}

export interface RunQueue {
  enqueue(data: RunJobData, options?: JobsOptions): Promise<RunResult>;
}

const QUEUE_NAME = "japanese-dsl-run";

export function createRunQueue(): RunQueue {
  const shouldUseRedis = env.queueMode === "redis" && env.redisUrl;

  if (!shouldUseRedis) {
    if (!env.redisUrl) {
      logger.warn("REDIS_URL not provided. Falling back to in-process execution.");
    } else if (env.queueMode !== "redis") {
      logger.info("QUEUE_MODE=sync. Using in-process execution.");
    }
    return {
      async enqueue(data: RunJobData): Promise<RunResult> {
        return runIntents(data.intents, {
          runId: data.runId,
          headless: data.options?.headless,
          artifactRoot: data.options?.artifactRoot,
          defaultTimeoutMs: data.options?.defaultTimeoutMs,
        });
      },
    };
  }

  const queue = new Queue<RunJobData>(QUEUE_NAME, {
    connection: { url: env.redisUrl },
  });
  const scheduler = new QueueScheduler(QUEUE_NAME, {
    connection: { url: env.redisUrl },
  });
  scheduler.waitUntilReady().catch((error) => {
    logger.error({ error }, "Failed to start queue scheduler");
  });

  const worker = new Worker<RunJobData>(
    QUEUE_NAME,
    async (job) => {
      logger.info({ runId: job.data.runId }, "Worker executing job");
      const result = await runIntents(job.data.intents, {
        runId: job.data.runId,
        headless: job.data.options?.headless,
        artifactRoot: job.data.options?.artifactRoot,
        defaultTimeoutMs: job.data.options?.defaultTimeoutMs,
      });
      return result;
    },
    {
      connection: { url: env.redisUrl },
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Job failed");
  });

  return {
    async enqueue(data: RunJobData, options?: JobsOptions) {
      const job = await queue.add("run", data, {
        removeOnComplete: true,
        removeOnFail: true,
        ...(options ?? {}),
      });
      const result = (await job.waitUntilFinished(queue.client)) as RunResult;
      return result;
    },
  };
}
