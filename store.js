// Small data layer: Firebase Realtime Database when configured, otherwise a
// demo mode that syncs browser tabs through localStorage.
(function () {
  const cfg = window.FIREBASE_CONFIG || {};
  const live = typeof firebase !== "undefined" && !!cfg.apiKey && !!cfg.databaseURL && !String(cfg.apiKey).includes("PASTE");

  if (live) {
    firebase.initializeApp(cfg);
    const db = firebase.database();
    let offset = 0;
    db.ref(".info/serverTimeOffset").on("value", (s) => { offset = s.val() || 0; });
    window.store = {
      live: true,
      TS: firebase.database.ServerValue.TIMESTAMP,
      now: () => Date.now() + offset,
      watch(path, cb) {
        const ref = db.ref(path);
        const h = ref.on("value", (s) => cb(s.val()));
        return () => ref.off("value", h);
      },
      get: (path) => db.ref(path).get().then((s) => s.val()),
      set: (path, v) => db.ref(path).set(v),
      update: (obj) => db.ref().update(obj),
      setIfAbsent: (path, v) =>
        db.ref(path).transaction((cur) => (cur === null ? v : undefined)).then((r) => r.committed),
      goOffline: () => db.goOffline(),
      goOnline: () => db.goOnline(),
    };
    return;
  }

  // ---------- demo mode ----------
  const KEY = "rtihQuizDemoDB";
  const parts = (p) => p.split("/").filter(Boolean);
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const getAt = (db, p) => parts(p).reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), db);
  const setAt = (db, p, v) => {
    const ks = parts(p); let o = db;
    for (let i = 0; i < ks.length - 1; i++) {
      if (typeof o[ks[i]] !== "object" || o[ks[i]] === null) o[ks[i]] = {};
      o = o[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (v === null || v === undefined) delete o[last]; else o[last] = v;
  };
  const resolve = (v) => {
    if (v && typeof v === "object" && v[".sv"] === "timestamp") return Date.now();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out = {}; for (const k in v) out[k] = resolve(v[k]); return out;
    }
    return v;
  };
  const subs = new Set();
  function notify() {
    const db = read();
    subs.forEach((s) => {
      const val = getAt(db, s.path);
      const j = JSON.stringify(val === undefined ? null : val);
      if (j !== s.last) { s.last = j; s.cb(JSON.parse(j)); }
    });
  }
  const write = (db) => { localStorage.setItem(KEY, JSON.stringify(db)); notify(); };
  window.addEventListener("storage", (e) => { if (e.key === KEY) notify(); });

  window.store = {
    live: false,
    goOffline() {},
    goOnline() {},
    TS: { ".sv": "timestamp" },
    now: () => Date.now(),
    watch(path, cb) {
      const s = { path, cb, last: undefined };
      subs.add(s); setTimeout(notify, 0);
      return () => subs.delete(s);
    },
    get(path) { const v = getAt(read(), path); return Promise.resolve(v === undefined ? null : v); },
    set(path, v) { const db = read(); setAt(db, path, resolve(v)); write(db); return Promise.resolve(); },
    update(obj) { const db = read(); for (const k in obj) setAt(db, k, resolve(obj[k])); write(db); return Promise.resolve(); },
    setIfAbsent(path, v) {
      const db = read(); const cur = getAt(db, path);
      if (cur !== undefined && cur !== null) return Promise.resolve(false);
      setAt(db, path, resolve(v)); write(db); return Promise.resolve(true);
    },
  };
})();
