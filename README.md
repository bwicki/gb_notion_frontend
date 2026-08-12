# Ballastbuch

Erfassungstool für Gasballonfahrten: Ballastverbrauch, ATC-Meldungen, Crew-Status.
Läuft als installierbare Web-App auf dem iPad, schreibt jede Zeile mit Zeit und GPS-Position
in eine JSON- und eine CSV-Datei im GitHub-Repository. Notion pollt diese Dateien.

Kein Build, keine Abhängigkeiten, keine externen Requests außer zur GitHub-API.
Nach dem ersten Laden vollständig offline bedienbar.

---

## 1. Einrichten

**Repository und Hosting**

1. Dateien in ein Repository legen (öffentlich oder privat).
2. Settings → Pages → Source: `Deploy from a branch`, Branch `main`, Ordner `/ (root)`.
3. App liegt danach unter `https://<benutzer>.github.io/<repo>/`.

Bei privatem Repository funktioniert Pages nur mit GitHub Pro/Team. Alternative:
Repository öffentlich lassen und den Ordner `data/` per `.gitignore` leer halten ist
**nicht** möglich, da die App genau dorthin schreibt. Wer die Fahrtdaten nicht öffentlich
haben will, hostet die App in einem öffentlichen Repo und lässt die App in ein zweites,
privates Datenrepo schreiben — das Feld „Repository" im Setup kann ein beliebiges Repo sein.

**Token**

Fine-grained Personal Access Token anlegen unter
Settings → Developer settings → Personal access tokens → Fine-grained tokens:

- Repository access: nur das Datenrepository
- Permissions → Repository permissions → **Contents: Read and write**
- Ablaufdatum knapp setzen, z. B. eine Woche nach der Fahrt

Mehr Rechte braucht die App nicht.

**In der App**

Setup-Reiter ausfüllen: Kennung der Fahrt, Rufzeichen, beide Piloten, Startballast,
Sacktafel (die kg-Werte der Schnelltasten), Repository (`benutzer/repo`), Branch, Ordner, Token.
Dann „Verbindung prüfen" und „Einstellungen sichern".

## 2. Auf dem iPad installieren

Safari öffnen → Teilen → **Zum Home-Bildschirm**. Danach erscheint das Ballon-Symbol,
die App startet ohne Safari-Leisten im Vollbild.

Beim ersten Eintrag fragt iPadOS nach der Standortfreigabe. „Beim Verwenden der App"
genügt. Ohne Freigabe werden Einträge weiterhin gespeichert, nur ohne Koordinaten —
das Feld `gps_fix` steht dann auf `false`.

## 3. Schwebend über anderen Apps

iPadOS erlaubt keiner Web-App ein systemweites Overlay. Was tatsächlich geht:

| Weg | Ergebnis |
|---|---|
| **Slide Over** — App vom Dock über eine laufende App ziehen | schmales, schwebendes Fenster über Karte, Wetter oder Foreflight; mit einer Wischgeste an den Rand weggeschoben und wieder hervorgeholt |
| **Split View** | fest geteilter Bildschirm, App dauerhaft sichtbar |
| **Stage Manager** (iPadOS 16+) | frei platzierbares, überlappendes Fenster |

Voraussetzung für alle drei: die App muss vom Home-Bildschirm installiert sein.

Zusätzlich hat die App eine eigene Minimierung: Der Knopf oben rechts klappt die
Oberfläche zu einem runden Regler zusammen, der den Restballast und den Füllstand zeigt.
Der Regler lässt sich frei über den Bildschirm ziehen; ein Tippen öffnet die App wieder.
Innerhalb eines Slide-Over-Fensters ist das der praktikable Dauerzustand.

## 4. Was die App schreibt

Zwei Dateien pro Fahrt, Dateiname aus der Fahrtkennung:

```
data/<fahrtkennung>.json
data/<fahrtkennung>.csv
```

Beide enthalten denselben Datenbestand, chronologisch nach `ts_utc` sortiert.

### Spalten

| Feld | Inhalt |
|---|---|
| `flight_id` | Kennung der Fahrt |
| `callsign` | Rufzeichen |
| `seq` | laufende Nummer auf dem erfassenden Gerät |
| `device` | Gerätekürzel, trennt Einträge bei zwei iPads |
| `ts_utc` | Zeitpunkt UTC, ISO 8601 |
| `ts_local` | derselbe Zeitpunkt mit Ortszeitversatz |
| `type` | `BALLAST`, `TALLY`, `ATC`, `CREW`, `NOTE` |
| `lat`, `lon` | Position in Grad, 6 Nachkommastellen |
| `alt_gps_m` | GPS-Höhe in Metern (nicht barometrisch) |
| `gps_acc_m` | gemeldete Genauigkeit in Metern |
| `gps_age_s` | Alter des Fixes zum Zeitpunkt des Eintrags |
| `gps_fix` | `true`, wenn eine Position anlag |
| `ballast_delta_kg` | relative Änderung, Abwurf negativ, Aufnahme positiv |
| `ballast_abs_kg` | Bestand nach diesem Eintrag |
| `atc_dir` | `RX` empfangen, `TX` gesendet |
| `atc_station`, `atc_freq`, `atc_squawk`, `atc_msg` | Meldungsinhalt |
| `crew_pic` | verantwortliche Führung zum Zeitpunkt des Eintrags |
| `crew_rest` | wer ruht, leer wenn beide wach |
| `note` | freie Bemerkung |
| `id` | UUID, stabiler Schlüssel für Notion |

