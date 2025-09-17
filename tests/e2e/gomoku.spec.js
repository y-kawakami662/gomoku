import { test, expect } from "@playwright/test";

const selectCell = (page, row, col) =>
  page.locator(`.cell[data-row="${row}"][data-col="${col}"]`);

test("renders the board and allows a black horizontal victory", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#status")).toHaveText("黒の番です");
  await expect(page.locator(".cell")).toHaveCount(225);

  const moveSequence = [
    [7, 3],
    [0, 0],
    [7, 4],
    [0, 1],
    [7, 5],
    [0, 2],
    [7, 6],
    [0, 3],
    [7, 7],
  ];

  for (const [row, col] of moveSequence) {
    await selectCell(page, row, col).click();
  }

  await expect(page.locator("#status")).toHaveText("黒の勝ちです");
  await expect(page.locator(".cell.win")).toHaveCount(5);
  await expect(selectCell(page, 7, 7)).toHaveAttribute("data-filled", "true");
});

test("resets the game state", async ({ page }) => {
  await page.goto("/");

  await selectCell(page, 5, 5).click();
  await selectCell(page, 5, 6).click();
  await expect(selectCell(page, 5, 5)).toHaveClass(/black/);

  await page.getByRole("button", { name: "リセット" }).click();

  await expect(page.locator("#status")).toHaveText("黒の番です");
  await expect(selectCell(page, 5, 5)).not.toHaveClass(/black|white/);
  await expect(selectCell(page, 5, 5)).toHaveAttribute("data-filled", "false");
});
