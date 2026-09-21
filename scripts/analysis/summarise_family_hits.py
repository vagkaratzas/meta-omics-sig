#!/usr/bin/env python3
"""Summarise an hmmsearch of one run's family HMMs against another run's family reps.

Reads the `--domtblout` written by hmmsearch_families.sh and keeps a (model, target) pair
as a match when both hold:

- full-sequence E-value <= --evalue (default 1e-5),
- the domains that pass --evalue cover at least --min-cov of the HMM **and** of the
  target sequence (default 0.5). Overlapping domains are merged before measuring, so a
  repeat is not counted twice. 0.5 mirrors proteinfamilies' own `cluster_coverage`.

Coverage on both sides is what makes a match mean "same family" rather than "shares a
domain": a multidomain representative that carries one domain of the model's family
would pass the E-value alone.

Writes OUT.tsv with every matching pair, and prints how many models and how many targets
have at least one match. Totals come from the HMM library and the reps FASTA, so models
and targets with no hit at all are counted too.

Usage:
    summarise_family_hits.py DOMTBL HMM_LIB REPS.faa OUT.tsv [--evalue 1e-5] [--min-cov 0.5]
    summarise_family_hits.py --selftest
"""

import argparse
import csv
import gzip
import sys
import tempfile
from pathlib import Path


def open_text(path):
    path = Path(path)
    return gzip.open(path, "rt") if path.suffix == ".gz" else path.open()


def covered(intervals):
    """Residues covered by a set of 1-based inclusive intervals, overlaps merged."""
    total, end = 0, 0
    for a, b in sorted(intervals):
        if b > end:
            total += b - max(a, end + 1) + 1
            end = b
    return total


def parse_domtbl(path, evalue):
    """(model, target) -> dict with full-sequence stats and the passing domains' intervals."""
    pairs = {}
    with open_text(path) as fh:
        for line in fh:
            if line.startswith("#"):
                continue
            f = line.split()
            target, tlen, model, qlen = f[0], int(f[2]), f[3], int(f[5])
            full_e, full_score, dom_ie = float(f[6]), float(f[7]), float(f[12])
            p = pairs.setdefault((model, target), {
                "evalue": full_e, "score": full_score, "qlen": qlen, "tlen": tlen,
                "hmm": [], "ali": [],
            })
            if dom_ie <= evalue:
                p["hmm"].append((int(f[15]), int(f[16])))
                p["ali"].append((int(f[17]), int(f[18])))
    return pairs


def matches(pairs, evalue, min_cov):
    rows = []
    for (model, target), p in pairs.items():
        if p["evalue"] > evalue or not p["hmm"]:
            continue
        hmm_cov = covered(p["hmm"]) / p["qlen"]
        target_cov = covered(p["ali"]) / p["tlen"]
        if hmm_cov >= min_cov and target_cov >= min_cov:
            rows.append({
                "model": model, "target": target, "evalue": p["evalue"], "score": p["score"],
                "hmm_cov": round(hmm_cov, 3), "target_cov": round(target_cov, 3),
            })
    return sorted(rows, key=lambda r: (r["model"], r["evalue"]))


def count_models(hmm_lib):
    with open_text(hmm_lib) as fh:
        return sum(line.startswith("NAME ") for line in fh)


def count_targets(reps):
    with open_text(reps) as fh:
        return sum(line.startswith(">") for line in fh)


def summarise(domtbl, hmm_lib, reps, out, evalue, min_cov):
    rows = matches(parse_domtbl(domtbl, evalue), evalue, min_cov)
    with open(out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["model", "target", "evalue", "score", "hmm_cov", "target_cov"],
                           delimiter="\t")
        w.writeheader()
        w.writerows(rows)
    n_models, n_targets = count_models(hmm_lib), count_targets(reps)
    hit_models = len({r["model"] for r in rows})
    hit_targets = len({r["target"] for r in rows})
    print(f"thresholds: full E-value <= {evalue:g}, HMM and target coverage >= {min_cov:g}")
    print(f"models with a match:  {hit_models} of {n_models} ({hit_models / n_models:.1%})")
    print(f"targets with a match: {hit_targets} of {n_targets} ({hit_targets / n_targets:.1%})")
    print(f"matching pairs:       {len(rows)} -> {out}")
    return hit_models, n_models, hit_targets, n_targets


