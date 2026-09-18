#!/usr/bin/env python3
"""Pool nf-core/mag's per-sample Prodigal proteins into one nf-core/proteinfamilies row.

mag 5.5.0 runs Prodigal once per assembly and publishes

    Annotation/Prodigal/<assembler>/<sample>/<assembler>-<sample>_prodigal.faa.gz

proteinfamilies 2.5.0 `assets/schema_input.json` requires `sample,fasta`, one FASTA per
row, extension `.fa|.fasta|.faa|.fas` (optionally `.gz`). Each row is clustered on its own,
so pooling the dates the way run 02's co-assembly did means concatenating the files into
one FASTA and writing one row.

A plain `cat` is not enough. MEGAHIT names contigs `k<k>_<n>` per assembly and Prodigal
names proteins `<contig>_<gene>`, so the same protein IDs recur in every sample. Each
header is therefore prefixed with its sample name (`<sample>-<id>`), which keeps IDs unique
and lets every family member be traced back to its date. `-` rather than `|`: mmseqs
parses `|`-delimited headers as database accessions. Sequence lines are copied unchanged.

Usage:
    mag_to_proteinfamilies.py MAG_OUTDIR OUT.csv POOLED.faa.gz [--sample NAME]
                              [--assembler MEGAHIT] [--expect N]
    mag_to_proteinfamilies.py --selftest
"""

import argparse
import csv
import gzip
import re
import sys
from pathlib import Path

# Extensions proteinfamilies 2.5.0 accepts, per its schema_input.json pattern.
ACCEPTED = (".fa", ".fasta", ".faa", ".fas")

# 2.5.0 restricts sample names to letters, digits, dots, underscores and dashes.
SAMPLE_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


def accepted(path):
    """True if proteinfamilies' schema would accept this filename."""
    name = path.name[:-3] if path.name.endswith(".gz") else path.name
    return name.endswith(ACCEPTED)


def find_prodigal(outdir, assembler):
    """Map sample name -> Prodigal .faa.gz, taking the sample from mag's directory layout."""
    base = Path(outdir) / "Annotation" / "Prodigal" / assembler
    hits = sorted(base.glob(f"*/{assembler}-*_prodigal.faa.gz"))
    if not hits:
        raise SystemExit(
            f"no Prodigal FASTA under {base}. Was skip_prodigal set, or is --assembler wrong? "
            f"Present: {', '.join(p.name for p in (Path(outdir) / 'Annotation' / 'Prodigal').glob('*')) or 'nothing'}"
        )
    return {h.parent.name: h for h in hits}


def pool(files, dest):
    """Write every protein with a sample-prefixed ID. Returns proteins per sample and how
    many original IDs had already appeared in an earlier sample."""
    counts, seen, shared = {}, set(), 0
    with gzip.open(dest, "wt", compresslevel=6) as out:
        for sample, path in files.items():
            n = 0
            with gzip.open(path, "rt") as fh:
                for line in fh:
                    if line.startswith(">"):
                        pid = line[1:].split(maxsplit=1)[0]
                        shared += pid in seen
                        seen.add(pid)
                        line = f">{sample}-{line[1:]}"
                        n += 1
                    out.write(line)
            if n == 0:
                raise SystemExit(f"{path} holds no proteins")
            counts[sample] = n
    return counts, shared


def build(outdir, pooled, sample, assembler="MEGAHIT", expect=None):
    if not SAMPLE_PATTERN.match(sample):
        raise SystemExit(
            f"sample name {sample!r} has characters proteinfamilies 2.5.0 rejects. "
            "Only letters, digits, dots, underscores and dashes are allowed."
        )
    pooled = Path(pooled)
    if not accepted(pooled):
        raise SystemExit(f"{pooled.name}: proteinfamilies accepts {', '.join(ACCEPTED)} (optionally .gz)")
    files = find_prodigal(outdir, assembler)
    if expect is not None and len(files) != expect:
        raise SystemExit(f"expected {expect} Prodigal FASTAs, found {len(files)}: {', '.join(files)}")
    counts, shared = pool(files, pooled)
    return [{"sample": sample, "fasta": str(pooled.resolve())}], counts, shared


def write(rows, path):
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["sample", "fasta"])
        w.writeheader()
        w.writerows(rows)


