/* =====================================================================
   grundrechnen-pdf.js  ·  PDF-Modul für die Grundrechnen-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Plus/Minus-Arbeitsblätter als PDF mit absoluten Koordinaten ->
   identisch auf iOS (WebKit) und Android (Chromium).

   Aufgaben sind Objekte { left, op, right, result } (geparst aus
   Strings wie "5 + 12 = §"). Die Lücke ('§' oder '#') kann an jeder
   Position stehen (left/right/result). Zahlen werden rechtsbündig in
   festen Spaltenbreiten ausgerichtet -> alle Aufgaben fluchten sauber.

   spec: { tasks:[{left,op,right,result}], numPages, showSol }
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
    ink:     rgb01(0x22, 0x22, 0x22),
    sub:     rgb01(0x55, 0x55, 0x55),
    sol:     rgb01(0x77, 0x77, 0x77),
    metaLine:rgb01(0x88, 0x88, 0x88),
    box:     rgb01(0x22, 0x22, 0x22),
    colLn:   rgb01(0xdd, 0xdd, 0xdd),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  // ---- Geometrie (eine Quelle der Wahrheit, auch von der HTML genutzt) ----
  const GEO = {
    cols: 2,        // 2 Spalten
    fs:   20,       // Schriftgröße
  };
  GEO.rowH = GEO.fs * 1.5;

  // Wie viele Aufgaben passen bei N Seiten insgesamt?
  function capacity(topY) {
    const avail = (PT.pageH - PT.marginY - 4) - topY;
    const rows = Math.max(1, Math.floor(avail / GEO.rowH));
    return rows * GEO.cols;
  }
  const TOP_WITH_HEADER = PT.marginY + 30 + 12;
  const TOP_NO_HEADER   = PT.marginY + 4;
  function capPage1(){ return capacity(TOP_WITH_HEADER); }
  function capPageN(){ return capacity(TOP_NO_HEADER); }
  function capacityForPages(numPages){
    return (numPages <= 1) ? capPage1() : (capPage1() + capPageN());
  }

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
      textRight(str, rx, yTop, o) {
        o = o || {};
        const f = o.font || fonts.regular;
        const size = o.size || 10;
        const w = f.widthOfTextAtSize(String(str), size);
        this.text(str, rx - w, yTop, o);
      },
      textWidth(str, font, size){ return (font||fonts.regular).widthOfTextAtSize(String(str), size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts) {
    const F = ctx.fonts;
    const top = PT.marginY;
    ctx.text('Mathe-Aufgaben', PT.marginX, top, { font: F.heavy, size: 14, color: C.blue });
    ctx.text('L\u00f6se die Aufgaben', PT.marginX, top + 18, { font: F.regular, size: 8, color: C.sub });

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

  function isBox(s){ return s === '\u00a7' || s === '#'; }
  function digits(s){ return isBox(s) ? 0 : String(s).replace('-','').length; }

  // Eine Aufgabe zeichnen, rechtsbündig in festen Spaltenbreiten.
  // layout = { dw, opw, mL, mR, mRes, fs, slotGap }
  function drawProblem(ctx, p, idx, x, yTop, layout) {
    const F = ctx.fonts;
    const { dw, opw, mL, mR, mRes, fs } = layout;
    // Nummer
    ctx.text((idx + 1) + '.', x, yTop + (fs - 9) * 0.5, { font: F.heavy, size: 9, color: C.blue });
    const numW = ctx.textWidth('00.', F.heavy, 9) + 6;
    let cx = x + numW;

    const gap = fs * 0.35;  // Abstand zwischen Slots/Operatoren

    function slot(val, maxDig) {
      const w = maxDig * dw;
      if (isBox(val)) {
        // Schreiblinie (Box) auf voller Slotbreite
        const ly = yTop + fs * 0.96;
        ctx.line(cx, ly, cx + w, ly, { color: C.box, w: 1.6 });
      } else {
        // rechtsbündig
        ctx.textRight(String(val), cx + w, yTop, { font: F.bold, size: fs, color: C.ink });
      }
      cx += w;
    }
    function op(sym) {
      cx += gap;
      ctx.textCentered(sym, cx + opw/2, yTop, { font: F.regular, size: fs, color: C.sub });
      cx += opw + gap;
    }

    slot(p.left, mL);
    op(p.op);
    slot(p.right, mR);
    op('=');
    slot(p.result, mRes);
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
    const cols = GEO.cols;
    const fs = GEO.fs;
    const rowH = GEO.rowH;
    const colW = PT.contentW / cols;
    const gen = (typeof spec.gen === 'function') ? spec.gen : null;

    // Aufgaben besorgen: bevorzugt Generator (füllt kapazitätsgenau), sonst feste Liste
    let tasks;
    if (gen) {
      const total = capacityForPages(numPages);
      tasks = [];
      for (let i = 0; i < total; i++) {
        const t = gen(i);
        if (t) tasks.push(t);
      }
    } else {
      tasks = (spec.tasks || []).filter(Boolean);
    }

    if (!tasks.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Aufgaben eingegeben.', PT.marginX, PT.marginY + 20,
               { font: fonts.bold, size: 11, color: C.sub });
      return await pdf.save();
    }

    // ---- Ziffernbreiten ermitteln (Helvetica bold, monospace-artige Ziffern) ----
    const dw = fonts.bold.widthOfTextAtSize('0', fs);     // Ziffernbreite
    const opw = fonts.bold.widthOfTextAtSize('+', fs);    // Operatorbreite

    // maximale Stellen je Position über alle Aufgaben (min. 2 für Boxen)
    let mL = 1, mR = 1, mRes = 2;
    tasks.forEach(p => {
      mL = Math.max(mL, isBox(p.left) ? 2 : digits(p.left));
      mR = Math.max(mR, isBox(p.right) ? 2 : digits(p.right));
      mRes = Math.max(mRes, isBox(p.result) ? 2 : digits(p.result));
    });
    const layout = { dw, opw, mL, mR, mRes, fs };

    // ---- Seiten-Aufteilung (kapazitätsgenau) ----
    const cap1 = capPage1();

    const pageSlices = [];
    if (numPages <= 1) {
      pageSlices.push(tasks);
    } else {
      pageSlices.push(tasks.slice(0, cap1));
      pageSlices.push(tasks.slice(cap1));
    }

    let firstTopAfterHeader = 0;
    for (let pg = 0; pg < pageSlices.length; pg++) {
      const slice = pageSlices[pg];
      if (!slice.length) continue;
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      let y;
      if (pg === 0) {
        y = drawHeader(ctx, opts);
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
        drawProblem(ctx, slice[i], startIdx + i, x, yTop, layout);
        // senkrechte Trennlinie zwischen den Spalten (einmal, in der Mitte)
        if (c === 0 && slice[i+1]) {
          const lx = PT.marginX + colW - 6;
          ctx.line(lx, yTop, lx, yTop + rowH - 4, { color: C.colLn, w: 0.6, dash:[2,2] });
        }
      }
      drawFooter(ctx);
    }

    // ---- Lösungsblock ----
    if (spec.showSol && tasks.length) {
      const pages = pdf.getPages();
      const last = pages[pages.length - 1];
      const lastSlice = pageSlices[pageSlices.length - 1];
      const lastRows = Math.ceil(lastSlice.length / cols);
      const lastTopY = (pageSlices.length === 1) ? firstTopAfterHeader : (PT.marginY + 4);
      const yAfter = lastTopY + lastRows * rowH + 8;

      // Lösung = vollständige Gleichung mit ausgefüllter Lücke
      const solStrings = tasks.map((p, i) => {
        const L = isBox(p.left) ? solveFor(p, 'left') : p.left;
        const R = isBox(p.right) ? solveFor(p, 'right') : p.right;
        const Res = isBox(p.result) ? solveFor(p, 'result') : p.result;
        return (i+1) + '. ' + L + ' ' + p.op + ' ' + R + ' = ' + Res;
      });

      const solLineH = 11;
      const solColW = PT.contentW / 4;
      const solRows = Math.ceil(solStrings.length / 4);
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
      for (let i = 0; i < solStrings.length; i++) {
        const r = Math.floor(i / 4), c = i % 4;
        const x = PT.marginX + c * solColW;
        ctx.text(solStrings[i], x, y + r * solLineH, { font: fonts.regular, size: 7.5, color: C.sol });
      }
    }

    return await pdf.save();
  }

  // Lücke ausrechnen (für Lösungsblock)
  function solveFor(p, which) {
    const a = parseFloat(p.left), b = parseFloat(p.right), res = parseFloat(p.result);
    if (which === 'result') return (p.op === '+') ? (a + b) : (a - b);
    if (which === 'left')   return (p.op === '+') ? (res - b) : (res + b);
    if (which === 'right')  return (p.op === '+') ? (res - a) : (a - res);
    return '?';
  }

  global.GrundrechnenPDF = { PT, GEO, capacityForPages, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
