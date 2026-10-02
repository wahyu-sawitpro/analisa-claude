# SawitPRO Lead Rejection Deck

A concise, 7-slide English analysis deck in the SawitPRO template. The deck is an HTML page that rebuilds itself from any
uploaded CSV, TSV, XLSX, XLS, ODS or JSON file. Parsing happens in the browser; data is not sent anywhere.

| Button | What it does |
|---|---|
| Upload files | Adds one or many files at once (or drag and drop). Each file, and each lead-like sheet in a workbook, becomes a data source; all sources are merged into one analysis. Toggle or remove sources in the bar under the toolbar |
| Present | Full-screen slide mode (arrow keys, Esc) |
| Download PPTX | Builds a native, editable 16:9 PowerPoint (real charts and tables) from the current data |
| Open in Google Slides | Uploads the PPTX to the viewer's Google Drive through the Google Drive connector, which converts it to Google Slides, then links to it. Falls back to manual import steps when Drive isn't available |

## Multiple files
- Columns are detected per file, so files can use different header names (e.g. `Status Leads` vs `Status`).
- Rows are merged; a lead ID that appears in more than one file is counted once (the latest source wins).
- Workbook sheets without lead columns (e.g. a notes sheet) are skipped.
- With more than one source, an extra **Across data sources** slide compares leads, rejection rate, leads in play, value and period per source, and "Data source" is tested as an outcome driver.
- With one file the deck is the same 7 slides.

## Slides
1. Cover
2. Executive summary: KPIs, key findings, bottom line
3. What drives the outcome: best-separating dimension (Gini gain) and a rejected vs. in-play cohort profile, with a confounding check
4. Why leads say no: translated reasons by status, reason-quality score, proposed reason taxonomy
5. Pipeline at stake: value, average value, closing-date coverage, and the leads still in play
6. Next steps: owner and timing for each action, plus data gaps
7. Thank you

## Files
- `index.html`: built deck, ready to open
- `src/deck.html`: page, analysis and HTML slides (images written as `{{IMG:name}}`)
- `src/export-pptx.js`: PPTX builder (pptxgenjs) and Google Drive upload, inlined at build time
- `src/sample-data.json`: sample dataset with lead names and phone numbers removed
- `assets/`: compressed images taken from the template
- `build.py`: run `python3 deck/build.py` to regenerate `index.html`

## Findings on the sample (21–25 Sep 2026, 34 leads)
- 88% (30) not interested; 4 leads are still in play, worth Rp9.99M.
- Engagement channel fully separates outcomes: WhatsApp chat 0/30 progressed, on-site visits and phone calls 4/4.
- The effect is confounded. All 30 rejections share one PIC, product line (KebunPRO), location and lead source, and were
  logged over 3 days, so this reads as one failed campaign. A controlled re-contact test is needed to isolate the channel.
- 100% of rejections use the catch-all reason "No clear interest yet". There is no diagnostic signal.
- All in-play leads cite timing ("no need in the near term"), and none have a closing date.
- 88% of rows have no potential-sales value or product, so lost value can't be sized.
