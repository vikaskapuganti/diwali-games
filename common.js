// Helpers shared by the host and player pages.
const BONUS_MS = QUIZ.bonusWindowSec * 1000;
const LETTERS = ["A", "B", "C", "D"];
const FLAT = [];
QUIZ.rounds.forEach((r, ri) =>
  r.questions.forEach((q, qi) => FLAT.push({ ...q, round: ri, num: qi + 1, total: r.questions.length }))
);
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function ranking(players) {
  return Object.entries(players || {})
    .map(([id, p]) => ({ id, name: p.name, score: p.score || 0, time: p.time || 0, joinedAt: p.joinedAt || 0 }))
    // same score: whoever answered faster overall ranks higher
    .sort((a, b) => b.score - a.score || a.time - b.time || a.joinedAt - b.joinedAt);
}
function rankOf(players, id) {
  const list = ranking(players);
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return null;
  return { rank: i + 1, of: list.length };
}
function pointsFor(choiceAt, qStart, double) {
  const el = Math.max(0, choiceAt - qStart);
  // a correct answer always scores; answering sooner adds a speed bonus
  const frac = Math.max(0, 1 - el / BONUS_MS);
  return (QUIZ.basePoints + Math.round(QUIZ.speedBonus * frac)) * (double ? 2 : 1);
}
