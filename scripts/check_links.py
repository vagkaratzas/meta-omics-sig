#!/usr/bin/env python3
"""Check Markdown link hygiene across the repo, which doubles as an Obsidian vault.

Four failures this catches, all of which have actually happened here:

1. Broken links - a relative link whose target does not exist.
2. Missing images - `![alt](path)` pointing at a file that is not there. Images are not
   graph edges, so they are checked for existence only and never counted as links.
3. Orphans - a file with no inbound links. Invisible in Obsidian's graph and effectively
   undiscoverable. ACRONYMS.md sat orphaned until 2026-08-10.
4. Wikilinks - `[[target]]` syntax. Obsidian offers it by autocomplete, but it renders as
   literal brackets on GitHub and in the docs/ Pages site, so this repo forbids it
   (see AGENTS.md). Obsidian builds its graph from ordinary relative Markdown links.

Exits non-zero if anything fails, so it can gate a commit.

Usage:
    check_links.py [--root DIR] [--quiet]
    check_links.py --selftest
"""

import argparse
import os
import re
import sys
from collections import defaultdict

# Files that are entry points by definition and may legitimately have no inbound links.
ROOTS = {"README.md"}

# Directories never scanned: pipeline outputs, git internals, vault config.
SKIP_DIRS = {".git", ".obsidian", "output", "node_modules", "__pycache__"}

# [text](target) - target trimmed of any #anchor. Images are excluded here (no leading !)
# because they are not graph edges; they get their own existence check instead.
LINK = re.compile(r"(?<!\!)\[[^\]]*\]\(([^)]+)\)")
IMAGE = re.compile(r"!\[[^\]]*\]\(([^)]+)\)", re.DOTALL)
WIKILINK = re.compile(r"\[\[([^\]]+)\]\]")

# Links and wikilinks inside code are examples, not real links. `[text](FILE.md)` in
# AGENTS.md documents the convention; a fenced block may show a link as sample output.
CODE_SPAN = re.compile(r"`[^`\n]*`")
CODE_FENCE = re.compile(r"^([ \t]*)(```|~~~).*?^\1\2.*?$", re.DOTALL | re.MULTILINE)


def strip_code(text):
    return CODE_SPAN.sub("", CODE_FENCE.sub("", text))


def markdown_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in sorted(filenames):
            if name.endswith(".md"):
                yield os.path.relpath(os.path.join(dirpath, name), root)


def links_in(text):
    """Relative .md link targets, with anchors and external URLs stripped out."""
    for raw in LINK.findall(text):
        target = raw.split("#")[0].strip()
        if not target or target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        yield target


def images_in(text):
    """Local image targets. Remote images are someone else's uptime problem."""
    for raw in IMAGE.findall(text):
        target = raw.split(" ")[0].strip()  # drop any optional "title"
        if target and not target.startswith(("http://", "https://", "data:")):
            yield target


def wikilinks_in(text):
    return WIKILINK.findall(text)


def analyse(root):
    files = list(markdown_files(root))
    known = set(files)
    outbound = defaultdict(set)
    broken, wikis, images = [], [], []

    for path in files:
        text = strip_code(open(os.path.join(root, path), encoding="utf-8").read())

        for target in links_in(text):
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), target))
            if resolved.endswith(".md"):
                outbound[path].add(resolved)
                if resolved not in known:
                    broken.append((path, target))
            elif not os.path.exists(os.path.join(root, resolved)):
                broken.append((path, target))

        for target in images_in(text):
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), target))
            if not os.path.exists(os.path.join(root, resolved)):
                images.append((path, target))

        for w in wikilinks_in(text):
            wikis.append((path, w))

    inbound = defaultdict(set)
    for src, targets in outbound.items():
        for t in targets:
            inbound[t].add(src)

    orphans = [f for f in files if f not in ROOTS and not inbound[f]]
    return files, broken, orphans, wikis, images, inbound, outbound


def report(root, quiet):
    files, broken, orphans, wikis, images, inbound, outbound = analyse(root)

    if not quiet:
        print(f"{len(files)} Markdown files under {root}\n")
        print(f"{'file':38} {'out':>4} {'in':>4}")
        for f in files:
            flag = "  <- orphan" if f in orphans else ""
            print(f"{f:38} {len(outbound[f]):>4} {len(inbound[f]):>4}{flag}")
        print()

    failed = False
    for label, items, fmt in (
        ("broken links", broken, lambda i: f"{i[0]} -> {i[1]}"),
        ("missing images", images, lambda i: f"{i[0]} -> {i[1]}"),
        ("orphans (no inbound links)", orphans, lambda i: i),
        ("wikilinks (not GitHub-safe)", wikis, lambda i: f"{i[0]} -> [[{i[1]}]]"),
    ):
        if items:
            failed = True
            print(f"FAIL {label}: {len(items)}")
            for i in items:
                print(f"     {fmt(i)}")
        elif not quiet:
            print(f"ok   {label}: none")

    return 1 if failed else 0


