/* Rechendreieck - gemeinsame Aufgabenlogik
   Wird von rechendreieck.html (Arbeitsblatt) und
   interaktiv-rechendreieck.html (Bildschirm) genutzt.

   Feldbezeichner:
     Innenfelder (Kreise, Ecken):  T = oben, L = links unten, R = rechts unten
     Aussenfelder (Rechtecke):     TL = zwischen T und L
                                   TR = zwischen T und R
                                   LR = zwischen L und R
   Es gilt immer:  TL = T + L ,  TR = T + R ,  LR = L + R
*/
(function (root) {
  'use strict';

  /* Zahlenraum -> Maximalwert, den ein Aussenfeld annehmen darf */
  var RANGES = { 10: 10, 20: 20, 100: 100 };

  var LEVELS = {
    /* alle drei Innenzahlen gegeben -> nur Addition */
    leicht: function () { return ['T', 'L', 'R']; },

    /* eine Innenzahl + die beiden angrenzenden Aussenzahlen */
    mittel: function (rnd) {
      var opts = [
        ['T', 'TL', 'TR'],
        ['L', 'TL', 'LR'],
        ['R', 'TR', 'LR']
      ];
      return opts[ri(rnd, 0, 2)];
    },

    /* zwei Innenzahlen + eine Aussenzahl, die NICHT zwischen ihnen liegt.
       (Laege sie dazwischen, waere sie redundant und die dritte Ecke
       nicht bestimmbar.) */
    mittel2: function (rnd) {
      var opts = [
        ['T', 'L', 'TR'], ['T', 'L', 'LR'],
        ['T', 'R', 'TL'], ['T', 'R', 'LR'],
        ['L', 'R', 'TL'], ['L', 'R', 'TR']
      ];
      return opts[ri(rnd, 0, 5)];
    },

    /* nur die drei Aussenzahlen -> Ecken erschliessen (Knobelaufgabe) */
    schwer: function () { return ['TL', 'TR', 'LR']; }
  };

  var LEVEL_ORDER = ['leicht', 'mittel', 'mittel2', 'schwer'];

  function ri(rnd, min, max) {
    return Math.floor(rnd() * (max - min + 1)) + min;
  }

  /* Erzeugt ein einzelnes Rechendreieck.
     range: 10 | 20 | 100
     level: 'leicht' | 'mittel' | 'mittel2' | 'schwer' | 'gemischt'
     rnd:   optionale Zufallsfunktion (Standard Math.random)
     -> { vals:{T,L,R,TL,TR,LR}, given:[...], level:'...' }            */
  function makeTask(range, level, rnd) {
    rnd = rnd || Math.random;
    var max = RANGES[range] || 20;
    /* Ecken so waehlen, dass kein Aussenfeld den Zahlenraum sprengt.
       Untergrenze 1, damit keine 0-Ecken entstehen (didaktisch unschoen). */
    var hi = Math.max(2, Math.floor(max / 2));

    var a, b, c, tries = 0;
    do {
      a = ri(rnd, 1, hi);
      b = ri(rnd, 1, hi);
      c = ri(rnd, 1, hi);
      tries++;
      /* Bei ausschliesslich gleichen Ecken wird die Aufgabe trivial */
    } while (a === b && b === c && tries < 20);

    var vals = {
      T: a, L: b, R: c,
      TL: a + b, TR: a + c, LR: b + c
    };

    var lv = level;
    if (lv === 'gemischt' || !LEVELS[lv]) {
      lv = LEVEL_ORDER[ri(rnd, 0, LEVEL_ORDER.length - 1)];
    }

    return { vals: vals, given: LEVELS[lv](rnd), level: lv };
  }

  /* Eindeutiger Schluessel zur Dublettenpruefung auf einem Arbeitsblatt */
  function taskKey(task) {
    var v = task.vals;
    return v.T + '-' + v.L + '-' + v.R + '|' + task.given.slice().sort().join(',');
  }

  /* Erzeugt n verschiedene Aufgaben (mit Abbruch nach zu vielen Versuchen) */
  function makeTasks(n, range, level, rnd) {
    rnd = rnd || Math.random;
    var out = [], seen = {}, guard = 0;
    while (out.length < n && guard < n * 60) {
      guard++;
      var t = makeTask(range, level, rnd);
      var k = taskKey(t);
      if (seen[k]) continue;
      seen[k] = 1;
      out.push(t);
    }
    /* Falls der Zahlenraum zu klein fuer n verschiedene Aufgaben ist,
       wird ohne Dublettenpruefung aufgefuellt. */
    while (out.length < n) out.push(makeTask(range, level, rnd));
    return out;
  }

  /* Prueft die vom Kind eingetragenen Werte.
     answers: { feldname: zahl|'' }
     -> { ok:bool, richtig:n, gesamt:n, perField:{feld:bool} }          */
  function check(task, answers) {
    var per = {}, ok = 0, total = 0;
    for (var k in task.vals) {
      if (task.given.indexOf(k) !== -1) continue;
      total++;
      var got = parseInt(answers[k], 10);
      var good = (got === task.vals[k]);
      per[k] = good;
      if (good) ok++;
    }
    return { ok: ok === total, richtig: ok, gesamt: total, perField: per };
  }

  /* Selbsttest: stimmen die Summenbeziehungen und ist die Aufgabe loesbar? */
  function validate(task) {
    var v = task.vals;
    if (v.TL !== v.T + v.L) return 'TL falsch';
    if (v.TR !== v.T + v.R) return 'TR falsch';
    if (v.LR !== v.L + v.R) return 'LR falsch';
    if (task.given.length !== 3) return 'nicht genau 3 gegebene Felder';
    /* Loesbarkeit: aus 3 gegebenen Feldern muessen alle 6 folgen. */
    var known = {};
    task.given.forEach(function (g) { known[g] = true; });
    for (var pass = 0; pass < 8; pass++) {
      /* Aussenfeld aus zwei Innenfeldern */
      tryFill(known, ['T', 'L'], 'TL');
      tryFill(known, ['T', 'R'], 'TR');
      tryFill(known, ['L', 'R'], 'LR');
      /* Innenfeld aus Aussenfeld minus Innenfeld */
      tryFill(known, ['TL', 'L'], 'T'); tryFill(known, ['TL', 'T'], 'L');
      tryFill(known, ['TR', 'R'], 'T'); tryFill(known, ['TR', 'T'], 'R');
      tryFill(known, ['LR', 'R'], 'L'); tryFill(known, ['LR', 'L'], 'R');
      /* Knobelfall: alle drei Aussenfelder gegeben */
      if (known.TL && known.TR && known.LR) {
        known.T = known.L = known.R = true;
      }
    }
    var all = ['T', 'L', 'R', 'TL', 'TR', 'LR'];
    for (var i = 0; i < all.length; i++) {
      if (!known[all[i]]) return 'nicht eindeutig loesbar (' + all[i] + ')';
    }
    return null;
  }

  function tryFill(known, from, to) {
    if (known[from[0]] && known[from[1]]) known[to] = true;
  }

  root.Rechendreieck = {
    RANGES: RANGES,
    LEVEL_ORDER: LEVEL_ORDER,
    makeTask: makeTask,
    makeTasks: makeTasks,
    taskKey: taskKey,
    check: check,
    validate: validate
  };
})(typeof window !== 'undefined' ? window : globalThis);
