/* =====================================================================
   uhr-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Uhr lernen als PDF mit absoluten Koordinaten -> identisch iOS/Android.
   Zwei Aufgabentypen:
     lesen  – Uhr mit Zeigern gezeigt, Uhrzeit auf Linie schreiben
     zeiger – Uhrzeit gegeben, Zeiger in leere Uhr einzeichnen

   Aufgabe: { h, m, type:'lesen'|'zeiger', label }  (label = formatierte Zeit)
   spec: { gen:function(i)->task, numPages, showSol, showNr, type }
   opts: { showName, showDate, showKl }
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14*MM, marginY: 12*MM };
  PT.contentW = PT.pageW - PT.marginX*2;

  const C = {
    blue:    rgb01(0x03,0x69,0xa1),
    face:    rgb01(0xff,0xfb,0xeb),
    faceEmpty:rgb01(0xf9,0xfa,0xfb),
    rim:     rgb01(0x03,0x69,0xa1),
    tick:    rgb01(0x33,0x33,0x33),
    hourHand:rgb01(0x1e,0x1b,0x4b),
    minHand: rgb01(0x03,0x69,0xa1),
    ink:     rgb01(0x1e,0x1b,0x4b),
    sub:     rgb01(0x55,0x55,0x55),
    sol:     rgb01(0x16,0xa3,0x4a),
    solGray: rgb01(0x77,0x77,0x77),
    metaLine:rgb01(0x88,0x88,0x88),
    answerLn:rgb01(0x03,0x69,0xa1),
    blueLn:  rgb01(0xba,0xe6,0xfd),
    white:   rgb01(0xff,0xff,0xff),
    cellBd:  rgb01(0xe5,0xe7,0xeb),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const GEO = { cols: 3, clockSize: 78, cellH: 130 };

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x,yTop,w,h,o){ o=o||{}; page.drawRectangle({x,y:PT.pageH-yTop-h,width:w,height:h,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0}); },
      line(x1,y1,x2,y2,o){ o=o||{}; const lc=o.cap==='round'?global.PDFLib.LineCapStyle.Round:undefined; page.drawLine({start:{x:x1,y:PT.pageH-y1},end:{x:x2,y:PT.pageH-y2},thickness:o.w||1,color:col(o.color)||col(C.ink),dashArray:o.dash,lineCap:lc}); },
      circle(cx,cyTop,r,o){ o=o||{}; page.drawCircle({x:cx,y:PT.pageH-cyTop,size:r,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0}); },
      text(str,x,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; page.drawText(String(str),{x,y:PT.pageH-yTop-asc,size,font:f,color:col(o.color)||col(C.ink)}); },
      textCentered(str,cx,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const w=f.widthOfTextAtSize(String(str),size); this.text(str,cx-w/2,yTop,o); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts, instr) {
    const F=ctx.fonts; const top=PT.marginY;
    ctx.text('Uhr lernen', PT.marginX, top, { font:F.heavy, size:14, color:C.blue });
    ctx.text(instr, PT.marginX, top+18, { font:F.regular, size:8, color:C.sub });
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

  function rad(a){ return a*Math.PI/180; }

  // Ziffernblatt (cx,cyTop = Mittelpunkt). withHands: Zeiger zeichnen?
  function drawClock(ctx, cx, cyTop, sz, h, m, withHands, handCol) {
    const r = sz/2 - 2;
    ctx.circle(cx, cyTop, r, { fill: withHands ? C.face : C.faceEmpty, stroke:C.rim, strokeWidth:2.5 });
    // Striche
    for (let i = 0; i < 60; i++) {
      const a = i/60*360 - 90, ra = rad(a), isH = i%5===0;
      const r1 = r*(isH?0.85:0.91), r2 = r*0.98;
      ctx.line(cx+r1*Math.cos(ra), cyTop+r1*Math.sin(ra), cx+r2*Math.cos(ra), cyTop+r2*Math.sin(ra),
               { color:C.tick, w:isH?1.6:0.8 });
    }
    // Zahlen 1-12
    const F = ctx.fonts;
    const nums = [12,1,2,3,4,5,6,7,8,9,10,11];
    nums.forEach((v,i) => {
      const a = i/12*360 - 90, ra = rad(a), rn = r*0.70;
      const nx = cx + rn*Math.cos(ra);
      const ny = cyTop + rn*Math.sin(ra);
      const fs = r*0.28;
      ctx.textCentered(String(v), nx, ny - fs/2, { font:F.bold, size:fs, color:C.ink });
    });
    if (withHands) {
      const mA = (m/60)*360 - 90;
      const hA = ((h%12)/12)*360 + (m/60)*30 - 90;
      const mX = cx + (r*0.82)*Math.cos(rad(mA)), mY = cyTop + (r*0.82)*Math.sin(rad(mA));
      const hX = cx + (r*0.55)*Math.cos(rad(hA)), hY = cyTop + (r*0.55)*Math.sin(rad(hA));
      ctx.line(cx, cyTop, hX, hY, { color:C.hourHand, w:r*0.08, cap:'round' });
      ctx.line(cx, cyTop, mX, mY, { color:C.minHand, w:r*0.05, cap:'round' });
    }
    ctx.circle(cx, cyTop, r*0.06, { fill:C.minHand });
  }

  function drawTaskCell(ctx, t, idx, x, yTop, cellW, showNr, showSol) {
    const F = ctx.fonts;
    const cx = x + cellW/2;
    const sz = GEO.clockSize;
    let y = yTop;
    // Rahmen
    ctx.rect(x+4, yTop, cellW-8, GEO.cellH-8, { stroke:C.cellBd, strokeWidth:1 });
    if (showNr) {
      ctx.textCentered((idx+1)+'.', cx, y+6, { font:F.bold, size:8, color:C.blue });
    }
    const clockCy = y + 14 + sz/2;
    if (t.type === 'lesen') {
      drawClock(ctx, cx, clockCy, sz, t.h, t.m, true);
      // Antwortlinie (oder Lösung)
      const ly = clockCy + sz/2 + 12;
      if (showSol) {
        ctx.textCentered(t.label, cx, ly-4, { font:F.heavy, size:10, color:C.sol });
      } else {
        ctx.line(cx-28, ly, cx+28, ly, { color:C.answerLn, w:1.4 });
      }
    } else {
      // zeiger: leere Uhr (Lösung: mit Zeigern), Zeit darunter
      drawClock(ctx, cx, clockCy, sz, t.h, t.m, showSol);
      const ly = clockCy + sz/2 + 12;
      ctx.textCentered(t.label, cx, ly-6, { font:F.heavy, size:11, color:C.ink });
    }
  }

  function capacityForPages(numPages, type){
    const per = (type === 'zeiger') ? 15 : 18;
    return numPages <= 1 ? per : Math.round(per*2);
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
    const numPages = spec.numPages || 1;
    const type = spec.type || 'lesen';
    const showNr = spec.showNr !== false;
    const showSol = !!spec.showSol;
    const gen = (typeof spec.gen === 'function') ? spec.gen : null;
    const cols = GEO.cols;
    const colW = PT.contentW / cols;
    const cellH = GEO.cellH;
    const bottom = PT.pageH - PT.marginY;

    let tasks;
    if (gen) {
      const total = capacityForPages(numPages, type);
      tasks = [];
      for (let i = 0; i < total; i++) { const t = gen(i); if (t) tasks.push(t); }
    } else {
      tasks = (spec.tasks || []).filter(Boolean);
    }

    if (!tasks.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Aufgaben generiert.', PT.marginX, PT.marginY+20, { font:fonts.bold, size:11, color:C.sub });
      return await pdf.save();
    }

    const instr = (type === 'zeiger') ? 'Zeichne die Zeiger passend zur angegebenen Uhrzeit ein.'
                                      : 'Wie viel Uhr ist es? Schreibe die Uhrzeit auf.';

    function rowsPerPage(topY){ return Math.max(1, Math.floor((bottom - topY)/cellH)); }
    const capP1 = rowsPerPage(PT.marginY + 30 + 12) * cols;

    const pageSlices = [];
    if (numPages <= 1) pageSlices.push(tasks);
    else { pageSlices.push(tasks.slice(0, capP1)); pageSlices.push(tasks.slice(capP1)); }

    let lastCtx, lastBottomY = 0;
    for (let pg = 0; pg < pageSlices.length; pg++) {
      const slice = pageSlices[pg];
      if (!slice.length) continue;
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      let y = (pg === 0) ? drawHeader(ctx, opts, instr) : (PT.marginY + 4);
      const startIdx = (pg === 0) ? 0 : pageSlices[0].length;
      for (let i = 0; i < slice.length; i++) {
        const r = Math.floor(i/cols), c = i%cols;
        const x = PT.marginX + c*colW;
        drawTaskCell(ctx, slice[i], startIdx+i, x, y + r*cellH, colW, showNr, showSol);
      }
      lastCtx = ctx;
      lastBottomY = y + Math.ceil(slice.length/cols)*cellH;
    }

    // Lösungsblock
    if (showSol && tasks.length) {
      const solStrings = tasks.map((t,i)=> (i+1)+'. '+t.label);
      const solLineH=11, solRows=Math.ceil(solStrings.length/5);
      const needed=20+solRows*solLineH;
      let sctx, sy;
      if (bottom - lastBottomY >= needed) { sctx=lastCtx; sy=lastBottomY+4; }
      else { const sp=pdf.addPage([PT.pageW,PT.pageH]); sctx=makeCtx(sp,fonts); sy=PT.marginY+6; }
      sctx.line(PT.marginX,sy,PT.pageW-PT.marginX,sy,{color:C.blueLn,w:1});
      sy+=8; sctx.text('L\u00d6SUNGEN',PT.marginX,sy,{font:fonts.heavy,size:8,color:C.blue}); sy+=12;
      const solColW=PT.contentW/5;
      for (let i=0;i<solStrings.length;i++){ const r=Math.floor(i/5),cc=i%5; sctx.text(solStrings[i],PT.marginX+cc*solColW,sy+r*solLineH,{font:fonts.regular,size:7.5,color:C.solGray}); }
    }

    return await pdf.save();
  }

  global.UhrPDF = { PT, GEO, capacityForPages, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
