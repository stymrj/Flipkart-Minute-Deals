// Regression test: sample Rome payload -> parser -> real card() render.
// Fixture (12 products: 6 standard productInfo + 3 Atlas + 3 MRCSV cards)
// must parse to 12 products and render 12 cards in the results grid.
// Also covers: self-test, CSV/JSON serialise, multi-keyword search.
// Usage: node test-results-tab.js   (paths are relative to this file)
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'src', 'deals.js'), 'utf8');

// Stubs for the helpers card() needs (unit price is not set by extract, so
// unitLabel is never called here; spark/ic are stubbed the same way).
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const ic = () => '';
const spark = () => '';

function slice(startMark, endMark, name) {
  const a = src.indexOf(startMark), b = src.indexOf(endMark, a);
  if (a < 0 || b < 0) throw new Error('could not find ' + name + ' in src/deals.js');
  return src.slice(a, b);
}
// Parser slice: price -> extract (covers fromParts, normalise, parseDls,
// SELFTEST + selfTest). serialise slice and matchQuery slice likewise.
eval(slice('  function price(v) {', '  const allowed = ', 'parser'));
eval(slice('  function card(p, fav, qtyMap) {', '  const byDisc = ', 'card'));
eval(slice('  function listText() {', '  // Add products from any source', 'serialise'));
eval(slice('  // Comma separates OR groups', '  function filtered() {', 'matchQuery'));

let failures = 0;
const check = (label, ok, extra) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + label + (extra !== undefined ? ' — ' + extra : ''));
  if (!ok) failures++;
};

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-api.json'), 'utf8'));
const items = extract(fixture, 'Test');
check('parser returns 12 products', items.length === 12, 'got ' + items.length);
check('every product has title/price/mrp/url', items.every(p => p.title && p.price > 0 && p.mrp >= p.price && /^https:\/\/www\.flipkart\.com/.test(p.url)));
const byTitle = t => items.find(p => p.title === t);
check('swapped fsp/mrp is corrected (sell 200, mrp 300)', byTitle('Test Sugar 1 kg') && byTitle('Test Sugar 1 kg').price === 200 && byTitle('Test Sugar 1 kg').mrp === 300);
check('MRP rebuilt from totalDiscount (150 -> mrp 250, 40%)', byTitle('Test Tea 250 g') && byTitle('Test Tea 250 g').mrp === 250 && byTitle('Test Tea 250 g').disc === 40);
check('glued MRP repaired (75037 -> 750, 37%)', byTitle('Test Ghee 1 L') && byTitle('Test Ghee 1 L').mrp === 750 && byTitle('Test Ghee 1 L').disc === 37);
check('tracking price read (99 / 199)', byTitle('Test Coffee 100 g') && byTitle('Test Coffee 100 g').price === 99 && byTitle('Test Coffee 100 g').mrp === 199);
check('title falls back to URL slug', byTitle('Tata Salt 1 Kg') && byTitle('Tata Salt 1 Kg').price === 90);
check('Atlas cards parsed (3)', items.filter(p => /Fortune Oil|Aashirvaad|OOS Ghee/.test(p.title)).length === 3);
check('MRCSV cards parsed (3)', items.filter(p => /Maggi|Parle-G|Amul Butter/.test(p.title)).length === 3);
check('out-of-stock flagged, not dropped', items.filter(p => !p.inStock).length === 2);
check('tail discount recorded', items.tailDisc === items[items.length - 1].disc && items.totalFound === 12, 'tailDisc=' + items.tailDisc);

// Same payload wrapped as an __INITIAL_STATE__ object (HTML fallback shape).
const statePayload = { multiWidgetState: { widgetsData: { slots: fixture.RESPONSE.slots } } };
check('HTML-fallback state shape parses', extract(statePayload, 'Test').length === 12);

// Render: the real card() must emit one <article class="card" per product.
const gridHtml = items.map(p => card(p, false, {})).join('');
const cards = (gridHtml.match(/<article class="card/g) || []).length;
console.log('Cards rendered:', cards);
check('cards rendered equals input count', cards === 12, cards + ' of 12');
check('card shows first title', gridHtml.includes('Test Atta 1 kg'));
check('card shows discount badge', gridHtml.includes('50% OFF'));
check('card shows price', gridHtml.includes('₹120'));

// Self-test button path (same function the sidebar calls).
const st = selfTest();
console.log('selfTest():', JSON.stringify(st));
check('self-test passes', st.pass && st.got === 3 && st.total === 3);

// Export serialisers.
const s2 = serialise(items);
check('CSV has header + 12 rows', s2.csv.split('\n').length === 13);
check('JSON parses to 12 objects', JSON.parse(s2.json).length === 12);
check('JSON keeps discount field', JSON.parse(s2.json)[0].discountPct === items[0].disc);

// Multi-keyword search: comma = OR, spaces = AND inside a group.
const atta = { title: 'Test Atta 1 kg', cat: 'Staples' };
check('search: single word matches', matchQuery(atta, 'atta') === true);
check('search: comma is OR', matchQuery(atta, 'rice, atta') === true);
check('search: spaces are AND', matchQuery(atta, 'atta rice') === false);
check('search: empty query matches all', matchQuery(atta, '') === true);

if (failures) { console.log('FAIL: ' + failures + ' check(s) failed'); process.exit(1); }
console.log('PASS: all 12 cards render');
