/* =====================================================================
   wortarten-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Wortarten bestimmen als PDF -> identisch iOS/Android.
   Zwei Modi:
     sort     – Wortkasten oben + Spaltentabelle (Wortart-Spalten) mit Lineatur
     sentence – Sätze, Wörter in passender Farbe markieren
   Deutsch-Schema rot; Schreiblinien blau.

   spec: { mode:'sort'|'sentence', items:[{word,key}], sentItems:[[ [w,tag],... ]],
           keys:[wortart], showLegend, showSol, lineStyle }
   opts: { showName, showDate, showKl }
   WC-Farben werden im Modul gespiegelt.
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
    boxBd:   rgb01(0xcb,0xd5,0xe1),
    base:    rgb01(0x1d,0x4e,0xd8),
    help:    rgb01(0x93,0xc5,0xfd),
    frame:   rgb01(0x60,0xa5,0xfa),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  // Wortart-Farben (color + bg-Hintergrund)
  const WC = {
    nomen: {label:'Nomen',     abbr:'N',  color:rgb01(0x25,0x63,0xeb), bg:rgb01(0xef,0xf6,0xff)},
    verb:  {label:'Verben',    abbr:'V',  color:rgb01(0xdc,0x26,0x26), bg:rgb01(0xfe,0xf2,0xf2)},
    adj:   {label:'Adjektive', abbr:'Adj',color:rgb01(0xea,0x8a,0x00), bg:rgb01(0xff,0xf7,0xed)},
    art:   {label:'Artikel',   abbr:'Art',color:rgb01(0x16,0xa3,0x4a), bg:rgb01(0xf0,0xfd,0xf4)},
    pro:   {label:'Pronomen',  abbr:'Pro',color:rgb01(0xea,0xb3,0x08), bg:rgb01(0xfe,0xfc,0xe8)},
  };
  const BAND = 4.2 * MM;  // kompakt für Tabellenspalten

  // HTML-Entities in den Wortlisten zu echten Zeichen
  function deent(s){
    return String(s)
      .replace(/&ouml;/g,'\u00f6').replace(/&Ouml;/g,'\u00d6')
      .replace(/&auml;/g,'\u00e4').replace(/&Auml;/g,'\u00c4')
      .replace(/&uuml;/g,'\u00fc').replace(/&Uuml;/g,'\u00dc')
      .replace(/&szlig;/g,'\u00df').replace(/&amp;/g,'&');
  }

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x,yTop,w,h,o){ o=o||{}; page.drawRectangle({x,y:PT.pageH-yTop-h,width:w,height:h,color:col(o.fill),borderColor:col(o.stroke),borderWidth:o.strokeWidth||0,opacity:o.opacity}); },
      line(x1,y1,x2,y2,o){ o=o||{}; page.drawLine({start:{x:x1,y:PT.pageH-y1},end:{x:x2,y:PT.pageH-y2},thickness:o.w||1,color:col(o.color)||col(C.ink),dashArray:o.dash}); },
      text(str,x,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const asc=f.heightAtSize(size)*0.76; page.drawText(String(str),{x,y:PT.pageH-yTop-asc,size,font:f,color:col(o.color)||col(C.ink)}); },
      textCentered(str,cx,yTop,o){ o=o||{}; const f=o.font||fonts.regular; const size=o.size||10; const w=f.widthOfTextAtSize(String(str),size); this.text(str,cx-w/2,yTop,o); },
      textWidth(str,font,size){ return (font||fonts.regular).widthOfTextAtSize(String(str),size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts, sub) {
    const F=ctx.fonts; const top=PT.marginY;
    ctx.text('Wortarten bestimmen', PT.marginX, top, { font:F.heavy, size:13, color:C.red2 });
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

  function drawLegend(ctx, keys, y) {
    const F = ctx.fonts;
    let x = PT.marginX;
    keys.forEach(k=>{
      const wc = WC[k]; if(!wc) return;
      ctx.rect(x, y, 12, 12, { fill:wc.color });
      ctx.text(wc.abbr, x+16, y+1, { font:F.bold, size:9, color:C.ink });
      const aw = ctx.textWidth(wc.abbr, F.bold, 9);
      ctx.text('= '+wc.label, x+16+aw+5, y+1, { font:F.regular, size:9, color:C.ink });
      x += 16 + aw + 5 + ctx.textWidth('= '+wc.label, F.regular, 9) + 18;
      if (x > PT.marginX + PT.contentW - 70) { x = PT.marginX; y += 16; }
    });
    return y + 20;
  }

  function drawLineRow(ctx, x, yTop, w, style) {
    const x2 = x + w;
    const total = BAND*3;
    // Einheitliche Zeilenhöhe für alle Stile: Grundlinie immer im Mittelband (wie bei 3 Linien).
    if (style === '1') {
      // nur Grundlinie, an derselben Position wie bei 3 Linien (yTop+BAND*2)
      ctx.line(x+MM, yTop+BAND*2, x2-MM, yTop+BAND*2, { color:C.base, w:1.6 });
      return total + 2.8*MM;
    }
    if (style === '2') {
      // Hilfslinie + Grundlinie im selben Abstand wie bei 3 Linien (BAND), gleiche Höhe
      ctx.line(x+MM, yTop+BAND, x2-MM, yTop+BAND, { color:C.help, w:1, dash:[3,2] });
      ctx.line(x+MM, yTop+BAND*2, x2-MM, yTop+BAND*2, { color:C.base, w:1.6 });
      ctx.line(x+MM, yTop+BAND, x+MM, yTop+BAND*2, { color:C.frame, w:1 });
      ctx.line(x2-MM, yTop+BAND, x2-MM, yTop+BAND*2, { color:C.frame, w:1 });
      return total + 2.8*MM;
    }
    ctx.line(x+MM, yTop, x2-MM, yTop, { color:C.frame, w:1 });
    ctx.line(x+MM, yTop+BAND, x2-MM, yTop+BAND, { color:C.help, w:1, dash:[3,2] });
    ctx.line(x+MM, yTop+BAND*2, x2-MM, yTop+BAND*2, { color:C.base, w:1.6 });
    ctx.line(x+MM, yTop+total, x2-MM, yTop+total, { color:C.frame, w:1 });
    ctx.line(x+MM, yTop, x+MM, yTop+total, { color:C.frame, w:1 });
    ctx.line(x2-MM, yTop, x2-MM, yTop+total, { color:C.frame, w:1 });
    return total + 2.8*MM;
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
    const mode = spec.mode || 'sort';
    const keys = (spec.keys || []).filter(k=>WC[k]);
    const items = (spec.items || []).map(it=>({word:deent(it.word), key:it.key}));
    const sentItems = (spec.sentItems || []).map(s=> s.map(t=>[deent(t[0]), t[1]]));
    const showLegend = !!spec.showLegend;
    const showSol = !!spec.showSol;
    const style = spec.lineStyle || '2';
    const fs = 15;
    const bottom = PT.pageH - PT.marginY;
    const W = PT.contentW;

    const sub = mode==='sort' ? 'Sortiere die W\u00f6rter in die richtige Spalte.' : 'Markiere die W\u00f6rter in der passenden Farbe.';

    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let y = drawHeader(ctx, opts, sub);
    function ensure(h){ if (y + h > bottom) { page=pdf.addPage([PT.pageW,PT.pageH]); ctx=makeCtx(page,fonts); y=PT.marginY+4; } }

    if (showLegend && keys.length) {
      ensure(24);
      y = drawLegend(ctx, keys, y) + 4;
    }

    if (mode === 'sort') {
      const numPages = spec.numPages || 1;

      // Zeichnet einen vollständigen Sortier-Block (Wortkasten + Spaltentabelle).
      // boxWords = Wörter im Kasten dieser Seite; fillToBottom = Tabelle bis Seitenende füllen.
      function drawSortBlock(boxWords) {
        // Wortkasten
        const boxPad = 4*MM;
        const wordFs = fs;
        const gapX = 5*MM, gapY = 3*MM;
        let lines = [[]]; let lineW = 0;
        const innerW = W - boxPad*2;
        boxWords.forEach(it=>{
          const wd = ctx.textWidth(it.word, fonts.bold, wordFs);
          if (lineW + wd > innerW && lines[lines.length-1].length) { lines.push([]); lineW=0; }
          lines[lines.length-1].push({word:it.word, w:wd});
          lineW += wd + gapX;
        });
        const boxH = boxPad*2 + lines.length*(wordFs+gapY) - gapY;
        ctx.rect(PT.marginX, y, W, boxH, { stroke:C.boxBd, strokeWidth:1.5 });
        let wy = y + boxPad;
        lines.forEach(line=>{
          const totW = line.reduce((a,b)=>a+b.w,0) + gapX*(line.length-1);
          let wx = PT.marginX + (W-totW)/2;
          line.forEach(it=>{ ctx.text(it.word, wx, wy, { font:fonts.bold, size:wordFs, color:C.ink }); wx += it.w + gapX; });
          wy += wordFs+gapY;
        });
        y += boxH + 5*MM;

        // Spaltentabelle
        const colW = W / keys.length;
        const byKey = {}; keys.forEach(k=>byKey[k]=0);
        boxWords.forEach(it=>{ if(byKey[it.key]!=null) byKey[it.key]++; });
        var minPer = Math.max(6, Math.max(...keys.map(k=>byKey[k]))+1);
        const headH = 7*MM;
        var rowStep = BAND*3 + 3*MM;
        var avail = bottom - (y + headH + 2*MM);
        var fitRows = Math.floor(avail / rowStep);
        const maxPer = Math.max(minPer, fitRows);
        keys.forEach((k,i)=>{
          const wc = WC[k];
          const cx = PT.marginX + i*colW;
          ctx.rect(cx, y, colW, headH, { fill:wc.bg, stroke:wc.color, strokeWidth:1.5 });
          ctx.textCentered(wc.label, cx+colW/2, y+(headH-10)/2, { font:fonts.heavy, size:10, color:wc.color });
        });
        y += headH + 2*MM;
        for (let r = 0; r < maxPer; r++) {
          const rowH = BAND*3 + 3*MM;
          keys.forEach((k,i)=>{
            const cx = PT.marginX + i*colW;
            drawLineRow(ctx, cx, y, colW, style);
          });
          y += rowH;
        }
      }

      if (numPages >= 2) {
        // Wörter in zwei Hälften teilen; jede Seite = eigener vollständiger Block
        const half = Math.ceil(items.length / 2);
        const firstHalf = items.slice(0, half);
        const secondHalf = items.slice(half);
        drawSortBlock(firstHalf);
        // Seite 2: neue Seite mit Kopf, Legende und eigenem Block
        page = pdf.addPage([PT.pageW, PT.pageH]); ctx = makeCtx(page, fonts);
        y = drawHeader(ctx, opts, sub);
        if (showLegend && keys.length) { y = drawLegend(ctx, keys, y) + 4; }
        drawSortBlock(secondHalf);
      } else {
        drawSortBlock(items);
      }

      // Lösung
      if (showSol) {
        page=pdf.addPage([PT.pageW,PT.pageH]); ctx=makeCtx(page,fonts);
        y=drawHeader(ctx,opts,'L\u00f6sung');
        const cW = W/keys.length;
        keys.forEach((k,i)=>{
          const wc=WC[k]; const cx=PT.marginX+i*cW;
          ctx.rect(cx, y, cW, 7*MM, { fill:wc.bg, stroke:wc.color, strokeWidth:1.5 });
          ctx.textCentered(wc.label, cx+cW/2, y+(7*MM-10)/2, { font:fonts.heavy, size:10, color:wc.color });
        });
        let yy = y + 7*MM + 2*MM;
        const colWords = {}; keys.forEach(k=>colWords[k]=[]);
        items.forEach(it=>{ if(colWords[it.key]) colWords[it.key].push(it.word); });
        const maxRows = Math.max(...keys.map(k=>colWords[k].length));
        for (let r=0;r<maxRows;r++){
          keys.forEach((k,i)=>{
            const cx=PT.marginX+i*cW;
            if (colWords[k][r]) ctx.text(colWords[k][r], cx+3*MM, yy, { font:fonts.bold, size:11, color:WC[k].color });
          });
          yy += 14;
        }
      }
    } else {
      // sentence
      keys.length; // (Legende oben)
      sentItems.forEach((s,i)=>{
        const text = s.map(t=>t[0]).join(' ').replace(/ \./g,'.');
        const lines = wrapTokens(ctx, text, fonts.bold, fs, W-22);
        const blockH = lines.length*fs*2.0 + 4*MM;
        ensure(blockH);
        ctx.text((i+1)+'.', PT.marginX, y, { font:fonts.bold, size:fs, color:C.gray });
        lines.forEach((ln,li)=> ctx.text(ln, PT.marginX+22, y+li*fs*2.0, { font:fonts.bold, size:fs, color:C.ink }));
        y += lines.length*fs*2.0 + 4*MM;
      });

      if (showSol) {
        page=pdf.addPage([PT.pageW,PT.pageH]); ctx=makeCtx(page,fonts);
        y=drawHeader(ctx,opts,'L\u00f6sung');
        if (showLegend && keys.length){ y=drawLegend(ctx,keys,y)+4; }
        sentItems.forEach((s,i)=>{
          ensure(fs*2.2);
          ctx.text((i+1)+'.', PT.marginX, y, { font:fonts.bold, size:fs, color:C.gray });
          let x = PT.marginX + 22;
          s.forEach(t=>{
            const word = t[0]; const tag = t[1];
            const wc = (tag && WC[tag]) ? WC[tag] : null;
            const isPunct = word === '.';
            const draw = isPunct ? word : word;
            ctx.text(draw, x, y, { font:fonts.bold, size:fs, color: wc?wc.color:C.ink });
            const wd = ctx.textWidth(draw, fonts.bold, fs);
            if (wc) ctx.line(x, y+fs+1, x+wd, y+fs+1, { color:wc.color, w:1.2 });
            x += wd + (isPunct?2:ctx.textWidth(' ',fonts.bold,fs));
          });
          y += fs*2.2;
        });
      }
    }

    return await pdf.save();

    function wrapTokens(ctx, str, font, size, maxW){
      const words = str.split(' '); const lines=[]; let cur='';
      words.forEach(w=>{ const test=cur?cur+' '+w:w; if(font.widthOfTextAtSize(test,size)>maxW && cur){lines.push(cur);cur=w;} else cur=test; });
      if(cur) lines.push(cur); return lines;
    }
  }

  global.WortartenPDF = { PT, WC, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
