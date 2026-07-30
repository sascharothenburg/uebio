/* =====================================================================
   zahlwoerter-pdf.js  ·  PDF-Modul für Zahlwörter & römische Zahlen
   © 2026 Sascha Rothenburg

   Eine Zeile = eine Aufgabe. Die Antwortform hängt vom Aufgabentyp ab:

     zahl2wort   727 = ______________________   (lange Schreiblinie)
     wort2zahl   siebenhundert… = [    ]        (kurzes Kästchen)
     zahl2rom    727 = ____________             (mittlere Linie)
     rom2zahl    DCCXXVII = [    ]              (kurzes Kästchen)
     dreher      einundzwanzig   [12] [21]      (richtige einkreisen)

   Spaltenzahl: "zahl2wort" braucht die volle Breite (das längste Zahlwort
   ist 29 Zeichen lang). Ist dieser Typ gewählt, wird einspaltig gesetzt,
   sonst zweispaltig - so bleibt die Kapazität für die Seitenzahl-Anzeige
   berechenbar.

   spec: { tasks:[…], numPages, cols, showSol, showNr }
   opts: { showName, showDate, showKl }
   Abhängig (global): window.PDFLib, window.fontkit (optional)
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14*MM, marginY: 12*MM };
  PT.contentW = PT.pageW - PT.marginX*2;

  const C = {
    blue:     rgb01(0x03,0x69,0xa1),
    ink:      rgb01(0x1e,0x1b,0x4b),
    sub:      rgb01(0x55,0x55,0x55),
    line:     rgb01(0x60,0xa5,0xfa),   // Schreiblinie (kräftig genug für S/W-Druck)
    box:      rgb01(0x60,0xa5,0xfa),   // Antwortkästchen
    boxBg:    rgb01(0xf0,0xf9,0xff),
    sol:      rgb01(0x16,0xa3,0x4a),   // Lösung
    solBg:    rgb01(0xdc,0xfc,0xe7),
    metaLine: rgb01(0x88,0x88,0x88),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const GEO = {
    rowH: 40,           // Zeilenhöhe
    colGap: 14,         // Abstand zwischen den Spalten
    nrW: 20,            // Platz für die Aufgabennummer
    promptSize: 11,     // Schriftgröße der Aufgabe
    baseOff: 25,        // Grundlinie relativ zur Zeilenoberkante
    lineOff: 3,         // Schreiblinie unter der Grundlinie
    boxW: 52, boxH: 22, // Antwortkästchen
    romLineW: 115,      // Linie für römische Antworten
    chipW: 46, chipGap: 9
  };

  /* Aufgabentypen, die die volle Seitenbreite brauchen */
  const WIDE = { zahl2wort: true };

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
      textCenteredBaseline(str,cx,yBase,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const w=f.widthOfTextAtSize(String(str),size); this.textBaseline(str,cx-w/2,yBase,o); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts, titel) {
    const F = ctx.fonts; const top = PT.marginY;
    ctx.text(titel || 'Zahlen schreiben und lesen', PT.marginX, top, { font:F.heavy, size:14, color:C.blue });
    ctx.text('Schreibe die Zahl in der anderen Schreibweise', PT.marginX, top+18, { font:F.regular, size:8, color:C.sub });
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

  /* Spaltenzahl aus der Typauswahl: lange Zahlwörter brauchen die
     ganze Breite, alles andere passt zweispaltig. */
  function colsFor(typen) {
    if (!typen || !typen.length) return 1;
    for (let i=0;i<typen.length;i++) if (WIDE[typen[i]]) return 1;
    return 2;
  }

  function capacityForPages(cols, numPages) {
    const bottom = PT.pageH - PT.marginY;
    let total = 0;
    for (let p=0; p<numPages; p++) {
      let y = (p===0) ? (PT.marginY + 30 + 12) : (PT.marginY + 4);
      let rows = 0;
      while (y + GEO.rowH <= bottom) { rows++; y += GEO.rowH; }
      total += rows * cols;
    }
    return total;
  }

  function drawTask(ctx, task, idx, x, yTop, colW, showNr, showSol) {
    const F = ctx.fonts;
    const wordFont = F.grund || F.bold;
    const size = GEO.promptSize;
    const baseY = yTop + GEO.baseOff;
    let cx = x;

    if (showNr) {
      ctx.textBaseline((idx+1)+'.', cx, baseY, { font:F.bold, size:8.5, color:C.blue });
      cx += GEO.nrW;
    }
    const right = x + colW;

    /* --- Zahlendreher: Wort, daneben zwei Zahlen zum Einkreisen --- */
    if (task.typ === 'dreher') {
      ctx.textBaseline(task.frage, cx, baseY, { font:wordFont, size, color:C.ink });
      let bx = right - (GEO.chipW*2 + GEO.chipGap);
      task.wahl.forEach(function (v) {
        const isSol = showSol && (String(v) === task.loesung);
        ctx.rect(bx, baseY-16, GEO.chipW, GEO.boxH,
                 { fill: isSol?C.solBg:C.boxBg, stroke: isSol?C.sol:C.box, strokeWidth: isSol?1.6:1.1 });
        ctx.textCenteredBaseline(String(v), bx+GEO.chipW/2, baseY,
                 { font:wordFont, size, color: isSol?C.sol:C.ink });
        bx += GEO.chipW + GEO.chipGap;
      });
      return;
    }

    /* --- alle übrigen Typen: "Frage =" und danach die Antwortform --- */
    const prompt = task.frage + '  =';
    ctx.textBaseline(prompt, cx, baseY, { font:wordFont, size, color:C.ink });
    cx += ctx.textWidth(prompt, wordFont, size) + 8;

    const kurz = (task.typ === 'wort2zahl' || task.typ === 'rom2zahl');
    if (kurz) {
      ctx.rect(cx, baseY-16, GEO.boxW, GEO.boxH,
               { fill: showSol?C.solBg:C.boxBg, stroke: showSol?C.sol:C.box, strokeWidth: showSol?1.6:1.1 });
      if (showSol) ctx.textCenteredBaseline(task.loesung, cx+GEO.boxW/2, baseY, { font:wordFont, size, color:C.sol });
      return;
    }

    /* Schreiblinie: römisch bekommt eine feste Länge, das Zahlwort
       den ganzen Rest der Zeile. */
    const lineEnd = (task.typ === 'zahl2rom')
      ? Math.min(cx + GEO.romLineW, right)
      : right;
    ctx.line(cx, baseY+GEO.lineOff, lineEnd, baseY+GEO.lineOff, { color:C.line, w:1.2 });
    if (showSol) ctx.textBaseline(task.loesung, cx+3, baseY, { font:wordFont, size, color:C.sol });
  }

  async function buildWorksheetPDF(spec, opts, fontBytes) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    if (fontBytes && global.fontkit) pdf.registerFontkit(global.fontkit);

    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold:    await pdf.embedFont(StandardFonts.HelveticaBold),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
      grund:   null
    };
    if (fontBytes && global.fontkit) {
      try { fonts.grund = await pdf.embedFont(fontBytes); } catch (e) { fonts.grund = null; }
    }

    opts = opts || {}; spec = spec || {};
    const tasks = (spec.tasks || []).filter(Boolean);
    const numPages = spec.numPages || 1;
    const cols = spec.cols || 1;
    const showNr = spec.showNr !== false;
    const showSol = !!spec.showSol;

    if (!tasks.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Aufgaben erstellt.', PT.marginX, PT.marginY+20, { font:fonts.bold, size:11, color:C.sub });
      return await pdf.save();
    }

    const colW = (PT.contentW - GEO.colGap*(cols-1)) / cols;
    const bottom = PT.pageH - PT.marginY;
    let pageNo = 0;
    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let rowY = drawHeader(ctx, opts, spec.titel);
    let colIdx = 0;

    for (let i=0;i<tasks.length;i++) {
      if (colIdx >= cols) { colIdx = 0; rowY += GEO.rowH; }
      if (rowY + GEO.rowH > bottom) {
        if (pageNo+1 >= numPages) break;
        pageNo++;
        page = pdf.addPage([PT.pageW, PT.pageH]);
        ctx = makeCtx(page, fonts);
        rowY = PT.marginY + 4;
        colIdx = 0;
      }
      drawTask(ctx, tasks[i], i, PT.marginX + colIdx*(colW+GEO.colGap), rowY, colW, showNr, showSol);
      colIdx++;
    }

    return await pdf.save();
  }

  /* =================================================================
     MERKBLATT RÖMISCHE ZAHLEN
     Einseitiges Lernblatt zum Anschauen oder Aufhängen - keine Aufgaben.
     ================================================================= */

  const ZEICHEN = [['I',1],['V',5],['X',10],['L',50],['C',100],['D',500],['M',1000]];
  const SONDER  = [['IV',4],['IX',9],['XL',40],['XC',90],['CD',400],['CM',900]];

  const REGELN = [
    'Gleiche Zeichen stehen h\u00f6chstens dreimal nebeneinander: III = 3, aber nicht IIII.',
    'Steht ein kleineres Zeichen VOR einem gr\u00f6\u00dferen, wird es abgezogen: IV = 5 - 1 = 4.',
    'Abgezogen werden nur I, X und C \u2013 und nur von den beiden n\u00e4chstgr\u00f6\u00dferen Zeichen.',
    'Sonst wird von links nach rechts addiert: XVII = 10 + 5 + 1 + 1 = 17.'
  ];

  /* Zerlegt eine Zahl in ihre römischen Bausteine - für das Beispiel */
  function zerlege(n) {
    const ROM = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],
                 [50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    const teile = [];
    for (let i=0;i<ROM.length;i++) {
      while (n >= ROM[i][0]) { teile.push(ROM[i]); n -= ROM[i][0]; }
    }
    return teile;
  }

  async function buildMerkblattPDF(opts, fontBytes) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    if (fontBytes && global.fontkit) pdf.registerFontkit(global.fontkit);
    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold:    await pdf.embedFont(StandardFonts.HelveticaBold),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
      grund:   null
    };
    if (fontBytes && global.fontkit) {
      try { fonts.grund = await pdf.embedFont(fontBytes); } catch (e) { fonts.grund = null; }
    }
    opts = opts || {};
    const page = pdf.addPage([PT.pageW, PT.pageH]);
    const ctx = makeCtx(page, fonts);
    const F = fonts, W = fonts.grund || fonts.bold;
    const X = PT.marginX, R = PT.pageW - PT.marginX;
    let y = PT.marginY;

    /* Kopf */
    ctx.text('R\u00f6mische Zahlen', X, y, { font:F.heavy, size:16, color:C.blue });
    ctx.text('Merkblatt \u2013 die sieben Zeichen und wie man sie zusammensetzt', X, y+21,
             { font:F.regular, size:8.5, color:C.sub });
    ctx.line(X, y+34, R, y+34, { color:C.blue, w:2.5 });
    y += 48;

    function ueberschrift(txt) {
      ctx.text(txt, X, y, { font:F.heavy, size:10, color:C.blue });
      y += 16;
    }

    /* 1) Die sieben Zeichen */
    ueberschrift('1  Die sieben Zeichen');
    {
      const bw = (PT.contentW - 6*8) / 7, bh = 46;
      ZEICHEN.forEach(function (z, i) {
        const bx = X + i*(bw+8);
        ctx.rect(bx, y, bw, bh, { fill:C.boxBg, stroke:C.box, strokeWidth:1.2 });
        ctx.textCenteredBaseline(z[0], bx+bw/2, y+24, { font:W, size:17, color:C.blue });
        ctx.textCenteredBaseline('= '+z[1], bx+bw/2, y+39, { font:W, size:9.5, color:C.ink });
      });
      y += bh + 18;
    }

    /* 2) Regeln */
    ueberschrift('2  Die Regeln');
    REGELN.forEach(function (r) {
      ctx.circle(X+3, y+4.5, 2, { fill:C.box });
      ctx.text(r, X+12, y, { font:W, size:9, color:C.ink });
      y += 15;
    });
    y += 8;

    /* 3) Die sechs Sonderfälle */
    ueberschrift('3  Diese sechs musst du dir merken');
    {
      const bw = (PT.contentW - 5*8) / 6, bh = 40;
      SONDER.forEach(function (s, i) {
        const bx = X + i*(bw+8);
        ctx.rect(bx, y, bw, bh, { fill:C.solBg, stroke:C.sol, strokeWidth:1.2 });
        ctx.textCenteredBaseline(s[0], bx+bw/2, y+21, { font:W, size:14, color:C.sol });
        ctx.textCenteredBaseline('= '+s[1], bx+bw/2, y+34, { font:W, size:9, color:C.ink });
      });
      y += bh + 18;
    }

    /* 4) Beispiel Schritt für Schritt */
    ueberschrift('4  Schritt f\u00fcr Schritt: 468');
    {
      const teile = zerlege(468);
      let bx = X;
      const bw = 62, bh = 34;
      teile.forEach(function (t, i) {
        ctx.rect(bx, y, bw, bh, { fill:C.boxBg, stroke:C.box, strokeWidth:1.1 });
        ctx.textCenteredBaseline(t[1], bx+bw/2, y+17, { font:W, size:13, color:C.blue });
        ctx.textCenteredBaseline(String(t[0]), bx+bw/2, y+29, { font:W, size:8.5, color:C.sub });
        bx += bw;
        if (i < teile.length-1) {
          ctx.textCenteredBaseline('+', bx+7, y+21, { font:W, size:11, color:C.sub });
          bx += 14;
        }
      });
      y += bh + 6;
      ctx.text('400 + 50 + 10 + 5 + 1 + 1 + 1  =  468        also:  468 = '+
               teile.map(function(t){return t[1];}).join(''),
               X, y, { font:W, size:9.5, color:C.ink });
      y += 22;
    }

    /* 5) Übersichtstabelle */
    ueberschrift('5  Zum Nachschlagen');
    {
      const spalten = [
        { titel:'1 bis 10',   werte: [1,2,3,4,5,6,7,8,9,10] },
        { titel:'11 bis 20',  werte: [11,12,13,14,15,16,17,18,19,20] },
        { titel:'Zehner',     werte: [30,40,50,60,70,80,90,100] },
        { titel:'Hunderter',  werte: [200,300,400,500,600,700,800,900,1000] }
      ];
      const cw = PT.contentW/4, lh = 15;
      spalten.forEach(function (sp, i) {
        const sx = X + i*cw;
        ctx.text(sp.titel, sx, y, { font:F.bold, size:8.5, color:C.blue });
        ctx.line(sx, y+12, sx+cw-10, y+12, { color:C.box, w:0.8 });
        sp.werte.forEach(function (v, r) {
          const teile = zerlege(v).map(function(t){return t[1];}).join('');
          ctx.text(v + '  =  ' + teile, sx, y+16+r*lh, { font:W, size:9, color:C.ink });
        });
      });
      y += 16 + 10*lh + 10;
    }

    /* Fußnote */
    ctx.line(X, y, R, y, { color:C.box, w:0.8 });
    y += 8;
    ctx.text('R\u00f6mische Zahlen findest du auf Zifferbl\u00e4ttern von Uhren, an Jahreszahlen '+
             'auf alten Geb\u00e4uden und als Kapitelnummern in B\u00fcchern.',
             X, y, { font:W, size:8.5, color:C.sub });
    y += 13;
    ctx.text('Auf manchen Uhren steht IIII statt IV \u2013 das ist eine alte Schreibweise, '+
             'die es vor der Regel mit dem Abziehen gab.',
             X, y, { font:W, size:8.5, color:C.sub });

    return await pdf.save();
  }

  global.ZahlwoerterPDF = { PT, GEO, WIDE, ZEICHEN, SONDER,
                            colsFor, capacityForPages,
                            buildWorksheetPDF, buildMerkblattPDF };

})(typeof window !== 'undefined' ? window : this);
