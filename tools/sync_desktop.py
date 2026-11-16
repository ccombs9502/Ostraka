#!/usr/bin/env python3
"""Copies the web app into the Windows app (src/) and the Mac app (OstrakaWeb/).
Run from the repo root after tools/make_version.py:

    python3 tools/sync_desktop.py ../ostraka-windows/src ../Ostraka/OstrakaWeb

The Windows copy gets an index.html that starts through js/boot.js, which
checks GitHub for updates. The Mac copy keeps the plain index.html; the Mac
app checks for updates itself (WebUpdater.swift).
"""
import pathlib, re, shutil, sys

root = pathlib.Path(__file__).resolve().parent.parent
FILES = ["styles.css", "icon.png", "version.json"]
DIRS = ["js", "data", "fonts", "icons"]

def copy(dest: pathlib.Path):
    dest.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        shutil.copy2(root / f, dest / f)
    for d in DIRS:
        if (dest / d).exists():
            shutil.rmtree(dest / d)
        shutil.copytree(root / d, dest / d)

def desktop_index() -> str:
    html = (root / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'\s*<link rel="stylesheet" href="[^"]+">', "", html)
    html = re.sub(r'\s*<link rel="manifest" href="[^"]+">', "", html)
    # Replace the script list (and the website-only offline script) with the updater.
    html = re.sub(r'\s*<script src="[^"]+"></script>', "", html)
    html = re.sub(r'\s*<script>.*?</script>', "", html, flags=re.S)
    return html.replace("</body>", '  <script src="js/boot.js"></script>\n</body>')

for target in sys.argv[1:]:
    dest = pathlib.Path(target).resolve()
    copy(dest)
    windows = (dest / ".." / "src-tauri").exists()
    if windows:
        (dest / "index.html").write_text(desktop_index(), encoding="utf-8")
    else:
        shutil.copy2(root / "index.html", dest / "index.html")
    print(("Windows" if windows else "Mac") + ":", dest)
