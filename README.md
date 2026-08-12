# GB Notion Frontend — Basket Reporting

An offline version of the Basket Reporting form, for use in the basket during a gas
balloon flight. Same four message types as the Tally form, same submit action, but it
keeps working without signal, adds the timestamp and GPS position to every entry, and
carries the ballast total forward on its own.

Every entry is written to a JSON and a CSV file in a GitHub repository. Notion polls
those files.

No build step, no dependencies, no external requests other than to the GitHub API.

---

## 1. Design

The app is a form, not an instrument panel. One column, one question set at a time,
system typeface, no colour beyond the ink.

Day mode is black on white. Night mode is red on black, which preserves dark adaptation
on a night flight. The sun/moon button in the header switches between them in one tap
and the choice is remembered. On first launch the app follows the iPad's own appearance
setting.

## 2. Set up

**Hosting**

1. Put these files in the repository root.
2. Settings → Pages → Source: `Deploy from a branch`, branch `main`, folder `/ (root)`.
3. The app is served at `https://<owner>.github.io/<repo>/` after about a minute.

**Token**

Settings → Developer settings → Personal access tokens → Fine-grained tokens:

- Repository access: the data repository only
- Permissions → Repository permissions → **Contents: Read and write**
- Short expiry, for example one week after the flight

**In the app**

Open Setup and fill in flight ID, callsign, both pilots, start ballast, bag sizes, then
repository (`owner/repo`), branch, folder and token. Check connection, then Save settings.

The Logo URL field takes the address of the Gas Balloon Switzerland logo used on the Tally
form; it then appears above the readout. Leave it empty to omit it.

## 3. Install on the iPad

Safari → Share → **Add to Home Screen**. The app then launches full screen without
Safari's bars, and location and wake lock work as expected.

Location permission is requested on the first entry. "While Using the App" is enough.
Without it entries are still recorded, with `gps_fix` set to `false`.

## 4. Floating over other apps

iPadOS gives no web app a system-wide overlay. What works:

| Route | Result |
|---|---|
| **Slide Over** — drag the app from the Dock onto a running app | narrow floating window over a map or Foreflight; swipe it off the edge and back |
| **Split View** | fixed split screen |
| **Stage Manager** (iPadOS 16+) | freely placed, overlapping window |

All three need the app installed from the Home Screen.

The header also has a minimise button: it collapses the app to a small pill showing the
kilograms still on board. The pill can be dragged anywhere; tapping it opens the app again.

## 5. Reporting

Pick a message type, fill in the fields, press **Post to CC Notion**. Every entry gets
the current time, the current GPS position, and the current crew status attached
automatically — those never need to be typed.

**Ballast** has three actions:

- *Drop* — subtracts the amount from what is on board
- *Take on* — adds it
- *Count on board* — sets the amount to what was physically counted; every later drop is
  calculated from there. Use it whenever the running total and the sacks disagree.

The bag-size buttons only fill the kilogram field, they do not post on their own. Posting
is always the one black button, so a knock against the iPad cannot log a drop.

**ATC** records direction, station, frequency, squawk and the wording. The underlined
phrases append standard text to the message field.

**Ressources** records who is pilot in command and who is resting. The setting stays
active and is attached to every following entry of any type, so the crew state is always
visible in Notion, not only on the entries that changed it.

**Other** is a free note.

## 6. What the app writes

```
data/<flight-id>.json
data/<flight-id>.csv
```

Both hold the same rows, sorted by `ts_utc`.

| Field | Content |
|---|---|
| `flight_id`, `callsign` | from Setup |
| `seq` | running number on the capturing device |
| `device` | device tag, separates entries when two iPads are in use |
| `ts_utc`, `ts_local` | the same instant in UTC and with local offset |
| `type` | `Ballast`, `ATC`, `Ressources`, `Other` — the values used on the Tally form |
| `lat`, `lon` | degrees, six decimal places |
| `alt_gps_m` | GPS altitude in metres, not barometric |
| `gps_acc_m`, `gps_age_s`, `gps_fix` | quality of the position at the moment of the entry |
| `ballast_action` | `drop`, `take` or `count` |
| `ballast_delta_kg` | relative change, drop negative |
| `ballast_abs_kg` | on board after this entry |
| `atc_dir` | `RX` received, `TX` sent |
| `atc_station`, `atc_freq`, `atc_squawk`, `atc_msg` | message content |
| `crew_pic`, `crew_rest` | crew state at the moment of the entry |
| `note` | free remark |
| `id` | UUID, the stable key for Notion |

`type` deliberately uses the spelling from the Tally form, including `Ressources`, so the
existing Notion select options match without editing. To change it, edit the four
`data-t` attributes in `index.html` and the matching strings in the post handler.

## 7. Polling from Notion

**GitHub API — immediate, recommended**

```
GET https://api.github.com/repos/<owner>/<repo>/contents/data/<flight-id>.json
Authorization: Bearer <token>
Accept: application/vnd.github.raw
```

5000 requests per hour per token; a 30 second interval is ample.

**raw.githubusercontent.com — public repositories only, delayed**

```
GET https://raw.githubusercontent.com/<owner>/<repo>/main/data/<flight-id>.csv
```

Behind a CDN with roughly a five minute cache. Fine after the flight, too slow during it.

Use `id` as the unique key and upsert. The file always holds the complete set of rows,
so appending produces duplicates.

## 8. Offline and transfer

Each entry is stored on the iPad first and stays there until it has been confirmed sent.
The hollow dot at the right of a log row means pending, filled means sent, and the header
gives the count.

Nothing is discarded without signal. The app retries when the connection returns and once
a minute while rows are pending. To send, it reads the file on GitHub, merges by `id` and
writes back, so two iPads on the same flight do not overwrite each other.

Save CSV and Save JSON export the current state to the Files app without a connection.

## 9. Limits worth knowing before takeoff

- **GPS in the background:** once the app is not in the foreground and the display locks,
  iPadOS suspends location updates. The app holds a wake lock while it is active. This
  records events, not a track — use a dedicated logger for a gapless trace.
- **Altitude:** `alt_gps_m` is GPS altitude above the WGS84 ellipsoid, not the altimeter
  reading. The altimeter governs what is reported to ATC.
- **Token on the device:** stored unencrypted in the browser. If the iPad is lost,
  revoking the token is enough. To avoid it entirely, put a Cloudflare Worker in front
  holding the token server side and point the API host in the code at the Worker.
- **The pill floats inside the app only.** A true overlay is not possible on iPadOS
  without a native app; Slide Over is the intended route.

## 10. Files

```
index.html                  the complete app
manifest.webmanifest        Home Screen installation
sw.js                       offline cache
icons/                      app icons
data/                       destination folder for flight files
```
