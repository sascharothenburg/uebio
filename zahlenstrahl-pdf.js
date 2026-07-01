/* =====================================================================
   zahlenstrahl-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Zahlenstrahl als PDF mit absoluten Koordinaten -> identisch iOS/Android.
   Zwei Aufgabentypen:
     read – roter Pfeil gegeben, Zahl ins Kästchen schreiben
     mark – Zahl in der Frage gegeben, Pfeil einzeichnen (Lösung: grüner Pfeil)

   Aufgabe: { start,end,major,minor, type:'read'|'mark', value, diff }
   spec: { gen:function(i)->task, numPages, showSol, showNr }
   opts: { showName, showDate, showKl }
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14*MM, marginY: 12*MM };
  PT.contentW = PT.pageW - PT.marginX*2;

  const C = {
    blue:    rgb01(0x03,0x69,0xa1),
    axis:    rgb01(0x03,0x69,0xa1),
    ink:     rgb01(0x1e,0x1b,0x4b),
    read:    rgb01(0xdc,0x26,0x26),
    sol:     rgb01(0x16,0xa3,0x4a),
    sub:     rgb01(0x55,0x55,0x55),
    solGray: rgb01(0x77,0x77,0x77),
    metaLine:rgb01(0x88,0x88,0x88),
    gray:    rgb01(0x94,0xa3,0xb8),
    blueLn:  rgb01(0xba,0xe6,0xfd),
    white:   rgb01(0xff,0xff,0xff),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const GEO = { cols: 1, rowH: 80, axisInset: 16 };

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x,yTop,w,h,o){ o=o||{}; page.drawRectangle({x,y:PT.pageH-yTop-h,width:w,height:h,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0}); },
      line(x1,y1,x2,y2,o){ o=o||{}; page.drawLine({start:{x:x1,y:PT.pageH-y1},end:{x:x2,y:PT.pageH-y2},thickness:o.w||1,color:col(o.color)||col(C.ink),dashArray:o.dash}); },
      poly(points,o){ o=o||{}; let d='M '+points.map(p=>p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' L ')+' Z'; page.drawSvgPath(d,{x:0,y:PT.pageH,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0}); },
      text(str,x,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; page.drawText(String(str),{x,y:PT.pageH-yTop-asc,size,font:f,color:col(o.color)||col(C.ink)}); },
      textCentered(str,cx,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const w=f.widthOfTextAtSize(String(str),size); this.text(str,cx-w/2,yTop,o); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts, instr) {
    const F=ctx.fonts; const top=PT.marginY;
    ctx.text('Zahlenstrahl', PT.marginX, top, { font:F.heavy, size:14, color:C.blue });
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

  function questionText(t) {
    if (t.type==='read') return 'Welche Zahl zeigt der Pfeil?';
    return 'Zeichne einen Pfeil bei der ' + t.value + '.';
  }

  // Ein Zahlenstrahl (mit Frage darüber)
  function drawTask(ctx, t, idx, x, yTop, w, showNr, showSol) {
    const F = ctx.fonts;
    let y = yTop;
    // Frage
    const q = (showNr ? (idx+1)+'. ' : '') + questionText(t);
    ctx.text(q, x, y, { font:F.bold, size:9, color:C.ink });
    y += 16;

    // Strahl-Geometrie
    const padL = 20, padR = 24;
    const x0 = x + padL, x1 = x + w - padR;
    const axisY = y + 40;
    const span = t.end - t.start;
    const px = (v) => x0 + (v - t.start)/span*(x1 - x0);

    // Achse + Pfeilspitze
    ctx.line(x0, axisY, x1 + 8, axisY, { color:C.axis, w:1.8 });
    ctx.poly([[x1+8, axisY-4],[x1+16, axisY],[x1+8, axisY+4]], { fill:C.axis });

    // Striche
    const majorCount = Math.round((t.end - t.start)/t.major);
    let v = t.start;
    let guard = 0;
    while (v <= t.end + 0.0001 && guard < 2000) {
      guard++;
      const X = px(v);
      const isMajor = (v % t.major === 0);
      if (isMajor) {
        ctx.line(X, axisY-8, X, axisY+8, { color:C.axis, w:1.8 });
        const majIndex = Math.round((v - t.start)/t.major);
        let label = true;
        if (t.diff === 'hard') {
          const isEnds = (v===t.start) || (v===t.end);
          label = isEnds || (majIndex%2===0);
          if (majorCount <= 2) label = true;
        }
        if (label) ctx.textCentered(String(v), X, axisY+12, { font:F.bold, size:9, color:C.ink });
      } else {
        ctx.line(X, axisY-5, X, axisY+5, { color:C.axis, w:1.1 });
      }
      v += t.minor;
    }

    // Markierung
    const mx = px(t.value);
    if (t.type === 'read') {
      // roter Pfeil von oben, Kästchen zwischen Frage und Achse
      const boxTop = y + 8;        // unter der Frage
      ctx.poly([[mx, axisY-2],[mx-5, axisY-13],[mx+5, axisY-13]], { fill:C.read });
      ctx.line(mx, axisY-13, mx, boxTop+16, { color:C.read, w:1.8 });
      if (showSol) {
        ctx.textCentered(String(t.value), mx, boxTop+1, { font:F.heavy, size:11, color:C.read });
      } else {
        ctx.rect(mx-13, boxTop, 26, 16, { fill:C.white, stroke:C.read, strokeWidth:1.4 });
      }
    } else {
      // mark: nur in Lösung grüner Pfeil
      if (showSol) {
        const boxTop = y + 8;
        ctx.poly([[mx, axisY-2],[mx-5, axisY-13],[mx+5, axisY-13]], { fill:C.sol });
        ctx.line(mx, axisY-13, mx, boxTop+16, { color:C.sol, w:1.8 });
        ctx.textCentered(String(t.value), mx, boxTop+1, { font:F.heavy, size:11, color:C.sol });
      }
    }
  }

  function capacityForPages(numPages){ return numPages <= 1 ? 8 : 18; }

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
    const showNr = spec.showNr !== false;
    const showSol = !!spec.showSol;
    const gen = (typeof spec.gen === 'function') ? spec.gen : null;
    const rowH = GEO.rowH;
    const bottom = PT.pageH - PT.marginY;
    const w = PT.contentW;

    let tasks;
    if (gen) {
      const total = capacityForPages(numPages);
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

    const hasRead = tasks.some(t => t.type==='read');
    const hasMark = tasks.some(t => t.type==='mark');
    const instr = (hasRead && hasMark) ? 'Lies ab, welche Zahl der Pfeil zeigt, bzw. zeichne den Pfeil bei der angegebenen Zahl.'
      : (hasRead ? 'Welche Zahl zeigt jeweils der Pfeil? Schreibe sie in das K\u00e4stchen.'
                 : 'Zeichne jeweils einen Pfeil an der angegebenen Stelle auf dem Zahlenstrahl.');

    function rowsPerPage(topY){ return Math.max(1, Math.floor((bottom - topY)/rowH)); }
    const capP1 = rowsPerPage(PT.marginY + 30 + 12);

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
        drawTask(ctx, slice[i], startIdx+i, PT.marginX, y + i*rowH, w, showNr, showSol);
      }
      lastCtx = ctx;
      lastBottomY = y + slice.length*rowH;
    }

    // Lösungsblock
    if (showSol && tasks.length) {
      const solStrings = tasks.map((t,i)=> (i+1)+'. '+t.value);
      const solLineH=11, solRows=Math.ceil(solStrings.length/6);
      const needed=20+solRows*solLineH;
      let sctx, sy;
      if (bottom - lastBottomY >= needed) { sctx=lastCtx; sy=lastBottomY+4; }
      else { const sp=pdf.addPage([PT.pageW,PT.pageH]); sctx=makeCtx(sp,fonts); sy=PT.marginY+6; }
      sctx.line(PT.marginX,sy,PT.pageW-PT.marginX,sy,{color:C.blueLn,w:1});
      sy+=8; sctx.text('L\u00d6SUNGEN',PT.marginX,sy,{font:fonts.heavy,size:8,color:C.blue}); sy+=12;
      const solColW=PT.contentW/6;
      for (let i=0;i<solStrings.length;i++){ const r=Math.floor(i/6),cc=i%6; sctx.text(solStrings[i],PT.marginX+cc*solColW,sy+r*solLineH,{font:fonts.regular,size:7.5,color:C.solGray}); }
    }

    return await pdf.save();
  }

  global.ZahlenstrahlPDF = { PT, GEO, capacityForPages, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
