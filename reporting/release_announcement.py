"""Build and email a product announcement from "Release Note Sprint.md".

Usage:
  python reporting/release_announcement.py build --notes "Release Note Sprint.md" --out output/announcement
  python reporting/release_announcement.py send  --html output/announcement/email.html \
         --subject-file output/announcement/subject.txt --to "a@x.com,b@y.com"

build:
  1. Parses the release note (one "## <App> <Platform>" section per app, ID / EN bullet lists).
  2. Groups identical features across apps; features in 3+ apps become headline features.
  3. If ANTHROPIC_API_KEY is set, asks Claude to polish the copy (titles, intro, wording).
     Without a key, or if the call fails, it falls back to the release-note wording.
  4. Writes email.html (bilingual: Indonesian first, then English), subject.txt,
     announcement.json and quality_notes.md (issues found in the release note).

send:
  Sends the HTML via SMTP (defaults to Gmail). Needs SMTP_USER and SMTP_PASSWORD
  (a Gmail App Password), optional SMTP_HOST / SMTP_PORT.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import smtplib
import ssl
import sys
from collections import OrderedDict
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

HEADLINE_MIN_APPS = 3
PLATFORMS = ("Android", "iOS", "Web")
ID_HINTS = re.compile(
    r"\b(dan|yang|kini|dengan|untuk|bisa|agar|lebih|saat|pada|melalui|terhadap|halaman|pengguna)\b",
    re.I,
)


# --------------------------------------------------------------------------- parse
def unescape_md(text: str) -> str:
    return re.sub(r"\\([\\`*_{}\[\]()#+\-.!|>~])", r"\1", text).strip()


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def split_app(heading: str) -> tuple[str, str]:
    """'PetaniPRO App Android' -> ('PetaniPRO', 'Android'); 'KebunPRO Web' -> ('KebunPRO', 'Web')."""
    words = heading.split()
    platform = "App"
    if words and words[-1] in PLATFORMS:
        platform = words.pop()
    if words and words[-1].lower() == "app":
        words.pop()
    return " ".join(words) or heading, platform


def parse_release_note(text: str) -> dict:
    sprint = ""
    sections: list[dict] = []
    cur = None
    lang = None
    for raw in text.splitlines():
        line = unescape_md(raw)
        if not line:
            continue
        if raw.startswith("# ") and not raw.startswith("## "):
            m = re.search(r"Sprint\s+([\d.]+)", line)
            sprint = m.group(1) if m else line.lstrip("# ").strip()
            continue
        if raw.startswith("## "):
            app, platform = split_app(line.lstrip("# ").strip())
            cur = {"app": app, "platform": platform, "ID": [], "EN": []}
            sections.append(cur)
            lang = None
            continue
        if cur is None:
            continue
        if line.upper() in ("ID", "EN"):
            lang = line.upper()
            continue
        if raw.lstrip().startswith(("-", "*")) and lang:
            cur[lang].append(line.lstrip("-* ").strip())
    return {"sprint": sprint, "sections": sections}


def build_features(parsed: dict) -> tuple[list[dict], list[str]]:
    """Merge bullets across apps into features. Returns (features, quality_notes)."""
    notes: list[str] = []
    sections = parsed["sections"]

    # Learn ID -> EN pairs from sections whose lists line up one-to-one.
    id_to_en: dict[str, str] = {}
    en_texts: set[str] = set()
    for s in sections:
        en_texts.update(norm(e) for e in s["EN"])
        if s["ID"] and len(s["ID"]) == len(s["EN"]):
            for i, e in zip(s["ID"], s["EN"]):
                id_to_en.setdefault(norm(i), e)

    features: "OrderedDict[str, dict]" = OrderedDict()
    for s in sections:
        label = f"{s['app']} {s['platform']}".strip()
        id_items = s["ID"]
        en_items = s["EN"]

        # English sentences that slipped into the ID list.
        stray = [b for b in id_items if norm(b) in en_texts and not ID_HINTS.search(b)]
        if stray:
            notes.append(f"**{label}**: bagian ID berisi kalimat bahasa Inggris: " + "; ".join(f"“{b}”" for b in stray))
            id_items = [b for b in id_items if b not in stray]
        if not s["EN"]:
            notes.append(f"**{label}**: bagian EN tidak ada; terjemahan diambil dari aplikasi lain jika tersedia.")
        if not s["ID"]:
            notes.append(f"**{label}**: bagian ID tidak ada.")
        if s["ID"] and s["EN"] and len(s["ID"]) != len(s["EN"]):
            notes.append(f"**{label}**: jumlah poin ID ({len(s['ID'])}) dan EN ({len(s['EN'])}) berbeda.")

        for idx, id_text in enumerate(id_items):
            en_text = id_to_en.get(norm(id_text)) or (en_items[idx] if idx < len(en_items) and len(en_items) == len(id_items) else "")
            key = norm(id_text)
            f = features.setdefault(key, {"id": id_text, "en": en_text, "apps": OrderedDict()})
            if not f["en"] and en_text:
                f["en"] = en_text
            f["apps"].setdefault(s["app"], [])
            if s["platform"] not in f["apps"][s["app"]]:
                f["apps"][s["app"]].append(s["platform"])

    # Platform coverage per app, to mark features that exist on only one platform.
    app_platforms: dict[str, set[str]] = {}
    for s in sections:
        app_platforms.setdefault(s["app"], set()).add(s["platform"])

    out = []
    for f in features.values():
        if not f["en"]:
            notes.append(f"Fitur tanpa versi EN: “{f['id']}”.")
        only = {}
        for app, plats in f["apps"].items():
            mobile = app_platforms[app] & {"Android", "iOS"}
            if len(mobile) == 2 and len(set(plats) & mobile) == 1:
                only[app] = plats[0]
        f["platform_only"] = only
        f["headline"] = len(f["apps"]) >= HEADLINE_MIN_APPS
        out.append(f)
    return out, notes


def group_features(features: list[dict]) -> tuple[list[dict], list[dict]]:
    """Headline features, plus per-app groups (apps with identical extra features are merged)."""
    headline = [f for f in features if f["headline"]]
    per_app: "OrderedDict[str, list[int]]" = OrderedDict()
    surface: dict[str, set[str]] = {}
    for i, f in enumerate(features):
        if f["headline"]:
            continue
        for app, plats in f["apps"].items():
            mobile = [p for p in plats if p in ("Android", "iOS")]
            if mobile:
                per_app.setdefault(app, []).append(i)
                surface.setdefault(app, set()).update(mobile)
            for p in plats:
                if p not in ("Android", "iOS"):  # "App" / "Web" are separate products, e.g. KebunPRO App vs Web
                    unit = f"{app} {p}"
                    per_app.setdefault(unit, []).append(i)
                    surface.setdefault(unit, set())
    groups: "OrderedDict[tuple, dict]" = OrderedDict()
    for unit, idxs in per_app.items():
        key = (tuple(idxs), tuple(sorted(surface[unit])))
        g = groups.setdefault(key, {"apps": [], "platforms": sorted(surface[unit]), "items": idxs})
        g["apps"].append(unit)
    return headline, list(groups.values())


# --------------------------------------------------------------------------- copy
def fallback_copy(sprint: str, features: list[dict], headline: list[dict], groups: list[dict]) -> dict:
    def title_body(text: str) -> tuple[str, str]:
        if ":" in text[:60]:
            t, b = text.split(":", 1)
            return t.strip(), b.strip()
        return "", text

    copy = {}
    for lang, key in (("id", "id"), ("en", "en")):
        items = []
        for f in features:
            t, b = title_body(f[key] or f["id"])
            items.append({"title": t, "body": b})
        copy[lang] = {
            "subject": f"Rilis Sprint {sprint}: fitur baru di aplikasi PRO" if lang == "id" else f"Sprint {sprint} release: what's new in the PRO apps",
            "headline": "Ada yang baru di aplikasi PRO" if lang == "id" else "What's new in the PRO apps",
            "intro": (
                f"Berikut pembaruan yang dirilis pada Sprint {sprint}."
                if lang == "id" else f"Here are the updates shipped in Sprint {sprint}."
            ),
            "items": items,
            "cta": (
                "Perbarui aplikasi melalui Google Play Store atau App Store untuk mendapatkan fitur terbaru."
                if lang == "id" else "Update your app from the Google Play Store or App Store to get the latest features."
            ),
        }
    return copy


SYSTEM_PROMPT = """You write short, friendly product announcements for SawitPRO, an Indonesian palm-oil \
agritech company. Its apps serve smallholder farmers (PetaniPRO), field teams (TimPRO), agents (AgenPRO), \
plantations (KebunPRO), collectors (RamPRO), cooperatives (KUDPRO) and partners (DutaPRO, MitraPRO).

