/* =====================================================================
   english-bingo-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   English Bingo als PDF -> identisch iOS/Android.
   spec: {
     cards: [ [ {en,de}, ... size*size ] , ... ],  // je Karte ein Wort-Array
     size: 3|4,
     showHelp: bool,      // deutsche Bedeutung unter dem Wort zeigen
     showCallList: bool,  // Anruferliste (Wortliste) am Ende anhängen
     diff: '3'|'4'
   }
   opts: { showName, showDate, showKl, name }
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14 * MM, marginY: 12 * MM };
  PT.contentW = PT.pageW - PT.marginX * 2;

  const C = {
    purple:   rgb01(0x7c, 0x3a, 0xed),
    purple2:  rgb01(0x6d, 0x28, 0xd9),
    purpleBg: rgb01(0xf5, 0xf3, 0xff),
    purpleBd: rgb01(0xdd, 0xd6, 0xfe),
    ink:      rgb01(0x1e, 0x1b, 0x4b),
    gray:     rgb01(0x94, 0xa3, 0xb8),
    sub:      rgb01(0x55, 0x55, 0x55),
    metaLine: rgb01(0x88, 0x88, 0x88),
    cellBd:   rgb01(0xc4, 0xb5, 0xfd),
  };
  function rgb01(r, g, b) { return { r: r / 255, g: g / 255, b: b / 255 }; }
  function col(c) { return c ? global.PDFLib.rgb(c.r, c.g, c.b) : undefined; }

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) { o = o || {}; page.drawRectangle({ x, y: PT.pageH - yTop - h, width: w, height: h, color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0 }); },
      circle(cx, cyTop, r, o) { o = o || {}; page.drawEllipse({ x: cx, y: PT.pageH - cyTop, xScale: r, yScale: r, color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0 }); },
      line(x1, y1, x2, y2, o) { o = o || {}; page.drawLine({ start: { x: x1, y: PT.pageH - y1 }, end: { x: x2, y: PT.pageH - y2 }, thickness: o.w || 1, color: col(o.color) || col(C.ink), dashArray: o.dash }); },
      text(str, x, yTop, o) { o = o || {}; const f = o.font || fonts.regular; const size = o.size || 10; const asc = f.heightAtSize(size) * 0.76; page.drawText(String(str), { x, y: PT.pageH - yTop - asc, size, font: f, color: col(o.color) || col(C.ink) }); },
      textCentered(str, cx, yTop, o) { o = o || {}; const f = o.font || fonts.regular; const size = o.size || 10; const w = f.widthOfTextAtSize(String(str), size); this.text(str, cx - w / 2, yTop, o); },
      textWidth(str, font, size) { return (font || fonts.regular).widthOfTextAtSize(String(str), size); },
      fonts,
    };
  }

  // Zeilenumbruch über verfügbare Breite (einfacher Wortumbruch)
  function wrapText(str, font, size, maxW) {
    const words = String(str).split(' ');
    const lines = [];
    let cur = '';
    words.forEach(w => {
      const test = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > maxW && cur) { lines.push(cur); cur = w; }
      else { cur = test; }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function drawHeader(ctx, opts, sub) {
    const F = ctx.fonts; const top = PT.marginY;
    ctx.text('English Bingo', PT.marginX, top, { font: F.heavy, size: 13, color: C.purple2 });
    ctx.text(sub, PT.marginX, top + 17, { font: F.regular, size: 8, color: C.sub });
    const fields = [];
    if (opts.showName) fields.push(['Name:', 90, opts.name || '']);
    if (opts.showDate) fields.push(['Datum:', 52, '']);
    if (opts.showKl) fields.push(['Klasse:', 30, '']);
    const right = PT.pageW - PT.marginX; const gap = 12, my = top + 1;
    let totalW = 0; fields.forEach(f => { totalW += ctx.textWidth(f[0], F.regular, 8) + 3 + f[1] + gap; }); totalW -= gap;
    let mx = right - totalW;
    if (fields.length) {
      fields.forEach(f => {
        const labW = ctx.textWidth(f[0], F.regular, 8);
        ctx.text(f[0], mx, my, { font: F.regular, size: 8, color: C.sub });
        const lineX = mx + labW + 3;
        ctx.line(lineX, my + 10, lineX + f[1], my + 10, { color: C.metaLine, w: 1 });
        if (f[2]) ctx.text(f[2], lineX + 3, my, { font: F.regular, size: 8, color: C.ink });
        mx = lineX + f[1] + gap;
      });
    }
    const lineY = top + 28; ctx.line(PT.marginX, lineY, PT.pageW - PT.marginX, lineY, { color: C.purple2, w: 2.5 });
    return lineY + 12;
  }

  async function buildBingoPDF(spec, opts) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      heavy: await pdf.embedFont(StandardFonts.HelveticaBold),
    };
    opts = opts || {}; spec = spec || {};
    const cards = spec.cards || [];
    const size = spec.size || 3;
    const showHelp = !!spec.showHelp;
    const diff = spec.diff || '3';
    const bottom = PT.pageH - PT.marginY;
    const W = PT.contentW;

    const subTop = (diff === '4' ? 'Year 4 \u00b7 Klasse 4 \u00b7 British English' : 'Year 3 \u00b7 Klasse 3 \u00b7 British English');

    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let y = drawHeader(ctx, opts, subTop);
    function newPage() { page = pdf.addPage([PT.pageW, PT.pageH]); ctx = makeCtx(page, fonts); y = drawHeader(ctx, opts, subTop); }
    function ensure(h) { if (y + h > bottom) { newPage(); } }

    // Zellgröße bestimmen (max ~40mm, min genug für Text)
    const maxCell = 36 * MM;
    let cell = Math.min(W / size, maxCell);
    const gridW = cell * size;
    const titleH = 9 * MM;
    const cardH = titleH + gridW + 6 * MM;

    cards.forEach((cardWords, ci) => {
      ensure(cardH);
      const gx = PT.marginX + (W - gridW) / 2;
      // Titel
      ctx.textCentered('B I N G O   \u2013   Karte ' + (ci + 1), PT.marginX + W / 2, y, { font: fonts.heavy, size: 11, color: C.purple2 });
      y += titleH;
      // Gitter
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cx = gx + c * cell, cy = y + r * cell;
          ctx.rect(cx, cy, cell, cell, { stroke: C.cellBd, strokeWidth: 1.2 });
          const w = cardWords[r * size + c] || { en: '', de: '' };
          const fs = size >= 4 ? 9 : 10.5;
          const lines = wrapText(w.en, fonts.bold, fs, cell - 5 * MM);
          const lineH = fs * 1.25;
          const blockH = lines.length * lineH + (showHelp && w.de ? fs * 0.75 + 3 : 0);
          let ty = cy + (cell - blockH) / 2;
          lines.forEach(ln => {
            ctx.textCentered(ln, cx + cell / 2, ty, { font: fonts.bold, size: fs, color: C.ink });
            ty += lineH;
          });
          if (showHelp && w.de) {
            ctx.textCentered('(' + w.de + ')', cx + cell / 2, ty + 2, { font: fonts.regular, size: fs * 0.72, color: C.gray });
          }
        }
      }
      y += gridW + 6 * MM;
    });

    if (spec.showCallList && cards.length) {
      newPage();
      ctx.text('Anruferliste \u00b7 Wortliste zum Vorlesen', PT.marginX, y, { font: fonts.heavy, size: 11, color: C.purple2 });
      y += 9 * MM;
      ctx.text('Rufe die W\u00f6rter in beliebiger Reihenfolge auf und hake sie hier ab.', PT.marginX, y, { font: fonts.regular, size: 8.5, color: C.sub });
      y += 8 * MM;
      const words = cards[0];
      const colW = W / 2;
      const rowH = 8 * MM;
      const rowsPerCol = Math.ceil(words.length / 2);
      words.forEach((w, i) => {
        const colIdx = Math.floor(i / rowsPerCol);
        const rowIdx = i % rowsPerCol;
        ensure(rowH);
        const cx = PT.marginX + colIdx * colW;
        const cy = y + rowIdx * rowH;
        ctx.circle(cx + 3 * MM, cy + rowH / 2, 2.6 * MM, { stroke: C.purple, strokeWidth: 1.3 });
        let label = w.en + (showHelp && w.de ? '  \u2013  ' + w.de : '');
        ctx.text(label, cx + 8 * MM, cy + rowH / 2 - 3.5, { font: fonts.bold, size: 10, color: C.ink });
      });
      y += rowsPerCol * rowH + 4 * MM;
    }

    return await pdf.save();
  }

  global.EnglishBingoPDF = { PT, buildBingoPDF };

})(typeof window !== 'undefined' ? window : this);
