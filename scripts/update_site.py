#!/usr/bin/env python3
"""Update stats and latest note/radio links in index.html.

Usage: python3 scripts/update_site.py data.json [index.html]

data.json example:
{
  "stats": {"matches": 12, "goals": 2, "assists": 0},
  "note":  [{"title": "...", "url": "https://note.com/..."}, ...],   # up to 3
  "radio": [{"title": "...", "url": "https://note.com/..."}, ...]    # up to 3
}
Any key may be omitted. Both the visible text and the matching EDIT MODE
input values are updated so the page's own edit mode stays in sync.
"""
import html
import json
import re
import sys


def set_text(doc, el_id, value):
    pat = re.compile(r'(<span[^>]*\bid="%s"[^>]*>)(.*?)(</span>)' % re.escape(el_id), re.S)
    doc, n = pat.subn(lambda m: m.group(1) + html.escape(str(value), quote=False) + m.group(3), doc, count=1)
    if n != 1:
        raise SystemExit(f"text element not found: {el_id}")
    return doc


def set_href(doc, el_id, url):
    pat = re.compile(r'(<a[^>]*\bid="%s"[^>]*\bhref=")([^"]*)(")' % re.escape(el_id))
    doc, n = pat.subn(lambda m: m.group(1) + html.escape(url) + m.group(3), doc, count=1)
    if n != 1:
        raise SystemExit(f"link element not found: {el_id}")
    return doc


def set_input(doc, el_id, value):
    pat = re.compile(r'(<input[^>]*\bid="%s"[^>]*\bvalue=")([^"]*)(")' % re.escape(el_id))
    doc, n = pat.subn(lambda m: m.group(1) + html.escape(str(value)) + m.group(3), doc, count=1)
    if n != 1:
        raise SystemExit(f"edit input not found: {el_id}")
    return doc


def main():
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    path = sys.argv[2] if len(sys.argv) > 2 else "public/index.html"
    doc = open(path, encoding="utf-8").read()
    before = doc

    stats = data.get("stats") or {}
    for key in ("matches", "goals", "assists"):
        if key in stats:
            doc = set_text(doc, f"stat-{key}", stats[key])
            doc = set_input(doc, f"edit-{key}", stats[key])

    for kind in ("note", "radio"):
        for i, item in enumerate((data.get(kind) or [])[:3], start=1):
            doc = set_text(doc, f"{kind}-art{i}", item["title"])
            doc = set_href(doc, f"{kind}-art-link{i}", item["url"])
            doc = set_input(doc, f"edit-{kind}-art{i}", item["title"])
            doc = set_input(doc, f"edit-{kind}-art{i}-url", item["url"])

    if doc == before:
        print("NO_CHANGE")
        return
    open(path, "w", encoding="utf-8").write(doc)
    print("UPDATED")


if __name__ == "__main__":
    main()
