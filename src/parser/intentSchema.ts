import { z } from "zod";

export const intentSchema = z.object({
  action: z.enum(["open", "click", "type", "assert"]),
  target: z.string().min(1, "target is required"),
  value: z.string().optional(),
  expect: z.enum(["visible", "includes", "equals"]).optional(),
  timeout: z.number().int().positive().max(120000).default(5000),
});

export type Intent = z.infer<typeof intentSchema>;

export const runOptionsSchema = z
  .object({
    headless: z.boolean().optional(),
    timeoutMs: z.number().int().positive().max(120000).optional(),
    artifactRoot: z.string().min(1).optional(),
  })
  .default({});

export const testRunSchema = z.object({
  intents: z.array(intentSchema),
  metadata: z
    .object({
      name: z.string().optional(),
      runId: z.string().optional(),
    })
    .default({}),
  options: runOptionsSchema,
});

export type TestRunPayload = z.infer<typeof testRunSchema>;
