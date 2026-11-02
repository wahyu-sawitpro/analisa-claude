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
import re
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
def norm_phone(x):
    """08xx / 628xx / 8xx / '8xx.0' -> '8xx' (digits only), None if not a phone."""
    if x is None or (isinstance(x, float) and pd.isna(x)) or pd.isna(x):
        return None
    d = re.sub(r"\D", "", str(x).split(".")[0])
    if d.startswith("62"):
        d = d[2:]
    d = d.lstrip("0")
    return d if len(d) >= 8 else None


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
    crm["phone"] = crm["cleaned phone"].map(norm_phone)
    crm = crm[crm["date"].notna()]

    sales["date"] = pd.to_datetime(sales["sale_order_date"], format="%d/%m/%Y", errors="coerce")
    sales["am"] = sales["pic_name"].fillna("(Tanpa PIC)").str.strip()
    for c in ["gmv", "nett_sales", "qty"]:
        sales[c] = to_num(sales[c])
    sales["phone"] = sales["customer_phone"].map(norm_phone)
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
    text(slide, MX, TOP, deck.W - 2 * MX, int(0.4 * IN), title, size=20 if len(title) <= 48 else 17, bold=True)
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
            cell.text = str(val) if str(val) != "" else " "
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


ROWS_PER_PAGE = 15


def paged_table(deck, title, subtitle, cols, rows, widths, *, footer_rows=None, highlight_col=None,
                x=None, w=None, y=None, per_page=ROWS_PER_PAGE, legend=None, first_extra=None, label=None,
                empty_row=None):
    """Render ALL rows; continue onto extra slides ("cont.") when they don't fit on one slide."""
    x = MX if x is None else x
    w = (deck.W - 2 * MX) if w is None else w
    y0 = TOP + int(0.72 * IN) if y is None else y
    rows = list(rows) or ([empty_row] if empty_row else [])
    footer_rows = footer_rows or []
    if legend:
        per_page -= 2
    if label:
        per_page -= 1
    chunks = [rows[i:i + per_page] for i in range(0, len(rows), per_page)] or [[]]
    if footer_rows and len(chunks[-1]) + len(footer_rows) > per_page:
        chunks.append([])
    slides = []
    for i, chunk in enumerate(chunks):
        s = deck.new()
        t = title if i == 0 else f"{title} (cont.)"
        header(deck, s, t, subtitle)
        yy = y0
        if legend:
            text(s, MX, yy - int(0.04 * IN), deck.W - 2 * MX, int(0.36 * IN), legend, size=8, color=MUTED)
            yy += int(0.38 * IN)
        if label:
            text(s, x, yy, w, int(0.22 * IN), label, size=10, bold=True, color=GREEN)
            yy += int(0.26 * IN)
        body = chunk + (footer_rows if i == len(chunks) - 1 else [])
        if body:
            table(s, x, yy, w, cols, body, widths, highlight_col=highlight_col)
        if i == 0 and first_extra:
            first_extra(s)
        slides.append(s)
    return slides


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


