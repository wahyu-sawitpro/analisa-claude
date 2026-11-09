"""
Customer LTV & Upsell / Cross-sell Report — Smallholder (output in English)

Membaca:
  - detail customer smallholder.csv  (wajib; 1 baris per customer: total_sales,
    total_invoice, avg_sales, days_since_last_order, account_manager,
    total_area_hectare, ...)
  - Sales Smallholder.csv            (opsional; dipakai untuk kategori produk
    yang sudah/belum dibeli tiap customer -> rekomendasi upsell produk)

Menghasilkan:
  - Deck .pptx berbasis template "deck slide.pptx" (sama dengan AM report)
  - Workbook .xlsx berisi daftar lengkap per kategori (untuk ditindaklanjuti AM)

Logika utama
  LTV          = total_sales customer (periode data di file).
  LTV tier     = Platinum (top 10% LTV), Gold (10–30%), Silver (30–60%), Bronze (sisa).
  Status       = Active (<= 90 hari sejak order terakhir), At risk (91–180), Dormant (> 180).

  Cross-sell KebunPRO (subscription IDR 20.000 / hektar / bulan, min. 50 ha)
    A. Area diketahui: total_area_hectare >= 50 -> Eligible.
       MRR = hektar x 20.000; ARR = MRR x 12.
       Area > 500 ha ditandai "Verify area" (tidak wajar untuk smallholder).
    B. Area TIDAK diketahui (total_area_hectare = 0): area diestimasi dari total
       penjualan:  est. hektar = total_sales / benchmark penjualan per hektar.
       Benchmark = median (total_sales / hektar) dari customer yang area-nya
       diketahui & wajar (1–500 ha), dihitung ulang tiap run dari data.
       Est. hektar >= 50 -> "Potential (sales-based)" -> AM wajib verifikasi luas kebun.

  Upselling (naikkan nilai belanja customer yang masih aktif)
    Kandidat = Active (<= 90 hari) DAN (tier Platinum/Gold ATAU >= 2 invoice).
    Wallet gap (jika area diketahui) = hektar x benchmark P75 penjualan per hektar
    – total_sales (minimal 0) = ruang belanja yang belum diambil SawitPRO.
    Kategori produk inti yang belum pernah dibeli (dari Sales Smallholder.csv)
    ditampilkan sebagai rekomendasi produk berikutnya.

  Win-back
    Tier Platinum/Gold yang sudah At risk / Dormant (LTV berisiko hilang).

Pemakaian:
  python reporting/ltv_report.py --data-dir . --template "deck slide.pptx" \
      --out output/LTV_Report.pptx [--xlsx output/LTV_Report.xlsx] [--today 2026-11-09]
"""
from __future__ import annotations

import argparse
import ast
import re
import datetime as dt
from pathlib import Path

import pandas as pd
from pptx.enum.chart import XL_CHART_TYPE

from am_report import (
    GREEN, GREY, IN, INK, LIGHT, MUTED, MX, ORANGE, RED, TOP, TPL_CLOSING, TPL_COVER, TZ,
    Deck, bar_chart, d_id, fmt_idr, fmt_int, header, norm_phone, paged_table, rect, table, text, to_num,
)

# ---------------------------------------------------------------- parameters
KEBUNPRO_MIN_HA = 50
KEBUNPRO_PRICE = 20_000          # IDR per hectare per month
AREA_MAX_PLAUSIBLE = 500         # ha; above this the area is flagged "Verify area"
ACTIVE_DAYS, AT_RISK_DAYS = 90, 180
CORE_CATS = ["Pupuk", "Pupuk Grosir", "Khusus Petani", "Toling", "Benih", "Racun"]
# Product channels (business rules):
#   Pupuk          = retail price (normal margin) -> preferred product to grow
#   Pupuk Grosir   = wholesale / bulk price
#   Toling         = low price; SawitPRO truck visits a specific area within one day
#   Khusus Petani  = subsidised price, max 10 MT per customer per month; sold at a loss -> never pushed as upsell
KP_CAT, TOLING_CAT, RETAIL_CAT, GROSIR_CAT = "Khusus Petani", "Toling", "Pupuk", "Pupuk Grosir"
KP_CAP_MT = 10                   # Khusus Petani limit per customer per month (metric tons)
KP_NEAR_CAP = 0.8                # >= 80% of the cap in a month counts as "near the cap"
KP_HEAVY_SHARE = 0.5             # >= 50% of LTV from Khusus Petani = subsidy-dependent customer
DECK_TOP_N = 30                  # rows per list in the deck; the xlsx always has all rows

DETAIL_FILE = "detail customer smallholder.csv"
SALES_FILE = "Sales Smallholder.csv"
CRM_FILE = "CRM Smallholder.csv"
NO_LOC = "(no location)"          # label in the deck when no source has a location; blank in the xlsx
REGION_MIN_CUSTOMERS = 5         # provinces with at least this many customers get their own slide
REGION_TOP_N = 10                # top customers per region slide
REGION_OFFER_N = 12              # 'who to offer' rows per region (full sentences)
UPSELL_DECK_N = 18               # upsell rows in the deck (full sentences)
SENT_PER_PAGE = 8                # rows per slide (6 after the legend) when a column holds full sentences


# ================================================================ data
def _parse_list(s):
    try:
        v = ast.literal_eval(str(s))
        return v if isinstance(v, list) else []
    except Exception:
        return []


def _first_location(s) -> str:
    """'[[Kuala Gasib, Koto Gasib, Siak, Riau], ...]' -> 'Siak, Riau' (regency, province of first farm)."""
    s = str(s or "").strip()
    if not s.startswith("[["):
        return ""
    first = s[2:].split("]")[0]
    parts = [p.strip() for p in first.split(",") if p.strip()]
    return ", ".join(parts[-2:]) if parts else ""


def _split_locations(s) -> list[list[str]]:
    """'[[Kuala Gasib, Koto Gasib, Siak, Riau], [Sam Sam, ...]]' -> [['Kuala Gasib', ..., 'Riau'], ...]"""
    s = str(s or "").strip()
    if not s.startswith("[["):
        return []
    return [[p.strip() for p in chunk.split(",") if p.strip()]
            for chunk in s[2:-2].split("], [")]


def _main_farm(row) -> tuple[str, str]:
    """(regency, province) of the customer's largest farm (by hectares)."""
    locs = _split_locations(row["farm_location"])
    if not locs:
        return "", ""
    areas = _parse_list(row["area_hectare"])
    i = max(range(len(locs)), key=lambda k: areas[k] if k < len(areas) and isinstance(areas[k], (int, float)) else -1)
    loc = locs[i]
    return (loc[-2] if len(loc) >= 2 else ""), (loc[-1] if loc else "")


BAD_PLACES = {"", "NO PROVINCE", "NO CITY", "INDONESIA", "NAN", "NONE"}


def norm_province(x) -> str:
    x = str(x or "").strip()
    return "" if x.upper() in BAD_PLACES else x.title()


def norm_regency(x) -> str:
    x = re.sub(r"\s+", " ", str(x or "").strip()).upper()
    if x in BAD_PLACES:
        return ""
    x = re.sub(r"^(KABUPATEN|KAB\.?)\s+", "", x)
    x = re.sub(r"\s+(REGENCY|CITY)$", "", x)
    x = re.sub(r"^KOTA\s+", "", x)
    return x.title()


def load_detail(path: Path) -> pd.DataFrame:
    d = pd.read_csv(path, dtype=str, encoding="utf-8-sig")
    for c in ["total_invoice", "total_sales", "avg_sales", "days_since_last_order", "total_kebun", "total_area_hectare"]:
        d[c] = to_num(d[c])
    d["customer_name"] = d["customer_name"].fillna("(no name)").str.strip()
    d["account_manager"] = d["account_manager"].fillna("(No AM)").str.strip()
    d["phone"] = d["customer_phone"].map(norm_phone).map(lambda p: f"0{p}" if p else "")
    d["last_order"] = pd.to_datetime(d["last_order_date"], format="%d/%m/%Y", errors="coerce")
    d["n_farms"] = d["area_hectare"].map(lambda s: len(_parse_list(s)))
    d["location"] = d["farm_location"].map(_first_location)
    d["phone_key"] = d["customer_phone"].map(norm_phone)
    mf = d.apply(_main_farm, axis=1)
    d["farm_regency"] = mf.map(lambda t: norm_regency(t[0]))
    d["farm_province"] = mf.map(lambda t: norm_province(t[1]))
    return d


def _mode(x: pd.Series) -> str:
    x = x[x != ""]
    return x.mode().iat[0] if len(x) else ""


