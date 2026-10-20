# SawitPRO Deck (Smallholder + Plantation)

The page title, the cover and the PPTX file name follow what was analysed (e.g. "SawitPRO Deck · Farmer Acquisition").
One deck page for every analysis request: sales reviews, lead acquisition (CRM), stock forecasting and more. The
slides follow the files you upload: sales exports give the sales review, CRM exports the acquisition slides, and a
sales history with a price list adds the stock forecast. A farmer acquisition export (e.g. `farmer akusisi.csv`) makes it a
farmer acquisition review (Duta vs non-Duta).

An English deck in the SawitPRO template that turns weekly CRM and sales exports into a short, insight-led review.
It is an HTML page: upload any number of files, check the detected data type of each one, then click **Analyze**.
Parsing and analysis happen in the browser; data is not sent anywhere.

| Control | What it does |
|---|---|
| Upload files | Replaces the deck's data with one or many CSV, TSV, XLSX, XLS, ODS or JSON files (or drag and drop) and rebuilds the deck from them straight away. **+ Add files** in the data sources bar adds files to the current set instead |
| Data sources bar | Each file or lead-like sheet, with its row count, an include toggle, a data-type selector (CRM / Sales, auto-detected) and remove |
| Analyze | Rebuilds the deck after you change a data type, team, include toggle or the monthly target |
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

## DO pipeline (CRM DO export)
A CRM export of DO (FFB supplier) leads, with `DO Name`, `Potensial FFB (Ton)` and `Mills terdekat` columns, is read as
**DO pipeline** and sets the deck. Slides: where the leads stand (status HOT / WARM / COLD with potential FFB, progress
stage with area), who and where (PIC, regency, nearest mill, lead source, customer type, FFB by PIC), and the lead list
with each lead's age and missing fields. Owner names, DO names and phone numbers are never shown. When the lead IDs run
far past the number of rows (e.g. DOOP-022 in a 1-row file) the deck flags the export as partial.

Findings for `CRM DO smallholder status.csv` (18 Oct 2026, the sample): 1 lead (DOOP-022, Sazali Wandana, Asahan,
Gapoktan / Kelompok Tani via canvassing), 50 ha and 200 t potential FFB near PGS, COLD at first outreach for 13 days;
distance to mill, current buyer, detail and closing date are empty.

## Farmer acquisition (Duta vs non-Duta)
When the export also has `user_role`, `jumlah_farm`, `total_area_hectare`, `province` and `regency` (e.g. `Farmer register for
weekly farmer.csv`) three slides are added: farmers vs estate owners (estate owner = the ESTATE_OWNER role; every other role, farmer & agent
included, is a farmer; who added a farm; median farm size), where users are (province and regency of the first farm), and users
above 100 ha (one slide per week, with each user's name and contact: phone, else email; one row per farm from `detail_hectare` and `location`, with a note that
hectares are as entered by the user and not yet validated). Farm names are not shown. In the committed sample, names, phones and emails are hashed. All
wording follows the direction of the change (rise or drop).

Findings for 12–18 Oct 2026 (sample): 600 farmers, +223 (+59%) on 5–11 Oct, the highest week in the file; 0 under a Duta
(4 the week before); 0 estate owners; 34% added a farm (205), median 2 ha; Riau 53, Kalimantan
13 → 64; 11 users above 100 ha (4 the week before), 2 report 5,000 ha or more; Organic +203 (direct 48 → 153, organic
46 → 126) explains 91% of the rise; 184 registrations on Wed 14 Oct.

A file with `akuisisi_type` / `minggu_register` / `join_date_farmer` columns is read as **Acquisition** and sets the whole
deck (other files are left out). Last week = the latest full registration week; a week still in progress (its data stops
before the Sunday, e.g. the week of 12 Oct with data to 14 Oct) is left out and the slide says so. Slides:
- **Duta vs non-Duta:** last week vs the week before (count, change, change %, share). Internal-team Dutas
  (`is_test_duta` = 1) and external Dutas are both Duta; the farmers-by-Duta table shows each Duta's user name without
  "Test", type, last week, the week before and all weeks. Slides use plain labels, not raw field names.
- **What moved the total:** waterfall by channel (`utm_source`) and the largest campaign moves (`utm_source_name`, non-Duta).
- **Weekly trend:** farmers per week by channel, and farmers per day last week vs the week before.
- **Channels in detail:** channel table with the 4-week average, campaign table, farmers without a phone number.

