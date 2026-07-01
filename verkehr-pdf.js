/* =====================================================================
   verkehr-pdf.js  ·  PDF-Modul für die Verkehr-App (pdf-lib)
   © 2026 Sascha Rothenburg

   Sachkunde-Arbeitsblätter (Verkehrserziehung) als PDF mit absoluten
   Koordinaten -> identisch auf iOS (WebKit) und Android (Chromium).

   Sechs kombinierbare Aufgabentypen:
     erkennen  – Schild ansehen, Bedeutung aufschreiben
     mc        – Multiple Choice (richtige Bedeutung ankreuzen)
     sort      – Schilder nach Kategorie sortieren
     vorfahrt  – Kreuzungs-Szenario (Autos + Mini-Schilder), Reihenfolge
     fahrrad   – verkehrssicheres Fahrrad beschriften (PNG + Zeiger)
     verhalten – Aussagen richtig/falsch ankreuzen
   + optionaler Lösungsblock. Klasse 3/4 steuert Schild-/Szenario-Auswahl.

   FLIESSENDER Seitenumbruch (wie Bundesländer), da Inhalte heterogen.

   Grafik:
     - Verkehrsschilder: eingebettete PNG (VK.SIGNS[k].img)  -> embedPng
     - Fahrrad: PNG (BIKE_IMG) + Zeiger als Vektor          -> embedPng + Linien
     - Kreuzung: reiner SVG-Vektor (Autos, Mini-Schilder)   -> Pfade/Rechtecke

   Daten (global): window.VK_DATA, window.BIKE_PTS, window.BIKE_IMG, window.BIKE_GEO
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
  PT.contentH = PT.pageH - PT.marginY * 2;

  const C = {
    green:   rgb01(0x15, 0x80, 0x3d),
    green2:  rgb01(0x16, 0xa3, 0x4a),
    greenLn: rgb01(0xbb, 0xf7, 0xd0),
    ink:     rgb01(0x1e, 0x29, 0x3b),
    sub:     rgb01(0x55, 0x55, 0x55),
    sol:     rgb01(0x77, 0x77, 0x77),
    metaLine:rgb01(0x88, 0x88, 0x88),
    dotLine: rgb01(0x99, 0x99, 0x99),
    box:     rgb01(0x16, 0xa3, 0x4a),
    cellBd:  rgb01(0xe5, 0xe7, 0xeb),
    white:   rgb01(0xff, 0xff, 0xff),
    road:    rgb01(0xd1, 0xd5, 0xdb),
    black:   rgb01(0x11, 0x11, 0x11),
    // Auto-Farben (wie App: CARCOL)
    carA:    rgb01(0xdc, 0x26, 0x26),
    carB:    rgb01(0x25, 0x63, 0xeb),
    carC:    rgb01(0x16, 0xa3, 0x4a),
    carD:    rgb01(0xf5, 0x9e, 0x0b),
    // Schilder-Mini
    signYel: rgb01(0xf7, 0xd1, 0x17),
    signRed: rgb01(0xd4, 0x00, 0x00),
  };
  function rgb01(r,g,b){ return {r:r/255,g:g/255,b:b/255}; }
  function col(c){ return c ? global.PDFLib.rgb(c.r,c.g,c.b) : undefined; }

  function makeCtx(page, fonts) {
    return {
      page, fonts,
      rect(x, yTop, w, h, o) {
        o = o || {};
        page.drawRectangle({
          x, y: PT.pageH - yTop - h, width: w, height: h,
          color: col(o.fill), borderColor: col(o.stroke),
          borderWidth: o.strokeWidth || 0, opacity: o.opacity,
          rotate: o.rotate, // unused
        });
      },
      line(x1, y1, x2, y2, o) {
        o = o || {};
        page.drawLine({
          start:{x:x1, y:PT.pageH-y1}, end:{x:x2, y:PT.pageH-y2},
          thickness:o.w||1, color:col(o.color)||col(C.ink),
          dashArray:o.dash||undefined,
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
        page.drawSvgPath(d, {
          x, y: PT.pageH - yTop, scale,
          color: col(o.fill), borderColor: col(o.stroke),
          borderWidth: o.strokeWidth || 0,
        });
      },
      image(img, x, yTop, w, h) {
        page.drawImage(img, { x, y: PT.pageH - yTop - h, width: w, height: h });
      },
      textWidth(str, font, size){ return (font||fonts.regular).widthOfTextAtSize(String(str), size); },
      fonts,
    };
  }

  // ---- HTML-Entities (Daten enthalten &auml; etc.) -----------------
  function de(s) {
    return String(s)
      .replace(/&auml;/g,'ä').replace(/&ouml;/g,'ö').replace(/&uuml;/g,'ü')
      .replace(/&Auml;/g,'Ä').replace(/&Ouml;/g,'Ö').replace(/&Uuml;/g,'Ü')
      .replace(/&szlig;/g,'ß').replace(/&amp;/g,'&').replace(/&#8211;/g,'–')
      .replace(/&#8230;/g,'…').replace(/&nbsp;/g,' ');
  }

  function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

  // =================================================================
  //  HEADER
  // =================================================================
  function drawHeader(ctx, opts, klasse) {
    const F = ctx.fonts;
    const top = PT.marginY;
    ctx.text('Verkehr & Sicherheit', PT.marginX, top, { font: F.heavy, size: 14, color: C.green });
    ctx.text('Im Straßenverkehr · Klasse ' + (klasse||''), PT.marginX, top + 18,
             { font: F.regular, size: 8, color: C.sub });
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
  //  FLOW (fließender Seitenumbruch)
  // =================================================================
  function makeFlow(pdf, fonts, opts, klasse) {
    let page = pdf.addPage([PT.pageW, PT.pageH]);
    let ctx = makeCtx(page, fonts);
    let y = drawHeader(ctx, opts, klasse);
    const bottom = PT.pageH - PT.marginY;
    return {
      get ctx(){ return ctx; },
      get y(){ return y; }, set y(v){ y = v; },
      ensure(h){ if (y + h > bottom) this.newPage(); },
      newPage(){ page = pdf.addPage([PT.pageW, PT.pageH]); ctx = makeCtx(page, fonts); y = drawHeader(ctx, opts, klasse); },
      remaining(){ return bottom - y; },
      bottom,
    };
  }

  function sectionTitle(flow, txt, minFollow) {
    // ensure ZUERST – erst danach flow.ctx holen, da newPage den ctx wechselt
    flow.ensure(22 + (minFollow || 0));
    const ctx = flow.ctx;
    flow.y += 4;
    ctx.text(txt, PT.marginX, flow.y, { font: ctx.fonts.heavy, size: 9.5, color: C.green });
    flow.y += 13;
    ctx.line(PT.marginX, flow.y, PT.pageW - PT.marginX, flow.y, { color: C.greenLn, w: 1.2 });
    flow.y += 6;
  }

  // =================================================================
  //  KREUZUNG (SVG-Vektor): Autos + Mini-Schilder
  // =================================================================
  function carColor(label){ return {A:C.carA,B:C.carB,C:C.carC,D:C.carD}[label] || C.carA; }

  function drawCar(ctx, x, y, heading, label, color) {
    // heading: N/E/S/W -> Rotation. Auto zeigt standardmäßig nach N (oben).
    // Wir zeichnen vereinfacht ein Rechteck + Dreieck (Fahrtrichtung) + Label.
    // Da pdf-lib-Rotation um Translation komplex ist, zeichnen wir die vier
    // Richtungen explizit als Polygon-Pfade.
    const c = color;
    // Karosserie-Halbmaße
    const bw = 9, bh = 14, tw = 6, th = 8;
    let body, nose;
    if (heading === 'N') {
      body = `M ${x-bw} ${y-bh} L ${x+bw} ${y-bh} L ${x+bw} ${y+bh} L ${x-bw} ${y+bh} Z`;
      nose = `M ${x} ${y-bh-6} L ${x-6} ${y-bh} L ${x+6} ${y-bh} Z`;
    } else if (heading === 'S') {
      body = `M ${x-bw} ${y-bh} L ${x+bw} ${y-bh} L ${x+bw} ${y+bh} L ${x-bw} ${y+bh} Z`;
      nose = `M ${x} ${y+bh+6} L ${x-6} ${y+bh} L ${x+6} ${y+bh} Z`;
    } else if (heading === 'E') {
      body = `M ${x-bh} ${y-bw} L ${x+bh} ${y-bw} L ${x+bh} ${y+bw} L ${x-bh} ${y+bw} Z`;
      nose = `M ${x+bh+6} ${y} L ${x+bh} ${y-6} L ${x+bh} ${y+6} Z`;
    } else { // W
      body = `M ${x-bh} ${y-bw} L ${x+bh} ${y-bw} L ${x+bh} ${y+bw} L ${x-bh} ${y+bw} Z`;
      nose = `M ${x-bh-6} ${y} L ${x-bh} ${y-6} L ${x-bh} ${y+6} Z`;
    }
    // svgPath nutzt y-Spiegelung über die Page; wir zeichnen relativ zu (0,topY=0)
    // -> einfacher: direkt mit absoluten Koordinaten, yTop=0 als Bezug.
    ctx.svgPath(body, 0, 0, 1, { fill: c });
    ctx.svgPath(nose, 0, 0, 1, { fill: c });
    // Fenster (weiß, halbtransparent-Ersatz: helles Weiß)
    ctx.rect(x-6, y-5, 12, 7, { fill: C.white });
    // Label
    ctx.textCentered(label, x, y-4, { font: ctx.fonts.heavy, size: 8, color: C.white });
  }

  function drawMiniSign(ctx, x, y, typ) {
    if (typ === 'vorfahrtstrasse') {
      // Raute weiß mit gelbem Kern
      ctx.svgPath(`M ${x} ${y-9} L ${x+9} ${y} L ${x} ${y+9} L ${x-9} ${y} Z`, 0, 0, 1, { fill: C.white, stroke: C.black, strokeWidth: 1.2 });
      ctx.svgPath(`M ${x} ${y-5} L ${x+5} ${y} L ${x} ${y+5} L ${x-5} ${y} Z`, 0, 0, 1, { fill: C.signYel });
    } else if (typ === 'vorfahrt_gewaehren') {
      ctx.svgPath(`M ${x} ${y+8} L ${x+9} ${y-7} L ${x-9} ${y-7} Z`, 0, 0, 1, { fill: C.white, stroke: C.signRed, strokeWidth: 2 });
    } else if (typ === 'stop') {
      ctx.svgPath(`M ${x-5} ${y-9} L ${x+5} ${y-9} L ${x+9} ${y-5} L ${x+9} ${y+5} L ${x+5} ${y+9} L ${x-5} ${y+9} L ${x-9} ${y+5} L ${x-9} ${y-5} Z`, 0, 0, 1, { fill: C.signRed });
      ctx.textCentered('STOP', x, y-3, { font: ctx.fonts.heavy, size: 4.5, color: C.white });
    }
  }

  function drawCrossing(ctx, xLeft, yTop, size, sc) {
    // Viewbox 220x220 -> skaliert auf 'size'
    const s = size / 220;
    const X = v => xLeft + v * s;
    const Y = v => yTop + v * s;
    // weißer Hintergrund
    ctx.rect(xLeft, yTop, size, size, { fill: C.white, stroke: C.cellBd, strokeWidth: 0.8 });
    // Straßen (grau)
    ctx.rect(X(85), Y(0), 50*s, 220*s, { fill: C.road });
    ctx.rect(X(0), Y(85), 220*s, 50*s, { fill: C.road });
    // Mittellinien (weiß gestrichelt)
    [[110,0,110,85],[110,135,110,220],[0,110,85,110],[135,110,220,110]].forEach(l => {
      ctx.line(X(l[0]),Y(l[1]),X(l[2]),Y(l[3]),{ color:C.white, w:1.5, dash:[4,4] });
    });
    // Positionen der Autos / Schilder (aus App)
    const pos = { N:[122,40], S:[98,180], E:[180,98], W:[40,122] };
    const sgn = { N:[140,68], S:[80,152], E:[152,80], W:[68,140] };
    (sc.cars||[]).forEach(c => {
      const p = pos[c[0]];
      drawCar(ctx, X(p[0]), Y(p[1]), c[1], c[2], carColor(c[3]));
    });
    if (sc.schild) {
      for (const arm in sc.schild) {
        const p = sgn[arm];
        drawMiniSign(ctx, X(p[0]), Y(p[1]), sc.schild[arm]);
      }
    }
  }

  // =================================================================
  //  Hilfs-Renderer
  // =================================================================
  function drawNumberedLines(flow, count, cols, rowH, startNo) {
    startNo = startNo || 1;
    const colGap = 6 * MM;
    const colW = (PT.contentW - colGap * (cols - 1)) / cols;
    rowH = rowH || 16;
    const rows = Math.ceil(count / cols);
    for (let r = 0; r < rows; r++) {
      flow.ensure(rowH);
      const ctx = flow.ctx;          // nach evtl. Umbruch aktuellen ctx holen
      const rowY = flow.y;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= count) continue;
        const x = PT.marginX + c * (colW + colGap);
        ctx.text((startNo+idx) + '.', x, rowY, { font: ctx.fonts.heavy, size: 9, color: C.green2 });
        ctx.line(x + 16, rowY + 11, x + colW, rowY + 11, { color: C.dotLine, w: 0.8, dash: [1.5, 1.5] });
      }
      flow.y += rowH;
    }
  }

  // Schild-Raster (PNG-Schilder mit Nummer darunter)
  function drawSignGrid(flow, signs, perRow, withMeaningLine) {
    const gap = 5 * MM;
    const cellW = (PT.contentW - gap * (perRow - 1)) / perRow;
    const imgMax = Math.min(cellW - 8, 70);
    const lineGap = 12;                                   // Abstand Schild -> Schreiblinie
    const labelH = withMeaningLine ? (lineGap + 10) : 14;
    const rows = Math.ceil(signs.length / perRow);
    for (let r = 0; r < rows; r++) {
      const rowH = imgMax + labelH + 8;
      flow.ensure(rowH);
      const ctx = flow.ctx;          // nach evtl. Umbruch aktuellen ctx holen
      const rowY = flow.y;
      for (let c = 0; c < perRow; c++) {
        const idx = r * perRow + c;
        if (idx >= signs.length) continue;
        const cellX = PT.marginX + c * (cellW + gap);
        const s = signs[idx];
        const ar = s.h / s.w;
        const iw = imgMax, ih = imgMax * ar;
        const imgX = cellX + (cellW - iw) / 2;
        ctx.text((idx+1) + '.', cellX, rowY, { font: ctx.fonts.heavy, size: 9, color: C.green2 });
        if (s._img) ctx.image(s._img, imgX, rowY + 10, iw, ih);
        const afterImg = rowY + 10 + ih;
        if (withMeaningLine) {
          ctx.line(cellX + 4, afterImg + lineGap, cellX + cellW - 4, afterImg + lineGap, { color: C.dotLine, w: 0.8, dash: [1.5,1.5] });
        }
      }
      flow.y += rowH;
    }
  }

  // =================================================================
  //  HAUPTFUNKTION
  // =================================================================
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
    const VK = global.VK_DATA;
    const klasse = spec.klasse || 3;
    let types = spec.types && spec.types.length ? spec.types : ['erkennen'];
    if ((spec.numPages || 1) >= 2) { types = types.concat(types); }
    const count = spec.count || 6;

    // Schild-Schlüssel passend zur Klasse
    const signKeys = Object.keys(VK.SIGNS).filter(k => klasse >= VK.SIGNS[k].kl);

    // PNG-Bilder vorab einbetten (nur die, die wir brauchen: alle passenden)
    const imgCache = {};
    async function getSignImg(k) {
      if (imgCache[k] !== undefined) return imgCache[k];
      try {
        const bytes = b64ToBytes(VK.SIGNS[k].img);
        imgCache[k] = await pdf.embedPng(bytes);
      } catch (e) { imgCache[k] = null; }
      return imgCache[k];
    }

    // Fahrrad-PNG
    let bikeImg = null;
    if (global.BIKE_IMG) {
      try { bikeImg = await pdf.embedPng(b64ToBytes(global.BIKE_IMG)); } catch(e){ bikeImg = null; }
    }

    const flow = makeFlow(pdf, fonts, opts, klasse);
    const solBlocks = [];

    for (const ty of types) {
      if (ty === 'erkennen') {
        const ks = shuffle(signKeys).slice(0, Math.min(count, signKeys.length));
        sectionTitle(flow, 'Was bedeutet dieses Schild? Schreibe es auf.', 90);
        const signs = [];
        for (const k of ks) { signs.push({ w: VK.SIGNS[k].w, h: VK.SIGNS[k].h, _img: await getSignImg(k) }); }
        drawSignGrid(flow, signs, 4, true);
        solBlocks.push({ t: 'Schilder erkennen', items: ks.map((k,i)=>(i+1)+'. '+de(VK.SIGNS[k].name)) });
      }
      else if (ty === 'mc') {
        const ks = shuffle(signKeys).slice(0, Math.min(count, signKeys.length));
        sectionTitle(flow, 'Kreuze die richtige Bedeutung an.', 50);
        for (let i = 0; i < ks.length; i++) {
          const k = ks[i];
          const correct = de(VK.SIGNS[k].name);
          const others = shuffle(signKeys.filter(x => x !== k)).slice(0,2).map(x => de(VK.SIGNS[x].name));
          const options = shuffle([correct].concat(others));
          const img = await getSignImg(k);
          const ar = VK.SIGNS[k].h / VK.SIGNS[k].w;
          const iw = 34, ih = 34 * ar;
          const blockH = Math.max(ih, options.length * 13) + 10;
          flow.ensure(blockH);
          const ctx = flow.ctx;
          const rowY = flow.y;
          ctx.text((i+1)+'.', PT.marginX, rowY, { font: ctx.fonts.heavy, size: 9.5, color: C.green2 });
          if (img) ctx.image(img, PT.marginX + 16, rowY, iw, ih);
          let oy = rowY;
          const ox = PT.marginX + 16 + iw + 10;
          options.forEach(o => {
            ctx.rect(ox, oy + 1, 9, 9, { stroke: C.box, strokeWidth: 1.1 });
            ctx.text(o, ox + 13, oy, { font: ctx.fonts.regular, size: 9, color: C.ink });
            oy += 13;
          });
          flow.y += blockH;
        }
        solBlocks.push({ t: 'Multiple Choice', items: ks.map((k,i)=>(i+1)+'. '+de(VK.SIGNS[k].name)) });
      }
      else if (ty === 'sort') {
        const ks = shuffle(signKeys).slice(0, Math.min(count + 2, signKeys.length));
        sectionTitle(flow, 'Sortiere die Schilder. Schreibe die Nummern in die richtige Spalte.', 80);
        // Schild-Raster (mit Nummern)
        const signs = [];
        for (const k of ks) signs.push({ w: VK.SIGNS[k].w, h: VK.SIGNS[k].h, _img: await getSignImg(k) });
        drawSignGrid(flow, signs, 5, false);
        // Kategorie-Spalten
        flow.y += 4;
        const cats = Object.keys(VK.KAT_LABEL);
        const colW = (PT.contentW - 6*(cats.length-1)) / cats.length;
        flow.ensure(60);
        const ctx = flow.ctx;
        const rowY = flow.y;
        cats.forEach((cat, i) => {
          const x = PT.marginX + i * (colW + 6);
          ctx.rect(x, rowY, colW, 54, { stroke: C.cellBd, strokeWidth: 1 });
          ctx.textCentered(de(VK.KAT_LABEL[cat]), x + colW/2, rowY + 4, { font: ctx.fonts.bold, size: 7.5, color: C.green });
        });
        flow.y += 60;
        solBlocks.push({ t: 'Sortieren', items: ks.map((k,i)=>(i+1)+'. '+de(VK.SIGNS[k].name)+' ('+de(VK.KAT_LABEL[VK.SIGNS[k].kat]||VK.SIGNS[k].kat)+')') });
      }
      else if (ty === 'vorfahrt') {
        const pool = VK.SCENARIOS.filter(s => klasse >= s.klasse);
        const chosen = shuffle(pool).slice(0, Math.min(4, pool.length));
        sectionTitle(flow, 'Wer fährt zuerst? Schreibe die Reihenfolge auf.', 205);
        const cross = 150;
        const perRow = 2;
        const cellW = (PT.contentW - 6*MM) / perRow;
        const cellH = cross + 40;
        const rowGap = 4 * MM;
        for (let r = 0; r < Math.ceil(chosen.length / perRow); r++) {
          flow.ensure(cellH + rowGap);
          const ctx = flow.ctx;
          const rowTop = flow.y;
          for (let cI = 0; cI < perRow; cI++) {
            const idx = r * perRow + cI;
            if (idx >= chosen.length) continue;
            const sc = chosen[idx];
            const x = PT.marginX + cI * (cellW + 6*MM);
            ctx.rect(x, rowTop, cellW, cellH - 6, { stroke: C.cellBd, strokeWidth: 1 });
            // Frage (evtl. umgebrochen)
            const qLines = wrapText(ctx, (idx+1)+'. '+de(sc.frage), ctx.fonts.bold, 7.5, cellW - 8);
            qLines.slice(0,2).forEach((ln, li) => ctx.text(ln, x + 4, rowTop + 4 + li*9, { font: ctx.fonts.bold, size: 7.5, color: C.ink }));
            const crossX = x + (cellW - cross) / 2;
            drawCrossing(ctx, crossX, rowTop + 22, cross, sc);
            ctx.text('Reihenfolge:', x + 4, rowTop + cross + 26, { font: ctx.fonts.regular, size: 8, color: C.ink });
            ctx.line(x + 62, rowTop + cross + 34, x + cellW - 6, rowTop + cross + 34, { color: C.dotLine, w: 0.8, dash:[1.5,1.5] });
          }
          flow.y = rowTop + cellH + rowGap;
        }
        solBlocks.push({ t: 'Vorfahrt', items: chosen.map((sc,i)=>(i+1)+'. '+de(sc.loesung)) });
      }
      else if (ty === 'fahrrad') {
        const G = global.BIKE_GEO;
        const pts = global.BIKE_PTS || [];
        const imgW = Math.min(PT.contentW, 360);
        const imgH = imgW * G.VBH / G.VBW;
        const linesH = Math.ceil(pts.length/2) * 15 + 10;
        // Titel + Bild + Linien als EINE Einheit sichern (sonst verwaister Titel)
        flow.ensure(22 + imgH + linesH);
        sectionTitle(flow, 'Wie heißen die Teile am verkehrssicheren Fahrrad? Schreibe sie auf.');
        const ctx = flow.ctx;
        const imgX = PT.marginX + (PT.contentW - imgW) / 2;
        const imgY = flow.y;
        const s = imgW / G.VBW;
        if (bikeImg) ctx.image(bikeImg, imgX + G.M*s, imgY + G.M*s, G.W*s, G.H*s);
        pts.forEach((p, i) => {
          const zx = imgX + (p[1] + G.M) * s, zy = imgY + (p[2] + G.M) * s;
          const lx = imgX + (p[3] + G.M) * s, ly = imgY + (p[4] + G.M) * s;
          ctx.line(zx, zy, lx, ly, { color: C.green, w: 1.2 });
          ctx.circle(zx, zy, 2.4, { fill: C.green });
          ctx.circle(lx, ly, 8, { fill: C.white, stroke: C.green, strokeWidth: 1.6 });
          ctx.textCentered(String(i+1), lx, ly - 4.5, { font: ctx.fonts.heavy, size: 8, color: C.green });
        });
        flow.y = imgY + imgH + 6;
        drawNumberedLines(flow, pts.length, 2, 15, 1);
        solBlocks.push({ t: 'Fahrrad', items: pts.map((p,i)=>(i+1)+'. '+de(p[0])) });
      }
      else if (ty === 'verhalten') {
        const pool = VK.VERHALTEN.filter(v => klasse >= v[2]);
        const chosen = shuffle(pool).slice(0, Math.min(8, pool.length));
        sectionTitle(flow, 'Richtig oder falsch? Kreuze an.', 30);
        // Kopf
        flow.ensure(14);
        let ctx = flow.ctx;
        const headY = flow.y;
        ctx.text('Aussage', PT.marginX + 16, headY, { font: ctx.fonts.bold, size: 8, color: C.sub });
        ctx.text('richtig', PT.pageW - PT.marginX - 78, headY, { font: ctx.fonts.bold, size: 8, color: C.sub });
        ctx.text('falsch', PT.pageW - PT.marginX - 34, headY, { font: ctx.fonts.bold, size: 8, color: C.sub });
        flow.y += 13;
        chosen.forEach((v, i) => {
          const txt = de(v[0]);
          // Zeilenhöhe je nach Textlänge (einfacher Umbruch)
          const maxTextW = PT.contentW - 16 - 90;
          const lines = wrapText(ctx, txt, ctx.fonts.regular, 8.5, maxTextW);
          const rowH = Math.max(14, lines.length * 10 + 6);
          flow.ensure(rowH);
          ctx = flow.ctx;
          const rowY = flow.y;
          ctx.text((i+1)+'.', PT.marginX, rowY, { font: ctx.fonts.heavy, size: 8.5, color: C.green2 });
          lines.forEach((ln, li) => ctx.text(ln, PT.marginX + 16, rowY + li*10, { font: ctx.fonts.regular, size: 8.5, color: C.ink }));
          // Kästchen richtig/falsch
          ctx.rect(PT.pageW - PT.marginX - 70, rowY, 10, 10, { stroke: C.box, strokeWidth: 1.1 });
          ctx.rect(PT.pageW - PT.marginX - 28, rowY, 10, 10, { stroke: C.box, strokeWidth: 1.1 });
          flow.y += rowH;
        });
        solBlocks.push({ t: 'Verhalten', items: chosen.map((v,i)=>(i+1)+'. '+(v[1]?'richtig':'falsch')) });
      }
    }

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
        const lines = wrapText(ctx, txt, ctx.fonts.regular, 7.5, PT.contentW);
        lines.forEach(ln => {
          flow.ensure(10);
          ctx = flow.ctx;
          ctx.text(ln, PT.marginX, flow.y, { font: ctx.fonts.regular, size: 7.5, color: C.sol });
          flow.y += 10;
        });
        flow.y += 2;
      });
    }

    return await pdf.save();
  }

  // ---- Helfer -----------------------------------------------------
  function wrapText(ctx, text, font, size, maxW) {
    const words = String(text).split(' ');
    const lines = []; let line = '';
    words.forEach(w => {
      const test = line ? line + ' ' + w : w;
      if (ctx.textWidth(test, font, size) > maxW && line) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  function b64ToBytes(b64) {
    const bin = (global.atob ? global.atob(b64) : Buffer.from(b64,'base64').toString('binary'));
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  global.VerkehrPDF = {
    PT, drawCrossing, buildWorksheetPDF,
  };

})(typeof window !== 'undefined' ? window : this);
