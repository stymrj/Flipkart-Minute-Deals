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
// byDisc is a const in src, so a plain eval() would scope it to the eval
// itself: capture the comparator expression instead of the declaration.
const byDisc = eval(slice('  const byDisc = ', '  function bestView', 'byDisc').replace(/^\s*const byDisc =\s*/, '').replace(/;\s*$/, ''));
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
check('tail discount is the listing minimum, not the last card', items.tailDisc === 25 && items.totalFound === 12, 'tailDisc=' + items.tailDisc);

// Same payload wrapped as an __INITIAL_STATE__ object (HTML fallback shape).
const statePayload = { multiWidgetState: { widgetsData: { slots: fixture.RESPONSE.slots } } };
check('HTML-fallback state shape parses', extract(statePayload, 'Test').length === 12);

// Highest-discount fixture: 85-95% items plus the shapes that used to drop them.
// The 5% trailing DLS card must not decide paging; the object discount and
// the LOW_STOCK clearance item must survive to the results tab.
const hd = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-high-discount.json'), 'utf8'));
const hi = extract(hd, 'Test');
check('high-discount fixture parses 8 products', hi.length === 8, 'got ' + hi.length);
const byHd = t => hi.find(p => p.title === t);
check('object totalDiscount + missing MRP: 85% (mrp rebuilt to 1000)', byHd('HD Object Discount Tea 85') && byHd('HD Object Discount Tea 85').disc === 85 && byHd('HD Object Discount Tea 85').mrp === 1000);
check('LOW_STOCK clearance item stays in stock', byHd('HD Low Stock Coffee 90') && byHd('HD Low Stock Coffee 90').inStock === true);
check('OUT_OF_STOCK item still flagged, not dropped', byHd('HD Out Of Stock Ghee 90') && byHd('HD Out Of Stock Ghee 90').inStock === false);
check('tail discount is the listing minimum (85), not the trailing 5% card', hi.tailDisc === 85, 'tailDisc=' + hi.tailDisc);
check('paging continues past page 1 (tail 85 >= 50 threshold, 8 found)', hi.tailDisc >= 50 && hi.totalFound >= 6);
// Best deals: the same byDisc order the Best tab renders, minDisc 30 + in stock.
const best = hi.filter(p => p.inStock && p.disc >= 30).slice().sort(byDisc);
check('highest-discount item sorts first for Best deals', best[0] && best[0].title === 'HD Clearance Mixer 95' && best[0].disc === 95);
const bestHtml = best.slice(0, 12).map(p => card(p, false, {})).join('');
check('Best-deals grid renders the 95% item first', bestHtml.indexOf('HD Clearance Mixer 95') !== -1 && bestHtml.indexOf('HD Clearance Mixer 95') < bestHtml.indexOf('HD String MRP Rice 90'));
check('Best-deals grid shows the 95% badge', bestHtml.includes('95% OFF'));

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
