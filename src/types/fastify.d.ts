import "fastify";
import type { RunQueue } from "../executor/playwrightWorker";

declare module "fastify" {
  interface FastifyInstance {
    runQueue: RunQueue;
  }
}
