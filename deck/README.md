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
1. Cover
2. Executive summary: KPIs, findings, bottom line
3. Success story: how CRM wins happened (channel, source) and the sales orders they became
4. Sales · what sold: GMV and units by product type (grouped from item names), GMV and orders by product category,
   basket size and common product pairs, price gaps on the same SKU
5. Sales · who bought and how: GMV and customers by region (regency/city, normalised) and province, order value by
   ordering channel and new vs repeat, sales PIC, unpaid amounts on partially paid orders, open orders, orders missing from the CRM
6. Rejection reasons last week: every reason (English, with the original CRM wording), split by status, a heat table against
   the two dimensions that best predict the reason (e.g. lead type, PIC), and notes on logging quality and location hot spots
7. What the reasons mean: reasons grouped by the fix they need, plus signals read from the discussion notes
8. What separates winners: the dimension that best separates orders from the rest, cohort profile, confounding caveat
9. Recoverable demand: leads still in play and what they are asking
10. Next steps: up to six actions with owner and timing
11. Thank you

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
- 10 of 19 orders (Rp390M) have no CRM engagement, and CRM wins carry no GMV.

## Plantation (28 Sep – 2 Oct 2026)
- Rp53.1M from 4 orders (7% of combined GMV). Seeds are 77% of GMV from a single 40-pack Topaz order.
- All 3 CRM wins are confirmed in sales (Rp43.2M): one by phone, one by name and PIC, one by value and date.
  All 3 are still marked "Prospek" in the CRM although the notes say closing.
- 2 leaf and soil test (Dokter Sawit) customers are the obvious follow-up for fertilizer orders.
- The plantation sales export has no region or customer-status columns, and the seed line has no product category.
