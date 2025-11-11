declare module "fs/promises" {
  export const readFile: (...args: any[]) => Promise<any>;
  export const writeFile: (...args: any[]) => Promise<void>;
  export const mkdir: (...args: any[]) => Promise<void>;
  export const access: (...args: any[]) => Promise<void>;
  export const readdir: (...args: any[]) => Promise<string[]>;
  export const appendFile: (...args: any[]) => Promise<void>;
}

declare module "path" {
  export function join(...parts: string[]): string;
  export function dirname(path: string): string;
  export function resolve(...parts: string[]): string;
  export const sep: string;
}

declare module "url" {
  export class URL {
    constructor(input: string, base?: string | URL);
    pathname: string;
  }
  export function fileURLToPath(url: string | URL): string;
}

declare module "node:process" {
  export = process;
}

declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  cwd(): string;
};

declare module "@fastify/static" {
  const plugin: any;
  export default plugin;
}

declare module "bullmq" {
  export interface JobsOptions {
    [key: string]: any;
  }

  export class Queue<T = any> {
    constructor(name: string, opts?: any);
    add(name: string, data: T, opts?: any): Promise<any>;
    drain(): Promise<void>;
    close(): Promise<void>;
    client?: any;
  }

  export class Worker<T = any, R = any> {
    constructor(name: string, processor: any, opts?: any);
    close(): Promise<void>;
    on(event: string, handler: (...args: any[]) => void): void;
  }

  export class QueueEvents {
    constructor(name: string, opts?: any);
    close(): Promise<void>;
    on(event: string, handler: (...args: any[]) => void): void;
  }

  export class QueueScheduler {
    constructor(name: string, opts?: any);
    waitUntilReady(): Promise<void>;
    close(): Promise<void>;
  }
}
