import { defineConfig } from "@playwright/test";

// Playwright が起動するローカル静的サーバのポートとベースURL
const port = Number(process.env.PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e", // E2E テストの配置ディレクトリ
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"]], // ローカルでは list レポータ
  use: {
    baseURL,
    trace: "on-first-retry", // 失敗時にトレースを採取
    headless: true,
  },
  webServer: {
    command: "node scripts/dev-server.mjs", // 簡易静的サーバ起動コマンド
    url: baseURL,                           // ヘルスチェック先
    reuseExistingServer: !process.env.CI,   // 既存サーバがあれば再利用
    timeout: 30000,
  },
});
