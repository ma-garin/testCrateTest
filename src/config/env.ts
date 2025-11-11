import dotenv from "dotenv";

dotenv.config();

export interface EnvironmentConfig {
  port: number;
  redisUrl?: string;
  postgresUrl?: string;
  s3Endpoint?: string;
  headless: boolean;
  artifactRoot: string;
}

const DEFAULT_ARTIFACT_DIR = "artifacts";

export const env: EnvironmentConfig = {
  port: Number(process.env.PORT ?? 3000),
  redisUrl: process.env.REDIS_URL,
  postgresUrl: process.env.POSTGRES_URL,
  s3Endpoint: process.env.S3_ENDPOINT,
  headless: process.env.HEADLESS === "false" ? false : true,
  artifactRoot: process.env.ARTIFACT_DIR ?? DEFAULT_ARTIFACT_DIR,
};

export default env;