def selftest():
    assert covered([]) == 0
    assert covered([(1, 10), (5, 20)]) == 20
    assert covered([(1, 10), (11, 20), (30, 30)]) == 21
    assert covered([(5, 20), (1, 10), (6, 8)]) == 20

    # domtbl columns: target tacc tlen query qacc qlen fullE fullScore fullBias # of
    #                 cE iE domScore domBias hmmFrom hmmTo aliFrom aliTo envFrom envTo acc desc
    def dom(target, tlen, model, qlen, full_e, ie, hmm, ali):
        return (f"{target} - {tlen} {model} - {qlen} {full_e} 100.0 0.1 1 1 {ie} {ie} 90.0 0.1 "
                f"{hmm[0]} {hmm[1]} {ali[0]} {ali[1]} {ali[0]} {ali[1]} 0.9 -\n")

    lines = [
        "# comment line\n",
        # full-length match split over two overlapping domains: kept
        dom("t_full", 100, "m1", 100, 1e-30, 1e-20, (1, 60), (1, 60)),
        dom("t_full", 100, "m1", 100, 1e-30, 1e-20, (50, 100), (50, 100)),
        # shares only a domain with m1: HMM covered, but 30% of a long target: dropped
        dom("t_multi", 300, "m1", 100, 1e-30, 1e-20, (1, 90), (1, 90)),
        # covers enough, but full E-value too weak: dropped
        dom("t_weak", 100, "m2", 100, 1e-3, 1e-4, (1, 100), (1, 100)),
        # good full E-value, but the only domain fails the domain E-value: dropped
        dom("t_dom", 100, "m2", 100, 1e-10, 1e-2, (1, 100), (1, 100)),
        # second model hitting the same target: both pairs kept, target counted once
        dom("t_full", 100, "m3", 120, 1e-12, 1e-12, (1, 110), (5, 95)),
    ]
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        domtbl = d / "x.domtbl"
        domtbl.write_text("".join(lines))
        lib = d / "lib.gz"
        with gzip.open(lib, "wt") as fh:
            fh.write("".join(f"HMMER3/f\nNAME  m{i}\nLENG  100\n//\n" for i in range(1, 5)))
        reps = d / "reps.faa"
        reps.write_text("".join(f">{t}\nMK\n" for t in ["t_full", "t_multi", "t_weak", "t_dom", "t_none"]))
        out = d / "out.tsv"

        assert summarise(domtbl, lib, reps, out, 1e-5, 0.5) == (2, 4, 1, 5)
        rows = list(csv.DictReader(out.open(), delimiter="\t"))
        assert [(r["model"], r["target"]) for r in rows] == [("m1", "t_full"), ("m3", "t_full")], rows
        assert rows[0]["hmm_cov"] == "1.0" and rows[1]["hmm_cov"] == "0.917", rows

        # a looser coverage threshold lets the multidomain target in
        assert summarise(domtbl, lib, reps, out, 1e-5, 0.3)[2] == 2
    print("selftest OK")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("domtbl", nargs="?")
    p.add_argument("hmm_lib", nargs="?", help="the HMM library that was searched (.gz or plain)")
    p.add_argument("reps", nargs="?", help="the representatives FASTA that was searched")
    p.add_argument("out", nargs="?", help="TSV of matching pairs")
    p.add_argument("--evalue", type=float, default=1e-5, help="full-sequence and domain E-value (default 1e-5)")
    p.add_argument("--min-cov", type=float, default=0.5, help="HMM and target coverage (default 0.5)")
    p.add_argument("--selftest", action="store_true", help="run assertions and exit")
    a = p.parse_args()
    if a.selftest:
        return selftest()
    if not all([a.domtbl, a.hmm_lib, a.reps, a.out]):
        p.error("DOMTBL, HMM_LIB, REPS and OUT are required")
    summarise(a.domtbl, a.hmm_lib, a.reps, a.out, a.evalue, a.min_cov)


if __name__ == "__main__":
    sys.exit(main())
