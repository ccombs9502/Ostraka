// Ostraka sync: keep progress the same on every device that knows a sync code.
//
// The code (like OSTR-7Q4K-2MXA-9PLD) is made on one device and typed into
// the others. Progress is saved online under the code (only a fingerprint of
// the code is stored there, never the code itself). Each device keeps working
// offline and syncs when it can.
//
// Merging: each device remembers the copy it last synced ("base"). For every
// word, result, sentence and setting it compares local, online and base:
// whichever side changed since the base wins; if both changed, the newer one
// wins. Deleting something on one device deletes it everywhere.
(function () {
  const O = window.O;
  if (!O || O.embedded) return; // The Mac/iPhone app keeps its own data for now.

  const URL = "https://jgzcjdbbcrquuxaaooqf.supabase.co/rest/v1/rpc/";
  const KEY = "sb_publishable_LYnNIkUVBIUfox-lLjUGYA_jlJAKt1S";
  const STATE = "ostraka-sync-v1";
  const LOCAL_ONLY = new Set(["theme", "hideInstallTip"]); // settings that stay on this device
  const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

  const S = (O.sync = { status: "off", error: "", lastSync: 0, listeners: [] });
  let st = read();
  function read() { try { return JSON.parse(localStorage.getItem(STATE)) || {}; } catch (e) { return {}; } }
  function write() { try { localStorage.setItem(STATE, JSON.stringify(st)); } catch (e) {} }
  const notify = () => S.listeners.forEach((f) => { try { f(); } catch (e) {} });

  S.code = () => st.code || "";
  S.on = () => !!st.code;
  S.lastSync = st.at || 0;
  S.status = st.code ? "idle" : "off";

  S.newCode = () => {
    const r = new Uint32Array(12);
    crypto.getRandomValues(r);
    const c = [...r].map((n) => ALPHA[n % ALPHA.length]).join("");
    return `OSTR-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
  };
  S.clean = (code) => {
    const t = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^OSTR/, "");
    return t.length === 12 ? `OSTR-${t.slice(0, 4)}-${t.slice(4, 8)}-${t.slice(8)}` : null;
  };

  async function rpc(name, body) {
    const res = await fetch(URL + name, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Sync server said " + res.status);
    return (await res.json())[0] || null;
  }
  const device = () => (/iPhone|iPad/.test(navigator.userAgent) ? "iPhone/iPad" : /Mac/.test(navigator.userAgent) ? "Mac" : /Windows/.test(navigator.userAgent) ? "Windows" : "Web").slice(0, 60);

  // ---------- Merging ----------
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const stamp = (v) => (v && typeof v === "object" ? Math.max(0, ...["at", "lastReviewed", "lastSeen", "updated", "created", "when"].map((k) => +new Date(v[k] || 0) || 0)) : 0);
  function pick(l, r, b) {
    if (same(l, r)) return l;
    if (same(l, b)) return r; // only the other device changed it (or deleted it)
    if (same(r, b)) return l; // only this device changed it
    if (l === undefined) return r; // deleted here, changed there: keep the change
    if (r === undefined) return l;
    return stamp(r) > stamp(l) ? r : l;
  }
  const isIdList = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => x && typeof x === "object" && "id" in x);
  const isPlainList = (a) => Array.isArray(a) && a.every((x) => x === null || typeof x !== "object");
  const isMap = (o) => o && typeof o === "object" && !Array.isArray(o);

  function mergeMap(l = {}, r = {}, b = {}, skip) {
    const out = {};
    new Set([...Object.keys(l), ...Object.keys(r)]).forEach((k) => {
      if (skip && skip.has(k)) { if (k in l) out[k] = l[k]; return; }
      const v = pick(l[k], r[k], b[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  function mergeIdList(l = [], r = [], b = []) {
    const by = (a) => new Map(a.map((x) => [x.id, x]));
    const L = by(l), R = by(r), B = by(b), out = [];
    // Keep this device's order, then add new ones from the other device.
    [...L.keys(), ...[...R.keys()].filter((k) => !L.has(k))].forEach((k) => {
      const v = pick(L.get(k), R.get(k), B.get(k));
      if (v !== undefined) out.push(v);
    });
    return out;
  }
  function mergeSet(l = [], r = [], b = []) {
    // In both: keep. Only on one side: keep if it's new, drop if the other side removed it.
    const L = new Set(l), R = new Set(r), B = new Set(b);
    return [...new Set([...l, ...r])].filter((x) => (L.has(x) && R.has(x)) || !B.has(x));
  }
  S.merge = (local, remote, base) => {
    base = base || {};
    const out = {};
    new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]).forEach((k) => {
      const l = local ? local[k] : undefined, r = remote ? remote[k] : undefined, b = base[k];
      if (k === "settings") out[k] = mergeMap(l, r, b, LOCAL_ONLY);
      else if (isIdList(l) || isIdList(r)) out[k] = mergeIdList(l, r, b);
      else if ((Array.isArray(l) || Array.isArray(r)) && isPlainList(l || []) && isPlainList(r || [])) out[k] = mergeSet(l, r, b);
      else if (isMap(l) || isMap(r)) out[k] = mergeMap(l || {}, r || {}, isMap(b) ? b : {});
      else { const v = pick(l, r, b); if (v !== undefined) out[k] = v; }
    });
    return out;
  };

  // ---------- Talking to the server ----------
  let busy = null, again = false, timer = null;
  function apply(merged) {
    // Update the existing objects in place: other parts of the app hold on to O.data and its settings.
    const d = O.data, set = d.settings || {};
    Object.keys(d).forEach((k) => delete d[k]);
    Object.keys(set).forEach((k) => delete set[k]);
    Object.assign(set, merged.settings || {});
    Object.assign(d, merged, { settings: set });
    rawSave();
    if (window.OUI && OUI.render) { try { OUI.render(); } catch (e) {} }
  }
  function done(version, data) {
    // Keep our own copy: the app changes O.data in place, and the base must not change with it.
    st.version = version; st.base = JSON.parse(JSON.stringify(data)); st.at = Date.now();
    S.lastSync = st.at; S.status = "idle"; S.error = "";
    write(); notify();
  }
  async function syncNow() {
    if (!st.code) return;
    if (busy) { again = true; return busy; }
    S.status = "syncing"; notify();
    busy = (async () => {
      try {
        let local = JSON.parse(JSON.stringify(O.data));
        // Nothing changed here since the last sync: just look for news.
        if (st.base && same(local, st.base)) {
          const row = await rpc("sync_pull", { p_code: st.code });
          if (row && row.version !== st.version) { const m = S.merge(local, row.data, st.base); apply(m); done(row.version, m); }
          else done(st.version, local);
          return;
        }
        for (let tries = 0; tries < 4; tries++) {
          const res = await rpc("sync_push", { p_code: st.code, p_data: local, p_base: st.version || 0, p_device: device() });
          if (res && res.ok) { done(res.version, local); return; }
          if (!res) throw new Error("No answer from the sync server");
          // Someone else saved first: combine their copy with ours and try again.
          local = S.merge(local, res.data, st.base);
          apply(local);
          st.version = res.version;
        }
        throw new Error("Couldn't finish syncing; will try again.");
      } catch (e) {
        S.status = navigator.onLine === false ? "offline" : "error";
        S.error = e.message || String(e);
        notify();
      } finally {
        busy = null;
        if (again) { again = false; setTimeout(syncNow, 500); }
      }
    })();
    return busy;
  }
  S.syncNow = syncNow;

  // Save locally right away; sync a few seconds after the last change.
  const rawSave = O.save;
  O.save = () => {
    rawSave();
    if (!st.code) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, 4000);
  };

  // Turn on: make a code and upload this device's progress.
  S.start = async () => {
    st = { code: S.newCode(), version: 0, base: null, at: 0 };
    write();
    await syncNow();
    if (S.status === "error" || S.status === "offline") { const err = S.error; st = {}; write(); S.status = "off"; notify(); throw new Error(err || "Couldn't reach the sync server."); }
    return st.code;
  };
  // Join: use a code from another device and combine its progress with this one.
  S.join = async (code) => {
    const c = S.clean(code);
    if (!c) throw new Error("That doesn't look like a sync code. It has 12 letters and numbers after OSTR.");
    const row = await rpc("sync_pull", { p_code: c });
    if (!row) throw new Error("No progress is saved under that code. Check it and try again.");
    st = { code: c, version: row.version, base: JSON.parse(JSON.stringify(row.data)), at: 0 };
    const merged = S.merge(JSON.parse(JSON.stringify(O.data)), row.data, {});
    apply(merged);
    // Settings like your name come from the other device the first time.
    st.base = JSON.parse(JSON.stringify(row.data));
    write();
    await syncNow();
    return c;
  };
  S.stop = () => { clearTimeout(timer); st = {}; write(); S.status = "off"; S.lastSync = 0; notify(); };

  // Sync when the app opens, when you come back to it, every few minutes, and before you leave.
  if (st.code) setTimeout(syncNow, 1200);
  document.addEventListener("visibilitychange", () => { if (st.code) syncNow(); });
  window.addEventListener("online", () => { if (st.code) syncNow(); });
  setInterval(() => { if (st.code && document.visibilityState === "visible") syncNow(); }, 3 * 60 * 1000);
})();
