# 日本語DSL E2E Test Runner

日本語で記述したDSLをPlaywrightで実行する最小構成のE2Eテストランナーです。APIにテストシナリオを渡すと、意図(JSON)へ変換し、Playwrightで実行した結果を構造化JSONとして返却します。

## 主な特徴

- 🇯🇵 日本語DSLをルールベースで解析し、`open` / `click` / `type` / `assert` 意図に変換
- 🧠 変換後の意図をZodスキーマで検証
- 🎬 PlaywrightでのE2E実行（スクリーンショット・HAR・動画・ログ保存）
- 🔁 最大3回のリトライ（指数バックオフ）で堅牢性を確保
- 📦 BullMQ + Redisによるジョブ投入（Redis未設定時はフォールバックで同期実行）
- 🗃️ PostgreSQLやS3互換ストレージ連携を想定した環境変数設計

## ディレクトリ構成

```
project-root/
├─ src/
│  ├─ api/
│  │  ├─ run.ts            # /run エンドポイント
│  │  └─ results.ts        # 実行結果取得エンドポイント
│  ├─ parser/
│  │  ├─ japaneseParser.ts # 日本語DSL → Intent解析
│  │  └─ intentSchema.ts   # Intent/TestRunスキーマ
│  ├─ executor/
│  │  ├─ runner.ts         # Playwright実行器
│  │  ├─ playwrightWorker.ts# BullMQキュー&ワーカー
│  │  └─ validator.ts      # スキーマ検証
│  ├─ utils/
│  │  └─ logger.ts         # Pinoロガー
│  ├─ config/
│  │  └─ env.ts            # 環境変数読み込み
│  └─ types/               # Fastify拡張などの型定義
├─ artifacts/              # 成果物出力ディレクトリ
├─ tests/
│  ├─ sample.yaml          # サンプルDSL
│  └─ example.spec.ts      # ランナー単体実行サンプル
├─ .env.example            # サンプル環境変数
├─ package.json
├─ tsconfig.json
└─ README.md
```

## セットアップ

1. 依存関係のインストール

   ```bash
   npm install
   npm run playwright:install
   ```

2. 環境変数の準備

   ```bash
   cp .env.example .env
   # 必要に応じてPORTやREDIS_URLを変更
   ```

   Redis未設定の場合でも、本プロジェクトは自動で同期実行フォールバックします。

3. 開発サーバーの起動

   ```bash
   npm run dev
   ```

   `http://localhost:3000/run` にPOSTすることでテストを実行できます。

## API

### `POST /run`

- **リクエストボディ**（例）

  ```yaml
  dsl:
    - "https://example.com を開く"
    - "「ログイン」と入力"
    - "「送信ボタン」をクリック"
    - "「ダッシュボード」が見えることを確認"
  metadata:
    name: ログインテスト
  ```

- **レスポンス例**

  ```json
  {
    "status": "passed",
    "runId": "8f1d1f3e-...",
    "durationMs": 5230,
    "steps": [
      { "action": "open", "target": "https://example.com", "status": "passed" },
      { "action": "type", "target": "keyboard", "value": "ログイン", "status": "passed" },
      { "action": "click", "target": "送信ボタン", "status": "passed" },
      { "action": "assert", "target": "ダッシュボード", "status": "passed" }
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

指定した`runId`の`result.json`を返却します。

## 日本語DSLの書き方

| DSL例 | 変換されるIntent |
|-------|------------------|
| `https://example.com を開く` | `{ action: "open", target: "https://example.com" }` |
| `「送信ボタン」をクリック` | `{ action: "click", target: "送信ボタン" }` |
| `「ログイン」と入力` | `{ action: "type", target: "keyboard", value: "ログイン" }` |
| `「検索ボックス」に「テスト」を入力` | `{ action: "type", target: "検索ボックス", value: "テスト" }` |
| `「ダッシュボード」が見えることを確認` | `{ action: "assert", target: "ダッシュボード" }` |

### セレクタ解決優先度

1. `data-testid="..."`
2. ARIAロール指定（例: `role=button[name=送信]`）
3. 表示テキスト完全一致
4. CSSセレクタ（`css=`プレフィックス、または `#id`, `.class` 等）

## 実行成果物

各実行は `./artifacts/{runId}/` 以下に保存されます。

- `screenshot.png` – 実行完了時のスクリーンショット
- `video/` – ステップ全体の動画（WebM）
- `network.har` – HAR形式のネットワークログ
- `log.jsonl` – ステップごとのログ
- `result.json` – 実行結果JSON

## サンプル実行

CLIからサンプルDSLを実行するには以下を参考にしてください。

```bash
npx tsx tests/example.spec.ts
```

※ Playwrightの実行にはブラウザバイナリのインストールが必要です。`npm run playwright:install` を事前に実行してください。

## 今後の拡張アイデア

- セレクタ自己修復（self-healing）
- 並列実行とCI統合（GitHub Actions）
- Slack通知やWebhook連携
- Next.js等によるWeb UIでの結果可視化
- OIDC認証やシークレット管理の強化

## ライセンス

MIT License
