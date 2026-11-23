// Regression test for the Telegram bot (bot/core.js) with a fake platform and
// a fake Telegram: new deals, price drops, restocks, dedupe, the dead-session
// warning and --json feed mode. No network.
// Usage: node test-bot.js
'use strict';
const fs = require('fs'), path = require('path');
const core = require('./bot/core');

const stateFile = path.join(__dirname, 'data', 'state.json');
const backup = fs.existsSync(stateFile) ? fs.readFileSync(stateFile) : null;
let failures = 0;
const check = (label, ok, extra) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + label + (extra !== undefined ? ' — ' + extra : ''));
  if (!ok) failures++;
};

Object.assign(process.env, { TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C', FLIPKART_COOKIE: 'x', GROUPS: 'baby', PAGES: '1', DIGEST_HOUR_IST: '-1', MIN_DISCOUNT: '60' });
delete process.env.DRY_RUN; delete process.env.THRESHOLDS;

let sent = [], page = [], refuse = '';
const fakeFetch = async (url, opts) => {
  if (/api\.telegram\.org/.test(url)) { sent.push(JSON.parse(opts.body).text); return { ok: true, status: 200, json: async () => ({ ok: true }) }; }
  throw new Error('unexpected fetch ' + url);
};
const platform = {
  label: 'Flipkart Minutes', required: ['FLIPKART_COOKIE'], sortedByDiscount: true, fetch: fakeFetch,
  async fetchPage() {
    if (refuse) throw Object.assign(new Error(refuse), { blocked: true });
    return Object.assign(page.map(p => Object.assign({}, p)), { more: false });
  }
};
const item = (id, priceNow, mrp, inStock = true) => ({ id, title: 'Item ' + id, price: priceNow, mrp, disc: Math.round((mrp - priceNow) / mrp * 100), url: 'https://www.flipkart.com/x/p/' + id, inStock, cat: 'Baby Care' });
const quiet = async fn => { const log = console.log, err = console.error, out = []; console.log = console.error = (...a) => out.push(a.join(' ')); try { return { code: await fn(), out }; } finally { console.log = log; console.error = err; } };

(async () => {
  try {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);

    page = [item('A', 100, 400), item('B', 300, 400), item('C', 50, 200, false)];
    let r = await quiet(() => core.run(platform, []));
    check('first run exits 0', r.code === 0, r.code);
    check('first run sends one message', sent.length === 1, sent.length);
    check('new deal above the minimum is sent', /Item A/.test(sent[0] || ''));
    check('deal below the minimum is not sent', !/Item B/.test(sent[0] || ''));
    check('out-of-stock deal is not sent', !/Item C/.test(sent[0] || ''));

    sent = [];
    r = await quiet(() => core.run(platform, []));
    check('unchanged second run sends nothing', r.code === 0 && sent.length === 0, sent.length);

    sent = []; page = [item('A', 80, 400), item('B', 300, 400), item('C', 50, 200, true)];
    r = await quiet(() => core.run(platform, []));
    check('price drop is sent with the old price', /Price drops[\s\S]*Item A[\s\S]*was ₹100/.test(sent[0] || ''), sent.length === 1 ? undefined : sent[0]);
    check('restock is sent', /Back in stock[\s\S]*Item C/.test(sent[0] || ''));

    sent = []; refuse = 'Flipkart refused the session (HTTP 401). Refresh FLIPKART_COOKIE.';
    r = await quiet(() => core.run(platform, []));
    check('dead session exits 1', r.code === 1, r.code);
    check('dead session is reported to Telegram', sent.length === 1 && /Alerts are paused: Flipkart refused the session/.test(sent[0]), sent.length === 1 ? undefined : sent[0]);

    sent = [];
    r = await quiet(() => core.run(platform, []));
    check('dead-session warning is sent once per day', r.code === 1 && sent.length === 0, sent.length);

    sent = []; refuse = '';
    r = await quiet(() => core.run(platform, []));
    const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    check('working session clears the warning', r.code === 0 && st.blockedDate === undefined);

    sent = []; refuse = 'expired';
    r = await quiet(() => core.run(platform, ['--dry-run']));
    check('dry run prints the warning instead of sending it', r.code === 1 && sent.length === 0 && r.out.some(l => /Alerts are paused: expired/.test(l)));

    refuse = ''; page = [item('A', 100, 400), item('B', 300, 400)];
    r = await quiet(() => core.run(platform, ['--json']));
    let feed = null; try { feed = JSON.parse(r.out[r.out.length - 1]); } catch (e) { /* checked below */ }
    check('--json prints the feed as the last line', r.code === 0 && feed && Array.isArray(feed.deals) && feed.store === 'Flipkart Minutes');
    check('--json keeps deals at or above MIN_DISCOUNT only', feed && feed.deals.length === 1 && feed.deals[0].title === 'Item A');
    check('--json sends nothing to Telegram', sent.length === 0);

    refuse = 'expired';
    r = await quiet(() => core.run(platform, ['--json']));
    check('--json fails on a dead session instead of publishing', r.code === 1);

    platform.fetchPage = async () => { throw new Error('HTTP 500'); };
    r = await quiet(() => core.run(platform, ['--json']));
    check('--json fails when every aisle failed', r.code === 1);
  } catch (e) {
    console.log('FAIL threw: ' + (e && e.stack || e)); failures++;
  } finally {
    if (backup) fs.writeFileSync(stateFile, backup); else if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  }
  if (failures) { console.log('FAIL: ' + failures + ' check(s) failed'); process.exit(1); }
  console.log('PASS: bot alerts, dedupe, session warning and feed mode');
})();
