# Tests

Nothing here is needed to run the app; `index.html` has no build step and no dependencies.
These are the checks that were written alongside a change, kept in the repository so the next
person — or the next session — does not have to write them again.

```
npm install jsdom playwright
node tests/smoke_vhf.js     # 65 checks, writes vhf.log beside itself
node tests/shot_vhf.js      # four screenshots of the log, the filter and the archive
```

Both load `index.html` straight from the working copy and put a stand-in in front of
`fetch`, so nothing reaches GitHub and no token is needed.

**`smoke_vhf.js`** covers what v261116-01 changed: a flight table past a megabyte, which the
GitHub API no longer embeds in its own answer; the refusal to write a table back when the read
came up short; and the rows the radio app at `krt2.wicki.aero` files under the kind `VHF` —
that they survive a write, that the log, the archive and the CSV, GeoJSON and KML exports show
them, that the filter can put them aside, and that the ballast arithmetic ignores them.

The stand-in GitHub in that file behaves the way the real one does past a megabyte: the
metadata answer carries the sha and the size but no content, and the body has to be asked for
again with the raw media type. A test that passes against a small file proves nothing about
the case it is there for, so the fixture is built to 1.5 MB on purpose.

## The other writer

The radio app at `krt2.wicki.aero` writes into the same flight table, and its repository carries
the test that puts both apps on one simulated GitHub — a stale sha, a file past a megabyte, a
file that cannot be read — with this app's `index.html` as one of the two parties:

```
git clone --depth 1 https://github.com/bwicki/krt2 ../krt2
cd ../krt2 && npm install jsdom
node tests/reporting_cross.js ../gb_notion_frontend/index.html src/vhflog.js
```

Run it after any change to `ghGet`, to `sync`, or to the way rows are merged. Nothing in this
folder sees the two writers at the same table; that test does.
