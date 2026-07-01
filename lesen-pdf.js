/* =====================================================================
   lesen-pdf.js  ·  PDF-Modul für die Lesen-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Leseübung als PDF mit absoluten Koordinaten -> identisch iOS/Android.
   Nummerierte Sätze, optional eine Schreib-/Mallinie darunter.
   Deutsch-Schema: rot (#b91c1c / #dc2626).

   spec: { sentences:[str], showNr, showDraw }
   opts: { showName, showDate, showKl }
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14*MM, marginY: 12*MM };
  PT.contentW = PT.pageW - PT.marginX*2;

  const C = {
    red:     rgb01(0xb9,0x1c,0x1c),
    red2:    rgb01(0xdc,0x26,0x26),
    ink:     rgb01(0x1e,0x1b,0x4b),
    gray:    rgb01(0x94,0xa3,0xb8),
    sub:     rgb01(0x55,0x55,0x55),
    metaLine:rgb01(0x88,0x88,0x88),
    drawLine:rgb01(0x94,0xa3,0xb8),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const GEO = { lineGap: 30 };

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      line(x1,y1,x2,y2,o){ o=o||{}; page.drawLine({start:{x:x1,y:PT.pageH-y1},end:{x:x2,y:PT.pageH-y2},thickness:o.w||1,color:col(o.color)||col(C.ink),dashArray:o.dash}); },
      text(str,x,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; page.drawText(String(str),{x,y:PT.pageH-yTop-asc,size,font:f,color:col(o.color)||col(C.ink)}); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      wrap(str, font, size, maxW){
        const words = String(str).split(' ');
        const lines = []; let cur = '';
        words.forEach(w=>{
          const test = cur ? cur+' '+w : w;
          if (font.widthOfTextAtSize(test, size) > maxW && cur) { lines.push(cur); cur = w; }
          else cur = test;
        });
        if (cur) lines.push(cur);
        return lines;
      },
      fonts,
    };
  }

  function drawHeader(ctx, opts) {
    const F=ctx.fonts; const top=PT.marginY;
    ctx.text('Lesen \u00fcben', PT.marginX, top, { font:F.heavy, size:14, color:C.red });
    ctx.text('Lies die S\u00e4tze laut vor', PT.marginX, top+18, { font:F.regular, size:8, color:C.sub });
    const fields=[];
    if(opts.showName) fields.push(['Name:',95]);
    if(opts.showDate) fields.push(['Datum:',55]);
    if(opts.showKl) fields.push(['Klasse:',32]);
    const right=PT.pageW-PT.marginX; const gap=14, my=top+1;
    let totalW=0; fields.forEach(f=>{ totalW+=ctx.textWidth(f[0],F.regular,8)+3+f[1]+gap; }); totalW-=gap;
    let mx=right-totalW;
    fields.forEach(f=>{ const labW=ctx.textWidth(f[0],F.regular,8); ctx.text(f[0],mx,my,{font:F.regular,size:8,color:C.sub}); const lineX=mx+labW+3; ctx.line(lineX,my+10,lineX+f[1],my+10,{color:C.metaLine,w:1}); mx=lineX+f[1]+gap; });
    const lineY=top+30; ctx.line(PT.marginX,lineY,PT.pageW-PT.marginX,lineY,{color:C.red,w:2.5});
    return lineY+14;
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
    const sentences = (spec.sentences || []).filter(Boolean);
    const showNr = spec.showNr !== false;
    const fs = 15;
    const lineH = fs*1.5;
    const numW = 26;
    const bottom = PT.pageH - PT.marginY;
    const gapAfter = 14;

    if (!sentences.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine S\u00e4tze generiert.', PT.marginX, PT.marginY+20, { font:fonts.bold, size:11, color:C.sub });
      return await pdf.save();
    }

    const textX = PT.marginX + numW;
    const maxW = PT.contentW - numW;

    // numPages aus spec (1 oder 2). Jede Seite wird greedy bis zur Unterkante
    // gefuellt -> bei jeder Schwierigkeitsstufe optimal voll. Seite 2 ist eine
    // eigenstaendige, gleich aufgebaute Seite (eigene Kopfzeile, Nummerierung
    // ab 1) mit anderen Saetzen.
    const numPages = (spec.numPages === 2) ? 2 : 1;

    let idx = 0;
    for (let p = 0; p < numPages && idx < sentences.length; p++) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      let y = drawHeader(ctx, opts);
      let nr = 1;

      while (idx < sentences.length) {
        const lines = ctx.wrap(sentences[idx], fonts.bold, fs, maxW);
        const blockH = lines.length*lineH + gapAfter;
        // Mindestens ein Satz pro Seite; sonst Bottom-Check
        if (nr > 1 && y + blockH > bottom) break;
        if (showNr) ctx.text(nr+'.', PT.marginX, y, { font:fonts.bold, size:fs, color:C.gray });
        lines.forEach((ln, li) => {
          ctx.text(ln, textX, y + li*lineH, { font:fonts.bold, size:fs, color:C.ink });
        });
        y += lines.length*lineH + gapAfter;
        nr++; idx++;
      }
    }

    return await pdf.save();
  }

  global.LesenPDF = { PT, GEO, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