You receive release-note features as JSON, each with Indonesian (id) and English (en) text. Rewrite them \
into announcement copy in both languages.

Rules:
- Use only facts in the input. Do not add features, numbers, dates, benefits or claims that are not there.
- Keep each item's meaning; give it a short title (2-6 words) and a one- or two-sentence body.
- Return exactly one item per input feature, in the same order.
- Indonesian: natural, warm, plain Bahasa Indonesia (use "kamu"); keep terms like TBS, PKS, RAM, RKH, Marihat.
- English: plain and concise; use FFB for TBS and "mill" for PKS; keep RAM, RKH, Marihat.
- subject: under 70 characters. headline: under 60 characters. intro: 1-2 sentences. cta: one sentence \
asking users to update via Google Play Store / App Store."""


def claude_copy(sprint: str, features: list[dict], headline: list[dict], groups: list[dict]) -> dict | None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set; using release-note wording.")
        return None
    try:
        import anthropic
        from pydantic import BaseModel
    except ImportError as exc:  # pragma: no cover
        print(f"anthropic SDK not installed ({exc}); using release-note wording.")
        return None

    class Item(BaseModel):
        title: str
        body: str

    class LangCopy(BaseModel):
        subject: str
        headline: str
        intro: str
        items: list[Item]
        cta: str

    class Copy(BaseModel):
        id: LangCopy
        en: LangCopy

    payload = {
        "sprint": sprint,
        "headline_features_in_most_apps": [features.index(f) for f in headline],
        "features": [
            {"index": i, "id": f["id"], "en": f["en"], "apps": list(f["apps"].keys())}
            for i, f in enumerate(features)
        ],
    }
    client = anthropic.Anthropic()
    try:
        resp = client.messages.parse(
            model=os.environ.get("ANNOUNCE_MODEL", "claude-opus-5-5"),
            max_tokens=16000,
            output_config={"effort": "low"},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False, indent=2)}],
            output_format=Copy,
        )
    except anthropic.APIStatusError as exc:
        print(f"Claude API error {exc.status_code}: {exc.message}; using release-note wording.")
        return None
    except anthropic.APIConnectionError as exc:
        print(f"Claude API connection error: {exc}; using release-note wording.")
        return None

    if resp.stop_reason != "end_turn" or resp.parsed_output is None:
        print(f"Claude stopped with {resp.stop_reason}; using release-note wording.")
        return None
    data = resp.parsed_output.model_dump()
    for lang in ("id", "en"):
        if len(data[lang]["items"]) != len(features):
            print("Claude returned a different number of items; using release-note wording.")
            return None
    return data


# --------------------------------------------------------------------------- render
C = {
    "bg": "#f3f5ef", "card": "#ffffff", "ink": "#16251c", "muted": "#5b6b5f",
    "line": "#d9e0d4", "palm": "#1f6b45", "palm_soft": "#e1efe5", "fruit_soft": "#fbe6da", "fruit_ink": "#a8410f",
}
FONT = "'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif"


def esc(s: str) -> str:
    return html.escape(s or "")


def badge(text: str) -> str:
    return (f'<span style="display:inline-block;margin:0 4px 4px 0;padding:2px 8px;border-radius:6px;'
            f'background:{C["palm_soft"]};color:{C["palm"]};font-size:12px;font-weight:600">{esc(text)}</span>')


def item_html(item: dict, apps_line: str = "") -> str:
    title = f'<div style="font-size:15px;font-weight:700;color:{C["ink"]};margin-bottom:4px">{esc(item["title"])}</div>' if item.get("title") else ""
    return (f'<tr><td style="padding:12px 0;border-top:1px solid {C["line"]}">{title}'
            f'<div style="font-size:14px;line-height:1.55;color:{C["ink"]}">{esc(item["body"])}</div>'
            f'{apps_line}</td></tr>')


def lang_block(lang: str, copy: dict, features: list[dict], headline: list[dict], groups: list[dict]) -> str:
    L = copy[lang]
    is_id = lang == "id"
    only_label = (lambda p: f" ({p})")
    out = [
        f'<h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;color:{C["ink"]};font-family:{FONT}">{esc(L["headline"])}</h1>',
        f'<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:{C["muted"]}">{esc(L["intro"])}</p>',
    ]
    if headline:
        out.append(f'<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:{C["muted"]};margin:8px 0 4px">'
                   f'{"Sorotan utama · hadir di banyak aplikasi" if is_id else "Highlights · available across apps"}</div>'
                   f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0">')
        for f in headline:
            i = features.index(f)
            apps = "".join(badge(a) for a in f["apps"])
            out.append(item_html(L["items"][i], f'<div style="margin-top:8px">{apps}</div>'))
        out.append("</table>")
    for g in groups:
        plats = g["platforms"]
        head = " & ".join(g["apps"]) + (f' · {" & ".join(plats)}' if plats else "")
        out.append(f'<div style="font-size:18px;font-weight:700;color:{C["palm"]};margin:24px 0 2px;font-family:{FONT}">{esc(head)}</div>'
                   f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0">')
        for i in g["items"]:
            item = dict(L["items"][i])
            only = {p for a, p in features[i]["platform_only"].items() if a in g["apps"] and len(g["platforms"]) > 1}
            if len(only) == 1:
                item["body"] = item["body"] + only_label(only.pop())
            out.append(item_html(item))
        out.append("</table>")
    out.append(f'<p style="margin:24px 0 0;padding:14px 16px;border-radius:10px;background:{C["palm"]};color:#ffffff;font-size:14px;font-weight:600">{esc(L["cta"])}</p>')
    return "\n".join(out)


def render_email(sprint: str, copy: dict, features, headline, groups, page_url_id: str = "", page_url_en: str = "") -> str:
    note_id = ("Catatan: email ini dibuat otomatis dari release note. Ilustrasi pada halaman web (jika ada) "
               "bukan tangkapan layar asli aplikasi.")
    note_en = ("Note: this email was generated automatically from the release note. Illustrations on the web page "
               "(if any) are not actual app screenshots.")
    links = ""
    if page_url_id or page_url_en:
        parts = []
        if page_url_id:
            parts.append(f'<a href="{esc(page_url_id)}" style="color:{C["palm"]}">Lihat versi web bergambar (ID)</a>')
        if page_url_en:
            parts.append(f'<a href="{esc(page_url_en)}" style="color:{C["palm"]}">Illustrated web version (EN)</a>')
        links = f'<p style="margin:0 0 16px;font-size:13px">{" · ".join(parts)}</p>'
    divider = (f'<tr><td style="padding:20px 28px 8px"><div style="border-top:2px solid {C["line"]};padding-top:20px;'
               f'font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:{C["muted"]}">English version</div></td></tr>')
    return f"""<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(copy["id"]["subject"])}</title></head>
