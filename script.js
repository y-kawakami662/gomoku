import {
  BOARD_SIZE,
  createEmptyBoard,
  checkWin,
  isBoardFull,
} from "./gomoku.js";

// Additional import for AI heuristics
import { gatherLine } from "./gomoku.js";

let boardElement;
let statusElement;
let resetButton;
let aiToggle;
let boardState = [];
let currentPlayer = "black";
let gameOver = false;
let vsAI = false;
const aiPlayer = "white"; // AI は白固定
let aiThinking = false;

function init() {
  boardElement = document.getElementById("board");
  statusElement = document.getElementById("status");
  resetButton = document.getElementById("reset");
  aiToggle = document.getElementById("aiToggle");

  if (!boardElement || !statusElement || !resetButton) {
    console.error("五目並べの要素が見つかりません。HTML を確認してください。");
    return;
  }

  boardElement.style.setProperty("--board-size", String(BOARD_SIZE));
  resetButton.addEventListener("click", resetGame);
  if (aiToggle) {
    aiToggle.addEventListener("change", () => {
      vsAI = aiToggle.checked;
      resetGame();
    });
    vsAI = aiToggle.checked;
  }
  resetGame();
}

function resetGame() {
  boardState = createEmptyBoard(BOARD_SIZE);
  currentPlayer = "black";
  gameOver = false;
  aiThinking = false;
  if (aiToggle) {
    vsAI = aiToggle.checked;
  }
  statusElement.textContent = `${playerLabel(currentPlayer)}の番です`;
  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      boardElement.appendChild(createCell(row, col));
    }
  }

  // 先手は黒なので、AI が白固定の限りここでの自動手は不要
}

function createCell(row, col) {
  const cell = document.createElement("button");
  cell.className = "cell";
  cell.type = "button";
  cell.dataset.row = String(row);
  cell.dataset.col = String(col);
  cell.dataset.filled = "false";
  cell.setAttribute("role", "gridcell");
  setCellLabel(cell, null);
  cell.addEventListener("click", () => handleCellClick(row, col));
  return cell;
}

function handleCellClick(row, col) {
  if (aiThinking) return;
  if (vsAI && currentPlayer === aiPlayer) return; // AI の手番中は無効
  applyMove(row, col);
  maybeAIMove();
}

function applyMove(row, col) {
  if (gameOver || boardState[row][col]) {
    return false;
  }

  const cell = selectCellElement(row, col);
  if (!cell) return false;

  boardState[row][col] = currentPlayer;
  cell.classList.add(currentPlayer);
  cell.dataset.filled = "true";
  setCellLabel(cell, currentPlayer);

  const winningLine = checkWin(boardState, row, col);
  if (winningLine) {
    highlightWin(winningLine);
    statusElement.textContent = `${playerLabel(currentPlayer)}の勝ちです`;
    gameOver = true;
    return true;
  }

  if (isBoardFull(boardState)) {
    statusElement.textContent = "引き分けです";
    gameOver = true;
    return true;
  }

  currentPlayer = currentPlayer === "black" ? "white" : "black";
  statusElement.textContent = `${playerLabel(currentPlayer)}の番です`;
  return true;
}

function highlightWin(cells) {
  cells.forEach(([cellRow, cellCol]) => {
    const selector = `.cell[data-row="${cellRow}"][data-col="${cellCol}"]`;
    const target = boardElement.querySelector(selector);
    if (target) {
      target.classList.add("win");
    }
  });
}

function playerLabel(player) {
  return player === "black" ? "黒" : "白";
}

function setCellLabel(cell, player) {
  const row = Number(cell.dataset.row) + 1;
  const col = Number(cell.dataset.col) + 1;
  if (!player) {
    cell.setAttribute("aria-label", `${row} 行 ${col} 列：空き`);
    return;
  }
  const stone = player === "black" ? "黒石" : "白石";
  cell.setAttribute("aria-label", `${row} 行 ${col} 列：${stone}`);
}

function selectCellElement(row, col) {
  return boardElement.querySelector(
    `.cell[data-row="${row}"][data-col="${col}"]`
  );
}

function getAvailableMoves() {
  const moves = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (!boardState[r][c]) moves.push([r, c]);
    }
  }
  return moves;
}

function simulateWinAt(row, col, player) {
  boardState[row][col] = player;
  const win = checkWin(boardState, row, col);
  boardState[row][col] = null;
  return Boolean(win);
}

function evaluateMove(row, col) {
  const mid = (BOARD_SIZE - 1) / 2;
  let score = 0;

  // Offensive: place as AI and measure lines
  boardState[row][col] = aiPlayer;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (const [dr, dc] of dirs) {
    const line = gatherLine(boardState, row, col, dr, dc, aiPlayer);
    const len = line.length;
    score += len * len * 10;
  }
  boardState[row][col] = null;

  // Defensive: if opponent were here, how strong would it be?
  const opponent = "black";
  boardState[row][col] = opponent;
  for (const [dr, dc] of dirs) {
    const line = gatherLine(boardState, row, col, dr, dc, opponent);
    const len = line.length;
    score += len * len * 7;
  }
  boardState[row][col] = null;

  // Prefer center
  const dist = Math.abs(row - mid) + Math.abs(col - mid);
  score += Math.max(0, 10 - dist);

  return score;
}

function chooseAIMove() {
  const moves = getAvailableMoves();
  if (moves.length === 0) return null;

  // 1) Try to win now
  for (const [r, c] of moves) {
    if (simulateWinAt(r, c, aiPlayer)) return [r, c];
  }

  // 2) Block opponent's immediate win
  for (const [r, c] of moves) {
    if (simulateWinAt(r, c, "black")) return [r, c];
  }

  // 3) Heuristic scoring
  let best = null;
  let bestScore = -Infinity;
  for (const [r, c] of moves) {
    const s = evaluateMove(r, c);
    if (s > bestScore) {
      bestScore = s;
      best = [r, c];
    }
  }
  return best;
}

function maybeAIMove() {
  if (!vsAI || gameOver || currentPlayer !== aiPlayer) return;
  aiThinking = true;
  setTimeout(() => {
    const choice = chooseAIMove();
    if (choice) {
      const [r, c] = choice;
      applyMove(r, c);
    }
    aiThinking = false;
  }, 200);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
