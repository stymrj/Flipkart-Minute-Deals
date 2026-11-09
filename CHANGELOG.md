# Changelog

## v2.0.0 — 2026-11-08
- Fixed (2026-11-09): install button now reads “Flipkart Minutes Deals” instead of the generic “PriceDrop Hunter”, so the dragged bookmark is named after this store instead of colliding with every other tool.
- Fixed (2026-11-09): highest-discount products were missed — the paging signal read the last card's discount, and a low-discount recommendation card trailing page 1 stopped the scan, so deeper pages were never fetched; it now reads the lowest discount in the discount-sorted listing. Also: object-shaped `totalDiscount` is now read (it parsed as 0% and the item was filtered out), and `LOW_STOCK` items are no longer treated as out of stock. Same fixes mirrored in `bot/platform.js`, and the bot's early-stop now uses the same tail discount in `bot/core.js`. No version bump (stays 2.0.0).

- Fetch layer rewritten around discount-first requests: every category is fetched
  with `sort=discount`; pages after the first are plain `page=N` requests, taken
  only while the previous page still ends on a discount worth showing
  (50% off, 40% for staples). The pagination-token flow is removed.
- Atlas / DLS card shapes (search-grid and recommendation widgets) are now
  parsed — pages that served only those cards used to come back blank.
- Price repair: selling price above MRP is swapped back instead of hiding the
  discount; a missing MRP is rebuilt from `totalDiscount`; a MRP with the
  discount digits glued on the end is repaired; `tracking.fsp`/`tracking.mrp`
  prices are now read.
- Pincode is read from the page's session state, then cookies, then storage.
  It is never invented and never switched.
- HTML fallback: if the page-fetch API returns nothing usable, the category
  page's embedded `__INITIAL_STATE__` JSON is parsed instead.
- Empty-state diagnostics: an empty scan now reports why (signed out, no
  delivery address, rate-limited, empty categories) instead of a blank page.
- In-browser Self-test button (sidebar) runs the parser on a built-in sample
  payload and reports PASS/FAIL.
- Depth default 2 → 3 pages per category; 12 groups / 39 sub-categories
  (added Sports & Fitness, Fashion Accessories, Mobile Accessories, Paan
  Corner; fixed the broken Health & First Aid link).
- Multi-keyword search (comma = OR, spaces = AND) and JSON export alongside CSV.
- Bot: `bot/platform.js` mirrors the browser parser (same shapes, same price
  repair, same page=N gating); pincode falls back to the one in the session
  cookie; `bot/config.json` gains the new groups. No new tokens or secrets.
- UI shell (filters, saved items, price history, themes, CSV export) unchanged.

## v1.0.0 — 2026-10-25

- Initial PriceDrop Hunter release for Flipkart Minutes.
