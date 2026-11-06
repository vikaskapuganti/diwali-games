// Player page: what people open on their phones.
let code = null, pid = null, meta = null, me = null, players = {}, myAnswer = null;
let unsubs = [], ansUnsub = null, ansQ = null, joinError = "", sending = false;

if (!store.live) {
  const b = $("#badge");
  b.textContent = "DEMO MODE";
  b.className = "badge demo";
}

const params = new URLSearchParams(location.search);
const roomParam = (params.get("room") || "").toUpperCase();
const SAVE = "rtihQuizPlayer";
// Remember the player so a refresh rejoins the same game. In demo mode each tab
// is a separate player, so use per-tab storage there.
const saveStore = store.live ? localStorage : sessionStorage;
const roomPath = (p) => `rooms/${code}${p ? "/" + p : ""}`;

async function tryResume() {
  let saved = null;
  try { saved = JSON.parse(saveStore.getItem(SAVE)); } catch (e) {}
  if (saved && saved.code && (!roomParam || saved.code === roomParam)) {
    const p = await store.get(`rooms/${saved.code}/players/${saved.pid}`);
    if (p) { code = saved.code; pid = saved.pid; connect(); return; }
  }
  render();
}

async function join(roomCode, name) {
  roomCode = roomCode.trim().toUpperCase();
  name = name.trim().replace(/\s+/g, " ").slice(0, 24);
  if (!roomCode || !name) { joinError = "Enter the room code and a name."; return render(); }
  const m = await store.get(`rooms/${roomCode}/meta`);
  if (!m) { joinError = "No game found with that code. Check the code on the screen."; return render(); }
  if (m.state === "final") { joinError = "This game has already finished."; return render(); }
  code = roomCode;
  pid = "p" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  await store.set(roomPath("players/" + pid), { name, score: 0, joinedAt: store.TS });
  saveStore.setItem(SAVE, JSON.stringify({ code, pid }));
  joinError = "";
  connect();
}

function connect() {
  unsubs.forEach((f) => f());
  unsubs = [
    store.watch(roomPath("meta"), (v) => { meta = v; syncAnswer(); render(); }),
    store.watch(roomPath("players"), (v) => {
      players = v || {};
      me = players[pid] || null;
      if (meta && !me) { leave(); return; }
      render();
    }),
  ];
}

function syncAnswer() {
  const q = meta ? meta.qIndex : -1;
  if (q === ansQ) return;
  if (ansUnsub) ansUnsub();
  ansQ = q; myAnswer = null; ansUnsub = null;
  if (q >= 0) ansUnsub = store.watch(roomPath(`answers/q${q}/${pid}`), (v) => { myAnswer = v; render(); });
}

function leave() {
  unsubs.forEach((f) => f()); unsubs = [];
  if (ansUnsub) ansUnsub();
  ansUnsub = null; ansQ = null;
  code = null; pid = null; meta = null; me = null; players = {};
  saveStore.removeItem(SAVE);
  render();
}

async function answer(choice) {
  if (sending || myAnswer || !meta || meta.state !== "question") return;
  if (typeof meta.qStart === "number" && store.now() > meta.qStart + LIMIT) return;
  sending = true;
  myAnswer = { choice, pending: true };
  render();
  try {
    await store.setIfAbsent(roomPath(`answers/q${meta.qIndex}/${pid}`), { choice, at: store.TS });
  } finally {
    sending = false;
  }
}

