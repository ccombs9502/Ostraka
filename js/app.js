// Ostraka web: screens and interaction.
(function () {
  "use strict";
  const O = window.O;
  O.load();
  if (O.embedded) {
    document.documentElement.classList.add("embed");
    // The app prints (Show work → Download PDF) with its own print panel.
    window.print = () => O.post({ type: "print", title: document.title });
  }
  const S = O.data.settings;

  // ---------- Tiny DOM helper ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const svg = (d) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el.setAttribute("viewBox", "0 0 24 24"); el.setAttribute("fill", "none"); el.setAttribute("stroke", "currentColor");
    el.setAttribute("stroke-width", "2"); el.setAttribute("stroke-linecap", "round"); el.setAttribute("stroke-linejoin", "round");
    el.innerHTML = d;
    return el;
  };
  const ICON = {
    home: '<path d="M3.5 11 12 4l8.5 7v9h-6v-6h-5v6h-6z"/>',
    book: '<path d="M5 3h11a3 3 0 0 1 3 3v15H7a2 2 0 0 1-2-2z"/><path d="M5 17a2 2 0 0 1 2-2h12"/>',
    grid: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
    plus: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    bolt: '<path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z" fill="currentColor"/>',
    pin: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    lambda: '<path fill="currentColor" stroke="none" d="M4.6 3.3C4.6 2.4 5.3 1.9 6.4 1.9C8.6 1.9 9.9 3.2 11 5.6L17.2 18.6C17.6 19.5 18.1 19.8 18.8 19.8C19.3 19.8 19.6 19.6 19.9 19.4L20.3 20.6C19.6 21.3 18.7 21.7 17.6 21.7C16.2 21.7 15.3 21 14.6 19.6L8.6 6.9C8 5.6 7.4 4.9 6.6 4.7C6 4.6 5.6 4.7 5.3 4.9C4.9 4.6 4.6 4 4.6 3.3ZM10.4 10.4L12.1 13.9L7.7 21.3C7.5 21.6 7.2 21.7 6.8 21.7L4.9 21.7C4.4 21.7 4.2 21.3 4.4 20.9Z"/>',
    lang: '<path d="M3 5h9M7.5 3v2M5 5c.9 3.2 3.2 5.8 6.5 7M10 5c-.9 3.2-3.2 5.8-6.5 7"/><path d="m12.5 21 4.5-10 4.5 10M14 17.5h6"/>',
  };
  const icon = (n) => svg(ICON[n]);
  const pinIcon = (on) => { const s = icon("pin"); if (on) s.setAttribute("fill", "currentColor"); return s; };

  // ---------- App state ----------
  const st = {
    section: O.embedded ? "translate" : "home",
    paradigmPractice: false,
    session: null,   // { kind, title, ... }
    modal: null,     // render function for an overlay
    pstack: [],      // paradigm navigation: {view:"ref", id} | {view:"practice", ids}
    keys: null,      // keyboard handler for the current screen
    msg: null,
  };
  const app = document.getElementById("app");

  // Animate only when what's on screen actually changes (a new page, card or
  // sheet), never when the same screen just redraws after a tap.
  const seen = {};
  const ap = (slot, key) => { const changed = seen[slot] !== key; seen[slot] = key; return changed ? " appear" : ""; };

  function render() {
    st.keys = null;
    const ot = window.OT && window.OT.session;
    if (ot) st.keys = window.OT.keys;
    // Keep the scroll position when the same screen redraws after a tap; only
    // a new screen (another page, sentence or step) starts back at the top.
    const screen = ot ? "t|" + ot.ids[ot.i] + "|" + (ot.phase === "parsed" ? "parse" : ot.phase) : st.session ? "s" : "shell|" + st.section;
    const SCROLLERS = [".content", ".s-body", ".sheet .body", ".t-prev", ".sheet .list"];
    const saved = screen === render.screen ? SCROLLERS.map((q) => { const el = app.querySelector(q); return el ? el.scrollTop : 0; }) : null;
    const winY = window.scrollY;
    render.screen = screen;
    app.style.minHeight = app.offsetHeight + "px";
    app.replaceChildren(ot ? window.OT.renderSession() : st.session ? renderSession() : renderShell());
    if (st.modal) app.append(h("div", { class: "overlay", onclick: (e) => { if (e.target.classList.contains("overlay") && st.modalDismissable) closeModal(); } }, st.modal()));
    if (saved) {
      SCROLLERS.forEach((q, i) => { const el = app.querySelector(q); if (el && saved[i]) el.scrollTop = saved[i]; });
      if (winY) window.scrollTo(0, winY);
    }
    app.style.minHeight = "";
    const auto = app.querySelector("[data-autofocus]");
    const touchOnly = window.OT && window.OT.session && matchMedia("(hover: none)").matches;
    if (auto && !touchOnly) setTimeout(() => auto.focus({ preventScroll: !!(window.OT && window.OT.session) }), 0);
  }
  function openModal(fn, dismissable = true) { st.modal = fn; st.modalId = (st.modalId || 0) + 1; st.modalDismissable = dismissable; render(); }
  const sheetClass = () => "sheet" + ap("modal", st.modalId);
  function closeModal() { st.modal = null; render(); }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && st.modal && st.modalDismissable) { closeModal(); return; }
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (st.keys) st.keys(e, typing);
  });

  // ---------- Shell ----------
  const SECTIONS = [["home", "Home", "home"], ["vocab", "Vocabulary", "book"], ["translate", "Translate", "lambda"], ["paradigms", "Paradigms", "grid"], ["settings", "Settings", "gear"]];
  function go(section, practice = false) { st.section = section; st.paradigmPractice = practice; st.pstack = []; if (section === "paradigms") st.pBrowse = false; render(); }

  function renderShell() {
    const navBtn = ([id, title, ic]) =>
      h("button", { class: "nav" + (st.section === id || (id === "vocab" && st.section === "add") || (id === "home" && st.section === "chapters") ? " on" : ""), "aria-current": st.section === id ? "page" : null, onclick: () => go(id) }, icon(ic), title);
    const views = { home: viewHome, chapters: viewChapters, vocab: viewVocab, translate: () => window.OT.view(), paradigms: viewParadigms, add: viewAdd, settings: viewSettings };
    const page = views[st.section]();
    if (!O.data.settings.hasSeenWelcome && !st.modal) setTimeout(() => openModal(welcomeSheet, false), 0);
    // People who already use Ostraka get asked their name once, too.
    else if (!O.embedded && !S.userName && !S.askedName && !st.modal && !st.askedThisVisit) { st.askedThisVisit = true; setTimeout(() => openModal(() => nameSheet(true), false), 0); }
    return h("div", { class: "shell" },
      h("nav", { class: "side" }, h("h6", null, "Ostraka"), SECTIONS.map(navBtn)),
      h("main", { class: "main" },
        h("div", { class: "top" }, page.title, h("span", { class: "spacer" }), page.tools || null),
        h("div", { class: "content" }, h("div", { class: "page" + ap("page", st.section + "|" + JSON.stringify(st.pstack[st.pstack.length - 1] || "")) }, page.body))),
      h("nav", { class: "tabs" }, SECTIONS.map(navBtn)));
  }

  // ---------- Home ----------
  function viewHome() {
    const d = O.data, n = O.currentChapter(), dir = S.tDir || "g2e";
    const hour = new Date().getHours();
    const hello = (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening") + (S.userName ? ", " + S.userName : "");
    const bar = (done, total) => h("div", { class: "hbar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": total, "aria-valuenow": done }, h("i", { style: `width:${total ? Math.round((done / total) * 100) : 0}%` }));
    // Pick up where you left off.
    const resume = continueInfo();
    const hero = resume
      ? h("div", { class: "card hero" },
          h("div", { class: "label", style: "margin:0;color:var(--accent)" }, "Pick up where you left off"),
          h("div", { class: "hero-t" }, resume.title),
          bar(resume.done, resume.total),
          h("div", { class: "row" }, h("span", { class: "muted small" }, resume.note), h("span", { class: "spacer" }),
            h("button", { class: "btn pri big", onclick: resume.go, "data-autofocus": "" }, "Continue →")))
      : !d.cards.length
        ? h("div", { class: "card hero" },
            h("div", { class: "label", style: "margin:0;color:var(--accent)" }, "Start here"),
            h("div", { class: "hero-t" }, "Add your vocabulary"),
            h("div", { class: "muted" }, "Paste your word list (Greek | English | chapter). Each chapter becomes its own group."),
            h("div", { class: "row" }, (d.sentences || []).length ? h("button", { class: "btn link", onclick: () => go("translate") }, "Or practice translating sentences") : null,
              h("span", { class: "spacer" }), h("button", { class: "btn pri big", onclick: () => go("add") }, "Add words →")))
        : h("div", { class: "card hero" },
            h("div", { class: "label", style: "margin:0;color:var(--accent)" }, "Start here"),
            h("div", { class: "hero-t" }, n ? `Learn the Chapter ${n} words` : "Learn your words"),
            h("div", { class: "row" }, h("span", { class: "muted small" }, "Keeps going until you know every word. Missed words come back sooner."), h("span", { class: "spacer" }),
              h("button", { class: "btn pri big", onclick: () => startSession("study", n ? "c:" + n : "all") }, "Start →")));
    // The chapter you're on, at a glance.
    let tiles = null;
    if (n) {
      const v = O.vocabFor(n), pa = O.paradigmsFor(n), t = O.sentencesFor(n, dir);
      const tile = (label, done, total, unit, action, fn) => h("button", { class: "card tile", onclick: fn, disabled: !total || null },
        h("span", { class: "label", style: "margin:0" }, label),
        h("span", { class: "tile-n" }, total ? done : "–", h("small", null, total ? ` of ${total} ${unit}` : ` no ${unit} yet`)),
        bar(done, total), h("span", { class: "tile-go" }, total ? (done >= total ? "Review →" : done ? action + " →" : "Start →") : ""));
      tiles = [
        h("div", { class: "row", style: "margin-top:6px" }, h("b", { style: "font-size:17px" }, "Chapter " + n), h("span", { class: "spacer" }),
          h("button", { class: "btn link", onclick: () => go("chapters") }, "See all chapters →")),
        h("div", { class: "tiles" },
          tile("Vocabulary", v.known, v.total, "words", "Keep learning", () => { st.vocabScope = "c:" + n; st.vocabKind = "study"; go("vocab"); }),
          tile("Paradigms", pa.done, pa.total, pa.total === 1 ? "chart" : "charts", "Keep going", () => practiceParadigms(pa.ids, n)),
          tile("Translate", t.done, t.total, "sentences", "Continue", () => startTranslate(t.ids, n, dir))),
      ];
    }
    return {
      title: "Home",
      body: h("div", { class: "home stack" },
        h("div", { class: "hello" }, hello),
        hero, tiles,
        installTip(),
        O.loadError ? h("div", { style: "color:var(--bad)" }, O.loadError) : null),
    };
  }

  // Home's Continue button: what you last did, and where it stands now.
  function continueInfo() {
    const a = S.lastActivity;
    if (!a) return null;
    if (a.type === "translate") {
      const ids = (a.ids || []).filter((id) => (O.data.sentences || []).some((s) => s.id === id));
      if (!ids.length) return null;
      const dir = a.dir || "g2e", done = ids.filter((id) => O.data.tResults[id + "|" + dir]).length;
      const all = done >= ids.length;
      return { title: `Translate · ${a.title}${all ? " · all done" : ` · sentence ${done + 1} of ${ids.length}`}`, done, total: ids.length,
        note: all ? "Finished. Continue to go through it again." : `${ids.length - done} sentence${ids.length - done === 1 ? "" : "s"} left`, go: () => startTranslate(ids, a.chapter, dir, a.title) };
    }
    if (a.type === "vocab") {
      const cards = O.cardsIn(a.scope);
      if (!cards.length) return null;
      const known = cards.filter((c) => (O.data.progress[c.id]?.intervalDays || 0) >= 3 || (O.data.mastery[c.id]?.strength || 0) >= 0.8).length;
      const verb = { study: "Learn", daily: "Review", cram: "Cram" }[a.kind] || "Study";
      return { title: `${verb} · ${O.scopeTitle(a.scope)}`, done: known, total: cards.length, note: `${known} of ${cards.length} words learned`, go: () => startSession(a.kind, a.scope) };
    }
    if (a.type === "paradigms") {
      const ids = (a.ids || []).filter((id) => O.pById(id));
      if (!ids.length) return null;
      const done = ids.filter((id) => O.data.pDone[id]).length;
      return { title: `Paradigms · ${a.title}`, done, total: ids.length, note: `${done} of ${ids.length} charts filled in correctly`, go: () => practiceParadigms(ids, a.chapter, a.title) };
    }
    return null;
  }
  function startTranslate(ids, chapter, dir, title) {
    const todo = ids.filter((id) => !O.data.tResults[id + "|" + dir]);
    window.OT.start(todo.length ? todo : ids, dir, title || (chapter ? "Chapter " + chapter : "Sentences"));
  }
  function practiceParadigms(ids, chapter, title) {
    if (!ids.length) return;
    O.setLast({ type: "paradigms", ids, chapter: chapter || null, title: title || (chapter ? "Chapter " + chapter : ids.length + " charts") });
    st.section = "paradigms"; st.paradigmPractice = true; st.pstack = [{ view: "practice", ids }]; render();
  }

  // Every chapter, with vocab, paradigms and translation side by side.
  function viewChapters() {
    const dir = S.tDir || "g2e", cur = O.currentChapter();
    const meter = (done, total, text) => h("div", null, h("div", { class: "hbar sm" }, h("i", { style: `width:${total ? Math.round((done / total) * 100) : 0}%`, class: total && done >= total ? "full" : "" })),
      h("div", { class: "muted small" }, total ? text : "—"));
    const rows = O.allChapters().map((n) => {
      const v = O.vocabFor(n), pa = O.paradigmsFor(n), t = O.sentencesFor(n, dir);
      return h("div", { class: "chrow" + (n === cur ? " cur" : "") },
        h("b", null, "Chapter " + n, n === cur ? h("span", { class: "badge" }, "current") : null),
        meter(v.known, v.total, v.known >= v.total ? `All ${v.total} words learned` : `${v.known} of ${v.total} words`),
        meter(pa.done, pa.total, `${pa.done} of ${pa.total} charts`),
        meter(t.done, t.total, `${t.done} of ${t.total} sentences`),
        n === cur ? h("span") : h("button", { class: "btn sm", onclick: () => { O.set("currentChapter", n); go("home"); } }, "Study this"));
    });
    return { title: "All chapters", tools: h("button", { class: "btn", onclick: () => go("home") }, "← Home"),
      body: h("div", { class: "card pad" },
        h("div", { class: "chrow head muted small" }, h("span"), h("span", null, "Vocabulary"), h("span", null, "Paradigms"), h("span", null, "Translate"), h("span")),
        rows.length ? rows : h("div", { class: "muted" }, "No chapters yet. Add words with a chapter number to see them here.")) };
  }

  // First launch: "What is your name?" (used for the greeting on Home).
  function nameSheet(alone) {
    let name = "";
    const finish = () => { O.set("askedName", true); if (alone) closeModal(); else render(); };
    const save = () => { const n = O.trim(name); if (n) O.set("userName", n.slice(0, 40)); else st.skipName = true; finish(); };
    return h("div", { class: sheetClass(), style: "width:min(460px,100%)" },
      h("div", { class: "body stack center" },
        h("img", { src: "icon.png", class: "logo", style: "margin:0 auto;width:64px;height:64px", alt: "" }),
        h("div", { style: "font-size:26px;font-weight:700" }, "What is your name?"),
        h("div", { class: "muted" }, "Ostraka will use it to greet you. You can change it in Settings."),
        h("input", { type: "text", placeholder: "Your first name", autocomplete: "given-name", "aria-label": "Your name", "data-autofocus": "", style: "font-size:18px;text-align:center",
          oninput: (e) => { name = e.target.value; }, onkeydown: (e) => { if (e.key === "Enter") save(); } }),
        h("button", { class: "btn pri big", onclick: save }, "Continue"),
        h("button", { class: "btn link", onclick: () => { st.skipName = true; finish(); } }, "Skip")));
  }

  // On iPhone/iPad in Safari (not yet on the Home Screen), show how to install it.
  function installTip() {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const installed = window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
    if (!ios || installed || S.hideInstallTip || location.protocol === "file:") return null;
    return h("div", { class: "card install-tip" },
      h("img", { src: "icons/apple-touch-icon.png", class: "logo", style: "width:44px;height:44px", alt: "" }),
      h("div", { style: "flex:1" }, h("b", null, "Add Ostraka to your Home Screen"),
        h("span", { class: "muted small" }, "Tap the Share button (the square with an arrow), then \u201cAdd to Home Screen.\u201d It opens full-screen like an app and works offline.")),
      h("button", { class: "icon-btn", title: "Hide", onclick: () => { O.set("hideInstallTip", true); render(); } }, icon("x")));
  }

  function welcomeSheet() {
    if (!S.userName && !st.skipName && !S.askedName) return nameSheet();
    const step = (n, ic, title, text) => h("div", { class: "row", style: "align-items:flex-start" },
      h("div", { class: "choice" }, h("div", { class: "ic", style: "background:var(--accent);width:38px;height:38px" }, icon(ic))),
      h("div", null, h("b", null, `${n}. ${title}`), h("div", { class: "muted small" }, text)));
    const done = () => { O.set("hasSeenWelcome", true); };
    return h("div", { class: sheetClass(), style: "width:min(560px,100%)" },
      h("div", { class: "body stack center" },
        h("img", { src: "icon.png", class: "logo", style: "margin:0 auto;width:72px;height:72px" }),
        h("div", { style: "font-size:27px;font-weight:700" }, "Welcome to Ostraka!"),
        h("div", { class: "muted" }, "A place to learn Koine Greek vocabulary and paradigms. Here's how to start."),
        h("div", { class: "stack", style: "text-align:left" },
          step(1, "plus", "Add your words", "Go to Vocabulary → + Add words and paste or load your list. Each chapter becomes its own group."),
          step(2, "target", "Pick how to study", "Study Session drills a group until you've mastered it. Daily Review takes a few minutes a day. Cram is for right before a quiz."),
          step(3, "grid", "Practice paradigms", "Over 60 charts are built in. Fill them in, drill single forms, or identify forms.")),
        h("button", { class: "btn pri big", onclick: () => { done(); st.modal = null; go("add"); } }, "Add my words"),
        h("button", { class: "btn link", onclick: () => { done(); closeModal(); } }, "Look around first")));
  }

  // ---------- Session setup ----------
  const MODES = [
    ["flashcards", "Flashcards", "Flip and check yourself", "▭"], ["type", "Type", "Type the English meaning", "Aa"],
    ["choice", "Multiple Choice", "Pick from 4 answers", "☰"], ["englishToGreek", "English → Greek", "Type the Greek word", "ω"],
    ["draw", "Draw", "Write it by hand", "✎"], ["board", "Board", "Match or type a whole set", "▦"],
  ];
  const SHORT = { flashcards: "Flashcards", type: "Type", choice: "Choice", englishToGreek: "Eng → Gk", draw: "Draw", board: "Board" };

  function openSetup(kind, initial, pickNow) {
    let selected = initial && initial.length ? initial.slice() : ["all"];
    // Picking single words: from the chapters/groups chosen, or all words.
    let picking = false, picked = new Set(), pickFrom = ["all"], pq = "";
    const count = (k) => (kind === "daily" ? O.reviewQueue(k).length : O.cardsIn(k).length);
    const scope = () => (selected.length === 1 ? selected[0] : selected.slice());
    const toggle = (k) => {
      selected = selected.filter((x) => !x.startsWith("w:"));
      if (k === "all") selected = ["all"];
      else {
        selected = selected.filter((x) => x !== "all");
        selected = selected.includes(k) ? selected.filter((x) => x !== k) : selected.concat(k);
        const order = O.scopeOptions();
        selected.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        if (!selected.length) selected = ["all"];
      }
      render();
    };
    const head = { study: "Study Session", daily: "Daily Review", cram: "Cram" }[kind];
    const expl = { study: "You'll keep going until every word in the group is mastered.", daily: "Today's words: the ones due for review plus a few new ones.", cram: "Go through every word in the group as fast as you can." }[kind];
    const note = {
      study: "Words you miss come back sooner and more often. Words you already know show up every few cards so you keep your momentum. A word is mastered after 3 right answers in a row (fewer if you already know it well).",
      daily: "Grade each word honestly. Words you know will rest for days, and words you miss come back soon.",
      cram: "Missed words come right back. Cram doesn't change your Daily Review schedule or your Study Session progress.",
    }[kind];
    const startPick = () => {
      const cur = selected.find((x) => x.startsWith("w:"));
      const others = selected.filter((x) => !x.startsWith("w:"));
      if (others.length) pickFrom = others; // otherwise keep showing the last list
      picked = new Set(cur ? cur.slice(2).split(",") : []);
      pq = ""; picking = true; render();
    };
    const pickerBody = () => {
      const pool = O.cardsIn(pickFrom.length === 1 ? pickFrom[0] : pickFrom), fq = O.fold(O.trim(pq));
      const list = pool.filter((c) => !fq || O.fold(c.greek).includes(fq) || O.fold(c.gloss).includes(fq));
      const allOn = list.length > 0 && list.every((c) => picked.has(c.id));
      const flip = (c) => { picked.has(c.id) ? picked.delete(c.id) : picked.add(c.id); render(); };
      return [
        h("div", { style: "font-size:22px;font-weight:700" }, "Pick words"),
        h("div", { class: "muted" }, "Choose exactly the words you want to practice, like just 3 from a chapter. Showing: " + O.scopeTitle(pickFrom.length === 1 ? pickFrom[0] : pickFrom) + "."),
        h("input", { type: "text", placeholder: "🔍 Search Greek or English", value: pq, oninput: (e) => { pq = e.target.value; render(); setTimeout(() => { const i = document.querySelector(".pick-q"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, class: "pick-q" }),
        h("div", { class: "sec-h" }, list.length + " words", h("span", { class: "spacer" }), picked.size + " picked",
          h("button", { class: "btn link", onclick: () => { list.forEach((c) => (allOn ? picked.delete(c.id) : picked.add(c.id))); render(); } }, allOn ? "Deselect these" : "Select all"),
          picked.size ? h("button", { class: "btn link", onclick: () => { picked.clear(); render(); } }, "Clear") : null),
        h("div", { class: "list", style: "max-height:46vh;overflow:auto" }, list.map((c) =>
          h("div", { class: "li", onclick: () => flip(c) },
            h("span", { style: "font-size:18px;color:" + (picked.has(c.id) ? "var(--accent)" : "var(--muted)") }, picked.has(c.id) ? "●" : "○"),
            h("span", { class: "gk" }, c.greek), h("span", { class: "spacer" }), h("span", { class: "muted small" }, c.gloss)))),
      ];
    };
    if (pickNow) { const others = selected.filter((x) => !x.startsWith("w:")); if (others.length) pickFrom = others; picked = new Set(); picking = true; }
    openModal(() => {
      if (picking) return h("div", { class: sheetClass() },
        h("div", { class: "body stack" }, pickerBody()),
        h("div", { class: "foot" },
          h("button", { class: "btn", onclick: () => { picking = false; render(); } }, "Back"),
          h("button", { class: "btn pri", disabled: !picked.size, onclick: () => {
            const ids = O.cardsIn("all").map((c) => c.id).filter((id) => picked.has(id));
            selected = ["w:" + ids.join(",")]; picking = false; render();
          } }, picked.size ? `Use ${picked.size} word${picked.size === 1 ? "" : "s"}` : "Pick some words")));
      const n = count(scope());
      const modeTiles = (list, key) => h("div", { class: "modes" }, list.map(([id, t, sub, g]) =>
        h("button", { class: "mode" + (S[key] === id ? " on" : ""), onclick: () => { O.set(key, id); render(); } },
          h("div", { class: "g" }, g), h("b", null, t), h("span", null, sub))));
      return h("div", { class: sheetClass() },
        h("div", { class: "body" },
          h("div", { style: "font-size:22px;font-weight:700" }, head), h("div", { class: "muted" }, expl),
          h("div", { class: "label" }, "1 · Choose your words (tap as many as you like)"),
          h("div", { class: "chips" },
            O.scopeOptions().map((k) => h("button", { class: "chip" + (selected.includes(k) ? " on" : ""), onclick: () => toggle(k), title: k.startsWith("c:") || k.startsWith("g:") ? "Right-click to pin" : null, oncontextmenu: (e) => { if (k.startsWith("c:") || k.startsWith("g:")) { e.preventDefault(); O.togglePinScope(k); render(); } } },
              O.isPinnedScope(k) || k === "pinned" ? "📌 " : "", O.scopeTitle(k), h("small", null, count(k)))),
            selected.filter((k) => k.startsWith("w:")).map((k) => h("button", { class: "chip on", onclick: startPick, title: "Change which words" }, "✓ " + O.scopeTitle(k), h("small", null, count(k)))),
            h("button", { class: "chip new", onclick: startPick, title: "Choose single words from the chapters or groups you tapped" }, "☑ Pick words…"),
            h("button", { class: "chip new", onclick: () => groupEditor(null, (g) => { selected = ["g:" + g.id]; }) }, "+ New group")),
          h("div", { class: "hint" }, "Want only a few words? Tap a chapter, then “Pick words…” to choose just the ones you want. Right-click a chapter or group to pin it."),
          kind === "study" ? [h("div", { class: "label" }, "2 · Choose a mode (you can switch any time)"), modeTiles(MODES, "studyMode")] : null,
          kind === "cram" ? [h("div", { class: "label" }, "2 · Choose a mode"), modeTiles(MODES.slice(0, 2), "cramMode")] : null,
          kind === "daily" ? [h("div", { class: "label" }, "2 · Direction"),
            h("div", { class: "seg" }, [["greekToEnglish", "Greek → English"], ["englishToGreek", "English → Greek"], ["mixed", "Mixed"]].map(([id, t]) =>
              h("button", { class: S.direction === id ? "on" : "", onclick: () => { O.set("direction", id); render(); } }, t)))] : null,
          h("div", { class: "note", style: "margin-top:16px" }, note)),
        h("div", { class: "foot" },
          h("button", { class: "btn", onclick: closeModal }, "Cancel"),
          h("button", { class: "btn pri", disabled: !n, onclick: () => startSession(kind, scope()) }, n ? `Start · ${n} words` : "No words")));
    });
  }

  function startSession(kind, scope) {
    st.modal = null;
    const title = O.scopeTitle(scope);
    O.setLast({ type: "vocab", kind, scope, title, chapter: O.chapterOfScope(scope) });
    if (kind === "study") st.session = { kind, title, engine: new O.MasteryEngine(O.cardsIn(scope)), p: {}, board: null };
    if (kind === "cram") {
      const cards = O.cardsIn(scope);
      st.session = { kind, title, all: cards, queue: O.shuffle(cards), done: 0, misses: 0, streak: 0, best: 0, start: Date.now(), end: null, p: {} };
    }
    if (kind === "daily") st.session = { kind, title, queue: O.reviewQueue(scope), reviewed: 0, p: {} };
    render();
  }
  function endSession() { clearInterval(st.timer); st.session = null; render(); }

  // ---------- Session screens ----------
  function renderSession() {
    const s = st.session;
    if (s.kind === "study") return studyScreen(s);
    if (s.kind === "cram") return cramScreen(s);
    return dailyScreen(s);
  }

  function sessionFrame(title, tools, body) {
    return h("div", { class: "session" },
      h("div", { class: "s-head" },
        h("button", { class: "btn", onclick: endSession }, "✕ End"), h("b", null, title), h("span", { class: "spacer" }), tools),
      h("div", { class: "s-body" }, h("div", { class: "s-inner" }, body)));
  }

  function complete(head, detail, againLabel, again) {
    st.keys = (e) => { if (e.key === "Enter") endSession(); };
    return h("div", { class: "stack center" + ap("done", head + detail), style: "margin:auto;align-items:center" },
      h("div", { style: "font-size:56px;color:var(--accent)" }, "✓"),
      h("div", { style: "font-size:24px;font-weight:700" }, head), h("div", { class: "muted" }, detail),
      h("div", { class: "row" }, again ? h("button", { class: "btn", onclick: again }, againLabel) : null,
        h("button", { class: "btn pri", onclick: endSession }, "Done")));
  }

  // Study Session
  function studyScreen(s) {
    const e = s.engine;
    const tools = h("div", { class: "seg" }, MODES.map(([id]) =>
      h("button", { class: S.studyMode === id ? "on" : "", onclick: () => { O.set("studyMode", id); s.p = {}; s.board = null; if (id !== "board") e.advance(); render(); } }, SHORT[id])));
    let body;
    if (e.finished) {
      const pct = e.answered ? Math.round((e.correctCount / e.answered) * 100) : 0;
      body = complete(`You mastered all ${e.cards.length} words!`, `${e.answered} answers · ${pct}% right.`, "Study again", () => { s.engine = new O.MasteryEngine(e.cards); s.p = {}; s.board = null; render(); });
    } else {
      const top = h("div", { class: "row small muted" }, `Mastered ${e.mastered.size} of ${e.cards.length}`,
        h("div", { class: "bar" }, h("i", { style: `width:${(e.mastered.size / Math.max(1, e.cards.length)) * 100}%` })),
        e.warmup && S.studyMode !== "board" ? h("span", { class: "pill" }, "A word you know") : null);
      const answer = (correct, secs) => {
        O.recordStudy(e.current, correct, secs < 6);
        e.record(e.current, correct); e.advance(); s.p = {}; render();
      };
      let practice;
      if (S.studyMode === "board") {
        if (!s.board) { e.advance(); s.board = { cards: e.boardRound(window.innerWidth < 760 ? 6 : 10), st: {} }; }
        practice = boardView(s, (card, ok) => { O.recordStudy(card, ok, false); e.record(card, ok); },
          () => { e.advance(); s.board = null; render(); });
      } else practice = practiceView(S.studyMode, e.current, s.p, answer, false);
      const cardKey = S.studyMode + "|" + (S.studyMode === "board" ? (s.board && s.board.cards.map((c) => c.id).join()) : (e.current && e.current.id) + "|" + e.answered);
      body = [top, h("div", { class: ap("card", cardKey), style: "flex:1;display:flex;flex-direction:column;gap:14px" }, practice)];
    }
    return sessionFrame("Study · " + s.title, tools, body);
  }

  // Cram
  function cramScreen(s) {
    const tools = h("div", { class: "seg" }, ["flashcards", "type"].map((id) =>
      h("button", { class: S.cramMode === id ? "on" : "", onclick: () => { O.set("cramMode", id); s.p = {}; render(); } }, SHORT[id])));
    const clock = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
    let body;
    if (!s.queue.length) {
      clearInterval(st.timer);
      body = complete("Cram complete!", `${s.all.length} words in ${clock(s.end - s.start)} · ${s.misses} missed · best streak ${s.best}`, "Cram again",
        () => { st.session = { ...s, queue: O.shuffle(s.all), done: 0, misses: 0, streak: 0, best: 0, start: Date.now(), end: null, p: {} }; render(); });
    } else {
      const timer = h("span", null, "⏱ " + clock(Date.now() - s.start));
      clearInterval(st.timer);
      st.timer = setInterval(() => { timer.textContent = "⏱ " + clock(Date.now() - s.start); }, 1000);
      const answer = (ok) => {
        const card = s.queue.shift();
        if (ok) { s.done++; s.streak++; s.best = Math.max(s.best, s.streak); }
        else { s.misses++; s.streak = 0; s.queue.splice(Math.min(3, s.queue.length), 0, card); }
        if (!s.queue.length) s.end = Date.now();
        s.p = {}; render();
      };
      body = [
        h("div", { class: "row small muted" }, `✓ ${s.done} of ${s.all.length}`, h("span", { class: "spacer" }),
          h("span", { style: s.streak >= 5 ? "color:#e08a2c" : "" }, `🔥 ${s.streak} in a row`), h("span", { class: "spacer" }), timer),
        h("div", { class: "bar", style: "flex:none" }, h("i", { style: `width:${(s.done / Math.max(1, s.all.length)) * 100}%` })),
        h("div", { class: ap("card", S.cramMode + "|" + s.done + "|" + s.misses), style: "flex:1;display:flex;flex-direction:column;gap:14px" }, practiceView(S.cramMode, s.queue[0], s.p, answer, true)),
      ];
    }
    return sessionFrame("Cram · " + s.title, tools, body);
  }

  // Daily Review
  function dailyScreen(s) {
    let body;
    if (!s.queue.length) body = complete("Daily review done!", `${s.reviewed} reviews. Come back tomorrow for the next batch.`);
    else {
      const card = s.queue[0], p = s.p;
      if (p.greekFront === undefined) p.greekFront = S.direction === "mixed" ? Math.random() < 0.5 : S.direction !== "englishToGreek";
      const reveal = () => { p.revealed = true; render(); };
      const grade = (g) => {
        O.grade(card, g); s.queue.shift();
        if (g === 1) s.queue.splice(Math.min(3, s.queue.length), 0, card);
        s.reviewed++; s.p = {}; render();
      };
      st.keys = (e, typing) => {
        if (typing) return;
        if (!p.revealed && e.key === " ") { e.preventDefault(); reveal(); }
        else if (p.revealed && "1234".includes(e.key)) grade(+e.key);
      };
      body = [
        h("div", { class: "bar", style: "flex:none" }, h("i", { style: `width:${(s.reviewed / Math.max(1, s.reviewed + s.queue.length)) * 100}%` })),
        h("div", { class: ap("card", card.id + "|" + s.reviewed), style: "flex:1;display:flex;flex-direction:column;gap:14px" },
          cardFace(card, p.greekFront, p.revealed, reveal),
          p.revealed
            ? h("div", { class: "grades" }, [[1, "Again"], [2, "Hard"], [3, "Good"], [4, "Easy"]].map(([g, t]) =>
                h("button", { class: "g" + g, onclick: () => grade(g) }, t, h("span", null, O.previewGrade(card, g)))))
            : h("button", { class: "btn pri big", style: "max-width:480px;margin:0 auto;width:100%", onclick: reveal }, "Show answer"),
          h("div", { class: "hint keys center" }, p.revealed ? "1–4 grades the word" : "Space shows the answer")),
      ];
    }
    return sessionFrame("Daily Review · " + s.title, h("span", { class: "muted" }, `${s.queue.length} left`), body);
  }

  // ---------- Practice modes ----------
  function cardFace(card, greekFront, revealed, onTap) {
    return h("div", { class: "face", onclick: onTap },
      h("div", { class: greekFront ? "big-gk" : "big-en" }, greekFront ? card.greek : card.gloss),
      revealed
        ? [h("div", { style: "width:220px;border-top:1px solid var(--line)" }),
           h("div", { class: greekFront ? "big-en" : "big-gk" }, greekFront ? card.gloss : card.greek),
           h("div", { class: "row" }, card.partOfSpeech ? h("span", { class: "pill" }, card.partOfSpeech) : null, card.chapter != null ? h("span", { class: "pill" }, "Ch. " + card.chapter) : null)]
        : h("div", { class: "muted" }, greekFront ? "What does it mean?" : "What's the Greek?"));
  }

  function feedback(ok, answer, greek, yours, canOverride, onOverride) {
    return h("div", { class: "feedback " + (ok ? "ok" : "bad") + ap("feedback", answer + "|" + (yours || "") + "|" + ok) },
      h("div", { class: "v" }, ok ? "✓ Correct" : "✕ Not quite"),
      h("div", { class: greek ? "greek" : "", style: `font-size:${greek ? 28 : 19}px;margin-top:4px` }, answer),
      !ok && yours ? h("div", { class: "muted small" }, "You wrote: " + yours) : null,
      canOverride ? h("button", { class: "btn", style: "margin-top:8px", onclick: onOverride }, "✓ I was right, count it") : null);
  }

  function resultButtons(onMiss, onGot) {
    return h("div", { class: "result-btns" },
      h("button", { class: "btn big", style: "background:var(--bad-soft);color:var(--bad)", onclick: onMiss }, "✕ Missed it"),
      h("button", { class: "btn big ok", onclick: onGot }, "✓ Got it"));
  }

  function greekKeypad(input) {
    const rows = ["αβγδεζηθι", "κλμνξοπρσ", "ςτυφχψω"];
    const press = (ch) => { input.value = O.toGreek(input.value + ch); input.dispatchEvent(new Event("input")); input.focus(); };
    return h("div", { class: "keypad" }, rows.map((r, i) => h("div", { class: "r" },
      [...r].map((ch) => h("button", { class: "key", onclick: () => press(ch) }, h("b", null, ch), h("i", null, O.latinKey(ch)))),
      i === 2 ? h("button", { class: "key", style: "width:50px", onclick: () => { input.value = [...input.value].slice(0, -1).join(""); input.dispatchEvent(new Event("input")); input.focus(); } }, "⌫") : null)));
  }
  const greekInput = (cls, placeholder) => {
    const el = h("input", { type: "text", class: cls, placeholder, autocomplete: "off", spellcheck: "false", autocapitalize: "off" });
    el.addEventListener("input", () => { const pos = el.value.length; const g = O.toGreek(el.value); if (g !== el.value) { el.value = g; el.setSelectionRange(pos, pos); } });
    return el;
  };

  /** One card in a given mode. answer(correct, seconds) moves on. quick = Cram (auto-advance). */
  function practiceView(mode, card, p, answer, quick) {
    if (!card) return null;
    if (p.t0 === undefined) p.t0 = Date.now();
    const secs = () => (Date.now() - p.t0) / 1000;

    if (mode === "flashcards") {
      const reveal = () => { if (!p.revealed) { p.secs = secs(); p.revealed = true; render(); } };
      st.keys = (e, typing) => {
        if (typing) return;
        if (!p.revealed && e.key === " ") { e.preventDefault(); reveal(); }
        else if (p.revealed && e.key === "1") answer(false, p.secs);
        else if (p.revealed && e.key === "2") answer(true, p.secs);
      };
      return [cardFace(card, true, p.revealed, reveal),
        p.revealed ? resultButtons(() => answer(false, p.secs), () => answer(true, p.secs))
          : h("button", { class: "btn pri big", style: "max-width:480px;margin:0 auto;width:100%", onclick: reveal }, "Show answer"),
        h("div", { class: "hint keys center" }, p.revealed ? "1 = missed it · 2 = got it" : "Space shows the answer")];
    }

    if (mode === "type" || mode === "englishToGreek") {
      const gk = mode === "englishToGreek";
      const input = gk ? greekInput("answer-input gk", "Type in Greek") : h("input", { type: "text", class: "answer-input", placeholder: "Type the English meaning", autocomplete: "off", spellcheck: "false" });
      input.value = p.text || "";
      input.setAttribute("data-autofocus", "");
      input.addEventListener("input", () => { p.text = input.value; });
      const finish = () => { if (p.finished || p.result === undefined) return; p.finished = true; answer(p.result || p.overridden, p.secs); };
      const check = () => {
        if (p.result !== undefined) return finish();
        if (!O.trim(p.text)) return;
        p.secs = secs();
        p.result = gk ? O.checkGreek(p.text, card.greek) : O.checkEnglish(p.text, card.gloss);
        render();
        if (p.result && quick) setTimeout(finish, 600);
      };
      const giveUp = () => { p.secs = secs(); p.result = false; render(); };
      // stopPropagation: this Enter is handled here, so the screen-wide "Enter = continue"
      // shortcut must not also see it (that skipped past the feedback).
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); check(); } });
      st.keys = (e, typing) => { if (!typing && e.key === "Enter" && p.result !== undefined) finish(); };
      if (p.result !== undefined) input.readOnly = true;
      return [
        h("div", { class: "prompt", style: "margin-top:auto" }, h("div", { class: "cap" }, gk ? "Write the Greek for" : "What does it mean?"),
          h("div", { class: gk ? "big-en" : "big-gk" }, gk ? card.gloss : card.greek)),
        h("div", { class: "center" }, input),
        p.result !== undefined
          ? feedback(p.result || p.overridden, gk ? card.greek : card.gloss, gk, p.text, !p.result && !p.overridden, () => { p.overridden = true; render(); })
          : gk ? [greekKeypad(input), h("div", { class: "muted small center" }, "Accents and breathing marks are optional. Typing on your keyboard works too: l-o-g-o-s → λογος.")] : null,
        h("div", { style: "margin-top:auto" }),
        p.result === undefined
          ? h("div", { class: "row", style: "max-width:480px;margin:0 auto;width:100%" },
              h("button", { class: "btn", onclick: giveUp }, gk ? "Show answer" : "I don't know"), h("span", { class: "spacer" }),
              h("button", { class: "btn pri", onclick: check }, "Check"))
          : h("button", { class: "btn pri big", style: "margin:0 auto;min-width:200px", onclick: finish }, "Continue"),
        h("div", { class: "hint keys center" }, "Return checks your answer, then Return again to continue"),
      ];
    }

    if (mode === "choice") {
      if (!p.options) p.options = O.choiceOptions(card, O.data.cards);
      const pick = (o) => { if (p.picked !== undefined) return; p.secs = secs(); p.picked = o; render(); };
      const next = () => answer(p.picked === card.gloss, p.secs);
      st.keys = (e, typing) => {
        if (typing) return;
        if (p.picked === undefined && "1234".includes(e.key) && p.options[+e.key - 1]) pick(p.options[+e.key - 1]);
        else if (p.picked !== undefined && e.key === "Enter") next();
      };
      return [
        h("div", { class: "prompt", style: "margin-top:auto" }, h("div", { class: "cap" }, "What does it mean?"), h("div", { class: "big-gk" }, card.greek)),
        h("div", { class: "stack", style: "max-width:520px;margin:0 auto;width:100%;gap:10px" }, p.options.map((o, i) =>
          h("button", { class: "choice-opt" + (p.picked !== undefined && o === card.gloss ? " right" : p.picked === o ? " wrong" : ""), onclick: () => pick(o) },
            h("span", { class: "n" }, i + 1), h("span", null, o)))),
        h("div", { style: "margin-top:auto" }),
        p.picked !== undefined ? h("button", { class: "btn pri big", style: "margin:0 auto;min-width:200px", onclick: next }, "Continue") : null,
        h("div", { class: "hint keys center" }, p.picked === undefined ? "Press 1–4 to choose" : "Return to continue"),
      ];
    }

    if (mode === "draw") {
      p.strokes = p.strokes || [];
      const canvas = h("canvas", { class: "draw" });
      const paint = () => {
        const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
        canvas.width = r.width * dpr; canvas.height = r.height * dpr;
        const c = canvas.getContext("2d");
        c.scale(dpr, dpr);
        c.strokeStyle = getComputedStyle(document.body).color; c.fillStyle = c.strokeStyle;
        c.lineWidth = 5; c.lineCap = "round"; c.lineJoin = "round";
        c.setLineDash([5, 5]); c.globalAlpha = 0.3; c.lineWidth = 1;
        c.beginPath(); c.moveTo(28, r.height * 0.7); c.lineTo(r.width - 28, r.height * 0.7); c.stroke();
        c.setLineDash([]); c.globalAlpha = 1; c.lineWidth = 5;
        p.strokes.forEach((s) => {
          c.beginPath();
          s.forEach(([x, y], i) => (i ? c.lineTo(x * r.width, y * r.height) : c.moveTo(x * r.width, y * r.height)));
          if (s.length === 1) { c.arc(s[0][0] * r.width, s[0][1] * r.height, 3, 0, 7); c.fill(); } else c.stroke();
        });
      };
      if (!p.checked) {
        let drawing = false;
        const pt = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
        canvas.addEventListener("pointerdown", (e) => { drawing = true; canvas.setPointerCapture(e.pointerId); p.strokes.push([pt(e)]); paint(); });
        canvas.addEventListener("pointermove", (e) => { if (drawing) { p.strokes[p.strokes.length - 1].push(pt(e)); paint(); } });
        canvas.addEventListener("pointerup", () => { drawing = false; checkBtn.disabled = !p.strokes.length; });
      }
      requestAnimationFrame(paint);
      const check = () => { if (!p.strokes.length) return; p.secs = secs(); p.checked = true; render(); };
      const clear = () => { p.strokes = []; paint(); checkBtn.disabled = true; };
      const checkBtn = h("button", { class: "btn pri", onclick: check, disabled: !p.strokes.length }, "Check");
      st.keys = (e, typing) => {
        if (typing) return;
        if (!p.checked && e.key === "Enter") check();
        else if (!p.checked && (e.key === "Backspace" || e.key === "Delete")) clear();
        else if (p.checked && e.key === "1") answer(false, p.secs);
        else if (p.checked && e.key === "2") answer(true, p.secs);
      };
      return [
        h("div", { class: "prompt" }, h("div", { class: "cap" }, "Write the Greek for"), h("div", { class: "big-en" }, card.gloss)),
        h("div", { class: "row", style: "align-items:center;gap:16px" },
          h("div", { style: "flex:1" }, canvas),
          p.checked ? h("div", { class: "center" + ap("drawans", card.id), style: "width:220px" }, h("div", { class: "muted small" }, "Answer"),
            h("div", { class: "greek", style: "font-size:32px" }, card.greek), h("div", { class: "muted small" }, "Compare it with your writing")) : null),
        p.checked ? resultButtons(() => answer(false, p.secs), () => answer(true, p.secs))
          : h("div", { class: "row" }, h("button", { class: "btn", onclick: clear }, "Clear"), h("span", { class: "spacer" }), checkBtn),
        h("div", { class: "hint keys center" }, p.checked ? "1 = missed it · 2 = got it" : "Click and drag (or use a touchscreen or pen) · Return checks · Delete clears"),
      ];
    }
    return null;
  }

  // ---------- Board ----------
  function boardView(s, onResult, onNext) {
    const b = s.board, cards = b.cards, bs = b.st;
    const styleSeg = h("div", { class: "seg", style: "margin:0 auto" }, [["match", "Match"], ["type", "Type"]].map(([id, t]) =>
      h("button", { class: S.boardStyle === id ? "on" : "", onclick: () => { O.set("boardStyle", id); b.st = {}; render(); } }, t)));
    const finished = (head, detail) => {
      st.keys = (e) => { if (e.key === "Enter") onNext(); };
      return h("div", { class: "stack center" + ap("done", head + detail), style: "margin:auto" }, h("div", { style: "font-size:44px;color:var(--accent)" }, "▦"),
        h("div", { style: "font-size:22px;font-weight:700" }, head), h("div", { class: "muted" }, detail),
        h("button", { class: "btn pri big", style: "margin:0 auto", onclick: onNext }, "Next board"));
    };

    if (S.boardStyle !== "type") {
      bs.meanings = bs.meanings || O.shuffle(cards);
      bs.mg = bs.mg || new Set(); bs.mm = bs.mm || new Set(); bs.missed = bs.missed || new Set(); bs.flash = bs.flash || new Set();
      if (bs.mg.size === cards.length) return [styleSeg, finished("Board cleared!", `${cards.length - bs.missed.size} of ${cards.length} matched on the first try.`)];
      const tryMatch = () => {
        if (!bs.g || !bs.e) return render();
        const gc = cards.find((c) => c.id === bs.g), ec = cards.find((c) => c.id === bs.e);
        if (bs.g === bs.e || O.fold(gc.gloss) === O.fold(ec.gloss)) {
          bs.mg.add(bs.g); bs.mm.add(bs.e);
          if (!bs.missed.has(bs.g)) onResult(gc, true);
        } else {
          if (!bs.missed.has(bs.g)) { bs.missed.add(bs.g); onResult(gc, false); }
          const keys = ["g" + bs.g, "e" + bs.e];
          keys.forEach((k) => bs.flash.add(k));
          setTimeout(() => { keys.forEach((k) => bs.flash.delete(k)); render(); }, 500);
        }
        bs.g = bs.e = null; render();
      };
      const tile = (c, gk) => {
        const id = c.id, done = gk ? bs.mg.has(id) : bs.mm.has(id), picked = gk ? bs.g === id : bs.e === id;
        return h("button", { class: "tile" + (gk ? " gk" : "") + (done ? " done" : "") + (picked ? " picked" : "") + (bs.flash.has((gk ? "g" : "e") + id) ? " flash" : ""), disabled: done,
          onclick: () => { if (gk) bs.g = bs.g === id ? null : id; else bs.e = bs.e === id ? null : id; tryMatch(); } }, gk ? c.greek : c.gloss);
      };
      return [styleSeg, h("div", { class: "cols" }, h("div", null, cards.map((c) => tile(c, true))), h("div", null, bs.meanings.map((c) => tile(c, false)))),
        h("div", { class: "muted small center" }, "Tap a Greek word, then its meaning (or the other way around).")];
    }

    bs.answers = bs.answers || {}; bs.over = bs.over || new Set();
    const right = (c) => (bs.results && bs.results[c.id]) || bs.over.has(c.id);
    const inputs = [];
    const rows = cards.map((c, i) => {
      const input = h("input", { type: "text", placeholder: "Meaning", autocomplete: "off", spellcheck: "false", style: "width:100%", value: bs.answers[c.id] || "" });
      input.readOnly = !!bs.results;
      input.addEventListener("input", () => { bs.answers[c.id] = input.value; });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !(e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); (inputs[i + 1] || input).focus(); } });
      if (i === 0 && !bs.results) input.setAttribute("data-autofocus", "");
      inputs.push(input);
      return h("div", { class: "trow" + (bs.results ? (right(c) ? " ok" : " bad") : "") },
        h("div", { class: "gk" }, c.greek),
        h("div", { style: "flex:1" }, input, bs.results ? [h("div", { class: "small", style: `color:var(--${right(c) ? "ok" : "bad"});margin-top:4px` }, (right(c) ? "✓ " : "✕ ") + c.gloss),
          !right(c) ? h("button", { class: "btn", style: "margin-top:6px;font-size:12px;padding:4px 10px", onclick: () => { bs.over.add(c.id); render(); } }, "✓ I was right, count it") : null] : null));
    });
    const check = () => { bs.results = {}; cards.forEach((c) => { bs.results[c.id] = O.checkEnglish(bs.answers[c.id] || "", c.gloss); }); render(); };
    const finish = () => { if (bs.finished) return; bs.finished = true; cards.forEach((c) => onResult(c, right(c))); onNext(); };
    st.keys = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !bs.results) check(); else if (e.key === "Enter" && bs.results) finish(); };
    return [styleSeg, h("div", { class: "tboard" }, rows),
      h("div", { class: "row" }, bs.results ? h("span", { class: "muted" }, `${cards.filter(right).length} of ${cards.length} right`) : h("span", { class: "muted" }, "Fill in each meaning, then check."),
        h("span", { class: "spacer" }), bs.results ? h("button", { class: "btn pri", onclick: finish }, "Next board") : h("button", { class: "btn pri", onclick: check }, "Check all")),
      h("div", { class: "hint keys" }, bs.results ? "Return for the next board" : "Return moves to the next box · Ctrl/⌘ + Return checks the board")];
  }

  // ---------- Vocabulary ----------
  let vocabSearch = "", selectingGroups = false, selectedGroups = new Set();
  // One place to start studying: what (chapter tabs) → how (Learn / Review / Cram) → Start.
  function studyPanel() {
    const d = O.data;
    if (!d.cards.length) return h("div", { class: "card pad stack center" }, h("b", { style: "font-size:18px" }, "No words yet"),
      h("div", { class: "muted" }, "Add your vocabulary list to start studying."), h("div", null, h("button", { class: "btn pri", onclick: () => go("add") }, "+ Add words")));
    const opts = O.scopeOptions();
    if (!st.vocabScope || (!opts.includes(st.vocabScope) && !st.vocabScope.startsWith("w:"))) { const n = O.currentChapter(); st.vocabScope = n && opts.includes("c:" + n) ? "c:" + n : opts.find((k) => k.startsWith("g:") && O.chapterOfScope(k) === n) || "all"; }
    const scope = st.vocabScope, kind = st.vocabKind || "study";
    const cards = O.cardsIn(scope), known = cards.filter((c) => (d.progress[c.id]?.intervalDays || 0) >= 3 || (d.mastery[c.id]?.strength || 0) >= 0.8).length;
    const due = O.reviewQueue(scope).length;
    const count = kind === "daily" ? due : cards.length;
    const choice = (k, title, text) => h("button", { class: "card how" + (kind === k ? " on" : ""), role: "radio", "aria-checked": kind === k ? "true" : "false", onclick: () => { st.vocabKind = k; render(); } },
      h("span", { class: "radio" }), h("span", null, h("b", null, title), h("span", { class: "muted small" }, text)));
    const select = (label, key, list) => h("label", { class: "row", style: "gap:6px" }, h("span", { class: "muted" }, label),
      h("select", { onchange: (e) => { O.set(key, e.target.value); render(); } }, list.map(([id, t]) => h("option", { value: id, selected: S[key] === id || null }, t))));
    const tabs = opts.map((k) => h("button", { class: "chip" + (scope === k ? " on" : ""), onclick: () => { st.vocabScope = k; render(); } }, O.scopeTitle(k)));
    if (scope.startsWith("w:")) tabs.push(h("button", { class: "chip on", onclick: () => openSetup(kind, [scope], true) }, "✓ " + O.scopeTitle(scope)));
    tabs.push(h("button", { class: "chip new", onclick: () => openSetup(kind, [scope.startsWith("w:") ? "all" : scope], true) }, "☑ Pick words…"));
    return h("div", { class: "stack" },
      h("div", { class: "chips" }, tabs),
      h("div", { class: "card pad" }, h("div", { class: "row" }, h("b", { style: "font-size:17px" }, O.scopeTitle(scope) + " · " + cards.length + " words"), h("span", { class: "spacer" }),
        h("span", { class: "badge" }, known + " learned")), h("div", { class: "hbar", style: "margin-top:10px" }, h("i", { style: `width:${cards.length ? Math.round((known / cards.length) * 100) : 0}%` }))),
      h("div", { class: "label", style: "margin:4px 0 0" }, "How do you want to study?"),
      h("div", { class: "stack", role: "radiogroup", style: "gap:10px" },
        choice("study", "Learn", "Keep going until you know every word. Missed words come back sooner. Best most days."),
        choice("daily", "Review", due ? `Spaced repetition: ${due} word${due === 1 ? "" : "s"} due today.` : "Spaced repetition: nothing due in this set today."),
        choice("cram", "Cram", "A fast run before a quiz. Doesn't change your progress.")),
      h("div", { class: "row wrap" },
        kind === "study" ? select("Card style", "studyMode", MODES.map((m) => [m[0], m[1]])) : null,
        kind === "cram" ? select("Card style", "cramMode", MODES.slice(0, 2).map((m) => [m[0], m[1]])) : null,
        kind === "daily" ? select("Direction", "direction", [["greekToEnglish", "Greek → English"], ["englishToGreek", "English → Greek"], ["mixed", "Mixed"]]) : null,
        h("span", { class: "spacer" }),
        h("button", { class: "btn pri big", disabled: !count || null, onclick: () => startSession(kind, scope) }, count ? `Start · ${count} word${count === 1 ? "" : "s"}` : "Nothing to study here")));
  }

  function viewVocab() {
    const listBox = h("div");
    const search = h("input", { type: "text", placeholder: "Search Greek or English", style: "width:100%", value: vocabSearch,
      oninput: () => { vocabSearch = search.value; drawList(); } });
    const drawList = () => listBox.replaceChildren(vocabList());
    drawList();
    return { title: "Vocabulary", tools: h("button", { class: "btn", onclick: () => go("add") }, "+ Add words"),
      body: h("div", { class: "stack" }, studyPanel(), h("div", { class: "sec-h", style: "margin-top:14px" }, "All your words"), search, listBox) };
  }

  function wordRow(c) {
    const pr = O.data.progress[c.id];
    const color = !pr ? "rgba(128,128,128,.35)" : pr.intervalDays >= 3 ? "var(--ok)" : "#e08a2c";
    return h("div", { class: "li" + (O.isPinnedWord(c.id) ? " pinned" : ""), onclick: () => editWord(c) },
      h("button", { class: "icon-btn" + (O.isPinnedWord(c.id) ? " on" : ""), title: O.isPinnedWord(c.id) ? "Unpin word" : "Pin word",
        onclick: (e) => { e.stopPropagation(); O.togglePinWord(c.id); render(); } }, pinIcon(O.isPinnedWord(c.id))),
      h("span", { class: "gk" }, c.greek), h("span", { class: "spacer" }), h("span", { class: "muted", style: "text-align:right" }, c.gloss),
      h("span", { class: "dot", style: "background:" + color }));
  }

  function vocabList() {
    const q = O.fold(O.trim(vocabSearch));
    const cards = O.data.cards.filter((c) => !q || O.fold(c.greek).includes(q) || O.fold(c.gloss).includes(q));
    const out = [];
    const pinned = cards.filter((c) => O.isPinnedWord(c.id));
    if (pinned.length) out.push(h("div", { class: "sec-h" }, "📌 Pinned words"), h("div", { class: "list" }, pinned.map(wordRow)));
    if (!q) {
      const groups = O.data.groups.slice().sort((a, b) => {
        const pa = O.data.pinnedScopes.indexOf("g:" + a.id), pb = O.data.pinnedScopes.indexOf("g:" + b.id);
        return (pa < 0 ? 1e9 : pa) - (pb < 0 ? 1e9 : pb);
      });
      out.push(h("div", { class: "sec-h" }, "Groups", h("span", { class: "spacer" }),
        selectingGroups && groups.length ? h("button", { class: "btn link", onclick: () => { selectedGroups = selectedGroups.size === groups.length ? new Set() : new Set(groups.map((g) => g.id)); render(); } }, selectedGroups.size === groups.length ? "Select none" : "Select all") : null,
        groups.length ? h("button", { class: "btn link", onclick: () => { selectingGroups = !selectingGroups; selectedGroups = new Set(); render(); } }, selectingGroups ? "Done" : "Select") : null));
      out.push(h("div", { class: "list" },
        groups.map((g) => {
          const on = selectedGroups.has(g.id), pin = O.isPinnedScope("g:" + g.id);
          return h("div", { class: "li" + (pin ? " pinned" : ""), onclick: () => { if (selectingGroups) { on ? selectedGroups.delete(g.id) : selectedGroups.add(g.id); render(); } else groupEditor(g); } },
            selectingGroups ? h("span", { style: "font-size:18px;color:" + (on ? "var(--accent)" : "var(--muted)") }, on ? "●" : "○")
              : h("button", { class: "icon-btn" + (pin ? " on" : ""), title: pin ? "Unpin" : "Pin to top", onclick: (e) => { e.stopPropagation(); O.togglePinScope("g:" + g.id); render(); } }, pinIcon(pin)),
            "📁 " + g.name, h("span", { class: "spacer" }), h("span", { class: "muted" }, O.cardsIn("g:" + g.id).length + " words"));
        }),
        !selectingGroups ? h("div", { class: "li", style: "color:var(--accent)", onclick: () => groupEditor(null) }, "+ New group") : null));
      if (selectingGroups) out.push(h("div", { class: "row", style: "margin-top:10px" }, h("span", { class: "muted" }, selectedGroups.size + " selected"), h("span", { class: "spacer" }),
        h("button", { class: "btn red", disabled: !selectedGroups.size, onclick: confirmDeleteGroups }, "Delete…")));
    }
    const byCh = new Map();
    cards.forEach((c) => { const k = c.chapter ?? "none"; if (!byCh.has(k)) byCh.set(k, []); byCh.get(k).push(c); });
    const keys = [...byCh.keys()].sort((a, b) => {
      const pa = a !== "none" && O.isPinnedScope("c:" + a), pb = b !== "none" && O.isPinnedScope("c:" + b);
      if (pa !== pb) return pa ? -1 : 1;
      return (a === "none" ? 1e9 : a) - (b === "none" ? 1e9 : b);
    });
    keys.forEach((k) => {
      const pin = k !== "none" && O.isPinnedScope("c:" + k);
      out.push(h("div", { class: "sec-h" }, pin ? "📌 " : "", k === "none" ? "No chapter yet" : "Chapter " + k, h("span", { class: "spacer" }),
        k !== "none" ? h("button", { class: "btn link", onclick: () => { O.togglePinScope("c:" + k); render(); } }, pin ? "Unpin" : "Pin") : null));
      out.push(h("div", { class: "list" }, byCh.get(k).map(wordRow)));
    });
    if (!O.data.cards.length) out.push(h("div", { class: "muted center", style: "margin-top:30px" }, "No words yet. Use “+ Add words” at the top."));
    else if (!cards.length) out.push(h("div", { class: "muted center", style: "margin-top:30px" }, "No words match your search."));
    return h("div", null, out);
  }

  function confirmDeleteGroups() {
    const n = selectedGroups.size;
    openModal(() => h("div", { class: sheetClass(), style: "width:min(460px,100%)" },
      h("div", { class: "body stack" }, h("b", { style: "font-size:18px" }, `Delete ${n} group${n === 1 ? "" : "s"}?`),
        h("div", { class: "muted" }, "Deleting the words also deletes their progress. This can't be undone.")),
      h("div", { class: "foot", style: "flex-wrap:wrap" },
        h("button", { class: "btn", onclick: closeModal }, "Cancel"),
        h("button", { class: "btn", onclick: () => { O.deleteGroups([...selectedGroups], false); selectedGroups = new Set(); selectingGroups = false; closeModal(); } }, "Delete groups, keep the words"),
        h("button", { class: "btn red", onclick: () => { O.deleteGroups([...selectedGroups], true); selectedGroups = new Set(); selectingGroups = false; closeModal(); } }, "Delete groups and their words"))));
  }

  function editWord(card) {
    const d = { ...card };
    const field = (label, key, greek) => h("label", { class: "stack", style: "gap:4px" }, h("span", { class: "muted small" }, label),
      h("input", { type: "text", value: d[key] || "", class: greek ? "greek" : "", style: greek ? "font-size:18px" : "", oninput: (e) => { d[key] = e.target.value; } }));
    openModal(() => h("div", { class: sheetClass(), style: "width:min(480px,100%)" },
      h("div", { class: "body stack" }, h("b", { style: "font-size:19px" }, "Edit Word"),
        field("Greek (lexical form)", "greek", true), field("English gloss", "gloss"), field("Part of speech", "partOfSpeech"), field("List", "deck"),
        h("label", { class: "stack", style: "gap:4px" }, h("span", { class: "muted small" }, "Chapter"),
          h("select", { onchange: (e) => { d.chapter = e.target.value ? +e.target.value : null; } },
            h("option", { value: "" }, "None"), Array.from({ length: 40 }, (_, i) => h("option", { value: i + 1, selected: d.chapter === i + 1 }, "Chapter " + (i + 1))))),
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: O.isPinnedWord(card.id), onchange: () => O.togglePinWord(card.id) }), "Pinned"),
        O.data.progress[card.id] ? h("button", { class: "btn", onclick: () => { delete O.data.progress[card.id]; delete O.data.mastery[card.id]; O.save(); closeModal(); } }, "Reset this word's progress") : null,
        h("button", { class: "btn red", onclick: () => { if (confirm("Delete this word?")) { O.removeCards([card.id]); closeModal(); } } }, "Delete word")),
      h("div", { class: "foot" }, h("button", { class: "btn", onclick: closeModal }, "Cancel"),
        h("button", { class: "btn pri", onclick: () => { if (!O.trim(d.greek) || !O.trim(d.gloss)) return; O.updateCard(d); closeModal(); } }, "Save"))));
  }

  function groupEditor(group, onSave) {
    let name = group ? group.name : "", sel = new Set(group ? group.cardIDs : []), q = "";
    const listBox = h("div");
    const drawList = () => {
      const all = O.cardsIn("all"), fq = O.fold(O.trim(q));
      const matches = all.filter((c) => !fq || O.fold(c.greek).includes(fq) || O.fold(c.gloss).includes(fq));
      const row = (c) => h("div", { class: "li", onclick: () => { sel.has(c.id) ? sel.delete(c.id) : sel.add(c.id); drawList(); } },
        h("span", { style: "font-size:18px;color:" + (sel.has(c.id) ? "var(--accent)" : "var(--muted)") }, sel.has(c.id) ? "●" : "○"),
        h("span", { class: "gk" }, c.greek), h("span", { class: "spacer" }), h("span", { class: "muted small" }, c.gloss));
      const others = fq ? all.filter((c) => sel.has(c.id) && !matches.includes(c)) : [];
      const allOn = matches.length && matches.every((c) => sel.has(c.id));
      listBox.replaceChildren(
        h("div", { class: "sec-h" }, fq ? matches.length + " matches" : "All words", h("span", { class: "spacer" }), sel.size + " selected",
          h("button", { class: "btn link", onclick: () => { matches.forEach((c) => (allOn ? sel.delete(c.id) : sel.add(c.id))); drawList(); } }, allOn ? "Deselect these" : "Select all")),
        h("div", { class: "list", style: "max-height:45vh;overflow:auto" }, matches.map(row)),
        others.length ? [h("div", { class: "sec-h" }, "Also selected"), h("div", { class: "list" }, others.map(row))] : null);
    };
    drawList();
    const save = () => {
      if (!O.trim(name) || !sel.size) return;
      const lib = O.cardsIn("all").map((c) => c.id);
      let ids = (group ? group.cardIDs : []).filter((id) => sel.has(id));
      ids = ids.concat(lib.filter((id) => sel.has(id) && !ids.includes(id)));
      const g = { id: group ? group.id : O.uid("g"), name: O.trim(name), cardIDs: ids };
      O.saveGroup(g);
      if (onSave) onSave(g);
      closeModal();
    };
    openModal(() => h("div", { class: sheetClass() },
      h("div", { class: "body stack" }, h("b", { style: "font-size:19px" }, group ? "Edit Group" : "New Group"),
        h("input", { type: "text", placeholder: "Group name (for example, Chapter 9)", value: name, oninput: (e) => { name = e.target.value; } }),
        h("input", { type: "text", placeholder: "🔍 Search Greek or English", oninput: (e) => { q = e.target.value; drawList(); } }),
        listBox,
        group ? h("button", { class: "btn red", onclick: () => { O.deleteGroups([group.id], false); closeModal(); } }, "Delete group (keep the words)") : null),
      h("div", { class: "foot" }, h("button", { class: "btn", onclick: closeModal }, "Cancel"), h("button", { class: "btn pri", onclick: save }, group ? "Save" : "Create"))));
  }

  // ---------- Paradigms ----------
  let pSelecting = false, pSelected = [];
  // ---------- Paradigms home: chapter tabs + "How do you want to practice?" ----------
  const PMODES = [
    ["chart", "Fill in the chart", "Write every box from memory, then check. Best for learning a new chart."],
    ["drill", "Drill forms", "One box at a time, like “genitive plural?”. Best for speed."],
    ["identify", "Identify", "See a form and parse it. Wrong answers explain why. Best practice for translating."],
  ];
  const pseg = (opts, cur, set) => h("div", { class: "seg" }, opts.map(([id, t]) => h("button", { class: cur === id ? "on" : "", onclick: () => set(id) }, t)));
  function paradigmHome() {
    const all = window.PARADIGMS, cur = O.currentChapter() || 0;
    const chs = [...new Set(all.map((p) => O.pChapter(p.id)).filter(Boolean))];
    // Your chapter and the ones before it first (newest first), then later ones.
    const order = chs.filter((n) => n <= cur).sort((a, b) => b - a).concat(chs.filter((n) => n > cur).sort((a, b) => a - b));
    if (st.pScope == null || (typeof st.pScope === "number" && !chs.includes(st.pScope))) st.pScope = order[0] ?? "all";
    const scope = st.pScope;
    // Your chapter and the three before it as chips; the rest in a menu.
    const recent = order.slice(0, 4);
    if (typeof scope === "number" && !recent.includes(scope)) recent.push(scope);
    const more = order.filter((n) => !recent.includes(n));
    const ids = scope === "pick" ? (st.pPicked || []) : scope === "all" ? all.map((p) => p.id) : all.filter((p) => O.pChapter(p.id) === scope).map((p) => p.id);
    const ps = ids.map(O.pById).filter(Boolean);
    const done = ps.filter((p) => O.data.pDone[p.id]).length;
    const cats = [...new Set(ps.map((p) => p.category))];
    const title = scope === "pick" ? `${ps.length} picked chart${ps.length === 1 ? "" : "s"}` : scope === "all" ? "All charts" : `Chapter ${scope}` + (cats.length === 1 ? " · " + cats[0] : "");
    const mode = S.paradigmMode || "chart";
    const chip = (k, label) => h("button", { class: "chip" + (scope === k ? " on" : ""), onclick: () => { st.pScope = k; st.pPreview = null; render(); } }, label);
    const choice = ([k, t, d]) => h("button", { class: "card how" + (mode === k ? " on" : ""), role: "radio", "aria-checked": mode === k ? "true" : "false", onclick: () => { O.set("paradigmMode", k); render(); } },
      h("span", { class: "radio" }), h("span", null, h("b", null, t), h("span", { class: "muted small" }, k === "drill" && ps[0] ? `One box at a time, like “genitive plural of ${ps[0].lemma.split(",")[0]}?”. Best for speed.` : d)));
    const start = () => { if (ps.length) practiceParadigms(ids, typeof scope === "number" ? scope : null, typeof scope === "number" ? "Chapter " + scope : title); };
    const prev = O.pById(st.pPreview) || ps[0];
    const listRow = (p) => {
      const isPin = S.pinnedParadigms.includes(p.id), ok = !!O.data.pDone[p.id];
      return h("div", { class: "li p-li" + (prev && prev.id === p.id ? " on" : ""), onclick: () => { st.pPreview = p.id; render(); } },
        h("span", { class: "p-ck" + (ok ? " y" : ""), title: ok ? "Mastered" : "Not mastered yet" }, ok ? "✓" : ""),
        h("span", { class: "gk", style: "min-width:70px" }, p.lemma.split(",")[0]), h("span", { class: "muted small" }, p.title), h("span", { class: "spacer" }),
        h("button", { class: "icon-btn" + (isPin ? " on" : ""), title: isPin ? "Unpin" : "Pin to top", onclick: (e) => { e.stopPropagation(); togglePinParadigm(p.id); } }, pinIcon(isPin)));
    };
    const preview = prev ? h("div", { class: "card pad p-prev" },
      h("div", { class: "row", style: "margin-bottom:6px" }, h("b", { class: "gk", style: "font-size:18px" }, prev.lemma.split(",")[0]), h("span", { class: "muted small" }, prev.title), h("span", { class: "spacer" }),
        h("button", { class: "btn link", onclick: () => { st.pstack.push({ view: "ref", id: prev.id }); render(); } }, "Open →")),
      h("div", { class: "scroll-x" }, h("table", { class: "ref t-mini" },
        h("tr", null, h("th", null, ""), prev.columns.map((c) => h("th", null, c))),
        prev.rows.map((rl, r) => h("tr", null, h("td", { class: "rl" }, rl), prev.columns.map((_, c) => { const parts = O.pSplit(prev, r, c); return h("td", null, parts.stem, h("span", { class: "end" }, parts.ending)); })))))) : null;
    return {
      title: "Paradigms",
      tools: h("button", { class: "btn", onclick: () => { st.pBrowse = true; render(); } }, "🔍 All charts"),
      body: h("div", { class: "p-wrap" },
        h("div", { class: "stack" },
          h("div", { class: "chips" }, recent.map((n) => chip(n, "Chapter " + n)), chip("all", "All charts"),
            more.length ? h("select", { class: "chip-sel", "aria-label": "Other chapter", onchange: (e) => { if (e.target.value) { st.pScope = +e.target.value; st.pPreview = null; render(); } } },
              h("option", { value: "" }, "Other chapter"), more.slice().sort((a, b) => a - b).map((n) => h("option", { value: n }, "Chapter " + n))) : null,
            scope === "pick" ? h("button", { class: "chip on", onclick: () => pickCharts() }, "✓ " + title) : null,
            h("button", { class: "chip new", onclick: () => pickCharts() }, "☑ Pick charts…")),
          h("div", { class: "card pad" }, h("div", { class: "row" }, h("b", { style: "font-size:17px" }, `${title} · ${ps.length} chart${ps.length === 1 ? "" : "s"}`), h("span", { class: "spacer" }),
            h("span", { class: "badge ok" }, done + " mastered")), h("div", { class: "hbar", style: "margin-top:10px" }, h("i", { style: `width:${ps.length ? Math.round((done / ps.length) * 100) : 0}%` })),
            h("div", { class: "muted small", style: "margin-top:6px" }, "A chart is mastered when you fill it in all right once.")),
          h("div", { class: "label", style: "margin:4px 0 0" }, "How do you want to practice?"),
          h("div", { class: "stack", role: "radiogroup", style: "gap:10px" }, PMODES.map(choice)),
          h("div", { class: "row wrap" },
            mode !== "identify" ? h("div", { class: "row", style: "gap:8px" }, h("span", { class: "muted" }, "Answer with"), pseg([[false, "Whole form"], [true, "Endings only"]], S.paradigmEndings, (v) => { O.set("paradigmEndings", v); render(); })) : null,
            h("span", { class: "spacer" }),
            h("button", { class: "btn pri big", disabled: !ps.length || null, onclick: start }, ps.length ? `Start · ${ps.length} chart${ps.length === 1 ? "" : "s"}` : "Pick some charts"))),
        h("div", { class: "stack" },
          h("div", { class: "card list" }, h("div", { class: "li", style: "cursor:default" }, h("b", null, scope === "all" ? "Every chart" : "Charts in " + (typeof scope === "number" ? "Chapter " + scope : "your pick")), h("span", { class: "spacer" }), h("span", { class: "muted small" }, "tap to preview")),
            ps.map(listRow)),
          preview)),
    };
  }
  // Choose exactly which charts to practice.
  function pickCharts() {
    let picked = new Set(st.pScope === "pick" ? st.pPicked || [] : typeof st.pScope === "number" ? window.PARADIGMS.filter((p) => O.pChapter(p.id) === st.pScope).map((p) => p.id) : []);
    openModal(() => h("div", { class: sheetClass() },
      h("div", { class: "body stack" },
        h("div", { style: "font-size:22px;font-weight:700" }, "Pick charts"),
        h("div", { class: "muted" }, "Choose exactly the charts you want to practice together."),
        O.pCategories().map((cat) => {
          const items = window.PARADIGMS.filter((p) => p.category === cat), allOn = items.every((p) => picked.has(p.id));
          return [h("div", { class: "sec-h" }, cat, h("span", { class: "spacer" }), h("button", { class: "btn link", onclick: () => { items.forEach((p) => (allOn ? picked.delete(p.id) : picked.add(p.id))); render(); } }, allOn ? "None" : "All")),
            h("div", { class: "list" }, items.map((p) => h("div", { class: "li", onclick: () => { picked.has(p.id) ? picked.delete(p.id) : picked.add(p.id); render(); } },
              h("span", { style: "font-size:18px;color:" + (picked.has(p.id) ? "var(--accent)" : "var(--muted)") }, picked.has(p.id) ? "●" : "○"),
              h("span", { class: "gk", style: "min-width:80px" }, p.lemma.split(",")[0]), h("span", { class: "muted small" }, p.title), h("span", { class: "spacer" }),
              O.pChapter(p.id) ? h("span", { class: "muted small" }, "Chap. " + O.pChapter(p.id)) : null)))];
        })),
      h("div", { class: "foot" },
        h("button", { class: "btn", onclick: closeModal }, "Cancel"),
        h("button", { class: "btn pri", disabled: !picked.size || null, onclick: () => { st.pPicked = window.PARADIGMS.map((p) => p.id).filter((id) => picked.has(id)); st.pScope = "pick"; st.pPreview = null; closeModal(); } },
          picked.size ? `Use ${picked.size} chart${picked.size === 1 ? "" : "s"}` : "Pick some charts"))));
  }

  function viewParadigms() {
    const top = st.pstack[st.pstack.length - 1];
    if (top && top.view === "ref") return paradigmReference(O.pById(top.id));
    if (top && top.view === "practice") return paradigmPractice(top.ids.map(O.pById));
    if (!st.pBrowse) return paradigmHome();
    const pinned = S.pinnedParadigms.map(O.pById).filter(Boolean);
    const row = (p) => {
      const isPin = S.pinnedParadigms.includes(p.id), on = pSelected.includes(p.id), ch = O.pChapter(p.id);
      return h("div", { class: "li" + (isPin ? " pinned" : ""), onclick: () => {
          if (pSelecting) { pSelected = on ? pSelected.filter((x) => x !== p.id) : pSelected.concat(p.id); render(); }
          else { st.pstack.push(st.paradigmPractice ? { view: "practice", ids: [p.id] } : { view: "ref", id: p.id }); render(); }
        } },
        pSelecting ? h("span", { style: "font-size:18px;color:" + (on ? "var(--accent)" : "var(--muted)") }, on ? "●" : "○")
          : h("button", { class: "icon-btn" + (isPin ? " on" : ""), title: isPin ? "Unpin" : "Pin to top", onclick: (e) => { e.stopPropagation(); togglePinParadigm(p.id); } }, pinIcon(isPin)),
        h("span", { class: "gk", style: "min-width:96px" }, p.lemma), h("span", { class: "muted" }, p.title), h("span", { class: "spacer" }),
        ch ? h("span", { class: "muted small" }, "Chap. " + ch) : null);
    };
    const sections = O.pCategories().map((cat) => {
      const items = window.PARADIGMS.filter((p) => p.category === cat);
      const allOn = items.every((p) => pSelected.includes(p.id));
      return [h("div", { class: "sec-h" }, cat, h("span", { class: "spacer" }),
        pSelecting ? h("button", { class: "btn link", onclick: () => { pSelected = allOn ? pSelected.filter((id) => !items.some((p) => p.id === id)) : [...new Set(pSelected.concat(items.map((p) => p.id)))]; render(); } }, allOn ? "Deselect" : "Select all") : null),
        h("div", { class: "list" }, items.map(row))];
    });
    const order = window.PARADIGMS.map((p) => p.id);
    return {
      title: "All charts",
      tools: [h("button", { class: "btn", onclick: () => { pSelecting = !pSelecting; pSelected = []; render(); } }, pSelecting ? "Done" : "Select"),
        h("button", { class: "btn", onclick: () => { st.pBrowse = false; pSelecting = false; render(); } }, "‹ By chapter")],
      body: h("div", null,
        h("div", { class: "muted small" }, st.paradigmPractice ? "Tap a chart to practice it, or tap Select to practice several together." : "Tap a chart to view it. To practice, open it and tap Practice, or tap Select to practice several together."),
        pinned.length ? [h("div", { class: "sec-h" }, "📌 Pinned"), h("div", { class: "list" }, pinned.map(row))] : null,
        sections,
        pSelecting ? h("div", { class: "card pad row", style: "position:sticky;bottom:12px;margin-top:16px" },
          h("span", { class: "muted" }, pSelected.length ? `${pSelected.length} chart${pSelected.length === 1 ? "" : "s"} selected` : "Tap charts to practice together"), h("span", { class: "spacer" }),
          h("button", { class: "btn pri", disabled: !pSelected.length, onclick: () => { const ids = pSelected.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b)); pSelecting = false; pSelected = []; st.pstack.push({ view: "practice", ids }); render(); } }, "▶ Practice")) : null),
    };
  }
  const togglePinParadigm = (id) => {
    const list = S.pinnedParadigms.slice(), i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    O.set("pinnedParadigms", list); render();
  };
  const backBtn = () => h("button", { class: "btn", onclick: () => { st.pstack.pop(); render(); } }, "‹ Back");

  function paradigmReference(p) {
    const ch = O.pChapter(p.id), isPin = S.pinnedParadigms.includes(p.id);
    const cell = (r, c) => {
      const parts = O.pSplit(p, r, c), others = p.cells[r][c].split("/").slice(1).map((x) => x.trim());
      return h("td", null, parts.stem, h("span", { class: S.highlightEndings ? "end" : "" }, parts.ending),
        others.length ? h("span", { class: "muted" }, " / " + others.join(" / ")) : null);
    };
    return {
      title: p.lemma,
      tools: [h("button", { class: "icon-btn" + (isPin ? " on" : ""), title: isPin ? "Unpin" : "Pin to top", onclick: () => togglePinParadigm(p.id) }, pinIcon(isPin)), backBtn()],
      body: h("div", { class: "stack center" },
        h("div", null, h("div", { class: "greek", style: "font-size:32px" }, p.lemma), h("div", { class: "muted" }, p.title),
          h("div", { class: "muted small" }, p.category + (ch ? " · Chap. " + ch : ""))),
        h("div", { class: "scroll-x" }, h("table", { class: "ref" },
          h("tr", null, h("th"), p.columns.map((c) => h("th", null, c))),
          p.rows.map((rl, r) => h("tr", null, h("td", { class: "rl" }, rl), p.columns.map((_, c) => cell(r, c)))))),
        h("div", { class: "row", style: "justify-content:center" },
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: S.highlightEndings, onchange: (e) => { O.set("highlightEndings", e.target.checked); render(); } }), "Highlight endings"),
          h("label", { class: "check" }, "Chapter",
            h("select", { onchange: (e) => { const m = { ...S.paradigmChapters }; m[p.id] = +e.target.value; O.set("paradigmChapters", m); render(); } },
              h("option", { value: 0, selected: !ch }, "None"), Array.from({ length: 30 }, (_, i) => h("option", { value: i + 1, selected: ch === i + 1 }, "Chap. " + (i + 1)))))),
        h("button", { class: "btn pri big", style: "margin:0 auto", onclick: () => { st.pstack.push({ view: "practice", ids: [p.id] }); render(); } }, "▶ Practice this chart")),
    };
  }

  const pState = {};   // practice state, keyed by chart set + mode
  function paradigmPractice(ps) {
    const key = ps.map((p) => p.id).join(",") + "|" + S.paradigmMode + "|" + S.paradigmEndings + "|" + S.paradigmAccents;
    const ps_ = (pState[key] = pState[key] || {});
    const seg = (opts, cur, set) => h("div", { class: "seg" }, opts.map(([id, t]) => h("button", { class: cur === id ? "on" : "", onclick: () => set(id) }, t)));
    const header = ps.length === 1
      ? h("div", { class: "center" }, h("div", { class: "greek", style: "font-size:30px" }, ps[0].lemma), h("div", { class: "muted" }, ps[0].title))
      : h("div", { class: "center" }, h("b", null, `Practicing ${ps.length} charts together`), h("div", { class: "chips", style: "justify-content:center;margin-top:6px" }, ps.map((p) => h("span", { class: "pill" }, O.pLabel(p)))));
    const controls = h("div", { class: "row wrap", style: "justify-content:center" },
      seg([["chart", "Chart"], ["drill", "Drill"], ["identify", "Identify"]], S.paradigmMode, (id) => { O.set("paradigmMode", id); render(); }),
      S.paradigmMode !== "identify" ? seg([[false, "Whole form"], [true, "Endings only"]], S.paradigmEndings, (v) => { O.set("paradigmEndings", v); render(); }) : null,
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: S.paradigmAccents, onchange: (e) => { O.set("paradigmAccents", e.target.checked); render(); } }), "Require accents"));
    const body = S.paradigmMode === "chart" ? chartFill(ps, ps_) : S.paradigmMode === "drill" ? formDrill(ps, ps_) : identifyDrill(ps, ps_);
    return { title: ps.length === 1 ? ps[0].lemma : ps.length + " charts", tools: backBtn(),
      body: h("div", { class: "stack" }, header, controls, h("div", { class: "stack" + ap("pbody", key + "|" + (ps_.index || 0)) }, body)) };
  }

  const allSlots = (ps) => O.shuffle(ps.flatMap((p, pi) => p.rows.flatMap((_, r) => p.columns.map((_, c) => [pi, r, c]))));

  function chartFill(ps, s) {
    s.index = s.index || 0;
    const p = ps[s.index];
    s.entries = s.entries || {};
    const E = (s.entries[p.id] = s.entries[p.id] || p.cells.map((row) => row.map(() => "")));
    const ends = S.paradigmEndings, acc = S.paradigmAccents;
    const ok = (r, c) => O.pCheck(p, E[r][c], r, c, ends, acc);
    s.checked = s.checked || {};
    const checked = s.checked[p.id];
    const total = p.rows.length * p.columns.length;
    let right = 0; p.rows.forEach((_, r) => p.columns.forEach((_, c) => { if (ok(r, c)) right++; }));
    const table = h("table", { class: "chart" + (ends ? " ends" : "") },
      h("tr", null, h("th"), p.columns.map((c) => h("th", null, c))),
      p.rows.map((rl, r) => h("tr", null, h("td", { class: "rl" }, rl), p.columns.map((_, c) => {
        const parts = O.pSplit(p, r, c), good = checked && ok(r, c), bad = checked && !ok(r, c);
        const input = greekInput("", "");
        input.value = E[r][c];
        input.readOnly = good;
        input.addEventListener("input", () => { E[r][c] = input.value; });
        return h("td", { class: "cell" + (good ? " ok" : bad ? " bad" : "") },
          h("div", { class: "row", style: "gap:2px" }, ends && parts.stem ? h("span", { class: "stem" }, parts.stem) : null, input),
          bad ? h("div", { class: "fix" }, ends ? parts.ending : p.cells[r][c]) : null);
      }))));
    const pager = ps.length > 1 ? h("div", { class: "row" },
      h("button", { class: "btn", disabled: s.index === 0, onclick: () => { s.index--; render(); } }, "‹ Previous"), h("span", { class: "spacer" }),
      h("div", { class: "center" }, h("b", null, O.pLabel(p)), h("div", { class: "muted small" }, `Chart ${s.index + 1} of ${ps.length}`)), h("span", { class: "spacer" }),
      h("button", { class: "btn", disabled: s.index >= ps.length - 1, onclick: () => { s.index++; render(); } }, "Next ›")) : null;
    const check = () => {
      s.checked[p.id] = true;
      let all = true; p.rows.forEach((_, r) => p.columns.forEach((_, c) => { if (!ok(r, c)) all = false; }));
      if (all) { O.data.pDone[p.id] = true; O.save(); }
      render();
    };
    st.keys = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !checked) check(); };
    return [pager, h("div", { class: "scroll-x" }, table),
      h("div", { class: "row" },
        checked ? [h("b", { style: right === total ? "color:var(--ok)" : "" }, right === total ? `All ${total} right!` : `${right} of ${total} right`), h("span", { class: "spacer" }),
          right < total ? h("button", { class: "btn pri", onclick: () => { p.rows.forEach((_, r) => p.columns.forEach((_, c) => { if (!ok(r, c)) E[r][c] = ""; })); s.checked[p.id] = false; render(); } }, "Try the missed ones") : null,
          h("button", { class: "btn", onclick: () => { s.entries[p.id] = null; s.checked[p.id] = false; render(); } }, "Start over")]
          : [h("span", { class: "muted small" }, `Fill in every ${ends ? "ending" : "box"}, then check. Accents are ${acc ? "required" : "optional"}.`), h("span", { class: "spacer" }),
             h("button", { class: "btn pri", onclick: check }, "Check chart")]),
      h("div", { class: "hint keys" }, "Ctrl/⌘ + Return checks the chart. Type Greek on your keyboard: l-o-g-o-s → λογος")];
  }

  function formDrill(ps, s) {
    if (!s.queue) { s.queue = allSlots(ps); s.right = 0; s.answered = 0; }
    if (!s.queue.length) {
      if (s.answered && s.right === s.answered && !s.marked) { s.marked = true; ps.forEach((p) => { O.data.pDone[p.id] = true; }); O.save(); }
      st.keys = (e) => { if (e.key === "Enter") { s.queue = null; render(); } };
      return h("div", { class: "stack center", style: "margin-top:30px" }, h("div", { style: "font-size:24px;font-weight:700" }, "Every form right!"),
        h("div", { class: "muted" }, `${s.right} of ${s.answered} right on the first try.`),
        h("div", { class: "row", style: "justify-content:center" }, h("button", { class: "btn", onclick: () => { s.queue = null; render(); } }, "Go again"), h("button", { class: "btn pri", onclick: () => { st.pstack.pop(); render(); } }, "Done")));
    }
    const [pi, r, c] = s.queue[0], p = ps[pi], ends = S.paradigmEndings;
    const stem = ends ? O.pSplit(p, r, c).stem : "";
    const input = greekInput("answer-input gk", ends ? "Ending" : "Type the form");
    input.value = s.text || ""; input.readOnly = s.result !== undefined; input.setAttribute("data-autofocus", "");
    if (ends) input.style.width = "180px";
    input.addEventListener("input", () => { s.text = input.value; });
    const next = () => { const slot = s.queue.shift(); if (!s.result) s.queue.splice(Math.min(3, s.queue.length), 0, slot); s.text = ""; s.result = undefined; render(); };
    const submit = () => {
      if (s.result !== undefined) return next();
      if (!O.trim(s.text)) return;
      s.result = O.pCheck(p, s.text, r, c, ends, S.paradigmAccents); s.answered++; if (s.result) s.right++; render();
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submit(); } });
    st.keys = (e, typing) => { if (!typing && e.key === "Enter" && s.result !== undefined) next(); };
    return [h("div", { class: "muted small center" }, `${s.queue.length} left · ${s.right} of ${s.answered} right`),
      ps.length > 1 ? h("div", { class: "center", style: "color:var(--accent);font-weight:700" }, O.pLabel(p)) : null,
      h("div", { class: "center", style: "font-size:22px;font-weight:600" }, `${p.rows[r]} · ${p.columns[c]}`),
      h("div", { class: "row", style: "justify-content:center;gap:4px" }, stem ? h("span", { class: "greek", style: "font-size:26px" }, stem) : null, input),
      s.result !== undefined ? feedback(s.result, p.cells[r][c], true) : null,
      s.result === undefined
        ? h("div", { class: "row", style: "max-width:420px;margin:0 auto;width:100%" }, h("button", { class: "btn", onclick: () => { s.result = false; s.answered++; render(); } }, "Show answer"), h("span", { class: "spacer" }), h("button", { class: "btn pri", onclick: submit }, "Check"))
        : h("button", { class: "btn pri big", style: "margin:0 auto;min-width:200px", onclick: next }, "Continue"),
      h("div", { class: "hint keys center" }, "Return checks, then Return again to continue")];
  }

  function identifyDrill(ps, s) {
    if (!s.queue) { s.queue = allSlots(ps); s.right = 0; s.answered = 0; s.pick = { p: ps.length === 1 ? 0 : null, r: null, c: null }; }
    if (!s.queue.length) {
      return h("div", { class: "stack center", style: "margin-top:30px" }, h("div", { style: "font-size:24px;font-weight:700" }, "You identified every form!"),
        h("div", { class: "muted" }, `${s.right} of ${s.answered} right on the first try.`),
        h("div", { class: "row", style: "justify-content:center" }, h("button", { class: "btn", onclick: () => { s.queue = null; render(); } }, "Go again"), h("button", { class: "btn pri", onclick: () => { st.pstack.pop(); render(); } }, "Done")));
    }
    const [pi, r, c] = s.queue[0];
    const shown = O.pDisplay(ps[pi].cells[r][c]);
    const form = O.pNormalize(shown, true);
    const matches = [];
    ps.forEach((p, a) => p.rows.forEach((_, b) => p.columns.forEach((_, d) => { if (O.pVariants(p.cells[b][d]).some((v) => O.pNormalize(v, true) === form)) matches.push([a, b, d]); })));
    const describe = ([a, b, d]) => (ps.length > 1 ? O.pLabel(ps[a]) + ", " : "") + ps[a].rows[b] + " " + ps[a].columns[d].toLowerCase();
    const pk = s.pick, chart = ps[pk.p ?? pi];
    const chips = (labels, cur, set) => h("div", { class: "chips", style: "justify-content:center" }, labels.map((l, i) =>
      h("button", { class: "chip" + (cur === i ? " on" : ""), disabled: s.result !== undefined, onclick: () => { set(i); render(); } }, l)));
    const check = () => {
      if (pk.p == null || pk.r == null || pk.c == null) return;
      s.result = matches.some(([a, b, d]) => a === pk.p && b === pk.r && d === pk.c); s.answered++; if (s.result) s.right++; render();
    };
    const next = () => { const slot = s.queue.shift(); if (!s.result) s.queue.splice(Math.min(3, s.queue.length), 0, slot); s.result = undefined; s.pick = { p: ps.length === 1 ? 0 : null, r: null, c: null }; render(); };
    st.keys = (e) => { if (e.key === "Enter") (s.result === undefined ? check : next)(); };
    return [h("div", { class: "muted small center" }, `${s.queue.length} left · ${s.right} of ${s.answered} right`),
      h("div", { class: "muted center" }, "What is this form?"), h("div", { class: "greek center", style: "font-size:44px" }, shown),
      ps.length > 1 ? chips(ps.map(O.pLabel), pk.p, (i) => { pk.p = i; pk.r = pk.c = null; }) : null,
      pk.p != null ? [chips(chart.rows, pk.r, (i) => { pk.r = i; }), chips(chart.columns, pk.c, (i) => { pk.c = i; })] : null,
      s.result !== undefined ? h("div", { class: "center" + ap("idres", s.answered), style: `font-weight:700;color:var(--${s.result ? "ok" : "bad"})` }, (s.result ? "✓ Correct: " : "✕ It's ") + matches.map(describe).join(" or ")) : null,
      s.result === false ? identifyWhy(ps, pk, matches, shown) : null,
      s.result === undefined ? h("button", { class: "btn pri big", style: "margin:0 auto;min-width:200px", disabled: pk.p == null || pk.r == null || pk.c == null, onclick: check }, "Check")
        : h("button", { class: "btn pri big", style: "margin:0 auto;min-width:200px", onclick: next }, "Continue")];
  }

  // Identify: why your box was wrong, with your choice (gold) and the right box (green) marked.
  function identifyWhy(ps, pk, matches, shown) {
    const chart = ps[pk.p];
    if (!chart || pk.r == null || pk.c == null) return null;
    const yours = O.pDisplay(chart.cells[pk.r][pk.c]);
    const inChart = matches.filter(([a]) => a === pk.p);
    const rowOk = inChart.some(([, b]) => b === pk.r), colOk = inChart.some(([, , d]) => d === pk.c);
    const lines = [h("div", null, "The box you picked is ", h("b", { class: "greek" }, yours), ". Compare its ending with ", h("span", { class: "greek" }, shown), ".")];
    // Wrong chart: show the chart the form really comes from.
    const other = !inChart.length && matches.length ? ps[matches[0][0]] : null;
    if (other) lines.push(h("div", null, "It isn't in the ", h("span", { class: "greek" }, chart.lemma.split(",")[0]), " chart at all. Look at the stem: it's ", h("span", { class: "greek" }, other.lemma.split(",")[0]), "."));
    const showChart = other || chart, marks = other ? matches.filter(([a]) => a === matches[0][0]) : inChart;
    if (rowOk && !colOk) lines.push(h("div", null, `${chart.rows[pk.r]} is right; the column isn't.`));
    if (colOk && !rowOk) lines.push(h("div", null, `${chart.columns[pk.c]} is right; the row isn't.`));
    const show = S.tExplain !== false;
    return h("div", { class: "stack", style: "gap:10px;max-width:560px;margin:0 auto;width:100%" },
      show ? h("div", { class: "t-fb" }, h("span", { class: "x" }, "✕"), h("div", { class: "stack", style: "gap:4px" }, lines)) : null,
      h("div", { class: "card pad" }, h("div", { class: "row", style: "margin-bottom:6px" }, h("b", { class: "greek" }, showChart.lemma.split(",")[0]), h("span", { class: "muted small" }, showChart.title), h("span", { class: "spacer" }),
        other ? null : h("span", { class: "small t-youk", style: "font-weight:700" }, "Your choice"), h("span", { class: "small t-hitk", style: "font-weight:700;margin-left:8px" }, "Right box")),
        h("div", { class: "scroll-x" }, h("table", { class: "ref t-mini" },
          h("tr", null, h("th", null, ""), showChart.columns.map((c) => h("th", null, c))),
          showChart.rows.map((rl, r) => h("tr", null, h("td", { class: "rl" }, rl), showChart.columns.map((_, c) => {
            const hit = marks.some(([, b, d]) => b === r && d === c), you = !other && r === pk.r && c === pk.c;
            return h("td", { class: hit ? "t-hit" : you ? "t-you" : "" }, O.pDisplay(showChart.cells[r][c]));
          })))))));
  }

  // ---------- Add Words ----------
  const imp = { text: "", deck: "My Words", chapter: null, excluded: new Set(), presetName: "My Words" };
  function viewAdd() {
    const dyn = h("div", { class: "stack" });
    const parsedAll = () => O.parseList(imp.text, O.trim(imp.deck) || "My Words", imp.chapter);
    const drawDyn = () => {
      const all = parsedAll();
      const found = [...new Set(all.map((c) => c.chapter).filter((c) => c != null))].sort((a, b) => a - b);
      imp.excluded = new Set([...imp.excluded].filter((n) => found.includes(n)));
      const ready = all.filter((c) => c.chapter == null || !imp.excluded.has(c.chapter));
      const counts = {}; all.forEach((c) => { if (c.chapter != null) counts[c.chapter] = (counts[c.chapter] || 0) + 1; });
      dyn.replaceChildren(
        found.length > 1 ? h("div", { class: "card pad" }, h("div", { class: "label", style: "margin-top:0" }, "Chapters to add"),
          h("div", { class: "chips" }, found.map((n) => h("button", { class: "chip" + (!imp.excluded.has(n) ? " on" : ""), onclick: () => { imp.excluded.has(n) ? imp.excluded.delete(n) : imp.excluded.add(n); drawDyn(); } }, "Ch. " + n, h("small", null, counts[n])))),
          h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn link", onclick: () => { imp.excluded = new Set(); drawDyn(); } }, "Select all"), h("button", { class: "btn link", onclick: () => { imp.excluded = new Set(found); drawDyn(); } }, "Select none"),
            h("span", { class: "spacer" }), h("span", { class: "muted small" }, `${found.length - imp.excluded.size} of ${found.length} chapters selected`))) : null,
        h("div", { class: "row wrap" },
          h("button", { class: "btn pri", disabled: !ready.length, onclick: () => {
            const n = O.addCards(ready, S.groupByChapter), chs = new Set(ready.map((c) => c.chapter).filter((c) => c != null)).size;
            st.msg = `Added ${n} word${n === 1 ? "" : "s"}` + (S.groupByChapter && chs && n ? ` into ${chs} chapter group${chs === 1 ? "" : "s"}` : "") + (ready.length - n ? `. Skipped ${ready.length - n} already in your list.` : ".");
            render(); } }, `+ Add ${ready.length} word${ready.length === 1 ? "" : "s"}`),
          h("button", { class: "btn", disabled: !all.length, onclick: () => { O.savePreset(O.trim(imp.deck) || "My Words", imp.text); st.msg = `Saved “${O.trim(imp.deck) || "My Words"}” to your presets.`; render(); } }, "Save this list as a preset")),
        st.msg ? h("div", { class: "muted" }, st.msg) : null);
    };
    const textarea = h("textarea", { placeholder: "Chapter 1\n- λόγος, ὁ — word, message\n…or one per line: λόγος, -ου, ὁ | word | 1", oninput: (e) => { imp.text = e.target.value; drawDyn(); } });
    textarea.value = imp.text;
    const file = h("input", { type: "file", accept: ".txt,.csv,.tsv,text/plain", style: "display:none", onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      imp.text = await f.text(); imp.deck = f.name.replace(/\.[^.]+$/, ""); imp.excluded = new Set();
      st.msg = `Loaded ${f.name}. Pick your chapters, then tap Add.`; render(); } });
    drawDyn();
    const download = () => {
      const name = (O.trim(imp.presetName) || "My Words") + ".txt";
      const a = h("a", { href: URL.createObjectURL(new Blob([O.exportText()], { type: "text/plain" })), download: name });
      document.body.append(a); a.click(); a.remove();
      st.msg = "Exported your words to " + name + "."; render();
    };
    return {
      title: "Add Words", tools: h("button", { class: "btn", onclick: () => go("vocab") }, "← Vocabulary"),
      body: h("div", { class: "stack" },
        O.data.cards.length ? h("div", { class: "card pad stack" }, h("b", null, `Your words (${O.data.cards.length})`),
          h("div", { class: "row wrap" }, h("input", { type: "text", value: imp.presetName, placeholder: "Preset name", oninput: (e) => { imp.presetName = e.target.value; } }),
            h("button", { class: "btn", onclick: () => { const n = O.trim(imp.presetName) || "My Words"; O.savePreset(n, O.exportText()); st.msg = `Saved all ${O.data.cards.length} of your words as the preset “${n}”.`; render(); } }, "Save all my words as a preset"),
            h("button", { class: "btn", onclick: download }, "Export to a file")),
          h("div", { class: "muted small" }, "A preset keeps a copy of your list in this browser so you can reload chapters anytime. Export saves a text file you can load on another device.")) : null,
        O.data.presets.length ? [h("div", { class: "sec-h" }, "Your presets"), h("div", { class: "list" }, O.data.presets.map((p) =>
          h("div", { class: "li", onclick: () => { imp.text = p.text; imp.deck = p.name; imp.excluded = new Set(); st.msg = `Loaded “${p.name}”. Pick your chapters, then tap Add.`; render(); } },
            "📚 " + p.name, h("span", { class: "spacer" }), h("span", { class: "muted small" }, O.parseList(p.text, p.name, null).length + " words"),
            h("button", { class: "icon-btn", title: "Delete preset", onclick: (e) => { e.stopPropagation(); if (confirm(`Delete the preset “${p.name}”?`)) { O.deletePreset(p.id); render(); } } }, icon("x")))))] : null,
        h("div", { class: "muted" }, "Paste or load a word list. Ostraka understands Greek | English | chapter lines, and lists with Chapter 1 headings and lines like - λόγος, ὁ — word."),
        textarea,
        h("div", { class: "row wrap" }, h("button", { class: "btn", onclick: () => file.click() }, "Load a text file…"), file,
          h("input", { type: "text", value: imp.deck, placeholder: "List name", oninput: (e) => { imp.deck = e.target.value; } }),
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: S.groupByChapter, onchange: (e) => O.set("groupByChapter", e.target.checked) }), "Make a group for each chapter"),
          h("label", { class: "check" }, "Chapter for lines without one",
            h("select", { onchange: (e) => { imp.chapter = e.target.value ? +e.target.value : null; drawDyn(); } }, h("option", { value: "" }, "None"),
              Array.from({ length: 40 }, (_, i) => h("option", { value: i + 1, selected: imp.chapter === i + 1 }, "Chapter " + (i + 1)))))),
        dyn),
    };
  }

  // ---------- Settings ----------
  function viewSettings() {
    return {
      title: "Settings",
      body: h("div", { class: "stack" },
        h("div", { class: "card pad stack" }, h("b", null, "You"),
          h("label", { class: "row" }, "Your name", h("span", { class: "spacer" }),
            h("input", { type: "text", value: S.userName || "", placeholder: "For the greeting on Home", style: "width:220px", onchange: (e) => { O.set("userName", O.trim(e.target.value).slice(0, 40)); render(); } }))),
        h("div", { class: "card pad stack" }, h("b", null, "Daily Review"),
          h("label", { class: "row" }, "New words per day", h("span", { class: "spacer" }),
            h("input", { type: "number", min: 5, max: 100, step: 5, value: S.newPerDay, style: "width:90px", onchange: (e) => { O.set("newPerDay", Math.max(1, +e.target.value || 15)); render(); } }))),
        h("div", { class: "card pad stack" }, h("b", null, "Library"),
          h("div", { class: "row" }, "Words", h("span", { class: "spacer" }), h("span", { class: "muted" }, O.data.cards.length)),
          h("div", { class: "row" }, "Groups", h("span", { class: "spacer" }), h("span", { class: "muted" }, O.data.groups.length)),
          h("div", { class: "row" }, "Reviewed at least once", h("span", { class: "spacer" }), h("span", { class: "muted" }, Object.keys(O.data.progress).length))),
        h("div", { class: "card pad stack" }, h("b", null, "About"),
          h("div", { class: "row" }, "Version", h("span", { class: "spacer" }), h("span", { class: "muted" }, "Ostraka Web 18")),
          h("div", { class: "muted small" }, "Your words and progress are saved in this browser on this computer."),
          h("div", { class: "muted small" }, "Translate uses the SBL Greek New Testament (SBLGNT, Society of Biblical Literature and Logos Bible Software) with MorphGNT parsing (CC BY-SA), glosses from the Dodson Greek Lexicon (public domain), and the Montserrat font (SIL Open Font License). Practice sentences by Prof. Andrew Swygard, used with permission."),
          h("button", { class: "btn", onclick: () => { O.set("hasSeenWelcome", false); render(); } }, "Show the welcome guide again")),
        h("div", { class: "card pad stack" },
          h("button", { class: "btn red", onclick: () => { if (confirm("Reset all progress? Your words, chapters and groups stay.")) { O.resetProgress(); render(); } } }, "Reset all progress"),
          h("div", { class: "muted small" }, "Clears your Daily Review schedule and Study Session progress. Your words, chapters and groups stay."))),
    };
  }

  window.OUI = { h, icon, svg, render, openModal, closeModal, sheetClass, ap, st, go, greekInput };
  window.OT.init();
  render();
})();
