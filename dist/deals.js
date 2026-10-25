/*!
 * PriceDrop Hunter for Flipkart Minutes
 * Runs as a bookmarklet on flipkart.com (uses your own session + pincode),
 * or in DEMO mode anywhere else (synthetic data, for previewing the UI).
 */
(function () {
  'use strict';
  if (window.__FKM__) { window.__FKM__.toggle(); return; }

  // ───────────────────────── Catalogue ─────────────────────────
  // [code, name]. Group-level scan is used when subs is empty.
  const GROUPS = [
    { id: 'bpe', name: 'Staples', icon: '🌾', subs: [['3uv', 'Dal & Pulses'], ['4wu', 'Ghee & Oils'], ['9da', 'Atta & Flours'], ['a6m', 'Masala & Spices'], ['zwp', 'Rice'], ['dtp', 'Dry Fruits'], ['fdl', 'Sugar, Jaggery & Salt']] },
    { id: 'ujs', name: 'Snacks & Beverages', icon: '🍿', subs: [['eb9', 'Biscuits'], ['dd9', 'Chips'], ['amr', 'Tea'], ['t7k', 'Coffee'], ['afd', 'Juices'], ['vnq', 'Nutritional Drinks'], ['dfw', 'Soft Drinks'], ['iau', 'Instant Drink Mixes'], ['wsx', 'Water']] },
    { id: 'esa', name: 'Dairy, Bakery & Eggs', icon: '🥛', subs: [['dt6', 'Dairy'], ['hh7', 'Eggs'], ['93l', 'Bakery, Sweets & Namkeen']] },
    { id: 'u0u', name: 'Packaged Goods', icon: '🍝', subs: [['ltz', 'Noodles & Pasta'], ['7o6', 'Chocolates'], ['0tl', 'Ketchups'], ['bx9', 'Cereals'], ['j4e', 'Jam & Honey'], ['wd7', 'Cooking Sauces'], ['td1', 'Baking']] },
    { id: 'njl', name: 'Personal & Baby Care', icon: '🧴', subs: [['vpw', 'Hair Care'], ['2s3', 'Oral Care'], ['smb', 'Diapers & Wipes']] },
    { id: 'mk9', name: 'Fruits & Vegetables', icon: '🥦', subs: [['w9z', 'Fruits'], ['aiw', 'Vegetables']] },
    { id: 'cwl', name: 'Household Care', icon: '🧽', subs: [['2z2', 'Detergents'], ['bdc', 'Utensil Cleaners'], ['u3c', 'Floor Cleaners'], ['qz9', 'Repellents'], ['2wc', 'Paper'], ['0s4', 'Basic Electricals']] },
    { id: 'uyk', name: 'Home & Kitchen', icon: '🍳', subs: [['hho', 'Kitchen Tools'], ['vdx', 'Cookware'], ['6f4', 'Bath & Bed']] },
    { id: 'h26', name: 'Fashion & Accessories', icon: '👕', hloc: '0026', subs: [] },
    { id: 'h38', name: 'Electronics & Gadgets', icon: '🎧', hloc: '0038', subs: [] },
    { id: 'h34', name: 'Ice Cream & Desserts', icon: '🍦', hloc: '0034', subs: [] },
    { id: 'h28', name: 'Toys, Games & Sports', icon: '🧸', hloc: '0028', subs: [] },
    { id: 'h31', name: 'Chicken, Meat & Fish', icon: '🍗', hloc: '3106', subs: [] },
    { id: 'h49', name: 'Paan Corner & Refreshers', icon: '🌿', hloc: '4901', subs: [] }
  ];
  const BASE = '/grocery/pr?marketplace=HYPERLOCAL&sort=discount&sid=73z';
  function groupUri(g) {
    if (g.hloc) return '/grocery/pr?marketplace=HYPERLOCAL&sort=discount&sid=hloc%2F' + g.hloc;
    return BASE + '&p[]=facets.category[]=73z/' + g.id;
  }
  function subUri(g, code) { return groupUri(g) + '&p[]=facets.category[]=73z/' + g.id + '/' + code + '/'; }

  const EXCLUDED = ['back cover', 'case cover', 'phone cover', 'mobile cover', 'phone case', 'screen guard', 'tempered glass'];

  // ───────────────────────── Utils ─────────────────────────
  const $inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
  const DEMO = !!window.__FKM_DEMO__ || !/(^|\.)flipkart\.com$/.test(location.hostname);

  const KEY = 'fkm_v2';
  const defaults = {
    theme: 'auto', view: 'grid', sort: 'score', minDisc: 30, maxPrice: 0, depth: 3,
    stockOnly: true, groups: ['bpe', 'ujs', 'esa', 'u0u'], pincode: '560032',
    favs: [], hidden: [], list: {}, prices: {}, lastScan: 0
  };
  let store;
  try { store = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { store = Object.assign({}, defaults); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* quota/private mode */ } };

  // ───────────────────────── Flipkart API ─────────────────────────
  function activePincode() {
    if (store.pincode) return store.pincode;
    try {
      const m = document.cookie.match(/(?:pincode|snPincode|deliveryPincode)=(\d{6})/);
      if (m) return m[1];
    } catch (e) { /* ignore */ }
    return '560032';
  }
  function sanitizeUri(u) {
    return u.replace(/(sid=)([^&]*)/, (_, p, v) => p + v.replace(/\//g, '%2F'));
  }
  let dc = '1', noLocation = false;
  async function fetchRome(uri, signal) {
    const body = {
      pageUri: sanitizeUri(uri),
      pageContext: { trackingContext: { context: { eVar51: 'neo/merchandising', eVar61: 'creative_card' } }, networkSpeed: 1700 },
      requestContext: { type: 'BROWSE_PAGE' },
      locationContext: { pincode: activePincode(), changed: false }
    };
    let ua = navigator.userAgent;
    if (ua.indexOf('FKUA/') < 0) ua += ' FKUA/msite/0.0.4/msite/Mobile';
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (signal.stop) throw new Error('stopped');
      try {
        const r = await fetch('https://' + dc + '.rome.api.flipkart.com/api/4/page/fetch?cacheFirst=false', {
          method: 'POST', mode: 'cors', credentials: 'include',
          headers: { accept: '*/*', 'content-type': 'application/json', flipkart_secure: 'true', 'x-user-agent': ua },
          body: JSON.stringify(body)
        });
        if (r.status === 406) { // "DC Change": this pincode lives in another data centre, retry there
          const j = await r.json().catch(() => null);
          const id = j && j.RESPONSE && j.RESPONSE.id;
          if (id && String(id) !== dc) { dc = String(id); continue; }
          return null;
        }
        if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
        if (!r.ok) return null;
        const json = await r.json();
        const red = json && json.RESPONSE && json.RESPONSE.pageMeta && json.RESPONSE.pageMeta.redirectionObject;
        if (red && /hyperlocal-preview/.test(red.url || '')) noLocation = true;
        return json;
      } catch (e) { lastErr = e; await sleep(600 * (attempt + 1)); }
    }
    throw lastErr;
  }

  function price(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { const m = v.replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? +m[0] : 0; }
    if (typeof v === 'object') {
      for (const k of ['value', 'text', 'defaultValue', 'params', 'UNLOCKED', 'LOCKED']) {
        const p = price(v[k]); if (p > 0) return p;
      }
    }
    return 0;
  }
  function normalise(v, catName) {
    const t = v.titles || {};
    const title = t.title || t.newTitle || t.superTitle || v.productTitle;
    const pr = v.pricing || {};
    const sell = price(pr.finalPrice && (pr.finalPrice.value != null ? pr.finalPrice.value : pr.finalPrice));
    if (!title || !sell) return null;
    let mrp = 0;
    const prices = pr.prices || [];
    for (const x of prices) if (x.priceType === 'MRP') { mrp = price(x.value); break; }
    if (!mrp) mrp = price(pr.mrp);
    if (mrp < sell) mrp = sell;
    const disc = mrp > sell ? Math.round((mrp - sell) / mrp * 100) : 0;
    let img = (v.media && v.media.images && v.media.images[0] && v.media.images[0].url) || (v.images && v.images[0] && v.images[0].url) || '';
    img = img.replace('{@width}', '240').replace('{@height}', '240').replace('{@quality}', '70');
    const path = v.baseUrl || v.smartUrl || '';
    const pa = v.productAction && v.productAction.value;
    const oos = (v.availability && v.availability.displayState === 'OUT_OF_STOCK') ||
      (pa && (pa.enabled === false || pa.actionType === 'NOTIFY_ME')) ||
      (v.buyability && v.buyability.intent === 'negative');
    const idm = path.match(/pid=([A-Z0-9]+)/i) || path.match(/\/p\/(itm[a-z0-9]+)/i);
    const id = v.id || v.itemId || (idm && idm[1]) || (title + '|' + sell);
    return { id: String(id), title: String(title), brand: guessBrand(title), price: sell, mrp, disc, save: mrp - sell, img, url: path ? 'https://www.flipkart.com' + path : '', inStock: !oos, cat: catName };
  }
  function guessBrand(t) { return (t.trim().split(/\s+/)[0] || '').replace(/[^\w&'-]/g, ''); }
  // Walk the whole response instead of hard-coding slot paths: survives layout changes.
  function extract(json, catName) {
    const out = [], seen = new Set();
    (function walk(o, d) {
      if (!o || typeof o !== 'object' || d > 14) return;
      if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; }
      if (o.titles && o.pricing) {
        const p = normalise(o, catName);
        if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); }
        return;
      }
      for (const k in o) walk(o[k], d + 1);
    })(json, 0);
    return out;
  }
  const allowed = p => { const t = p.title.toLowerCase(); return !EXCLUDED.some(k => t.includes(k)); };

  // ───────────────────────── Demo data ─────────────────────────
  function demoFetch(groupId, subName, page) {
    let seed = 0; const key = groupId + subName + page;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const brands = ['Amul', 'Tata', 'Nestlé', 'Britannia', 'Aashirvaad', 'Fortune', 'Haldiram', 'Dabur', 'Surf', 'Maggi', 'Cadbury', 'Pepsi', 'Real', 'Godrej', 'Patanjali', 'Lays'];
    const words = ['Premium', 'Classic', 'Value Pack', 'Family Pack', 'Fresh', 'Organic', 'Combo', 'Select', 'Mega Pack'];
    const g = GROUPS.find(x => x.id === groupId) || GROUPS[0];
    const items = [];
    const n = page > 2 ? 4 : 12;
    for (let i = 0; i < n; i++) {
      const mrp = Math.round(40 + rnd() * 900);
      const disc = Math.round(8 + rnd() * rnd() * 70 + (rnd() < 0.05 ? 15 : 0));
      const sell = Math.max(5, Math.round(mrp * (1 - disc / 100)));
      const brand = brands[Math.floor(rnd() * brands.length)];
      const hue = Math.floor(rnd() * 360);
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},80%,88%)'/><stop offset='1' stop-color='hsl(${(hue + 40) % 360},70%,72%)'/></linearGradient></defs><rect width='240' height='240' fill='url(#g)'/><text x='50%' y='56%' font-size='96' text-anchor='middle'>${g.icon}</text></svg>`;
      items.push({
        id: `${groupId}-${subName}-${page}-${i}`, title: `${brand} ${subName} ${words[Math.floor(rnd() * words.length)]} ${[100, 250, 500, 1000][Math.floor(rnd() * 4)]}g`,
        brand, price: sell, mrp, disc: sell < mrp ? Math.round((mrp - sell) / mrp * 100) : 0, save: mrp - sell,
        img: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), url: '#demo', inStock: rnd() > 0.12, cat: g.name + ' › ' + subName
      });
    }
    return items;
  }

  // ───────────────────────── State ─────────────────────────
  const S = { products: new Map(), scanning: false, done: 0, total: 0, errors: 0, ctl: { stop: false },
    q: '', brand: '', cat: '', favOnly: false, newOnly: false, shown: 60, tab: 'deals', panel: false, startedAt: 0 };

  // ───────────────────────── Scanner ─────────────────────────
  async function scan() {
    if (S.scanning) return;
    const jobs = [];
    for (const g of GROUPS) {
      if (!store.groups.includes(g.id)) continue;
      if (g.subs.length) g.subs.forEach(([c, n]) => jobs.push({ g, name: n, uri: subUri(g, c) }));
      else jobs.push({ g, name: 'All', uri: groupUri(g) });
    }
    if (!jobs.length) { toast('Pick at least one category'); return; }
    S.scanning = true; S.ctl = { stop: false }; S.done = 0; S.errors = 0; S.total = jobs.length; S.startedAt = Date.now();
    S.products.clear(); S.shown = 60; render();
    const ctl = S.ctl, queue = jobs.slice();
    const worker = async () => {
      while (queue.length && !ctl.stop) {
        const job = queue.shift();
        try {
          for (let page = 1; page <= store.depth && !ctl.stop; page++) {
            let items;
            if (DEMO) { await sleep(120 + Math.random() * 260); items = demoFetch(job.g.id, job.name, page); }
            else {
              const json = await fetchRome(job.uri + (page > 1 ? '&page=' + page : ''), ctl);
              items = json ? extract(json, job.g.name + ' › ' + job.name) : [];
            }
            let fresh = 0;
            for (const p of items) {
              if (!allowed(p) || S.products.has(p.id)) continue;
              const prev = store.prices[p.id];
              p.isNew = prev == null; p.was = prev != null && prev !== p.price ? prev : 0;
              S.products.set(p.id, p); fresh++;
            }
            scheduleRender();
            if (fresh < 3) break;
            if (items.length && items[items.length - 1].disc < Math.min(store.minDisc, 20)) break; // sorted by discount: rest is below threshold
          }
        } catch (e) { if (!ctl.stop) S.errors++; }
        S.done++; scheduleRender();
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    S.scanning = false;
    const prices = store.prices;
    S.products.forEach(p => { prices[p.id] = p.price; });
    const ids = Object.keys(prices);
    if (ids.length > 6000) ids.slice(0, ids.length - 6000).forEach(k => delete prices[k]);
    store.lastScan = Date.now(); save(); render();
    if (noLocation && !S.products.size) { toast('No Minutes location set. Open flipkart.com, choose your Minutes delivery address/pincode, then scan again.'); return; }
    toast(ctl.stop ? 'Scan stopped' : `Scan complete · ${S.products.size} products` + (S.errors ? ` · ${S.errors} failed` : ''));
  }

  // ───────────────────────── Filtering ─────────────────────────
  const score = p => p.disc + Math.min(30, p.save / 8);
  const SORTS = {
    score: ['Best deal', (a, b) => score(b) - score(a)],
    disc: ['Highest discount', (a, b) => b.disc - a.disc || b.save - a.save],
    save: ['Biggest saving ₹', (a, b) => b.save - a.save],
    pasc: ['Price: low → high', (a, b) => a.price - b.price],
    pdesc: ['Price: high → low', (a, b) => b.price - a.price],
    name: ['Name A–Z', (a, b) => a.title.localeCompare(b.title)]
  };
  function filtered() {
    const q = S.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const fav = new Set(store.favs), hid = new Set(store.hidden);
    const out = [];
    S.products.forEach(p => {
      if (hid.has(p.id)) return;
      if (store.stockOnly && !p.inStock) return;
      if (p.disc < store.minDisc) return;
      if (store.maxPrice && p.price > store.maxPrice) return;
      if (S.brand && p.brand !== S.brand) return;
      if (S.cat && p.cat.split(' › ')[0] !== S.cat) return;
      if (S.favOnly && !fav.has(p.id)) return;
      if (S.newOnly && !p.isNew && !p.was) return;
      if (q.length) { const t = (p.title + ' ' + p.cat).toLowerCase(); if (!q.every(w => t.includes(w))) return; }
      out.push(p);
    });
    return out.sort(SORTS[store.sort][1]);
  }

  // ───────────────────────── UI ─────────────────────────
  const host = document.createElement('div');
  host.id = 'fkm-host';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;display:none';
  const root = host.attachShadow({ mode: 'open' });
  const CSS = `
:host{all:initial}
*{box-sizing:border-box;margin:0}
.app{--bg:#f4f6fb;--sf:#fff;--sf2:#eef1f8;--tx:#161a2b;--mt:#6b7391;--bd:#e1e5f0;--pr:#2874f0;--pr2:#1b57c4;--ac:#ffe500;--ok:#0f9d58;--hot:#e5484d;--sh:0 1px 2px rgba(20,30,70,.06),0 6px 20px rgba(20,30,70,.06);
 position:absolute;inset:0;background:var(--bg);color:var(--tx);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;display:flex;flex-direction:column}
.app.dark{--bg:#0e1220;--sf:#171c30;--sf2:#1f2540;--tx:#eef1fb;--mt:#8b94b8;--bd:#2a3150;--pr:#5b95ff;--pr2:#7aaaff;--sh:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35)}
button,input,select{font:inherit;color:inherit}
button{cursor:pointer;border:0;background:none}
header{display:flex;align-items:center;gap:12px;padding:12px 20px;background:var(--pr);color:#fff;flex-wrap:wrap}
.logo{font-weight:800;font-size:18px;letter-spacing:-.3px;display:flex;align-items:center;gap:8px}
.logo i{background:var(--ac);color:#111;border-radius:8px;padding:2px 8px;font-style:normal;font-size:12px;font-weight:800}
.demo{background:#ffe5e5;color:#b3261e;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700}
.search{flex:1;min-width:180px;max-width:520px;position:relative}
.search input{width:100%;border:0;border-radius:10px;padding:10px 14px 10px 38px;background:#fff;color:#161a2b;outline:0}
.search:before{content:"🔍";position:absolute;left:12px;top:8px;font-size:14px}
.sp{flex:1}
.ib{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.16);color:#fff;font-size:16px;position:relative}
.ib:hover{background:rgba(255,255,255,.28)}
.badge{position:absolute;top:-4px;right:-4px;background:var(--ac);color:#111;border-radius:99px;font-size:10px;font-weight:800;padding:1px 5px}
.body{flex:1;display:flex;min-height:0}
aside{width:290px;flex:none;background:var(--sf);border-right:1px solid var(--bd);overflow:auto;padding:16px;display:flex;flex-direction:column;gap:18px}
aside h4{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--mt);margin-bottom:8px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--bd);background:var(--sf2);border-radius:99px;padding:5px 10px;font-size:12px;white-space:nowrap}
.chip.on{background:var(--pr);border-color:var(--pr);color:#fff}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.fld{width:100%;padding:8px 10px;border:1px solid var(--bd);border-radius:8px;background:var(--sf2)}
input[type=range]{width:100%;accent-color:var(--pr)}
.sw{display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer}
.btn{background:var(--pr);color:#fff;border-radius:10px;padding:11px 14px;font-weight:700;width:100%}
.btn:hover{background:var(--pr2)}
.btn.stop{background:var(--hot)}
.btn.ghost{background:var(--sf2);color:var(--tx);font-weight:600;padding:8px 10px;width:auto;border:1px solid var(--bd)}
main{flex:1;overflow:auto;padding:16px 20px 40px;min-width:0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px}
.stat{background:var(--sf);border-radius:12px;padding:10px 14px;box-shadow:var(--sh)}
.stat b{display:block;font-size:20px;letter-spacing:-.5px}.stat span{color:var(--mt);font-size:12px}
.bar{height:4px;background:var(--bd);border-radius:9px;overflow:hidden;margin:0 0 12px}
.bar div{height:100%;background:linear-gradient(90deg,var(--pr),#7aaaff);transition:width .3s}
.tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.tools select{padding:7px 10px;border-radius:8px;border:1px solid var(--bd);background:var(--sf)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
.grid.list{grid-template-columns:1fr}
.card{background:var(--sf);border-radius:14px;box-shadow:var(--sh);overflow:hidden;display:flex;flex-direction:column;position:relative;transition:transform .15s}
.card:hover{transform:translateY(-2px)}
.card.oos{opacity:.55}
.list .card{flex-direction:row;align-items:center}
.list .im{width:96px;height:96px;flex:none;aspect-ratio:auto}
.im{aspect-ratio:1;background:var(--sf2) center/cover no-repeat;position:relative}
.dc{position:absolute;top:8px;left:8px;background:var(--ok);color:#fff;font-weight:800;font-size:12px;padding:3px 8px;border-radius:7px}
.dc.hot{background:var(--hot)}
.tag{position:absolute;top:8px;right:40px;background:var(--ac);color:#111;font-weight:800;font-size:10px;padding:3px 6px;border-radius:6px}
.fv{position:absolute;top:4px;right:4px;width:30px;height:30px;border-radius:99px;background:rgba(255,255,255,.9);font-size:15px;color:#999}
.fv.on{color:var(--hot)}
.inf{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}
.ti{font-size:13px;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--tx);text-decoration:none}
.ct{font-size:11px;color:var(--mt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}.pr b{font-size:17px}.pr s{color:var(--mt);font-size:12px}
.sv{font-size:11px;color:var(--ok);font-weight:700}
.was{font-size:11px;color:var(--hot);font-weight:700}
.acts{display:flex;gap:6px;margin-top:auto;padding-top:6px}
.acts button,.acts a{flex:1;text-align:center;border-radius:8px;padding:6px;font-size:12px;font-weight:700;text-decoration:none;background:var(--sf2);color:var(--tx);border:1px solid var(--bd)}
.acts .add{background:var(--pr);border-color:var(--pr);color:#fff}
.acts .add.in{background:var(--ok);border-color:var(--ok)}
.empty{text-align:center;color:var(--mt);padding:60px 20px}.empty big{font-size:44px;display:block}
.drawer{position:absolute;top:0;right:0;bottom:0;width:min(420px,100%);background:var(--sf);box-shadow:-10px 0 40px rgba(0,0,0,.25);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .25s;z-index:5}
.drawer.open{transform:none}
.drawer header{background:var(--sf);color:var(--tx);border-bottom:1px solid var(--bd)}
.drawer .ib{background:var(--sf2);color:var(--tx)}
.dl{flex:1;overflow:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px}
.li{display:flex;gap:10px;align-items:center;background:var(--sf2);border-radius:10px;padding:8px}
.li img{width:44px;height:44px;border-radius:8px;object-fit:cover}
.li div{flex:1;min-width:0;font-size:12px}.li .ti{-webkit-line-clamp:1}
.qty{display:flex;align-items:center;gap:6px}.qty button{width:24px;height:24px;border-radius:7px;background:var(--sf);border:1px solid var(--bd)}
.df{padding:14px 16px;border-top:1px solid var(--bd);display:flex;flex-direction:column;gap:8px}
.toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%) translateY(80px);background:#161a2b;color:#fff;padding:10px 16px;border-radius:10px;opacity:0;transition:.25s;pointer-events:none;z-index:9}
.toast.on{transform:translateX(-50%);opacity:1}
.menu-btn{display:none}
@media(max-width:820px){
 aside{position:absolute;z-index:4;top:0;bottom:0;left:0;transform:translateX(-100%);transition:transform .25s;box-shadow:10px 0 40px rgba(0,0,0,.25);width:min(310px,88%)}
 aside.open{transform:none}.menu-btn{display:block}
 header{padding:10px 12px}.search{order:5;flex-basis:100%;max-width:none}
 main{padding:12px}.grid{grid-template-columns:repeat(2,1fr);gap:10px}
}
kbd{background:var(--sf2);border:1px solid var(--bd);border-radius:5px;padding:0 5px;font-size:11px}
`;
  root.innerHTML = '<style>' + CSS + '</style><div class="app" id="app"></div>';
  const app = root.getElementById('app');

  let sideOpen = false;
  const groupChip = g => `<button class="chip ${store.groups.includes(g.id) ? 'on' : ''}" data-act="grp" data-id="${g.id}">${g.icon} ${esc(g.name)}</button>`;
  function sidebar() {
    return `<aside class="${sideOpen ? 'open' : ''}">
 <div><h4>Categories</h4><div class="chips">${GROUPS.map(groupChip).join('')}</div>
  <div class="row" style="margin-top:8px"><button class="chip" data-act="all">Select all</button><button class="chip" data-act="none">Clear</button></div></div>
 <div><h4>Scan settings</h4>
  <label class="row" style="margin-bottom:6px"><span>Pincode</span><input class="fld" style="width:110px" data-in="pincode" value="${esc(store.pincode)}" maxlength="6" inputmode="numeric"></label>
  <label class="row"><span>Pages per category</span><b>${store.depth}</b></label><input type="range" min="1" max="5" value="${store.depth}" data-in="depth"></div>
 ${S.scanning ? '<button class="btn stop" data-act="stop">■ Stop scan</button>' : '<button class="btn" data-act="scan">⚡ Scan deals</button>'}
 <div><h4>Filters</h4>
  <label class="row"><span>Min discount</span><b>${store.minDisc}%</b></label><input type="range" min="0" max="90" step="5" value="${store.minDisc}" data-in="minDisc">
  <label class="row" style="margin-top:10px"><span>Max price</span><b>${store.maxPrice ? $inr(store.maxPrice) : 'Any'}</b></label><input type="range" min="0" max="2000" step="50" value="${store.maxPrice}" data-in="maxPrice">
  <label class="sw" style="margin-top:10px"><input type="checkbox" data-in="stockOnly" ${store.stockOnly ? 'checked' : ''}> In-stock only</label>
  <label class="sw" style="margin-top:6px"><input type="checkbox" data-in="favOnly" ${S.favOnly ? 'checked' : ''}> ♥ Favourites only</label>
  <label class="sw" style="margin-top:6px"><input type="checkbox" data-in="newOnly" ${S.newOnly ? 'checked' : ''}> New / price-dropped only</label></div>
 <div><h4>Data</h4><div class="chips"><button class="chip" data-act="csv">⬇ CSV</button><button class="chip" data-act="copyall">⧉ Copy top 20</button><button class="chip" data-act="unhide">Unhide (${store.hidden.length})</button></div>
  <p style="color:var(--mt);font-size:11px;margin-top:10px">Shortcuts: <kbd>/</kbd> search · <kbd>S</kbd> scan · <kbd>Esc</kbd> close</p></div>
</aside>`;
  }
  function card(p, fav, qtyMap) {
    const inList = qtyMap[p.id];
    return `<article class="card ${p.inStock ? '' : 'oos'}">
 <div class="im" style="background-image:url('${esc(String(p.img).replace(/'/g, '%27'))}')">
  <span class="dc ${p.disc >= 60 ? 'hot' : ''}">${p.disc}% OFF</span>${p.isNew ? '<span class="tag">NEW</span>' : p.was ? '<span class="tag">PRICE ↓</span>' : ''}
  <button class="fv ${fav ? 'on' : ''}" data-act="fav" data-id="${esc(p.id)}" title="Favourite">${fav ? '♥' : '♡'}</button></div>
 <div class="inf"><a class="ti" ${p.url && p.url !== '#demo' ? `href="${esc(p.url)}" target="_blank" rel="noopener"` : ''}>${esc(p.title)}</a>
  <div class="ct">${esc(p.cat)}</div>
  <div class="pr"><b>${$inr(p.price)}</b><s>${$inr(p.mrp)}</s></div>
  <div class="sv">Save ${$inr(p.save)}${p.inStock ? '' : ' · <span style="color:var(--hot)">Out of stock</span>'}</div>
  ${p.was ? `<div class="was">Was ${$inr(p.was)} last scan</div>` : ''}
  <div class="acts"><button class="add ${inList ? 'in' : ''}" data-act="add" data-id="${esc(p.id)}">${inList ? '✓ In list ×' + inList : '+ List'}</button><button data-act="hide" data-id="${esc(p.id)}" title="Hide">✕</button></div></div></article>`;
  }
  function mainView() {
    const list = filtered();
    const cats = [...new Set([...S.products.values()].map(p => p.cat.split(' › ')[0]))];
    const brands = Object.entries([...S.products.values()].reduce((m, p) => (m[p.brand] = (m[p.brand] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 40);
    const avg = list.length ? Math.round(list.reduce((s, p) => s + p.disc, 0) / list.length) : 0;
    const best = list.reduce((m, p) => p.save > m ? p.save : m, 0);
    const fav = new Set(store.favs);
    const pct = S.total ? Math.round(S.done / S.total * 100) : 0;
    return `<main id="main">
 ${S.scanning ? `<div class="bar"><div style="width:${pct}%"></div></div>` : ''}
 <div class="stats">
  <div class="stat"><b>${list.length}</b><span>deals shown / ${S.products.size} scanned</span></div>
  <div class="stat"><b>${avg}%</b><span>average discount</span></div>
  <div class="stat"><b>${$inr(best)}</b><span>biggest single saving</span></div>
  <div class="stat"><b>${S.scanning ? pct + '%' : store.lastScan ? new Date(store.lastScan).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</b><span>${S.scanning ? `scanning ${S.done}/${S.total}` : 'last scan'}</span></div>
 </div>
 <div class="tools">
  <button class="ib menu-btn" style="background:var(--sf);color:var(--tx);border:1px solid var(--bd)" data-act="side">☰</button>
  <select data-in="sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${store.sort === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
  <select data-in="cat"><option value="">All categories</option>${cats.map(c => `<option ${S.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
  <select data-in="brand"><option value="">All brands</option>${brands.map(([b, n]) => `<option value="${esc(b)}" ${S.brand === b ? 'selected' : ''}>${esc(b)} (${n})</option>`).join('')}</select>
  <span class="sp"></span>
  <button class="chip ${store.view === 'grid' ? 'on' : ''}" data-act="view" data-v="grid">▦ Grid</button><button class="chip ${store.view === 'list' ? 'on' : ''}" data-act="view" data-v="list">☰ List</button>
 </div>
 ${list.length ? `<div class="grid ${store.view}">${list.slice(0, S.shown).map(p => card(p, fav.has(p.id), store.list)).join('')}</div>
   ${list.length > S.shown ? `<div style="text-align:center;margin-top:18px"><button class="btn ghost" data-act="more">Show ${Math.min(60, list.length - S.shown)} more (${list.length - S.shown} left)</button></div>` : ''}`
        : `<div class="empty"><big>${S.scanning ? '🔎' : '🛒'}</big>${S.scanning ? 'Hunting for deals…' : S.products.size ? 'No deals match your filters. Try lowering the minimum discount.' : 'Pick categories and hit <b>Scan deals</b>.'}</div>`}
</main>`;
  }
  function drawer() {
    const items = Object.entries(store.list).map(([id, q]) => [S.products.get(id) || store._cache && store._cache[id], q]).filter(x => x[0]);
    const tot = items.reduce((s, [p, q]) => s + p.price * q, 0), mrp = items.reduce((s, [p, q]) => s + p.mrp * q, 0);
    return `<div class="drawer ${S.panel ? 'open' : ''}"><header><b style="flex:1;font-size:16px">🛒 Shopping list</b><button class="ib" data-act="clearlist" title="Clear">🗑</button><button class="ib" data-act="closepanel">✕</button></header>
 <div class="dl">${items.length ? items.map(([p, q]) => `<div class="li"><img src="${esc(p.img)}" alt=""><div><a class="ti">${esc(p.title)}</a><b>${$inr(p.price * q)}</b> <s style="color:var(--mt)">${$inr(p.mrp * q)}</s></div><div class="qty"><button data-act="dec" data-id="${esc(p.id)}">−</button><b>${q}</b><button data-act="inc" data-id="${esc(p.id)}">+</button></div></div>`).join('') : '<div class="empty"><big>🧺</big>Your list is empty.<br>Tap “+ List” on any deal.</div>'}</div>
 <div class="df"><div class="row"><span>Items total</span><b style="font-size:18px">${$inr(tot)}</b></div><div class="row" style="color:var(--ok)"><span>You save</span><b>${$inr(mrp - tot)}</b></div>
 <div class="row"><button class="btn ghost" style="flex:1" data-act="copylist">⧉ Copy list</button><button class="btn" style="flex:1" data-act="openlinks">Open items ↗</button></div></div></div>`;
  }
  function render() {
    const dark = store.theme === 'dark' || (store.theme === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches);
    const keepScroll = (root.getElementById('main') || {}).scrollTop || 0;
    const sideScroll = (root.querySelector('aside') || {}).scrollTop || 0;
    const focused = root.activeElement && root.activeElement.dataset ? root.activeElement.dataset.in : null;
    const count = Object.values(store.list).reduce((a, b) => a + b, 0);
    app.className = 'app' + (dark ? ' dark' : '');
    app.innerHTML = `<header><button class="ib menu-btn" data-act="side">☰</button><div class="logo">PriceDrop <i>HUNTER</i>${DEMO ? '<span class="demo">DEMO DATA</span>' : ''}</div>
 <div class="search"><input data-in="q" placeholder="Search products, brands…  ( / )" value="${esc(S.q)}"></div><span class="sp"></span>
 <button class="ib" data-act="theme" title="Theme">${dark ? '☀' : '☾'}</button><button class="ib" data-act="panel" title="Shopping list">🛒${count ? `<span class="badge">${count}</span>` : ''}</button><button class="ib" data-act="close" title="Close (Esc)">✕</button></header>
 <div class="body">${sidebar()}${mainView()}</div>${drawer()}<div class="toast" id="toast"></div>`;
    const m = root.getElementById('main'); if (m) m.scrollTop = keepScroll;
    const a = root.querySelector('aside'); if (a) a.scrollTop = sideScroll;
    if (focused === 'q') { const i = root.querySelector('[data-in=q]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }
  let rq = 0;
  const scheduleRender = () => { if (rq) return; rq = setTimeout(() => { rq = 0; render(); }, 250); };
  let tt;
  function toast(msg) {
    const t = root.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2400);
  }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || 'Copied'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(msg || 'Copied'); }
  }
  function listText() {
    const lines = Object.entries(store.list).map(([id, q]) => { const p = S.products.get(id); return p ? `• ${p.title} ×${q} — ${$inr(p.price * q)}${p.url && p.url !== '#demo' ? '\n  ' + p.url : ''}` : null; }).filter(Boolean);
    return lines.join('\n');
  }

  // ───────────────────────── Events ─────────────────────────
  const reFilter = debounce(() => { S.shown = 60; render(); }, 150);
  root.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.in; if (!k) return;
    if (k === 'q') { S.q = e.target.value; reFilter(); return; }
    if (k === 'pincode') { store.pincode = e.target.value.replace(/\D/g, '').slice(0, 6); save(); return; }
    if (k === 'depth' || k === 'minDisc' || k === 'maxPrice') { store[k] = +e.target.value; save(); S.shown = 60; render(); return; }
  });
  root.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.in; if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (k === 'stockOnly') { store.stockOnly = v; save(); }
    else if (k === 'sort') { store.sort = v; save(); }
    else if (k === 'favOnly') S.favOnly = v; else if (k === 'newOnly') S.newOnly = v;
    else if (k === 'cat') S.cat = v; else if (k === 'brand') S.brand = v;
    else return;
    S.shown = 60; render();
  });
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, id = el.dataset.id;
    store._cache = store._cache || {};
    switch (a) {
      case 'close': api.hide(); break;
      case 'theme': store.theme = app.classList.contains('dark') ? 'light' : 'dark'; save(); render(); break;
      case 'side': sideOpen = !sideOpen; render(); break;
      case 'panel': S.panel = !S.panel; render(); break;
      case 'closepanel': S.panel = false; render(); break;
      case 'grp': store.groups = store.groups.includes(id) ? store.groups.filter(x => x !== id) : store.groups.concat(id); save(); render(); break;
      case 'all': store.groups = GROUPS.map(g => g.id); save(); render(); break;
      case 'none': store.groups = []; save(); render(); break;
      case 'scan': sideOpen = false; scan(); break;
      case 'stop': S.ctl.stop = true; toast('Stopping…'); break;
      case 'view': store.view = el.dataset.v; save(); render(); break;
      case 'more': S.shown += 60; render(); break;
      case 'fav': store.favs = store.favs.includes(id) ? store.favs.filter(x => x !== id) : store.favs.concat(id); save(); render(); break;
      case 'hide': store.hidden.push(id); save(); render(); toast('Hidden — undo via Data › Unhide'); break;
      case 'unhide': store.hidden = []; save(); render(); break;
      case 'add': store.list[id] = (store.list[id] || 0) + 1; { const p = S.products.get(id); if (p) store._cache[id] = p; } save(); render(); break;
      case 'inc': store.list[id]++; save(); render(); break;
      case 'dec': if (--store.list[id] <= 0) delete store.list[id]; save(); render(); break;
      case 'clearlist': store.list = {}; save(); render(); break;
      case 'copylist': copy(listText() || 'Empty list', 'List copied'); break;
      case 'openlinks': Object.keys(store.list).map(i => S.products.get(i)).filter(p => p && p.url && p.url !== '#demo').forEach(p => window.open(p.url, '_blank', 'noopener')); break;
      case 'copyall': copy(filtered().slice(0, 20).map(p => `${p.disc}% off · ${p.title} · ${$inr(p.price)} (MRP ${$inr(p.mrp)})${p.url && p.url !== '#demo' ? '\n' + p.url : ''}`).join('\n'), 'Top 20 deals copied'); break;
      case 'csv': {
        const rows = [['Title', 'Brand', 'Category', 'Price', 'MRP', 'Discount %', 'Saving', 'In stock', 'URL']].concat(filtered().map(p => [p.title, p.brand, p.cat, p.price, p.mrp, p.disc, p.save, p.inStock, p.url]));
        const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
        const a2 = document.createElement('a'); a2.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a2.download = 'minutes-deals.csv'; a2.click(); toast('CSV downloaded'); break;
      }
    }
  });
  document.addEventListener('keydown', e => {
    if (host.style.display === 'none') return;
    const typing = root.activeElement && /INPUT|SELECT/.test(root.activeElement.tagName);
    if (e.key === 'Escape') { if (S.panel) { S.panel = false; render(); } else if (typing) root.activeElement.blur(); else api.hide(); }
    else if (!typing && !e.metaKey && !e.ctrlKey) {
      if (e.key === '/') { e.preventDefault(); const i = root.querySelector('[data-in=q]'); i && i.focus(); }
      else if (e.key.toLowerCase() === 's') S.scanning ? (S.ctl.stop = true) : scan();
    }
    if (!typing || e.key === 'Escape') e.stopPropagation();
  }, true);

  // ───────────────────────── Public API ─────────────────────────
  let prevOverflow = '';
  const api = {
    show() { host.style.display = 'block'; prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; render(); },
    hide() { host.style.display = 'none'; document.documentElement.style.overflow = prevOverflow; },
    toggle() { host.style.display === 'none' ? api.show() : api.hide(); }
  };
  window.__FKM__ = api;
  document.body.appendChild(host);
  api.show();
  if (DEMO && !S.products.size) setTimeout(scan, 300);
})();
