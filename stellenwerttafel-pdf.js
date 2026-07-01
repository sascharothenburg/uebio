/* =====================================================================
   stellenwerttafel-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Stellenwerttafel als PDF mit absoluten Koordinaten -> identisch iOS/Android.
   Zwei Aufgabentypen:
     num2tab – Zahl gegeben, Tafel leer ausfüllen
     tab2num – Tafel gefüllt, Zahl ablesen (Linie)

   Aufgabe: { num, places, type:'num2tab'|'tab2num' }
   spec: { gen:function(i)->task, numPages, showSol, showNr, places }
   opts: { showName, showDate, showKl }
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14*MM, marginY: 12*MM };
  PT.contentW = PT.pageW - PT.marginX*2;

  const C = {
    blue:    rgb01(0x03,0x69,0xa1),
    cellBd:  rgb01(0x03,0x69,0xa1),
    label:   rgb01(0x03,0x69,0xa1),
    ink:     rgb01(0x1e,0x1b,0x4b),
    sol:     rgb01(0xa1,0x62,0x07),
    solBg:   rgb01(0xff,0xfb,0xeb),
    sub:     rgb01(0x55,0x55,0x55),
    solGray: rgb01(0x77,0x77,0x77),
    metaLine:rgb01(0x88,0x88,0x88),
    numLine: rgb01(0x88,0x88,0x88),
    blueLn:  rgb01(0xba,0xe6,0xfd),
    white:   rgb01(0xff,0xff,0xff),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const PLACE_LABELS = {1:'E',2:'Z',3:'H',4:'T',5:'ZT',6:'HT'};

  // Spalten je Stellenzahl + Aufgabenzahl je Seite (aus Notizen)
  const GEO = {
    colsByPlaces: {2:4, 3:4, 4:3, 5:2, 6:2},
    autoCount:    {2:20, 3:20, 4:15, 5:10, 6:10},
    cellW: 34,        // Kästchenbreite
    cellH: 28,        // Kästchenhöhe
    labelH: 12,
    numH: 18,
    rowGap: 16,
  };

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

  function drawHeader(ctx, opts, instr) {
    const F=ctx.fonts; const top=PT.marginY;
    ctx.text('Stellenwerttafel', PT.marginX, top, { font:F.heavy, size:14, color:C.blue });
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

  function digitsArray(num, places) {
    const s = String(num).padStart(places, '0');
    return s.split('').map(Number);
  }

  function taskCellHeight() {
    return GEO.numH + GEO.labelH + GEO.cellH + GEO.rowGap;
  }

  function drawTaskTable(ctx, t, idx, cx, yTop, showNr, showSol) {
    const F = ctx.fonts;
    const places = t.places;
    const tableW = places * GEO.cellW;
    const x0 = cx - tableW/2;
    let y = yTop;

    if (showNr) {
      ctx.text((idx+1)+'.', x0, y, { font:F.bold, size:9, color:rgb01(0x94,0xa3,0xb8) });
    }
    // Zahl-Zeile
    const filled = (t.type === 'num2tab') ? showSol : true;
    const showNum = (t.type === 'num2tab') ? true : showSol;
    if (showNum) {
      ctx.textCentered(t.num.toLocaleString('de-DE'), cx, y, { font:F.heavy, size:13, color:C.ink });
    } else {
      // Linie zum Eintragen
      const lw = tableW*0.7;
      ctx.line(cx - lw/2, y + 13, cx + lw/2, y + 13, { color:C.numLine, w:1.2 });
    }
    y += GEO.numH;
    // Labels
    const labels = [];
    for (let p = places; p >= 1; p--) labels.push(PLACE_LABELS[p]);
    labels.forEach((l, i) => {
      ctx.textCentered(l, x0 + i*GEO.cellW + GEO.cellW/2, y, { font:F.bold, size:8, color:C.label });
    });
    y += GEO.labelH;
    // Zellen
    const dig = digitsArray(t.num, places);
    for (let i = 0; i < places; i++) {
      const cellX = x0 + i*GEO.cellW;
      const solCell = filled && showSol && t.type==='num2tab';
      ctx.rect(cellX, y, GEO.cellW, GEO.cellH, { fill: solCell ? C.solBg : C.white, stroke:C.cellBd, strokeWidth:1.1 });
      if (filled) {
        const valCol = solCell ? C.sol : C.ink;
        ctx.textCentered(String(dig[i]), cellX + GEO.cellW/2, y + (GEO.cellH-13)/2, { font:F.bold, size:13, color:valCol });
      }
    }
  }

  // Kapazität (Aufgaben pro Seite) aus autoCount / Layout
  function colsFor(places){ return GEO.colsByPlaces[places] || 4; }
  function capacityForPages(numPages, places) {
    const auto = GEO.autoCount[places] || 20;
    return numPages <= 1 ? auto : Math.round(auto * 2.2);
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
    const places = spec.places || 3;
    const showNr = spec.showNr !== false;
    const showSol = !!spec.showSol;
    const gen = (typeof spec.gen === 'function') ? spec.gen : null;
    const cols = colsFor(places);
    const colW = PT.contentW / cols;
    const cellH = taskCellHeight();
    const bottom = PT.pageH - PT.marginY;

    // Aufgaben besorgen
    let tasks;
    if (gen) {
      const total = capacityForPages(numPages, places);
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

    const hasNum2tab = tasks.some(t => t.type==='num2tab');
    const hasTab2num = tasks.some(t => t.type==='tab2num');
    const instr = (hasNum2tab && hasTab2num)
      ? 'Trage die Zahlen in die Tafel ein bzw. lies die Zahl aus der Tafel ab.'
      : (tasks[0].type==='num2tab' ? 'Trage jede Zahl richtig in die Stellenwerttafel ein.'
                                   : 'Lies die Zahl aus der Stellenwerttafel ab und schreibe sie auf.');

    // Kapazität pro Seite (Zeilen)
    function rowsPerPage(topY){ return Math.max(1, Math.floor((bottom - topY) / cellH)); }
    const topWithHeader = PT.marginY + 30 + 12;
    const topNoHeader = PT.marginY + 4;
    const capP1 = rowsPerPage(topWithHeader) * cols;

    const pageSlices = [];
    if (numPages <= 1) pageSlices.push(tasks);
    else { pageSlices.push(tasks.slice(0, capP1)); pageSlices.push(tasks.slice(capP1)); }

    let lastCtx, lastBottomY = 0;
    for (let pg = 0; pg < pageSlices.length; pg++) {
      const slice = pageSlices[pg];
      if (!slice.length) continue;
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      let y = (pg === 0) ? drawHeader(ctx, opts, instr) : topNoHeader;
      const startIdx = (pg === 0) ? 0 : pageSlices[0].length;
      for (let i = 0; i < slice.length; i++) {
        const r = Math.floor(i/cols), c = i%cols;
        const cx = PT.marginX + c*colW + colW/2;
        const yTop = y + r*cellH;
        drawTaskTable(ctx, slice[i], startIdx+i, cx, yTop, showNr, showSol);
      }
      lastCtx = ctx;
      lastBottomY = y + Math.ceil(slice.length/cols)*cellH;
    }

    // Lösungsblock
    if (showSol && tasks.length) {
      const solStrings = tasks.map((t,i)=> (i+1)+'. '+t.num.toLocaleString('de-DE'));
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

  global.StellenwerttafelPDF = { PT, GEO, capacityForPages, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
