"""Compare the metro map's connections with docs/data.json (the validation table's edges).
Stdlib only. Prints edges only on the map and edges only in data.json; exits 1 if they differ.

  python3 scripts/check_map.py [SCRIPT] [DATA_JSON]
  python3 scripts/check_map.py --selftest

The map's edges are the EDGES list (JSON) between the `edges:begin` / `edges:end` comments in
.claude/skills/update-metro-map/scripts/sig_map.js, the script that draws the map. `reference-genomes`
is the FASTA input icon. A difference is not an error by itself: an edge the SIG drew but the table
doesn't track yet shows up here so it gets added to data.json or explained (see the update-metro-map skill).
"""

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SCRIPT = REPO / ".claude/skills/update-metro-map/scripts/sig_map.js"
EDGES = re.compile(r"//\s*edges:begin[^\n]*\n\s*const EDGES = (\[.*?\]);\s*//\s*edges:end", re.S)


def map_edges(text: str) -> set[tuple[str, str]]:
    m = EDGES.search(text)
    if not m:
        sys.exit("no `edges:begin` ... `const EDGES = [...]` ... `edges:end` block found")
    return {(a, b) for a, b in json.loads(m.group(1))}


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
    js = """(function () {
  // edges:begin (JSON)
  const EDGES = [
    ["a", "c"], ["b", "c"],
    ["reference-genomes", "d"]
  ];
  // edges:end
  const x = [1, 2];
})();"""
    assert map_edges(js) == {("a", "c"), ("b", "c"), ("reference-genomes", "d")}, map_edges(js)
    data = {"edges": [{"from": "a", "to": "c"}, {"from": "c", "to": "e"}]}
    assert json_edges(data) == {("a", "c"), ("c", "e")}
    assert report({("a", "c")}, {("a", "c")}) == 0
    assert report({("a", "c")}, {("a", "c"), ("c", "e")}) == 1
    print("selftest ok")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--selftest"]:
        selftest()
        sys.exit(0)
    script = Path(sys.argv[1]) if len(sys.argv) > 1 else SCRIPT
    js = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO / "docs/data.json"
    sys.exit(report(map_edges(script.read_text()), json_edges(json.loads(js.read_text()))))
