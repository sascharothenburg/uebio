/* =====================================================================
   auslaut-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   English Words (6 Aufgabentypen, Topics, Icons) als PDF -> identisch iOS/Android.
   Vier Aufgabentypen:
     gap     – Lücke füllen (zweispaltig) + Schreiblinien
     derive  – Verlängern (Grundwort -> Linie zum Aufschreiben)
     tf      – Richtig/Falsch ankreuzen + richtiges Wort auf Linie
     sort    – Wortvorrat in zwei Auslaut-Spalten einsortieren

   Deutsch-Schema rot; Schreiblinien blau.

   spec: {
     tasks: [ {type, ...} ],   // wie in der App erzeugt
     diff: '12'|'34',
     showRule, showSol,
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
    purpleInk:rgb01(0x4c, 0x1d, 0x95),
    ink:      rgb01(0x1e, 0x1b, 0x4b),
    gray:     rgb01(0x94, 0xa3, 0xb8),
    sub:      rgb01(0x55, 0x55, 0x55),
    metaLine: rgb01(0x88, 0x88, 0x88),
    boxBd:    rgb01(0xe2, 0xe8, 0xf0),
    cellBd:   rgb01(0xcb, 0xd5, 0xe1),
    softBg:   rgb01(0xf8, 0xfa, 0xfc),
    blankLn:  rgb01(0x55, 0x55, 0x55),
    base:     rgb01(0x6d, 0x28, 0xd9),
    help:     rgb01(0xa7, 0x8b, 0xfa),
    frame:    rgb01(0xc4, 0xb5, 0xfd),
  };
  function rgb01(r, g, b) { return { r: r / 255, g: g / 255, b: b / 255 }; }
  function col(c) { return c ? global.PDFLib.rgb(c.r, c.g, c.b) : undefined; }

  const BAND1 = 3.5 * MM;  // Stil 1 & 2
  const BAND3 = 4 * MM;    // Stil 3

  function deent(s) {
    return String(s)
      .replace(/&ouml;/g, '\u00f6').replace(/&Ouml;/g, '\u00d6')
      .replace(/&auml;/g, '\u00e4').replace(/&Auml;/g, '\u00c4')
      .replace(/&uuml;/g, '\u00fc').replace(/&Uuml;/g, '\u00dc')
      .replace(/&szlig;/g, '\u00df').replace(/&amp;/g, '&');
  }

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) { o = o || {}; page.drawRectangle({ x, y: PT.pageH - yTop - h, width: w, height: h, color: col(o.fill), borderColor: col(o.stroke), borderWidth: o.strokeWidth || 0, opacity: o.opacity }); },
      line(x1, y1, x2, y2, o) { o = o || {}; page.drawLine({ start: { x: x1, y: PT.pageH - y1 }, end: { x: x2, y: PT.pageH - y2 }, thickness: o.w || 1, color: col(o.color) || col(C.ink), dashArray: o.dash }); },
      text(str, x, yTop, o) { o = o || {}; const f = o.font || fonts.regular; const size = o.size || 10; const asc = f.heightAtSize(size) * 0.76; page.drawText(String(str), { x, y: PT.pageH - yTop - asc, size, font: f, color: col(o.color) || col(C.ink) }); },
      textCentered(str, cx, yTop, o) { o = o || {}; const f = o.font || fonts.regular; const size = o.size || 10; const w = f.widthOfTextAtSize(String(str), size); this.text(str, cx - w / 2, yTop, o); },
      textWidth(str, font, size) { return (font || fonts.regular).widthOfTextAtSize(String(str), size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts, sub) {
    const F = ctx.fonts; const top = PT.marginY;
    ctx.text('English Words', PT.marginX, top, { font: F.heavy, size: 13, color: C.purple2 });
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

  function drawRuleBox(ctx, y, segs) {
    // segs: array of {t, b} text segments (b=bold) -> einzeilig umgebrochen
    const F = ctx.fonts; const size = 8.5;
    const padX = 4 * MM, padTop = 2.4 * MM;
    const innerW = PT.contentW - padX * 2;
    // Zeilen umbrechen über Segment-Worte
    const words = [];
    segs.forEach(s => { s.t.split(' ').forEach((w, i, arr) => { words.push({ w: (i < arr.length - 1 ? w + ' ' : w + ' '), b: s.b }); }); });
    const lines = [[]]; let lw = 0;
    words.forEach(o => {
      const f = o.b ? F.bold : F.regular;
      const wd = f.widthOfTextAtSize(o.w, size);
      if (lw + wd > innerW && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push(o); lw += wd;
    });
    const lineH = size * 1.32;
    const boxH = padTop * 2 + lines.length * lineH - (lineH - size);
    ctx.rect(PT.marginX, y, PT.contentW, boxH, { fill: C.purpleBg, stroke: C.purpleBd, strokeWidth: 1.5 });
    let ty = y + padTop;
    lines.forEach((ln, li) => {
      let tx = PT.marginX + padX;
      ln.forEach(o => {
        const f = o.b ? F.bold : F.regular;
        ctx.text(o.w, tx, ty, { font: f, size, color: C.purpleInk });
        tx += f.widthOfTextAtSize(o.w, size);
      });
      ty += lineH;
    });
    return y + boxH + 2.5 * MM;
  }

  // Lineatur-Zeile über volle Breite (zum Abschreiben). Gibt verbrauchte Höhe zurück.
  function drawLineRow(ctx, x, yTop, w, style) {
    const x2 = x + w;
    if (style === '0') {
      ctx.line(x, yTop + BAND1, x2, yTop + BAND1, { color: rgb01(0xaa, 0xaa, 0xaa), w: 1.4 });
      return BAND1 + 2.4 * MM;
    }
    if (style === '1') {
      const padTop = BAND1 * 2, padBot = BAND1;
      ctx.line(x, yTop + padTop, x2, yTop + padTop, { color: C.base, w: 2 });
      return padTop + padBot;
    }
    if (style === '2') {
      const padTop = BAND1, padBot = BAND1;
      ctx.line(x, yTop + padTop, x2, yTop + padTop, { color: C.help, w: 1, dash: [3, 2] });
      ctx.line(x, yTop + padTop + BAND1, x2, yTop + padTop + BAND1, { color: C.base, w: 2 });
      ctx.line(x, yTop + padTop, x, yTop + padTop + BAND1, { color: C.frame, w: 1 });
      ctx.line(x2, yTop + padTop, x2, yTop + padTop + BAND1, { color: C.frame, w: 1 });
      return padTop + BAND1 + padBot + 3 * MM;
    }
    // style 3
    const total = BAND3 * 3;
    ctx.line(x, yTop, x2, yTop, { color: C.frame, w: 1 });
    ctx.line(x, yTop + BAND3, x2, yTop + BAND3, { color: C.help, w: 1, dash: [3, 2] });
    ctx.line(x, yTop + BAND3 * 2, x2, yTop + BAND3 * 2, { color: C.base, w: 2 });
    ctx.line(x, yTop + total, x2, yTop + total, { color: C.frame, w: 1 });
    ctx.line(x, yTop, x, yTop + total, { color: C.frame, w: 1 });
    ctx.line(x2, yTop, x2, yTop + total, { color: C.frame, w: 1 });
    return total + 4 * MM;
  }

  // Inline-Schreiblinie (rechts neben Text). Höhe je Stil; gibt {w,h} zurück; zeichnet bündig zur Textgrundlinie.
  function drawInlineLine(ctx, x, baselineY, w, style) {
    // baselineY = y der Schriftgrundlinie (yTop des Textes + Schrifthöhe-ähnlich); wir setzen Grundlinie knapp darunter
    if (style === '0') {
      ctx.line(x, baselineY, x + w, baselineY, { color: rgb01(0xaa, 0xaa, 0xaa), w: 1.4 });
      return;
    }
    if (style === '1') {
      ctx.line(x, baselineY, x + w, baselineY, { color: C.base, w: 2 });
      return;
    }
    if (style === '2') {
      const top = baselineY - BAND1;
      ctx.line(x, top, x + w, top, { color: C.help, w: 1, dash: [3, 2] });
      ctx.line(x, baselineY, x + w, baselineY, { color: C.base, w: 2 });
      ctx.line(x, top, x, baselineY, { color: C.frame, w: 1 });
      ctx.line(x + w, top, x + w, baselineY, { color: C.frame, w: 1 });
      return;
    }
    // style 3
    const total = BAND3 * 3;
    const top = baselineY - total;
    ctx.line(x, top, x + w, top, { color: C.frame, w: 1 });
    ctx.line(x, top + BAND3, x + w, top + BAND3, { color: C.help, w: 1, dash: [3, 2] });
    ctx.line(x, top + BAND3 * 2, x + w, top + BAND3 * 2, { color: C.base, w: 2 });
    ctx.line(x, baselineY, x + w, baselineY, { color: C.frame, w: 1 });
    ctx.line(x, top, x, baselineY, { color: C.frame, w: 1 });
    ctx.line(x + w, top, x + w, baselineY, { color: C.frame, w: 1 });
  }

  // Höhe einer Aufgabenzeile mit Inline-Linie je Stil
  function inlineRowH(style, fs) {
    const textH = fs * 1.2;
    if (style === '0' || style === '1') return Math.max(textH, BAND1) + 4 * MM;
    if (style === '2') return Math.max(textH, BAND1) + 4 * MM;
    return Math.max(textH, BAND3 * 3) + 4 * MM;
  }

  function secHead(ctx, txt, y) {
    ctx.text(txt, PT.marginX, y, { font: ctx.fonts.bold, size: 9.5, color: C.purple2 });
    return y + 9.5 * 1.5;
  }

  function makeGap(en) {
    const letters = [];
    for (let i = 1; i < en.length; i++) { if (/[a-z]/i.test(en[i])) letters.push(i); }
    if (!letters.length) return { pre: en, gap: '', post: '', idx: -1 };
    // Position kommt aus dem Task (g), hier nur Fallback
    const idx = letters[0];
    return { pre: en.slice(0, idx), gap: en[idx], post: en.slice(idx + 1), idx };
  }

  async function buildWorksheetPDF(spec, opts, _unused) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      heavy: await pdf.embedFont(StandardFonts.HelveticaBold),
    };
    opts = opts || {}; spec = spec || {};
    const tasks = spec.tasks || [];
    const diff = spec.diff || '3';
    const showSol = !!spec.showSol;
    const showHelp = spec.showHelp !== false;
    const style = spec.lineStyle || '2';
    const icons = spec.icons || {};   // { word: pngDataUri }
    const fs = 12.5;
    const bottom = PT.pageH - PT.marginY;
    const W = PT.contentW;

    // Icons (PNG-DataURIs) einbetten -> Map word -> embedded image
    const imgCache = {};
    for (const word of Object.keys(icons)) {
      try {
        const dataUri = icons[word];
        if (!dataUri || dataUri.indexOf('data:image/png') !== 0) continue;
        const b64 = dataUri.split(',')[1];
        const bytes = b64ToBytes(b64);
        imgCache[word.toLowerCase()] = await pdf.embedPng(bytes);
      } catch (e) { /* skip bad icon */ }
    }

    const subTop = (diff === '4' ? 'Year 4 \u00b7 Klasse 4 \u00b7 British English' : 'Year 3 \u00b7 Klasse 3 \u00b7 British English');

    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let y = drawHeader(ctx, opts, subTop);
    function newPage(sub) { page = pdf.addPage([PT.pageW, PT.pageH]); ctx = makeCtx(page, fonts); y = drawHeader(ctx, opts, sub != null ? sub : subTop); }
    function ensure(h) { if (y + h > bottom) { newPage(); } }

    // Icon zeichnen (falls vorhanden); gibt verbrauchte Breite zurück (0 wenn kein Icon)
    function drawIcon(word, x, yTop, sizePt) {
      const img = imgCache[String(word).toLowerCase()];
      if (!img) return 0;
      const dim = img.scale(1);
      const ratio = dim.width / dim.height;
      let w = sizePt, h = sizePt;
      if (ratio > 1) { h = sizePt / ratio; } else { w = sizePt * ratio; }
      page.drawImage(img, { x, y: PT.pageH - yTop - h, width: w, height: h });
      return sizePt;
    }

    let nr = 1;
    tasks.forEach(t => { renderTask(t, nr); nr++; });

    if (showSol) {
      newPage('Answers \u00b7 L\u00f6sung');
      let snr = 1;
      tasks.forEach(t => { renderSolution(t, snr); snr++; });
    }

    return await pdf.save();

    // ---------- Aufgaben ----------
    function renderTask(t, n) {
      if (t.type === 'match') return taskMatch(t, n);
      if (t.type === 'write') return taskWriteGapUnscramble(t, n, 'write');
      if (t.type === 'gap') return taskWriteGapUnscramble(t, n, 'gap');
      if (t.type === 'unscramble') return taskWriteGapUnscramble(t, n, 'unscramble');
      if (t.type === 'sentence') return taskSentence(t, n);
      if (t.type === 'search') return taskSearch(t, n);
    }

    function secHead(n, txt, sub) {
      const numStr = n + '.';
      ctx.text(numStr, PT.marginX, y, { font: fonts.heavy, size: 9.5, color: C.purple2 });
      let tx = PT.marginX + 6 * MM;
      ctx.text(txt, tx, y, { font: fonts.heavy, size: 9.5, color: C.purple2 });
      tx += ctx.textWidth(txt, fonts.heavy, 9.5) + 4;
      if (sub) ctx.text(sub, tx, y + 0.5, { font: fonts.regular, size: 8, color: C.gray });
      y += 9.5 * 1.5;
    }

    function lineRow() {
      // volle Breite, je nach Stil; gibt Höhe zurück
      const used = drawLineRow(ctx, PT.marginX, y, W, style);
      y += used;
    }

    function taskMatch(t, n) {
      const k = t.en.length;
      const rowH = Math.max(fs * 1.8, (fs + 4) * 1.2);
      const blockH = 9.5 * 1.5 + k * rowH + 6 * MM;
      ensure(blockH);
      secHead(n, 'Match the words.', 'Verbinde Englisch und Deutsch.');
      const colW = W / 2;
      const yStart = y;
      // linke Spalte: Icon + en + Kreis
      t.en.forEach((x, i) => {
        const ry = yStart + i * rowH;
        let tx = PT.marginX;
        const iconW = drawIcon(x.en, tx, ry - 1, fs + 3);
        if (iconW) tx += iconW + 2 * MM;
        ctx.text(x.en, tx, ry, { font: fonts.bold, size: fs, color: C.ink });
        // Kreis am Spaltenende
        const cx = PT.marginX + colW - 8 * MM;
        ctx.page.drawEllipse({ x: cx, y: PT.pageH - ry - fs * 0.4, xScale: 2.4, yScale: 2.4, borderColor: col(C.help), borderWidth: 1.5 });
      });
      // gestrichelte Trennlinie
      ctx.line(PT.marginX + colW, yStart - 2, PT.marginX + colW, yStart + k * rowH - 2, { color: C.purpleBd, w: 1, dash: [2, 2] });
      // rechte Spalte: Kreis + de
      t.de.forEach((x, i) => {
        const ry = yStart + i * rowH;
        const cx = PT.marginX + colW + 4 * MM;
        ctx.page.drawEllipse({ x: cx, y: PT.pageH - ry - fs * 0.4, xScale: 2.4, yScale: 2.4, borderColor: col(C.help), borderWidth: 1.5 });
        ctx.text(x.de, cx + 5 * MM, ry, { font: fonts.regular, size: fs, color: C.ink });
      });
      y = yStart + k * rowH + 6 * MM;
    }

    function taskWriteGapUnscramble(t, n, kind) {
      const heads = {
        write: ['Look and write.', 'Schreibe das Wort ab.'],
        gap: ['Fill in the missing letter.', 'Erg\u00e4nze den fehlenden Buchstaben.'],
        unscramble: ['Put the letters in order.', 'Ordne die Buchstaben zum Wort.'],
      };
      const lineH = (style === '3' ? BAND3 * 3 + 4 * MM : (style === '0' ? 0 : BAND1 * 3));
      const blockH = 9.5 * 1.5 + (fs + 10) * 1.3 + lineH + 5 * MM;
      ensure(blockH);
      secHead(n, heads[kind][0], heads[kind][1]);
      // Icon + Wort/Lücke/Scramble
      const iconSize = fs + 10;
      let tx = PT.marginX;
      const iconW = drawIcon(t.en, tx, y - 1, iconSize);
      if (iconW) tx += iconW + 3 * MM;
      const baseY = y + iconSize * 0.25;
      if (kind === 'write') {
        ctx.text(t.en, tx, baseY, { font: fonts.heavy, size: fs + 2, color: C.ink });
        tx += ctx.textWidth(t.en, fonts.heavy, fs + 2) + 3 * MM;
      } else if (kind === 'gap') {
        const g = t.g || makeGap(t.en);
        ctx.text(g.pre, tx, baseY, { font: fonts.heavy, size: fs + 4, color: C.ink });
        tx += ctx.textWidth(g.pre, fonts.heavy, fs + 4) + 2;
        const bw = 12;
        ctx.line(tx, baseY + (fs + 4) * 0.95, tx + bw, baseY + (fs + 4) * 0.95, { color: C.blankLn, w: 1.6 });
        tx += bw + 2;
        ctx.text(g.post, tx, baseY, { font: fonts.heavy, size: fs + 4, color: C.ink });
        tx += ctx.textWidth(g.post, fonts.heavy, fs + 4) + 3 * MM;
      } else {
        // unscramble: scram ist "h-a-t" (mit Bindestrichen)
        ctx.text(t.scram, tx, baseY, { font: fonts.heavy, size: fs + 3, color: C.purple });
        tx += ctx.textWidth(t.scram, fonts.heavy, fs + 3) + 3 * MM;
      }
      if (showHelp && t.de) ctx.text('(' + t.de + ')', tx, baseY + 1.5, { font: fonts.regular, size: 8.5, color: C.gray });
      y += Math.max(iconSize, (fs + 10) * 0.9) + 2 * MM;
      if (style !== '0') { lineRow(); }
      y += 3 * MM;
    }

    function taskSentence(t, n) {
      const blockH = 9.5 * 1.5 + (fs + 2) * 1.5 + 5 * MM;
      ensure(blockH);
      secHead(n, 'Complete the sentence.', 'Setze das richtige Wort ein.');
      let tx = PT.marginX;
      ctx.text(t.pre, tx, y, { font: fonts.bold, size: fs + 2, color: C.ink });
      tx += ctx.textWidth(t.pre, fonts.bold, fs + 2) + 2;
      const bw = Math.max(20, (t.gap || '').length * 7 + 8);
      ctx.line(tx, y + (fs + 2) * 0.95, tx + bw, y + (fs + 2) * 0.95, { color: C.blankLn, w: 1.6 });
      tx += bw + 2;
      ctx.text(t.post, tx, y, { font: fonts.bold, size: fs + 2, color: C.ink });
      tx += ctx.textWidth(t.post, fonts.bold, fs + 2) + 3 * MM;
      if (showHelp && t.de) ctx.text('(' + t.de + ')', tx, y + 1.5, { font: fonts.regular, size: 8.5, color: C.gray });
      y += (fs + 2) * 1.5 + 4 * MM;
    }

    function taskSearch(t, n) {
      const cell = 6.5 * MM;
      const gridW = t.size * cell;
      const blockH = 9.5 * 1.5 + 12 * MM + gridW + 6 * MM;
      ensure(blockH);
      secHead(n, 'Find the words.', 'Finde die Englisch-W\u00f6rter im Gitter.');
      // Wortliste-Box
      const wfs = 9, padX = 3 * MM, padY = 2 * MM, innerW = W - padX * 2, sep = '   \u00b7   ';
      const items = t.words.map(o => o.en.toUpperCase() + (showHelp && o.de ? ' (' + o.de + ')' : ''));
      const lines = [[]]; let lw = 0;
      items.forEach(w => {
        const wd = ctx.textWidth(w, fonts.bold, wfs) + ctx.textWidth(sep, fonts.regular, wfs);
        if (lw + wd > innerW && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
        lines[lines.length - 1].push(w); lw += wd;
      });
      const lh = wfs * 1.5;
      const boxH = padY * 2 + lines.length * lh - (lh - wfs);
      ctx.rect(PT.marginX, y, W, boxH, { fill: C.purpleBg, stroke: C.purpleBd, strokeWidth: 1.2 });
      let wy = y + padY;
      lines.forEach(ln => {
        let wx = PT.marginX + padX;
        ln.forEach((w, k) => {
          ctx.text(w, wx, wy, { font: fonts.bold, size: wfs, color: C.ink });
          wx += ctx.textWidth(w, fonts.bold, wfs);
          if (k < ln.length - 1) { ctx.text(sep, wx, wy, { font: fonts.regular, size: wfs, color: C.gray }); wx += ctx.textWidth(sep, fonts.regular, wfs); }
        });
        wy += lh;
      });
      y += boxH + 3 * MM;
      // Gitter zentriert
      ensure(gridW + 2 * MM);
      const gx = PT.marginX + (W - gridW) / 2;
      const cellFs = t.size > 10 ? 9 : 10;
      for (let r = 0; r < t.size; r++) {
        for (let c = 0; c < t.size; c++) {
          const cxp = gx + c * cell, cyp = y + r * cell;
          ctx.rect(cxp, cyp, cell, cell, { stroke: C.purpleBd, strokeWidth: 0.6 });
          ctx.textCentered(t.grid[r][c], cxp + cell / 2, cyp + (cell - cellFs) / 2 - 0.5, { font: fonts.bold, size: cellFs, color: C.ink });
        }
      }
      y += gridW + 6 * MM;
    }

    // ---------- Lösungen ----------
    function renderSolution(t, n) {
      if (t.type === 'match') {
        const blockH = 9.5 * 1.5 + t.en.length * fs * 1.4 + 4 * MM;
        ensure(blockH);
        secHead(n, 'Match', '');
        t.en.forEach(x => {
          const de = t.de.filter(d => d.key === x.key)[0];
          let tx = PT.marginX;
          ctx.text(x.en, tx, y, { font: fonts.bold, size: fs, color: C.purple2 });
          tx += ctx.textWidth(x.en, fonts.bold, fs) + 4;
          ctx.text('= ' + (de ? de.de : ''), tx, y, { font: fonts.regular, size: fs, color: C.ink });
          y += fs * 1.4;
        });
        y += 3 * MM;
        return;
      }
      if (t.type === 'search') {
        ensure(9.5 * 1.5 + fs * 1.5 + 4 * MM);
        secHead(n, 'Word Search', '');
        ctx.text((t.placed || []).join(', '), PT.marginX, y, { font: fonts.bold, size: fs, color: C.purple2 });
        y += fs * 1.5 + 3 * MM;
        return;
      }
      if (t.type === 'sentence') {
        ensure(9.5 * 1.5 + (fs) * 1.5 + 4 * MM);
        secHead(n, 'Sentence', '');
        let tx = PT.marginX;
        ctx.text(t.pre, tx, y, { font: fonts.regular, size: fs, color: C.ink });
        tx += ctx.textWidth(t.pre, fonts.regular, fs);
        ctx.text(t.gap, tx, y, { font: fonts.bold, size: fs, color: C.purple2 });
        tx += ctx.textWidth(t.gap, fonts.bold, fs);
        ctx.text(t.post, tx, y, { font: fonts.regular, size: fs, color: C.ink });
        y += fs * 1.5 + 3 * MM;
        return;
      }
      // write / gap / unscramble
      ensure(9.5 * 1.5 + fs * 1.5 + 4 * MM);
      secHead(n, 'Word', '');
      let tx = PT.marginX;
      ctx.text(t.en, tx, y, { font: fonts.bold, size: fs, color: C.purple2 });
      tx += ctx.textWidth(t.en, fonts.bold, fs) + 4;
      ctx.text('\u2013 ' + (t.de || ''), tx, y, { font: fonts.regular, size: fs, color: C.ink });
      y += fs * 1.5 + 3 * MM;
    }
  }

  function b64ToBytes(b64) {
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  }

  global.EnglishPDF = { PT, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
