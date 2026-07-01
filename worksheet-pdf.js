/* =====================================================================
   worksheet-pdf.js  ·  Gemeinsames PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Zweck: Arbeitsblätter als PDF mit ABSOLUTEN Koordinaten erzeugen.
   Dadurch identisch auf iOS (WebKit) und Android (Chromium) – kein
   Engine-Druck mehr, kein Umbruch-Drift, keine Leerseiten.

   Dieses Modul ist app-übergreifend gedacht. Eine App liefert:
     - eine Liste von Aufgaben
     - eine measure()-Funktion (Höhe einer Aufgabe in pt)
     - eine draw()-Funktion (zeichnet eine Aufgabe an x/y)
     - Header-Infos
   Das Modul übernimmt: Seitengeometrie, BERECHNETE Füllung, Paginierung,
   Spalten, Header, und das Erzeugen der PDF-Bytes.

   Abhängigkeit: pdf-lib (UMD) global als window.PDFLib
     <script src="pdf-lib.min.js"></script>
   ===================================================================== */

(function (global) {
  'use strict';

  // ---- A4-Geometrie (pt) -------------------------------------------
  const PT = {
    pageW: 595.28,           // A4 Breite
    pageH: 841.89,           // A4 Höhe
    marginX: 14 * 2.834645,  // 14mm -> pt
    marginY: 12 * 2.834645,  // 12mm -> pt
  };
  PT.contentW = PT.pageW - PT.marginX * 2;
  PT.contentH = PT.pageH - PT.marginY * 2;

  // ---- Farben (rgb 0..1) -------------------------------------------
  const C = {
    blue:  rgb01(0x03, 0x69, 0xa1),
    red:   rgb01(0xdc, 0x26, 0x26),
    dotBlue: rgb01(0x25, 0x63, 0xeb),
    ink:   rgb01(0x1e, 0x29, 0x3b),
    sub:   rgb01(0x55, 0x55, 0x55),
    empty: rgb01(0xcb, 0xd5, 0xe1),
    metaLine: rgb01(0x88, 0x88, 0x88),
    dash:  rgb01(0xdd, 0xdd, 0xdd),
  };
  function rgb01(r, g, b) { return { r: r / 255, g: g / 255, b: b / 255 }; }

  // Wandelt unser {r,g,b}-Rohformat in ein pdf-lib Color-Objekt.
  function col(c) {
    if (!c) return undefined;
    return global.PDFLib.rgb(c.r, c.g, c.b);
  }

  // ---- Hilfen: pdf-lib nutzt UNTEN-LINKS als Ursprung. ------------
  // Wir rechnen intern mit OBEN-LINKS (wie HTML/Canvas) und spiegeln
  // beim Zeichnen: yPdf = pageH - yTop.
  function makePageCtx(page, fonts) {
    return {
      page, fonts,
      // y ist Top-basiert.
      circle(cx, cyTop, r, opts) {
        page.drawEllipse({
          x: cx, y: PT.pageH - cyTop, xScale: r, yScale: r,
          color: col(opts.fill), borderColor: col(opts.stroke),
          borderWidth: opts.strokeWidth || 0,
          borderDashArray: opts.dash || undefined,
        });
      },
      rect(x, yTop, w, h, opts) {
        page.drawRectangle({
          x, y: PT.pageH - yTop - h, width: w, height: h,
          color: col(opts.fill), borderColor: col(opts.stroke),
          borderWidth: opts.strokeWidth || 0,
          borderDashArray: opts.dash || undefined,
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
        // pdf-lib zeichnet Text an der Baseline; yTop ist Oberkante.
        const ascent = f.heightAtSize(size) * 0.8;
        page.drawText(String(str), {
          x, y: PT.pageH - yTop - ascent, size, font: f,
          color: col(opts.color) || col(C.ink),
        });
      },
      textWidth(str, font, size) {
        return font.widthOfTextAtSize(String(str), size);
      },
      // Vektor-Pfeil (dir: 'right'|'down'), da U+2192/2193 nicht WinAnsi-fähig sind.
      arrow(xTop, yTop, len, dir, color) {
        const col = color || C.ink;
        if (dir === 'down') {
          this.line(xTop, yTop, xTop, yTop + len, { color: col, w: 1.8 });
          this.line(xTop, yTop + len, xTop - 3, yTop + len - 4, { color: col, w: 1.8 });
          this.line(xTop, yTop + len, xTop + 3, yTop + len - 4, { color: col, w: 1.8 });
        } else { // right
          this.line(xTop, yTop, xTop + len, yTop, { color: col, w: 1.8 });
          this.line(xTop + len, yTop, xTop + len - 4, yTop - 3, { color: col, w: 1.8 });
          this.line(xTop + len, yTop, xTop + len - 4, yTop + 3, { color: col, w: 1.8 });
        }
      },
    };
  }

  // =================================================================
  //  PUNKTEFELD  (portiert aus dotField() der HTML)
  // =================================================================
  const DOT = {
    pad: 5,
    radius: { big: 9, small: 6, tiny: 5.5 },
    gap:    { big: 6, small: 3.5, tiny: 3.5 },
  };

  function dotFieldSize(cells, cols, scale) {
    const R = DOT.radius[scale], GAP = DOT.gap[scale];
    const rows = Math.ceil(cells / cols);
    const step = R * 2 + GAP;
    const groupGap = (cols >= 10) ? 4 : 0;
    return {
      w: DOT.pad * 2 + cols * step + groupGap,
      h: DOT.pad * 2 + rows * step,
      R, step, groupGap, rows,
    };
  }

  // filled: -1 = leer (count); sonst Anzahl gefüllter Punkte
  // splitRed: Anzahl roter Punkte (Rest blau); sonst null
  function drawDotField(ctx, xTop, yTop, cells, cols, filled, arrange, scale, splitRed) {
    const m = dotFieldSize(cells, cols, scale);
    const R = m.R, step = m.step, groupGap = m.groupGap;

    // Rahmen
    ctx.rect(xTop + 0.75, yTop + 0.75, m.w - 1.5, m.h - 1.5, {
      fill: rgb01(255, 255, 255), stroke: C.blue, strokeWidth: 1.5,
    });

    for (let idx = 0; idx < cells; idx++) {
      const r = Math.floor(idx / cols), c = idx % cols;
      const extra = (cols >= 10 && c >= 5) ? groupGap : 0;
      const cx = xTop + DOT.pad + c * step + R + extra;
      const cy = yTop + DOT.pad + r * step + R;

      let color;
      if (splitRed != null) {
        color = (idx < splitRed) ? C.red : C.dotBlue;
      } else if (arrange === 'fives') {
        color = (cols >= 10) ? ((c < 5) ? C.red : C.dotBlue)
                             : ((r % 2 === 0) ? C.red : C.dotBlue);
      } else {
        color = (r % 2 === 0) ? C.red : C.dotBlue;
      }

      if (filled < 0) {
        ctx.circle(cx, cy, R, { stroke: C.empty, strokeWidth: 0.8, dash: [2, 2] });
      } else if (idx < filled) {
        ctx.circle(cx, cy, R, { fill: color, stroke: C.ink, strokeWidth: 0.6 });
      } else {
        ctx.circle(cx, cy, R, { stroke: C.empty, strokeWidth: 0.8 });
      }
    }
    return m;
  }

  // =================================================================
  //  AUFGABEN-ADAPTER für die Mengen-App
  //  (Andere Apps liefern später ihre eigenen Adapter.)
  // =================================================================
  //
  //  spec = {
  //    mode: 'draw'|'count'|'compare'|'split',
  //    field: {id:'feld10'|'feld20', cells, cols},
  //    arrange: 'fives'|'rows',
  //    small: bool,   // kompakte Punkte (2-spaltig)
  //  }

  function clampN(v, cells) { return Math.max(0, Math.min(v, cells)); }

  // Misst die Höhe EINER Aufgabe in pt (für Füllungsberechnung).
  function measureTask(spec) {
    const { mode, field, small } = spec;
    const scale = small ? 'small' : 'big';
    const m = dotFieldSize(field.cells, field.cols, scale);
    const stacked = small;
    if (mode === 'count') {
      if (stacked) return 28 + m.h;            // Zahl+Pfeil oben, Feld darunter
      return Math.max(m.h, 30);
    }
    if (mode === 'compare') return Math.max(m.h, 30);
    // draw / split
    if (stacked) return m.h + 24;              // Feld + Antwortzeile darunter
    return Math.max(m.h, 26);
  }

  // Breite EINER Aufgabe (für Spalten-Sanity; nicht zwingend exakt).
  function measureTaskWidth(spec) {
    const { mode, field, small } = spec;
    const scale = small ? 'small' : 'big';
    const m = dotFieldSize(field.cells, field.cols, scale);
    if (mode === 'compare') return m.w + 8 + 30 + 8 + m.w;
    if (mode === 'count' && !small) return 34 + 18 + m.w;
    if (small) return m.w;
    return m.w + 9 + 70;
  }

  // Zeichnet EINE Aufgabe; gibt verbrauchte Höhe zurück.
  function drawTask(ctx, spec, task, num, xTop, yTop, colW) {
    const { mode, field, arrange, small } = spec;
    const scale = small ? 'small' : 'big';
    const stacked = small;
    const cells = field.cells, cols = field.cols;
    const F = ctx.fonts;

    // Nummer
    ctx.text(num + '.', xTop, yTop, { font: F.heavy, size: 10, color: C.blue });
    const numW = 16;
    const cx = xTop + numW;

    if (mode === 'draw') {
      const m = drawDotField(ctx, cx, yTop, cells, cols, clampN(task.n, cells), arrange, scale, null);
      if (stacked) {
        const ly = yTop + m.h + 5 + 8;
        ctx.text('=', cx + 3, ly, { font: F.heavy, size: 13 });
        ctx.line(cx + 3 + 14, ly + 13, cx + 3 + 14 + 70, ly + 13, { color: C.blue, w: 2 });
        return m.h + 24;
      } else {
        const midY = yTop + m.h / 2;
        ctx.text('=', cx + m.w + 9, midY - 7, { font: F.heavy, size: 13 });
        ctx.line(cx + m.w + 9 + 14, midY + 7, cx + m.w + 9 + 14 + 60, midY + 7, { color: C.blue, w: 2 });
        return m.h;
      }
    }

    if (mode === 'count') {
      const nStr = String(clampN(task.n, cells));
      if (stacked) {
        ctx.text(nStr, cx + 3, yTop, { font: F.grund, size: 22 });
        ctx.arrow(cx + 3 + 30, yTop + 6, 14, 'down', C.ink);
        const m = drawDotField(ctx, cx, yTop + 28, cells, cols, -1, arrange, 'small', null);
        return 28 + m.h;
      } else {
        const m = dotFieldSize(cells, cols, 'big');
        const midY = yTop + m.h / 2;
        ctx.text(nStr, cx, midY - 14, { font: F.grund, size: 24 });
        ctx.arrow(cx + 34, midY, 16, 'right', C.ink);
        drawDotField(ctx, cx + 34 + 22, yTop, cells, cols, -1, arrange, 'big', null);
        return m.h;
      }
    }

    if (mode === 'compare') {
      const cmp = (field.id === 'feld20') ? 'small' : 'big';
      const m = drawDotField(ctx, cx, yTop, cells, cols, clampN(task.a, cells), arrange, cmp, null);
      const boxX = cx + m.w + 8;
      const midY = yTop + m.h / 2;
      ctx.rect(boxX, midY - 15, 30, 30, { stroke: C.blue, strokeWidth: 1.8 });
      drawDotField(ctx, boxX + 30 + 8, yTop, cells, cols, clampN(task.b, cells), arrange, cmp, null);
      return m.h;
    }

    if (mode === 'split') {
      const n = clampN(task.n, cells);
      // rote Anzahl: bevorzugt die beim Generieren gewürfelte Aufteilung (task.red),
      // sonst Fallback auf feste Aufteilung für Altdaten ohne red-Feld
      let redPart;
      if (task.red != null) {
        redPart = clampN(task.red, cells);
        if (redPart < 1) redPart = 1;
        if (redPart > n - 1 && n > 1) redPart = n - 1;
        if (n <= 1) redPart = 0;
      } else {
        redPart = (n >= 5) ? 5 : Math.ceil(n / 2);
        if (n > 10) redPart = 10;
      }
      const m = drawDotField(ctx, cx, yTop, cells, cols, n, arrange, scale, redPart);
      const drawEq = (bx, by) => {
        const head = n + ' =';
        ctx.text(head, bx, by, { font: F.heavy, size: 13 });
        let xx = bx + ctx.textWidth(head, F.heavy, 13) + 6;
        ctx.line(xx, by + 14, xx + 34, by + 14, { color: C.blue, w: 1.8 });
        xx += 34 + 4;
        ctx.text('+', xx, by, { font: F.heavy, size: 13, color: C.red });
        xx += ctx.textWidth('+', F.heavy, 13) + 4;
        ctx.line(xx, by + 14, xx + 34, by + 14, { color: C.blue, w: 1.8 });
      };
      if (stacked) { drawEq(cx + 3, yTop + m.h + 5 + 8); return m.h + 24; }
      drawEq(cx + m.w + 8, yTop + m.h / 2 - 7);
      return m.h;
    }
    return 26;
  }

  // =================================================================
  //  HEADER
  // =================================================================
  const MODE_TITLE = {
    draw: 'Wie viele Punkte? Schreibe die Zahl.',
    count: 'Male die richtige Anzahl Punkte.',
    compare: 'Vergleiche die Mengen. Schreibe <, = oder >.',
    split: 'Zerlege die Menge: rot + blau.',
  };

  function drawHeader(ctx, opts) {
    const F = ctx.fonts;
    const top = PT.marginY;
    // Logo: zwei Plättchen (rot + blau) als Vektor, da Standard-PDF-Fonts
    // keine Emoji kodieren koennen.
    const lr = 5.5;
    ctx.circle(PT.marginX + lr, top + 7, lr, { fill: C.red });
    ctx.circle(PT.marginX + lr * 2 + 5, top + 7, lr, { fill: C.dotBlue });
    const titleX = PT.marginX + lr * 3 + 12;
    ctx.text('Mengen', titleX, top, { font: F.heavy, size: 14, color: C.blue });
    ctx.text(opts.sub || '', PT.marginX, top + 18, { font: F.regular, size: 8, color: C.sub });

    // Meta-Felder: NEBENEINANDER in einer Zeile (Header behält feste Höhe).
    // Alle Felder sind leere Schreiblinien zum handschriftlichen Ausfüllen.
    // Linienlängen an Handschrift angepasst: Name am längsten, Klasse kurz.
    const fields = [];
    if (opts.showName) fields.push(['Name:', 95]);   // Vor- und Nachname
    if (opts.showDate) fields.push(['Datum:', 55]);  // z.B. 12.06.2026
    if (opts.showKl)   fields.push(['Klasse:', 32]); // z.B. 2b
    const right = PT.pageW - PT.marginX;
    const gap = 14;          // Abstand zwischen den Feldern
    const my = top + 1;      // alle Felder auf gleicher Höhe wie der Titel
    // Gesamtbreite berechnen, um rechtsbündig zu starten
    let totalW = 0;
    fields.forEach(f => {
      const labW = ctx.textWidth(f[0], F.regular, 8);
      totalW += labW + 3 + f[1] + gap;
    });
    totalW -= gap; // letzter gap entfällt
    let mx = right - totalW;
    fields.forEach(f => {
      const labW = ctx.textWidth(f[0], F.regular, 8);
      ctx.text(f[0], mx, my, { font: F.regular, size: 8, color: C.sub });
      const lineX = mx + labW + 3;
      ctx.line(lineX, my + 10, lineX + f[1], my + 10, { color: C.metaLine, w: 1 });
      mx = lineX + f[1] + gap;
    });

    const lineY = top + 30;
    ctx.line(PT.marginX, lineY, PT.pageW - PT.marginX, lineY, { color: C.blue, w: 2.5 });
    return lineY + 14; // Inhalt beginnt hier
  }

  // =================================================================
  //  BERECHNETE FÜLLUNG + PAGINIERUNG  (Kern der WebKit-Lösung)
  // =================================================================
  //
  //  layout(spec, totalTasks) -> {
  //    ncols, rowH, colW,
  //    perPage1, perPageN,   // Aufgaben pro Seite (Seite 1 mit Header)
  //  }
  function planLayout(spec) {
    const mode = spec.mode, field = spec.field;
    // Spaltenzahl (1:1 aus buildWS)
    let ncols;
    if (mode === 'compare') ncols = 1;
    else if (mode === 'draw' && field.id === 'feld10') ncols = spec.twoCol ? 3 : 1;
    else ncols = spec.twoCol ? 2 : 1;

    const small = (ncols >= 2) && (field.id === 'feld20' ||
      ((mode === 'draw' || mode === 'split') && field.id === 'feld10'));

    const mspec = Object.assign({}, spec, { small });
    const taskH = measureTask(mspec);
    const rowGap = 11;            // padding-bottom zwischen Zeilen
    const rowH = taskH + rowGap;
    const colW = PT.contentW / ncols;

    // Nutzbare Höhe: Seite 1 hat Header, Folgeseiten ~2mm Luft
    const headerH = 44;           // Titel+Sub+Linie+Abstand (~ drawHeader Rückgabe - marginY)
    const usable1 = PT.contentH - headerH;
    const usableN = PT.contentH - 6;

    const rows1 = Math.max(1, Math.floor(usable1 / rowH));
    const rowsN = Math.max(1, Math.floor(usableN / rowH));

    return {
      ncols, small, rowH, colW, taskH,
      perPage1: rows1 * ncols,
      perPageN: rowsN * ncols,
    };
  }

  // Wieviele Aufgaben passen INSGESAMT auf N Seiten (für Generator-Anzeige).
  function capacityForPages(spec, numPages) {
    const L = planLayout(spec);
    if (numPages <= 1) return L.perPage1;
    return L.perPage1 + L.perPageN * (numPages - 1);
  }

  // Splittet die Aufgaben in Seiten gemäß berechneter Kapazität.
  function splitPages(spec, tasks) {
    const L = planLayout(spec);
    const pages = [];
    let i = 0;
    // Seite 1
    pages.push(tasks.slice(i, i + L.perPage1)); i += L.perPage1;
    // Folgeseiten
    while (i < tasks.length) {
      pages.push(tasks.slice(i, i + L.perPageN)); i += L.perPageN;
    }
    return { pages, layout: L };
  }

  // =================================================================
  //  HAUPTFUNKTION: PDF bauen
  // =================================================================
  async function buildWorksheetPDF(spec, tasks, headerOpts, fontBytes) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();

    // pdf-lib braucht fontkit für Custom-Fonts
    if (fontBytes && global.fontkit) {
      pdf.registerFontkit(global.fontkit);
    }

    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
      grund:   null,
    };
    if (fontBytes && global.fontkit) {
      try { fonts.grund = await pdf.embedFont(fontBytes); }
      catch (e) { fonts.grund = fonts.heavy; }
    } else {
      fonts.grund = fonts.heavy; // Fallback ohne Grundschrift
    }

    if (!tasks.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makePageCtx(page, fonts);
      ctx.text('Keine Aufgaben – bitte im Generator würfeln.',
        PT.marginX, PT.pageH / 2, { font: fonts.regular, size: 11, color: C.sub });
      return await pdf.save();
    }

    const { pages, layout } = splitPages(spec, tasks);
    const dspec = Object.assign({}, spec, { small: layout.small });
    let globalIdx = 0;

    pages.forEach((slice, pg) => {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makePageCtx(page, fonts);
      let y;
      if (pg === 0) {
        y = drawHeader(ctx, Object.assign({ sub: MODE_TITLE[spec.mode] }, headerOpts));
      } else {
        y = PT.marginY + 6;
      }

      const ncols = layout.ncols, colW = layout.colW, rowH = layout.rowH;
      let col = 0, rowTop = y;

      slice.forEach((task, k) => {
        const x = PT.marginX + col * colW;
        const cellPadLeft = col === 0 ? 0 : 12;

        if (col > 0) {
          ctx.line(x, rowTop, x, rowTop + layout.taskH, { color: C.dash, w: 1, dash: [2, 2] });
        }

        drawTask(ctx, dspec, task, globalIdx + 1, x + cellPadLeft, rowTop, colW - cellPadLeft);
        globalIdx++;
        col++;
        if (col >= ncols) { col = 0; rowTop += rowH; }
      });
    });

    return await pdf.save(); // Uint8Array
  }

  // =================================================================
  //  Export
  // =================================================================
  global.WorksheetPDF = {
    PT, MODE_TITLE,
    measureTask, measureTaskWidth,
    planLayout, capacityForPages, splitPages,
    buildWorksheetPDF,
  };

})(typeof window !== 'undefined' ? window : this);
