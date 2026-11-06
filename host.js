// Host screen: runs on the laptop connected to the projector.
let code = null, meta = null, players = {}, answers = {};
let unsubs = [], ansUnsub = null, ansQ = null;
let busy = false, history = [], qrCache = {};

const badge = $("#badge");
badge.textContent = store.live ? "LIVE" : "DEMO MODE";
badge.className = "badge " + (store.live ? "live" : "demo");

const roomPath = (p) => `rooms/${code}${p ? "/" + p : ""}`;
const joinUrl = () => {
  const u = new URL("index.html", location.href);
  u.search = "?room=" + code;
  return u.href;
};
const nPlayers = () => Object.keys(players).length;
const nAnswered = () => Object.keys(answers).filter((id) => players[id]).length;

function newCode() {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

async function createRoom(mode) {
  code = newCode();
  while (await store.get(`rooms/${code}/meta`)) code = newCode();
  await store.set(`rooms/${code}`, { meta: { mode, state: "lobby", round: 0, qIndex: -1, createdAt: store.TS } });
  localStorage.setItem("rtihQuizHost", code);
  history = [];
  connect();
}

function connect() {
  unsubs.forEach((f) => f());
  unsubs = [];
  unsubs.push(store.watch(roomPath("meta"), (v) => { meta = v; syncAnswers(); render(); }));
  unsubs.push(store.watch(roomPath("players"), (v) => { players = v || {}; render(); }));
}

function syncAnswers() {
  const q = meta ? meta.qIndex : -1;
  if (q === ansQ) return;
  if (ansUnsub) ansUnsub();
  ansQ = q; answers = {}; ansUnsub = null;
  if (q >= 0) ansUnsub = store.watch(roomPath("answers/q" + q), (v) => { answers = v || {}; render(); });
}

// ---------- state changes ----------
function setMeta(fields) {
  history.push(JSON.parse(JSON.stringify(meta)));
  const u = {};
  for (const k in fields) u[roomPath("meta/" + k)] = fields[k];
  return store.update(u);
}

function startQuestion(qi) {
  return setMeta({ state: "question", qIndex: qi, round: FLAT[qi].round, qStart: store.TS });
}

async function reveal() {
  if (busy || !meta || meta.state !== "question") return;
  busy = true;
  try {
    const qi = meta.qIndex;
    if (!(meta.scored && meta.scored["q" + qi])) {
      const ans = (await store.get(roomPath("answers/q" + qi))) || {};
      const q = FLAT[qi];
      const dbl = QUIZ.rounds[q.round].double;
      const u = {};
      for (const id in players) {
        const a = ans[id];
        const correct = !!a && a.choice === q.answer;
        const gain = correct ? pointsFor(a.at, meta.qStart, dbl) : 0;
        u[roomPath(`players/${id}/score`)] = (players[id].score || 0) + gain;
        // total answering time on correct answers breaks ties (faster wins)
        if (gain > 0) u[roomPath(`players/${id}/time`)] = (players[id].time || 0) + Math.max(0, a.at - meta.qStart);
        u[roomPath(`players/${id}/last`)] = { q: qi, gain, correct: correct && gain > 0, answered: !!a };
      }
      u[roomPath("meta/scored/q" + qi)] = true;
      await store.update(u);
    }
    await setMeta({ state: "reveal" });
  } finally {
    busy = false;
  }
}

function next() {
  if (!meta) return;
  const s = meta.state;
  if (s === "lobby") return setMeta({ state: "roundIntro", round: 0 });
  if (s === "roundIntro") return startQuestion(FLAT.findIndex((f) => f.round === meta.round));
  if (s === "question") return reveal();
  if (s === "reveal") {
    const q = FLAT[meta.qIndex];
    if (q.num < q.total) return startQuestion(meta.qIndex + 1);
    if (q.round < QUIZ.rounds.length - 1) return setMeta({ state: "leaderboard" });
    return setMeta({ state: "final" });
  }
  if (s === "leaderboard") return setMeta({ state: "roundIntro", round: meta.round + 1 });
}

function back() {
  const prev = history.pop();
  if (!prev) return;
  // never restart a timer when going back: show that question's answer instead
  if (prev.state === "question") prev.state = "reveal";
  prev.scored = meta.scored || null;
  store.set(roomPath("meta"), prev);
}

function newGame() {
  if (meta && meta.state !== "final" && meta.state !== "lobby" && !confirm("End this game and start a new one?")) return;
  unsubs.forEach((f) => f()); unsubs = [];
  if (ansUnsub) ansUnsub();
  ansUnsub = null; ansQ = null;
  code = null; meta = null; players = {}; answers = {}; history = [];
  localStorage.removeItem("rtihQuizHost");
  render();
}

// ---------- screens ----------
function qrFor(url) {
  if (qrCache[url]) return qrCache[url];
  if (typeof qrcode === "undefined") return "";
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  qrCache[url] = qr.createDataURL(12, 2);
  return qrCache[url];
}

const DIYA = `<svg class="diya" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M32 6c5 8 8 13 8 18a8 8 0 0 1-16 0c0-5 3-10 8-18z" fill="#ffb627"/>
  <path d="M32 14c2.5 4 4 7 4 10a4 4 0 0 1-8 0c0-3 1.5-6 4-10z" fill="#fff3c4"/>
  <path d="M6 36h52c-2 12-12 20-26 20S8 48 6 36z" fill="#ff7a1a"/>
  <path d="M10 36h44" stroke="#a5440b" stroke-width="3" stroke-linecap="round"/></svg>`;

function screenSetup(saved) {
  return `<div class="center">
    ${DIYA}
    <h1 class="title-xl">${esc(QUIZ.title)}</h1>
    <p class="sub">${QUIZ.rounds.length} rounds · ${FLAT.length} questions</p>
    <div class="mode-pick">
      <button class="mode-card" data-mode="solo"><b>Solo</b><span>Everyone plays on their own phone. Top 10 players on the leaderboard.</span></button>
      <button class="mode-card" data-mode="team"><b>Team</b><span>One phone per team. Teams compete on the leaderboard.</span></button>
    </div>
    ${saved ? `<p class="sub" style="margin-top:3vh">Unfinished game found: <b>${esc(saved)}</b> &nbsp;<button class="btn ghost" id="resume">Resume it</button></p>` : ""}
  </div>`;
}

function screenLobby() {
  const url = joinUrl();
  const list = Object.values(players).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  const word = meta.mode === "team" ? "teams" : "players";
  return `<div class="lobby">
      <div>
        <h1 class="title-xl">${esc(QUIZ.title)}</h1>
        <p class="sub">${meta.mode === "team" ? "Team mode: one phone per team" : "Solo mode: everyone plays on their own phone"}</p>
        <div class="code">Scan the QR code, or open the link and enter the code<span>${esc(code)}</span></div>
        <div class="url">${esc(url)}</div>
        ${shareButtons()}
      </div>
      <div class="qr"><img alt="QR code to join" src="${qrFor(url)}"></div>
    </div>
    <div class="joined">
      <h3>${list.length} ${list.length === 1 ? word.slice(0, -1) : word} joined</h3>
      <div class="chips">${list.map((p) => `<span class="chip">${esc(p.name)}</span>`).join("")}</div>
    </div>`;
}

function screenRoundIntro() {
  const r = QUIZ.rounds[meta.round];
  return `<div class="center">
    <p class="sub">Round ${meta.round + 1} of ${QUIZ.rounds.length}</p>
    <h1 class="title-xl">${esc(r.title)}</h1>
    <p class="sub">${r.questions.length} questions${r.double ? " · <b style='color:var(--orange)'>Double points</b>" : ""}</p>
  </div>`;
}

function optionTiles(q, showAnswer) {
  const counts = [0, 0, 0, 0];
  Object.values(answers).forEach((a) => { if (a && counts[a.choice] !== undefined) counts[a.choice]++; });
  const total = Math.max(1, counts.reduce((x, y) => x + y, 0));
  return `<div class="options">${q.options.map((o, i) => {
    const cls = showAnswer ? (i === q.answer ? "correct" : "dim") : "";
    const bar = showAnswer ? `<i class="bar" style="width:${(counts[i] / total) * 100}%"></i>` : "";
    const cnt = showAnswer ? `<span class="count">${counts[i]}</span>` : "";
    return `<div class="opt o${LETTERS[i]} ${cls}">${bar}<span class="letter">${LETTERS[i]}</span><span class="txt">${esc(o)}</span>${cnt}</div>`;
  }).join("")}</div>`;
}

function screenQuestion(showAnswer) {
  const q = FLAT[meta.qIndex];
  const r = QUIZ.rounds[q.round];
  const who = (meta.mode === "team" ? "team" : "player") + (nPlayers() === 1 ? "" : "s");
  return `<div class="qhead">
      <div class="where">Round ${q.round + 1}: <b>${esc(r.title)}</b>${r.double ? '<span class="pill2x">2x points</span>' : ""}<br>Question ${q.num} of ${q.total}</div>
      ${showAnswer ? "" : `<div class="timer up" id="timer"><span id="tnum">0</span></div>`}
    </div>
    <div class="question">${esc(q.q)}</div>
    ${optionTiles(q, showAnswer)}
    <div class="answered">${showAnswer
      ? `Correct answer: <b>${LETTERS[q.answer]}. ${esc(q.options[q.answer])}</b>`
      : `<b>${nAnswered()}</b> of ${nPlayers()} ${who} answered`}</div>
    ${showAnswer ? "" : answerChips()}`;
}

// Everyone's name, lit up once they have answered (never shows what they picked)
function answerChips() {
  const list = Object.entries(players).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  return `<div class="anschips">${list.map(([id, p]) =>
    `<span class="${answers[id] ? "done" : ""}">${esc(p.name)}</span>`).join("")}</div>`;
}

function boardRows(list) {
  return list.map((p, i) => `<div class="row ${i === 0 ? "top1" : ""}" style="animation-delay:${i * 60}ms">
      <span class="r">${i + 1}</span><span>${esc(p.name)}</span><span class="s">${p.score}</span></div>`).join("");
}

function screenLeaderboard() {
  const list = ranking(players).slice(0, 10);
  return `<div style="text-align:center">
      <p class="sub">After Round ${meta.round + 1} of ${QUIZ.rounds.length}</p>
      <h1 class="title-xl" style="font-size:clamp(32px,4.5vw,72px)">Leaderboard</h1>
    </div>
    <div class="board">${boardRows(list) || '<p class="sub" style="text-align:center">No scores yet</p>'}</div>`;
}

function screenFinal() {
  const list = ranking(players);
  const top = [list[1], list[0], list[2]];
  const cls = ["p2", "p1", "p3"], nums = [2, 1, 3];
  return `<div style="text-align:center">
      ${DIYA}
      <h1 class="title-xl" style="font-size:clamp(32px,4.5vw,72px)">Winners</h1>
    </div>
    <div class="podium">${top.map((p, i) => p ? `<div class="step ${cls[i]}">
        <div class="name">${esc(p.name)}</div><div class="pts">${p.score} points</div>
        <div class="block">${nums[i]}</div></div>` : "").join("")}</div>
    ${list.length > 3 ? `<div class="board" style="max-width:800px">${list.slice(3, 10).map((p, i) => `<div class="row"><span class="r">${i + 4}</span><span>${esc(p.name)}</span><span class="s">${p.score}</span></div>`).join("")}</div>` : ""}`;
}

// ---------- controls ----------
function controls() {
  if (!meta) return "";
  const s = meta.state;
  const canBack = history.length > 0;
  const backBtn = `<button class="btn ghost" id="back" ${canBack ? "" : "disabled"}>Back</button>`;
  const left = `<span class="info">Room ${esc(code)} · ${nPlayers()} ${meta.mode === "team" ? "teams" : "players"}</span><span class="spacer"></span>`;
  const full = `<button class="btn ghost" id="full">Full screen</button>`;
  let main = "";
  if (s === "lobby") main = `<button class="btn" id="next" ${nPlayers() ? "" : "disabled"}>Start quiz</button>`;
  if (s === "roundIntro") main = `${backBtn}<button class="btn" id="next">Start round ${meta.round + 1}</button>`;
  if (s === "question") main = `<button class="btn" id="next">Reveal answer</button>`;
  if (s === "reveal") {
    const q = FLAT[meta.qIndex];
    const label = q.num < q.total ? "Next question" : q.round < QUIZ.rounds.length - 1 ? "Show leaderboard" : "Show winners";
    main = `${backBtn}<button class="btn" id="next">${label}</button>`;
  }
  if (s === "leaderboard") main = `${backBtn}<button class="btn" id="next">Next round</button>`;
  if (s === "final") main = `${backBtn}`;
  return `${left}${main}${full}<button class="btn ghost" id="new">New game</button>`;
}

function render() {
  const scr = $("#screen"), ctl = $("#controls");
  if (!code) {
    scr.innerHTML = screenSetup(localStorage.getItem("rtihQuizHost"));
    ctl.innerHTML = "";
    scr.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => createRoom(b.dataset.mode)));
    const r = $("#resume");
    if (r) r.onclick = () => { code = localStorage.getItem("rtihQuizHost"); history = []; connect(); };
    return;
  }
  if (!meta) { scr.innerHTML = `<div class="center"><p class="sub">Connecting...</p></div>`; ctl.innerHTML = ""; return; }
  const s = meta.state;
  // a finished game no longer needs the Resume option
  if (s === "final" && localStorage.getItem("rtihQuizHost") === code) localStorage.removeItem("rtihQuizHost");
  scr.innerHTML =
    s === "lobby" ? screenLobby() :
    s === "roundIntro" ? screenRoundIntro() :
    s === "question" ? screenQuestion(false) :
    s === "reveal" ? screenQuestion(true) :
    s === "leaderboard" ? screenLeaderboard() :
    screenFinal();
  ctl.innerHTML = controls();
  const on = (id, fn) => { const el = $("#" + id); if (el) el.onclick = fn; };
  on("next", next);
  on("back", back);
  on("new", newGame);
  if (meta && meta.state === "lobby") wireShare(`Join the Diwali Quiz on your phone: ${joinUrl()}\nGame code: ${code}`);
  on("full", () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()));
  tick();
}

