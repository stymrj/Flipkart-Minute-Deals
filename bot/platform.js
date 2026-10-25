// Flipkart Minutes: the same page-fetch API the mobile site uses, with your own session cookie.
'use strict';
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
let dc = '1';

function normalise(v, cat, { price, brandOf }) {
  const t = v.titles || {}, pr = v.pricing || {};
  const title = t.title || t.newTitle || t.superTitle || v.productTitle;
  const sell = price(pr.finalPrice && (pr.finalPrice.value != null ? pr.finalPrice.value : pr.finalPrice));
  if (!title || !sell) return null;
  let mrp = 0;
  for (const x of pr.prices || []) if (x.priceType === 'MRP') { mrp = price(x.value); break; }
  if (!mrp) mrp = price(pr.mrp);
  if (mrp < sell) mrp = sell;
  const path = v.baseUrl || v.smartUrl || '';
  const pa = v.productAction && v.productAction.value;
  const oos = (v.availability && v.availability.displayState === 'OUT_OF_STOCK') || (pa && (pa.enabled === false || pa.actionType === 'NOTIFY_ME')) || (v.buyability && v.buyability.intent === 'negative');
  const idm = path.match(/pid=([A-Z0-9]+)/i) || path.match(/\/p\/(itm[a-z0-9]+)/i);
  return { id: String(v.id || v.itemId || (idm && idm[1]) || title + '|' + sell), title: String(title), brand: brandOf(title), price: sell, mrp, disc: mrp > sell ? Math.round((mrp - sell) / mrp * 100) : 0, url: path ? 'https://www.flipkart.com' + path : '', inStock: !oos, cat };
}
function extract(json, cat, ctx) {
  const out = [], seen = new Set();
  (function walk(o, d) {
    if (!o || typeof o !== 'object' || d > 14) return;
    if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; }
    if (o.titles && o.pricing) { const p = normalise(o, cat, ctx); if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); } return; }
    for (const k in o) walk(o[k], d + 1);
  })(json, 0);
  return out;
}

module.exports = {
  label: 'Flipkart Minutes',
  required: ['FLIPKART_COOKIE'],
  workers: 4,
  pageSize: 6,
  async fetchPage(job, page, ctx) {
    const { env, fetch, sleep } = ctx;
    const uri = job.sub[0].replace(/(sid=)([^&]*)/, (_, p, v) => p + v.replace(/\//g, '%2F')) + (page > 1 ? '&page=' + page : '');
    const body = JSON.stringify({
      pageUri: uri,
      pageContext: { trackingContext: { context: { eVar51: 'neo/merchandising', eVar61: 'creative_card' } }, networkSpeed: 1700 },
      requestContext: { type: 'BROWSE_PAGE' },
      locationContext: { pincode: env.PINCODE || '560032', changed: false }
    });
    for (let a = 0; a < 4; a++) {
      const r = await fetch(`https://${dc}.rome.api.flipkart.com/api/4/page/fetch?cacheFirst=false`, {
        method: 'POST', body,
        headers: { accept: '*/*', 'content-type': 'application/json', flipkart_secure: 'true', 'user-agent': UA, 'x-user-agent': UA + ' FKUA/msite/0.0.4/msite/Mobile', origin: 'https://www.flipkart.com', referer: 'https://www.flipkart.com/', cookie: env.FLIPKART_COOKIE }
      });
      if (r.status === 406) { // "DC Change": retry on the data centre the API names
        const j = await r.json().catch(() => null), id = j && j.RESPONSE && j.RESPONSE.id;
        if (id && String(id) !== dc) { dc = String(id); continue; }
        return [];
      }
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error(`Flipkart refused the session (HTTP ${r.status}). Refresh FLIPKART_COOKIE.`), { blocked: true });
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (a + 1)); continue; }
      if (!r.ok) return [];
      const json = await r.json();
      const red = json && json.RESPONSE && json.RESPONSE.pageMeta && json.RESPONSE.pageMeta.redirectionObject;
      if (red && /hyperlocal-preview/.test(red.url || '')) throw Object.assign(new Error('No Minutes delivery location on this session. Set your address on flipkart.com, then copy a fresh FLIPKART_COOKIE.'), { blocked: true });
      return extract(json, job.g.name + ' › ' + job.sub[1], ctx);
    }
    throw new Error('rate limited');
  }
};
