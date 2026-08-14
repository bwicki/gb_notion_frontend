#!/usr/bin/env node
/**
 * Basket Reporting → Notion
 *
 * Reads the flight table that the app writes into this repository and upserts every row
 * into a Notion database. Runs inside GitHub Actions, so nothing has to poll: the app
 * commits, the commit starts this script, and Notion has the row seconds later.
 *
 * Needs nothing but Node 20 or newer — fetch is built in, there are no dependencies.
 *
 * Environment:
 *   NOTION_TOKEN     secret, the internal integration token (starts with ntn_ or secret_)
 *   NOTION_DATABASE  the database id, 32 hex characters from its URL
 *   FLIGHT           optional; without it every data/*.json but the underscore files is read
 *   NOTION_VERSION   optional; defaults to 2022-06-28
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const TOKEN = process.env.NOTION_TOKEN;
const DB = (process.env.NOTION_DATABASE || '').replace(/-/g, '');
const VERSION = process.env.NOTION_VERSION || '2022-06-28';
const ONLY = process.env.FLIGHT || '';
const DIR = process.env.DATA_DIR || 'data';

if (!TOKEN || !DB) {
  console.error('NOTION_TOKEN and NOTION_DATABASE must be set.');
  process.exit(1);
}

const H = {
  Authorization: `Bearer ${TOKEN}`,
  'Notion-Version': VERSION,
  'Content-Type': 'application/json',
};

/* Notion allows about three requests a second; a small pause keeps us well inside that. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function notion(method, url, body, tries = 0) {
  const r = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 429 || r.status >= 500) {
    if (tries >= 5) throw new Error(`${method} ${url} → ${r.status}`);
    const wait = Number(r.headers.get('retry-after') || 0) * 1000 || 1000 * 2 ** tries;
    await sleep(wait);
    return notion(method, url, body, tries + 1);
  }
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/* ── The mapping ───────────────────────────────────────────────────────────
   Left: the column in Notion. Right: the field in the flight table and its type.
   Add or remove lines freely — a column that does not exist in Notion is skipped
   with a warning rather than failing the run.                                */
const MAP = {
  Name:        ['id', 'title'],
  Flight:      ['flight_id', 'rich_text'],
  Callsign:    ['callsign', 'rich_text'],
  Type:        ['type', 'select'],
  Time:        ['ts_utc', 'date'],
  Reporter:    ['reporter', 'rich_text'],
  Device:      ['device', 'rich_text'],
  Position:    ['pos_lat', 'rich_text'],
  Longitude:   ['pos_lon', 'rich_text'],
  Place:       ['place', 'rich_text'],
  Altitude:    ['alt_ft', 'number'],
  Track:       ['tc_deg', 'number'],
  Speed:       ['speed_kt', 'number'],
  Vario:       ['vs_ms', 'number'],
  Action:      ['ballast_action', 'select'],
  Medium:      ['ballast_medium', 'select'],
  Delta:       ['ballast_delta_kg', 'number'],
  Ballast:     ['ballast_abs_kg', 'number'],
  Sand:        ['sand_left_kg', 'number'],
  Water:       ['water_left_kg', 'number'],
  Direction:   ['atc_dir', 'select'],
  Station:     ['atc_station', 'rich_text'],
  Frequency:   ['atc_freq', 'rich_text'],
  Squawk:      ['atc_squawk', 'rich_text'],
  Message:     ['atc_msg', 'rich_text'],
  PIC:         ['crew_pic', 'rich_text'],
  Resting:     ['crew_rest', 'rich_text'],
  Battery:     ['res_battery_pct', 'number'],
  FuelCell:    ['res_fuel_cell', 'select'],
  Methanol:    ['res_methanol_pct', 'number'],
  Solar:       ['res_solar', 'select'],
  CrewO2:      ['res_o2_crew', 'select'],
  O2Litres:    ['res_o2_liters', 'number'],
  O2Percent:   ['res_o2_pct', 'number'],
  Note:        ['note', 'rich_text'],
  Edited:      ['edited_at', 'rich_text'],
};

const text = (v) => [{ type: 'text', text: { content: String(v).slice(0, 1900) } }];

function value(kind, raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (kind === 'title') return { title: text(raw) };
  if (kind === 'rich_text') return { rich_text: text(raw) };
  if (kind === 'select') return { select: { name: String(raw).slice(0, 100) } };
  if (kind === 'number') { const n = Number(raw); return Number.isFinite(n) ? { number: n } : null; }
  if (kind === 'date') return { date: { start: String(raw) } };
  if (kind === 'checkbox') return { checkbox: !!raw };
  return null;
}

async function schema() {
  const db = await notion('GET', `https://api.notion.com/v1/databases/${DB}`);
  return new Set(Object.keys(db.properties || {}));
}

async function existingRows() {
  const map = new Map();
  let cursor;
  do {
    const page = await notion('POST', `https://api.notion.com/v1/databases/${DB}/query`,
      cursor ? { page_size: 100, start_cursor: cursor } : { page_size: 100 });
    for (const p of page.results) {
      const t = p.properties?.Name?.title?.[0]?.plain_text;
      if (t) map.set(t, { page: p.id, edited: p.properties?.Edited?.rich_text?.[0]?.plain_text || '' });
    }
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return map;
}

async function rows() {
  const files = (await readdir(DIR))
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && !f.endsWith('.deleted.json'))
    .filter((f) => (ONLY ? f === `${ONLY}.json` : true));
  const out = [];
  for (const f of files) {
    const list = JSON.parse(await readFile(path.join(DIR, f), 'utf8'));
    if (Array.isArray(list)) out.push(...list);
  }
  /* rows the crew deleted must not reappear in Notion */
  const gone = new Set();
  for (const f of await readdir(DIR)) {
    if (!f.endsWith('.deleted.json')) continue;
    try {
      for (const t of JSON.parse(await readFile(path.join(DIR, f), 'utf8'))) if (t?.id) gone.add(t.id);
    } catch { /* an unreadable tombstone file must not stop the run */ }
  }
  return { rows: out.filter((e) => e?.id && !gone.has(e.id)), gone };
}

async function main() {
  const props = await schema();
  const missing = Object.keys(MAP).filter((k) => !props.has(k));
  if (missing.length) console.warn('Columns not present in Notion, skipped:', missing.join(', '));

  const { rows: list, gone } = await rows();
  const known = await existingRows();

  let created = 0, updated = 0, archived = 0;

  for (const e of list) {
    const properties = {};
    for (const [col, [field, kind]] of Object.entries(MAP)) {
      if (!props.has(col)) continue;
      const v = value(kind, e[field]);
      if (v) properties[col] = v;
    }
    if (!properties.Name) properties.Name = { title: text(e.id) };

    const hit = known.get(e.id);
    if (!hit) {
      await notion('POST', 'https://api.notion.com/v1/pages',
        { parent: { database_id: DB }, properties });
      created++;
    } else if ((e.edited_at || '') !== hit.edited) {
      await notion('PATCH', `https://api.notion.com/v1/pages/${hit.page}`, { properties });
      updated++;
    } else {
      continue;                       /* unchanged — no request at all */
    }
    await sleep(350);
  }

  /* a row the crew removed is archived rather than deleted, so nothing is lost */
  for (const [id, hit] of known) {
    if (!gone.has(id)) continue;
    await notion('PATCH', `https://api.notion.com/v1/pages/${hit.page}`, { archived: true });
    archived++;
    await sleep(350);
  }

  console.log(`rows ${list.length} · created ${created} · updated ${updated} · archived ${archived}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
