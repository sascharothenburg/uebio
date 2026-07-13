/* =====================================================================
   schreibschrift-pdf.js  ·  PDF-Modul für die Schreibschrift-SAS-App (pdf-lib)
   © 2026 Sascha Rothenburg · Bienchen SAS von Peter Wiegel (SIL OFL 1.1)

   Erzeugt Schulausgangsschrift-Arbeitsblätter mit 4-Linien-Lineatur
   (Oberzone/Mittelband/Unterzone), analog zu schreiben-pdf.js aber mit
   asymmetrischer Bänderung für Ober- und Unterlängen der Schreibschrift.

   Ein Arbeitsblatt kombiniert bis zu drei Abschnitte in dieser Reihenfolge:
   Buchstaben -> Wörter -> Sätze (pädagogische Progression). Abschnitte mit
   leerer Auswahl werden übersprungen.

   Abhängigkeiten (global): window.PDFLib (pdf-lib), window.fontkit (@pdf-lib/fontkit)
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645; // 1mm in pt

  // ---- A4-Geometrie (pt) -------------------------------------------
  const PT = {
    pageW: 595.28,
    pageH: 841.89,
    marginX: 14 * MM,
    marginY: 12 * MM,
  };
  PT.contentW = PT.pageW - PT.marginX * 2;
  PT.contentH = PT.pageH - PT.marginY * 2;

  // ---- Lineatur-Maße (4-Linien-System für Schreibschrift) -----------
  // Gemessen an Bienchen SAS (unitsPerEm 2100): xHeight=595 (beide Varianten
  // gleich), Ascent Regular=1100, Ascent Italic(Einzelbuchstaben)=1500,
  // Descent=600 (beide). Ober-/Unterzonen daraus abgeleitet + Sicherheitsmarge.
  const LIN = {
    band: 5 * MM,                 // Mittelband (x-Höhen-Zone), wie Grundschrift-App
    XHEIGHT_RATIO: 0.2833,
    get vfont() { return this.band / this.XHEIGHT_RATIO; },
    get oberWord() { return this.band * 1.05; },  // Oberzone Wörter/Sätze (Versalien, Ober­längen) - Marge ueber realer Glyphenhoehe, nicht nur ueber der nominalen Ascent-Metrik
    get oberLetter() { return this.oberWord; }, // Oberzone Einzelbuchstaben - identisch zu Woertern/Saetzen (echte Glyphenhoehen sind fuer Italic-Versalien nicht groesser als fuer Regular-Versalien, siehe Kommentar oben)
    get unter() { return this.band * 1.05; },     // Unterzone (Unterlängen g,j,y,q - beide Varianten gleich)
    get totalWord() { return this.oberWord + this.band + this.unter; },
    get totalLetter() { return this.oberLetter + this.band + this.unter; },
    rowGap: 5 * MM,
    labelH: 13,
    corner: 5.5 * MM,
    textInset: 6 * MM,
  };
  const MIN_SHRINK = 0.8;      // ab hier lieber umbrechen statt weiter schrumpfen
  const SENTENCE_MIN_SCALE = 0.7; // harte Untergrenze, auch nach Umbruch auf 2 Zeilen
  const LINE_GAP = LIN.band * 0.35; // Abstand zwischen zwei umgebrochenen Satz-Zeilen
  const LETTER_SINGLE_GAP = 0.85 * MM; // Abstand zwischen Buchstaben im 1-Zeilen-Modus (kompakter als rowGap, damit 12 Buchstaben auf eine Seite passen)

  // ---- Farben (Deutsch-Rot) ------------------------------------------
  const C = {
    red:     rgb01(0xb9, 0x1c, 0x1c),
    ink:     rgb01(0x1e, 0x29, 0x3b),
    sub:     rgb01(0x55, 0x55, 0x55),
    metaLine:rgb01(0x88, 0x88, 0x88),
    paper:   rgb01(0xfe, 0xf9, 0xc3),
    frame:   rgb01(0x44, 0x44, 0x44),
    bandBg:  rgb01(0xdb, 0xea, 0xfe),
    grund:   rgb01(0x1d, 0x4e, 0xd8),
    help:    rgb01(0x60, 0xa5, 0xfa),
    dash:    rgb01(0x93, 0xc5, 0xfd),
    corner:  rgb01(0x33, 0x33, 0x33),
    vtext:   rgb01(0x4b, 0x82, 0xc3),
  };
  function rgb01(r, g, b) { return { r: r / 255, g: g / 255, b: b / 255 }; }
  function col(c) { return c ? global.PDFLib.rgb(c.r, c.g, c.b) : undefined; }

  // ---- Zeichen-Kontext (Top-Left-Koordinaten -> pdf-lib) -------------
  function makePageCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, opts) {
        page.drawRectangle({
          x, y: PT.pageH - yTop - h, width: w, height: h,
          color: col(opts.fill), borderColor: col(opts.stroke),
          borderWidth: opts.strokeWidth || 0,
          borderDashArray: opts.dash || undefined,
          opacity: opts.opacity, borderOpacity: opts.borderOpacity,
        });
      },
      line(x1, y1Top, x2, y2Top, opts) {
        page.drawLine({
          start: { x: x1, y: PT.pageH - y1Top },
          end:   { x: x2, y: PT.pageH - y2Top },
          thickness: opts.w || 1, color: col(opts.color),
          dashArray: opts.dash || undefined,
        });
      },
      text(str, x, yTop, opts) {
        const f = opts.font || fonts.regular;
        const size = opts.size || 10;
        const ascent = f.heightAtSize(size) * 0.8;
        page.drawText(String(str), {
          x, y: PT.pageH - yTop - ascent, size, font: f,
          color: col(opts.color) || col(C.ink),
          opacity: opts.opacity,
        });
      },
      textBaseline(str, x, yBaseline, opts) {
        const f = opts.font || fonts.regular;
        const size = opts.size || 10;
        page.drawText(String(str), {
          x, y: PT.pageH - yBaseline, size, font: f,
          color: col(opts.color) || col(C.ink),
          opacity: opts.opacity,
        });
      },
      textWidth(str, font, size) { return font.widthOfTextAtSize(String(str), size); },
    };
  }

  // =================================================================
  //  BIENCHEN-SAS TRANSLITERATION
  //  Die Fonts haben KEIN GSUB (keine Ligaturen) - die Verbindungen
  //  entstehen rein durch manuelles Einfügen von Steuerzeichen und
  //  Font-Wechsel zwischen Font a (regulär) und Font b (kursiv), exakt
  //  wie in der offiziellen Bienchen-SAS-Anleitung (Peter Wiegel) beschrieben:
  //   - \  am Wortanfang vor Kleinbuchstaben: vollständiger Anstrich
  //   - ~  nach "oben verbindenden" Buchstaben b,o,r,v,w,x: Verlängerung
  //        auf x-Höhe (am Wortende oder vor u,v,w,y)
  //   - nach b,o,r,v,w,x (wenn NICHT vor u,v,w,y) sowie nach A,F,H:
  //        der folgende Buchstabe wird in Font b (kursiv) gesetzt
  //   - §  ersetzt/ergänzt Schluss-s, ß und die Kombination "st"
  //   - einzeln stehende Großbuchstaben werden komplett in Font b gesetzt
  // =================================================================
  const UPPER_CONNECT = { b: 1, o: 1, r: 1, v: 1, w: 1, x: 1 };
  const CAP_TRIGGER   = { A: 1, F: 1, H: 1 };
  const NO_LEAD_STROKE = { z: 1, m: 1, n: 1, r: 1, a: 1, ä: 1, u: 1, ü: 1, v: 1, w: 1, x: 1 }; // Buchstaben, die am Wortanfang/isoliert die saubere Italic-Form OHNE Anstrich nutzen. (a/ae/u/ue/v/w/x waren testweise auf Regular-Anstrich+Italic (ITALIC_LEAD) - das erzeugte aber einen sichtbar unverbundenen Strich, da pdf-lib keine GPOS-Positionierung anwendet. Pragmatischer Fix: wie z/m/n/r behandeln.)

  // Zerlegt EIN Wort (nur Buchstaben, keine Leerzeichen/Satzzeichen) in
  // Runs {text, italic}. Wendet \-, ~- und §-Regeln + Font-a/b-Wechsel an.
  function composeWord(word) {
    const chars = word.split('');
    const n = chars.length;
    const runs = [];
    let curItalic = false;
    let buf = '';
    function flush() { if (buf) { runs.push({ text: buf, italic: curItalic }); buf = ''; } }
    function setItalic(v) { if (v !== curItalic) { flush(); curItalic = v; } }

    let forceItalicNext = false;
    for (let i = 0; i < n; i++) {
      const ch = chars[i];
      const lower = ch.toLowerCase();
      const isFirst = i === 0;
      const isLast = i === n - 1;
      const nextCh = isLast ? null : chars[i + 1];
      const nextLower = nextCh ? nextCh.toLowerCase() : null;

      // Sonderfall: "st" -> s + § + t (Bienchen-SAS-Anleitung: bestaetigt durch "ist"->"is§t", "Mustertext"->"Mus§tertext")
      if (ch === 's' && nextCh === 't' && !isLast) {
        setItalic(false); buf += ch + '§';
        continue;
      }
      // Sonderfall: "sc" (i.d.R. "sch") -> s + § + c (bestaetigt durch "getaeuscht"->"getaeus§cht",
      // "labyrinthisch"->"labyrinthis§ch", "hinweggeschwunden"->"hinwegges§chwunden")
      if (ch === 's' && nextCh === 'c' && !isLast) {
        setItalic(false); buf += ch + '§';
        continue;
      }
      // Sonderfall: "ßi" -> ß + § + i
      if (ch === 'ß' && nextCh === 'i' && !isLast) {
        setItalic(false); buf += ch + '§';
        continue;
      }
      // WICHTIG: s/ß am tatsaechlichen Wortende (nichts folgt) bleiben literal!
      // Die Anleitung zeigt "Das"->"D\as" und "Lebens"->"Lebens" (beides mit
      // normalem, literalem 's' am Wortende, KEIN §). § ist nur ein
      // Verbindungszeichen zwischen s/ss und einem folgenden Konsonanten,
      // kein Ersatz fuer Schluss-s allgemein - die vorherige Regel
      // ("isLast -> §") beruhte auf einem Fehlschluss und fuehrte dazu, dass
      // § (LSB -398 von 2100 - fast seine gesamte Breite) fast vollstaendig
      // unter dem vorherigen Buchstaben verschwand (z.B. bei "Fuchs").

      const useItalic = forceItalicNext;
      forceItalicNext = false;
      setItalic(useItalic);

      if (isFirst && ch === lower && /[a-zäöü]/.test(lower) && NO_LEAD_STROKE[lower]) {
        // z/m/n/r/a/ä/u/ü/v/w/x: kein Anstrich, saubere Italic-Form statt Regular
        setItalic(true);
        buf += ch;
        setItalic(false);
      } else if (isFirst && ch === lower && /[a-zäöü]/.test(lower)) {
        buf += '\\' + ch; // Wortanfang: voller Anstrich
      } else {
        buf += ch;
      }

      if (ch === lower && UPPER_CONNECT[lower]) {
        if (nextCh) {
          forceItalicNext = true;
        }
        // Weder Wortende noch vor u/v/w/y wird noch eine '~'-Verlaengerung
        // gesetzt: ohne GPOS-Unterstuetzung in pdf-lib sitzt das Zeichen
        // nicht direkt am Buchstaben-Ende, sondern wirkt wie ein separates,
        // angeklebtes Sonderzeichen (siehe Wortende-Fix weiter oben).
      } else if (CAP_TRIGGER[ch] && nextCh) {
        forceItalicNext = true;
      }
    }
    flush();
    return runs;
  }

  // Einzelner, isoliert stehender Buchstabe (Buchstaben-Übungsmodus):
  // Kleinbuchstaben -> Font a mit vollem Anstrich; Großbuchstaben einzeln
  // -> komplett Font b.
  // WICHTIG: '§' (Schluss-s) ist im Bienchen-SAS-Font NUR ein winziger
  // Abschluss-Haken (Versionsbreite ~3% em), der eine VORAUSGEHENDE Feder
  // fortsetzt - er hat keine eigenstaendige Buchstabenform und ist daher
  // fuer isoliertes Buchstaben-Uben ungeeignet (wird bei Wiederholung durch
  // die winzige Laufweite zu einem unlesbaren Strich verschmiert). Fuer die
  // Einzelbuchstaben-Praxis daher immer die normale 's'-Glyphe verwenden.
  // Ebenso wird die abschliessende '~'-Verlaengerung (Wortende-Bogen) bei
  // Einzelbuchstaben weggelassen, da nichts folgt, das sie verbindet.
  function composeStandaloneLetter(ch) {
    const lower = ch.toLowerCase();
    if (lower === 's') return [{ text: '\\s', italic: false }];
    if (ch === 'ß') return [{ text: '\\' + ch, italic: false }];
    if (ch !== lower) return [{ text: ch, italic: true }]; // Versal einzeln -> kursiv
    if (NO_LEAD_STROKE[lower]) return [{ text: ch, italic: true }]; // z/m/n/r/a/ä/u/ü/v/w/x: ohne Anstrich, saubere Italic-Form statt Regular
    return [{ text: '\\' + ch, italic: false }];
  }

  // Ganzer Text (Wort ODER Satz): an Leerzeichen trennen, Satzzeichen am
  // Wortende abtrennen (bleiben regulär/undekoriert), pro Wort composeWord().
  function composePhrase(text) {
    const tokens = String(text).split(/(\s+)/); // Leerzeichen als eigene Tokens behalten
    const runs = [];
    tokens.forEach(tok => {
      if (!tok) return;
      if (/^\s+$/.test(tok)) { runs.push({ text: tok, italic: false }); return; }
      const m = tok.match(/^([^\s]*?)([.,!?;:„"']*)$/);
      const core = m ? m[1] : tok;
      const trail = m ? m[2] : '';
      if (core) runs.push(...composeWord(core));
      if (trail) runs.push({ text: trail, italic: false });
    });
    return runs;
  }

  function measureRuns(ctx, runs, fontReg, fontIta, size) {
    let w = 0;
    runs.forEach(r => { w += ctx.textWidth(r.text, r.italic ? fontIta : fontReg, size); });
    return w;
  }

  function drawRuns(ctx, runs, x0, baseline, size, fontReg, fontIta, color, opacity) {
    let x = x0;
    runs.forEach(r => {
      const font = r.italic ? fontIta : fontReg;
      ctx.textBaseline(r.text, x, baseline, { font, size, color, opacity });
      x += ctx.textWidth(r.text, font, size);
    });
    return x - x0;
  }


  function drawRow4(ctx, xLeft, yTop, width, oberH, unterH) {
    const band = LIN.band;
    const total = oberH + band + unterH;
    const right = xLeft + width;

    ctx.rect(xLeft, yTop, width, total, { fill: C.paper, stroke: C.frame, strokeWidth: 1.5 });

    const hilfsY = yTop + oberH;      // Hilfslinie (oben, Ende Oberzone)
    const grundY = yTop + oberH + band; // Grundlinie (Basislinie)

    ctx.rect(xLeft, hilfsY, width, band, { fill: C.bandBg, opacity: 0.7 });

    ctx.line(xLeft, yTop, right, yTop, { color: C.help, w: 1 });                 // Oberlinie
    ctx.line(xLeft, hilfsY, right, hilfsY, { color: C.dash, w: 1, dash: [3, 2] }); // Hilfslinie
    ctx.line(xLeft, grundY, right, grundY, { color: C.grund, w: 2 });            // Grundlinie
    ctx.line(xLeft, yTop + total, right, yTop + total, { color: C.help, w: 1 }); // Unterlinie

    const cl = LIN.corner;
    const mark = (cx, cy, dx, dy) => {
      ctx.line(cx, cy, cx + dx, cy, { color: C.corner, w: 2 });
      ctx.line(cx, cy, cx, cy + dy, { color: C.corner, w: 2 });
    };
    mark(xLeft, yTop, cl, cl);
    mark(right, yTop, -cl, cl);
    mark(xLeft, yTop + total, cl, -cl);
    mark(right, yTop + total, -cl, -cl);

    return grundY;
  }

  function drawWordRow(ctx, xLeft, yTop, width, text, showV, fontReg, fontIta) {
    const grundY = drawRow4(ctx, xLeft, yTop, width, LIN.oberWord, LIN.unter);
    if (showV && text) {
      const runs = composePhrase(text);
      let size = LIN.vfont;
      const avail = width - LIN.textInset * 2;
      const w0 = measureRuns(ctx, runs, fontReg, fontIta, size);
      if (w0 > avail) size = size * (avail / w0);
      drawRuns(ctx, runs, xLeft + LIN.textInset, grundY, size, fontReg, fontIta, C.vtext, 0.40);
    }
  }

  // Breite einer ganzen Phrase bei gegebener Groesse (ohne ctx, nur Fonts noetig)
  function measurePhraseWidth(text, fontReg, fontIta, size) {
    let w = 0;
    composePhrase(text).forEach(r => {
      w += (r.italic ? fontIta : fontReg).widthOfTextAtSize(String(r.text), size);
    });
    return w;
  }

  // Plant 1 oder 2 Zeilen fuer einen Satz: erst leicht schrumpfen (bis MIN_SHRINK),
  // erst danach an einer Wortgrenze umbrechen (statt die Schrift bis zur
  // Unleserlichkeit zu verkleinern).
  function planSentenceLines(text, fontReg, fontIta, avail) {
    const full = LIN.vfont;
    const w0 = measurePhraseWidth(text, fontReg, fontIta, full);
    if (w0 <= avail) return { lines: [text], size: full };

    const shrunk = full * (avail / w0);
    if (shrunk >= full * MIN_SHRINK) return { lines: [text], size: shrunk };

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      return { lines: [text], size: Math.max(shrunk, full * SENTENCE_MIN_SCALE) };
    }
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const line1 = words.slice(0, i).join(' ');
      const line2 = words.slice(i).join(' ');
      const w1 = measurePhraseWidth(line1, fontReg, fontIta, full);
      const w2 = measurePhraseWidth(line2, fontReg, fontIta, full);
      const worst = Math.max(w1, w2);
      if (!best || worst < best.worst) best = { line1, line2, worst };
    }
    let size = full;
    if (best.worst > avail) size = full * (avail / best.worst);
    size = Math.max(size, full * SENTENCE_MIN_SCALE);
    return { lines: [best.line1, best.line2], size };
  }

  // Zeichnet einen Satz als 1 oder 2 gestapelte Lineatur-Zeilen (siehe planSentenceLines).
  // Gibt die Anzahl gezeichneter Zeilen zurueck.
  function drawSentenceRows(ctx, xLeft, yTop, width, text, showV, fontReg, fontIta) {
    const avail = width - LIN.textInset * 2;
    const plan = (showV && text) ? planSentenceLines(text, fontReg, fontIta, avail) : { lines: [''], size: LIN.vfont };
    let rowTop = yTop;
    plan.lines.forEach(line => {
      const grundY = drawRow4(ctx, xLeft, rowTop, width, LIN.oberWord, LIN.unter);
      if (showV && line) {
        const runs = composePhrase(line);
        drawRuns(ctx, runs, xLeft + LIN.textInset, grundY, plan.size, fontReg, fontIta, C.vtext, 0.40);
      }
      rowTop += LIN.totalWord + LINE_GAP;
    });
    return plan.lines.length;
  }

  // Bei den meisten Buchstaben ist Tinte-Breite ~ Laufweite (Faktor ~1.05-1.15),
  // der Standard-Repeat-Abstand (1.55x Laufweite) reicht dann locker. Bei
  // einigen Italic-Glyphen (a/ae/x/z) ist die Tinte aber 50-61% breiter als
  // die Laufweite (per fontTools nachgemessen) - Standard-Abstand quetscht
  // sie dann sichtbar zusammen. Explizite Korrektur je Buchstabe:
  // Ziel: sichtbare Luecke nach der Tinte soll ~44% der Tinten-Breite betragen
  // (das Verhaeltnis, das Regular-Buchstaben wie 'b' von Natur aus haben, weil
  // deren Tinte-Breite nah an der Laufweite liegt). Fuer die Italic-Only-
  // Buchstaben (siehe NO_LEAD_STROKE) weicht die Tinte-Breite von der
  // Laufweite ab (per fontTools nachgemessen) - deshalb explizite Multiplikatoren:
  const LETTER_STEP_MULT = { z: 2.16, m: 1.53, n: 1.58, r: 1.6, a: 2.32, ä: 2.32, u: 1.9, ü: 1.84, v: 1.8, w: 1.73, x: 2.28 };
  const LETTER_INK_RATIO = { z: 1.5, m: 1.06, n: 1.1, r: 1.11, a: 1.61, ä: 1.61, u: 1.32, ü: 1.28, v: 1.25, w: 1.2, x: 1.58 };

  function drawLetterRepeatRow(ctx, xLeft, yTop, width, letter, fontReg, fontIta) {
    const grundY = drawRow4(ctx, xLeft, yTop, width, LIN.oberLetter, LIN.unter);
    const size = LIN.vfont;
    const runs = composeStandaloneLetter(letter);
    const unitW = measureRuns(ctx, runs, fontReg, fontIta, size);
    const mult = LETTER_STEP_MULT[letter.toLowerCase()] || 1.55;
    const inkW = unitW * (LETTER_INK_RATIO[letter.toLowerCase()] || 1.15);
    const step = unitW * mult;
    let x = xLeft + LIN.textInset;
    const rightLimit = xLeft + width - LIN.textInset;
    while (x + inkW <= rightLimit) {
      drawRuns(ctx, runs, x, grundY, size, fontReg, fontIta, C.vtext, 0.40);
      x += step;
    }
  }

  function drawLetterModelRow(ctx, xLeft, yTop, width, letter, fontReg, fontIta) {
    const grundY = drawRow4(ctx, xLeft, yTop, width, LIN.oberLetter, LIN.unter);
    const size = LIN.vfont;
    const runs = composeStandaloneLetter(letter);
    drawRuns(ctx, runs, xLeft + LIN.textInset, grundY, size, fontReg, fontIta, C.vtext, 0.40);
  }

  // =================================================================
  //  HEADER
  // =================================================================
  function drawHeader(ctx, opts) {
    const F = ctx.fonts;
    const top = PT.marginY;
    const title = opts.title || 'Schreibschrift üben';
    const sub = opts.sub || 'Schulausgangsschrift: Buchstaben, Wörter, Sätze';
    ctx.text(title, PT.marginX, top, { font: F.heavy, size: 14, color: C.red });
    ctx.text(sub, PT.marginX, top + 18, { font: F.regular, size: 8, color: C.sub });

    const fields = [];
    if (opts.showName) fields.push(['Name:', 95]);
    if (opts.showDate) fields.push(['Datum:', 55]);
    if (opts.showKl)   fields.push(['Klasse:', 32]);
    const right = PT.pageW - PT.marginX;
    const gap = 14, my = top + 1;
    let totalW = 0;
    fields.forEach(f => { totalW += ctx.textWidth(f[0], F.regular, 8) + 3 + f[1] + gap; });
    totalW -= gap;
    let mx = right - totalW;
    fields.forEach(f => {
      const labW = ctx.textWidth(f[0], F.regular, 8);
      ctx.text(f[0], mx, my, { font: F.regular, size: 8, color: C.sub });
      const lineX = mx + labW + 3;
      ctx.line(lineX, my + 10, lineX + f[1], my + 10, { color: C.metaLine, w: 1 });
      mx = lineX + f[1] + gap;
    });

    const lineY = top + 30;
    ctx.line(PT.marginX, lineY, PT.pageW - PT.marginX, lineY, { color: C.red, w: 2.5 });
    return lineY + 14;
  }

  function drawSectionTitle(ctx, x, yTop, label, continued) {
    ctx.text(label + (continued ? ' (Fortsetzung)' : ''), x, yTop,
      { font: ctx.fonts.heavy, size: 10.5, color: C.red });
    return yTop + 16;
  }

  // =================================================================
  //  ITEM-HÖHEN
  // =================================================================
  function letterItemHeight(mode) {
    mode = mode || 'both';
    if (mode === 'both') {
      return LIN.labelH + (LIN.totalLetter * 2) + (LIN.rowGap * 0.4) + LIN.rowGap;
    }
    return LIN.labelH + LIN.totalLetter + LETTER_SINGLE_GAP;
  }
  function wordItemHeight(lines) {
    lines = lines || 1;
    return LIN.labelH + (LIN.totalWord * lines) + (LINE_GAP * (lines - 1)) + LIN.rowGap;
  }

  // =================================================================
  //  HAUPTFUNKTION: kombiniertes Arbeitsblatt
  //  letters: string[]  words: string[]  sentences: string[]
  //  opts: {showV, showName, showDate, showKl}
  //  fontRegularBytes: Bienchen SAS Regular (Wörter/Sätze)
  //  fontItalicBytes:  Bienchen SAS Italic  (Einzelbuchstaben)
  // =================================================================
  async function buildCombinedWorksheetPDF(letters, words, sentences, opts, fontRegularBytes, fontItalicBytes) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    if ((fontRegularBytes || fontItalicBytes) && global.fontkit) pdf.registerFontkit(global.fontkit);

    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
      bienR:   null,
      bienI:   null,
    };
    if (fontRegularBytes && global.fontkit) {
      try { fonts.bienR = await pdf.embedFont(fontRegularBytes); }
      catch (e) { console.error('[Schreibschrift] Bienchen-Regular konnte nicht eingebettet werden, falle auf Helvetica zurueck:', e); fonts.bienR = fonts.heavy; }
    } else {
      console.error('[Schreibschrift] Bienchen-Regular-Bytes oder fontkit fehlen (fontRegularBytes=' + !!fontRegularBytes + ', fontkit=' + !!global.fontkit + ') - falle auf Helvetica zurueck.');
      fonts.bienR = fonts.heavy;
    }
    if (fontItalicBytes && global.fontkit) {
      try { fonts.bienI = await pdf.embedFont(fontItalicBytes); }
      catch (e) { console.error('[Schreibschrift] Bienchen-Italic konnte nicht eingebettet werden, falle auf Helvetica zurueck:', e); fonts.bienI = fonts.heavy; }
    } else {
      console.error('[Schreibschrift] Bienchen-Italic-Bytes oder fontkit fehlen (fontItalicBytes=' + !!fontItalicBytes + ', fontkit=' + !!global.fontkit + ') - falle auf Helvetica zurueck.');
      fonts.bienI = fonts.bienR;
    }

    opts = opts || {};
    const showV = opts.showV !== false;
    const letterMode = opts.letterMode || 'both'; // 'repeat' | 'model' | 'both'

    letters = letters || []; words = words || []; sentences = sentences || [];

    const sentenceAvail = PT.contentW - LIN.textInset * 2;
    const sections = [
      { key: 'buchstaben', title: 'Buchstaben üben', items: letters.map(ch => ({ type: 'letter', val: ch, h: letterItemHeight(letterMode) })) },
      { key: 'woerter',    title: 'Wörter abschreiben', items: words.map(w => ({ type: 'word', val: w, h: wordItemHeight() })) },
      { key: 'saetze',     title: 'Sätze abschreiben', items: sentences.map(s => {
          const lineCount = showV ? planSentenceLines(s, fonts.bienR, fonts.bienI, sentenceAvail).lines.length : 1;
          return { type: 'sentence', val: s, h: wordItemHeight(lineCount) };
        }) },
    ].filter(s => s.items.length);

    if (!sections.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makePageCtx(page, fonts);
      ctx.text('Bitte zuerst Buchstaben, Wörter oder Sätze auswählen.', PT.marginX, PT.pageH / 2,
        { font: fonts.regular, size: 11, color: C.sub });
      return await pdf.save();
    }

    const fontFallbackActive = (fonts.bienR === fonts.heavy) || (fonts.bienI === fonts.heavy);

    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makePageCtx(page, fonts);
    let y = drawHeader(ctx, opts);
    if (fontFallbackActive) {
      ctx.text('⚠ Schreibschrift-Font nicht geladen - Ersatzschrift aktiv', PT.marginX, y - 4,
        { font: fonts.heavy, size: 8, color: C.red });
      y += 4;
    }
    const bottomLimit = PT.marginY + PT.contentH;

    function newPage() {
      page = pdf.addPage([PT.pageW, PT.pageH]);
      ctx = makePageCtx(page, fonts);
      y = PT.marginY + 6;
    }

    sections.forEach(section => {
      if (y + 16 + section.items[0].h > bottomLimit) newPage();
      y = drawSectionTitle(ctx, PT.marginX, y, section.title, false);
      let continued = false;
      section.items.forEach(item => {
        if (y + item.h > bottomLimit) {
          newPage();
          continued = true;
          y = drawSectionTitle(ctx, PT.marginX, y, section.title, true);
        }
        if (item.type === 'letter') {
          ctx.text(item.val, PT.marginX, y, { font: fonts.heavy, size: 10, color: C.red });
          const row1Top = y + LIN.labelH;
          if (letterMode === 'both') {
            drawLetterRepeatRow(ctx, PT.marginX, row1Top, PT.contentW, item.val, fonts.bienR, fonts.bienI);
            const row2Top = row1Top + LIN.totalLetter + (LIN.rowGap * 0.4);
            drawLetterModelRow(ctx, PT.marginX, row2Top, PT.contentW, item.val, fonts.bienR, fonts.bienI);
          } else if (letterMode === 'model') {
            drawLetterModelRow(ctx, PT.marginX, row1Top, PT.contentW, item.val, fonts.bienR, fonts.bienI);
          } else {
            drawLetterRepeatRow(ctx, PT.marginX, row1Top, PT.contentW, item.val, fonts.bienR, fonts.bienI);
          }
        } else if (item.type === 'sentence') {
          ctx.text(item.val, PT.marginX, y, { font: fonts.heavy, size: 10, color: C.red });
          const rowTop = y + LIN.labelH;
          drawSentenceRows(ctx, PT.marginX, rowTop, PT.contentW, item.val, showV, fonts.bienR, fonts.bienI);
        } else {
          ctx.text(item.val, PT.marginX, y, { font: fonts.heavy, size: 10, color: C.red });
          const rowTop = y + LIN.labelH;
          drawWordRow(ctx, PT.marginX, rowTop, PT.contentW, item.val, showV, fonts.bienR, fonts.bienI);
        }
        y += item.h;
      });
    });

    return await pdf.save();
  }

  // ---- Export ---------------------------------------------------------
  global.SchreibschriftPDF = {
    PT, LIN,
    letterItemHeight, wordItemHeight,
    composeWord, composeStandaloneLetter, composePhrase,
    planSentenceLines,
    buildCombinedWorksheetPDF,
  };

})(typeof window !== 'undefined' ? window : this);
