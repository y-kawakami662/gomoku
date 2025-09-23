export function playerLabel(player) {
  return player === "black" ? "黒" : "白";
}

export function setCellLabel(cell, player) {
  const row = Number(cell.dataset.row) + 1;
  const col = Number(cell.dataset.col) + 1;
  if (!player) {
    cell.setAttribute("aria-label", `${row} 行 ${col} 列：空き`);
    return;
  }
  const stone = player === "black" ? "黒石" : "白石";
  cell.setAttribute("aria-label", `${row} 行 ${col} 列：${stone}`);
}

export function selectCellElement(boardElement, row, col) {
  return boardElement.querySelector(
    `.cell[data-row="${row}"][data-col="${col}"]`
  );
}

export function createCell(row, col, onClick) {
  const cell = document.createElement("button");
  cell.className = "cell";
  cell.type = "button";
  cell.dataset.row = String(row);
  cell.dataset.col = String(col);
  cell.dataset.filled = "false";
  cell.setAttribute("role", "gridcell");
  setCellLabel(cell, null);
  if (typeof onClick === "function") {
    cell.addEventListener("click", () => onClick(row, col));
  }
  return cell;
}

export function highlightWin(boardElement, cells) {
  cells.forEach(([cellRow, cellCol]) => {
    const selector = `.cell[data-row="${cellRow}"][data-col="${cellCol}"]`;
    const target = selectCellElement(boardElement, cellRow, cellCol);
    if (target) {
      target.classList.add("win");
    }
  });
}

