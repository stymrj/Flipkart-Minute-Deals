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
  return { id: String(v.id || v.itemId || (idm && idm[1]) || title + '|' + sell), title: String(title), brand: brandOf(title), price: sell, mrp, disc: mrp > sell ? Math.round((mrp - sell) / mrp * 100) : 0, url: path ? 'https://www.flipkart.com' + path + (path.indexOf('?') < 0 ? '?' : '&') + 'marketplace=HYPERLOCAL' : '', inStock: !oos, cat };
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
  async fetchPage(job, page, ctx) {
    const { env, fetch, sleep } = ctx;
    if (page === 1) job.pager = null;
    // Minutes ignores page=N: the next page needs the token from the previous response.
    const pageContext = job.pager
      ? { slotContextMap: {}, pageHashKey: job.pager.hash, paginatedFetch: true, fetchAllPages: false, paginationContextMap: job.pager.map, pageNumber: page }
      : { trackingContext: { context: { eVar51: 'neo/merchandising', eVar61: 'creative_card' } }, networkSpeed: 4750 };
    const pin = +(env.PINCODE || 560032) || env.PINCODE;
    const body = JSON.stringify({ pageUri: job.sub[0], pageContext, requestContext: { type: 'BROWSE_PAGE' }, locationContext: { pincode: pin, changed: false } });
    for (let a = 0; a < 4; a++) {
      const r = await fetch(`https://${dc}.rome.api.flipkart.com/api/4/page/fetch?cacheFirst=false`, {
        method: 'POST', body,
        headers: { accept: '*/*', 'content-type': 'application/json', flipkart_secure: 'true', 'user-agent': UA, 'x-user-agent': UA + ' FKUA/website/42/website/Desktop', origin: 'https://www.flipkart.com', referer: 'https://www.flipkart.com/', cookie: env.FLIPKART_COOKIE }
      });
      if (r.status === 406) { // "DC Change": retry on the data centre the API names
        const j = await r.json().catch(() => null), id = j && j.RESPONSE && j.RESPONSE.id;
        if (id && String(id) !== dc) { dc = String(id); continue; }
        return Object.assign([], { more: false });
      }
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error(`Flipkart refused the session (HTTP ${r.status}). Refresh FLIPKART_COOKIE.`), { blocked: true });
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (a + 1)); continue; }
      if (!r.ok) return Object.assign([], { more: false });
      const json = await r.json();
      const red = json && json.RESPONSE && json.RESPONSE.pageMeta && json.RESPONSE.pageMeta.redirectionObject;
      if (red && /hyperlocal-preview/.test(red.url || '')) throw Object.assign(new Error('No Minutes delivery location on this session. Set your address on flipkart.com, then copy a fresh FLIPKART_COOKIE.'), { blocked: true });
      const items = extract(json, job.g.name + ' › ' + job.sub[1], ctx);
      const pd = json && json.RESPONSE && json.RESPONSE.pageData;
      items.more = !!(pd && pd.hasMorePages && pd.paginationContextMap);
      if (items.more) job.pager = { hash: pd.pageHash, map: pd.paginationContextMap };
      return items;
    }
    throw new Error('rate limited');
  }
};
