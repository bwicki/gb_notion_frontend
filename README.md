# GB Notion Frontend — Basket Reporting

An offline version of the Basket Reporting form for use in the basket during a gas balloon
flight. Same four message types as the Tally form, same submit action, but it keeps working
without signal, stamps every entry with time and GPS position, carries the ballast figure
forward across all devices, and lets several people report in parallel.

Every entry is written to a JSON and a CSV file in a GitHub repository. Notion polls those
files. The app reads the same files back every five seconds, so each device always shows the
complete flight.

No build step, no dependencies, no external requests other than to the GitHub API.

---

## 1. The screen

The whole app fits one phone screen without scrolling, and its outline is always visible.
Only the log and the setup scroll.

Day mode is dark anthracite on a grey ground; unselected buttons carry a visible outline and a
white face. Night mode is red on black and preserves dark adaptation. The sun/moon button in
the header switches in one tap and the choice is remembered; on first launch the app follows
the iPad's own appearance setting.

The header shows UTC to the second, the flight, and four buttons: log, day/night, menu,
minimise. Below it, flush against the header, sit the four message types; the kilograms on
board appear under them only on the Ballast tab, where they are relevant. There is no logo and
no title inside the app — the home screen icon already says what this is, and the room is
better spent on the form.

The day/night button always shows the mode you are *not* in: a moon by day, a sun at night.
Tapping it is the switch.

Settings, transfer, export and this document live behind the menu button between day/night and
minimise. The log screen is therefore nothing but the log. *About — more info* opens this
README as a page in its own window.

Night mode comes in four colours — red, amber, green or dimmed white — chosen in the setup.
Red preserves dark adaptation best; the others are there for personal preference and for
screens where red reads badly.

The app icon and the favicon are a sandbag beside four tally strokes, in club navy on white.
The set covers all three platforms: `apple-touch-icon` in 120, 152, 167 and 180 pixels for
iPhone and iPad, manifest icons in 192 to 512 for Android and Chrome, two maskable versions
with the artwork inside the safe circle so Android's adaptive shapes do not clip it, a
`mask-icon.svg` for pinned tabs in desktop Safari, and a multi-resolution `favicon.ico`.
The icons are opaque — iOS renders transparency in a home screen icon as black — and the
manifest background is white to match, so the Android splash shows no seam. The 16 and 32 pixel
favicons carry a simplified version with three uprights instead of four; at that size the
narrower gaps of the full mark close up into a smudge.

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

The *Ballast on board at start* field beside the flight ID is only needed before the first
inventory: it seeds the running figure so that early drops count, and it gives the first
inventory something to compare against in `tally_diff_kg`. Leave it empty and the ballast
figure simply starts with the first Take Inventory.

The reporter name for this device sits at the top of the setup and needs no password — it
changes often enough, and getting it wrong only mislabels entries. Everything below it is
locked: press *Unlock settings* and enter **1234**. Fill in the device mode and name, the flight, the two
pilots, the weight of one ballast bag, the full ready-ballast weight, and the quick drop
amounts. The GitHub connection and the WhatsApp recipients sit in collapsed sections at the
bottom — open them once per device, then close them again. Saving asks twice before it
applies, so a flight in progress cannot be overwritten by a stray tap. Leaving the setup
screen locks it again.

## 3. Install on the iPad

Safari → Share → **Add to Home Screen**. It is saved as *Basket Reporting* and launches full
screen without Safari's bars, and location and wake lock work as expected. Location permission is requested on the
first entry; "While Using the App" is enough. Without it, entries are still recorded, with
`gps_fix` set to `false`.

## 4. Floating over other apps

iPadOS gives no web app a system-wide overlay. What works:

| Route | Result |
|---|---|
| **Slide Over** — drag the app from the Dock onto a running app | narrow floating window over a map or Foreflight |
| **Split View** | fixed split screen |
| **Stage Manager** (iPadOS 16+) | freely placed, overlapping window |

All three need the app installed from the Home Screen. The minimise button additionally
collapses the app to a draggable pill showing the kilograms still on board; tapping the pill
opens it again.

## 5. Who is reporting

The setup asks whether this is a **personal device** or a **shared device**.

On a personal device — the default, and what the two pilots' own phones should be set to —
every entry is filed under the name entered there, whoever happens to be pilot in command. The
reporter button is hidden; there is nothing to get wrong.

On a shared device the reporter defaults to whoever is pilot in command, and the button at the
top right of the readout switches to the other pilot for the exceptional case. It turns dark
while the alternate is active, so the exception is visible, and every entry carries that name
until it is switched back. Changing the PIC on the Ressources tab moves the default with it.

Each row also records `device_mode`, so it is possible to tell afterwards which reporting
regime a row came from.