# ================================================================ insights
def compute_insights(crm, sales, weeks, cutoff):
    """Rule-based analysis. Returns dict of tables + list of insight sentences."""
    lw_a, lw_b = weeks[-1]
    pw_a, pw_b = weeks[-2]
    base_a = weeks[-5][0]            # 4 weeks before last week
    base_b = weeks[-2][1]
    crm_lw, sal_lw = in_range(crm, lw_a, lw_b), in_range(sales, lw_a, lw_b)
    crm_pw, sal_pw = in_range(crm, pw_a, pw_b), in_range(sales, pw_a, pw_b)
    crm_base, sal_base = in_range(crm, base_a, base_b), in_range(sales, base_a, base_b)
    out = {"insights": [], "actions": []}

    # ---- 1. GMV drivers --------------------------------------------------
    g_lw = sal_lw.groupby("am")["gmv"].sum()
    g_pw = sal_pw.groupby("am")["gmv"].sum()
    g_avg = sal_base.groupby("am")["gmv"].sum() / 4
    ams = g_lw.index.union(g_pw.index).union(g_avg.index)
    mv = pd.DataFrame({"lw": g_lw, "pw": g_pw, "avg4": g_avg}).reindex(ams).fillna(0)
    mv["d_pw"] = mv["lw"] - mv["pw"]
    mv["d_avg"] = mv["lw"] - mv["avg4"]
    tot_lw, tot_avg = mv["lw"].sum(), mv["avg4"].sum()
    if tot_avg > 0:
        d = (tot_lw - tot_avg) / tot_avg
        out["insights"].append(
            f"Team GMV {fmt_idr(tot_lw)} is {abs(d)*100:.0f}% {'above' if d >= 0 else 'below'} "
            f"the prior 4-week average ({fmt_idr(tot_avg)}/week).")
    up = mv[mv["d_avg"] > 0].sort_values("d_avg", ascending=False).head(2)
    dn = mv[mv["d_avg"] < 0].sort_values("d_avg").head(2)
    if len(up):
        out["insights"].append("Biggest GMV gain vs 4-week avg: " + "; ".join(
            f"{am} (+{fmt_idr(r.d_avg)})" for am, r in up.iterrows()) + ".")
    if len(dn):
        out["insights"].append("Biggest GMV drop vs 4-week avg: " + "; ".join(
            f"{am} (−{fmt_idr(-r.d_avg)})" for am, r in dn.iterrows()) + ".")
    p_lw = sal_lw.groupby("item_name")["gmv"].sum()
    p_avg = sal_base.groupby("item_name")["gmv"].sum() / 4
    pm = (p_lw.reindex(p_lw.index.union(p_avg.index)).fillna(0)
          - p_avg.reindex(p_lw.index.union(p_avg.index)).fillna(0)).sort_values()
    if len(pm) and pm.iloc[0] < 0:
        out["insights"].append(f"Product with the largest GMV decline vs 4-week avg: {pm.index[0]} (−{fmt_idr(-pm.iloc[0])}).")
    if len(pm) and pm.iloc[-1] > 0:
        out["insights"].append(f"Product with the largest GMV increase vs 4-week avg: {pm.index[-1]} (+{fmt_idr(pm.iloc[-1])}).")

    # ---- 2. AMs needing attention -----------------------------------------
    flags = []
    e_lw = crm_lw.groupby("am").size()
    e_avg = crm_base.groupby("am").size() / 4
    inv_lw = sal_lw.groupby("am")["main_invoice_no"].nunique()
    resp = crm_lw.groupby("am")["responded"].sum()
    reach = crm_lw.groupby("am")["reached"].sum() / resp.where(resp > 0)
    team_reach = crm_lw["reached"].sum() / max(crm_lw["responded"].sum(), 1)
    for am in e_lw.index.union(e_avg.index):
        el, ea = e_lw.get(am, 0), e_avg.get(am, 0)
        if el >= 20 and inv_lw.get(am, 0) == 0:
            flags.append((am, f"{fmt_int(el)} engagements but no invoice last week"))
        if resp.get(am, 0) >= 20 and reach.get(am, 1) < team_reach - 0.15:
            flags.append((am, f"reach rate {fmt_pct(reach[am])} vs team {fmt_pct(team_reach)}"))
        if ea >= 20 and el < 0.5 * ea:
            flags.append((am, f"engagements fell to {fmt_int(el)} from avg {fmt_int(ea)}/week"))
    out["flags"] = flags

    # ---- 3. CRM -> sales conversion (contacts in the last 4 weeks) ---------
    c4 = in_range(crm, weeks[-4][0], lw_b)
    c4 = c4[c4["phone"].notna()].sort_values("date")
    first = c4.groupby(["am", "phone"], as_index=False)["date"].min()
    sal_cut = sales[(sales["date"] <= pd.Timestamp(cutoff)) & sales["phone"].notna()]
    m = first.merge(sal_cut[["phone", "date", "gmv", "main_invoice_no"]], on="phone", how="left", suffixes=("", "_s"))
    m = m[m["date_s"].isna() | (m["date_s"] >= m["date"])]
    conv = m[m["date_s"].notna()]
    ct = first.groupby("am")["phone"].nunique().rename("contacted").to_frame()
    ct["converted"] = conv.groupby("am")["phone"].nunique()
    ct["gmv"] = conv.groupby("am")["gmv"].sum()
    ct = ct.fillna(0)
    ct["rate"] = ct["converted"] / ct["contacted"].where(ct["contacted"] > 0)
    out["conversion"] = ct.sort_values(["converted", "contacted"], ascending=False)
    out["conv_window"] = (weeks[-4][0], lw_b)
    tc, tv = ct["contacted"].sum(), ct["converted"].sum()
    if tc:
        out["insights"].append(
            f"CRM→sales conversion (contacts {d_id(weeks[-4][0])} – {d_id(lw_b)}): "
            f"{fmt_int(tv)} of {fmt_int(tc)} leads bought ({tv/tc*100:.1f}%), GMV {fmt_idr(ct['gmv'].sum())}.")

    # ---- 4. Hot prospects not yet converted (last 30 days) -----------------
    h = in_range(crm, cutoff - dt.timedelta(days=29), cutoff)
    h = h[h["hot"] & h["phone"].notna()].sort_values("date").groupby("phone").tail(1)
    bought = sal_cut.groupby("phone")["date"].max()
    h = h[~h.apply(lambda r: r["phone"] in bought.index and bought[r["phone"]] >= r["date"], axis=1)] if len(h) else h
    h = h.sort_values("date", ascending=False)
    out["hot_open"] = h
    if len(h):
        by = h.groupby("am").size().sort_values(ascending=False)
        out["actions"].append(
            f"Follow up {fmt_int(len(h))} hot prospects (last 30 days) with no order yet — "
            + ", ".join(f"{am} {n}" for am, n in by.head(4).items()) + ".")

    # ---- 5. Churn risk: regular buyers gone quiet --------------------------
    hist = sales[sales["date"] <= pd.Timestamp(cutoff)]
    six = hist[hist["date"] > pd.Timestamp(cutoff - dt.timedelta(days=180))]
    cs = six.groupby("customer_id").agg(
        name=("customer_name", "first"), am=("am", lambda x: x.mode().iat[0]),
        months=("date", lambda x: x.dt.to_period("M").nunique()),
        orders=("main_invoice_no", "nunique"), gmv=("gmv", "sum"), last=("date", "max"))
    risk = cs[(cs["months"] >= 3) & (cs["last"] < pd.Timestamp(cutoff - dt.timedelta(days=45)))]
    out["churn"] = risk.sort_values("gmv", ascending=False)
    if len(risk):
        out["actions"].append(
            f"Re-engage {fmt_int(len(risk))} regular customers (orders in ≥3 of the last 6 months) with no order "
            f"in 45+ days — {fmt_idr(risk['gmv'].sum())} GMV in the last 6 months at risk.")

    # ---- 6. Rejection reason trend -----------------------------------------
    rs = crm[crm["Alasan customer tidak tertarik"].notna()].copy()
    rs["reason"] = rs["Alasan customer tidak tertarik"].str.strip().map(lambda x: REASON_EN.get(x, x))
    wk = {}
    for i, (a_, b_) in enumerate(weeks[-4:]):
        wk[i] = in_range(rs, a_, b_)["reason"].value_counts()
    wt = pd.DataFrame(wk).fillna(0)
    rising = []
    for reason, r in wt.iterrows():
        if r[3] >= 5 and r[3] > r[2] > r[1]:
            rising.append(f"'{reason}' rose 3 weeks in a row ({int(r[1])}→{int(r[2])}→{int(r[3])})")
        elif r[3] >= 5 and r[3] >= 1.5 * max(r[0:3].mean(), 1):
            rising.append(f"'{reason}' jumped to {int(r[3])} (avg {r[0:3].mean():.0f}/week)")
    out["reason_trend"] = wt
    if rising:
        out["insights"].append("Rejection reasons rising: " + "; ".join(rising[:2]) + ".")

    # ---- 7. Data quality ---------------------------------------------------
    dq = crm_lw.groupby("am").agg(total=("am", "size"), empty=("responded", lambda x: int((~x).sum())))
    dq["pct"] = dq["empty"] / dq["total"]
    dq = dq[dq["empty"] > 0].sort_values("empty", ascending=False)
    out["dq"] = dq
    if len(dq):
        tot = dq["empty"].sum()
        out["actions"].append(
            f"{fmt_int(tot)} engagements last week have no 'Respon Pengguna' filled in "
            f"({tot/len(crm_lw)*100:.0f}% of all) — mostly " + ", ".join(dq.index[:3]) + ".")
    merged = {}
    for am, why in flags:
        merged.setdefault(am, []).append(why)
    for am, whys in list(merged.items())[:4]:
        out["actions"].append(f"Check in with {am}: " + "; ".join(whys) + ".")

    # data freshness caveat goes first
    smax, cmax = sales["date"].max().date(), crm["date"].max().date()
    if smax < lw_b:
        out["insights"].insert(0, f"Caution: Sales data only runs to {d_id(smax)}, so last week's GMV figures are incomplete.")
    if cmax < lw_b:
        out["insights"].insert(0, f"Caution: CRM data only runs to {d_id(cmax)}, so last week's activity figures are incomplete.")
    return out


