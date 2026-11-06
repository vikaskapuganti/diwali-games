// Tambola player page: each person's own ticket on their phone.
let code = null, pid = null, meta = null, me = null, winners = {}, marks = new Set();
let unsubs = [], joinError = "", note = "", noteKind = "", lastSeenCount = -1, knownWinners = null, claiming = false;

if (!store.live) {
  const b = $("#badge");
  b.textContent = "DEMO MODE";
  b.className = "badge demo";
}

const params = new URLSearchParams(location.search);
const roomParam = (params.get("room") || "").toUpperCase();
const SAVE = "rtihTambolaPlayer";
const saveStore = store.live ? localStorage : sessionStorage; // demo: each tab is its own player
const gamePath = (p) => `tambola/${code}${p ? "/" + p : ""}`;
const called = () => (meta && meta.called ? Object.values(meta.called) : []);
const marksKey = () => `rtihTambolaMarks_${code}_${pid}`;

async function tryResume() {
  let saved = null;
  try { saved = JSON.parse(saveStore.getItem(SAVE)); } catch (e) {}
  if (saved && saved.code && (!roomParam || saved.code === roomParam)) {
    const p = await store.get(`tambola/${saved.code}/players/${saved.pid}`);
    if (p) { code = saved.code; pid = saved.pid; loadMarks(); connect(); return; }
  }
  render();
}

async function join(roomCode, name) {
  roomCode = roomCode.trim().toUpperCase();
  name = name.trim().replace(/\s+/g, " ").slice(0, 24);
  if (!roomCode || !name) { joinError = "Enter the game code and your name."; return render(); }
  const m = await store.get(`tambola/${roomCode}/meta`);
  if (!m) { joinError = "No game found with that code. Check the code on the screen."; return render(); }
  if (m.state === "over") { joinError = "This game has already finished."; return render(); }
  code = roomCode;
  pid = "p" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  await store.set(gamePath("players/" + pid), { name, ticket: makeTicket(), joinedAt: store.TS });
  saveStore.setItem(SAVE, JSON.stringify({ code, pid }));
  joinError = "";
  loadMarks();
  connect();
}

function loadMarks() {
  try { marks = new Set(JSON.parse(localStorage.getItem(marksKey())) || []); } catch (e) { marks = new Set(); }
}
function saveMarks() {
  try { localStorage.setItem(marksKey(), JSON.stringify([...marks])); } catch (e) {}
}

function connect() {
  unsubs.forEach((f) => f());
  unsubs = [
    store.watch(gamePath("meta"), (v) => { meta = v; render(); }),
    store.watch(gamePath("players/" + pid), (v) => {
      me = v;
      if (meta && !me) { leave(); return; }
      render();
    }),
    store.watch(gamePath("winners"), (v) => {
      const next = v || {};
      if (knownWinners) {
        for (const p of PRIZES) {
          const w = next[p.id];
          if (w && !knownWinners[p.id] && w.pid !== pid) { note = `${w.name} won ${p.name}`; noteKind = ""; }
        }
      }
      knownWinners = next;
      winners = next;
      render();
    }),
  ];
}

function leave() {
  unsubs.forEach((f) => f()); unsubs = [];
  code = null; pid = null; meta = null; me = null; winners = {}; knownWinners = null; marks = new Set();
  saveStore.removeItem(SAVE);
  render();
}

function tapCell(n, el) {
  if (!n || !meta || meta.state !== "playing") return;
  if (!called().includes(n)) {
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
    return;
  }
  if (marks.has(n)) marks.delete(n); else marks.add(n);
  saveMarks();
  render();
}

function heldFullHouse() {
  return FULL_HOUSES.some((id) => winners[id] && winners[id].pid === pid);
}

function ready(cells, prizeId) {
  const nums = prizeNumbers(cells, prizeId);
  const set = new Set(called());
  return nums.every((n) => marks.has(n) && set.has(n));
}

async function claim(kind) {
  if (claiming || !me) return;
  const cells = parseTicket(me.ticket);
  const prizeId = kind === "full" ? "fh1" : kind;
  if (!ready(cells, prizeId)) return;
  claiming = true;
  const entry = { pid, name: me.name, at: store.TS };
  try {
    let won = null;
    if (kind === "full") {
      if (heldFullHouse()) return;
      for (const id of FULL_HOUSES) {
        if (winners[id] && winners[id].pid !== pid) continue;
        if (await store.setIfAbsent(gamePath("winners/" + id), entry)) { won = id; break; }
      }
    } else if (await store.setIfAbsent(gamePath("winners/" + kind), entry)) {
      won = kind;
    }
    const p = PRIZES.find((x) => x.id === (won || prizeId));
    if (won) { note = `You won ${p.name}! Go to the stage.`; noteKind = "ok"; }
    else { note = kind === "full" ? "All Full House prizes are taken." : `Someone claimed ${p.name} just before you.`; noteKind = "bad"; }
  } finally {
    claiming = false;
    render();
  }
}

