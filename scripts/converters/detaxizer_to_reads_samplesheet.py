#!/usr/bin/env python3
"""Build a `sample,fastq_1,fastq_2` samplesheet from an nf-core/detaxizer output dir.

detaxizer 1.3.0 ships `--generate_downstream_samplesheets`, but
`--generate_pipeline_samplesheets` is constrained by
`^(taxprofiler|mag)(?:,(taxprofiler|mag)){0,1}` - metatdenovo, ampliseq and
viralmetagenome are not in the enum, so the edge into them needs this step.

The filtered reads land in `<outdir>/filter/filtered/`, named by whichever
`--filtering_tool` ran:

    seqkit (default)  <sample>_R1_filtered.fastq.gz / <sample>_R2_filtered.fastq.gz
    bbmap             <sample>_filtered_1.fastq.gz  / <sample>_filtered_2.fastq.gz
    either, SE        <sample>_filtered.fastq.gz
    long reads        <sample>_longReads_filtered.fastq.gz

Both schemes are read, because `--filtering_tool` is a flag a user may flip between runs
and the naming silently changes with it.

Pair synchronisation, checked in detaxizer 1.3.0 source, because a co-assembler will not
tolerate desynchronised mates: `MERGE_IDS` unions the per-mate / per-classifier hit lists
into ONE id file per sample, and `modules/local/filter.nf` applies that same list to both
mates via `seqkit grep -v -f`. The mate of a removed read is therefore removed too and
R1/R2 stay in step. This script does not re-verify that per run - counting reads in a
gzipped FASTQ is not a samplesheet's job - it only guarantees both mates are present.

Usage:
    detaxizer_to_reads_samplesheet.py DETAXIZER_OUTDIR OUT.csv
    detaxizer_to_reads_samplesheet.py --selftest
"""

import argparse
import csv
import re
import sys
from pathlib import Path

# <sample>_R1_filtered.fastq.gz (seqkit) and <sample>_filtered_1.fastq.gz (bbmap).
# Group 1 is the sample name, group 2 the mate number.
MATE_PATTERNS = (
    re.compile(r"^(?P<sample>.+)_R(?P<mate>[12])_filtered\.fastq\.gz$"),
    re.compile(r"^(?P<sample>.+)_filtered_(?P<mate>[12])\.fastq\.gz$"),
)
SINGLE_PATTERN = re.compile(r"^(?P<sample>.+)_filtered\.fastq\.gz$")


def parse(name):
    """(sample, mate) for a filtered FASTQ, mate None for single-end. None if unrecognised."""
    for pattern in MATE_PATTERNS:
        m = pattern.match(name)
        if m:
            return m.group("sample"), int(m.group("mate"))
    m = SINGLE_PATTERN.match(name)
    if m:
        return m.group("sample"), None
    return None


def build(outdir):
    filtered = Path(outdir) / "filter" / "filtered"
    if not filtered.is_dir():
        raise SystemExit(
            f"no {filtered} directory.\n"
            "detaxizer only publishes filtered reads when it actually filters: with "
            "--skip_filter true this directory is never created, and "
            "--generate_downstream_samplesheets produces nothing either, because the "
            "generator is fed ch_filtered_reads, which stays empty."
        )

    samples = {}
    for path in sorted(filtered.glob("*.fastq.gz")):
        hit = parse(path.name)
        if hit is None:
            continue
        sample, mate = hit
        samples.setdefault(sample, {})[mate] = str(path.resolve())

    if not samples:
        raise SystemExit(f"{filtered} holds no *_filtered.fastq.gz files")

    long_reads = [s for s in samples if s.endswith("_longReads")]
    if long_reads:
        raise SystemExit(
            "long-read samples cannot go into a sample,fastq_1,fastq_2 samplesheet: "
            + ", ".join(sorted(long_reads))
            + "\nmetatdenovo, ampliseq and viralmetagenome all take short reads here."
        )

    rows = []
    for sample in sorted(samples):
        mates = samples[sample]
        if None in mates:
            # Single-end: one file, no mate suffix at all.
            rows.append({"sample": sample, "fastq_1": mates[None], "fastq_2": ""})
            continue
        missing = {1, 2} - set(mates)
        if missing:
            raise SystemExit(
                f"{sample}: paired naming but mate {missing.pop()} is missing. "
                "A half-published sample means the detaxizer run did not finish - "
                "do not co-assemble from it."
            )
        rows.append({"sample": sample, "fastq_1": mates[1], "fastq_2": mates[2]})
    return rows