def insight_slides(deck, ins, iso_wk, cutoff):
    W = deck.W
    gap = int(0.14 * IN)
    half = (W - 2 * MX - gap) // 2
    y = TOP + int(0.68 * IN)

    # ---- Key insights & actions
    s = deck.new()
    header(deck, s, f"Key Insights & Action Items — W{iso_wk}", "Generated automatically from CRM and Sales data")
    text(s, MX, y, half, int(0.25 * IN), "What happened", size=11, bold=True, color=GREEN)
    text(s, MX, y + int(0.32 * IN), half, int(3.3 * IN),
         [[("•  ", {"bold": True, "color": GREEN}), (t, {})] for t in ins["insights"][:8]] or ["No notable changes."],
         size=9)
    x2 = MX + half + gap
    rect(s, x2, y - int(0.06 * IN), half, int(3.55 * IN), LIGHT)
    pad = int(0.14 * IN)
    text(s, x2 + pad, y, half - 2 * pad, int(0.25 * IN), "What to do this week", size=11, bold=True, color=GREEN)
    text(s, x2 + pad, y + int(0.32 * IN), half - 2 * pad, int(3.1 * IN),
         [[(f"{i+1}.  ", {"bold": True, "color": GREEN}), (t, {})] for i, t in enumerate(ins["actions"][:7])]
         or ["No action items."], size=9)

    # ---- Conversion (all AMs) + needs-attention panel on the first page
    a, b = ins["conv_window"]
    ct = ins["conversion"]
    ct = ct[ct["contacted"] > 0]
    rows = [[am, fmt_int(r["contacted"]), fmt_int(r["converted"]), fmt_pct(r["rate"]),
             fmt_idr(r["gmv"]) if r["gmv"] else "–"] for am, r in ct.iterrows()]
    tc, tv = ct["contacted"].sum(), ct["converted"].sum()
    total = [[("Total", INK), fmt_int(tc), fmt_int(tv), fmt_pct(tv / tc) if tc else "–", fmt_idr(ct["gmv"].sum())]]
    tw = int((W - 2 * MX) * 0.62)
    merged = {}
    for am, why in ins["flags"]:
        merged.setdefault(am, []).append(why)

    def flags_panel(s):
        xn = MX + tw + gap
        wn = W - MX - xn
        text(s, xn, y, wn, int(0.25 * IN), "Needs attention", size=10, bold=True, color=GREEN)
        lines = [[("•  ", {"bold": True, "color": RED}), (f"{am}: ", {"bold": True}), ("; ".join(w), {})]
                 for am, w in merged.items()] or ["No AM flags this week."]
        text(s, xn, y + int(0.3 * IN), wn, int(3.2 * IN), lines, size=8 if len(lines) <= 8 else 7)

    paged_table(deck, "CRM → Sales Conversion per Account Manager",
                f"Leads first contacted {d_id(a)} – {d_id(b)} (matched by phone) that ordered on/after contact, up to {d_id(cutoff)}",
                ["Account Manager", "Leads contacted", "Converted", "Conv. rate", "GMV from converted"],
                rows, [2.4, 1.2, 1, 1, 1.4], footer_rows=total, highlight_col=3, w=tw, first_extra=flags_panel,
                empty_row=["(no contacts)", "", "", "", ""])

    # ---- Follow-up 1: hot prospects not yet converted (all rows)
    h = ins["hot_open"]
    stage_lbl = {
        "High Prospect - Segera transaksi": ("High prospect — buy now", RED),
        "Prospect - Transaksi dalam sebulan": ("Prospect — within 1 month", ORANGE),
    }
    hr = []
    for _, r in h.iterrows():
        lbl, col = stage_lbl.get(str(r["Respon Pengguna"]).strip(), (str(r["Respon Pengguna"]), INK))
        prod = r.get("Product yang diminta customer")
        if pd.isna(prod) or not str(prod).strip():
            prod = r.get("Pupuk Ditawarkan")
        prod = "–" if pd.isna(prod) or not str(prod).strip() else str(prod)
        hr.append([(str(r["Nama Customer"]) if pd.notna(r["Nama Customer"]) else "(no name)")[:24], r["am"],
                   r["date"].strftime("%d %b %Y"), fmt_int((pd.Timestamp(cutoff) - r["date"]).days),
                   (lbl, col), prod[:30] + ("…" if len(prod) > 30 else "")])
    n_high = sum(1 for _, r in h.iterrows() if str(r["Respon Pengguna"]).startswith("High"))
    paged_table(deck, f"Follow-up: Hot Prospects Not Yet Converted ({fmt_int(len(h))})",
                f"Contacted in the last 30 days (to {d_id(cutoff)}), marked hot in CRM, no order since the last contact  •  "
                f"{n_high} high prospect, {len(h)-n_high} prospect",
                ["Customer", "Account Manager", "Last contact", "Days ago", "Stage", "Product requested / offered"],
                hr, [1.7, 1.9, 1.05, 0.75, 1.75, 2.6],
                legend=[[("Stage:  ", {"bold": True, "color": INK}),
                         ("High prospect — buy now", {"bold": True, "color": RED}),
                         (" = customer said they will order immediately (CRM: 'High Prospect – Segera transaksi').   ", {}),
                         ("Prospect — within 1 month", {"bold": True, "color": ORANGE}),
                         (" = expected to order within a month (CRM: 'Prospect – Transaksi dalam sebulan').", {})]],
                empty_row=["(none — all hot prospects have ordered)", "", "", "", "", ""])

    # ---- Follow-up 2: churn risk (all rows)
    c = ins["churn"]
    cr = [[str(r["name"])[:28], str(r["am"]), r["last"].strftime("%d %b %Y"),
           fmt_int((pd.Timestamp(cutoff) - r["last"]).days), fmt_int(r["months"]), fmt_int(r["orders"]), fmt_idr(r["gmv"])]
          for _, r in c.iterrows()]
    paged_table(deck, f"Follow-up: Regular Customers at Churn Risk ({fmt_int(len(c))})",
                f"Ordered in ≥3 of the last 6 months but no order in the last 45+ days (to {d_id(cutoff)})  •  "
                f"GMV at risk {fmt_idr(c['gmv'].sum()) if len(c) else 'IDR 0'}",
                ["Customer", "Account Manager", "Last order", "Days since", "Active months (6M)", "Orders (6M)", "GMV (6M)"],
                cr, [2, 2, 1.1, 0.9, 1.2, 1, 1.2], highlight_col=6,
                empty_row=["(none)", "", "", "", "", "", ""])

    # ---- Data quality (all AMs) + rejection trend chart on the first page
    dq = ins["dq"]
    dr = [[am, fmt_int(r["total"]), fmt_int(r["empty"]), fmt_pct(r["pct"])] for am, r in dq.iterrows()]

    def reason_chart(s):
        wt = ins["reason_trend"]
        if len(wt):
            wt = wt.loc[wt.sum(axis=1).sort_values(ascending=False).index].head(8)
            bar_chart(s, MX + half + gap, y, half, int(3.45 * IN),
                      [r[:30] + ("…" if len(r) > 30 else "") for r in wt.index][::-1],
                      [(f"W{(cutoff - dt.timedelta(days=7*(3-i))).isocalendar()[1]}", wt[i].tolist()[::-1]) for i in range(4)],
                      [GREY, YELLOW, ORANGE, GREEN], title="Reasons for no interest — last 4 weeks",
                      kind=XL_CHART_TYPE.BAR_CLUSTERED, labels=False)

    paged_table(deck, f"CRM Data Quality & Rejection Trend — W{iso_wk}",
                "Engagements without a recorded response, and reasons for no interest over the last 4 weeks",
                ["Account Manager", "Engagements", "No response", "% empty"],
                dr, [2.4, 1.1, 1.1, 0.9], highlight_col=3, w=half, y=y, label="Response not filled in (last week)",
                first_extra=reason_chart, empty_row=["All filled in ✓", "", "", ""])


