import {
  BOARD_SIZE,
  createEmptyBoard,
  checkWin,
  isBoardFull,
} from "../core/gomoku.js";

import { chooseAIMove } from "../ai/ai.js";
import { playerLabel, setCellLabel, selectCellElement, createCell, highlightWin } from "./dom.js";

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
      boardElement.appendChild(createCell(row, col, handleCellClick));
    }
  }

  // 先手は黒なので、AI が白固定の限りここでの自動手は不要
}

// createCell moved to dom.js

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

  const cell = selectCellElement(boardElement, row, col);
  if (!cell) return false;

  boardState[row][col] = currentPlayer;
  cell.classList.add(currentPlayer);
  cell.dataset.filled = "true";
  setCellLabel(cell, currentPlayer);

  const winningLine = checkWin(boardState, row, col);
  if (winningLine) {
    highlightWin(boardElement, winningLine);
    statusElement.textContent = `${playerLabel(currentPlayer)}の勝ちです`;
    // VRM: 勝敗に応じて表情を切替（AIキャラ想定）
    try {
      if (vsAI && window.vrmFace) {
        if (currentPlayer === aiPlayer && typeof window.vrmFace.smile === "function") {
          // AIが勝利
          window.vrmFace.smile(5000, 0.9);
        } else if (currentPlayer !== aiPlayer && typeof window.vrmFace.sad === "function") {
          // AIが敗北
          window.vrmFace.sad(3000, 0.85);
        }
      }
    } catch (_) {}
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
  // VRM: 手番切り替えのタイミングで口を閉じる（形が残らないように）
  try {
    if (window.vrmTalk && typeof window.vrmTalk.close === "function") {
      window.vrmTalk.close();
    }
  } catch (_) {}
  return true;
}

// highlightWin, playerLabel, setCellLabel, selectCellElement moved to ./dom.js

function maybeAIMove() {
  if (!vsAI || gameOver || currentPlayer !== aiPlayer) return;
  aiThinking = true;
  // VRM: AI の手番中に口パクを少しだけ再生
  try {
    if (window.vrmTalk && typeof window.vrmTalk.start === "function") {
      window.vrmTalk.start(260);
    }
  } catch (_) {}
  setTimeout(() => {
    const start = Date.now();
    const choice = chooseAIMove(boardState, aiPlayer);
    const elapsed = Date.now() - start;
    const wait = Math.max(0, 200 - elapsed);
    (async () => {
      if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
      }
      if (choice) {
      const [r, c] = choice;
      applyMove(r, c);
      }
      aiThinking = false;
    })();
  }, 200);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