def write(rows, path):
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["sample", "fastq_1", "fastq_2"])
        w.writeheader()
        w.writerows(rows)


def selftest():
    import tempfile

    assert parse("LMO_20160315_MT_a_R1_filtered.fastq.gz") == ("LMO_20160315_MT_a", 1)
    assert parse("LMO_20160315_MT_a_filtered_2.fastq.gz") == ("LMO_20160315_MT_a", 2)
    assert parse("LMO_20160315_MT_a_filtered.fastq.gz") == ("LMO_20160315_MT_a", None)
    assert parse("LMO_20160315_MT_a_R1_removed.fastq.gz") is None

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "run"
        filt = root / "filter" / "filtered"
        filt.mkdir(parents=True)

        # seqkit naming, two paired samples; removed/ reads must never be picked up
        for s in ("LMO_20160315_MT_a", "LMO_20160315_MT_b"):
            for r in ("R1", "R2"):
                (filt / f"{s}_{r}_filtered.fastq.gz").write_text("")
        (filt / "LMO_20160315_MT_a_R1_removed.fastq.gz").write_text("")
        rows = build(root)
        assert [r["sample"] for r in rows] == ["LMO_20160315_MT_a", "LMO_20160315_MT_b"], rows
        assert rows[0]["fastq_1"].endswith("_R1_filtered.fastq.gz"), rows[0]
        assert rows[0]["fastq_2"].endswith("_R2_filtered.fastq.gz"), rows[0]
        assert "removed" not in rows[0]["fastq_1"] + rows[0]["fastq_2"]

        # bbmap naming produces the same rows
        root2 = Path(tmp) / "bb"
        filt2 = root2 / "filter" / "filtered"
        filt2.mkdir(parents=True)
        for m in ("1", "2"):
            (filt2 / f"LMO_MT_filtered_{m}.fastq.gz").write_text("")
        rows2 = build(root2)
        assert rows2 == [{
            "sample": "LMO_MT",
            "fastq_1": str((filt2 / "LMO_MT_filtered_1.fastq.gz").resolve()),
            "fastq_2": str((filt2 / "LMO_MT_filtered_2.fastq.gz").resolve()),
        }], rows2

        # single-end leaves fastq_2 empty rather than inventing a mate
        root3 = Path(tmp) / "se"
        filt3 = root3 / "filter" / "filtered"
        filt3.mkdir(parents=True)
        (filt3 / "LMO_SE_filtered.fastq.gz").write_text("")
        assert build(root3)[0]["fastq_2"] == ""

        # a half-published pair must fail loudly, not co-assemble one orphaned mate
        root4 = Path(tmp) / "half"
        filt4 = root4 / "filter" / "filtered"
        filt4.mkdir(parents=True)
        (filt4 / "LMO_MT_R1_filtered.fastq.gz").write_text("")
        try:
            build(root4)
        except SystemExit as exc:
            assert "mate 2 is missing" in str(exc), exc
        else:
            raise AssertionError("orphaned mate was not rejected")

        # long reads have no place in a fastq_1/fastq_2 sheet
        root5 = Path(tmp) / "lr"
        filt5 = root5 / "filter" / "filtered"
        filt5.mkdir(parents=True)
        (filt5 / "LMO_longReads_filtered.fastq.gz").write_text("")
        try:
            build(root5)
        except SystemExit as exc:
            assert "long-read" in str(exc), exc
        else:
            raise AssertionError("long reads were not rejected")

        # --skip_filter leaves no filter/filtered at all; say so, do not write an empty sheet
        try:
            build(Path(tmp) / "nothing")
        except SystemExit as exc:
            assert "--skip_filter" in str(exc), exc
        else:
            raise AssertionError("missing filter/filtered was not reported")

    print("selftest OK")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("outdir", nargs="?", help="detaxizer --outdir")
    p.add_argument("outfile", nargs="?", help="samplesheet to write")
    p.add_argument("--selftest", action="store_true", help="run assertions and exit")
    a = p.parse_args()

    if a.selftest:
        selftest()
        return
    if not (a.outdir and a.outfile):
        p.error("outdir and outfile are required unless --selftest is given")

    rows = build(a.outdir)
    write(rows, a.outfile)
    print(f"wrote {len(rows)} rows to {a.outfile}", file=sys.stderr)
    for r in rows:
        print(f"  {r['sample']}", file=sys.stderr)


if __name__ == "__main__":
    main()
