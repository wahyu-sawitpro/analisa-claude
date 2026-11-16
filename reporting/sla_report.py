"""
B2C Smallholder — Delivery SLA Failure (Aging) Report + Lessons Learned (output in English)

SLA: an order must be DELIVERED within 14 days of sale_order_date AND be fully PAID.
Any order still not delivered after 14 days is an SLA failure.

Reads:
  - pending and aging more than 14 days from smallholder team customer.csv  (required)
      sale_order_date, item, customer_ref, product_category, customer_name, pic_names,
      full_payment_date, invoice_status, sale_order_status, sales, odoo_delivery_status,
      delivery_scheduled_at, Aging
  - Sales Smallholder.csv  (optional; order -> customer phone / status / city)
  - CRM Smallholder.csv    (optional; PIC contacts with the customer while the order was pending)

Produces (same pattern as the AM / LTV report):
  - Deck .pptx based on "deck slide.pptx"
  - Workbook .xlsx (orders + findings, lessons learned, per PIC, assumptions)

Root cause per order (who owns the breach):
  Payment not complete                         -> Sales PIC (collection)
  Late payment (paid after the SLA deadline)   -> Sales PIC (collection)
  Slow payment + fulfilment delay              -> Sales PIC + Ops
  Fulfilment delay (paid on time, not shipped) -> Ops / Logistics

Usage:
  python reporting/sla_report.py --data-dir . --template "deck slide.pptx" \
      --out output/sla_report.pptx --xlsx output/sla_report.xlsx [--today 2026-11-18]
"""
from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

import pandas as pd

from am_report import (
    GREEN, IN, MUTED, MX, ORANGE, RED, TOP, TPL_CLOSING, TPL_COVER, TZ,
    Deck, d_id, fmt_idr, fmt_int, header, kpi_tile, norm_phone, paged_table, table, text, to_num,
)

# ---------------------------------------------------------------- parameters
SLA_DAYS = 14            # delivery SLA in days from order date
PAY_DAYS = 3             # target: fully paid within N days of order
DISPATCH_DAYS = 3        # target: dispatched within N days after full payment
BUFFER_DAY = 10          # schedule delivery no later than this day to keep a buffer
DELIVERED = {"done", "delivered", "completed", "received"}

AGING_FILE = "pending and aging more than 14 days from smallholder team customer.csv"
SALES_FILE = "Sales Smallholder.csv"
CRM_FILE = "CRM Smallholder.csv"


# ================================================================ data
def _date(s: pd.Series) -> pd.Series:
    """'12/10/2026' or '26/10/2026, 16:22' (day first) -> datetime64 at 00:00."""
    return pd.to_datetime(s.astype(str).str.split(",").str[0].str.strip(),
                          dayfirst=True, errors="coerce").dt.normalize()


def load_orders(path: Path) -> pd.DataFrame:
    d = pd.read_csv(path, dtype=str, encoding="utf-8-sig").fillna("")
    d.columns = [c.strip().lower() for c in d.columns]
    d["order_date"] = _date(d["sale_order_date"])
    d["paid_date"] = _date(d["full_payment_date"])
    d["sched_date"] = _date(d["delivery_scheduled_at"])
    d["sales_idr"] = to_num(d["sales"])
    d["ref"] = d["customer_ref"].str.strip()
    d["inv"] = d["invoice_status"].str.strip().str.upper()
    d["so"] = d["sale_order_status"].str.strip().str.upper()
    d["delivery"] = d["odoo_delivery_status"].str.strip().str.lower()
    d["pic"] = d["pic_names"].str.strip().replace("", "(no PIC)")
    return d[d["order_date"].notna()].copy()


def load_context(data_dir: Path) -> tuple[pd.DataFrame | None, pd.DataFrame | None]:
    sales = crm = None
    p = data_dir / SALES_FILE
    if p.exists():
        s = pd.read_csv(p, dtype=str, encoding="utf-8-sig").fillna("")
        s = s.rename(columns={"main_order_no": "ref"})
        sales = (s.groupby("ref").agg(phone=("customer_phone", "first"), cust_status=("customer_status", "first"),
                                      city=("city", "first"), province=("province", "first"))
                 .reset_index())
        sales["phone"] = sales["phone"].map(norm_phone)
    p = data_dir / CRM_FILE
    if p.exists():
        c = pd.read_csv(p, dtype=str, encoding="utf-8-sig").fillna("")
        c.columns = [x.strip().lstrip("﻿") for x in c.columns]
        crm = pd.DataFrame({
            "phone": c.get("cleaned phone", c.get("Phone No (08xx)", "")).map(norm_phone),
            "date": pd.to_datetime(c["Tanggal"], errors="coerce").dt.normalize(),
            "by": c.get("Smallholders Team", ""),
            "type": c.get("Engagement Type", ""),
            "note": c.get("Detail Pembahasan", ""),
        }).dropna(subset=["date"])
    return sales, crm


