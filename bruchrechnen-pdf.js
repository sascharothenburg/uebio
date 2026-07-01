/* =====================================================================
   bruchrechnen-pdf.js  ·  PDF-Modul für die Bruchrechnen-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Brüche als Bild (Kreis-Tortenstücke / Balken-Segmente) als PDF mit
   absoluten Koordinaten -> identisch auf iOS und Android.

   Zwei Aufgabentypen:
     read  – Bild ist gefärbt, Bruch-Feld leer (Kind liest den Bruch ab)
     color – Bild ist leer, Bruch ist gegeben (Kind färbt das Bild an)

   Aufgabe: { shape:'circle'|'bar', n:Nenner, k:Zähler, type:'read'|'color' }
   spec: { tasks:[...], numPages, showSol, showNr }
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

  const C = {
    blue:    rgb01(0x03, 0x69, 0xa1),
    blue2:   rgb01(0x0e, 0xa5, 0xe9),   // FILL (Bild)
    green:   rgb01(0x16, 0xa3, 0x4a),   // FILLSOL (Lösung)
    line:    rgb01(0x03, 0x69, 0xa1),   // LINE (Konturen)
    ink:     rgb01(0x1e, 0x1b, 0x4b),
    sub:     rgb01(0x55, 0x55, 0x55),
    sol:     rgb01(0x77, 0x77, 0x77),
    metaLine:rgb01(0x88, 0x88, 0x88),
    boxBd:   rgb01(0xdc, 0x26, 0x26),   // rotes leeres Bruchfeld
    eq:      rgb01(0x94, 0xa3, 0xb8),
    white:   rgb01(0xff, 0xff, 0xff),
    cellBd:  rgb01(0xe5, 0xe7, 0xeb),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const GEO = {
    cols: 2,
    cellH: 120,     // Höhe einer Aufgabenzelle
    circleR: 34,    // Kreisradius
    barW: 130, barH: 38,
  };

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) {
        o = o || {};
        page.drawRectangle({
          x, y: PT.pageH - yTop - h, width: w, height: h,
          color: col(o.fill), borderColor: col(o.stroke),
          borderWidth: o.strokeWidth || 0,
        });
      },
      line(x1, y1, x2, y2, o) {
        o = o || {};
        page.drawLine({
          start:{x:x1, y:PT.pageH-y1}, end:{x:x2, y:PT.pageH-y2},
          thickness:o.w||1, color:col(o.color)||col(C.ink), dashArray:o.dash,
        });
      },
      circle(cx, cyTop, r, o) {
        o = o || {};
        page.drawCircle({
          x: cx, y: PT.pageH - cyTop, size: r,
          color: col(o.fill), borderColor: col(o.stroke),
          borderWidth: o.strokeWidth || 0,
        });
      },
      svgPath(d, x, yTop, o) {
        o = o || {};
        page.drawSvgPath(d, {
          x, y: PT.pageH - yTop,
          color: col(o.fill), borderColor: col(o.stroke),
          borderWidth: o.strokeWidth || 0,
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

  function drawHeader(ctx, opts, instr) {
    const F = ctx.fonts;
    const top = PT.marginY;
    ctx.text('Bruchrechnen', PT.marginX, top, { font: F.heavy, size: 14, color: C.blue });
    ctx.text(instr, PT.marginX, top + 18, { font: F.regular, size: 8, color: C.sub });
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

  // ---- Kreis in n Tortenstücke, erste `filled` gefärbt ----
  function drawCircleFrac(ctx, cx, cyTop, r, n, filled, fillCol) {
    if (n === 1) {
      ctx.circle(cx, cyTop, r, { fill: filled >= 1 ? fillCol : C.white, stroke: C.line, strokeWidth: 2 });
      return;
    }
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI - Math.PI/2;
      const a1 = ((i+1) / n) * 2 * Math.PI - Math.PI/2;
      // Punkte relativ zum Zentrum; svgPath nutzt (x,y) als Ursprung mit y-Flip
      const x0 = r * Math.cos(a0), y0 = r * Math.sin(a0);
      const x1 = r * Math.cos(a1), y1 = r * Math.sin(a1);
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      // Pfad im lokalen Koordinatensystem; Ursprung wird auf (cx, cyTop) gesetzt.
      // pdf-lib drawSvgPath: y wächst nach unten relativ zum Anker (wie SVG).
      const d = `M 0 0 L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
      const fc = (i < filled) ? fillCol : C.white;
      ctx.svgPath(d, cx, cyTop, { fill: fc, stroke: C.line, strokeWidth: 1.6 });
    }
  }

  // ---- Balken in n Segmente, erste `filled` gefärbt ----
  function drawBarFrac(ctx, x, yTop, w, h, n, filled, fillCol) {
    const seg = w / n;
    for (let i = 0; i < n; i++) {
      const fc = (i < filled) ? fillCol : C.white;
      ctx.rect(x + i*seg, yTop, seg, h, { fill: fc, stroke: C.line, strokeWidth: 1.4 });
    }
  }

  // ---- Bruch zeichnen (Zähler / Strich / Nenner) ----
  function drawFraction(ctx, cx, cyTop, k, n, c) {
    const F = ctx.fonts;
    const fsN = 16;
    ctx.textCentered(String(k), cx, cyTop, { font: F.heavy, size: fsN, color: c });
    const lineY = cyTop + fsN + 3;
    ctx.line(cx - 11, lineY, cx + 11, lineY, { color: c, w: 2 });
    ctx.textCentered(String(n), cx, lineY + 3, { font: F.heavy, size: fsN, color: c });
  }

  // ---- leeres Bruchfeld (zwei Kästchen + Strich) ----
  function drawEmptyFraction(ctx, cx, cyTop) {
    const bw = 22, bh = 16;
    ctx.rect(cx - bw/2, cyTop, bw, bh, { fill: C.white, stroke: C.boxBd, strokeWidth: 1.4 });
    const lineY = cyTop + bh + 4;
    ctx.line(cx - 15, lineY, cx + 15, lineY, { color: C.ink, w: 2 });
    ctx.rect(cx - bw/2, lineY + 4, bw, bh, { fill: C.white, stroke: C.boxBd, strokeWidth: 1.4 });
  }

  // Eine Aufgaben-Zelle zeichnen
  function drawTaskCell(ctx, t, idx, x, yTop, cellW, showNr, showSol) {
    const F = ctx.fonts;
    const cx = x + cellW/2;
    let y = yTop;
    if (showNr) {
      ctx.textCentered((idx+1) + '.', cx, y, { font: F.bold, size: 9, color: C.eq });
      y += 14;
    }
    if (t.type === 'color') {
      ctx.textCentered('F\u00e4rbe diesen Bruch an:', cx, y, { font: F.regular, size: 8, color: C.sub });
      y += 12;
    }
    // Layout: [Form] = [Bruch], horizontal zentriert
    const fillCol = showSol ? C.green : C.blue2;
    const isCircle = (t.shape === 'circle');
    const shapeW = isCircle ? GEO.circleR*2 : GEO.barW;
    const fracW = 30;
    const eqW = 16;
    const totalW = shapeW + eqW + fracW;
    let sx = cx - totalW/2;
    const midY = y + 30;

    // Form
    if (t.type === 'read') {
      // Bild gefärbt (k Teile)
      if (isCircle) drawCircleFrac(ctx, sx + GEO.circleR, midY, GEO.circleR, t.n, t.k, fillCol);
      else drawBarFrac(ctx, sx, midY - GEO.barH/2, GEO.barW, GEO.barH, t.n, t.k, fillCol);
    } else {
      // color: Bild leer (Lösung: gefärbt), sonst leer
      const f = showSol ? t.k : 0;
      if (isCircle) drawCircleFrac(ctx, sx + GEO.circleR, midY, GEO.circleR, t.n, f, fillCol);
      else drawBarFrac(ctx, sx, midY - GEO.barH/2, GEO.barW, GEO.barH, t.n, f, fillCol);
    }
    sx += shapeW;
    // = Zeichen
    ctx.textCentered('=', sx + eqW/2, midY - 8, { font: F.bold, size: 14, color: C.eq });
    sx += eqW;
    // Bruch
    const fcx = sx + fracW/2;
    if (t.type === 'read') {
      if (showSol) drawFraction(ctx, fcx, midY - 14, t.k, t.n, fillCol);
      else drawEmptyFraction(ctx, fcx, midY - 14);
    } else {
      drawFraction(ctx, fcx, midY - 14, t.k, t.n, C.ink);
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
    const tasks = (spec.tasks || []).filter(Boolean);
    const numPages = spec.numPages || 1;
    const showNr = spec.showNr !== false;
    const showSol = !!spec.showSol;
    const cols = GEO.cols;
    const colW = PT.contentW / cols;
    const cellH = GEO.cellH;
    const bottom = PT.pageH - PT.marginY;

    if (!tasks.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Aufgaben generiert.', PT.marginX, PT.marginY + 20,
               { font: fonts.bold, size: 11, color: C.sub });
      return await pdf.save();
    }

    // Instruktion
    const hasRead = tasks.some(t => t.type === 'read');
    const hasColor = tasks.some(t => t.type === 'color');
    let instr;
    if (hasRead && hasColor) instr = 'Schreibe den gef\u00e4rbten Bruch auf bzw. f\u00e4rbe den angegebenen Bruch an.';
    else if (hasRead) instr = 'Welcher Bruch ist jeweils gef\u00e4rbt? Schreibe Z\u00e4hler und Nenner.';
    else instr = 'F\u00e4rbe jeweils den angegebenen Bruch im Bild an.';

    // Kapazität
    function capacity(topY){ return Math.max(2, Math.floor((bottom - topY) / cellH) * cols); }
    const topWithHeader = PT.marginY + 30 + 12;

    const pageSlices = [];
    if (numPages <= 1) {
      pageSlices.push(tasks);
    } else {
      const cap1 = capacity(topWithHeader);
      pageSlices.push(tasks.slice(0, cap1));
      pageSlices.push(tasks.slice(cap1));
    }

    let lastCtx, lastColYBottom = 0;
    for (let pg = 0; pg < pageSlices.length; pg++) {
      const slice = pageSlices[pg];
      if (!slice.length) continue;
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      let y = (pg === 0) ? drawHeader(ctx, opts, instr) : (PT.marginY + 4);
      const startIdx = (pg === 0) ? 0 : pageSlices[0].length;
      for (let i = 0; i < slice.length; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const x = PT.marginX + c * colW;
        const yTop = y + r * cellH;
        drawTaskCell(ctx, slice[i], startIdx + i, x, yTop, colW, showNr, showSol);
      }
      lastCtx = ctx;
      lastColYBottom = y + Math.ceil(slice.length / cols) * cellH;
    }

    // Lösungsblock
    if (showSol && tasks.length) {
      const solStrings = tasks.map((t,i)=> (i+1) + '. ' + t.k + '/' + t.n);
      const solLineH = 11;
      const solRows = Math.ceil(solStrings.length / 6);
      const needed = 20 + solRows * solLineH;
      let sctx, sy;
      if (bottom - lastColYBottom >= needed) {
        sctx = lastCtx; sy = lastColYBottom + 4;
      } else {
        const sp = pdf.addPage([PT.pageW, PT.pageH]);
        sctx = makeCtx(sp, fonts); sy = PT.marginY + 6;
      }
      sctx.line(PT.marginX, sy, PT.pageW - PT.marginX, sy, { color: rgb01(0xba,0xe6,0xfd), w: 1 });
      sy += 8;
      sctx.text('L\u00d6SUNGEN', PT.marginX, sy, { font: fonts.heavy, size: 8, color: C.blue });
      sy += 12;
      const solColW = PT.contentW / 6;
      for (let i = 0; i < solStrings.length; i++) {
        const r = Math.floor(i / 6), cc = i % 6;
        const sx = PT.marginX + cc * solColW;
        sctx.text(solStrings[i], sx, sy + r * solLineH, { font: fonts.regular, size: 7.5, color: C.sol });
      }
    }

    return await pdf.save();
  }

  global.BruchrechnenPDF = { PT, GEO, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
