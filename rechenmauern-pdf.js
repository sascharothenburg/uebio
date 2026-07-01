/* =====================================================================
   rechenmauern-pdf.js  ·  PDF-Modul für die Rechenmauern-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Zahlenmauern als PDF mit absoluten Koordinaten -> identisch auf iOS/Android.
   Eine Mauer: rows[0]=unterste (breiteste) Reihe ... rows[top]=Deckstein.
   gaps["r_c"]=true markiert leere Steine (zum Ausrechnen).

   spec: { walls:[{rows,gaps,type}], numPages, showSol, showNr }
   opts: { showName, showDate, showKl }
   Abhängig (global): window.PDFLib
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14*MM, marginY: 12*MM };
  PT.contentW = PT.pageW - PT.marginX*2;

  const C = {
    blue:    rgb01(0x03,0x69,0xa1),
    brick:   rgb01(0xe0,0xf2,0xfe),
    brickBd: rgb01(0x0e,0xa5,0xe9),
    gapBd:   rgb01(0xdc,0x26,0x26),
    gapSol:  rgb01(0x16,0xa3,0x4a),
    gapSolBg:rgb01(0xdc,0xfc,0xe7),
    ink:     rgb01(0x1e,0x1b,0x4b),
    sub:     rgb01(0x55,0x55,0x55),
    sol:     rgb01(0x77,0x77,0x77),
    metaLine:rgb01(0x88,0x88,0x88),
    blueLn:  rgb01(0xba,0xe6,0xfd),
    white:   rgb01(0xff,0xff,0xff),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const GEO = { cols: 2, brickW: 40, brickH: 26, brickGap: 3 };

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) {
        o = o || {};
        page.drawRectangle({ x, y: PT.pageH-yTop-h, width:w, height:h,
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
    ctx.text('Rechenmauern', PT.marginX, top, { font:F.heavy, size:14, color:C.blue });
    ctx.text('Rechne die fehlenden Steine aus', PT.marginX, top+18, { font:F.regular, size:8, color:C.sub });
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

  // Höhe einer Mauer (Anzahl Reihen)
  function wallHeight(w, showNr) {
    const rows = w.rows.length;
    return (showNr ? 14 : 0) + rows * (GEO.brickH + GEO.brickGap) + 8;
  }
  // Breite der untersten Reihe
  function wallWidth(w) {
    const n = w.rows[0].length;
    return n * GEO.brickW + (n-1) * GEO.brickGap;
  }

  function drawWall(ctx, w, idx, cellX, yTop, cellW, showNr, showSol) {
    const F = ctx.fonts;
    let y = yTop;
    if (showNr) {
      ctx.text((idx+1)+'.', cellX, y, { font:F.bold, size:9, color:C.blue });
      y += 14;
    }
    const totalRows = w.rows.length;
    // von unten (breit) nach oben (schmal) zeichnen; rows[0] unten
    // Wir zeichnen Reihe r an vertikaler Position: unterste Reihe ganz unten
    for (let r = 0; r < totalRows; r++) {
      const rowArr = w.rows[r];
      const n = rowArr.length;
      const rowW = n*GEO.brickW + (n-1)*GEO.brickGap;
      const rowX = cellX + (cellW - rowW)/2;
      // vertikale Position: oberste Reihe (Deckstein, r=totalRows-1) zuerst oben
      const visualRow = (totalRows-1) - r; // 0 = oben
      const by = y + visualRow * (GEO.brickH + GEO.brickGap);
      for (let c = 0; c < n; c++) {
        const bx = rowX + c*(GEO.brickW + GEO.brickGap);
        const isGap = w.gaps[r+'_'+c];
        const showVal = !isGap || showSol;
        const fillCol = (isGap && showSol) ? C.gapSolBg : C.brick;
        const strokeCol = isGap ? (showSol ? C.gapSol : C.gapBd) : C.brickBd;
        ctx.rect(bx, by, GEO.brickW, GEO.brickH, { fill: fillCol, stroke: strokeCol, strokeWidth: isGap?1.6:1.2 });
        if (showVal) {
          const valCol = (isGap && showSol) ? C.gapSol : C.ink;
          ctx.textCentered(String(rowArr[c]), bx + GEO.brickW/2, by + (GEO.brickH-12)/2, { font:F.bold, size:12, color: valCol });
        }
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
    const walls = (spec.walls || []).filter(Boolean);
    const numPages = spec.numPages || 1;
    const showNr = spec.showNr !== false;
    const showSol = !!spec.showSol;
    const cols = GEO.cols;
    const colGap = 8*MM;
    const colW = (PT.contentW - colGap)/cols;
    const bottom = PT.pageH - PT.marginY;
    const rowGap = 8;

    if (!walls.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Mauern generiert.', PT.marginX, PT.marginY+20, { font:fonts.bold, size:11, color:C.sub });
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
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const h = wallHeight(w, showNr);
      let c = (colY[0] <= colY[1]) ? 0 : 1;
      if (colY[c] + h > bottom) {
        const other = 1-c;
        if (colY[other] + h <= bottom) c = other;
        else { if (pageNo+1 >= numPages) break; newPage(); c = 0; }
      }
      const x = PT.marginX + c*(colW+colGap);
      placed.push({ w, idx: used.length, ctx, x, yTop: colY[c] });
      used.push(w);
      colY[c] += h + rowGap;
    }
    placed.forEach(pl => drawWall(pl.ctx, pl.w, pl.idx, pl.x, pl.yTop, colW, showNr, showSol));

    // Lösungsblock (nur Decksteine/Lücken-Werte sind im Bild gezeigt; hier kompakt die Decksteine)
    if (showSol && used.length) {
      const yAfter = Math.max(colY[0], colY[1]) + 4;
      const solStrings = used.map((w,i) => {
        const top = w.rows[w.rows.length-1][0];
        return (i+1)+'. Deckstein '+top;
      });
      const solLineH=11, solRows=Math.ceil(solStrings.length/4);
      const needed=20+solRows*solLineH;
      let sctx, sy;
      if (bottom - yAfter >= needed) { sctx=ctx; sy=yAfter; }
      else { const sp=pdf.addPage([PT.pageW,PT.pageH]); sctx=makeCtx(sp,fonts); sy=PT.marginY+6; }
      sctx.line(PT.marginX,sy,PT.pageW-PT.marginX,sy,{color:C.blueLn,w:1});
      sy+=8; sctx.text('L\u00d6SUNGEN (im Bild gr\u00fcn dargestellt)',PT.marginX,sy,{font:fonts.heavy,size:8,color:C.blue}); sy+=12;
      const solColW=PT.contentW/4;
      for (let i=0;i<solStrings.length;i++){ const r=Math.floor(i/4),cc=i%4; sctx.text(solStrings[i],PT.marginX+cc*solColW,sy+r*solLineH,{font:fonts.regular,size:7.5,color:C.sol}); }
    }

    return await pdf.save();
  }

  global.RechenmauernPDF = { PT, GEO, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
