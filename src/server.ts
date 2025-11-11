import Fastify from "fastify";
import env from "./config/env";
import logger from "./utils/logger";
import runRoutes from "./api/run";
import resultsRoutes from "./api/results";
import { createRunQueue } from "./executor/playwrightWorker";

export async function buildServer() {
  const app = Fastify({ logger: false });
  app.decorate("runQueue", createRunQueue());

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
