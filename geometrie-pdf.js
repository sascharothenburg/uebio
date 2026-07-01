/* =====================================================================
   geometrie-pdf.js  ·  PDF-Modul für die Geometrie-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Formen & Symmetrien als PDF mit absoluten Koordinaten ->
   identisch auf iOS und Android.

   Aufgabentypen:
     pickShape – Name vorgegeben, richtige Form aus 4 ankreuzen
     pickName  – Form gezeigt, richtigen Namen ankreuzen
     sym       – Form gezeigt, eine Symmetrieachse einzeichnen

   Aufgabe: { area:'shape'|'sym', sub:'pickShape'|'pickName'|'draw',
              shape:key, options:[keys] }
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
    fill:    rgb01(0xe0, 0xf2, 0xfe),   // hellblaue Formfüllung
    fillSol: rgb01(0xdc, 0xfc, 0xe7),   // hellgrün (Lösung)
    line:    rgb01(0x03, 0x69, 0xa1),
    axis:    rgb01(0xdc, 0x26, 0x26),   // rote Symmetrieachse
    ink:     rgb01(0x1e, 0x1b, 0x4b),
    sub:     rgb01(0x55, 0x55, 0x55),
    sol:     rgb01(0x77, 0x77, 0x77),
    metaLine:rgb01(0x88, 0x88, 0x88),
    boxBd:   rgb01(0x94, 0xa3, 0xb8),
    boxSol:  rgb01(0x16, 0xa3, 0x4a),
    white:   rgb01(0xff, 0xff, 0xff),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const GEO = { cols: 2 };

  // ---- Formen-Geometrie (repliziert die HTML-SHAPES) ----
  // Jede Form liefert für Größe s: ein draw(ctx,x,yTop,s,fillCol) und
  // axis(s) -> [x1,y1,x2,y2] (erste Symmetrieachse, lokal).
  function regPoly(s, n, startDeg) {
    const c = s/2, r = s/2 - s*0.1, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (startDeg + i*360/n) * Math.PI/180;
      pts.push([c + r*Math.cos(a), c + r*Math.sin(a)]);
    }
    return pts;
  }
  const NAMES = {
    quadrat:'Quadrat', rechteck:'Rechteck', dreieck:'Dreieck', kreis:'Kreis',
    trapez:'Trapez', raute:'Raute', fuenfeck:'F\u00fcnfeck', sechseck:'Sechseck', oval:'Oval'
  };
  const BASIC = ['quadrat','rechteck','dreieck','kreis'];

  // Polygon-Punkte je Form (lokal, in einer s×s-Box)
  function shapePolygon(key, s) {
    switch (key) {
      case 'dreieck': { const m=s*0.12; return [[s/2,m],[s-m,s-m],[m,s-m]]; }
      case 'trapez':  { const m=s*0.12; return [[s*0.3,m],[s*0.7,m],[s-m,s-m],[m,s-m]]; }
      case 'raute':   { const my=s*0.08,mx=s*0.26; return [[s/2,my],[s-mx,s/2],[s/2,s-my],[mx,s/2]]; }
      case 'fuenfeck':return regPoly(s,5,-90);
      case 'sechseck':return regPoly(s,6,-90);
      default: return null;
    }
  }

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
          color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0,
        });
      },
      ellipse(cx, cyTop, rx, ry, o) {
        o = o || {};
        page.drawEllipse({
          x: cx, y: PT.pageH - cyTop, xScale: rx, yScale: ry,
          color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0,
        });
      },
      polygon(points, o) {
        o = o || {};
        // points: [[x,yTop],...] -> SVG-Pfad relativ, mit Anker (0,0)
        let d = 'M ' + points.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' L ') + ' Z';
        page.drawSvgPath(d, {
          x: 0, y: PT.pageH,  // Anker oben-links der Seite; Punkte sind absolute Top-Koordinaten
          color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0,
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

  // Form zeichnen an Position (x,yTop), Größe s
  function drawShape(ctx, key, x, yTop, s, fillCol) {
    const stroke = C.line, sw = 2;
    if (key === 'quadrat') {
      const m = s*0.18, a = s - 2*m;
      ctx.rect(x+m, yTop+m, a, a, { fill: fillCol, stroke, strokeWidth: sw });
    } else if (key === 'rechteck') {
      const mx = s*0.1, my = s*0.26, w = s-2*mx, h = s-2*my;
      ctx.rect(x+mx, yTop+my, w, h, { fill: fillCol, stroke, strokeWidth: sw });
    } else if (key === 'kreis') {
      const r = s/2 - s*0.12;
      ctx.circle(x + s/2, yTop + s/2, r, { fill: fillCol, stroke, strokeWidth: sw });
    } else if (key === 'oval') {
      const rx = s/2 - s*0.08, ry = s/2 - s*0.2;
      ctx.ellipse(x + s/2, yTop + s/2, rx, ry, { fill: fillCol, stroke, strokeWidth: sw });
    } else {
      const pts = shapePolygon(key, s);
      if (pts) {
        const abs = pts.map(p => [x + p[0], yTop + p[1]]);
        ctx.polygon(abs, { fill: fillCol, stroke, strokeWidth: sw });
      }
    }
  }

  // Erste Symmetrieachse (lokal) -> [x1,y1,x2,y2]
  function firstAxis(key, s) {
    const c = s/2;
    switch (key) {
      case 'quadrat':  { const m=s*0.1; return [c,m,c,s-m]; }
      case 'rechteck': { const my=s*0.2; return [c,my,c,s-my]; }
      case 'dreieck':  { const m=s*0.12; return [c,m*0.6,c,s-m*0.85]; }
      case 'kreis':    { const m=s*0.06; return [c,m,c,s-m]; }
      case 'trapez':   return [c,s*0.06,c,s-s*0.06];
      case 'raute':    { const my=s*0.07; return [c,my,c,s-my]; }
      case 'oval':     { const my=s*0.16; return [c,my,c,s-my]; }
      case 'fuenfeck':
      case 'sechseck': {
        const n = key==='fuenfeck'?5:6, R = s/2 - s*0.04, a = (-90)*Math.PI/180;
        const dx = R*Math.cos(a), dy = R*Math.sin(a);
        return [c-dx, c-dy, c+dx, c+dy];
      }
      default: return [c, s*0.1, c, s-s*0.1];
    }
  }

  function drawHeader(ctx, opts) {
    const F = ctx.fonts;
    const top = PT.marginY;
    ctx.text('Geometrie \u2013 Formen & Symmetrien', PT.marginX, top, { font: F.heavy, size: 13, color: C.blue });
    ctx.text('Benenne die Formen, kreuze richtig an und arbeite mit den Symmetrieachsen.', PT.marginX, top + 17,
             { font: F.regular, size: 8, color: C.sub });
    const fields = [];
    if (opts.showName) fields.push(['Name:', 90]);
    if (opts.showDate) fields.push(['Datum:', 52]);
    if (opts.showKl)   fields.push(['Klasse:', 30]);
    const right = PT.pageW - PT.marginX;
    const gap = 12, my = top + 1;
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
    const lineY = top + 28;
    ctx.line(PT.marginX, lineY, PT.pageW - PT.marginX, lineY, { color: C.blue, w: 2.5 });
    return lineY + 12;
  }

  function questionText(t) {
    if (t.area === 'shape') {
      if (t.sub === 'pickName') return 'Wie hei\u00dft diese Form? Kreuze an.';
      return 'Kreuze die Form an: ' + NAMES[t.shape];
    }
    return 'Zeichne eine Symmetrieachse ein.';
  }

  // Höhe einer Aufgabe (für fließendes Layout)
  function taskHeight(t) {
    if (t.area === 'shape' && t.sub === 'pickShape') return 16 + 54 + 18;       // Frage + Formenreihe + Kästchen
    if (t.area === 'shape' && t.sub === 'pickName')  return 16 + 62 + 20;       // Frage + Form + Wortzeile
    return 16 + 74;                                                              // Symmetrie: Frage + Form
  }

  // Checkbox
  function checkbox(ctx, x, yTop, sz, checked) {
    ctx.rect(x, yTop, sz, sz, { stroke: checked ? C.boxSol : C.boxBd, strokeWidth: 1.4, fill: checked ? C.boxSol : C.white });
    if (checked) {
      // Häkchen
      ctx.line(x + sz*0.22, yTop + sz*0.55, x + sz*0.42, yTop + sz*0.75, { color: C.white, w: 1.4 });
      ctx.line(x + sz*0.42, yTop + sz*0.75, x + sz*0.8, yTop + sz*0.28, { color: C.white, w: 1.4 });
    }
  }

  function drawTask(ctx, t, idx, x, yTop, cellW, showNr, showSol) {
    const F = ctx.fonts;
    let y = yTop;
    // Frage
    const q = (showNr ? (idx+1) + '. ' : '') + questionText(t);
    ctx.text(q, x, y, { font: F.bold, size: 8.5, color: C.ink });
    y += 16;

    if (t.area === 'shape' && t.sub === 'pickShape') {
      // 4 Formen nebeneinander mit Kästchen darunter
      const s = 42;
      const n = t.options.length;
      const slotW = cellW / n;
      t.options.forEach((o, i) => {
        const sx = x + i*slotW + (slotW - s)/2;
        const correct = showSol && o === t.shape;
        drawShape(ctx, o, sx, y, s, correct ? C.fillSol : C.fill);
        checkbox(ctx, x + i*slotW + slotW/2 - 6, y + s + 4, 12, correct);
      });
    } else if (t.area === 'shape' && t.sub === 'pickName') {
      // Form mittig, darunter Wort-Optionen mit Kästchen
      const s = 50;
      drawShape(ctx, t.shape, x + (cellW - s)/2, y, s, C.fill);
      let oy = y + s + 8;
      let ox = x;
      t.options.forEach((o) => {
        const correct = showSol && o === t.shape;
        checkbox(ctx, ox, oy, 11, correct);
        ctx.text(NAMES[o], ox + 15, oy + 1, { font: F.regular, size: 8.5, color: C.ink });
        ox += 15 + ctx.textWidth(NAMES[o], F.regular, 8.5) + 14;
        if (ox > x + cellW - 50) { ox = x; oy += 14; }
      });
    } else {
      // Symmetrie: Form, in Lösung mit Achse
      const s = 62;
      const sx = x + (cellW - s)/2;
      drawShape(ctx, t.shape, sx, y, s, C.fill);
      if (showSol) {
        const a = firstAxis(t.shape, s);
        ctx.line(sx + a[0], y + a[1], sx + a[2], y + a[3], { color: C.axis, w: 2, dash: [5,3] });
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
    const tasks = (spec.tasks || []).filter(Boolean);
    const numPages = spec.numPages || 1;
    const showNr = spec.showNr !== false;
    const showSol = !!spec.showSol;
    const cols = GEO.cols;
    const colGap = 6 * MM;
    const colW = (PT.contentW - colGap) / cols;
    const bottom = PT.pageH - PT.marginY;
    const rowGap = 6;

    if (!tasks.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Aufgaben generiert.', PT.marginX, PT.marginY + 20, { font: fonts.bold, size: 11, color: C.sub });
      return await pdf.save();
    }

    // Platzieren (fließend, 2 Spalten, variable Höhe)
    const placed = [];
    let pageNo = 0;
    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let topY = drawHeader(ctx, opts);
    let colY = [topY, topY];

    function newPage() {
      pageNo++;
      page = pdf.addPage([PT.pageW, PT.pageH]);
      ctx = makeCtx(page, fonts);
      const ty = PT.marginY + 4;
      colY = [ty, ty];
    }

    const used = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const h = taskHeight(t);
      let c = (colY[0] <= colY[1]) ? 0 : 1;
      if (colY[c] + h > bottom) {
        const other = 1 - c;
        if (colY[other] + h <= bottom) c = other;
        else {
          if (pageNo + 1 >= numPages) break;
          newPage(); c = 0;
        }
      }
      const x = PT.marginX + c * (colW + colGap);
      placed.push({ t, idx: used.length, ctx, x, yTop: colY[c] });
      used.push(t);
      colY[c] += h + rowGap;
    }

    placed.forEach(pl => drawTask(pl.ctx, pl.t, pl.idx, pl.x, pl.yTop, colW, showNr, showSol));

    // Lösungsblock (kompakt) auf letzter Seite
    if (showSol && used.length) {
      const yAfter = Math.max(colY[0], colY[1]) + 4;
      const solStrings = used.map((t,i) => {
        if (t.area === 'sym') return (i+1) + '. Achse einzeichnen';
        return (i+1) + '. ' + NAMES[t.shape];
      });
      const solLineH = 11, solRows = Math.ceil(solStrings.length/4);
      const needed = 20 + solRows*solLineH;
      let sctx, sy;
      if (bottom - yAfter >= needed) { sctx = ctx; sy = yAfter; }
      else { const sp = pdf.addPage([PT.pageW, PT.pageH]); sctx = makeCtx(sp, fonts); sy = PT.marginY + 6; }
      sctx.line(PT.marginX, sy, PT.pageW - PT.marginX, sy, { color: rgb01(0xba,0xe6,0xfd), w: 1 });
      sy += 8;
      sctx.text('L\u00d6SUNGEN', PT.marginX, sy, { font: fonts.heavy, size: 8, color: C.blue });
      sy += 12;
      const solColW = PT.contentW / 4;
      for (let i = 0; i < solStrings.length; i++) {
        const r = Math.floor(i/4), cc = i%4;
        sctx.text(solStrings[i], PT.marginX + cc*solColW, sy + r*solLineH, { font: fonts.regular, size: 7.5, color: C.sol });
      }
    }

    return await pdf.save();
  }

  global.GeometriePDF = { PT, GEO, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
