import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_SIZE,
  WIN_LENGTH,
  createEmptyBoard,
  placeStone,
  checkWin,
  isBoardFull,
} from "../src/core/gomoku.js";

describe("createEmptyBoard", () => {
  test("produces a square board filled with null", () => {
    const board = createEmptyBoard();
    assert.equal(board.length, BOARD_SIZE);
    board.forEach((row) => {
      assert.equal(row.length, BOARD_SIZE);
      row.forEach((cell) => {
        assert.equal(cell, null);
      });
    });
  });

  test("accepts a custom size", () => {
    const board = createEmptyBoard(3);
    assert.equal(board.length, 3);
    board.forEach((row) => assert.equal(row.length, 3));
  });
});

describe("placeStone", () => {
  test("places a stone for the given player", () => {
    const board = createEmptyBoard(5);
    placeStone(board, 2, 2, "black");
    assert.equal(board[2][2], "black");
  });

  test("throws if cell already occupied", () => {
    const board = createEmptyBoard(5);
    placeStone(board, 0, 0, "black");
    assert.throws(() => placeStone(board, 0, 0, "white"));
  });
});

describe("checkWin", () => {
  test("detects a horizontal win", () => {
    const board = createEmptyBoard();
    const row = 7;
    for (let col = 3; col < 3 + WIN_LENGTH; col += 1) {
      placeStone(board, row, col, "black");
    }
    const win = checkWin(board, row, 3 + WIN_LENGTH - 1);
    assert.ok(win);
    assert.deepEqual(win, [
      [row, 3],
      [row, 4],
      [row, 5],
      [row, 6],
      [row, 7],
    ]);
  });

  test("returns null when there is no win", () => {
    const board = createEmptyBoard();
    placeStone(board, 0, 0, "black");
    placeStone(board, 0, 1, "white");
    const win = checkWin(board, 0, 1);
    assert.equal(win, null);
  });
});

describe("isBoardFull", () => {
  test("detects when the board is full", () => {
    const board = createEmptyBoard(2);
    placeStone(board, 0, 0, "black");
    placeStone(board, 0, 1, "white");
    placeStone(board, 1, 0, "black");
    placeStone(board, 1, 1, "white");
    assert.equal(isBoardFull(board), true);
  });

  test("detects when the board still has empty cells", () => {
    const board = createEmptyBoard(2);
    placeStone(board, 0, 0, "black");
    assert.equal(isBoardFull(board), false);
  });
});
