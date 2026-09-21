# Run 06 — proteinfamilies (families from LMO metagenome ORFs)

Sixth run of the chain. It clusters the proteins predicted by
[run 05, mag](../05_mag/README.md) into families. It is the metagenome counterpart of
[run 03](../03_proteinfamilies/README.md), which did the same for the metatranscriptome.

- Pipeline: `nf-core/proteinfamilies` **2.5.0** (requires Nextflow `>=26.04.0`)
- Input: one row, pooled from mag's three per-sample Prodigal FASTAs. **Generated on the cluster**, not committed
- Params: [`params.yml`](params.yml). Every parameter is the same as in run 03

## Why this edge exists

It exercises `mag → proteinfamilies`, one of the six unexercised edges off mag in
[PLAN.md](../../PLAN.md#samplesheet-chaining--validation-table). It also gives the first
comparison of metagenome and metatranscriptome proteins that holds method constant. Both
runs use the same ORF caller (Prodigal, at assembly level), the same pipeline and revision,
and the same parameters. Only the omics layer differs.

## Why one pooled row, and why it needs a converter

Decided 2026-09-18 ([RUNS.md, run 05](../../RUNS.md#05--mag-lmo-metagenome-assembly-and-binning)).
Run 02 co-assembled the three dates into one set of proteins, and run 03 clustered that set
as a single row. mag assembled each date separately, which gives three Prodigal files:

```
Annotation/Prodigal/MEGAHIT/<sample>/MEGAHIT-<sample>_prodigal.faa.gz
```

proteinfamilies clusters each samplesheet row on its own. Three rows would give three
separate family sets, which cannot be compared with run 03's single one. The three files
therefore go in as one row.

Joining the files with plain `cat` would produce a FASTA that is valid but ambiguous.
MEGAHIT names contigs `k141_<n>` in every assembly, and Prodigal names proteins
`<contig>_<gene>`, so the same protein IDs appear once per sample. The converter,
`scripts/converters/mag_to_proteinfamilies.py`, fixes this as follows:

- **finds** the per-sample Prodigal FASTAs and takes each sample name from mag's directory layout,
- **prefixes every header** with its sample, so `k141_1_1` becomes `LMO_20160315_MG_a-k141_1_1`.
  IDs become unique, and every family member traces back to its date. The separator is `-`
  rather than `|`, because mmseqs reads `|`-delimited headers as database accessions,
- **copies sequence lines unchanged**, as in run 03,
- **reports** proteins per sample, plus how many IDs repeated across samples before
  prefixing. On run 05's output that was **1,073,177 of 2,513,059 (43%)**: a plain `cat`
  would have given proteinfamilies a FASTA in which 43% of headers were ambiguous,
- **refuses** to run if the number of samples is not the one given with `--expect`, which
  catches a mag run where one assembly failed. It also refuses an empty Prodigal file, and
  any file extension or sample name that proteinfamilies 2.5.0's schema would reject.

The per-bin Prokka `.faa` files are not used. They cover only binned contigs, so they would
not be comparable with run 03's whole-assembly proteins.

## Build the samplesheet

```bash
python3 scripts/converters/mag_to_proteinfamilies.py \
    <mag-outdir> \
    runs/06_proteinfamilies/samplesheet.csv \
    <somewhere-on-cluster>/LMO_MG_pooled.faa.gz \
    --expect 3
```

The pooled FASTA holds roughly 2.5 M proteins. Writing it next to the samplesheet in the
cluster clone is fine, because `runs/*/*.faa.gz` is gitignored. The script produces one row:

```csv
sample,fasta
LMO_MG_pooled,/.../LMO_MG_pooled.faa.gz
```

The per-sample counts it prints should match RUNS.md run 05: 507,173 + 1,074,480 + 931,406
= **2,513,059**.

## Run

```bash
nextflow run nf-core/proteinfamilies \
  -r 2.5.0 \
  -profile slurm,singularity \
  -c /path/to/your-site.config \
  -params-file params.yml \
  -resume
```

At 12.7× run 03's input, mmseqs clustering is the step most likely to need more memory.
Raise it in the site config, not in `params.yml`. Parameters are what the comparison holds
constant, and resources are not part of it.

mmseqs was fine. What failed was the Nextflow head JVM, out of heap while submitting
`MERGE_SEEDS` tasks ([nf-core/proteinfamilies#191](https://github.com/nf-core/proteinfamilies/issues/191)).
Until that is fixed, give the head job a larger heap before launching at this scale:

```bash
export NXF_OPTS="-Xms2g -Xmx16g"
```

## Reading the result against run 03

Before putting family counts side by side, keep in mind what differs:

- **Redundancy.** A genome assembled on more than one date contributes near-identical
  copies of its proteins. Clustering merges them, but they also inflate cluster sizes. More
  clusters then clear `cluster_size_threshold 25` than a single co-assembly would allow,
  which biases the family count upward.
- **Layer.** Metagenome assembly recovers genomes, whereas a metatranscriptome only holds
  what was being expressed. More families is the expected direction; the size of the
  difference is what needs explaining.
- **Length filter.** SeqKit preprocessing (length filter 30–5,000 aa, gap trimming, duplicate
  removal) took the input from 2,513,059 to **2,415,819** proteins, removing 97,240 (3.9%).
  The longest input protein was 7,403 aa, so `max_seq_length 5000` also bound here.

The numbers from the run itself are in [RUNS.md](../../RUNS.md#06--proteinfamilies-families-from-the-metagenome-orfs).

## Verify

```bash
# proteins in, per sample and total (the converter prints these as well)
zcat <pooled>.faa.gz | grep -c '^>'                       # expect 2,513,059
zcat <pooled>.faa.gz | grep '^>' | cut -d' ' -f1 | sort | uniq -d | head   # expect nothing

# families produced
ls <outdir>/

# downstream samplesheets, and the representatives they point at
cat <outdir>/proteinfold/samplesheet.csv <outdir>/proteinannotator/samplesheet.csv
grep -c '^>' <outdir>/proteinfold/*/*_reps.faa
```

## Status

| Step | Status |
|------|--------|
| Converter `mag_to_proteinfamilies.py` | **READY** — `--selftest` passes |
| Samplesheet conversion | **DONE** 2026-09-18 — one row, 2,513,059 proteins (507,173 + 1,074,480 + 931,406, matching run 05); **1,073,177 IDs recurred across samples before prefixing** |
| proteinfamilies run | **SUCCESS** 2026-09-21 — **5,864 protein families** from 2,415,819 proteins after length filtering |
| Downstream samplesheets | **EMITTED** — `proteinfold/` and `proteinannotator/`, neither consumed by a run yet |

Provenance: <https://cloud.seqera.io/user/vangelis/watch/4VgXDoIUSqHCpZ>

Full run record: [RUNS.md](../../RUNS.md#06--proteinfamilies-families-from-the-metagenome-orfs).
