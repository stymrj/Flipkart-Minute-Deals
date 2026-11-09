// Flipkart Minutes: the same page-fetch API the mobile site uses, with your own session cookie.
// v2: discount-first page=N requests (no pagination tokens), Atlas/DLS card shapes,
// totalDiscount + tracking prices, swapped-price and glued-MRP repair.
'use strict';
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
let dc = '1';

function discOf(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  // Discount can arrive wrapped in an object ({value: "85% off"}):
  // unwrap it first instead of stringifying the object (which reads 0
  // and silently drops the item under the minimum-discount filter).
  if (typeof v === 'object') return discOf(v.value != null ? v.value : (v.text != null ? v.text : v.defaultValue));
  const m = String(v).match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? +m[1] : 0;
}
function cleanImg(u) {
  return String(u || '').replace('{@width}', '200').replace('{@height}', '200').replace('?q={@quality}', '?q=80').replace('{@quality}', '80');
}
function titleFromUrl(u) {
  const s = String(u || '').split('?')[0].replace(/\/p\/itm[a-z0-9_-]+.*$/i, '').split('/').filter(Boolean).pop() || '';
  const words = s.replace(/-/g, ' ').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, ' ');
  return words ? words.replace(/\b\w/g, c => c.toUpperCase()) : '';
}
// Shared finish for every parser shape (same rules as src/deals.js).
function fromParts(id, title, sell, mrp, disc, img, url, oos, cat, brandOf) {
  if (!sell || sell <= 0) return null;
  title = String(title || '').trim() || titleFromUrl(url) || 'Product';
  if (mrp > 0 && sell > mrp) { const t = sell; sell = mrp; mrp = t; }
  if ((!mrp || mrp <= sell) && disc > 0 && disc < 100) mrp = Math.round(sell / (1 - disc / 100));
  if (!mrp || mrp < sell) mrp = sell;
  if (!disc || disc <= 0 || disc > 99) disc = mrp > sell ? Math.round((mrp - sell) / mrp * 100) : 0;
  if (mrp > sell && disc > 0 && String(mrp).endsWith(String(Math.round(disc)))) {
    const cur = Math.round((mrp - sell) / mrp * 100);
    if (Math.abs(cur - disc) > 2) {
      const clean = parseInt(String(mrp).slice(0, -String(Math.round(disc)).length), 10);
      if (clean > sell) {
        const cd = Math.round((clean - sell) / clean * 100);
        if (Math.abs(cd - disc) <= 2) { mrp = clean; disc = cd; }
      }
    }
  }
  let link = url ? String(url) : '';
  if (link && link.indexOf('http') !== 0) link = 'https://www.flipkart.com' + link;
  if (link && link.indexOf('marketplace=HYPERLOCAL') < 0) link += (link.indexOf('?') < 0 ? '?' : '&') + 'marketplace=HYPERLOCAL';
  const idm = link.match(/pid=([A-Z0-9_-]+)/i) || link.match(/\/p\/(itm[a-z0-9_-]+)/i);
  return { id: String(id || (idm && idm[1]) || (title + '|' + sell)), title: String(title), brand: brandOf(title), price: sell, mrp, disc, url: link, inStock: !oos, cat };
}
function normalise(v, cat, ctx) {
  const { price, brandOf } = ctx;
  const t = v.titles || {};
  const title = t.title || t.newTitle || t.superTitle || v.productTitle;
  const pr = v.pricing || {};
  const sell = price(pr.finalPrice && (pr.finalPrice.value != null ? pr.finalPrice.value : pr.finalPrice));
  if (!sell) return null;
  let mrp = 0;
  for (const x of pr.prices || []) if (x.priceType === 'MRP') { mrp = price(x.value); break; }
  if (!mrp) mrp = price(pr.mrp);
  const disc = discOf(pr.totalDiscount);
  const img = (v.media && v.media.images && v.media.images[0] && v.media.images[0].url) || (v.images && v.images[0] && v.images[0].url) || '';
  const path = v.baseUrl || v.smartUrl || '';
  const pa = v.productAction && v.productAction.value;
  // Only an explicit out-of-stock state hides an item: any other state
  // (e.g. LOW_STOCK on a clearance line) is still buyable, and treating
  // it as out of stock hid the deepest discounts behind "in stock only".
  const oos = (v.availability && v.availability.displayState === 'OUT_OF_STOCK') ||
    (pa && (pa.enabled === false || pa.actionType === 'NOTIFY_ME')) ||
    (v.buyability && v.buyability.intent === 'negative') ||
    (v.action && v.action.params && v.action.params.isAvailable === false);
  return fromParts(v.id || v.itemId || '', title, sell, mrp, disc, cleanImg(img), path, oos, cat, brandOf);
}
// Atlas / DLS cards carry no titles/pricing object, so the generic walk misses them.
function parseDls(json, cat, ctx, out, seen) {
  const { price, brandOf } = ctx;
  const slots = (json && json.RESPONSE && json.RESPONSE.slots) || (json && json.slots) ||
    (json && json.multiWidgetState && json.multiWidgetState.widgetsData && json.multiWidgetState.widgetsData.slots) ||
    (json && json.multiWidgetState && json.multiWidgetState.pageDataResponse && json.multiWidgetState.pageDataResponse.slots) || [];
  for (const s of slots) {
    const w = (s.slotData || s).widget || (s.slotData || s);
    const dls = (w.data && w.data.dlsData) || {};
    for (const k in dls) {
      if (k.indexOf('MRCSV') < 0 && k.indexOf('carouselData') < 0 && k.indexOf('gridData') < 0 && k.indexOf('horizontalListData') < 0) continue;
      const cards = (dls[k] && dls[k].value) || [];
      if (!Array.isArray(cards)) continue;
      for (const cw of cards) {
        try {
          const cval = (cw && cw.value) || {};
          if (cval.snb_hl_text_0 && cval.snb_hl_text_0.value) {
            const snb = cval.snb_hl_text_0.value;
            const lnk = (cval.col_0 && cval.col_0.action && (cval.col_0.action.url || cval.col_0.action.originalUrl)) || '';
            const title = (snb.label_0 && snb.label_0.value && snb.label_0.value.text) || (snb.label_1 && snb.label_1.value && snb.label_1.value.text) || (cval.trackerData_0 && cval.trackerData_0.tracking && cval.trackerData_0.tracking.contentTitle) || '';
            const stepper = (cval.stepperData_0 && cval.stepperData_0.action) || (cval.snb_beauty_gmh_image_0 && cval.snb_beauty_gmh_image_0.value && cval.snb_beauty_gmh_image_0.value.stepperData_0 && cval.snb_beauty_gmh_image_0.value.stepperData_0.action);
            let p1 = price(snb.label_4), p2 = price(snb.label_3);
            if (!p1 && stepper) p1 = price((stepper.params && stepper.params.price) || (stepper.tracking && stepper.tracking.fsp));
            if (!p2 && stepper) p2 = price(stepper.tracking && stepper.tracking.mrp);
            const sell = p1 && p2 ? Math.min(p1, p2) : (p1 || p2 || 0);
            const mrp = p1 && p2 ? Math.max(p1, p2) : sell;
            let disc = 0;
            const l2 = snb.label_2 && snb.label_2.value;
            const l2s = typeof l2 === 'object' ? ((l2.params && l2.params.defaultValue) || l2.text || '') : String(l2 || '');
            const dm = String(l2s).match(/(\d+)%/);
            if (dm) disc = +dm[1];
            const oos = (stepper && stepper.tracking && stepper.tracking.isAvailable === 'false') || (stepper && stepper.enabled === false) || (cval.action && cval.action.params && cval.action.params.isAvailable === false);
            let img = (cval.col_0 && cval.col_0.action && cval.col_0.action.params && cval.col_0.action.params.imageUrl) || (stepper && stepper.params && stepper.params.productImage) || '';
            if (!img) {
              const io = (cval.image_0 && cval.image_0.value) || (cval.snb_beauty_gmh_image_0 && cval.snb_beauty_gmh_image_0.value && cval.snb_beauty_gmh_image_0.value.image_0 && cval.snb_beauty_gmh_image_0.value.image_0.value) || {};
              img = (io.params && io.params.defaultValue) || io.imageHack || io.dynamicImageUrl || '';
            }
            const p = fromParts('', title, sell, mrp, disc, cleanImg(img), lnk, oos, cat, brandOf);
            if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); }
            continue;
          }
          let pcard = null;
          for (const pk in cval) {
            if (pk.indexOf('product-card') >= 0 || pk.indexOf('productCard') >= 0) { pcard = (cval[pk] && cval[pk].value) || {}; break; }
          }
          if (!pcard) continue;
          const sa = (pcard.stepperData_0 && pcard.stepperData_0.action) || {};
          const stk = sa.tracking || {};
          const pSell = price((sa.params && sa.params.price) || stk.fsp) || price(pcard.label_5) || 0;
          const pMrp = price(stk.mrp) || price(pcard.label_4) || 0;
          const sell = pSell && pMrp ? Math.min(pSell, pMrp) : (pSell || pMrp || 0);
          const mrp = pSell && pMrp ? Math.max(pSell, pMrp) : sell;
          let disc = 0;
          if (pcard.label_15 && pcard.label_15.value) {
            const l15 = pcard.label_15.value;
            const l15s = typeof l15 === 'object' ? ((l15.UNLOCKED && l15.UNLOCKED.value && l15.UNLOCKED.value.text) || (l15.LOCKED && l15.LOCKED.value && l15.LOCKED.value.text) || l15.text || '') : String(l15);
            const dm = String(l15s).match(/(\d+)%/);
            if (dm) disc = +dm[1];
          }
          const lnk = (pcard.box_5 && pcard.box_5.action && pcard.box_5.action.url) || (pcard.col_0 && pcard.col_0.action && pcard.col_0.action.url) || (pcard.box_0 && pcard.box_0.action && pcard.box_0.action.url) || '';
          const title = (pcard.label_2 && pcard.label_2.value && pcard.label_2.value.text) || (pcard.label_1 && pcard.label_1.value && pcard.label_1.value.text) || (pcard.label_0 && pcard.label_0.value && pcard.label_0.value.text) || (pcard.trackerData_0 && pcard.trackerData_0.tracking && pcard.trackerData_0.tracking.contentTitle) || '';
          let img = (sa.params && sa.params.productImage) || '';
          if (!img) {
            const io = (pcard['hp_reco_pmu_product-card_image_0'] && pcard['hp_reco_pmu_product-card_image_0'].value) || {};
            img = (io.image_0 && io.image_0.value && io.image_0.value.dynamicImageUrl) || (io.video_0 && io.video_0.value && io.video_0.value.dynamicImageUrl) || '';
          }
          const oos = sa.enabled === false || (pcard.button_0 && pcard.button_0.value && pcard.button_0.value.actionType === 'NOTIFY_ME') || (pcard.button_0 && pcard.button_0.value && pcard.button_0.value.text && /notify/i.test(pcard.button_0.value.text));
          const p = fromParts('', title, sell, mrp, disc, cleanImg(img), lnk, oos, cat, brandOf);
          if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); }
        } catch (e) { /* one bad card must not kill the page */ }
      }
    }
  }
}
function extract(json, cat, ctx) {
  const out = [], seen = new Set(), listingDiscs = [];
  (function walk(o, d) {
    if (!o || typeof o !== 'object' || d > 14) return;
    if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; }
    if (o.titles && o.pricing) {
      const p = normalise(o, cat, ctx);
      if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); listingDiscs.push(p.disc); }
      return;
    }
    for (const k in o) walk(o[k], d + 1);
  })(json, 0);
  try { parseDls(json, cat, ctx, out, seen); } catch (e) { /* keep shape-1 results */ }
  // Paging signal: the lowest discount in the discount-sorted listing
  // (shape-1 products) only. Atlas/DLS recommendation cards carry
  // arbitrary discounts and sit last in the array, so reading the last
  // item's discount stopped paging after page 1 whenever a low-discount
  // card trailed a page full of 85-95% deals.
  out.tailDisc = listingDiscs.length ? Math.min(...listingDiscs) : (out.length ? Math.min(...out.map(p => p.disc)) : 0);
  out.totalFound = out.length;
  return out;
}
function sanitizeUri(u) {
  return String(u || '').replace(/(sid=)([^&]*)/, (_, p, v) => p + v.replace(/\//g, '%2F'));
}
// Discount-first page URIs: sort=discount on every request, page=N after page 1.
function pageUriFor(uri, page) {
  let u = sanitizeUri(uri);
  if (!/[?&]sort=/.test(u)) u += (u.indexOf('?') < 0 ? '?' : '&') + 'sort=discount';
  if (page > 1) u = /([?&])page=\d+/.test(u) ? u.replace(/([?&])page=\d+/, '$1page=' + page) : u + '&page=' + page;
  return u;
}
function pincodeFromCookie(cookie) {
  const m = String(cookie || '').match(/(?:^|;\s*)(?:snPincode|deliveryPincode|pincode)=(\d{6})/i);
  return m ? m[1] : '';
}

module.exports = {
  label: 'Flipkart Minutes',
  required: ['FLIPKART_COOKIE'],
  workers: 4,
  sortedByDiscount: true,
  async fetchPage(job, page, ctx) {
    const { env, fetch, sleep } = ctx;
    // Pincode: an explicit PINCODE wins; otherwise use the one saved in the
    // session cookie, so the bot never sends a different address than the user has.
    let pin = env.PINCODE || pincodeFromCookie(env.FLIPKART_COOKIE) || '';
    pin = +(pin || 560032) || pin;
    const body = JSON.stringify({
      pageUri: pageUriFor(job.sub[0], page),
      pageContext: { trackingContext: { context: { eVar51: 'neo/merchandising', eVar61: 'creative_card' } }, networkSpeed: 4750 },
      requestContext: { type: 'BROWSE_PAGE' },
      locationContext: { pincode: pin, changed: false }
    });
    for (let a = 0; a < 4; a++) {
      const r = await fetch(`https://${dc}.rome.api.flipkart.com/api/4/page/fetch?cacheFirst=false`, {
        method: 'POST', body,
        headers: { accept: '*/*', 'accept-language': 'en-US,en;q=0.9', 'content-type': 'application/json', flipkart_secure: 'true', 'user-agent': UA, 'x-user-agent': UA + ' FKUA/website/42/website/Desktop', origin: 'https://www.flipkart.com', referer: 'https://www.flipkart.com/', cookie: env.FLIPKART_COOKIE }
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
      const threshold = job.g.id === 'staples' ? 40 : 50;
      items.more = items.totalFound >= 6 && items.tailDisc >= threshold;
      return items;
    }
    throw new Error('rate limited');
  }
};
