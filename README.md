# PriceDrop Hunter for Flipkart Minutes

Scans the Flipkart Minutes categories you pick and shows the biggest discounts first, then the best deals of each category. It runs in your own browser as a bookmarklet or userscript. Nothing is uploaded and there is no account.

**Live page:** https://stymrj.github.io/Flipkart-Minute-Deals/

## What's new in v2 (2026-11-08)

- **Discount-first fetching:** every category is now requested with `sort=discount`, and pages after the first are plain `page=N` requests, fetched only while the previous page still ends on a discount worth showing (50% off, 40% for staples). The old pagination-token flow is gone.
- **Highest-discount fix (2026-11-09):** the page-end discount that decides whether deeper pages are fetched is now the lowest discount in the discount-sorted listing — a low-discount recommendation card trailing page 1 used to stop the scan there, so the deepest discounts on later pages were never fetched. A discount wrapped in an object (e.g. `totalDiscount: {value: "85% off"}`) is now read instead of parsing as 0%, and clearance items flagged `LOW_STOCK` are no longer treated as out of stock.
- **Atlas / DLS cards parsed:** Minutes pages that serve search-grid and recommendation cards (no `titles`/`pricing` object) used to come back blank. Both card shapes are now parsed, so those pages return products.
- **Price repair:** a selling price above the MRP is swapped back instead of hiding the discount; a missing MRP is rebuilt from the discount; a MRP with the discount digits glued on the end is repaired. Prices hidden in `tracking.fsp`/`tracking.mrp` and the `totalDiscount` field are now read.
- **Pincode from the session:** the delivery pincode is read from the page's own session state, then cookies, then storage. The browser tool never invents one and never sends a different address than the one you already set. (The Telegram bot reads `PINCODE` if set, else the pincode saved in the session cookie, else 560032 — see the bot table below.)
- **HTML fallback:** if the page-fetch API returns nothing usable for a category, Hunter reads the category page itself and parses the `__INITIAL_STATE__` JSON embedded in it.
- **Empty-state diagnostics:** a scan that finds nothing now says why — signed out, no delivery address, rate-limited, or categories that returned no products — instead of a blank page.
- **Self-test button:** the sidebar has a Self-test that runs the parser on a built-in sample payload (all three card shapes) and reports PASS/FAIL. Run it any time the results look wrong.
- **Deeper by default:** 3 pages per category in the browser tool (was 2); the Telegram bot still scans 2 pages per aisle by default (see `PAGES` below). 12 groups / 39 sub-categories (added Sports & Fitness, Fashion Accessories, Mobile Accessories, Paan Corner; fixed the broken Health & First Aid link).
- **Multi-keyword search:** comma separates OR groups, spaces inside a group are AND — `atta, rice` finds either; `atta 1kg` needs both words.
- **JSON export** alongside CSV, from the same filtered list.
- **Bookmark name fixed:** the install button now reads **Flipkart Minutes Deals** instead of the generic “PriceDrop Hunter”, so the bookmark you drag to your bookmarks bar is named after this store.

## Why v2 is stronger

- **Price history, lowest-ever and price-drop alerts** — every scan is compared with the prices stored in your browser, and the Telegram bot keeps the same history server-side in `data/state.json` (30 days), so drops and restocks are caught, not just today's deals.
- **Saved items with sparklines** — heart any deal and its price is tracked; the card shows a low/high sparkline and how much it dropped since you saved it.
- **Cross-category best-deal row** — the top 12 discounts across everything you scanned, plus the best of each category in swipeable rows.
- **Unit-price / value sort** — rupees per kg, litre or piece, read from the pack size, with a best-value sort.
- **Telegram bot with dedupe + price history** — the bot sends each deal once, then again only if it gets cheaper or comes back in stock; scheduled runs every 30 minutes.
- **CSV and JSON export** of the filtered list, and a shopping list with totals and savings.

## Features

