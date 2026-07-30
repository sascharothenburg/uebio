/* =====================================================================
   uhrzeit-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   English Clock / Telling the Time als PDF -> identisch iOS/Android.
   Analoguhr wird als Vektorgrafik gezeichnet (kein Bild noetig).

   Zwei Aufgabentypen:
     read – Uhr zeigt eine Zeit, Kind schreibt die englische Uhrzeit auf
     draw – englischer Satz vorgegeben, Kind zeichnet die Zeiger auf eine leere Uhr

   spec: {
     tasks: [ {type, hour, minute, phrase} ... ],
     showBank: bool,
     showSol: bool,
     lineStyle: '0'|'1'|'2'
   }
   opts: { showName, showDate, showKl, name }
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = { pageW: 595.28, pageH: 841.89, marginX: 14 * MM, marginY: 12 * MM };
  PT.contentW = PT.pageW - PT.marginX * 2;
  const DEG = Math.PI / 180;

  const C = {
    purple:   rgb01(0x7c, 0x3a, 0xed),
    purple2:  rgb01(0x6d, 0x28, 0xd9),
    purpleBg: rgb01(0xf5, 0xf3, 0xff),
    purpleBd: rgb01(0xdd, 0xd6, 0xfe),
    ink:      rgb01(0x1e, 0x1b, 0x4b),
    gray:     rgb01(0x94, 0xa3, 0xb8),
    sub:      rgb01(0x55, 0x55, 0x55),
    metaLine: rgb01(0x88, 0x88, 0x88),
    blankLn:  rgb01(0x55, 0x55, 0x55),
    face:     rgb01(0xff, 0xff, 0xff),
    faceBd:   rgb01(0x6d, 0x28, 0xd9),
    tick:     rgb01(0xc4, 0xb5, 0xfd),
    hourHand: rgb01(0x1e, 0x1b, 0x4b),
    minHand:  rgb01(0x7c, 0x3a, 0xed),
    solGreen: rgb01(0x16, 0xa3, 0x4a),
  };
  function rgb01(r, g, b) { return { r: r / 255, g: g / 255, b: b / 255 }; }
  function col(c) { return c ? global.PDFLib.rgb(c.r, c.g, c.b) : undefined; }

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) { o = o || {}; page.drawRectangle({ x, y: PT.pageH - yTop - h, width: w, height: h, color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0 }); },
      circle(cx, cyTop, r, o) { o = o || {}; page.drawEllipse({ x: cx, y: PT.pageH - cyTop, xScale: r, yScale: r, color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0 }); },
      line(x1, y1, x2, y2, o) { o = o || {}; page.drawLine({ start: { x: x1, y: PT.pageH - y1 }, end: { x: x2, y: PT.pageH - y2 }, thickness: o.w || 1, color: col(o.color) || col(C.ink), dashArray: o.dash, lineCap: o.round ? global.PDFLib.LineCapStyle.Round : undefined }); },
      text(str, x, yTop, o) { o = o || {}; const f = o.font || fonts.regular; const size = o.size || 10; const asc = f.heightAtSize(size) * 0.76; page.drawText(String(str), { x, y: PT.pageH - yTop - asc, size, font: f, color: col(o.color) || col(C.ink) }); },
      textCentered(str, cx, yTop, o) { o = o || {}; const f = o.font || fonts.regular; const size = o.size || 10; const w = f.widthOfTextAtSize(String(str), size); this.text(str, cx - w / 2, yTop, o); },
      textWidth(str, font, size) { return (font || fonts.regular).widthOfTextAtSize(String(str), size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts, sub) {
    const F = ctx.fonts; const top = PT.marginY;
    ctx.text('English Clock', PT.marginX, top, { font: F.heavy, size: 13, color: C.purple2 });
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

  const BAND1 = 3.5 * MM;
  function drawLineRow(ctx, x, yTop, w, style) {
    const x2 = x + w;
    if (style === '0' || !style) { ctx.line(x, yTop + BAND1, x2, yTop + BAND1, { color: rgb01(0xaa, 0xaa, 0xaa), w: 1.4 }); return BAND1 + 2.4 * MM; }
    if (style === '1') { const padTop = BAND1 * 2; ctx.line(x, yTop + padTop, x2, yTop + padTop, { color: C.purple2, w: 2 }); return padTop + BAND1; }
    const hilfsY = yTop + BAND1, grundY = hilfsY + BAND1;
    ctx.line(x, hilfsY, x2, hilfsY, { color: rgb01(0x93, 0xc5, 0xfd), w: 1, dash: [3, 2] });
    ctx.line(x, grundY, x2, grundY, { color: rgb01(0x1d, 0x4e, 0xd8), w: 2 });
    return grundY - yTop + 2.4 * MM;
  }

  // ---------- Analoguhr ----------
  // hour: 1-12, minute: 0/15/30/45. blank=true -> nur Ziffernblatt ohne Zeiger.
  function drawClock(ctx, cx, cyTopCenter, r, hour, minute, blank) {
    ctx.circle(cx, cyTopCenter, r, { fill: C.face, stroke: C.faceBd, strokeWidth: 2 });
    for (let m = 0; m < 60; m += 5) {
      const ang = m * 6 * DEG;
      const thick = (m % 15 === 0);
      const rOut = r * 0.95, rIn = r * (thick ? 0.82 : 0.88);
      const x1 = cx + rOut * Math.sin(ang), y1 = cyTopCenter - rOut * Math.cos(ang);
      const x2 = cx + rIn * Math.sin(ang), y2 = cyTopCenter - rIn * Math.cos(ang);
      ctx.line(x1, y1, x2, y2, { color: thick ? C.faceBd : C.tick, w: thick ? 1.8 : 1 });
    }
    const nfs = r * 0.24;
    for (let k = 1; k <= 12; k++) {
      const ang = k * 30 * DEG;
      const rr = r * 0.68;
      const nx = cx + rr * Math.sin(ang), ny = cyTopCenter - rr * Math.cos(ang) - nfs * 0.36;
      ctx.textCentered(String(k), nx, ny, { font: ctx.fonts.bold, size: nfs, color: C.ink });
    }
    if (!blank) {
      const hAng = ((hour % 12) * 30 + minute * 0.5) * DEG;
      const mAng = minute * 6 * DEG;
      const hLen = r * 0.5, mLen = r * 0.72;
      ctx.line(cx, cyTopCenter, cx + hLen * Math.sin(hAng), cyTopCenter - hLen * Math.cos(hAng), { color: C.hourHand, w: 3.2, round: true });
      ctx.line(cx, cyTopCenter, cx + mLen * Math.sin(mAng), cyTopCenter - mLen * Math.cos(mAng), { color: C.minHand, w: 2.2, round: true });
    }
    ctx.circle(cx, cyTopCenter, r * 0.045, { fill: C.faceBd });
  }

  async function buildWorksheetPDF(spec, opts) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      heavy: await pdf.embedFont(StandardFonts.HelveticaBold),
    };
    opts = opts || {}; spec = spec || {};
    const tasks = spec.tasks || [];
    const showSol = !!spec.showSol;
    const showBank = spec.showBank !== false;
    const style = spec.lineStyle || '1';
    const bottom = PT.pageH - PT.marginY;
    const W = PT.contentW;
    const fs = 12;
    const subTop = 'What time is it? \u00b7 o\u2019clock \u00b7 half past \u00b7 quarter past/to';

    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let y = drawHeader(ctx, opts, subTop);
    function newPage(sub) { page = pdf.addPage([PT.pageW, PT.pageH]); ctx = makeCtx(page, fonts); y = drawHeader(ctx, opts, sub != null ? sub : subTop); }
    function ensure(h) { if (y + h > bottom) newPage(); }

    if (showBank) {
      const items = ['It\u2019s ___ o\u2019clock.', 'It\u2019s half past ___.', 'It\u2019s (a) quarter past ___.', 'It\u2019s (a) quarter to ___.'];
      const wfs = 9, padX = 3 * MM, padY = 2.4 * MM;
      const sep = '     \u00b7     ';
      const innerW = W - padX * 2;
      const lines = [[]]; let lw = 0;
      items.forEach(it => {
        const wd = ctx.textWidth(it, fonts.bold, wfs) + ctx.textWidth(sep, fonts.regular, wfs);
        if (lw + wd > innerW && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
        lines[lines.length - 1].push(it); lw += wd;
      });
      const lh = wfs * 1.5;
      const boxH = padY * 2 + lines.length * lh - (lh - wfs);
      ctx.rect(PT.marginX, y, W, boxH, { fill: C.purpleBg, stroke: C.purpleBd, strokeWidth: 1.2 });
      let wy = y + padY;
      lines.forEach(ln => {
        let wx = PT.marginX + padX;
        ln.forEach((it, k) => {
          ctx.text(it, wx, wy, { font: fonts.bold, size: wfs, color: C.purple2 });
          wx += ctx.textWidth(it, fonts.bold, wfs);
          if (k < ln.length - 1) { ctx.text(sep, wx, wy, { font: fonts.regular, size: wfs, color: C.gray }); wx += ctx.textWidth(sep, fonts.regular, wfs); }
        });
        wy += lh;
      });
      y += boxH + 4 * MM;
    }

    function secHead(n, txt, sub) {
      ctx.text(n + '.', PT.marginX, y, { font: fonts.heavy, size: 9.5, color: C.purple2 });
      let tx = PT.marginX + 6 * MM;
      ctx.text(txt, tx, y, { font: fonts.heavy, size: 9.5, color: C.purple2 });
      tx += ctx.textWidth(txt, fonts.heavy, 9.5) + 4;
      if (sub) ctx.text(sub, tx, y + 0.5, { font: fonts.regular, size: 8, color: C.gray });
      y += 9.5 * 1.5;
    }

    const S = 32 * MM;
    const R = S * 0.46;

    const TEXT_Y = 0.42 * S;
    function taskRead(t, n) {
      const blockH = 9.5 * 1.5 + S + 8 * MM;
      ensure(blockH);
      secHead(n, 'Look and write.', 'Schreibe die Uhrzeit auf Englisch.');
      const cx = PT.marginX + S / 2, cyC = y + S / 2;
      drawClock(ctx, cx, cyC, R, t.hour, t.minute, false);
      const tx = PT.marginX + S + 8 * MM;
      const tW = W - S - 8 * MM;
      ctx.text('It\u2019s', tx, y + TEXT_Y, { font: fonts.bold, size: fs, color: C.ink });
      const lrW = Math.min(tW - 10, 68 * MM);
      drawLineRow(ctx, tx, y + TEXT_Y + 9 * MM, lrW, style);
      y += S + 8 * MM;
    }

    function taskDraw(t, n) {
      const blockH = 9.5 * 1.5 + S + 6 * MM;
      ensure(blockH);
      secHead(n, 'Read and draw the hands.', 'Zeichne Stunden- und Minutenzeiger ein.');
      const tx = PT.marginX;
      ctx.text('\u201c' + t.phrase + '\u201d', tx, y + TEXT_Y, { font: fonts.bold, size: fs, color: C.ink });
      const cx = PT.marginX + W - S / 2, cyC = y + S / 2;
      drawClock(ctx, cx, cyC, R, t.hour, t.minute, true);
      y += S + 6 * MM;
    }

    let nr = 1;
    tasks.forEach(t => {
      if (t.type === 'read') taskRead(t, nr); else taskDraw(t, nr);
      nr++;
    });

    if (showSol) {
      newPage('Answers \u00b7 L\u00f6sung');
      let snr = 1;
      tasks.forEach(t => {
        const blockH = 9.5 * 1.5 + 22 * MM + 4 * MM;
        ensure(blockH);
        secHead(snr, 'Solution', '');
        const cx = PT.marginX + 20 * MM, cyC = y + 20 * MM;
        drawClock(ctx, cx, cyC, 20 * MM, t.hour, t.minute, false);
        ctx.text('It\u2019s ' + t.phrase, PT.marginX + 48 * MM, y + 20 * MM - fs * 0.4, { font: fonts.heavy, size: fs, color: C.solGreen });
        y += 40 * MM + 4 * MM;
        snr++;
      });
    }

    return await pdf.save();
  }

  global.UhrzeitPDF = { PT, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
