#!/usr/bin/env python3
"""Convert an nf-core/fetchngs samplesheet into a downstream read samplesheet.

fetchngs has no `--nf_core_pipeline` option for ampliseq, mag, metatdenovo, detaxizer or
viralmetagenome (its enum is [rnaseq, atacseq, viralrecon, taxprofiler]), so the generic
samplesheet must be converted by hand. Everything below is one row per run with a forward
and an optional reverse FASTQ; only the column *names* differ, so `--target` picks them:

    --target reads      sample, fastq_1, (fastq_2)
                        metatdenovo 1.4.0, ampliseq 2.18.0, viralmetagenome 1.1.3
    --target detaxizer  sample, short_reads_fastq_1, (short_reads_fastq_2)
                        detaxizer 1.3.0 - same data, different column names, which is the
                        whole reason `fetchngs -> detaxizer` is CONVERSION REQUIRED

mag is deliberately not handled: it additionally requires `group` and
`short_reads_platform`, which is a different shape, not a different set of column names.

Two things this fixes beyond renaming columns:

1. fetchngs sets `sample` to the ENA *experiment* accession (ERX...), so without a rename
   every downstream result is labelled ERX13368357 instead of something meaningful.
2. Sample names are built from `collection_date`, never `sample_alias`. For LMO's
   PRJEB82694 the aliases carry pre-correction dates and disagree with `collection_date`
   for 23 of 26 samples; ENA aliases are immutable so this will not be fixed upstream.

Usage:
    fetchngs_to_reads_samplesheet.py IN.csv OUT.csv --strategy RNA-Seq [--prefix LMO]
    fetchngs_to_reads_samplesheet.py IN.csv OUT.csv --strategy RNA-Seq --target detaxizer
    fetchngs_to_reads_samplesheet.py --selftest
"""

import argparse
import csv
import re
import sys

# ENA library_strategy -> short layer tag used in sample names.
LAYER = {"RNA-Seq": "MT", "WGS": "MG", "AMPLICON": "AMP"}

# Output column names per target. The rows are built once with the generic keys below and
# renamed on write, because the only difference between these schemas is what the two FASTQ
# columns are called.
TARGETS = {
    "reads": ("sample", "fastq_1", "fastq_2"),
    "detaxizer": ("sample", "short_reads_fastq_1", "short_reads_fastq_2"),
}

# Replicate suffix as written in LMO sample aliases: "..._a" or "...:repl-a".
REPLICATE = re.compile(r"(?:_|repl-)([a-z])$")


def sample_name(row, prefix):
    """Build a stable, meaningful sample id from the corrected collection date."""
    date = row["collection_date"]
    if not date:
        raise ValueError(f"{row['run_accession']}: empty collection_date")
    layer = LAYER.get(row["library_strategy"], row["library_strategy"])
    parts = [prefix, date.replace("-", ""), layer]
    rep = REPLICATE.search(row["sample_alias"] or "")
    if rep:
        parts.append(rep.group(1))
    return "_".join(parts)


def convert(rows, strategy, prefix):
    out = []
    for row in rows:
        if row["library_strategy"] != strategy:
            continue
        out.append(
            {
                "sample": sample_name(row, prefix),
                "fastq_1": row["fastq_1"],
                "fastq_2": row.get("fastq_2", ""),
            }
        )
    if not out:
        raise SystemExit(f"no rows with library_strategy={strategy!r}")

    names = [r["sample"] for r in out]
    dupes = {n for n in names if names.count(n) > 1}
    if dupes:
        raise SystemExit(f"sample names are not unique: {sorted(dupes)}")
    return sorted(out, key=lambda r: r["sample"])


def write(rows, path, target="reads"):
    sample_col, fq1_col, fq2_col = TARGETS[target]
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=[sample_col, fq1_col, fq2_col])
        w.writeheader()
        for r in rows:
            w.writerow({sample_col: r["sample"], fq1_col: r["fastq_1"], fq2_col: r["fastq_2"]})


