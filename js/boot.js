// Ostraka – desktop updater (Windows app). Used instead of the plain <script>
// list in index.html. It loads the newest copy of the app this computer has:
// the one built into the app, or a newer one downloaded from GitHub. After
// loading, it checks GitHub for a newer version, downloads only the files that
// changed (checking each one's fingerprint), and offers a Restart.
// Your saved progress is never touched: only the app's own code is replaced.
(function () {
  "use strict";
  const REMOTE = window.OSTRAKA_UPDATE_URL || "https://ccombs9502.github.io/Ostraka/";   // (tests can point it elsewhere)
  const DB = "ostraka-updates", STORE = "bundle", KEY = "current";
  const PENDING = "ostraka-boot-pending";   // set while a downloaded version starts

  // ---------- IndexedDB (where downloaded versions are kept) ----------
  function db() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
      const r = fn(s);
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
    });
  }
  const getCached = () => idb("readonly", (s) => s.get(KEY)).catch(() => null);
  const putCached = (v) => idb("readwrite", (s) => s.put(v, KEY));
  const dropCached = () => idb("readwrite", (s) => s.delete(KEY)).catch(() => {});

  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: (k) => { try { localStorage.removeItem(k); } catch (e) {} },
  };

  async function sha256(text) {
    if (!(window.crypto && crypto.subtle)) return null;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ---------- Loading the app ----------
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = false;
      s.onload = res; s.onerror = () => rej(new Error("Couldn't load " + src));
      document.body.appendChild(s);
    });
  }
  function useStyle(href) {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href;
    document.head.appendChild(l);
  }

  // Loads a version: files from the download where it has them, otherwise
  // the ones built into the app.
  async function start(manifest, texts) {
    const urls = {};
    const url = (p) => {
      if (!texts || texts[p] == null) return p;
      if (!urls[p]) urls[p] = URL.createObjectURL(new Blob([texts[p]], { type: p.endsWith(".css") ? "text/css" : "text/javascript" }));
      return urls[p];
    };
    window.OSTRAKA_SRC = url;
    // Downloaded styles go in as text, so "fonts/…" still points at the app's own fonts.
    manifest.styles.forEach((p) => {
      if (texts && texts[p] != null) { const st = document.createElement("style"); st.textContent = texts[p]; document.head.appendChild(st); }
      else useStyle(p);
    });
    for (const p of manifest.scripts) await loadScript(url(p));
  }

  let running = null;   // the manifest of the version that's running

  async function boot() {
    let built = null;
    try { built = await (await fetch("version.json", { cache: "no-store" })).json(); } catch (e) {}
    const fallback = { name: "Ostraka Web", build: 0, styles: ["styles.css"], scripts: ["js/paradigms.js", "js/logic.js", "data/practice.js", "js/tengine.js", "js/english.js", "js/translate.js", "js/app.js"], files: {} };
    built = built || fallback;

    const cached = await getCached();
    // A downloaded version that didn't finish starting last time is thrown away.
    if (cached && ls.get(PENDING) === String(cached.manifest.build)) { await dropCached(); ls.del(PENDING); return startBuilt(built); }
    if (cached && cached.manifest.build > built.build) {
      ls.set(PENDING, String(cached.manifest.build));
      try {
        await start(cached.manifest, cached.texts);
        running = cached.manifest;
        // Started fine: clear the flag once the app has drawn itself. If it
        // never draws, throw the download away and restart on the built-in copy.
        setTimeout(async () => {
          if (document.querySelector("#app > *")) { ls.del(PENDING); return; }
          await dropCached(); ls.del(PENDING); location.reload();
        }, 5000);
        return;
      } catch (e) {
        await dropCached(); ls.del(PENDING);
        location.reload();
        return;
      }
    }
    if (cached) dropCached();   // the app was reinstalled with something newer
    return startBuilt(built);
  }
  async function startBuilt(built) {
    await start(built, null);
    running = built;
  }

  // ---------- Checking GitHub ----------
  async function check() {
    if (!running || !navigator.onLine) return;
    let remote;
    try { remote = await (await fetch(REMOTE + "version.json?t=" + Date.now(), { cache: "no-store" })).json(); } catch (e) { return; }
    if (!remote || !(remote.build > running.build) || !remote.files) return;
    const have = (await getCached()) || null;
    const texts = {};
    for (const p of Object.keys(remote.files)) {
      const want = remote.files[p].sha256;
      // Unchanged since the running version: keep using that copy.
      if (running.files[p] && running.files[p].sha256 === want) {
        if (have && have.texts[p] != null && have.manifest.files[p] && have.manifest.files[p].sha256 === want) texts[p] = have.texts[p];
        continue;
      }
      let text;
      try { text = await (await fetch(REMOTE + p + "?v=" + remote.build, { cache: "no-store" })).text(); } catch (e) { return; }
      const got = await sha256(text);
      if (got && got !== want) return;   // damaged or half-published: try again next time
      texts[p] = text;
    }
    // Files neither downloaded nor carried over come from the built-in copy:
    // fill them in now so the saved version stands on its own.
    for (const p of Object.keys(remote.files)) {
      if (texts[p] != null) continue;
      try { texts[p] = await (await fetch(p, { cache: "no-store" })).text(); } catch (e) { return; }
    }
    await putCached({ manifest: remote, texts, savedAt: Date.now() });
    offerRestart(remote.name);
  }

  function offerRestart(name) {
    if (document.getElementById("upd")) return;
    const b = document.createElement("button");
    b.id = "upd"; b.className = "btn pri";
    b.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:999;box-shadow:0 6px 20px rgba(0,0,0,.3)";
    b.textContent = (name || "An update") + " is ready · Restart";
    b.onclick = () => location.reload();
    document.body.append(b);
  }

  // What's running, for Settings → About.
  window.OSTRAKA_UPDATER = { running: () => running, check };

  boot().then(() => {
    setTimeout(check, 3000);
    setInterval(check, 6 * 60 * 60 * 1000);   // and every 6 hours while open
  });
})();