# ================================================================ analysis
def analyse(d: pd.DataFrame, today: dt.date, sales, crm) -> pd.DataFrame:
    t = pd.Timestamp(today)
    d = d.copy()
    d["delivered"] = d["delivery"].isin(DELIVERED)
    d["aging"] = (t - d["order_date"]).dt.days
    d["deadline"] = d["order_date"] + pd.Timedelta(days=SLA_DAYS)
    d["days_late"] = d["aging"] - SLA_DAYS
    d["is_paid"] = (d["inv"] == "PAID") & d["paid_date"].notna()
    d["days_to_pay"] = (d["paid_date"] - d["order_date"]).dt.days.where(d["is_paid"])
    d["days_since_paid"] = (t - d["paid_date"]).dt.days.where(d["is_paid"])
    d = d[~d["delivered"] & (d["aging"] > SLA_DAYS)].copy()

    if sales is not None and len(d):
        d = d.merge(sales, on="ref", how="left")
    for c in ("phone", "cust_status", "city", "province"):
        if c not in d:
            d[c] = ""
    d = d.fillna({"phone": "", "cust_status": "", "city": "", "province": ""})

    rc, owner, flags, crm_txt = [], [], [], []
    for _, r in d.iterrows():
        if not r["is_paid"]:
            rc.append("Payment not complete"); owner.append("Sales PIC (collection)")
        elif r["days_to_pay"] > SLA_DAYS:
            rc.append("Late payment — paid after SLA deadline"); owner.append("Sales PIC (collection)")
        elif r["days_to_pay"] > PAY_DAYS:
            rc.append("Slow payment + fulfilment delay"); owner.append("Sales PIC + Ops / Logistics")
        else:
            rc.append("Fulfilment delay — paid on time, not shipped"); owner.append("Ops / Logistics")

        f = []
        if r["is_paid"] and r["days_since_paid"] > DISPATCH_DAYS:
            f.append(f"Paid {int(r['days_since_paid'])}d ago, still not dispatched")
        if r["is_paid"] and r["so"] == "NEW":
            f.append("SO still NEW after full payment (not confirmed in Odoo)")
        if pd.notna(r["sched_date"]) and pd.notna(r["paid_date"]) and r["sched_date"] < r["paid_date"]:
            f.append("Delivery scheduled before payment was complete")
        if pd.notna(r["sched_date"]):
            sday = (r["sched_date"] - r["order_date"]).days
            if sday > SLA_DAYS:
                f.append(f"Delivery scheduled on day {sday} — after the SLA deadline")
            elif sday > BUFFER_DAY:
                f.append(f"Delivery scheduled on day {sday} — no buffer before day {SLA_DAYS}")
            if r["sched_date"] < pd.Timestamp(today):
                f.append(f"Missed scheduled date by {(pd.Timestamp(today) - r['sched_date']).days}d, no new date")
        else:
            f.append("No delivery schedule set")
        if r["days_late"] >= SLA_DAYS:
            f.append(f"Critical: {int(r['days_late'])}d beyond SLA")
        if r["cust_status"] == "repeat customer":
            f.append("Repeat customer — churn risk")
        flags.append(f)

        txt = ""
        if crm is not None and r["phone"]:
            hits = crm[(crm["phone"] == r["phone"]) & (crm["date"] > r["order_date"])].sort_values("date")
            if len(hits):
                last = hits.iloc[-1]
                txt = (f"{len(hits)} CRM contact(s) since order, last {d_id(last['date'].date())} "
                       f"by {last['by']} ({last['type']}): \"{str(last['note'])[:70]}\"")
                f.append("PIC contacted customer while order pending — no delivery escalation logged")
        crm_txt.append(txt)

    d["root_cause"], d["owner"], d["flags"], d["crm_contact"] = rc, owner, flags, crm_txt
    return d.sort_values("aging", ascending=False).reset_index(drop=True)


