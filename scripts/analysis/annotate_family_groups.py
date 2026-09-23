#!/usr/bin/env python3
"""Split one proteinfamilies run's families into matched / unmatched and compare annotation.

Written for run 03 (metatranscriptome families) against run 06 (metagenome families), with
the InterProScan output of run 07 (proteinannotator on run 03's representatives): are the
metatranscriptome families with no metagenome counterpart annotated less, or differently?

Three inputs are joined:

- META: proteinfamilies' `family_reps/<sample>/<sample>_meta_mqc.csv`. The `Family Id` is
  the HMM name, the `Representative Id` is the sequence proteinannotator annotated.
- HITS: the TSV written by summarise_family_hits.py. Its `model` column is a family of the
  run whose HMMs were searched, so it must be the same run as META. A family is "matched"
  when it appears there at least once.
- IPS: proteinannotator's `functional_annotation/interproscan/<id>/<id>.tsv`.
  proteinannotator's SeqKit step replaces "/" with "_" in headers, so a representative
  `k141_1_1/4-125` is `k141_1_1_4-125` in IPS. The same substitution is applied here.

Writes OUT.tsv with one row per family: group, representative, and the best match (lowest
E-value) per member database plus the InterPro entries. Prints, per group, how many
families have any match and how many have a match in each member database.

Stops instead of guessing if a HITS model is not a META family (names do not line up) or an
IPS protein is not a META representative (wrong run or missed substitution).

Usage:
    annotate_family_groups.py META.csv HITS.tsv IPS.tsv OUT.tsv
    annotate_family_groups.py --selftest
"""

import argparse
import csv
import sys
import tempfile
from pathlib import Path

DBS = ["PANTHER", "Hamap", "TIGRFAM", "PIRSF", "SFLD"]


def read_meta(path):
    """Family Id -> row. Skips the MultiQC '#' header lines."""
    with open(path) as fh:
        rows = csv.DictReader(line for line in fh if not line.startswith("#"))
        return {r["Family Id"]: r for r in rows}


def read_matched(path):
    with open(path) as fh:
        return {r["model"] for r in csv.DictReader(fh, delimiter="\t")}


def read_ips(path):
    """protein -> {db: (evalue, 'acc desc'), 'InterPro': set of 'IPR desc'}."""
    ann = {}
    with open(path) as fh:
        for line in fh:
            f = line.rstrip("\n").split("\t")
            protein, db, acc, desc = f[0], f[3], f[4], f[5]
            try:
                evalue = float(f[8])
            except ValueError:  # "-" for databases that report no E-value
                evalue = float("inf")
            a = ann.setdefault(protein, {"InterPro": set()})
            if db not in a or evalue < a[db][0]:
                a[db] = (evalue, f"{acc} {desc}".strip())
            if len(f) > 11 and f[11] not in ("", "-"):
                a["InterPro"].add(f"{f[11]} {f[12] if len(f) > 12 else ''}".strip())
    return ann


def join(meta, matched, ips):
    unknown = matched - meta.keys()
    if unknown:
        sys.exit(f"{len(unknown)} HITS models are not META families, e.g. {sorted(unknown)[:3]}: "
                 "HITS must come from searching this run's HMMs")
    by_rep = {r["Representative Id"].replace("/", "_"): fam for fam, r in meta.items()}
    stray = ips.keys() - by_rep.keys()
    if stray:
        sys.exit(f"{len(stray)} IPS proteins are not META representatives, e.g. {sorted(stray)[:3]}")
    rows = []
    for fam, r in sorted(meta.items()):
        a = ips.get(r["Representative Id"].replace("/", "_"), {"InterPro": set()})
        rows.append({
            "family": fam,
            "group": "matched" if fam in matched else "unmatched",
            "representative": r["Representative Id"],
            "size": r["Size"],
            "rep_length": r["Representative Length"],
            **{db: a[db][1] if db in a else "" for db in DBS},
            "InterPro": "; ".join(sorted(a["InterPro"])),
        })
    return rows


def summarise(rows):
    """group -> (families, with any match, {db: with a match in db})."""
    out = {}
    for g in ("matched", "unmatched"):
        grp = [r for r in rows if r["group"] == g]
        out[g] = (len(grp),
                  sum(any(r[db] for db in DBS) for r in grp),
                  {db: sum(bool(r[db]) for r in grp) for db in DBS + ["InterPro"]})
    return out


