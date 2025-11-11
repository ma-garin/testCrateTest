// src/types/global.d.ts
// --- Node型が未導入でも最低限ビルドが通るようにする簡易シム ---

// process の最小型（env と exit のみ）
declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

// @fastify/static の型が無くても import できるようにする宣言
declare module '@fastify/static' {
  import { FastifyPluginCallback } from 'fastify';
  const fastifyStatic: FastifyPluginCallback<{
    root: string;
    prefix?: string;
    index?: string | false;
    list?: boolean;
    decorateReply?: boolean;
  }>;
  export default fastifyStatic;
}

// Nodeのパス操作を最低限使えるようにする（型だけ用意）
declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function dirname(p: string): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: string): string;
}
