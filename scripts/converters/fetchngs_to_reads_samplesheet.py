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
    --target mag        sample, group, short_reads_1, (short_reads_2), short_reads_platform
                        mag 5.5.0 - not just a rename. `short_reads_platform` is copied from
                        the fetchngs `instrument_platform` column (ENA uses mag's spellings,
                        so ILLUMINA transfers unchanged) and validated against mag's enum.
                        `group` is a study-design decision no upstream pipeline can supply -
                        see --group.

Two things this fixes beyond renaming columns:

1. fetchngs sets `sample` to the ENA *experiment* accession (ERX...), so without a rename
   every downstream result is labelled ERX13368357 instead of something meaningful.
2. Sample names are built from `collection_date`, never `sample_alias`. For LMO's
   PRJEB82694 the aliases carry pre-correction dates and disagree with `collection_date`
   for 23 of 26 samples; ENA aliases are immutable so this will not be fixed upstream.

Usage:
    fetchngs_to_reads_samplesheet.py IN.csv OUT.csv --strategy RNA-Seq [--prefix LMO]
    fetchngs_to_reads_samplesheet.py IN.csv OUT.csv --strategy RNA-Seq --target detaxizer
    fetchngs_to_reads_samplesheet.py IN.csv OUT.csv --strategy WGS --target mag [--group 0]
    fetchngs_to_reads_samplesheet.py --selftest
