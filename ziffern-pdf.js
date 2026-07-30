/* =====================================================================
   ziffern-pdf.js  ·  PDF-Modul für die Ziffern-Schreibübung (pdf-lib)
   © 2026 Sascha Rothenburg

   Schreiblehrgang für die Ziffern 0-9 im Kästchenraster.
   Eine Zeile = eine Ziffer:

     [Mengenbild]  [Vollton]  [punktiert]…  [leere Kästchen]…

   Der Vollton kommt aus der Grundschrift, die Nachspur-Ziffern aus der
   punktierten Variante (Grundschrift-Punkt).

   WICHTIG: Die Vollton-Grundschrift ist tabellarisch (alle Ziffern 600/1000),
   die Punkt-Variante NICHT (586-759). Jede Ziffer wird deshalb einzeln
   über ihre gemessene Breite im Kästchen zentriert.

   spec: { rows:[{digit, traceCells}], numPages, cellMM, showDots, showStart }
   opts: { showName, showDate, showKl }
   Abhängig (global): window.PDFLib, window.fontkit
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14*MM, marginY: 12*MM };
  PT.contentW = PT.pageW - PT.marginX*2;

  const C = {
    blue:     rgb01(0x03,0x69,0xa1),
    grid:     rgb01(0xbf,0xdb,0xfe),   // Kästchenlinien
    gridBold: rgb01(0x60,0xa5,0xfa),   // Rahmen des Kästchenstreifens
    solid:    rgb01(0x1d,0x4e,0xd8),   // Vollton-Vorgabe
    trace:    rgb01(0x60,0xa5,0xfa),   // punktierte Nachspur-Ziffer (kräftig genug,
                                       // die Punkte der Schrift sind klein)
    start:    rgb01(0xea,0x58,0x0c),   // Startpunkt
    dot:      rgb01(0x0e,0xa5,0xe9),   // Mengenbild-Punkte
    ink:      rgb01(0x1e,0x1b,0x4b),
    sub:      rgb01(0x55,0x55,0x55),
    metaLine: rgb01(0x88,0x88,0x88),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const NAMES = ['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun'];

  /* Startpunkte der Schreibbewegung, als Anteil der Ziffernfläche
     (x von links, y von oben).

     Diese Werte sind NICHT geschätzt, sondern aus der Schrift
     "Grundschrift-Punkt" ausgemessen: dort besteht jede Ziffer aus
     gleich großen Punkten plus EINER deutlich größeren Kontur (Faktor
     5-12 der Fläche) - das ist der vom Schriftentwerfer gesetzte
     Startpunkt. In den Nachspur-Kästchen ist er dadurch ohnehin
     sichtbar; die Tabelle dient nur dazu, ihn auch im Vollton-
     Vorgabekästchen anzeigen zu können. */
  const START = {
    0:[0.65,0.07], 1:[0.16,0.30], 2:[0.09,0.18], 3:[0.13,0.08], 4:[0.56,0.06],
    5:[0.16,0.07], 6:[0.79,0.06], 7:[0.11,0.06], 8:[0.70,0.07], 9:[0.80,0.07]
  };

  /* Die Ziffern der Grundschrift stehen auf der Grundlinie und reichen
     bis rund 0.78 em Höhe (gemessen: minY -5…7, maxY 759…794). */
  const DIGIT_H = 0.78;

  const GEO = {
    labelH: 13,          // Beschriftung über dem Kästchenstreifen
    rowGap: 4*MM,        // Abstand zwischen zwei Ziffernzeilen
    fill: 0.80,          // wie hoch die Ziffer im Kästchen steht
    dotBoxCells: 2       // Breite des Mengenbilds in Kästchen
  };

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) {
        o = o || {};
        page.drawRectangle({ x, y: PT.pageH-yTop-h, width:w, height:h,
          color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth||0,
          borderDashArray: o.dash || undefined });
      },
      circle(cx, cyTop, r, o) {
        o = o || {};
        page.drawCircle({ x:cx, y:PT.pageH-cyTop, size:r,
          color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth||0 });
      },
      line(x1,y1,x2,y2,o){ o=o||{}; page.drawLine({ start:{x:x1,y:PT.pageH-y1}, end:{x:x2,y:PT.pageH-y2}, thickness:o.w||1, color:col(o.color)||col(C.ink), dashArray:o.dash }); },
      text(str,x,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; page.drawText(String(str),{x,y:PT.pageH-yTop-asc,size,font:f,color:col(o.color)||col(C.ink),opacity:o.opacity}); },
      textBaseline(str,x,yBase,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; page.drawText(String(str),{x,y:PT.pageH-yBase,size,font:f,color:col(o.color)||col(C.ink),opacity:o.opacity}); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts) {
    const F = ctx.fonts; const top = PT.marginY;
    ctx.text('Ziffern schreiben', PT.marginX, top, { font:F.heavy, size:14, color:C.blue });
    ctx.text('Spure die Ziffern nach und schreibe sie weiter', PT.marginX, top+18, { font:F.regular, size:8, color:C.sub });
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

  function cellSize(cellMM){ return (cellMM||12) * MM; }
  function rowHeight(cellMM){ return GEO.labelH + cellSize(cellMM) + GEO.rowGap; }
  function cellCount(cellMM){ return Math.floor(PT.contentW / cellSize(cellMM)); }

  /* Zeichnet eine Ziffer mittig in ein Kästchen. Beide Schriftschnitte
     werden einzeln vermessen, weil die Punkt-Variante nicht tabellarisch ist. */
  function drawDigit(ctx, digit, font, cx, cellTop, K, color, opacity) {
    const size = (K * GEO.fill) / DIGIT_H;
    const s = String(digit);
    const w = ctx.textWidth(s, font, size);
    /* Grundlinie so legen, dass die Ziffer senkrecht mittig sitzt */
    const glyphH = size * DIGIT_H;
    const baseY = cellTop + (K + glyphH)/2;
    ctx.textBaseline(s, cx - w/2, baseY, { font, size, color, opacity });
    return { size, baseY, glyphH };
  }

  /* Mengenbild: so viele Punkte wie die Ziffer angibt (0 bleibt leer) */
  function drawDots(ctx, n, x, yTop, w, h) {
    ctx.rect(x, yTop, w, h, { stroke:C.gridBold, strokeWidth:1, dash:[2,2] });
    if (!n) return;
    const cols = n <= 3 ? n : (n <= 6 ? 3 : 3);
    const rows = Math.ceil(n / cols);
    const r = Math.min(w/(cols*3.2), h/(rows*3.2));
    const gapX = w/(cols+1), gapY = h/(rows+1);
    let k = 0;
    for (let ry=0; ry<rows; ry++) {
      const inRow = Math.min(cols, n-k);
      const offX = (cols-inRow)*gapX/2;
      for (let cxi=0; cxi<inRow; cxi++) {
        ctx.circle(x+offX+gapX*(cxi+1), yTop+gapY*(ry+1), r, { fill:C.dot });
        k++;
      }
    }
  }

  function drawRow(ctx, row, yTop, cellMM, showDots, showStart, fonts) {
    const K = cellSize(cellMM);
    const total = cellCount(cellMM);
    const x0 = PT.marginX;
    const gridTop = yTop + GEO.labelH;

    /* Beschriftung */
    ctx.text(row.digit + ' \u2013 ' + NAMES[row.digit], x0, yTop,
             { font:fonts.bold, size:9, color:C.blue });

    /* Kästchenraster */
    ctx.rect(x0, gridTop, total*K, K, { stroke:C.gridBold, strokeWidth:1.2 });
    for (let i=1;i<total;i++) ctx.line(x0+i*K, gridTop, x0+i*K, gridTop+K, { color:C.grid, w:0.8 });

    let cell = 0;
    /* Mengenbild ganz links */
    if (showDots) {
      drawDots(ctx, row.digit, x0+2, gridTop+2, GEO.dotBoxCells*K-4, K-4);
      cell = GEO.dotBoxCells;
    }
    /* Vollton-Vorgabe */
    const solidFont = fonts.grundSolid || fonts.bold;
    drawDigit(ctx, row.digit, solidFont, x0+(cell+0.5)*K, gridTop, K, C.solid);
    if (showStart) {
      const sp = START[row.digit] || [0.5,0.1];
      const size = (K*GEO.fill)/DIGIT_H;
      const gw = ctx.textWidth(String(row.digit), solidFont, size);
      const gh = size*DIGIT_H;
      const gx = x0+(cell+0.5)*K - gw/2, gy = gridTop + (K-gh)/2;
      ctx.circle(gx + sp[0]*gw, gy + sp[1]*gh, 2.1, { fill:C.start });
    }
    cell++;

    /* Punktierte Nachspur-Ziffern */
    const traceFont = fonts.grundDot || solidFont;
    const useOpacity = !fonts.grundDot;   // ohne Punktfont ersatzweise blass
    for (let t=0; t<row.traceCells && cell<total; t++, cell++) {
      drawDigit(ctx, row.digit, traceFont, x0+(cell+0.5)*K, gridTop, K,
                C.trace, useOpacity ? 0.35 : undefined);
    }
    /* Rest bleibt leer */
  }

  async function buildWorksheetPDF(spec, opts, fontBytes, fontBytesPunkt) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    if ((fontBytes || fontBytesPunkt) && global.fontkit) pdf.registerFontkit(global.fontkit);

    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold:    await pdf.embedFont(StandardFonts.HelveticaBold),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
      grundSolid: null, grundDot: null
    };
    if (fontBytes && global.fontkit) {
      try { fonts.grundSolid = await pdf.embedFont(fontBytes); } catch(e) { fonts.grundSolid = null; }
    }
    if (fontBytesPunkt && global.fontkit) {
      try { fonts.grundDot = await pdf.embedFont(fontBytesPunkt); } catch(e) { fonts.grundDot = null; }
    }

    opts = opts || {}; spec = spec || {};
    const rows = (spec.rows || []).filter(Boolean);
    const numPages = spec.numPages || 1;
    const cellMM = spec.cellMM || 12;
    const showDots = !!spec.showDots;
    const showStart = !!spec.showStart;

    if (!rows.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Ziffern gewählt.', PT.marginX, PT.marginY+20, { font:fonts.bold, size:11, color:C.sub });
      return await pdf.save();
    }

    const h = rowHeight(cellMM);
    const bottom = PT.pageH - PT.marginY;
    let pageNo = 0;
    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let y = drawHeader(ctx, opts);

    for (let i=0;i<rows.length;i++) {
      if (y + h > bottom) {
        if (pageNo+1 >= numPages) break;
        pageNo++;
        page = pdf.addPage([PT.pageW, PT.pageH]);
        ctx = makeCtx(page, fonts);
        y = PT.marginY + 4;
      }
      drawRow(ctx, rows[i], y, cellMM, showDots, showStart, fonts);
      y += h;
    }

    return await pdf.save();
  }

  /* Wie viele Zeilen passen bei gegebener Kästchengröße auf n Seiten?
     Wird von der App für die Seitenzahl-Steuerung genutzt, damit
     Kapazität und Seitenumbruch nicht auseinanderlaufen. */
  function capacityForPages(cellMM, numPages) {
    const h = rowHeight(cellMM);
    const bottom = PT.pageH - PT.marginY;
    let total = 0;
    for (let p=0; p<numPages; p++) {
      let y = (p===0) ? (PT.marginY + 30 + 12) : (PT.marginY + 4);
      while (y + h <= bottom) { total++; y += h; }
    }
    return total;
  }

  global.ZiffernPDF = { PT, GEO, NAMES, START,
                        cellCount, capacityForPages, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