Findings for the week of 5–11 Oct 2026 (sample): 376 farmers, −103 (−22%) on 28 Sep – 4 Oct; non-Duta 372 (−99), under
Duta 4 (−4) from 3 internal-team Dutas (Rudi 2, Satria K 1, Sazali Wandana 1); 7 of the 8 Dutas with farmers in 7 weeks
are internal team. Organic −95 explains 92%
of the drop ("organic" campaign 111 → 47); GADN +10 and App-Register-Campaign-DG +36 grew. 28% of farmers have no phone.

## Stock forecast (sales history + price list)
The plan runs from the day after the last sale to **Plan until** (default 31 Dec of that year; a date field next to the
monthly target changes it). Part months are pro rata by day, and the plan is broken down by week (Monday to Sunday):
weekly stock plan (target, MT, bags, largest SKUs), weekly plan by SKU (MT per week), stock by area per week, and the
plan by month and area. Exports without order numbers count each line as one order line; without a shipping column
the footer says "Sales amount".

Findings for `smallholder sales ytd.csv` (full export, all categories; only items sold by the kg are forecast) + `list pricing.csv`
(sample, data to 18 Oct 2026, target Rp4B a month): 1,442 MT from 19 Oct to 31 Dec, about 136 MT a week (250 MT 19–31 Oct,
596 MT Nov, 596 MT Dec); Riau 81%, Sumatera Utara 16%, Sumatera Selatan 3%. SKUs are ranked by number of orders (top 12 on
the slide, all 26 in `output/forecast_weekly_by_sku_19Oct-31Dec.csv`): KCL Canada Cap Mahkota 178 orders, RP Mahkota Egypt 70,
Urea Nitrea 44, KCL Sasco 40.

Upload a sales history (e.g. `history sales Jan - Oct 2026 per 14 Oct.csv`) together with a price list (e.g.
`Price per 14 Oct 2026.csv`, detected as **Price list**; a title row above the headers is skipped). A **Monthly target
(Rp)** field appears in the data sources bar (Rp4B by default). With a price list the deck is a forecast deck: cover,
forecast executive summary, the slides below, forecast next steps and closing (no sales review or CRM slides):
- **Forecast · RpX a month**: GMV by month against the target, fertilizer tonnes by month with the plan, orders a
  month the target needs, method, price moves and data notes.
- **Forecast · stock plan by month and area**: Month | Area (province) | Stock required (MT, top 3 SKUs) | Target
  sales (IDR) | Description, for the 3 months after the data ends.
- **Forecast · stock plan by SKU**: MT per SKU and month, bags, average price per bag and main areas.

Method: only items sold by the kg; the target is split by each area's share of fertilizer GMV (Riau, Sumatera Utara,
Sumatera Selatan incl. Lampung, Jambi, Bengkulu), reduced by the non-fertilizer and shipping shares, and turned into kg
at today's price for each SKU and price tier (product_cat Pupuk = Reguler, Pupuk Grosir = Grosir, Toling = Toko
Keliling, Khusus Petani). The SKU mix comes from the same month last season when the history has it (Jan uses Jan–Feb),
else the last 4 months. Lines with no province take the customer's province from other orders, else the PIC's.
A long history is reviewed on its last 3 full months in the trend slides.

Findings for Rp4B a month (history to 13 Oct 2026, prices of 14 Oct): Nov 600 MT, Dec 600 MT, Jan 469 MT
(Riau 474 / 474 / 389, Sumatera Utara 112 / 112 / 63, Sumatera Selatan 15 / 15 / 17). Largest lines: KCL Canada Cap
Mahkota 447 MT and RP Mahkota Egypt 364 MT over 3 months. The best month so far is 394 t (Sep), so the plan is about
1.4–1.5× that; at the Jul–Oct average order (Rp27.8M) Rp4B needs about 138 fertilizer orders a month against 73 now.

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
- `src/sample-data.json`: `Farmer register for weekly farmer.csv` (farmer names and phones hashed; Duta user names kept). Earlier samples: `smallholder sales ytd.csv` + `list pricing.csv` (forecast; customer names, phones and IDs hashed). Earlier samples: the six weekly exports for 12–18 Oct (sales and CRM, both teams, anonymised, on branch `claude/deck-slide-data-upload-c45lkx`), `CRM DO smallholder status.csv` and `farmer akusisi.csv` (names and phones replaced by tokens; Duta user names kept)
- `output/`: built PPTX files for the forecast, acquisition, DO pipeline and Jul–Sep reviews, `audit.csv` and `DECISIONS.md`
- `build.py`: run `python3 deck/build.py` to regenerate `index.html`

