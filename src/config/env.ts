import dotenv from "dotenv";

dotenv.config();

type QueueMode = "redis" | "sync";

export interface EnvironmentConfig {
  port: number;
  redisUrl?: string;
  headless: boolean;
  artifactRoot: string;
  queueMode: QueueMode;
}

const DEFAULT_ARTIFACT_DIR = "artifacts";

function resolveQueueMode(): QueueMode {
  const mode = process.env.QUEUE_MODE?.toLowerCase();
  if (mode === "redis") return "redis";
  return "sync";
}

export const env: EnvironmentConfig = {
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL,
  headless: process.env.HEADLESS === "false" ? false : true,
  artifactRoot: process.env.ARTIFACT_DIR ?? DEFAULT_ARTIFACT_DIR,
  queueMode: resolveQueueMode(),
};

export default env;
