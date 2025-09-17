export const BOARD_SIZE = 15;
export const WIN_LENGTH = 5;

export const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function createEmptyBoard(size = BOARD_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

export function isInside(board, row, col) {
  return (
    row >= 0 &&
    row < board.length &&
    col >= 0 &&
    col < board[row].length
  );
}

export function collectLine(board, row, col, deltaRow, deltaCol, player) {
  const cells = [];
  let nextRow = row + deltaRow;
  let nextCol = col + deltaCol;
  while (isInside(board, nextRow, nextCol) && board[nextRow][nextCol] === player) {
    cells.push([nextRow, nextCol]);
    nextRow += deltaRow;
    nextCol += deltaCol;
  }
  return cells;
}

export function gatherLine(board, row, col, deltaRow, deltaCol, player) {
  const forward = collectLine(board, row, col, deltaRow, deltaCol, player);
  const backward = collectLine(board, row, col, -deltaRow, -deltaCol, player).reverse();
  return [...backward, [row, col], ...forward];
}

export function checkWin(board, row, col, winLength = WIN_LENGTH) {
  const player = board[row][col];
  if (!player) {
    return null;
  }

  for (const [deltaRow, deltaCol] of DIRECTIONS) {
    const line = gatherLine(board, row, col, deltaRow, deltaCol, player);
    if (line.length >= winLength) {
      return line;
    }
  }

  return null;
}

export function isBoardFull(board) {
  return board.every((row) => row.every(Boolean));
}

export function placeStone(board, row, col, player) {
  if (!isInside(board, row, col)) {
    throw new RangeError(`Cell (${row}, ${col}) is outside the board.`);
  }
  if (board[row][col]) {
    throw new Error(`Cell (${row}, ${col}) is already occupied.`);
  }
  board[row][col] = player;
  return board;
}