## 5a. Position

The position on every row is the fix of the device that made the entry, taken at the moment of
posting. Rows merged in from another iPad keep that iPad's position — nothing is ever
re-stamped. Three columns carry it in short notation: `pos_lat` as `484532N`, `pos_lon` as
`0072345E`, and `alt_ft` as WGS84 altitude in feet. The decimal degrees and metres stay
alongside for map links and for anything that needs the raw value.

Track and ground speed come with every entry. iOS and Android supply both with the fix once the
device is moving; when they do not, the app derives them from the previous fix, requiring at
least three seconds and five metres between the two so that a stationary basket does not
produce a random course. Both fields stay empty rather than guessing when neither source is
available. The header shows the current values live beside the GPS accuracy.

## 6. Ballast

**Drop** subtracts the kilograms thrown. The quick buttons only fill the field; posting is
always the one dark button, so a knock against the iPad cannot log a drop.

**Take Inventory** records what is actually on board and resets the running figure. Three
inputs:

- *Bags* and *Water* on one line — bags counted in total including safety ballast and
  multiplied by the weight per bag from the setup, water in litres at one kilogram per litre.
- *Ready ballast* — 0, 25, 50, 75 or 100 per cent of the full ready-ballast weight from the
  setup, normally 30 kg.

The running total under the fields shows the result before it is posted, and the entry lands
in the table as three columns:

| Column | Contents |
|---|---|
| `sand_kg` | bags × weight per bag, **plus** the ready ballast |
| `water_kg` | litres |
| `total_ballast_kg` | sand + water, and the new figure on board |

Ready ballast is always sand, so sand + water = total. `inv_bags` and `inv_ready_pct` are
carried alongside so an inventory can be reopened and corrected later.

**`tally_diff_kg` records where the figures parted company.** Every inventory stores the
counted total minus what the running calculation expected at that moment. A reading of −60
means sixty kilograms left the basket without being logged; a positive figure means a drop was
logged that did not happen, or a bag was miscounted. The first inventory has no predecessor to
compare against and leaves the column empty unless a start ballast was entered in the setup.
The figure is recalculated over the whole flight after every edit, deletion or merge, so it
always reflects the current state of the table. The app also shows the expected value and the
difference live, before an inventory is posted.

**The dropped figure is measured from the first inventory**, not from the sum of the drops:
`first inventory total − currently on board`. Throwing sand is not exact; counting sacks is.
Every later inventory therefore feeds straight into the dropped figure, including whatever
went overboard without being logged.

## 7. ATC, Ressources, Other

**ATC** puts the station on its own line, frequency and squawk side by side beneath it, then
the message. Station, Frq and SQ are carried over from the previous call and shown in grey
with a dashed outline; they have to be confirmed before the entry can be posted, either by
tapping into a field to change it or with the *Confirm* button. A long sequence of calls to
the same station costs one tap, without any risk of an unnoticed stale frequency. The dashed
chips append standard phrases — including QNH and Ops Normal — to the message.

**Ressources** puts current PIC and who is resting on the first line, then battery, fuel cell
and solar on the second — battery as a list in ten-percent steps with 75, 85 and 95 added,
where the reading actually matters. The PIC and resting state stays active and is
attached to every following entry of any type; battery, fuel cell and solar belong to the entry
they were filed with.

**Other** is a free note.

## 8. WhatsApp

ATC, Ressources and Other each carry a checkbox at the foot of the form: *Send also to
WhatsApp recipients*. It is one setting, remembered across the three types, and has no effect
on Ballast entries.

Recipients are defined in the setup, up to eight, each with a name and a number in
international form with digits only, for example `41791234567`.

Above them sits a ninth, separate entry: the **ATC Coordinator**. It is offered on ATC entries
only, as its own checkbox above the general one, and it is ticked by default there — an ATC
call normally goes to the coordinator whether or not the rest of the list is in play. The two
checkboxes are independent, so an ATC entry can go to the coordinator alone, to the list alone,
to both, or to nobody. Ressources and Other never see the coordinator.

With the box ticked, posting first writes the entry as usual, then opens a sheet with the
finished message and one button per recipient. An ATC entry reads:

```
*ATC | HB-QWV*
Station: ZURICH INFO
Frq: 124.700  SQ: 7000
Msg: QNH 1013, Ops Normal
21:04Z 484532N 0072345E 2340 ft
https://maps.google.com/?q=48.75890,7.39580
```

The first line is bold in WhatsApp.

### The layout is yours

The setup holds one template per message type under *WhatsApp message layout*. Placeholders in
braces are substituted; **a line whose placeholders are all empty is dropped**, so optional
fields cost nothing when they were not reported, and a single empty placeholder among filled
ones becomes an en dash. *Reset to default* puts the three back.