### Ballastlogik

`ballast_abs_kg` wird fortgeschrieben: Startwert aus dem Setup, jeder `BALLAST`-Eintrag
addiert sein `ballast_delta_kg`. Ein `TALLY`-Eintrag setzt den Bestand auf den physisch
gezählten Wert; alle folgenden Abwürfe rechnen ab dort weiter. So bleibt die Rechnung
korrekt, auch wenn zwischendurch unprotokolliert Sand ausgeworfen wurde.

Jede Zeile trägt ihren eigenen `ballast_abs_kg`, Notion muss nichts nachrechnen.

## 5. Aus Notion pollen

Zwei Endpunkte, unterschiedliche Aktualität:

**GitHub-API — sofort aktuell, empfohlen**

```
GET https://api.github.com/repos/<benutzer>/<repo>/contents/data/<fahrtkennung>.json
Authorization: Bearer <token>
Accept: application/vnd.github.raw
```

Mit `Accept: application/vnd.github.raw` kommt der Dateiinhalt direkt, ohne Base64-Umweg.
Limit: 5000 Anfragen pro Stunde und Token. Ein Poll-Intervall von 30 Sekunden reicht
für eine Fahrt weit aus.

**raw.githubusercontent.com — nur für öffentliche Repos, aber verzögert**

```
GET https://raw.githubusercontent.com/<benutzer>/<repo>/main/data/<fahrtkennung>.csv
```

Dieser Endpunkt liegt hinter einem CDN mit rund fünf Minuten Cache. Für eine
Live-Verfolgung während der Fahrt zu langsam, für die Nachbereitung völlig ausreichend.

**Auf Notion-Seite**

`id` als eindeutigen Schlüssel verwenden und beim Import upserten, nicht anhängen.
Die Datei enthält immer den vollständigen Stand, nicht nur die neuen Zeilen — bei
reinem Anhängen entstehen Dubletten.

## 6. Offline und Übertragung

Jeder Eintrag geht zuerst in den lokalen Speicher des iPads und bleibt dort, bis er
bestätigt übertragen ist. Der Punkt rechts an jeder Zeile im Bordbuch zeigt den Stand:
gelb offen, grün übertragen. Die Statusleiste nennt die Zahl der offenen Zeilen.

Ohne Netz wird nichts verworfen. Sobald wieder Verbindung besteht, überträgt die App
automatisch — sofern „Auto-Übertragung" an ist — und zusätzlich einmal pro Minute,
solange offene Zeilen vorliegen.

Beim Übertragen liest die App die Datei auf GitHub, führt sie über die `id` mit dem
lokalen Bestand zusammen und schreibt das Ergebnis zurück. Zwei iPads auf derselben
Fahrt überschreiben sich dadurch nicht gegenseitig, solange sie nicht in derselben
Sekunde senden.

Über „CSV sichern" und „JSON sichern" lässt sich der Stand jederzeit ohne Netz in
die Dateien-App exportieren.

## 7. Grenzen, die vor dem Start bekannt sein sollten

- **GPS im Hintergrund:** Sobald die App nicht im Vordergrund ist und das Display sperrt,
  hält iPadOS die Standortabfrage an. Die App fordert eine Wake-Lock an, damit das
  Display bei aktiver App nicht sperrt. Für eine lückenlose Track-Aufzeichnung ist ein
  eigenes Loggergerät die richtige Wahl — diese App protokolliert Ereignisse, keinen Track.
- **Höhe:** `alt_gps_m` ist die GPS-Höhe über dem WGS84-Ellipsoid, nicht der Höhenmesserwert.
  Für Meldungen an ATC ist der Höhenmesser maßgeblich, nicht dieses Feld.
- **Token auf dem Gerät:** Der Token liegt unverschlüsselt im lokalen Speicher des Browsers.
  Bei Verlust des iPads reicht ein Widerruf des Tokens auf GitHub. Wer das vermeiden will,
  schaltet einen Cloudflare Worker als Proxy davor, der den Token serverseitig hält; das
  Feld „Repository" bleibt dann leer und der API-Host wird im Code auf den Worker gesetzt.
- **Der Regler schwebt nur innerhalb der App.** Ein Overlay über fremden Apps ist auf
  iPadOS ohne native App nicht möglich; Slide Over ist der vorgesehene Weg (Abschnitt 3).

## 8. Bedienung während der Fahrt

Der Nachtmodus im Setup schaltet die Oberfläche auf Rot auf Schwarz und erhält das
Dunkelsehen. Der Quittungston bestätigt jeden Eintrag, damit ein Abwurf ohne Blick
aufs Display erfasst werden kann.

Die Schnelltasten im Ballast-Reiter tragen sofort ein, ohne Rückfrage — eine Berührung,
eine Zeile. Der Wert stammt aus der Sacktafel im Setup; sinnvoll ist, dort die tatsächlich
an Bord befindlichen Sackgrößen einzutragen.

Im Crew-Reiter erzeugen „Wechsel" und „Ruhe" jeweils einen Eintrag und ändern gleichzeitig
den Stand, der allen folgenden Einträgen mitgegeben wird.

## 9. Dateien

```
index.html                  vollständige App
manifest.webmanifest        Installation auf dem Home-Bildschirm
sw.js                       Offline-Cache
icons/                      App-Symbole
data/                       Zielordner der Fahrtdateien
```