def run(meta_path, hits_path, ips_path, out_path):
    rows = join(read_meta(meta_path), read_matched(hits_path), read_ips(ips_path))
    with open(out_path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]), delimiter="\t")
        w.writeheader()
        w.writerows(rows)
    s = summarise(rows)
    pct = lambda k, n: f"{k:>4} ({k / n:.1%})" if n else f"{k:>4}"
    print(f"{'':<22}{'matched':>16}{'unmatched':>16}")
    print(f"{'families':<22}{s['matched'][0]:>16}{s['unmatched'][0]:>16}")
    print(f"{'any InterProScan match':<22}"
          + "".join(f"{pct(s[g][1], s[g][0]):>16}" for g in s))
    for db in DBS + ["InterPro"]:
        print(f"{db:<22}" + "".join(f"{pct(s[g][2][db], s[g][0]):>16}" for g in s))
    print(f"-> {out_path}")
    return s


def selftest():
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        meta = d / "meta.csv"
        meta.write_text(
            '# id: "family_metadata"\n# plot_type: "table"\n'
            '"Sample Name","Family Id","Size","Representative Length","Representative Id","Sequence"\n'
            '"LMO_1_1","LMO_1_1",30,100,"k141_1_1/4-125","MK"\n'
            '"LMO_1_2","LMO_1_2",40,90,"k141_2_1/1-90","MK"\n'
            '"LMO_2_1","LMO_2_1",25,80,"k141_3_2/10-89","MK"\n')
        hits = d / "hits.tsv"
        hits.write_text("model\ttarget\tevalue\n"
                        "LMO_1_1\tx\t1e-30\nLMO_1_1\ty\t1e-10\nLMO_1_2\tz\t1e-20\n")

        def ips_line(p, db, acc, e, ipr="-", ipr_desc="-"):
            return f"{p}\tmd5\t100\t{db}\t{acc}\tdesc {acc}\t1\t90\t{e}\tT\t22-09-2026\t{ipr}\t{ipr_desc}\n"

        ips = d / "ips.tsv"
        ips.write_text(
            # two PANTHER rows for one protein: the lower E-value is kept
            ips_line("k141_1_1_4-125", "PANTHER", "PTHR1", "1e-5")
            + ips_line("k141_1_1_4-125", "PANTHER", "PTHR2", "1e-40", "IPR000001", "Kinase")
            + ips_line("k141_1_1_4-125", "Hamap", "MF_1", "-", "IPR000002", "Ribosomal")
            # unmatched family with a PANTHER hit; LMO_1_2 has no IPS row at all
            + ips_line("k141_3_2_10-89", "PANTHER", "PTHR3", "1e-9"))
        out = d / "out.tsv"

        s = run(meta, hits, ips, out)
        assert s["matched"][:2] == (2, 1), s
        assert s["unmatched"][:2] == (1, 1), s
        assert s["matched"][2]["Hamap"] == 1 and s["unmatched"][2]["Hamap"] == 0, s
        rows = {r["family"]: r for r in csv.DictReader(out.open(), delimiter="\t")}
        assert rows["LMO_1_1"]["PANTHER"] == "PTHR2 desc PTHR2", rows["LMO_1_1"]
        assert rows["LMO_1_1"]["InterPro"] == "IPR000001 Kinase; IPR000002 Ribosomal", rows["LMO_1_1"]
        assert rows["LMO_1_2"]["group"] == "matched" and rows["LMO_1_2"]["PANTHER"] == ""
        assert rows["LMO_2_1"]["group"] == "unmatched"

        # guards: HITS from the other run's HMMs, and IPS from a different run's reps
        for bad_hits, bad_ips in [("model\nMG_9_9\n", ips.read_text()),
                                  (hits.read_text(), ips_line("k141_1_1/4-125", "PANTHER", "P", "1"))]:
            hits.write_text(bad_hits)
            ips.write_text(bad_ips)
            try:
                run(meta, hits, ips, out)
            except SystemExit:
                pass
            else:
                raise AssertionError("mismatched inputs were accepted")
    print("selftest OK")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("meta", nargs="?", help="<sample>_meta_mqc.csv of the run whose HMMs were searched")
    p.add_argument("hits", nargs="?", help="TSV written by summarise_family_hits.py")
    p.add_argument("ips", nargs="?", help="proteinannotator InterProScan TSV for the same representatives")
    p.add_argument("out", nargs="?", help="per-family TSV to write")
    p.add_argument("--selftest", action="store_true", help="run assertions and exit")
    a = p.parse_args()
    if a.selftest:
        return selftest()
    if not all([a.meta, a.hits, a.ips, a.out]):
        p.error("META, HITS, IPS and OUT are required")
    run(a.meta, a.hits, a.ips, a.out)


if __name__ == "__main__":
    sys.exit(main())
