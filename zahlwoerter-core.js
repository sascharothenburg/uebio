/* =====================================================================
   zahlwoerter-core.js  ·  Zahlwörter und römische Zahlen
   © 2026 Sascha Rothenburg

   Wird von zahlwoerter.html (Arbeitsblatt) und
   interaktiv-zahlwoerter.html genutzt.

   Schreibweise der Zahlwörter (systematisch, wie in den meisten
   Lehrwerken für den Zahlenraum bis 1000):
     100  -> einhundert      1000 -> eintausend
     101  -> einhunderteins  121  -> einhunderteinundzwanzig
   Die Stolpersteine sind bewusst ausgeschrieben und nicht abgeleitet:
     16 sechzehn (nicht sechszehn)   17 siebzehn (nicht siebenzehn)
     30 dreißig (mit ß)              60 sechzig    70 siebzig
   aber:
     600 sechshundert (mit s)        700 siebenhundert
   ===================================================================== */
(function (root) {
  'use strict';

  /* 0-19 als feste Wörter - hier sitzen die meisten Unregelmäßigkeiten */
  var ONES = [
    'null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun',
    'zehn','elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn',
    'achtzehn','neunzehn'
  ];

  /* Zehner. Index 0 und 1 werden nie benutzt (0-19 kommen aus ONES). */
  var TENS = [
    '','zehn','zwanzig','dreißig','vierzig','fünfzig','sechzig','siebzig',
    'achtzig','neunzig'
  ];

  /* Der Einer in Verbindungen: "ein-und-zwanzig", nicht "eins-und-zwanzig".
     Vor "hundert"/"tausend" gilt dasselbe: "einhundert". */
  function bindeform(n) {
    return n === 1 ? 'ein' : ONES[n];
  }

  /* Zahlwort für 0-99 */
  function unter100(n) {
    if (n < 20) return ONES[n];
    var z = Math.floor(n / 10), e = n % 10;
    if (e === 0) return TENS[z];
    return bindeform(e) + 'und' + TENS[z];
  }

  /* Zahlwort für 0-1000 */
  function zahlwort(n) {
    n = Math.round(n);
    if (n < 0 || n > 1000) return null;
    if (n === 1000) return 'eintausend';
    if (n < 100) return unter100(n);
    var h = Math.floor(n / 100), rest = n % 100;
    /* 600 = sechshundert, 700 = siebenhundert: hier bleibt das volle
       Grundwort stehen, anders als bei sechzig/siebzig. */
    var wort = bindeform(h) + 'hundert';
    if (rest > 0) wort += unter100(rest);
    return wort;
  }

  /* ---- Römische Zahlen 1-1000, subtraktive Schreibweise ---- */
  var ROM = [
    [1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],
    [50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']
  ];

  function roemisch(n) {
    n = Math.round(n);
    if (n < 1 || n > 1000) return null;   /* die Null gibt es nicht */
    var out = '';
    for (var i = 0; i < ROM.length; i++) {
      while (n >= ROM[i][0]) { out += ROM[i][1]; n -= ROM[i][0]; }
    }
    return out;
  }

  var ROMVAL = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };
  function ausRoemisch(s) {
    if (!s) return null;
    s = String(s).toUpperCase().trim();
    if (!/^[IVXLCDM]+$/.test(s)) return null;
    var sum = 0;
    for (var i = 0; i < s.length; i++) {
      var v = ROMVAL[s[i]], next = ROMVAL[s[i+1]];
      sum += (next && next > v) ? -v : v;
    }
    /* Nur kanonische Schreibweisen gelten (IIII wird abgelehnt) */
    return roemisch(sum) === s ? sum : null;
  }

  /* ---- Zahlendreher ----
     Zahlen, bei denen Sprech- und Schreibreihenfolge auseinanderfallen:
     zweistellig, beide Ziffern verschieden, keine glatte Zehnerzahl.
     "einundzwanzig" wird leicht als 12 geschrieben. */
  function istDreher(n) {
    if (n < 13 || n > 99) return false;
    var z = Math.floor(n / 10), e = n % 10;
    return e !== 0 && z !== e;
  }
  function dreh(n) {
    return (n % 10) * 10 + Math.floor(n / 10);
  }

  /* ---- Aufgabentypen ---- */
  var TYPEN = {
    'zahl2wort':  { label: 'Ziffer \u2192 Zahlwort',  min: 0, max: 1000 },
    'wort2zahl':  { label: 'Zahlwort \u2192 Ziffer',  min: 0, max: 1000 },
    'dreher':     { label: 'Zahlendreher',            min: 13, max: 99 },
    'zahl2rom':   { label: 'Ziffer \u2192 r\u00f6misch', min: 1, max: 1000 },
    'rom2zahl':   { label: 'R\u00f6misch \u2192 Ziffer', min: 1, max: 1000 }
  };

  function ri(rnd, a, b) { return Math.floor(rnd() * (b - a + 1)) + a; }

  /* Erzeugt eine Aufgabe.
     typ: Schlüssel aus TYPEN, max: Obergrenze des Zahlenraums
     -> { typ, n, frage, loesung, wahl? }                                */
  function makeTask(typ, max, rnd) {
    rnd = rnd || Math.random;
    var t = TYPEN[typ];
    if (!t) return null;
    var lo = t.min, hi = Math.min(t.max, max);
    if (hi < lo) return null;

    var n;
    if (typ === 'dreher') {
      var guard = 0;
      do { n = ri(rnd, lo, hi); guard++; } while (!istDreher(n) && guard < 200);
      if (!istDreher(n)) n = 21;
      return { typ: typ, n: n, frage: zahlwort(n), loesung: String(n),
               wahl: rnd() < 0.5 ? [n, dreh(n)] : [dreh(n), n] };
    }
    n = ri(rnd, lo, hi);
    switch (typ) {
      case 'zahl2wort': return { typ: typ, n: n, frage: String(n), loesung: zahlwort(n) };
      case 'wort2zahl': return { typ: typ, n: n, frage: zahlwort(n), loesung: String(n) };
      case 'zahl2rom':  return { typ: typ, n: n, frage: String(n), loesung: roemisch(n) };
      case 'rom2zahl':  return { typ: typ, n: n, frage: roemisch(n), loesung: String(n) };
    }
    return null;
  }

  function taskKey(t) { return t.typ + ':' + t.n; }

  /* n verschiedene Aufgaben, gleichmäßig über die gewählten Typen */
  function makeTasks(n, typen, max, rnd) {
    rnd = rnd || Math.random;
    typen = (typen && typen.length) ? typen : ['zahl2wort'];
    var out = [], seen = {}, guard = 0;
    while (out.length < n && guard < n * 80) {
      guard++;
      var t = makeTask(typen[out.length % typen.length], max, rnd);
      if (!t) continue;
      var k = taskKey(t);
      if (seen[k]) continue;
      seen[k] = 1;
      out.push(t);
    }
    /* Reicht der Zahlenraum nicht für n verschiedene Aufgaben,
       wird ohne Dublettenprüfung aufgefüllt. */
    while (out.length < n) {
      var f = makeTask(typen[out.length % typen.length], max, rnd);
      if (!f) break;
      out.push(f);
    }
    return out;
  }

  root.Zahlwoerter = {
    ONES: ONES, TENS: TENS, TYPEN: TYPEN,
    zahlwort: zahlwort,
    roemisch: roemisch,
    ausRoemisch: ausRoemisch,
    istDreher: istDreher,
    dreh: dreh,
    makeTask: makeTask,
    makeTasks: makeTasks,
    taskKey: taskKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
