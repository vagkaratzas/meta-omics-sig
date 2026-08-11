# Execution Ledger

Every pipeline execution for the end-to-end use case, with the provenance needed to
reproduce or audit it. One row per run in the index; one section per run below.

Named `RUNS.md` rather than `OUTPUTS.md` because what needs tracking is **executions** —
the output directories themselves are gitignored and live on cluster storage.

- Per-run inputs, params and troubleshooting notes: `runs/<NN>_<pipeline>/README.md`
- Chain design and edge validation status: [PLAN.md](PLAN.md)
- Reusable environment gotchas: [AGENTS.md](AGENTS.md)

**Convention:** never record absolute cluster paths here. Record the pipeline, revision,
Nextflow version, input manifest, Seqera Platform run link, and outcome. Paths are
site-specific and go stale; the Seqera link preserves the full execution record.

---

## Index

| # | Pipeline | Revision | Date | Scope | Status | Provenance |
|---|----------|----------|------|-------|--------|------------|
| 01 | nf-core/fetchngs | 1.12.0 | 2026-08-10 | LMO pilot — 3 dates × 3 omics layers | **SUCCESS** | [Seqera run](https://cloud.seqera.io/user/vangelis/watch/1Hd5FAdXhle9M9) |
| 02 | nf-core/metatdenovo | 1.4.0 | 2026-08-11 | 6 MT libraries → one co-assembly + protein FASTA | **SUCCESS** — 198,252 proteins | [Seqera run](https://cloud.seqera.io/user/vangelis/watch/dR2OkpNzn3QwP) |
| 03 | nf-core/proteinfamilies | 2.5.0 | 2026-08-11 | protein families from the run-02 ORFs | **SUCCESS** — 405 families | [Seqera run](https://cloud.seqera.io/user/vangelis/watch/H1MTwbD6IUKz3) |
| 04 | nf-core/detaxizer | 1.3.0 | 2026-08-11 | phiX removal from the 6 MT libraries | **SUCCESS** — 172 phiX pairs in 161 M | [Seqera run](https://cloud.seqera.io/user/vangelis/watch/5qFu9n8YSLmCxP) |

---

## 01 — fetchngs, LMO pilot

**Provenance:** <https://cloud.seqera.io/user/vangelis/watch/1Hd5FAdXhle9M9>

| | |
|---|---|
| Pipeline | `nf-core/fetchngs` `-r 1.12.0` (latest release; Feb 2024) |
| Nextflow | 26.04.4 |
| Executor / container | SLURM / Singularity |
| Input manifest | [`runs/01_fetchngs/ids.csv`](runs/01_fetchngs/ids.csv) — 12 ENA run accessions |
| Params | [`runs/01_fetchngs/params.yml`](runs/01_fetchngs/params.yml) |
| Date | 2026-08-10 |
| Outcome | Success — 12/12 runs downloaded and md5-verified |

### What was fetched

3 dates from the LMO matched-26 set, chosen to touch all five core accessions and three
seasons. Amplicon restricted to `filter fraction:0.2`; MT restricted to the rRNA-depleted
study.

| Layer | Study | Runs | Instrument |
|-------|-------|------|------------|
| 16S amplicon | PRJEB52780, PRJEB52782, PRJEB52828 | 3 | Illumina MiSeq |
| Metagenome | PRJEB82694 | 3 | Illumina NovaSeq 6000 |
| Metatranscriptome | PRJEB69280 | 6 (2 replicates × 3 dates) | Illumina HiSeq 2500 |

Dates: 2016-03-15 (early spring), 2016-08-03 (summer), 2017-10-31 (autumn).
Totals: **555,738,002 reads · 79,977,308,002 bases · 34.5 GB**, all PAIRED.

### Outputs produced

| Path (relative to outdir) | Contents |
|---------------------------|----------|
| `fastq/` | 24 FASTQ files (12 runs × R1/R2) |
| `fastq/md5/` | md5 checksum per file, verified in-pipeline |
| `metadata/*.runinfo_ftp.tsv` | 12 files, one per run, full ENA metadata |
| `samplesheet/samplesheet.csv` | 12 rows × **39 columns** |
| `samplesheet/id_mappings.csv` | 9 columns, MultiQC rename source |
| `samplesheet/multiqc_config.yml` | MultiQC `sample_names_rename` map |

### Metadata validation — the point of the pilot

`ena_metadata_fields` was overridden to add `collection_date, lat, lon, depth,
environmental_medium` to the fetchngs default set. Confirmed present: `collection_date`
is column 35 of `samplesheet.csv` and column 33 of the runinfo TSVs.

**The PRJEB82694 alias/date conflict reproduces exactly as predicted**, now with pipeline
output as evidence rather than an API query:

| Run | Study | Layer | `collection_date` | date in `sample_alias` | |
|-----|-------|-------|-------------------|------------------------|---|
| ERR9715801 | PRJEB52780 | AMPLICON | 2016-03-15 | 2016-03-15 | match |
| ERR12258632 | PRJEB69280 | RNA-Seq | 2016-03-15 | 2016-03-15 | match |
| ERR12258633 | PRJEB69280 | RNA-Seq | 2016-03-15 | 2016-03-15 | match |
| ERR13967264 | PRJEB82694 | WGS | 2016-03-15 | **2017-08-15** | **DIFFER** |
| ERR9717120 | PRJEB52782 | AMPLICON | 2016-08-03 | 2016-08-03 | match |
| ERR12258650 | PRJEB69280 | RNA-Seq | 2016-08-03 | 2016-08-03 | match |
| ERR12258651 | PRJEB69280 | RNA-Seq | 2016-08-03 | 2016-08-03 | match |
| ERR13967258 | PRJEB82694 | WGS | 2016-08-03 | **2017-02-15** | **DIFFER** |
| ERR9726503 | PRJEB52828 | AMPLICON | 2017-10-31 | 2017-10-31 | match |
| ERR12258626 | PRJEB69280 | RNA-Seq | 2017-10-31 | 2017-10-31 | match |
| ERR12258627 | PRJEB69280 | RNA-Seq | 2017-10-31 | 2017-10-31 | match |
| ERR13967244 | PRJEB82694 | WGS | 2017-10-31 | **2016-03-31** | **DIFFER** |

3/3 metagenome runs disagree; 9/9 amplicon and metatranscriptome runs agree. Confirms
`collection_date` as the only safe join key across layers.

### New metadata questions for Daniel

Two inconsistencies surfaced that were not visible before joining the layers:

1. **`depth` disagrees between layers for the same water sample.** MG and MT record
   `depth = 2` (matching "2 m depth" in their sample titles); all three amplicon studies
   record `depth = 3`, constant across every filter fraction. Suspicion: the amplicon
   `depth` field was populated with the filter fraction (3 µm) rather than sampling
   depth. Needs confirming before `depth` is used as a covariate.
2. **`environmental_medium` is not harmonised.** MT reads
   `Water;brackish water (ENVO:00002019)`; MG and amplicon read
   `brackish water (ENVO:00002019)`.

`lat`/`lon` are identical across all 12 samples (56.9309, 17.0607) — consistent.

### Handoff finding

The emitted `sample` column **is the experiment accession** (`ERX…`) for every row —
`sample == experiment_accession` holds for all 12. Downstream pipelines keyed on this
would label every result `ERX13368357` rather than something like
`LMO_2016-03-15_MG_0.2`. A rename step is required before ampliseq / mag / metatdenovo,
in addition to the column conversion already recorded in
[PLAN.md](PLAN.md#samplesheet-chaining--validation-table).

### Environment workarounds required

All three are now documented in [AGENTS.md](AGENTS.md); none are LMO-specific.

| Obstacle | Resolution |
|----------|------------|
| Nextflow 26.04 strict config parser rejects `def check_max(obj, type)` in 1.12.0's `nextflow.config` | `export NXF_SYNTAX_PARSER=v1` |
| `ena_metadata_fields` interpolated unquoted → YAML folded scalar's spaces split into extra shell args, argparse exit 2 on all 12 tasks | single-line, whitespace-free value |
| `wget:1.20.1` container has no `/etc/resolv.conf` → Singularity skips the bind, no DNS, `wget` exit 4 | per-process `container` override to `quay.io/biocontainers/gnu-wget:1.18--h60da905_7` |
| Execution report render aborts on `-resume` (timestamped filename already exists) | `report.overwrite` / `timeline.overwrite` / `trace.overwrite` / `dag.overwrite` = `true` |

### Upstream issues to file against nf-core/fetchngs

All four verified still present on `dev` as of 2026-08-10 — none are fixed by an
unreleased change. Detail and suggested wording in the section below.

- [ ] Quote `${fields}` in the `SRA_IDS_TO_RUNINFO` command (bug)
- [ ] `multiqc_mappings_config.py` emits a stray `"` and mangles comma-containing values (bug)
- [ ] Cut a release with the modern template so 1.x works on Nextflow 26.04+ (release request)
- [ ] Add `ampliseq` / `mag` / `metatdenovo` to `--nf_core_pipeline` (feature)
- [ ] `wget` container lacks `/etc/resolv.conf` (bug, needs re-verification against `dev`'s 1.21.4 image)

---

## 02 — metatdenovo, LMO metatranscriptome co-assembly

**Status: SUCCESS, 2026-08-11.**

**Provenance:** <https://cloud.seqera.io/user/vangelis/watch/dR2OkpNzn3QwP>

| | |
|---|---|
| Pipeline | `nf-core/metatdenovo` `-r 1.4.0` (Jun 2026) |
| Nextflow | requires `>=25.10.4`; modern template, so **no** `NXF_SYNTAX_PARSER=v1` |
| Input | 6 RNA-Seq libraries from run 01, ~27 GB |
| Samplesheet | generated on-cluster by `scripts/converters/fetchngs_to_reads_samplesheet.py` |
| Params | [`runs/02_metatdenovo/params.yml`](runs/02_metatdenovo/params.yml) |
| Date | 2026-08-11 |
| Outcome | Success — one megahit co-assembly, prodigal ORF calling, **198,252 predicted proteins** in `prodigal/*.faa.gz` |

This exercises the `fetchngs → metatdenovo` edge: the converted samplesheet was accepted
and the pipeline ran to completion on it. The row in
[PLAN.md](PLAN.md#samplesheet-chaining--validation-table) stays **CONVERSION REQUIRED** —
that is the mechanism and running the chain does not change it — and now carries an
`exercised 2026-08-11` clause. Extending `--nf_core_pipeline` to metatdenovo is what would
turn it green.

### Why the parameters are what they are

`assembler: megahit` — the workflow collects all reads with `.toList()`/`.collect()` before
assembling, so this is **one co-assembly**, not six. rnaSPAdes over ~320 M read pairs is
memory-brutal; megahit is built for this shape.

`orf_caller: prodigal` — this single parameter is what makes the proteinfamilies handoff
work:

| ORF caller | Published protein file | Accepted by proteinfamilies 2.5.0 |
|------------|------------------------|-----------------------------------|
| **prodigal** | `prodigal/<assembly>.faa.gz` | **yes** |
| prokka | `prokka/prokka.faa.gz` | yes, but much slower here |
| transdecoder | `transdecoder/*.transdecoder.pep.gz` | **no** — `.pep` is not in the schema's accepted set |

`skip_eggnog` / `skip_kofamscan` / `skip_eukulele` — all three are ON by default and each
wants a large database (eggnog ~50 GB; `eukulele_db` has no default at all). This run is
for the assembly, ORFs and protein FASTA. Annotation returns once the chain is validated.

### Sample renaming

fetchngs sets `sample` to the ENA experiment accession, so results would be labelled
`ERX11668914`. The converter rebuilds names from `collection_date` — never `sample_alias`,
whose LMO metagenome dates are stale:

`LMO_20160315_MT_a/b`, `LMO_20160803_MT_a/b`, `LMO_20171031_MT_a/b`

---

## 03 — proteinfamilies, families from the metatranscriptome ORFs

**Status: SUCCESS, 2026-08-11.**

**Provenance:** <https://cloud.seqera.io/user/vangelis/watch/H1MTwbD6IUKz3>

| | |
|---|---|
| Pipeline | `nf-core/proteinfamilies` `-r 2.5.0` (Aug 2026) |
| Nextflow | requires `>=26.04.0`; modern template |
| Input | one row, 198,252 proteins — metatdenovo co-assembles, so there is a single protein FASTA |
| Samplesheet | generated on-cluster by `scripts/converters/metatdenovo_to_proteinfamilies.py` |
| Params | [`runs/03_proteinfamilies/params.yml`](runs/03_proteinfamilies/params.yml) |
| Date | 2026-08-11 |
| Outcome | Success — **405 protein families** from 198,252 predicted proteins, plus downstream samplesheets for proteinfold and proteinannotator |

405 families out of 198,252 input proteins is a ~490:1 reduction, but the numerator and
denominator are not comparable until the length filter and the clustering threshold are
accounted for: `min_seq_length 30` drops short partial ORFs before clustering, and
`cluster_size_threshold 25` means only clusters of ≥25 sequences ever seed a family. The
count is the outcome of a default-parameter handoff run, not a biological result — read it
that way until the QC numbers in `runs/03_proteinfamilies/README.md#verify` are recorded.

### New edge, now drawn on the metro map

`metatdenovo → proteinfamilies` was proposed to the SIG off the back of this run and **is
now on the metro map** — metatdenovo feeds the shared `fasta` interchange that the protein
stations hang off. The proposal rested on an executed handoff rather than a schema reading:
metatdenovo with prodigal emits `.faa.gz` directly, so it needed only a one-row samplesheet
and no reformatting. Row in
[PLAN.md](PLAN.md#samplesheet-chaining--validation-table).

### proteinfamilies emits downstream samplesheets natively — the second pipeline found that does

This run set the only two non-default parameters in `params.yml`:

```yaml
skip_proteinfold_samplesheet: false
skip_proteinannotator_samplesheet: false
```

Both default to `true`. With them off, proteinfamilies 2.5.0 publishes `id,fasta` sheets at
`proteinfold/samplesheet.csv` and `proteinannotator/samplesheet.csv`, each pointing at the
family representatives `<samplename>_reps.faa`. The mechanism is the new Nextflow workflow
output syntax (`publish:` in `main.nf`), added in proteinfamilies 2.1.0 for proteinfold and
2.2.0 for proteinannotator.

This retires a claim repeated across this repo since 2026-08-10: that **detaxizer is the
only pipeline in the chain that ships a downstream samplesheet generator.** It is now one of
two, and the two use different mechanisms — detaxizer's `--generate_downstream_samplesheets`
with a pipeline-name enum, proteinfamilies' per-target `skip_*_samplesheet` flags. Both
corrected in [PLAN.md](PLAN.md) and `docs/data.json`.

The sheets were emitted, not yet consumed — no proteinfold or proteinannotator run has read
them. One version trap is already visible from the schemas: proteinfold **2.0.0** accepts
`id` and `.faa`, but **1.1.1** requires a `sequence` column and `.fa`/`.fasta` only, so the
native sheet is only native against 2.0.0. proteinannotator 1.1.0 accepts it as-is.

---

## 04 — detaxizer, phiX removal from the metatranscriptome libraries

**Status: SUCCESS, 2026-08-11.**

**Provenance:** <https://cloud.seqera.io/user/vangelis/watch/5qFu9n8YSLmCxP>

| | |
|---|---|
| Pipeline | `nf-core/detaxizer` `-r 1.3.0` |
| Input | the 6 RNA-Seq libraries from run 01 |
| Samplesheet | generated on-cluster by `scripts/converters/fetchngs_to_reads_samplesheet.py --target detaxizer` |
| Params | [`runs/04_detaxizer/params.yml`](runs/04_detaxizer/params.yml) |
| Contaminant | phiX174 `NC_001422.1` (5,386 bp) via `--classification_bbduk`; **no kraken2 database** |
| Date | 2026-08-11 |
| Outcome | Success — **172 phiX read pairs out of 161,043,840**, and downstream samplesheets for taxprofiler and mag |

### How much phiX was actually there

`summary.tsv`, against ENA `read_count` for each run (halved: `base_count/read_count` is
exactly 126, so ENA counts single reads while detaxizer's ids are pair-level after
`MERGE_IDS`).

| Library | phiX pairs | Total pairs | 1 in |
|---|---|---|---|
| LMO_20160315_MT_a | 1 | 20,903,392 | 20,903,392 |
| LMO_20160315_MT_b | 21 | 19,313,852 | 919,707 |
| LMO_20160803_MT_a | 6 | 25,895,996 | 4,315,999 |
| LMO_20160803_MT_b | 4 | 22,008,804 | 5,502,201 |
| LMO_20171031_MT_a | 35 | 38,553,488 | 1,101,528 |
| LMO_20171031_MT_b | 105 | 34,368,308 | 327,317 |
| **Total** | **172** | **161,043,840** | **936,301** |

**0.000107% of pairs** — consistent with a well-loaded HiSeq run whose spike-in is mostly
bled off at demultiplexing. This is the number the 2026-08-10 scope decision lacked.

A low fraction does not by itself mean the assembly is clean: 172 pairs × 2 × 126 bp is
43,344 bp against a 5,386 bp genome — an upper bound of **8× coverage** pooled across the
co-assembly, which is above megahit's floor. So the question was settled against run 02's
**existing** assembly rather than by rebuilding it:

```console
$ zcat megahit_assembly.contigs.fa.gz | seqkit locate -f phix174_NC_001422.1.fasta -m 5 | head
seqID   patternName     pattern strand  start   end     matched
```

**No hits — header row only, at up to 5 mismatches.** phiX is absent from the run 02
co-assembly, so none of run 03's 405 families can contain a phiX-derived ORF.

**Conclusion: metatdenovo and proteinfamilies are NOT re-run.** Runs 02 and 03 stand as
executed, and the phiX filter is now a documented negative rather than an assumption — the
0.000107% never reached assembly depth. Had this search hit, the fix would still have been
to discount the offending contig's ORFs, not to rebuild a six-library co-assembly.

### The finding: detaxizer's native mag samplesheet is rejected by mag

This is the first time anything has consumed a detaxizer-generated samplesheet. The two
sheets were validated against their targets' `schema_input.json`:

| Generated sheet | Target | Verdict |
|---|---|---|
| `downstream_samplesheets/taxprofiler.csv` | taxprofiler 2.0.1 | **PASSES** — `sample`, `run_accession`, `instrument_platform: ILLUMINA` all satisfy the schema, paths match `^\S+\.f(ast)?q\.gz$` |
| `downstream_samplesheets/mag-pe.csv` | mag 5.5.0 | **REJECTED**, two independent violations |

mag 5.5.0 refuses `mag-pe.csv` because:

1. **`group` is a required property** with pattern `^\S+$`, and detaxizer hardcodes
   `def group = ""` in `SAMPLESHEET_MAG` ("only used for co-abundance in binning").
2. **`short_reads_platform` is `dependentRequired` on `short_reads_1`**, and detaxizer does
   not emit that column at all.

Both hold whether empty CSV cells are read as empty strings or dropped, so this is not an
nf-schema edge case. detaxizer 1.3.0's mag emitter is writing the column set mag wanted at
some earlier release. Filed 2026-08-11 as
[nf-core/detaxizer#100](https://github.com/nf-core/detaxizer/issues/100), with a fix that
reuses the platform expression already present 45 lines above in `SAMPLESHEET_TAXPROFILER`
— its `ILLUMINA` / `OXFORD_NANOPORE` values are exactly what mag's enums accept.

The taxprofiler sheet is valid but still cannot drive a run on its own: taxprofiler also
requires a `--databases` sheet, which detaxizer cannot produce.

### Why these sheets are not the ones to run mag and taxprofiler from

Both point at **metatranscriptome** reads, because this run used `--strategy RNA-Seq`.
Binning transcripts into MAGs is not meaningful, and the chain intends taxprofiler for the
metagenome layer. Reaching those two stations properly means a second detaxizer run with
`--strategy WGS` over the 3 metagenome libraries — same `params.yml` otherwise.

---

## Conversion scripts

`scripts/converters/` holds the conversions the validation table calls for. Each has an
assert-based `--selftest` that runs with no arguments and no fixtures:

| Script | Edge | Guards against |
|--------|------|----------------|
| `fetchngs_to_reads_samplesheet.py` | fetchngs → metatdenovo / ampliseq / viralmetagenome (`--target reads`), → detaxizer (`--target detaxizer`), → mag (`--target mag`) | stale `sample_alias` dates leaking into sample names; duplicate sample names silently merging samples. Sample names are identical across targets, which is what makes runs 02, 04 and 05 comparable. `--target mag` additionally refuses a long-read `instrument_platform` in `short_reads_platform`, and refuses an empty `group` — the column mag requires and [detaxizer#100](https://github.com/nf-core/detaxizer/issues/100) writes blank |
| `metatdenovo_to_proteinfamilies.py` | metatdenovo → proteinfamilies | emitting a samplesheet proteinfamilies would reject (the transdecoder `.pep` case); more than one protein FASTA, which would mean the co-assembly assumption broke |
| `detaxizer_to_reads_samplesheet.py` | detaxizer → metatdenovo / ampliseq / viralmetagenome | picking up `filter/removed/` instead of `filter/filtered/`; an orphaned mate reaching a co-assembler; silently writing an empty sheet when `--skip_filter` meant no filtered reads were ever published. Handles both `--filtering_tool` naming schemes |

```bash
python3 scripts/converters/fetchngs_to_reads_samplesheet.py --selftest
python3 scripts/converters/metatdenovo_to_proteinfamilies.py --selftest
python3 scripts/converters/detaxizer_to_reads_samplesheet.py --selftest
```

Generated samplesheets are **not committed** — they contain absolute cluster paths.
Regenerate them on the cluster from the previous pipeline's output.
