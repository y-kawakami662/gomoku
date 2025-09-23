import {
  BOARD_SIZE,
  createEmptyBoard,
  checkWin,
  isBoardFull,
} from "./gomoku.js";

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

function pickRandomMove(moves) {
  if (moves.length === 0) return null;
  const idx = Math.floor(Math.random() * moves.length);
  return moves[idx];
}

function maybeAIMove() {
  if (!vsAI || gameOver || currentPlayer !== aiPlayer) return;
  aiThinking = true;
  setTimeout(() => {
    const moves = getAvailableMoves();
    const choice = pickRandomMove(moves);
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
