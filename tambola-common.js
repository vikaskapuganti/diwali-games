// Shared by the Tambola host and player pages.
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const PRIZES = [
  { id: "top", name: "Top Line", row: 0 },
  { id: "middle", name: "Middle Line", row: 1 },
  { id: "bottom", name: "Bottom Line", row: 2 },
  { id: "fh1", name: "1st Full House" },
  { id: "fh2", name: "2nd Full House" },
  { id: "fh3", name: "3rd Full House" },
];
const FULL_HOUSES = ["fh1", "fh2", "fh3"];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Standard ticket: 3 rows x 9 columns, 5 numbers per row, 15 in total.
// Column 1 holds 1-9, column 2 holds 10-19, ... column 9 holds 80-90.
// Returned as a comma-separated string of 27 cells (0 = blank), row by row.
function makeTicket() {
  let grid;
  for (;;) {
    grid = [0, 1, 2].map(() => {
      const row = Array(9).fill(false);
      shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 5).forEach((c) => (row[c] = true));
      return row;
    });
    if ([...Array(9).keys()].every((c) => grid.some((r) => r[c]))) break;
  }
  const cells = Array(27).fill(0);
  for (let c = 0; c < 9; c++) {
    const lo = c === 0 ? 1 : c * 10;
    const hi = c === 8 ? 90 : c * 10 + 9;
    const rows = [0, 1, 2].filter((r) => grid[r][c]);
    const pool = [];
    for (let n = lo; n <= hi; n++) pool.push(n);
    const picks = shuffle(pool).slice(0, rows.length).sort((a, b) => a - b);
    rows.forEach((r, i) => (cells[r * 9 + c] = picks[i]));
  }
  return cells.join(",");
}

const parseTicket = (s) => String(s || "").split(",").map(Number);
const rowNumbers = (cells, r) => cells.slice(r * 9, r * 9 + 9).filter((n) => n > 0);
const allNumbers = (cells) => cells.filter((n) => n > 0);

function prizeNumbers(cells, prizeId) {
  const p = PRIZES.find((x) => x.id === prizeId);
  return p && p.row !== undefined ? rowNumbers(cells, p.row) : allNumbers(cells);
}

// A claim is valid when every number it needs has been called.
function validClaim(ticketStr, called, prizeId) {
  const set = new Set(called || []);
  return prizeNumbers(parseTicket(ticketStr), prizeId).every((n) => set.has(n));
}

function callLine(n) {
  return (window.CALLS && CALLS[n]) || "";
}