def lessons(d: pd.DataFrame) -> list[tuple[str, str]]:
    """Rule-based lessons learned + actions derived from the failed orders."""
    n = len(d)
    if not n:
        return []
    L = []

    def has(key):
        m = d["flags"].map(lambda fs: any(key in f for f in fs))
        return int(m.sum()), ", ".join(d.loc[m, "ref"])

    def rc(key):
        m = d["root_cause"].str.contains(key, case=False)
        return int(m.sum()), ", ".join(d.loc[m, "ref"])

    k, refs = rc("^Fulfilment")
    if k:
        L.append((f"{k}/{n} order(s) were fully paid on time but never shipped — the breach is internal (Ops), not the customer.",
                  f"Any PAID order not dispatched within {DISPATCH_DAYS} days escalates to the Ops lead. Owner: Ops. ({refs})"))
    k, refs = rc("payment")
    if k:
        L.append((f"{k}/{n} order(s) breached because full payment came late — the SLA clock ran out on collection.",
                  f"PIC payment reminders on D+1 / D+3 / D+7; orders unpaid at D+7 are re-dated or cancelled so the SLA "
                  f"measures Ops, not customer payment behaviour. Owner: Sales PIC. ({refs})"))
    k, _ = has("SO still NEW")
    if k:
        L.append((f"{k}/{n} order(s) are PAID but the Sale Order is still NEW — payment did not move the order to the warehouse.",
                  "Auto-confirm the SO when the invoice becomes PAID (Odoo automation), or a daily 'PAID & SO = NEW' check sent to Ops. Owner: Ops / Product."))
    k, _ = has("scheduled before payment")
    if k:
        L.append((f"{k}/{n} delivery schedule(s) were set before payment was complete and never re-planned after payment.",
                  f"Schedule delivery only after PAID; when payment lands, re-schedule within {DISPATCH_DAYS} days. Owner: Ops."))
    k, _ = has("Delivery scheduled on day")
    if k:
        L.append((f"{k}/{n} order(s) were scheduled after day {BUFFER_DAY} — any slip guarantees a breach.",
                  f"Planning rule: schedule delivery by day 7–{BUFFER_DAY} after order. Owner: Ops."))
    k, _ = has("Missed scheduled date")
    if k:
        L.append((f"{k}/{n} order(s) passed their scheduled date with no update — nobody owned the miss.",
                  "When a scheduled date passes without delivery, Ops logs a reason + new date within 24h. Owner: Ops."))
    k, _ = has("no delivery escalation")
    if k:
        L.append((f"{k}/{n} customer(s) were contacted by the PIC while the order was pending, but no delivery escalation was logged.",
                  "On every visit / call, the PIC checks open orders > 7 days and records the delivery status in CRM. Owner: Sales PIC."))
    k, refs = has("Critical")
    if k:
        L.append((f"{k}/{n} order(s) are ≥ {SLA_DAYS} days beyond SLA — high risk of refund / churn.",
                  f"PIC calls the customer this week with a firm delivery date; goodwill (free shipping / voucher) for repeat buyers. ({refs})"))
    by = d.groupby("pic").size().sort_values(ascending=False)
    L.append(("Breaches by PIC: " + ", ".join(f"{p} ({c})" for p, c in by.items()) + ".",
              "Review every open order > 7 days in the weekly Smallholder sync."))
    return L


# ================================================================ output
def _d(x) -> str:
    return d_id(x.date()) if pd.notna(x) else "–"