| Placeholder | Value |
|---|---|
| `{type}` `{callsign}` `{flight}` `{reporter}` | who and what |
| `{dir}` `{station}` `{freq}` `{squawk}` `{msg}` | the ATC fields |
| `{pic}` `{resting}` `{battery}` `{fuelcell}` `{solar}` | the Ressources fields |
| `{note}` | the free remark |
| `{time}` | UTC as `21:04Z` |
| `{pos}` | degrees, minutes and seconds, `484532N 0072345E` |
| `{posdm}` | degrees and minutes only, `4745N 00732E` |
| `{alt}` | GPS altitude in feet, rounded to ten |
| `{tc}` `{speed}` | track as `TC 235` and ground speed as `12.4 kn` |
| `{maps}` | link to the position on Google Maps |

Without a position fix, `{pos}`, `{alt}` and `{maps}` are empty, which drops their lines
entirely rather than sending a placeholder.

**One chat at a time.** No browser can push a message into several WhatsApp chats at once —
`wa.me` opens a single conversation with the text prefilled, and the send button still has to
be pressed by hand. The sheet lists the recipients; tap a name, send, come back, tap the next.
*Copy text* puts the message on the clipboard for pasting into a group, which is faster when
one exists.

The row records `whatsapp` = `yes` and `whatsapp_to` with the names, so the table shows which
entries were meant to go out. Whether they were actually sent happens inside WhatsApp and
cannot be recorded here.

## 9. Sending, and what happens without a link

There is nothing to switch on. Pressing **Post to CC Notion** writes the entry to the device and
sends it straight away. If there is no connection the entry is held in a queue — the header
shows how many are waiting — and the queue goes out on its own as soon as the link returns,
either on the browser's online event or on the next five-second cycle, whichever comes first.

Order is never in doubt: the file is always written as the complete set of rows sorted by
`ts_utc`, so a queued entry lands in its correct place in the sequence rather than at the end.
An entry made at 21:04 and sent at 21:11 still sits between 21:03 and 21:05 in the table.

*Send now* in the menu forces an attempt, and *Reload from GitHub* pulls the table without
writing. Neither is needed in normal use.

## 10. Several devices at once

Every row carries `reporter` (who entered it), `device` (which iPad) and `source` (`app` for
this tool).

Sending is a merge, never an overwrite: the app reads the file on GitHub, merges it with what
is held locally by `id`, recalculates the ballast column over the whole set, and writes the
result back. If another device wrote in the meantime, GitHub rejects the write and the app
retries with the fresh version, up to three times.

**The table is played back every five seconds.** A drop made on one iPad shows up on the other
within a few seconds, and the ballast figure accounts for both. A device that joins mid-flight,
or whose local copy was cleared, gets the whole flight back with *Reload* in the log screen.

Polling that often is affordable because the app sends a conditional request: when nothing has
changed, GitHub answers 304 with no body, and a 304 does not count against the hourly limit of
5000 requests. Only an actual change costs a request. Polling pauses while the app is in the
background.

**Tally rows.** Anything appended to the same JSON file appears in the app and in the ballast
calculation, provided it carries at least `id`, `ts_utc` and `type`. Give Tally-sourced rows
`reporter: "Tally"` and `source: "tally"` so it is visible where they came from. A ballast row
may be relative (`ballast_delta_kg`, negative for a drop) or an inventory
(`ballast_action: "count"` with `total_ballast_kg`, which resets the running total).

**Deletions** are shared through `data/<flight-id>.deleted.json`, holding the ids that were
removed with the time and the person who removed them. Every device applies that list, so a
deleted row does not reappear from another iPad's copy, and the main table stays clean.

## 11. The log

The list button in the header opens the log: the whole flight, newest first, with time,
content, reporter and a dot showing whether the row has been sent. Nothing else — transfer and
export moved into the menu.

Tapping an entry opens it for editing. The editable fields depend on the type — kilograms and
remark for a drop, bags, water and ready ballast for an inventory, station through message for
ATC. Saving stamps `edited_at` and `edited_by`. The ballast column is recalculated over the
whole flight after every edit and every deletion, so the figures stay consistent wherever in
the sequence the change was made.

Deleting asks twice, states what is being removed and who recorded it, and warns that the
deletion is shared with the other devices.

## 12. What the app writes

```
data/<flight-id>.json          the table
data/<flight-id>.csv           the same rows as CSV
data/<flight-id>.deleted.json  ids that were removed
```