def channel_slides(deck, crm, crm_lw, weeks, iso_wk, lw_a, lw_b):
    """Engagement type (channel) + lead source breakdown."""
    W = deck.W
    gap = int(0.14 * IN)
    half = (W - 2 * MX - gap) // 2
    y = TOP + int(0.68 * IN)
    order = ["Phone Call", "WhatsApp / Text", "Onsite", "Social Media", "Conference Call", "(Not filled)"]
    colors = [GREEN, YELLOW, ORANGE, RGBColor(0x4C, 0xAF, 0x50), RGBColor(0x8D, 0x6E, 0x63), GREY]
    c6 = in_range(crm, weeks[0][0], weeks[-1][1]).copy()
    c6["ch"] = c6["Engagement Type"].fillna("(Not filled)").str.strip()
    extra = [t for t in c6["ch"].unique() if t not in order]
    chans = [t for t in order if t in set(c6["ch"])] + sorted(extra)
    cmap = {t: colors[order.index(t)] if t in order else MUTED for t in chans}

    # ---- slide A: trend + channel effectiveness + lead source
    s = deck.new()
    header(deck, s, f"CRM Engagement Channels — W{iso_wk}",
           "Where engagements happen (Engagement Type) and where leads come from (Sumber Lead)")
    cats, series = [], {t: [] for t in chans}
    for a, b in weeks:
        cats.append(f"W{a.isocalendar()[1]}")
        vc = in_range(c6, a, b)["ch"].value_counts()
        for t in chans:
            series[t].append(int(vc.get(t, 0)))
    ch = bar_chart(s, MX, y, half, int(3.45 * IN), cats, [(t, series[t]) for t in chans], [cmap[t] for t in chans],
                   title="Engagements by channel — last 6 weeks", kind=XL_CHART_TYPE.COLUMN_STACKED, labels=False)

    lw = crm_lw.copy()
    lw["ch"] = lw["Engagement Type"].fillna("(Not filled)").str.strip()
    g = lw.groupby("ch").agg(n=("ch", "size"), resp=("responded", "sum"), reached=("reached", "sum"),
                             hot=("hot", "sum"), leads=("lead_key", "nunique"))
    g = g.reindex([t for t in chans if t in g.index])
    tot = g["n"].sum() or 1
    rows = [[t, fmt_int(r["n"]), f"{r['n']/tot*100:.0f}%", fmt_int(r["leads"]),
             fmt_pct(r["reached"] / r["resp"]) if r["resp"] else "–", fmt_int(r["hot"])] for t, r in g.iterrows()]
    rows.append([("Total", INK), fmt_int(g["n"].sum()), "100%", fmt_int(lw["lead_key"].nunique()),
                 fmt_pct(g["reached"].sum() / g["resp"].sum()) if g["resp"].sum() else "–", fmt_int(g["hot"].sum())])
    x2 = MX + half + gap
    text(s, x2, y, half, int(0.22 * IN), f"Channel results — W{iso_wk}", size=10, bold=True, color=GREEN)
    table(s, x2, y + int(0.26 * IN), half, ["Channel", "Engagements", "Share", "Leads", "Reach", "Hot"],
          rows, [1.7, 1.25, 0.7, 0.75, 0.75, 0.55], row_h=int(0.2 * IN))
    src = lw["Sumber Lead"].fillna("(Not filled)").str.strip().value_counts()
    ys = y + int(0.26 * IN) + int(0.2 * IN) * (len(rows) + 1) + int(0.15 * IN)
    text(s, x2, ys, half, int(0.22 * IN), f"Lead source — W{iso_wk}", size=10, bold=True, color=GREEN)
    text(s, x2, ys + int(0.25 * IN), half, int(1.2 * IN),
         [[(f"{k}: ", {"bold": True}), (f"{fmt_int(v)} ({v/tot*100:.0f}%)", {})] for k, v in src.items()],
         size=8)

    # ---- slide B: per AM x channel (all AMs)
    pv = lw.pivot_table(index="am", columns="ch", values="Engagement ID", aggfunc="count", fill_value=0)
    pv = pv.reindex(columns=[t for t in chans if t in pv.columns], fill_value=0)
    pv["Total"] = pv.sum(axis=1)
    pv = pv.sort_values("Total", ascending=False)
    cols = list(pv.columns)
    rows = [[am] + [fmt_int(r[c]) if r[c] else "–" for c in cols] for am, r in pv.iterrows()]
    total = [[("Total", INK)] + [fmt_int(pv[c].sum()) for c in cols]]
    short = {"WhatsApp / Text": "WhatsApp", "Conference Call": "Conf. call", "(Not filled)": "Not filled"}
    paged_table(deck, f"Engagement Channels per Account Manager — W{iso_wk}",
                f"{d_id(lw_a)} – {d_id(lw_b)}  •  number of engagements by Engagement Type",
                ["Account Manager"] + [short.get(c, c) for c in cols], rows,
                [2.6] + [1] * (len(cols) - 1) + [0.9], footer_rows=total, highlight_col=len(cols),
                empty_row=["(no engagements)"] + [""] * len(cols))


