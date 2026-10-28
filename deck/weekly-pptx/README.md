# Weekly review on the SawitPRO 2026 template

Builds the weekly sales review as a PPTX on `deck slide.pptx` (SawitPRO new theme 2026): the template cover and
"Terima Kasih" slides are kept, the reference slides are dropped, and content slides use its title layout.

    python3 build_deck.py "deck slide.pptx" <folder with the six CSV exports> out.pptx

Inputs: Smallholder and Plantation sales (last two weeks), and the rejection-reason and success-story CRM exports
for both teams. The CSVs are not committed.

- Success stories are checked against the sales export (phone, then product; Plantation also lead name and region).
  A story with no order is noted "Team put on CRM however sales not reflected yet"; orders with no engagement are
  listed as "In sales, not in the CRM". Notes are never quoted.
- Rejection reasons: TikTok live viewers (no phone) and customers asking about an order are separated from real
  leads; each real lead's barrier is read from the reason field, then the notes (`barrier.py`). Potential GMV is shown
  only where logged; otherwise the need is shown as stated (sacks, kg, tonnes, seeds). Nothing is estimated.
- `NEED` and `PL_STORY` in `build_deck.py` hold the per-lead needs and Plantation matches checked by hand for the
  week of 19-25 Oct 2026; update them for a new week.
