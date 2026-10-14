# SawitPRO sales analysis

The main deliverable is the deck in `deck/` (see `deck/README.md`): a single HTML page with upload, Analyze,
Download PPTX and Google Slides export, published as a claude.ai artifact.

## Standing requests from the user
- **Always go deeper.** Don't stop at totals and the first explanation. For any change, break it down (volume vs
  price vs mix, customers lost vs returning vs new, accounts, PICs, products, regions, channels, timing), test whether
  one account or one deal explains it, and turn each finding into a concrete action with an owner.
- Match the review to the data the user uploaded: a weekly export is a weekly review; a multi-month export is a
  trend or decline review. Say when a file's dates don't match what its name suggests.
- Deck text is in English; chat replies follow the user's language (usually Indonesian).

## Rules
- No customer names or phone numbers on any slide; raw CSV exports are never committed (the sample is anonymised by
  hashing phone numbers and names).
- PPTX charts are drawn as shapes and text boxes (no native charts), so Google Slides keeps every label.
- Rebuild with `python3 deck/build.py` after editing `deck/src/`.
