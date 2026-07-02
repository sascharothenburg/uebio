/* =====================================================================
   print-bridge.js  ·  PDF an nativen Druck übergeben
   © 2026 Sascha Rothenburg

   Strategie:
   - In der Capacitor-App: PDF-Bytes -> Datei -> natives Print/Share-Plugin.
     Das druckt über iOS UIPrintInteractionController bzw. Android PrintManager.
     -> identisches Ergebnis auf beiden Plattformen (kein WebKit-Druck).
   - Im Browser (Web-Version):
     - Desktop: PDF in verstecktem iframe öffnen, iframe.print() auslösen.
     - iOS (Safari/Chrome/Firefox – alle WebKit): iframe.print() betrifft auf
       iOS zuverlässig NICHT den iframe-Inhalt, sondern den Top-Level-Kontext
       (bekannter WebKit-Bug: Druckvorschau zeigt kurz das PDF, der
       tatsächliche Ausdruck/Export ist aber falsch/leer). Deshalb auf iOS
       das PDF stattdessen in einem neuen Tab öffnen -> nativer Vollbild-
       PDF-Viewer mit eigenem, zuverlässigem Drucken/Teilen-Button.

   Benötigte Capacitor-Plugins (siehe README):
     @capacitor/filesystem   (PDF temporär speichern)
     @capacitor/share        (Teilen/Drucken-Sheet)  ODER
     ein dediziertes Print-Plugin (z.B. ein eigenes / community).
   ===================================================================== */

(function (global) {
  'use strict';

  function isCapacitor() {
    return !!(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform());
  }

  // iOS erkennen: iPhone/iPod klassisch per UA, iPad ab iPadOS 13 meldet sich
  // als "MacIntel" -> zusätzlich über Touch-Support abgrenzen.
  function isIOS() {
    const ua = global.navigator ? global.navigator.userAgent : '';
    const platform = global.navigator ? global.navigator.platform : '';
    const iPadOS13Plus = platform === 'MacIntel' && global.navigator.maxTouchPoints > 1;
    return /iPad|iPhone|iPod/.test(ua) || iPadOS13Plus;
  }

  function u8ToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  // --- Browser-Fallback (Desktop): verstecktes iframe + print() -------
  function printInBrowserDesktop(bytes, fileName) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = function () {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        window.open(url, '_blank');
      }
      setTimeout(() => { URL.revokeObjectURL(url); iframe.remove(); }, 60000);
    };
  }

  // --- Browser-Fallback (iOS): PDF im neuen Tab öffnen -----------------
  // Kein programmatischer print()-Aufruf – iOS-WebKit druckt sonst den
  // falschen Kontext. Der native PDF-Viewer bringt sein eigenes,
  // zuverlässiges Drucken/Teilen-Icon mit.
  function printInBrowserIOS(bytes, fileName) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      // Popup-Blocker: im selben Tab öffnen als letzter Ausweg
      window.location.href = url;
    }
    // URL bewusst NICHT sofort revoken – iOS lädt den Viewer asynchron;
    // großzügiges Timeout reicht, da der Tab die Blob-Referenz hält.
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60000);
  }

  function printInBrowser(bytes, fileName) {
    if (isIOS()) {
      printInBrowserIOS(bytes, fileName);
    } else {
      printInBrowserDesktop(bytes, fileName);
    }
  }

  // --- Native: speichern + Share/Print-Sheet -------------------------
  async function printNative(bytes, fileName) {
    const FS = global.Capacitor.Plugins.Filesystem;
    const Share = global.Capacitor.Plugins.Share;

    const b64 = u8ToBase64(bytes);

    // 1) PDF in den Cache schreiben
    const writeRes = await FS.writeFile({
      path: fileName,
      data: b64,
      directory: 'CACHE',     // Capacitor Directory.Cache
    });

    const uri = writeRes.uri;

    // 2) Teilen/Drucken-Sheet öffnen (enthält auf iOS & Android "Drucken")
    if (Share && Share.share) {
      await Share.share({
        title: 'Arbeitsblatt',
        url: uri,
        dialogTitle: 'Drucken oder Teilen',
      });
    } else {
      // Fallback: nur Datei geschrieben; App müsste eigenes Print-Plugin nutzen
      console.warn('Share-Plugin fehlt – PDF liegt unter:', uri);
    }
    return uri;
  }

  async function printPDF(bytes, fileName) {
    fileName = fileName || 'Mengen.pdf';
    if (isCapacitor()) {
      try { return await printNative(bytes, fileName); }
      catch (e) { console.error('Nativer Druck fehlgeschlagen:', e); printInBrowser(bytes, fileName); }
    } else {
      printInBrowser(bytes, fileName);
    }
  }

  global.PrintBridge = { printPDF, isCapacitor, isIOS };

})(typeof window !== 'undefined' ? window : this);
