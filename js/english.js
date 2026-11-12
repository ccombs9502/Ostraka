// Ostraka – grading "In this sentence": does the English fit this exact form?
// It must use one of the word's meanings, and for a verb it must show the
// right person, number, tense and voice (λήμψεσθε → "you all will take /
// receive", not "I take" or "you will take"). Flexible on wording, strict on
// what the form means.
(function () {
  "use strict";

  // ---------- English verb forms ----------
  const IRR = {
    be: ["was were", "been"], take: ["took", "taken"], give: ["gave", "given"], say: ["said", "said"], see: ["saw", "seen"],
    go: ["went", "gone"], come: ["came", "come"], know: ["knew", "known"], make: ["made", "made"], have: ["had", "had"],
    do: ["did", "done"], speak: ["spoke", "spoken"], write: ["wrote", "written"], find: ["found", "found"], hear: ["heard", "heard"],
    send: ["sent", "sent"], bring: ["brought", "brought"], lead: ["led", "led"], eat: ["ate", "eaten"], drink: ["drank", "drunk"],
    tell: ["told", "told"], leave: ["left", "left"], become: ["became", "become"], begin: ["began", "begun"], throw: ["threw", "thrown"],
    fall: ["fell", "fallen"], rise: ["rose", "risen"], arise: ["arose", "arisen"], stand: ["stood", "stood"], teach: ["taught", "taught"],
    seek: ["sought", "sought"], think: ["thought", "thought"], sit: ["sat", "sat"], lose: ["lost", "lost"], build: ["built", "built"],
    keep: ["kept", "kept"], sleep: ["slept", "slept"], hold: ["held", "held"], get: ["got", "gotten got"], put: ["put", "put"],
    set: ["set", "set"], let: ["let", "let"], cast: ["cast", "cast"], shut: ["shut", "shut"], run: ["ran", "run"], bear: ["bore", "born borne"],
    forgive: ["forgave", "forgiven"], choose: ["chose", "chosen"], draw: ["drew", "drawn"], grow: ["grew", "grown"], fly: ["flew", "flown"],
    flee: ["fled", "fled"], feed: ["fed", "fed"], meet: ["met", "met"], buy: ["bought", "bought"], sell: ["sold", "sold"], pay: ["paid", "paid"],
    lay: ["laid", "laid"], lie: ["lay lied", "lain lied"], strike: ["struck", "struck stricken"], catch: ["caught", "caught"], fight: ["fought", "fought"],
    win: ["won", "won"], break: ["broke", "broken"], wear: ["wore", "worn"], forget: ["forgot", "forgotten"], hide: ["hid", "hidden"],
    ride: ["rode", "ridden"], shine: ["shone shined", "shone shined"], sing: ["sang", "sung"], swear: ["swore", "sworn"],
    understand: ["understood", "understood"], spend: ["spent", "spent"], mean: ["meant", "meant"], feel: ["felt", "felt"], hang: ["hung hanged", "hung hanged"],
    dig: ["dug", "dug"], read: ["read", "read"], behold: ["beheld", "beheld"], withdraw: ["withdrew", "withdrawn"], overcome: ["overcame", "overcome"],
    undertake: ["undertook", "undertaken"], beget: ["begot begat", "begotten"], sow: ["sowed", "sown sowed"], shake: ["shook", "shaken"],
    bind: ["bound", "bound"], light: ["lit lighted", "lit lighted"], hit: ["hit", "hit"], cut: ["cut", "cut"], hurt: ["hurt", "hurt"],
    spread: ["spread", "spread"], burn: ["burned burnt", "burned burnt"], dwell: ["dwelt dwelled", "dwelt dwelled"], weep: ["wept", "wept"],
    stick: ["stuck", "stuck"], slay: ["slew", "slain"], tear: ["tore", "torn"], awake: ["awoke", "awoken"], wake: ["woke", "woken"],
  };
  const vowel = (c) => "aeiou".includes(c);
  const doubles = (b) => b.length <= 5 && /[^aeiou][aeiou][bdgklmnprt]$/.test(b) && !/^(visit|open|enter|listen|offer|suffer|answer|gather|murmur|travel|wonder|deliver|happen|labor|order|honor)$/.test(b);
  function forms(base) {
    if (base === "be") return { base: ["be"], s3: ["is"], pres: ["am", "is", "are"], ing: ["being"], past: ["was", "were"], pp: ["been"] };
    const last = base.slice(-1), prev = base.slice(-2, -1);
    let s3 = /(s|x|z|ch|sh|o)$/.test(base) ? base + "es" : last === "y" && !vowel(prev) ? base.slice(0, -1) + "ies" : base + "s";
    if (base === "have") s3 = "has";
    const ing = [];
    if (/ie$/.test(base)) ing.push(base.slice(0, -2) + "ying");
    else if (last === "e" && !/(ee|ye|oe)$/.test(base)) ing.push(base.slice(0, -1) + "ing");
    else ing.push(base + "ing");
    if (doubles(base)) ing.push(base + last + "ing");
    let past, pp;
    if (IRR[base]) { past = IRR[base][0].split(" "); pp = IRR[base][1].split(" "); }
    else {
      const ed = last === "e" ? base + "d" : last === "y" && !vowel(prev) ? base.slice(0, -1) + "ied" : base + "ed";
      past = [ed]; if (doubles(base)) past.push(base + last + "ed");
      pp = past;
    }
    return { base: [base], s3: [s3], pres: [base, s3], ing, past, pp };
  }
  // Phrasal glosses: "come to know" → head "come"; "am" → "be".
  const BE = new Set(["am", "is", "are", "was", "were", "be", "been", "being"]);
  function verbHeads(meanings) {
    const out = new Set();
    for (let m of meanings) {
      m = m.toLowerCase().replace(/\(.*?\)/g, " ").replace(/^\s*(i|to)\s+/, "").trim();
      const parts = m.split(/\s+/), w = parts[0];
      if (!w || !/^[a-z]+$/.test(w)) continue;
      out.add(BE.has(w) ? "be" : w);
      // "come to know" → also "know"
      const ti = parts.indexOf("to");
      if (ti > 0 && parts[ti + 1] && /^[a-z]+$/.test(parts[ti + 1])) out.add(parts[ti + 1]);
    }
    return [...out];
  }

  // ---------- Reading the English ----------
  function words(text) {
    return text.toLowerCase().replace(/[’‘`]/g, "'").replace(/y'all/g, "you all").replace(/\bya'll\b/g, "you all")
      .replace(/\bye\b/g, "you all").replace(/\byou guys\b/g, "you all").replace(/\ball of you\b/g, "you all")
      .replace(/\byou\s*\(\s*(pl|plural|all)\.?\s*\)/g, "you all").replace(/\byour\s*\(\s*(pl|plural)\.?\s*\)/g, "your all")
      .replace(/'ll\b/g, " will").replace(/n't\b/g, " not").replace(/'s\b/g, " 's").replace(/'re\b/g, " are").replace(/'ve\b/g, " have").replace(/'m\b/g, " am").replace(/'d\b/g, " would")
      .replace(/[,;:]/g, " , ").replace(/[\/()\[\]."!?\u2014\u2013]|--/g, " ").split(/\s+/).map((x) => (x === "'s" ? x : x.replace(/^'+|'+$/g, ""))).filter(Boolean);
  }
  const has = (w, ...xs) => xs.some((x) => w.includes(x));
  // Words that start a new clause: helpers before one of these belong to another verb.
  const CLAUSE = new Set([",", "and", "but", "that", "because", "while", "after", "when", "who", "which", "if", "so", "for", "since", "before", "until", "as", "whom", "where"]);
  function subject(w) {
    const s = w.join(" ");
    if (/\byou all\b/.test(s)) return "2P";
    if (w.includes("we")) return "1P";
    if (w.includes("i")) return "1S";
    if (has(w, "you", "thou")) return "2S";
    if (has(w, "they")) return "3P";
    if (has(w, "he", "she", "it", "one")) return "3S";
    return null;
  }
  const PERSON = { "1S": "I", "1P": "we", "2S": "you", "2P": "you all", "3S": "he / she / it", "3P": "they" };
  const TENSE = { P: "present", I: "imperfect", F: "future", A: "aorist", X: "perfect", Y: "pluperfect" };

  // Find which meaning the English uses, and how that verb is written.
  function findVerb(w, heads) {
    w = w.filter((x) => x !== ",");
    for (const hd of heads) {
      const f = forms(hd);
      for (let i = 0; i < w.length; i++) {
        const t = w[i], cats = [];
        for (const k of ["base", "s3", "pres", "ing", "past", "pp"]) if (f[k].includes(t)) cats.push(k);
        if (cats.length) return { head: hd, i, cats, f };
      }
    }
    return null;
  }

  // "“receive”, “take”" (no repeats, no leading "I").
  const listOf = (meanings) => [...new Set(meanings.map((m) => m.replace(/^\s*I\s+/, "").trim().toLowerCase()).filter(Boolean))].slice(0, 3).map((m) => "“" + m + "”").join(", ");

  // ---------- Verbs ----------
  function checkVerb(parse, lemma, meanings, text) {
    const all = words(text), w = all.filter((x) => x !== ",");
    const heads = verbHeads(meanings);
    const v = findVerb(w, heads);
    if (!v) return { ok: false, why: `Use one of its meanings: ${listOf(meanings)}.` };
    let [p, t, voice, mood] = [parse[0], parse[1], parse[2], parse[3]];
    const L0 = lemma.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // οἶδα is perfect in form but means "I know" (pluperfect "I knew").
    if (L0 === "οιδα") t = t === "X" ? "P" : t === "Y" ? "I" : t;
    const num = parse[5];
    // Helpers count only inside this verb's own clause ("while he was speaking, a Pharisee asks").
    let k = v.i, idx = -1;
    for (let j = 0, m = 0; j < all.length; j++) { if (all[j] === ",") continue; if (m === v.i) { idx = j; break; } m++; }
    let startC = 0;
    for (let j = idx - 1; j >= 0; j--) if (CLAUSE.has(all[j])) { startC = j + 1; break; }
    const before = all.slice(startC, idx).filter((x) => x !== ","), isCat = (c) => v.cats.includes(c);
    const anyIn = (...xs) => xs.some((x) => w.includes(x));
    const auxIn = (...xs) => before.some((x) => xs.includes(x));
    // The subject is the pronoun before the verb ("they take it", not "it").
    let subj = subject(before.length ? before : w.slice(0, v.i));
    if (before.includes("let") && before.includes("us")) subj = "1P";   // "let us eat"
    // Questions put the subject after the helper or verb: "are you …?", "do you know …?"
    if (!subj) { const after = subject(w.slice(v.i + 1, v.i + 3)); if (after && (v.i === 0 || ["do", "does", "did", "are", "is", "am", "will", "have", "has", "can", "how", "why", "what", "where"].includes(w[0]))) subj = after; }
    // Middle/passive deponents (ἔρχομαι, ἀποκρίνομαι) read as active.
    const deponent = /(μαι|ομαι)$/.test(lemma.normalize("NFD").replace(/[̀-ͯ]/g, ""));
    const passive = voice === "P" && !deponent && v.head !== "be";
    const beforeBe = before.filter((x) => BE.has(x));

    // Person and number (finite moods).
    // Subjunctive / optative: only catch a clash ("I" for "we"); "let us …", "do not …" need no pronoun.
    if ("123".includes(p) && ["S", "O"].includes(mood)) {
      const want = p + num;
      if (subj && subj !== want && !(want === "2P" && subj === "2S" && false)) {
        if (want === "2P" && subj === "2S") return { ok: false, why: "This verb is plural. “You” alone reads as one person, so write “you all” (or y'all)." };
        return { ok: false, why: `This verb is ${p === "1" ? "1st" : p === "2" ? "2nd" : "3rd"} person ${num === "P" ? "plural" : "singular"}: “${PERSON[want]} …”, not “${PERSON[subj]} …”.` };
      }
      return { ok: true };
    }
    if ("123".includes(p) && mood === "I") {
      const want = p + num;
      if (subj && subj !== want) {
        if (want === "2P" && subj === "2S") return { ok: false, why: "This verb is plural. “You” alone reads as one person, so write “you all” (or y'all)." };
        return { ok: false, why: `This verb is ${p === "1" ? "1st" : p === "2" ? "2nd" : "3rd"} person ${num === "P" ? "plural" : "singular"}: “${PERSON[want]} …”, not “${PERSON[subj]} …”.` };
      }
      // "am" can only be "I am".
      const implied = v.head === "be" && w[v.i] === "am" && want === "1S";
      if (!subj && p !== "3" && !implied) return { ok: false, why: `Say who does it. This verb is ${p === "1" ? "1st" : "2nd"} person ${num === "P" ? "plural" : "singular"}: “${PERSON[want]} …”.` };
      // No pronoun, 3rd person present: "has" for one, "have" for many.
      if (!subj && p === "3" && mood === "I" && t === "P" && !passive && !before.some((x) => BE.has(x) || x === "does" || x === "do")) {
        if (num === "S" && isCat("base") && !isCat("s3") && v.head !== "be") return { ok: false, why: `This verb is singular (he / she / it): “${v.f.s3[0]}”, not “${v.f.base[0]}”.` };
        if (num === "P" && isCat("s3") && !isCat("base")) return { ok: false, why: `This verb is plural (they): “${v.f.base[0]}”, not “${v.f.s3[0]}”.` };
      }
    }
    // Clauses that turn an infinitive or participle into a full English clause
    // (“before you ask”, “after he cried out”, “so that he was no longer…”).
    const SUB = ["before", "after", "while", "when", "because", "since", "so", "that", "until", "as", "who", "which", "whom", "the", "one", "ones", "may", "let", "in", "with"];
    if (mood === "N") {
      return w[v.i - 1] === "to" || isCat("ing") || before.includes("to") || anyIn(...SUB) ? { ok: true } : { ok: false, why: "This is an infinitive: “to …” (or a clause like “before he …”)." };
    }
    if (mood === "P") {
      const okP = isCat("ing") || isCat("pp") || before.includes("to") || before.includes("having") || anyIn(...SUB) || before.some((x) => BE.has(x));
      return okP ? { ok: true } : { ok: false, why: "This is a participle: “…ing” (or “the one who …”, “after he …”, “while …”)." };
    }
    if (mood === "M") {
      if (auxIn("will", "shall")) return { ok: false, why: "This is a command, not the future: just “…!” (or “let him …”)." };
      return { ok: true };
    }
    if (mood === "S" || mood === "O") return { ok: true };

    // Indicative: tense (and voice).
    const will = auxIn("will", "shall") || (before.includes("going") && before.includes("to"));
    const haveAux = auxIn("have", "has"), hadAux = auxIn("had");
    const wasWere = auxIn("was", "were"), amIsAre = auxIn("am", "is", "are");
    const tn = TENSE[t] || "this tense";
    if (passive) {
      const pp = isCat("pp");
      const ok =
        !pp ? false :
        t === "P" ? amIsAre || before.includes("being") :
        t === "I" ? wasWere :
        t === "F" ? will && before.includes("be") :
        t === "A" ? wasWere :
        t === "X" ? haveAux && before.includes("been") :
        t === "Y" ? hadAux && before.includes("been") : true;
      if (!ok) {
        const ex = { P: "is taken", I: "was being taken", F: "will be taken", A: "was taken", X: "has been taken", Y: "had been taken" }[t];
        return { ok: false, why: `This is ${tn} passive: something is done to the subject, like “${ex}”.` };
      }
      return { ok: true };
    }
    const be = v.head === "be";
    const prog = isCat("ing") && beforeBe.length;
    let ok;
    // Historical present: Greek stories often say "he says" where English says "he said".
    const HIST = ["λεγω", "ερχομαι", "ερωταω", "αγω", "φερω", "βλεπω", "λαλεω", "κραζω"];
    if (t === "P" && p === "3" && HIST.includes(L0) && isCat("past") && !will && !haveAux && !hadAux && !beforeBe.length) ok = true;
    else if (t === "P") ok = !will && !hadAux && !wasWere && !auxIn("did") && !(haveAux && isCat("pp") && !isCat("pres")) &&
      (be ? isCat("pres") : (isCat("pres") || (prog && amIsAre) || (auxIn("do", "does") && isCat("base"))));
    else if (t === "I") ok = !will && (be ? isCat("past") : ((prog && wasWere) || before.includes("used") || before.includes("kept") || before.includes("began") || before.includes("would") || (isCat("past") && !haveAux && !hadAux)));
    else if (t === "F") ok = will && (isCat("base") || (prog && before.includes("be")));
    else if (t === "A") ok = !will && !haveAux && !hadAux && !(prog && wasWere) && ((isCat("past") && !beforeBe.length) || (be && isCat("past")) || (auxIn("did") && isCat("base")));
    // Perfect: "has taken" (your professor sometimes writes the simple past, "I spoke").
    else if (t === "X") ok = (haveAux && isCat("pp")) || (isCat("past") && !will && !beforeBe.length && !hadAux);
    else if (t === "Y") ok = hadAux && isCat("pp");
    else ok = true;
    if (!ok) {
      const f = v.f, past = f.past[0], pp = f.pp[0], ing = f.ing[0];
      const ex = { P: `${f.s3[0]} / is ${ing}`, I: `was ${ing}`, F: `will ${f.base[0]}`, A: past, X: `has ${pp}`, Y: `had ${pp}` }[t];
      return { ok: false, why: `This verb is ${tn} tense, like “${ex}”.` };
    }
    return { ok: true };
  }

  // ---------- Nouns, adjectives, pronouns ----------
  const IRR_PL = { man: "men", woman: "women", child: "children", person: "people persons", foot: "feet", tooth: "teeth", mouse: "mice", ox: "oxen",
    brother: "brothers brethren", sheep: "sheep", fish: "fish fishes", wife: "wives", life: "lives", knife: "knives", leaf: "leaves", loaf: "loaves",
    thief: "thieves", wolf: "wolves", half: "halves", self: "selves", elder: "elders", gentile: "gentiles" };
  function plural(n) {
    if (IRR_PL[n]) return IRR_PL[n].split(" ");
    if (/(s|x|z|ch|sh)$/.test(n)) return [n + "es"];
    if (/[^aeiou]y$/.test(n)) return [n.slice(0, -1) + "ies"];
    return [n + "s"];
  }
  const STOP = new Set(["a", "an", "the", "of", "one", "to", "in", "on", "for", "and", "or", "with", "by", "from", "who", "that", "is", "be", "i", "someone", "something", "thing", "kind"]);
  const PRON = {
    // [nominative, possessive/genitive, object] for each person+number (+ gender for 3rd singular).
    "1S": ["i", "my mine", "me"], "1P": ["we", "our ours", "us"],
    "2S": ["you thou", "your yours thy thine", "you thee"], "2P": ["you all", "your all yours all you all", "you all"],
    "3SM": ["he himself", "his him himself", "him himself"], "3SF": ["she herself", "her hers herself", "her herself"],
    "3SN": ["it itself", "its it itself", "it itself"], "3P": ["they themselves", "their theirs them themselves", "them themselves"],
  };
  function checkNominal(info, kind, lemma, meanings, text) {
    const w = words(text), s = " " + w.join(" ") + " ";
    const parse = info.parse || "", cas = parse[4], num = parse[5], gen = parse[6];
    const L = lemma.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    // Personal pronouns: the English pronoun has to fit the person, number and case.
    const personal = { "εγω": "1", "συ": "2", "αυτος": "3", "ημεις": "1", "υμεις": "2" }[L];
    if (personal && cas && num) {
      const key = personal + num + (personal === "3" && num === "S" ? gen || "M" : "");
      const set = PRON[key] || PRON[personal + num];
      if (set) {
        const col = cas === "N" || cas === "V" ? 0 : cas === "G" ? 1 : 2;
        const okForms = set[col].split(" "), multi = okForms.filter((x) => x.includes(" ") || x === "all");
        const allPhrase = /you all|your all|yours all/.test(set[col]), joined = w.join(" ");
        const self = personal === "3" && (w.includes("same") || w.includes("very") || w.some((x) => /sel(f|ves)$/.test(x)));
        const hit = self ? true : allPhrase ? (col === 1 ? /\b(your all|yours all|of you all|you all 's)/.test(joined) || (w.includes("all") && w.includes("your")) : w.includes("you") && w.includes("all"))
          : okForms.some((x) => w.includes(x)) || (cas === "G" && w.includes("of") && set[2].split(" ").some((x) => w.includes(x)));
        if (!hit) {
          const nice = { 0: "the subject form", 1: "“of …” or the possessive", 2: "the object form" }[col];
          const ex = allPhrase ? (col === 0 ? "you all" : col === 1 ? "your (pl) / of you all" : "you all") : set[col].split(" ").slice(0, 2).join(" / ");
          return { ok: false, why: `This pronoun is ${{ N: "nominative", G: "genitive", D: "dative", A: "accusative", V: "vocative" }[cas]} ${num === "P" ? "plural" : "singular"}: use ${nice}, like “${ex}”.` };
        }
        return { ok: true };
      }
    }
    // Meaning: at least one real word from one of its meanings.
    const content = new Set();
    meanings.forEach((m) => {
      const ws = m.toLowerCase().replace(/\(.*?\)/g, " ").split(/[^a-z']+/).filter((x) => x && x.length > 1);
      const keep = ws.filter((x) => !STOP.has(x));
      (keep.length ? keep : ws).forEach((x) => content.add(x));   // "one" alone is a real meaning (εἷς)
    });
    let used = null, usedPlural = false;
    for (const c of content) {
      if (w.includes(c)) { used = c; break; }
      const pl = plural(c).find((x) => w.includes(x));
      if (pl) { used = c; usedPlural = pl !== c; break; }
      if (w.some((x) => x.length > 3 && c.length > 3 && x.startsWith(c.slice(0, -1)) && x.length <= c.length + 4)) { used = c; break; }   // good → goodness? close forms
    }
    if (!used && content.size) return { ok: false, why: `Use one of its meanings: ${listOf(meanings)}.` };
    // Number (nouns): λόγοι → “words”.
    if (kind === "Noun" && used && num && !/^[A-Z]/.test(meanings[0] || "")) {
      const pls = plural(used), same = pls.includes(used);
      if (num === "P" && !usedPlural && !same) return { ok: false, why: `This noun is plural: “${pls[0]}”, not “${used}”.` };
      if (num === "S" && usedPlural && !same) return { ok: false, why: `This noun is singular: “${used}”, not “${pls[0]}”.` };
    }
    // “of …” belongs to the genitive.
    if (cas && cas !== "G" && /^\s*(the\s+)?of\b/.test(text.toLowerCase()) && !meanings.some((m) => /^of\b/i.test(m))) {
      return { ok: false, why: `“of …” is for the genitive. This word is ${{ N: "nominative", D: "dative", A: "accusative", V: "vocative" }[cas] || "not genitive"}.` };
    }
    return { ok: true };
  }

  // ---------- Everything else (and, but, in, not …) ----------
  function checkPlain(meanings, text) {
    const w = words(text);
    const want = new Set();
    meanings.forEach((m) => m.toLowerCase().replace(/\(.*?\)/g, " ").split(/[^a-z']+/).forEach((x) => { if (x && x.length > 0) want.add(x); }));
    want.delete("i");
    if (!want.size || w.some((x) => want.has(x))) return { ok: true };
    return { ok: false, why: `Use one of its meanings: ${listOf(meanings)}.` };
  }

  // Common renderings the dictionary gloss leaves out.
  const EXTRA = {
    "γινομαι": "become, happen, be, come to pass, come", "λεγω": "say, tell, speak", "λαλεω": "speak, say, tell", "ερχομαι": "come, go",
    "ποιεω": "do, make", "διδωμι": "give, grant", "αφιημι": "forgive, leave, let, permit", "ιστημι": "stand, set, place", "τιθημι": "put, place, lay",
    "εγειρω": "raise, rise, arise, wake, get up", "καλεω": "call, invite, name", "ζητεω": "seek, look for", "ευρισκω": "find", "οραω": "see, look",
    "βλεπω": "see, look, watch", "εχω": "have, hold", "ακουω": "hear, listen", "γινωσκω": "know, understand, learn", "οιδα": "know",
    "αγαπαω": "love", "πιστευω": "believe, trust, entrust", "πορευομαι": "go, travel, proceed, depart, leave, journey", "αποκρινομαι": "answer, reply", "λαμβανω": "take, receive",
    "εσθιω": "eat", "πινω": "drink", "πεμπω": "send", "αποστελλω": "send", "μενω": "remain, stay, abide", "σωζω": "save, heal",
    "δοξαζω": "glorify, praise, honor", "κρινω": "judge, decide", "αγω": "lead, bring", "βαλλω": "throw, cast, put", "εκβαλλω": "cast out, throw out, drive out",
    "εισερχομαι": "enter, go in, come in", "εξερχομαι": "go out, come out", "αποθνησκω": "die", "αποκτεινω": "kill", "θελω": "want, wish, will, desire",
    "δυναμαι": "can, be able", "δει": "must, it is necessary", "ειμι": "be, exist",
    "αιρω": "take, take away, take up, lift, raise, remove, carry", "αρχω": "begin, rule, reign", "αρχομαι": "begin", "γενναω": "beget, give birth, bear, be born, father",
    "παρακαλεω": "urge, exhort, encourage, comfort, beg, ask, appeal", "προσερχομαι": "come to, go to, approach, come near", "αναβαινω": "go up, come up, ascend, climb",
    "απερχομαι": "go away, depart, leave, go", "εκπορευομαι": "go out, come out, proceed", "εξερχομαι": "go out, come out, get out, leave", "δεω": "bind, tie, must, be necessary",
    "βουλομαι": "wish, want, desire, intend", "θεωρεω": "see, watch, observe, behold", "παραδιδωμι": "hand over, give up, deliver, betray, give, entrust",
    "καταβαινω": "come down, go down, descend", "υπαγω": "go, go away, depart", "ακολουθεω": "follow", "διδασκω": "teach", "κηρυσσω": "preach, proclaim",
    "προσευχομαι": "pray", "αιτεω": "ask, request", "ερωταω": "ask, request, question", "γραφω": "write", "απολλυμι": "destroy, perish, lose, die",
    "φοβεομαι": "fear, be afraid",
    "ιεροσ": "temple, holy, sacred", "εντολη": "commandment, command", "εμοσ": "my, mine", "ιουδαιοσ": "jew, jewish, judean",
    "εισ": "one, someone, a, a certain, single", "πλοιον": "boat, ship", "εθνοσ": "nation, gentile, people", "ρημα": "word, saying, thing, matter",
    "μεσοσ": "midst, middle, among", "τελοσ": "end, goal, purpose", "παραγγελια": "instruction, command, order", "ανυποκριτοσ": "sincere, genuine",
    "τεκνον": "child", "αιων": "age, forever, ever, eternity, world", "λοιποσ": "rest, remaining, other, others", "πασ": "all, every, any, whole, everyone, everything",
    "ουρανοσ": "heaven, sky", "γη": "earth, land, ground", "οχλοσ": "crowd, multitude", "μαθητησ": "disciple", "οικοσ": "house, household, home",
    "οικια": "house, household, home", "ημερα": "day", "ωρα": "hour, time", "καρδια": "heart", "χειρ": "hand", "οφθαλμοσ": "eye", "κοσμοσ": "world",
    "αγιοσ": "holy, saint", "πνευμα": "spirit, wind, breath", "νομοσ": "law", "αμαρτια": "sin", "δικαιοσ": "righteous, just", "αγαθοσ": "good",
    "καλοσ": "good, beautiful, fine", "πολυσ": "many, much, great", "μεγασ": "great, large, big", "αλλοσ": "other, another", "εκεινοσ": "that, those, he",
    "ουτοσ": "this, these, he, she, it", "τισ": "who, what, which, why, someone, anyone, a certain", "οσ": "who, which, that, what, whom, whose", "χαιρω": "rejoice, be glad", "αναστασις": "resurrection", "πεμπω": "send", "μελλω": "be about to, will, intend",
  };
  const fold = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ς/g, "σ").replace(/σ/g, "σ");

  // info: { lemma, pos, parse }, kind: Verb/Noun/…, meanings: ["I take", "receive"…]
  function checkCtx(info, kind, meanings, text) {
    text = (text || "").trim();
    if (!text) return { ok: false, why: "Type how this word reads in this sentence." };
    if (!/[a-z]{2,}|\bi\b/i.test(text)) return { ok: false, why: "Write it in English." };
    const extra = info && EXTRA[fold(info.lemma || "").replace(/σ$/, "σ")];
    meanings = meanings.concat(extra ? extra.split(", ").map((m) => (kind === "Verb" ? "I " + m : m)) : []).map((m) => m.trim()).filter(Boolean);
    if (!meanings.length || !info) return { ok: true };   // nothing to check against
    if (kind === "Verb" && info.parse) return checkVerb(info.parse, info.lemma, meanings, text);
    if (["Noun", "Adjective", "Pronoun", "Article"].includes(kind)) {
      if (kind === "Article") return /\b(the|he|she|it|they|who|which|that|those|this|these|one|him|her|them|his|its|their)\b/i.test(text) ? { ok: true } : { ok: false, why: "The article is “the” (or “he / she / they” when it stands alone)." };
      return checkNominal(info, kind, info.lemma, meanings, text);
    }
    return checkPlain(meanings, text);
  }

  window.OENG = { checkCtx, forms, words, subject, _findVerb: findVerb, _verbHeads: verbHeads, EXTRA };
})();
