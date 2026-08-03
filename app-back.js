/* =====================================================================
   app-back.js  ·  Zurueck-Navigation innerhalb einer App
   © 2026 Sascha Rothenburg

   Ergaenzt back-button.js, ersetzt es aber nicht:
     back-button.js  = Android-Hardware-Taste  ->  history.back()
     app-back.js     = sorgt dafuer, dass dieses history.back() zuerst
                       auf den Startbildschirm der App fuehrt und nicht
                       sofort zurueck in die Fach-/App-Auswahl.

   Prinzip (identisch zu rechendreieck.html / interaktiv-rechendreieck.html,
   dort noch inline geloest):
   Beim ERSTEN Verlassen des Startbildschirms wird genau EIN zusaetzlicher
   History-Eintrag angelegt. Ein Zurueck holt uns per popstate auf den
   Startbildschirm; ein weiteres Zurueck verlaesst die Seite normal.
   Es wird bewusst nur ein einziger Eintrag erzeugt - sonst muesste man
   sich durch jeden einzelnen Tab-Wechsel zurueckklicken.

   Einbinden NACH dem Inline-Script der App, vor </body>:
       <script src="app-back.js"></script>

   Erkannt wird automatisch:
     - window.showTab(name)  -> Startbildschirm 'gen'        (Generator-Apps)
     - window.show(screen)   -> Startbildschirm 'scr-start'  (Interaktiv-Apps)
   Abweichender Startbildschirm bei Bedarf vor dem Einbinden setzen:
       <script>window.APP_BACK_START='...';</script>

   Ohne passende Funktion passiert nichts - die Datei ist damit gefahrlos
   in jede App einbindbar.
   ===================================================================== */

(function (global) {
  'use strict';

  var fnName = null;   // 'showTab' oder 'show'
  var START = null;    // Name des Startbildschirms
  var cur = null;      // aktuell sichtbarer Bildschirm
  var inSub = false;   // liegt unser zusaetzlicher History-Eintrag vor?

  function detect() {
    if (typeof global.showTab === 'function') { fnName = 'showTab'; START = 'gen'; return true; }
    if (typeof global.show === 'function') { fnName = 'show'; START = 'scr-start'; return true; }
    return false;
  }

  /* Ruft die (umhuellte) Anzeigefunktion der App auf. */
  function go(name) {
    try { global[fnName](name); } catch (e) {}
  }

  /* Eine Ebene nach oben: aus einem Unterbildschirm zum Start, sonst nichts.
     Rueckgabe true = wir haben die Navigation uebernommen.
     Wird NICHT automatisch an den "Zurueck"-Knopf der Kopfzeile gehaengt -
     der soll bewusst immer direkt zum Akkordeon der Fachseite fuehren.
     Bei Bedarf in einer App selbst verdrahten:
         btn.addEventListener('click',function(e){ if(appGoUp()) e.preventDefault(); }); */
  function goUp() {
    if (cur !== null && cur !== START) {
      if (inSub) { global.history.back(); }  /* popstate zeigt den Start */
      else { go(START); }
      return true;
    }
    return false;
  }

  function init() {
    if (!detect()) return;
    if (typeof global.APP_BACK_START === 'string') START = global.APP_BACK_START;

    cur = START;

    /* Anzeigefunktion umhuellen: Original bleibt unveraendert, wir haengen
       nur die History-Buchfuehrung an. */
    var orig = global[fnName];
    global[fnName] = function (name) {
      var result = orig.apply(this, arguments);
      cur = name;
      if (name !== START) {
        if (!inSub) {
          try { global.history.pushState({ appBack: 1 }, ''); } catch (e) {}
          inSub = true;
        }
      } else {
        inSub = false;
      }
      return result;
    };

    global.addEventListener('popstate', function () {
      if (inSub) { inSub = false; go(START); }
    });

    /* Fuer eigene Knoepfe in der App nutzbar. */
    global.appGoUp = goUp;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
