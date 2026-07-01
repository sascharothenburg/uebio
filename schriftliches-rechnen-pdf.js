/* =====================================================================
   schriftliches-rechnen-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Schriftliche Rechenverfahren (+, −, ×, :) in Schulheft-Kästchen (5×7mm),
   rechtsbündig, mit leeren Rechenzeilen. PDF mit absoluten Koordinaten ->
   identisch auf iOS/Android.

   Aufgabe: { op:'add'|'sub'|'mul'|'div', a,b,res, rest?, divmode? }
   spec: { tasks:[...], numPages, showSol, showNr }
   opts: { showName, showDate, showKl }
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14*MM, marginY: 12*MM };
  PT.contentW = PT.pageW - PT.marginX*2;

  const C = {
    blue:    rgb01(0x03,0x69,0xa1),
    cellBd:  rgb01(0xcb,0xd5,0xe1),
    ink:     rgb01(0x1e,0x1b,0x4b),
    green:   rgb01(0x16,0xa3,0x4a),
    sub:     rgb01(0x55,0x55,0x55),
    sol:     rgb01(0x77,0x77,0x77),
    metaLine:rgb01(0x88,0x88,0x88),
    rule:    rgb01(0x1e,0x1b,0x4b),
    blueLn:  rgb01(0xba,0xe6,0xfd),
    white:   rgb01(0xff,0xff,0xff),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  // Kästchen 5×7mm
  const CW = 5*MM, CH = 7*MM;
  const GEO = { cols: 2 };

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x,yTop,w,h,o){ o=o||{}; page.drawRectangle({x,y:PT.pageH-yTop-h,width:w,height:h,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0}); },
      line(x1,y1,x2,y2,o){ o=o||{}; page.drawLine({start:{x:x1,y:PT.pageH-y1},end:{x:x2,y:PT.pageH-y2},thickness:o.w||1,color:col(o.color)||col(C.ink),dashArray:o.dash}); },
      text(str,x,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; page.drawText(String(str),{x,y:PT.pageH-yTop-asc,size,font:f,color:col(o.color)||col(C.ink)}); },
      textCentered(str,cx,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const w=f.widthOfTextAtSize(String(str),size); this.text(str,cx-w/2,yTop,o); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts) {
    const F=ctx.fonts; const top=PT.marginY;
    ctx.text('Schriftliches Rechnen', PT.marginX, top, { font:F.heavy, size:14, color:C.blue });
    ctx.text('Rechne in den K\u00e4stchen', PT.marginX, top+18, { font:F.regular, size:8, color:C.sub });
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

  const OPSYM = { add:'+', sub:'-', mul:'\u00d7', div:':' };
  function maxLen(t){ return Math.max((''+t.a).length,(''+t.b).length,(''+t.res).length); }

  // Höhe einer Aufgabe (Anzahl Gitterzeilen * CH + Label)
  function taskGridRows(t) {
    if (t.op === 'div') {
      const cols = (''+t.a).length;
      return 1 + (cols + 2); // Dividendzeile + Rechenzeilen
    }
    let rows = 2 + 1; // a, b, ergebnis
    if (t.op === 'mul' && (''+t.b).length >= 2) rows += (''+t.b).length; // Teilprodukte
    return rows;
  }
  function taskHeight(t, showNr) {
    return (showNr?14:0) + taskGridRows(t)*CH + 12;
  }

  // +,-,× zeichnen
  function drawVert(ctx, t, x, yTop, cellW, showSol) {
    const F = ctx.fonts;
    const w = maxLen(t) + 1;             // +1 Operatorspalte
    const gridW = w * CW;
    const gx = x + (cellW - gridW)/2;    // zentriert in der Zelle
    const fs = 13;
    const aStr = ''+t.a, bStr = ''+t.b, resStr = ''+t.res;

    function rowCells(str, opSym, fill, y, valCol) {
      const pad = w - str.length;
      for (let c = 0; c < w; c++) {
        const cx = gx + c*CW;
        ctx.rect(cx, y, CW, CH, { stroke: C.cellBd, strokeWidth: 0.8 });
        let ch = '';
        if (c === 0 && opSym) ch = opSym;
        else if (fill) { const idx = c - pad; if (idx >= 0 && idx < str.length) ch = str[idx]; }
        if (ch) ctx.textCentered(ch, cx + CW/2, y + (CH-fs)/2, { font: F.bold, size: fs, color: valCol || C.ink });
      }
    }
    let y = yTop;
    rowCells(aStr, '', true, y, C.ink); y += CH;
    rowCells(bStr, OPSYM[t.op], true, y, C.ink); y += CH;
    // Strich
    ctx.line(gx, y+1, gx + gridW, y+1, { color: C.rule, w: 1.8 }); y += 3;
    // Multiplikation mit 2-stelligem Faktor: Teilprodukt-Leerzeilen
    if (t.op === 'mul' && bStr.length >= 2) {
      for (let p = 0; p < bStr.length; p++) {
        for (let c = 0; c < w; c++) ctx.rect(gx + c*CW, y, CW, CH, { stroke: C.cellBd, strokeWidth: 0.8 });
        y += CH;
      }
      ctx.line(gx, y+1, gx + gridW, y+1, { color: C.rule, w: 1.8 }); y += 3;
    }
    rowCells(resStr, '', showSol, y, showSol ? C.green : C.ink);
  }

  // Division zeichnen
  function drawDiv(ctx, t, x, yTop, cellW, showSol) {
    const F = ctx.fonts;
    const aStr = ''+t.a;
    const cols = aStr.length;
    const gridW = cols * CW;
    const gx = x; // linksbündig in der Zelle
    const fs = 13;
    let y = yTop;
    // Dividendzeile (gefüllt)
    for (let c = 0; c < cols; c++) {
      const cx = gx + c*CW;
      ctx.rect(cx, y, CW, CH, { stroke: C.cellBd, strokeWidth: 0.8 });
      ctx.textCentered(aStr[c], cx + CW/2, y + (CH-fs)/2, { font: F.bold, size: fs, color: C.ink });
    }
    // rechts daneben: " : b = ____"
    const rx = gx + gridW + 8;
    const ry = y + (CH-fs)/2;
    let rt = OPSYM.div + ' ' + t.b + ' = ';
    ctx.text(rt, rx, ry, { font: F.bold, size: fs, color: C.ink });
    const rtW = ctx.textWidth(rt, F.bold, fs);
    const lineX = rx + rtW;
    const lineW = 40;
    if (showSol) {
      ctx.text(String(t.res), lineX + 2, ry, { font: F.bold, size: fs, color: C.green });
    }
    ctx.line(lineX, y + CH - 3, lineX + lineW, y + CH - 3, { color: C.rule, w: 1.4 });
    // Rest
    if (t.rest > 0) {
      const restY = y + CH + 4;
      let restT = 'Rest ';
      ctx.text(restT, rx, restY + (CH-fs)/2, { font: F.regular, size: fs*0.9, color: C.ink });
      const rW = ctx.textWidth(restT, F.regular, fs*0.9);
      if (showSol) ctx.text(String(t.rest), rx + rW + 2, restY + (CH-fs)/2, { font: F.bold, size: fs, color: C.green });
      ctx.line(rx + rW, restY + CH - 5, rx + rW + 28, restY + CH - 5, { color: C.rule, w: 1.4 });
    }
    y += CH;
    // leere Rechenzeilen (cols+2 Zeilen)
    for (let r = 0; r < cols + 1; r++) {
      for (let c = 0; c < cols; c++) ctx.rect(gx + c*CW, y, CW, CH, { stroke: C.cellBd, strokeWidth: 0.8 });
      y += CH;
    }
  }

  function drawTask(ctx, t, idx, x, yTop, cellW, showNr, showSol) {
    const F = ctx.fonts;
    let y = yTop;
    if (showNr) {
      ctx.text((idx+1)+'.', x, y, { font:F.bold, size:9, color:C.blue });
      y += 14;
    }
    if (t.op === 'div') drawDiv(ctx, t, x, y, cellW, showSol);
    else drawVert(ctx, t, x, y, cellW, showSol);
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
    const tasks = (spec.tasks || []).filter(Boolean);
    const numPages = spec.numPages || 1;
    const showNr = spec.showNr !== false;
    const showSol = !!spec.showSol;
    const cols = GEO.cols;
    const colGap = 8*MM;
    const colW = (PT.contentW - colGap)/cols;
    const bottom = PT.pageH - PT.marginY;
    const rowGap = 10;

    if (!tasks.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Aufgaben generiert.', PT.marginX, PT.marginY+20, { font:fonts.bold, size:11, color:C.sub });
      return await pdf.save();
    }

    const placed = [];
    let pageNo = 0;
    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let topY = drawHeader(ctx, opts);
    let colY = [topY, topY];
    function newPage(){ pageNo++; page=pdf.addPage([PT.pageW,PT.pageH]); ctx=makeCtx(page,fonts); const ty=PT.marginY+4; colY=[ty,ty]; }

    const used = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const h = taskHeight(t, showNr);
      let c = (colY[0] <= colY[1]) ? 0 : 1;
      if (colY[c] + h > bottom) {
        const other = 1-c;
        if (colY[other] + h <= bottom) c = other;
        else { if (pageNo+1 >= numPages) break; newPage(); c = 0; }
      }
      const x = PT.marginX + c*(colW+colGap);
      placed.push({ t, idx: used.length, ctx, x, yTop: colY[c] });
      used.push(t);
      colY[c] += h + rowGap;
    }
    placed.forEach(pl => drawTask(pl.ctx, pl.t, pl.idx, pl.x, pl.yTop, colW, showNr, showSol));

    // Lösungsblock
    if (showSol && used.length) {
      const yAfter = Math.max(colY[0], colY[1]) + 4;
      const solStrings = used.map((t,i) => {
        let r = (i+1)+'. '+t.a+' '+OPSYM[t.op]+' '+t.b+' = '+t.res;
        if (t.op === 'div' && t.rest > 0) r += ' R'+t.rest;
        return r;
      });
      const solLineH=11, solRows=Math.ceil(solStrings.length/3);
      const needed=20+solRows*solLineH;
      let sctx, sy;
      if (bottom - yAfter >= needed) { sctx=ctx; sy=yAfter; }
      else { const sp=pdf.addPage([PT.pageW,PT.pageH]); sctx=makeCtx(sp,fonts); sy=PT.marginY+6; }
      sctx.line(PT.marginX,sy,PT.pageW-PT.marginX,sy,{color:C.blueLn,w:1});
      sy+=8; sctx.text('L\u00d6SUNGEN',PT.marginX,sy,{font:fonts.heavy,size:8,color:C.blue}); sy+=12;
      const solColW=PT.contentW/3;
      for (let i=0;i<solStrings.length;i++){ const r=Math.floor(i/3),cc=i%3; sctx.text(solStrings[i],PT.marginX+cc*solColW,sy+r*solLineH,{font:fonts.regular,size:7.5,color:C.sol}); }
    }

    return await pdf.save();
  }

  global.SchriftlichesRechnenPDF = { PT, GEO, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
