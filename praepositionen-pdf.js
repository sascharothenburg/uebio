/* =====================================================================
   praepositionen-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   English Prepositions als PDF -> identisch iOS/Android.
   Zwei Aufgabentypen:
     choice – Multiple Choice (3 Optionen, richtige einkreisen) + gezeichnete Szene
     gap    – Lückensatz (Wort selbst schreiben) + gezeichnete Szene

   Szene: eine Kiste mit zwei "Füßchen" (Lücke darunter) + ein Ball,
   je nach Präposition unterschiedlich positioniert/verdeckt gezeichnet.

   spec: {
     tasks: [ {type, rel, ...} ],
     showBank: bool,      // Wortbank (7 Wörter EN-DE) am Seitenanfang
     showSol: bool,
     lineStyle: '0'|'1'|'2'|'3'
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
    blankLn:  rgb01(0x55, 0x55, 0x55),
    box:      rgb01(0xfb, 0xbf, 0x24),
    boxBd:    rgb01(0x92, 0x40, 0x0e),
    ball:     rgb01(0x38, 0xbd, 0xf8),
    ballBd:   rgb01(0x03, 0x69, 0xa1),
    apple:    rgb01(0xdc, 0x26, 0x26),
    appleBd:  rgb01(0x99, 0x1b, 0x1b),
    leaf:     rgb01(0x16, 0xa3, 0x4a),
    stem:     rgb01(0x78, 0x35, 0x0f),
    star:     rgb01(0xf4, 0x72, 0xb6),
    starBd:   rgb01(0xbe, 0x18, 0x5d),
    book:     rgb01(0x0d, 0x94, 0x88),
    bookBd:   rgb01(0x0f, 0x5c, 0x54),
    block:    rgb01(0x7c, 0x3a, 0xed),
    blockBd:  rgb01(0x5b, 0x21, 0xb6),
    ground:   rgb01(0xb0, 0xb0, 0xb0),
    solGreen: rgb01(0x16, 0xa3, 0x4a),
  };
  function rgb01(r, g, b) { return { r: r / 255, g: g / 255, b: b / 255 }; }
  function col(c) { return c ? global.PDFLib.rgb(c.r, c.g, c.b) : undefined; }

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) { o = o || {}; page.drawRectangle({ x, y: PT.pageH - yTop - h, width: w, height: h, color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0, opacity: o.opacity }); },
      circle(cx, cyTop, r, o) { o = o || {}; page.drawEllipse({ x: cx, y: PT.pageH - cyTop, xScale: r, yScale: r, color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0 }); },
      line(x1, y1, x2, y2, o) { o = o || {}; page.drawLine({ start: { x: x1, y: PT.pageH - y1 }, end: { x: x2, y: PT.pageH - y2 }, thickness: o.w || 1, color: col(o.color) || col(C.ink), dashArray: o.dash }); },
      text(str, x, yTop, o) { o = o || {}; const f = o.font || fonts.regular; const size = o.size || 10; const asc = f.heightAtSize(size) * 0.76; page.drawText(String(str), { x, y: PT.pageH - yTop - asc, size, font: f, color: col(o.color) || col(C.ink) }); },
      textCentered(str, cx, yTop, o) { o = o || {}; const f = o.font || fonts.regular; const size = o.size || 10; const w = f.widthOfTextAtSize(String(str), size); this.text(str, cx - w / 2, yTop, o); },
      textWidth(str, font, size) { return (font || fonts.regular).widthOfTextAtSize(String(str), size); },
      path(pathData, cx, cyTop, o) { o = o || {}; page.drawSvgPath(pathData, { x: cx, y: PT.pageH - cyTop, scale: o.scale || 1, color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0 }); },
      fonts,
    };
  }

  function drawHeader(ctx, opts, sub) {
    const F = ctx.fonts; const top = PT.marginY;
    ctx.text('English Prepositions', PT.marginX, top, { font: F.heavy, size: 13, color: C.purple2 });
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
    // style '2' (Standard): Hilfslinie (gestrichelt) + Grundlinie (durchgezogen), 3.5mm Abstand
    const hilfsY = yTop + BAND1, grundY = hilfsY + BAND1;
    ctx.line(x, hilfsY, x2, hilfsY, { color: rgb01(0x93, 0xc5, 0xfd), w: 1, dash: [3, 2] });
    ctx.line(x, grundY, x2, grundY, { color: rgb01(0x1d, 0x4e, 0xd8), w: 2 });
    return grundY - yTop + 2.4 * MM;
  }

  const STAR_PATH = 'M 0,-20 L 5.9,-6.2 L 20,-6.2 L 8.9,2.4 L 12.9,17.6 L 0,8 L -12.9,17.6 L -8.9,2.4 L -20,-6.2 L -5.9,-6.2 Z';

  function drawItem(ctx, itemId, cx, cyCenter, size) {
    const r = size / 2;
    if (itemId === 'apple') {
      ctx.circle(cx, cyCenter + r * 0.1, r * 0.82, { fill: C.apple, stroke: C.appleBd, strokeWidth: 1.2 });
      ctx.rect(cx - r * 0.07, cyCenter - r * 0.95, r * 0.14, r * 0.35, { fill: C.stem });
      ctx.circle(cx + r * 0.32, cyCenter - r * 0.72, r * 0.26, { fill: C.leaf, stroke: C.appleBd, strokeWidth: 0.6 });
      return;
    }
    if (itemId === 'star') {
      ctx.path(STAR_PATH, cx, cyCenter, { scale: size / 40, fill: C.star, stroke: C.starBd, strokeWidth: 1 });
      return;
    }
    if (itemId === 'book') {
      ctx.rect(cx - r * 0.85, cyCenter - r * 0.68, r * 1.7, r * 1.36, { fill: C.book, stroke: C.bookBd, strokeWidth: 1.3 });
      ctx.line(cx, cyCenter - r * 0.68, cx, cyCenter + r * 0.68, { color: C.bookBd, w: 1.4 });
      ctx.line(cx - r * 0.55, cyCenter - r * 0.28, cx - r * 0.15, cyCenter - r * 0.28, { color: rgb01(0xff, 0xff, 0xff), w: 1 });
      ctx.line(cx - r * 0.55, cyCenter + r * 0.02, cx - r * 0.15, cyCenter + r * 0.02, { color: rgb01(0xff, 0xff, 0xff), w: 1 });
      ctx.line(cx + r * 0.15, cyCenter - r * 0.28, cx + r * 0.55, cyCenter - r * 0.28, { color: rgb01(0xff, 0xff, 0xff), w: 1 });
      ctx.line(cx + r * 0.15, cyCenter + r * 0.02, cx + r * 0.55, cyCenter + r * 0.02, { color: rgb01(0xff, 0xff, 0xff), w: 1 });
      return;
    }
    if (itemId === 'block') {
      ctx.rect(cx - r * 0.75, cyCenter - r * 0.75, r * 1.5, r * 1.5, { fill: C.block, stroke: C.blockBd, strokeWidth: 1.3 });
      ctx.line(cx - r * 0.75, cyCenter - r * 0.15, cx + r * 0.75, cyCenter - r * 0.15, { color: C.blockBd, w: 1 });
      ctx.line(cx - r * 0.15, cyCenter - r * 0.75, cx - r * 0.15, cyCenter + r * 0.75, { color: C.blockBd, w: 1 });
      return;
    }
    // Standard: Ball
    ctx.circle(cx, cyCenter, r, { fill: C.ball, stroke: C.ballBd, strokeWidth: 1.2 });
    ctx.circle(cx - r * 0.35, cyCenter - r * 0.35, r * 0.3, { fill: rgb01(0xff, 0xff, 0xff) });
  }

  // ---------- Szene: Kiste (mit Füßchen) + Gegenstand, je nach Präposition ----------
  // Frame: quadratisch, S = Kantenlänge in pt. x,yTop = linke obere Ecke.
  function drawScene(ctx, x, yTop, S, relId, itemId) {
    const feetW = 0.07 * S, feetH = 0.06 * S;
    const boxW = 0.46 * S, boxH = 0.26 * S;
    const IR = 0.13 * S; // halbe Gegenstandsgröße
    const ground = yTop + 0.88 * S;
    ctx.line(x + 0.03 * S, ground, x + 0.97 * S, ground, { color: C.ground, w: 1 });

    function drawBox(bx, bw, filled) {
      const by = ground - feetH - boxH;
      if (filled) {
        ctx.rect(bx, by, bw, boxH, { fill: C.box, stroke: C.boxBd, strokeWidth: 1.3 });
        ctx.line(bx, by + boxH * 0.32, bx + bw, by + boxH * 0.32, { color: C.boxBd, w: 1 });
      } else {
        ctx.line(bx, by, bx, by + boxH, { color: C.boxBd, w: 1.4 });
        ctx.line(bx + bw, by, bx + bw, by + boxH, { color: C.boxBd, w: 1.4 });
        ctx.line(bx, by + boxH, bx + bw, by + boxH, { color: C.boxBd, w: 1.4 });
        ctx.line(bx, by, bx + bw, by, { color: C.boxBd, w: 1, dash: [2, 2] });
      }
      ctx.rect(bx + 0.05 * bw, ground - feetH, feetW, feetH, { fill: C.boxBd });
      ctx.rect(bx + bw - 0.05 * bw - feetW, ground - feetH, feetW, feetH, { fill: C.boxBd });
      return by;
    }
    function drawItemAt(cx, cyCenter, scale) {
      drawItem(ctx, itemId, cx, cyCenter, IR * 2 * (scale || 1));
    }

    if (relId === 'between') {
      const bw = 0.382 * S;                 // breite Kisten
      const itemS = 0.16 * S;               // kleinerer Gegenstand, damit die Lücke eng bleibt
      const gap = itemS * 1.1;
      const bx1 = x + (S - (bw * 2 + gap)) / 2, bx2 = bx1 + bw + gap;
      drawBox(bx1, bw, true); drawBox(bx2, bw, true);
      drawItemAt(bx1 + bw + gap / 2, ground - itemS / 2, itemS / (IR * 2));
      return;
    }

    let bx = x + 0.27 * S;
    if (relId === 'next_to') bx = x + 0.14 * S;

    if (relId === 'in') {
      const by = drawBox(bx, boxW, false);
      drawItemAt(bx + boxW / 2, by + boxH * 0.6, 0.92);
      return;
    }

    const by = drawBox(bx, boxW, true);

    if (relId === 'on') { drawItemAt(bx + boxW / 2, by - IR * 0.95, 1); return; }
    if (relId === 'under') { drawItemAt(bx + boxW / 2, ground - feetH * 0.5, 0.82); return; }
    if (relId === 'next_to') { drawItemAt(bx + boxW + IR * 1.15, ground - IR, 1); return; }
    if (relId === 'behind') { drawItemAt(bx + boxW - IR * 0.2, by - IR * 0.15, 0.9); drawBox(bx, boxW, true); return; }
    if (relId === 'in_front_of') { drawItemAt(bx + boxW * 0.5, ground - IR * 0.55, 1.2); return; }
  }

  function sentenceFor(rel, item) {
    const subj = 'The ' + (item ? item.en : 'ball') + ' is ';
    if (rel.id === 'between') return { pre: subj, gap: rel.en, post: ' the two boxes.' };
    return { pre: subj, gap: rel.en, post: ' the box.' };
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
    const bottom = PT.pageH - PT.marginY;
    const W = PT.contentW;
    const fs = 12;
    const subTop = 'Prepositions \u00b7 in / on / under / next to / behind / in front of / between';

    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let y = drawHeader(ctx, opts, subTop);
    function newPage(sub) { page = pdf.addPage([PT.pageW, PT.pageH]); ctx = makeCtx(page, fonts); y = drawHeader(ctx, opts, sub != null ? sub : subTop); }
    function ensure(h) { if (y + h > bottom) newPage(); }

    if (showBank && spec.bankRels && spec.bankRels.length) {
      const wfs = 9, padX = 3 * MM, padY = 2.4 * MM;
      const items = spec.bankRels.map(r => r.en.toUpperCase() + ' \u2013 ' + r.de);
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
    const TEXT_Y = 0.60 * S; // fixe Ankerhöhe, an Kistenmitte ausgerichtet -> keine "springende" Zeile mehr
    function taskChoice(t, n) {
      const blockH = 9.5 * 1.5 + S + 8 * MM;
      ensure(blockH);
      secHead(n, 'Look and circle.', 'Kreise die richtige Pr\u00e4position ein.');
      const sceneX = PT.marginX;
      drawScene(ctx, sceneX, y, S, t.rel.id, t.item && t.item.id);
      const tx = sceneX + S + 6 * MM;
      const tW = W - S - 6 * MM;
      const s = sentenceFor(t.rel, t.item);
      let cx = tx;
      ctx.text(s.pre, cx, y + TEXT_Y, { font: fonts.bold, size: fs, color: C.ink });
      cx += ctx.textWidth(s.pre, fonts.bold, fs);
      const bw = Math.max(30, ctx.textWidth('in front of', fonts.bold, fs) + 6);
      ctx.line(cx, y + TEXT_Y + fs * 0.95, cx + bw, y + TEXT_Y + fs * 0.95, { color: C.blankLn, w: 1.4, dash: [2, 2] });
      cx += bw + 2;
      ctx.text(s.post, cx, y + TEXT_Y, { font: fonts.bold, size: fs, color: C.ink });
      // Optionen
      let oy = y + TEXT_Y + 9 * MM;
      let ox = tx;
      const pillH = 7.5 * MM, pillFs = 10.5;
      t.options.forEach(opt => {
        const label = opt.en;
        const lw = ctx.textWidth(label, fonts.bold, pillFs);
        const pillW = lw + 7 * MM;
        ctx.rect(ox, oy, pillW, pillH, { stroke: C.purpleBd, strokeWidth: 1.3 });
        ctx.textCentered(label, ox + pillW / 2, oy + (pillH - pillFs * 0.703) / 2, { font: fonts.bold, size: pillFs, color: C.ink });
        ox += pillW + 4 * MM;
        if (ox > tx + tW - 20 * MM) { ox = tx; oy += pillH + 2.5 * MM; }
      });
      y += S + 8 * MM;
    }

    function taskGap(t, n) {
      const blockH = 9.5 * 1.5 + S + 8 * MM;
      ensure(blockH);
      secHead(n, 'Fill in the gap.', 'Schreibe die passende Pr\u00e4position.');
      const sceneX = PT.marginX;
      drawScene(ctx, sceneX, y, S, t.rel.id, t.item && t.item.id);
      const tx = sceneX + S + 6 * MM;
      const s = sentenceFor(t.rel, t.item);
      let cx = tx;
      ctx.text(s.pre, cx, y + TEXT_Y, { font: fonts.bold, size: fs, color: C.ink });
      cx += ctx.textWidth(s.pre, fonts.bold, fs);
      const bw = 26 * MM;
      ctx.line(cx, y + TEXT_Y + fs * 0.95, cx + bw, y + TEXT_Y + fs * 0.95, { color: C.blankLn, w: 1.6 });
      cx += bw + 2;
      ctx.text(s.post, cx, y + TEXT_Y, { font: fonts.bold, size: fs, color: C.ink });
      y += S + 8 * MM;
    }

    let nr = 1;
    tasks.forEach(t => {
      if (t.type === 'choice') taskChoice(t, nr);
      else taskGap(t, nr);
      nr++;
    });

    if (showSol) {
      newPage('Answers \u00b7 L\u00f6sung');
      let snr = 1;
      tasks.forEach(t => {
        ensure(9.5 * 1.5 + fs * 1.5 + 4 * MM);
        secHead(snr, 'Solution', '');
        const s = sentenceFor(t.rel, t.item);
        let tx = PT.marginX;
        ctx.text(s.pre, tx, y, { font: fonts.regular, size: fs, color: C.ink });
        tx += ctx.textWidth(s.pre, fonts.regular, fs);
        ctx.text(t.rel.en, tx, y, { font: fonts.heavy, size: fs, color: C.solGreen });
        tx += ctx.textWidth(t.rel.en, fonts.heavy, fs);
        ctx.text(s.post, tx, y, { font: fonts.regular, size: fs, color: C.ink });
        y += fs * 1.5 + 3 * MM;
        snr++;
      });
    }

    return await pdf.save();
  }

  global.PraepositionenPDF = { PT, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
