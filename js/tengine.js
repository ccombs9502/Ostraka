// Ostraka web: Translate engine.
// Sentence parsing, answer keys from the tagged Greek New Testament (MorphGNT SBLGNT),
// accent restoration, verse matching and the rules used to check each step.
// Plain script (no modules) so it also works from file:// and inside the Windows app.
(function () {
  "use strict";
  const O = window.O;
  const E = (window.OE = {});

  const fw = (s) => O.fold(s).replace(/[^\p{L}]/gu, "");
  E.fw = fw;
  const GREEK = /[Ͱ-Ͽἀ-῿]/;
  const LATIN = /[A-Za-z]/;

  // ---------- Books and references ----------
  E.BOOKS = [
    ["Matthew", "Matt", "Mt", "Mat"], ["Mark", "Mk", "Mrk", "Mar"], ["Luke", "Lk", "Luk"], ["John", "Jn", "Jhn", "Joh"],
    ["Acts", "Ac", "Act"], ["Romans", "Rom", "Ro", "Rm"], ["1 Corinthians", "1 Cor", "1Co", "1 Co"], ["2 Corinthians", "2 Cor", "2Co", "2 Co"],
    ["Galatians", "Gal", "Ga"], ["Ephesians", "Eph"], ["Philippians", "Phil", "Php"], ["Colossians", "Col"],
    ["1 Thessalonians", "1 Thess", "1Th", "1 Th"], ["2 Thessalonians", "2 Thess", "2Th", "2 Th"], ["1 Timothy", "1 Tim", "1Ti"],
    ["2 Timothy", "2 Tim", "2Ti"], ["Titus", "Tit"], ["Philemon", "Phlm", "Phm", "Philem"], ["Hebrews", "Heb"], ["James", "Jas", "Jam"],
    ["1 Peter", "1 Pet", "1Pe", "1 Pt"], ["2 Peter", "2 Pet", "2Pe", "2 Pt"], ["1 John", "1 Jn", "1Jn", "1 Jo"], ["2 John", "2 Jn", "2Jn"],
    ["3 John", "3 Jn", "3Jn"], ["Jude", "Jud"], ["Revelation", "Rev", "Re", "Rv"],
  ];
  const squash = (s) => s.toLowerCase().replace(/[\s.]/g, "");
  E.parseRef = (s) => {
    const m = (s || "").trim().match(/^([1-3]?\s?[A-Za-z]+)\.?\s+(\d+)\s*:\s*(\d+)/);
    if (!m) return null;
    const name = squash(m[1]);
    const b = E.BOOKS.findIndex((names) => names.some((n) => squash(n) === name));
    if (b < 0) return null;
    return { b, c: +m[2], v: +m[3], key: `${b}.${+m[2]}.${+m[3]}`, label: `${E.BOOKS[b][0]} ${+m[2]}:${+m[3]}` };
  };
  E.refLabel = (key) => { const [b, c, v] = key.split(".").map(Number); return `${E.BOOKS[b][0]} ${c}:${v}`; };

  // ---------- Loading the Greek New Testament data ----------
  E.ready = false;
  let waiting = [];
  E.load = (cb) => {
    if (E.ready) { cb && cb(); return; }
    if (cb) waiting.push(cb);
    if (E.loading) return;
    E.loading = true;
    const done = () => { build(); E.ready = true; const w = waiting; waiting = []; w.forEach((f) => f()); };
    if (window.GNT) { done(); return; }
    const s = document.createElement("script");
    s.src = "data/gnt.js";
    s.onload = done;
    s.onerror = () => { E.loading = false; E.loadError = true; const w = waiting; waiting = []; w.forEach((f) => f()); };
    document.head.append(s);
  };
  function build() {
    const G = window.GNT;
    E.forms = G.forms; E.lemmas = G.lemmas; E.glosses = G.glosses; E.verses = G.verses;
    // MorphGNT leaves person off ἐγώ and σύ; add it so it can be asked and checked.
    G.forms.forEach((f) => {
      if (f[2] !== "RP" || f[3][0] !== "-") return;
      const L = G.lemmas[f[1]];
      const person = L === "ἐγώ" ? "1" : L === "σύ" ? "2" : null;
      if (person) f[3] = person + f[3].slice(1);
    });
    // How often each lemma is tagged as each kind across the NT (for kindsFor).
    E.lemmaKinds = new Map();
    G.forms.forEach((f) => {
      const k = E.posName(f[2]);
      if (!E.lemmaKinds.has(f[1])) E.lemmaKinds.set(f[1], {});
      const m = E.lemmaKinds.get(f[1]); m[k] = (m[k] || 0) + f[4];
    });
    E.byFold = new Map();
    G.forms.forEach((f, i) => { const k = fw(f[0]); if (!E.byFold.has(k)) E.byFold.set(k, []); E.byFold.get(k).push(i); });
    for (const list of E.byFold.values()) list.sort((a, b) => G.forms[b][4] - G.forms[a][4]);
    E.lemmaFold = new Map();
    G.lemmas.forEach((l, i) => { const k = fw(l); if (!E.lemmaFold.has(k)) E.lemmaFold.set(k, i); });
  }
  const verseCache = new Map();
  E.verse = (key) => {
    if (!verseCache.has(key)) {
      const raw = E.verses[key];
      verseCache.set(key, raw ? raw.split(",").map((x) => parseInt(x, 36)) : null);
    }
    return verseCache.get(key);
  };
  let wordIndex = null;
  function buildIndex() {
    wordIndex = new Map();
    for (const key of Object.keys(E.verses)) {
      const seen = new Set();
      for (const fi of E.verse(key)) {
        const k = fw(E.forms[fi][0]);
        if (seen.has(k)) continue;
        seen.add(k);
        if (!wordIndex.has(k)) wordIndex.set(k, []);
        wordIndex.get(k).push(key);
      }
    }
  }

  // ---------- Form information ----------
  E.info = (fi) => {
    const f = E.forms[fi];
    return { fi, word: f[0], lemma: E.lemmas[f[1]], lemmaIdx: f[1], pos: f[2], parse: f[3], count: f[4] };
  };
  E.POS = { "N-": "Noun", "V-": "Verb", RA: "Article", RP: "Pronoun", RR: "Pronoun", RD: "Pronoun", RI: "Pronoun", "A-": "Adjective", "P-": "Preposition", "C-": "Conjunction", "D-": "Adverb", "X-": "Particle", "I-": "Particle" };
  E.KINDS = ["Verb", "Noun", "Article", "Pronoun", "Adjective", "Preposition", "Conjunction", "Adverb", "Particle"];
  E.posName = (pos) => E.POS[pos] || "Particle";
  // Grammars don't all label every word the same way (MorphGNT calls some
  // καί "adverbs", and αὐτός is a pronoun that also works like an adjective),
  // so "What is it?" accepts every reasonable label for the word.
  const ALSO = {
    "αυτοσ": ["Pronoun", "Adjective"], "ουτοσ": ["Pronoun", "Adjective"], "εκεινοσ": ["Pronoun", "Adjective"],
    "τισ": ["Pronoun", "Adjective"], "οστισ": ["Pronoun"], "οσ": ["Pronoun"],
    "και": ["Conjunction", "Adverb"], "δε": ["Conjunction", "Particle"], "γαρ": ["Conjunction", "Particle"],
    "ουν": ["Conjunction", "Particle"], "μεν": ["Conjunction", "Particle"], "τε": ["Conjunction", "Particle"],
    "αρα": ["Conjunction", "Particle"], "γε": ["Particle"], "αν": ["Particle"],
    "ου": ["Adverb", "Particle"], "ουχι": ["Adverb", "Particle"], "μη": ["Adverb", "Particle", "Conjunction"],
    "αμην": ["Particle", "Adverb"], "ιδου": ["Particle", "Adverb"], "ναι": ["Particle", "Adverb"], "ουαι": ["Particle"],
  };
  E.kindsFor = (form) => {
    const set = new Set([E.posName(form.pos)]);
    const fold = fw(E.lemmas[form.lemmaIdx] || "").replace(/ς/g, "σ");
    (ALSO[fold] || []).forEach((k) => set.add(k));
    // Any other label this word gets in at least 10% of its NT uses.
    const m = E.lemmaKinds && E.lemmaKinds.get(form.lemmaIdx);
    if (m) { const tot = Object.values(m).reduce((x, y) => x + y, 0); Object.entries(m).forEach(([k, c]) => { if (c / tot >= 0.1) set.add(k); }); }
    if (form.pos === "RD" || form.pos === "RI") set.add("Adjective");
    return [...set];
  };
  const NOMINAL = new Set(["N-", "RA", "RP", "RR", "RD", "RI", "A-"]);

  // Glosses: the user's own vocabulary first, then the public-domain Dodson lexicon.
  E.gloss = (lemma) => {
    if (!lemma) return "";
    const k = fw(lemma);
    const card = O.data.cards.find((c) => fw((c.greek || "").split(/[,\s]/)[0]) === k);
    if (card) return card.gloss;
    if (!E.ready) return "";
    const i = E.lemmaFold.get(k);
    return i != null ? E.glosses[i] || "" : "";
  };

  // ---------- Parsing fields ----------
  E.FIELDS = {
    tense: { i: 1, name: "Tense", opts: [["P", "Present", "Pres"], ["I", "Imperfect", "Impf"], ["F", "Future", "Fut"], ["A", "Aorist", "Aor"], ["X", "Perfect", "Perf"], ["Y", "Pluperfect", "Plupf"]] },
    voice: { i: 2, name: "Voice", opts: [["A", "Active", "Act"], ["M", "Middle", "Mid"], ["P", "Passive", "Pass"]] },
    mood: { i: 3, name: "Mood", opts: [["I", "Indicative", "Ind"], ["D", "Imperative", "Impv"], ["S", "Subjunctive", "Subj"], ["O", "Optative", "Opt"], ["N", "Infinitive", "Inf"], ["P", "Participle", "Ptc"]] },
    person: { i: 0, name: "Person", opts: [["1", "1st", "1st"], ["2", "2nd", "2nd"], ["3", "3rd", "3rd"]] },
    case: { i: 4, name: "Case", opts: [["N", "Nominative", "Nom"], ["G", "Genitive", "Gen"], ["D", "Dative", "Dat"], ["A", "Accusative", "Acc"], ["V", "Vocative", "Voc"]] },
    number: { i: 5, name: "Number", opts: [["S", "Singular", "Sing"], ["P", "Plural", "Pl"]] },
    gender: { i: 6, name: "Gender", opts: [["M", "Masculine", "Masc"], ["F", "Feminine", "Fem"], ["N", "Neuter", "Neut"]] },
    // The other gender an ambiguous form (αὐτοῦ: masculine or neuter) could be.
    gender2: { i: 6, name: "Gender 2", opts: [["M", "Masculine", "Masc"], ["F", "Feminine", "Fem"], ["N", "Neuter", "Neut"]] },
    // The other case an ambiguous form (ἔργα: nominative or accusative) could be.
    case2: { i: 4, name: "Case 2", opts: [["N", "Nominative", "Nom"], ["G", "Genitive", "Gen"], ["D", "Dative", "Dat"], ["A", "Accusative", "Acc"], ["V", "Vocative", "Voc"]] },
    takes: { name: "Takes the", opts: [["G", "Genitive", "Gen"], ["D", "Dative", "Dat"], ["A", "Accusative", "Acc"]] },
  };
  // Every case this exact form can be, with the same lemma, number and gender
  // (from the whole New Testament, plus the rule that a neuter nominative and
  // accusative always look the same). Vocative is left out.
  E.caseOptions = (word, key) => {
    if (!key || !key.parse || key.parse[4] === "-") return [];
    const set = new Set([key.parse[4]]);
    (E.byFold.get(fw(word)) || []).forEach((i) => {
      const f = E.forms[i], c = f[3][4];
      if (f[1] === key.lemmaIdx && f[3][5] === key.parse[5] && f[3][6] === key.parse[6] && c !== "-" && c !== "V") set.add(c);
    });
    if (key.parse[6] === "N" && "NA".includes(key.parse[4])) { set.add("N"); set.add("A"); }
    return [...set];
  };
  // Every gender this exact form can be, with the same lemma, case and number.
  // Nouns have one gender, so only adjectives, pronouns, articles and participles.
  E.genderOptions = (word, key) => {
    if (!key || !key.parse || "-".includes(key.parse[6]) || /^N/.test(key.pos)) return [];
    const set = new Set([key.parse[6]]);
    (E.byFold.get(fw(word)) || []).forEach((i) => {
      const f = E.forms[i], g = f[3][6];
      if (f[1] === key.lemmaIdx && f[3][4] === key.parse[4] && f[3][5] === key.parse[5] && g !== "-") set.add(g);
    });
    // Second-declension masculine and neuter share the genitive and dative.
    // (Participles too: λύοντος, λύοντι.)
    if ("MN".includes(key.parse[6]) && "GD".includes(key.parse[4]) && (/^V/.test(key.pos) || /ο[σς]$/.test(fw(E.lemmas[key.lemmaIdx] || "")))) { set.add("M"); set.add("N"); }
    return [...set];
  };
  // Letter codes (full = "letters"): tense P I F A R(perfect) L(pluperfect); voice A M P;
  // mood I S O M(imperative) N(infinitive) P(participle); person 1 2 3; case N G D A V;
  // number S P; gender M F N.
  const LETTER = { tense: { X: "R", Y: "L" }, mood: { D: "M" } };
  E.optLabel = (field, code, full) => {
    const o = E.FIELDS[field].opts.find((x) => x[0] === code);
    if (!o) return "";
    if (full === "letters") { const base = field.replace(/2$/, ""); return (LETTER[base] && LETTER[base][code]) || code; }
    return full ? o[1] : o[2];
  };

  // Which fields to ask for. Verb fields follow the mood the user picked, so they give nothing away.
  E.fieldsFor = (kind, chosenMood, keyParse) => {
    if (kind === "Verb") {
      const base = ["tense", "voice", "mood"];
      if (chosenMood === "P") return base.concat(["case", "number", "gender"]);
      if (chosenMood === "N") return base;
      return base.concat(["person", "number"]);
    }
    if (kind === "Noun" || kind === "Article" || kind === "Adjective") return ["case", "number", "gender"];
    if (kind === "Pronoun") {
      if (!keyParse) return ["case", "number", "gender"];
      const f = keyParse[0] !== "-" ? ["case", "person", "number"] : ["case", "number"];
      if (keyParse[6] !== "-") f.push("gender");
      return f;
    }
    if (kind === "Preposition") return ["takes"];
    return [];
  };
  E.checkField = (field, val, parse, takes) => {
    if (!val) return false;
    if (field === "takes") return !takes || val === takes;
    if (!parse) return true;
    const want = parse[E.FIELDS[field].i];
    if (field === "voice" && "MP".includes(want) && "PIXY".includes(parse[1])) return "MP".includes(val);
    return val === want;
  };
  // "Present, Active, Indicative, 2nd Singular"
  // Turn a saved label ("Fut, Act, Ind, 3rd Pl", "Prep + Gen", "Gen / Nom, Sg")
  // into letters ("FAI3P", "Prep +G", "G/NS").
  E.toLetters = (label) => {
    if (!label) return label;
    const map = {};
    Object.entries(E.FIELDS).forEach(([f, def]) => { if (/2$/.test(f)) return; def.opts.forEach((o) => { const L = E.optLabel(f, o[0], "letters"); map[o[1].toLowerCase()] = L; map[o[2].toLowerCase()] = L; }); });
    map["sg"] = "S"; map["pl"] = "P";
    let prep = "";
    let rest = label.trim();
    if (/^prep\b/i.test(rest)) { prep = "Prep "; rest = rest.replace(/^prep\s*/i, ""); }
    const out = rest.split(/\s*,\s*|\s+(?=[^\s\/+])/).map((tok) => {
      if (!tok) return "";
      if (tok.includes("/")) return tok.split(/\s*\/\s*/).map((x) => map[x.toLowerCase()] || x).join("/");
      if (tok.startsWith("+")) return "+" + (map[tok.slice(1).trim().toLowerCase()] || tok.slice(1).trim());
      return map[tok.toLowerCase()] ?? tok;
    }).join("");
    return prep + out.replace(/\+\s+/g, "+");
  };
  E.parseLabel = (fields, get, full) => {
    if (full === "letters") {
      // Run together: PAI1P, NSM, A/NPN, +D.
      return fields.map((f) => { const v = get(f); if (!v) return "_"; const l = E.optLabel(f, v, full); return f === "takes" ? "+" + l : f === "case2" || f === "gender2" ? "/" + l : l; }).join("");
    }
    const parts = [];
    for (const f of fields) {
      const v = get(f);
      if (!v) { parts.push("___"); continue; }
      const lab = E.optLabel(f, v, full);
      if (f === "number" && fields.includes("person") && get("person")) { parts[parts.length - 1] += " " + lab; continue; }
      if (f === "takes") { parts.push("+ " + lab); continue; }
      if ((f === "case2" || f === "gender2") && parts.length) { parts[parts.length - 1] += " / " + lab; continue; }
      parts.push(lab);
    }
    return parts.join(", ");
  };

  // ---------- Reading pasted sentence lists ----------
  // Accepts your teacher's format: "Chapter 9", then "1. Greek (gloss) ... (John 2:22)." Sentences may run onto more lines.
  // Also accepts "- Greek — English" lines.
  const REF_RE = /\(\s*([1-3]?\s?[A-Z][a-z]+\.?\s+\d+\s*:\s*\d+(?:\s*[-–]\s*\d+)?)\s*\)\s*([.;·:,!?;]?)\s*$/;
  E.parseSentences = (text, defaultChapter) => {
    const out = [];
    let chapter = defaultChapter ?? null, cur = null;
    const flush = () => { if (cur && cur.raw.trim()) { const s = E.parseOne(cur.raw, cur.chapter); if (s) out.push(s); } cur = null; };
    for (const rawLine of (text || "").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const head = O.chapterHeading(line);
      if (head !== null) { flush(); chapter = head; continue; }
      const num = line.match(/^(\d+)[.)]\s+(.*)$/);
      const bullet = line.match(/^[-•*]\s+(.*)$/);
      if (num) { flush(); cur = { raw: num[2], chapter }; }
      else if (bullet) { flush(); cur = { raw: bullet[1], chapter }; }
      else if (cur) cur.raw += " " + line;
      else cur = { raw: line, chapter };
    }
    flush();
    return out;
  };

  E.parseOne = (raw, chapter) => {
    let s = raw.replace(/\s+/g, " ").trim();
    let english = "";
    const dash = s.match(/\s(?:—|–|=|\|)\s(?=[^Ͱ-Ͽἀ-῿]*$)/);
    if (dash && LATIN.test(s.slice(dash.index)) && GREEK.test(s.slice(0, dash.index))) {
      english = s.slice(dash.index + dash[0].length).trim();
      s = s.slice(0, dash.index).trim();
    }
    let ref = null, endPunct = "";
    const rm = s.match(REF_RE);
    if (rm) { ref = E.parseRef(rm[1]); endPunct = rm[2] || ""; s = s.slice(0, rm.index).trim(); if (!ref) ref = { key: null, label: rm[1].trim() }; }
    s = s.replace(/([Ͱ-Ͽἀ-῿])\d+/gu, "$1");       // footnote numbers
    const tokens = [];
    const re = /\(([^)]*)\)|(\.\s?\.\s?\.|…)|([Ͱ-Ͽἀ-῿̀-ͯ'’᾽ʼ]+)|([.,;·:;!?])/gu;
    let m;
    while ((m = re.exec(s))) {
      if (m[1] != null) {
        const inner = m[1].trim();
        const prev = [...tokens].reverse().find((t) => !t.gap);
        if (inner && LATIN.test(inner) && prev) {
          // "(king, nominative)": "king" is the given meaning, "nominative" is a
          // grammar note. "(genitive)" alone is only a note, so the word is
          // still parsed. Greek inside the note ("παιδίον, child") is dropped.
          const parts = inner.split(/\s*[,;]\s*/).filter(Boolean);
          const GRAM = /^(nominative|genitive|dative|accusative|vocative)$/i;
          const gram = parts.filter((x) => GRAM.test(x));
          const rest = parts.filter((x) => !GRAM.test(x) && LATIN.test(x) && !/[Ͱ-Ͽἀ-῿]/.test(x));
          if (rest.length) prev.given = rest.join(", ");
          // A note that isn't a translation ("superlative of μικρός") is shown
          // as the professor's note; the word is still parsed.
          if (gram.length) prev.note = gram[0].toLowerCase();
          else if (!rest.length) prev.note = inner;
        }
      } else if (m[2]) tokens.push({ w: "…", gap: true, post: "" });
      else if (m[3]) {
        const w = m[3].normalize("NFC").replace(/[’᾽ʼ']/g, "’");
        if (/^[;·]$/.test(w)) { if (tokens.length) tokens[tokens.length - 1].post += w; continue; }
        tokens.push({ w, post: "" });
      } else if (m[4]) { if (tokens.length) tokens[tokens.length - 1].post += m[4]; }
    }
    if (endPunct && tokens.length) tokens[tokens.length - 1].post += endPunct;
    if (!tokens.some((t) => !t.gap)) return null;
    return { chapter, tokens, ref: ref ? ref.label : "", refKey: ref ? ref.key : null, english };
  };
  E.sentenceText = (s, withGlosses) => s.tokens.map((t) => t.w + (withGlosses && t.given ? ` (${t.given})` : "") + (t.post || "")).join(" ");

  // ---------- Answer keys ----------
  // For each token: { forms: [form indices that count as right], src: "verse" | "form" | null }
  const acuteOnly = (s) => s.normalize("NFD").replace(/̀/g, "́").normalize("NFC");
  const KEYS = new WeakMap();   // kept out of saved data
  E.verseOf = (s) => (KEYS.get(s) || {}).verse || null;
  E.keyFor = (s) => {
    if (!E.ready) return null;
    const cached = KEYS.get(s);
    if (cached && cached.ref === s.refKey) return cached.key;
    const words = s.tokens.map((t, i) => [t, i]).filter(([t]) => !t.gap);
    const key = s.tokens.map(() => ({ forms: [], src: null }));
    let verseKey = s.refKey && E.verses[s.refKey] ? s.refKey : null;
    if (!verseKey) { const found = E.findVerse(words.map(([t]) => t.w), 0.8); if (found) verseKey = found.key; }
    if (verseKey) {
      const vf = E.verse(verseKey);
      let pos = 0;
      for (const [t, i] of words) {
        const k = fw(t.w);
        for (let j = pos; j < vf.length; j++) {
          if (fw(E.forms[vf[j]][0]) === k) { key[i] = { forms: [vf[j]], src: "verse" }; pos = j + 1; break; }
        }
      }
    }
    for (const [t, i] of words) {
      if (key[i].forms.length) continue;
      const cands = E.byFold.get(fw(t.w)) || [];
      if (!cands.length) continue;
      const exact = cands.filter((fi) => acuteOnly(E.forms[fi][0]) === acuteOnly(t.w));
      key[i] = { forms: exact.length ? exact : cands, src: "form" };
    }
    KEYS.set(s, { key, ref: s.refKey, verse: verseKey });
    return key;
  };
  E.keyStatus = (s) => {
    const key = E.keyFor(s);
    if (!key) return { label: "Checking…", full: false };
    const words = s.tokens.filter((t) => !t.gap && !t.given).length;
    const verse = key.filter((k, i) => k.src === "verse" && !s.tokens[i].given).length;
    const any = key.filter((k, i) => k.src && !s.tokens[i].given).length;
    const vk = E.verseOf(s);
    if (vk && verse >= words) return { label: E.refLabel(vk) + " · parsing found", full: true };
    if (any >= words) return { label: "Parsing found", full: true };
    if (any) return { label: `Parsing found for ${any} of ${words} words`, full: false };
    return { label: "No key · self-check", full: false };
  };

  // What case a preposition takes, from the words after it.
  E.takes = (s, i) => {
    const key = E.keyFor(s);
    for (let j = i + 1; j < s.tokens.length; j++) {
      const k = key && key[j];
      if (!k || !k.forms.length) continue;
      const f = E.forms[k.forms[0]];
      if (NOMINAL.has(f[2]) && f[3][4] !== "-") return f[3][4];
      if (f[2] === "P-" || f[2] === "V-") return null;
    }
    return null;
  };

  // ---------- Units (what you parse one at a time) ----------
  // With "link articles automatically" on, an article joins the word right after it when they agree.
  E.units = (s, linkArticles) => {
    const key = E.keyFor(s);
    const units = [];
    for (let i = 0; i < s.tokens.length; i++) {
      const t = s.tokens[i];
      if (t.gap) continue;
      const k = key && key[i];
      const f = k && k.forms.length ? E.forms[k.forms[0]] : null;
      if (linkArticles && f && f[2] === "RA" && !t.given) {
        const j = i + 1, t2 = s.tokens[j], k2 = key[j];
        const f2 = k2 && k2.forms.length ? E.forms[k2.forms[0]] : null;
        if (t2 && !t2.gap && !t2.given && f2 && NOMINAL.has(f2[2]) && f2[2] !== "RA" && f2[3].slice(4, 7) === f[3].slice(4, 7)) {
          units.push({ ids: [i, j], head: j, given: t2.given || null, article: true });
          i = j; continue;
        }
      }
      units.push({ ids: [i], head: i, given: t.given || null });
    }
    units.forEach((u, n) => { u.n = n; u.greek = u.ids.map((id) => s.tokens[id].w).join(" "); });
    return units;
  };
  // Every analysis that counts as right for this unit's head word.
  E.unitForms = (s, u) => { const k = E.keyFor(s); return k && k[u.head] ? k[u.head].forms.map(E.info) : []; };

  // ---------- Accents and breathing marks ----------
  const VOWEL = /[αεηιουω]/;
  E.gravify = (w) => {
    // An acute on the last syllable becomes grave when another word follows.
    const d = w.normalize("NFD");
    const letters = [...d];
    let lastVowel = -1;
    for (let i = letters.length - 1; i >= 0; i--) if (VOWEL.test(letters[i].normalize("NFC").toLowerCase())) { lastVowel = i; break; }
    if (lastVowel < 0) return w;
    for (let i = lastVowel + 1; i < letters.length && /[̀-ͯ]/.test(letters[i]); i++) if (letters[i] === "́") letters[i] = "̀";
    return letters.join("").normalize("NFC");
  };
  // Best accented spelling for a typed word, plus other likely spellings.
  E.restoreWord = (typed) => {
    const plain = fw(typed);
    if (!plain || !E.ready) return { text: typed, known: false, alts: [] };
    const hasMarks = /[̀-ͯ]/.test(typed.normalize("NFD"));
    const cands = E.byFold.get(plain) || [];
    if (!cands.length) return { text: typed, known: false, alts: [] };
    const tally = new Map();
    for (const fi of cands) { const a = acuteOnly(E.forms[fi][0]); tally.set(a, (tally.get(a) || 0) + E.forms[fi][4]); }
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    if (hasMarks) {
      const mine = acuteOnly(typed.normalize("NFC"));
      return { text: typed.normalize("NFC"), known: tally.has(mine), alts: tally.has(mine) ? [] : ranked.map((r) => r[0]).slice(0, 3) };
    }
    const top = ranked[0][1];
    const alts = ranked.filter((r) => r[1] >= Math.max(2, top * 0.04)).map((r) => r[0]);
    return { text: ranked[0][0], known: true, alts: alts.length > 1 ? alts : [] };
  };
  // Split into letters with the marks that belong to each.
  const letterMarks = (w) => {
    const out = [];
    for (const ch of w.normalize("NFD")) {
      if (/[̀-ͯ]/.test(ch) && out.length) out[out.length - 1].m += ch;
      else out.push({ b: ch, m: "" });
    }
    return out;
  };
  // [{t, add}] so the app can show the marks it added in gold.
  E.addedMarks = (typed, out) => {
    const a = letterMarks(typed), b = letterMarks(out);
    if (a.filter((x) => /\p{L}/u.test(x.b)).length !== b.filter((x) => /\p{L}/u.test(x.b)).length) return [{ t: out, add: false }];
    let ai = 0;
    return b.map((x) => {
      while (ai < a.length && !/\p{L}/u.test(a[ai].b) && /\p{L}/u.test(x.b)) ai++;
      const mine = a[ai] ? a[ai].m : "";
      ai++;
      const added = [...x.m].some((c) => !mine.includes(c));
      return { t: (x.b + x.m).normalize("NFC"), add: added };
    });
  };

  // Find the verse that contains these words in this order (share = how many must match).
  E.findVerse = (words, share = 1) => {
    if (!E.ready) return null;
    const ws = words.map(fw).filter(Boolean);
    if (ws.length < 2) return null;
    if (!wordIndex) buildIndex();
    let best = null;
    const lists = ws.map((w) => wordIndex.get(w) || null);
    const known = lists.filter(Boolean);
    if (!known.length) return null;
    const rare = known.reduce((a, b) => (a.length <= b.length ? a : b));
    for (const key of rare.slice(0, 600)) {
      const vf = E.verse(key).map((fi) => fw(E.forms[fi][0]));
      let pos = 0, hit = 0, start = -1, end = -1;
      for (const w of ws) {
        const j = vf.indexOf(w, pos);
        if (j >= 0) { hit++; if (start < 0) start = j; end = j; pos = j + 1; }
      }
      const score = hit / ws.length;
      const tight = hit ? hit / (end - start + 1) : 0;
      if (score >= share && (!best || score > best.score || (score === best.score && tight > best.tight))) best = { key, score, tight, start, end };
    }
    return best;
  };

  // Type a sentence: restore marks, and use the exact verse if the whole sentence is in the New Testament.
  E.restoreSentence = (text) => {
    const raw = (text || "").trim();
    const parts = raw.match(/[Ͱ-Ͽἀ-῿̀-ͯ'’]+|[.,;·:;!?]/gu) || [];
    const words = [];
    for (const p of parts) {
      if (/^[.,;·:;!?]$/.test(p)) { if (words.length) words[words.length - 1].post += p; continue; }
      words.push({ typed: p.normalize("NFC"), post: "" });
    }
    if (!words.length) return { words, ref: null };
    let ref = null;
    const found = words.length >= 2 ? E.findVerse(words.map((w) => w.typed), 1) : null;
    if (found && found.tight === 1 && (words.length >= 4 || E.verse(found.key).length === words.length)) {
      const vf = E.verse(found.key);
      words.forEach((w, n) => { w.text = E.forms[vf[found.start + n]][0]; w.known = true; w.alts = []; w.fromVerse = true; });
      ref = { key: found.key, label: E.refLabel(found.key) };
    } else {
      let prevArt = null;   // case/number/gender of an article just before, to pick the right ending
      words.forEach((w, n) => {
        const r = E.restoreWord(w.typed);
        if (prevArt && r.alts.length > 1) {
          const agree = r.alts.find((alt) => (E.byFold.get(fw(alt)) || []).some((fi) => acuteOnly(E.forms[fi][0]) === alt && E.forms[fi][2] !== "RA" && E.forms[fi][3].slice(4, 7) === prevArt));
          if (agree) r.text = agree;
        }
        const arts = (E.byFold.get(fw(r.text)) || []).filter((fi) => E.forms[fi][2] === "RA" && acuteOnly(E.forms[fi][0]) === acuteOnly(r.text));
        const cngs = [...new Set(arts.map((fi) => E.forms[fi][3].slice(4, 7)))];
        prevArt = cngs.length === 1 ? cngs[0] : null;
        const last = n === words.length - 1 || /[.,;·:;!?]/.test(w.post);
        w.text = r.known && !last ? E.gravify(r.text) : r.text;
        w.known = r.known; w.alts = r.alts;
      });
    }
    words.forEach((w) => { w.segs = E.addedMarks(w.typed, w.text); });
    return { words, ref };
  };

  // ---------- Related paradigm charts ----------
  E.charts = (s) => {
    const key = E.keyFor(s);
    if (!key) return [];
    const ids = [];
    const add = (id) => { if (id && !ids.includes(id) && O.pById(id)) ids.push(id); };
    key.forEach((k, i) => {
      if (!k.forms.length || s.tokens[i].given) return;
      const f = E.info(k.forms[0]), L = fw(f.lemma), p = f.parse;
      if (f.pos === "RA") add("article");
      else if (f.pos === "RP") add({ εγω: "p-ego", συ: "p-sy", αυτοσ: "p-autos" }[L]);
      else if (f.pos === "RR") add("p-hos");
      else if (f.pos === "RD") add({ ουτοσ: "p-houtos", εκεινοσ: "p-ekeinos" }[L]);
      else if (f.pos === "N-") {
        const g = p[6];
        if (L.endsWith("οσ") && g === "M") add("n-logos");
        else if (L.endsWith("ον") && g === "N") add("n-ergon");
        else if (L.endsWith("η") && g === "F") add("n-graphe");
        else if (L.endsWith("α") && g === "F") add(/[ειρ]α$/.test(L) ? "n-hemera" : "n-doxa");
        else if (L.endsWith("ησ") && g === "M") add("n-prophetes");
        else if (L.endsWith("μα")) add("n-onoma");
        else if (L.endsWith("ευσ")) add("n-basileus");
        else if (L.endsWith("ηρ")) add("n-pater");
        else if (L.endsWith("οσ") && g === "N") add("n-genos");
        else if (L.endsWith("ισ")) add(L.endsWith("σισ") ? "n-polis" : "n-elpis");
        else add("n-sarx");
      } else if (f.pos === "A-") add({ πασ: "a-pas", μεγασ: "a-megas", πολυσ: "a-polys" }[L] || "a-agathos");
      else if (f.pos === "V-") {
        const [, t, v, m] = p;
        if (L === "ειμι") add({ P: "eimi-pres", I: "eimi-impf", F: "eimi-fut" }[t]);
        else if (L === "οιδα") add(t === "Y" ? "oida-plpf" : "oida-perf");
        else if (m === "P") add({ PA: "pt-pres-a", PM: "pt-pres-mp", PP: "pt-pres-mp", AA: "pt-aor-a", AM: "pt-aor-m", AP: "pt-aor-p", XA: "pt-perf-a", XM: "pt-perf-mp", XP: "pt-perf-mp" }[t + v]);
        else if (m === "I") {
          const mp = "MP".includes(v);
          const contract = L.endsWith("αω") ? "c-agapao" : L.endsWith("εω") ? "c-poieo" : L.endsWith("οω") ? "c-pleroo" : null;
          if (contract && (t === "P" || t === "I")) add(contract + (t === "I" ? "-impf" : "") + (mp ? "-mp" : ""));
          else {
            const tn = { P: "pres", I: "impf", F: "fut", A: "aor", X: "perf", Y: "plpf" }[t];
            const vn = t === "P" || t === "I" || t === "X" ? (mp ? "mp" : "a") : t === "Y" ? "a" : { A: "a", M: "m", P: "p" }[v];
            add(`luo-${tn}-${vn}`);
          }
        }
      }
    });
    return ids;
  };

  // ---------- Skeleton (outline) rules ----------
  E.ROLES = ["Verb", "Subject", "Direct object", "Indirect object", "Prepositional phrase", "Modifier", "Conjunction", "Other"];
  // Roles that fit a phrase, from the parsing of its words.
  E.phraseRoles = (s, units, phrase) => {
    const key = E.keyFor(s);
    const infos = [];
    phrase.forEach((un) => units[un].ids.forEach((id) => { const k = key && key[id]; infos.push(k && k.forms.length ? E.info(k.forms[0]) : null); }));
    if (infos.some((x) => !x)) return null;   // can't judge words without a key
    const finite = infos.find((x) => x.pos === "V-" && "IDSO".includes(x.parse[3]));
    if (finite) return { roles: ["Verb"], why: "has the main verb " + finite.word };
    const content = infos.filter((x) => x.pos !== "C-" && x.pos !== "X-");
    const conjOnly = !content.length;
    if (conjOnly) return { roles: ["Conjunction", "Other"], why: "joins the parts together" };
    const extra = infos[0].pos === "C-" ? ["Conjunction", "Prepositional phrase", "Subject", "Direct object", "Indirect object", "Modifier"] : [];
    const first = content[0];
    if (first.pos === "P-") return { roles: ["Prepositional phrase", "Modifier"].concat(extra), why: first.word + " starts a prepositional phrase" };
    const verbal = content.find((x) => x.pos === "V-");
    if (verbal) return { roles: ["Verb", "Modifier", "Other"].concat(extra), why: verbal.parse[3] === "P" ? "a participle phrase" : "an infinitive phrase" };
    const nom = content.find((x) => NOMINAL.has(x.pos) && x.pos !== "RA") || content.find((x) => NOMINAL.has(x.pos));
    if (nom) {
      const c = nom.parse[4];
      const map = { N: ["Subject", "Modifier"], A: ["Direct object", "Modifier"], D: ["Indirect object", "Modifier"], G: ["Modifier"], V: ["Other", "Modifier"] };
      const why = { N: "nominative", A: "accusative", D: "dative", G: "genitive", V: "vocative" }[c];
      return { roles: (map[c] || ["Other"]).concat(extra), why: `${nom.word} is ${why}` };
    }
    return { roles: ["Modifier", "Other"].concat(extra), why: "describes something else in the sentence" };
  };
  // Ostraka's suggested outline: [{units:[...], level, role, why}]
  E.suggestOutline = (s, units) => {
    const key = E.keyFor(s);
    const rows = [];
    let cur = null;
    const POSTPOS = new Set(["δε", "γαρ", "ουν", "τε"]);
    const NEG = new Set(["ου", "ουκ", "ουχ", "μη"]);
    units.forEach((u, n) => {
      const k = key && key[u.head];
      const f = k && k.forms.length ? E.info(k.forms[0]) : null;
      const finite = f && f.pos === "V-" && "IDSO".includes(f.parse[3]);
      const neg = f && NEG.has(fw(f.word));
      const post = f && f.pos === "C-" && POSTPOS.has(fw(f.lemma));
      const nominal = f && NOMINAL.has(f.pos);
      const startsNew = !cur || !f || (!post && (f.pos === "P-" || f.pos === "C-" || neg ||
        (finite && !cur.negOnly) || (cur.hasVerb && nominal) ||
        (cur.lastCase && nominal && f.parse[4] !== cur.lastCase && f.parse[4] !== "G")));
      if (startsNew) { cur = { units: [n], lastCase: nominal ? f.parse[4] : null, negOnly: !!neg, hasVerb: !!finite }; rows.push(cur); }
      else {
        cur.units.push(n);
        if (finite) { cur.hasVerb = true; cur.negOnly = false; }
        if (nominal && f.parse[4] !== "G") cur.lastCase = f.parse[4];
      }
      if (f && f.pos === "P-") cur.lastCase = E.takes(s, u.head);
    });
    // Merge a lone conjunction into the phrase after it.
    for (let i = rows.length - 2; i >= 0; i--) {
      const only = rows[i].units.length === 1 && (() => { const k = key && key[units[rows[i].units[0]].head]; return k && k.forms.length && E.forms[k.forms[0]][2] === "C-"; })();
      if (only) { rows[i + 1].units = rows[i].units.concat(rows[i + 1].units); rows.splice(i, 1); }
    }
    let verseLevel = 0;
    rows.forEach((r, i) => {
      const pr = E.phraseRoles(s, units, r.units);
      r.role = pr ? pr.roles[0] : "Other"; r.why = pr ? pr.why : "";
      if (r.role === "Verb") r.level = 0;
      else if (r.role === "Modifier" && i > 0) r.level = Math.min(3, rows[i - 1].level + 1);
      else r.level = 1;
      if (i > 0 && rows[i - 1].role === r.role && r.role !== "Verb" && pr && pr.roles.includes("Conjunction")) r.level = rows[i - 1].level;
      verseLevel = Math.max(verseLevel, r.level);
    });
    // καί + the same case as the line above: it continues that line (e.g. more objects of the same preposition).
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], prev = rows[i - 1];
      const k0 = key && key[units[r.units[0]].head];
      if (!k0 || !k0.forms.length || E.forms[k0.forms[0]][2] !== "C-" || !r.lastCase || r.lastCase !== prev.lastCase) continue;
      r.role = prev.role;
      r.level = prev.chainLevel != null ? prev.chainLevel : prev.level + 1;
      r.chainLevel = r.level;
      const prep = prev.prep || (prev.role === "Prepositional phrase" ? units[prev.units.find((n) => { const kk = key[units[n].head]; return kk && kk.forms.length && E.forms[kk.forms[0]][2] === "P-"; })].greek : null);
      r.prep = prep;
      r.why = prep ? "another object of " + prep : "joined to the line above by " + units[r.units[0]].greek;
    }
    const hasSubject = rows.some((r) => r.role === "Subject");
    rows.forEach((r) => { if (r.role === "Verb" && !hasSubject) r.why = "main verb · its subject is inside the verb"; });
    return rows;
  };
  // Check the user's outline. Returns [{row, ok, message}] plus overall ok.
  E.checkOutline = (s, units, rows) => {
    const results = rows.map((r) => {
      const pr = E.phraseRoles(s, units, r.units);
      if (!r.role) return { ok: false, message: "Choose a role for this line." };
      if (!pr) return { ok: true, message: "" };
      if (!pr.roles.includes(r.role)) {
        const q = r.role === "Subject" ? "Is anything in this line nominative?" :
          r.role === "Direct object" ? "Is the main word here accusative, and is it outside a prepositional phrase?" :
          r.role === "Verb" ? "Does this line have a verb with a person ending?" :
          r.role === "Prepositional phrase" ? "Does this line start with a preposition?" :
          r.role === "Indirect object" ? "Is the main word here dative?" : "Look at the case of the main word in this line.";
        return { ok: false, message: q };
      }
      return { ok: true, message: "" };
    });
    // A preposition needs its object in the same line.
    rows.forEach((r, ri) => {
      r.units.forEach((un) => {
        const u = units[un];
        const k = E.keyFor(s)[u.head];
        if (!k || !k.forms.length || E.forms[k.forms[0]][2] !== "P-") return;
        const next = units[un + 1];
        if (next && !r.units.includes(next.n)) results[ri] = { ok: false, message: `Where is the object of ${u.greek}? It usually goes in the same line.` };
      });
    });
    const verbRows = rows.map((r, i) => [r, i]).filter(([r]) => r.role === "Verb");
    if (verbRows.length) {
      const top = Math.min(...verbRows.map(([r]) => r.level));
      rows.forEach((r, i) => {
        if (r.role !== "Verb" && r.role !== "Conjunction" && r.level <= top && results[i].ok)
          results[i] = { ok: false, message: "Which word does this line belong to? Try indenting it under the verb." };
      });
    }
    // Order: an indented line has to sit under the line it belongs to.
    rows.forEach((r, i) => {
      if (!results[i].ok) return;
      const prev = rows[i - 1];
      if (r.level > 0 && (!prev || r.level > prev.level + 1))
        results[i] = { ok: false, message: prev ? "This line is pushed in too far. It should be only one step further right than the line it belongs to." : "An indented line needs a line above it to hang from. Move it below the word it describes." };
      else if (r.level > 0) {
        // Its parent is the nearest line above with a smaller indent.
        let p = i - 1; while (p >= 0 && rows[p].level >= r.level) p--;
        const parent = p >= 0 ? rows[p] : null;
        if (parent && ["Subject", "Direct object", "Indirect object"].includes(r.role) && parent.role !== "Verb" && parent.role !== "Conjunction")
          results[i] = { ok: false, message: `A ${r.role.toLowerCase()} belongs to the verb. Move this line so it sits under the verb line.` };
      }
    });
    if (verbRows.length && rows.length && rows[0].role !== "Verb" && rows[0].role !== "Conjunction" && results[0].ok)
      results[0] = { ok: false, message: "Start the skeleton with the verb at the top." };
    return { results, ok: results.every((x) => x.ok) };
  };

  // ---------- English check ----------
  const enWords = (s) => (s || "").toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter((w) => w && !["the", "a", "an"].includes(w));
  E.compareEnglish = (mine, ref) => {
    const a = enWords(mine), b = enWords(ref);
    if (!a.length || !b.length) return 0;
    const bag = new Map();
    b.forEach((w) => bag.set(w, (bag.get(w) || 0) + 1));
    let hit = 0;
    a.forEach((w) => { const n = bag.get(w) || 0; if (n) { hit++; bag.set(w, n - 1); } });
    return (2 * hit) / (a.length + b.length);
  };
  // Greek → compare the forms written, any order.
  E.compareGreek = (mine, s) => {
    const want = s.tokens.filter((t) => !t.gap).map((t) => fw(t.w)).sort();
    const got = (mine.match(/[Ͱ-Ͽἀ-῿̀-ͯ]+/gu) || []).map(fw).filter(Boolean);
    const sorted = [...got].sort();
    const same = want.length === sorted.length && want.every((w, i) => w === sorted[i]);
    const order = same && got.every((w, i) => w === fw(s.tokens.filter((t) => !t.gap)[i].w));
    const missing = want.filter((w) => !got.includes(w));
    const extra = got.filter((w) => !want.includes(w));
    return { same, order, missing, extra };
  };
})();