<body style="margin:0;padding:0;background:{C["bg"]};font-family:{FONT};color:{C["ink"]}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{C["bg"]}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:{C["card"]};border-radius:14px;border:1px solid {C["line"]}">
<tr><td style="padding:28px 28px 8px">
<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:{C["muted"]};margin-bottom:12px">Rilis Sprint {esc(sprint)} · Sprint {esc(sprint)} Release</div>
{links}
<p style="margin:0 0 20px;padding:10px 14px;border-radius:10px;background:{C["fruit_soft"]};color:{C["fruit_ink"]};font-size:12px;line-height:1.5">{esc(note_id)}<br>{esc(note_en)}</p>
{lang_block("id", copy, features, headline, groups)}
</td></tr>
{divider}
<tr><td style="padding:8px 28px 28px">
{lang_block("en", copy, features, headline, groups)}
</td></tr>
</table>
</td></tr></table>
</body></html>"""


# --------------------------------------------------------------------------- commands
def cmd_build(args) -> int:
    text = Path(args.notes).read_text(encoding="utf-8")
    parsed = parse_release_note(text)
    if not parsed["sections"]:
        print("::error::No '## <App>' sections found in the release note.")
        return 1
    features, notes = build_features(parsed)
    headline, groups = group_features(features)
    sprint = parsed["sprint"] or "?"

    copy = claude_copy(sprint, features, headline, groups)
    source = "claude"
    if copy is None:
        copy = fallback_copy(sprint, features, headline, groups)
        source = "release-note wording"

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "email.html").write_text(
        render_email(sprint, copy, features, headline, groups,
                     os.environ.get("ANNOUNCE_PAGE_URL_ID", ""), os.environ.get("ANNOUNCE_PAGE_URL_EN", "")),
        encoding="utf-8",
    )
    subject = f'{copy["id"]["subject"]} | {copy["en"]["subject"]}'
    (out / "subject.txt").write_text(subject, encoding="utf-8")
    (out / "announcement.json").write_text(
        json.dumps({"sprint": sprint, "copy_source": source, "features": features, "copy": copy},
                   ensure_ascii=False, indent=2), encoding="utf-8")
    q = ["## Catatan kualitas release note", ""] + ([f"- {n}" for n in notes] or ["- Tidak ada temuan."])
    q += ["", f"Copy ditulis oleh: **{source}**", f"Fitur: {len(features)} (sorotan utama: {len(headline)})"]
    (out / "quality_notes.md").write_text("\n".join(q) + "\n", encoding="utf-8")
    print(f"Built announcement for Sprint {sprint}: {len(features)} features, copy by {source}.")
    print("\n".join(q))
    return 0


def cmd_send(args) -> int:
    to = [a.strip() for a in (args.to or "").split(",") if a.strip()]
    if not to:
        print("::error::No recipients. Set the ANNOUNCE_PREVIEW_TO / ANNOUNCE_TO secret.")
        return 1
    user, pwd = os.environ.get("SMTP_USER"), os.environ.get("SMTP_PASSWORD")
    if not user or not pwd:
        print("::error::SMTP_USER / SMTP_PASSWORD secrets are not set.")
        return 1
    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    port = int(os.environ.get("SMTP_PORT", "465"))
    subject = Path(args.subject_file).read_text(encoding="utf-8").strip()
    if args.prefix:
        subject = f"{args.prefix} {subject}"
    body = Path(args.html).read_text(encoding="utf-8")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = os.environ.get("SMTP_FROM", user)
    msg["To"] = msg["From"]  # recipients go in Bcc so the list stays private
    msg.attach(MIMEText("Buka email ini di aplikasi yang mendukung HTML. / Please view this email in an HTML-capable client.", "plain", "utf-8"))
    msg.attach(MIMEText(body, "html", "utf-8"))

    ctx = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ctx) as s:
            s.login(user, pwd)
            s.sendmail(msg["From"], to, msg.as_string())
    else:
        with smtplib.SMTP(host, port) as s:
            s.starttls(context=ctx)
            s.login(user, pwd)
            s.sendmail(msg["From"], to, msg.as_string())
    print(f"Sent '{subject}' to {len(to)} recipient(s).")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("--notes", default="Release Note Sprint.md")
    b.add_argument("--out", default="output/announcement")
    s = sub.add_parser("send")
    s.add_argument("--html", required=True)
    s.add_argument("--subject-file", required=True)
    s.add_argument("--to", default="")
    s.add_argument("--prefix", default="")
    args = p.parse_args()
    return cmd_build(args) if args.cmd == "build" else cmd_send(args)


if __name__ == "__main__":
    sys.exit(main())