## Reading the CRM honestly
- **What a “win” is.** Rows marked as ordered are split into leads that were worked, sales logged at checkout (mobile
  shop or walk-in: “toko keliling”, “beli pupuk …”) and after-sales calls on orders already placed. Only worked leads
  count in the funnel, the PIC conversion note and “what separates winners”.
- **Order follow-ups.** Engagements where the customer asks about an existing order (“Menanyakan Status Pesanan”) are
  taken out of the rejection reasons and shown on a customer-service slide with the orders named, the issue read from
  the notes (past SLA, queue, delivery, documents, damaged goods) and first purchases.
- **Templated logging.** A PIC whose engagements all share one status, one reason and one location (or exactly the
  same count every day) with no notes is flagged; those rows are left out of the driver analysis and the call-back
  list, and the rejection slide says the real reasons are unknown.
- **Potential loss.** Leads who didn't order are valued from what they said they needed: the potential GMV logged in
  the CRM, a rupiah amount in the notes, sacks or tonnes in the notes, or the fertilizer need in kg, priced at this
  week's selling price per product (50 kg sacks). Leads who ordered this week (by phone) are left out. The value is
  grouped by reason, with stock-outs, slow delivery, price and payment terms marked as on our side, and shown on a
  “Rejection reasons · potential loss” slide with the biggest leads at stake and any competitor price in the notes.
- **Overdue prospects.** Prospects whose estimated closing date has passed by the end of the week become an action.

## Findings for the week of 12–18 Oct 2026 (sample data)
The sample is the six exports in the repo for this week: Smallholder and Plantation sales (last two weeks), and the
rejection-reason and success-story CRM exports for both teams.

Smallholder
- Rp376M from 25 orders, up 77% from Rp212M: more orders (11 → 25); KCL / MOP +Rp123M, NPK +Rp107M. The largest order
  (Rp110M, a group purchase of NPK and urea in Bungo) is 29% of GMV; without each week's largest order GMV is still +49%.
- 19 “wins” in the CRM, but 14 are mobile-shop sales logged at checkout and 3 are after-sales calls; only 2 came from
  working a lead. Of 62 reached leads that showed interest, 2 ordered. TikTok: 38 leads, 0 orders, mostly price questions.
- Potential loss: Rp277M of named demand from 8 leads didn't convert; Rp230M of it on our side. Payment terms Rp119M
  (3 leads asked to pay in instalments, incl. 10 t of NPK Pak Tani) and stock-outs Rp111M (NPK Mahkota 13-6-27 10 t,
  AC Powder AKP, KCL Sasco). Price is not the blocker: one lead paid Rp450k a sack of KCL Mahkota elsewhere vs our
  Rp419k. 72 of 80 leads have no quantity logged, and 3 leads in the not-ordered export ordered anyway (Rp145M).
- 10 engagements were customers chasing 8 orders; 6 mention the SLA or a queue (Topaz seeds 30–40 days).
- Joko Prestiwo and Muhammad Abdul Wahab closed 4 orders (Rp59.8M) with no CRM entry; Rp67.7M is still unpaid.

Plantation
- Rp39.1M from 5 orders, up 50% from Rp26M on bigger orders (rock phosphate Rp17.2M).
- 76 of 78 “not interested” entries are templated (Devi Mariana Naibaho, exactly 10 ads leads a day, and Naya
  Huwaidah): one status, one reason, one location and no notes, so the ads and event results can't be judged.
- The 2 real wins are leaf and soil tests from Khoirul Huda's field visits in Jambi; 2 prospects (drone mapping
  Rp9.6M, leaf test Rp3.2M) are past their closing date. Eko Prastyo's 2 orders (Rp15.5M) have no CRM entry.

## Findings for Jul–Sep 2026 (earlier sample: sales decline review)
That sample was the two Smallholder exports in the repo: sales Jul–Sep (371 order lines, 237 orders) and the CRM
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
