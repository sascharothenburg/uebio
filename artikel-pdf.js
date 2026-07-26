/* =====================================================================
   artikel-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Artikel zuordnen (der/die/das) als PDF -> identisch iOS/Android.
   Jede Seite mischt automatisch alle vier Aufgabentypen (keine Auswahl mehr):
     gap    – Lücke vor dem Nomen füllen (der/die/das) + Schreiblinien
     sort   – Wortvorrat in drei Artikel-Spalten einsortieren
     check  – Richtigen Artikel ankreuzen
     fix    – Falsche Artikel erkennen & auf Linie richtig schreiben

   Deutsch-Schema rot; Schreiblinien blau.

   spec: {
     taskSets: [ [ {type,...}, ... ], ... ],  // ein gemischtes Set pro Seite
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
    red:      rgb01(0xb9, 0x1c, 0x1c),
    red2:     rgb01(0xdc, 0x26, 0x26),
    redBg:    rgb01(0xfe, 0xf2, 0xf2),
    redBd:    rgb01(0xfe, 0xca, 0xca),
    redInk:   rgb01(0x7f, 0x1d, 0x1d),
    ink:      rgb01(0x1e, 0x1b, 0x4b),
    gray:     rgb01(0x94, 0xa3, 0xb8),
    sub:      rgb01(0x55, 0x55, 0x55),
    metaLine: rgb01(0x88, 0x88, 0x88),
    boxBd:    rgb01(0xe2, 0xe8, 0xf0),
    cellBd:   rgb01(0xcb, 0xd5, 0xe1),
    softBg:   rgb01(0xf8, 0xfa, 0xfc),
    blankLn:  rgb01(0x55, 0x55, 0x55),
    base:     rgb01(0x1d, 0x4e, 0xd8),
    help:     rgb01(0x93, 0xc5, 0xfd),
    frame:    rgb01(0x60, 0xa5, 0xfa),
  };
  function rgb01(r, g, b) { return { r: r / 255, g: g / 255, b: b / 255 }; }
  function col(c) { return c ? global.PDFLib.rgb(c.r, c.g, c.b) : undefined; }

  const BAND2 = 3.5 * MM;
  const B3_TOP = 4 * MM;
  const B3_MID = 5 * MM;
  const B3_BOT = 4 * MM;
  const B3_TOTAL = B3_TOP + B3_MID + B3_BOT;

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
      ascHeight(size, font) { return (font || fonts.regular).heightAtSize(size) * 0.76; },
      textBaseline(str, x, baseY, o) { o = o || {}; const f = o.font || fonts.regular; const size = o.size || 10; const asc = f.heightAtSize(size) * 0.76; this.text(str, x, baseY - asc, o); },
      textCentered(str, cx, yTop, o) { o = o || {}; const f = o.font || fonts.regular; const size = o.size || 10; const w = f.widthOfTextAtSize(String(str), size); this.text(str, cx - w / 2, yTop, o); },
      textWidth(str, font, size) { return (font || fonts.regular).widthOfTextAtSize(String(str), size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts, sub) {
    const F = ctx.fonts; const top = PT.marginY;
    ctx.text('Artikel zuordnen', PT.marginX, top, { font: F.heavy, size: 13, color: C.red2 });
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
    const lineY = top + 28; ctx.line(PT.marginX, lineY, PT.pageW - PT.marginX, lineY, { color: C.red2, w: 2.5 });
    return lineY + 12;
  }

  function drawRuleBox(ctx, y, segs) {
    const F = ctx.fonts; const size = 8.5;
    const padX = 4 * MM, padTop = 2.4 * MM;
    const innerW = PT.contentW - padX * 2;
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
    ctx.rect(PT.marginX, y, PT.contentW, boxH, { fill: C.redBg, stroke: C.redBd, strokeWidth: 1.5 });
    let ty = y + padTop;
    lines.forEach((ln) => {
      let tx = PT.marginX + padX;
      ln.forEach(o => {
        const f = o.b ? F.bold : F.regular;
        ctx.text(o.w, tx, ty, { font: f, size, color: C.redInk });
        tx += f.widthOfTextAtSize(o.w, size);
      });
      ty += lineH;
    });
    return y + boxH + 2.5 * MM;
  }

  function drawLineRow(ctx, x, yTop, w, style) {
    const x2 = x + w;
    if (style === '0') {
      ctx.line(x, yTop + B3_MID, x2, yTop + B3_MID, { color: rgb01(0xaa, 0xaa, 0xaa), w: 1.4 });
      return B3_MID + 2.4 * MM;
    }
    if (style === '1') {
      const padTop = B3_TOP + B3_MID, padBot = B3_BOT;
      ctx.line(x, yTop + padTop, x2, yTop + padTop, { color: C.base, w: 2 });
      return padTop + padBot;
    }
    if (style === '2') {
      const padTop = B3_TOP;
      ctx.line(x, yTop + padTop, x2, yTop + padTop, { color: C.help, w: 1, dash: [3, 2] });
      ctx.line(x, yTop + padTop + BAND2, x2, yTop + padTop + BAND2, { color: C.base, w: 2 });
      ctx.line(x, yTop + padTop, x, yTop + padTop + BAND2, { color: C.frame, w: 1 });
      ctx.line(x2, yTop + padTop, x2, yTop + padTop + BAND2, { color: C.frame, w: 1 });
      return padTop + BAND2 + B3_BOT + 2 * MM;
    }
    ctx.line(x, yTop, x2, yTop, { color: C.frame, w: 1 });
    ctx.line(x, yTop + B3_TOP, x2, yTop + B3_TOP, { color: C.help, w: 1, dash: [3, 2] });
    ctx.line(x, yTop + B3_TOP + B3_MID, x2, yTop + B3_TOP + B3_MID, { color: C.base, w: 2 });
    ctx.line(x, yTop + B3_TOTAL, x2, yTop + B3_TOTAL, { color: C.frame, w: 1 });
    ctx.line(x, yTop, x, yTop + B3_TOTAL, { color: C.frame, w: 1 });
    ctx.line(x2, yTop, x2, yTop + B3_TOTAL, { color: C.frame, w: 1 });
    return B3_TOTAL + 4 * MM;
  }

  function drawInlineLine(ctx, x, baselineY, w, style) {
    if (style === '0') { ctx.line(x, baselineY, x + w, baselineY, { color: rgb01(0xaa, 0xaa, 0xaa), w: 1.4 }); return; }
    if (style === '1') { ctx.line(x, baselineY, x + w, baselineY, { color: C.base, w: 2 }); return; }
    if (style === '2') {
      const top = baselineY - BAND2;
      ctx.line(x, top, x + w, top, { color: C.help, w: 1, dash: [3, 2] });
      ctx.line(x, baselineY, x + w, baselineY, { color: C.base, w: 2 });
      ctx.line(x, top, x, baselineY, { color: C.frame, w: 1 });
      ctx.line(x + w, top, x + w, baselineY, { color: C.frame, w: 1 });
      return;
    }
    const topFrame = baselineY - B3_MID - B3_TOP;
    const helpY = baselineY - B3_MID;
    const botFrame = baselineY + B3_BOT;
    ctx.line(x, topFrame, x + w, topFrame, { color: C.frame, w: 1 });
    ctx.line(x, helpY, x + w, helpY, { color: C.help, w: 1, dash: [3, 2] });
    ctx.line(x, baselineY, x + w, baselineY, { color: C.base, w: 2 });
    ctx.line(x, botFrame, x + w, botFrame, { color: C.frame, w: 1 });
    ctx.line(x, topFrame, x, botFrame, { color: C.frame, w: 1 });
    ctx.line(x + w, topFrame, x + w, botFrame, { color: C.frame, w: 1 });
  }

  function inlineBaselineY(yTextTop) {
    return yTextTop + 1 * MM + B3_TOP + B3_MID;
  }
  function inlineRowH() {
    return 1 * MM + B3_TOP + B3_MID + B3_BOT + 1 * MM;
  }

  function secHead(ctx, txt, y) {
    ctx.text(txt, PT.marginX, y, { font: ctx.fonts.bold, size: 9.5, color: C.red2 });
    return y + 9.5 * 1.5;
  }

  // Vektor-Häkchen (kein Unicode-Glyph, da Helvetica/WinAnsi das nicht rendert)
  function drawCheck(ctx, x, yTop, size, color) {
    const x1 = x + size * 0.15, y1 = yTop + size * 0.55;
    const x2 = x + size * 0.4, y2 = yTop + size * 0.82;
    const x3 = x + size * 0.85, y3 = yTop + size * 0.15;
    ctx.line(x1, y1, x2, y2, { color, w: 1.6 });
    ctx.line(x2, y2, x3, y3, { color, w: 1.6 });
  }

  const RULE = [
    { t: 'Nomen haben immer einen Artikel:' }, { t: 'der', b: 1 }, { t: ',' }, { t: 'die', b: 1 }, { t: 'oder' }, { t: 'das', b: 1 },
    { t: '. Lerne Nomen am besten immer zusammen mit ihrem Artikel, zum Beispiel' },
    { t: 'der Hund, die Katze, das Kind', b: 1 }, { t: '.' }
  ];

  const GENDERS = ['der', 'die', 'das'];

  function groupByType(arr) {
    const g = { gap: [], sort: [], check: [], fix: [] };
    arr.forEach(t => { if (g[t.type]) g[t.type].push(t); });
    return g;
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
    const diff = spec.diff || '12';
    const showRule = !!spec.showRule;
    const showSol = !!spec.showSol;
    const style = spec.lineStyle || '2';
    const fs = 15;
    const bottom = PT.pageH - PT.marginY;
    const W = PT.contentW;

    const subTop = (diff === '34' ? 'Klasse 3\u20134' : 'Klasse 1\u20132');

    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let y = drawHeader(ctx, opts, subTop);
    function newPage(sub) { page = pdf.addPage([PT.pageW, PT.pageH]); ctx = makeCtx(page, fonts); y = drawHeader(ctx, opts, sub != null ? sub : subTop); }
    function ensure(h) { if (y + h > bottom) { newPage(); } }

    const taskSets = (spec.taskSets && spec.taskSets.length)
      ? spec.taskSets.map(set => set.map(cloneTask))
      : [(spec.tasks || []).map(cloneTask)];

    function renderTaskSet(setTasks) {
      if (showRule) { ensure(20 * MM); y = drawRuleBox(ctx, y, RULE); y += 1.5 * MM; }
      const g = groupByType(setTasks);
      if (g.gap.length) renderGap(g.gap, 1);
      if (g.sort.length) renderSort(g.sort, 1);
      if (g.check.length) renderCheck(g.check, 1);
      if (g.fix.length) renderFix(g.fix, 1);
    }

    taskSets.forEach((setTasks, si) => { if (si > 0) { newPage(); } renderTaskSet(setTasks); });

    if (showSol) {
      newPage('L\u00f6sung \u2013 Artikel zuordnen');
      const allTasks = [];
      taskSets.forEach(set => set.forEach(t => allTasks.push(t)));
      const g = groupByType(allTasks);
      if (g.gap.length) solGap(g.gap, 1);
      if (g.sort.length) solSort(g.sort, 1);
      if (g.check.length) solCheck(g.check, 1);
      if (g.fix.length) solFix(g.fix, 1);
    }

    return await pdf.save();

    // ---------- Aufgaben ----------
    function renderGap(arr, startNr) {
      y = secHead(ctx, 'Welcher Artikel passt? Schreibe der, die oder das auf die Linie.', y);
      const colW = W / 2;
      const rowH = fs * 1.7;
      for (let i = 0; i < arr.length; i += 2) {
        ensure(rowH);
        for (let c = 0; c < 2 && i + c < arr.length; c++) {
          const t = arr[i + c];
          const x = PT.marginX + c * colW;
          const baseY = y + ctx.ascHeight(fs);
          const nrStr = (startNr + i + c) + '.';
          ctx.textBaseline(nrStr, x, baseY, { font: fonts.bold, size: 9, color: C.gray });
          let tx = x + ctx.textWidth(nrStr, fonts.bold, 9) + 4;
          const blankW = 34;
          ctx.line(tx, baseY, tx + blankW, baseY, { color: C.blankLn, w: 1.6 });
          tx += blankW + 5;
          ctx.textBaseline(t.word, tx, baseY, { font: fonts.bold, size: fs, color: C.ink });
        }
        y += rowH;
      }
      if (style !== '0') {
        y += 1 * MM;
        ensure(6 * MM);
        ctx.text('Schreibe die W\u00f6rter mit Artikel auf die Linien:', PT.marginX, y, { font: fonts.regular, size: 7.5, color: C.gray });
        y += 4 * MM;
        const rows = Math.max(2, Math.ceil(arr.length / 4));
        for (let r = 0; r < rows; r++) {
          const need = (style === '3' ? B3_TOTAL + 4 * MM : (style === '2' ? B3_TOP + BAND2 + B3_BOT + 2 * MM : B3_MID + B3_BOT + 2 * MM));
          ensure(need);
          y += drawLineRow(ctx, PT.marginX, y, W, style);
        }
      }
      y += 2 * MM;
      return startNr + arr.length;
    }

    function renderSort(arr, startNr) {
      arr.forEach(t => {
        const nc = t.cols.length;
        const bank = t.words.map(o => o.w);
        const tableRows = Math.ceil(t.words.length / nc) + 1;
        const blockH = 9 * 1.5 + 16 * MM + 7 * MM + tableRows * 8 * MM + 8 * MM;
        ensure(blockH);
        y = secHead(ctx, 'Ordne die W\u00f6rter dem richtigen Artikel zu.', y);
        const wfs = fs, padX = 3 * MM, padY = 2.4 * MM, innerW = W - padX * 2, sep = '   \u00b7   ';
        const lines = [[]]; let lw = 0;
        bank.forEach(w => {
          const wd = ctx.textWidth(w, fonts.bold, wfs) + ctx.textWidth(sep, fonts.regular, wfs);
          if (lw + wd > innerW && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
          lines[lines.length - 1].push(w); lw += wd;
        });
        const lineH = wfs * 1.55;
        const boxH = padY * 2 + lines.length * lineH - (lineH - wfs);
        ctx.rect(PT.marginX, y, W, boxH, { fill: C.softBg, stroke: C.boxBd, strokeWidth: 1.2 });
        let wy = y + padY;
        lines.forEach(ln => {
          let wx = PT.marginX + padX;
          ln.forEach((w, k) => {
            ctx.text(w, wx, wy, { font: fonts.bold, size: wfs, color: C.ink });
            wx += ctx.textWidth(w, fonts.bold, wfs);
            if (k < ln.length - 1) { ctx.text(sep, wx, wy, { font: fonts.regular, size: wfs, color: C.gray }); wx += ctx.textWidth(sep, fonts.regular, wfs); }
          });
          wy += lineH;
        });
        y += boxH + 3 * MM;
        const colW = W / nc, headH = 7 * MM;
        for (let cc = 0; cc < nc; cc++) {
          ctx.rect(PT.marginX + cc * colW, y, colW, headH, { fill: C.redBg, stroke: C.cellBd, strokeWidth: 1.2 });
          ctx.textCentered(t.cols[cc], PT.marginX + cc * colW + colW / 2, y + (headH - 10) / 2, { font: fonts.heavy, size: 10, color: C.red2 });
        }
        y += headH;
        const cellH = 8 * MM;
        for (let r = 0; r < tableRows; r++) {
          ensure(cellH);
          for (let cc = 0; cc < nc; cc++) ctx.rect(PT.marginX + cc * colW, y, colW, cellH, { stroke: C.cellBd, strokeWidth: 1.2 });
          y += cellH;
        }
        y += 6 * MM;
      });
      return startNr + arr.length;
    }

    function renderCheck(arr, startNr) {
      y = secHead(ctx, 'Kreuze den richtigen Artikel an.', y);
      const rowH = fs * 1.9;
      const boxSize = 10, boxGap = 5, groupGap = 10;
      for (let i = 0; i < arr.length; i++) {
        ensure(rowH);
        const t = arr[i];
        const baseY = y + ctx.ascHeight(fs);
        const nrStr = (i + startNr) + '.';
        ctx.textBaseline(nrStr, PT.marginX, baseY, { font: fonts.bold, size: 9, color: C.gray });
        let tx = PT.marginX + ctx.textWidth(nrStr, fonts.bold, 9) + 4;
        ctx.textBaseline(t.word, tx, baseY, { font: fonts.bold, size: fs, color: C.ink });
        tx += ctx.textWidth(t.word, fonts.bold, fs) + 14;
        GENDERS.forEach(g => {
          const boxY = baseY - boxSize + 1;
          ctx.rect(tx, boxY, boxSize, boxSize, { stroke: C.ink, strokeWidth: 1.2 });
          tx += boxSize + boxGap;
          ctx.textBaseline(g, tx, baseY, { font: fonts.regular, size: 9.5, color: C.sub });
          tx += ctx.textWidth(g, fonts.regular, 9.5) + groupGap;
        });
        y += rowH;
      }
      y += 2 * MM;
      return startNr + arr.length;
    }

    function renderFix(arr, startNr) {
      y = secHead(ctx, 'Manche Artikel sind falsch. Schreibe das Wortpaar richtig auf die Linie.', y);
      const colW = W / 2;
      const rowH = inlineRowH();
      for (let i = 0; i < arr.length; i += 2) {
        ensure(rowH);
        for (let c = 0; c < 2 && i + c < arr.length; c++) {
          const t = arr[i + c];
          const x = PT.marginX + c * colW;
          const baseY = inlineBaselineY(y);
          const nrStr = (startNr + i + c) + '.';
          ctx.textBaseline(nrStr, x, baseY, { font: fonts.bold, size: 9, color: C.gray });
          let tx = x + ctx.textWidth(nrStr, fonts.bold, 9) + 4;
          const phrase = t.dispArt + ' ' + t.word;
          ctx.textBaseline(phrase, tx, baseY, { font: fonts.bold, size: fs, color: C.ink });
          tx += ctx.textWidth(phrase, fonts.bold, fs) + 6;
          let lineW = colW - (tx - x) - 4;
          if (lineW < 55) lineW = 55;
          drawInlineLine(ctx, tx, baseY, lineW, style === '0' ? '0' : style);
        }
        y += rowH;
      }
      y += 2 * MM;
      return startNr + arr.length;
    }

    // ---------- Lösung ----------
    function solGap(arr, startNr) {
      y = secHead(ctx, 'L\u00f6sung', y);
      const colW = W / 2, rowH = fs * 1.4;
      for (let i = 0; i < arr.length; i += 2) {
        ensure(rowH);
        for (let c = 0; c < 2 && i + c < arr.length; c++) {
          const t = arr[i + c];
          const x = PT.marginX + c * colW;
          const nrStr = (startNr + i + c) + '.';
          ctx.text(nrStr, x, y + 1, { font: fonts.bold, size: 9, color: C.gray });
          let tx = x + ctx.textWidth(nrStr, fonts.bold, 9) + 4;
          ctx.text(t.art, tx, y, { font: fonts.bold, size: fs, color: C.red2 });
          ctx.line(tx, y + fs * 1.02, tx + ctx.textWidth(t.art, fonts.bold, fs), y + fs * 1.02, { color: C.red2, w: 0.8 });
          tx += ctx.textWidth(t.art, fonts.bold, fs) + 4;
          ctx.text(t.word, tx, y, { font: fonts.bold, size: fs, color: C.ink });
        }
        y += rowH;
      }
      y += 2 * MM;
      return startNr + arr.length;
    }

    function solSort(arr, startNr) {
      y = secHead(ctx, 'L\u00f6sung', y);
      arr.forEach(t => {
        const nc = t.cols.length;
        const cols = [];
        let maxRows = 0;
        for (let c = 0; c < nc; c++) {
          const list = t.words.filter(o => o.col === c).map(o => ({ word: o.w }));
          cols.push(list); if (list.length > maxRows) maxRows = list.length;
        }
        const headH = 6 * MM, cellH = fs * 1.3;
        const blockH = headH + maxRows * cellH + 6 * MM;
        ensure(blockH);
        const colW = W / nc;
        for (let c = 0; c < nc; c++) {
          ctx.rect(PT.marginX + c * colW, y, colW, headH, { fill: C.redBg, stroke: C.cellBd, strokeWidth: 1 });
          ctx.text(t.cols[c], PT.marginX + c * colW + 3 * MM, y + (headH - 9) / 2, { font: fonts.heavy, size: 9, color: C.red2 });
        }
        y += headH;
        const bodyH = maxRows * cellH;
        for (let c = 0; c < nc; c++) ctx.rect(PT.marginX + c * colW, y, colW, bodyH, { stroke: C.cellBd, strokeWidth: 1 });
        for (let c = 0; c < nc; c++) {
          cols[c].forEach((o, r) => {
            ctx.text(o.word, PT.marginX + c * colW + 3 * MM, y + r * cellH + 2, { font: fonts.bold, size: fs, color: C.ink });
          });
        }
        y += bodyH + 2 * MM;
        y += 2 * MM;
      });
      return startNr + arr.length;
    }

    function solCheck(arr, startNr) {
      y = secHead(ctx, 'L\u00f6sung', y);
      const rowH = fs * 1.6;
      arr.forEach((t, i) => {
        ensure(rowH);
        const nrStr = (startNr + i) + '.';
        ctx.text(nrStr, PT.marginX, y + 1, { font: fonts.bold, size: 9, color: C.gray });
        let tx = PT.marginX + ctx.textWidth(nrStr, fonts.bold, 9) + 4;
        ctx.text(t.word, tx, y, { font: fonts.bold, size: fs, color: C.ink });
        tx += ctx.textWidth(t.word, fonts.bold, fs) + 12;
        drawCheck(ctx, tx, y - 1, 11, C.red2);
        tx += 15;
        ctx.text(t.art, tx, y, { font: fonts.bold, size: fs, color: C.red2 });
        y += rowH;
      });
      y += 2 * MM;
      return startNr + arr.length;
    }

    function solFix(arr, startNr) {
      y = secHead(ctx, 'L\u00f6sung', y);
      const colW = W / 2, rowH = fs * 1.6;
      for (let i = 0; i < arr.length; i += 2) {
        ensure(rowH);
        for (let c = 0; c < 2 && i + c < arr.length; c++) {
          const t = arr[i + c];
          const x = PT.marginX + c * colW;
          const nrStr = (startNr + i + c) + '.';
          ctx.text(nrStr, x, y + 1, { font: fonts.bold, size: 9, color: C.gray });
          let tx = x + ctx.textWidth(nrStr, fonts.bold, 9) + 4;
          if (t.wrong) {
            const badPhrase = t.dispArt + ' ' + t.word;
            ctx.text(badPhrase, tx, y, { font: fonts.bold, size: fs, color: C.gray });
            ctx.line(tx, y + fs * 0.55, tx + ctx.textWidth(badPhrase, fonts.bold, fs), y + fs * 0.55, { color: C.gray, w: 1 });
            tx += ctx.textWidth(badPhrase, fonts.bold, fs) + 6;
            const goodPhrase = t.correctArt + ' ' + t.word;
            ctx.text(goodPhrase, tx, y, { font: fonts.bold, size: fs, color: C.red2 });
          } else {
            const okPhrase = t.correctArt + ' ' + t.word;
            ctx.text(okPhrase, tx, y, { font: fonts.bold, size: fs, color: C.ink });
          }
        }
        y += rowH;
      }
      y += 2 * MM;
      return startNr + arr.length;
    }
  }

  function cloneTask(t) {
    const o = { type: t.type };
    if (t.type === 'gap' || t.type === 'check') {
      o.word = deent(t.word); o.art = t.art;
    } else if (t.type === 'sort') {
      o.cols = (t.cols || []).map(deent);
      o.words = (t.words || []).map(w => ({ w: deent(w.w), col: w.col }));
    } else if (t.type === 'fix') {
      o.word = deent(t.word); o.correctArt = t.correctArt; o.dispArt = t.dispArt; o.wrong = t.wrong;
    }
    return o;
  }

  global.ArtikelPDF = { PT, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
