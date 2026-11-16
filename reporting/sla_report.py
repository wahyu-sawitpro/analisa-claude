"""
B2C Smallholder — Delivery SLA Failure (Aging) Report + Lessons Learned (output in English)

SLA: an order must be DELIVERED by sale_order_date + 14 days. Goods are shipped only once the
order is FULLY PAID, but the SLA always counts from the sale order date — late payment does not
move the deadline (order on the 1st -> deliver by the 15th, even if paid on the 10th).
Any order still not delivered after 14 days is an SLA failure.
All orders belong to PIC team Smallholder (rows of other teams are dropped when
Sales Smallholder.csv says so).

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

Payment status per order (context for the breach; the deadline never moves):
  Paid before deadline  -> paid by day 14 but not delivered by the deadline
  Paid after deadline   -> paid after day 14; still counted late from the order date
  Not fully paid        -> cannot ship yet; still counted late from the order date

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
PIC_TEAM = "Smallholder"  # every order in this report belongs to the Smallholder PIC team
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
        if "pic_team" not in s:
            s["pic_team"] = ""
        sales = (s.groupby("ref").agg(phone=("customer_phone", "first"), cust_status=("customer_status", "first"),
                                      city=("city", "first"), province=("province", "first"),
                                      pic_team=("pic_team", "first"))
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
    for c in ("phone", "cust_status", "city", "province", "pic_team"):
        if c not in d:
            d[c] = ""
    d = d.fillna({"phone": "", "cust_status": "", "city": "", "province": "", "pic_team": ""})
    # PIC team: every order belongs to Smallholder; drop rows another team owns (if the Sales file says so)
    d = d[d["pic_team"].str.strip().eq("") | d["pic_team"].str.lower().str.startswith("smallholder")].copy()
    d["pic_team"] = PIC_TEAM

    rc, stage, flags, crm_txt = [], [], [], []
    for _, r in d.iterrows():
        dl = d_id(r["deadline"].date())
        if not r["is_paid"]:
            rc.append(f"Not fully paid ({r['inv'] or 'unpaid'}) — not delivered by deadline {dl}")
            stage.append("Not fully paid")
        elif r["days_to_pay"] > SLA_DAYS:
            rc.append(f"Paid late (D+{int(r['days_to_pay'])}) — not delivered by deadline {dl}")
            stage.append("Paid after deadline")
        else:
            rc.append(f"Paid D+{int(r['days_to_pay'])} — not delivered by deadline {dl}")
            stage.append("Paid before deadline")

        f = []
        if r["is_paid"]:
            f.append(f"Fully paid on D+{int(r['days_to_pay'])}; SLA deadline stays {dl} (order date + {SLA_DAYS})")
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

    d["root_cause"], d["stage"], d["flags"], d["crm_contact"] = rc, stage, flags, crm_txt
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

    def st(name):
        m = d["stage"] == name
        return int(m.sum()), ", ".join(d.loc[m, "ref"])

    k, refs = st("Paid before deadline")
    if k:
        L.append((f"{k}/{n} order(s) were fully paid before the SLA deadline but still not delivered by order date + "
                  f"{SLA_DAYS} — payment was not the blocker.",
                  f"Once PAID, the Smallholder PIC books delivery on or before the SLA deadline; not dispatched within "
                  f"{DISPATCH_DAYS} days of payment -> escalate to the delivery lead. ({refs})"))
    k1, r1 = st("Paid after deadline")
    k2, r2 = st("Not fully paid")
    if k1 + k2:
        L.append((f"{k1 + k2}/{n} order(s) were paid after day {SLA_DAYS} or are still unpaid — the SLA still counts from "
                  "the sale order date, so late payment does not excuse the breach.",
                  f"Smallholder PIC reminds the customer on D+1 / D+3 / D+7 so the order is fully paid early enough to "
                  f"deliver by D+{SLA_DAYS}; unpaid at D+7 -> re-date or cancel the order. ({', '.join(x for x in (r1, r2) if x)})"))
    k, _ = has("SO still NEW")
    if k:
        L.append((f"{k}/{n} order(s) are PAID but the Sale Order is still NEW — payment did not move the order to the warehouse.",
                  "Auto-confirm the SO when the invoice becomes PAID (Odoo automation), or a daily 'PAID & SO = NEW' check by the Smallholder team."))
    k, _ = has("scheduled before payment")
    if k:
        L.append((f"{k}/{n} delivery schedule(s) were set before payment was complete and never re-planned after payment.",
                  f"Delivery is scheduled only after full payment; when payment lands, re-schedule within {DISPATCH_DAYS} days."))
    k, _ = has("Delivery scheduled on day")
    if k:
        L.append((f"{k}/{n} order(s) were scheduled after day {BUFFER_DAY} — any slip guarantees a breach.",
                  f"Planning rule: schedule delivery by day 7–{BUFFER_DAY} after order."))
    k, _ = has("Missed scheduled date")
    if k:
        L.append((f"{k}/{n} order(s) passed their scheduled date with no update — nobody owned the miss.",
                  "When a scheduled date passes without delivery, the Smallholder PIC logs a reason + new date within 24h."))
    k, _ = has("no delivery escalation")
    if k:
        L.append((f"{k}/{n} customer(s) were contacted by the PIC while the order was pending, but no delivery escalation was logged.",
                  "On every visit / call, the PIC checks open orders > 7 days and records the delivery status in CRM."))
    k, refs = has("Critical")
    if k:
        L.append((f"{k}/{n} order(s) are ≥ {SLA_DAYS} days beyond SLA — high risk of refund / churn.",
                  f"PIC calls the customer this week with a firm delivery date; goodwill (free shipping / voucher) for repeat buyers. ({refs})"))
    by = d.groupby("pic").size().sort_values(ascending=False)
    L.append((f"Breaches by PIC (team {PIC_TEAM}): " + ", ".join(f"{p} ({c})" for p, c in by.items()) + ".",
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
    st_col = {"Paid before deadline": RED, "Paid after deadline": ORANGE, "Not fully paid": ORANGE}

    def rc_color(stage):
        return st_col.get(stage, MUTED)

    # ---------------------------------------------------------- 1. cover
    s = deck.new(TPL_COVER)
    for shp in list(s.shapes):
        if shp.has_text_frame and shp.text_frame.text.strip():
            shp._element.getparent().remove(shp._element)
    text(s, int(0.45 * IN), int(0.95 * IN), int(7 * IN), int(0.9 * IN),
         "Delivery SLA Failures (Aging > 14 days)\nB2C Smallholder", size=26, bold=True)
    text(s, int(0.45 * IN), int(2.0 * IN), int(7.5 * IN), int(0.3 * IN),
         f"PIC team {PIC_TEAM}  •  {fmt_int(len(d))} order(s) failing  •  {d_id(today)}",
         size=12, bold=True, color=GREEN)
    text(s, int(0.45 * IN), int(2.3 * IN), int(7 * IN), int(0.3 * IN),
         f"SLA: delivered by sale order date + {SLA_DAYS} days (shipped once fully paid; late payment does not move the deadline).",
         size=10, color=MUTED)
    text(s, int(0.45 * IN), int(2.55 * IN), int(7 * IN), int(0.3 * IN),
         f"Source: {AGING_FILE}  •  Auto-generated {d_id(today)}", size=9, color=MUTED)

    # ---------------------------------------------------------- 2. summary
    s = deck.new()
    header(deck, s, "Summary — Orders Failing the Delivery SLA",
           f"PIC team {PIC_TEAM}  •  SLA deadline = sale order date + {SLA_DAYS} days, even if payment is late  •  "
           f"shipped once fully paid")
    gap = int(0.2 * IN)
    tw = (W - 2 * MX - 3 * gap) // 4
    y = TOP + int(0.72 * IN)
    n_before = int(d["stage"].eq("Paid before deadline").sum())
    tiles = [("Orders failing SLA", fmt_int(len(d))),
             ("Sales value held", fmt_idr(d["sales_idr"].sum())),
             ("Paid before / after deadline", f"{n_before} / {len(d) - n_before}"),
             ("Avg days to full payment", f"D+{d['days_to_pay'].mean():.0f}" if d["days_to_pay"].notna().any() else "–")]
    for i, (lab, val) in enumerate(tiles):
        kpi_tile(s, MX + i * (tw + gap), y, tw, int(0.85 * IN), lab, val)
    y2 = y + int(1.05 * IN)
    half = (W - 2 * MX - gap) // 2
    if len(d):
        g = d.groupby("stage").agg(n=("ref", "size"), v=("sales_idr", "sum"),
                                   w=("days_since_paid", "mean"), o=("days_late", "mean")).reset_index()
        text(s, MX, y2, half, int(0.22 * IN), "By payment status", size=10, bold=True, color=GREEN)
        table(s, MX, y2 + int(0.26 * IN), half, ["Payment status", "Orders", "Sales", "Avg since paid", "Avg over SLA"],
              [[(r.stage, rc_color(r.stage)), fmt_int(r.n), fmt_idr(r.v),
                "–" if pd.isna(r.w) else f"{r.w:.0f}d", f"+{r.o:.0f}d"] for r in g.itertuples()],
              [2.2, 0.8, 1.2, 1.2, 1.2])
        p = d.groupby("pic").agg(n=("ref", "size"), v=("sales_idr", "sum"), a=("aging", "max")).reset_index()
        text(s, MX + half + gap, y2, half, int(0.22 * IN), "By PIC", size=10, bold=True, color=GREEN)
        table(s, MX + half + gap, y2 + int(0.26 * IN), half, ["PIC", "Team", "Orders", "Sales", "Oldest (d)"],
              [[r.pic, PIC_TEAM, fmt_int(r.n), fmt_idr(r.v), fmt_int(r.a)] for r in p.itertuples()],
              [2.4, 1.1, 0.8, 1.2, 1.0], left_cols=(1,))
    else:
        text(s, MX, y2, W - 2 * MX, int(0.4 * IN), "No order is breaching the delivery SLA this week.",
             size=14, bold=True, color=GREEN)

    # ---------------------------------------------------------- 3. order detail
    def since_paid(r):
        return f"{int(r.days_since_paid)}d" if r.is_paid else ("not paid", RED)
    rows = [[r.ref, r.customer_name, r.pic, r.item, fmt_idr(r.sales_idr), _d(r.order_date),
             f"{_d(r.paid_date)} (D+{int(r.days_to_pay)})" if r.is_paid else (r.inv or "–", RED),
             _d(r.deadline), f"{int(r.aging)}d", since_paid(r), (f"+{int(r.days_late)}d", RED),
             (r.stage, rc_color(r.stage))] for r in d.itertuples()]
    legend = (f"SLA deadline = sale order date + {SLA_DAYS} days (does not move if payment is late)  •  "
              f"Fully paid (D+x) = full payment date, x days after the order  •  Aging = sale order date → today  •  "
              f"Since paid = full payment date → today  •  Over SLA = aging − {SLA_DAYS} = days past the deadline")
    paged_table(deck, "Orders Failing SLA — Detail",
                f"PIC team {PIC_TEAM}  •  as of {d_id(today)}  •  shipped once fully paid, deadline counted from order date",
                ["Order", "Customer", "PIC", "Item", "Sales", "Order date", "Fully paid", "SLA deadline", "Aging",
                 "Since paid", "Over SLA", "Payment status"], rows,
                [1.25, 1.5, 1.5, 2.0, 0.95, 0.95, 1.3, 0.95, 0.65, 0.75, 0.7, 1.5],
                left_cols=(1, 2, 3, 11), font=7, legend=legend, empty_row=["–"] + [""] * 11)

    # ---------------------------------------------------------- 4. findings per order
    # table() styles only the first paragraph of a cell -> keep every cell on one paragraph
    rows = [[r.ref, f"{r.customer_name} — PIC {r.pic} ({PIC_TEAM})",
             (r.root_cause, rc_color(r.stage)),
             "  •  ".join(r.flags + ([r.crm_contact] if r.crm_contact else []))]
            for r in d.itertuples()]
    paged_table(deck, "Why Each Order Failed — Process Findings",
                f"SLA deadline = sale order date + {SLA_DAYS} days, even if payment is late  •  findings derived from the data",
                ["Order", "Customer / PIC", "Root cause", "Findings"], rows, [1.1, 2.0, 2.4, 6.0],
                left_cols=(1, 2, 3), font=7, per_page=6,
                empty_row=["–", "", "", ""])

    # ---------------------------------------------------------- 5. lessons learned
    rows = [[str(i + 1), les, act] for i, (les, act) in enumerate(L)]
    paged_table(deck, "Lessons Learned & Actions", "Generated from the findings above — review in the weekly Smallholder sync",
                ["#", "Lesson learned", "Action"], rows, [0.3, 5.0, 5.0], left_cols=(1, 2), font=8, per_page=10,
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
        "City": d["city"], "PIC": d["pic"], "PIC team": d["pic_team"], "Item": d["item"], "Category": d["product_category"],
        "Sales (IDR)": d["sales_idr"], "Order date": d["order_date"].dt.date,
        "SLA deadline": d["deadline"].dt.date, "Invoice status": d["inv"],
        "Full payment date": d["paid_date"].dt.date, "Days to pay": d["days_to_pay"],
        "Since paid (paid -> today)": d["days_since_paid"], "SO status": d["so"], "Delivery status": d["delivery"],
        "Scheduled": d["sched_date"].dt.date, "Aging (order -> today)": d["aging"], "Over SLA (aging - 14)": d["days_late"],
        "Root cause": d["root_cause"], "Payment status": d["stage"], "Findings": d["flags"].map("\n".join),
        "CRM contact while pending": d["crm_contact"],
    })
    by_pic = (d.groupby("pic").agg(Orders=("ref", "size"), **{"Sales (IDR)": ("sales_idr", "sum")},
                                   **{"Avg aging": ("aging", "mean")}, **{"Oldest aging": ("aging", "max")})
              .reset_index().rename(columns={"pic": "PIC"}).round({"Avg aging": 1}))
    sheets = {
        "Orders failing SLA": orders,
        "Lessons learned": pd.DataFrame([(i + 1, a, b) for i, (a, b) in enumerate(L)],
                                        columns=["#", "Lesson learned", "Action"]),
        "Per PIC": by_pic,
        "Assumptions": pd.DataFrame([
            ("Report date", d_id(today)),
            ("PIC team", PIC_TEAM),
            ("Delivery SLA (days from sale order date)", SLA_DAYS),
            ("Goods are shipped", "once the order is fully paid (invoice PAID)"),
            ("SLA deadline", f"sale order date + {SLA_DAYS} days — does not move if payment is late"),
            ("Target: fully paid within (days)", PAY_DAYS),
            ("Target: dispatched after payment within (days)", DISPATCH_DAYS),
            ("Schedule delivery no later than day", BUFFER_DAY),
            ("Delivered statuses", ", ".join(sorted(DELIVERED))),
        ], columns=["Parameter", "Value"]),
    }
    wide = {"Findings": 70, "Lesson learned": 80, "Action": 80, "CRM contact while pending": 60}
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
