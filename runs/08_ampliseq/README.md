# Run 08 — ampliseq (16S V3-V4 amplicons from the LMO amplicon layer)

Eighth run of the chain, and the first to touch the **amplicon** layer. Runs 02–07 used
only the metatranscriptome and metagenome. Fed from
[run 01, fetchngs](../01_fetchngs/README.md) through the converter. detaxizer is not
upstream.

- Pipeline: `nf-core/ampliseq` **2.18.0** (requires Nextflow `>=25.10.4`)
- Input: `samplesheet.csv`, **generated on the cluster**, not committed
- Params: [`params.yml`](params.yml)

## Which edge this exercises

This run uses `fetchngs 1.12.0 → converter → ampliseq`, **not** the native
`--nf_core_pipeline ampliseq` emitter. Run 01 used 1.12.0, which has no ampliseq option.
The native emitter arrived in 1.13.0 and stays unexercised. It will be tested with the
latest fetchngs on another dataset. Here the reads and the converter are already in hand,
so the run costs only the ampliseq compute.

`--target reads` writes `sample,fastq_1,fastq_2`. ampliseq 2.18.0 accepts that spelling:
its schema takes either `sampleID/forwardReads/reverseReads` or `sample/fastq_1/fastq_2`,
and `run` is optional. Sample names such as `LMO_20160315_AMP` match ampliseq's
`^[a-zA-Z][a-zA-Z0-9_]+$`.

## Why detaxizer is not upstream

ampliseq removes phiX itself. Its `DADA2_FILTNTRIM` passes `rm.phix = TRUE` for any
non-PacBio input (`conf/modules.config`, 2.18.0). A detaxizer pass would repeat that
filter. It is also a different edge: `detaxizer → ampliseq` is **CONVERSION REQUIRED**,
and detaxizer excludes ampliseq from `--generate_downstream_samplesheets`.
[Run 04](../04_detaxizer/README.md) filtered only the metatranscriptome, so it holds no
amplicon reads to pass on anyway.

## Primers

The three amplicon studies (PRJEB52780, PRJEB52782, PRJEB52828) describe their reads as
"Bacterial (and some archaeal) V3V4 sequences". The LMO group amplifies V3-V4 with
**341F / 805R**:

- Fridolfsson et al. 2023, *Sci Rep* 13:11865, [doi:10.1038/s41598-023-38816-0](https://doi.org/10.1038/s41598-023-38816-0)
  (PMID 37481661). LMO 2011–2018, 0.2 µm Sterivex, "341F-805R as described and validated
  in Hugerth et al.", MiSeq 2×300, processed with nf-core/ampliseq.
- Martínez-García et al. 2022, *Front Microbiol* 13:834675, [doi:10.3389/fmicb.2022.834675](https://doi.org/10.3389/fmicb.2022.834675)
  (PMID 36212867). LMO 2015–2016 free-living and particle-attached fractions, same primer
  pair, ampliseq with forward reads truncated to 259 bp and reverse reads to 199 bp.
  Its data are PRJEB52496, not one of the three studies used here.
- The primer pair itself: Herlemann et al. 2011, *ISME J* 5:1571–1579,
  [doi:10.1038/ismej.2011.41](https://doi.org/10.1038/ismej.2011.41) (PMID 21472016).
  Hugerth et al. 2014, [doi:10.1128/AEM.01403-14](https://doi.org/10.1128/AEM.01403-14)
  (PMID 24928874) describes the design.

No publication tied to PRJEB52780/82/28 was found, and none of the full texts available
through PubMed prints the sequences. The data author confirmed the sequences in
`params.yml` on 2026-09-23. They are the standard Herlemann sequences:

| Primer | Sequence |
|---|---|
| 341F | `CCTACGGGNGGCWGCAG` |
| 805R | `GACTACHVGGGTATCTAATCC` |

### Check the primers before running

The sequences are confirmed, but the reads could still have had them removed before
submission. cutadapt drops reads that lack the primer, so that would show up as empty
samples, not as an error. Count exact degenerate matches near the start of 10,000 reads
per mate. fetchngs names files `<ERX>_<ERR>_<mate>.fastq.gz`:

```bash
for r in <fetchngs-outdir>/fastq/*_ERR97{15801,17120,26503}_1.fastq.gz; do
  echo "$r $(zcat $r | head -40000 | awk 'NR%4==2' | grep -cE '^.{0,10}CCTACGGG[ACGT]GGC[AT]GCAG')"
done
for r in <fetchngs-outdir>/fastq/*_ERR97{15801,17120,26503}_2.fastq.gz; do
  echo "$r $(zcat $r | head -40000 | awk 'NR%4==2' | grep -cE '^.{0,10}GACTAC[ACT][ACG]GGGTATCTAATCC')"
done
```

Expect most of the 10,000. Near zero means the primers were already removed: set
`skip_cutadapt: true` and record it.

On codon (2026-09-23) R1 matched 9,739–9,825 and R2 9,642–9,804 of 10,000 reads. Every R1 read starts with
4 random bases before 341F (`NNNN CCTACGGGGGGCTGCAG…`). ampliseq 2.18.0 runs cutadapt
with an unanchored `-g`, which removes the primer and everything before it, so the spacer
needs no extra setting. A first version of this check dropped a `G` from the forward
pattern and matched almost nothing; the pattern above is corrected.

## Build the samplesheet

Run from the repo checkout on the cluster:

```bash
python3 scripts/converters/fetchngs_to_reads_samplesheet.py \
    <fetchngs-outdir>/samplesheet/samplesheet.csv \
    runs/08_ampliseq/samplesheet.csv \
    --strategy AMPLICON --target reads
```

Expected: three rows, one per collection date, with no replicate suffix:

```csv
sample,fastq_1,fastq_2
LMO_20160315_AMP,.../ERX9265004_ERR9715801_1.fastq.gz,.../ERX9265004_ERR9715801_2.fastq.gz
LMO_20160803_AMP,.../ERX..._ERR9717120_1.fastq.gz,.../ERX..._ERR9717120_2.fastq.gz
LMO_20171031_AMP,.../ERX..._ERR9726503_1.fastq.gz,.../ERX..._ERR9726503_2.fastq.gz
```

The dates match the MG and MT sample names from runs 02 and 05, so results can be joined
by date across all three layers.

## Run

```bash
nextflow run nf-core/ampliseq \
  -r 2.18.0 \
  -profile slurm,singularity \
  -c /path/to/your-site.config \
  -params-file runs/08_ampliseq/params.yml \
  -resume
```

## Verify

```bash
# reads surviving each step, per sample: cutadapt, filtering, merging, chimeras
cat <outdir>/overall_summary.tsv

# ASVs and taxonomy
grep -c '^>' <outdir>/dada2/ASV_seqs.fasta
head <outdir>/dada2/ASV_tax.*.tsv
```

In `overall_summary.tsv`, a large loss at the merge step means the truncation lengths
leave too little overlap. A large loss at cutadapt means the primer check above was skipped
or failed.

## Next edges this opens

| Edge | Blocked on |
|---|---|
| `ampliseq → differentialabundance` | three samples, one per date: no replicated condition to test |
| amplicon vs MG / MT taxonomy | a taxonomic profile of the MG and MT layers (taxprofiler, or MAG / family taxonomy) |

## Status

| Step | Status |
|------|--------|
| Primers | **Confirmed**: 341F/805R, sequences confirmed by the data author and found in about 98% of R1 and R2 reads (2026-09-23) |
| Samplesheet | **Prepared**: converter command above, `--strategy AMPLICON --target reads` |
| ampliseq run | **Not run** |
