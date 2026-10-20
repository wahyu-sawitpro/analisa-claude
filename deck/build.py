"""Build deck/index.html: inline the JS modules, template images and sample dataset into src/deck.html."""
import base64, json, pathlib, re
root = pathlib.Path(__file__).parent
html = (root / "src/deck.html").read_text()
html = re.sub(r"/\*INCLUDE:([\w.-]+)\*/", lambda m: (root / "src" / m.group(1)).read_text(), html)
mime = {".jpg": "image/jpeg", ".png": "image/png"}
def img(m):
    f = root / "assets" / m.group(1)
    return f"data:{mime[f.suffix]};base64," + base64.b64encode(f.read_bytes()).decode()
html = re.sub(r"\{\{IMG:([\w.-]+)\}\}", img, html)
# SAMPLE=<path> builds with another dataset (e.g. the real export for the private published deck; never committed)
import os
sample = json.loads(pathlib.Path(os.environ.get("SAMPLE") or root / "src/sample-data.json").read_text())
html = html.replace("/*SAMPLE_DATA*/null", json.dumps(sample, ensure_ascii=False))
out = pathlib.Path(os.environ.get("OUT") or root / "index.html"); out.write_text(html)
print("wrote", out, f"{len(html)/1e6:.2f} MB")