def load_categories(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    s = pd.read_csv(path, dtype=str)
    s["gmv"] = to_num(s["gmv"])
    s["date"] = pd.to_datetime(s["sale_order_date"], format="%d/%m/%Y", errors="coerce")
    g = s.groupby("customer_id").agg(
        cats=("product_cat", lambda x: sorted(set(x.dropna().str.strip()))),
        first_order=("date", "min"),
        sales_province=("province", lambda x: _mode(x.map(norm_province))),
        sales_regency=("city", lambda x: _mode(x.map(norm_regency))),
    )
    # product mix (share of GMV per channel) and Khusus Petani tonnage per month
    s["cat"] = s["product_cat"].fillna("").str.strip()
    s["kg"] = pd.to_numeric(s["item_name"].str.extract(r"(\d+(?:[.,]\d+)?)\s*[kK][gG]\b")[0]
                            .str.replace(",", ".", regex=False), errors="coerce")
    s["mt"] = (to_num(s["qty"]) * s["kg"] / 1000).fillna(0)
    tot = s.groupby("customer_id")["gmv"].sum().replace(0, float("nan"))
    for col, cat in (("sh_kp", KP_CAT), ("sh_tol", TOLING_CAT), ("sh_ret", RETAIL_CAT), ("sh_gro", GROSIR_CAT)):
        g[col] = (s[s["cat"] == cat].groupby("customer_id")["gmv"].sum() / tot).reindex(g.index).fillna(0)
    kp = s[s["cat"] == KP_CAT].assign(m=lambda x: x["date"].dt.to_period("M"))
    kpm = kp.groupby(["customer_id", "m"])["mt"].sum()
    g["kp_mt_max"] = kpm.groupby(level=0).max().reindex(g.index).fillna(0)
    g["kp_mt_avg"] = kpm.groupby(level=0).mean().reindex(g.index).fillna(0)
    g["kp_max_month"] = kpm.groupby(level=0).idxmax().map(lambda t: t[1].strftime("%b %Y")).reindex(g.index).fillna("")

    top = s.groupby(["customer_id", "product_cat"])["gmv"].sum().reset_index()
    top = top.sort_values("gmv", ascending=False).drop_duplicates("customer_id").set_index("customer_id")["product_cat"]
    g["top_cat"] = top
    return g


def load_location_context(data_dir: Path):
    """Sales rows + CRM kecamatan, used to fill customers/rows without a location."""
    ctx = {"sales": None, "crm": None}
    sp = data_dir / SALES_FILE
    if sp.exists():
        s = pd.read_csv(sp, dtype=str)
        s["phone"] = s["customer_phone"].map(norm_phone)
        s["prov_n"] = s["province"].map(norm_province)
        s["reg_n"] = s["city"].map(norm_regency)
        ctx["sales"] = s
    cp = data_dir / CRM_FILE
    if cp.exists():
        c = pd.read_csv(cp, dtype=str, encoding="utf-8-sig", usecols=lambda x: x in ("cleaned phone", "Kecamatan"))
        if {"cleaned phone", "Kecamatan"} <= set(c.columns):
            c["phone"] = c["cleaned phone"].map(norm_phone)
            c["kec"] = c["Kecamatan"].fillna("").str.strip()
            ctx["crm"] = c[(c["kec"] != "") & c["phone"].notna()]
    return ctx


def resolve_locations(d: pd.DataFrame, ctx) -> pd.DataFrame:
    """Province/regency per customer. Order of sources:
    1 Farm (own)  2 Farm (same phone, other account)  3 Delivery (same customer_id)
    4 Delivery (same phone, other account)  5 CRM kecamatan (same phone)  6 Unknown"""
    d = d.copy()
    d["province"], d["regency"], d["loc_source"] = "", "", ""

    def fill(mask_prov, prov, reg, label):
        m = (d["province"] == "") & mask_prov
        d.loc[m, "province"] = prov[m]
        d.loc[m, "regency"] = reg[m]
        d.loc[m, "loc_source"] = label

    has = d["farm_province"] != ""
    fill(has, d["farm_province"], d["farm_regency"], "Farm")

    farm_by_phone = d[has & d["phone_key"].notna()].drop_duplicates("phone_key").set_index("phone_key")
    fp = d["phone_key"].map(farm_by_phone["farm_province"]).fillna("")
    fr = d["phone_key"].map(farm_by_phone["farm_regency"]).fillna("")
    fill(fp != "", fp, fr, "Farm (same phone)")

    s = ctx.get("sales")
    if s is not None:
        ok = s[s["prov_n"] != ""]
        for key, col, label in (("customer_id", "customer_id", "Delivery"),
                                ("phone", "phone_key", "Delivery (same phone)")):
            g = ok.groupby(key).agg(p=("prov_n", _mode),
                                    r=("reg_n", _mode))
            pv = d[col].map(g["p"]).fillna("")
            rg = d[col].map(g["r"]).fillna("")
            fill(pv != "", pv, rg, label)

    c = ctx.get("crm")
    if c is not None:
        # CRM 'Kecamatan' looks like "Kampar - Tapung Hilir" (regency - district).
        # regency -> province is learnt from registered farm locations and Sales addresses.
        pairs = [(norm_regency(loc[-2]), norm_province(loc[-1]))
                 for v in d["farm_location"] for loc in _split_locations(v) if len(loc) >= 2]
        if s is not None:
            pairs += list(zip(s["reg_n"], s["prov_n"]))
        rp = pd.DataFrame(pairs, columns=["reg", "prov"])
        rp = rp[(rp["reg"] != "") & (rp["prov"] != "")].groupby("reg")["prov"].agg(_mode)
        ck = c.assign(reg=c["kec"].str.split(" - ").str[0].map(norm_regency))
        ck["prov"] = ck["reg"].map(rp)
        ck = ck.dropna(subset=["prov"]).groupby("phone").agg(p=("prov", _mode), r=("reg", _mode))
        pv = d["phone_key"].map(ck["p"]).fillna("")
        rg = d["phone_key"].map(ck["r"]).fillna("")
        fill(pv != "", pv, rg, "CRM kecamatan")

    d["province"] = d["province"].replace("", "Unknown")
    d["regency"] = d["regency"].replace("", "Unknown")
    d.loc[d["loc_source"] == "", "loc_source"] = "Unknown"
    return d


def location_fixes(d: pd.DataFrame, ctx) -> pd.DataFrame:
    """Sales rows that had no province/city, with the location found via the same customer_id / phone."""
    s = ctx.get("sales")
    if s is None:
        return pd.DataFrame()
    bad = s[s["prov_n"] == ""]
    look = d.set_index("customer_id")[["province", "regency", "loc_source"]]
    res = look.reindex(bad["customer_id"]).reset_index(drop=True)
    out = pd.DataFrame({
        "Order date": bad["sale_order_date"].values, "Invoice": bad["main_invoice_no"].values,
        "Customer": bad["customer_name"].values, "Phone": bad["customer_phone"].values,
        "AM (PIC)": bad["pic_name"].values, "Province in Sales": bad["province"].values,
        "City in Sales": bad["city"].values, "Resolved province": res["province"].values,
        "Resolved regency": res["regency"].values, "Found via": res["loc_source"].values})
    return out


MIX_LEGEND = [[("Product mix", {"bold": True}), (" = share of the customer's purchases:  ", {}),
               ("R", {"bold": True}), (" retail Pupuk (+ Grosir)   ", {}),
               ("KP", {"bold": True}), (f" Khusus Petani — subsidised, max {KP_CAP_MT} MT/month, sold at a loss   ", {}),
               ("T", {"bold": True}), (" Toling — low price, SawitPRO truck visits the area for one day", {})]]


def mix_label(r) -> str:
    parts = [("R", r["sh_ret"] + r["sh_gro"]), ("KP", r["sh_kp"]), ("T", r["sh_tol"])]
    return " / ".join(f"{k} {v * 100:.0f}%" for k, v in parts if v >= 0.005) or "other"


def full_offer(r) -> str:
    """Full sentence for the region 'what to offer' column: KebunPRO pitch (if eligible) + upsell suggestion."""
    out = []
    if r["kp_basis"] == "Area":
        out.append(f"Farm of {r['kp_ha']:,.0f} ha qualifies for KebunPRO (min. {KEBUNPRO_MIN_HA} ha): offer the "
                   f"subscription at {fmt_idr(r['kp_mrr'])}/month ({fmt_idr(r['kp_arr'])}/year).")
    elif r["kp_basis"] == "Sales-based":
        out.append(f"No farm data, but purchases suggest about {r['kp_ha']:,.0f} ha: confirm the farm size; if ≥ "
                   f"{KEBUNPRO_MIN_HA} ha offer KebunPRO at about {fmt_idr(r['kp_mrr'])}/month.")
    if r["status"] != "Active" and r["kp_basis"]:
        out.append(f"Last order was {int(r['days_since_last_order'])} days ago, so open with a win-back call "
                   "before pitching the subscription.")
    if r["upsell_action"]:
        first = r["upsell_action"].split(". ")[0].rstrip(".") + "."
        out.append(first if r["kp_basis"] else r["upsell_action"])
    return " ".join(out)


def suggest(r, toling_regs) -> str:
    """Full-sentence upsell suggestion for an AM, following the product-channel rules (max 3 sentences).
    Margin order: retail Pupuk > Pupuk Grosir > Toling > Khusus Petani (subsidised, sold at a loss)."""
    out = []
    reg = r["regency"] if r["regency"] != "Unknown" else "their area"
    kp_heavy = r["sh_kp"] >= KP_HEAVY_SHARE
    normal = r["sh_ret"] + r["sh_gro"]            # share bought at normal (retail / wholesale) price
    truck_here = reg in toling_regs
    # 1. Khusus Petani cap / dependency
    if r["kp_mt_max"] >= KP_CAP_MT * KP_NEAR_CAP:
        out.append(f"Already took {r['kp_mt_max']:.1f} MT of subsidised Khusus Petani in {r['kp_max_month']} "
                   f"(limit {KP_CAP_MT} MT per month), so any extra need has to be sold at normal price: offer retail "
                   f"Pupuk{' (or Pupuk Grosir if the volume is large)' if r['total_sales'] >= 1e8 else ''} for the "
                   "volume above the quota.")
    elif kp_heavy:
        out.append(f"{r['sh_kp'] * 100:.0f}% of purchases are subsidised Khusus Petani, which SawitPRO sells at a loss: "
                   f"keep it within the {KP_CAP_MT} MT/month quota and move the next order to retail Pupuk"
                   f"{' or the Toling truck' if truck_here else ''} so the account becomes profitable.")
    # 2. farm size vs spend
    if r["wallet_gap"] == r["wallet_gap"] and r["wallet_gap"] > 0:
        out.append(f"The {r['total_area_hectare']:,.0f} ha farm can absorb about {fmt_idr(r['wallet_gap'])} more "
                   "fertilizer than bought so far: propose a full-area fertilizing plan with retail Pupuk for the "
                   "next application round.")
    # 3. loyal normal-price buyer -> secure the season
    if normal >= 0.5 and not kp_heavy:
        out.append(f"Buys mostly at normal price ({normal * 100:.0f}% retail / wholesale Pupuk, "
                   f"{int(r['total_invoice'])} orders): offer a season contract or volume price for the next "
                   "application so the full-season need is ordered from SawitPRO.")
    # 4. Toling (low price, truck visits an area for one day)
    if r["sh_tol"] >= 0.5:
        out.append(f"Buys mainly from the Toling truck ({r['sh_tol'] * 100:.0f}%): share the next truck date for "
                   f"{reg} and pre-book the order; for urgent needs between truck visits offer retail Pupuk with "
                   "direct delivery.")
    elif r["sh_tol"] == 0 and truck_here and normal < 0.3 and not kp_heavy:
        out.append(f"The Toling truck already serves {reg}: invite the customer to the next one-day truck visit "
                   "to add an extra order between their regular purchases.")
    # 5. complementary products
    cats = r.get("cats") if isinstance(r.get("cats"), list) else []
    if len(out) < 3 and "Racun" not in cats:
        out.append("Add Racun (herbicide / weed control) to the next fertilizer order so the fertilizer works "
                   "better and the basket grows.")
    if len(out) < 3 and "Benih" not in cats and r["total_area_hectare"] >= 10:
        out.append("Ask about replanting plans and offer Benih Topaz seedlings for old or empty blocks.")
    # 6. repeat order
    if len(out) < 3 and r["total_invoice"] < 3:
        out.append(f"Only {int(r['total_invoice'])} order(s) so far, last one {int(r['days_since_last_order'])} days "
                   "ago: call before the next fertilizing round to lock in the repeat order.")
    return " ".join(out[:3]) or "Offer a volume bundle (retail Pupuk + Racun) for the next fertilizing round."


def offer_short(r, toling_regs) -> str:
    """Main upsell offer as a short phrase (verb first), used in the Opportunity column and xlsx 'Main offer'."""
    reg = r["regency"] if r["regency"] != "Unknown" else "their area"
    normal = r["sh_ret"] + r["sh_gro"]
    if r["kp_mt_max"] >= KP_CAP_MT * KP_NEAR_CAP:
        return f"sell retail Pupuk for the volume above the {KP_CAP_MT} MT/month Khusus Petani quota"
    if r["sh_kp"] >= KP_HEAVY_SHARE:
        return "move purchases from subsidised Khusus Petani to retail Pupuk"
    if r["wallet_gap"] == r["wallet_gap"] and r["wallet_gap"] > 0:
        return f"propose a fertilizing plan for the whole farm (room to grow {fmt_idr(r['wallet_gap'])})"
    if normal >= 0.5:
        return "offer a season contract or volume price for retail Pupuk"
    if r["sh_tol"] >= 0.5:
        return f"pre-book their order on the next Toling truck visit in {reg}"
    if r["sh_tol"] == 0 and reg in toling_regs and normal < 0.3:
        return f"invite them to the next Toling truck visit in {reg}"
    return "bundle retail Pupuk with Racun for the next fertilizing round"


def opportunity_text(r) -> str:
    """Clear sentence(s) describing what to do with the customer (win-back, KebunPRO, upsell)."""
    out = []
    if r["winback"]:
        out.append(f"Call to win back — no order for {int(r['days_since_last_order'])} days.")
    kp = ""
    if r["kp_basis"] == "Area" and r["kp_priority"] != "Verify":
        kp = f"offer KebunPRO for the {r['kp_ha']:,.0f} ha farm ({fmt_idr(r['kp_mrr'])}/month)"
    elif r["kp_basis"] == "Area":
        kp = (f"check the registered farm area first ({r['total_area_hectare']:,.0f} ha looks wrong), "
              "then offer KebunPRO")
    elif r["kp_basis"] == "Sales-based":
        kp = (f"confirm the farm size (est. {r['kp_ha']:,.0f} ha from purchases), then offer KebunPRO "
              f"(≈ {fmt_idr(r['kp_mrr'])}/month)")
    up = r["offer_short"] if r["upsell"] else ""
    main = "; also ".join(x for x in (kp, up) if x)
    if main:
        main = main[0].upper() + main[1:] + "."
        out.append(("Then " + main[0].lower() + main[1:]) if r["winback"] else main)
    return " ".join(out)


def analyse(d: pd.DataFrame, cats: pd.DataFrame | None, ctx=None):
    d = d.copy()
    # ---- LTV tier (by rank so ties don't collapse tiers)
    pct = d["total_sales"].rank(ascending=False, method="first") / len(d)
    d["tier"] = pd.cut(pct, [0, 0.10, 0.30, 0.60, 1.0], labels=["Platinum", "Gold", "Silver", "Bronze"]).astype(str)
    d["status"] = pd.cut(d["days_since_last_order"], [-1, ACTIVE_DAYS, AT_RISK_DAYS, 10**6],
                         labels=["Active", "At risk", "Dormant"]).astype(str)

    # ---- sales-per-hectare benchmark from customers with a known, plausible area
    known = d[(d["total_area_hectare"] >= 1) & (d["total_area_hectare"] <= AREA_MAX_PLAUSIBLE)]
    per_ha = known["total_sales"] / known["total_area_hectare"]
    bench_med = float(per_ha.median()) if len(per_ha) else float("nan")
    bench_p75 = float(per_ha.quantile(0.75)) if len(per_ha) else float("nan")

    # ---- KebunPRO
    d["area_known"] = d["total_area_hectare"] > 0
    d["est_ha"] = (d["total_sales"] / bench_med).where(~d["area_known"]) if bench_med == bench_med else float("nan")
    d["kp_ha"] = d["total_area_hectare"].where(d["area_known"], d["est_ha"])
    d["kp_basis"] = ""
    d.loc[d["area_known"] & (d["total_area_hectare"] >= KEBUNPRO_MIN_HA), "kp_basis"] = "Area"
    d.loc[~d["area_known"] & (d["est_ha"] >= KEBUNPRO_MIN_HA), "kp_basis"] = "Sales-based"
    d["kp_flag"] = ""
    d.loc[(d["kp_basis"] == "Area") & (d["total_area_hectare"] > AREA_MAX_PLAUSIBLE), "kp_flag"] = "Verify area (outlier)"
    d.loc[d["kp_basis"] == "Sales-based", "kp_flag"] = "Confirm farm size"
    d["kp_mrr"] = (d["kp_ha"] * KEBUNPRO_PRICE).where(d["kp_basis"] != "", 0)
    d["kp_arr"] = d["kp_mrr"] * 12

    def kp_priority(r):
        if r["kp_basis"] == "":
            return ""
        if r["kp_flag"].startswith("Verify"):
            return "Verify"
        if r["status"] == "Active":
            return "High"
        return "Medium" if r["status"] == "At risk" else "Low"
    d["kp_priority"] = d.apply(kp_priority, axis=1)

    # ---- upsell
    d["wallet_pot"] = (d["total_area_hectare"] * bench_p75).where(
        d["area_known"] & (d["total_area_hectare"] <= AREA_MAX_PLAUSIBLE))
    d["wallet_gap"] = (d["wallet_pot"] - d["total_sales"]).clip(lower=0)
    d["upsell"] = (d["status"] == "Active") & (d["tier"].isin(["Platinum", "Gold"]) | (d["total_invoice"] >= 2))
    if cats is not None:
        d = d.join(cats, on="customer_id")
        d["cats"] = d["cats"].map(lambda v: v if isinstance(v, list) else [])
        # popularity of each core category among repeat customers -> order of recommendation
        pop = pd.Series([c for v in d.loc[d["total_invoice"] >= 2, "cats"] for c in v]).value_counts()
        order = [c for c in pop.index if c in CORE_CATS] + [c for c in CORE_CATS if c not in pop.index]
        d["not_bought"] = d["cats"].map(lambda v: [c for c in order if c not in v])
        d["bought"] = d["cats"].map(lambda v: ", ".join(v))
        d["next_product"] = d["not_bought"].map(lambda v: ", ".join(v[:2]))
    else:
        d["bought"] = d["next_product"] = ""
        d["sales_province"] = d["sales_regency"] = ""
    # ---- location (farm -> same phone farm -> delivery by id -> delivery by phone -> CRM kecamatan)
    d = resolve_locations(d, ctx or {})
    for c in ("sh_kp", "sh_tol", "sh_ret", "sh_gro", "kp_mt_max", "kp_mt_avg"):
        if c not in d:
            d[c] = 0.0
        d[c] = d[c].fillna(0)
    if "kp_max_month" not in d:
        d["kp_max_month"] = ""
    d["kp_max_month"] = d["kp_max_month"].fillna("")
    # regencies where the Toling truck already sells (at least one Toling buyer there)
    toling_regs = set(d.loc[(d["sh_tol"] > 0) & (d["regency"] != "Unknown"), "regency"])
    d["upsell_action"] = d.apply(lambda r: suggest(r, toling_regs) if r["upsell"] else "", axis=1)
    d["offer_short"] = d.apply(lambda r: offer_short(r, toling_regs) if r["upsell"] else "", axis=1)

    # ---- win-back
    d["winback"] = d["tier"].isin(["Platinum", "Gold"]) & d["status"].isin(["At risk", "Dormant"])

    d["opportunity"] = d.apply(opportunity_text, axis=1)

    return d, dict(bench_med=bench_med, bench_p75=bench_p75, n_bench=len(known))


# ================================================================ deck
def build(data_dir: Path, template: Path, out: Path, xlsx: Path | None, today: dt.date):
    d0 = load_detail(data_dir / DETAIL_FILE)
    cats = load_categories(data_dir / SALES_FILE)
    ctx = load_location_context(data_dir)
    d, b = analyse(d0, cats, ctx)
    fixes = location_fixes(d, ctx)
    data_date = d["last_order"].max().date() if d["last_order"].notna().any() else today

    kp = d[d["kp_basis"] != ""].copy()
    prio_rank = {"High": 0, "Medium": 1, "Low": 2, "Verify": 3}
    kp["_p"] = kp["kp_priority"].map(prio_rank)
    kp_area = kp[kp["kp_basis"] == "Area"].sort_values(["_p", "kp_ha"], ascending=[True, False])
    kp_sales = kp[kp["kp_basis"] == "Sales-based"].sort_values(["_p", "total_sales"], ascending=[True, False])
    kp_ok = kp[kp["kp_priority"] != "Verify"]
    up = d[d["upsell"]].copy()
    up["_t"] = up["tier"].map({"Platinum": 0, "Gold": 1, "Silver": 2, "Bronze": 3})
    up = up.sort_values(["_t", "total_sales"], ascending=[True, False])
    wb = d[d["winback"]].sort_values("total_sales", ascending=False)

    deck = Deck(template)
    W = deck.W
    gap = int(0.25 * IN)
    y = TOP + int(0.75 * IN)
    half = (W - 2 * MX - gap) // 2
    prio_col = {"High": GREEN, "Medium": ORANGE, "Low": MUTED, "Verify": RED}

    # ---------------------------------------------------------- 1. cover
    s = deck.new(TPL_COVER)
    for shp in list(s.shapes):
        if shp.has_text_frame and shp.text_frame.text.strip():
            shp._element.getparent().remove(shp._element)
    text(s, int(0.45 * IN), int(0.95 * IN), int(7 * IN), int(0.9 * IN),
         "Customer LTV & Upsell / Cross-sell\nSmallholder", size=26, bold=True)
    text(s, int(0.45 * IN), int(2.0 * IN), int(7 * IN), int(0.3 * IN),
         f"KebunPRO opportunity  •  {fmt_int(len(d))} customers  •  Data up to {d_id(data_date)}",
         size=12, bold=True, color=GREEN)
    text(s, int(0.45 * IN), int(2.3 * IN), int(7 * IN), int(0.3 * IN),
         f"Source: {DETAIL_FILE}  •  Auto-generated {d_id(today)}", size=9, color=MUTED)

    # ---------------------------------------------------------- 2. summary
    s = deck.new()
    header(deck, s, "Summary — LTV & Growth Opportunities",
           f"{fmt_int(len(d))} customers  •  KebunPRO IDR {KEBUNPRO_PRICE:,}/ha/month, min. {KEBUNPRO_MIN_HA} ha")
    kp_area_ok = kp_ok[kp_ok["kp_basis"] == "Area"]
    tiles = [
        ("Total LTV", fmt_idr(d["total_sales"].sum()).replace("IDR ", "")),
        ("Avg LTV / customer", fmt_idr(d["total_sales"].mean()).replace("IDR ", "")),
        ("Active (≤90d)", f"{fmt_int((d['status'] == 'Active').sum())} / {fmt_int(len(d))}"),
        ("KebunPRO candidates", f"{fmt_int(len(kp_area_ok))} + {fmt_int(len(kp_sales))} est."),
        ("KebunPRO MRR (area)", fmt_idr(kp_area_ok["kp_mrr"].sum()).replace("IDR ", "")),
        ("Upsell / Win-back", f"{fmt_int(len(up))} / {fmt_int(len(wb))}"),
    ]
    tw_ = (W - 2 * MX - 5 * int(0.12 * IN)) // 6
    for i, (lab, val) in enumerate(tiles):
        tile(s, MX + i * (tw_ + int(0.12 * IN)), y - int(0.1 * IN), tw_, int(0.75 * IN), lab, val)
    text(s, MX, y + int(0.68 * IN), W - 2 * MX, int(0.2 * IN), "Amounts in IDR  •  est. = sales-based estimate (no farm data)",
         size=7, color=MUTED)
    yb = y + int(0.95 * IN)
    hi = [
        f"{fmt_int(len(kp_area))} customers have a registered farm area ≥ {KEBUNPRO_MIN_HA} ha "
        f"({fmt_int((kp_area['kp_priority'] == 'Verify').sum())} with an implausible area > {AREA_MAX_PLAUSIBLE} ha to verify first).",
        f"{fmt_int(len(kp_sales))} customers without farm data buy enough to suggest ≥ {KEBUNPRO_MIN_HA} ha "
        f"(sales ÷ benchmark {fmt_idr(b['bench_med'])}/ha) — confirm farm size, then offer KebunPRO.",
        f"KebunPRO MRR: area-based {fmt_idr(kp_area_ok['kp_mrr'].sum())} + sales-based est. "
        f"{fmt_idr(kp_sales['kp_mrr'].sum())} = {fmt_idr(kp_ok['kp_mrr'].sum())} (ARR {fmt_idr(kp_ok['kp_arr'].sum())}); "
        f"active customers only: MRR {fmt_idr(kp_ok.loc[kp_ok['kp_priority'] == 'High', 'kp_mrr'].sum())}.",
        f"{fmt_int(len(up))} active customers are upsell candidates; known wallet gap "
        f"{fmt_idr(up['wallet_gap'].fillna(0).sum())} (farm area × P75 sales/ha {fmt_idr(b['bench_p75'])} – current sales).",
        f"{fmt_int(len(wb))} Platinum/Gold customers have gone quiet (> {ACTIVE_DAYS} days) — "
        f"LTV at risk {fmt_idr(wb['total_sales'].sum())}.",
        f"Top 10% customers (Platinum) hold {d.loc[d['tier'] == 'Platinum', 'total_sales'].sum() / max(d['total_sales'].sum(), 1) * 100:.0f}% of total LTV.",
    ]
    text(s, MX, yb, half + int(1.2 * IN), int(0.25 * IN), "Highlights", size=11, bold=True, color=GREEN)
    text(s, MX, yb + int(0.3 * IN), half + int(1.2 * IN), int(2.6 * IN),
         [[("•  ", {"bold": True, "color": GREEN}), (t, {})] for t in hi], size=9)
    xr = MX + half + int(1.2 * IN) + gap
    wr = W - MX - xr
    seg = d.groupby("tier").agg(n=("customer_id", "size"), ltv=("total_sales", "sum")).reindex(
        ["Platinum", "Gold", "Silver", "Bronze"])
    bar_chart(s, xr, yb, wr, int(2.75 * IN), seg.index.tolist(), [("LTV (IDR million)", (seg["ltv"] / 1e6).round(0).tolist())],
              [GREEN], title="LTV by tier (IDR million)")

    # ---------------------------------------------------------- 2b. glossary + tiers
    glossary_slide(deck, d, b)
    platinum_slide(deck, d)

    # ---------------------------------------------------------- 3. segmentation
    s = deck.new()
    header(deck, s, "LTV Segmentation — Tier × Activity",
           f"Tier: Platinum top 10%, Gold 10–30%, Silver 30–60%, Bronze rest  •  "
           f"Active ≤ {ACTIVE_DAYS}d, At risk ≤ {AT_RISK_DAYS}d, Dormant > {AT_RISK_DAYS}d")
    piv = d.pivot_table(index="tier", columns="status", values="customer_id", aggfunc="count", fill_value=0).reindex(
        index=["Platinum", "Gold", "Silver", "Bronze"], columns=["Active", "At risk", "Dormant"], fill_value=0)
    bar_chart(s, MX, y, half, int(3.4 * IN), piv.index.tolist(),
              [(c, piv[c].tolist()) for c in piv.columns], [GREEN, ORANGE, GREY],
              title="Customers by tier & activity", kind=XL_CHART_TYPE.COLUMN_STACKED)
    tg = d.groupby("tier").agg(n=("customer_id", "size"), ltv=("total_sales", "sum"), avg=("total_sales", "mean"),
                               inv=("total_invoice", "mean"), aov=("avg_sales", "median"),
                               rec=("days_since_last_order", "median")).reindex(["Platinum", "Gold", "Silver", "Bronze"])
    rows = [[t, fmt_int(r["n"]), fmt_idr(r["ltv"]), fmt_idr(r["avg"]), f"{r['inv']:.1f}", fmt_idr(r["aov"]),
             fmt_int(r["rec"])] for t, r in tg.iterrows()]
    table(s, MX + half + gap, y, half, ["Tier", "Cust.", "LTV", "Avg LTV", "Avg inv.", "Median AOV", "Median days"],
          rows, [1, 0.6, 1.1, 1.1, 0.7, 1.1, 0.9], row_h=int(0.3 * IN))

    # ---------------------------------------------------------- 4. KebunPRO — area known
    legend = [[("Priority:  ", {"bold": True}), ("High", {"bold": True, "color": GREEN}), (" = active ≤90d   ", {}),
               ("Medium", {"bold": True, "color": ORANGE}), (" = at risk 91–180d   ", {}),
               ("Low", {"bold": True, "color": MUTED}), (" = dormant >180d (win back first)   ", {}),
               ("Verify", {"bold": True, "color": RED}), (f" = area > {AREA_MAX_PLAUSIBLE} ha, check data before offering", {})],
              [("MRR", {"bold": True}), (f" = monthly KebunPRO fee = ha × IDR {KEBUNPRO_PRICE:,}   ", {}),
               ("ARR", {"bold": True}), (" = yearly = MRR × 12   ", {}),
               ("LTV", {"bold": True}), (" = customer's total sales to date", {})]]

    def kp_rows(df, area_col):
        return [[r["customer_name"][:24], r["account_manager"][:22], (r["kp_priority"], prio_col[r["kp_priority"]]),
                 fmt_int(r[area_col]), fmt_idr(r["kp_mrr"]), fmt_idr(r["kp_arr"]), fmt_idr(r["total_sales"]),
                 fmt_int(r["total_invoice"]), fmt_int(r["days_since_last_order"])] for _, r in df.head(DECK_TOP_N).iterrows()]

    more = lambda df: f"  •  top {DECK_TOP_N} shown, full list in xlsx" if len(df) > DECK_TOP_N else ""
    paged_table(deck, f"KebunPRO Cross-sell — Farm Area ≥ {KEBUNPRO_MIN_HA} ha ({fmt_int(len(kp_area))})",
                f"Registered farm area  •  MRR = ha × IDR {KEBUNPRO_PRICE:,}  •  "
                f"MRR excl. Verify {fmt_idr(kp_area.loc[kp_area['kp_priority'] != 'Verify', 'kp_mrr'].sum())}{more(kp_area)}",
                ["Customer", "Account Manager", "Priority", "Area (ha)", "MRR", "ARR", "LTV", "Invoices", "Days since"],
                kp_rows(kp_area, "total_area_hectare"), [1.8, 1.8, 0.8, 0.8, 1.1, 1.1, 1.1, 0.7, 0.8],
                highlight_col=4, legend=legend, empty_row=["(none)"] + [""] * 8)

    # ---------------------------------------------------------- 5. KebunPRO — sales-based estimate
    paged_table(deck, f"KebunPRO Potential — No Farm Data, Sales-based ({fmt_int(len(kp_sales))})",
                f"Est. area = LTV ÷ {fmt_idr(b['bench_med'])} per ha (median of {fmt_int(b['n_bench'])} customers with known area)  •  "
                f"min. LTV ≈ {fmt_idr(b['bench_med'] * KEBUNPRO_MIN_HA)}  •  confirm farm size first{more(kp_sales)}",
                ["Customer", "Account Manager", "Priority", "Est. area (ha)", "Est. MRR", "Est. ARR", "LTV", "Invoices",
                 "Days since"],
                kp_rows(kp_sales, "est_ha"), [1.8, 1.8, 0.8, 0.9, 1.1, 1.1, 1.1, 0.7, 0.8],
                highlight_col=4, legend=legend, empty_row=["(none)"] + [""] * 8)

    # ---------------------------------------------------------- 6. upsell
    tier_col = {"Platinum": GREEN, "Gold": ORANGE, "Silver": INK, "Bronze": MUTED}
    ur = [[r["customer_name"][:20], r["account_manager"][:18], (r["tier"], tier_col[r["tier"]]),
           fmt_idr(r["total_sales"]).replace("IDR ", ""), mix_label(r), r["upsell_action"]]
          for _, r in up.head(UPSELL_DECK_N).iterrows()]
    more_up = f"  •  top {UPSELL_DECK_N} shown, full list in xlsx" if len(up) > UPSELL_DECK_N else ""
    paged_table(deck, f"Upsell Candidates — Active Customers ({fmt_int(len(up))})",
                f"Active ≤ {ACTIVE_DAYS}d and (Platinum/Gold or ≥ 2 invoices)  •  sorted by tier & LTV{more_up}",
                ["Customer", "Account Manager", "Tier", "LTV (IDR)", "Product mix", "Suggested action"],
                ur, [1.3, 1.25, 0.75, 0.65, 1.05, 6.0], per_page=SENT_PER_PAGE, font=7, legend=MIX_LEGEND,
                left_cols=(5,),
                empty_row=["(none)"] + [""] * 5)

    # ---------------------------------------------------------- 7. win-back
    wr_ = [[r["customer_name"][:24], r["account_manager"][:22], (r["tier"], tier_col[r["tier"]]),
            (r["status"], ORANGE if r["status"] == "At risk" else RED),
            r["last_order"].strftime("%d %b %Y") if pd.notna(r["last_order"]) else "–",
            fmt_int(r["days_since_last_order"]), fmt_int(r["total_invoice"]), fmt_idr(r["total_sales"]),
            "Yes" if r["kp_basis"] else ""]
           for _, r in wb.head(DECK_TOP_N).iterrows()]
    paged_table(deck, f"Win-back — High-LTV Customers Gone Quiet ({fmt_int(len(wb))})",
                f"Platinum/Gold, no order > {ACTIVE_DAYS} days  •  LTV at risk {fmt_idr(wb['total_sales'].sum())}"
                f"  •  KebunPRO = also a KebunPRO lead{more(wb)}",
                ["Customer", "Account Manager", "Tier", "Status", "Last order", "Days since", "Invoices", "LTV", "KebunPRO"],
                wr_, [1.8, 1.8, 0.8, 0.8, 1, 0.8, 0.7, 1.1, 0.8], highlight_col=7,
                empty_row=["(none)"] + [""] * 8)

    # ---------------------------------------------------------- 7b. per location
    loc_p = location_table(d, kp_ok, kp, up, wb, "province")
    loc_r = location_table(d, kp_ok, kp, up, wb, ["province", "regency"])
    src = d["loc_source"].value_counts()
    src_txt = (f"Location from: farm {fmt_int(src.get('Farm', 0))} • same-phone farm {fmt_int(src.get('Farm (same phone)', 0))}"
               f" • delivery {fmt_int(src.get('Delivery', 0) + src.get('Delivery (same phone)', 0))}"
               f" • CRM kecamatan {fmt_int(src.get('CRM kecamatan', 0))} • no location {fmt_int(src.get('Unknown', 0))}")

    s = deck.new()
    header(deck, s, "Breakdown by Province", src_txt)
    # deck view: provinces with < 3 customers grouped into "Others" (full list in xlsx)
    small = (loc_p["cust"] < 3) & (loc_p.index != "Unknown")
    lp = loc_p[~small & (loc_p.index != "Unknown")]
    if small.sum():
        oth = loc_p[small].sum(numeric_only=True)
        oth["avg_ltv"] = oth["ltv"] / max(oth["cust"], 1)
        oth["active_pct"] = oth["active"] / max(oth["cust"], 1)
        lp = pd.concat([lp, pd.DataFrame([oth], index=[f"Others ({int(small.sum())} prov.)"])])
    if (loc_p.index == "Unknown").any():
        lp = pd.concat([lp, loc_p[loc_p.index == "Unknown"].rename(index={"Unknown": NO_LOC})])
    cw = int((W - 2 * MX) * 0.30)
    chart_p = lp[lp.index != NO_LOC]
    bar_chart(s, MX, y, cw, int(2.3 * IN), chart_p.index.tolist()[::-1],
              [("LTV (IDR million)", (chart_p["ltv"] / 1e6).round(0).tolist()[::-1])], [GREEN],
              title="LTV by province (IDR million)", kind=XL_CHART_TYPE.BAR_CLUSTERED)
    xt = MX + cw + gap
    tot_ltv = max(d["total_sales"].sum(), 1)
    m = lambda v: fmt_idr(v).replace("IDR ", "")
    pr = [[pv, fmt_int(r["cust"]), m(r["ltv"]), f"{r['ltv'] / tot_ltv * 100:.0f}%", m(r["avg_ltv"]),
           f"{r['active_pct'] * 100:.0f}%", fmt_int(r["kp_n"]), m(r["kp_mrr"]) if r["kp_mrr"] else "–",
           fmt_int(r["up_n"]), fmt_int(r["wb_n"])]
          for pv, r in lp.iterrows()]
    pr_tot = [[("Total", INK), fmt_int(loc_p["cust"].sum()), m(loc_p["ltv"].sum()), "100%",
               m(d["total_sales"].mean()), f"{(d['status'] == 'Active').mean() * 100:.0f}%",
               fmt_int(loc_p["kp_n"].sum()), m(loc_p["kp_mrr"].sum()), fmt_int(loc_p["up_n"].sum()),
               fmt_int(loc_p["wb_n"].sum())]]
    table(s, xt, y, W - MX - xt,
          ["Province", "Cust", "LTV", "Share", "Avg LTV", "Active", "KP cand.", "KP MRR", "Upsell", "Win-bk"],
          pr + pr_tot, [1.7, 0.5, 0.75, 0.6, 0.75, 0.62, 0.72, 0.72, 0.65, 0.65], highlight_col=2,
          row_h=int(0.27 * IN))
    text(s, xt, y + int(0.27 * IN) * (len(pr) + 2) + int(0.06 * IN), W - MX - xt, int(0.2 * IN),
         "Amounts in IDR  •  KP = KebunPRO (excl. 'Verify')  •  Active = ordered ≤ 90 days  •  "
         "provinces with < 3 customers grouped as Others", size=7, color=MUTED)

    # insight sentences per province
    lines = []
    known = loc_p[loc_p.index != "Unknown"]
    if len(known):
        p1 = known.index[0]
        lines.append(f"{p1} is the core market: {fmt_int(known.loc[p1, 'cust'])} customers, "
                     f"{known.loc[p1, 'ltv'] / tot_ltv * 100:.0f}% of LTV.")
        kp_best = known.sort_values("kp_mrr", ascending=False)
        if kp_best["kp_mrr"].iat[0] > 0:
            lines.append(f"Most KebunPRO potential: {kp_best.index[0]} — MRR {fmt_idr(kp_best['kp_mrr'].iat[0])} "
                         f"from {fmt_int(kp_best['kp_n'].iat[0])} customers.")
        big = known[known["cust"] >= 5].sort_values("avg_ltv", ascending=False)
        if len(big):
            lines.append(f"Highest avg LTV (≥5 cust.): {big.index[0]} ({fmt_idr(big['avg_ltv'].iat[0])}).")
        wbm = known.sort_values("wb_ltv", ascending=False)
        if wbm["wb_ltv"].iat[0] > 0:
            lines.append(f"Largest win-back LTV at risk: {wbm.index[0]} ({fmt_idr(wbm['wb_ltv'].iat[0])}).")
    if lines:
        yl = y + int(2.4 * IN)
        text(s, MX, yl, cw, int(0.22 * IN), "Highlights", size=10, bold=True, color=GREEN)
        text(s, MX, yl + int(0.25 * IN), cw, int(1.1 * IN),
             [[("•  ", {"bold": True, "color": GREEN}), (t, {})] for t in lines], size=8)

    rr = [[rg if rg != "Unknown" else "–", pv, fmt_int(r["cust"]), fmt_idr(r["ltv"]), fmt_idr(r["avg_ltv"]), f"{r['active_pct'] * 100:.0f}%",
           fmt_int(r["area_ha"]) if r["area_ha"] else "–", fmt_int(r["kp_n"]), fmt_idr(r["kp_mrr"]) if r["kp_mrr"] else "–",
           fmt_int(r["up_n"]), fmt_int(r["wb_n"])]
          for (pv, rg), r in loc_r[loc_r.index.get_level_values(0) != "Unknown"].head(DECK_TOP_N).iterrows()]
    paged_table(deck, f"Breakdown by Regency (Kabupaten) — Top {min(DECK_TOP_N, len(rr))}",
                "Sorted by LTV  •  Area = registered farm hectares (excl. > "
                f"{AREA_MAX_PLAUSIBLE} ha outliers)  •  KebunPRO excl. 'Verify'  •  full list in xlsx",
                ["Regency", "Province", "Cust.", "LTV", "Avg LTV", "Active", "Area (ha)", "KebunPRO", "KP MRR",
                 "Upsell", "Win-back"],
                rr, [1.5, 1.4, 0.55, 1, 0.95, 0.65, 0.8, 0.8, 0.95, 0.65, 0.75], highlight_col=3,
                empty_row=["(no location data)"] + [""] * 10)

    # ---------------------------------------------------------- 7c. per region: who to call
    region_slides(deck, d, loc_p)

    # ---------------------------------------------------------- 8. per AM
    g = d.groupby("account_manager").agg(
        cust=("customer_id", "size"), ltv=("total_sales", "sum"), active=("status", lambda x: (x == "Active").sum()),
        pg=("tier", lambda x: x.isin(["Platinum", "Gold"]).sum()))
    g["kp_n"] = kp_ok.groupby("account_manager").size()
    g["kp_mrr"] = kp_ok.groupby("account_manager")["kp_mrr"].sum()
    g["kp_verify"] = kp[kp["kp_priority"] == "Verify"].groupby("account_manager").size()
    g["up_n"] = up.groupby("account_manager").size()
    g["wb_n"] = wb.groupby("account_manager").size()
    g = g.fillna(0).sort_values(["kp_mrr", "ltv"], ascending=False)
    g_show = g[g[["kp_n", "kp_verify", "up_n", "wb_n"]].sum(axis=1) > 0]
    ar = [[am, fmt_int(r["cust"]), fmt_idr(r["ltv"]), fmt_int(r["active"]), fmt_int(r["pg"]), fmt_int(r["kp_n"]),
           fmt_idr(r["kp_mrr"]) if r["kp_mrr"] else "–", fmt_int(r["kp_verify"]), fmt_int(r["up_n"]), fmt_int(r["wb_n"])]
          for am, r in g_show.iterrows()]
    tot = [[("Total", INK), fmt_int(g["cust"].sum()), fmt_idr(g["ltv"].sum()), fmt_int(g["active"].sum()),
            fmt_int(g["pg"].sum()), fmt_int(g["kp_n"].sum()), fmt_idr(g["kp_mrr"].sum()), fmt_int(g["kp_verify"].sum()),
            fmt_int(g["up_n"].sum()), fmt_int(g["wb_n"].sum())]]
    paged_table(deck, "Opportunity Pipeline per Account Manager",
                "KebunPRO count & MRR exclude 'Verify' rows (shown separately)  •  AMs without any opportunity hidden"
                + (f" ({len(g) - len(g_show)})" if len(g) > len(g_show) else ""),
                ["Account Manager", "Customers", "LTV", "Active", "Plat/Gold", "KebunPRO", "KebunPRO MRR", "Verify",
                 "Upsell", "Win-back"],
                ar, [2.3, 0.85, 1.15, 0.7, 0.8, 0.85, 1.15, 0.65, 0.7, 0.8], footer_rows=tot, highlight_col=6)

    # ---------------------------------------------------------- 9. notes
    s = deck.new()
    header(deck, s, "Notes & Definitions")
    defs = [
        f"Source: {DETAIL_FILE} (one row per customer). LTV = total_sales over the period covered by the export "
        f"(latest order in file: {d_id(data_date)}). " + (f"Product categories from {SALES_FILE}." if cats is not None else
                                                          f"{SALES_FILE} not found — product recommendations skipped."),
        "LTV tier by rank of LTV: Platinum = top 10%, Gold = next 20%, Silver = next 30%, Bronze = remaining 40%.",
        f"Activity from days_since_last_order: Active ≤ {ACTIVE_DAYS}, At risk {ACTIVE_DAYS+1}–{AT_RISK_DAYS}, Dormant > {AT_RISK_DAYS} days.",
        f"KebunPRO: subscription IDR {KEBUNPRO_PRICE:,} per hectare per month, minimum {KEBUNPRO_MIN_HA} ha. "
        f"MRR = hectares × IDR {KEBUNPRO_PRICE:,}; ARR = MRR × 12. Eligible when total_area_hectare ≥ {KEBUNPRO_MIN_HA}.",
        f"No farm data (total_area_hectare = 0): est. hectares = LTV ÷ benchmark sales per hectare "
        f"({fmt_idr(b['bench_med'])}/ha = median LTV/ha of {fmt_int(b['n_bench'])} customers with 1–{AREA_MAX_PLAUSIBLE} ha). "
        "The benchmark is recalculated every run. These are leads to verify, not confirmed eligibility.",
        f"Farm area > {AREA_MAX_PLAUSIBLE} ha is flagged 'Verify' (implausible for a smallholder / likely input error) and "
        "excluded from MRR totals until corrected in the app.",
        f"Upsell: Active and (Platinum/Gold or ≥ 2 invoices). Wallet gap = farm ha × P75 LTV per ha "
        f"({fmt_idr(b['bench_p75'])}) – current LTV, only when farm area is known.",
        "Suggested products = core categories (Pupuk, Pupuk Grosir, Khusus Petani, Toling, Benih, Racun) not yet bought, "
        "ordered by how common they are among repeat customers.",
        "Win-back: Platinum/Gold customers that are At risk or Dormant. Full lists incl. phone numbers are in the xlsx.",
        "Location: (1) largest registered farm; (2) farm of another account with the same phone; (3) most frequent "
        "delivery province in Sales for the same customer_id; (4) same phone; (5) CRM 'Kecamatan' for that phone, "
        "mapped via known farm locations; if still not found the location is left empty. "
        "Sales rows without a location are listed in xlsx 'Location fixes'.",
    ]
    text(s, MX, TOP + int(0.6 * IN), W - 2 * MX, int(3.9 * IN),
         [[("•  ", {"color": GREEN, "bold": True}), (t, {})] for t in defs], size=9)

    deck.new(TPL_CLOSING)
    deck.finalize(out)

    if xlsx:
        write_xlsx(xlsx, d, kp_area, kp_sales, up, wb, g, b, loc_p, loc_r, fixes)

    return dict(customers=len(d), data_date=data_date, kebunpro_area=len(kp_area), kebunpro_sales_based=len(kp_sales),
                kebunpro_mrr_excl_verify=round(kp_ok["kp_mrr"].sum()), upsell=len(up), winback=len(wb),
                bench_sales_per_ha=round(b["bench_med"]), bench_p75_per_ha=round(b["bench_p75"]))


TIER_RULE = {"Platinum": "Top 10%", "Gold": "Next 20%", "Silver": "Next 30%", "Bronze": "Bottom 40%"}
TIER_ACTION = {"Platinum": "Keep close: priority service, KebunPRO first, protect from churn",
               "Gold": "Grow to Platinum: bundles, repeat orders, KebunPRO if ≥ 50 ha",
               "Silver": "Increase frequency: next-product offers, seasonal reminders",
               "Bronze": "Activate: second order, low-cost follow-up (WA / broadcast)"}


def glossary_slide(deck, d, b):
    W = deck.W
    gap = int(0.3 * IN)
    y = TOP + int(0.62 * IN)
    lw = int((W - 2 * MX - gap) * 0.47)
    s = deck.new()
    header(deck, s, "How to Read This Report — Terms & LTV Tiers")
    terms = [
        ("LTV", "Lifetime value = total sales (IDR) of the customer in the data period."),
        ("AOV", "Average order value = LTV ÷ number of invoices."),
        ("MRR", f"Monthly recurring revenue = KebunPRO subscription per month = hectares × IDR {KEBUNPRO_PRICE:,}. "
                "Example: 100 ha → IDR 2.0M / month."),
        ("ARR", "Annual recurring revenue = MRR × 12. Example: 100 ha → IDR 24.0M / year."),
        ("KebunPRO candidate", f"Farm area ≥ {KEBUNPRO_MIN_HA} ha. 'est.' = no farm data; area estimated from LTV ÷ "
                               f"{fmt_idr(b['bench_med'])} per ha → confirm farm size first."),
        ("Verify", f"Registered area > {AREA_MAX_PLAUSIBLE} ha — likely input error; not counted in MRR."),
        ("Upsell", f"Active customer (Platinum/Gold or ≥ 2 invoices): sell more, preferably at retail price."),
        ("Pupuk", "Retail price — normal margin; the product to grow."),
        ("Pupuk Grosir", "Wholesale / bulk price."),
        ("Toling", "Low price; SawitPRO truck visits a specific area within one day."),
        ("Khusus Petani", f"Subsidised price, max {KP_CAP_MT} MT per customer per month; sold at a loss — "
                          "never pushed as upsell."),
        ("Wallet gap", f"Farm ha × {fmt_idr(b['bench_p75'])} per ha (P75) – LTV = room to grow spend."),
        ("Win-back", f"Platinum/Gold customer with no order for > {ACTIVE_DAYS} days."),
        ("Status", f"Active ≤ {ACTIVE_DAYS} days since last order • At risk {ACTIVE_DAYS + 1}–{AT_RISK_DAYS} • "
                   f"Dormant > {AT_RISK_DAYS}."),
    ]
    text(s, MX, y, lw, int(0.25 * IN), "Terms", size=11, bold=True, color=GREEN)
    text(s, MX, y + int(0.3 * IN), lw, int(3.6 * IN),
         [[(f"{k}: ", {"bold": True, "color": GREEN}), (v, {})] for k, v in terms], size=8)

    x2 = MX + lw + gap
    w2 = W - MX - x2
    order = ["Platinum", "Gold", "Silver", "Bronze"]
    g = d.groupby("tier").agg(n=("customer_id", "size"), lo=("total_sales", "min"), hi=("total_sales", "max"),
                              ltv=("total_sales", "sum")).reindex(order)
    tot = max(d["total_sales"].sum(), 1)
    tier_col = {"Platinum": GREEN, "Gold": ORANGE, "Silver": INK, "Bronze": MUTED}
    rows = [[(t, tier_col[t]), TIER_RULE[t], f"{fmt_idr(r['lo'])} – {fmt_idr(r['hi'])}", fmt_int(r["n"]),
             f"{r['ltv'] / tot * 100:.0f}%"] for t, r in g.iterrows()]
    text(s, x2, y, w2, int(0.25 * IN), "LTV tiers (ranked by LTV, recalculated every run)", size=11, bold=True,
         color=GREEN)
    table(s, x2, y + int(0.3 * IN), w2, ["Tier", "Rule", "LTV range (this run)", "Cust.", "Share of LTV"],
          rows, [0.8, 1.0, 2.4, 0.55, 0.85], row_h=int(0.3 * IN))
    ya = y + int(0.3 * IN) + int(0.3 * IN) * 5 + int(0.15 * IN)
    text(s, x2, ya, w2, int(0.22 * IN), "What to do per tier", size=10, bold=True, color=GREEN)
    text(s, x2, ya + int(0.26 * IN), w2, int(1.3 * IN),
         [[(f"{t}: ", {"bold": True, "color": tier_col[t]}), (TIER_ACTION[t], {})] for t in order], size=8)


def platinum_slide(deck, d):
    st_col = {"Active": GREEN, "At risk": ORANGE, "Dormant": RED}
    pl = d[d["tier"] == "Platinum"].sort_values("total_sales", ascending=False)
    rows = [[f"{i}. {r['customer_name'][:22]}", r["account_manager"][:20],
             ("" if r["province"] == "Unknown" else r["province"]), fmt_idr(r["total_sales"]).replace("IDR ", ""),
             fmt_int(r["total_invoice"]), fmt_idr(r["avg_sales"]).replace("IDR ", ""), (r["status"], st_col[r["status"]]), fmt_int(r["days_since_last_order"]),
             (r["opportunity"] or "–", INK if r["opportunity"] else MUTED)]
            for i, (_, r) in enumerate(pl.iterrows(), start=1)]
    lo = pl["total_sales"].min() if len(pl) else 0
    paged_table(deck, f"Platinum Customers — Top 10% by LTV ({fmt_int(len(pl))})",
                f"LTV ≥ {fmt_idr(lo)}  •  {pl['total_sales'].sum() / max(d['total_sales'].sum(), 1) * 100:.0f}% of total LTV  •  "
                "Gold/Silver/Bronze lists: xlsx 'All customers' (column LTV tier)",
                ["Customer", "Account Manager", "Province", "LTV (IDR)", "Inv.", "AOV (IDR)", "Status", "Days", "Opportunity"],
                rows, [1.5, 1.45, 1.0, 0.75, 0.4, 0.75, 0.65, 0.45, 4.7], highlight_col=3, per_page=9, font=7,
                left_cols=(8,))


def region_slides(deck, d, loc_p):
    """Per province (>= REGION_MIN_CUSTOMERS): slide A = top customers by LTV, slide B = who to offer
    (KebunPRO cross-sell first, then upsell)."""
    tier_col = {"Platinum": GREEN, "Gold": ORANGE, "Silver": INK, "Bronze": MUTED}
    st_col = {"Active": GREEN, "At risk": ORANGE, "Dormant": RED}
    reg = lambda r: "–" if r["regency"] == "Unknown" else r["regency"][:15]
    am = lambda r: r["account_manager"][:19]
    m = lambda v: fmt_idr(v).replace("IDR ", "")
    for prov, pr in loc_p.iterrows():
        if prov == "Unknown" or pr["cust"] < REGION_MIN_CUSTOMERS:
            continue
        sub = d[d["province"] == prov]
        summary = (f"{fmt_int(pr['cust'])} customers  •  LTV {fmt_idr(pr['ltv'])}  •  active {pr['active_pct'] * 100:.0f}%  •  "
                   f"KebunPRO MRR {fmt_idr(pr['kp_mrr'])}  •  {fmt_int(pr['up_n'])} upsell  •  {fmt_int(pr['wb_n'])} win-back")

        top = sub.sort_values("total_sales", ascending=False).head(REGION_TOP_N)
        rows = [[f"{i}. {r['customer_name'][:21]}", reg(r), am(r), (r["tier"], tier_col[r["tier"]]),
                 (r["status"], st_col[r["status"]]), m(r["total_sales"]), fmt_int(r["total_invoice"]),
                 fmt_int(r["days_since_last_order"]), (r["opportunity"] or "–", INK if r["opportunity"] else MUTED)]
                for i, (_, r) in enumerate(top.iterrows(), start=1)]
        paged_table(deck, f"{prov} — Top {len(rows)} Customers by LTV", summary,
                    ["Customer", "Regency", "Account Manager", "Tier", "Status", "LTV (IDR)", "Inv.", "Days", "Opportunity"],
                    rows, [1.55, 1.0, 1.45, 0.65, 0.65, 0.75, 0.4, 0.45, 4.6], highlight_col=5, per_page=REGION_TOP_N + 1,
                    font=7, left_cols=(8,))

        kp_t = sub[(sub["kp_basis"] != "") & (sub["kp_priority"] != "Verify")].sort_values("kp_mrr", ascending=False)
        up_t = sub[sub["upsell"] & ~sub.index.isin(kp_t.index)].sort_values("total_sales", ascending=False)
        if not len(kp_t) + len(up_t):
            continue                      # nothing to offer here -> no empty slide
        tg = pd.concat([kp_t, up_t]).head(REGION_OFFER_N)
        trows = []
        for _, r in tg.iterrows():
            if r["kp_basis"]:
                val, col = f"KebunPRO {m(r['kp_mrr'])}/month", GREEN
            else:
                gap_ok = r["wallet_gap"] == r["wallet_gap"] and r["wallet_gap"] > 0
                val, col = (f"Room to grow {m(r['wallet_gap'])}" if gap_ok else f"Bought {m(r['total_sales'])}"), INK
            trows.append([r["customer_name"][:20], am(r)[:18], reg(r), ((val), col), mix_label(r),
                          fmt_int(r["days_since_last_order"]), full_offer(r)])
        more = f"  •  top {REGION_OFFER_N} shown, full list in xlsx" if len(kp_t) + len(up_t) > REGION_OFFER_N else ""
        paged_table(deck, f"{prov} — Who to Offer: KebunPRO & Upsell ({fmt_int(len(kp_t))} + {fmt_int(len(up_t))})",
                    f"KebunPRO candidates first (by MRR, excl. 'Verify'), then upsell candidates (by LTV){more}",
                    ["Customer", "Account Manager", "Regency", "Potential (IDR)", "Product mix", "Days", "What to offer"],
                    trows, [1.3, 1.25, 0.85, 1.05, 1.05, 0.45, 5.55], per_page=SENT_PER_PAGE, font=7,
                    legend=MIX_LEGEND, left_cols=(6,))


def tile(slide, x, y, w, h, label, value):
    rect(slide, x, y, w, h, LIGHT)
    pad = int(0.1 * IN)
    text(slide, x + pad, y + pad, w - 2 * pad, int(0.2 * IN), label, size=8, color=MUTED)
    text(slide, x + pad, y + pad + int(0.22 * IN), w - 2 * pad, int(0.32 * IN), value, size=14, bold=True, color=GREEN)


def location_table(d, kp_ok, kp, up, wb, by):
    g = d.groupby(by).agg(cust=("customer_id", "size"), ltv=("total_sales", "sum"), avg_ltv=("total_sales", "mean"),
                          active=("status", lambda x: (x == "Active").sum()))
    g["active_pct"] = g["active"] / g["cust"]
    ok_area = d[(d["total_area_hectare"] <= AREA_MAX_PLAUSIBLE)]
    g["area_ha"] = ok_area.groupby(by)["total_area_hectare"].sum()
    g["kp_n"] = kp_ok.groupby(by).size()
    g["kp_mrr"] = kp_ok.groupby(by)["kp_mrr"].sum()
    g["kp_verify"] = kp[kp["kp_priority"] == "Verify"].groupby(by).size()
    g["up_n"] = up.groupby(by).size()
    g["wb_n"] = wb.groupby(by).size()
    g["wb_ltv"] = wb.groupby(by)["total_sales"].sum()
    g = g.fillna(0).sort_values("ltv", ascending=False)
    # keep "Unknown" at the bottom
    unk = g.index.get_level_values(0) == "Unknown" if isinstance(by, list) else g.index == "Unknown"
    return pd.concat([g[~unk], g[unk]])


# ================================================================ xlsx
def write_xlsx(path: Path, d, kp_area, kp_sales, up, wb, per_am, b, loc_p, loc_r, fixes):
    path.parent.mkdir(parents=True, exist_ok=True)
    base = {"customer_name": "Customer", "phone": "Phone", "account_manager": "Account Manager", "tier": "LTV tier",
            "status": "Status", "total_sales": "LTV (IDR)", "total_invoice": "Invoices", "avg_sales": "AOV (IDR)",
            "last_order_date": "Last order", "days_since_last_order": "Days since last order", "province": "Province", "regency": "Regency",
            "loc_source": "Location source"}

    def loc_cols(df):
        df = df.replace({"province": {"Unknown": NO_LOC}, "regency": {"Unknown": ""}})
        return df.rename(columns={
            "province": "Province", "regency": "Regency", "cust": "Customers", "ltv": "LTV (IDR)",
            "avg_ltv": "Avg LTV (IDR)", "active": "Active", "active_pct": "Active %", "area_ha": "Farm area (ha)",
            "kp_n": "KebunPRO candidates", "kp_mrr": "KebunPRO MRR (IDR)", "kp_verify": "KebunPRO verify",
            "up_n": "Upsell", "wb_n": "Win-back", "wb_ltv": "Win-back LTV (IDR)"}).round(
            {"Active %": 3, "Avg LTV (IDR)": -3, "KebunPRO MRR (IDR)": -3})

    def pick(df, extra):
        cols = {**base, **extra}
        out = df[list(cols)].copy()
        for c in ("kp_ha", "est_ha"):
            if c in out:
                out[c] = out[c].round(0)
        for c in ("kp_mrr", "kp_arr", "wallet_gap"):
            if c in out:
                out[c] = out[c].round(-3)
        for c in ("province", "regency", "loc_source"):
            if c in out:
                out[c] = out[c].replace("Unknown", "")
        return out.rename(columns=cols)

    kp_cols = {"kp_priority": "Priority", "kp_flag": "Note", "total_kebun": "Farms", "kp_ha": "Area / est. area (ha)",
               "kp_mrr": "KebunPRO MRR (IDR)", "kp_arr": "KebunPRO ARR (IDR)"}
    sheets = {
        "KebunPRO - Area": pick(kp_area, kp_cols),
        "KebunPRO - Sales-based": pick(kp_sales, kp_cols),
        "Upsell": pick(up, {"total_area_hectare": "Area (ha)", "wallet_gap": "Wallet gap (IDR)",
                            "bought": "Categories bought",
                            "sh_ret": "Retail Pupuk share", "sh_gro": "Pupuk Grosir share",
                            "sh_kp": "Khusus Petani share", "kp_mt_max": "Khusus Petani max MT / month",
                            "sh_tol": "Toling share", "offer_short": "Main offer",
                            "upsell_action": "Suggested action"}),
        "Win-back": pick(wb, {"kp_basis": "KebunPRO basis", "bought": "Categories bought"}),
        "Per Province": loc_cols(loc_p.reset_index()),
        "Per Regency": loc_cols(loc_r.reset_index()),
        "Customers by Region": pick(
            d.assign(rank_in_province=d.groupby("province")["total_sales"].rank(ascending=False, method="first"))
             .sort_values(["province", "total_sales"], ascending=[True, False]),
            {"rank_in_province": "Rank in province", "opportunity": "Opportunity",
             "kp_mrr": "KebunPRO MRR (IDR)", "wallet_gap": "Wallet gap (IDR)", "upsell_action": "Suggested action"}),
        "Location fixes": fixes.replace({"Resolved province": {"Unknown": ""}, "Resolved regency": {"Unknown": ""},
                                         "Found via": {"Unknown": ""}}) if len(fixes) else fixes,
        "Per AM": per_am.reset_index().rename(columns={
            "account_manager": "Account Manager", "cust": "Customers", "ltv": "LTV (IDR)", "active": "Active",
            "pg": "Platinum/Gold", "kp_n": "KebunPRO candidates", "kp_mrr": "KebunPRO MRR (IDR)",
            "kp_verify": "KebunPRO verify", "up_n": "Upsell", "wb_n": "Win-back"}),
        "All customers": pick(d.sort_values("total_sales", ascending=False), {
            "total_area_hectare": "Area (ha)", "est_ha": "Est. area (ha)", "kp_basis": "KebunPRO basis",
            "kp_priority": "KebunPRO priority", "kp_mrr": "KebunPRO MRR (IDR)", "upsell": "Upsell candidate",
            "winback": "Win-back", "bought": "Categories bought"}),
        "Assumptions": pd.DataFrame([
            ("KebunPRO price (IDR / ha / month)", KEBUNPRO_PRICE),
            ("KebunPRO minimum area (ha)", KEBUNPRO_MIN_HA),
            ("Benchmark LTV per ha — median (IDR)", round(b["bench_med"])),
            ("Benchmark LTV per ha — P75 (IDR)", round(b["bench_p75"])),
            ("Customers used for benchmark", b["n_bench"]),
            ("Max plausible smallholder area (ha)", AREA_MAX_PLAUSIBLE),
            ("Active if days since last order ≤", ACTIVE_DAYS),
            ("At risk if days since last order ≤", AT_RISK_DAYS),
        ], columns=["Parameter", "Value"]),
    }
    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        for name, df in sheets.items():
            df.to_excel(xw, sheet_name=name, index=False)
            ws = xw.sheets[name]
            ws.freeze_panes = "A2"
            for i, col in enumerate(df.columns, start=1):
                width = max([len(str(col))] + [len(str(v)) for v in df[col].head(200)]) + 2
                ws.column_dimensions[ws.cell(1, i).column_letter].width = min(width, 45)
                if str(col) == "Suggested action":
                    from openpyxl.styles import Alignment
                    ws.column_dimensions[ws.cell(1, i).column_letter].width = 90
                    for c in ws.iter_cols(min_col=i, max_col=i, min_row=2):
                        for cell in c:
                            cell.alignment = Alignment(wrap_text=True, vertical="top")
                if "share" in str(col):
                    for c in ws.iter_cols(min_col=i, max_col=i, min_row=2):
                        for cell in c:
                            cell.number_format = "0%"
                if any(k in str(col) for k in ("IDR", "(ha)")):
                    for c in ws.iter_cols(min_col=i, max_col=i, min_row=2):
                        for cell in c:
                            cell.number_format = "#,##0"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=".")
    ap.add_argument("--template", default="deck slide.pptx")
    ap.add_argument("--out", default=None)
    ap.add_argument("--xlsx", default=None, help="default: same name as --out with .xlsx")
    ap.add_argument("--today", default=None, help="YYYY-MM-DD (default: hari ini WIB)")
    a = ap.parse_args()
    today = dt.date.fromisoformat(a.today) if a.today else dt.datetime.now(TZ).date()
    out = Path(a.out) if a.out else Path("output") / f"LTV_Report_Smallholder_{today:%Y-%m-%d}.pptx"
    xlsx = Path(a.xlsx) if a.xlsx else out.with_suffix(".xlsx")
    info = build(Path(a.data_dir), Path(a.template), out, xlsx, today)
    print(f"OK -> {out}\n      {xlsx}")
    for k, v in info.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