def build(data_dir: Path, template: Path, out: Path, xlsx: Path | None, today: dt.date):
    raw = load_orders(data_dir / AGING_FILE)
    sales, crm = load_context(data_dir)
    d = analyse(raw, today, sales, crm)
    L = lessons(d)

    deck = Deck(template)
    W = deck.W
    rc_col = {"Fulfilment": RED, "Late payment": ORANGE, "Slow payment": ORANGE, "Payment not": ORANGE}

    def rc_color(s):
        return next((c for k, c in rc_col.items() if s.startswith(k)), MUTED)

    # ---------------------------------------------------------- 1. cover
    s = deck.new(TPL_COVER)
    for shp in list(s.shapes):
        if shp.has_text_frame and shp.text_frame.text.strip():
            shp._element.getparent().remove(shp._element)
    text(s, int(0.45 * IN), int(0.95 * IN), int(7 * IN), int(0.9 * IN),
         "Delivery SLA Failures (Aging > 14 days)\nB2C Smallholder", size=26, bold=True)
    text(s, int(0.45 * IN), int(2.0 * IN), int(7 * IN), int(0.3 * IN),
         f"SLA: delivered ≤ {SLA_DAYS} days after order & fully paid  •  {fmt_int(len(d))} order(s) failing  •  {d_id(today)}",
         size=12, bold=True, color=GREEN)
    text(s, int(0.45 * IN), int(2.3 * IN), int(7 * IN), int(0.3 * IN),
         f"Source: {AGING_FILE}  •  Auto-generated {d_id(today)}", size=9, color=MUTED)

    # ---------------------------------------------------------- 2. summary
    s = deck.new()
    header(deck, s, "Summary — Orders Failing the Delivery SLA",
           f"Aging counted from order date to {d_id(today)}  •  only orders not yet delivered")
    gap = int(0.2 * IN)
    tw = (W - 2 * MX - 3 * gap) // 4
    y = TOP + int(0.72 * IN)
    tiles = [("Orders failing SLA", fmt_int(len(d))),
             ("Sales value held", fmt_idr(d["sales_idr"].sum()).replace("IDR ", "IDR ")),
             ("Average aging", f"{d['aging'].mean():.0f} days" if len(d) else "–"),
             ("Oldest order", f"{int(d['aging'].max())} days" if len(d) else "–")]
    for i, (lab, val) in enumerate(tiles):
        kpi_tile(s, MX + i * (tw + gap), y, tw, int(0.85 * IN), lab, val)
    y2 = y + int(1.05 * IN)
    half = (W - 2 * MX - gap) // 2
    if len(d):
        g = d.groupby(["root_cause", "owner"]).agg(n=("ref", "size"), v=("sales_idr", "sum")).reset_index()
        text(s, MX, y2, half, int(0.22 * IN), "By root cause (who owns the breach)", size=10, bold=True, color=GREEN)
        table(s, MX, y2 + int(0.26 * IN), half, ["Root cause", "Owner", "#", "Sales"],
              [[(r.root_cause, rc_color(r.root_cause)), r.owner, fmt_int(r.n), fmt_idr(r.v)] for r in g.itertuples()],
              [3.2, 2.2, 0.9, 1.3], left_cols=(1,))
        p = d.groupby("pic").agg(n=("ref", "size"), v=("sales_idr", "sum"), a=("aging", "max")).reset_index()
        text(s, MX + half + gap, y2, half, int(0.22 * IN), "By PIC", size=10, bold=True, color=GREEN)
        table(s, MX + half + gap, y2 + int(0.26 * IN), half, ["PIC", "Orders", "Sales", "Oldest (d)"],
              [[r.pic, fmt_int(r.n), fmt_idr(r.v), fmt_int(r.a)] for r in p.itertuples()], [2.6, 0.8, 1.3, 1.0])
    else:
        text(s, MX, y2, W - 2 * MX, int(0.4 * IN), "No order is breaching the delivery SLA this week.",
             size=14, bold=True, color=GREEN)

    # ---------------------------------------------------------- 3. order detail
    rows = [[r.ref, r.customer_name, r.pic, r.item, fmt_idr(r.sales_idr), _d(r.order_date),
             f"{_d(r.paid_date)} (D+{int(r.days_to_pay)})" if r.is_paid else (r.inv or "–", RED),
             _d(r.sched_date), fmt_int(r.aging), (f"+{int(r.days_late)}", RED),
             (r.root_cause, rc_color(r.root_cause))] for r in d.itertuples()]
    paged_table(deck, "Orders Failing SLA — Detail", f"Sorted by aging  •  SLA deadline = order date + {SLA_DAYS} days",
                ["Order", "Customer", "PIC", "Item", "Sales", "Order date", "Fully paid", "Scheduled", "Aging",
                 "Late", "Root cause"], rows, [1.25, 1.5, 1.5, 2.0, 1.0, 1.0, 1.3, 1.0, 0.75, 0.6, 2.3],
                left_cols=(1, 2, 3, 10), font=7, empty_row=["–"] + [""] * 10)

    # ---------------------------------------------------------- 4. findings per order
    # table() styles only the first paragraph of a cell -> keep every cell on one paragraph
    rows = [[r.ref, f"{r.customer_name} — {r.owner}",
             "  •  ".join(r.flags + ([r.crm_contact] if r.crm_contact else []))]
            for r in d.itertuples()]
    paged_table(deck, "Why Each Order Failed — Process Findings", "Owner = team that must act; findings derived from the data",
                ["Order", "Customer / owner", "Findings"], rows, [1.1, 2.2, 8.0], left_cols=(1, 2), font=7, per_page=6,
                empty_row=["–", "", ""])

    # ---------------------------------------------------------- 5. lessons learned
    rows = [[str(i + 1), les, act] for i, (les, act) in enumerate(L)]
    paged_table(deck, "Lessons Learned & Actions", "Generated from the findings above — review in the weekly Smallholder sync",
                ["#", "Lesson learned", "Action / owner"], rows, [0.3, 5.0, 5.0], left_cols=(1, 2), font=8, per_page=10,
                empty_row=["–", "No SLA failures — nothing to learn this week.", ""])

    deck.new(TPL_CLOSING)
    deck.finalize(out)
    if xlsx:
        write_xlsx(xlsx, d, L, today)
    return dict(failing=len(d), sales_held=float(d["sales_idr"].sum()), lessons=len(L))


