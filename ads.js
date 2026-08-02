/* ===========================================================================
   ads.js  ·  Zentrale AdMob-Steuerung für alle Grundschul-Apps
   © 2026 Sascha Rothenburg

   Einbinden in jede App, VOR </body>:
       <script src="ads.js"></script>

   Verhalten:
   - Läuft NUR im nativen Capacitor-Wrapper. Im normalen Browser (Netlify)
     passiert nichts -> die Web-Version bleibt unverändert.
   - Zeigt ein Adaptive Banner oben (TOP_CENTER).
   - Liest die echte Bannerhöhe aus und setzt sie als CSS-Variable --ad-top
     auf :root, damit der Header darunter Platz lassen kann.

   WICHTIG: Solange getestet wird, NUR die Test-Ad-Unit-ID verwenden.
   Eigene Klicks auf echte Anzeigen führen zur AdMob-Sperre!
   =========================================================================== */
(function () {
  'use strict';

  // --- Test-IDs von Google (während der Entwicklung verwenden!) ---
  var TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/9214589741';
  // var TEST_BANNER_IOS  = 'ca-app-pub-3940256099942544/2435281174';

  // --- Echte Ad-Unit-ID (erst beim Release eintragen, Test-ID auskommentieren) ---
  // var LIVE_BANNER_ANDROID = 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ';

  var BANNER_AD_ID = TEST_BANNER_ANDROID;   // <- beim Release auf LIVE_... umstellen
  var USE_TEST_ADS = true;                  // <- beim Release auf false setzen

  // Standard-Reserve, bis die echte Höhe vom SDK gemeldet wird (px).
  var FALLBACK_AD_HEIGHT = 56;

  function setAdTop(px) {
    document.documentElement.style.setProperty('--ad-top', (px || 0) + 'px');
  }

  // CSS-Variable existiert immer; im Browser bleibt sie 0.
  setAdTop(0);

  // --- Native-Erkennung (robust über mehrere Wege) ---
  // Manche Capacitor-Versionen liefern isNativePlatform() nicht zuverlässig,
  // aber getPlatform() gibt 'android' / 'ios' zurück. Beides akzeptieren.
  function isNative() {
    var c = window.Capacitor;
    if (!c) return false;
    var p = null;
    try { if (typeof c.getPlatform === 'function') p = c.getPlatform(); } catch (e) {}
    if (p === 'android' || p === 'ios') return true;
    try { if (typeof c.isNativePlatform === 'function' && c.isNativePlatform()) return true; } catch (e) {}
    if (c.platform === 'android' || c.platform === 'ios') return true;
    return false;
  }

  // Wenn nicht nativ -> reine Web-Ansicht, nichts tun.
  if (!isNative()) {
    return;
  }

  var Cap = window.Capacitor;

  // Wir sind im nativen Wrapper -> SOFORT Banner-Platz reservieren,
  // BEVOR irgendwas anderes passiert (unabhängig vom Plugin-/Banner-Timing).
  // So wird der Header nie vom Banner überdeckt, auch nicht beim Kaltstart
  // der Startseite (index.html).
  document.documentElement.classList.add('cap-native');
  setAdTop(FALLBACK_AD_HEIGHT);

  // AdMob-Plugin holen.
  var plugins = Cap.Plugins || {};
  var AdMob = plugins.AdMob;
  if (!AdMob) {
    console.warn('[ads] AdMob-Plugin nicht gefunden. npm i @capacitor-community/admob & npx cap sync');
    return;
  }

  // Enum-Werte als String-Fallbacks (das Plugin akzeptiert die String-Literale).
  var ADAPTIVE = 'ADAPTIVE_BANNER';
  var TOP = 'TOP_CENTER';

  async function initAds() {
    try {
      await AdMob.initialize({
        initializeForTesting: USE_TEST_ADS
      });

      // Banner-Events: echte Höhe übernehmen.
      // Eventname kann je nach Plugin-Version variieren -> beide registrieren.
      var applySize = function (info) {
        var h = (info && (info.height || (info.size && info.size.height))) || FALLBACK_AD_HEIGHT;
        setAdTop(h);
      };
      try { AdMob.addListener('bannerAdLoaded', function () { setAdTop(FALLBACK_AD_HEIGHT); }); } catch (e) {}
      try { AdMob.addListener('bannerAdSizeChanged', applySize); } catch (e) {}

      await AdMob.showBanner({
        adId: BANNER_AD_ID,
        adSize: ADAPTIVE,
        position: TOP,
        margin: 0,
        isTesting: USE_TEST_ADS
      });

      // Falls kein Size-Event kommt: Fallback-Reserve setzen.
      setTimeout(function () {
        var cur = getComputedStyle(document.documentElement).getPropertyValue('--ad-top').trim();
        if (!cur || cur === '0px') setAdTop(FALLBACK_AD_HEIGHT);
      }, 1500);

    } catch (err) {
      console.warn('[ads] Banner konnte nicht geladen werden:', err);
      setAdTop(0);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initAds();
  } else {
    document.addEventListener('DOMContentLoaded', initAds);
  }
})();
