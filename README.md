# Minutes Deal Radar

Scan Flipkart Minutes categories for the biggest discounts, track price drops between scans, and build a shopping list. Runs entirely in your browser using your own Flipkart session. Nothing is sent to any third party.

## Features

- Full-screen responsive UI (grid/list, dark mode), style-isolated with Shadow DOM
- Best-deal score (percent off plus rupees saved) and 6 sort modes
- NEW / PRICE ↓ badges against your previous scan
- Filters: search, category, brand, max price, min discount, in-stock, favourites, new only
- Shopping list with quantities, totals and savings; copy or open all links
- CSV export and copy-top-20 for sharing
- Parallel scanning with retries, up to 5 pages per category, stop anytime
- Remembers pincode, filters, favourites, theme (localStorage)
- Shortcuts: `/` search, `S` scan/stop, `Esc` close

## Install

### Bookmarklet (desktop and mobile)
1. `node build.js`
2. Open `index.html`, drag **⚡ Deal Radar** to your bookmarks bar (mobile: **Copy for mobile**, paste as a bookmark URL).
3. On flipkart.com set your delivery pincode, click the bookmark, press **Scan deals**.

### Userscript (Tampermonkey / Violentmonkey)
Install `dist/minutes-deal-radar.user.js`. A yellow **⚡ Deals** button appears on every flipkart.com page.

### Demo
Run a local server and click **Try live demo** (synthetic data, any site):
```
python3 -m http.server 8765   # then open http://localhost:8765
```

## Develop

- `src/deals.js`: the whole app (single IIFE, no dependencies)
- `src/index.tpl.html`: installer page template
- `build.js`: minifies with terser (via npx, optional) and writes `dist/` and `index.html`

Run `node build.js` after every change.

## Known limitations

- Uses Flipkart's undocumented Rome API (`/api/4/page/fetch`); it can change without notice. The parser walks the response generically to tolerate layout changes.
- Category URIs for the first eight groups come from the public reference project; the last six (Fashion, Electronics, etc.) are best guesses and may need adjusting in `GROUPS`/`groupUri` in `src/deals.js`.
- Personal & Baby Care, Home & Kitchen and Household Care list only some subcategories, so products in the others are not scanned.
- Price history is per-browser and only compares against your previous scan.
- Unofficial and unaffiliated with Flipkart. Use responsibly and keep scan depth modest.
