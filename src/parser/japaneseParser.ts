import yaml from "js-yaml";
import { intentSchema, type Intent } from "./intentSchema";

type RawDslInput = string | string[] | Record<string, unknown> | Intent[];

const OPEN_REGEX = /^(?<url>https?:\/\/\S+).*?(開く|アクセスする)/;
const CLICK_REGEX = /「(?<target>.+?)」(?:を)?クリック/;
const TYPE_VALUE_ONLY_REGEX = /「(?<value>.+?)」と入力/;
const TYPE_WITH_TARGET_REGEX = /「(?<value>.+?)」(?:を|を?)「(?<target>.+?)」に入力/;
const ASSERT_REGEX = /「(?<target>.+?)」が見えることを確認/;

function ensureArray(input: unknown): RawDslInput {
  if (typeof input === "string") {
    const parsed = yaml.load(input);
    return (parsed ?? []) as RawDslInput;
  }
  return input as RawDslInput;
}

function normalizeDsl(raw: RawDslInput): string[] | Intent[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (typeof raw[0] === "string") {
      return raw as string[];
    }
    return raw as Intent[];
  }

  if (typeof raw === "object" && raw !== null) {
    if (Array.isArray((raw as Record<string, unknown>).steps)) {
      return ((raw as Record<string, unknown>).steps as unknown[]).map(String);
    }
    if (Array.isArray((raw as Record<string, unknown>).intents)) {
      return (raw as { intents: Intent[] }).intents;
    }
  }

  if (typeof raw === "string") {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

function parseLine(line: string): Intent {
  const openMatch = line.match(OPEN_REGEX);
  if (openMatch?.groups?.url) {
    return intentSchema.parse({
      action: "open",
      target: openMatch.groups.url,
    });
  }

  const clickMatch = line.match(CLICK_REGEX);
  if (clickMatch?.groups?.target) {
    return intentSchema.parse({
      action: "click",
      target: clickMatch.groups.target,
    });
  }

  const typeTargetMatch = line.match(TYPE_WITH_TARGET_REGEX);
  if (typeTargetMatch?.groups?.value && typeTargetMatch?.groups?.target) {
    return intentSchema.parse({
      action: "type",
      target: typeTargetMatch.groups.target,
      value: typeTargetMatch.groups.value,
    });
  }

  const typeValueMatch = line.match(TYPE_VALUE_ONLY_REGEX);
  if (typeValueMatch?.groups?.value) {
    return intentSchema.parse({
      action: "type",
      target: "keyboard",
      value: typeValueMatch.groups.value,
    });
  }

  const assertMatch = line.match(ASSERT_REGEX);
  if (assertMatch?.groups?.target) {
    return intentSchema.parse({
      action: "assert",
      target: assertMatch.groups.target,
    });
  }

  throw new Error(`Unable to parse DSL line: ${line}`);
}

export function parseJapaneseDsl(input: unknown): Intent[] {
  const normalized = normalizeDsl(ensureArray(input));
  if (normalized.length === 0) {
    return [];
  }

  if (typeof normalized[0] !== "string") {
    return (normalized as Intent[]).map((intent) => intentSchema.parse(intent));
  }

  return (normalized as string[]).map(parseLine);
}
