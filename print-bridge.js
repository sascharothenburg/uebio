/* =====================================================================
   print-bridge.js  ·  PDF an nativen Druck übergeben
   © 2026 Sascha Rothenburg

   Strategie:
   - In der Capacitor-App: PDF-Bytes -> Datei -> natives Print/Share-Plugin.
     Das druckt über iOS UIPrintInteractionController bzw. Android PrintManager.
     -> identisches Ergebnis auf beiden Plattformen (kein WebKit-Druck).
   - Im Browser (Entwicklung): PDF in neuem Tab/als Blob öffnen, dann
     der normale Druckdialog. Nur zum Testen des Layouts.

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

  function u8ToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  // --- Browser-Fallback: Blob in neuem Fenster, Druck anstoßen --------
  function printInBrowser(bytes, fileName) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    // iframe-Druck, damit der Dialog direkt erscheint
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = function () {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        // Falls Druck blockiert: einfach im Tab öffnen
        window.open(url, '_blank');
      }
      setTimeout(() => { URL.revokeObjectURL(url); iframe.remove(); }, 60000);
    };
  }

  // --- Native: speichern + Share/Print-Sheet -------------------------
  async function printNative(bytes, fileName) {
    const { Filesystem, Directory } = global.Capacitor.Plugins.Filesystem
      ? { Filesystem: global.Capacitor.Plugins.Filesystem, Directory: undefined }
      : {};

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

  global.PrintBridge = { printPDF, isCapacitor };

})(typeof window !== 'undefined' ? window : this);