- Asks which categories to scan, then shows the biggest discounts first
- Best deals of each category in one swipeable row, with See all
- Ranks by percent off and rupees saved together
- Labels products that are new, cheaper than last time, or at their lowest price ever
- Price history sparkline on every product you have seen before
- Saved items strip showing how much each one dropped since you saved it
- Unit price (per kg, litre or piece) with a value sort
- One-tap presets: under ₹99, 50% off, save ₹100+, price drops, lowest ever, best value
- A setup checklist on first open, plus a "Why 0 results" box after an empty scan
- Self-test button in the sidebar: parses a built-in sample payload and reports PASS/FAIL
- In-stock-only filter, on by default (toggle it in Settings)
- Keyboard shortcuts: `/` search, `S` scan (or stop a running scan), `Esc` close
- Filters: search, category, brand, maximum price, minimum discount, stock, saved items
- Shopping list with quantities, total and total savings
- CSV and JSON export, copy-to-share text, grid/list views, light and dark themes
- Settings, saved items and price history stay in your browser

## Install

![Install walkthrough](https://stymrj.github.io/PriceDrop-Hunter/media/install-demo.gif)

[Watch the walkthrough video (MP4)](https://stymrj.github.io/PriceDrop-Hunter/media/install-demo.mp4)

**Bookmarklet (desktop).** Run `node build.js`, open `index.html`, and drag the **Flipkart Minutes Deals** button to your bookmarks bar. Open flipkart.com and click the bookmark.

**Bookmarklet (mobile).** On the install page, tap **Copy mobile loader**. It is a bookmark of about 380 characters that loads the latest version from GitHub Pages, so it fits on any phone. Create a bookmark named **Flipkart Minutes Deals**, paste it as the address, and run it from the address bar on flipkart.com. The full bookmarklet (about 70 KB, no network needed) is in `dist/bookmarklet.txt`.

**Userscript.** Install `dist/minutes-deal-radar.user.js` in Tampermonkey or Violentmonkey. A small Deals button appears on every flipkart.com page.

## Use

1. Open the Flipkart Minutes store and click the bookmark (or the Deals button).
2. Press **Scan**, pick categories, and set pages per category (1–5).
3. Browse Best deals, All deals, or Saved. Heart items to track them, add them to the shopping list, or export CSV/JSON.
4. If a scan returns nothing, read the **Why 0 results** box — it names the cause. If results look wrong, press **Self-test** in the sidebar: it parses a built-in sample and reports PASS/FAIL. Shortcuts: `/` search, `S` scan, `Esc` close.

## Telegram alerts

Hunter can send new deals, price drops and cheaper saved items to your Telegram.

1. In Telegram, open `@BotFather`, send `/newbot`, and copy the bot token.
2. Open your new bot and press **Start**.
3. Get your chat ID from `@userinfobot`, or open `https://api.telegram.org/bot<token>/getUpdates` and copy `chat.id`.
4. On the store, open Hunter, press **Telegram** in the top bar, paste the token and chat ID, press **Send test**, then switch alerts on.

Each deal is sent once, and again only if its price drops further. Use the userscript for alerts: some shops block bookmarklets from calling Telegram, while the userscript sends through `GM_xmlhttpRequest`. The token is stored only in your browser.

## Telegram bot (GitHub Actions)

Hunter can also run on its own, without a browser, on GitHub Actions. Every 30 minutes it scans Flipkart Minutes, compares with the previous run, and sends what changed to Telegram. The bot keeps a price history in `data/state.json`, so it reports new deals, price drops and restocks — and stays silent when nothing changed.

| | Browser tool | Telegram bot |
| :--- | :--- | :--- |
| Runs | In your browser tab | On GitHub Actions (free for public repos) |
| When | Each time you press Scan and pick categories | Every 30 minutes, 08:31 to 00:01 IST |
| Uses | Your open Flipkart Minutes session | A copy of your session stored as a GitHub secret |
| Alerts | New deals, price drops, saved items | New deals, price drops, back in stock, a morning catalogue |

### Step 1: Copy the repository

Click **Fork** at the top of [github.com/stymrj/Flipkart-Minute-Deals](https://github.com/stymrj/Flipkart-Minute-Deals). Everything below happens in your fork.

### Step 2: Create your Telegram bot

1. In Telegram, open `@BotFather`, send `/newbot`, and follow the prompts. Copy the token it gives you. This is `TELEGRAM_BOT_TOKEN`.
2. Open your new bot and press **Start**.
3. Open `@userinfobot` and press **Start**. Copy the number it shows. This is `TELEGRAM_CHAT_ID`.


### Step 3: Copy your Flipkart session

The bot needs a session that has a Minutes delivery address, exactly like your browser.

1. On a computer, open [flipkart.com](https://www.flipkart.com), log in, and set your **Minutes** delivery address or pincode.
2. Press `F12` to open DevTools, go to the **Network** tab, and reload the page.
3. Click the first request to `www.flipkart.com`, find **Request Headers → cookie**, and copy the whole value. This is `FLIPKART_COOKIE`.
4. Your pincode is `PINCODE`. If you leave it out, the bot uses the pincode saved in that cookie.

Cookies expire after a while. When the bot reports that Flipkart refused the session, copy a fresh one.

### Step 4: Add the secrets

In your fork, open **Settings → Secrets and variables → Actions → Secrets** and add:

| Secret | Required | What it is |
| :--- | :---: | :---: |
| `TELEGRAM_BOT_TOKEN` | Yes | Token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | Your chat ID from @userinfobot, or a channel `@username` |
| `FLIPKART_COOKIE` | Yes | The Cookie header from a logged-in flipkart.com tab with your Minutes address set. |
| `PINCODE` | No | Your delivery pincode. Default: the one in the cookie, else 560032. |

Then open the **Variables** tab and add `BOT_ENABLED` = `true`. Scheduled runs only start once this is set.

Optional variables:

| Variable | Default | What it does |
| :--- | :--- | :--- |
| `MIN_DISCOUNT` | per group | One threshold for every group, for example `65` |
| `THRESHOLDS` | per group | Per-group discount thresholds, for example `fresh=60,staples=65` (group ids from `bot/config.json`) |
| `GROUPS` | all | Only scan these groups, for example `fresh,staples` |
| `PAGES` | `2` | Pages per aisle, 1 to 5 |
| `DIGEST_HOUR_IST` | `9` | Hour of the morning catalogue; `-1` turns it off |
| `MAX_WORKERS` | `4` | How many aisles the bot scans at once |
| `MAX_ALERTS` | `40` | Most deals sent per message section (new / cheaper / back in stock) |
| `RUNNER` | `ubuntu-latest` | Set to `self-hosted` to run on your own computer |

### Step 5: Enable and test

1. Open the **Actions** tab. GitHub pauses workflows in new forks: click **I understand my workflows, go ahead and enable them**.
2. Choose **Telegram deal alerts** → **Run workflow**, first with **Print the messages instead of sending them** ticked (dry run), then without — your first alert arrives within a minute or two.

From then on it runs every 30 minutes by itself. GitHub sometimes starts scheduled runs late, and it pauses schedules in repositories with no activity for 60 days; re-enable them from the Actions tab if that happens.

### Step 6 (if blocked): run it on your own computer

GitHub's servers share IP addresses that some shops block. A self-hosted runner runs the same workflow on your computer, from your home connection.

In your repository: **Settings → Actions → Runners → New self-hosted runner**, follow its commands, then set variable `RUNNER` = `self-hosted` and keep that computer on during alert hours. Node 18 or newer must be installed on that computer.

### Run it on your computer

```bash
cp .env.example .env        # fill in the values from steps 2 and 3
node bot/run.js --dry-run   # prints the messages, sends nothing
node bot/run.js             # sends to Telegram and remembers this run in data/state.json
```

Node 18 or newer, no `npm install` needed.

### Keep your session safe

A session cookie works like your password for that site. Keep it only in GitHub **Secrets** or your local `.env` (already in `.gitignore`), never in a commit or an issue. GitHub hides secrets in run logs. If one ever leaks, log out of all devices on Flipkart Minutes to cancel it.

## Troubleshooting

- **Blank results / 0 deals:** read the **Why 0 results** box after the scan. Common causes: you are logged out (log in again on flipkart.com), no Minutes delivery address is set (set it on the Minutes store page), Flipkart rate-limited the scan (wait a few minutes), or the categories genuinely have nothing above your minimum discount (lower it and rescan).
- **Login / location:** Hunter only works inside your own logged-in flipkart.com tab, and always uses the delivery pincode Flipkart already saved for you — it never changes your address. If the pincode is wrong, fix it on the Minutes store page, not in Hunter.
- **Self-test fails:** the parser itself is broken for the built-in sample — check that `dist/` was rebuilt with `node build.js` after the last change, and report the FAIL line.
- **Telegram test fails:** use the userscript version; the bookmarklet is blocked from calling Telegram on some pages.
- **Bot never runs on schedule:** scheduled runs only start once the `BOT_ENABLED` variable is `true` (Step 4) and the workflow is enabled in the Actions tab. A manual **Run workflow** still works without it.
- **Bot run exits 1 (no token/chat ID, or "Missing settings"):** the `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` or `FLIPKART_COOKIE` secret is missing or empty — re-add it under Settings → Secrets and variables → Actions → Secrets. A dry run (`--dry-run` locally, or the dry-run tickbox on Run workflow) does not need the Telegram secrets.

## Testing

Run `node test-results-tab.js` (sample Rome payload: 12 products, all 3 card shapes, parser -> real card() render) and `node build.js` to rebuild `dist/` and `index.html`.

The regression test asserts 12 parsed products render 12 cards, plus the swapped-price, glued-MRP, tracking-price and title-fallback repairs, the self-test, CSV/JSON export and multi-keyword search. Live Flipkart results still need a manual browser test: the API cannot be fully verified from a machine without a logged-in Minutes session.

## How it gets data

Calls the same page-fetch API the Flipkart site uses (`1.rome.api.flipkart.com/api/4/page/fetch`, with data-centre switching on HTTP 406), from your logged-in tab. It sends the Minutes pincode Flipkart already saved for you (it never changes your address), requests every category discount-first, follows up with `page=N` only while the tail discount stays high, and retries on rate limits. If the API returns nothing usable, it falls back to parsing the `__INITIAL_STATE__` JSON on the category page itself.

## Limitations

- Prices and stock depend on your Minutes delivery address. Set it on the Minutes store page first.
- One pincode per run: the browser tool always uses your saved Minutes address, so it never switches your delivery address. (The bot takes one `PINCODE` per run.)
- The 39 sub-categories were read from the Minutes store and the Nov 2026 category list; if Flipkart adds or renames one, update `GROUPS` in `src/deals.js`.
- Flipkart can change its internal API at any time.

## Project layout

```
src/deals.js         the app (one file, no dependencies)
src/index.tpl.html   install page template
bot/                 Telegram bot: run.js, core.js, platform.js, config.json
.github/workflows/   telegram-bot.yml (every 30 minutes)
.env.example         settings for local runs
test-results-tab.js  regression test (node test-results-tab.js)
fixtures/sample-api.json   sample Rome payload for the test
build.js             builds dist/ and index.html
favicon.svg
```

Run `node build.js` after any change.

## License

MIT — see `LICENSE`. The Flipkart fetch-and-parse layer includes portions adapted from MIT-licensed reference code; the original copyright notice for those portions is reproduced in `LICENSE`.

Made with ♥ by [Satyam Raj](https://www.linkedin.com/in/satyamraj1)
