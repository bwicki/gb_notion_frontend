/**
 * Basket Reporting — join code relay
 *
 * A letterbox, nothing more. The master leaves an encrypted setup under the fingerprint of a
 * six-character code; the joining device fetches it once with the same code and the letterbox
 * empties itself. The worker never sees the setup in the clear: the code is the key, and the
 * code never travels here.
 *
 * What the worker adds over a file in a public repository:
 *   - a lifetime that is enforced rather than written down (KV expiry)
 *   - deletion on first successful collection, so one code means one device
 *   - a limit on wrong guesses per address, which is what makes six characters enough
 *
 * Deploy:
 *   1. Cloudflare dashboard → Workers & Pages → Create → Worker. Paste this file.
 *   2. Storage & Databases → KV → Create namespace, name it `basket_join`.
 *   3. Worker → Settings → Bindings → Add → KV namespace: variable name `JOIN`,
 *      namespace `basket_join`.
 *   4. Optional but worth it: Settings → Variables → add `ORIGIN` with the address of the app,
 *      e.g. https://bwicki.github.io — then no other site can call it.
 *   5. Deploy, copy the worker address, and put it into the app under
 *      Settings → GitHub connection → Join code relay.
 */

const TTL = 24 * 3600;          // a code lives a day — long enough for a flight that runs overnight
const MAX_FAILS = 20;           // wrong guesses per address per hour
const MAX_SIZE = 60000;         // an encrypted setup is a few kilobytes

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allow = env.ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'x-basket-join',
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

    /* ── leave a setup ──────────────────────────────────────────── */
    if (request.method === 'POST') {
      let body;
      try { body = await request.json() } catch { return json({ error: 'bad request' }, 400) }
      const pid = String(body.id || '').toLowerCase();
      const payload = String(body.payload || '');
      if (!/^[a-f0-9]{32}$/.test(pid) || !payload || payload.length > MAX_SIZE)
        return json({ error: 'bad request' }, 400);
      await env.JOIN.put('j:' + pid, payload, { expirationTtl: TTL });
      return json({ ok: true, expires_in: TTL });
    }

    /* ── is it still there? ─────────────────────────────────────────
       A look without taking: the master asks whether its code has been collected yet, and the
       answer must not empty the letterbox. No counting of failures here either — this is the
       owner checking on their own code, not somebody guessing at it. */
    if (request.method === 'HEAD') {
      if (!looksRight) return new Response(null, { status: 400, headers: cors });
      const there = await env.JOIN.get('j:' + id);
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'x-basket-join': there ? 'present' : 'gone', 'cache-control': 'no-store' },
      });
    }

    /* ── collect it, once ───────────────────────────────────────── */
    if (request.method === 'GET') {
      if (!looksRight) return json({ error: 'bad request' }, 400);
      const fkey = 'f:' + ip;
      const fails = Number(await env.JOIN.get(fkey) || 0);
      if (fails >= MAX_FAILS) return json({ error: 'too many attempts' }, 429);

      const payload = await env.JOIN.get('j:' + id);
      if (!payload) {
        /* a wrong code costs the guesser one of their attempts for the hour */
        await env.JOIN.put(fkey, String(fails + 1), { expirationTtl: 3600 });
        return json({ error: 'no such code' }, 404);
      }
      await env.JOIN.delete('j:' + id);      /* one code, one device */
      return json({ payload });
    }

    /* ── withdraw it ────────────────────────────────────────────── */
    if (request.method === 'DELETE') {
      if (!looksRight) return json({ error: 'bad request' }, 400);
      await env.JOIN.delete('j:' + id);
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
