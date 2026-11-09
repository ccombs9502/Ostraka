// Ostraka web: Translate mode.
// Parse each word → build the skeleton → write the translation. Greek → English and English → Greek.
(function () {
  "use strict";
  const O = window.O, E = window.OE;
  const T = (window.OT = {});
  let h, icon, render, openModal, closeModal, sheetClass, ap, greekInput;
  const S = () => O.data.settings;

  // ---------- Setup ----------
  T.init = () => {
    ({ h, icon, render, openModal, closeModal, sheetClass, ap, greekInput } = window.OUI);
    const d = O.data;
    for (const [k, v] of Object.entries({ sentences: [], sentenceGroups: [], tResults: {}, tNotes: {}, tWork: {}, sentencePresets: [], pinnedSentences: [], pinnedSentenceGroups: [], tDays: [] }))
      if (d[k] == null) d[k] = v;
    const defaults = { tLabelsFull: true, tLinkArticles: true, tNotesFull: false, tShowStructure: false, tDir: "g2e" };
    for (const [k, v] of Object.entries(defaults)) if (d.settings[k] == null) d.settings[k] = v;
  };
  const tr = { tab: "practice", scope: ["all"], lib: { filter: "all", chapter: "all", group: "all", q: "", select: false, sel: [] }, imp: { text: "", chapters: null, groupByChapter: true, addTo: "" }, type: { text: "", picks: {} } };
  T.session = null;

  const PAL_DARK = ["#8fe08a", "#7cc8f0", "#f0b46a", "#ef8fd6", "#b9a4ff", "#f4e06d", "#ff9e7a", "#6fe0d0", "#c9e86f", "#f59ac0", "#9fb8ff", "#ffc773"];
  const PAL_LIGHT = ["#2f8a43", "#1f78b4", "#c26a12", "#c2357e", "#6a4fc9", "#957800", "#d0532a", "#13857a", "#5c8a0e", "#b8336a", "#3d5fd1", "#a8630f"];
  const palette = () => (matchMedia("(prefers-color-scheme: dark)").matches ? PAL_DARK : PAL_LIGHT);
  const shuffle = (a) => O.shuffle(a.slice());
  const greekIn = (props) => {
    const el = greekInput("t-in gk", props.placeholder || "");
    if (props.value) el.value = props.value;
    el.addEventListener("input", () => props.oninput && props.oninput(el.value));
    if (props.autofocus) el.setAttribute("data-autofocus", "");
    if (props.onenter) el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); props.onenter(); } });
    return el;
  };
  const textIn = (props) => h("input", {
    type: "text", class: "t-in", placeholder: props.placeholder || "", value: props.value || "", autocomplete: "off", spellcheck: "false",
    "data-autofocus": props.autofocus || null,
    oninput: (e) => props.oninput && props.oninput(e.target.value),
    onkeydown: (e) => { if (e.key === "Enter" && props.onenter) { e.preventDefault(); e.stopPropagation(); props.onenter(); } },
  });
  const seg = (opts, cur, onPick) => h("div", { class: "seg" }, opts.map(([v, lab]) => h("button", { class: cur === v ? "on" : "", onclick: () => onPick(v) }, lab)));
  const toggle = (on, label, onChange, note) => h("label", { class: "check t-toggle" },
    h("input", { type: "checkbox", checked: on || null, onchange: (e) => onChange(e.target.checked) }), label, note ? h("span", { class: "muted small" }, note) : null);
  const waitGNT = (fn) => { if (E.ready) return true; E.load(() => { render(); fn && fn(); }); return false; };
  const loadingNote = () => h("div", { class: "card pad muted" }, E.loadError ? "Couldn't load the Greek New Testament data (data/gnt.js)." : "Loading the Greek New Testament…");

  // ---------- Sentence helpers ----------
  const byId = (id) => O.data.sentences.find((s) => s.id === id);
  const lastResult = (id, dir = "g2e") => O.data.tResults[id + "|" + dir] || null;
  const usedHelp = (r) => r && (r.hints > 0 || r.charts > 0 || r.structure);
  const sentenceGreek = (s) => E.sentenceText(s, false);
  T.scopeIds = (key) => {
    const d = O.data;
    if (Array.isArray(key)) { const set = new Set(); key.forEach((k) => T.scopeIds(k).forEach((id) => set.add(id))); return d.sentences.filter((s) => set.has(s.id)).map((s) => s.id); }
    if (key === "all") return d.sentences.map((s) => s.id);
    if (key === "red") return d.sentences.filter((s) => usedHelp(lastResult(s.id))).map((s) => s.id);
    if (key === "new") return d.sentences.filter((s) => !lastResult(s.id) && !lastResult(s.id, "e2g")).map((s) => s.id);
    if (key === "pinned") return d.sentences.filter((s) => d.pinnedSentences.includes(s.id)).map((s) => s.id);
    if (key.startsWith("c:")) return d.sentences.filter((s) => s.chapter === +key.slice(2)).map((s) => s.id);
    if (key.startsWith("g:")) { const g = d.sentenceGroups.find((x) => x.id === key.slice(2)); return g ? g.ids.filter((id) => byId(id)) : []; }
    return [];
  };
  const scopeTitle = (k) => k === "all" ? "All sentences" : k === "red" ? "Used help" : k === "new" ? "Not translated yet" : k === "pinned" ? "Pinned" :
    k.startsWith("c:") ? "Chapter " + k.slice(2) : (O.data.sentenceGroups.find((g) => g.id === k.slice(2)) || {}).name || "Group";
  const sentenceChapters = () => [...new Set(O.data.sentences.map((s) => s.chapter).filter((c) => c != null))].sort((a, b) => a - b);
  const scopeOptions = () => {
    const d = O.data, groupNames = new Set(d.sentenceGroups.map((g) => O.fold(g.name)));
    const opts = ["all"];
    if (d.pinnedSentences.length) opts.push("pinned");
    const groups = d.sentenceGroups.map((g) => "g:" + g.id);
    const pinnedG = groups.filter((k) => d.pinnedSentenceGroups.includes(k.slice(2)));
    opts.push(...pinnedG, ...sentenceChapters().filter((n) => !groupNames.has(O.fold("Chapter " + n))).map((n) => "c:" + n), ...groups.filter((k) => !pinnedG.includes(k)));
    if (T.scopeIds("red").length) opts.push("red");
    if (T.scopeIds("new").length) opts.push("new");
    return opts;
  };
  T.addSentences = (list, groupByChapter, addToGroup) => {
    const d = O.data, now = Date.now();
    const known = new Set(d.sentences.map((s) => O.fold(sentenceGreek(s))));
    const added = [];
    list.forEach((s, i) => {
      const k = O.fold(sentenceGreek(s));
      if (known.has(k)) {
        // Same sentence again: keep the old one, but take any professor's
        // glosses, reference or English the new copy adds.
        const old = d.sentences.find((x) => O.fold(sentenceGreek(x)) === k);
        if (old) {
          const gNew = s.tokens.filter((t) => t.given).length, gOld = old.tokens.filter((t) => t.given).length;
          if (gNew > gOld && s.tokens.length === old.tokens.length) old.tokens = s.tokens;
          if (!old.ref && s.ref) { old.ref = s.ref; old.refKey = s.refKey || null; }
          if (!old.english && s.english) old.english = s.english;
        }
        return;
      }
      known.add(k);
      const rec = { id: O.uid("s"), chapter: s.chapter ?? null, tokens: s.tokens, ref: s.ref || "", refKey: s.refKey || null, english: s.english || "", created: now + i };
      d.sentences.push(rec); added.push(rec);
    });
    if (groupByChapter) {
      const chapters = [...new Set(added.map((s) => s.chapter).filter((c) => c != null))];
      chapters.forEach((c) => {
        const name = "Chapter " + c;
        let g = d.sentenceGroups.find((x) => O.fold(x.name) === O.fold(name));
        if (!g) { g = { id: O.uid("sg"), name, ids: [] }; d.sentenceGroups.push(g); }
        added.filter((s) => s.chapter === c).forEach((s) => { if (!g.ids.includes(s.id)) g.ids.push(s.id); });
      });
    }
    if (addToGroup) { const g = d.sentenceGroups.find((x) => x.id === addToGroup); if (g) added.forEach((s) => { if (!g.ids.includes(s.id)) g.ids.push(s.id); }); }
    O.save();
    return added;
  };

  // ---------- Translate page (outside a session) ----------
  T.view = () => {
    T.init();
    const tabs = [["practice", "Practice"], ["library", "Library"], ["import", "Import"], ["type", "Type a sentence"]];
    const body = { practice: viewPractice, library: viewLibrary, import: viewImport, type: viewType }[tr.tab]();
    return {
      title: "Translate",
      tools: seg(tabs, tr.tab, (v) => { tr.tab = v; render(); }),
      body: h("div", { class: "stack" + ap("ttab", tr.tab) }, body),
    };
  };
  T.goTab = (tab) => { tr.tab = tab; };

  function viewPractice() {
    const d = O.data;
    if (!d.sentences.length) return emptyLibrary();
    const ids = T.scopeIds(tr.scope.length === 1 ? tr.scope[0] : tr.scope);
    const pick = (k) => {
      if (k === "all") tr.scope = ["all"];
      else {
        tr.scope = tr.scope.filter((x) => x !== "all");
        tr.scope = tr.scope.includes(k) ? tr.scope.filter((x) => x !== k) : tr.scope.concat(k);
        if (!tr.scope.length) tr.scope = ["all"];
      }
      render();
    };
    const s = S();
    return [
      h("div", { class: "card pad stack" },
        h("div", { style: "font-size:21px;font-weight:700" }, "Translate sentences"),
        h("div", { class: "muted" }, "Parse each word, build the skeleton, then write the whole sentence. Works the way you translate by hand."),
        h("div", { class: "label" }, "1 · Direction"),
        seg([["g2e", "Greek → English"], ["e2g", "English → Greek"]], s.tDir, (v) => { O.set("tDir", v); render(); }),
        h("div", { class: "label" }, "2 · Choose sentences (tap as many as you like)"),
        h("div", { class: "chips" }, scopeOptions().map((k) => h("button", { class: "chip" + (tr.scope.includes(k) ? " on" : ""), onclick: () => pick(k) }, scopeTitle(k), h("small", null, T.scopeIds(k).length)))),
        h("div", { class: "label" }, "3 · Options"),
        h("div", { class: "stack", style: "gap:8px" },
          toggle(s.tLinkArticles, "Link articles automatically", (v) => { O.set("tLinkArticles", v); render(); }, "Good for beginners: each article comes joined to its noun."),
          toggle(s.tShowStructure, "Show structure", (v) => { O.set("tShowStructure", v); render(); }, "Starts the skeleton with the outline filled in. Counts as help."),
          h("div", { class: "row wrap" }, h("span", null, "Labels"), seg([["full", "Full words"], ["short", "Short"]], s.tLabelsFull ? "full" : "short", (v) => { O.set("tLabelsFull", v === "full"); render(); }),
            h("span", { style: "margin-left:12px" }, "Notes"), seg([["folded", "Folded"], ["full", "Full"]], s.tNotesFull ? "full" : "folded", (v) => { O.set("tNotesFull", v === "full"); render(); }))),
        h("div", { class: "row", style: "margin-top:8px" },
          h("span", { class: "muted" }, ids.length + (ids.length === 1 ? " sentence" : " sentences")), h("span", { class: "spacer" }),
          h("button", { class: "btn pri big", disabled: !ids.length || null, onclick: () => T.start(ids, s.tDir, tr.scope.map(scopeTitle).join(" + ")) }, "Start translating"))),
      h("div", { class: "row wrap" },
        h("button", { class: "btn", onclick: () => { tr.tab = "type"; render(); } }, "Type a sentence"),
        h("button", { class: "btn", onclick: () => { tr.tab = "import"; render(); } }, "Import sentences"),
        h("button", { class: "btn", onclick: () => { tr.tab = "library"; render(); } }, "Open Library")),
    ];
  }
  const emptyLibrary = () => h("div", { class: "card pad stack center" },
    h("div", { style: "font-size:20px;font-weight:700" }, "No sentences yet"),
    h("div", { class: "muted" }, "Import your teacher's sentences, or type a Greek sentence to translate."),
    h("div", { class: "row", style: "justify-content:center" },
      h("button", { class: "btn pri", onclick: () => { tr.tab = "import"; render(); } }, "Import sentences"),
      h("button", { class: "btn", onclick: () => { tr.tab = "type"; render(); } }, "Type a sentence")));

  // ---------- Library ----------
  function statusDot(r) {
    if (!r) return h("span", { class: "t-dot none", title: "Not translated yet" });
    return usedHelp(r) ? h("span", { class: "t-dot red", title: "Used help" }) : h("span", { class: "t-dot ok", title: "No help" }, "✓");
  }
  function helpTag(r) {
    if (!r) return null;
    if (usedHelp(r)) {
      const parts = [];
      if (r.hints) parts.push(r.hints + (r.hints === 1 ? " hint" : " hints"));
      if (r.charts) parts.push("Chart");
      if (r.structure) parts.push("Structure");
      return h("span", { class: "t-tag red" }, parts.join(" · "));
    }
    return r.retriedClean ? h("span", { class: "t-tag ok" }, "Retried clean ✓") : null;
  }
  const fmtDate = (t) => { if (!t) return ""; const d = new Date(t), now = new Date(); const days = Math.floor((now.setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5); return days === 0 ? "Today" : days === 1 ? "Yesterday" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };

  function viewLibrary() {
    const d = O.data, L = tr.lib;
    if (!d.sentences.length) return emptyLibrary();
    let list = d.sentences.slice();
    if (L.group !== "all") list = list.filter((s) => T.scopeIds(L.group).includes(s.id));
    if (L.chapter !== "all") list = list.filter((s) => String(s.chapter) === L.chapter);
    if (L.filter === "clean") list = list.filter((s) => { const r = lastResult(s.id); return r && !usedHelp(r); });
    if (L.filter === "red") list = list.filter((s) => usedHelp(lastResult(s.id)));
    if (L.q.trim()) {
      const q = O.fold(L.q.trim());
      list = list.filter((s) => O.fold(sentenceGreek(s)).includes(q) || O.fold(s.english || "").includes(q) || O.fold((d.tNotes[s.id] || {}).english || "").includes(q) || O.fold(s.ref || "").includes(q));
    }
    list.sort((a, b) => (d.pinnedSentences.includes(b.id) - d.pinnedSentences.includes(a.id)) || ((a.chapter ?? 999) - (b.chapter ?? 999)) || a.created - b.created);
    const all = d.sentences;
    const counts = { all: all.length, clean: all.filter((s) => { const r = lastResult(s.id); return r && !usedHelp(r); }).length, red: all.filter((s) => usedHelp(lastResult(s.id))).length };
    const groupChips = [["all", "All sentences"]].concat(
      d.sentenceGroups.slice().sort((a, b) => d.pinnedSentenceGroups.includes(b.id) - d.pinnedSentenceGroups.includes(a.id)).map((g) => ["g:" + g.id, (d.pinnedSentenceGroups.includes(g.id) ? "📌 " : "") + g.name + " · " + g.ids.filter((id) => byId(id)).length]));
    const selCount = L.sel.length;
    const toggleSel = (id) => { L.sel = L.sel.includes(id) ? L.sel.filter((x) => x !== id) : L.sel.concat(id); render(); };
    const row = (s) => {
      const r = lastResult(s.id), r2 = lastResult(s.id, "e2g"), pinned = d.pinnedSentences.includes(s.id);
      const eng = s.english || (d.tNotes[s.id] || {}).english || "";
      return h("div", { class: "li t-li" + (L.select && L.sel.includes(s.id) ? " pinned" : ""), onclick: () => L.select ? toggleSel(s.id) : askStart([s.id], s.ref || "Sentence") },
        L.select ? h("span", { class: "t-box" + (L.sel.includes(s.id) ? " on" : "") }, L.sel.includes(s.id) ? "✓" : "") : null,
        statusDot(r),
        h("div", { class: "t-li-main" },
          h("div", { class: "gk t-li-gk" }, pinned ? "📌 " : "", E.sentenceText(s, true)),
          eng ? h("div", { class: "muted small", style: "font-size:14px" }, eng) : null),
        helpTag(r), (O.data.tWork[s.id + "|g2e"] || O.data.tWork[s.id + "|e2g"]) && !L.select ? h("button", { class: "btn link", onclick: (e) => { e.stopPropagation(); showWork(workKeys([s.id])); } }, "📄 Work") : null, r2 ? h("span", { class: "t-tag" + (usedHelp(r2) ? " red" : " ok") }, "Eng → Gk " + (usedHelp(r2) ? "•" : "✓")) : null,
        h("div", { class: "muted small t-li-meta" }, [s.ref, s.chapter != null ? "Ch. " + s.chapter : "", fmtDate(r && r.at)].filter(Boolean).join(" · ")),
        L.select ? null : h("button", { class: "icon-btn" + (pinned ? " on" : ""), title: pinned ? "Unpin" : "Pin", onclick: (e) => { e.stopPropagation(); togglePinSentence(s.id); } }, (() => { const p = icon("pin"); if (pinned) p.setAttribute("fill", "currentColor"); return p; })()),
        L.select ? null : h("button", { class: "btn" + (usedHelp(r) ? " t-retry" : ""), onclick: (e) => { e.stopPropagation(); askStart([s.id], s.ref || "Sentence"); } }, usedHelp(r) ? "↺ Try again" : r ? "Again" : "Translate"));
    };
    const reds = T.scopeIds("red");
    return [
      h("div", { class: "row wrap" },
        h("input", { type: "text", placeholder: "Search Greek, English or reference", value: L.q, style: "flex:1;min-width:200px", oninput: (e) => { L.q = e.target.value; clearTimeout(tr.qt); tr.qt = setTimeout(render, 250); } }),
        h("button", { class: "btn" + (L.select ? " pri" : ""), onclick: () => { L.select = !L.select; L.sel = []; render(); } }, L.select ? "Done" : "Select"),
        h("button", { class: "btn pri", onclick: () => { tr.tab = "import"; render(); } }, "Import sentences")),
      h("div", { class: "row wrap" }, h("span", { class: "label", style: "margin:0 4px 0 0" }, "Groups"),
        h("div", { class: "chips" }, groupChips.map(([k, lab]) => h("button", {
          class: "chip" + (L.group === k ? " on" : ""), onclick: () => { L.group = k; render(); },
          oncontextmenu: k.startsWith("g:") ? (e) => { e.preventDefault(); groupMenu(k.slice(2)); } : null,
        }, lab)), h("button", { class: "chip new", onclick: () => groupEditor(null) }, "+ New group"))),
      h("div", { class: "row wrap" },
        seg([["all", "All · " + counts.all], ["clean", "No help · " + counts.clean], ["red", "Used help · " + counts.red]], L.filter, (v) => { L.filter = v; render(); }),
        h("select", { onchange: (e) => { L.chapter = e.target.value; render(); } },
          h("option", { value: "all" }, "All chapters"), sentenceChapters().map((c) => h("option", { value: String(c), selected: L.chapter === String(c) || null }, "Chapter " + c))),
        L.group.startsWith("g:") ? h("button", { class: "btn link", onclick: () => groupMenu(L.group.slice(2)) }, "Edit group") : null,
        h("span", { class: "spacer" }),
        reds.length ? h("button", { class: "btn pri", onclick: () => askStart(reds, "Used help") }, "↺ Retry all red · " + reds.length) : null),
      list.length ? h("div", { class: "list" }, list.map(row)) : h("div", { class: "muted center", style: "padding:30px" }, "Nothing matches."),
      L.select ? h("div", { class: "t-selbar" },
        h("b", null, selCount + " selected"),
        h("select", { disabled: !selCount || null, onchange: (e) => { const v = e.target.value; e.target.value = ""; if (v === "new") groupEditor(null, L.sel.slice()); else if (v) { const g = d.sentenceGroups.find((x) => x.id === v); L.sel.forEach((id) => { if (!g.ids.includes(id)) g.ids.push(id); }); O.save(); render(); } } },
          h("option", { value: "" }, "+ Add to group…"), d.sentenceGroups.map((g) => h("option", { value: g.id }, g.name)), h("option", { value: "new" }, "New group…")),
        h("button", { class: "btn", disabled: !selCount || null, onclick: () => { L.sel.forEach((id) => { if (!d.pinnedSentences.includes(id)) d.pinnedSentences.push(id); }); O.save(); render(); } }, "📌 Pin"),
        h("button", { class: "btn", disabled: !selCount || null, onclick: () => askStart(L.sel.slice(), "Selected sentences") }, "Practice these"),
        h("button", { class: "btn", disabled: !selCount || null, onclick: () => { const k = workKeys(L.sel); if (k.length) showWork(k); else alert("None of these sentences have been translated yet."); } }, "📄 Show work"),
        h("button", { class: "btn red", disabled: !selCount || null, onclick: () => { if (confirm(`Delete ${selCount} sentence${selCount === 1 ? "" : "s"}?`)) { deleteSentences(L.sel); L.sel = []; render(); } } }, "Delete")) : null,
    ];
  }
  function togglePinSentence(id) { const l = O.data.pinnedSentences, i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id); O.save(); render(); }
  function deleteSentences(ids) {
    const d = O.data, set = new Set(ids);
    d.sentences = d.sentences.filter((s) => !set.has(s.id));
    d.sentenceGroups.forEach((g) => { g.ids = g.ids.filter((id) => !set.has(id)); });
    d.pinnedSentences = d.pinnedSentences.filter((id) => !set.has(id));
    ids.forEach((id) => { delete d.tNotes[id]; delete d.tResults[id + "|g2e"]; delete d.tResults[id + "|e2g"]; });
    O.save();
  }
  // From the Library: ask which way to translate before starting.
  function askStart(ids, title) {
    if (!ids.length) return;
    const one = ids.length === 1;
    const status = (dir) => {
      if (!one) return null;
      const r = lastResult(ids[0], dir);
      return h("span", { class: "muted small" }, !r ? "Not done yet" : usedHelp(r) ? h("span", null, h("span", { class: "t-dot red" }), " Done with help") : "✓ Done");
    };
    const pick = (dir) => { O.set("tDir", dir); closeModal(); T.start(ids, dir, title); };
    const choice = (dir, top, sub) => h("button", { class: "t-dirpick" + (S().tDir === dir ? " last" : ""), onclick: () => pick(dir) },
      h("b", null, top), h("span", { class: "muted small" }, sub), status(dir));
    openModal(() => h("div", { class: sheetClass(), style: "width:min(440px,100%)" }, h("div", { class: "body stack" },
      h("div", { style: "font-size:20px;font-weight:700" }, "How do you want to translate " + (one ? "it" : "these " + ids.length) + "?"),
      choice("g2e", "Greek → English", "Parse each Greek word, build the skeleton, write the English."),
      choice("e2g", "English → Greek", "Build each Greek word from the English, then write the Greek sentence."),
      h("button", { class: "btn link", onclick: closeModal }, "Cancel"))));
  }
  function groupMenu(gid) {
    const d = O.data, g = d.sentenceGroups.find((x) => x.id === gid);
    if (!g) return;
    openModal(() => h("div", { class: sheetClass(), style: "width:min(420px,100%)" }, h("div", { class: "body stack" },
      h("div", { style: "font-size:20px;font-weight:700" }, g.name),
      h("button", { class: "btn", onclick: () => { closeModal(); groupEditor(g); } }, "Edit group"),
      h("button", { class: "btn", onclick: () => { const l = d.pinnedSentenceGroups, i = l.indexOf(gid); if (i >= 0) l.splice(i, 1); else l.push(gid); O.save(); closeModal(); } }, d.pinnedSentenceGroups.includes(gid) ? "Unpin group" : "📌 Pin group"),
      h("button", { class: "btn", onclick: () => { closeModal(); askStart(T.scopeIds("g:" + gid), g.name); } }, "Practice this group"),
      h("button", { class: "btn", onclick: () => { const k = workKeys(T.scopeIds("g:" + gid)); if (k.length) showWork(k, null, g.name); else alert("No sentences in this group have been translated yet."); } }, "📄 Show work for this group"),
      h("button", { class: "btn red", onclick: () => { if (confirm(`Delete the group "${g.name}"? The sentences stay in your Library.`)) { d.sentenceGroups = d.sentenceGroups.filter((x) => x.id !== gid); if (tr.lib.group === "g:" + gid) tr.lib.group = "all"; O.save(); closeModal(); } } }, "Delete group"),
      h("button", { class: "btn link", onclick: closeModal }, "Close"))));
  }
  function groupEditor(group, preselect) {
    const d = O.data;
    let name = group ? group.name : "", q = "";
    const sel = new Set(group ? group.ids : preselect || []);
    openModal(() => {
      const list = d.sentences.filter((s) => !q || O.fold(sentenceGreek(s) + " " + (s.ref || "") + " " + (s.english || "")).includes(O.fold(q)));
      return h("div", { class: sheetClass() },
        h("div", { class: "body stack" },
          h("div", { style: "font-size:21px;font-weight:700" }, group ? "Edit group" : "New group"),
          h("input", { type: "text", placeholder: "Group name (e.g. Exam review)", value: name, "data-autofocus": "", oninput: (e) => { name = e.target.value; } }),
          h("input", { type: "text", placeholder: "Search sentences", value: q, oninput: (e) => { q = e.target.value; clearTimeout(tr.gq); tr.gq = setTimeout(render, 250); } }),
          h("div", { class: "row" }, h("span", { class: "muted small" }, sel.size + " selected"), h("span", { class: "spacer" }),
            h("button", { class: "btn link", onclick: () => { list.forEach((s) => sel.add(s.id)); render(); } }, "Select all shown"),
            h("button", { class: "btn link", onclick: () => { sel.clear(); render(); } }, "Clear")),
          h("div", { class: "list", style: "max-height:46vh;overflow:auto" }, list.map((s) => h("label", { class: "li" },
            h("input", { type: "checkbox", checked: sel.has(s.id) || null, onchange: (e) => { if (e.target.checked) sel.add(s.id); else sel.delete(s.id); render(); } }),
            h("span", { class: "gk", style: "flex:1" }, sentenceGreek(s)), h("span", { class: "muted small" }, s.ref))))),
        h("div", { class: "foot" },
          h("button", { class: "btn", onclick: closeModal }, "Cancel"),
          h("button", { class: "btn pri", onclick: () => {
            if (!name.trim()) { alert("Give the group a name."); return; }
            if (group) { group.name = name.trim(); group.ids = d.sentences.filter((s) => sel.has(s.id)).map((s) => s.id); }
            else d.sentenceGroups.push({ id: O.uid("sg"), name: name.trim(), ids: d.sentences.filter((s) => sel.has(s.id)).map((s) => s.id) });
            O.save(); tr.lib.select = false; tr.lib.sel = []; closeModal();
          } }, "Save group")));
    });
  }

  // ---------- Import ----------
  function viewImport() {
    const I = tr.imp, d = O.data;
    const parsed = E.parseSentences(I.text);
    const ready = E.ready || waitGNT();
    const chapters = [...new Set(parsed.map((s) => s.chapter).filter((c) => c != null))];
    if (!I.chapters || I.chapterKey !== chapters.join("|")) { I.chapters = chapters.slice(); I.chapterKey = chapters.join("|"); }
    const chosen = parsed.filter((s) => s.chapter == null || I.chapters.includes(s.chapter));
    const loadFile = () => {
      const inp = h("input", { type: "file", accept: ".txt,.text,.md,text/plain", style: "display:none" });
      inp.addEventListener("change", () => { const f = inp.files[0]; if (!f) return; f.text().then((t) => { I.text = t; I.chapters = null; render(); }); });
      document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 60000);
    };
    return [
      h("div", { class: "t-imp" },
        h("div", { class: "card pad stack" },
          h("div", { class: "row" }, h("b", null, "Your sentences"), h("span", { class: "spacer" }), h("button", { class: "btn", onclick: loadFile }, "Load a text file…")),
          h("textarea", { placeholder: "Chapter 9\n1. ὁ ἀδελφός σου ἔχει τι (something) κατὰ σου (Matt 5:23).\n2. καὶ ἐπίστευσαν (they believed) τῇ γραφῇ (Scripture) …", value: I.text, style: "min-height:260px",
            oninput: (e) => { I.text = e.target.value; clearTimeout(tr.it); tr.it = setTimeout(() => { const a = document.activeElement, pos = a && a.selectionStart; render(); const t = document.querySelector(".t-imp textarea"); if (t && a && a.tagName === "TEXTAREA") { t.focus(); t.setSelectionRange(pos, pos); } }, 500); } }),
          h("div", { class: "note" },
            h("b", null, "Format: "), "“Chapter 9” on its own line starts a chapter. Number each sentence (1. 2. 3.); a sentence can run onto the next line. ",
            "A translation in parentheses right after a word, like ", h("span", { class: "greek" }, "τι (something)"), ", makes it a given word. A reference at the end, like (John 2:22), is saved too. You can add your own English after a dash: ", h("span", { class: "greek" }, "— "), "English."),
          d.sentencePresets.length ? h("div", { class: "row wrap" }, h("span", { class: "muted small" }, "Presets:"), d.sentencePresets.map((p) =>
            h("button", { class: "chip", onclick: () => { I.text = p.text; I.chapters = null; render(); }, oncontextmenu: (e) => { e.preventDefault(); if (confirm(`Delete the preset "${p.name}"?`)) { d.sentencePresets = d.sentencePresets.filter((x) => x.id !== p.id); O.save(); render(); } } }, p.name))) : null),
        h("div", { class: "card pad stack" },
          h("b", null, "Preview · " + parsed.length + (parsed.length === 1 ? " sentence" : " sentences")),
          !parsed.length ? h("div", { class: "muted" }, "Paste sentences on the left to see them here.") :
            h("div", { class: "t-prev" }, parsed.map((s) => {
              const st = ready ? E.keyStatus(s) : { label: "Checking…", full: false };
              return h("div", { class: "t-prev-row" + (s.chapter != null && !I.chapters.includes(s.chapter) ? " off" : "") },
                h("div", { style: "flex:1;min-width:0" }, h("div", { class: "greek", style: "font-size:18px" }, E.sentenceText(s, true)), s.english ? h("div", { class: "muted small" }, s.english) : null),
                h("div", { style: "text-align:right;flex:none;max-width:45%" }, h("div", { class: "muted small" }, [s.chapter != null ? "Ch. " + s.chapter : "", s.ref].filter(Boolean).join(" · ")),
                  h("span", { class: "t-tag " + (st.full ? "ok" : "warn") }, st.label)));
            })))),
      parsed.length ? h("div", { class: "card pad row wrap", style: "gap:16px" },
        chapters.length ? h("div", null, h("div", { class: "label", style: "margin-top:0" }, "Chapters to add"),
          h("div", { class: "chips" }, chapters.map((c) => h("button", { class: "chip" + (I.chapters.includes(c) ? " on" : ""), onclick: () => { I.chapters = I.chapters.includes(c) ? I.chapters.filter((x) => x !== c) : I.chapters.concat(c); render(); } }, "Chapter " + c)))) : null,
        toggle(I.groupByChapter, "Group by chapter", (v) => { I.groupByChapter = v; render(); }),
        h("label", { class: "row" }, "Add to group",
          h("select", { onchange: (e) => { I.addTo = e.target.value; } }, h("option", { value: "" }, "None"), d.sentenceGroups.map((g) => h("option", { value: g.id, selected: I.addTo === g.id || null }, g.name)))),
        h("span", { class: "spacer" }),
        h("button", { class: "btn", onclick: () => { const name = prompt("Name this preset", chapters.length ? "Chapter " + chapters.join(", ") + " sentences" : "My sentences"); if (name) { d.sentencePresets.push({ id: O.uid("sp"), name, text: I.text }); O.save(); render(); } } }, "Save as preset"),
        h("button", { class: "btn pri", disabled: !chosen.length || null, onclick: () => {
          const added = T.addSentences(chosen, I.groupByChapter, I.addTo);
          const skipped = chosen.length - added.length;
          alert(`Added ${added.length} sentence${added.length === 1 ? "" : "s"}.` + (skipped ? ` ${skipped} ${skipped === 1 ? "was" : "were"} already in your Library.` : ""));
          I.text = ""; I.chapters = null; tr.tab = "library"; render();
        } }, `Add ${chosen.length} sentence${chosen.length === 1 ? "" : "s"}`)) : null,
    ];
  }

  // ---------- Type a sentence ----------
  function viewType() {
    const Y = tr.type;
    if (!E.ready && !waitGNT()) return loadingNote();
    const box = h("div", { class: "t-type-out" });
    const paint = () => box.replaceChildren(typePreview());
    // A box that grows and wraps. Greek letters everywhere except inside
    // ( ), so a gloss like (everyone) or a reference like (Matt 7:26) stays English.
    const input = h("textarea", { class: "t-in gk t-type-in", rows: "1", placeholder: "Type here: kai egw autos anqrwpos eimi", autocomplete: "off", spellcheck: "false", autocapitalize: "off", "data-autofocus": "" });
    input.value = Y.text;
    const grow = () => { input.style.height = "auto"; input.style.height = input.scrollHeight + 2 + "px"; };
    input.addEventListener("input", () => {
      const pos = input.selectionStart, before = input.value.length;
      const g = toGreekOutsideParens(input.value);
      if (g !== input.value) { input.value = g; const p2 = pos + (g.length - before); input.setSelectionRange(p2, p2); }
      Y.text = input.value; Y.picks = {}; grow(); paint();
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
    requestAnimationFrame(grow);
    paint();
    return [
      h("div", { class: "card pad stack" },
        h("div", { class: "row wrap" }, h("b", null, "You type"), h("span", { class: "spacer" }),
          h("span", { class: "muted small" }, "h = η · q = θ · c = ξ · u = υ · f = φ · x = χ · y = ψ · w = ω · σ becomes ς at the end of a word")),
        input,
        h("div", { class: "muted small" }, "Leave out accents and breathing marks. Ostraka adds them for you."),
        box),
    ];
  }
  function toGreekOutsideParens(v) {
    return v.split(/(\([^()]*\)?)/).map((seg) => (seg.startsWith("(") ? seg : O.toGreek(seg))).join("");
  }
  // Pull out "(gloss)" after a word and a "(Matt 7:26)" reference at the end,
  // the same way the teacher's sentences are written for Import.
  function typedResult() {
    const Y = tr.type;
    let text = Y.text, myRef = null;
    const rm = text.match(/\(([^()]*\d+\s*:\s*\d+[^()]*)\)[\s.]*$/);
    if (rm && E.parseRef(rm[1])) { myRef = E.parseRef(rm[1]); text = text.slice(0, rm.index); }
    const glosses = {};
    text = text.replace(/\(([^()]*)\)?/g, (m, g, off) => {
      const words = (text.slice(0, off).match(/\S*\p{L}\S*/gu) || []).length;
      if (words && (g || "").trim()) glosses[words - 1] = g.trim();
      return " ";
    });
    const r = E.restoreSentence(text);
    r.words.forEach((w, i) => { if (Y.picks[i]) { w.text = Y.picks[i]; w.segs = E.addedMarks(w.typed, w.text); } if (glosses[i]) w.gloss = glosses[i]; });
    if (!r.ref && myRef) r.myRef = myRef;
    return r;
  }
  function typePreview() {
    const Y = tr.type;
    if (!Y.text.trim()) return h("div", { class: "muted" }, "Your sentence will appear here with accents and breathing marks.");
    const r = typedResult();
    if (!r.words.length) return h("div", { class: "muted" }, "Type Greek letters to start.");
    const unknown = r.words.filter((w) => !w.known);
    const amb = r.words.map((w, i) => [w, i]).filter(([w]) => w.alts && w.alts.length > 1);
    const text = r.words.map((w) => w.text + (w.gloss ? ` (${w.gloss})` : "") + w.post).join(" ");
    const refLabel = r.ref ? r.ref.label : r.myRef ? r.myRef.label : "";
    const save = (thenStart) => {
      const s = E.parseOne(text + (refLabel ? ` (${refLabel})` : ""), null);
      if (!s) return;
      const added = T.addSentences([s], false, "");
      const rec = added[0] || O.data.sentences.find((x) => O.fold(sentenceGreek(x)) === O.fold(sentenceGreek(s)));
      if (thenStart && rec) T.start([rec.id], S().tDir, rec.ref || "Your sentence");
      else { alert(added.length ? "Saved to your Library." : "That sentence is already in your Library."); render(); }
    };
    return h("div", { class: "stack" },
      h("div", { class: "row wrap" }, h("b", null, "With accents & breathing marks"), h("span", { class: "spacer" }), h("span", { class: "muted small" }, h("span", { class: "t-add" }, "gold"), " = added for you")),
      h("div", { class: "t-type-res" }, r.words.map((w, i) => h("span", {
        class: "t-tw" + (w.alts && w.alts.length > 1 ? " amb" : "") + (w.known ? "" : " unk"),
        title: !w.known ? "Not found in the New Testament. Check this word yourself." : w.alts && w.alts.length > 1 ? "Tap to choose a different spelling" : null,
        onclick: w.alts && w.alts.length > 1 ? () => { const cur = w.alts.indexOf(E.restoreWord(w.typed).text === w.text ? w.alts[0] : w.text.normalize("NFD").replace(/̀/g, "́").normalize("NFC")); tr.type.picks[i] = w.alts[(cur + 1) % w.alts.length]; const b = document.querySelector(".t-type-out"); if (b) b.replaceChildren(typePreview()); } : null,
      }, w.segs.map((sg) => sg.add ? h("span", { class: "t-add" }, sg.t) : sg.t), w.gloss ? h("span", { class: "t-tgloss" }, " (" + w.gloss + ")") : null, w.post)),
        refLabel && !r.ref ? h("span", { class: "t-tgloss" }, "(" + refLabel + ")") : null),
      r.ref ? h("div", { class: "t-found" }, h("span", { class: "t-ok" }, "✓"), h("div", null, h("b", null, "Found in the New Testament: " + r.ref.label + "."), " Ostraka can check your parsing for every word in this sentence.")) : null,
      amb.length ? h("div", { class: "note" }, h("b", null, "Some words could be more than one thing. "), "They have a dotted line. Ostraka picked the most likely one; tap a word to switch: ",
        amb.map(([w]) => h("span", { class: "greek", style: "margin-right:10px" }, w.alts.join(" / ")))) : null,
      unknown.length ? h("div", { class: "note", style: "color:var(--bad)" }, "Not in the New Testament, so no marks were added: ", unknown.map((w) => w.typed).join(", "), ". Check these yourself. Sentences that aren't New Testament verses are self-checked.") : null,
      h("div", { class: "row wrap" },
        h("button", { class: "btn", onclick: () => { tr.type = { text: "", picks: {} }; render(); } }, "Clear"),
        h("span", { class: "spacer" }),
        h("button", { class: "btn", onclick: () => save(false) }, "Save to Library"),
        h("button", { class: "btn pri", onclick: () => save(true) }, "Translate this sentence →")));
  }

  // ---------- Sessions ----------
  T.start = (ids, dir, title) => {
    ids = ids.filter((id) => byId(id));
    if (!ids.length) return;
    T.session = { ids, i: 0, dir: dir || "g2e", title: title || "Translate", done: [] };
    if (!E.ready) { E.load(() => { prepare(); render(); }); render(); return; }
    prepare(); render();
  };
  T.close = () => { T.session = null; render(); };

  function prepare() {
    const ss = T.session, s = byId(ss.ids[ss.i]);
    const units = E.units(s, S().tLinkArticles);
    const pal = shuffle(palette());
    const notes = O.data.tNotes[s.id] || {};
    Object.assign(ss, {
      s, units, colors: units.map((u, n) => pal[n % pal.length]), phase: "parse",
      ans: units.map((u) => ({ f: {}, ok: {}, done: !!u.given, tries: 0, missed: false, hl: false, skip: false })),
      help: { hints: 0, charts: 0, structure: false, seen: {} }, start: Date.now(), lines: {}, hint: null,
      outline: null, english: "", englishResult: null, greekText: "", greekResult: null, notes,
    });
    ss.cur = ss.ans.findIndex((a) => !a.done);
    if (ss.cur < 0) ss.phase = "parsed";
  }
  const unitForms = (u) => E.unitForms(T.session.s, u);
  const unitKind = (u) => { const f = unitForms(u); return f.length ? E.posName(f[0].pos) : null; };
  const unitTakes = (u) => E.takes(T.session.s, u.head);
  const cueFor = (u, n) => {
    const ss = T.session;
    if (u.given) return u.given;
    const mine = (ss.notes.ctx || [])[n];
    if (mine) return mine;
    const f = unitForms(u)[0];
    if (!f) return "?";
    const g = (E.gloss(f.lemma) || "").split(/[,;(]/)[0].trim().replace(/^I /, "");
    return (u.article ? "the " : "") + (g || f.lemma);
  };
  const labelsFull = () => S().tLabelsFull;

  // Which steps a unit has, in order.
  function stepsFor(u) {
    if (T.session.dir === "e2g") return ["kind", "lex", "parse", "form"];
    return noLex(u) ? ["kind", "mean", "parse", "ctx"] : ["kind", "lex", "mean", "parse", "ctx"];
  }
  // Words that never change form (οὖν, καί, ἐν, οὐ…) are already their own
  // dictionary form, so there's no lexical-form question for them.
  function noParse(u) {
    const forms = unitForms(u);
    return forms.length > 0 && forms.every((f) => ["Conjunction", "Adverb", "Particle"].includes(E.posName(f.pos)));
  }
  function noLex(u) {
    if (T.session.dir === "e2g" || u.given) return false;
    const forms = unitForms(u);
    return forms.length > 0 && forms.every((f) => ["Conjunction", "Preposition", "Adverb", "Particle"].includes(E.posName(f.pos)) && E.fw(f.lemma) === E.fw(u.greek));
  }
  function fieldsNow(u, a) {
    const kind = a.f.kind || unitKind(u);
    const f = unitForms(u)[0];
    return E.fieldsFor(kind, a.f.mood, f ? f.parse : null);
  }
  function parseLabel(u, a, onlyOk) {
    const fields = fieldsNow(u, a);
    return E.parseLabel(fields, (fl) => (!onlyOk || a.ok["p:" + fl] ? a.f[fl] : null), labelsFull());
  }

  // Check every filled answer for the current unit.
  function checkUnit() {
    const ss = T.session, n = ss.cur, u = ss.units[n], a = ss.ans[n];
    if (n < 0 || !u) return;
    const forms = unitForms(u), noKey = !forms.length;
    if (!a.open) a.open = {};
    if (!a.closed) a.closed = {};
    a.tries++;
    let allOk = true;
    const mark = (k, ok) => { a.ok[k] = !!ok; if (!ok) allOk = false; };
    for (const step of stepsFor(u)) {
      if (step === "kind") mark("kind", !!a.f.kind && (noKey || forms.some((f) => E.posName(f.pos) === a.f.kind)));
      if (step === "lex") {
        const v = E.fw(a.f.lex || "");
        mark("lex", !!v && (noKey || forms.some((f) => E.fw(f.lemma) === v) || (u.article && forms.some((f) => v === E.fw("ὁ " + f.lemma)))));
      }
      if (step === "mean") {
        const gl = forms.length ? E.gloss(forms[0].lemma) : "";
        mark("mean", !!(a.f.mean || "").trim() && (a.override || !gl || meanOk(a.f.mean, gl)));
      }
      if (step === "parse") {
        const fields = fieldsNow(u, a);
        if (!fields.length) { a.ok.parse = true; continue; }
        let all = true;
        for (const fl of fields) {
          const ok = !!a.f[fl] && (noKey || forms.some((f) => E.checkField(fl, a.f[fl], f.parse, fl === "takes" ? unitTakes(u) : null)));
          a.ok["p:" + fl] = !!ok; if (!ok) all = false;
        }
        mark("parse", all);
      }
      if (step === "ctx") {
        const t = (a.f.ctx || "").trim();
        const problem = t ? ctxProblem(u, forms, t) : null;
        // A warning, not a hard stop: some verbs take a genitive object, so
        // pressing Check again with the same answer keeps it.
        const keep = problem && a.ctxKeep === t;
        mark("ctx", !!t && (!problem || keep));
        a.ctxMsg = problem && !keep ? problem : null;
        a.ctxKeep = problem ? t : null;
      }
      if (step === "form") mark("form", !!a.f.form && E.fw(a.f.form) === E.fw(u.greek));
    }
    ["lex", "mean", "ctx", "form"].forEach((k) => { if (a.ok[k]) { a.closed[k] = true; delete a.open[k]; } });
    Object.keys(a.ok).forEach((k) => { if (k.startsWith("p:") && a.ok[k]) delete a.open[k]; });
    if (a.ok.kind) delete a.open.kind;
    if (!allOk) { a.missed = true; render(); return; }
    a.done = true; a.skip = false; ss.hint = null;
    advance();
  }
  function advance() {
    const ss = T.session;
    const from = ss.cur;
    let next = ss.ans.findIndex((a, i) => i > from && !a.done && !a.skip);
    if (next < 0) next = ss.ans.findIndex((a) => !a.done && !a.skip);
    if (next < 0) { next = ss.ans.findIndex((a) => !a.done); if (next >= 0) ss.ans.forEach((a) => { a.skip = false; }); }
    ss.cur = next;
    if (next < 0) ss.phase = "parsed";
    render();
  }

  // ---------- Hints ----------
  // Does the English fit the case? Right now: a genitive usually shows up as
  // "of …", "…'s", "from …" or a possessive like "my" or "his".
  function ctxProblem(u, forms, text) {
    const f = forms[0];
    if (!f || !f.parse || f.parse[4] !== "G") return null;
    if (!["Noun", "Pronoun", "Adjective", "Article"].includes(E.posName(f.pos))) return null;
    const ss = T.session, prev = ss.units[ss.units.indexOf(u) - 1];
    if (prev) { const pf = unitForms(prev)[0]; if (pf && E.posName(pf.pos) === "Preposition") return null; }
    const t = " " + text.toLowerCase().replace(/[’‘]/g, "'") + " ";
    if (/\b(of|from|than|about|by|whose|my|your|his|her|its|our|their|mine|yours)\b|'s\b|s'/.test(t)) return null;
    return `${u.greek} is genitive, so it usually reads “of …” (or “…'s”, or “my/his/their …”). If your English fits here anyway, press Check again to keep it.`;
  }
  // "and, even, also" counts when any of the meanings listed is right.
  function meanOk(ans, gl) {
    if (O.checkEnglish(ans, gl)) return true;
    const parts = ans.split(/[,;\/]| or /).map((x) => x.trim()).filter(Boolean);
    return parts.length > 1 && parts.some((x) => O.checkEnglish(x, gl));
  }
  function currentStep(u, a) { return stepsFor(u).find((st) => !a.ok[st]) || "ctx"; }
  function hintText(u, a, step, tier) {
    const forms = unitForms(u), f = forms[0];
    const word = T.session.s.tokens[u.head].w;
    if (!f) return "This word isn't in the answer key, so Ostraka can't give a hint for it. Check it with the Charts button or your notes.";
    const kind = E.posName(f.pos);
    if (step === "kind") {
      if (tier === 1) return "Look at the ending of the word, and whether an article (ὁ, ἡ, τό…) comes right before it. Verbs end in person endings like -ω, -εις, -ει; nouns end in case endings like -ος, -ου, -ῳ, -ον.";
      const other = shuffle(E.KINDS.filter((k) => k !== kind))[0];
      return `It's either a ${[kind, other].sort().join(" or a ")}.`;
    }
    if (step === "lex") {
      const L = f.lemma;
      if (tier === 1) return `The dictionary form starts with “${[...L][0]}” and has ${[...E.fw(L)].length} letters.`;
      return `It starts with “${[...L].slice(0, Math.ceil([...L].length / 2)).join("")}…”`;
    }
    if (step === "mean") {
      const gl = (E.gloss(f.lemma) || "").split(/[,;]/)[0].trim();
      if (!gl) return "Use the meaning you know best for " + f.lemma + ".";
      if (tier === 1) return `It starts with “${gl[0]}”.`;
      return gl.replace(/\B\w/g, "_");
    }
    if (step === "parse") {
      const fields = fieldsNow(u, a);
      const ending = [...word.normalize("NFC")].slice(-3).join("");
      if (tier === 1) return kind === "Preposition" ? "Look at the article or noun right after it. Its case shows which case this preposition takes." :
        `Look at the ending: -${ending}. The Charts button shows the chart it comes from.`;
      const fl = fields.find((x) => !a.ok["p:" + x]) || fields[0];
      if (!fl) return "This word has nothing to parse.";
      if (fl === "takes") { const t = unitTakes(u); return t ? `It takes the ${E.optLabel("takes", t, true)}.` : "Check the word after it."; }
      return `${E.FIELDS[fl].name}: ${E.optLabel(fl, f.parse[E.FIELDS[fl].i], true)}.`;
    }
    if (step === "ctx") return tier === 1 ? "Fit the meaning into this sentence. Genitive is often “of …”, dative “to/for …”, and a verb's ending tells you who does it (I, you, he/she/it…)." :
      "Read the words around it. What would sound natural here in English?";
    if (step === "form") {
      if (tier === 1) return `Start from ${f.lemma} and add the ending for: ${E.parseLabel(E.fieldsFor(kind, f.parse[3], f.parse), (x) => (x === "takes" ? null : f.parse[E.FIELDS[x].i]), true)}.`;
      return `It starts with “${[...u.greek].slice(0, Math.ceil([...u.greek].length / 2)).join("")}…”`;
    }
    return "";
  }
  function openHint() {
    const ss = T.session;
    if (ss.phase !== "parse" || ss.cur < 0) { ss.hint = { general: true }; render(); return; }
    const u = ss.units[ss.cur], a = ss.ans[ss.cur], step = currentStep(u, a);
    const tier = ss.hint && ss.hint.u === ss.cur && ss.hint.step === step ? Math.min(2, ss.hint.tier + 1) : 1;
    const k = ss.cur + "|" + step + "|" + tier;
    if (!ss.help.seen[k]) { ss.help.seen[k] = true; ss.help.hints++; }
    ss.hint = { u: ss.cur, step, tier };
    render();
  }
  function hintPop() {
    const ss = T.session;
    if (!ss.hint) return null;
    let body, title;
    if (ss.hint.general) {
      title = "Hint";
      body = ss.phase === "skeleton" ? "Find the verb first and put it at the top. Then ask: who does it (nominative), what receives it (accusative), and which phrases start with a preposition. Indent each phrase under the word it describes." :
        "Use the outline: start with the verb, then its subject and object, then the phrases. Read your word-by-word line for the meanings.";
    } else {
      const u = ss.units[ss.hint.u], a = ss.ans[ss.hint.u];
      title = `Hint ${ss.hint.tier} of 2 · ` + { kind: "What is it?", lex: "Lexical form", mean: "Meaning", parse: "Parsing", ctx: "In this sentence", form: "Writing the form" }[ss.hint.step];
      body = hintText(u, a, ss.hint.step, ss.hint.tier);
    }
    return h("div", { class: "t-pop" + ap("thint", JSON.stringify(ss.hint)) },
      h("div", { class: "row" }, h("b", { style: "color:var(--accent)" }, title), h("span", { class: "spacer" }), h("button", { class: "icon-btn", onclick: () => { ss.hint = null; render(); } }, icon("x"))),
      h("div", null, body),
      !ss.hint.general && ss.hint.tier < 2 ? h("button", { class: "btn", onclick: openHint }, "Next hint") : null,
      h("div", { class: "muted small" }, "Hints you use are noted in your Library."));
  }

  // ---------- View settings (⚙) ----------
  function settingsPop() {
    const ss = T.session;
    if (!ss.settingsOpen) return null;
    const lines = makeLines(ss.units);
    const lineDone = (ln) => ln.every((n) => ss.ans[n].done);
    const curLine = lines.findIndex((ln) => ln.includes(ss.cur));
    return h("div", { class: "t-pop t-set" + ap("tset", "1") },
      h("div", { class: "row" }, h("b", null, "View"), h("span", { class: "spacer" }), h("button", { class: "icon-btn", onclick: () => { ss.settingsOpen = false; render(); } }, icon("x"))),
      h("div", { class: "t-set-row" }, h("span", null, "Notes"), seg([["folded", "Folded"], ["full", "Full"]], S().tNotesFull ? "full" : "folded", (v) => { O.set("tNotesFull", v === "full"); Object.keys(ss.lines).forEach((k) => { if (ss.lines[k] === "open") delete ss.lines[k]; }); render(); })),
      h("div", { class: "t-set-row" }, h("span", null, "Labels"), seg([["full", "Full words"], ["short", "Short"]], labelsFull() ? "full" : "short", (v) => { O.set("tLabelsFull", v === "full"); render(); })),
      lines.length > 1 ? (() => {
        const closedNow = lines.some((l, i) => ss.lines[i] === "closed" || (ss.lines[i] !== "open" && lineDone(l) && i !== curLine));
        return h("div", { class: "t-set-row" }, h("span", null, "Lines"),
          closedNow ? h("button", { class: "btn", onclick: () => { lines.forEach((l, i) => { ss.lines[i] = "open"; }); render(); } }, "▾ Expand all")
            : h("button", { class: "btn", onclick: () => { lines.forEach((l, i) => { if (lineDone(l) && i !== curLine) ss.lines[i] = "closed"; else delete ss.lines[i]; }); render(); } }, "▸ Minimize finished"));
      })() : null,
      h("div", { class: "t-set-row" }, h("span", null, "Colors"), h("button", { class: "btn", onclick: () => { const pal = shuffle(palette()); ss.colors = ss.units.map((u, n) => pal[n % pal.length]); render(); } }, "⟳ New colors")),
      lines.length > 1 ? h("div", { class: "muted small" }, "Long sentences are split into lines by length only, so the lines give no grammar clues.") : null);
  }

  // ---------- Charts ----------
  function openCharts() {
    const ss = T.session;
    if (!ss.help.charts) ss.help.charts = 1;
    const ids = E.charts(ss.s);
    let cur = ids[0];
    openModal(() => {
      const p = cur ? O.pById(cur) : null;
      return h("div", { class: sheetClass(), style: "width:min(760px,100%)" },
        h("div", { class: "body stack" },
          h("div", { class: "row" }, h("div", { style: "font-size:20px;font-weight:700" }, "Charts for this sentence"), h("span", { class: "spacer" }), h("button", { class: "icon-btn", onclick: closeModal }, icon("x"))),
          ids.length ? h("div", { class: "chips" }, ids.map((id) => { const q = O.pById(id); return h("button", { class: "chip" + (id === cur ? " on" : ""), onclick: () => { cur = id; render(); } }, q.title.replace(" indicative", "") + " · " + q.lemma.split(",")[0]); })) :
            h("div", { class: "muted" }, "No built-in charts match the words in this sentence. Open Paradigms for all 68 charts."),
          p ? h("div", { class: "scroll-x" }, chartTable(p)) : null,
          h("div", { class: "small", style: "color:var(--bad)" }, "● Opening charts marks this sentence “Translated with chart.”")));
    });
  }
  function chartTable(p) {
    return h("table", { class: "ref" },
      h("tr", null, h("th", null, ""), p.columns.map((c) => h("th", null, c))),
      p.rows.map((r, i) => h("tr", null, h("td", { class: "rl" }, r), p.cells[i].map((c) => h("td", null, O.pDisplay(c))))));
  }

  // ---------- Rendering a session ----------
  T.renderSession = () => {
    const ss = T.session;
    if (!E.ready) return h("div", { class: "session" }, h("div", { class: "s-inner" }, loadingNote()));
    const s = ss.s;
    const stepNames = ss.dir === "e2g" ? ["Build each word", "Skeleton", "Greek sentence"] : ["Parse each word", "Skeleton", "English"];
    const phaseIdx = ss.phase === "parse" || ss.phase === "parsed" ? 0 : ss.phase === "skeleton" ? 1 : 2;
    const head = h("div", { class: "s-head t-head" },
      h("button", { class: "btn t-close", title: "Close", onclick: () => { if (confirm("Stop translating? This sentence won't be saved.")) T.close(); } }, "✕", h("span", { class: "t-hide-sm" }, " Close")),
      h("div", { class: "t-title" }, h("b", null, ss.dir === "e2g" ? "English → Greek" : "Translate"),
        h("div", { class: "muted small" }, [s.ref, ss.title !== s.ref ? ss.title : "", `${ss.i + 1} of ${ss.ids.length}`].filter(Boolean).join(" · "))),
      h("div", { class: "bar t-hide-sm", style: "min-width:80px;max-width:260px" }, h("i", { style: `width:${(100 * ss.i) / ss.ids.length}%` })),
      h("div", { class: "t-help" },
        h("button", { class: "btn", onclick: () => { ss.hint = null; ss.settingsOpen = false; openCharts(); } }, "Charts"),
        h("button", { class: "btn" + (ss.hint ? " pri" : ""), onclick: () => { ss.settingsOpen = false; openHint(); } }, "💡 Hint"),
        h("button", { class: "btn t-gear" + (ss.settingsOpen ? " pri" : ""), title: "View settings", onclick: () => { ss.settingsOpen = !ss.settingsOpen; ss.hint = null; render(); } }, icon("gear")),
        hintPop(), settingsPop()));
    let main;
    if (ss.phase === "parse" || ss.phase === "parsed") main = parseScreen();
    else if (ss.phase === "skeleton") main = skeletonScreen();
    else main = finalScreen();
    const el = h("div", { class: "session" }, head,
      h("div", { class: "s-body" }, h("div", { class: "s-inner t-inner" + ap("tsent", ss.ids[ss.i] + "|" + ss.phase) },
        h("div", { class: "t-steps" }, stepNames.map((n, i) => h("span", { class: "t-st" + (i === phaseIdx ? " on" : i < phaseIdx ? " done" : "") }, i < phaseIdx ? "✓ " + n : `${i + 1} · ${n}`))),
        main)));
    requestAnimationFrame(() => { fitLines(); drawArrows(); });
    return el;
  };

  // Lines split by length only, so they give nothing away about the grammar.
  // Lines are packed to the real width of the screen: if every word fits on
  // one row it stays one row, and it only breaks where it would have to wrap.
  // Word widths are measured after each draw (fitLines) and reused here.
  T.fit = { width: 0, gap: 26, w: {} };
  function makeLines(units) {
    const F = T.fit;
    if (!F.width) return [units.map((u, n) => n)];
    const W = units.map((u, n) => F.w[n] || [...u.greek].length * 13 + 18);
    const pack = (avail) => {
      const lines = [];
      let cur = [], len = 0;
      W.forEach((w, n) => {
        if (cur.length && len + F.gap + w > avail) { lines.push(cur); cur = []; len = 0; }
        len += (cur.length ? F.gap : 0) + w; cur.push(n);
      });
      if (cur.length) lines.push(cur);
      return lines;
    };
    const total = W.reduce((x, w) => x + w, 0) + F.gap * (W.length - 1);
    if (total <= F.width) return [W.map((w, n) => n)];
    const avail = F.width - 36; // room for the ▾ button
    // Fill each line to the edge of the window before starting the next.
    return pack(avail);
  }
  let refits = 0, refitTimer = null;
  function fitLines() {
    const ss = T.session, box = document.querySelector(".t-sent .t-lines");
    if (!ss || !box) return;
    const F = T.fit;
    const words = box.querySelector(".t-words");
    if (words) F.gap = parseFloat(getComputedStyle(words).columnGap) || F.gap;
    F.width = box.clientWidth;
    box.querySelectorAll(".t-w[data-u]").forEach((el) => {
      const n = +el.dataset.u, gap = el.nextElementSibling && el.nextElementSibling.classList.contains("t-gap") ? el.nextElementSibling.offsetWidth + F.gap : 0;
      F.w[n] = Math.ceil(el.offsetWidth + gap);
    });
    const want = JSON.stringify(makeLines(ss.units));
    if (want !== T.drawnLines && refits < 3) {
      refits++; clearTimeout(refitTimer); refitTimer = setTimeout(() => { refits = 0; }, 800);
      // Line numbers move when the packing changes, so forget per-line open/closed choices.
      if (JSON.parse(want).length !== JSON.parse(T.drawnLines || "[]").length) ss.lines = {};
      render();
    }
  }
  let resizeT = null;
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (T.session) fitLines(); }, 150); });
  const wavy = (c) => { const el = document.createElementNS("http://www.w3.org/2000/svg", "svg"); el.setAttribute("viewBox", "0 0 130 10"); el.setAttribute("class", "t-wave"); el.innerHTML = `<path d="M2 5 Q 10 0 18 5 T 34 5 T 50 5 T 66 5 T 82 5 T 98 5 T 114 5 T 128 5" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`; return el; };
  const postOf = (u) => { const s = T.session.s; const last = u.ids[u.ids.length - 1]; return s.tokens[last].post || ""; };
  const gapAfter = (u) => { const s = T.session.s; const t = s.tokens[u.ids[u.ids.length - 1] + 1]; return t && t.gap; };

  // The notes under one unit.
  function stack(u, n, full) {
    const ss = T.session, a = ss.ans[n], c = ss.colors[n], e2g = ss.dir === "e2g";
    if (u.given) return h("div", { class: "t-given-tx" }, e2g ? u.greek : "“" + u.given + "”");
    if (!full) {
      const fold = e2g ? (a.ok.form ? u.greek : null) : a.ok.ctx ? a.f.ctx : null;
      return fold ? h("div", { class: "t-fold" + (e2g ? " gk" : ""), style: "color:" + c }, fold) : null;
    }
    // While you work on a word, what you've entered shows right away; Check marks it right or wrong.
    const cur = n === ss.cur && ss.phase === "parse";
    const st = (k) => (a.ok[k] === false ? " wrong" : a.ok[k] ? "" : " pend");
    const has = (k) => (a.ok[k] || cur) && (a.f[k] || "").trim();
    const parts = [];
    const f0 = unitForms(u)[0];
    if (a.ok.lex) parts.push(h("div", { class: "t-lex" }, "(" + (f0 ? f0.lemma : a.f.lex) + ")"));
    else if (has("lex")) parts.push(h("div", { class: "t-lex" + st("lex") }, "(" + a.f.lex + ")"));
    if (!e2g && has("mean")) parts.push(h("div", { class: "t-gl" + st("mean") }, "“" + a.f.mean + "”"));
    if (e2g && a.ok.lex) { const g = f0 ? (E.gloss(f0.lemma) || "").split(/[,;]/)[0] : ""; if (g) parts.push(h("div", { class: "t-gl" }, "“" + g + "”")); }
    const fields = a.f.kind ? fieldsNow(u, a) : [];
    const chosen = fields.filter((fl) => a.f[fl]);
    if (fields.length && (chosen.length && (cur || a.ok.parse))) {
      const bits = [];
      fields.forEach((fl, i) => {
        const v = a.f[fl];
        const lab = v ? (fl === "takes" ? "+ " : "") + E.optLabel(fl, v, labelsFull()) : "___";
        const joinPN = fl === "number" && fields[i - 1] === "person";
        if (i) bits.push(joinPN ? " " : ", ");
        bits.push(h("span", { class: a.ok["p:" + fl] === false ? "wrong" : a.ok["p:" + fl] ? "" : "pend" }, lab));
      });
      parts.push(h("div", { class: "t-hr", style: "background:" + c }), h("div", { class: "t-ps" }, bits));
    } else if (!fields.length && a.f.kind && (cur || a.ok.kind)) parts.push(h("div", { class: "t-hr", style: "background:" + c }), h("div", { class: "t-ps" + st("kind") }, a.f.kind));
    if (!e2g && has("ctx")) parts.push(wavy(c), h("div", { class: "t-ctx" + st("ctx") }, a.f.ctx));
    if (e2g && a.ok.form) parts.push(wavy(c), h("div", { class: "t-ctx gk" }, u.greek));
    else if (e2g && cur && (a.f.form || "").trim()) parts.push(wavy(c), h("div", { class: "t-ctx gk" + st("form") }, a.f.form));
    return parts.length ? h("div", { class: "t-ann", style: "color:" + c }, parts) : null;
  }
  // Update the notes under the current word without redrawing the page (keeps the keyboard open).
  function refreshLive() {
    const ss = T.session, el = document.querySelector(".t-w.cur .t-live");
    if (!el || ss.cur < 0) return;
    const st = stack(ss.units[ss.cur], ss.cur, true);
    el.replaceChildren(...(st ? [st] : []));
  }

  function sentenceCard(opts = {}) {
    const ss = T.session, e2g = ss.dir === "e2g";
    const lines = makeLines(ss.units);
    T.drawnLines = JSON.stringify(lines);
    const lineDone = (ln) => ln.every((n) => ss.ans[n].done);
    const curLine = lines.findIndex((ln) => ln.includes(ss.cur));
    const isClosed = (li) => {
      if (opts.allClosed) return true;
      const st = ss.lines[li];
      if (st === "open") return false;
      if (st === "closed") return true;
      return lineDone(lines[li]) && li !== curLine && ss.phase === "parse";
    };
    const unitWord = (u) => (e2g ? cueFor(u, u.n) : u.greek);
    const rows = lines.map((ln, li) => {
      if (isClosed(li)) {
        return h("div", { class: "t-cl" },
          h("button", { class: "t-chev", title: "Open this line", onclick: () => { ss.lines[li] = "open"; render(); } }, "▸"),
          h("div", { class: "t-cl-words" }, ln.map((n) => {
            const u = ss.units[n], a = ss.ans[n], c = ss.colors[n];
            const under = u.given ? (e2g ? u.greek : "“" + u.given + "”") : e2g ? (a.ok.form ? u.greek : "") : a.ok.ctx ? a.f.ctx : "";
            return h("div", { class: "t-cl-w" + (u.given ? " given" : "") },
              h("span", { class: e2g ? "t-cl-en" : "t-cl-gk" }, unitWord(u) + (e2g ? "" : postOf(u))),
              h("span", { class: "t-cl-bar", style: "background:" + (u.given ? "var(--muted)" : a.done ? c : "var(--line)") }),
              h("span", { class: "t-cl-tx" + (e2g && !u.given ? " gk" : ""), style: u.given ? "" : "color:" + c }, under || " "));
          })),
          lineDone(ln) ? h("span", { class: "t-ok" }, "✓") : null);
      }
      return h("div", { class: "t-line" },
        lines.length > 1 || ss.lines[li] ? h("button", { class: "t-chev", title: "Minimize this line", onclick: () => { ss.lines[li] = "closed"; render(); } }, "▾") : null,
        h("div", { class: "t-words" }, ln.map((n) => {
          const u = ss.units[n], a = ss.ans[n], c = ss.colors[n];
          const cur = n === ss.cur && ss.phase === "parse";
          const full = cur || S().tNotesFull || ss.lines[li] === "open";
          const word = h("div", { class: "t-w" + (u.given ? " given" : a.done ? " done" : cur ? " cur" : " pend") + (a.hl ? " hl" : ""), "data-u": n },
            h("div", { class: "t-wd" },
              h("div", { class: e2g ? "t-en" : "t-gk", onclick: !u.given && !cur && ss.phase === "parse" ? () => { ss.cur = n; ss.hint = null; render(); } : null }, unitWord(u) + (e2g ? "" : postOf(u))),
              h("div", { class: "t-br", style: u.given ? "" : a.done || cur ? "border-color:" + c : "" })),
            cur ? h("div", { class: "t-live" }, stack(u, n, true)) : stack(u, n, full),
            a.skip && !a.done ? h("div", { class: "t-tagw" }, "↷ Skipped") : null,
            a.hl ? h("div", { class: "t-tagw hl" }, "★ Highlighted") : null);
          return gapAfter(u) ? [word, h("div", { class: "t-gap" }, "…")] : word;
        })));
    });
    const sofar = ss.units.map((u, n) => (u.given ? (e2g ? u.greek : u.given) : ss.ans[n].done ? (e2g ? u.greek : ss.ans[n].f.ctx) : null)).filter(Boolean);
    const all = ss.ans.every((a) => a.done);
    return h("div", { class: "card t-sent" },
      e2g ? h("div", { class: "t-prompt" }, h("span", { class: "muted small" }, "Translate into Greek: "), h("b", null, englishPrompt()),
        !ss.s.english && !(ss.notes && ss.notes.english) ? h("div", { class: "muted small" }, "Tip: translate this sentence Greek → English first, and your own English becomes the prompt here.") : null) : null,
      h("div", { class: "t-lines" }, rows, (() => { const a = document.createElementNS("http://www.w3.org/2000/svg", "svg"); a.setAttribute("class", "t-arrows"); return a; })()),
      h("div", { class: "muted", style: "margin-top:6px" }, ss.s.ref ? "(" + ss.s.ref + ")" : ""),
      sofar.length ? h("div", { class: "t-sofar" + (all ? " all" : "") }, h("span", { class: "t-sofar-l" }, all ? "Word by word" : "So far"), h("span", { class: e2g ? "greek" : "" }, sofar.join(e2g ? " " : " · ") + (all ? "" : " …"))) : null);
  }
  function englishPrompt() {
    const ss = T.session, s = ss.s;
    return s.english || (ss.notes && ss.notes.english) || ss.units.map((u, n) => cueFor(u, n)).join(" ");
  }

  // Arrows from a preposition to the words it governs (only after you've parsed it).
  function drawArrows() {
    const ss = T.session;
    if (!ss || !ss.units) return;
    const box = document.querySelector(".t-lines"), svgEl = document.querySelector(".t-arrows");
    if (!box || !svgEl) return;
    const B = box.getBoundingClientRect();
    let out = "";
    ss.units.forEach((u, n) => {
      const a = ss.ans[n];
      if (!a.done || a.f.kind !== "Preposition" || !a.f.takes) return;
      const from = box.querySelector(`.t-w[data-u="${n}"] .t-gk, .t-w[data-u="${n}"] .t-en`), to = box.querySelector(`.t-w[data-u="${n + 1}"] .t-gk, .t-w[data-u="${n + 1}"] .t-en`);
      if (!from || !to) return;
      const f = from.getBoundingClientRect(), t = to.getBoundingClientRect();
      if (Math.abs(f.top - t.top) > 8) return;
      const c = ss.colors[n];
      const x1 = f.left + f.width / 2 - B.left, y1 = f.top - B.top + 2, x2 = t.left + Math.min(28, t.width / 3) - B.left, y2 = t.top - B.top + 2;
      const lab = E.optLabel("takes", a.f.takes, labelsFull());
      out += `<path d="M${x1} ${y1} C ${x1} ${y1 - 24}, ${x2 - 16} ${y2 - 26}, ${x2} ${y2}" fill="none" stroke="${c}" stroke-width="2.2"/>` +
        `<path d="M${x2 - 5} ${y2 - 8} L${x2} ${y2} L${x2 + 5} ${y2 - 9}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>` +
        `<text x="${(x1 + x2) / 2}" y="${Math.min(y1, y2) - 22}" fill="${c}" font-size="13" font-weight="700" text-anchor="middle" font-family="Montserrat, sans-serif">${lab}</text>`;
    });
    svgEl.setAttribute("width", B.width); svgEl.setAttribute("height", B.height);
    svgEl.innerHTML = out;
  }

  // ---------- Step 1: parse / build each word ----------
  function parseScreen() {
    const ss = T.session;
    const side = colorChart();
    if (ss.phase === "parsed") {
      return [sentenceCard(), h("div", { class: "t-grid" },
        h("div", { class: "card pad row", style: "gap:14px" }, h("span", { class: "t-ok big" }, "✓"),
          h("div", { style: "flex:1" }, h("b", { style: "font-size:17px" }, "Every word is " + (ss.dir === "e2g" ? "built." : "parsed.")), h("div", { class: "muted" }, "Next, put the pieces into the skeleton.")),
          h("button", { class: "btn pri big", "data-autofocus": "", onclick: startSkeleton }, "Build the skeleton →")), side)];
    }
    return [sentenceCard(), h("div", { class: "t-grid" }, workspace(), side)];
  }

  function colorChart() {
    const ss = T.session, e2g = ss.dir === "e2g";
    return h("div", { class: "t-side" },
      h("div", { class: "label", style: "margin-top:0" }, "Colors"),
      ss.units.map((u, n) => {
        if (u.given) return null;
        const a = ss.ans[n], c = ss.colors[n];
        return h("div", { class: "t-key" }, h("span", { class: "t-keydot", style: "background:" + c }),
          h("div", null, h("div", { class: e2g ? "t-key-en" : "greek t-key-gk", style: "color:" + c }, e2g ? cueFor(u, n) : u.greek),
            a.done ? h("div", { class: "small" }, a.f.kind + (fieldsNow(u, a).length ? " · " + parseLabel(u, a) : "") + (e2g ? " · " : ""), e2g ? h("span", { class: "greek" }, u.greek) : null) :
              h("div", { class: "small muted" }, "🔒 Parse to Reveal")));
      }),
      h("div", { class: "muted small", style: "margin-top:8px" }, "Colors are random. Labels unlock as you parse."));
  }

  function workspace() {
    const ss = T.session, n = ss.cur, u = ss.units[n], a = ss.ans[n], c = ss.colors[n], e2g = ss.dir === "e2g";
    const forms = unitForms(u), noKey = !forms.length;
    if (!a.open) a.open = {};
    if (!a.closed) a.closed = {};
    const okMark = (k) => (a.ok[k] === true ? h("span", { class: "t-okm" }, "✓") : a.ok[k] === false ? h("span", { class: "t-badm" }, "✕") : h("span", { class: "t-todo" }));
    const row = (k, label, control, extra) => h("div", { class: "t-row" + (a.ok[k] === false ? " bad" : "") }, h("div", { class: "t-k" }, okMark(k), label), h("div", { class: "t-v" }, control, extra || null));
    // A finished question shrinks to one line to make room; tap ✎ to change it.
    const compactRow = (k, label, value, valueClass) => h("div", { class: "t-row t-row-c" + (a.ok[k] === false ? " bad" : "") },
      h("div", { class: "t-k" }, okMark(k), label),
      h("button", { class: "t-cval" + (valueClass ? " " + valueClass : ""), style: "color:" + c, onclick: () => { a.open[k] = true; delete a.closed[k]; render(); } }, value, h("span", { class: "t-edit" }, "✎")));
    const isCompact = (k, filled, needsClose) => filled && !a.open[k] && a.ok[k] !== false && (!needsClose || a.closed[k]);
    const order = e2g ? ["lex", "form"] : noLex(u) ? ["mean", "ctx"] : ["lex", "mean", "ctx"];
    const focusNext = (from) => {
      const later = order.slice(order.indexOf(from) + 1).find((k) => !(a.f[k] || "").trim());
      if (later) { a.open[later] = true; render(); return; }
      checkUnit();
    };
    const enterText = (k) => () => { if ((a.f[k] || "").trim()) { a.closed[k] = true; delete a.open[k]; } focusNext(k); };
    let focusSet = false;
    const af = (k) => { if (focusSet || a.ok[k] || ((a.f[k] || "").trim() && !a.open[k])) return false; focusSet = true; return true; };
    const rows = [];

    // What is it?
    if (isCompact("kind", !!a.f.kind)) rows.push(compactRow("kind", "What is it?", a.f.kind));
    else rows.push(row("kind", "What is it?", h("div", { class: "chips" }, E.KINDS.map((k) => h("button", {
      class: "chip t-chip" + (a.f.kind === k ? " sel" : "") + (a.ok.kind === false && a.f.kind === k ? " wrong" : ""), style: a.f.kind === k ? "color:" + c : "",
      onclick: () => { const changed = a.f.kind !== k; a.f.kind = k; delete a.ok.kind; delete a.open.kind; if (changed) { delete a.ok.parse; } render(); },
    }, k)))));

    // Lexical form
    const lexLabel = e2g ? "Greek word" : "Lexical form";
    if (noLex(u)) { /* no lexical-form box */ }
    else if (isCompact("lex", (a.f.lex || "").trim(), true)) rows.push(compactRow("lex", lexLabel, a.f.lex, "gk"));
    else rows.push(row("lex", lexLabel, greekIn({ value: a.f.lex || "", placeholder: "dictionary form", autofocus: af("lex") || a.open.lex, oninput: (v) => { a.f.lex = v; delete a.ok.lex; refreshLive(); }, onenter: enterText("lex") }),
      h("span", { class: "muted small" }, "the form you'd look up")));

    // Meaning
    if (!e2g) {
      if (isCompact("mean", (a.f.mean || "").trim(), true)) rows.push(compactRow("mean", "Meaning", a.f.mean));
      else rows.push(row("mean", "Meaning", textIn({ value: a.f.mean || "", placeholder: "dictionary meaning", autofocus: af("mean") || a.open.mean, oninput: (v) => { a.f.mean = v; delete a.ok.mean; a.override = false; refreshLive(); }, onenter: enterText("mean") }),
        a.ok.mean === false && (a.f.mean || "").trim() ? h("button", { class: "btn link", onclick: () => { a.override = true; a.ok.mean = true; render(); } }, "✓ I was right, count it") : null));
    }

    // Parsing: each choice shrinks once picked
    const fields = a.f.kind ? fieldsNow(u, a) : [];
    const fieldBox = (fl) => {
      const k = "p:" + fl, v = a.f[fl];
      if (v && !a.open[k] && a.ok[k] !== false)
        return h("button", { class: "t-fpill" + (a.ok[k] ? " ok" : ""), style: "color:" + c, onclick: () => { a.open[k] = true; render(); } },
          h("span", { class: "lbl" }, E.FIELDS[fl].name), E.optLabel(fl, v, labelsFull()), h("span", { class: "t-edit" }, "✎"));
      return h("div", { class: "t-field" + (a.ok[k] === false ? " bad" : "") },
        h("span", { class: "lbl" }, E.FIELDS[fl].name),
        h("div", { class: "chips" }, E.FIELDS[fl].opts.filter((o) => !(fl === "case" && o[0] === "V" && a.f.kind !== "Noun")).map((o) => h("button", {
          class: "chip t-chip" + (v === o[0] ? " sel" : "") + (a.ok[k] === false && v === o[0] ? " wrong" : ""), style: v === o[0] ? "color:" + c : "",
          onclick: () => { a.f[fl] = o[0]; delete a.ok[k]; delete a.ok.parse; delete a.open[k]; render(); },
        }, labelsFull() ? o[1] : o[2]))));
    };
    // Only show the parsing box when this kind of word has something to parse
    // (no box at all for words like οὖν, καί, οὐ).
    if (a.f.kind ? fields.length : !noParse(u))
      rows.push(row("parse", e2g ? "What it needs to be" : "Parse",
        !a.f.kind ? h("span", { class: "muted small" }, "Choose what it is first.") : h("div", { class: "t-fields" }, fields.map(fieldBox))));

    // In this sentence / write the form
    if (!e2g) {
      if (isCompact("ctx", (a.f.ctx || "").trim(), true)) rows.push(compactRow("ctx", "In this sentence", a.f.ctx));
      else rows.push(row("ctx", "In this sentence", textIn({ value: a.f.ctx || "", placeholder: "how it reads here, e.g. “of man”", autofocus: af("ctx") || a.open.ctx, oninput: (v) => { a.f.ctx = v; delete a.ok.ctx; refreshLive(); }, onenter: enterText("ctx") }), a.ctxMsg ? h("div", { class: "note t-ctxmsg" }, a.ctxMsg) : null));
    } else {
      const preview = h("div", { class: "t-formprev" });
      const paint = () => { const v = a.f.form || ""; if (!v.trim()) { preview.replaceChildren(); return; } const r = E.restoreSentence(v); preview.replaceChildren(h("span", { class: "muted small" }, "With marks: "), h("span", { class: "greek", style: "font-size:19px" }, r.words.map((w) => [w.segs.map((sg) => sg.add ? h("span", { class: "t-add" }, sg.t) : sg.t), " "]))); };
      if (isCompact("form", (a.f.form || "").trim(), true)) rows.push(compactRow("form", "Write the form", a.f.form, "gk"));
      else { rows.push(row("form", "Write the form", greekIn({ value: a.f.form || "", placeholder: u.article ? "article + word" : "the Greek word", autofocus: af("form") || a.open.form, oninput: (v) => { a.f.form = v; delete a.ok.form; paint(); refreshLive(); }, onenter: enterText("form") }), preview)); paint(); }
    }
    return h("div", { class: "card pad t-work" + ap("twork", ss.ids[ss.i] + "|" + n) },
      h("div", { class: "row wrap" }, h("span", { class: "muted" }, e2g ? "Now building" : "Now parsing"),
        h("span", { class: e2g ? "t-now-en" : "t-now-gk", style: "color:" + c }, e2g ? cueFor(u, n) : u.greek),
        u.article ? h("span", { class: "muted small" }, "with its article") : null, h("span", { class: "spacer" }),
        noKey ? h("span", { class: "t-tag warn" }, "No answer key for this word · check it yourself") : null),
      rows,
      h("div", { class: "row wrap", style: "margin-top:12px" },
        h("button", { class: "btn" + (a.hl ? " pri" : ""), style: a.hl ? "" : "color:#b08a00", onclick: () => { a.hl = !a.hl; render(); } }, a.hl ? "★ Highlighted" : "★ Highlight"),
        h("button", { class: "btn", onclick: () => { a.skip = true; ss.hint = null; advance(); } }, "↷ Skip"),
        h("span", { class: "spacer" }),
        h("span", { class: "hint keys" }, "Enter moves on"),
        h("button", { class: "btn pri big", onclick: checkUnit }, "Check")));
  }

  // ---------- Step 2: skeleton ----------
  function startSkeleton() {
    const ss = T.session;
    ss.phase = "skeleton"; ss.hint = null;
    if (S().tShowStructure) {
      const rows = E.suggestOutline(ss.s, ss.units);
      ss.outline = { rows: rows.map((r) => ({ units: r.units, level: r.level, role: r.role })), tray: [], sel: [], result: null, shown: false };
      ss.help.structure = true;
    } else ss.outline = { rows: [], tray: ss.units.map((u, n) => n), sel: [], result: null, shown: false };
    render();
  }
  function pieceCell(n, small) {
    const ss = T.session, u = ss.units[n], a = ss.ans[n], c = ss.colors[n], e2g = ss.dir === "e2g";
    const top = e2g ? cueFor(u, n) : u.greek;
    const under = u.given ? (e2g ? u.greek : "“" + u.given + "”") : e2g ? u.greek : a.f.ctx || "";
    return h("div", { class: "t-pc" + (u.given ? " given" : "") + (small ? " sm" : "") },
      h("span", { class: e2g ? "t-pc-en" : "t-pc-gk" }, top),
      h("span", { class: "t-cl-bar", style: "background:" + (u.given ? "var(--muted)" : c) }),
      h("span", { class: "t-pc-tx" + (e2g ? " gk" : ""), style: u.given ? "" : "color:" + c }, under));
  }
  // One plain instruction at a time, based on where the student is.
  function skeletonGuide(O2, canDrag) {
    const noRole = O2.rows.findIndex((r) => !r.role);
    let n, title, text;
    if (!O2.rows.length) {
      n = 1; title = "Find the main verb.";
      text = canDrag ? "It's the word you parsed as a verb that tells what happens. Drag it down into “Your skeleton” (or click it, then press Make a line). It goes at the top." : "It's the word you parsed as a verb that tells what happens. Tap it, then press Make a line. It goes at the top.";
    } else if (O2.tray.length) {
      n = 2; title = "Add the next piece.";
      text = "Pick a word or phrase that goes with a line you already have: the subject (nominative), the object (accusative), or a preposition with its noun. Select all its words, articles too, and make a line. Then press → to tuck it under the word it goes with" + (canDrag ? ", or drag the ⋮⋮ handle to the right." : ".");
    } else if (noRole >= 0) {
      n = 3; title = "Name each line.";
      text = "Every word is placed. Use each line's dropdown to say what it is: Verb, Subject, Direct object, Prepositional phrase, and so on.";
    } else {
      n = 4; title = "Check it.";
      text = "Your skeleton looks complete. Press Check skeleton. It's fine if it isn't exactly like Ostraka's; it only has to make sense.";
    }
    return h("div", { class: "t-guide" },
      h("div", { class: "t-gsteps" }, [1, 2, 3, 4].map((k) => h("span", { class: "t-stepdot" + (k < n ? " done" : k === n ? " on" : "") }, k < n ? "✓" : String(k)))),
      h("div", null, h("b", null, "Step " + n + ": " + title + " "), h("span", null, text)));
  }
  function skeletonExample() {
    const line = (lvl, gk, en, role) => h("div", { class: "t-exrow", style: `margin-left:${lvl * 28}px` },
      lvl ? h("span", { class: "t-elbow" }, "└") : null, h("span", { class: "gk" }, gk), h("span", { class: "muted" }, en), h("span", { class: "t-tag" }, role));
    return h("div", { class: "t-ex" },
      h("div", { class: "small" }, "The skeleton shows what hangs on what. The verb goes on top; everything that tells you more about it sits under it, pushed to the right. Example:"),
      h("div", { class: "gk", style: "font-size:18px;margin:6px 0" }, "ὁ λόγος ἦν πρὸς τὸν θεόν"),
      line(0, "ἦν", "was", "Verb"),
      line(1, "ὁ λόγος", "the Word", "Subject"),
      line(1, "πρὸς τὸν θεόν", "with God", "Prepositional phrase"),
      h("div", { class: "small muted", style: "margin-top:6px" }, "Read it back: “The Word was with God.” A word that describes a noun (an adjective or a genitive) goes one step further right, under that noun."));
  }
  function skeletonScreen() {
    const ss = T.session, O2 = ss.outline;
    const sel = O2.sel;
    const res = O2.result;
    const group = () => {
      if (!sel.length) return;
      const units = sel.slice().sort((a, b) => a - b);
      O2.rows.push({ units, level: O2.rows.length ? 1 : 0, role: "" });
      O2.tray = O2.tray.filter((n) => !units.includes(n)); O2.sel = []; O2.result = null; O2.passed = false; render();
    };
    // ---- Drag and drop (mouse / trackpad) ----
    // Words: drag from "Your words" into a line, onto empty outline space for a
    // new line, or back to "Your words". Lines: drag the ⋮⋮ handle up or down to
    // reorder, and left or right to set the indent.
    const canDrag = matchMedia("(pointer: fine)").matches;
    const clearDz = () => document.querySelectorAll(".dz-on,.dz-top,.dz-bot").forEach((el) => el.classList.remove("dz-on", "dz-top", "dz-bot"));
    const takeWord = (n) => {
      O2.tray = O2.tray.filter((x) => x !== n);
      O2.rows.forEach((r) => { r.units = r.units.filter((x) => x !== n); });
      O2.rows = O2.rows.filter((r) => r.units.length);
      O2.sel = O2.sel.filter((x) => x !== n);
    };
    const startDrag = (e, d) => { d.x = e.clientX; T.drag = d; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "ostraka"); } catch (er) {} e.stopPropagation(); };
    const endDrag = () => { T.drag = null; clearDz(); };
    const dropOn = (kind, idx) => ({
      ondragover: (e) => {
        if (!T.drag) return;
        e.preventDefault(); e.stopPropagation();
        clearDz();
        const el = e.currentTarget;
        if (kind === "row" && T.drag.type === "row") { const r = el.getBoundingClientRect(); el.classList.add(e.clientY < r.top + r.height / 2 ? "dz-top" : "dz-bot"); }
        else el.classList.add("dz-on");
      },
      ondragleave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove("dz-on", "dz-top", "dz-bot"); },
      ondrop: (e) => {
        const d = T.drag; if (!d) return;
        e.preventDefault(); e.stopPropagation();
        const el = e.currentTarget;
        if (d.type === "word") {
          const target = kind === "row" ? O2.rows[idx] : null;
          takeWord(d.n);
          if (kind === "tray") O2.tray = O2.tray.concat(d.n).sort((a, b) => a - b);
          else if (target && O2.rows.includes(target)) target.units = target.units.concat(d.n).sort((a, b) => a - b);
          else O2.rows.push({ units: [d.n], level: O2.rows.length ? 1 : 0, role: "" });
        } else if (d.type === "row") {
          const row = O2.rows[d.i];
          if (kind === "tray") { O2.tray = O2.tray.concat(row.units).sort((a, b) => a - b); O2.rows.splice(d.i, 1); }
          else {
            let to = O2.rows.length;
            if (kind === "row") { const r = el.getBoundingClientRect(); to = e.clientY < r.top + r.height / 2 ? idx : idx + 1; }
            O2.rows.splice(d.i, 1);
            if (to > d.i) to--;
            O2.rows.splice(to, 0, row);
            row.level = to === 0 ? 0 : Math.max(0, Math.min(4, row.level + Math.round((e.clientX - d.x) / 36)));
          }
        }
        O2.result = null; O2.passed = false; endDrag(); render();
      },
    });
    const wordDrag = (n) => canDrag && !O2.passed ? { draggable: "true", ondragstart: (e) => startDrag(e, { type: "word", n }), ondragend: endDrag } : {};
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= O2.rows.length) return; [O2.rows[i], O2.rows[j]] = [O2.rows[j], O2.rows[i]]; O2.result = null; O2.passed = false; render(); };
    const outlineRows = O2.rows.map((r, i) => {
      const rr = res && res.results[i];
      return h("div", Object.assign({ class: "t-orow" + (rr ? (rr.ok ? " ok" : " bad") : ""), style: `margin-left:${r.level * 36}px` }, canDrag ? dropOn("row", i) : {}),
        canDrag && !O2.passed ? h("span", { class: "t-handle", title: "Drag to move or indent this line", draggable: "true",
          ondragstart: (e) => { startDrag(e, { type: "row", i }); const row = e.currentTarget.parentElement; try { e.dataTransfer.setDragImage(row, 12, 16); } catch (er) {} setTimeout(() => row.classList.add("dragging"), 0); },
          ondragend: endDrag }, "⋮⋮") : null,
        r.level ? h("span", { class: "t-elbow" }, "└") : null,
        h("div", { class: "t-ph" }, r.units.map((n) => h("span", Object.assign({ class: "t-dw" }, wordDrag(n)), pieceCell(n, true)))),
        O2.passed ? (r.role ? h("span", { class: "t-tag ok" }, r.role) : null) : h("select", { class: "t-role", onchange: (e) => { r.role = e.target.value; O2.result = null; O2.passed = false; render(); } },
          h("option", { value: "" }, "Choose a role ▾"), E.ROLES.map((x) => h("option", { value: x, selected: r.role === x || null }, x))),
        O2.passed ? null : h("div", { class: "t-ctrl" },
          h("button", { class: "icon-btn", title: "Move up", onclick: () => move(i, -1) }, "↑"),
          h("button", { class: "icon-btn", title: "Move down", onclick: () => move(i, 1) }, "↓"),
          h("button", { class: "icon-btn", title: "Outdent", onclick: () => { r.level = Math.max(0, r.level - 1); O2.result = null; O2.passed = false; render(); } }, "←"),
          h("button", { class: "icon-btn", title: "Indent under the line above", onclick: () => { r.level = Math.min(4, r.level + 1); O2.result = null; O2.passed = false; render(); } }, "→"),
          h("button", { class: "icon-btn", title: "Take apart", onclick: () => { O2.tray = O2.tray.concat(r.units).sort((a, b) => a - b); O2.rows.splice(i, 1); O2.result = null; O2.passed = false; render(); } }, icon("x"))),
        rr && !rr.ok ? h("div", { class: "t-omsg" }, rr.message) : null);
    });
    const check = () => {
      if (O2.tray.length) { O2.result = { ok: false, results: O2.rows.map(() => ({ ok: true })), msg: "Put every word into the skeleton first." }; render(); return; }
      const r = E.checkOutline(ss.s, ss.units, O2.rows);
      O2.result = r;
      if (r.ok) O2.passed = true;
      render();
    };
    const suggestion = O2.passed || O2.shown ? E.suggestOutline(ss.s, ss.units) : null;
    return [
      sentenceCard({ allClosed: true }),
      h("div", { class: "card pad stack" },
        h("div", { class: "row wrap" }, h("b", { style: "font-size:17px" }, "Build the skeleton"), h("span", { class: "spacer" }),
          h("button", { class: "btn sm", onclick: () => { O2.ex = !O2.ex; render(); } }, O2.ex ? "Hide example" : "How does this work?")),
        O2.ex ? skeletonExample() : null,
        O2.passed ? null : skeletonGuide(O2, canDrag),
        O2.passed ? null : [
          h("div", { class: "label", style: "margin:4px 0 0" }, "Your words"),
          h("div", Object.assign({ class: "t-tray" }, canDrag ? dropOn("tray") : {}), O2.tray.length ? O2.tray.map((n) => h("div", Object.assign({ class: "t-trayb" + (sel.includes(n) ? " sel" : ""), role: "button", tabindex: "0" }, wordDrag(n), { onkeydown: (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.currentTarget.click(); } }, onclick: () => { O2.sel = sel.includes(n) ? sel.filter((x) => x !== n) : sel.concat(n); render(); } }), pieceCell(n))) :
            h("span", { class: "muted small" }, "Every word is in your skeleton."),
            sel.length ? h("button", { class: "btn pri", onclick: group }, `⊕ Make a line from ${sel.length} word${sel.length === 1 ? "" : "s"}`) : null)],
        h("div", { class: "label", style: "margin:6px 0 0" }, "Your skeleton"),
        O2.rows.length ? h("div", Object.assign({ class: "t-outline" }, canDrag && !O2.passed ? dropOn("outline") : {}), outlineRows, canDrag && !O2.passed && O2.tray.length ? h("div", { class: "t-drop sm" }, "Drop a word here to start a new line") : null) : h("div", Object.assign({ class: "t-drop" }, canDrag ? dropOn("outline") : {}), canDrag ? "Drag the main verb here, or click it and press Make a line." : "Tap the main verb, then press Make a line."),
        res && res.msg ? h("div", { class: "note", style: "color:var(--bad)" }, res.msg) : null,
        O2.passed ? h("div", { class: "t-found" }, h("span", { class: "t-ok" }, "✓"), h("div", null, h("b", null, "Your outline works."), " Here's Ostraka's suggested outline to compare."), h("button", { class: "btn sm", style: "margin-left:auto", onclick: () => { O2.passed = false; O2.result = null; render(); } }, "✎ Edit skeleton")) : null,
        suggestion ? h("div", { class: "t-outline sugg" }, suggestion.map((r) => h("div", { class: "t-orow", style: `margin-left:${r.level * 36}px` },
          r.level ? h("span", { class: "t-elbow" }, "└") : null, h("div", { class: "t-ph" }, r.units.map((n) => pieceCell(n, true))),
          h("span", { class: "t-tag" + (r.role === "Verb" ? " ok" : "") }, r.role + (r.why ? " · " + r.why : ""))))) : null,
        h("div", { class: "row wrap" },
          h("span", { class: "spacer" }),
          !O2.passed && res && !res.ok && !O2.shown ? h("button", { class: "btn", onclick: () => { O2.shown = true; ss.help.structure = true; render(); } }, "Show Ostraka's outline") : null,
          O2.passed || O2.shown ? h("button", { class: "btn pri big", onclick: () => { ss.phase = "final"; ss.hint = null; render(); } }, ss.dir === "e2g" ? "Write the Greek →" : "Write the English →") :
            h("button", { class: "btn pri big", onclick: check }, "Check skeleton ↩"))),
    ];
  }

  // ---------- Step 3: the whole sentence ----------
  function finalScreen() {
    const ss = T.session, e2g = ss.dir === "e2g";
    const outline = ss.outline.rows.map((r) => h("div", { class: "t-orow", style: `margin-left:${r.level * 36}px` },
      r.level ? h("span", { class: "t-elbow" }, "└") : null, h("div", { class: "t-ph" }, r.units.map((n) => pieceCell(n, true))), r.role ? h("span", { class: "t-tag" }, r.role) : null));
    let checkArea;
    if (!e2g) {
      const ref = ss.s.english;
      const res = ss.englishResult;
      checkArea = [
        h("textarea", { class: "t-eng", placeholder: "Write the whole sentence in English", "data-autofocus": "", value: ss.english, oninput: (e) => { ss.english = e.target.value; ss.englishResult = null; },
          onkeydown: (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); checkEnglish(); } } }),
        res ? h("div", { class: "feedback " + (res.ok ? "ok" : "bad") },
          h("div", { class: "v" }, res.ok ? "✓ Looks right" : ref ? "✕ Compare with this" : "Check it yourself"),
          ref ? h("div", { style: "font-size:17px;margin-top:4px" }, ref) : h("div", { class: "muted small" }, "There's no answer to compare with, so check it against your word-by-word line."),
          !res.ok ? h("div", { class: "row", style: "justify-content:center;margin-top:8px" },
            h("button", { class: "btn ok", onclick: () => finishSentence() }, ref ? "✓ I was right, count it" : "✓ It's right"),
            h("button", { class: "btn", onclick: () => { ss.englishResult = null; render(); } }, "Try again")) : null) : null,
        res ? null : h("div", { class: "row" }, h("span", { class: "spacer" }), h("button", { class: "btn pri big", onclick: checkEnglish }, "Check translation ↩")),
      ];
    } else {
      const prev = h("div", { class: "t-formprev" });
      const paint = () => { const v = ss.greekText || ""; if (!v.trim()) { prev.replaceChildren(); return; } const r = E.restoreSentence(v); prev.replaceChildren(h("span", { class: "muted small" }, "With marks: "), h("span", { class: "greek", style: "font-size:21px" }, r.words.map((w) => [w.segs.map((sg) => sg.add ? h("span", { class: "t-add" }, sg.t) : sg.t), w.post, " "]))); };
      const inp = greekIn({ value: ss.greekText, placeholder: "Type the whole sentence in Greek", autofocus: true, oninput: (v) => { ss.greekText = v; ss.greekResult = null; paint(); }, onenter: () => checkGreek() });
      paint();
      const res = ss.greekResult;
      checkArea = [inp, prev,
        res ? h("div", { class: "feedback " + (res.same ? "ok" : "bad") },
          h("div", { class: "v" }, res.same ? "✓ Every form is right" : "✕ Not quite"),
          res.same && !res.order ? h("div", { class: "muted small" }, "Your word order is different from the original. Greek allows that; compare: ", h("span", { class: "greek" }, sentenceGreek(ss.s))) : null,
          !res.same && res.missing.length ? h("div", { class: "small" }, "Check these words: ", h("span", { class: "greek" }, res.missing.length + " form" + (res.missing.length === 1 ? " is" : "s are") + " missing or spelled differently")) : null,
          !res.same ? h("div", { class: "row", style: "justify-content:center;margin-top:8px" }, h("button", { class: "btn", onclick: () => { ss.greekResult = null; render(); } }, "Try again"), h("button", { class: "btn link", onclick: () => finishSentence() }, "✓ I was right, count it")) : null) : null,
        h("div", { class: "row" }, h("span", { class: "spacer" }), h("button", { class: "btn pri big", onclick: checkGreek }, "Check ↩"))];
    }
    return [
      sentenceCard({ allClosed: true }),
      h("div", { class: "card pad stack" },
        h("div", { class: "row" }, h("span", { class: "t-ok" }, "✓"), h("b", null, "Your outline")), h("div", { class: "t-outline" }, outline)),
      h("div", { class: "card pad stack" }, h("b", { style: "font-size:17px" }, e2g ? "3 · Your Greek" : "3 · Your English"), checkArea),
    ];
  }
  function checkEnglish() {
    const ss = T.session;
    if (!ss.english.trim()) return;
    const ref = ss.s.english;
    const ok = ref ? E.compareEnglish(ss.english, ref) >= 0.6 : false;
    ss.englishResult = { ok };
    if (ok) finishSentence(); else render();
  }
  function checkGreek() {
    const ss = T.session;
    if (!ss.greekText.trim()) return;
    const r = E.compareGreek(ss.greekText, ss.s);
    ss.greekResult = r;
    if (r.same) finishSentence(); else render();
  }

  // ---------- Finishing a sentence ----------
  function finishSentence() {
    const ss = T.session, d = O.data, s = ss.s;
    const key = s.id + "|" + ss.dir;
    const prev = d.tResults[key];
    const r = {
      at: Date.now(), hints: ss.help.hints, charts: ss.help.charts ? 1 : 0, structure: !!ss.help.structure,
      units: ss.units.filter((u) => !u.given).length, firstTry: ss.ans.filter((a, n) => !ss.units[n].given && !a.missed).length,
      secs: Math.round((Date.now() - ss.start) / 1000),
    };
    r.retriedClean = !usedHelp(r) && (usedHelp(prev) || (prev && prev.retriedClean)) ? true : false;
    d.tResults[key] = r;
    if (ss.dir === "g2e") {
      d.tNotes[s.id] = { ctx: ss.units.map((u, n) => (u.given ? u.given : ss.ans[n].f.ctx || "")), english: ss.english.trim() || (d.tNotes[s.id] || {}).english || "" };
    }
    d.tWork[key] = {
      at: r.at, dir: ss.dir,
      units: ss.units.map((u, n) => {
        const a = ss.ans[n], f0 = unitForms(u)[0];
        return { greek: u.greek, post: postOf(u), gap: !!gapAfter(u), given: u.given || null, cue: ss.dir === "e2g" ? cueFor(u, n) : null,
          kind: a.f.kind || "", lex: u.given ? "" : (f0 ? f0.lemma : a.f.lex || ""), mean: a.f.mean || (ss.dir === "e2g" && f0 ? (E.gloss(f0.lemma) || "").split(/[,;]/)[0] : ""),
          parse: u.given ? "" : fieldsNow(u, a).length ? parseLabel(u, a) : "", ctx: a.f.ctx || "", takes: a.f.takes || null };
      }),
      outline: (ss.outline ? ss.outline.rows : []).map((r0) => ({ units: r0.units.slice(), level: r0.level, role: r0.role })),
      text: ss.dir === "e2g" ? (ss.greekText ? E.restoreSentence(ss.greekText).words.map((w) => w.text + w.post).join(" ") : sentenceGreek(s)) : ss.english.trim(),
      prompt: ss.dir === "e2g" ? englishPrompt() : "",
    };
    const today = new Date().toISOString().slice(0, 10);
    if (!d.tDays.includes(today)) d.tDays.push(today);
    O.save();
    ss.result = r;
    openModal(completeSheet, false);
  }
  function streak() {
    const days = new Set(O.data.tDays);
    let n = 0;
    const d = new Date();
    for (;;) { const k = d.toISOString().slice(0, 10); if (!days.has(k)) break; n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function completeSheet() {
    const ss = T.session, r = ss.result, s = ss.s, e2g = ss.dir === "e2g";
    const help = usedHelp(r);
    const tag = help ? [r.hints ? `${r.hints} hint${r.hints === 1 ? "" : "s"}` : "", r.charts ? "chart" : "", r.structure ? "structure" : ""].filter(Boolean).join(" & ") : "";
    const pal = ["#e8b665", "#c9a050", "#f3d9a0", "#a8743a"];
    const shards = Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.2, rr = 100 + ((i * 37) % 70), x = 260 + Math.cos(a) * rr * 1.35, y = 60 + Math.sin(a) * rr * 0.32, sz = 6 + ((i * 7) % 9); return `<polygon class="t-shard" style="--d:${(i % 7) * 40}ms;--x:${(260 - x) * 0.6}px;--y:${(60 - y) * 0.6}px" points="0,${-sz} ${sz * 0.8},${sz * 0.4} ${-sz * 0.6},${sz * 0.7}" fill="${pal[i % 4]}" opacity="${0.55 + (i % 4) * 0.12}" transform="translate(${x} ${y}) rotate(${(i * 53) % 360})"/>`; }).join("");
    const svgShards = h("div", { class: "t-shards", html: `<svg width="520" height="210" viewBox="0 0 520 210">${shards}</svg>` });
    const last = ss.i >= ss.ids.length - 1;
    const mm = Math.floor(r.secs / 60) + ":" + String(r.secs % 60).padStart(2, "0");
    const eng = e2g ? englishPrompt() : (ss.english || s.english);
    return h("div", { class: sheetClass() + " t-done", style: "width:min(560px,100%)" },
      h("div", { class: "body center stack", style: "position:relative;overflow:hidden" },
        help ? h("div", { class: "t-redtag" }, h("span", { class: "t-dot red" }), "Translated with " + tag) : null,
        svgShards,
        h("div", { class: "t-medal" }, "✓"),
        h("div", { style: "font-size:25px;font-weight:700;position:relative" }, "Sentence translated!"),
        h("div", { class: "greek", style: "font-size:23px;position:relative" }, sentenceGreek(s)),
        eng ? h("div", { style: "font-size:17px;position:relative" }, "“" + eng + "”") : null,
        h("div", { class: "t-stats" },
          [[`${r.units} / ${r.units}`, e2g ? "words built" : "words parsed"], [r.firstTry, "right first try"], [mm, "time"], ["🔥 " + streak(), "day streak"]].map(([a, b]) => h("div", null, h("b", null, a), h("span", null, b)))),
        h("div", { class: "row", style: "margin-top:6px" },
          h("button", { class: "btn big", style: "flex:1", onclick: () => { closeModal(); prepare(); render(); } }, help ? "↺ Try again without hints" : "↺ Try again"),
          h("button", { class: "btn big", style: "flex:1", onclick: () => showWork([s.id + "|" + ss.dir], () => openModal(completeSheet, false)) }, "📄 Show work"),
          h("button", { class: "btn pri big", style: "flex:1", "data-autofocus": "", onclick: () => { closeModal(); if (last) { T.session = null; tr.tab = "library"; window.OUI.st.section = "translate"; render(); } else { ss.i++; prepare(); render(); } } }, last ? "Finish" : "Next sentence →"))));
  }

  // ---------- Show work (for handing in homework) ----------
  const workKeys = (ids) => {
    const d = O.data, out = [];
    d.sentences.filter((s) => ids.includes(s.id)).forEach((s) => ["g2e", "e2g"].forEach((dir) => { if (d.tWork[s.id + "|" + dir]) out.push(s.id + "|" + dir); }));
    return out;
  };
  const WORK_COLORS = ["#1f78b4", "#2f8a43", "#c26a12", "#c2357e", "#6a4fc9", "#957800", "#d0532a", "#13857a", "#5c8a0e", "#b8336a", "#3d5fd1", "#a8630f"];
  const waveSvg = (c) => `<svg class="ws-wave" viewBox="0 0 130 10"><path d="M2 5 Q 10 0 18 5 T 34 5 T 50 5 T 66 5 T 82 5 T 98 5 T 114 5 T 128 5" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  function workSheet(keys, title) {
    const d = O.data;
    const name = S().tStudentName || "";
    const sheet = h("div", { class: "ws" },
      h("div", { class: "ws-head" },
        h("div", null, h("div", { class: "ws-title" }, title || "Translation work"),
          h("div", { class: "ws-sub" }, new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }))),
        h("div", { class: "ws-name" }, name ? name : "")),
      keys.map((key, i) => {
        const [sid, dir] = key.split("|");
        const s = byId(sid), w = d.tWork[key];
        if (!s || !w) return null;
        const e2g = dir === "e2g";
        const words = w.units.map((u, n) => {
          const c = WORK_COLORS[n % WORK_COLORS.length];
          const top = e2g ? u.cue || u.mean || "" : u.greek + (u.post || "");
          if (u.given) return [h("div", { class: "ws-w given" }, h("div", { class: "ws-wd" }, h("div", { class: e2g ? "ws-en" : "ws-gk" }, top), h("div", { class: "ws-br" })), h("div", { class: "ws-given" }, e2g ? u.greek : "“" + u.given + "”")), u.gap ? h("div", { class: "ws-gap" }, "…") : null];
          const stack = [];
          if (u.lex) stack.push(h("div", { class: "ws-lex" }, "(" + u.lex + ")"));
          if (u.mean) stack.push(h("div", { class: "ws-gl" }, "“" + u.mean + "”"));
          stack.push(h("div", { class: "ws-hr", style: "background:" + c }), h("div", { class: "ws-ps" }, u.parse ? u.parse : u.kind));
          stack.push(h("div", { html: waveSvg(c) }), h("div", { class: "ws-ctx" + (e2g ? " gk" : "") }, e2g ? u.greek : u.ctx));
          return [h("div", { class: "ws-w" }, h("div", { class: "ws-wd" }, h("div", { class: e2g ? "ws-en" : "ws-gk" }, top), h("div", { class: "ws-br", style: "border-color:" + c })), h("div", { class: "ws-ann", style: "color:" + c }, stack)), u.gap ? h("div", { class: "ws-gap" }, "…") : null];
        });
        const outline = w.outline.length ? h("div", { class: "ws-outline" }, w.outline.map((r) => h("div", { class: "ws-orow", style: `margin-left:${r.level * 28}px` },
          r.level ? h("span", { class: "ws-elbow" }, "└") : null,
          h("span", { class: "ws-ph" }, r.units.map((n) => { const u = w.units[n]; return e2g ? (u.cue || "") + " = " + u.greek : u.greek; }).join(e2g ? " · " : " ")),
          r.role ? h("span", { class: "ws-role" }, r.role) : null))) : null;
        return h("div", { class: "ws-sent" },
          h("div", { class: "ws-num" }, `${i + 1}. `, s.ref || "", s.chapter != null ? h("span", { class: "ws-ch" }, " · Chapter " + s.chapter) : null, e2g ? h("span", { class: "ws-ch" }, " · English → Greek") : null),
          e2g ? h("div", { class: "ws-prompt" }, w.prompt) : h("div", { class: "ws-greek" }, E.sentenceText(s, true)),
          h("div", { class: "ws-words" }, words),
          outline ? h("div", { class: "ws-label" }, "Skeleton") : null, outline,
          h("div", { class: "ws-label" }, e2g ? "Greek" : "Translation"),
          h("div", { class: "ws-final" + (e2g ? " gk" : "") }, w.text || "—"));
      }));
    return sheet;
  }
  function showWork(keys, onClose, title) {
    const close = () => { closeModal(); if (onClose) onClose(); };
    openModal(() => h("div", { class: sheetClass() + " ws-modal" },
      h("div", { class: "body stack" },
        h("div", { class: "row wrap" }, h("div", { style: "font-size:20px;font-weight:700" }, "Your work"), h("span", { class: "spacer" }),
          h("input", { type: "text", placeholder: "Your name (shows on the page)", value: S().tStudentName || "", style: "width:240px", onchange: (e) => { O.set("tStudentName", e.target.value.trim()); render(); } })),
        h("div", { class: "ws-paper" }, workSheet(keys, title))),
      h("div", { class: "foot" },
        h("span", { class: "muted small", style: "margin-right:auto" }, "In the print window, choose “Save as PDF” to download it."),
        h("button", { class: "btn", onclick: close }, "Close"),
        h("button", { class: "btn pri", onclick: () => printWork(keys, title) }, "⬇ Download PDF"))), !onClose);
  }
  function printWork(keys, title) {
    let root = document.getElementById("t-print");
    if (!root) { root = document.createElement("div"); root.id = "t-print"; document.body.append(root); }
    root.replaceChildren(workSheet(keys, title));
    document.body.classList.add("t-printing");
    const done = () => { document.body.classList.remove("t-printing"); root.replaceChildren(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 60);
  }

  // Enter = check on the parse screen when nothing else has focus.
  T.keys = (e, typing) => {
    const ss = T.session;
    if (!ss || typing) return;
    if (e.key === "Enter" && ss.phase === "parse") { e.preventDefault(); checkUnit(); }
  };
})();
