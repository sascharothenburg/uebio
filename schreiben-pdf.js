/* =====================================================================
   schreiben-pdf.js  ·  PDF-Modul für die Schreib-App (pdf-lib)
   © 2026 Sascha Rothenburg · Grundschrift von Christian Urff

   Erzeugt Schullineatur-Arbeitsblätter als PDF mit ABSOLUTEN Koordinaten.
   Dadurch identisch auf iOS (WebKit) und Android (Chromium) – keine
   Plattform-Weiche (PT_WIN/PT_IOS) mehr nötig, EIN Maßsatz für alle.

   Lineatur "5mm" (Lineatur 1, Erstklässler):
     - Oberlängen-Bereich : 5mm
     - Mittelband (a,e,o)  : 5mm   <- Grundmaß
     - Unterlängen-Bereich : 5mm
     - Zeilenhöhe gesamt   : 15mm
   Vier Linien: obere Hilfslinie, gestrichelte Mittellinie, Grundlinie (kräftig),
   untere Hilfslinie. Gelber Hintergrund, blau hinterlegtes Mittelband,
   schwarze Eckmarken. Optional Vorschrift-Wort blass in Grundschrift.

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

  // ---- Lineatur-Maße (5mm) -----------------------------------------
  const LIN = {
    band: 5 * MM,                 // Mittelband
    get total() { return this.band * 3; },   // 15mm Zeilenhöhe
    rowGap: 6 * MM,               // Abstand zwischen Zeilen (inkl. Label-Platz)
    labelH: 13,                   // Höhe der Wort-Beschriftung über der Zeile (pt)
    corner: 5.5 * MM,             // Länge der Eckmarken
    textInset: 6 * MM,            // x-Einzug des Vorschrift-Worts
    // Schriftgröße so, dass die x-Höhe der Grundschrift = Mittelband (5mm).
    // Grundschrift x-Höhe ≈ 0.428·Schriftgröße (gemessen, unitsPerEm 1000).
    XHEIGHT_RATIO: 0.428,
    get vfont() { return this.band / this.XHEIGHT_RATIO; },
  };

  // ---- Farben ------------------------------------------------------
  const C = {
    red:     rgb01(0xb9, 0x1c, 0x1c),   // Akzent/Header (Deutsch-Rot)
    ink:     rgb01(0x1e, 0x29, 0x3b),
    sub:     rgb01(0x55, 0x55, 0x55),
    metaLine:rgb01(0x88, 0x88, 0x88),
    paper:   rgb01(0xfe, 0xf9, 0xc3),   // gelber Zeilenhintergrund
    frame:   rgb01(0x44, 0x44, 0x44),   // Zeilenrahmen
    bandBg:  rgb01(0xdb, 0xea, 0xfe),   // blau hinterlegtes Mittelband (hell)
    grund:   rgb01(0x1d, 0x4e, 0xd8),   // Grundlinie kräftig
    help:    rgb01(0x60, 0xa5, 0xfa),   // Hilfslinien
    dash:    rgb01(0x93, 0xc5, 0xfd),   // gestrichelte Mittellinie
    corner:  rgb01(0x33, 0x33, 0x33),   // Eckmarken
    vtext:   rgb01(0x4b, 0x82, 0xc3),   // Vorschrift-Wort (blass über Alpha)
  };
  function rgb01(r, g, b) { return { r: r / 255, g: g / 255, b: b / 255 }; }
  function col(c) { return c ? global.PDFLib.rgb(c.r, c.g, c.b) : undefined; }

  // ---- Lineatur-Varianten ------------------------------------------
  // '3' (Standard) = 4 gezeichnete Linien / 3 Bänder (Schullineatur Klasse 1/2)
  // '2'            = Hilfslinie + Grundlinie
  // '1'            = nur Grundlinie
  // Die ZEILENHÖHE bleibt in allen Varianten identisch, damit Ober- und
  // Unterlängen immer denselben Platz haben und die Schriftgröße konstant ist.
  function normStyle(v) {
    v = String(v == null ? '3' : v);
    return (v === '1' || v === '2') ? v : '3';
  }

  // ---- Zeichen-Kontext (Top-Left-Koordinaten -> pdf-lib) -----------
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
      /** Text an gegebener BASELINE (yTop = Position der Grundlinie). */
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
  //  EINE LINEATUR-ZEILE zeichnen
  //  yTop = obere Kante der Zeile. word = Vorschrift (oder '' / null).
  // =================================================================
  function drawLineRow(ctx, xLeft, yTop, width, word, showV, style) {
    style = normStyle(style);
    const band = LIN.band;
    const total = LIN.total;

    // 1) gelber Hintergrund + Rahmen (in allen Lineatur-Varianten gleich)
    ctx.rect(xLeft, yTop, width, total, {
      fill: C.paper, stroke: C.frame, strokeWidth: 1.5,
    });

    const bandTop = yTop + band;
    const baseY = yTop + band * 2;
    const right = xLeft + width;

    // 2) blau hinterlegtes Mittelband (nur wenn die Hilfslinie gezeichnet wird)
    if (style !== '1') {
      ctx.rect(xLeft, bandTop, width, band, { fill: C.bandBg, opacity: 0.7 });
    }

    // 3) Linien - je nach gewählter Lineatur
    //    '3' = obere Hilfslinie + Hilfslinie + Grundlinie + untere Hilfslinie
    //    '2' = Hilfslinie + Grundlinie
    //    '1' = nur Grundlinie
    if (style === '3') {
      ctx.line(xLeft, yTop, right, yTop, { color: C.help, w: 1 });                  // obere Hilfslinie
      ctx.line(xLeft, yTop + total, right, yTop + total, { color: C.help, w: 1 });  // untere Hilfslinie
    }
    if (style !== '1') {
      ctx.line(xLeft, bandTop, right, bandTop, { color: C.dash, w: 1, dash: [3, 2] }); // Hilfslinie (gestrichelt)
    }
    ctx.line(xLeft, baseY, right, baseY, { color: C.grund, w: 2 });                 // Grundlinie

    // 4) Eckmarken
    const cl = LIN.corner;
    const mark = (cx, cy, dx, dy) => {
      ctx.line(cx, cy, cx + dx, cy, { color: C.corner, w: 2 });      // horizontal
      ctx.line(cx, cy, cx, cy + dy, { color: C.corner, w: 2 });      // vertikal
    };
    mark(xLeft, yTop, cl, cl);                 // oben-links
    mark(right, yTop, -cl, cl);                // oben-rechts
    mark(xLeft, yTop + total, cl, -cl);        // unten-links
    mark(right, yTop + total, -cl, -cl);       // unten-rechts

    // 5) Vorschrift-Wort (blass, sitzt mit Grundlinie auf baseY)
    if (showV && word) {
      const size = LIN.vfont;
      ctx.textBaseline(word, xLeft + LIN.textInset, baseY, {
        font: ctx.fonts.grund, size, color: C.vtext, opacity: 0.40,
      });
    }
  }

  // =================================================================
  //  SAETZE: 1 oder 2 Zeilen, je nach Laenge (leichtes Schrumpfen,
  //  danach lieber Umbruch statt bis zur Unleserlichkeit verkleinern)
  // =================================================================
  function measurePhraseWidth(text, font, size) {
    return font.widthOfTextAtSize(String(text), size);
  }

  function planSentenceLines(text, font, avail) {
    const full = LIN.vfont;
    const w0 = measurePhraseWidth(text, font, full);
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
      const w1 = measurePhraseWidth(line1, font, full);
      const w2 = measurePhraseWidth(line2, font, full);
      const worst = Math.max(w1, w2);
      if (!best || worst < best.worst) best = { line1, line2, worst };
    }
    let size = full;
    if (best.worst > avail) size = full * (avail / best.worst);
    size = Math.max(size, full * SENTENCE_MIN_SCALE);
    return { lines: [best.line1, best.line2], size };
  }

  function drawSentenceRows(ctx, xLeft, yTop, width, text, showV, font, style, extraRow) {
    const avail = width - LIN.textInset * 2;
    const plan = (showV && text) ? planSentenceLines(text, font, avail) : { lines: [''], size: LIN.vfont };
    let rowTop = yTop;
    plan.lines.forEach(line => {
      drawLineRow(ctx, xLeft, rowTop, width, null, false, style);
      if (showV && line) {
        const baseY = rowTop + LIN.band * 2;
        ctx.textBaseline(line, xLeft + LIN.textInset, baseY, {
          font, size: plan.size, color: C.vtext, opacity: 0.40,
        });
      }
      rowTop += LIN.total + LINE_GAP;
    });
    // Zusätzliche Übungszeile: leere Lineatur zum eigenständigen Abschreiben
    if (extraRow) drawLineRow(ctx, xLeft, rowTop, width, null, false, style);
    return plan.lines.length;
  }

  function drawSectionTitle(ctx, x, yTop, label, continued) {
    ctx.text(label + (continued ? ' (Fortsetzung)' : ''), x, yTop,
      { font: ctx.fonts.heavy, size: 10.5, color: C.red });
    return yTop + 16;
  }

  // =================================================================
  //  BUCHSTABEN-MODUS: 2 Zeilen pro Buchstabe
  //  Zeile 1 (Spur): Buchstabe mehrfach hintereinander, komplett blass
  //                  -> motorische Bahn einüben, im Kurs bleiben
  //  Zeile 2 (Vorbild+Frei): Buchstabe einmal blass am Anfang, Rest leer
  //                  -> als Vorbild nachspuren, danach frei weiterüben
  // =================================================================
  function drawLetterRepeatRow(ctx, xLeft, yTop, width, letter, font, style, showV) {
    const band = LIN.band;
    drawLineRow(ctx, xLeft, yTop, width, null, false, style);
    if (showV === false) return;
    const baseY = yTop + band * 2;
    const size = LIN.vfont;
    const letterW = ctx.textWidth(letter, font, size);
    const gap = letterW * 0.7;
    const step = letterW + gap;
    let x = xLeft + LIN.textInset;
    const rightLimit = xLeft + width - LIN.textInset;
    while (x + letterW <= rightLimit) {
      ctx.textBaseline(letter, x, baseY, { font, size, color: C.vtext, opacity: 0.40 });
      x += step;
    }
  }

  function drawLetterModelRow(ctx, xLeft, yTop, width, letter, font, style, showV) {
    const band = LIN.band;
    drawLineRow(ctx, xLeft, yTop, width, null, false, style);
    if (showV === false) return;
    const baseY = yTop + band * 2;
    const size = LIN.vfont;
    ctx.textBaseline(letter, xLeft + LIN.textInset, baseY, {
      font, size, color: C.vtext, opacity: 0.40,
    });
    // Rest der Zeile bleibt frei (leere Lineatur) zum eigenständigen Üben
  }

  const LETTER_SINGLE_GAP = 2 * MM;   // Abstand nach dem letzten Buchstaben-Zeilenblock
  const LETTER_ROW_GAP = LIN.rowGap * 0.4; // Abstand zwischen Vorschreib- und Übungszeile

  // extraRow (bool): zusätzliche leere Übungszeile unter der Vorschreib-Zeile.
  function letterItemHeight(extraRow) {
    const rows = extraRow ? 2 : 1;
    return LIN.labelH + (LIN.total * rows) + (LETTER_ROW_GAP * (rows - 1)) + LETTER_SINGLE_GAP;
  }
  function itemHeightLetter() { return letterItemHeight(true); }

  function planLayoutLetter(extraRow) {
    const itemH = letterItemHeight(extraRow);
    const headerH = 44;
    const usable1 = PT.contentH - headerH;
    const usableN = PT.contentH - 6;
    return {
      itemH,
      perPage1: Math.max(1, Math.floor(usable1 / itemH)),
      perPageN: Math.max(1, Math.floor(usableN / itemH)),
    };
  }

  function splitPagesLetter(letters, extraRow) {
    const L = planLayoutLetter(extraRow);
    const pages = [];
    let i = 0;
    pages.push(letters.slice(i, i + L.perPage1)); i += L.perPage1;
    while (i < letters.length) {
      pages.push(letters.slice(i, i + L.perPageN)); i += L.perPageN;
    }
    return { pages, layout: L };
  }

  async function buildLetterWorksheetPDF(letters, opts, fontBytes, fontBytesPunkt) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    if ((fontBytes || fontBytesPunkt) && global.fontkit) pdf.registerFontkit(global.fontkit);

    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
      grund:   null,
    };
    opts = opts || {};
    const useDotted = !!opts.dotted;
    const chosenBytes = (useDotted && fontBytesPunkt) ? fontBytesPunkt : fontBytes;
    if (chosenBytes && global.fontkit) {
      try { fonts.grund = await pdf.embedFont(chosenBytes); }
      catch (e) { fonts.grund = fonts.heavy; }
    } else {
      fonts.grund = fonts.heavy;
    }

    if (!letters || !letters.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makePageCtx(page, fonts);
      ctx.text('Bitte zuerst Buchstaben auswählen.', PT.marginX, PT.pageH / 2,
               { font: fonts.regular, size: 11, color: C.sub });
      return await pdf.save();
    }

    const style = normStyle(opts.lineStyle);
    const extraRow = !!opts.extraRow;
    const showVL = opts.showV !== false;
    const { pages, layout } = splitPagesLetter(letters, extraRow);

    pages.forEach((slice, pg) => {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makePageCtx(page, fonts);
      let y = (pg === 0) ? drawHeader(ctx, Object.assign({}, opts, {
        title: 'Buchstaben üben', sub: 'Erst die Bahn nachspuren, dann frei weiterüben',
      })) : PT.marginY + 6;

      slice.forEach(letter => {
        ctx.text(letter, PT.marginX, y, { font: fonts.heavy, size: 10, color: C.red });
        const row1Top = y + LIN.labelH;
        drawLetterRepeatRow(ctx, PT.marginX, row1Top, PT.contentW, letter, fonts.grund, style, showVL);
        if (extraRow) {
          drawLineRow(ctx, PT.marginX, row1Top + LIN.total + LETTER_ROW_GAP, PT.contentW, null, false, style);
        }
        y += layout.itemH;
      });
    });

    return await pdf.save();
  }

  // =================================================================
  //  HEADER (analog Mengen, aber Deutsch-Rot + Stift-freie Variante)
  // =================================================================
  function drawHeader(ctx, opts) {
    const F = ctx.fonts;
    const top = PT.marginY;

    // Titel (kein Emoji – Standard-Fonts können das nicht; schlichter Text)
    const title = opts.title || 'Schreibübung';
    const sub = opts.sub || 'Schreibe die Wörter schön in die Zeilen';
    ctx.text(title, PT.marginX, top, { font: F.heavy, size: 14, color: C.red });
    ctx.text(sub, PT.marginX, top + 18,
             { font: F.regular, size: 8, color: C.sub });

    // Meta-Felder nebeneinander (leere Schreiblinien)
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

  // =================================================================
  //  BERECHNETE FÜLLUNG
  //  Ein "Item" = Label (Wort in rot) + eine Lineatur-Zeile.
  // =================================================================
  function itemHeight() {
    return LIN.labelH + LIN.total + LIN.rowGap;
  }

  // Fuer Saetze: mehrzeilig moeglich (Umbruch statt endlosem Schrumpfen)
  const MIN_SHRINK = 0.8;
  const SENTENCE_MIN_SCALE = 0.7;
  const LINE_GAP = LIN.band * 0.35;
  function wordItemHeight(lines, extraRow) {
    lines = lines || 1;
    const rows = lines + (extraRow ? 1 : 0);
    return LIN.labelH + (LIN.total * rows) + (LINE_GAP * (rows - 1)) + LIN.rowGap;
  }

  function planLayout(extraRow) {
    const itemH = wordItemHeight(1, extraRow);
    const headerH = 44;
    const usable1 = PT.contentH - headerH;
    const usableN = PT.contentH - 6;
    return {
      itemH,
      perPage1: Math.max(1, Math.floor(usable1 / itemH)),
      perPageN: Math.max(1, Math.floor(usableN / itemH)),
    };
  }

  function capacityForPages(numPages, extraRow) {
    const L = planLayout(extraRow);
    if (numPages <= 1) return L.perPage1;
    return L.perPage1 + L.perPageN * (numPages - 1);
  }

  function splitPages(words, extraRow) {
    const L = planLayout(extraRow);
    const pages = [];
    let i = 0;
    pages.push(words.slice(i, i + L.perPage1)); i += L.perPage1;
    while (i < words.length) {
      pages.push(words.slice(i, i + L.perPageN)); i += L.perPageN;
    }
    return { pages, layout: L };
  }

  // =================================================================
  //  HAUPTFUNKTION
  //  words: string[]; opts: {showV, showName, showDate, showKl}
  // =================================================================
  async function buildWorksheetPDF(words, opts, fontBytes) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    if (fontBytes && global.fontkit) pdf.registerFontkit(global.fontkit);

    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
      grund:   null,
    };
    if (fontBytes && global.fontkit) {
      try { fonts.grund = await pdf.embedFont(fontBytes); }
      catch (e) { fonts.grund = fonts.heavy; }
    } else {
      fonts.grund = fonts.heavy;
    }

    opts = opts || {};
    const showV = opts.showV !== false;
    const style = normStyle(opts.lineStyle);
    const extraRow = !!opts.extraRow;

    if (!words || !words.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makePageCtx(page, fonts);
      ctx.text('Bitte zuerst Wörter auswählen.', PT.marginX, PT.pageH / 2,
               { font: fonts.regular, size: 11, color: C.sub });
      return await pdf.save();
    }

    const { pages, layout } = splitPages(words, extraRow);

    pages.forEach((slice, pg) => {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makePageCtx(page, fonts);
      let y = (pg === 0) ? drawHeader(ctx, opts) : PT.marginY + 6;

      slice.forEach(word => {
        // Label (Wort in rot über der Zeile)
        ctx.text(word, PT.marginX, y, { font: fonts.heavy, size: 10, color: C.red });
        const rowTop = y + LIN.labelH;
        drawLineRow(ctx, PT.marginX, rowTop, PT.contentW, word, showV, style);
        if (extraRow) drawLineRow(ctx, PT.marginX, rowTop + LIN.total + LINE_GAP, PT.contentW, null, false, style);
        y += layout.itemH;
      });
    });

    return await pdf.save();
  }

  // =================================================================
  //  KOMBINIERTE HAUPTFUNKTION: Buchstaben + Woerter + Saetze zusammen
  //  letters/words/sentences: string[]
  //  opts: {showV, showName, showDate, showKl, dotted, lineStyle, extraRow}
  //  lineStyle: '1' | '2' | '3' (Anzahl der Lineatur-Linien, Standard '3')
  //  extraRow:  true = zusätzliche leere Übungszeile unter jedem Eintrag
  // =================================================================
  async function buildCombinedWorksheetPDF(letters, words, sentences, opts, fontBytes, fontBytesPunkt) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    if ((fontBytes || fontBytesPunkt) && global.fontkit) pdf.registerFontkit(global.fontkit);

    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
      grund:   null,
    };
    opts = opts || {};
    const useDotted = !!opts.dotted;
    const chosenBytes = (useDotted && fontBytesPunkt) ? fontBytesPunkt : fontBytes;
    if (chosenBytes && global.fontkit) {
      try { fonts.grund = await pdf.embedFont(chosenBytes); }
      catch (e) { console.error('[Grundschrift] Font konnte nicht eingebettet werden, falle auf Helvetica zurueck:', e); fonts.grund = fonts.heavy; }
    } else {
      console.error('[Grundschrift] Font-Bytes oder fontkit fehlen - falle auf Helvetica zurueck.');
      fonts.grund = fonts.heavy;
    }
    const fontFallbackActive = fonts.grund === fonts.heavy;

    const showV = opts.showV !== false;
    const style = normStyle(opts.lineStyle);
    const extraRow = !!opts.extraRow;
    letters = letters || []; words = words || []; sentences = sentences || [];

    const sentenceAvail = PT.contentW - LIN.textInset * 2;
    const sections = [
      { key: 'buchstaben', title: 'Buchstaben üben', items: letters.map(ch => ({ type: 'letter', val: ch, h: letterItemHeight(extraRow) })) },
      { key: 'woerter',    title: 'Wörter abschreiben', items: words.map(w => ({ type: 'word', val: w, h: wordItemHeight(1, extraRow) })) },
      { key: 'saetze',     title: 'Sätze abschreiben', items: sentences.map(s => {
          const lineCount = showV ? planSentenceLines(s, fonts.grund, sentenceAvail).lines.length : 1;
          return { type: 'sentence', val: s, h: wordItemHeight(lineCount, extraRow) };
        }) },
    ].filter(sec => sec.items.length);

    if (!sections.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makePageCtx(page, fonts);
      ctx.text('Bitte zuerst Buchstaben, Wörter oder Sätze auswählen.', PT.marginX, PT.pageH / 2,
        { font: fonts.regular, size: 11, color: C.sub });
      return await pdf.save();
    }

    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makePageCtx(page, fonts);
    let y = drawHeader(ctx, opts);
    if (fontFallbackActive) {
      ctx.text('! Grundschrift-Font nicht geladen - Ersatzschrift aktiv', PT.marginX, y - 4,
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
          drawLetterRepeatRow(ctx, PT.marginX, row1Top, PT.contentW, item.val, fonts.grund, style, showV);
          if (extraRow) {
            drawLineRow(ctx, PT.marginX, row1Top + LIN.total + LETTER_ROW_GAP, PT.contentW, null, false, style);
          }
        } else if (item.type === 'sentence') {
          ctx.text(item.val, PT.marginX, y, { font: fonts.heavy, size: 10, color: C.red });
          const rowTop = y + LIN.labelH;
          drawSentenceRows(ctx, PT.marginX, rowTop, PT.contentW, item.val, showV, fonts.grund, style, extraRow);
        } else {
          ctx.text(item.val, PT.marginX, y, { font: fonts.heavy, size: 10, color: C.red });
          const rowTop = y + LIN.labelH;
          drawLineRow(ctx, PT.marginX, rowTop, PT.contentW, item.val, showV, style);
          if (extraRow) drawLineRow(ctx, PT.marginX, rowTop + LIN.total + LINE_GAP, PT.contentW, null, false, style);
        }
        y += item.h;
      });
    });

    return await pdf.save();
  }

  // ---- Export ------------------------------------------------------
  global.SchreibenPDF = {
    PT, LIN, normStyle,
    itemHeight, wordItemHeight, planLayout, capacityForPages, splitPages,
    buildWorksheetPDF,
    itemHeightLetter, letterItemHeight, planLayoutLetter, splitPagesLetter,
    buildLetterWorksheetPDF,
    planSentenceLines,
    buildCombinedWorksheetPDF,
  };


})(typeof window !== 'undefined' ? window : this);
