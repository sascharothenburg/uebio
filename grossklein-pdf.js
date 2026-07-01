/* =====================================================================
   grossklein-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Groß- und Kleinschreibung als PDF -> identisch iOS/Android.
   Aufgabentypen:
     fix  – Satz klein gegeben, richtig auf Lineatur schreiben
     find – korrekter Satz, Nomen unterstreichen
     pair – Wortpaar groß/klein ankreuzen
   Deutsch-Schema rot; Schreiblinien blau (Lineatur 1/2/3 Linien).

   spec: { tasks:[{type,sent|word,cap,note}], numPages, showSol, showRule, lineStyle, diff }
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
    // Lineatur (blau)
    base:    rgb01(0x1d,0x4e,0xd8),   // Grundlinie
    help:    rgb01(0x93,0xc5,0xfd),   // Hilfslinie (gestrichelt)
    frame:   rgb01(0x60,0xa5,0xfa),   // Dach/Keller/vertikale Striche
    ruleBg:  rgb01(0xfe,0xf2,0xf2),
    ruleBd:  rgb01(0xfe,0xca,0xca),
    ruleTx:  rgb01(0x7f,0x1d,0x1d),
    box:     rgb01(0x55,0x55,0x55),
    sol:     rgb01(0xdc,0x26,0x26),
    note:    rgb01(0x77,0x77,0x77),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  const BAND2 = 3.5 * MM;  // 2-Linien: Abstand Hilfslinie <-> Grundlinie (wie Heft)
  const B3_TOP = 4 * MM;   // Oberlängen
  const B3_MID = 5 * MM;   // Mittelband (x-Höhe)
  const B3_BOT = 4 * MM;   // Unterlängen
  const B3_TOTAL = B3_TOP + B3_MID + B3_BOT;

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x,yTop,w,h,o){ o=o||{}; page.drawRectangle({x,y:PT.pageH-yTop-h,width:w,height:h,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0}); },
      line(x1,y1,x2,y2,o){ o=o||{}; page.drawLine({start:{x:x1,y:PT.pageH-y1},end:{x:x2,y:PT.pageH-y2},thickness:o.w||1,color:col(o.color)||col(C.ink),dashArray:o.dash}); },
      text(str,x,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; page.drawText(String(str),{x,y:PT.pageH-yTop-asc,size,font:f,color:col(o.color)||col(C.ink)}); },
      ascHeight(size,font){ return (font||fonts.regular).heightAtSize(size)*0.76; },
      textBaseline(str,x,baseY,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; this.text(str,x,baseY-asc,o); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      wrap(str, font, size, maxW){
        const words = String(str).split(' '); const lines=[]; let cur='';
        words.forEach(w=>{ const test=cur?cur+' '+w:w; if(font.widthOfTextAtSize(test,size)>maxW && cur){lines.push(cur);cur=w;} else cur=test; });
        if(cur) lines.push(cur); return lines;
      },
      fonts,
    };
  }

  function drawHeader(ctx, opts, sub) {
    const F=ctx.fonts; const top=PT.marginY;
    ctx.text('Gro\u00df- und Kleinschreibung', PT.marginX, top, { font:F.heavy, size:13, color:C.red2 });
    ctx.text(sub, PT.marginX, top+17, { font:F.regular, size:8, color:C.sub });
    const fields=[];
    if(opts.showName) fields.push(['Name:',90]);
    if(opts.showDate) fields.push(['Datum:',52]);
    if(opts.showKl) fields.push(['Klasse:',30]);
    const right=PT.pageW-PT.marginX; const gap=12, my=top+1;
    let totalW=0; fields.forEach(f=>{ totalW+=ctx.textWidth(f[0],F.regular,8)+3+f[1]+gap; }); totalW-=gap;
    let mx=right-totalW;
    fields.forEach(f=>{ const labW=ctx.textWidth(f[0],F.regular,8); ctx.text(f[0],mx,my,{font:F.regular,size:8,color:C.sub}); const lineX=mx+labW+3; ctx.line(lineX,my+10,lineX+f[1],my+10,{color:C.metaLine,w:1}); mx=lineX+f[1]+gap; });
    const lineY=top+28; ctx.line(PT.marginX,lineY,PT.pageW-PT.marginX,lineY,{color:C.red2,w:2.5});
    return lineY+12;
  }

  // ---- Lineatur (Vektor), Heft-Maß ----
  function lineRowHeight(style) {
    if (style === '3') return B3_TOTAL + 4 * MM;
    if (style === '2') return B3_TOP + BAND2 + B3_BOT + 2 * MM;
    if (style === '1') return B3_MID + B3_BOT + 2 * MM;
    return B3_MID + 2.4 * MM;
  }
  function drawLineRow(ctx, x, yTop, w, style) {
    const x2 = x + w;
    if (style === '1') {
      const padTop = B3_TOP + B3_MID;
      ctx.line(x, yTop + padTop, x2, yTop + padTop, { color:C.base, w:2 });
    } else if (style === '2') {
      const padTop = B3_TOP;
      ctx.line(x, yTop + padTop, x2, yTop + padTop, { color:C.help, w:1, dash:[3,2] });
      ctx.line(x, yTop + padTop + BAND2, x2, yTop + padTop + BAND2, { color:C.base, w:2 });
      ctx.line(x, yTop + padTop, x, yTop + padTop + BAND2, { color:C.frame, w:1 });
      ctx.line(x2, yTop + padTop, x2, yTop + padTop + BAND2, { color:C.frame, w:1 });
    } else {
      ctx.line(x, yTop, x2, yTop, { color:C.frame, w:1 });
      ctx.line(x, yTop + B3_TOP, x2, yTop + B3_TOP, { color:C.help, w:1, dash:[3,2] });
      ctx.line(x, yTop + B3_TOP + B3_MID, x2, yTop + B3_TOP + B3_MID, { color:C.base, w:2 });
      ctx.line(x, yTop + B3_TOTAL, x2, yTop + B3_TOTAL, { color:C.frame, w:1 });
      ctx.line(x, yTop, x, yTop + B3_TOTAL, { color:C.frame, w:1 });
      ctx.line(x2, yTop, x2, yTop + B3_TOTAL, { color:C.frame, w:1 });
    }
  }

  // Satz-Text aus Token-Array. correct: richtige Groß/Kleinschreibung, sonst alles klein.
  function uc(w){ return w.charAt(0).toUpperCase()+w.slice(1); }
  function lc(w){ return w.charAt(0).toLowerCase()+w.slice(1); }
  function sentenceStr(sent, correct){
    return sent.map(t=>{
      const w=t[0];
      if(correct){ return (t[1]==='S'||t[1]==='N'||t[1]==='X') ? uc(w) : lc(w); }
      return lc(w);
    }).join(' ');
  }
  // Lösungssatz mit Nomen-Positionen (für Unterstreichung)
  function nomenWords(sent){
    return sent.filter(t=> t[1]==='S'||t[1]==='N'||t[1]==='X').map(t=>uc(t[0]));
  }

  function secHead(ctx, txt, x, y){
    ctx.text(txt, x, y, { font:ctx.fonts.heavy, size:9.5, color:C.red2 });
    return y + 16;
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
    const showSol = !!spec.showSol;
    const showRule = !!spec.showRule;
    const style = spec.lineStyle || '2';
    const diff = spec.diff || '12';
    const fs = 15;
    const bottom = PT.pageH - PT.marginY;
    const W = PT.contentW;

    const hasSets = spec.taskSets && spec.taskSets.length && spec.taskSets.some(s => s && s.length);
    if (!tasks.length && !hasSets) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Aufgaben generiert.', PT.marginX, PT.marginY+20, { font:fonts.bold, size:11, color:C.sub });
      return await pdf.save();
    }

    // Aufgabensätze: bei "2 Seiten" zwei getrennte, gleich aufgebaute Seiten (andere Sätze).
    const taskSets = (spec.taskSets && spec.taskSets.length)
      ? spec.taskSets.map(set => set.slice())
      : [tasks];

    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    const headSub = diff==='34'?'Klasse 3\u20134':'Klasse 1\u20132';
    let y = drawHeader(ctx, opts, headSub);

    function newPage(sub){ page=pdf.addPage([PT.pageW,PT.pageH]); ctx=makeCtx(page,fonts); y=drawHeader(ctx, opts, sub!=null?sub:headSub); }
    function ensure(h){ if (y + h > bottom) { newPage(); } }

    function renderTaskSet(setTasks){
      const groups = { fix:[], find:[], pair:[] };
      setTasks.forEach(t=>{ if(groups[t.type]) groups[t.type].push(t); });

      // Merksatz
      if (showRule) {
        const rule = diff==='34'
          ? 'Merke: Nomen schreibt man gro\u00df \u2013 auch nominalisierte Verben und Adjektive. Am Satzanfang schreibt man immer gro\u00df.'
          : 'Merke: Nomen (Namenw\u00f6rter) schreibt man gro\u00df. Am Satzanfang schreibt man immer gro\u00df.';
        const lines = ctx.wrap(rule, fonts.regular, 8.5, W-10*MM);
        const boxH = lines.length*12 + 8*MM;
        ensure(boxH);
        ctx.rect(PT.marginX, y, W, boxH, { fill:C.ruleBg, stroke:C.ruleBd, strokeWidth:1.5 });
        lines.forEach((ln,i)=> ctx.text(ln, PT.marginX+4*MM, y+4*MM+i*12, { font:fonts.regular, size:8.5, color:C.ruleTx }));
        y += boxH + 5*MM;
      }

      let nr = 1;

      // FIX
      if (groups.fix.length) {
        ensure(20); y = secHead(ctx, 'Schreibe die S\u00e4tze richtig auf.', PT.marginX, y);
        groups.fix.forEach(t=>{
          const lh = lineRowHeight(style);
          const blockH = 14 + lh + 4*MM;
          ensure(blockH);
          ctx.text((nr)+'. '+sentenceStr(t.sent, false), PT.marginX, y, { font:fonts.bold, size:fs, color:C.ink });
          y += 14;
          drawLineRow(ctx, PT.marginX, y, W, style);
          y += lh + 4*MM;
          nr++;
        });
      }

      // FIND
      if (groups.find.length) {
        ensure(20); y = secHead(ctx, 'Unterstreiche alle gro\u00df geschriebenen W\u00f6rter (Nomen).', PT.marginX, y);
        groups.find.forEach(t=>{
          const str = (nr)+'. '+sentenceStr(t.sent, true);
          const lines = ctx.wrap(str, fonts.bold, fs, W);
          const blockH = lines.length*fs*1.8 + 4*MM;
          ensure(blockH);
          lines.forEach((ln,i)=> ctx.text(ln, PT.marginX, y+i*fs*1.8, { font:fonts.bold, size:fs, color:C.ink }));
          y += lines.length*fs*1.8 + 4*MM;
          nr++;
        });
      }

      // PAIR
      if (groups.pair.length) {
        ensure(20); y = secHead(ctx, 'Kreuze die richtige Schreibweise an.', PT.marginX, y);
        const nrW = 24;
        const boxW = 12, boxGap = 16;
        let maxWordW = 0;
        groups.pair.forEach(t=>{ maxWordW = Math.max(maxWordW, ctx.textWidth(uc(t.word), fonts.bold, fs)); });
        const optW = boxGap + maxWordW + 28;
        groups.pair.forEach(t=>{
          const rowH = 6*MM;
          ensure(rowH);
          const opts = Math.random()<0.5 ? [lc(t.word),uc(t.word)] : [uc(t.word),lc(t.word)];
          const x0 = PT.marginX;
          ctx.text((nr)+'.', x0, y+1, { font:fonts.bold, size:fs, color:C.ink });
          opts.forEach((o,i)=>{
            const cx = x0 + nrW + i*optW;
            ctx.rect(cx, y, boxW, boxW, { stroke:C.box, strokeWidth:1.4 });
            ctx.text(o, cx + boxGap, y+1, { font:fonts.bold, size:fs, color:C.ink });
          });
          if (t.note) ctx.text('('+t.note+')', x0 + nrW + opts.length*optW, y+2, { font:fonts.regular, size:7.5, color:C.note });
          y += rowH;
          nr++;
        });
      }
    }

    taskSets.forEach((setTasks, si) => {
      if (si > 0) { newPage(); }
      renderTaskSet(setTasks);
    });

    // ===== Lösung =====
    if (showSol) {
      page = pdf.addPage([PT.pageW, PT.pageH]); ctx = makeCtx(page, fonts);
      y = drawHeader(ctx, opts, 'L\u00f6sung');
      let snr = 1;
      const allTasks = [];
      taskSets.forEach(set => set.forEach(t => allTasks.push(t)));
      const groups = { fix:[], find:[], pair:[] };
      allTasks.forEach(t=>{ if(groups[t.type]) groups[t.type].push(t); });
      const allSol = [];
      groups.fix.forEach(t=> allSol.push(solStr(t.sent)));
      groups.find.forEach(t=> allSol.push(solStr(t.sent)));
      groups.pair.forEach(t=> allSol.push([{t:(t.cap?uc(t.word):lc(t.word)), u:true}, ...(t.note?[{t:' ('+t.note+')', u:false, note:true}]:[])]));
      allSol.forEach(seg=>{
        ensure(fs*1.8);
        // Nummer
        ctx.text(snr+'.', PT.marginX, y, { font:fonts.regular, size:fs, color:C.gray });
        let x = PT.marginX + 16;
        seg.forEach(part=>{
          const c = part.note ? C.note : (part.u ? C.sol : C.ink);
          const f = part.note ? fonts.regular : fonts.bold;
          const sz = part.note ? 8 : fs;
          ctx.text(part.t, x, y, { font:f, size:sz, color:c });
          const wd = ctx.textWidth(part.t, f, sz);
          if (part.u) ctx.line(x, y+fs+1, x+wd, y+fs+1, { color:C.sol, w:1 });
          x += wd + 4;
        });
        y += fs*1.8;
        snr++;
      });
    }

    return await pdf.save();

    // Lösungssatz als Segmente (Nomen rot+unterstrichen)
    function solStr(sent){
      return sent.map(t=>{
        const w=t[0];
        const isN = (t[1]==='S'||t[1]==='N'||t[1]==='X');
        return { t: isN?uc(w):lc(w), u: isN };
      });
    }
  }

  global.GrossKleinPDF = { PT, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
