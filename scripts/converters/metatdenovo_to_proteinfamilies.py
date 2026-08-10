#!/usr/bin/env python3
"""Build an nf-core/proteinfamilies samplesheet from an nf-core/metatdenovo output dir.

proteinfamilies 2.4.0 `assets/schema_input.json` requires `sample,fasta`, where `fasta` is
an amino-acid FASTA whose extension matches `.fa|.fasta|.faa|.fas` (optionally `.gz`).

metatdenovo publishes its protein FASTA in a location and with an extension that depends
on which ORF caller ran:

    prodigal      prodigal/<assembly>.faa.gz              accepted
    prokka        prokka/prokka.faa.gz                    accepted
    transdecoder  transdecoder/*.transdecoder.pep.gz      REJECTED - .pep is not in the
                                                          schema pattern, so the file must
                                                          be renamed before use

This script finds the protein FASTA, refuses to emit a samplesheet proteinfamilies would
reject, and says exactly what to do when the ORF caller was transdecoder.

Usage:
    metatdenovo_to_proteinfamilies.py METATDENOVO_OUTDIR OUT.csv [--sample NAME]
    metatdenovo_to_proteinfamilies.py --selftest
"""

import argparse
import csv
import sys
from pathlib import Path

# Extensions proteinfamilies 2.4.0 accepts, per its schema_input.json pattern.
ACCEPTED = (".fa", ".fasta", ".faa", ".fas")

# Where each ORF caller leaves its protein FASTA, in preference order.
CANDIDATES = ("prodigal/*.faa.gz", "prokka/*.faa.gz", "transdecoder/*.pep.gz")


def accepted(path):
    """True if proteinfamilies' schema would accept this filename."""
    name = path.name[:-3] if path.name.endswith(".gz") else path.name
    return name.endswith(ACCEPTED)


def find_protein_fasta(outdir):
    outdir = Path(outdir)
    for pattern in CANDIDATES:
        hits = sorted(outdir.glob(pattern))
        if hits:
            return hits
    raise SystemExit(
        f"no protein FASTA under {outdir}. Looked for: {', '.join(CANDIDATES)}. "
        "Was --orf_caller set? metatdenovo has no default ORF caller."
    )


def build(outdir, sample):
    hits = find_protein_fasta(outdir)
    if len(hits) > 1:
        raise SystemExit(
            f"expected one protein FASTA (metatdenovo co-assembles), found {len(hits)}: "
            + ", ".join(h.name for h in hits)
        )
    fasta = hits[0]
    if not accepted(fasta):
        raise SystemExit(
            f"{fasta.name} has an extension proteinfamilies rejects.\n"
            f"Accepted: {', '.join(ACCEPTED)} (optionally .gz).\n"
            "This is the transdecoder case. Rename it first, e.g.:\n"
            f"  cp {fasta} {fasta.parent / fasta.name.replace('.pep', '.faa')}"
        )
    return [{"sample": sample, "fasta": str(fasta.resolve())}]


def write(rows, path):
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["sample", "fasta"])
        w.writeheader()
        w.writerows(rows)


def selftest():
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)

        # prodigal output is accepted and produces exactly one row
        (root / "prodigal").mkdir()
        (root / "prodigal" / "megahit_assembly.faa.gz").write_text("")
        rows = build(root, "LMO_MT")
        assert len(rows) == 1 and rows[0]["sample"] == "LMO_MT", rows
        assert rows[0]["fasta"].endswith("megahit_assembly.faa.gz"), rows

        # more than one protein FASTA means the co-assembly assumption broke
        (root / "prodigal" / "second.faa.gz").write_text("")
        try:
            build(root, "LMO_MT")
        except SystemExit as exc:
            assert "expected one protein FASTA" in str(exc)
        else:
            raise AssertionError("multiple protein FASTAs were not rejected")

        # transdecoder's .pep.gz must be refused with the rename instruction
        root2 = Path(tmp) / "td"
        (root2 / "transdecoder").mkdir(parents=True)
        (root2 / "transdecoder" / "a.transdecoder.pep.gz").write_text("")
        try:
            build(root2, "LMO_MT")
        except SystemExit as exc:
            assert "proteinfamilies rejects" in str(exc), exc
        else:
            raise AssertionError(".pep.gz was not rejected")

        # no ORF output at all is a clear error, not an empty samplesheet
        try:
            build(Path(tmp) / "empty", "LMO_MT")
        except SystemExit as exc:
            assert "no protein FASTA" in str(exc)
        else:
            raise AssertionError("missing protein FASTA was not reported")

    assert accepted(Path("x.faa.gz")) and accepted(Path("x.fasta"))
    assert not accepted(Path("x.pep.gz")) and not accepted(Path("x.fna.gz"))
    print("selftest OK")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("outdir", nargs="?", help="metatdenovo --outdir")
    p.add_argument("outfile", nargs="?", help="samplesheet to write")
    p.add_argument("--sample", default="LMO_MT_coassembly", help="sample name (default: LMO_MT_coassembly)")
    p.add_argument("--selftest", action="store_true", help="run assertions and exit")
    a = p.parse_args()

    if a.selftest:
        selftest()
        return
    if not (a.outdir and a.outfile):
        p.error("outdir and outfile are required unless --selftest is given")

    rows = build(a.outdir, a.sample)
    write(rows, a.outfile)
    print(f"wrote {a.outfile}: {rows[0]['sample']} -> {rows[0]['fasta']}", file=sys.stderr)


if __name__ == "__main__":
    main()
