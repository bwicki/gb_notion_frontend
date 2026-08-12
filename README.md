# GB Notion Frontend

Capture tool for gas balloon flights: ballast use, ATC messages, crew status.
Runs as an installable web app on the iPad and writes every entry, with timestamp and
GPS position, into a JSON and a CSV file in a GitHub repository. Notion polls those files.

No build step, no dependencies, no external requests other than to the GitHub API.
Fully usable offline after the first load.

---

## 1. Set up

**Repository and hosting**

1. Put these files in a repository.
2. Settings → Pages → Source: `Deploy from a branch`, branch `main`, folder `/ (root)`.
3. The app is then served at `https://<owner>.github.io/<repo>/`.

Pages only serves private repositories on GitHub Pro or Team. If the flight data must
stay private, host the app from a public repository and point the app at a second,
private repository for the data — the Repository field in Setup can name any repository
the token has access to.

**Token**

Create a fine-grained personal access token under
Settings → Developer settings → Personal access tokens → Fine-grained tokens:

- Repository access: the data repository only
- Permissions → Repository permissions → **Contents: Read and write**
- Set a short expiry, for example one week after the flight

The app needs nothing beyond that.

**In the app**

Fill in the Setup tab: flight ID, callsign, both pilots, start ballast, bag sizes (the kg
values on the quick keys), repository (`owner/repo`), branch, folder, token.
Then use Check connection, then Save settings.

## 2. Install on the iPad

Open in Safari → Share → **Add to Home Screen**. The balloon icon appears and the app
launches full screen without Safari's bars.

iPadOS asks for location permission on the first entry. "While Using the App" is enough.
Without permission entries are still recorded, just without coordinates — the `gps_fix`
field is then `false`.

## 3. Floating over other apps

iPadOS gives no web app a system-wide overlay. What does work:

| Route | Result |
|---|---|
| **Slide Over** — drag the app from the Dock onto a running app | narrow floating window over a map, weather or Foreflight; swipe it off the edge and back |
| **Split View** | fixed split screen, app permanently visible |
| **Stage Manager** (iPadOS 16+) | freely placed, overlapping window |

All three require the app to be installed from the Home Screen.

The app also minimises on its own: the button at the top right collapses the interface
into a round dial showing remaining ballast and fill level. The dial can be dragged
anywhere on screen; tapping it opens the app again. Inside a Slide Over window that is
the practical resting state.

## 4. What the app writes

Two files per flight, named after the flight ID:

```
data/<flight-id>.json
data/<flight-id>.csv
```

Both hold the same rows, sorted chronologically by `ts_utc`.

### Columns

| Field | Content |
|---|---|
| `flight_id` | flight identifier |
| `callsign` | aircraft callsign |
| `seq` | running number on the capturing device |
| `device` | device tag, separates entries when two iPads are in use |
| `ts_utc` | timestamp in UTC, ISO 8601 |
| `ts_local` | same instant with local time offset |
| `type` | `BALLAST`, `TALLY`, `ATC`, `CREW`, `NOTE` |
| `lat`, `lon` | position in degrees, six decimal places |
| `alt_gps_m` | GPS altitude in metres (not barometric) |
| `gps_acc_m` | reported accuracy in metres |
| `gps_age_s` | age of the fix at the moment of the entry |
| `gps_fix` | `true` when a position was available |
| `ballast_delta_kg` | relative change, drop negative, take-on positive |
| `ballast_abs_kg` | amount on board after this entry |
| `atc_dir` | `RX` received, `TX` sent |
| `atc_station`, `atc_freq`, `atc_squawk`, `atc_msg` | message content |
| `crew_pic` | pilot in command at the time of the entry |
| `crew_rest` | who is resting, empty when both are awake |
| `note` | free remark |
| `id` | UUID, the stable key for Notion |

### How ballast is calculated

`ballast_abs_kg` is carried forward: it starts at the value from Setup, and every
`BALLAST` entry adds its `ballast_delta_kg`. A `TALLY` entry sets the amount on board to
what was physically counted, and every later drop is calculated from there. That keeps
the figure correct even when sand went overboard without being logged.

Every row carries its own `ballast_abs_kg`, so Notion never has to recalculate.

## 5. Polling from Notion

Two endpoints, with different freshness:

**GitHub API — immediate, recommended**

```
GET https://api.github.com/repos/<owner>/<repo>/contents/data/<flight-id>.json
Authorization: Bearer <token>
Accept: application/vnd.github.raw
```

`Accept: application/vnd.github.raw` returns the file content directly, with no base64
step. Limit: 5000 requests per hour per token. A 30 second poll interval is more than
enough for one flight.

**raw.githubusercontent.com — public repositories only, and delayed**

```
GET https://raw.githubusercontent.com/<owner>/<repo>/main/data/<flight-id>.csv
```

This endpoint sits behind a CDN with roughly a five minute cache. Too slow to follow a
flight live, fine for working through the data afterwards.

**On the Notion side**

Use `id` as the unique key and upsert on import rather than appending. The file always
holds the complete set of rows, not just the new ones — appending produces duplicates.

## 6. Offline and transfer

Every entry goes to the iPad's local storage first and stays there until it has been
confirmed as sent. The dot at the right of each row in the log shows the state: amber
pending, green sent. The status rail gives the number of pending rows.

Nothing is discarded when there is no signal. Once a connection returns the app sends
automatically — as long as Auto transfer is on — and additionally once a minute while
rows are still pending.

To send, the app reads the file on GitHub, merges it with the local set by `id`, and
writes the result back. Two iPads on the same flight therefore do not overwrite each
other, unless they send in the same second.

Save CSV and Save JSON export the current state to the Files app at any time, without
a connection.

## 7. Limits worth knowing before takeoff

- **GPS in the background:** once the app is not in the foreground and the display locks,
  iPadOS suspends location updates. The app requests a wake lock so the display stays on
  while the app is active. For a gapless track, use a dedicated logger — this app records
  events, not a track.
- **Altitude:** `alt_gps_m` is GPS altitude above the WGS84 ellipsoid, not the altimeter
  reading. The altimeter governs what is reported to ATC, not this field.
- **Token on the device:** the token sits unencrypted in the browser's local storage. If
  the iPad is lost, revoking the token on GitHub is enough. To avoid that entirely, put a
  Cloudflare Worker in front as a proxy holding the token server side; leave the
  Repository field empty and point the API host in the code at the Worker.
- **The dial floats inside the app only.** An overlay across other apps is not possible on
  iPadOS without a native app; Slide Over is the intended route (section 3).

## 8. Using it in flight

Night mode in Setup switches the interface to red on black and preserves dark adaptation.
The confirmation tone acknowledges each entry, so a drop can be logged without looking
at the display.

The quick keys on the Ballast tab record immediately, with no confirmation step — one
touch, one row. Their values come from the bag sizes in Setup; enter the sack sizes
actually carried on board.

On the Crew tab, Hand over and Rest each write an entry and at the same time change the
status attached to every following entry.

## 9. Files

```
index.html                  the complete app
manifest.webmanifest        Home Screen installation
sw.js                       offline cache
icons/                      app icons
data/                       destination folder for flight files
```
