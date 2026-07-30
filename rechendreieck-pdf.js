/* =====================================================================
   rechendreieck-pdf.js  ·  PDF-Modul für die Rechendreieck-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Rechendreiecke als PDF mit absoluten Koordinaten -> identisch auf iOS/Android.
   Ein Dreieck: vals {T,L,R,TL,TR,LR}, given = Liste der vorgegebenen Felder.
   Es gilt immer TL=T+L, TR=T+R, LR=L+R.

   spec: { tris:[{vals,given,level}], numPages, showSol, showNr }
   opts: { showName, showDate, showKl }
   Abhängig (global): window.PDFLib
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14*MM, marginY: 12*MM };
  PT.contentW = PT.pageW - PT.marginX*2;

  const C = {
    blue:     rgb01(0x03,0x69,0xa1),
    edge:     rgb01(0x7d,0xd3,0xfc),
    inFill:   rgb01(0xe0,0xf2,0xfe),
    inBd:     rgb01(0x0e,0xa5,0xe9),
    outFill:  rgb01(0xff,0xff,0xff),
    outBd:    rgb01(0x03,0x69,0xa1),
    gapBd:    rgb01(0xdc,0x26,0x26),
    gapSol:   rgb01(0x16,0xa3,0x4a),
    gapSolBg: rgb01(0xdc,0xfc,0xe7),
    ink:      rgb01(0x1e,0x1b,0x4b),
    sub:      rgb01(0x55,0x55,0x55),
    sol:      rgb01(0x77,0x77,0x77),
    metaLine: rgb01(0x88,0x88,0x88),
    blueLn:   rgb01(0xba,0xe6,0xfd),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  /* Entwurfsraster eines Dreiecks. Alle Werte in pt, y von oben gezählt.
     Wird in der Spalte horizontal zentriert (offsetX). */
  const GEO = {
    cols: 3,
    designW: 160,     // Breite des Entwurfsrasters
    blockH: 155,      // Höhe eines Dreiecks ohne Nummer
    r: 19,            // Radius der Innenfelder (Kreise)
    rw: 42, rh: 27,   // Aussenfelder (Rechtecke)
    nrH: 14,          // Höhe der Aufgabennummer
    rowGap: 10        // Abstand zwischen zwei Dreieckszeilen
  };

  /* Mittelpunkte im Entwurfsraster */
  const NODES = {
    T:  { x: 80,  y: 26,  shape:'circle' },
    L:  { x: 30,  y: 132, shape:'circle' },
    R:  { x: 130, y: 132, shape:'circle' },
    TL: { x: 55,  y: 79,  shape:'rect' },
    TR: { x: 105, y: 79,  shape:'rect' },
    LR: { x: 80,  y: 132, shape:'rect' }
  };
  const EDGES = [['T','L'],['T','R'],['L','R']];

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) {
        o = o || {};
        page.drawRectangle({ x, y: PT.pageH-yTop-h, width:w, height:h,
          color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth||0 });
      },
      circle(cx, cyTop, r, o) {
        o = o || {};
        page.drawCircle({ x: cx, y: PT.pageH-cyTop, size: r,
          color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth||0 });
      },
      line(x1,y1,x2,y2,o){ o=o||{}; page.drawLine({ start:{x:x1,y:PT.pageH-y1}, end:{x:x2,y:PT.pageH-y2}, thickness:o.w||1, color:col(o.color)||col(C.ink), dashArray:o.dash }); },
      text(str,x,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; page.drawText(String(str),{x,y:PT.pageH-yTop-asc,size,font:f,color:col(o.color)||col(C.ink)}); },
      textCentered(str,cx,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const w=f.widthOfTextAtSize(String(str),size); this.text(str,cx-w/2,yTop,o); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts) {
    const F = ctx.fonts; const top = PT.marginY;
    ctx.text('Rechendreiecke', PT.marginX, top, { font:F.heavy, size:14, color:C.blue });
    ctx.text('Trage die fehlenden Zahlen ein', PT.marginX, top+18, { font:F.regular, size:8, color:C.sub });
    const fields=[];
    if(opts.showName) fields.push(['Name:',95]);
    if(opts.showDate) fields.push(['Datum:',55]);
    if(opts.showKl) fields.push(['Klasse:',32]);
    const right=PT.pageW-PT.marginX; const gap=14, my=top+1;
    let totalW=0; fields.forEach(f=>{ totalW+=ctx.textWidth(f[0],F.regular,8)+3+f[1]+gap; }); totalW-=gap;
    let mx=right-totalW;
    fields.forEach(f=>{ const labW=ctx.textWidth(f[0],F.regular,8); ctx.text(f[0],mx,my,{font:F.regular,size:8,color:C.sub}); const lineX=mx+labW+3; ctx.line(lineX,my+10,lineX+f[1],my+10,{color:C.metaLine,w:1}); mx=lineX+f[1]+gap; });
    const lineY=top+30; ctx.line(PT.marginX,lineY,PT.pageW-PT.marginX,lineY,{color:C.blue,w:2.5});
    return lineY+12;
  }

  function triHeight(showNr) {
    return (showNr ? GEO.nrH : 0) + GEO.blockH;
  }

  /* Schriftgröße abhängig von der Stellenzahl, damit 3-stellige
     Zahlen nicht aus dem Kreis laufen. */
  function fontSizeFor(vals) {
    let md = 1;
    for (const k in vals) { const d = String(vals[k]).length; if (d > md) md = d; }
    return md >= 3 ? 11.5 : 13;
  }

  function drawTriangle(ctx, task, idx, cellX, yTop, cellW, showNr, showSol) {
    const F = ctx.fonts;
    let y = yTop;
    if (showNr) {
      ctx.text((idx+1)+'.', cellX, y, { font:F.bold, size:9, color:C.blue });
      y += GEO.nrH;
    }
    const ox = cellX + (cellW - GEO.designW)/2;
    const fs = fontSizeFor(task.vals);
    const givenSet = {};
    task.given.forEach(g => { givenSet[g] = true; });

    /* 1. Verbindungslinien zuerst -> werden von den Feldern überdeckt */
    EDGES.forEach(e => {
      const a = NODES[e[0]], b = NODES[e[1]];
      ctx.line(ox+a.x, y+a.y, ox+b.x, y+b.y, { color:C.edge, w:1.6 });
    });

    /* 2. Felder */
    for (const key in NODES) {
      const n = NODES[key];
      const cx = ox + n.x, cy = y + n.y;
      const isGap = !givenSet[key];
      const isCircle = (n.shape === 'circle');

      let fill, stroke, sw;
      if (isGap && showSol)      { fill = C.gapSolBg; stroke = C.gapSol; sw = 1.6; }
      else if (isGap)            { fill = isCircle ? C.inFill : C.outFill; stroke = C.gapBd; sw = 1.6; }
      else                       { fill = isCircle ? C.inFill : C.outFill; stroke = isCircle ? C.inBd : C.outBd; sw = 1.2; }

      if (isCircle) {
        ctx.circle(cx, cy, GEO.r, { fill: fill, stroke: stroke, strokeWidth: sw });
      } else {
        ctx.rect(cx-GEO.rw/2, cy-GEO.rh/2, GEO.rw, GEO.rh, { fill: fill, stroke: stroke, strokeWidth: sw });
      }

      const showVal = !isGap || showSol;
      if (showVal) {
        const valCol = (isGap && showSol) ? C.gapSol : C.ink;
        ctx.textCentered(String(task.vals[key]), cx, cy - fs*0.52, { font:F.bold, size:fs, color:valCol });
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
    opts = opts || {}; spec = spec || {};
    const tris = (spec.tris || []).filter(Boolean);
    const numPages = spec.numPages || 1;
    const showNr = spec.showNr !== false;
    const showSol = !!spec.showSol;
    const cols = GEO.cols;
    const colGap = 5*MM;
    const colW = (PT.contentW - colGap*(cols-1))/cols;
    const bottom = PT.pageH - PT.marginY;

    if (!tris.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Dreiecke generiert.', PT.marginX, PT.marginY+20, { font:fonts.bold, size:11, color:C.sub });
      return await pdf.save();
    }

    const h = triHeight(showNr);
    const placed = [];
    let pageNo = 0;
    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let rowY = drawHeader(ctx, opts);
    let colIdx = 0;
    function newPage(){ pageNo++; page=pdf.addPage([PT.pageW,PT.pageH]); ctx=makeCtx(page,fonts); rowY=PT.marginY+4; colIdx=0; }

    const used = [];
    for (let i = 0; i < tris.length; i++) {
      if (colIdx >= cols) { colIdx = 0; rowY += h + GEO.rowGap; }
      if (rowY + h > bottom) {
        if (pageNo+1 >= numPages) break;
        newPage();
      }
      const x = PT.marginX + colIdx*(colW+colGap);
      placed.push({ t: tris[i], idx: used.length, ctx, x, yTop: rowY });
      used.push(tris[i]);
      colIdx++;
    }
    placed.forEach(pl => drawTriangle(pl.ctx, pl.t, pl.idx, pl.x, pl.yTop, colW, showNr, showSol));

    /* Kein separater Lösungs-Textblock: beim Rechendreieck sind bei
       showSol bereits alle sechs Werte grün im Bild sichtbar. Ein
       zusätzlicher Block würde nur eine weitere Seite verbrauchen. */

    return await pdf.save();
  }

  global.RechendreieckPDF = { PT, GEO, NODES, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
