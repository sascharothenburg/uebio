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
  function drawLineRow(ctx, xLeft, yTop, width, word, showV) {
    const band = LIN.band;
    const total = LIN.total;

    // 1) gelber Hintergrund + Rahmen
    ctx.rect(xLeft, yTop, width, total, {
      fill: C.paper, stroke: C.frame, strokeWidth: 1.5,
    });

    // 2) blau hinterlegtes Mittelband (zwischen Hilfslinie und Grundlinie)
    const bandTop = yTop + band;
    ctx.rect(xLeft, bandTop, width, band, { fill: C.bandBg, opacity: 0.7 });

    // 3) Linien
    const right = xLeft + width;
    // obere Hilfslinie (oben)
    ctx.line(xLeft, yTop, right, yTop, { color: C.help, w: 1 });
    // gestrichelte Mittellinie (Oberkante Mittelband)
    ctx.line(xLeft, bandTop, right, bandTop, { color: C.dash, w: 1, dash: [3, 2] });
    // Grundlinie (kräftig, Unterkante Mittelband)
    const baseY = yTop + band * 2;
    ctx.line(xLeft, baseY, right, baseY, { color: C.grund, w: 2 });
    // untere Hilfslinie
    ctx.line(xLeft, yTop + total, right, yTop + total, { color: C.help, w: 1 });

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
  //  HEADER (analog Mengen, aber Deutsch-Rot + Stift-freie Variante)
  // =================================================================
  function drawHeader(ctx, opts) {
    const F = ctx.fonts;
    const top = PT.marginY;

    // Titel (kein Emoji – Standard-Fonts können das nicht; schlichter Text)
    ctx.text('Schreibübung', PT.marginX, top, { font: F.heavy, size: 14, color: C.red });
    ctx.text('Schreibe die Wörter schön in die Zeilen', PT.marginX, top + 18,
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

  function planLayout() {
    const itemH = itemHeight();
    const headerH = 44;
    const usable1 = PT.contentH - headerH;
    const usableN = PT.contentH - 6;
    return {
      itemH,
      perPage1: Math.max(1, Math.floor(usable1 / itemH)),
      perPageN: Math.max(1, Math.floor(usableN / itemH)),
    };
  }

  function capacityForPages(numPages) {
    const L = planLayout();
    if (numPages <= 1) return L.perPage1;
    return L.perPage1 + L.perPageN * (numPages - 1);
  }

  function splitPages(words) {
    const L = planLayout();
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

    if (!words || !words.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makePageCtx(page, fonts);
      ctx.text('Bitte zuerst Wörter auswählen.', PT.marginX, PT.pageH / 2,
               { font: fonts.regular, size: 11, color: C.sub });
      return await pdf.save();
    }

    const { pages, layout } = splitPages(words);

    pages.forEach((slice, pg) => {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makePageCtx(page, fonts);
      let y = (pg === 0) ? drawHeader(ctx, opts) : PT.marginY + 6;

      slice.forEach(word => {
        // Label (Wort in rot über der Zeile)
        ctx.text(word, PT.marginX, y, { font: fonts.heavy, size: 10, color: C.red });
        const rowTop = y + LIN.labelH;
        drawLineRow(ctx, PT.marginX, rowTop, PT.contentW, word, showV);
        y += layout.itemH;
      });
    });

    return await pdf.save();
  }

  // ---- Export ------------------------------------------------------
  global.SchreibenPDF = {
    PT, LIN,
    itemHeight, planLayout, capacityForPages, splitPages,
    buildWorksheetPDF,
  };

})(typeof window !== 'undefined' ? window : this);
