/* =====================================================================
   geometrie-wuerfel-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Würfelnetze & Körper: ergibt-Netz-Würfel (Ja/Nein), Netz-auswählen (pick),
   Körper<->Name (Multiple Choice). PDF mit absoluten Koordinaten.

   Aufgabe:
     {area:'net', sub:'yesno', net:[[x,y]...], valid:bool}
     {area:'net', sub:'pick', options:[{net,valid}]}
     {area:'solid', sub:'s2n', solid:key, options:[keys]}   (Körper -> Name)
     {area:'solid', sub:'n2s', solid:key, options:[keys]}   (Name -> Körper)
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
    ink:     rgb01(0x1e,0x1b,0x4b),
    sub:     rgb01(0x55,0x55,0x55),
    sol:     rgb01(0x77,0x77,0x77),
    metaLine:rgb01(0x88,0x88,0x88),
    boxBd:   rgb01(0x94,0xa3,0xb8),
    boxSol:  rgb01(0x16,0xa3,0x4a),
    blueLn:  rgb01(0xba,0xe6,0xfd),
    white:   rgb01(0xff,0xff,0xff),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const GEO = { cols: 2 };
  const SOLID_NAMES = { wuerfel:'W\u00fcrfel', quader:'Quader', kugel:'Kugel', zylinder:'Zylinder', kegel:'Kegel', pyramide:'Pyramide' };

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x,yTop,w,h,o){ o=o||{}; page.drawRectangle({x,y:PT.pageH-yTop-h,width:w,height:h,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0,opacity:o.opacity,borderOpacity:o.borderOpacity}); },
      line(x1,y1,x2,y2,o){ o=o||{}; page.drawLine({start:{x:x1,y:PT.pageH-y1},end:{x:x2,y:PT.pageH-y2},thickness:o.w||1,color:col(o.color)||col(C.ink),dashArray:o.dash}); },
      circle(cx,cyTop,r,o){ o=o||{}; page.drawCircle({x:cx,y:PT.pageH-cyTop,size:r,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0,opacity:o.opacity,borderOpacity:o.borderOpacity}); },
      ellipse(cx,cyTop,rx,ry,o){ o=o||{}; page.drawEllipse({x:cx,y:PT.pageH-cyTop,xScale:rx,yScale:ry,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0,opacity:o.opacity,borderOpacity:o.borderOpacity}); },
      poly(points,o){ o=o||{}; let d='M '+points.map(p=>p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' L ')+' Z'; page.drawSvgPath(d,{x:0,y:PT.pageH,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0,opacity:o.opacity,borderOpacity:o.borderOpacity}); },
      text(str,x,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; page.drawText(String(str),{x,y:PT.pageH-yTop-asc,size,font:f,color:col(o.color)||col(C.ink)}); },
      textCentered(str,cx,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const w=f.widthOfTextAtSize(String(str),size); this.text(str,cx-w/2,yTop,o); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts) {
    const F=ctx.fonts; const top=PT.marginY;
    ctx.text('Geometrie \u2013 W\u00fcrfelnetze & K\u00f6rper', PT.marginX, top, { font:F.heavy, size:13, color:C.blue });
    ctx.text('Erkenne W\u00fcrfelnetze und benenne die K\u00f6rper', PT.marginX, top+17, { font:F.regular, size:8, color:C.sub });
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

  // Hexomino (Würfelnetz) zeichnen, zentriert in Breite boxW ab (x,yTop)
  function netBounds(cells) {
    const xs = cells.map(c=>c[0]), ys = cells.map(c=>c[1]);
    return { minx:Math.min(...xs), miny:Math.min(...ys), maxx:Math.max(...xs), maxy:Math.max(...ys) };
  }
  function drawNet(ctx, cells, x, yTop, cell, fillCol) {
    const b = netBounds(cells);
    cells.forEach(c => {
      const cx = x + (c[0]-b.minx)*cell;
      const cy = yTop + (c[1]-b.miny)*cell;
      ctx.rect(cx, cy, cell, cell, { fill:fillCol, opacity:0.3, stroke:C.line, strokeWidth:1.8 });
    });
  }
  function netSize(cells, cell) {
    const b = netBounds(cells);
    return { w:(b.maxx-b.minx+1)*cell, h:(b.maxy-b.miny+1)*cell };
  }

  // 3D-Körper
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
    } else if (key==='kugel') {
      ctx.circle(x+50*s, yTop+50*s, 32*s, f);
      ctx.ellipse(x+50*s, yTop+50*s, 32*s, 11*s, { stroke:C.line, strokeWidth:1.1, dash:[3,2] });
    } else if (key==='zylinder') {
      ctx.ellipse(x+50*s, yTop+22*s, 26*s, 9*s, ft);
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

  function questionText(t) {
    if (t.area==='net') {
      if (t.sub==='yesno') return 'Ergibt dieses Netz einen W\u00fcrfel?';
      return 'Welches Netz ergibt einen W\u00fcrfel? Kreuze an.';
    }
    if (t.sub==='s2n') return 'Wie hei\u00dft dieser K\u00f6rper? Kreuze an.';
    return 'Kreuze den K\u00f6rper an: ' + SOLID_NAMES[t.solid];
  }

  function taskHeight(t, showNr) {
    let body;
    if (t.area==='net' && t.sub==='yesno') body = 60;
    else if (t.area==='net' && t.sub==='pick') body = 80;
    else if (t.area==='solid' && t.sub==='s2n') body = 64 + 22;
    else body = 60 + 18;
    return (showNr?14:0) + 14 + body + 12;
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
    ctx.text(q, x, y, { font:F.bold, size:8.5, color:C.ink });
    y += 16;
    const cx = x + cellW/2;

    if (t.area==='net' && t.sub==='yesno') {
      const cell = 18;
      const sz = netSize(t.net, cell);
      const nx = x + 10;
      drawNet(ctx, t.net, nx, y, cell, C.fill);
      // Ja / Nein mit Kästchen
      let ox = x + cellW*0.5;
      const oy = y + Math.max(0, (sz.h-12)/2);
      ['Ja','Nein'].forEach(lbl => {
        const correct = showSol && ((lbl==='Ja') === t.valid);
        checkbox(ctx, ox, oy, 12, correct);
        ctx.text(lbl, ox+15, oy+1, { font:F.bold, size:9, color:C.ink });
        ox += 15 + ctx.textWidth(lbl, F.bold, 9) + 18;
      });
    } else if (t.area==='net' && t.sub==='pick') {
      const cell = 14;
      const n = t.options.length;
      const slotW = cellW / n;
      // einheitliche Checkbox-Höhe unter dem höchsten Netz der Reihe
      let maxH = 0;
      t.options.forEach(o => { maxH = Math.max(maxH, netSize(o.net, cell).h); });
      const boxY = y + maxH + 6;
      t.options.forEach((o, i) => {
        const sz = netSize(o.net, cell);
        const sx = x + i*slotW + (slotW - sz.w)/2;
        const correct = showSol && o.valid;
        drawNet(ctx, o.net, sx, y, cell, correct?C.fillSol:C.fill);
        checkbox(ctx, x + i*slotW + slotW/2 - 6, boxY, 12, correct);
      });
    } else if (t.area==='solid' && t.sub==='s2n') {
      const sz = 60;
      drawSolid(ctx, t.solid, cx - sz/2, y, sz, C.fill);
      let oy = y + sz + 6;
      let ox = x;
      t.options.forEach(o => {
        const correct = showSol && o === t.solid;
        checkbox(ctx, ox, oy, 11, correct);
        ctx.text(SOLID_NAMES[o], ox+15, oy+1, { font:F.regular, size:8.5, color:C.ink });
        ox += 15 + ctx.textWidth(SOLID_NAMES[o], F.regular, 8.5) + 14;
        if (ox > x + cellW - 50) { ox = x; oy += 14; }
      });
    } else {
      // n2s: Name vorgegeben, 4 Körper ankreuzen
      const n = t.options.length;
      const slotW = cellW / n;
      const sz = 50;
      t.options.forEach((o, i) => {
        const sx = x + i*slotW + (slotW - sz)/2;
        const correct = showSol && o === t.solid;
        drawSolid(ctx, o, sx, y, sz, correct?C.fillSol:C.fill);
        checkbox(ctx, x + i*slotW + slotW/2 - 6, y + sz + 2, 12, correct);
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
      // pick-Aufgaben über volle Breite (4 Netze) -> eigene Zeile
      const fullWidth = (t.area==='net' && t.sub==='pick') || (t.area==='solid' && t.sub==='n2s');
      const h = taskHeight(t, showNr);
      if (fullWidth) {
        // beide Spalten müssen frei sein -> auf max(colY) setzen
        let yy = Math.max(colY[0], colY[1]);
        if (yy + h > bottom) { if (pageNo+1 >= numPages) break; newPage(); yy = colY[0]; }
        placed.push({ t, idx: used.length, ctx, x: PT.marginX, yTop: yy, w: PT.contentW });
        used.push(t);
        colY[0] = colY[1] = yy + h + rowGap;
      } else {
        let c = (colY[0] <= colY[1]) ? 0 : 1;
        if (colY[c] + h > bottom) {
          const other = 1-c;
          if (colY[other] + h <= bottom) c = other;
          else { if (pageNo+1 >= numPages) break; newPage(); c = 0; }
        }
        const x = PT.marginX + c*(colW+colGap);
        placed.push({ t, idx: used.length, ctx, x, yTop: colY[c], w: colW });
        used.push(t);
        colY[c] += h + rowGap;
      }
    }
    placed.forEach(pl => drawTask(pl.ctx, pl.t, pl.idx, pl.x, pl.yTop, pl.w, showNr, showSol));

    // Lösungsblock
    if (showSol && used.length) {
      const yAfter = Math.max(colY[0], colY[1]) + 4;
      const solStrings = used.map((t,i) => {
        if (t.area==='net' && t.sub==='yesno') return (i+1)+'. '+(t.valid?'Ja':'Nein');
        if (t.area==='net' && t.sub==='pick') return (i+1)+'. g\u00fcltiges Netz';
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

  global.GeometrieWuerfelPDF = { PT, GEO, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