def selftest():
    rows = [
        # Two MT replicates on one date -> must get _a / _b suffixes.
        {"run_accession": "ERR12258632", "library_strategy": "RNA-Seq", "collection_date": "2016-03-15",
         "sample_alias": "LMOMETAT:2016-03-15:0.2_a", "fastq_1": "/d/a_1.fastq.gz", "fastq_2": "/d/a_2.fastq.gz"},
        {"run_accession": "ERR12258633", "library_strategy": "RNA-Seq", "collection_date": "2016-03-15",
         "sample_alias": "LMOMETAT:2016-03-15:0.2_b", "fastq_1": "/d/b_1.fastq.gz", "fastq_2": "/d/b_2.fastq.gz"},
        # MG row whose alias date disagrees with collection_date: the date used must be
        # the collection_date (2016-03-15), NOT the stale alias date (2017-08-15).
        {"run_accession": "ERR13967264", "library_strategy": "WGS", "collection_date": "2016-03-15",
         "sample_alias": "LMOmetaG:2017-08-15:0.2-2m:repl-a", "fastq_1": "/d/g_1.fastq.gz", "fastq_2": "/d/g_2.fastq.gz"},
        {"run_accession": "ERR9715801", "library_strategy": "AMPLICON", "collection_date": "2016-03-15",
         "sample_alias": "LMO16S:2016-03-15:0.2", "fastq_1": "/d/x_1.fastq.gz", "fastq_2": "/d/x_2.fastq.gz"},
    ]

    mt = convert(rows, "RNA-Seq", "LMO")
    assert [r["sample"] for r in mt] == ["LMO_20160315_MT_a", "LMO_20160315_MT_b"], mt
    assert mt[0]["fastq_2"] == "/d/a_2.fastq.gz"

    mg = convert(rows, "WGS", "LMO")
    assert mg[0]["sample"] == "LMO_20160315_MG_a", mg  # collection_date wins over alias
    assert "2017" not in mg[0]["sample"], "stale alias date leaked into the sample name"

    amp = convert(rows, "AMPLICON", "LMO")
    assert amp[0]["sample"] == "LMO_20160315_AMP", amp  # no replicate suffix

    # A duplicate sample name must fail loudly rather than silently collapse samples.
    clash = [dict(rows[0]), dict(rows[0])]
    clash[1]["run_accession"] = "ERRother"
    try:
        convert(clash, "RNA-Seq", "LMO")
    except SystemExit as exc:
        assert "not unique" in str(exc)
    else:
        raise AssertionError("duplicate sample names were not rejected")

    # --target only renames columns; the rows themselves must be identical.
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        for target, expected in TARGETS.items():
            out = f"{tmp}/{target}.csv"
            write(mt, out, target)
            with open(out, newline="") as fh:
                got = list(csv.reader(fh))
            assert tuple(got[0]) == expected, (target, got[0])
            assert got[1][0] == "LMO_20160315_MT_a" and got[1][1] == "/d/a_1.fastq.gz", got[1]

    print("selftest OK")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("infile", nargs="?", help="fetchngs samplesheet.csv")
    p.add_argument("outfile", nargs="?", help="samplesheet to write")
    p.add_argument("--strategy", default="RNA-Seq", help="ENA library_strategy to keep (default: RNA-Seq)")
    p.add_argument("--prefix", default="LMO", help="sample-name prefix (default: LMO)")
    p.add_argument("--target", default="reads", choices=sorted(TARGETS),
                   help="output column names (default: reads)")
    p.add_argument("--selftest", action="store_true", help="run assertions and exit")
    a = p.parse_args()

    if a.selftest:
        selftest()
        return
    if not (a.infile and a.outfile):
        p.error("infile and outfile are required unless --selftest is given")

    with open(a.infile, newline="") as fh:
        rows = list(csv.DictReader(fh))
    out = convert(rows, a.strategy, a.prefix)
    write(out, a.outfile, a.target)
    print(f"wrote {len(out)} rows to {a.outfile} (--target {a.target})", file=sys.stderr)
    for r in out:
        print(f"  {r['sample']}", file=sys.stderr)


if __name__ == "__main__":
    main()
