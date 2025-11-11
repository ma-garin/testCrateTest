import { readFile } from "fs/promises";
import yaml from "js-yaml";
import { parseJapaneseDsl } from "../src/parser/japaneseParser";
import { runIntents } from "../src/executor/runner";

async function main() {
  const file = await readFile(new URL("./sample.yaml", import.meta.url), "utf-8");
  const steps = yaml.load(file);
  const intents = parseJapaneseDsl(steps);
  const result = await runIntents(intents, { headless: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