// ---------- screens ----------
function ticketHtml(cells, interactive) {
  const set = new Set(called());
  return `<div class="ticket">${cells.map((n) => {
    if (!n) return `<span class="tc blank"></span>`;
    const cls = marks.has(n) && set.has(n) ? "marked" : "";
    return `<button class="tc ${cls}" data-n="${n}" ${interactive ? "" : "disabled"}>${n}</button>`;
  }).join("")}</div>`;
}

function claimButtons(cells) {
  const lines = PRIZES.filter((p) => p.row !== undefined).map((p) => {
    const w = winners[p.id];
    if (w) return `<button class="claim done" disabled><span>${p.name}</span><small>${w.pid === pid ? "You won" : "Won by " + esc(w.name)}</small></button>`;
    const nums = rowNumbers(cells, p.row);
    const got = nums.filter((n) => marks.has(n)).length;
    const ok = ready(cells, p.id);
    return `<button class="claim ${ok ? "go" : ""}" data-claim="${p.id}" ${ok ? "" : "disabled"}><span>${p.name}</span><small>${got} of 5</small></button>`;
  });
  const fhLeft = FULL_HOUSES.filter((id) => !winners[id]).length;
  const mine = heldFullHouse();
  const got = allNumbers(cells).filter((n) => marks.has(n)).length;
  const ok = !mine && fhLeft > 0 && ready(cells, "fh1");
  lines.push(`<button class="claim full ${ok ? "go" : ""}" data-claim="full" ${ok ? "" : "disabled"}>
      <span>Full House</span><small>${mine ? "You won" : fhLeft ? `${got} of 15 · ${fhLeft} left` : "All taken"}</small></button>`);
  return `<div class="claims">${lines.join("")}</div>`;
}

function screenJoin() {
  return `<div class="p-center" style="justify-content:flex-start;padding-top:6vh">
    <div><h1 class="p-title">Tambola</h1><p class="muted" style="margin:0">Get your ticket for the game on the big screen</p></div>
    <form id="joinForm" style="text-align:left">
      <label class="field"><span>Game code</span>
        <input class="code" id="room" maxlength="4" autocomplete="off" value="${esc(roomParam)}" placeholder="ABCD"></label>
      <label class="field"><span>Your name</span>
        <input id="name" maxlength="24" autocomplete="off" placeholder="Enter your name"></label>
      <div class="err">${esc(joinError)}</div>
      <button class="btn wide" type="submit">Get my ticket</button>
    </form>
  </div>`;
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
  const cells = parseTicket(me.ticket);
  const list = called();
  const cur = list[list.length - 1];
  const s = meta.state;

  if (s === "lobby") {
    scr.innerHTML = `<p class="muted" style="margin:0">${esc(me.name)}</p>
      <h1 class="p-title" style="margin-top:0">Your ticket</h1>
      ${ticketHtml(cells, false)}
      <div class="card" style="margin-top:18px"><p class="big" style="font-size:22px">You're in!</p>
      <p class="muted" style="margin:6px 0 0">When the game starts, tap each number on your ticket as it is called. Complete a line or the full ticket, then press Claim.</p></div>`;
    return;
  }

  if (s === "over") {
    scr.innerHTML = `<div class="p-center"><div class="card"><p class="big">Game over</p>
      <p class="muted" style="margin:8px 0 14px">Thanks for playing. Happy Diwali!</p>
      ${PRIZES.map((p) => `<div class="wline"><span>${p.name}</span><b>${winners[p.id] ? esc(winners[p.id].name) + (winners[p.id].pid === pid ? " (you)" : "") : "-"}</b></div>`).join("")}
      </div></div>`;
    return;
  }

  const isNew = list.length !== lastSeenCount;
  lastSeenCount = list.length;
  scr.innerHTML = `<div class="p-head"><span>${esc(me.name)}</span><span>${list.length} of 90 called</span></div>
    <div class="now">
      <div class="nowball ${isNew && cur ? "pop" : ""}">${cur ?? "--"}</div>
      <div><div class="nowline">${cur ? esc(callLine(cur)) : "Waiting for the first number"}</div>
      <div class="muted" style="font-size:13px">${list.length > 1 ? "Before: " + list.slice(-4, -1).reverse().join(", ") : ""}</div></div>
    </div>
    ${ticketHtml(cells, true)}
    <p class="muted" style="text-align:center;font-size:13px;margin:8px 0 0">Tap a number when it is called. Tap again to unmark.</p>
    ${note ? `<div class="note ${noteKind}">${esc(note)}</div>` : ""}
    ${claimButtons(cells)}`;
  scr.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => tapCell(+b.dataset.n, b)));
  scr.querySelectorAll("[data-claim]").forEach((b) => (b.onclick = () => claim(b.dataset.claim)));
}

tryResume();
