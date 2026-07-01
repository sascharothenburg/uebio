/* =====================================================================
   zeit-pdf.js  ·  PDF-Modul für die Zeit-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Sachrechnen mit Zeit als PDF mit absoluten Koordinaten ->
   identisch auf iOS (WebKit) und Android (Chromium).

   Aufgaben in Kästchen (Box mit Rahmen + Typ-Label). Der Text kann
   mehrzeilig sein (Marker '\n') und enthält eine Lücke '___'.
   2 Spalten; Box-Höhe variabel -> FLIESSENDER Umbruch (kapazitäts-
   genau gefüllt über Generator).

   spec: { gen:function(i)->{q,s,type}, numPages, showSol }
         (q = Text mit '\n' für Umbruch und '___' für die Lücke)
   opts: { showName, showDate, showKl }
   Abhängig (global): window.PDFLib
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = {
    pageW: 595.28, pageH: 841.89,
    marginX: 14 * MM, marginY: 12 * MM,
  };
  PT.contentW = PT.pageW - PT.marginX * 2;

  const C = {
    blue:    rgb01(0x03, 0x69, 0xa1),
    blue2:   rgb01(0x0e, 0xa5, 0xe9),
    blueLn:  rgb01(0xba, 0xe6, 0xfd),
    ink:     rgb01(0x1e, 0x1b, 0x4b),
    sub:     rgb01(0x55, 0x55, 0x55),
    sol:     rgb01(0x77, 0x77, 0x77),
    metaLine:rgb01(0x88, 0x88, 0x88),
    boxBd:   rgb01(0xd9, 0xdd, 0xe3),
    line:    rgb01(0x33, 0x33, 0x33),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  // ---- Geometrie (eine Quelle der Wahrheit, auch von der HTML genutzt) ----
  const GEO = {
    cols: 2,
    fs:   13,          // Aufgaben-Schrift
    labelH: 12,        // Höhe Typ-Label
    lineH: 17,         // Zeilenhöhe im Aufgabentext
    boxPadV: 7,        // vertikales Innen-Padding der Box
    boxGap: 8,         // Abstand zwischen Boxen
  };

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) {
        o = o || {};
        page.drawRectangle({
          x, y: PT.pageH - yTop - h, width: w, height: h,
          color: col(o.fill), borderColor: col(o.stroke),
          borderWidth: o.strokeWidth || 0,
        });
      },
      line(x1, y1, x2, y2, o) {
        o = o || {};
        page.drawLine({
          start:{x:x1, y:PT.pageH-y1}, end:{x:x2, y:PT.pageH-y2},
          thickness:o.w||1, color:col(o.color)||col(C.ink), dashArray:o.dash,
        });
      },
      text(str, x, yTop, o) {
        o = o || {};
        const f = o.font || fonts.regular;
        const size = o.size || 10;
        const ascent = f.heightAtSize(size) * 0.76;
        page.drawText(String(str), {
          x, y: PT.pageH - yTop - ascent, size, font: f,
          color: col(o.color) || col(C.ink),
        });
      },
      textCentered(str, cx, yTop, o) {
        o = o || {};
        const f = o.font || fonts.regular;
        const size = o.size || 10;
        const w = f.widthOfTextAtSize(String(str), size);
        this.text(str, cx - w/2, yTop, o);
      },
      textWidth(str, font, size){ return (font||fonts.regular).widthOfTextAtSize(String(str), size); },
      fonts,
    };
  }

  function drawHeader(ctx, opts) {
    const F = ctx.fonts;
    const top = PT.marginY;
    ctx.text('Mit Zeit rechnen', PT.marginX, top, { font: F.heavy, size: 14, color: C.blue });
    ctx.text('Berechne und l\u00f6se die Aufgaben', PT.marginX, top + 18, { font: F.regular, size: 8, color: C.sub });
    const fields = [];
    if (opts.showName) fields.push(['Name:', 95]);
    if (opts.showDate) fields.push(['Datum:', 55]);
    if (opts.showKl)   fields.push(['Klasse:', 32]);
    const right = PT.pageW - PT.marginX;
    const gap = 14, my = top + 1;
    let totalW = 0;
    fields.forEach(f => { totalW += ctx.textWidth(f[0], F.regular, 8) + 3 + f[1] + gap; });
    totalW -= gap;
    let mx = right - totalW;
    fields.forEach(f => {
      const labW = ctx.textWidth(f[0], F.regular, 8);
      ctx.text(f[0], mx, my, { font: F.regular, size: 8, color: C.sub });
      const lineX = mx + labW + 3;
      ctx.line(lineX, my + 10, lineX + f[1], my + 10, { color: C.metaLine, w: 1 });
      mx = lineX + f[1] + gap;
    });
    const lineY = top + 30;
    ctx.line(PT.marginX, lineY, PT.pageW - PT.marginX, lineY, { color: C.blue, w: 2.5 });
    return lineY + 12;
  }

  // Höhe einer Box ermitteln (Anzahl Textzeilen aus '\n')
  function boxHeight(task) {
    const lines = String(task.q).split('\n').length;
    return GEO.labelH + lines * GEO.lineH + GEO.boxPadV * 2;
  }

  // Eine Aufgaben-Box zeichnen
  function drawBox(ctx, task, idx, x, yTop, w) {
    const F = ctx.fonts;
    const h = boxHeight(task);
    ctx.rect(x, yTop, w, h, { stroke: C.boxBd, strokeWidth: 1 });
    // Typ-Label
    ctx.text((idx + 1) + '. ' + (task.type || ''), x + 6, yTop + 5,
             { font: F.bold, size: 7, color: C.blue });
    // Text-Zeilen (mit Lücke '___')
    const lines = String(task.q).split('\n');
    let ty = yTop + GEO.labelH + GEO.boxPadV;
    lines.forEach(line => {
      drawTextWithGap(ctx, line, x + 8, ty, w - 16);
      ty += GEO.lineH;
    });
  }

  // Zeichnet eine Zeile, ersetzt '___' durch eine Schreiblinie
  function drawTextWithGap(ctx, line, x, yTop, maxW) {
    const F = ctx.fonts;
    const fs = GEO.fs;
    const lineW = 42;
    const parts = String(line).split('___');
    let cx = x;
    for (let p = 0; p < parts.length; p++) {
      const seg = parts[p];
      if (seg) {
        ctx.text(seg, cx, yTop, { font: F.bold, size: fs, color: C.ink });
        cx += ctx.textWidth(seg, F.bold, fs);
      }
      if (p < parts.length - 1) {
        const ly = yTop + fs * 0.95;
        ctx.line(cx + 2, ly, cx + 2 + lineW, ly, { color: C.line, w: 1.4 });
        cx += lineW + 4;
      }
    }
  }

  // Wie viele Aufgaben passen? (variabel, daher Schätzung über mittlere Boxhöhe)
  // Wir füllen über den Generator, indem wir tatsächlich platzieren bis voll.
  async function buildWorksheetPDF(spec, opts, _unused) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold:    await pdf.embedFont(StandardFonts.HelveticaBold),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
    };

    opts = opts || {};
    spec = spec || {};
    const numPages = spec.numPages || 1;
    const cols = GEO.cols;
    const colGap = 6 * MM;
    const colW = (PT.contentW - colGap * (cols - 1)) / cols;
    const gen = (typeof spec.gen === 'function') ? spec.gen : null;
    const bottom = PT.pageH - PT.marginY;

    // Aufgaben sammeln: über Generator vorerzeugen (genug für numPages),
    // dann platzieren bis die gewünschten Seiten voll sind.
    // Wir erzeugen großzügig (Kapazitätsobergrenze) und brechen beim Platzieren ab.
    const maxPerPage = 30; // Sicherheitsobergrenze pro Seite
    const wanted = numPages * maxPerPage;
    let tasks = [];
    if (gen) {
      for (let i = 0; i < wanted; i++) { const t = gen(i); if (t) tasks.push(t); }
    } else {
      tasks = (spec.tasks || []).filter(Boolean);
    }
    if (!tasks.length) {
      const page = pdf.addPage([PT.pageW, PT.pageH]);
      const ctx = makeCtx(page, fonts);
      ctx.text('Keine Aufgaben \u2013 bitte Aufgabentyp ausw\u00e4hlen.', PT.marginX, PT.marginY + 20,
               { font: fonts.bold, size: 11, color: C.sub });
      return await pdf.save();
    }

    // ---- Platzieren: spaltenweise füllen, Seiten zählen ----
    const placed = []; // {task, idx, page, x, yTop}
    let pageNo = 0;
    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let topY = drawHeader(ctx, opts);
    // Spaltenhöhen verfolgen
    let colY = [topY, topY];
    let idx = 0;
    const usedTasks = [];

    function newPage() {
      pageNo++;
      page = pdf.addPage([PT.pageW, PT.pageH]);
      ctx = makeCtx(page, fonts);
      const ty = PT.marginY + 4;
      colY = [ty, ty];
    }

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const h = boxHeight(task);
      // Spalte mit weniger Höhe wählen
      let c = (colY[0] <= colY[1]) ? 0 : 1;
      // Passt es noch auf die aktuelle Seite?
      if (colY[c] + h > bottom) {
        // andere Spalte probieren
        const other = 1 - c;
        if (colY[other] + h <= bottom) {
          c = other;
        } else {
          // Seite voll -> neue Seite, sofern erlaubt
          if (pageNo + 1 >= numPages) break; // gewünschte Seitenzahl erreicht
          newPage();
          c = 0;
        }
      }
      const x = PT.marginX + c * (colW + colGap);
      placed.push({ task, idx: idx, pageRef: page, ctx: ctx, x, yTop: colY[c] });
      usedTasks.push(task);
      colY[c] += h + GEO.boxGap;
      idx++;
    }

    // Tatsächlich zeichnen
    placed.forEach(pl => {
      drawBox(pl.ctx, pl.task, pl.idx, pl.x, pl.yTop, colW);
    });

    // ---- Lösungsblock (auf der letzten Seite, sonst neue) ----
    if (spec.showSol && usedTasks.length) {
      const yAfter = Math.max(colY[0], colY[1]) + 4;
      const solLineH = 11;
      const solRows = Math.ceil(usedTasks.length / 4);
      const needed = 20 + solRows * solLineH;
      let sctx, sy;
      if (bottom - yAfter >= needed) {
        sctx = ctx; sy = yAfter;
      } else {
        const sp = pdf.addPage([PT.pageW, PT.pageH]);
        sctx = makeCtx(sp, fonts); sy = PT.marginY + 6;
      }
      sctx.line(PT.marginX, sy, PT.pageW - PT.marginX, sy, { color: C.blueLn, w: 1 });
      sy += 8;
      sctx.text('L\u00d6SUNGEN', PT.marginX, sy, { font: fonts.heavy, size: 8, color: C.blue });
      sy += 12;
      const solColW = PT.contentW / 4;
      for (let i = 0; i < usedTasks.length; i++) {
        const r = Math.floor(i / 4), cc = i % 4;
        const sx = PT.marginX + cc * solColW;
        sctx.text((i+1) + '. ' + usedTasks[i].s, sx, sy + r * solLineH,
                  { font: fonts.regular, size: 7.5, color: C.sol });
      }
    }

    return await pdf.save();
  }

  global.ZeitPDF = { PT, GEO, buildWorksheetPDF };

})(typeof window !== 'undefined' ? window : this);