# ================================================================ slides
def build(data_dir: Path, template: Path, out: Path, today: dt.date):
    crm, sales = load(data_dir)
    cutoff, weeks = periods(today)
    lw_a, lw_b = weeks[-1]
    pw_a, pw_b = weeks[-2]
    iso_wk = lw_a.isocalendar()[1]
    m_end = cutoff if cutoff.day >= 7 else (cutoff.replace(day=1) - dt.timedelta(days=1))
    year_start = dt.date(m_end.year, 1, 1)

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
    rows = []
    for am, r in t_lw.iterrows():
        d = "–"
        dc = MUTED
        if r.get("gmv_prev", 0) > 0 or r["gmv"] > 0:
            diff = r["gmv"] - r.get("gmv_prev", 0)
            d = ("+" if diff >= 0 else "−") + fmt_idr(abs(diff))
            dc = GREEN if diff > 0 else (RED if diff < 0 else MUTED)
        rows.append([am, fmt_int(r["engagements"]), fmt_int(r["leads"]), fmt_pct(r["reach"]),
                     fmt_int(r["hot"]), fmt_int(r["invoices"]), fmt_int(r["customers"]),
                     fmt_idr(r["gmv"]), (d, dc)])
    paged_table(deck, f"Account Manager Performance — W{iso_wk}",
                f"{d_id(lw_a)} – {d_id(lw_b)}  •  sorted by GMV  •  Δ GMV vs prior week",
                ["Account Manager", "Engagements", "Unique leads", "Reach", "Hot", "Invoices", "Customers", "GMV", "Δ GMV"],
                rows, [2.4, 1.2, 1.1, 0.8, 0.6, 0.8, 0.95, 1.3, 1.4], highlight_col=7,
                empty_row=["(no activity)", "", "", "", "", "", "", "", ""])

    # ---------------------------------------------------------- 4a. engagement channels
    channel_slides(deck, crm, crm_lw, weeks, iso_wk, lw_a, lw_b)

    # ---------------------------------------------------------- 4b. insights (rule-based)
    ins = compute_insights(crm, sales, weeks, cutoff)
    insight_slides(deck, ins, iso_wk, cutoff)

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
    header(deck, s, f"Monthly Trend {m_end.year} (YTD)",
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
    piv = sal_ytd.pivot_table(index="am", columns="m", values="gmv", aggfunc="sum", fill_value=0)
    piv = piv.reindex(columns=months, fill_value=0)
    piv["YTD"] = piv.sum(axis=1)
    inv_ytd = sal_ytd.groupby("am")["main_invoice_no"].nunique()
    cus_ytd = sal_ytd.groupby("am")["customer_id"].nunique()
    piv = piv.sort_values("YTD", ascending=False)
    ytd_tot = piv["YTD"].sum() or 1
    rows = []
    for am, r in piv.iterrows():
        rows.append([am] + [fmt_idr(r[m]) if r[m] else "–" for m in last3] +
                    [fmt_idr(r["YTD"]), fmt_int(inv_ytd.get(am, 0)), fmt_int(cus_ytd.get(am, 0)),
                     f"{r['YTD']/ytd_tot*100:.0f}%"])
    total = [[("Total", INK)] + [fmt_idr(piv[m].sum()) for m in last3] +
             [fmt_idr(piv["YTD"].sum()), fmt_int(sal_ytd["main_invoice_no"].nunique()),
              fmt_int(sal_ytd["customer_id"].nunique()), "100%"]]
    lab3 = [mlabel[list(months).index(m)] for m in last3]
    paged_table(deck, "GMV per Account Manager — Monthly",
                f"Last 3 months + YTD  {('•  ' + partial_note) if partial_note else ''}",
                ["Account Manager"] + lab3 + ["GMV YTD", "Invoices YTD", "Customers YTD", "Share"],
                rows, [2.5] + [1.15] * len(last3) + [1.25, 1.1, 1.3, 0.8], footer_rows=total,
                highlight_col=len(last3) + 1)

    # ---------------------------------------------------------- 8. aktivitas CRM per AM per bulan
    pe = crm_ytd.pivot_table(index="am", columns="m", values="Engagement ID", aggfunc="count", fill_value=0)
    pe = pe.reindex(columns=months, fill_value=0)
    pe["YTD"] = pe.sum(axis=1)
    lm = crm_ytd[crm_ytd["m"] == last3[-1]]
    lm_resp = lm.groupby("am")["responded"].sum()
    lm_reach = lm.groupby("am")["reached"].sum() / lm_resp.where(lm_resp > 0)
    lm_hot = lm.groupby("am")["hot"].sum()
    lm_new = lm.groupby("am")["new_lead"].sum()
    pe = pe.sort_values([last3[-1], "YTD"], ascending=False)
    pe = pe[pe[last3].sum(axis=1) > 0]
    rows = []
    for am, r in pe.iterrows():
        rows.append([am] + [fmt_int(r[m]) for m in last3] +
                    [fmt_pct(lm_reach.get(am, float("nan"))), fmt_int(lm_hot.get(am, 0)), fmt_int(lm_new.get(am, 0)),
                     fmt_int(r["YTD"])])
    paged_table(deck, "CRM Activity per Account Manager — Monthly",
                f"Engagements per month (last 3 months) + reach rate & hot prospects for the latest month  "
                f"{('•  ' + partial_note) if partial_note else ''}",
                ["Account Manager"] + lab3 + [f"Reach {lab3[-1]}", f"Hot {lab3[-1]}", f"New leads {lab3[-1]}", "Engagements YTD"],
                rows, [2.6] + [1] * len(last3) + [1.1, 1, 1.2, 1.3], highlight_col=len(last3))

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
