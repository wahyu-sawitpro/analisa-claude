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