def selftest():
    import tempfile

    def faa(path, ids):
        path.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(path, "wt") as fh:
            for i in ids:
                fh.write(f">{i} # 1 # 90 # 1 # ID=1_1;partial=00\nMKV\nLL*\n")

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "mag"
        prod = root / "Annotation" / "Prodigal" / "MEGAHIT"
        faa(prod / "S1" / "MEGAHIT-S1_prodigal.faa.gz", ["k141_1_1", "k141_2_1"])
        faa(prod / "S2" / "MEGAHIT-S2_prodigal.faa.gz", ["k141_1_1"])
        pooled = Path(tmp) / "pooled.faa.gz"

        # one row, headers prefixed, the colliding k141_1_1 made unique, sequences untouched
        rows, counts, shared = build(root, pooled, "LMO_MG_pooled", expect=2)
        assert rows == [{"sample": "LMO_MG_pooled", "fasta": str(pooled.resolve())}], rows
        assert counts == {"S1": 2, "S2": 1} and shared == 1, (counts, shared)
        text = gzip.open(pooled, "rt").read()
        heads = [l for l in text.splitlines() if l.startswith(">")]
        assert heads[0] == ">S1-k141_1_1 # 1 # 90 # 1 # ID=1_1;partial=00", heads
        assert len(set(h.split()[0] for h in heads)) == 3, heads
        assert text.count("MKV\nLL*\n") == 3, text

        # a missing sample (e.g. a failed assembly) is caught by --expect
        try:
            build(root, pooled, "LMO_MG_pooled", expect=3)
        except SystemExit as exc:
            assert "expected 3" in str(exc), exc
        else:
            raise AssertionError("--expect mismatch was not rejected")

        # wrong assembler / skip_prodigal is a clear error, not an empty FASTA
        try:
            build(root, pooled, "LMO_MG_pooled", assembler="SPAdes")
        except SystemExit as exc:
            assert "no Prodigal FASTA" in str(exc), exc
        else:
            raise AssertionError("missing Prodigal output was not reported")

        # an empty Prodigal file means a broken upstream run
        faa(prod / "S3" / "MEGAHIT-S3_prodigal.faa.gz", [])
        try:
            build(root, pooled, "LMO_MG_pooled")
        except SystemExit as exc:
            assert "no proteins" in str(exc), exc
        else:
            raise AssertionError("empty Prodigal FASTA was not rejected")

        # output extension and sample name must pass proteinfamilies' schema
        for bad in [(Path(tmp) / "x.pep.gz", "LMO_MG_pooled"), (pooled, "LMO MG")]:
            try:
                build(root, *bad)
            except SystemExit as exc:
                assert "accepts" in str(exc) or "rejects" in str(exc), exc
            else:
                raise AssertionError(f"{bad} was not rejected")

    print("selftest OK")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("outdir", nargs="?", help="mag --outdir")
    p.add_argument("outfile", nargs="?", help="samplesheet to write")
    p.add_argument("pooled", nargs="?", help="pooled protein FASTA to write, e.g. LMO_MG_pooled.faa.gz")
    p.add_argument("--sample", default="LMO_MG_pooled", help="sample name (default: LMO_MG_pooled)")
    p.add_argument("--assembler", default="MEGAHIT", help="mag assembler directory (default: MEGAHIT)")
    p.add_argument("--expect", type=int, help="fail unless exactly this many Prodigal FASTAs are found")
    p.add_argument("--selftest", action="store_true", help="run assertions and exit")
    a = p.parse_args()

    if a.selftest:
        selftest()
        return
    if not (a.outdir and a.outfile and a.pooled):
        p.error("outdir, outfile and pooled are required unless --selftest is given")

    rows, counts, shared = build(a.outdir, a.pooled, a.sample, a.assembler, a.expect)
    write(rows, a.outfile)
    for sample, n in counts.items():
        print(f"{sample}\t{n:,} proteins", file=sys.stderr)
    print(f"total\t{sum(counts.values()):,} proteins; {shared:,} IDs recurred across samples "
          f"before prefixing", file=sys.stderr)
    print(f"wrote {a.outfile}: {rows[0]['sample']} -> {rows[0]['fasta']}", file=sys.stderr)


if __name__ == "__main__":
    main()
