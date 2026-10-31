/**
 * Basket Reporting — join code relay          worker v2 (31 October 2026)
 *
 * A letterbox, nothing more. The master leaves an encrypted setup under the fingerprint of a
 * six-character code; the joining device fetches it with the same code. The worker never sees
 * the setup in the clear: the code is the key, and the code never travels here.
 *
 * Two kinds of letter, and the difference is the whole of version 2:
 *
 *   a follower code  — one device, one flight. It lives a day and the letterbox empties itself
 *                      the moment it is collected.
 *   a viewer code    — read-only access to the archive, for somebody outside the crew. It may
 *                      live ten days or for ever, and it survives collection, because several
 *                      people may use one code and because a viewer who reinstalls would
 *                      otherwise be locked out. The worker counts the collections instead, so
 *                      the master can see on its own screen that the code has been used.
 *
 * What the worker adds over a file in a public repository:
 *   - a lifetime that is enforced rather than written down (KV expiry)
 *   - a follower code that cannot be used twice
 *   - a limit on wrong guesses per address, which is what makes six characters enough
 *
 * Deploy:
 *   1. Cloudflare dashboard → Workers & Pages → basket-join → Edit code. Paste this file.
 *   2. The KV namespace binding `JOIN` and the variable `ORIGIN` stay as they are.
 *   3. Deploy. Nothing in the app needs changing first — version 1 codes keep working.
 */

const TTL_DEFAULT = 24 * 3600;       // a follower code: long enough for a flight that runs overnight
const TTL_MAX = 3650 * 24 * 3600;    // ten years, which is what "unlimited" is kept as in practice
const MAX_FAILS = 20;                // wrong guesses per address per hour
const MAX_SIZE = 60000;              // an encrypted setup is a few kilobytes

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allow = env.ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'x-basket-join, x-basket-taken, x-basket-kind',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
    };
    const json = (obj, status) => new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' },
    });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname !== '/join') return json({ error: 'not found' }, 404);
    if (!env.JOIN) return json({ error: 'no KV namespace bound as JOIN' }, 500);

    const id = (url.searchParams.get('id') || '').toLowerCase();
    const looksRight = /^[a-f0-9]{32}$/.test(id);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    /* ── leave a setup ────────────────────────────────────────────
       keep:true files it as a viewer code, under its own prefix. ttl is in seconds; 0 means
       for ever, which KV expresses by being given no expiry at all. */
    if (request.method === 'POST') {
      let body;
      try { body = await request.json() } catch { return json({ error: 'bad request' }, 400) }
      const pid = String(body.id || '').toLowerCase();
      const payload = String(body.payload || '');
      if (!/^[a-f0-9]{32}$/.test(pid) || !payload || payload.length > MAX_SIZE)
        return json({ error: 'bad request' }, 400);

      const keep = body.keep === true;
      let ttl = body.ttl === undefined ? TTL_DEFAULT : Math.floor(Number(body.ttl));
      if (!Number.isFinite(ttl) || ttl < 0) ttl = TTL_DEFAULT;
      if (ttl > TTL_MAX) ttl = TTL_MAX;
      /* KV refuses anything under a minute */
      const opts = ttl === 0 ? {} : { expirationTtl: Math.max(60, ttl) };

      await env.JOIN.put((keep ? 'v:' : 'j:') + pid, payload, opts);
      if (keep) await env.JOIN.delete('c:' + pid);     /* a reissued code starts counting again */
      return json({ ok: true, kind: keep ? 'viewer' : 'follower', expires_in: ttl });
    }

    /* ── is it still there, and has it been collected? ──────────────
       A look without taking: the master asks after its own code, and the answer must not empty
       the letterbox. No counting of failures here — this is the owner checking on their own
       code, not somebody guessing at it. */
    if (request.method === 'HEAD') {
      if (!looksRight) return new Response(null, { status: 400, headers: cors });
      const asFollower = await env.JOIN.get('j:' + id);
      const asViewer = asFollower ? null : await env.JOIN.get('v:' + id);
      const taken = asViewer ? (await env.JOIN.get('c:' + id) || '0') : '0';
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'x-basket-join': (asFollower || asViewer) ? 'present' : 'gone',
          'x-basket-kind': asFollower ? 'follower' : (asViewer ? 'viewer' : 'none'),
          'x-basket-taken': taken,
          'cache-control': 'no-store',
        },
      });
    }

    /* ── collect it ─────────────────────────────────────────────── */
    if (request.method === 'GET') {
      if (!looksRight) return json({ error: 'bad request' }, 400);
      const fkey = 'f:' + ip;
      const fails = Number(await env.JOIN.get(fkey) || 0);
      if (fails >= MAX_FAILS) return json({ error: 'too many attempts' }, 429);

      /* a follower code first: it is the one that is consumed */
      const one = await env.JOIN.get('j:' + id);
      if (one) {
        await env.JOIN.delete('j:' + id);        /* one code, one device */
        return json({ payload: one, kind: 'follower' });
      }

      /* a viewer code stays where it is; only the tally moves */
      const many = await env.JOIN.get('v:' + id);
      if (many) {
        const n = Number(await env.JOIN.get('c:' + id) || 0) + 1;
        await env.JOIN.put('c:' + id, String(n));
        return json({ payload: many, kind: 'viewer' });
      }

      /* a wrong code costs the guesser one of their attempts for the hour */
      await env.JOIN.put(fkey, String(fails + 1), { expirationTtl: 3600 });
      return json({ error: 'no such code' }, 404);
    }

    /* ── withdraw it ──────────────────────────────────────────────
       Both kinds, and the tally with them: the master does not have to remember which it was. */
    if (request.method === 'DELETE') {
      if (!looksRight) return json({ error: 'bad request' }, 400);
      await env.JOIN.delete('j:' + id);
      await env.JOIN.delete('v:' + id);
      await env.JOIN.delete('c:' + id);
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
