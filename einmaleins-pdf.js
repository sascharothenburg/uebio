/* =====================================================================
   einmaleins-pdf.js  ·  PDF-Modul für die Einmaleins-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Erzeugt 1×1-Arbeitsblätter als PDF mit absoluten Koordinaten ->
   identisch auf iOS (WebKit) und Android (Chromium).

   Aufgaben sind sehr regelmäßig (gleichgroße Zellen im Spaltenraster),
   daher BERECHNETE Seitenfüllung: Aus der verfügbaren Höhe wird die
   Zeilenzahl pro Seite bestimmt; bei "2 Seiten" wird auf zwei Blätter
   verteilt. Kein fließender Umbruch nötig.

   spec: { tasks:[{a,b,res,sol}], cols, numPages, inverted, reihenLabel, showSol }
   opts: { showName, showDate, showKl }
   Abhängig (global): window.PDFLib
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = {
    pageW: 595.28, pageH: 841.89,
    marginX: 14 * MM, marginY: 12 * MM,
  };
  PT.contentW = PT.pageW - PT.marginX * 2;
  PT.contentH = PT.pageH - PT.marginY * 2;

  // Mathe-Blau
  const C = {
    blue:    rgb01(0x03, 0x69, 0xa1),
    blue2:   rgb01(0x0e, 0xa5, 0xe9),
    blueLn:  rgb01(0xba, 0xe6, 0xfd),
    ink:     rgb01(0x1e, 0x29, 0x3b),
    sub:     rgb01(0x55, 0x55, 0x55),
    sol:     rgb01(0x77, 0x77, 0x77),
    metaLine:rgb01(0x88, 0x88, 0x88),
    line:    rgb01(0x33, 0x33, 0x33),
    foot:    rgb01(0x94, 0xa3, 0xb8),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      line(x1, y1, x2, y2, o) {
        o = o || {};
        page.drawLine({
          start:{x:x1, y:PT.pageH-y1}, end:{x:x2, y:PT.pageH-y2},
          thickness:o.w||1, color:col(o.color)||col(C.ink), dashArray:o.dash,
        });
      },
      text(str, x, yTop, o) {
        o = o || {};
        const f = o.font || fonts.regular;
        const size = o.size || 10;
        const ascent = f.heightAtSize(size) * 0.76;
        page.drawText(String(str), {
          x, y: PT.pageH - yTop - ascent, size, font: f,
          color: col(o.color) || col(C.ink),
        });
      },
      textCentered(str, cx, yTop, o) {
        o = o || {};
        const f = o.font || fonts.regular;
        const size = o.size || 10;
        const w = f.widthOfTextAtSize(String(str), size);
        this.text(str, cx - w/2, yTop, o);
      },
      textWidth(str, font, size){ return (font||fonts.regular).widthOfTextAtSize(String(str), size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts, reihenLabel, inverted) {
    const F = ctx.fonts;
    const top = PT.marginY;
    ctx.text('Das kleine 1 \u00d7 1', PT.marginX, top, { font: F.heavy, size: 14, color: C.blue });
    const sub = 'Reihen: ' + reihenLabel + (inverted ? ' \u00b7 Ergebnis vorgegeben' : ' \u00b7 Ergebnis eintragen');
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
    ctx.line(PT.marginX, lineY, PT.pageW - PT.marginX, lineY, { color: C.blue, w: 2.5 });
    return lineY + 12;
  }

  function drawFooter(ctx) {
    // Fußzeile bewusst leer (kein "Super gemacht!"/Copyright im Druck).
  }

  // Eine Aufgabe zeichnen: "12. 3 × 4 = ____"
  function drawTask(ctx, t, idx, x, yTop, fs) {
    const F = ctx.fonts;
    // Nummer
    const numStr = (idx + 1) + '.';
    ctx.text(numStr, x, yTop + (fs - 9) * 0.5, { font: F.heavy, size: 9, color: C.blue });
    const numW = ctx.textWidth('00.', F.heavy, 9) + 4;
    let tx = x + numW;

    function part(val, lineW) {
      if (val === '?') {
        // Schreiblinie
        const ly = yTop + fs * 0.92;
        ctx.line(tx, ly, tx + lineW, ly, { color: C.line, w: 1 });
        tx += lineW;
      } else {
        ctx.text(String(val), tx, yTop, { font: F.bold, size: fs, color: C.ink });
        tx += ctx.textWidth(String(val), F.bold, fs);
      }
    }
    function op(sym) {
      const s = ' ' + sym + ' ';
      ctx.text(s, tx, yTop, { font: F.regular, size: fs, color: C.sub });
      tx += ctx.textWidth(s, F.regular, fs);
    }

    part(t.a, fs * 1.1);
    op('\u00d7');
    part(t.b, fs * 1.1);
    op('=');
    part(t.res, fs * 1.6);
  }

  async function buildWorksheetPDF(spec, opts, _unused) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold:    await pdf.embedFont(StandardFonts.HelveticaBold),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
    };

    opts = opts || {};
    spec = spec || {};
    const cols = spec.cols || 3;
    const numPages = spec.numPages || 1;
    const fs = 18;                 // Schriftgröße der Gleichung (pt) – größer, mehr Schreibplatz
    const rowH = fs * 1.45;        // Zeilenhöhe inkl. Abstand
    const colW = PT.contentW / cols;
    const gen = (typeof spec.gen === 'function') ? spec.gen : null;

    // Kapazität (Aufgaben) einer Seite ab vertikaler Position topY
    function capacity(topY) {
      const avail = (PT.pageH - PT.marginY - 4) - topY; // kein Fuß mehr -> nur kleine Reserve
      const rows = Math.max(1, Math.floor(avail / rowH));
      return rows * cols;
    }
    const topWithHeader = PT.marginY + 30 + 12;  // wie drawHeader zurückgibt
    const topNoHeader   = PT.marginY + 4;
    const capPage1 = capacity(topWithHeader);
    const capPageN = capacity(topNoHeader);

    // Gesamtzahl der Aufgaben bestimmen
    const totalNeeded = (numPages <= 1) ? capPage1 : (capPage1 + capPageN);

    // Aufgaben besorgen: bevorzugt über Generator, sonst feste Liste
    let tasks;
    if (gen) {
      tasks = [];
      for (let i = 0; i < totalNeeded; i++) tasks.push(gen(i));
    } else {
      tasks = spec.tasks || [];
    }

    if (!tasks.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Aufgaben \u2013 bitte Reihen ausw\u00e4hlen.', PT.marginX, PT.marginY + 20,
               { font: fonts.bold, size: 11, color: C.sub });
      return await pdf.save();
    }

    // Aufteilung auf Seiten (kapazitätsgenau)
    const pageSlices = [];
    if (numPages <= 1) {
      pageSlices.push(tasks);
    } else {
      pageSlices.push(tasks.slice(0, capPage1));
      pageSlices.push(tasks.slice(capPage1));
    }

    // ---- Seiten zeichnen ----
    let firstPageTopAfterHeader = 0;
    for (let pg = 0; pg < pageSlices.length; pg++) {
      const slice = pageSlices[pg];
      if (!slice.length) continue;
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      let y;
      if (pg === 0) {
        y = drawHeader(ctx, opts, spec.reihenLabel || '', spec.inverted);
        firstPageTopAfterHeader = y;
      } else {
        y = PT.marginY + 4; // Folgeseiten ohne Header -> mehr Platz
      }
      // Aufgaben im Raster
      const startIdx = (pg === 0) ? 0 : pageSlices[0].length;
      for (let i = 0; i < slice.length; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const x = PT.marginX + c * colW;
        const yTop = y + r * rowH;
        drawTask(ctx, slice[i], startIdx + i, x, yTop, fs);
      }
      drawFooter(ctx);
    }

    // ---- Lösungsblock (eigene Seite, falls nötig) ----
    if (spec.showSol && tasks.length) {
      // Auf die letzte Seite, wenn Platz; sonst neue Seite.
      // Einfacher & robust: immer auf eine eigene (letzte) Seite anhängen,
      // wenn die letzte Seite voll ist. Wir prüfen den Platz der letzten Seite.
      const pages = pdf.getPages();
      const last = pages[pages.length - 1];
      const lastSlice = pageSlices[pageSlices.length - 1];
      const lastRows = Math.ceil(lastSlice.length / cols);
      const lastTopY = (pageSlices.length === 1) ? firstPageTopAfterHeader : (PT.marginY + 4);
      let yAfter = lastTopY + lastRows * rowH + 8;

      const solLineH = 11;
      // wie viele Lösungszeilen passen noch?
      const solColW = PT.contentW / 6; // Lösungen kompakt in 6 Spalten
      const solRows = Math.ceil(tasks.length / 6);
      const needed = 20 + solRows * solLineH;
      const remaining = (PT.pageH - PT.marginY - 16) - yAfter;

      let ctx, y;
      if (remaining >= needed) {
        ctx = makeCtx(last, fonts);
        y = yAfter;
      } else {
        const page = pdf.addPage([PT.pageW, PT.pageH]);
        ctx = makeCtx(page, fonts);
        y = PT.marginY + 6;
      }
      ctx.line(PT.marginX, y, PT.pageW - PT.marginX, y, { color: C.blueLn, w: 1 });
      y += 8;
      ctx.text('L\u00d6SUNGEN', PT.marginX, y, { font: fonts.heavy, size: 8, color: C.blue });
      y += 12;
      for (let i = 0; i < tasks.length; i++) {
        const r = Math.floor(i / 6), c = i % 6;
        const x = PT.marginX + c * solColW;
        ctx.text((i + 1) + '. ' + tasks[i].sol, x, y + r * solLineH,
                 { font: fonts.regular, size: 7.5, color: C.sol });
      }
    }

    return await pdf.save();
  }

  global.EinmaleinsPDF = { PT, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
