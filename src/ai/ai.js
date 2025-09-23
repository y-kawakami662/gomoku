import { BOARD_SIZE, checkWin, gatherLine } from "../core/gomoku.js";

// まだ石が置かれていないマスの一覧を返す
function getAvailableMoves(board) {
  const moves = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (!board[r][c]) moves.push([r, c]);
    }
  }
  return moves;
}

// 指定マスに仮置きして勝てるかを判定（直後に元へ戻す）
function simulateWinAt(board, row, col, player) {
  board[row][col] = player;
  const win = checkWin(board, row, col);
  board[row][col] = null;
  return Boolean(win);
}

// 与えられた着点の評価値を計算（攻守と中心寄りの重み付け）
function evaluateMove(board, row, col, aiPlayer) {
  const mid = (BOARD_SIZE - 1) / 2;
  let score = 0;

  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  // 攻め: AI 自身として仮置きし、連の長さを評価
  board[row][col] = aiPlayer;
  for (const [dr, dc] of dirs) {
    const line = gatherLine(board, row, col, dr, dc, aiPlayer);
    const len = line.length;
    score += len * len * 10;
  }
  board[row][col] = null;

  // 守り: 相手がここに置いた場合の強さを見積もる（ブロック優先度）
  const opponent = aiPlayer === "black" ? "white" : "black";
  board[row][col] = opponent;
  for (const [dr, dc] of dirs) {
    const line = gatherLine(board, row, col, dr, dc, opponent);
    const len = line.length;
    score += len * len * 7;
  }
  board[row][col] = null;

  // 中央寄りを優先（マンハッタン距離で減点）
  const dist = Math.abs(row - mid) + Math.abs(col - mid);
  score += Math.max(0, 10 - dist);

  return score;
}

// 現局面での AI の最善手を返す
export function chooseAIMove(board, aiPlayer = "white") {
  const moves = getAvailableMoves(board);
  if (moves.length === 0) return null;

  // 1) その場で勝てる手があれば最優先
  for (const [r, c] of moves) {
    if (simulateWinAt(board, r, c, aiPlayer)) return [r, c];
  }

  // 2) 相手の即勝をブロック
  const opponent = aiPlayer === "black" ? "white" : "black";
  for (const [r, c] of moves) {
    if (simulateWinAt(board, r, c, opponent)) return [r, c];
  }

  // 3) ヒューリスティック評価に基づくスコア最大の手
  let best = null;
  let bestScore = -Infinity;
  for (const [r, c] of moves) {
    const s = evaluateMove(board, r, c, aiPlayer);
    if (s > bestScore) {
      bestScore = s;
      best = [r, c];
    }
  }
  return best;
}
