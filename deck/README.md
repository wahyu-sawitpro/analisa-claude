# SawitPRO Sales & Leads Deck (Smallholder + Plantation)

An English deck in the SawitPRO template that turns weekly CRM and sales exports into a short, insight-led review.
It is an HTML page: upload any number of files, check the detected data type of each one, then click **Analyze**.
Parsing and analysis happen in the browser; data is not sent anywhere.

| Control | What it does |
|---|---|
| Upload files | Adds one or many CSV, TSV, XLSX, XLS, ODS or JSON files (or drag and drop). Nothing changes until you click Analyze |
| Data sources bar | Each file or lead-like sheet, with its row count, an include toggle, a data-type selector (CRM / Sales, auto-detected) and remove |
| Analyze | Builds the deck from the included sources |
| Present | Full-screen slide mode (arrow keys, Esc) |
| Download PPTX | Editable 16:9 PowerPoint of the current deck. Bar charts are drawn from shapes and text boxes (no embedded chart workbooks), so they look the same in PowerPoint and Google Slides |
| Open in Google Slides | Uploads the PPTX to the viewer's Google Drive via the Google Drive connector (converted to Slides), with a manual-import fallback |

## Teams
Every file is assigned to a team, shown in the data sources bar and overridable per file:
an explicit choice, else the `pic_team` column (sales files with both teams are split row by row), else the CRM headers
(`Smallholders Team` vs `PIC (Plantation team)`), else the file name. With two teams the deck adds a combined executive
summary, a **Teams at a glance** comparison, a divider and full section per team, and merged next steps tagged by team.
With one team it is the single-team deck.

## Data types
- **CRM engagements**: one row per engagement (e.g. `Engagement ID`, `Smallholders Team`, `Engagement Type`, `Respon Pengguna`,
  `Alasan customer tidak tertarik`, `Detail Pembahasan`, `Sumber Lead`). Rows are classified by status: *Already order* = won;
  *Prospect* / *Mempertimbangkan* = still in play; *Cold - Tidak tertarik* = lost. Rejection and order exports can be
  separate files or one file.
- **Sales orders**: one row per order line (e.g. `main_order_no`, `pic_name`, `customer_phone`, `item_name`, `qty`, `gmv`,
  `customer_status`, `main_inv_status`). Lines are grouped into orders.
- CRM rows whose notes say "Closing …" count as wins even when the status was left at *Prospek* (flagged as a CRM clean-up).
- CRM wins are linked to sales orders by phone number (`08…` and `+62…` normalised), then an order number in the notes
  (`#B2C…`), then first name (spelling-tolerant: Muryanto = Muriyanto) + same PIC, then — for wins only — same PIC, value within 2% and
  order within 7 days. The success-story slide lists how each win was matched. Repeated engagement IDs are counted once.

## Slides (only the ones the data supports are shown)
Charts are drawn by `src/viz.js` once as geometry, rendered as SVG on the page and as plain shapes and text boxes in the
PPTX (no native charts, so Google Slides keeps every label). Chart types: column, line (Pareto), waffle, funnel,
100% stacked bars, heat matrix and horizontal bars. Categorical colours are checked for colour-blind separation.

1. Cover, executive summary, teams at a glance
2. Per team:
   - Success story: how wins happened (channel, source, lead type as 100% bars) and the orders behind them
   - Success story · what the wins are worth: average order of CRM wins vs orders with no CRM record, product mix of
     wins vs other orders, share of GMV, days to order, biggest win, new vs repeat, potential GMV vs actual
   - Sales · what sold: GMV by product type and by product category (columns), units anchor, basket, price gaps
   - Sales · who bought and how: region (or customer role), average order by channel and customer type, sales PIC,
     unpaid, open and CRM-less orders
   - Sales · order size and timing: GMV by day, customer concentration (Pareto line with 80% mark), orders by size band
   - Sales · where to grow: product × region heat matrix, what buyers of the most-bought product also buy
     (cross-sell gap), open orders by age, entry product for new customers, regional product skew
   - Rejection reasons: every reason by status, heat matrix against the dimensions that best predict the reason
   - Rejection reasons · who to call back: waffle of every lead that didn't order (can be won back vs closed for now),
     reasons by contact outcome, signals from the notes, and a call-back plan per reason (what to do, when)
   - What separates winners: rate by the deciding dimension (columns) and cohort profile
   - Team performance: CRM funnel and PIC scorecard
   - Recoverable demand: leads still in play
