"""
Account Manager Report — Smallholder (weekly + monthly), output in English

Membaca:
  - CRM Smallholder.csv    (export Lark Base, aktivitas engagement AM)
  - Sales Smallholder.csv  (detail penjualan per baris item, GMV per PIC)

Menghasilkan deck .pptx berbasis template "deck slide.pptx" (SawitPRO NEW THEME 2026).

Aturan periode (Asia/Jakarta):
  - Minggu = Senin s/d Minggu.
  - Minggu berjalan TIDAK diikutkan. Batas akhir data = Minggu terakhir yang
    sudah lewat (cutoff). Contoh: dijalankan Senin 2 Nov 2026 -> data s/d
    Minggu 1 Nov 2026.
  - Mingguan: minggu terakhir yang lengkap + tren 6 minggu.
  - Bulanan: Januari s/d bulan dari cutoff; bulan berjalan baru masuk (MTD)
    jika sudah >= 7 hari terlewati.

Pemakaian:
  python reporting/am_report.py --data-dir . --template "deck slide.pptx" \
      --out output/AM_Report.pptx [--today 2026-11-02]
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION, XL_LABEL_POSITION
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Emu, Pt

# ---------------------------------------------------------------- brand
GREEN = RGBColor(0x00, 0x72, 0x00)
YELLOW = RGBColor(0xFC, 0xD1, 0x02)
ORANGE = RGBColor(0xFC, 0xA5, 0x02)
INK = RGBColor(0x14, 0x14, 0x14)
GREY = RGBColor(0xDF, 0xDF, 0xDF)
MUTED = RGBColor(0x6B, 0x6B, 0x6B)
LIGHT = RGBColor(0xF2, 0xF7, 0xF2)
RED = RGBColor(0xC6, 0x28, 0x28)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
FONT = "Plus Jakarta Sans"

TZ = ZoneInfo("Asia/Jakarta")
BULAN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

REACHED_EXCL = "Unable to Contact - Tidak bisa dihubungi"
HOT = {"High Prospect - Segera transaksi", "Prospect - Transaksi dalam sebulan"}

REASON_EN = {
    "Belum ada kebutuhan dalam waktu segera": "No immediate need",
    "Belum ketertarikan yang jelas (Cek harga / Nanya-nanya))": "No clear interest yet (price check / just asking)",
    "Tidak mempunyai lahan lagi": "No longer owns land",
    "Terikat dengan pihak lain (KUD, agen)": "Tied to another party (cooperative, agent)",
    "Produk yang dibutuhkan tidak tersedia": "Required product not available",
    "Hanya ingin membeli dalam kuantitas kecil": "Only wants to buy small quantities",
    "Harga mahal": "Price too high",
    "Sudah mempunyai supplier / toko langganan langganan": "Already has a regular supplier / store",
    "Ingin pembayaran tempo": "Wants payment terms (credit)",
    "Ingin melihat gudang / pupuknya terlebih dahulu": "Wants to see the warehouse / fertilizer first",
    "Barangnya datang lebih lama": "Delivery takes too long",
    "Dokter Sawit - Harganya kemahalan": "Dokter Sawit – price too high",
}

# template slide indices (0-based) in deck slide.pptx
TPL_COVER, TPL_CONTENT, TPL_CLOSING = 0, 1, 27


# ================================================================ helpers
def fmt_idr(v: float) -> str:
    v = float(v)
    if abs(v) >= 1e9:
        return f"IDR {v/1e9:,.2f}B"
    if abs(v) >= 1e6:
        return f"IDR {v/1e6:,.1f}M"
    return f"IDR {v:,.0f}"


def fmt_int(v) -> str:
    return f"{int(round(v)):,}"


def fmt_pct(v) -> str:
    return "–" if pd.isna(v) else f"{v*100:.0f}%"


def delta_str(cur, prev) -> tuple[str, RGBColor]:
    if prev == 0 or pd.isna(prev):
        return ("new" if cur else "–", MUTED)
    d = (cur - prev) / abs(prev)
    arrow = "▲" if d > 0 else ("▼" if d < 0 else "■")
    return (f"{arrow} {abs(d)*100:.0f}% vs prior week", GREEN if d > 0 else (RED if d < 0 else MUTED))


def d_id(d: dt.date) -> str:
    return f"{d.day} {BULAN[d.month-1]} {d.year}"


def to_num(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s.astype(str).str.replace(",", "", regex=False).str.strip(), errors="coerce").fillna(0)


# ================================================================ data
def load(data_dir: Path):
    crm = pd.read_csv(data_dir / "CRM Smallholder.csv", encoding="utf-8-sig", dtype=str)
    sales = pd.read_csv(data_dir / "Sales Smallholder.csv", dtype=str)

    crm["date"] = pd.to_datetime(crm["Tanggal"], format="%Y/%m/%d", errors="coerce")
    crm["am"] = crm["Smallholders Team"].fillna("(Tanpa AM)").str.strip()
    crm["lead_key"] = crm["cleaned phone"].fillna(crm["cleaned leads (phone no - name)"])
    crm["reached"] = crm["Respon Pengguna"].notna() & (crm["Respon Pengguna"] != REACHED_EXCL)
    crm["responded"] = crm["Respon Pengguna"].notna()
    crm["hot"] = crm["Respon Pengguna"].isin(HOT)
    crm["new_lead"] = crm["Leads"].eq("New Leads")
    crm = crm[crm["date"].notna()]

    sales["date"] = pd.to_datetime(sales["sale_order_date"], format="%d/%m/%Y", errors="coerce")
    sales["am"] = sales["pic_name"].fillna("(Tanpa PIC)").str.strip()
    for c in ["gmv", "nett_sales", "qty"]:
        sales[c] = to_num(sales[c])
    sales = sales[sales["date"].notna()]
    return crm, sales


def periods(today: dt.date):
    week_start_cur = today - dt.timedelta(days=today.weekday())  # Senin minggu berjalan
    cutoff = week_start_cur - dt.timedelta(days=1)               # Minggu terakhir yang lengkap
    lw_start = week_start_cur - dt.timedelta(days=7)
    weeks = [(lw_start - dt.timedelta(days=7 * i), lw_start - dt.timedelta(days=7 * i) + dt.timedelta(days=6))
             for i in range(5, -1, -1)]
    return cutoff, weeks


def in_range(df, a: dt.date, b: dt.date):
    return df[(df["date"] >= pd.Timestamp(a)) & (df["date"] <= pd.Timestamp(b))]


def crm_kpis(df):
    resp = df["responded"].sum()
    return dict(
        engagements=len(df),
        leads=df["lead_key"].nunique(),
        reach=(df["reached"].sum() / resp) if resp else float("nan"),
        hot=int(df["hot"].sum()),
        new_leads=int(df["new_lead"].sum()),
        already=int(df["Respon Pengguna"].eq("Already order").sum()),
    )


def sales_kpis(df):
    return dict(
        gmv=df["gmv"].sum(),
        invoices=df["main_invoice_no"].nunique(),
        customers=df["customer_id"].nunique(),
        new_cust=df.loc[df["customer_status"].eq("new customer"), "customer_id"].nunique(),
        qty=df["qty"].sum(),
    )


def am_table(crm_p, sales_p, crm_prev=None, sales_prev=None):
    c = crm_p.groupby("am").agg(
        engagements=("am", "size"),
        leads=("lead_key", "nunique"),
        responded=("responded", "sum"),
        reached=("reached", "sum"),
        hot=("hot", "sum"),
    )
    c["reach"] = c["reached"] / c["responded"].where(c["responded"] > 0)
    s = sales_p.groupby("am").agg(
        gmv=("gmv", "sum"),
        invoices=("main_invoice_no", "nunique"),
        customers=("customer_id", "nunique"),
    )
    t = c.join(s, how="outer").fillna({"engagements": 0, "leads": 0, "hot": 0, "gmv": 0, "invoices": 0, "customers": 0})
    if sales_prev is not None:
        t["gmv_prev"] = sales_prev.groupby("am")["gmv"].sum().reindex(t.index).fillna(0)
    if crm_prev is not None:
        t["eng_prev"] = crm_prev.groupby("am").size().reindex(t.index).fillna(0)
    t = t[(t["engagements"] > 0) | (t["gmv"] > 0)]
    return t.sort_values(["gmv", "engagements"], ascending=False)


# ================================================================ pptx plumbing
class Deck:
    def __init__(self, template: Path):
        self.prs = Presentation(str(template))
        self.W, self.H = self.prs.slide_width, self.prs.slide_height
        self._tpl = list(self.prs.slides)
        self._keep = []

    def _clone(self, idx):
        src = self._tpl[idx]
        s = self.prs.slides.add_slide(src.slide_layout)
        for ph in list(s.placeholders):
            ph._element.getparent().remove(ph._element)
        for shp in src.shapes:
            if shp.is_placeholder:
                continue
            s.shapes._spTree.append(copy.deepcopy(shp._element))
        for rel in src.part.rels.values():  # gambar pada slide sumber
            if "image" in rel.reltype:
                s.part.rels.get_or_add(rel.reltype, rel._target)
        return s

    def new(self, idx=TPL_CONTENT):
        s = self._clone(idx)
        self._keep.append(s)
        return s

    def finalize(self, out: Path):
        lst = self.prs.slides._sldIdLst
        for sid, slide in zip(list(lst), self._tpl):
            self.prs.part.drop_rel(sid.rId)
            lst.remove(sid)
        used = {id(sl.slide_layout.part) for sl in self.prs.slides}
        for master in self.prs.slide_masters:
            lst_l = master._element.get_or_add_sldLayoutIdLst()
            for lid in list(lst_l):
                part = master.part.related_part(lid.rId)
                if id(part) not in used:
                    master.part.drop_rel(lid.rId)
                    lst_l.remove(lid)
        out.parent.mkdir(parents=True, exist_ok=True)
        self.prs.save(str(out))


def text(slide, x, y, w, h, s, size=12, bold=False, color=INK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(Emu(x), Emu(y), Emu(w), Emu(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for m in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, m, 0)
    lines = s if isinstance(s, list) else [s]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        runs = line if isinstance(line, list) else [(line, {})]
        for r_text, st in runs:
            r = p.add_run()
            r.text = r_text
            f = r.font
            f.name = FONT
            f.size = Pt(st.get("size", size))
            f.bold = st.get("bold", bold)
            f.color.rgb = st.get("color", color)
    return tb


def rect(slide, x, y, w, h, fill, line=None):
    from pptx.enum.shapes import MSO_SHAPE
    r = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Emu(x), Emu(y), Emu(w), Emu(h))
    r.adjustments[0] = 0.08
    r.fill.solid()
    r.fill.fore_color.rgb = fill
    if line is None:
        r.line.fill.background()
    else:
        r.line.color.rgb = line
        r.line.width = Pt(0.75)
    r.shadow.inherit = False
    return r


IN = 914400
MX = int(0.45 * IN)       # margin kiri/kanan
TOP = int(0.80 * IN)      # di bawah header logo
BOTTOM = int(5.08 * IN)   # di atas footer hijau


def header(deck, slide, title, subtitle=None):
    text(slide, MX, TOP, deck.W - 2 * MX - int(2.2 * IN), int(0.4 * IN), title, size=20, bold=True)
    if subtitle:
        text(slide, MX, TOP + int(0.40 * IN), deck.W - 2 * MX, int(0.25 * IN), subtitle, size=10, color=MUTED)


def kpi_tile(slide, x, y, w, h, label, value, delta=None):
    rect(slide, x, y, w, h, LIGHT)
    pad = int(0.12 * IN)
    text(slide, x + pad, y + pad, w - 2 * pad, int(0.2 * IN), label, size=9, color=MUTED)
    text(slide, x + pad, y + pad + int(0.22 * IN), w - 2 * pad, int(0.36 * IN), value, size=18, bold=True, color=GREEN)
    if delta:
        text(slide, x + pad, y + h - pad - int(0.18 * IN), w - 2 * pad, int(0.18 * IN), delta[0], size=8, color=delta[1])


def table(slide, x, y, w, cols, rows, widths, row_h=int(0.215 * IN), font=8, highlight_col=None):
    n = len(rows) + 1
    gt = slide.shapes.add_table(n, len(cols), Emu(x), Emu(y), Emu(w), Emu(row_h * n)).table
    tot = sum(widths)
    for i, wd in enumerate(widths):
        gt.columns[i].width = Emu(int(w * wd / tot))
    for r in range(n):
        gt.rows[r].height = Emu(row_h)
    for r in range(n):
        for c in range(len(cols)):
            cell = gt.cell(r, c)
            val = cols[c] if r == 0 else rows[r - 1][c]
            color = INK
            if isinstance(val, tuple):
                val, color = val
            cell.text = str(val)
            cell.margin_left = cell.margin_right = Emu(int(0.06 * IN))
            cell.margin_top = cell.margin_bottom = Emu(int(0.02 * IN))
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            p = cell.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT if c == 0 else PP_ALIGN.RIGHT
            f = p.runs[0].font
            f.name, f.size = FONT, Pt(font)
            cell.fill.solid()
            if r == 0:
                cell.fill.fore_color.rgb = GREEN
                f.bold, f.color.rgb = True, WHITE
            else:
                cell.fill.fore_color.rgb = WHITE if r % 2 else LIGHT
                f.color.rgb = color
                f.bold = c == 0 or c == highlight_col
    return gt


def style_chart(ch, legend=True, num_fmt='#,##0'):
    ch.font.name = FONT
    ch.font.size = Pt(8)
    ch.font.color.rgb = INK
    ch.has_legend = legend
    if legend:
        ch.legend.position = XL_LEGEND_POSITION.TOP
        ch.legend.include_in_layout = False
        ch.legend.font.size = Pt(8)
    try:
        va = ch.value_axis
        va.has_major_gridlines = True
        va.major_gridlines.format.line.color.rgb = GREY
        va.format.line.fill.background()
        va.tick_labels.number_format = num_fmt
        va.tick_labels.number_format_is_linked = False
        ca = ch.category_axis
        ca.format.line.color.rgb = GREY
        ca.has_major_gridlines = False
    except Exception:
        pass


def bar_chart(slide, x, y, w, h, cats, series, colors, title=None, num_fmt='#,##0', labels=True,
              kind=XL_CHART_TYPE.COLUMN_CLUSTERED, label_fmt=None):
    cd = CategoryChartData()
    cd.categories = cats
    for name, vals in series:
        cd.add_series(name, vals)
    gf = slide.shapes.add_chart(kind, Emu(x), Emu(y), Emu(w), Emu(h), cd)
    ch = gf.chart
    style_chart(ch, legend=len(series) > 1, num_fmt=num_fmt)
    if title:
        ch.has_title = True
        ch.chart_title.text_frame.text = title
        tp = ch.chart_title.text_frame.paragraphs[0]
        tp.runs[0].font.size, tp.runs[0].font.bold, tp.runs[0].font.name = Pt(10), True, FONT
    else:
        ch.has_title = False
    plot = ch.plots[0]
    try:
        plot.gap_width = 60
        plot.overlap = -10 if len(series) > 1 else 0
    except Exception:
        pass
    for s, col in zip(plot.series, colors):
        s.format.fill.solid()
        s.format.fill.fore_color.rgb = col
    if labels:
        plot.has_data_labels = True
        dl = plot.data_labels
        dl.font.size = Pt(7)
        dl.font.name = FONT
        dl.number_format = label_fmt or num_fmt
        dl.number_format_is_linked = False
        try:
            dl.position = XL_LABEL_POSITION.OUTSIDE_END
        except Exception:
            pass
    return ch


# ================================================================ slides
def build(data_dir: Path, template: Path, out: Path, today: dt.date):
    crm, sales = load(data_dir)
    cutoff, weeks = periods(today)
    lw_a, lw_b = weeks[-1]
    pw_a, pw_b = weeks[-2]
    iso_wk = lw_a.isocalendar()[1]
    year_start = dt.date(cutoff.year, 1, 1)
    m_end = cutoff if cutoff.day >= 7 else (cutoff.replace(day=1) - dt.timedelta(days=1))

    crm_lw, crm_pw = in_range(crm, lw_a, lw_b), in_range(crm, pw_a, pw_b)
    sal_lw, sal_pw = in_range(sales, lw_a, lw_b), in_range(sales, pw_a, pw_b)
    k_lw = {**crm_kpis(crm_lw), **sales_kpis(sal_lw)}
    k_pw = {**crm_kpis(crm_pw), **sales_kpis(sal_pw)}

    deck = Deck(template)
    W = deck.W
    data_max_crm = crm["date"].max().date()
    data_max_sales = sales["date"].max().date()

    # ---------------------------------------------------------- 1. cover
    s = deck.new(TPL_COVER)
    for shp in list(s.shapes):
        if shp.has_text_frame and shp.text_frame.text.strip():
            shp._element.getparent().remove(shp._element)
    text(s, int(0.45 * IN), int(0.95 * IN), int(7 * IN), int(0.9 * IN),
         "Account Manager Report\nSmallholder", size=26, bold=True)
    text(s, int(0.45 * IN), int(2.0 * IN), int(7 * IN), int(0.3 * IN),
         f"Weekly W{iso_wk} ({d_id(lw_a)} – {d_id(lw_b)})  •  Monthly Jan – {BULAN[m_end.month-1]} {m_end.year}",
         size=12, bold=True, color=GREEN)
    text(s, int(0.45 * IN), int(2.3 * IN), int(7 * IN), int(0.3 * IN),
         f"Data up to {d_id(cutoff)} (current week excluded)  •  Auto-generated {d_id(today)}",
         size=9, color=MUTED)

    # ---------------------------------------------------------- 2. ringkasan mingguan
    s = deck.new()
    header(deck, s, f"Last Week Summary — W{iso_wk}",
           f"{d_id(lw_a)} – {d_id(lw_b)}  •  compared with W{pw_a.isocalendar()[1]} ({d_id(pw_a)} – {d_id(pw_b)})")
    tiles = [
        ("GMV", fmt_idr(k_lw["gmv"]), delta_str(k_lw["gmv"], k_pw["gmv"])),
        ("Invoices", fmt_int(k_lw["invoices"]), delta_str(k_lw["invoices"], k_pw["invoices"])),
        ("Transacting customers", fmt_int(k_lw["customers"]), delta_str(k_lw["customers"], k_pw["customers"])),
        ("New customers", fmt_int(k_lw["new_cust"]), delta_str(k_lw["new_cust"], k_pw["new_cust"])),
        ("CRM engagements", fmt_int(k_lw["engagements"]), delta_str(k_lw["engagements"], k_pw["engagements"])),
        ("Unique leads contacted", fmt_int(k_lw["leads"]), delta_str(k_lw["leads"], k_pw["leads"])),
        ("Reach rate", fmt_pct(k_lw["reach"]),
         (f"{(k_lw['reach']-k_pw['reach'])*100:+.0f} pp vs prior week", MUTED) if not pd.isna(k_pw["reach"]) else None),
        ("Hot prospects", fmt_int(k_lw["hot"]), delta_str(k_lw["hot"], k_pw["hot"])),
    ]
    gap = int(0.14 * IN)
    tw = (W - 2 * MX - 3 * gap) // 4
    th = int(0.9 * IN)
    y0 = TOP + int(0.72 * IN)
    for i, (lab, val, dlt) in enumerate(tiles):
        kpi_tile(s, MX + (i % 4) * (tw + gap), y0 + (i // 4) * (th + gap), tw, th, lab, val, dlt)

    # sorotan otomatis
    t_lw = am_table(crm_lw, sal_lw, crm_pw, sal_pw)
    notes = []
    if len(t_lw) and t_lw["gmv"].max() > 0:
        top = t_lw["gmv"].idxmax()
        notes.append(f"Top GMV: {top} ({fmt_idr(t_lw.loc[top, 'gmv'])}, {fmt_int(t_lw.loc[top, 'invoices'])} invoices).")
    if len(t_lw):
        topc = t_lw["engagements"].idxmax()
        notes.append(f"Most engagements: {topc} ({fmt_int(t_lw.loc[topc, 'engagements'])} activities).")
    if "gmv_prev" in t_lw:
        lost = t_lw[(t_lw["gmv_prev"] > 0) & (t_lw["gmv"] == 0)].index.tolist()
        if lost:
            notes.append("Had GMV the prior week but zero last week: " + ", ".join(lost[:5]) + ".")
    if data_max_sales < lw_b:
        notes.append(f"Warning: Sales data only runs to {d_id(data_max_sales)}, so this week is incomplete — please refresh the CSV.")
    if data_max_crm < lw_b:
        notes.append(f"Warning: CRM data only runs to {d_id(data_max_crm)}, so this week is incomplete — please refresh the CSV.")
    ytxt = y0 + 2 * th + gap + int(0.15 * IN)
    text(s, MX, ytxt, W - 2 * MX, int(0.7 * IN), [[("Highlights", {"bold": True, "color": GREEN})]] + [[("•  ", {"bold": True, "color": GREEN}), (n, {})] for n in notes],
         size=9)

    # ---------------------------------------------------------- 3. tren 6 minggu
    s = deck.new()
    header(deck, s, "Last 6 Weeks Trend", "Weeks run Monday–Sunday; current week excluded")
    cats, gmv_w, inv_w, eng_w, hot_w = [], [], [], [], []
    for a, b in weeks:
        cats.append(f"W{a.isocalendar()[1]}\n{a.day}/{a.month}")
        sw, cw = in_range(sales, a, b), in_range(crm, a, b)
        gmv_w.append(round(sw["gmv"].sum() / 1e6, 1))
        inv_w.append(sw["main_invoice_no"].nunique())
        eng_w.append(len(cw))
        hot_w.append(int(cw["hot"].sum()))
    cw_ = (W - 2 * MX - gap) // 2
    ch_y, ch_h = TOP + int(0.68 * IN), int(3.45 * IN)
    bar_chart(s, MX, ch_y, cw_, ch_h, cats, [("GMV (IDR million)", gmv_w)], [GREEN], title="GMV (IDR million)",
              num_fmt='#,##0', label_fmt='#,##0.0')
    bar_chart(s, MX + cw_ + gap, ch_y, cw_, ch_h, cats,
              [("Engagements", eng_w), ("Hot prospects", hot_w), ("Invoices", inv_w)],
              [GREEN, YELLOW, ORANGE], title="CRM Activity vs Invoices")

    # ---------------------------------------------------------- 4. leaderboard AM mingguan
    s = deck.new()
    header(deck, s, f"Account Manager Performance — W{iso_wk}",
           f"{d_id(lw_a)} – {d_id(lw_b)}  •  sorted by GMV  •  Δ GMV vs prior week")
    rows = []
    for am, r in t_lw.head(14).iterrows():
        d = "–"
        dc = MUTED
        if r.get("gmv_prev", 0) > 0 or r["gmv"] > 0:
            diff = r["gmv"] - r.get("gmv_prev", 0)
            d = ("+" if diff >= 0 else "−") + fmt_idr(abs(diff))
            dc = GREEN if diff > 0 else (RED if diff < 0 else MUTED)
        rows.append([am, fmt_int(r["engagements"]), fmt_int(r["leads"]), fmt_pct(r["reach"]),
                     fmt_int(r["hot"]), fmt_int(r["invoices"]), fmt_int(r["customers"]),
                     fmt_idr(r["gmv"]), (d, dc)])
    if len(t_lw) > 14:
        rows.append([f"+{len(t_lw)-14} other AMs", "", "", "", "", "", "", "", ""])
    table(s, MX, TOP + int(0.72 * IN), W - 2 * MX,
          ["Account Manager", "Engagements", "Unique leads", "Reach", "Hot", "Invoices", "Customers", "GMV", "Δ GMV"],
          rows, [2.4, 1.2, 1.1, 0.8, 0.6, 0.8, 0.95, 1.3, 1.4], highlight_col=7)

    # ---------------------------------------------------------- 5. kualitas CRM minggu lalu
    s = deck.new()
    header(deck, s, f"CRM Engagement Outcomes — W{iso_wk}", "User response distribution & reasons for no interest")
    resp = crm_lw["Respon Pengguna"].fillna("(Not filled)").value_counts()
    short = {
        "Unable to Contact - Tidak bisa dihubungi": "Unable to contact",
        "Mempertimbangkan / Pikir-pikir": "Considering",
        "Cold - Tidak tertarik": "Not interested",
        "Prospect - Transaksi dalam sebulan": "Prospect (≤1 month)",
        "High Prospect - Segera transaksi": "High prospect",
        "Menanyakan Status Pesanan": "Asking order status",
        "Already order": "Already ordered",
    }
    rc = [short.get(k, k) for k in resp.index][::-1]
    bar_chart(s, MX, ch_y, cw_, ch_h, rc, [("Engagements", resp.values.tolist()[::-1])], [GREEN],
              title="User responses", kind=XL_CHART_TYPE.BAR_CLUSTERED)
    reasons = crm_lw["Alasan customer tidak tertarik"].dropna().map(lambda x: REASON_EN.get(x.strip(), x)).value_counts().head(7)
    if len(reasons):
        rr = [[(k[:48] + "…") if len(k) > 49 else k, fmt_int(v)] for k, v in reasons.items()]
        text(s, MX + cw_ + gap, ch_y, cw_, int(0.25 * IN), "Top reasons for no interest", size=10, bold=True)
        table(s, MX + cw_ + gap, ch_y + int(0.3 * IN), cw_, ["Reason", "Count"], rr, [4, 1], row_h=int(0.25 * IN))
        ytype = ch_y + int(0.3 * IN) + int(0.25 * IN) * (len(rr) + 1) + int(0.2 * IN)
    else:
        ytype = ch_y
    et = crm_lw["Engagement Type"].fillna("(Empty)").value_counts()
    text(s, MX + cw_ + gap, ytype, cw_, int(0.6 * IN),
         [[("Channels: ", {"bold": True})] + [(f"{k} {fmt_int(v)}  ", {}) for k, v in et.items()]], size=8, color=MUTED)

    # ---------------------------------------------------------- 6. tren bulanan
    # Bulan berjalan baru diikutkan (sebagai MTD) jika sudah >= 7 hari terlewati
    m_end = cutoff if cutoff.day >= 7 else (cutoff.replace(day=1) - dt.timedelta(days=1))
    months = pd.period_range(pd.Timestamp(year_start), pd.Timestamp(m_end), freq="M")
    sal_ytd = in_range(sales, year_start, m_end).copy()
    crm_ytd = in_range(crm, year_start, m_end).copy()
    sal_ytd["m"] = sal_ytd["date"].dt.to_period("M")
    crm_ytd["m"] = crm_ytd["date"].dt.to_period("M")
    mlabel = [BULAN[p.month - 1] + ("*" if p == months[-1] and m_end.day != p.days_in_month else "") for p in months]
    partial_note = (f"*{BULAN[m_end.month-1]} = MTD to {d_id(m_end)}"
                    if m_end.day != months[-1].days_in_month else "")

    s = deck.new()
    header(deck, s, f"Monthly Trend {cutoff.year} (YTD)",
           f"1 Jan – {d_id(m_end)}  {('•  ' + partial_note) if partial_note else ''}")
    g_m = sal_ytd.groupby("m")["gmv"].sum().reindex(months, fill_value=0)
    newc = sal_ytd[sal_ytd["customer_status"].eq("new customer")].groupby("m")["customer_id"].nunique().reindex(months, fill_value=0)
    repc = sal_ytd[sal_ytd["customer_status"].eq("repeat customer")].groupby("m")["customer_id"].nunique().reindex(months, fill_value=0)
    bar_chart(s, MX, ch_y, cw_, ch_h, mlabel, [("GMV (IDR million)", (g_m / 1e6).round(1).tolist())], [GREEN],
              title="GMV per month (IDR million)", label_fmt='#,##0')
    ch = bar_chart(s, MX + cw_ + gap, ch_y, cw_, ch_h, mlabel,
                   [("New customers", newc.tolist()), ("Repeat", repc.tolist())], [YELLOW, GREEN],
                   title="Transacting customers", kind=XL_CHART_TYPE.COLUMN_STACKED)
    ch.plots[0].data_labels.position = XL_LABEL_POSITION.CENTER

    # ---------------------------------------------------------- 7. GMV per AM per bulan
    last3 = list(months[-3:])
    s = deck.new()
    header(deck, s, "GMV per Account Manager — Monthly",
           f"Last 3 months + YTD  {('•  ' + partial_note) if partial_note else ''}")
    piv = sal_ytd.pivot_table(index="am", columns="m", values="gmv", aggfunc="sum", fill_value=0)
    piv = piv.reindex(columns=months, fill_value=0)
    piv["YTD"] = piv.sum(axis=1)
    inv_ytd = sal_ytd.groupby("am")["main_invoice_no"].nunique()
    cus_ytd = sal_ytd.groupby("am")["customer_id"].nunique()
    piv = piv.sort_values("YTD", ascending=False)
    rows = []
    for am, r in piv.head(14).iterrows():
        rows.append([am] + [fmt_idr(r[m]) if r[m] else "–" for m in last3] +
                    [fmt_idr(r["YTD"]), fmt_int(inv_ytd.get(am, 0)), fmt_int(cus_ytd.get(am, 0)),
                     f"{r['YTD']/piv['YTD'].sum()*100:.0f}%"])
    rows.append([("Total", INK)] + [fmt_idr(piv[m].sum()) for m in last3] +
                [fmt_idr(piv["YTD"].sum()), fmt_int(sal_ytd["main_invoice_no"].nunique()),
                 fmt_int(sal_ytd["customer_id"].nunique()), "100%"])
    lab3 = [mlabel[list(months).index(m)] for m in last3]
    table(s, MX, TOP + int(0.72 * IN), W - 2 * MX,
          ["Account Manager"] + lab3 + ["GMV YTD", "Invoices YTD", "Customers YTD", "Share"],
          rows, [2.5, 1.15, 1.15, 1.15, 1.25, 1.1, 1.3, 0.8], highlight_col=4)

    # ---------------------------------------------------------- 8. aktivitas CRM per AM per bulan
    s = deck.new()
    header(deck, s, "CRM Activity per Account Manager — Monthly",
           f"Engagements per month (last 3 months) + reach rate & hot prospects for the latest month  {('•  ' + partial_note) if partial_note else ''}")
    pe = crm_ytd.pivot_table(index="am", columns="m", values="Engagement ID", aggfunc="count", fill_value=0)
    pe = pe.reindex(columns=months, fill_value=0)
    pe["YTD"] = pe.sum(axis=1)
    lm = crm_ytd[crm_ytd["m"] == last3[-1]]
    lm_reach = lm.groupby("am").apply(lambda d: d["reached"].sum() / d["responded"].sum() if d["responded"].sum() else float("nan"))
    lm_hot = lm.groupby("am")["hot"].sum()
    lm_new = lm.groupby("am")["new_lead"].sum()
    pe = pe.sort_values([last3[-1], "YTD"], ascending=False)
    pe = pe[pe[last3].sum(axis=1) > 0]
    rows = []
    for am, r in pe.head(14).iterrows():
        rows.append([am] + [fmt_int(r[m]) for m in last3] +
                    [fmt_pct(lm_reach.get(am, float("nan"))), fmt_int(lm_hot.get(am, 0)), fmt_int(lm_new.get(am, 0)),
                     fmt_int(r["YTD"])])
    table(s, MX, TOP + int(0.72 * IN), W - 2 * MX,
          ["Account Manager"] + lab3 + [f"Reach {lab3[-1]}", f"Hot {lab3[-1]}", f"New leads {lab3[-1]}", "Engagements YTD"],
          rows, [2.6, 1, 1, 1, 1.1, 1, 1.2, 1.3], highlight_col=3)

    # ---------------------------------------------------------- 9. produk teratas
    s = deck.new()
    header(deck, s, "Top Products by GMV", f"Week W{iso_wk} vs YTD")
    for j, (lab, df) in enumerate([(f"W{iso_wk}", sal_lw), ("YTD", sal_ytd)]):
        top = df.groupby("item_name").agg(gmv=("gmv", "sum"), qty=("qty", "sum")).sort_values("gmv", ascending=False).head(10)
        rr = [[(k[:40] + "…") if len(k) > 41 else k, fmt_int(r["qty"]), fmt_idr(r["gmv"])] for k, r in top.iterrows()]
        if not rr:
            rr = [["(no sales)", "", ""]]
        text(s, MX + j * (cw_ + gap), ch_y, cw_, int(0.25 * IN), lab, size=10, bold=True, color=GREEN)
        table(s, MX + j * (cw_ + gap), ch_y + int(0.3 * IN), cw_, ["Product", "Qty", "GMV"], rr, [4, 1, 1.5],
              row_h=int(0.25 * IN))

    # ---------------------------------------------------------- 10. definisi
    s = deck.new()
    header(deck, s, "Notes & Definitions")
    defs = [
        f"Period: weeks run Monday–Sunday (WIB). The current week is excluded; data is cut off at {d_id(cutoff)}. "
        "The current month is shown (as MTD) only once at least 7 days have passed.",
        f"Latest date in files: CRM {d_id(data_max_crm)}, Sales {d_id(data_max_sales)}. "
        "If this is earlier than the cutoff, the CSV has not been refreshed.",
        "GMV: sum of the gmv column in Sales Smallholder.csv (all SO/invoice statuses in the file). "
        "AM = pic_name; invoices with multiple PICs keep the combined name.",
        "Invoices: unique main_invoice_no. Customers: unique customer_id; new/repeat from customer_status.",
        "Engagements: number of CRM rows (Engagement ID) per AM (Smallholders Team column).",
        "Unique leads: unique phone numbers (cleaned phone) contacted.",
        "Reach rate: engagements with a response other than 'Unable to Contact' ÷ engagements with a response filled in.",
        "Hot prospects: responses 'High Prospect – Segera transaksi' + 'Prospect – Transaksi dalam sebulan'.",
    ]
    text(s, MX, TOP + int(0.6 * IN), W - 2 * MX, int(3.8 * IN), [[("•  ", {"color": GREEN, "bold": True}), (d, {})] for d in defs],
         size=10)

    # ---------------------------------------------------------- 11. penutup
    deck.new(TPL_CLOSING)

    deck.finalize(out)
    return dict(cutoff=cutoff, week=(lw_a, lw_b), iso_week=iso_wk, kpi=k_lw, kpi_prev=k_pw,
                data_max_crm=data_max_crm, data_max_sales=data_max_sales)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=".")
    ap.add_argument("--template", default="deck slide.pptx")
    ap.add_argument("--out", default=None)
    ap.add_argument("--today", default=None, help="YYYY-MM-DD (default: hari ini WIB)")
    a = ap.parse_args()
    today = dt.date.fromisoformat(a.today) if a.today else dt.datetime.now(TZ).date()
    out = Path(a.out) if a.out else Path("output") / f"AM_Report_Smallholder_{today:%Y-%m-%d}.pptx"
    info = build(Path(a.data_dir), Path(a.template), out, today)
    print(f"OK -> {out}")
    for k, v in info.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
