"""Compare the metro map's connections with docs/data.json (the validation table's edges).
Stdlib only. Prints edges only on the map and edges only in data.json; exits 1 if they differ.

  python3 scripts/check_map.py [MMD] [DATA_JSON]
  python3 scripts/check_map.py --selftest

Hidden stations (id starts with `_`) are junctions: an edge A -> _x -> B counts as A -> B.
File-icon stations (`%%metro file:/files:/dir:`) are inputs drawn for readability, not
pipelines: their edges are skipped unless ALIASES maps them to a data.json station.
A difference is not an error by itself: an edge the SIG drew but the table doesn't track yet
shows up here so it gets added to data.json or explained (see the update-metro-map skill).
"""

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ALIASES = {"ref_in": "reference-genomes"}  # map file-icon station -> data.json station
EDGE = re.compile(r"^\s*([\w-]+)(?:\[[^\]]*\])?\s*-->\|[^|]*\|\s*([\w-]+)")
ICON = re.compile(r"^\s*%%metro (?:file|files|dir):\s*([\w-]+)")


def map_edges(text: str) -> set[tuple[str, str]]:
    icons = {m.group(1) for m in map(ICON.match, text.splitlines()) if m} - set(ALIASES)
    raw = set()
    for line in text.splitlines():
        m = EDGE.match(line)
        if m and not line.lstrip().startswith("%%") and m.group(1) not in icons:
            raw.add(tuple(ALIASES.get(n, n) for n in m.groups()))
    out = set()
    for a, b in raw:
        if a.startswith("_"):
            continue
        if b.startswith("_"):  # expand through junctions (one level is all the map uses)
            out |= {(a, c) for x, c in raw if x == b and not c.startswith("_")}
        else:
            out.add((a, b))
    return out


def json_edges(data: dict) -> set[tuple[str, str]]:
    return {(e["from"], e["to"]) for e in data["edges"]}


def report(on_map: set, in_json: set) -> int:
    for label, diff in (("only on the map", on_map - in_json), ("only in data.json", in_json - on_map)):
        print(f"{len(diff)} edge(s) {label}")
        for a, b in sorted(diff):
            print(f"  {a} -> {b}")
    print(f"{len(on_map & in_json)} edge(s) in both")
    return 1 if on_map ^ in_json else 0


def selftest() -> None:
    mmd = """%%metro line: s | shotgun | #000
%%metro files: reads_icon | FASTQ
    a[A] -->|s| _j
    b -->|s| _j
    _j -->|s| c
    ref_in -->|s| d
    reads_icon -->|s| c
    %% x -->|s| y is a comment
"""
    assert map_edges(mmd) == {("a", "c"), ("b", "c"), ("reference-genomes", "d")}, map_edges(mmd)
    data = {"edges": [{"from": "a", "to": "c"}, {"from": "c", "to": "e"}]}
    assert json_edges(data) == {("a", "c"), ("c", "e")}
    assert report({("a", "c")}, {("a", "c")}) == 0
    print("selftest ok")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--selftest"]:
        selftest()
        sys.exit(0)
    mmd = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / "images/nf-core-meta-omics-metromap.mmd"
    js = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO / "docs/data.json"
    sys.exit(report(map_edges(mmd.read_text()), json_edges(json.loads(js.read_text()))))
