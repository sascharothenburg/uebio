/* =====================================================================
   auslaut-pdf.js  ·  PDF-Modul (pdf-lib)
   © 2026 Sascha Rothenburg

   Schärfung (tz, ck, ss/ß) als PDF -> identisch iOS/Android.
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

  const BAND2 = 3.5 * MM;  // 2-Linien: Abstand Hilfslinie <-> Grundlinie (wie Heft)
  const B3_TOP = 4 * MM;   // Oberlängen
  const B3_MID = 5 * MM;   // Mittelband (x-Höhe)
  const B3_BOT = 4 * MM;   // Unterlängen
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
    ctx.text('Sch\u00e4rfung \u2013 tz, ck, ss/\u00df', PT.marginX, top, { font: F.heavy, size: 13, color: C.red2 });
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
    ctx.rect(PT.marginX, y, PT.contentW, boxH, { fill: C.redBg, stroke: C.redBd, strokeWidth: 1.5 });
    let ty = y + padTop;
    lines.forEach((ln, li) => {
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

  // Lineatur-Zeile über volle Breite (zum Abschreiben). Gibt verbrauchte Höhe zurück.
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
    // style 3: 4-Linien-Lineatur 4/5/4 mm
    ctx.line(x, yTop, x2, yTop, { color: C.frame, w: 1 });
    ctx.line(x, yTop + B3_TOP, x2, yTop + B3_TOP, { color: C.help, w: 1, dash: [3, 2] });
    ctx.line(x, yTop + B3_TOP + B3_MID, x2, yTop + B3_TOP + B3_MID, { color: C.base, w: 2 });
    ctx.line(x, yTop + B3_TOTAL, x2, yTop + B3_TOTAL, { color: C.frame, w: 1 });
    ctx.line(x, yTop, x, yTop + B3_TOTAL, { color: C.frame, w: 1 });
    ctx.line(x2, yTop, x2, yTop + B3_TOTAL, { color: C.frame, w: 1 });
    return B3_TOTAL + 4 * MM;
  }

  // Inline-Schreiblinie (rechts neben Text). baselineY = Grundlinie.
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

  function inlineBaselineY(yTextTop, fs, style) {
    return yTextTop + 1 * MM + B3_TOP + B3_MID;
  }

  // Höhe einer Aufgabenzeile mit Inline-Linie – für ALLE Stile gleich (Heft-Lineatur).
  function inlineRowH(style, fs) {
    return 1 * MM + B3_TOP + B3_MID + B3_BOT + 1 * MM;
  }

  function secHead(ctx, txt, y) {
    ctx.text(txt, PT.marginX, y, { font: ctx.fonts.bold, size: 9.5, color: C.red2 });
    return y + 9.5 * 1.5;
  }

  const RULES = {
    tz: [{ t: 'Nach einem kurzen, betonten Vokal schreibt man' }, { t: 'tz', b: 1 }, { t: '(Ka' }, { t: 'tz', b: 1 }, { t: 'e, Pla' }, { t: 'tz', b: 1 }, { t: '). Nach langem Vokal oder nach einem Mitlaut steht nur' }, { t: 'z', b: 1 }, { t: '(Sal' }, { t: 'z', b: 1 }, { t: ', Ker' }, { t: 'z', b: 1 }, { t: 'e).' }],
    ck: [{ t: 'Nach einem kurzen, betonten Vokal schreibt man' }, { t: 'ck', b: 1 }, { t: '(Zu' }, { t: 'ck', b: 1 }, { t: 'er, ba' }, { t: 'ck', b: 1 }, { t: 'en). Nach langem Vokal oder nach einem Mitlaut steht nur' }, { t: 'k', b: 1 }, { t: '(Ha' }, { t: 'k', b: 1 }, { t: 'en, On' }, { t: 'k', b: 1 }, { t: 'el).' }],
    ss: [{ t: 'Nach einem kurzen Vokal schreibt man' }, { t: 'ss', b: 1 }, { t: '(Flu' }, { t: 'ss', b: 1 }, { t: ', Ta' }, { t: 'ss', b: 1 }, { t: 'e). Nach langem Vokal oder Doppellaut steht' }, { t: '\u00df', b: 1 }, { t: '(Fu' }, { t: '\u00df', b: 1 }, { t: ', gro' }, { t: '\u00df', b: 1 }, { t: ').' }],
  };

  // Phänomen aus Lücken-Key ableiten (z->tz, k->ck, ß->ss)
  const KEY2PHEN = { tz: 'tz', z: 'tz', ck: 'ck', k: 'ck', ss: 'ss', '\u00df': 'ss' };

  function makeGap(word, luecke) {
    let idx = word.indexOf(luecke);
    if (idx < 0) idx = word.toLowerCase().indexOf(luecke.toLowerCase());
    if (idx < 0) return { pre: word, post: '', gap: luecke };
    return { pre: word.slice(0, idx), post: word.slice(idx + luecke.length), gap: luecke };
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
    const tasks = (spec.tasks || []).map(cloneTask);
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
      : [tasks];

    function renderRuleBoxes(setTasks){
      if (!showRule) return;
      const phenSet = {};
      setTasks.forEach(t => {
        if (t.type === 'gap') { const p = KEY2PHEN[t.key]; if (p) phenSet[p] = 1; }
        if (t.type === 'sort') { const p = KEY2PHEN[t.labelA] || KEY2PHEN[t.labelB]; if (p) phenSet[p] = 1; }
      });
      ['tz', 'ck', 'ss'].forEach(ph => { if (phenSet[ph] && RULES[ph]) { ensure(20 * MM); y = drawRuleBox(ctx, y, RULES[ph]); } });
      y += 1.5 * MM;
    }

    function renderTaskSet(setTasks){
      renderRuleBoxes(setTasks);
      const groups = { gap: [], sort: [] };
      setTasks.forEach(t => { groups[t.type].push(t); });
      let nr = 1;
      if (groups.gap.length) { nr = renderGap(groups.gap, nr); }
      if (groups.sort.length) { nr = renderSort(groups.sort, nr); }
    }

    taskSets.forEach((setTasks, si) => {
      if (si > 0) { newPage(); }
      renderTaskSet(setTasks);
    });

    if (showSol) {
      newPage('L\u00f6sung \u2013 Sch\u00e4rfung tz, ck, ss/\u00df');
      const allTasks = [];
      taskSets.forEach(set => set.forEach(t => allTasks.push(t)));
      const groups = { gap: [], sort: [] };
      allTasks.forEach(t => { groups[t.type].push(t); });
      let snr = 1;
      if (groups.gap.length) { snr = solGap(groups.gap, snr); }
      if (groups.sort.length) { snr = solSort(groups.sort, snr); }
    }

    return await pdf.save();

    // ---------- Aufgaben ----------
    function renderGap(arr, startNr) {
      y = secHead(ctx, 'Erg\u00e4nze die fehlenden Buchstaben.', y);
      const colW = W / 2;
      const rowH = fs * 1.7;
      for (let i = 0; i < arr.length; i += 2) {
        ensure(rowH);
        for (let c = 0; c < 2 && i + c < arr.length; c++) {
          const t = arr[i + c];
          const g = makeGap(t.word, t.luecke);
          const x = PT.marginX + c * colW;
          const baseY = y + ctx.ascHeight(fs);
          const nrStr = (startNr + i + c) + '.';
          ctx.textBaseline(nrStr, x, baseY, { font: fonts.bold, size: 9, color: C.gray });
          let tx = x + ctx.textWidth(nrStr, fonts.bold, 9) + 4;
          ctx.textBaseline(g.pre, tx, baseY, { font: fonts.bold, size: fs, color: C.ink });
          tx += ctx.textWidth(g.pre, fonts.bold, fs) + 2;
          const blankW = Math.max(10, t.luecke.length * 7 + 4);
          ctx.line(tx, baseY, tx + blankW, baseY, { color: C.blankLn, w: 1.6 });
          tx += blankW + 2;
          ctx.textBaseline(g.post, tx, baseY, { font: fonts.bold, size: fs, color: C.ink });
        }
        y += rowH;
      }
      if (style !== '0') {
        y += 1 * MM;
        ensure(6 * MM);
        ctx.text('Schreibe die W\u00f6rter richtig auf die Linien:', PT.marginX, y, { font: fonts.regular, size: 7.5, color: C.gray });
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
        const bank = t.words.map(o => {
          const g = makeGap(o.w, o.lk);
          return g.pre + '_'.repeat(o.lk.length) + g.post;
        });
        const tableRows = Math.ceil(t.words.length / 2) + 1;
        const blockH = 9 * 1.5 + 16 * MM + 7 * MM + tableRows * 8 * MM + 8 * MM;
        ensure(blockH);
        y = secHead(ctx, 'Erg\u00e4nze die fehlenden Buchstaben und ordne die W\u00f6rter in die richtige Spalte (' + t.labelA + ' oder ' + t.labelB + ').', y);
        // Wortvorrat-Box
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
        // Tabelle 2 Spalten
        const colW = W / 2, headH = 7 * MM;
        ctx.rect(PT.marginX, y, colW, headH, { fill: C.redBg, stroke: C.cellBd, strokeWidth: 1.2 });
        ctx.rect(PT.marginX + colW, y, colW, headH, { fill: C.redBg, stroke: C.cellBd, strokeWidth: 1.2 });
        ctx.textCentered(t.labelA, PT.marginX + colW / 2, y + (headH - 11) / 2, { font: fonts.heavy, size: 11, color: C.red2 });
        ctx.textCentered(t.labelB, PT.marginX + colW * 1.5, y + (headH - 11) / 2, { font: fonts.heavy, size: 11, color: C.red2 });
        y += headH;
        const cellH = 8 * MM;
        for (let r = 0; r < tableRows; r++) {
          ensure(cellH);
          ctx.rect(PT.marginX, y, colW, cellH, { stroke: C.cellBd, strokeWidth: 1.2 });
          ctx.rect(PT.marginX + colW, y, colW, cellH, { stroke: C.cellBd, strokeWidth: 1.2 });
          y += cellH;
        }
        y += 6 * MM;
      });
      return startNr + arr.length;
    }

    // ---------- Lösung ----------
    function solGap(arr, startNr) {
      y = secHead(ctx, 'L\u00fcckenw\u00f6rter', y);
      const colW = W / 2, rowH = fs * 1.4;
      for (let i = 0; i < arr.length; i += 2) {
        ensure(rowH);
        for (let c = 0; c < 2 && i + c < arr.length; c++) {
          const t = arr[i + c];
          const g = makeGap(t.word, t.luecke);
          const x = PT.marginX + c * colW;
          const nrStr = (startNr + i + c) + '.';
          ctx.text(nrStr, x, y + 1, { font: fonts.bold, size: 9, color: C.gray });
          let tx = x + ctx.textWidth(nrStr, fonts.bold, 9) + 4;
          ctx.text(g.pre, tx, y, { font: fonts.bold, size: fs, color: C.ink });
          tx += ctx.textWidth(g.pre, fonts.bold, fs);
          ctx.text(g.gap, tx, y, { font: fonts.bold, size: fs, color: C.red2 });
          ctx.line(tx, y + fs * 1.02, tx + ctx.textWidth(g.gap, fonts.bold, fs), y + fs * 1.02, { color: C.red2, w: 0.8 });
          tx += ctx.textWidth(g.gap, fonts.bold, fs);
          ctx.text(g.post, tx, y, { font: fonts.bold, size: fs, color: C.ink });
        }
        y += rowH;
      }
      y += 2 * MM;
      return startNr + arr.length;
    }

    function solSort(arr, startNr) {
      y = secHead(ctx, 'Sortieren', y);
      arr.forEach(t => {
        const A = t.words.filter(o => o.col === 'A').map(o => o.w);
        const B = t.words.filter(o => o.col === 'B').map(o => o.w);
        const rows = Math.max(A.length, B.length);
        const headH = 6 * MM, cellH = fs * 1.3;
        const blockH = headH + rows * cellH + 5 * MM;
        ensure(blockH);
        const colW = W / 2;
        ctx.rect(PT.marginX, y, colW, headH, { fill: C.redBg, stroke: C.cellBd, strokeWidth: 1 });
        ctx.rect(PT.marginX + colW, y, colW, headH, { fill: C.redBg, stroke: C.cellBd, strokeWidth: 1 });
        ctx.text(t.labelA, PT.marginX + 3 * MM, y + (headH - 9) / 2, { font: fonts.heavy, size: 9, color: C.red2 });
        ctx.text(t.labelB, PT.marginX + colW + 3 * MM, y + (headH - 9) / 2, { font: fonts.heavy, size: 9, color: C.red2 });
        y += headH;
        const bodyH = rows * cellH;
        ctx.rect(PT.marginX, y, colW, bodyH, { stroke: C.cellBd, strokeWidth: 1 });
        ctx.rect(PT.marginX + colW, y, colW, bodyH, { stroke: C.cellBd, strokeWidth: 1 });
        for (let r = 0; r < rows; r++) {
          if (A[r]) ctx.text(A[r], PT.marginX + 3 * MM, y + r * cellH + 2, { font: fonts.bold, size: fs, color: C.ink });
          if (B[r]) ctx.text(B[r], PT.marginX + colW + 3 * MM, y + r * cellH + 2, { font: fonts.bold, size: fs, color: C.ink });
        }
        y += bodyH + 5 * MM;
      });
      return startNr + arr.length;
    }
  }

  function cloneTask(t) {
    const o = { type: t.type };
    if (t.type === 'gap') {
      o.word = deent(t.word); o.luecke = deent(t.luecke); o.key = t.key;
    } else {
      o.labelA = deent(t.labelA); o.labelB = deent(t.labelB);
      o.words = (t.words || []).map(w => ({ w: deent(w.w), col: w.col, lk: deent(w.lk) }));
    }
    return o;
  }

  global.SchaerfungPDF = { PT, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
