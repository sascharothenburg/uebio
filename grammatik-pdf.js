/* =====================================================================
   grammatik-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   English Grammar als PDF -> identisch iOS/Android.
   Vier Aufgabentypen (alle Multiple Choice, 2-4 Pillen zum Ankreuzen):
     tobe    – to be (am/is/are) & have got/has got
     plural  – Pluralformen (regelmäßig + unregelmäßig)
     thisthat– this/that/these/those (nah/fern, Singular/Plural, mit Mini-Szene)
     wh      – Fragewörter (What/Where/Who/When/How)

   Einheitliche, kompakte Zeilenhöhe für ALLE Modi -> verlässliche Seitenkapazität
   unabhängig davon, welche Modi kombiniert werden.

   spec: { tasks: [...], showBank: bool, showSol: bool }
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
    ball:     rgb01(0x38, 0xbd, 0xf8),
    ballBd:   rgb01(0x03, 0x69, 0xa1),
    apple:    rgb01(0xdc, 0x26, 0x26),
    appleBd:  rgb01(0x99, 0x1b, 0x1b),
    leaf:     rgb01(0x16, 0xa3, 0x4a),
    star:     rgb01(0xf4, 0x72, 0xb6),
    starBd:   rgb01(0xbe, 0x18, 0x5d),
    eyeBd:    rgb01(0x1e, 0x1b, 0x4b),
    ground:   rgb01(0xb0, 0xb0, 0xb0),
    solGreen: rgb01(0x16, 0xa3, 0x4a),
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
      image(img, cx, cyTopCenter, size) { if (!img) return; page.drawImage(img, { x: cx - size / 2, y: PT.pageH - cyTopCenter - size / 2, width: size, height: size }); },
      path(pathData, cx, cyTop, o) { o = o || {}; page.drawSvgPath(pathData, { x: cx, y: PT.pageH - cyTop, scale: o.scale || 1, color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0 }); },
      fonts,
    };
  }

  function drawHeader(ctx, opts, sub) {
    const F = ctx.fonts; const top = PT.marginY;
    ctx.text('English Grammar', PT.marginX, top, { font: F.heavy, size: 13, color: C.purple2 });
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

  const STAR_PATH = 'M 0,-20 L 5.9,-6.2 L 20,-6.2 L 8.9,2.4 L 12.9,17.6 L 0,8 L -12.9,17.6 L -8.9,2.4 L -20,-6.2 L -5.9,-6.2 Z';
  function drawTinyItem(ctx, imgCache, itemId, cx, cyCenter, size) {
    const img = imgCache && imgCache[itemId];
    if (img) { ctx.image(img, cx, cyCenter, size); return; }
    const r = size / 2;
    if (itemId === 'apple') {
      ctx.circle(cx, cyCenter + r * 0.1, r * 0.82, { fill: C.apple, stroke: C.appleBd, strokeWidth: 1 });
      ctx.circle(cx + r * 0.3, cyCenter - r * 0.7, r * 0.24, { fill: C.leaf });
      return;
    }
    if (itemId === 'star') { ctx.path(STAR_PATH, cx, cyCenter, { scale: size / 40, fill: C.star, stroke: C.starBd, strokeWidth: 0.8 }); return; }
    ctx.circle(cx, cyCenter, r, { fill: C.ball, stroke: C.ballBd, strokeWidth: 1 });
    ctx.circle(cx - r * 0.35, cyCenter - r * 0.35, r * 0.28, { fill: rgb01(0xff, 0xff, 0xff) });
  }

  async function embedItemIcons(pdf, icons, tasks) {
    const need = {}; tasks.forEach(t => { if (t.type === 'thisthat' && t.itemId) need[t.itemId] = 1; });
    const cache = {};
    for (const id of Object.keys(need)) {
      if (icons && icons[id]) { try { cache[id] = await pdf.embedPng(icons[id]); } catch (e) { /* ignore, fallback to vector */ } }
    }
    return cache;
  }

  // "this/that"-Mini-Szene: nur Gegenstand/Gegenstände, einheitliche Größe.
  // Nah/Fern wird per Beschriftung (here / over there) unterschieden - nicht per Größe,
  // damit die Icons in allen Aufgaben konsistent gleich groß erscheinen.
  function drawThisThatScene(ctx, imgCache, x, yTop, W, H, near, plural, itemId) {
    const ICON = 16 * MM;              // feste Icongröße für ALLE Fälle
    const capFs = 8.4;
    const cxMid = x + W / 2;
    const iconCy = yTop + 1 * MM + ICON / 2;

    if (plural) {
      const gap = ICON * 1.0;
      drawTinyItem(ctx, imgCache, itemId, cxMid - gap / 2, iconCy, ICON);
      drawTinyItem(ctx, imgCache, itemId, cxMid + gap / 2, iconCy, ICON);
    } else {
      drawTinyItem(ctx, imgCache, itemId, cxMid, iconCy, ICON);
    }

    const caption = near ? 'here' : 'over there';
    ctx.textCentered(caption, cxMid, iconCy + ICON / 2 + 1.6 * MM, { font: ctx.fonts.bold, size: capFs, color: C.purple2 });
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
    const fs = 11.5;
    const subTop = 'to be \u00b7 have got \u00b7 plural \u00b7 this/that/these/those \u00b7 Wh-questions';

    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let y = drawHeader(ctx, opts, subTop);
    function newPage(sub) { page = pdf.addPage([PT.pageW, PT.pageH]); ctx = makeCtx(page, fonts); y = drawHeader(ctx, opts, sub != null ? sub : subTop); }
    function ensure(h) { if (y + h > bottom) newPage(); }

    const BANKS = {
      tobe:     { items: ['am / is / are', 'have got / has got'],
                  merk: 'Merke:  I -> am   \u00b7   he / she / it und 1 Person oder Ding -> is   \u00b7   you / we / they und mehrere -> are   \u00b7   he / she / it -> has got, sonst have got' },
      plural:   { items: ['cat -> cats', 'box -> boxes', 'baby -> babies', 'child -> children'],
                  merk: 'Merke:  meist + s   \u00b7   nach s, x, ch, sh, o + es   \u00b7   Mitlaut + y wird zu ies   \u00b7   Ausnahmen einfach merken: child, mouse, foot, man, woman, tooth' },
      thisthat: { items: ['this / that / these / those'],
                  merk: 'Merke:  hier = this (1 Ding) / these (mehrere)   \u00b7   da dr\u00fcben = that (1 Ding) / those (mehrere)   \u00b7   i, e = nah   a, o = fern' },
      wh:       { items: ['what \u00b7 where \u00b7 who \u00b7 when \u00b7 how'],
                  merk: 'Merke:  What = Was   \u00b7   Where = Wo   \u00b7   Who = Wer   \u00b7   When = Wann   \u00b7   How = Wie' },
    };

    if (showBank) {
      const bank = BANKS[spec.mode] || BANKS.tobe;
      const items = bank.items;
      const wfs = 8.6, padX = 3 * MM, padY = 2.2 * MM;
      const sep = '     \u00b7     ';
      const innerW = W - padX * 2;
      const lines = [[]]; let lw = 0;
      items.forEach(it => {
        const wd = ctx.textWidth(it, fonts.bold, wfs) + ctx.textWidth(sep, fonts.regular, wfs);
        if (lw + wd > innerW && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
        lines[lines.length - 1].push(it); lw += wd;
      });
      const lh = wfs * 1.5;
      const mfs = 8.2;
      const merkLines = [];
      {
        const words = bank.merk.split(' ');
        let cur = '';
        words.forEach(wd => {
          const test = cur ? cur + ' ' + wd : wd;
          if (ctx.textWidth(test, fonts.regular, mfs) > innerW && cur) { merkLines.push(cur); cur = wd; }
          else cur = test;
        });
        if (cur) merkLines.push(cur);
      }
      const boxH = padY * 2 + lines.length * lh + merkLines.length * (mfs * 1.5) - (lh - wfs);
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
      merkLines.forEach(ml => { ctx.text(ml, PT.marginX + padX, wy + 1, { font: fonts.regular, size: mfs, color: C.sub }); wy += mfs * 1.5; });
      y += boxH + 4 * MM;
    }

    const ROWH = 28 * MM;      // einheitliche Zeilenhöhe für ALLE Aufgabentypen
    const SCENE_W = 34 * MM;   // Breite der Mini-Szene bei this/that
    const PILL_H = 7.2 * MM, PILL_FS = 10.3;
    const imgCache = await embedItemIcons(pdf, spec.icons, tasks);

    function drawPills(options, tx, tW, oy) {
      let ox = tx;
      options.forEach(opt => {
        const lw = ctx.textWidth(opt, fonts.bold, PILL_FS);
        const pillW = lw + 7 * MM;
        if (ox + pillW > tx + tW && ox > tx) { ox = tx; oy += PILL_H + 2.2 * MM; }
        ctx.rect(ox, oy, pillW, PILL_H, { stroke: C.purpleBd, strokeWidth: 1.3 });
        ctx.textCentered(opt, ox + pillW / 2, oy + (PILL_H - PILL_FS * 0.703) / 2, { font: fonts.bold, size: PILL_FS, color: C.ink });
        ox += pillW + 3.5 * MM;
      });
    }

    function taskRow(t, n) {
      ensure(ROWH);
      const topY = y;
      ctx.text(n + '.', PT.marginX, topY, { font: fonts.heavy, size: 9, color: C.purple2 });
      const bodyX = PT.marginX + 6 * MM;
      let tx = bodyX, tW = W - 6 * MM;

      if (t.type === 'thisthat') {
        drawThisThatScene(ctx, imgCache, bodyX, topY - 2, SCENE_W, ROWH - 2 * MM, t.near, t.plural, t.itemId);
        tx = bodyX + SCENE_W + 5 * MM; tW = W - 6 * MM - SCENE_W - 5 * MM;
      }

      const sentY = topY + 1;
      let cx = tx;
      ctx.text(t.pre, cx, sentY, { font: fonts.bold, size: fs, color: C.ink });
      cx += ctx.textWidth(t.pre, fonts.bold, fs);
      const bw = Math.max(24 * MM, ctx.textWidth('have got', fonts.bold, fs) + 6);
      ctx.line(cx, sentY + fs * 0.95, cx + bw, sentY + fs * 0.95, { color: C.blankLn, w: 1.4, dash: [2, 2] });
      cx += bw + 2;
      if (t.post) ctx.text(t.post, cx, sentY, { font: fonts.bold, size: fs, color: C.ink });

      drawPills(t.options, tx, tW, sentY + 9.5 * MM);
      y += ROWH;
    }

    let nr = 1;
    tasks.forEach(t => { taskRow(t, nr); nr++; });

    if (showSol) {
      newPage('Answers \u00b7 L\u00f6sung');
      let snr = 1;
      tasks.forEach(t => {
        ensure(fs * 1.5 + 3 * MM);
        ctx.text(snr + '.', PT.marginX, y, { font: fonts.heavy, size: 9, color: C.purple2 });
        let tx = PT.marginX + 6 * MM;
        const sol = (!t.pre || !t.pre.trim()) ? t.correct.charAt(0).toUpperCase() + t.correct.slice(1) : t.correct;
        ctx.text(t.pre, tx, y, { font: fonts.regular, size: fs, color: C.ink });
        tx += ctx.textWidth(t.pre, fonts.regular, fs);
        ctx.text(sol, tx, y, { font: fonts.heavy, size: fs, color: C.solGreen });
        tx += ctx.textWidth(sol, fonts.heavy, fs);
        if (t.post) ctx.text(t.post, tx, y, { font: fonts.regular, size: fs, color: C.ink });
        y += fs * 1.5 + 3 * MM;
        snr++;
      });
    }

    return await pdf.save();
  }

  global.GrammatikPDF = { PT, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
