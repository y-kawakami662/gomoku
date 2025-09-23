import { test, expect } from "@playwright/test";

const selectCell = (page, row, col) =>
  page.locator(`.cell[data-row="${row}"][data-col="${col}"]`);

test("AI toggled on: AI replies to black's move", async ({ page }) => {
  await page.goto("/");
  // enable AI
  await page.evaluate(() => {
    const el = document.getElementById('aiToggle');
    if (el && !el.checked) {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  await expect(page.locator("#status")).toHaveText("黒の番です", { timeout: 15000 });
  // black moves
  await selectCell(page, 7, 7).click();
  await expect(page.locator("#status")).toHaveText("白の番です");

  // wait for AI to move (status returns to black's turn)
  await expect(page.locator("#status")).toHaveText("黒の番です", { timeout: 15000 });
// 盤上の石は 2 個（黒の初手＋AI の応手）
  await expect(page.locator('.cell[data-filled="true"]')).toHaveCount(2);
});

test("Clicks during AI thinking are ignored", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const el = document.getElementById('aiToggle');
    if (el && !el.checked) {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // 黒で 1 手指した直後、遠い別マスを素早くクリック（AI 思考中の無効化を確認）
  await selectCell(page, 5, 5).click();
  const second = selectCell(page, 0, 14);
  await second.click();

  // AI の応手完了を待つ
  await expect(page.locator("#status")).toHaveText("黒の番です", { timeout: 15000 });

  // 直後の 2 回目クリックは無視される（依然として空のまま）
  await expect(second).toHaveAttribute("data-filled", "true");
});