def write_xlsx(path: Path, d: pd.DataFrame, L, today: dt.date):
    from openpyxl.styles import Alignment
    path.parent.mkdir(parents=True, exist_ok=True)
    orders = pd.DataFrame({
        "Order": d["ref"], "Customer": d["customer_name"], "Customer status": d["cust_status"],
        "City": d["city"], "PIC": d["pic"], "Item": d["item"], "Category": d["product_category"],
        "Sales (IDR)": d["sales_idr"], "Order date": d["order_date"].dt.date,
        "SLA deadline": d["deadline"].dt.date, "Invoice status": d["inv"],
        "Full payment date": d["paid_date"].dt.date, "Days to pay": d["days_to_pay"],
        "Days since paid": d["days_since_paid"], "SO status": d["so"], "Delivery status": d["delivery"],
        "Scheduled": d["sched_date"].dt.date, "Aging (days)": d["aging"], "Days late": d["days_late"],
        "Root cause": d["root_cause"], "Owner": d["owner"], "Findings": d["flags"].map("\n".join),
        "CRM contact while pending": d["crm_contact"],
    })
    by_pic = (d.groupby("pic").agg(Orders=("ref", "size"), **{"Sales (IDR)": ("sales_idr", "sum")},
                                   **{"Avg aging": ("aging", "mean")}, **{"Oldest aging": ("aging", "max")})
              .reset_index().rename(columns={"pic": "PIC"}).round({"Avg aging": 1}))
    sheets = {
        "Orders failing SLA": orders,
        "Lessons learned": pd.DataFrame([(i + 1, a, b) for i, (a, b) in enumerate(L)],
                                        columns=["#", "Lesson learned", "Action / owner"]),
        "Per PIC": by_pic,
        "Assumptions": pd.DataFrame([
            ("Report date", d_id(today)),
            ("Delivery SLA (days from order)", SLA_DAYS),
            ("Target: fully paid within (days)", PAY_DAYS),
            ("Target: dispatched after payment within (days)", DISPATCH_DAYS),
            ("Schedule delivery no later than day", BUFFER_DAY),
            ("Delivered statuses", ", ".join(sorted(DELIVERED))),
        ], columns=["Parameter", "Value"]),
    }
    wide = {"Findings": 70, "Lesson learned": 80, "Action / owner": 80, "CRM contact while pending": 60}
    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        for name, df in sheets.items():
            df.to_excel(xw, sheet_name=name, index=False)
            ws = xw.sheets[name]
            ws.freeze_panes = "A2"
            for i, col in enumerate(df.columns, start=1):
                letter = ws.cell(1, i).column_letter
                width = max([len(str(col))] + [len(str(v)) for v in df[col].head(200)]) + 2
                ws.column_dimensions[letter].width = wide.get(col, min(width, 40))
                for c in ws.iter_cols(min_col=i, max_col=i, min_row=2):
                    for cell in c:
                        if col in wide:
                            cell.alignment = Alignment(wrap_text=True, vertical="top")
                        elif "IDR" in str(col):
                            cell.number_format = "#,##0"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=".")
    ap.add_argument("--template", default="deck slide.pptx")
    ap.add_argument("--out", default="output/sla_report.pptx")
    ap.add_argument("--xlsx", default=None, help="default: same name as --out with .xlsx")
    ap.add_argument("--no-xlsx", action="store_true", help="build the deck only")
    ap.add_argument("--today", default=None, help="YYYY-MM-DD (default: today WIB)")
    a = ap.parse_args()
    today = dt.date.fromisoformat(a.today) if a.today else dt.datetime.now(TZ).date()
    out = Path(a.out)
    xlsx = None if a.no_xlsx else (Path(a.xlsx) if a.xlsx else out.with_suffix(".xlsx"))
    info = build(Path(a.data_dir), Path(a.template), out, xlsx, today)
    print(f"OK -> {out}" + (f"\n      {xlsx}" if xlsx else ""))
    for k, v in info.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
