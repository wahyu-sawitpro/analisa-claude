# Smallholder Sales Jul–Sep 2026: decisions log

The deck is built from `Smallholder sales jul - sep.csv` (371 order lines) and `Smallholder engagement jul - sep.csv`
(850 engagements) with the deck page in `deck/`. The uploader asked for the deck page (upload, Analyze, PPTX / Google
Slides) without answering the question list, so every item below uses the recommended default. Each one can be changed.

| # | Question | Answer used | Decided by |
|---|---|---|---|
| 1 | Main metric | GMV (`gmv` = sales_amount + shipping, before discount) | default |
| 2 | Comparison basis | Sep vs Jul (first vs last full month); "Sales Decline Review" | default |
| 3 | Sep orders not completed (Rp569M; Rp311M part paid) | Counted in GMV and flagged | default |
| 4 | Next steps (human-only) | DRAFT: actions marked "[DRAFT]", owner and date "[to be agreed]" | default |
| 5 | Font minimum | 9 pt text and tables, 10 pt notes, 8 pt for labels inside charts | default |
| 6 | Joko Prestiwo: 195 of 195 identical entries | Shown, flagged as a likely form default, left out of the slide title | default |
| 7 | Deck language | English (repo rule) | default |
| 8 | Engagement dated 30 Jun | Left out: CRM limited to the sales months (849 engagements) | default |
| 9 | Number format | Rp2.41B / Rp569M | default |
| 10 | Output | PPTX and deck page committed to this branch; page published as an artifact | default |
| K1 | Slide 8 wording, slide 15 "reached" | Fixed: "bought in Jul–Aug"; reached = call result logged or on-site visit | default |
| K2 | Font sizes | Raised (see 5) | default |
| K3 | Drop the success-story slide | Kept (template structure unchanged) | default |
| K4 | Footer basis and as-of date | Added: "GMV incl. shipping, before discount · Sep vs Jul · data to 30 Sep 2026" | default |

Rounding: Rp values to 3 significant figures (Rp2.41B, Rp569M), percentages to whole numbers; totals are summed from
source values before rounding.

## Still open
- Human-only: owners and dates for the 6 next steps.
- The 2 CRM wins (Simon Sutrado Simanjuntak): 1 of 2 matches a buyer in the sales export by phone.
- 62 phone or WhatsApp engagements have no call result; 297 engagements have no `Call Response` at all.
- Potential GMV, fertilizer needs and land size are 90–97% empty in the CRM export, so they are not shown.
- Tonnes on slide 4 are estimated from pack sizes in item names; not checked item by item.
- Slide 12 has empty space under the wins table (only 2 wins); slide 13 bar labels sit tight on the bars.

# Stock forecast Nov 2026 – Jan 2027: decisions log

Built from `history sales Jan - Oct 2026 per 14 Oct.csv` (795 lines, 2 Jan – 13 Oct 2026) and
`Price per 14 Oct 2026.csv`, with the target set by the uploader. Output: slides 3–5 of
`Smallholder Forecast Nov 2026 - Jan 2027.pptx`, `forecast_stock_plan.csv` and `forecast_stock_by_sku.csv`.

| Item | Decision | Decided by |
|---|---|---|
| Target | Rp4B GMV a month (management target Rp18B); editable on the deck page | uploader |
| Products | Items sold by the kg (fertilizer); liquids (litre), seeds, pesticides and services left out | uploader |
| Price tiers | product_cat Pupuk = Reguler, Pupuk Grosir = Grosir, Toling = Toko Keliling, Khusus Petani = Khusus Petani | uploader |
| Prices | Price list of 14 Oct 2026; an SKU missing from its tier uses the Reguler price, then any tier; 8 SKUs not on the list use their last selling price | default |
| Areas | Riau; Sumatera Utara; Sumatera Selatan incl. Lampung, Jambi, Bengkulu. Target split by each area's share of fertilizer GMV Jan–Oct (82% / 16% / 2%) | uploader (areas), default (split) |
| Missing province | 36 lines (Rp1.36B, mostly Jan–Feb from the old app) take the customer's province from their other orders; 6 lines the PIC's main area | default |
| Stock formula | area target × 96% fertilizer share × (1 − 1.8% shipping) ÷ value per kg at today's prices, using the area's SKU and tier mix | default |
| Mix window | Nov and Dec: last 4 months (Jul–Oct 2026). Jan: same season last year (Jan–Feb 2026). An area with fewer than 8 orders in the window uses its full history (Sumatera Selatan in Nov/Dec) | default |
| Rounding | Each SKU rounded to whole bags; MT shown to 1 decimal | default |
| Trend slides | A Jan–Oct export is reviewed on its last 3 full months (Jul–Sep); October (to 13 Oct) is partial and left out of the trend | default |

Checks: every month × area target, price per kg and tonnage (27 values) and every SKU × month cell (93 values) were
recomputed in a separate Python model and match (within 0.2% / 0.1 MT, the bag rounding); a deliberately wrong control
value was caught.

Not covered by the data: stock on hand, supplier lead times and minimum orders, so "stock required" is the tonnage to
sell, not a purchase order. The highest month in the data is Jan 2026 at Rp3.0B (Rp1.29B of it had no province);
the best of the last 6 months is Jul at Rp2.41B.
