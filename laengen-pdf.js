/* =====================================================================
   laengen-pdf.js  ·  PDF-Modul für die Längen/Gewichte-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Erzeugt Umrechnen-/Vergleichs-Arbeitsblätter als PDF mit absoluten
   Koordinaten -> identisch auf iOS (WebKit) und Android (Chromium).

   Aufgaben sind regelmäßig (2 Spalten, eine Zeile pro Aufgabe), daher
   BERECHNETE Seitenfüllung statt fließendem Umbruch.

   Aufgabenformat: { q, s }
     q = Aufgabentext mit Lücken-Platzhalter '___' (drei Unterstriche),
         z.B. "3,4 km = ___ m"  oder  "3,4 m ___ 340 cm"
     s = Lösung (z.B. "3400 m" oder "<")
   Das Modul zeichnet an Stelle von '___' eine Schreiblinie.

   spec: { tasks:[{q,s}], numPages, showSol, title, sub }
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

  const C = {
    blue:    rgb01(0x03, 0x69, 0xa1),
    blue2:   rgb01(0x0e, 0xa5, 0xe9),
    blueLn:  rgb01(0xba, 0xe6, 0xfd),
    ink:     rgb01(0x1e, 0x1b, 0x4b),
    sub:     rgb01(0x55, 0x55, 0x55),
    sol:     rgb01(0x77, 0x77, 0x77),
    metaLine:rgb01(0x88, 0x88, 0x88),
    rowLn:   rgb01(0xe5, 0xe7, 0xeb),
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

  function drawHeader(ctx, opts, title, sub) {
    const F = ctx.fonts;
    const top = PT.marginY;
    ctx.text(title, PT.marginX, top, { font: F.heavy, size: 14, color: C.blue });
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

  // Aufgabe zeichnen: Text mit '___' -> Schreiblinie an der Stelle.
  // x = linke Kante der Zelle, cellW = Zellbreite, fs = Schriftgröße
  function drawTask(ctx, t, idx, x, yTop, cellW, fs) {
    const F = ctx.fonts;
    ctx.text((idx + 1) + '.', x, yTop + (fs - 8) * 0.5, { font: F.heavy, size: 8, color: C.blue });
    const numW = ctx.textWidth('00.', F.heavy, 8) + 4;
    let tx = x + numW;
    const lineW = 38;  // Breite der Lücke (pt)

    // q an '___' aufteilen
    const parts = String(t.q).split('___');
    for (let p = 0; p < parts.length; p++) {
      const seg = parts[p];
      if (seg) {
        ctx.text(seg, tx, yTop, { font: F.bold, size: fs, color: C.ink });
        tx += ctx.textWidth(seg, F.bold, fs);
      }
      if (p < parts.length - 1) {
        // Lücke -> Schreiblinie
        const ly = yTop + fs * 0.95;
        ctx.line(tx + 2, ly, tx + 2 + lineW, ly, { color: C.line, w: 1 });
        tx += lineW + 4;
      }
    }
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
    const numPages = spec.numPages || 1;
    const cols = 2;
    const fs = 15;                // größer für bessere Lesbarkeit
    const rowH = fs * 1.7;        // Zeilenhöhe 
    const colW = PT.contentW / cols;
    const gen = (typeof spec.gen === 'function') ? spec.gen : null;

    // Kapazität (Aufgaben) einer Seite ab vertikaler Position topY
    function capacity(topY) {
      const avail = (PT.pageH - PT.marginY - 4) - topY;
      const rows = Math.max(1, Math.floor(avail / rowH));
      return rows * cols;
    }
    const topWithHeader = PT.marginY + 30 + 12;  // wie drawHeader zurückgibt
    const topNoHeader   = PT.marginY + 4;
    const capPage1 = capacity(topWithHeader);
    const capPageN = capacity(topNoHeader);
    const totalNeeded = (numPages <= 1) ? capPage1 : (capPage1 + capPageN);

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
      ctx.text('Keine Aufgaben \u2013 bitte Einheiten ausw\u00e4hlen.', PT.marginX, PT.marginY + 20,
               { font: fonts.bold, size: 11, color: C.sub });
      return await pdf.save();
    }

    // Aufteilung (kapazitätsgenau)
    const pageSlices = [];
    if (numPages <= 1) {
      pageSlices.push(tasks);
    } else {
      pageSlices.push(tasks.slice(0, capPage1));
      pageSlices.push(tasks.slice(capPage1));
    }

    let firstTopAfterHeader = 0;
    for (let pg = 0; pg < pageSlices.length; pg++) {
      const slice = pageSlices[pg];
      if (!slice.length) continue;
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      let y;
      if (pg === 0) {
        y = drawHeader(ctx, opts, spec.title || 'L\u00e4ngen & Gewichte', spec.sub || 'Rechne um und vergleiche');
        firstTopAfterHeader = y;
      } else {
        y = PT.marginY + 4;
      }
      const startIdx = (pg === 0) ? 0 : pageSlices[0].length;
      for (let i = 0; i < slice.length; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const x = PT.marginX + c * colW;
        const yTop = y + r * rowH;
        drawTask(ctx, slice[i], startIdx + i, x, yTop, colW, fs);
        // dünne Trennlinie unter der Zeile (volle Breite, nur einmal pro Zeile)
        if (c === 0) {
          const ly = yTop + rowH - 4;
          ctx.line(PT.marginX, ly, PT.pageW - PT.marginX, ly, { color: C.rowLn, w: 0.6 });
        }
      }
      drawFooter(ctx);
    }

    // Lösungsblock
    if (spec.showSol && tasks.length) {
      const pages = pdf.getPages();
      const last = pages[pages.length - 1];
      const lastSlice = pageSlices[pageSlices.length - 1];
      const lastRows = Math.ceil(lastSlice.length / cols);
      const lastTopY = (pageSlices.length === 1) ? firstTopAfterHeader : (PT.marginY + 4);
      const yAfter = lastTopY + lastRows * rowH + 8;

      const solLineH = 11;
      const solColW = PT.contentW / 6;
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
        ctx.text((i + 1) + '. ' + tasks[i].s, x, y + r * solLineH,
                 { font: fonts.regular, size: 7.5, color: C.sol });
      }
    }

    return await pdf.save();
  }

  global.LaengenPDF = { PT, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
