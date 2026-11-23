# SawitPRO sales analysis

The main deliverable is the deck in `deck/` (see `deck/README.md`): a single HTML page with upload, Analyze,
Download PPTX and Google Slides export. It is published as two claude.ai artifacts, each refreshed by its own weekly
routine:
- "SawitPRO Sales Deck" (https://claude.ai/artifact/WFkx8cUiCoSgwT3Y5ooSEn): weekly sales and CRM review, built with
  `TITLE="SawitPRO Sales Deck" python3 deck/build.py` from the weekly exports (sales: "Smallholder Sales last four
  weeks.csv" and "Plantation Sales last four weeks.csv"; CRM: success story and rejection reasons, last week, both
  teams); routine every Monday 13:00 WIB.
- "SawitPRO Deck" (https://claude.ai/artifact/H73dmaq1yoCnzL2p2JMg5p): farmer registration review; routine every
  Tuesday 10:00 WIB (see "Weekly registration refresh" in `deck/README.md`).
Never publish one review to the other's artifact. New analysis requests (sales, acquisition, forecasting, ...) are
added to this deck, not built as separate decks.

## Standing requests from the user
- **Sales deck structure (composed):** Smallholder and Plantation are separate teams: no slide compares or sums them
  (no both-teams trend, no "Teams at a glance"; the executive summary shows each team on its own). In each team section
  first the summary slide, the only slide that uses the 4 weeks: four deltas (sales last week vs the week before,
  sales vs the average of the 3 earlier weeks, orders = unique invoices vs the week before, orders vs the 3-week
  average), a chart of total sales for the 4 weeks, the week-by-week table (no average row) and under it a "Top category"
  card (category with the most sales and with the most orders, the week before vs last week). Its yellow box says in 2-4 short
  lines why sales fell or rose vs the week before (e.g. smaller average order, fewer customers, the category that
  led last week vs the week before), each line saying what it means, not only the numbers (e.g. sales up
  but orders down = customers bought in bulk; units per order; same or different buyers); never a long analysis. Every slide after it
  compares last week with the week before only. Then the sales slide (last week vs the week before), then
  "Product categories · bought most vs earned most" (units vs sales, last week vs the week before), the other sales slides, success
  story and rejection reasons. When last week's data stops 2+ days before Sunday, say so and add the like-for-like
  view (the same first days of each week).
- **Always go deeper.** Don't stop at totals and the first explanation. For any change, break it down (volume vs
  price vs mix, customers lost vs returning vs new, accounts, PICs, products, regions, channels, timing), test whether
  one account or one deal explains it, and turn each finding into a concrete action with an owner.
- **Rejection reasons: read the notes.** For every rejection reason, analyse the "Detail Pembahasan" notes (what was
  asked, price sent and no reply, products and quantities named, waiting for Toling, shipping, stock, documents) and
  give a next step per reason ("Rejection reasons · what the notes say" slide).
- **"What holds it back" comes from the CRM fields:** Plantation = "Alasan tidak tertarik"; Smallholder = "Alasan
  customer tidak tertarik" + "Respon Pengguna" (e.g. "Product out of stock · Considering"). Don't guess it from notes.
- **Show the engagement purpose on the rejection slides:** Plantation "Tujuan Melakukan Engagement", Smallholder
  "Objective" (purpose chart on "Rejection reasons last week", a Purpose column on the notes and potential tables).
- **"Belum ketertarikan yang jelas (cek harga / nanya-nanya)" is not a refusal.** Label it "Still inquiring, no clear
  interest to buy now" and treat it as an open enquiry. A lead who didn't order with no reason logged counts as the
  same "Still inquiring" reason (the notes slide says how many were filled in this way).
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