// ---------- screens ----------
function stats() {
  const r = rankOf(players, pid);
  return `<div class="stat">
      <div><b>${me ? me.score || 0 : 0}</b><span>points</span></div>
      ${r ? `<div><b>#${r.rank}</b><span>of ${r.of}</span></div>` : ""}
    </div>`;
}

function screenJoin() {
  return `<div class="p-center" style="justify-content:flex-start;padding-top:6vh">
    <div><h1 class="p-title">${esc(QUIZ.title)}</h1><p class="muted" style="margin:0">Join the game on the big screen</p></div>
    <form id="joinForm" style="text-align:left">
      <label class="field"><span>Room code</span>
        <input class="code" id="room" maxlength="4" autocomplete="off" value="${esc(roomParam)}" placeholder="ABCD"></label>
      <label class="field"><span>Your name (or team name in team mode)</span>
        <input id="name" maxlength="24" autocomplete="off" placeholder="Enter a name"></label>
      <div class="err">${esc(joinError)}</div>
      <button class="btn wide" type="submit">Join</button>
    </form>
  </div>`;
}

function screenWait(title, sub) {
  return `<div class="p-center"><div class="card">
      <p class="muted" style="margin:0 0 6px">${me ? esc(me.name) : ""}</p>
      <p class="big">${title}</p>
      <p class="muted" style="margin:8px 0 0">${sub}</p>
    </div>${me && (me.score || meta.state !== "lobby") ? stats() : ""}</div>`;
}

function screenQuestion() {
  const q = FLAT[meta.qIndex];
  const r = QUIZ.rounds[q.round];
  const picked = myAnswer ? myAnswer.choice : null;
  const over = typeof meta.qStart === "number" && store.now() > meta.qStart + LIMIT;
  return `<div class="p-head"><span>Round ${q.round + 1} · Q${q.num} of ${q.total}${r.double ? " · 2x" : ""}</span><span class="p-timer" id="ptimer"></span></div>
    <div class="p-bar"><i id="pbar" style="width:100%"></i></div>
    <p class="p-q">${esc(q.q)}</p>
    <div class="p-opts">${q.options.map((o, i) => {
      const cls = picked === null ? "" : picked === i ? "picked" : "faded";
      return `<button class="p-opt o${LETTERS[i]} ${cls}" data-i="${i}" ${picked !== null || over ? "disabled" : ""}><span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></button>`;
    }).join("")}</div>
    <p class="muted" style="text-align:center;margin-top:16px">${
      picked !== null ? `Answer locked: <b style="color:#fff">${LETTERS[picked]}</b>. Wait for the reveal.` :
      over ? "Time's up" : "Tap your answer. Faster answers score more."}</p>`;
}

function screenReveal() {
  const q = FLAT[meta.qIndex];
  const last = me && me.last && me.last.q === meta.qIndex ? me.last : null;
  let head;
  if (!last) head = `<p class="big">Checking answers...</p>`;
  else if (last.correct) head = `<p class="result ok">Correct!</p><p class="big">+${last.gain} points</p>`;
  else if (last.answered) head = `<p class="result bad">Wrong answer</p>`;
  else head = `<p class="result bad">No answer</p>`;
  return `<div class="p-center"><div class="card">${head}
      <p class="muted" style="margin:12px 0 0">Correct answer: <b style="color:#fff">${LETTERS[q.answer]}. ${esc(q.options[q.answer])}</b></p>
    </div>${stats()}</div>`;
}

function render() {
  const scr = $("#screen");
  if (!code) {
    scr.innerHTML = screenJoin();
    const f = $("#joinForm");
    f.onsubmit = (e) => { e.preventDefault(); f.querySelector("button").disabled = true; join($("#room").value, $("#name").value); };
    (roomParam ? $("#name") : $("#room")).focus();
    return;
  }
  if (!meta || !me) { scr.innerHTML = `<div class="p-center"><p class="muted">Connecting...</p></div>`; return; }
  const s = meta.state;
  if (s === "lobby") scr.innerHTML = screenWait("You're in!", "Wait for the host to start the quiz.");
  else if (s === "roundIntro") {
    const r = QUIZ.rounds[meta.round];
    scr.innerHTML = screenWait(`Round ${meta.round + 1}: ${esc(r.title)}`, r.double ? "Double points this round. Get ready!" : "Get ready!");
  }
  else if (s === "question") scr.innerHTML = screenQuestion();
  else if (s === "reveal") scr.innerHTML = screenReveal();
  else if (s === "leaderboard") scr.innerHTML = screenWait(`Round ${meta.round + 1} done`, "Check the leaderboard on the big screen.");
  else if (s === "final") {
    const r = rankOf(players, pid);
    scr.innerHTML = screenWait(r ? `You finished #${r.rank}` : "Quiz over", "Thanks for playing. Happy Diwali!");
  }
  scr.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => answer(+b.dataset.i)));
  releaseConnectionSoon(s === "final");
  tick();
}

// Free Firebase allows 100 open connections, and every open tab counts.
// A minute after the game ends, this page disconnects so it frees its place.
let offlineTimer = null;
function releaseConnectionSoon(isOver) {
  if (isOver && !offlineTimer) offlineTimer = setTimeout(() => store.goOffline(), 60000);
  if (!isOver && offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; }
}


function tick() {
  if (!meta || meta.state !== "question" || typeof meta.qStart !== "number") return;
  const rem = meta.qStart + LIMIT - store.now();
  const t = $("#ptimer"), bar = $("#pbar");
  if (t) t.textContent = Math.max(0, Math.ceil(rem / 1000));
  if (bar) bar.style.width = Math.max(0, Math.min(100, (rem / LIMIT) * 100)) + "%";
  if (rem <= 0 && !myAnswer && !$(".p-opt[disabled]")) render();
}
setInterval(tick, 200);

tryResume();
