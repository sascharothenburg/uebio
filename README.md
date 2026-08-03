# Übio · Grundschulübungen

Quellcode von [uebio.de](https://uebio.de) – kostenlose Arbeitsblätter und
interaktive Übungen für die Grundschule (Klasse 1–4).

Jede App erzeugt Aufgaben direkt im Browser und gibt sie als PDF aus. Es gibt
keinen Server, keine Nutzerkonten und keine Datenübertragung: Alles läuft auf
dem Gerät des Nutzers.

* **Web:** GitHub Pages, Domain per `CNAME` (uebio.de)
* **Android:** Capacitor-WebView, Paket `de.rothenburg.grundschule`

---

## Inhalt

| Bereich    | Apps | Einstiegsseite     |
|------------|-----:|--------------------|
| Mathematik |   19 | `mathe.html`       |
| Deutsch    |   11 | `deutsch.html`     |
| Englisch   |    5 | `englisch.html`    |
| Sachkunde  |    2 | `sachkunde.html`   |
| Interaktiv |    7 | `interaktiv.html`  |

Die Startseite `index.html` verlinkt die fünf Bereiche und führt in ihrem
`SUBJECTS`-Array die Zähler mit. **Wichtig:** Die Zähler dort müssen zur Zahl
der tatsächlich verlinkten Apps auf der jeweiligen Fachseite passen.

---

## Aufbau

Kein Build-Schritt, keine Abhängigkeiten zum Installieren. Alles ist statisches
HTML/CSS/JavaScript und lässt sich direkt öffnen bzw. ausliefern.

Jede App besteht in der Regel aus zwei Dateien:

```
einmaleins.html        Oberfläche + Aufgabenlogik (inline)
einmaleins-pdf.js      PDF-Erzeugung mit absoluten Koordinaten
```

Die Trennung ist Absicht: Das PDF-Modul rechnet in echten Millimetern und
liefert dadurch auf iOS (WebKit) und Android (Chromium) identische Ergebnisse.

### Gemeinsame Module

| Datei                  | Zweck |
|------------------------|-------|
| `pdf-lib.min.js`       | PDF-Erzeugung |
| `fontkit.umd.min.js`   | Einbetten eigener Schriften ins PDF |
| `pdf.min.js`, `pdf.worker.min.js` | Rendern der Vorschau |
| `print-bridge.js`      | Drucken über `PrintBridge.printPDF()` (nicht `window.print()`) |
| `back-button.js`       | Android-Hardware-Zurücktaste |
| `app-back.js`          | Zurück-Weg innerhalb einer App (erst zum Startbildschirm) |
| `ads.js`               | AdMob-Banner; im Browser wirkungslos, greift nur im Capacitor-Wrapper |
| `grundschrift-font.js` | Grundschrift als Base64 fürs PDF |
| `bienchen-font.js`     | Bienchen SAS (Schreibschrift) als Base64 fürs PDF |
| `fonts.css`            | Nunito lokal aus `fonts/` – **kein** Google-Fonts-CDN |

### Datenmodule

Größere Datenbestände liegen getrennt von der Oberfläche:
`bundeslaender-data.js`, `verkehr-data.js`, `zahlwoerter-core.js`,
`rechendreieck-core.js`, `grammatik-icons.js`.

---

## Konventionen

* **Kein externer Request.** Keine CDNs, keine Google Fonts, keine
  Tracking-Skripte. Amazon-Produktbilder auf `schulmaterialien.html` laden erst
  nach ausdrücklicher Zustimmung (Zwei-Klick-Lösung).
* **Drucken immer über PDF**, nicht über `window.print()`.
* **Vorschau und Druck müssen identisch sein.** Aufgaben deshalb nie innerhalb
  von `pdfSpec()` neu würfeln, sondern zwischenspeichern.
* **Seitenkapazität aus der echten PDF-Geometrie berechnen**, nie schätzen –
  sonst laufen Anzeige und Seitenumbruch auseinander.
* **Gerätetest ist die Wahrheit.** Headless-Chromium bildet die
  Druck-Eigenheiten von iOS-WebKit nicht ab.

### Farben je Fach

| Fach       | Farben |
|------------|--------|
| Mathematik | `#0369a1` / `#0ea5e9` |
| Deutsch    | `#b91c1c` / `#dc2626` |
| Englisch   | `#6d28d9` / `#7c3aed` |
| Sachkunde  | `#15803d` / `#22c55e` |
| Interaktiv | Verlauf Orange → Pink → Violett |

---

## SEO

Jede indexierte Seite trägt `<title>`, `meta description`, `link rel=canonical`
sowie einen Open-Graph- und Twitter-Card-Block. `sitemap.xml` listet alle
öffentlichen Seiten, `robots.txt` verweist darauf.

Beim Anlegen einer neuen App also nicht vergessen:

1. Kachel auf der Fachseite eintragen
2. Zähler in `index.html` erhöhen
3. Meta-Block in der neuen Datei ergänzen
4. Seite in `sitemap.xml` aufnehmen

---

## Lizenzen

Code und Inhalte: © 2026 Sascha Rothenburg. Die erzeugten Arbeitsblätter dürfen
für den eigenen Unterrichts- und Lerngebrauch frei genutzt und ausgedruckt
werden.

Schriften Dritter – Einzelheiten in [`Open_Font_License.txt`](Open_Font_License.txt):

* **Grundschrift** von Christian Urff – CC BY 3.0
* **Bienchen SAS** von Peter Wiegel – SIL Open Font License 1.1
* **Nunito** von The Nunito Project Authors – SIL Open Font License 1.1

---

## Kontakt

Impressum und Kontaktdaten: [uebio.de/impressum.html](https://uebio.de/impressum.html)
