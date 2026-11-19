#!/usr/bin/env python3
"""Writes version.json: the version number and a fingerprint (SHA-256) of every
file the desktop apps can update. Run it from the repo root before each release:

    python3 tools/make_version.py

The Windows app and the Mac app's Translate page read
https://ccombs9502.github.io/Ostraka/version.json to find and download updates.
"""
import hashlib, json, re, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent
sw = (root / "sw.js").read_text(encoding="utf-8")
m = re.search(r'const VERSION = "ostraka-web-(\d+)([a-z]?)"', sw)
if not m:
    sys.exit("Couldn't find VERSION in sw.js")
web, patch = int(m.group(1)), m.group(2)
build = web * 100 + (ord(patch) - ord("a") + 1 if patch else 0)

html = (root / "index.html").read_text(encoding="utf-8")
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
styles = re.findall(r'<link rel="stylesheet" href="([^"]+)">', html)
# gnt.js is loaded later by the engine, so it isn't in index.html.
# index.html too: the Mac app loads the page itself, so a new script tag must reach it.
paths = ["index.html"] + styles + scripts + ["data/gnt.js"]

files = {}
for p in paths:
    data = (root / p).read_bytes()
    files[p] = {"sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}

out = {
    "name": f"Ostraka Web {web}{patch}",
    "build": build,
    "styles": styles,
    "scripts": scripts,
    "files": files,
}
(root / "version.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"version.json: {out['name']} (build {build}), {len(files)} files")