| Field | Content |
|---|---|
| `flight_id`, `callsign` | from the setup |
| `seq` | running number on the capturing device |
| `device` | device tag |
| `reporter` | who made the entry |
| `source` | `app`, or whatever an external writer sets, e.g. `tally` |
| `ts_utc`, `ts_local` | the same instant in UTC and with local offset |
| `type` | `Ballast`, `ATC`, `Ressources`, `Other` — the values used on the Tally form |
| `pos_lat`, `pos_lon`, `alt_ft` | position of the reporting device in short notation, `484532N` / `0072345E`, and altitude in feet |
| `tc_deg`, `speed_kt` | track over ground in degrees and ground speed in knots, one decimal |
| `lat`, `lon`, `alt_gps_m` | the same fix in decimal degrees and metres, for map links |
| `gps_acc_m`, `gps_age_s`, `gps_fix` | quality of the position at the moment of the entry |
| `device_mode` | `personal` or `shared` |
| `ballast_action` | `drop` or `count` |
| `ballast_delta_kg` | kilograms thrown, negative |
| `ballast_abs_kg` | on board after this entry, recalculated across all devices |
| `sand_kg`, `water_kg`, `total_ballast_kg` | inventory result |
| `tally_diff_kg` | counted total minus what was expected at that moment |
| `inv_bags`, `inv_ready_pct` | what the inventory was built from |
| `atc_dir` | `RX` received, `TX` sent |
| `atc_station`, `atc_freq`, `atc_squawk`, `atc_msg` | message content |
| `crew_pic`, `crew_rest` | crew state at the moment of the entry |
| `res_battery_pct`, `res_fuel_cell`, `res_solar` | power state as reported on a Ressources entry |
| `note` | free remark |
| `whatsapp`, `whatsapp_to` | set when the entry was marked for WhatsApp, and to whom |
| `edited_at`, `edited_by` | set when a row was changed after the fact |
| `id` | UUID, the stable key for Notion |

`type` deliberately uses the spelling from the Tally form, including `Ressources`, so the
existing Notion select options match without editing. To change it, edit the four `data-t`
attributes in `index.html` and the matching strings in the post handler.

## 13. Polling from Notion

**GitHub API — immediate, recommended**

```
GET https://api.github.com/repos/<owner>/<repo>/contents/data/<flight-id>.json
Authorization: Bearer <token>
Accept: application/vnd.github.raw
```

Poll `<flight-id>.deleted.json` the same way and archive the matching rows in Notion. Use `id`
as the unique key and upsert; the file always holds the complete set of rows, so appending
produces duplicates.

**raw.githubusercontent.com — public repositories only, delayed**

```
GET https://raw.githubusercontent.com/<owner>/<repo>/main/data/<flight-id>.csv
```

Behind a CDN with roughly a five minute cache. Fine after the flight, too slow during it.

## 14. Limits worth knowing before takeoff

- **GPS in the background:** once the app is not in the foreground and the display locks,
  iPadOS suspends location updates. The app holds a wake lock while it is active. This records
  events, not a track — use a dedicated logger for a gapless trace.
- **Altitude:** `alt_gps_m` is GPS altitude above the WGS84 ellipsoid, not the altimeter
  reading. The altimeter governs what is reported to ATC.
- **Rate limit:** with two iPads and a Notion poll on the same token, the hourly budget is
  comfortable as long as the conditional requests keep returning 304. Frequent writes are what
  cost — each post is roughly four requests.
- **The password is 1234 and lives in the source.** It guards against a mistaken tap in the
  basket, not against anyone with the file. Change the `PASS` constant in `index.html` if a
  different one is wanted.
- **Token on the device:** stored unencrypted in the browser. If the iPad is lost, revoking the
  token is enough. To avoid it entirely, put a Cloudflare Worker in front holding the token
  server side and point the API host in the code at the Worker.
- **The pill floats inside the app only.** A true overlay is not possible on iPadOS without a
  native app; Slide Over is the intended route.

## 15. Version

The build stamp sits in the bottom right of every screen, in the form `v<YYMMDD>-<nn>` —
the date written backwards, then a counter that restarts at 01 each day and goes up with every
build released that day. `v260812-06` is the sixth build of 12 August 2026.

It lives in two places that must be kept in step: the `APP_VERSION` constant near the top of
the script in `index.html`, and the cache name `V` in `sw.js`. `readme.html` is generated from
this file and has to be regenerated whenever it changes. Bumping the cache name is what
forces the service worker to fetch the new files rather than serve the old ones, so a build
with an unchanged cache name may not reach a device that already has the app installed.

## 16. Files

```
index.html                  the complete app
manifest.webmanifest        Home Screen installation
sw.js                       offline cache
readme.html                 this document, opened from the menu
favicon.ico                 multi-resolution favicon
icons/                      app icons and favicons
data/                       destination folder for flight files
```