3. Next steps and closing

## Files
- `index.html`: built deck, ready to open
- `src/deck.html`: page shell and styles; `src/analysis.js`: detection, cleaning, linking and analysis;
  `src/slides.js`: narrative and HTML slides; `src/app.js`: upload, Analyze flow, present mode;
  `src/export-pptx.js`: PPTX builder and Google Drive upload
- `src/sample-data.json`: last week's five exports (3 Smallholder, 2 Plantation) with phone numbers and names replaced by anonymous tokens
- `build.py`: run `python3 deck/build.py` to regenerate `index.html`

## Findings on last week's data (28 Sep – 4 Oct 2026)
- Rp669M GMV from 19 orders (19 customers, 4 new); the top 2 orders are 39% of GMV.
- Rock phosphate is the anchor product: 71% of units (1,977 of 2,779) and 40% of GMV. By product category, Pupuk has
  the most GMV (30%) and Khusus Petani the most orders (8). 7 of 19 orders mix product types, most often KCL with NPK or RP.
- RP Mahkota 50kg (Egypt) sold at Rp111k–129k per unit across 7 lines (+15%).
- Riau is 81% of GMV. Kampar has the most customers (7); Siak's Rp161M is mostly one Rp147M order.
- Web orders average Rp50.5M vs Rp18.2M on the Petani app; repeat customers are 15 of 19 orders and 87% of GMV.
- Rp170M is still unpaid on 4 partially paid orders, and 13 of 19 orders are still open.
- All 10 CRM wins are confirmed in sales (9 orders, Rp279M). 9 of 10 came from one PIC's on-site canvassing.
- Lead source separates outcomes: canvassing 8 of 9 ordered, database 0 of 23.
- Lead type predicts the rejection reason: existing leads 15 of 17 locked into a shop, KUD or agent; new leads 7 of 12 "just asking".
- 5 of 8 "just asking" reasons were logged when the call didn't connect. Pelalawan - Kerumutan: 11 of 12 engagements locked in.
- 15 of 17 "not interested" leads are locked into a shop, KUD or agent (2 buy on credit, 3 already fertilized this season).
- 10 of 11 leads still in play asked about the warehouse, delivery or prices; 6 could not be reached by phone.
- 3 leads stalled on stock or a 7–14 day delivery (AC AKP, KCL Mahkota, NPK).
- 10 of 19 orders (Rp390M) have no CRM engagement. 4 sellers (7 orders, Rp356M, 53% of GMV) logged no CRM engagement at all.
- Funnel: 39 logged, 33 reached, 21 showed interest, 10 ordered. 6 of 29 calls didn't connect.
- Rudi Nirwana turns 9 of 10 engagements into orders (on-site); Merita Syarif 0 of 10 so far (WhatsApp, 9 still considering).
- 9 of 19 orders are above Rp20M and make 83% of GMV; the top 3 of 19 customers are 50%.
- 9 of 10 wins are dated the same day as their order, and wins were last edited a median 4 days after the engagement,
  so the CRM records sales after the fact rather than tracking leads.
- Orders behind CRM wins average Rp31M vs Rp39M for orders with no CRM record; wins are 42% of GMV. Wins buy less
  rock phosphate (6% of win GMV vs 65% elsewhere). Biggest win: Rp113M of NPK from a phone call on a canvassing lead.
- 8 of 10 rock phosphate buyers didn't add KCL / MOP, its most common partner; 5 bought nothing else.
  Kampar buys mostly NPK (42% of its GMV). 4 open orders (Rp228M) are 4+ days old.
- 13 of 29 leads who didn't order can still be won back; 15 are locked into a shop, KUD or agent.
- Discounts: Rp11.8M (1.8% of GMV) on 6 orders; shipping charged Rp22.6M on 10 orders.

## Plantation (28 Sep – 2 Oct 2026)
- Rp53.1M from 4 orders (7% of combined GMV). Seeds are 77% of GMV from a single 40-pack Topaz order.
- All 3 CRM wins are confirmed in sales (Rp43.2M): one by phone, one by name and PIC, one by value and date.
  All 3 are still marked "Prospek" in the CRM although the notes say closing.
- Wins ordered a median 2 days after the engagement. One seller (1 order, Rp9.9M) has no CRM engagement.
- 2 leaf and soil test (Dokter Sawit) customers are the obvious follow-up for fertilizer orders.
- The plantation sales export has no region or customer-status columns, and the seed line has no product category.
