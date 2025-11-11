import test from "node:test";
import assert from "node:assert/strict";
import { parseJapaneseDsl } from "../src/parser/japaneseParser";

const defaultTimeout = 5000;

test("parses colon style open command", () => {
  const [intent] = parseJapaneseDsl(["ページを開く: https://example.com"]);
  assert.deepStrictEqual(intent, {
    action: "open",
    target: "https://example.com",
    timeout: defaultTimeout,
  });
});

test("parses numbered steps with click and assert", () => {
  const intents = parseJapaneseDsl([
    "1. 「送信ボタン」をクリック",
    "2. 「ダッシュボード」が見えることを確認",
  ]);

  assert.deepStrictEqual(intents, [
    { action: "click", target: "送信ボタン", timeout: defaultTimeout },
    { action: "assert", target: "ダッシュボード", expect: "visible", timeout: defaultTimeout },
  ]);
});

test("parses keyboard input intent", () => {
  const [intent] = parseJapaneseDsl(["「ログイン」と入力"]);
  assert.deepStrictEqual(intent, {
    action: "type",
    target: "keyboard",
    value: "ログイン",
    timeout: defaultTimeout,
  });
});

test("validates provided intents against schema", () => {
  const intents = parseJapaneseDsl([
    {
      action: "open",
      target: "https://example.com",
      timeout: 3000,
    },
  ]);

  assert.deepStrictEqual(intents, [
    { action: "open", target: "https://example.com", timeout: 3000 },
  ]);
});

test("throws on unsupported statement", () => {
  assert.throws(() => parseJapaneseDsl(["未対応の操作を行う"]));
});
