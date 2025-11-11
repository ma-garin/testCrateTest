// src/server.ts
import Fastify from "fastify";
import env from "./config/env";
import logger from "./utils/logger";
import runRoutes from "./api/run";
import resultsRoutes from "./api/results";
import { createRunQueue } from "./executor/playwrightWorker";

// 追加：GUI配信用
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process"; // ← process.exit の型エラー対策（明示 import）

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer() {
  const app = Fastify({ logger: false });
  app.decorate("runQueue", createRunQueue());

  // API ルート
  await app.register(runRoutes);
  await app.register(resultsRoutes);

  // 追加：public/ をルート配信（プレフィックスなし）
  await app.register(fastifyStatic, {
    root: path.join(__dirname, "../public"),
    // prefix は付けない（"/" 直下で配信）
    index: "index.html",
    decorateReply: false,
  });

  //