// ---------- timer ----------
function tick() {
  if (!meta || meta.state !== "question" || typeof meta.qStart !== "number") return;
  // count-up clock only; the answer is revealed when the host presses the button
  const t = $("#timer");
  if (t) {
    $("#tnum").textContent = Math.max(0, Math.floor((store.now() - meta.qStart) / 1000));
  }
}
setInterval(tick, 200);

// keyboard: right arrow or space = next, left arrow = back
document.addEventListener("keydown", (e) => {
  if (!meta) return;
  if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); const b = $("#next"); if (b && !b.disabled) next(); }
  if (e.key === "ArrowLeft") { const b = $("#back"); if (b && !b.disabled) back(); }
});

// ---------- share the join link (WhatsApp / copy) ----------
let copiedUntil = 0;
function shareButtons() {
  const copied = Date.now() < copiedUntil;
  return `<div class="share">
      <button class="btn" id="shareWa">Share on WhatsApp</button>
      <button class="btn ghost" id="copyLink">${copied ? "Link copied" : "Copy link"}</button>
    </div>`;
}
function wireShare(message) {
  const wa = document.getElementById("shareWa");
  if (wa) wa.onclick = () => window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank");
  const cp = document.getElementById("copyLink");
  if (cp) cp.onclick = async () => {
    const link = joinUrl();
    try { await navigator.clipboard.writeText(link); }
    catch (e) {
      const t = document.createElement("textarea");
      t.value = link; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch (e2) {}
      t.remove();
    }
    copiedUntil = Date.now() + 2500;
    render();
    setTimeout(render, 2600);
  };
}

// On load, drop a remembered game that has finished or no longer exists
(async () => {
  const saved = localStorage.getItem("rtihQuizHost");
  if (!saved) return;
  const m = await store.get(`rooms/${saved}/meta`);
  if (!m || m.state === "final") { localStorage.removeItem("rtihQuizHost"); if (!code) render(); }
})();

render();
