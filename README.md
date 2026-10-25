# PriceDrop Hunter for Flipkart Minutes

Scans Flipkart Minutes departments in the background, ranks products by real savings, and tracks price changes between scans. It runs in your own browser as a bookmarklet or userscript. Nothing is uploaded and there is no account.

**Live page:** https://stymrj.github.io/Flipkart-Minute-Deals/

## Features

- Ranks by percent off and rupees saved together
- Labels products that are new, cheaper than last time, or at their lowest price ever
- Price history sparkline on every product you have seen before
- Saved items strip showing how much each one dropped since you saved it
- Unit price (per kg, litre or piece) with a value sort
- One-tap presets: under ₹99, 50% off, save ₹100+, price drops, lowest ever, best value
- A setup checklist on first open
- Filters: search, category, brand, maximum price, minimum discount, stock, saved items
- Shopping list with quantities, total and total savings
- CSV export and copy-to-share text
- Grid and list views, light and dark themes, keyboard shortcuts
- Settings, saved items and price history stay in your browser

## Install

**Bookmarklet (desktop).** Run `node build.js`, open `index.html`, and drag the button to your bookmarks bar. Open flipkart.com and click the bookmark.

**Bookmarklet (mobile).** Copy the code from the page, create a bookmark, and paste the code as its address. Run it from the address bar on flipkart.com.

**Userscript.** Install `dist/minutes-deal-radar.user.js` in Tampermonkey or Violentmonkey. A small Deals button appears on every flipkart.com page.

**Demo.** Use "Try the demo" on the install page to explore the interface with sample data.

## Keyboard shortcuts

`/` search, `S` scan or stop, `Esc` close.

## Telegram alerts

Hunter can send new deals, price drops and cheaper saved items to your Telegram.

1. In Telegram, open `@BotFather`, send `/newbot`, and copy the bot token.
2. Open your new bot and press **Start**.
3. Get your chat ID from `@userinfobot`, or open `https://api.telegram.org/bot<token>/getUpdates` and copy `chat.id`.
4. In Hunter's sidebar, open **Telegram alerts**, paste the token and chat ID, press **Send test message**, then switch alerts on.
5. Optional: set **Auto-scan** (for example every 15 minutes) and keep the tab open.

Each deal is sent once, and again only if its price drops further. Use the userscript for alerts: some shops block bookmarklets from calling Telegram, while the userscript sends through `GM_xmlhttpRequest`. The token is stored only in your browser.

## How it gets data

Calls the same page-fetch endpoint the Flipkart site uses, from your logged-in session. If the API reports a data-centre change (HTTP 406), the request is retried on the data centre it names.

## Limitations

- Category addresses for the first eight departments are verified patterns. The last six (Fashion, Electronics, Ice Cream, Toys, Meat, Paan) are best guesses and may need adjusting in `GROUPS`.
- Personal & Baby Care, Home & Kitchen and Household Care list only some subcategories.
- Flipkart needs a Minutes delivery location on the session; without one it returns no products.

## Project layout

```
src/deals.js         the app (one file, no dependencies)
src/index.tpl.html   install page template
build.js             builds dist/ and index.html
favicon.svg
```

Run `node build.js` after any change.

---

Made with ♥ by [Satyam Raj](https://www.linkedin.com/in/satyamraj1)
