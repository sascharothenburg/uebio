/* =====================================================================
   bundeslaender-pdf.js  ·  PDF-Modul für die Bundesländer-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Erzeugt Sachkunde-Arbeitsblätter (Deutschland/Bundesländer) als PDF mit
   absoluten Koordinaten -> identisch auf iOS (WebKit) und Android (Chromium).

   Anders als Mengen/Schreiben: die Aufgabentypen sind heterogen und frei
   kombinierbar (Land->Hauptstadt, Hauptstadt->Land, Karte beschriften,
   Multiple-Choice, Nachbarländer) + optionaler Lösungsblock. Daher KEINE
   vorab berechnete Füllung, sondern FLIESSENDER Seitenumbruch: Inhalte
   werden nacheinander gezeichnet; reicht der Platz nicht, beginnt eine
   neue Seite.

   Kartendaten: window.BL_DATA = {LD, ALLKEYS, FLAECHEN, STADT, NACHBARN, MEERE}
   (aus bundeslaender-data.js). Polygone bereits projiziert im VB 560x720.

   Abhängigkeiten (global): window.PDFLib, window.fontkit (optional)
   ===================================================================== */

(function (global) {
  'use strict';

  const MM = 2.834645;
  const PT = {
    pageW: 595.28, pageH: 841.89,
    marginX: 14 * MM, marginY: 12 * MM,
  };
  PT.contentW = PT.pageW - PT.marginX * 2;
  PT.contentH = PT.pageH - PT.marginY * 2;

  // Karten-Viewbox (aus der App)
  const VB_W = 560, VB_H = 720;

  // ---- Farben (Sachkunde-Grün) ------------------------------------
  const C = {
    green:   rgb01(0x15, 0x80, 0x3d),
    green2:  rgb01(0x16, 0xa3, 0x4a),
    greenLn: rgb01(0xbb, 0xf7, 0xd0),
    mapFill: rgb01(0xdc, 0xfc, 0xe7),
    mapStroke: rgb01(0x15, 0x80, 0x3d),
    ink:     rgb01(0x1e, 0x29, 0x3b),
    sub:     rgb01(0x55, 0x55, 0x55),
    sol:     rgb01(0x77, 0x77, 0x77),
    metaLine:rgb01(0x88, 0x88, 0x88),
    dotLine: rgb01(0x99, 0x99, 0x99),
    capRed:  rgb01(0xdc, 0x26, 0x26),
    white:   rgb01(0xff, 0xff, 0xff),
    box:     rgb01(0x16, 0xa3, 0x4a),
    labelInk:rgb01(0x14, 0x53, 0x2d),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  // ---- Zeichen-Kontext (Top-Left -> pdf-lib bottom-left) ----------
  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) {
        o = o || {};
        page.drawRectangle({
          x, y: PT.pageH - yTop - h, width: w, height: h,
          color: col(o.fill), borderColor: col(o.stroke),
          borderWidth: o.strokeWidth || 0,
          opacity: o.opacity, borderOpacity: o.borderOpacity,
        });
      },
      line(x1, y1, x2, y2, o) {
        o = o || {};
        page.drawLine({
          start:{x:x1, y:PT.pageH-y1}, end:{x:x2, y:PT.pageH-y2},
          thickness:o.w||1, color:col(o.color)||col(C.ink),
          dashArray:o.dash||undefined, opacity:o.opacity,
        });
      },
      text(str, x, yTop, o) {
        o = o || {};
        const f = o.font || fonts.regular;
        const size = o.size || 10;
        const ascent = f.heightAtSize(size) * 0.76;
        page.drawText(String(str), {
          x, y: PT.pageH - yTop - ascent, size, font: f,
          color: col(o.color) || col(C.ink), opacity: o.opacity,
        });
      },
      circle(cx, cyTop, r, o) {
        o = o || {};
        page.drawCircle({
          x: cx, y: PT.pageH - cyTop, size: r,
          color: col(o.fill), borderColor: col(o.stroke),
          borderWidth: o.strokeWidth || 0,
        });
      },
      svgPath(d, x, yTop, scale, o) {
        o = o || {};
        // pdf-lib drawSvgPath: y wächst nach unten, Ursprung oben-links der
        // angegebenen Position -> passt zu unserem Top-Left, wenn wir y spiegeln.
        page.drawSvgPath(d, {
          x, y: PT.pageH - yTop, scale,
          color: col(o.fill), borderColor: col(o.stroke),
          borderWidth: o.strokeWidth || 0,
        });
      },
      textWidth(str, font, size) { return (font||fonts.regular).widthOfTextAtSize(String(str), size); },
      fonts,
    };
  }

  // =================================================================
  //  KARTE zeichnen
  //  numbers: {key:label} | null ; opts:{kuerzel, capdot, fill}
  //  Zeichnet ab (xLeft, yTop) mit Breite wPt. Höhe = wPt*720/560.
  // =================================================================
  function pathD(polys) {
    const parts = [];
    for (let p = 0; p < polys.length; p++) {
      const pts = polys[p];
      let s = 'M';
      for (let i = 0; i < pts.length; i++) s += (i?' L':'') + pts[i][0] + ',' + pts[i][1];
      s += ' Z';
      parts.push(s);
    }
    return parts.join(' ');
  }

  function mapHeight(wPt) { return wPt * VB_H / VB_W; }

  // -----------------------------------------------------------------
  // Label-Platzierung in Viewbox-Einheiten (560x720).
  // Verhindern Überlappungen, wo Orte sehr eng beieinander liegen.
  //   anchor    : eigener Ankerpunkt (Punkt + Strichanfang) statt v.l
  //               -> nötig für Brandenburg (umschließt Berlin) und
  //                  Potsdam (liegt neben, nicht in Berlin).
  //   capAnchor : eigener Ankerpunkt für die Hauptstadt-Aufgabe.
  //   numOff    : Versatz der Nummer ggü. dem Anker ("Karte beschriften")
  //   capOff    : Versatz der Nummer ggü. dem Anker ("Hauptstädte")
  // Bei Versatz wird eine dünne Leader-Linie vom Anker zur Nummer gezogen.
  // Berlin-Zentrum ≈ (443,256); Berlin-bbox x424–461 / y241–271.
  // -----------------------------------------------------------------
  const LABEL_OFFSET = {
    // Stadtstaaten: Nummer mit Abstand + Leader zum kleinen Ort.
    HH: { numOff: [ 26, -20 ], capOff: [ 26, -20 ] },   // Hamburg
    HB: { numOff: [ -26, -16 ], capOff: [ -26, -16 ] }, // Bremen
    // Berlin: kleiner Ort -> Nummer rechts daneben mit Leader.
    BE: { numOff: [ 34, -4 ], capOff: [ 34, -4 ] },
    // Brandenburg: Label/Punkt sitzen sonst MITTEN in Berlin.
    //  - Karte beschriften: Anker auf die Brandenburger Fläche (NO von Berlin).
    //  - Hauptstädte: Potsdam liegt SW direkt neben Berlin (nicht darin).
    BB: {
      anchor: [ 443, 256 ], numOff: [ -28, -26 ], noLeader: true, // leicht links über Berlin, ohne Strich
      capAnchor: [ 422, 272 ], capOff: [ -22, 16 ],    // Potsdam SW neben Berlin
    },
  };

  function drawMap(ctx, xLeft, yTop, wPt, numbers, opts) {
    opts = opts || {};
    const D = global.BL_DATA;
    const scale = wPt / VB_W;
    const fillC = opts.fill ? C.mapFill : C.white;

    // Länderflächen
    D.ALLKEYS.forEach(k => {
      const d = pathD(D.LD[k].polys);
      ctx.svgPath(d, xLeft, yTop, scale, {
        fill: fillC, stroke: C.mapStroke, strokeWidth: 0.7,
      });
    });

    // Marker + Beschriftungen
    D.ALLKEYS.forEach(k => {
      const v = D.LD[k];
      const off = LABEL_OFFSET[k];

      // capMode: Hauptstadt-Aufgabe -> roter Hauptstadt-Punkt + Nummer.
      if (opts.capMode) {
        // Ankerpunkt der Hauptstadt (eigener capAnchor hat Vorrang)
        const ax = (off && off.capAnchor) ? off.capAnchor[0] : v.l[0];
        const ay = (off && off.capAnchor) ? off.capAnchor[1] : v.l[1];
        const x = xLeft + ax * scale;
        const y = yTop + ay * scale;
        // Punkt am Hauptstadt-Ort. Bei Stadtstaaten ohne Anker kein Extra-Punkt;
        // Brandenburg (capAnchor=Potsdam) bekommt aber einen Punkt.
        if (!v.s || (off && off.capAnchor)) {
          ctx.circle(x, y, 2.6, { fill: C.capRed, stroke: C.white, strokeWidth: 0.8 });
        }
        const lbl = (numbers && numbers[k] != null) ? String(numbers[k]) : '';
        if (lbl) {
          const fs = 11;
          const w = ctx.textWidth(lbl, ctx.fonts.heavy, fs);
          const cOff = off && off.capOff;
          const lx = (cOff ? x + cOff[0]*scale : (v.s ? x : x + 5));
          const ly = (cOff ? y + cOff[1]*scale : (v.s ? y - 3 : y));
          if (cOff && (cOff[0] || cOff[1])) ctx.line(x, y, lx, ly, { color: C.capRed, w: 0.6, opacity: 0.8 });
          ctx.text(lbl, lx - w/2, ly - fs*0.5, { font: ctx.fonts.heavy, size: fs, color: C.capRed });
        }
        return;
      }

      // "Karte beschriften" (oder Kürzel-Lesehilfe)
      // Ankerpunkt (eigener anchor hat Vorrang)
      const ax = (off && off.anchor) ? off.anchor[0] : v.l[0];
      const ay = (off && off.anchor) ? off.anchor[1] : v.l[1];
      const x = xLeft + ax * scale;
      const y = yTop + ay * scale;

      let lbl = '';
      if (numbers && numbers[k] != null) lbl = String(numbers[k]);
      else if (opts.kuerzel) lbl = v.k;

      if (!v.s && opts.capdot) ctx.circle(x, y, 2.4, { fill: C.capRed });

      if (lbl) {
        const fs = v.s ? 9 : 12;
        const w = ctx.textWidth(lbl, ctx.fonts.heavy, fs);
        const nOff = off && off.numOff;
        const hasShift = nOff && (nOff[0] || nOff[1]);
        const noLeader = off && off.noLeader;
        const lx = nOff ? x + nOff[0]*scale : x;
        const ly = nOff ? y + nOff[1]*scale : y + (v.s ? 0 : 4);
        // Leader nur, wenn die Zahl versetzt ist UND noLeader nicht gesetzt.
        if (hasShift && !noLeader) {
          ctx.circle(x, y, 1.6, { fill: C.green2 });
          ctx.line(x, y, lx, ly, { color: C.green2, w: 0.6, opacity: 0.85 });
        }
        ctx.text(lbl, lx - w/2, ly - fs*0.76, {
          font: ctx.fonts.heavy, size: fs, color: C.labelInk,
        });
      }
    });

    return mapHeight(wPt);
  }

  // =================================================================
  //  HEADER
  // =================================================================
  function drawHeader(ctx, opts, klasse) {
    const F = ctx.fonts;
    const top = PT.marginY;
    ctx.text('Bundesländer & Städte', PT.marginX, top, { font: F.heavy, size: 14, color: C.green });
    ctx.text('Deutschland kennenlernen · Klasse ' + (klasse||''), PT.marginX, top + 18,
             { font: F.regular, size: 8, color: C.sub });

    // Meta-Felder
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
    ctx.line(PT.marginX, lineY, PT.pageW - PT.marginX, lineY, { color: C.green, w: 2.5 });
    return lineY + 12;
  }

  // =================================================================
  //  LAYOUT-MASCHINE mit fließendem Seitenumbruch
  // =================================================================
  function makeFlow(pdf, fonts, opts, klasse) {
    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let y = drawHeader(ctx, opts, klasse);
    const bottom = PT.pageH - PT.marginY;

    return {
      get ctx() { return ctx; },
      get y() { return y; },
      set y(v) { y = v; },
      // sorgt dafür, dass h pt Platz vorhanden ist; sonst neue Seite
      ensure(h) {
        if (y + h > bottom) this.newPage();
      },
      newPage() {
        page = pdf.addPage([PT.pageW, PT.pageH]);
        ctx = makeCtx(page, fonts);
        y = drawHeader(ctx, opts, klasse);
      },
      remaining() { return bottom - y; },
      bottom,
    };
  }

  function sectionTitle(flow, txt) {
    flow.ensure(23);
    const ctx = flow.ctx;   // nach evtl. Seitenumbruch frisch holen
    flow.y += 4;
    ctx.text(txt, PT.marginX, flow.y, { font: ctx.fonts.heavy, size: 9.5, color: C.green });
    flow.y += 13;
    ctx.line(PT.marginX, flow.y, PT.pageW - PT.marginX, flow.y, { color: C.greenLn, w: 1.2 });
    flow.y += 6;
  }

  // Eine Liste mit nummerierten Schreiblinien in N Spalten
  // items: [{label}], cols, lineH
  function drawNumberedList(flow, items, prefixFn, cols, opts) {
    opts = opts || {};
    const colGap = 6 * MM;
    const colW = (PT.contentW - colGap * (cols - 1)) / cols;
    const rowH = opts.rowH || 16;
    const rows = Math.ceil(items.length / cols);
    for (let r = 0; r < rows; r++) {
      flow.ensure(rowH);
      const ctx = flow.ctx;   // nach evtl. Seitenumbruch frisch holen
      const rowY = flow.y;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= items.length) continue;
        const x = PT.marginX + c * (colW + colGap);
        const it = items[idx];
        const num = (idx + 1) + '.';
        ctx.text(num, x, rowY, { font: ctx.fonts.heavy, size: 9, color: C.green2 });
        const numW = 15;
        let tx = x + numW;
        if (it.pre) {
          ctx.text(it.pre, tx, rowY, { font: ctx.fonts.bold, size: 9, color: C.ink });
          tx += ctx.textWidth(it.pre, ctx.fonts.bold, 9) + 4;
        }
        const lineY = rowY + 11;
        if (tx < x + colW) ctx.line(tx, lineY, x + colW, lineY, { color: C.dotLine, w: 0.8, dash: [1.5, 1.5] });
      }
      flow.y += rowH;
    }
  }

  // Multiple-Choice-Block
  function drawMC(flow, entries) {
    // entries: [{q, options:[...]}]
    const rowH = 15;
    entries.forEach((e, i) => {
      flow.ensure(rowH);
      const ctx = flow.ctx;   // nach evtl. Seitenumbruch frisch holen
      const rowY = flow.y;
      const num = (i + 1) + '.';
      ctx.text(num, PT.marginX, rowY, { font: ctx.fonts.heavy, size: 9.5, color: C.green2 });
      let tx = PT.marginX + 16;
      ctx.text(e.q, tx, rowY, { font: ctx.fonts.bold, size: 9.5, color: C.ink });
      tx += ctx.textWidth(e.q, ctx.fonts.bold, 9.5) + 10;
      e.options.forEach(o => {
        const boxY = rowY + 1.5;
        ctx.rect(tx, boxY, 9, 9, { stroke: C.box, strokeWidth: 1.2 });
        tx += 12;
        ctx.text(o, tx, rowY, { font: ctx.fonts.regular, size: 9.5, color: C.ink });
        tx += ctx.textWidth(o, ctx.fonts.regular, 9.5) + 12;
      });
      flow.y += rowH;
    });
  }

  // =================================================================
  //  Aufgaben-Generator-Helfer
  // =================================================================
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // =================================================================
  //  HAUPTFUNKTION
  //  spec: { types:[...], count, klasse, showSol, kuerzel, capdot }
  //  opts: { showName, showDate, showKl }
  // =================================================================
  async function buildWorksheetPDF(spec, opts, fontBytes) {
    const { PDFDocument, StandardFonts } = global.PDFLib;
    const pdf = await PDFDocument.create();
    if (fontBytes && global.fontkit) pdf.registerFontkit(global.fontkit);

    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold:    await pdf.embedFont(StandardFonts.HelveticaBold),
      heavy:   await pdf.embedFont(StandardFonts.HelveticaBold),
    };

    opts = opts || {};
    spec = spec || {};
    const D = global.BL_DATA;
    let types = spec.types && spec.types.length ? spec.types : ['lh'];
    const count = spec.count || 8;
    // "2 Seiten": jeden Aufgabentyp zweimal ausgeben (neu gemischt -> andere Reihenfolge)
    if ((spec.numPages || 1) >= 2) {
      types = types.concat(types);
    }
    const klasse = spec.klasse || 3;

    const flow = makeFlow(pdf, fonts, opts, klasse);
    const solBlocks = [];

    types.forEach(ty => {
      if (ty === 'lh') {
        const ks = shuffle(D.ALLKEYS).slice(0, count);
        sectionTitle(flow, 'Schreibe die Hauptstadt zu jedem Bundesland.');
        drawNumberedList(flow, ks.map(k => ({ pre: D.LD[k].n })), null, 2, {});
        solBlocks.push({ t: 'Hauptstädte', items: ks.map((k, i) => (i + 1) + '. ' + D.LD[k].h) });
      }
      else if (ty === 'hl') {
        const ks = shuffle(D.ALLKEYS).slice(0, count);
        sectionTitle(flow, 'Zu welchem Bundesland gehört die Hauptstadt?');
        drawNumberedList(flow, ks.map(k => ({ pre: D.LD[k].h })), null, 2, {});
        solBlocks.push({ t: 'Bundesländer', items: ks.map((k, i) => (i + 1) + '. ' + D.LD[k].n) });
      }
      else if (ty === 'karte') {
        const order = shuffle(D.ALLKEYS);
        const numbers = {};
        order.forEach((k, i) => { numbers[k] = i + 1; });
        sectionTitle(flow, 'Trage die Namen der Bundesländer zu den Nummern ein.');
        // Karte: Breite so wählen, dass sie auf eine Seite passt
        const mapW = 250;
        const mapH = mapHeight(mapW);
        flow.ensure(mapH + 4);
        const mapX = PT.marginX + (PT.contentW - mapW) / 2;
        drawMap(flow.ctx, mapX, flow.y, mapW, numbers, { fill: true });
        flow.y += mapH + 6;
        // Nummern-Liste (3 Spalten)
        drawNumberedList(flow, order.map(k => ({})), null, 3, { rowH: 14 });
        solBlocks.push({ t: 'Karte', items: order.map((k, i) => (i + 1) + '. ' + D.LD[k].n) });
      }
      else if (ty === 'hauptstadt') {
        const order = shuffle(D.ALLKEYS);
        const numbers = {};
        order.forEach((k, i) => { numbers[k] = i + 1; });
        sectionTitle(flow, 'Bestimme die Hauptstädte. Schreibe sie zu den Nummern auf der Karte.');
        const mapW = 250;
        const mapH = mapHeight(mapW);
        flow.ensure(mapH + 4);
        const mapX = PT.marginX + (PT.contentW - mapW) / 2;
        drawMap(flow.ctx, mapX, flow.y, mapW, numbers, { fill: true, capMode: true });
        flow.y += mapH + 6;
        drawNumberedList(flow, order.map(k => ({})), null, 3, { rowH: 14 });
        solBlocks.push({ t: 'Hauptstädte', items: order.map((k, i) => (i + 1) + '. ' + D.LD[k].h) });
      }
      else if (ty === 'mc') {
        const ks = shuffle(D.ALLKEYS).slice(0, count);
        sectionTitle(flow, 'Kreuze die richtige Hauptstadt an.');
        const entries = ks.map(k => {
          const correct = D.LD[k].h;
          const others = shuffle(D.ALLKEYS.filter(x => x !== k)).slice(0, 2).map(x => D.LD[x].h);
          return { q: D.LD[k].n, options: shuffle([correct].concat(others)) };
        });
        drawMC(flow, entries);
        solBlocks.push({ t: 'Multiple Choice', items: ks.map((k, i) => (i + 1) + '. ' + D.LD[k].h) });
      }
      else if (ty === 'nachbar') {
        sectionTitle(flow, 'Nachbarländer & Meere');
        flow.ensure(14);
        let ctx = flow.ctx;
        ctx.text('Welche 9 Länder grenzen an Deutschland?', PT.marginX, flow.y,
                 { font: ctx.fonts.bold, size: 9.5, color: C.ink });
        flow.y += 14;
        const nine = [];
        for (let i = 0; i < 9; i++) nine.push({});
        drawNumberedList(flow, nine, null, 3, { rowH: 15 });
        flow.y += 4;
        flow.ensure(14);
        ctx = flow.ctx;
        ctx.text('An welche zwei Meere grenzt Deutschland?', PT.marginX, flow.y,
                 { font: ctx.fonts.bold, size: 9.5, color: C.ink });
        flow.y += 14;
        drawNumberedList(flow, [{}, {}], null, 2, { rowH: 15 });
        solBlocks.push({ t: 'Nachbarländer', items: D.NACHBARN.map((n, i) => (i + 1) + '. ' + deHtml(n)) });
        solBlocks.push({ t: 'Meere', items: D.MEERE.map((n, i) => (i + 1) + '. ' + n) });
      }
    });

    // Lösungsblock
    if (spec.showSol && solBlocks.length) {
      flow.ensure(24);
      let ctx = flow.ctx;
      flow.y += 6;
      ctx.line(PT.marginX, flow.y, PT.pageW - PT.marginX, flow.y, { color: C.greenLn, w: 1 });
      flow.y += 8;
      ctx.text('LÖSUNGEN', PT.marginX, flow.y, { font: ctx.fonts.heavy, size: 8, color: C.green });
      flow.y += 12;
      solBlocks.forEach(b => {
        const txt = b.t + ': ' + b.items.join('  ·  ');
        const words = txt.split(' ');
        let line = '';
        const maxW = PT.contentW;
        const size = 7.5;
        words.forEach(w => {
          const test = line ? line + ' ' + w : w;
          if (ctx.textWidth(test, ctx.fonts.regular, size) > maxW) {
            flow.ensure(10);
            ctx = flow.ctx;
            ctx.text(line, PT.marginX, flow.y, { font: ctx.fonts.regular, size, color: C.sol });
            flow.y += 10;
            line = w;
          } else line = test;
        });
        if (line) {
          flow.ensure(10);
          ctx = flow.ctx;
          ctx.text(line, PT.marginX, flow.y, { font: ctx.fonts.regular, size, color: C.sol });
          flow.y += 10;
        }
        flow.y += 2;
      });
    }

    return await pdf.save();
  }

  // HTML-Entities in den Daten (Dänemark etc.) auflösen
  function deHtml(s) {
    return String(s)
      .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
      .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
      .replace(/&szlig;/g, 'ß').replace(/&amp;/g, '&');
  }

  global.BundeslaenderPDF = {
    PT, drawMap, mapHeight, pathD,
    buildWorksheetPDF,
  };

})(typeof window !== 'undefined' ? window : this);
