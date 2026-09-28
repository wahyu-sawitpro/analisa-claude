"""Build deck/index.html: inline template images and the sample dataset into src/deck.html."""
import base64, json, pathlib, re
root = pathlib.Path(__file__).parent
html = (root / "src/deck.html").read_text()
mime = {".jpg": "image/jpeg", ".png": "image/png"}
def img(m):
    f = root / "assets" / m.group(1)
    return f"data:{mime[f.suffix]};base64," + base64.b64encode(f.read_bytes()).decode()
html = re.sub(r"\{\{IMG:([\w.-]+)\}\}", img, html)
sample = json.loads((root / "src/sample-data.json").read_text())
html = html.replace("/*SAMPLE_DATA*/null", json.dumps(sample, ensure_ascii=False))
html = html.replace("/*EXPORT_PPTX*/", (root / "src/export-pptx.js").read_text())
(root / "index.html").write_text(html)
print("wrote", root / "index.html", f"{len(html)/1e6:.2f} MB")
