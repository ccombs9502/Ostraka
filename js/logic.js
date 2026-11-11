// Ostraka web: data, answer checking, scheduling and study engines.
// Plain script (no modules) so index.html works by double-clicking it.
(function () {
  "use strict";
  const O = (window.O = {});

  // ---------- Text helpers ----------
  O.trim = (s) => (s || "").trim();
  O.fold = (s) =>
    (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ς/g, "σ");
  O.foldGreek = (s) => O.fold(s).replace(/[^\p{L}]/gu, "");
  O.uid = (p) => p + "-" + Math.random().toString(36).slice(2) + Date.now().toString(36);

  O.levenshtein = (a, b) => {
    const x = [...a], y = [...b];
    if (!x.length) return y.length;
    if (!y.length) return x.length;
    let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
    for (let i = 1; i <= x.length; i++) {
      const cur = [i];
      for (let j = 1; j <= y.length; j++)
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[y.length];
  };

  // ---------- Answer checking (forgiving on purpose) ----------
  const normalizeEnglish = (s) => {
    let t = (s || "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9' ]/g, " ");
    const words = t.split(/\s+/).filter(Boolean);
    const fillers = new Set(["i", "to", "the", "a", "an"]);
    while (words.length > 1 && fillers.has(words[0])) words.shift();
    return words.join(" ");
  };
  const englishOptions = (gloss) =>
    (gloss || "").replace(/\([^)]*\)/g, " ").split(/[,;/!?]/).map(normalizeEnglish).filter(Boolean);

  O.checkEnglish = (answer, gloss) => {
    const a = normalizeEnglish(answer);
    if (!a) return false;
    return englishOptions(gloss).some((o) => {
      if (a === o) return true;
      const tol = o.length >= 8 ? 2 : o.length >= 4 ? 1 : 0;
      return tol > 0 && O.levenshtein(a, o) <= tol;
    });
  };

  const greekOptions = (greek) => {
    const articles = new Set(["ο", "η", "το"]);
    const parts = (greek || "").replace(/\([^)]*\)/g, " ").split(",").map((p) => p.trim());
    if (!parts.length) return [];
    const firstIsArticle = articles.has(O.foldGreek(parts[0]));
    const out = [];
    parts.forEach((p, i) => {
      if (p.startsWith("-")) return;
      const f = O.foldGreek(p);
      if (!f) return;
      if (i > 0 && articles.has(f) && !firstIsArticle) return;
      out.push(f);
    });
    return out;
  };

  O.checkGreek = (answer, greek) => {
    const a = O.foldGreek(answer);
    if (!a) return false;
    return greekOptions(greek).some((o) => a === o || (o.length >= 5 && O.levenshtein(a, o) <= 1));
  };

  // ---------- Typing Greek on a regular keyboard (Greek layout) ----------
  // Sound-alike layout used by most Bible software (Accordance/BibleWorks style):
  // h = η, q = θ, c = ξ, u = υ, f = φ, x = χ, y = ψ, w = ω. σ turns into ς at word ends.
  O.greekMap = {
    a: "α", b: "β", g: "γ", d: "δ", e: "ε", z: "ζ", h: "η", q: "θ", i: "ι", k: "κ", l: "λ", m: "μ",
    n: "ν", c: "ξ", o: "ο", p: "π", r: "ρ", s: "σ", t: "τ", u: "υ", f: "φ", x: "χ", y: "ψ", w: "ω",
  };
  O.latinKey = (g) => Object.keys(O.greekMap).find((k) => O.greekMap[k] === g) || "";
  O.toGreek = (s) => {
    const chars = [...(s || "")].flatMap((ch) => {
      const l = ch.toLowerCase();
      if (l === "j" || l === "v") return [];
      return [O.greekMap[l] || ch];
    });
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === "σ" || chars[i] === "ς") {
        const next = chars[i + 1];
        chars[i] = !next || !/\p{L}/u.test(next) ? "ς" : "σ";
      }
    }
    return chars.join("");
  };

  // ---------- Parsing pasted word lists ----------
  O.chapterHeading = (line) => {
    const lower = line.toLowerCase();
    const prefix = ["chapter", "ch.", "ch "].find((p) => lower.startsWith(p));
    if (!prefix) return null;
    const rest = lower.slice(prefix.length).trim();
    const m = rest.match(/^(\d+)/);
    if (!m) return null;
    const after = rest.slice(m[1].length).replace(/[\s.:;,!?\-–—]/g, "");
    return after ? null : parseInt(m[1], 10);
  };

  O.parseList = (text, deck, defaultChapter) => {
    let current = null;
    const out = [];
    for (const raw of (text || "").split(/\r?\n/)) {
      let line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const h = O.chapterHeading(line);
      if (h !== null) { current = h; continue; }
      for (const b of ["- ", "• ", "* "]) if (line.startsWith(b)) { line = line.slice(b.length).trim(); break; }
      let parts;
      if (line.includes("|")) parts = line.split("|").map((p) => p.trim());
      else if (line.includes("\t")) parts = line.split("\t").map((p) => p.trim());
      else {
        const m = line.match(/ (—|–|=) /);
        if (!m) continue;
        parts = [line.slice(0, m.index).trim(), line.slice(m.index + m[0].length).trim()];
      }
      if (parts.length < 2 || !parts[0] || !parts[1]) continue;
      let chapter = current ?? defaultChapter ?? null;
      let pos = "";
      if (parts.length >= 3 && parts[2]) {
        const d = parts[2].replace(/\D/g, "");
        if (d) chapter = parseInt(d, 10); else pos = parts[2];
      }
      if (parts.length >= 4 && parts[3]) pos = parts[3];
      out.push({ id: O.uid("c"), greek: parts[0], gloss: parts[1], partOfSpeech: pos, chapter, deck, isCustom: true });
    }
    return out;
  };

  // ---------- Daily Review scheduler (SM-2 style) ----------
  const DAY = 86400000;
  O.newProgress = () => ({ ease: 2.5, intervalDays: 0, reps: 0, lapses: 0, due: 0, firstReviewed: null, lastReviewed: null });
  O.review = (old, grade, now = Date.now()) => {
    const p = { ...old };
    if (grade === 1) { p.lapses++; p.reps = 0; p.ease = Math.max(1.3, p.ease - 0.2); p.intervalDays = 0; }
    else if (grade === 2) { p.ease = Math.max(1.3, p.ease - 0.15); p.intervalDays = p.reps === 0 ? 0.5 : Math.max(1, p.intervalDays * 1.2); p.reps++; }
    else if (grade === 3) { p.intervalDays = p.reps === 0 ? 1 : p.reps === 1 ? 3 : p.intervalDays * p.ease; p.reps++; }
    else { p.ease += 0.15; p.intervalDays = p.reps === 0 ? 4 : Math.max(4, p.intervalDays * p.ease * 1.3); p.reps++; }
    p.due = grade === 1 ? now + 60000 : now + p.intervalDays * DAY;
    p.lastReviewed = now;
    return p;
  };
  O.describeDue = (p, now = Date.now()) => {
    const s = Math.max(0, (p.due - now) / 1000);
    if (s < 3600) return Math.max(1, Math.floor(s / 60)) + "m";
    if (s < 86400) return Math.round(s / 3600) + "h";
    const d = s / 86400;
    return d < 31 ? Math.round(d) + "d" : (d / 30).toFixed(1) + "mo";
  };

  // ---------- Saved data ----------
  const KEY = "ostraka-data-v1";
  const defaults = () => ({
    cards: [], progress: {}, mastery: {}, groups: [], presets: [],
    pinnedScopes: [], pinnedWords: [],
    settings: {
      newPerDay: 15, direction: "greekToEnglish", studyMode: "flashcards", cramMode: "flashcards",
      boardStyle: "match", paradigmMode: "chart", paradigmAccents: false, paradigmEndings: false,
      highlightEndings: true, pinnedParadigms: [], paradigmChapters: {}, hasSeenWelcome: false,
      groupByChapter: true,
    },
  });

  // Inside the Mac/iPhone app, the page is told so by window.OSTRAKA_EMBED: data
  // comes from the app (not browser storage), saves go back to the app, and
  // the app's own vocabulary is used to check meanings.
  const EMB = window.OSTRAKA_EMBED || null;
  O.embedded = !!EMB;
  const embedCards = (list) => (list || []).map((c, i) => ({ id: "app" + i, greek: c.greek || "", gloss: c.gloss || "", chapter: c.chapter ?? null }));
  const post = (msg) => { try { window.webkit.messageHandlers.ostraka.postMessage(msg); } catch (e) {} };
  O.post = post;
  O.setCards = (list) => { if (O.data) O.data.cards = embedCards(list); };
  O.load = () => {
    let d = defaults();
    try {
      const raw = EMB ? EMB.data : localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        d = { ...d, ...saved, settings: { ...d.settings, ...(saved.settings || {}) } };
      }
    } catch (e) { O.loadError = "Couldn't read saved data in this browser."; }
    if (EMB) { d.cards = embedCards(EMB.cards); d.settings.hasSeenWelcome = true; }
    O.data = d;
  };
  O.save = () => {
    if (EMB) { post({ type: "save", json: JSON.stringify(O.data) }); return; }
    try { localStorage.setItem(KEY, JSON.stringify(O.data)); }
    catch (e) { O.loadError = "Couldn't save. Your browser may be blocking storage."; }
  };
  O.set = (k, v) => { O.data.settings[k] = v; O.save(); };

  // ---------- Word sets (scopes) ----------
  // Scope keys: "all", "c:3" (chapter), "g:<id>" (group), "missed", "pinned".
  const byChapter = (list) =>
    list.map((c, i) => [c, i]).sort((a, b) => ((a[0].chapter ?? 999) - (b[0].chapter ?? 999)) || a[1] - b[1]).map((x) => x[0]);

  O.chapters = () => [...new Set(O.data.cards.map((c) => c.chapter).filter((c) => c != null))].sort((a, b) => a - b);

  O.cardsIn = (key) => {
    const d = O.data;
    if (Array.isArray(key)) {
      const seen = new Set(), out = [];
      key.forEach((k) => O.cardsIn(k).forEach((c) => { if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } }));
      return out;
    }
    if (key === "all") return byChapter(d.cards);
    if (key === "missed") return byChapter(d.cards.filter((c) => { const m = d.mastery[c.id]; return m && m.missed >= 2 && m.strength < 0.6; }));
    if (key === "pinned") return byChapter(d.cards.filter((c) => d.pinnedWords.includes(c.id)));
    if (key.startsWith("c:")) { const n = +key.slice(2); return byChapter(d.cards.filter((c) => c.chapter === n)); }
    // "w:id1,id2": words picked one by one for this session.
    if (key.startsWith("w:")) { const ids = new Set(key.slice(2).split(",")); return byChapter(d.cards.filter((c) => ids.has(c.id))); }
    if (key.startsWith("g:")) {
      const g = d.groups.find((x) => x.id === key.slice(2));
      if (!g) return [];
      const map = new Map(d.cards.map((c) => [c.id, c]));
      return g.cardIDs.map((id) => map.get(id)).filter(Boolean);
    }
    return [];
  };

  O.scopeTitle = (key) => {
    if (Array.isArray(key)) return key.length <= 3 ? key.map(O.scopeTitle).join(" + ") : key.length + " groups";
    if (key === "all") return "All words";
    if (key === "missed") return "Missed often";
    if (key === "pinned") return "Pinned words";
    if (key.startsWith("c:")) return "Chapter " + key.slice(2);
    if (key.startsWith("w:")) { const n = key.slice(2).split(",").filter(Boolean).length; return n + (n === 1 ? " picked word" : " picked words"); }
    if (key.startsWith("g:")) return (O.data.groups.find((g) => g.id === key.slice(2)) || {}).name || "Group";
    return key;
  };

  O.scopeOptions = () => {
    const d = O.data;
    const opts = ["all"];
    if (d.pinnedWords.length) opts.push("pinned");
    const groupNames = new Set(d.groups.map((g) => O.fold(g.name)));
    let rest = O.chapters().filter((n) => !groupNames.has(O.fold("Chapter " + n))).map((n) => "c:" + n);
    rest = rest.concat(d.groups.map((g) => "g:" + g.id));
    const pinned = d.pinnedScopes.filter((k) => rest.includes(k));
    opts.push(...pinned, ...rest.filter((k) => !pinned.includes(k)));
    if (O.cardsIn("missed").length) opts.push("missed");
    return opts;
  };

  O.isPinnedScope = (k) => O.data.pinnedScopes.includes(k);
  O.togglePinScope = (k) => {
    const list = O.data.pinnedScopes, i = list.indexOf(k);
    if (i >= 0) list.splice(i, 1); else list.push(k);
    O.save();
  };
  O.isPinnedWord = (id) => O.data.pinnedWords.includes(id);
  O.togglePinWord = (id) => {
    const list = O.data.pinnedWords, i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    O.save();
  };

  // ---------- Daily Review queries ----------
  O.dueCards = (key, now = Date.now()) =>
    O.cardsIn(key).filter((c) => O.data.progress[c.id] && O.data.progress[c.id].due <= now)
      .sort((a, b) => O.data.progress[a.id].due - O.data.progress[b.id].due);
  O.unseen = (key) => O.cardsIn(key).filter((c) => !O.data.progress[c.id]);
  O.newToday = () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return Object.values(O.data.progress).filter((p) => p.firstReviewed && p.firstReviewed >= start.getTime()).length;
  };
  O.newAvailable = (key) => Math.max(0, Math.min(O.data.settings.newPerDay - O.newToday(), O.unseen(key).length));
  O.reviewQueue = (key) => O.dueCards(key).concat(O.unseen(key).slice(0, O.newAvailable(key)));
  O.knownCount = (key) => O.cardsIn(key).filter((c) => (O.data.progress[c.id]?.intervalDays || 0) >= 3).length;

  O.grade = (card, g) => {
    const p = O.data.progress[card.id] || O.newProgress();
    if (!p.firstReviewed) p.firstReviewed = Date.now();
    O.data.progress[card.id] = O.review(p, g);
    O.save();
  };
  O.previewGrade = (card, g) => O.describeDue(O.review(O.data.progress[card.id] || O.newProgress(), g));

  O.recordStudy = (card, correct, fast) => {
    const m = O.data.mastery[card.id] || { strength: 0, correct: 0, missed: 0, lastSeen: null };
    if (correct) { m.correct++; m.strength = Math.min(1, m.strength + (fast ? 0.2 : 0.12)); }
    else { m.missed++; m.strength = Math.max(0, m.strength - 0.3); }
    m.lastSeen = Date.now();
    O.data.mastery[card.id] = m;
    O.save();
  };

  // ---------- Editing words, groups and presets ----------
  const dupKey = (c) => O.fold(c.deck) + "|" + (c.greek || "").normalize("NFC") + "|" + O.fold(c.gloss);

  O.addCards = (list, groupByChapter) => {
    const existing = new Set(O.data.cards.map(dupKey));
    const added = [];
    list.forEach((c) => { const k = dupKey(c); if (!existing.has(k)) { existing.add(k); O.data.cards.push(c); added.push(c); } });
    if (groupByChapter) {
      [...new Set(added.map((c) => c.chapter).filter((c) => c != null))].sort((a, b) => a - b).forEach((n) => {
        const ids = added.filter((c) => c.chapter === n).map((c) => c.id);
        const name = "Chapter " + n;
        const g = O.data.groups.find((x) => O.fold(x.name) === O.fold(name));
        if (g) ids.forEach((id) => { if (!g.cardIDs.includes(id)) g.cardIDs.push(id); });
        else O.data.groups.push({ id: O.uid("g"), name, cardIDs: ids });
      });
    }
    if (added.length) O.save();
    return added.length;
  };

  O.updateCard = (card) => {
    const i = O.data.cards.findIndex((c) => c.id === card.id);
    if (i < 0) return;
    O.data.cards[i] = { ...card, greek: O.trim(card.greek), gloss: O.trim(card.gloss), deck: O.trim(card.deck) || "My Words" };
    O.save();
  };

  O.removeCards = (ids) => {
    const set = new Set(ids);
    if (!set.size) return;
    O.data.cards = O.data.cards.filter((c) => !set.has(c.id));
    set.forEach((id) => { delete O.data.progress[id]; delete O.data.mastery[id]; });
    O.data.pinnedWords = O.data.pinnedWords.filter((id) => !set.has(id));
    O.data.groups.forEach((g) => { g.cardIDs = g.cardIDs.filter((id) => !set.has(id)); });
    O.save();
  };

  O.saveGroup = (group) => {
    const i = O.data.groups.findIndex((g) => g.id === group.id);
    if (i >= 0) O.data.groups[i] = group; else O.data.groups.push(group);
    O.save();
  };
  O.deleteGroups = (ids, withWords) => {
    const set = new Set(ids);
    const words = O.data.groups.filter((g) => set.has(g.id)).flatMap((g) => g.cardIDs);
    O.data.groups = O.data.groups.filter((g) => !set.has(g.id));
    O.data.pinnedScopes = O.data.pinnedScopes.filter((k) => !(k.startsWith("g:") && set.has(k.slice(2))));
    if (withWords) O.removeCards(words); else O.save();
  };

  O.savePreset = (name, text) => {
    const clean = O.trim(name);
    if (!clean || !O.trim(text)) return;
    const p = O.data.presets.find((x) => O.fold(x.name) === O.fold(clean));
    if (p) p.text = text; else O.data.presets.push({ id: O.uid("p"), name: clean, text });
    O.save();
  };
  O.deletePreset = (id) => { O.data.presets = O.data.presets.filter((p) => p.id !== id); O.save(); };

  O.exportText = () =>
    O.cardsIn("all").map((c) => [c.greek, c.gloss, c.chapter ?? "", c.partOfSpeech || ""].join(" | ")).join("\n");

  O.resetProgress = () => { O.data.progress = {}; O.data.mastery = {}; O.save(); };

  // ---------- Study Session engine (mastery) ----------
  O.MasteryEngine = class {
    constructor(cards) {
      this.cards = cards;
      this.mastered = new Set();
      this.streak = {}; this.misses = {}; this.required = {}; this.strengths = {};
      this.recent = []; this.shown = 0; this.answered = 0; this.correctCount = 0;
      this.current = null; this.warmup = false;
      cards.forEach((c) => {
        const s = O.data.mastery[c.id]?.strength || 0;
        this.strengths[c.id] = s;
        this.required[c.id] = s >= 0.8 ? 1 : s >= 0.5 ? 2 : 3;
      });
      this.advance();
    }
    get finished() { return this.mastered.size === this.cards.length; }
    weight(c) { return 1 + 3 * (1 - (this.strengths[c.id] || 0)) + 2 * (this.misses[c.id] || 0); }
    record(card, correct) {
      this.answered++;
      const id = card.id;
      if (correct) {
        this.correctCount++;
        this.strengths[id] = Math.min(1, (this.strengths[id] || 0) + 0.12);
        if (!this.mastered.has(id)) {
          this.streak[id] = (this.streak[id] || 0) + 1;
          if (this.streak[id] >= (this.required[id] || 3)) this.mastered.add(id);
        }
      } else {
        this.strengths[id] = Math.max(0, (this.strengths[id] || 0) - 0.3);
        this.streak[id] = 0;
        this.misses[id] = (this.misses[id] || 0) + 1;
        this.required[id] = 3;
        this.mastered.delete(id);
      }
    }
    show(c, warm) {
      this.current = c; this.warmup = warm;
      this.recent.push(c.id);
      const limit = Math.min(3, Math.max(0, this.cards.length - 1));
      while (this.recent.length > limit) this.recent.shift();
    }
    advance() {
      const remaining = this.cards.filter((c) => !this.mastered.has(c.id));
      if (!remaining.length) { this.current = null; return; }
      this.shown++;
      if (this.shown % 4 === 0) {
        const known = this.cards.filter((c) => !this.recent.includes(c.id) && (this.mastered.has(c.id) || (this.strengths[c.id] || 0) >= 0.8));
        if (known.length) { const e = known[Math.floor(Math.random() * known.length)]; this.show(e, this.mastered.has(e.id)); return; }
      }
      let pool = remaining.filter((c) => !this.recent.includes(c.id));
      if (!pool.length) pool = remaining;
      const w = pool.map((c) => this.weight(c));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < pool.length; i++) { if (r < w[i]) return this.show(pool[i], false); r -= w[i]; }
      this.show(pool[pool.length - 1], false);
    }
    boardRound(size) {
      const remaining = this.cards.filter((c) => !this.mastered.has(c.id));
      const ranked = remaining.map((c) => [c, this.weight(c) * (0.75 + Math.random() * 0.5)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
      const round = ranked.slice(0, size);
      const inRound = new Set(round.map((c) => c.id));
      const known = O.shuffle(this.cards.filter((c) => !inRound.has(c.id) && (this.mastered.has(c.id) || (this.strengths[c.id] || 0) >= 0.8)));
      if (round.length < size) round.push(...known.slice(0, size - round.length));
      else if (size >= 6 && known.length) round[round.length - 1] = known[0];
      return O.shuffle(round);
    }
  };

  O.shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  O.choiceOptions = (card, pool) => {
    const others = pool.filter((c) => c.id !== card.id && O.fold(c.gloss) !== O.fold(card.gloss));
    const ordered = O.shuffle(others.filter((c) => c.partOfSpeech === card.partOfSpeech))
      .concat(O.shuffle(others.filter((c) => c.partOfSpeech !== card.partOfSpeech)));
    const picks = [];
    for (const c of ordered) { if (picks.length >= 3) break; if (!picks.includes(c.gloss)) picks.push(c.gloss); }
    return O.shuffle(picks.concat([card.gloss]));
  };

  // ---------- Paradigms ----------
  const variants = (answer) =>
    answer.split("/").flatMap((part) => {
      const p = part.trim();
      return p.includes("(ν)") ? [p.replace("(ν)", ""), p.replace("(ν)", "ν")] : [p];
    });
  O.pVariants = variants;
  O.pDisplay = (answer) => (answer.split("/")[0] || answer).trim().replace("(ν)", "ν");
  O.pNormalize = (s, accents) =>
    accents ? (s || "").normalize("NFC").replace(/\s/g, "").replace(/ς/g, "σ") : O.foldGreek(s);
  O.pMatches = (input, answer, accents) => {
    const a = O.pNormalize(input, accents);
    return !!a && variants(answer).some((v) => O.pNormalize(v, accents) === a);
  };

  const stemCache = new Map();
  const stemLength = (p, col) => {
    const key = p.id + ":" + col;
    if (stemCache.has(key)) return stemCache.get(key);
    const cols = col == null ? p.columns.map((_, i) => i) : [col];
    const forms = [];
    p.cells.forEach((row) => cols.forEach((c) => forms.push([...O.pDisplay(row[c])].filter((ch) => /\p{L}/u.test(ch)).map((ch) => O.foldGreek(ch)))));
    let k = Math.min(...forms.map((f) => f.length));
    for (let i = 0; i < k; i++) if (new Set(forms.map((f) => f[i])).size > 1) { k = i; break; }
    while (k > 0 && forms.some((f) => f.length <= k)) k--;
    stemCache.set(key, k);
    return k;
  };
  O.pSplit = (p, r, c) => {
    const k = stemLength(p, p.columns.length === 3 ? c : null);
    const raw = (p.cells[r][c].split("/")[0] || "").trim();
    const chars = [...raw];
    let count = 0, i = 0;
    while (count < k && i < chars.length) { if (/\p{L}/u.test(chars[i])) count++; i++; }
    return { stem: chars.slice(0, i).join(""), ending: chars.slice(i).join("") };
  };
  O.pCheck = (p, input, r, c, endingsOnly, accents) =>
    O.pMatches(endingsOnly ? O.pSplit(p, r, c).stem + input : input, p.cells[r][c], accents);

  O.pLabel = (p) => p.lemma + " · " + p.title;
  O.pChapter = (id) => {
    const o = O.data.settings.paradigmChapters[id];
    const n = o !== undefined ? o : window.PARADIGM_CHAPTERS[id] || 0;
    return n > 0 ? n : null;
  };
  O.pCategories = () => [...new Set(window.PARADIGMS.map((p) => p.category))];
  O.pById = (id) => window.PARADIGMS.find((p) => p.id === id);
})();
