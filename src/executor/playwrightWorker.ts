import { Queue, Worker, QueueScheduler, JobsOptions } from "bullmq";
import { runIntents, type RunResult } from "./runner";
import env from "../config/env";
import logger from "../utils/logger";
import type { Intent } from "../parser/intentSchema";

export interface RunJobData {
  runId: string;
  intents: Intent[];
  metadata?: Record<string, unknown>;
}

export interface RunQueue {
  enqueue(data: RunJobData, options?: JobsOptions): Promise<RunResult>;
}

const QUEUE_NAME = "japanese-dsl-run";

export function createRunQueue(): RunQueue {
  if (!env.redisUrl) {
    logger.warn("REDIS_URL not provided. Falling back to in-process execution.");
    return {
      async enqueue(data: RunJobData): Promise<RunResult> {
        return runIntents(data.intents, { runId: data.runId });
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
      const result = await runIntents(job.data.intents, { runId: job.data.runId });
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
