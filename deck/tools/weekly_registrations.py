"""Weekly farmer-registration refresh for SawitPRO Deck (run every Tuesday).

Reads `Farmer register for weekly farmer.csv` from origin/main and:
  1. checks the file covers the whole of last week (Monday-Sunday before today, WIB);
  2. writes the hashed sample to deck/src/sample-data.json and rebuilds deck/index.html (committed);
  3. writes the real rows to <out_dir>/real-sample.json and builds <out_dir>/index.html (published privately, never committed);
  4. prints a JSON summary of last week vs the week before (the reference numbers the deck must match).

Usage: python3 deck/tools/weekly_registrations.py <out_dir> [--today YYYY-MM-DD]
Exit code 0 = fresh, 2 = file missing, 3 = file does not cover last week yet (nothing rebuilt).
"""
import csv, datetime as dt, hashlib, io, json, os, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
CSV = "Farmer register for weekly farmer.csv"
WIB = dt.timezone(dt.timedelta(hours=7))


def git(*a):
    return subprocess.run(["git", "-C", str(ROOT), *a], capture_output=True, text=True)


def num(v):
    try:
        return float(str(v).replace(",", ""))
    except ValueError:
        return 0.0


def main():
    out = pathlib.Path(sys.argv[1]).resolve(); out.mkdir(parents=True, exist_ok=True)
    today = dt.date.fromisoformat(sys.argv[sys.argv.index("--today") + 1]) if "--today" in sys.argv else dt.datetime.now(WIB).date()
    git("fetch", "-q", "origin", "main")
    r = git("show", f"origin/main:{CSV}")
    if r.returncode:
        print(json.dumps({"status": "missing", "file": CSV})); return 2
    commit = git("log", "-1", "--format=%h %ci", "origin/main", "--", CSV).stdout.strip()
    rows = list(csv.reader(io.StringIO(r.stdout.lstrip("﻿"))))
    H, body = rows[0], [x + [""] * (len(rows[0]) - len(x)) for x in rows[1:] if any(v.strip() for v in x)]
    I = {k: i for i, k in enumerate(H)}

    # last week = the Monday-Sunday before today's week
    last_mon = today - dt.timedelta(days=today.weekday() + 7)
    prev_mon = last_mon - dt.timedelta(days=7)
    wk = lambda x: dt.datetime.strptime(x[I["minggu_register"]], "%d/%m/%Y").date()
    joined = lambda x: dt.datetime.strptime(x[I["join_date_farmer"]], "%d/%m/%Y, %H:%M")
    data_to = max(joined(x) for x in body)
    fresh = data_to.date() >= last_mon + dt.timedelta(days=6)
    info = {"file_commit": commit, "rows": len(body), "data_to": data_to.strftime("%Y-%m-%d %H:%M"),
            "last_week": f"{last_mon:%d %b} - {last_mon + dt.timedelta(days=6):%d %b %Y}", "fresh": fresh}
    if not fresh:
        info["status"] = "stale"; print(json.dumps(info, indent=1)); return 3

    # hashed sample (committed) and real sample (private build only)
    h = lambda s, n=5: hashlib.sha1(s.encode()).hexdigest()[:n]
    real, hashed = [], []
    for x in body:
        real.append({k: (x[i] or None) for i, k in enumerate(H)})
        y = list(x)
        if y[I["farmer_name"]]: y[I["farmer_name"]] = "Farmer " + h(y[I["farmer_name"]] + y[I["farmer_id"]])
        for c in ("farmer_phone", "duta_phone"):
            if c in I and y[I[c]]: y[I[c]] = "P" + h(y[I[c]], 8)
        if "farmer_email" in I and y[I["farmer_email"]]: y[I["farmer_email"]] = "user" + h(y[I["farmer_email"]], 6) + "@example.com"
        if "farm_name" in I and y[I["farm_name"]] not in ("", "[]"):
            y[I["farm_name"]] = "[" + ", ".join(f"Farm {k + 1}" for k in range(y[I["farm_name"]].count(",") + 1)) + "]"
        if "referral_utm" in I: y[I["referral_utm"]] = y[I["referral_utm"]][:40]
        hashed.append({k: (y[i] or None) for i, k in enumerate(H)})
    src = lambda rows_: {"sources": [{"name": CSV, "sheet": None, "headers": H, "rows": rows_}]}
    (ROOT / "deck/src/sample-data.json").write_text(json.dumps(src(hashed), ensure_ascii=False))
    (out / "real-sample.json").write_text(json.dumps(src(real), ensure_ascii=False))
    subprocess.run([sys.executable, str(ROOT / "deck/build.py")], check=True, stdout=subprocess.DEVNULL)
    subprocess.run([sys.executable, str(ROOT / "deck/build.py")], check=True, stdout=subprocess.DEVNULL,
                   env={**os.environ, "SAMPLE": str(out / "real-sample.json"), "OUT": str(out / "index.html"), "DECK_MODE": "registrations"})

    # reference numbers for last week vs the week before
    def stat(mon):
        w = [x for x in body if wk(x) == mon]
        role = lambda x: "Estate owner" if "ESTATE_OWNER" in x[I["user_role"]].upper() else "Farmer"
        cnt = lambda f: dict(sorted(((k, sum(1 for x in w if f(x) == k)) for k in {f(x) for x in w}), key=lambda kv: -kv[1]))
        prov = lambda x: (x[I["province"]].strip("[]").split(",")[0].strip() or "(no farm yet)")
        big = [x for x in w if num(x[I["total_area_hectare"]]) > 100]
        return {"total": len(w), "role": cnt(role), "duta": cnt(lambda x: x[I["akuisisi_type"]]), "utm_source": cnt(lambda x: x[I["utm_source"]]),
                "province": dict(list(cnt(prov).items())[:10]), "with_farm": sum(1 for x in w if num(x[I["jumlah_farm"]]) > 0),
                "above_100ha": len(big), "above_100ha_total_ha": round(sum(num(x[I["total_area_hectare"]]) for x in big)),
                "ordered": sum(1 for x in w if "last_sale_order_date" in I and x[I["last_sale_order_date"]]),
                "no_phone": sum(1 for x in w if not x[I["farmer_phone"]]),
                "per_day": {str(d): sum(1 for x in w if joined(x).date() == d) for d in (mon + dt.timedelta(days=k) for k in range(7))}}
    info.update(status="ok", last=stat(last_mon), before=stat(prev_mon), private_html=str(out / "index.html"))
    print(json.dumps(info, indent=1, ensure_ascii=False)); return 0


if __name__ == "__main__":
    sys.exit(main())
