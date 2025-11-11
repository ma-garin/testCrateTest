// public/app.js
(function () {
  const $ = (s) => document.querySelector(s);

  const sample = {
    intents: [
      { action: "open", url: "https://example.com" },
      { action: "assert", target: "title", expect: "includes", value: "Example Domain" },
      {
        action: "assert",
        target: "selector",
        selector: 'a[href^="https://www.iana.org"]',
        expect: "visible"
      }
    ],
    metadata: { suite: "smoke", name: "example-dom" },
    options: { headless: true, timeoutMs: 30000 }
  };

  const payloadEl = $("#payload");
  const resultEl = $("#result");
  const runBtn = $("#run");

  // 初期表示：サンプルJSONを投入
  payloadEl.value = JSON.stringify(sample, null, 2);

  function show(obj) {
    resultEl.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  async function postRun(bodyJson) {
    const res = await fetch("/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyJson
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}\n${text}`);
    }
    return await res.json();
  }

  runBtn.addEventListener("click", async () => {
    try {
      // JSON構文チェック（ここで失敗するとサーバーに投げない）
      const parsed = JSON.parse(payloadEl.value);
      // サーバーへ送るのはユーザー入力そのまま（整形せず）
      show({ status: "running...", note: "実行中。数秒お待ちください。" });
      const resJson = await postRun(payloadEl.value);
      show(resJson);

      // 補助：/results/:runId がある場合、追跡リンクを表示
      if (resJson.runId) {
        const tip =
          `\n\n補足: 結果の詳細取得 (GET /results/${resJson.runId}) に対応していれば、` +
          `ブラウザで「/results/${resJson.runId}」へアクセス可能です。`;
        resultEl.textContent += tip;
      }
    } catch (e) {
      show(`エラー: ${e.message || e.toString()}`);
    }
  });
})();
