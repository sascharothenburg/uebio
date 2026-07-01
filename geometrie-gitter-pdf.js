/* =====================================================================
   geometrie-gitter-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Gitter & Körper: Spiegeln, Abzeichnen, Körper<->Netz (Multiple Choice).
   PDF mit absoluten Koordinaten -> identisch auf iOS/Android.

   Aufgabe:
     {area:'mirror', axis:'v'|'h', cells:[{x,y}], half, gridR}
     {area:'copy', cells:[{x,y}], grid}
     {area:'solid', dir:'s2n'|'n2s', solid:key, options:[keys]}
   spec: { tasks:[...], numPages, showSol, showNr }
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14*MM, marginY: 12*MM };
  PT.contentW = PT.pageW - PT.marginX*2;

  const C = {
    blue:    rgb01(0x03,0x69,0xa1),
    fill:    rgb01(0x0e,0xa5,0xe9),
    fillSol: rgb01(0x16,0xa3,0x4a),
    line:    rgb01(0x03,0x69,0xa1),
    grid:    rgb01(0xcb,0xd5,0xe1),
    axis:    rgb01(0xdc,0x26,0x26),
    ink:     rgb01(0x1e,0x1b,0x4b),
    sub:     rgb01(0x55,0x55,0x55),
    sol:     rgb01(0x77,0x77,0x77),
    metaLine:rgb01(0x88,0x88,0x88),
    boxBd:   rgb01(0x94,0xa3,0xb8),
    boxSol:  rgb01(0x16,0xa3,0x4a),
    blueLn:  rgb01(0xba,0xe6,0xfd),
    arrow:   rgb01(0x94,0xa3,0xb8),
    white:   rgb01(0xff,0xff,0xff),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const GEO = { cols: 1 };  // 1 Aufgabe pro Zeile (Figuren brauchen Platz)
  const SOLID_NAMES = { wuerfel:'W\u00fcrfel', quader:'Quader', zylinder:'Zylinder', kegel:'Kegel', pyramide:'Pyramide' };

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x,yTop,w,h,o){ o=o||{}; page.drawRectangle({x,y:PT.pageH-yTop-h,width:w,height:h,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0,opacity:o.opacity,borderOpacity:o.borderOpacity}); },
      line(x1,y1,x2,y2,o){ o=o||{}; page.drawLine({start:{x:x1,y:PT.pageH-y1},end:{x:x2,y:PT.pageH-y2},thickness:o.w||1,color:col(o.color)||col(C.ink),dashArray:o.dash}); },
      circle(cx,cyTop,r,o){ o=o||{}; page.drawCircle({x:cx,y:PT.pageH-cyTop,size:r,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0,opacity:o.opacity,borderOpacity:o.borderOpacity}); },
      ellipse(cx,cyTop,rx,ry,o){ o=o||{}; page.drawEllipse({x:cx,y:PT.pageH-cyTop,xScale:rx,yScale:ry,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0,opacity:o.opacity,borderOpacity:o.borderOpacity}); },
      poly(points,o){ o=o||{}; let d='M '+points.map(p=>p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' L ')+' Z'; page.drawSvgPath(d,{x:0,y:PT.pageH,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0,opacity:o.opacity,borderOpacity:o.borderOpacity}); },
      path(d,o){ o=o||{}; page.drawSvgPath(d,{x:o.x||0,y:o.y!=null?o.y:PT.pageH,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0,opacity:o.opacity}); },
      text(str,x,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; page.drawText(String(str),{x,y:PT.pageH-yTop-asc,size,font:f,color:col(o.color)||col(C.ink)}); },
      textCentered(str,cx,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const w=f.widthOfTextAtSize(String(str),size); this.text(str,cx-w/2,yTop,o); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts) {
    const F=ctx.fonts; const top=PT.marginY;
    ctx.text('Geometrie \u2013 Gitter & K\u00f6rper', PT.marginX, top, { font:F.heavy, size:13, color:C.blue });
    ctx.text('Spiegeln, Abzeichnen und K\u00f6rper mit ihren Netzen', PT.marginX, top+17, { font:F.regular, size:8, color:C.sub });
    const fields=[];
    if(opts.showName) fields.push(['Name:',90]);
    if(opts.showDate) fields.push(['Datum:',52]);
    if(opts.showKl) fields.push(['Klasse:',30]);
    const right=PT.pageW-PT.marginX; const gap=12, my=top+1;
    let totalW=0; fields.forEach(f=>{ totalW+=ctx.textWidth(f[0],F.regular,8)+3+f[1]+gap; }); totalW-=gap;
    let mx=right-totalW;
    fields.forEach(f=>{ const labW=ctx.textWidth(f[0],F.regular,8); ctx.text(f[0],mx,my,{font:F.regular,size:8,color:C.sub}); const lineX=mx+labW+3; ctx.line(lineX,my+10,lineX+f[1],my+10,{color:C.metaLine,w:1}); mx=lineX+f[1]+gap; });
    const lineY=top+28; ctx.line(PT.marginX,lineY,PT.pageW-PT.marginX,lineY,{color:C.blue,w:2.5});
    return lineY+12;
  }

  // ---- Gitter zeichnen ----
  function drawGrid(ctx, x, yTop, cols, rows, cell) {
    for (let i = 0; i <= cols; i++) ctx.line(x+i*cell, yTop, x+i*cell, yTop+rows*cell, { color:C.grid, w:0.8 });
    for (let j = 0; j <= rows; j++) ctx.line(x, yTop+j*cell, x+cols*cell, yTop+j*cell, { color:C.grid, w:0.8 });
  }
  function drawCells(ctx, cells, x, yTop, cell, fillCol) {
    cells.forEach(c => ctx.rect(x+c.x*cell, yTop+c.y*cell, cell, cell, { fill:fillCol, stroke:C.line, strokeWidth:1.2 }));
  }
  function mirrorCells(cells, axis, cols, rows) {
    return cells.map(c => axis==='v' ? {x:(2*cols-1-c.x),y:c.y} : {x:c.x,y:(2*rows-1-c.y)});
  }

  // ---- 3D-Körper (aus 100x100-Box, skaliert) ----
  function drawSolid(ctx, key, x, yTop, size, fillCol) {
    const s = size/100;
    const P = (pts) => pts.map(p => [x + p[0]*s, yTop + p[1]*s]);
    const st = { stroke:C.line, strokeWidth:1.6 };
    const f = Object.assign({ fill:fillCol, opacity:0.25 }, st);
    const ft = Object.assign({ fill:fillCol, opacity:0.4 }, st);
    if (key==='wuerfel') {
      ctx.poly(P([[25,35],[65,35],[65,75],[25,75]]), f);
      ctx.poly(P([[25,35],[40,20],[80,20],[65,35]]), ft);
      ctx.poly(P([[65,35],[80,20],[80,60],[65,75]]), ft);
    } else if (key==='quader') {
      ctx.poly(P([[20,40],[60,40],[60,78],[20,78]]), f);
      ctx.poly(P([[20,40],[36,24],[76,24],[60,40]]), ft);
      ctx.poly(P([[60,40],[76,24],[76,62],[60,78]]), ft);
    } else if (key==='zylinder') {
      ctx.ellipse(x+50*s, yTop+22*s, 26*s, 9*s, ft);
      // Mantel als Rechteck-Annäherung
      ctx.rect(x+24*s, yTop+22*s, 52*s, 56*s, { fill:fillCol, opacity:0.25, stroke:C.line, strokeWidth:1.6 });
      ctx.ellipse(x+50*s, yTop+78*s, 26*s, 9*s, { stroke:C.line, strokeWidth:1.6 });
    } else if (key==='kegel') {
      ctx.poly(P([[50,16],[24,78],[76,78]]), f);
      ctx.ellipse(x+50*s, yTop+78*s, 26*s, 9*s, { stroke:C.line, strokeWidth:1.6 });
    } else if (key==='pyramide') {
      // vierseitige Pyramide: Raute-Grundfläche + zwei sichtbare Vorderflächen
      ctx.poly(P([[50,88],[86,70],[50,56],[14,70]]), Object.assign({}, st, { fill:fillCol, opacity:0.15 }));
      ctx.poly(P([[50,16],[14,70],[50,88]]), f);
      ctx.poly(P([[50,16],[50,88],[86,70]]), ft);
    }
  }

  // ---- Netze (aus 100x100-Box) ----
  function drawNet(ctx, key, x, yTop, size, fillCol) {
    const s = size/100;
    const rc = (rx,ry,rw,rh) => ctx.rect(x+rx*s, yTop+ry*s, rw*s, rh*s, { fill:fillCol, opacity:0.25, stroke:C.line, strokeWidth:1.4 });
    const P = (pts) => pts.map(p => [x + p[0]*s, yTop + p[1]*s]);
    if (key==='wuerfel') {
      const u=17, ox=33, oy=16;
      [[ox,oy],[ox,oy+u],[ox,oy+2*u],[ox,oy+3*u],[ox-u,oy+u],[ox+u,oy+u]].forEach(p=>rc(p[0],p[1],u,u));
    } else if (key==='quader') {
      const w=18,h=12,ox=14,oy=32;
      rc(ox,oy,w,h); rc(ox+w,oy,w,h); rc(ox+2*w,oy,w,h); rc(ox+3*w,oy,w,h);
      rc(ox+w,oy-w,w,w); rc(ox+w,oy+h,w,w);
    } else if (key==='zylinder') {
      ctx.ellipse(x+28*s, yTop+26*s, 13*s, 6*s, { fill:fillCol, opacity:0.25, stroke:C.line, strokeWidth:1.4 });
      rc(34,34,44,32);
      ctx.ellipse(x+28*s, yTop+74*s, 13*s, 6*s, { fill:fillCol, opacity:0.25, stroke:C.line, strokeWidth:1.4 });
    } else if (key==='kegel') {
      // Mantel = Kreissektor (oben), als Polygon approximiert (lokale Koordinaten wie HTML-SVG)
      // HTML: M50,20 L30,58 A24,24 0 0 0 70,58 Z  -> Spitze (50,20), flacher Bogen (30,58)->(70,58)
      // Bogen mit Radius 24: Mittelpunkt liegt OBERHALB der Sehne, Bogen wölbt sich leicht nach unten.
      const apex=[50,20], aL=[30,58], aR=[70,58];
      const rArc=24, chordMid=[50,58];
      // Mittelpunkt oberhalb: Abstand vom Sehnenmittelpunkt = sqrt(r^2 - (chord/2)^2)
      const half=(aR[0]-aL[0])/2;                 // =20
      const off=Math.sqrt(Math.max(0,rArc*rArc-half*half)); // ~13.3
      const cyArc=58-off, cxArc=50;
      const a0=Math.atan2(aL[1]-cyArc, aL[0]-cxArc);
      const a1=Math.atan2(aR[1]-cyArc, aR[0]-cxArc);
      const pts=[apex];
      const STEPS=12;
      for(let k=0;k<=STEPS;k++){
        const a=a0+(a1-a0)*(k/STEPS);
        pts.push([cxArc+rArc*Math.cos(a), cyArc+rArc*Math.sin(a)]);
      }
      ctx.poly(P(pts), { fill:fillCol, opacity:0.25, stroke:C.line, strokeWidth:1.4 });
      ctx.circle(x+50*s, yTop+80*s, 13*s, { fill:fillCol, opacity:0.25, stroke:C.line, strokeWidth:1.4 });
    } else if (key==='pyramide') {
      const cx=50,cy=50,q=16;
      rc(cx-q/2,cy-q/2,q,q);
      ctx.poly(P([[cx-q/2,cy-q/2],[cx+q/2,cy-q/2],[cx,cy-q/2-18]]), { fill:fillCol, opacity:0.25, stroke:C.line, strokeWidth:1.4 });
      ctx.poly(P([[cx-q/2,cy+q/2],[cx+q/2,cy+q/2],[cx,cy+q/2+18]]), { fill:fillCol, opacity:0.25, stroke:C.line, strokeWidth:1.4 });
      ctx.poly(P([[cx-q/2,cy-q/2],[cx-q/2,cy+q/2],[cx-q/2-18,cy]]), { fill:fillCol, opacity:0.25, stroke:C.line, strokeWidth:1.4 });
      ctx.poly(P([[cx+q/2,cy-q/2],[cx+q/2,cy+q/2],[cx+q/2+18,cy]]), { fill:fillCol, opacity:0.25, stroke:C.line, strokeWidth:1.4 });
    }
  }

  function questionText(t) {
    if (t.area==='mirror') return 'Spiegle die Figur an der roten Achse.';
    if (t.area==='copy') return 'Zeichne die Figur in das rechte Gitter ab.';
    if (t.dir==='s2n') return 'Welches Netz geh\u00f6rt zu diesem K\u00f6rper? Kreuze an.';
    return 'Welcher K\u00f6rper geh\u00f6rt zu diesem Netz? Kreuze an.';
  }

  // Höhe schätzen
  function taskHeight(t, showNr) {
    let body;
    if (t.area==='mirror') {
      const cell = 22;
      const fullRows = t.axis==='v' ? t.gridR : t.gridR*2;
      body = fullRows*cell;
    } else if (t.area==='copy') {
      body = t.grid*22;
    } else {
      body = 70 + 70; // Körper + Optionsreihe
    }
    return (showNr?14:0) + 14 + body + 16;
  }

  function checkbox(ctx, x, yTop, sz, checked) {
    ctx.rect(x, yTop, sz, sz, { stroke: checked?C.boxSol:C.boxBd, strokeWidth:1.4, fill: checked?C.boxSol:C.white });
    if (checked) {
      ctx.line(x+sz*0.22, yTop+sz*0.55, x+sz*0.42, yTop+sz*0.75, { color:C.white, w:1.4 });
      ctx.line(x+sz*0.42, yTop+sz*0.75, x+sz*0.8, yTop+sz*0.28, { color:C.white, w:1.4 });
    }
  }

  function drawTask(ctx, t, idx, x, yTop, cellW, showNr, showSol) {
    const F = ctx.fonts;
    let y = yTop;
    const q = (showNr ? (idx+1)+'. ' : '') + questionText(t);
    ctx.text(q, x, y, { font:F.bold, size:9, color:C.ink });
    y += 16;

    if (t.area==='mirror') {
      const cell = 22;
      const cols = t.half, rows = t.gridR;
      const fullCols = t.axis==='v' ? cols*2 : cols;
      const fullRows = t.axis==='v' ? rows : rows*2;
      const gx = x + (cellW - fullCols*cell)/2;
      drawGrid(ctx, gx, y, fullCols, fullRows, cell);
      drawCells(ctx, t.cells, gx, y, cell, C.fill);
      // Achse
      if (t.axis==='v') { const ax=gx+cols*cell; ctx.line(ax, y, ax, y+fullRows*cell, { color:C.axis, w:2.5 }); }
      else { const ay=y+rows*cell; ctx.line(gx, ay, gx+fullCols*cell, ay, { color:C.axis, w:2.5 }); }
      if (showSol) drawCells(ctx, mirrorCells(t.cells, t.axis, cols, rows), gx, y, cell, C.fillSol);
    } else if (t.area==='copy') {
      const cell = 22, n = t.grid, gap = cell;
      const totalW = n*cell*2 + gap;
      const gx = x + (cellW - totalW)/2;
      drawGrid(ctx, gx, y, n, n, cell);
      drawCells(ctx, t.cells, gx, y, cell, C.fill);
      // Pfeil (Vektor)
      const axMid = gx + n*cell + gap/2;
      const axY = y + n*cell/2;
      ctx.line(axMid - 7, axY, axMid + 7, axY, { color:C.arrow, w:2 });
      ctx.line(axMid + 2, axY - 5, axMid + 7, axY, { color:C.arrow, w:2 });
      ctx.line(axMid + 2, axY + 5, axMid + 7, axY, { color:C.arrow, w:2 });
      const ox = gx + n*cell + gap;
      drawGrid(ctx, ox, y, n, n, cell);
      if (showSol) drawCells(ctx, t.cells, ox, y, cell, C.fillSol);
    } else {
      // solid: oben Körper/Netz, darunter 4 Optionen mit Kästchen
      const sz = 64;
      const isS2N = t.dir==='s2n';
      const cx = x + cellW/2;
      if (isS2N) drawSolid(ctx, t.solid, cx - sz/2, y, sz, C.fill);
      else drawNet(ctx, t.solid, cx - sz/2, y, sz, C.fill);
      let oy = y + sz + 10;
      const n = t.options.length;
      const slotW = cellW / n;
      const osz = 52;
      t.options.forEach((o, i) => {
        const sx = x + i*slotW + (slotW - osz)/2;
        const correct = showSol && o === t.solid;
        if (isS2N) drawNet(ctx, o, sx, oy, osz, correct?C.fillSol:C.fill);
        else drawSolid(ctx, o, sx, oy, osz, correct?C.fillSol:C.fill);
        checkbox(ctx, x + i*slotW + slotW/2 - 6, oy + osz + 2, 12, correct);
      });
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
    const tasks = (spec.tasks || []).filter(Boolean);
    const numPages = spec.numPages || 1;
    const showNr = spec.showNr !== false;
    const showSol = !!spec.showSol;
    const cellW = PT.contentW;
    const bottom = PT.pageH - PT.marginY;
    const rowGap = 14;

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
    let y = drawHeader(ctx, opts);
    function newPage(){ pageNo++; page=pdf.addPage([PT.pageW,PT.pageH]); ctx=makeCtx(page,fonts); y=PT.marginY+4; }

    const used = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const h = taskHeight(t, showNr);
      if (y + h > bottom) {
        if (pageNo+1 >= numPages) break;
        newPage();
      }
      placed.push({ t, idx: used.length, ctx, x: PT.marginX, yTop: y });
      used.push(t);
      y += h + rowGap;
    }
    placed.forEach(pl => drawTask(pl.ctx, pl.t, pl.idx, pl.x, pl.yTop, cellW, showNr, showSol));

    // Lösungsblock
    if (showSol && used.length) {
      const yAfter = y + 4;
      const solStrings = used.map((t,i) => {
        if (t.area==='mirror') return (i+1)+'. Spiegelbild';
        if (t.area==='copy') return (i+1)+'. Figur abzeichnen';
        return (i+1)+'. '+SOLID_NAMES[t.solid];
      });
      const solLineH=11, solRows=Math.ceil(solStrings.length/4);
      const needed=20+solRows*solLineH;
      let sctx, sy;
      if (bottom - yAfter >= needed) { sctx=ctx; sy=yAfter; }
      else { const sp=pdf.addPage([PT.pageW,PT.pageH]); sctx=makeCtx(sp,fonts); sy=PT.marginY+6; }
      sctx.line(PT.marginX,sy,PT.pageW-PT.marginX,sy,{color:C.blueLn,w:1});
      sy+=8; sctx.text('L\u00d6SUNGEN',PT.marginX,sy,{font:fonts.heavy,size:8,color:C.blue}); sy+=12;
      const solColW=PT.contentW/4;
      for (let i=0;i<solStrings.length;i++){ const r=Math.floor(i/4),cc=i%4; sctx.text(solStrings[i],PT.marginX+cc*solColW,sy+r*solLineH,{font:fonts.regular,size:7.5,color:C.sol}); }
    }

    return await pdf.save();
  }

  global.GeometrieGitterPDF = { PT, GEO, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
