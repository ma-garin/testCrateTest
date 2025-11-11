# 日本語DSL E2E Test Runner

ブラウザGUIとFastify APIから日本語DSLで記述したE2Eシナリオを実行できる最小構成のランナーです。DSLをルールベースで意図(JSON)に変換し、Playwrightで実行した結果や成果物を取得できます。

## 主な特徴

- 🇯🇵 日本語DSL・JSONどちらからでも`open` / `click` / `type` / `assert`意図へ変換
- 🧠 Zodスキーマで実行前に意図・オプションを検証
- 🎬 PlaywrightでのE2E実行（スクリーンショット・動画・HAR・ログ保存）
- 🔁 最大3回リトライ＋指数バックオフで堅牢性を確保
- 🧵 BullMQ + Redisによる非同期実行（`QUEUE_MODE=sync`でRedisなしの同期フォールバック）
- 🖥️ `public/index.html` をFastifyの静的配信で提供し、ブラウザ上からDSLを送信可能

## ディレクトリ構成

```
CreateAutoTest/
├── public/
│   └── index.html           # シンプルなブラウザGUI
├── src/
│   ├── api/
│   │   ├── run.ts           # /run エンドポイント
│   │   └── results.ts       # 実行結果取得エンドポイント
│   ├── config/
│   │   └── env.ts           # 環境変数読み込み
│   ├── executor/
│   │   ├── runner.ts        # Playwright実行器
│   │   └── playwrightWorker.ts # BullMQキュー&フォールバック
│   ├── utils/
│   │   └── logger.ts        # Pinoロガー
│   └── server.ts            # Fastifyサーバ本体
├── tests/
│   ├── sample.yaml          # DSLサンプル
│   └── example.spec.ts      # Playwright実行サンプル
├── .env                     # ローカル開発用設定
├── package.json
├── tsconfig.json
└── README.md
```

`artifacts/` ディレクトリは実行時に自動作成され、スクリーンショット・動画・HAR・JSONログが runId 毎に保存されます。

## セットアップ

1. 依存関係のインストール

   ```bash
   npm install
   npm run playwright:install
   ```

2. 環境変数の確認（リポジトリの `.env` を必要に応じて変更）

   ```env
   PORT=3000
   QUEUE_MODE=sync
   HEADLESS=true
   ```

   `QUEUE_MODE=sync` の場合、Redis が無くても同期実行され、「`REDIS_URL not provided. Falling back to in-process execution.`」というログが表示されます。

3. 開発サーバーの起動

   ```bash
   npm run dev
   ```

   成功すると以下のログが表示されます。

   ```
   REDIS_URL not provided. Falling back to in-process execution.
   Server running at http://0.0.0.0:3000
   ```

4. ブラウザで `http://localhost:3000` を開くとGUIが表示され、テキストエリアにDSLを入力して「実行」を押すだけで `/run` API が呼び出されます。

## API の使い方

### `POST /run`

- **DSLテキスト例（`text/plain`）**

  ```text
  ページを開く: https://example.com
  「Example Domain」が見えることを確認
  ```

- **JSON例**

  ```json
  {
    "intents": [
      { "action": "open", "target": "https://example.com" },
      {
        "action": "assert",
        "target": "title",
        "expect": "includes",
        "value": "Example Domain"
      }
    ],
    "metadata": { "suite": "smoke", "name": "example-dom" },
    "options": { "headless": true, "timeoutMs": 30000 }
  }
  ```

- **curl例**

  ```bash
  curl -i -X POST http://localhost:3000/run \
    -H 'Content-Type: application/json' \
    --data-binary '{
      "intents": [
        { "action": "open", "target": "https://example.com" },
        { "action": "assert", "target": "title", "expect": "includes", "value": "Example Domain" }
      ],
      "metadata": { "suite": "smoke", "name": "example-dom" },
      "options": { "headless": true, "timeoutMs": 30000 }
    }'
  ```

- **レスポンス例**

  ```json
  {
    "status": "passed",
    "runId": "8f1d1f3e-...",
    "durationMs": 5230,
    "steps": [
      { "intent": { "action": "open", "target": "https://example.com", "timeout": 5000 }, "status": "passed", "attempts": 1, "durationMs": 1502 },
      { "intent": { "action": "assert", "target": "title", "expect": "includes", "value": "Example Domain", "timeout": 30000 }, "status": "passed", "attempts": 1, "durationMs": 231 }
    ],
    "artifacts": {
      "screenshot": "artifacts/8f1d1f3e-.../screenshot.png",
      "video": "artifacts/8f1d1f3e-.../video/0.webm",
      "har": "artifacts/8f1d1f3e-.../network.har",
      "log": "artifacts/8f1d1f3e-.../log.jsonl",
      "result": "artifacts/8f1d1f3e-.../result.json"
    }
  }
  ```

### `GET /results/:runId`

指定した `runId` の `result.json` を返却します。GUIのレスポンスに含まれる `runId` を利用してください。

## 日本語DSLの書き方

| DSL例 | 変換されるIntent |
|-------|------------------|
| `https://example.com を開く` | `{ action: "open", target: "https://example.com" }` |
| `ページを開く: https://example.com` | `{ action: "open", target: "https://example.com" }` |
| `「送信ボタン」をクリック` | `{ action: "click", target: "送信ボタン" }` |
| `「ログイン」と入力` | `{ action: "type", target: "keyboard", value: "ログイン" }` |
| `「検索ボックス」に「テスト」を入力` | `{ action: "type", target: "検索ボックス", value: "テスト" }` |
| `「ダッシュボード」が見えることを確認` | `{ action: "assert", target: "ダッシュボード", expect: "visible" }` |

## 成果物

`artifacts/{runId}/` 配下に以下を保存します。

- `screenshot.png` : 実行後のスクリーンショット
- `video/` : ステップ全体の動画
- `network.har` : ネットワークログ
- `log.jsonl` : ステップごとのログ
- `result.json` : 実行結果サマリ（API経由で取得可能）

## テスト

型チェックとユニットテストを以下のコマンドで実行できます。

```bash
npm run lint   # TypeScriptの型チェック
npm run test   # DSLパーサーのユニットテスト
```

## 開発メモ

- Playwrightの依存関係インストールには `npm run playwright:install` を実行してください。
- Redis を利用する場合は `.env` に `QUEUE_MODE=redis` と `REDIS_URL` を設定してください。
- Node.js v23 以降を想定しています（`package.json` の `engines` を参照）。
