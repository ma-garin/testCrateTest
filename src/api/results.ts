import { FastifyInstance } from "fastify";
import { readFile } from "fs/promises";
import path from "path";
import env from "../config/env";
import logger from "../utils/logger";

export default async function resultsRoutes(fastify: FastifyInstance) {
  fastify.get("/results/:runId", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const resultPath = path.join(env.artifactRoot, runId, "result.json");
    try {
      const raw = await readFile(resultPath, "utf-8");
      const data = JSON.parse(raw);
      return reply.send(data);
    } catch (error) {
      logger.error({ runId, error }, "Failed to read result");
      return reply.status(404).send({ error: "Result not found" });
    }
  });
}
