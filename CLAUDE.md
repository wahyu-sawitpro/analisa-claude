# SawitPRO sales analysis

The main deliverable is the deck in `deck/` (see `deck/README.md`): a single HTML page with upload, Analyze,
Download PPTX and Google Slides export, published as the claude.ai artifact "SawitPRO Deck"
(https://claude.ai/artifact/H73dmaq1yoCnzL2p2JMg5p). New analysis requests (sales, acquisition, forecasting, ...) are
added to this deck, not built as separate decks.

## Standing requests from the user
- **Always go deeper.** Don't stop at totals and the first explanation. For any change, break it down (volume vs
  price vs mix, customers lost vs returning vs new, accounts, PICs, products, regions, channels, timing), test whether
  one account or one deal explains it, and turn each finding into a concrete action with an owner.
- Match the review to the data the user uploaded: a weekly export is a weekly review; a multi-month export is a
  trend or decline review. Say when a file's dates don't match what its name suggests.
- Deck text is in English; chat replies follow the user's language (usually Indonesian).

## Rules
- No customer names or phone numbers on any slide, except the "Success story · the orders" table, which the user asked
  to show each buyer's name and phone (from the uploaded export, read in the browser only). Raw CSV exports are never
  committed (the sample is anonymised by hashing phone numbers and names).
- PPTX charts are drawn as shapes and text boxes (no native charts), so Google Slides keeps every label.
- Rebuild with `python3 deck/build.py` after editing `deck/src/`.
