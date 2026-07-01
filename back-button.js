/* =====================================================================
   back-button.js  ·  Android-Hardware-/Gesten-Zurücktaste
   © 2026 Sascha Rothenburg

   Verbindet die native Android-Zurücktaste mit dem normalen Seitenverlauf:
   - Gibt es noch Verlauf (history) -> eine Seite zurück (wie Browser-Zurück).
   - Sind wir auf der ersten Seite (kein Verlauf, z.B. index.html)
     -> App wird beendet (normales Android-Verhalten am Wurzelpunkt).

   Ohne diesen Handler beendet Capacitor die App schon beim ersten Druck
   und man landet sofort im Homescreen – auch mitten in der App.

   Im Browser (kein Capacitor) passiert nichts Schädliches: der Listener
   wird dann gar nicht registriert.
   ===================================================================== */

(function () {
  'use strict';

  function init() {
    // Capacitor App-Plugin vorhanden? (nur in der nativen App)
    var Caps = window.Capacitor;
    if (!Caps || !Caps.Plugins || !Caps.Plugins.App) return;
    var App = Caps.Plugins.App;

    App.addListener('backButton', function (info) {
      // Eine Seite kann sich explizit als Wurzel markieren:
      //   <body data-root="true">  ODER  window.IS_ROOT_PAGE = true
      // Auf der Wurzel (index.html) beendet die Zurücktaste immer die App.
      var isRoot = (document.body && document.body.getAttribute('data-root') === 'true')
        || window.IS_ROOT_PAGE === true;

      var canGoBack = (info && typeof info.canGoBack === 'boolean')
        ? info.canGoBack
        : (window.history.length > 1);

      if (!isRoot && canGoBack) {
        window.history.back();
      } else {
        // Wurzelpunkt oder kein Verlauf -> App beenden
        if (App.exitApp) App.exitApp();
      }
    });
  }

  // Capacitor kann erst nach 'deviceready'/Load bereitstehen
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
