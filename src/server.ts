import Fastify from "fastify";
import path from "path";
import { fileURLToPath } from "url";
import process from "node:process";
import fastifyStatic from "@fastify/static";
import env from "./config/env";
import logger from "./utils/logger";
import runRoutes from "./api/run";
import resultsRoutes from "./api/results";
import { createRunQueue } from "./executor/playwrightWorker";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer() {
  const app = Fastify({ logger: false });
  app.decorate("runQueue", createRunQueue());

  // Serve the browser GUI (public/index.html)
  await app.register(fastifyStatic as any, {
    root: path.join(__dirname, "../public"),
  } as any);

  await app.register(runRoutes);
  await app.register(resultsRoutes);

  return app;
}

if (process.env.NODE_ENV !== "test") {
  buildServer()
    .then((app) => {
      app.listen({ port: env.port, host: "0.0.0.0" }, (err, address) => {
        if (err) {
          logger.error({ err }, "Failed to start server");
          process.exit(1);
        }
        logger.info(`Server running at ${address}`);
      });
    })
    .catch((error) => {
      logger.error({ error }, "Failed to bootstrap server");
      process.exit(1);
    });
}
