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
   - Sales · vs the week before (shown when the uploaded sales data covers two weeks, in one file or two):
     GMV, orders, average order and customers with the change, GMV by day of week for both weeks (line), a customer
     bridge (lost, returning and new customers as a waterfall) and what moved GMV by product type (diverging bars).
     The notes explain an increase or a drop: order count vs order size, products, customers, the effect of the
     largest order, and the biggest PIC and region swings; the next steps add a win-back or repeat action
   - Sales trend (shown when the sales exports cover two or more full months, e.g. a Jul–Sep export): three slides.
     GMV by month split into accounts that stopped ordering vs everyone else, GMV by week; a customer bridge from the
     first to the last month and the change by PIC and product category; orders by size band per month, the accounts
     that stopped ordering (anonymised, with PIC, product, region and last order), retention and orders not yet completed
     Plus: volume vs price (tonnes sold from pack sizes, GMV per kg, and a waterfall splitting the change into more kg,
     a cheaper product mix and price cuts per product); month by month (PIC and category heat matrices, new vs repeat
     customers, top-5 customer share, month-end timing, channels and new regions); and who to win back first (lapsed
     customers and repeat buyers per PIC, reorder interval, and CRM contact when a CRM export is uploaded)
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

## Comparing weeks
Upload the week-before sales export (same columns as `sales from last week.csv`) next to last week's, or one export
covering both weeks. Sales lines are grouped into Monday–Sunday weeks by order date: the latest week is analysed as
"last week" and the one before is the comparison. The same order line in two files counts once. Without a second week
the comparison slide is skipped and the upload bar suggests adding it.

## Two kinds of review
- **Weekly review** (default): the sales data ends part-way through a month, e.g. the last two weeks. The deck covers
  last week, compares it with the week before and, when a longer export is also uploaded, adds the trend slides.
- **Sales trend / decline review**: the sales data ends on a full month and covers two or more full months, e.g. a
  Jul–Sep export. The cover becomes “Sales Decline Review · <Team> Sales Jul–Sep” (or “Sales Trend Review” when GMV
  rose), the executive summary and next steps are about the change across the months, and the sales slides cover the
  whole period (“Sales Jul–Sep · …”). CRM exports are analysed on their own and labelled with their own dates
  (“CRM 5–9 Oct · …”), since they rarely cover the same months; their engagements are matched to buyers by phone to
  show whether the team is calling the customers it lost.

Months the data covers in full form the trend; a partial month is left out. The same order line in two files counts once.

## Files
- `index.html`: built deck, ready to open
- `src/deck.html`: page shell and styles; `src/analysis.js`: detection, cleaning, linking and analysis;
  `src/slides.js`: narrative and HTML slides; `src/app.js`: upload, Analyze flow, present mode;
  `src/export-pptx.js`: PPTX builder and Google Drive upload
- `src/sample-data.json`: the Smallholder Jul–Sep sales export and the CRM engagement export, with phone numbers and names replaced by anonymous tokens
- `output/`: the Jul–Sep PPTX, `audit.csv` (each number re-derived from the CSVs) and `DECISIONS.md`
- `build.py`: run `python3 deck/build.py` to regenerate `index.html`

## Findings for Jul–Sep 2026 (sample data: sales decline review)
The sample is the two Smallholder exports in the repo: sales Jul–Sep (371 order lines, 237 orders) and the CRM
engagement export for the same months (850 engagements; the one dated 30 Jun is left out, so 849).
- GMV Rp2.41B → Rp1.64B → Rp2.25B (−7% Jul to Sep), August the low point (52 orders from 36 customers).
- Three wholesale fertilizer accounts of one PIC (Rp1.06B in Jul, 44% of the month) stopped ordering after 25 Jul,
  7 Aug and 27 Aug. All other customers grew 67% (Rp1.35B → Rp2.25B); Khusus Petani +Rp655M.
- Orders of Rp100M+ fell from 6 to 1; Rp20–100M orders rose from 16 to 38. Only 24 of 67 July customers ordered again.
- Volume vs price: 322t → 394t of fertilizer (+22%), but GMV per kg fell 26% (Rp7,422 → Rp5,526). The extra
  volume added Rp534M; a cheaper mix (rock phosphate 28% → 51% of kg) took Rp582M and price cuts Rp165M
  (Urea Nitrea −28%).
- Less concentrated: the top 5 customers were 58% of GMV in July and 32% in September.
- 62 customers bought in Jul–Aug but not in September (Rp3.1B), 19 of them repeat buyers (Rp2.22B). Customers reorder
  every 14 days (median). Of 18 customers who bought in both July and September, 14 spent more.
- Rp569M of September GMV is not completed yet (Rp311M only partially paid).
- CRM Jul–Sep: 27 of the 62 lapsed customers were contacted, none of the 3 stopped accounts. 767 of 849 engagements
  reached the lead (a logged call result or an on-site visit), 590 showed interest and 2 ordered. Joko Prestiwo (195 of
  195) and Edi Sutarsan (36 of 37) logged the same status and reason on nearly every engagement.
- Next steps are marked [DRAFT] with owner and date left to agree; see `output/DECISIONS.md` for every default used.
  accounts were contacted, and the PIC of those accounts logged no engagements.

## Findings for the week of 5–11 Oct 2026 (earlier weekly sample)
That sample was the five exports for that week: Smallholder sales (last 2 weeks), Smallholder CRM rejection reasons and
success story, Plantation sales (last 2 weeks) and the Plantation CRM closing log (“success story + additional data”).

Smallholder
- Rp212M from 11 orders, down 69% from Rp682M: fewer orders (20 → 11) and smaller ones (Rp34.1M → Rp19.3M average).
  19 customers from the week before didn't reorder (Rp673M); 9 new customers brought Rp182M. Rock phosphate −Rp201M, NPK −Rp144M.
- 7 CRM wins, 6 confirmed in sales (Rp99M, 47% of GMV). Wins lean on KCL / MOP (50% of win GMV vs 1% elsewhere).
  One closing names order #B2C25867 (Rp33.2M), which is not in the sales export (refund and adjustment noted).
- Lead source: TikTok 3 of 3 ordered, database 1 of 23. 29 of 41 leads who didn't order can still be won back.
- Joko Prestiwo and Simon Sutrado Simanjuntak closed 4 orders (Rp85.2M) with no CRM entry.

Plantation
- Rp16.5M from 4 orders, down 69% from Rp53.1M: same number of orders, much smaller (last week's Rp40.8M seed order did not repeat).
- The CRM closing log has 6 closings this week worth Rp95.2M, but only Rp16.5M (3 closings, all 4 orders) is in the sales
  export. #B2C25597, #B2C25819, #B2B2539 and #B2C25986 (Rp78.8M, including Rp56.6M of urea) are missing from it.
- Regions for plantation orders come from the closing log: Riau 81% of GMV.

## Reading a closing log without a header row
Exports whose first row is already data (dates, order numbers, amounts, attachments) get column names inferred from
their content. A row with only an order number and amount continues the closing above it. A closing that names an order
is placed in that order's week; other closings use their own date. Rows from other weeks are left out and counted on
the success-story slide.