"""

import argparse
import csv
import re
import sys

# ENA library_strategy -> short layer tag used in sample names.
LAYER = {"RNA-Seq": "MT", "WGS": "MG", "AMPLICON": "AMP"}

# Output column -> key of the generic row built by convert(). Rows are built once and
# projected on write. For `reads` and `detaxizer` this is a pure column rename; `mag` also
# needs two columns the others do not carry, so the mapping is ordered rather than a tuple.
TARGETS = {
    "reads": {
        "sample": "sample", "fastq_1": "fastq_1", "fastq_2": "fastq_2",
    },
    "detaxizer": {
        "sample": "sample",
        "short_reads_fastq_1": "fastq_1", "short_reads_fastq_2": "fastq_2",
    },
    "mag": {
        "sample": "sample", "group": "group",
        "short_reads_1": "fastq_1", "short_reads_2": "fastq_2",
        "short_reads_platform": "platform",
    },
}

# mag 5.5.0 schema_input.json, short_reads_platform enum. ENA's instrument_platform uses the
# same spellings, so the value transfers unchanged - but ENA also emits long-read platforms
# (OXFORD_NANOPORE, PACBIO_SMRT, ...) which are NOT valid here, hence the check.
MAG_SHORT_READ_PLATFORMS = {
    "ILLUMINA", "BGISEQ", "LS454", "ION_TORRENT", "DNBSEQ", "ELEMENT", "ULTIMA",
    "VELA_DIAGNOSTICS", "GENAPSYS", "GENEMIND", "TAPESTRI",
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


def convert(rows, strategy, prefix, group="0"):
    out = []
    for row in rows:
        if row["library_strategy"] != strategy:
            continue
        out.append(
            {
                "sample": sample_name(row, prefix),
                "fastq_1": row["fastq_1"],
                "fastq_2": row.get("fastq_2", ""),
                # Only consumed by --target mag. `group` is a study-design decision that no
                # upstream pipeline can supply: in mag it selects which samples share a
                # co-abundance binning set, so one group across all samples gives every
                # assembly the differential coverage of the whole series.
                "group": group,
                "platform": row.get("instrument_platform", ""),
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
    columns = TARGETS[target]
    if target == "mag":
        for r in rows:
            if r["platform"] not in MAG_SHORT_READ_PLATFORMS:
                raise SystemExit(
                    f"{r['sample']}: instrument_platform {r['platform']!r} is not a valid mag "
                    "short_reads_platform.\n"
                    f"Accepted: {', '.join(sorted(MAG_SHORT_READ_PLATFORMS))}.\n"
                    "Long-read platforms belong in long_reads / long_reads_platform, which "
                    "this converter does not emit."
                )
            if not str(r["group"]).strip() or " " in str(r["group"]):
                raise SystemExit(
                    f"{r['sample']}: group {r['group']!r} is empty or contains a space; mag "
                    "requires group to match ^\\S+$. This is the same column detaxizer 1.3.0 "
                    "writes empty (nf-core/detaxizer#100)."
                )
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(columns))
        w.writeheader()
        for r in rows:
            w.writerow({out_col: r[key] for out_col, key in columns.items()})


def selftest():
    # instrument_platform is present on every row because fetchngs 1.12.0 always emits it
    # (bin/sra_ids_to_runinfo.py); --target mag copies it into short_reads_platform.
    rows = [
        # Two MT replicates on one date -> must get _a / _b suffixes.
        {"run_accession": "ERR12258632", "library_strategy": "RNA-Seq", "collection_date": "2016-03-15",
         "sample_alias": "LMOMETAT:2016-03-15:0.2_a", "instrument_platform": "ILLUMINA",
         "fastq_1": "/d/a_1.fastq.gz", "fastq_2": "/d/a_2.fastq.gz"},
        {"run_accession": "ERR12258633", "library_strategy": "RNA-Seq", "collection_date": "2016-03-15",
         "sample_alias": "LMOMETAT:2016-03-15:0.2_b", "instrument_platform": "ILLUMINA",
         "fastq_1": "/d/b_1.fastq.gz", "fastq_2": "/d/b_2.fastq.gz"},
        # MG row whose alias date disagrees with collection_date: the date used must be
        # the collection_date (2016-03-15), NOT the stale alias date (2017-08-15).
        {"run_accession": "ERR13967264", "library_strategy": "WGS", "collection_date": "2016-03-15",
         "sample_alias": "LMOmetaG:2017-08-15:0.2-2m:repl-a", "instrument_platform": "ILLUMINA",
         "fastq_1": "/d/g_1.fastq.gz", "fastq_2": "/d/g_2.fastq.gz"},
        {"run_accession": "ERR9715801", "library_strategy": "AMPLICON", "collection_date": "2016-03-15",
         "sample_alias": "LMO16S:2016-03-15:0.2", "instrument_platform": "ILLUMINA",
         "fastq_1": "/d/x_1.fastq.gz", "fastq_2": "/d/x_2.fastq.gz"},
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

    # Every target must carry the same sample names and paths; only the header differs.
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        for target, columns in TARGETS.items():
            out = f"{tmp}/{target}.csv"
            write(mt, out, target)
            with open(out, newline="") as fh:
                got = list(csv.reader(fh))
            assert got[0] == list(columns), (target, got[0])
            assert got[1][0] == "LMO_20160315_MT_a", (target, got[1])
            assert "/d/a_1.fastq.gz" in got[1], (target, got[1])

        # mag carries two columns the other targets do not, sourced rather than renamed.
        mg = convert(rows, "WGS", "LMO")
        write(mg, f"{tmp}/mag.csv", "mag")
        with open(f"{tmp}/mag.csv", newline="") as fh:
            got = list(csv.DictReader(fh))
        assert got[0]["short_reads_platform"] == "ILLUMINA", got  # copied from ENA
        assert got[0]["group"] == "0", got                        # default
        assert got[0]["sample"] == "LMO_20160315_MG_a", got

        # a non-default group must reach the sheet
        write(convert(rows, "WGS", "LMO", group="spring"), f"{tmp}/g.csv", "mag")
        with open(f"{tmp}/g.csv", newline="") as fh:
            assert list(csv.DictReader(fh))[0]["group"] == "spring"

        # a long-read platform is not a valid short_reads_platform - refuse, do not pass through
        nanopore = [dict(rows[2], instrument_platform="OXFORD_NANOPORE")]
        try:
            write(convert(nanopore, "WGS", "LMO"), f"{tmp}/n.csv", "mag")
        except SystemExit as exc:
            assert "not a valid mag short_reads_platform" in str(exc), exc
        else:
            raise AssertionError("long-read platform was not rejected")

        # an empty group is exactly the detaxizer#100 bug; do not reproduce it
        try:
            write(convert(rows, "WGS", "LMO", group=""), f"{tmp}/e.csv", "mag")
        except SystemExit as exc:
            assert "group" in str(exc) and "^\\S+$" in str(exc), exc
        else:
            raise AssertionError("empty group was not rejected")

    print("selftest OK")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("infile", nargs="?", help="fetchngs samplesheet.csv")
    p.add_argument("outfile", nargs="?", help="samplesheet to write")
    p.add_argument("--strategy", default="RNA-Seq", help="ENA library_strategy to keep (default: RNA-Seq)")
    p.add_argument("--prefix", default="LMO", help="sample-name prefix (default: LMO)")
    p.add_argument("--target", default="reads", choices=sorted(TARGETS),
                   help="output column names (default: reads)")
    p.add_argument("--group", default="0",
                   help="--target mag only: mag's co-abundance binning group. One group for "
                        "every sample (the default) gives each assembly the differential "
                        "coverage of the whole series (default: 0)")
    p.add_argument("--selftest", action="store_true", help="run assertions and exit")
    a = p.parse_args()

    if a.selftest:
        selftest()
        return
    if not (a.infile and a.outfile):
        p.error("infile and outfile are required unless --selftest is given")

    with open(a.infile, newline="") as fh:
        rows = list(csv.DictReader(fh))
    out = convert(rows, a.strategy, a.prefix, a.group)
    write(out, a.outfile, a.target)
    print(f"wrote {len(out)} rows to {a.outfile} (--target {a.target})", file=sys.stderr)
    for r in out:
        print(f"  {r['sample']}", file=sys.stderr)


if __name__ == "__main__":
    main()
