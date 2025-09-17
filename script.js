import {
  BOARD_SIZE,
  createEmptyBoard,
  checkWin,
  isBoardFull,
} from "./gomoku.js";

let boardElement;
let statusElement;
let resetButton;
let boardState = [];
let currentPlayer = "black";
let gameOver = false;

function init() {
  boardElement = document.getElementById("board");
  statusElement = document.getElementById("status");
  resetButton = document.getElementById("reset");

  if (!boardElement || !statusElement || !resetButton) {
    console.error("五目並べの要素が見つかりません。HTML を確認してください。");
    return;
  }

  boardElement.style.setProperty("--board-size", String(BOARD_SIZE));
  resetButton.addEventListener("click", resetGame);
  resetGame();
}

function resetGame() {
  boardState = createEmptyBoard(BOARD_SIZE);
  currentPlayer = "black";
  gameOver = false;
  statusElement.textContent = `${playerLabel(currentPlayer)}の番です`;
  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      boardElement.appendChild(createCell(row, col));
    }
  }
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
  cell.addEventListener("click", () => handleMove(row, col, cell));
  return cell;
}

function handleMove(row, col, cell) {
  if (gameOver || boardState[row][col]) {
    return;
  }

  boardState[row][col] = currentPlayer;
  cell.classList.add(currentPlayer);
  cell.dataset.filled = "true";
  setCellLabel(cell, currentPlayer);

  const winningLine = checkWin(boardState, row, col);
  if (winningLine) {
    highlightWin(winningLine);
    statusElement.textContent = `${playerLabel(currentPlayer)}の勝ちです`;
    gameOver = true;
    return;
  }

  if (isBoardFull(boardState)) {
    statusElement.textContent = "引き分けです";
    gameOver = true;
    return;
  }

  currentPlayer = currentPlayer === "black" ? "white" : "black";
  statusElement.textContent = `${playerLabel(currentPlayer)}の番です`;
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
