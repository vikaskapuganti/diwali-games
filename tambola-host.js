// Tambola host screen: runs on the laptop connected to the projector.
let code = null, meta = null, players = {}, winners = {};
let unsubs = [], rolling = false, rollShow = null, fresh = [], announced = new Set(), qrCache = {};

const badge = $("#badge");
badge.textContent = store.live ? "LIVE" : "DEMO MODE";
badge.className = "badge " + (store.live ? "live" : "demo");

const gamePath = (p) => `tambola/${code}${p ? "/" + p : ""}`;
const called = () => (meta && meta.called ? Object.values(meta.called) : []);
const nPlayers = () => Object.keys(players).length;
const ORDER_KEY = () => "rtihTambolaOrder_" + code;
const joinUrl = () => {
  const u = new URL("tambola.html", location.href);
  u.search = "?room=" + code;
  return u.href;
};

function newCode() {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

async function createGame() {
  code = newCode();
  while (await store.get(`tambola/${code}/meta`)) code = newCode();
  const order = shuffle([...Array(90)].map((_, i) => i + 1));
  localStorage.setItem(ORDER_KEY(), JSON.stringify(order));
  await store.set(`tambola/${code}`, { meta: { state: "lobby", createdAt: store.TS } });
  localStorage.setItem("rtihTambolaHost", code);
  resetLocal();
  connect();
}

function resetLocal() {
  meta = null; players = {}; winners = {}; fresh = []; announced = new Set(); rolling = false; rollShow = null;
}

function connect() {
  unsubs.forEach((f) => f());
  unsubs = [
    store.watch(gamePath("meta"), (v) => { meta = v; checkWinners(); render(); }),
    store.watch(gamePath("players"), (v) => { players = v || {}; checkWinners(); render(); }),
    store.watch(gamePath("winners"), (v) => { winners = v || {}; checkWinners(); render(); }),
  ];
}

// Verify every claim against the called numbers. Invalid claims are removed.
function checkWinners() {
  if (!meta) return; // never judge a claim before the called numbers have loaded
  for (const p of PRIZES) {
    const w = winners[p.id];
    if (!w || announced.has(p.id)) continue;
    const pl = players[w.pid];
    if (!pl) continue; // player data not loaded yet; checked again on next update
    if (!validClaim(pl.ticket, called(), p.id)) {
      store.set(gamePath("winners/" + p.id), null);
      continue;
    }
    announced.add(p.id);
    // pop up only claims made in the last minute (not old ones when resuming)
    if (typeof w.at === "number" && store.now() - w.at < 60000) fresh.push(p.id);
  }
  if (meta && meta.state === "playing" && FULL_HOUSES.every((id) => winners[id] && announced.has(id))) {
    store.update({ [gamePath("meta/state")]: "over" });
  }
}

function getOrder() {
  let order = null;
  try { order = JSON.parse(localStorage.getItem(ORDER_KEY())); } catch (e) {}
  if (!Array.isArray(order) || order.length !== 90) {
    // different laptop or cleared browser: shuffle whatever has not been called yet
    const done = new Set(called());
    order = [...called(), ...shuffle([...Array(90)].map((_, i) => i + 1).filter((n) => !done.has(n)))];
    localStorage.setItem(ORDER_KEY(), JSON.stringify(order));
  }
  return order;
}

function nextNumber() {
  if (rolling || !meta || meta.state !== "playing") return;
  const done = new Set(called());
  const n = getOrder().find((x) => !done.has(x));
  if (!n) { store.update({ [gamePath("meta/state")]: "over" }); return; }
  fresh = [];
  rolling = true;
  const start = Date.now();
  const spin = setInterval(() => {
    rollShow = 1 + Math.floor(Math.random() * 90);
    const el = $("#bignum");
    if (el) el.textContent = rollShow;
    if (Date.now() - start > 1000) {
      clearInterval(spin);
      rolling = false; rollShow = null;
      const list = [...called(), n];
      store.update({ [gamePath("meta/called")]: list, [gamePath("meta/lastAt")]: store.TS });
    }
  }, 70);
  render();
}

function newGame() {
  if (meta && meta.state === "playing" && !confirm("End this game and start a new one?")) return;
  unsubs.forEach((f) => f()); unsubs = [];
  code = null;
  resetLocal();
  localStorage.removeItem("rtihTambolaHost");
  render();
}

// ---------- screens ----------
function qrFor(url) {
  if (qrCache[url]) return qrCache[url];
  if (typeof qrcode === "undefined") return "";
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  return (qrCache[url] = qr.createDataURL(12, 2));
}

function screenSetup(saved) {
  return `<div class="center">
    <h1 class="title-xl">Tambola</h1>
    <p class="sub">Everyone gets their own ticket on their phone. Tap to mark, claim to win.</p>
    <p class="sub">Prizes: Top Line · Middle Line · Bottom Line · 1st, 2nd and 3rd Full House</p>
    <div style="margin-top:4vh;display:flex;gap:16px;flex-wrap:wrap;justify-content:center">
      <button class="btn" id="create" style="font-size:22px;padding:16px 32px">Start a new game</button>
      ${saved ? `<button class="btn ghost" id="resume" style="font-size:18px">Resume game ${esc(saved)}</button>` : ""}
    </div>
  </div>`;
}

function screenLobby() {
  const url = joinUrl();
  const list = Object.values(players).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  return `<div class="lobby">
      <div>
        <h1 class="title-xl">Tambola</h1>
        <p class="sub">Scan to get your ticket</p>
        <div class="code">Or open the link and enter the code<span>${esc(code)}</span></div>
        <div class="url">${esc(url)}</div>
        ${shareButtons()}
      </div>
      <div class="qr"><img alt="QR code to join" src="${qrFor(url)}"></div>
    </div>
    <div class="joined">
      <h3>${list.length} ${list.length === 1 ? "player" : "players"} joined</h3>
      <div class="chips">${list.map((p) => `<span class="chip">${esc(p.name)}</span>`).join("")}</div>
    </div>`;
}

function prizeStrip() {
  return `<div class="prizes">${PRIZES.map((p) => {
    const w = winners[p.id] && announced.has(p.id) ? winners[p.id] : null;
    return `<div class="prize ${w ? "won" : ""}"><span>${p.name}</span><b>${w ? esc(w.name) : "Open"}</b></div>`;
  }).join("")}</div>`;
}

function screenPlaying() {
  const list = called();
  const cur = rolling ? rollShow : list[list.length - 1];
  const set = new Set(list);
  const last5 = list.slice(-6, -1).reverse();
  let board = "";
  for (let n = 1; n <= 90; n++) {
    const cls = set.has(n) ? (n === list[list.length - 1] && !rolling ? "on latest" : "on") : "";
    board += `<span class="cell ${cls}">${n}</span>`;
  }
  const overlay = fresh.length
    ? `<div class="winner-pop">${fresh.map((id) => {
        const p = PRIZES.find((x) => x.id === id);
        return `<div><span>${p.name}</span><b>${esc(winners[id].name)}</b></div>`;
      }).join("")}<p class="muted">Press Next number to continue, or click to close</p></div>`
    : "";
  return `<div class="tb-layout">
      <div class="tb-left">
        <div class="ball ${rolling ? "spin" : list.length ? "land" : ""}"><span id="bignum">${cur ?? "--"}</span></div>
        <div class="callline">${!rolling && cur ? esc(callLine(cur)) : rolling ? "..." : "Press Next number to begin"}</div>
        <div class="count">${list.length} of 90 called</div>
        ${last5.length ? `<div class="last5"><span class="muted">Previous</span>${last5.map((n) => `<i>${n}</i>`).join("")}</div>` : ""}
      </div>
      <div class="board90">${board}</div>
    </div>
    ${prizeStrip()}
    ${overlay}`;
}

function screenOver() {
  return `<div style="text-align:center">
      <h1 class="title-xl" style="font-size:clamp(32px,4.5vw,72px)">Tambola Winners</h1>
      <p class="sub">${called().length} numbers called</p>
    </div>
    <div class="board" style="max-width:900px">${PRIZES.map((p) => {
      const w = winners[p.id];
      return `<div class="row"><span class="r" style="font-size:.7em">${p.name}</span><span></span><span class="s">${w ? esc(w.name) : "Not won"}</span></div>`;
    }).join("")}</div>`;
}

function render() {
  const scr = $("#screen"), ctl = $("#controls");
  if (!code) {
    scr.innerHTML = screenSetup(localStorage.getItem("rtihTambolaHost"));
    ctl.innerHTML = "";
    $("#create").onclick = createGame;
    const r = $("#resume");
    if (r) r.onclick = () => { code = localStorage.getItem("rtihTambolaHost"); resetLocal(); connect(); };
    return;
  }
  if (!meta) { scr.innerHTML = `<div class="center"><p class="sub">Connecting...</p></div>`; ctl.innerHTML = ""; return; }
  const s = meta.state;
  scr.innerHTML = s === "lobby" ? screenLobby() : s === "playing" ? screenPlaying() : screenOver();
  const info = `<span class="info">Game ${esc(code)} · ${nPlayers()} players</span><span class="spacer"></span>`;
  let main = "";
  if (s === "lobby") main = `<button class="btn" id="start" ${nPlayers() ? "" : "disabled"}>Start Tambola</button>`;
  if (s === "playing") main = `<button class="btn" id="next" ${rolling ? "disabled" : ""}>Next number</button>`;
  ctl.innerHTML = `${info}${main}<button class="btn ghost" id="full">Full screen</button><button class="btn ghost" id="new">New game</button>`;
  const on = (id, fn) => { const el = $("#" + id); if (el) el.onclick = fn; };
  on("start", () => store.update({ [gamePath("meta/state")]: "playing" }));
  on("next", nextNumber);
  const pop = $(".winner-pop");
  if (pop) pop.onclick = () => { fresh = []; render(); };
  on("new", newGame);
  if (meta && meta.state === "lobby") wireShare(`Get your Tambola ticket on your phone: ${joinUrl()}\nGame code: ${code}`);
  on("full", () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()));
}

// Space or right arrow = next number
document.addEventListener("keydown", (e) => {
  if ((e.key === " " || e.key === "ArrowRight") && meta && meta.state === "playing") { e.preventDefault(); nextNumber(); }
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

render();
