name: AM Report Smallholder (build deck)

on:
  schedule:
    - cron: "0 9 * * 1"    # Monday 09:00 UTC = 16:00 WIB; Apps Script pulls it at 17:00 WIB
  workflow_dispatch:       # bisa juga dijalankan manual dari tab Actions

permissions:
  contents: read

jobs:
  report:
    runs-on: ubuntu-latest
    env:
      TZ: Asia/Jakarta
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install -r reporting/requirements.txt

      - name: Check input files
        run: |
          for f in "CRM Smallholder.csv" "Sales Smallholder.csv" "deck slide.pptx"; do
            if [ ! -f "$f" ]; then
              echo "::error::File '$f' tidak ditemukan di repo. Upload export terbaru dulu."
              exit 1
            fi
          done

      - name: Build deck
        id: build
        run: |
          python reporting/am_report.py --data-dir . --template "deck slide.pptx" --out "output/report.pptx" | tee build.log
          WEEK=$(grep -oP 'iso_week: \K[0-9]+' build.log)
          echo "title=AM Report Smallholder – W${WEEK} $(date +%Y) (generated $(date +%Y-%m-%d))" >> "$GITHUB_OUTPUT"

      - name: Keep pptx as artifact
        uses: actions/upload-artifact@v4
        with:
          name: am-report-pptx
          path: output/report.pptx
          retention-days: 14
