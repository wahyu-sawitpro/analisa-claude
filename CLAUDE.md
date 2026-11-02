# SawitPRO sales analysis

The main deliverable is the deck in `deck/` (see `deck/README.md`): a single HTML page with upload, Analyze,
Download PPTX and Google Slides export. It is published as two claude.ai artifacts, each refreshed by its own weekly
routine:
- "SawitPRO Sales Deck" (https://claude.ai/artifact/WFkx8cUiCoSgwT3Y5ooSEn): weekly sales and CRM review, built with
  `TITLE="SawitPRO Sales Deck" python3 deck/build.py` from the six weekly exports; routine every Monday 13:00 WIB.
- "SawitPRO Deck" (https://claude.ai/artifact/H73dmaq1yoCnzL2p2JMg5p): farmer registration review; routine every
  Tuesday 10:00 WIB (see "Weekly registration refresh" in `deck/README.md`).
Never publish one review to the other's artifact. New analysis requests (sales, acquisition, forecasting, ...) are
added to this deck, not built as separate decks.

## Standing requests from the user
- **Always go deeper.** Don't stop at totals and the first explanation. For any change, break it down (volume vs
  price vs mix, customers lost vs returning vs new, accounts, PICs, products, regions, channels, timing), test whether
  one account or one deal explains it, and turn each finding into a concrete action with an owner.
- **Rejection reasons: read the notes.** For every rejection reason, analyse the "Detail Pembahasan" notes (what was
  asked, price sent and no reply, products and quantities named, waiting for Toling, shipping, stock, documents) and
  give a next step per reason ("Rejection reasons · what the notes say" slide).
- **"Belum ketertarikan yang jelas (cek harga / nanya-nanya)" is not a refusal.** Label it "Still inquiring, no clear
  interest to buy now" and treat it as an open enquiry.
- **SawitPRO price tiers, cheapest to most expensive:** Khusus Petani (farmer price, close to the subsidised price),
  Toling (toko keliling: sells at set stops, so the customer pays no shipping), Grosir (wholesale), Retail (product_cat
  "Pupuk"). Use this order on the "price tiers" slide and in every price-related finding or action.
- **Price tiers are also a sales lens:** compare each tier last week vs the week before and say which tier led and
  which overtook which (e.g. "Toling outsold Grosir last week; the week before Grosir led").
- **Success story · the orders** shows: every order of Rp50M+ (if none, the top 3 orders), customers with more than one
  invoice in the week, and CRM wins whose source or discussion notes point to something other than Toling/canvassing
  (ads, social media, TikTok, referral, events) as outliers worth telling.
- Match the review to the data the user uploaded: a weekly export is a weekly review; a multi-month export is a
  trend or decline review. Say when a file's dates don't match what its name suggests.
- Deck text is in English; chat replies follow the user's language (usually Indonesian).

## Rules
- No customer names or phone numbers on any slide, except (at the user's request) the "Success story · the orders"
  table (each buyer's name and phone) and the "users above 100 ha" registration slides (name and contact: phone, else
  email). Those details come from the export uploaded in the browser; files built from real exports with them are sent
  to the user, not committed. Raw CSV exports are never committed (the sample is anonymised by hashing phone numbers
  and names).
- PPTX charts are drawn as shapes and text boxes (no native charts), so Google Slides keeps every label.
- Rebuild with `python3 deck/build.py` after editing `deck/src/`.