def selftest():
    import contextlib
    import io
    import tempfile

    def write(root, path, text):
        full = os.path.join(root, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        open(full, "w", encoding="utf-8").write(text)

    def silent_report(root):
        """report() prints its failures; swallow that so selftest output stays clean."""
        with contextlib.redirect_stdout(io.StringIO()):
            return report(root, quiet=True)

    with tempfile.TemporaryDirectory() as tmp:
        # A clean vault: README -> Home -> child, everything reachable.
        write(tmp, "README.md", "[home](Home.md)")
        write(tmp, "Home.md", "[readme](README.md) [child](sub/Child.md)")
        write(tmp, "sub/Child.md", "[up](../Home.md)")
        files, broken, orphans, wikis, images, _, _ = analyse(tmp)
        assert len(files) == 3, files
        assert not broken and not orphans and not wikis and not images, (broken, orphans, wikis, images)
        assert silent_report(tmp) == 0

    with tempfile.TemporaryDirectory() as tmp:
        write(tmp, "README.md", "[gone](Missing.md) [ok](Home.md)")
        write(tmp, "Home.md", "[readme](README.md)")
        _, broken, _, _, _, _, _ = analyse(tmp)
        assert broken == [("README.md", "Missing.md")], broken
        assert silent_report(tmp) == 1

    with tempfile.TemporaryDirectory() as tmp:
        # Lonely.md is linked from nowhere; README is a declared root and is exempt.
        write(tmp, "README.md", "no links here")
        write(tmp, "Lonely.md", "[readme](README.md)")
        _, _, orphans, _, _, _, _ = analyse(tmp)
        assert orphans == ["Lonely.md"], orphans

    with tempfile.TemporaryDirectory() as tmp:
        # A real wikilink fails; one inside backticks is prose about the rule.
        write(tmp, "README.md", "see [[Other]] now")
        write(tmp, "Other.md", "we never use `[[wikilinks]]` here [r](README.md)")
        _, _, _, wikis, _, _, _ = analyse(tmp)
        assert wikis == [("README.md", "Other")], wikis

    with tempfile.TemporaryDirectory() as tmp:
        # Anchors, images and external URLs must not be counted as broken *links* - an
        # absent image is reported separately, never as a broken link.
        write(tmp, "README.md",
              "[a](Home.md#some-section) ![img](nope.png) [x](https://example.com) [s](#local)")
        write(tmp, "Home.md", "[r](README.md)")
        _, broken, _, _, images, _, _ = analyse(tmp)
        assert broken == [], broken
        assert images == [("README.md", "nope.png")], images

    with tempfile.TemporaryDirectory() as tmp:
        # A present image passes; a remote one is not our problem; a multi-line alt text
        # (as used for long accessibility descriptions) must still resolve.
        os.makedirs(os.path.join(tmp, "images"))
        open(os.path.join(tmp, "images", "diagram.png"), "wb").close()
        write(tmp, "README.md",
              "![a very long\nalt text spanning lines](images/diagram.png)\n"
              "![remote](https://example.com/x.png)\n[h](Home.md)")
        write(tmp, "Home.md", "[r](README.md)")
        _, _, _, _, images, _, _ = analyse(tmp)
        assert images == [], images
        assert silent_report(tmp) == 0

    with tempfile.TemporaryDirectory() as tmp:
        # Links shown as examples in code must not count. This is the real bug the very
        # first run of this script caught in AGENTS.md, which documents the convention
        # by writing `[text](FILE.md)` in backticks.
        write(tmp, "README.md", "always write `[text](FILE.md)` [h](Home.md)")
        write(tmp, "Home.md", "```markdown\n[example](DOES_NOT_EXIST.md)\n```\n[r](README.md)")
        _, broken, _, wikis, _, _, _ = analyse(tmp)
        assert broken == [], broken
        assert wikis == [], wikis

    print("selftest OK")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--root", default=".", help="repo root to scan (default: .)")
    p.add_argument("--quiet", action="store_true", help="only print failures")
    p.add_argument("--selftest", action="store_true", help="run assertions and exit")
    a = p.parse_args()

    if a.selftest:
        selftest()
        return 0
    return report(a.root, a.quiet)


if __name__ == "__main__":
    sys.exit(main())
