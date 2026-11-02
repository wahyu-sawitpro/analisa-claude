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
