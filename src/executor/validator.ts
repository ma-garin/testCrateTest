import { testRunSchema, type Intent, type TestRunPayload } from "../parser/intentSchema";

export function validateRun(
  intents: Intent[],
  metadata: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
): TestRunPayload {
  return testRunSchema.parse({
    intents,
    metadata,
    options,
  });
}
