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
| 05 | nf-core/mag | 5.5.0 | 2026-09-18 | 3 MG libraries → 3 assemblies, MetaBAT2 bins, protein FASTA | **SUCCESS** — 160 bins (CheckM2: 24 near-complete, 49 medium-quality), 2,513,059 proteins; BUSCO columns unreliable ([mag#1115](https://github.com/nf-core/mag/issues/1115)) | [Seqera run](https://cloud.seqera.io/user/vangelis/watch/2wiu8ZycJHfAVC) · [CheckM2 re-run](https://cloud.seqera.io/user/vangelis/watch/2Nloa7fgPEWnlX) |
| 06 | nf-core/proteinfamilies | 2.5.0 | 2026-09-21 | protein families from the run-05 ORFs, pooled into one row | **SUCCESS** — 5,864 families | Seqera link pending |


## Upstream issues filed from this project

Every bug report or feature request this project has sent upstream, with the run that
surfaced it. Details are in the run sections below.

| Issue | Filed | Found in | Status |
|-------|-------|----------|--------|
| [nf-core/fetchngs#373](https://github.com/nf-core/fetchngs/issues/373) — `wget` container has no `/etc/resolv.conf` | 2026-08-10 | run 01 | closed, shipped in 1.13.0 |
| [nf-core/fetchngs#374](https://github.com/nf-core/fetchngs/issues/374) — `--ena_metadata_fields` interpolated unquoted | 2026-08-10 | run 01 | closed, shipped in 1.13.0 |
| [nf-core/fetchngs#375](https://github.com/nf-core/fetchngs/issues/375) — `multiqc_mappings_config.py` stray quote, mangles commas | 2026-08-10 | run 01 | closed, shipped in 1.13.0 |
| [nf-core/fetchngs#376](https://github.com/nf-core/fetchngs/issues/376) — `--nf_core_pipeline` lacks ampliseq, mag, metatdenovo | 2026-08-10 | run 01 | closed, shipped in 1.13.0 |
| [nf-core/detaxizer#99](https://github.com/nf-core/detaxizer/issues/99) — `filter.nf` `$(COUNTER-1)` should be `$((COUNTER-1))` | 2026-08-11 | run 04 | open |
| [nf-core/detaxizer#100](https://github.com/nf-core/detaxizer/issues/100) — generated mag samplesheet rejected by mag | 2026-08-11 | run 04 | open |
| [nf-core/fetchngs#401](https://github.com/nf-core/fetchngs/issues/401) — 1.13.0 `--nf_core_pipeline mag` sheet rejected by mag | 2026-09-15 | 1.13.0 schema check | open |
| [nf-core/mag#1115](https://github.com/nf-core/mag/issues/1115) — BUSCO batch mode leaks lineage state between bins, corrupting `bin_summary.tsv` | 2026-09-18 | run 05 | open |

---

## 01 — fetchngs, LMO pilot

**Provenance:** <https://cloud.seqera.io/user/vangelis/watch/1Hd5FAdXhle9M9>

| | |
|---|---|
| Pipeline | `nf-core/fetchngs` `-r 1.12.0` (latest release at run time; superseded by 1.13.0 on 2026-09-15) |
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

All three are now documented in [AGENTS.md](AGENTS.md); none are LMO-specific. **All three
are fixed upstream in fetchngs 1.13.0** (2026-09-15) and apply only to a 1.12.0 run.

| Obstacle | Resolution |
|----------|------------|
| Nextflow 26.04 strict config parser rejects `def check_max(obj, type)` in 1.12.0's `nextflow.config` | `export NXF_SYNTAX_PARSER=v1` |
| `ena_metadata_fields` interpolated unquoted → YAML folded scalar's spaces split into extra shell args, argparse exit 2 on all 12 tasks | single-line, whitespace-free value |
| `wget:1.20.1` container has no `/etc/resolv.conf` → Singularity skips the bind, no DNS, `wget` exit 4 | per-process `container` override to `quay.io/biocontainers/gnu-wget:1.18--h60da905_7` |
| Execution report render aborts on `-resume` (timestamped filename already exists) | `report.overwrite` / `timeline.overwrite` / `trace.overwrite` / `dag.overwrite` = `true` |

### Upstream issues against nf-core/fetchngs — all filed, all shipped in 1.13.0

Drafted here on 2026-08-10, filed upstream, and **released in
[fetchngs 1.13.0](https://github.com/nf-core/fetchngs/releases/tag/1.13.0) on 2026-09-15**.

- [x] Quote `${fields}` in the `SRA_IDS_TO_RUNINFO` command (bug) — *"ENA metadata fields with spaces no longer cause word-splitting errors"*
- [x] `multiqc_mappings_config.py` emits a stray `"` and mangles comma-containing values (bug) — *"fixed stray quote and comma handling in CSV parsing"*
- [x] Cut a release with the modern template so 1.x works on Nextflow 26.04+ (release request) — template synced through nf-core/tools 4.1.0; `nextflowVersion = '!>=25.10.4'`
- [x] Add `ampliseq` / `mag` / `metatdenovo` to `--nf_core_pipeline` (feature) — enum is now `ampliseq, atacseq, mag, metatdenovo, rnaseq, sarek, taxprofiler, viralrecon`
- [x] `wget` container lacks `/etc/resolv.conf` (bug) — container updated to `wget` 1.25.0, upstream [#373](https://github.com/nf-core/fetchngs/issues/373)

**Run 01 is not re-run.** It succeeded on 1.12.0 and its outputs feed runs 02–05; the fixes
change how the run would be *set up*, not what it produced. What 1.13.0 changes for this
project is recorded in the two notes below.

### What 1.13.0 changes for the chain

**Three of the four environment workarounds are retired.** A 1.13.0 run needs no
`NXF_SYNTAX_PARSER=v1` (modern template), no whitespace-free `ena_metadata_fields`
(word-splitting fixed), and no `wget` container override (1.25.0 resolves DNS). The
`report.overwrite` settings are a Nextflow behaviour, not a fetchngs one, and still apply.
The override should be dropped from the site config only after a 1.13.0 run confirms it —
the container change is upstream's claim, not yet our observation.

**The new `--nf_core_pipeline` targets are not all usable.** Checked against
`subworkflows/local/channel_sra_create_csv/main.nf` and each target's `schema_input.json`:

| Target | Emitted extras | Verdict |
|---|---|---|
| `metatdenovo` | none — `sample,fastq_1,fastq_2` + metadata | **usable**; matches metatdenovo 1.4.0's required set |
| `ampliseq` | `run: ''` | **usable**; ampliseq 2.18.0 accepts the `sample`/`fastq_1` spelling and `run` is optional |
| `mag` | `group: ''`, `short_reads_platform: 'ILLUMINA'`, `long_reads_platform: ''` | **rejected by mag 5.5.0** — `group` is required with pattern `^\S+$`; the reads are also emitted as `fastq_1`/`fastq_2`, which mag does not read, and the platform is hardcoded rather than taken from `instrument_platform` |

The mag emitter is the **same defect as
[nf-core/detaxizer#100](https://github.com/nf-core/detaxizer/issues/100)** — an empty `group`
in a generated mag samplesheet — arriving independently in a second pipeline a month later.
**Filed 2026-09-15 as [nf-core/fetchngs#401](https://github.com/nf-core/fetchngs/issues/401).**

And on every target, `sample` is still the ENA experiment accession
(`buildPipelineMap` takes `meta.id` minus its run suffix), so a native sheet still labels
results `ERX13368357`. `scripts/converters/fetchngs_to_reads_samplesheet.py` stays necessary
for mag, detaxizer and viralmetagenome, and stays *useful* everywhere else for the
`collection_date` renaming.

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

## 05 — mag, LMO metagenome assembly and binning

**Status: SUCCESS, 2026-09-18.** Zero failed or retried tasks.

**Provenance:** <https://cloud.seqera.io/user/vangelis/watch/2wiu8ZycJHfAVC>

| | |
|---|---|
| Pipeline | `nf-core/mag` `-r 5.5.0` (`v5.5.0-g56abab5`) |
| Nextflow | 26.04.6 build 12646 |
| Input | the 3 WGS libraries from run 01 — ERR13967264, ERR13967258, ERR13967244, one per date |
| Samplesheet | generated on-cluster by `scripts/converters/fetchngs_to_reads_samplesheet.py --target mag --group 0` |
| Params | [`runs/05_mag/params.yml`](runs/05_mag/params.yml) — MEGAHIT per sample, MetaBAT2 only, BUSCO on, GTDB-Tk off; CheckM2 added afterwards with `-resume` |
| Date | 2026-09-18 |
| Outcome | Success — 3 assemblies, **160 MetaBAT2 bins**, **2,513,059 predicted proteins**, 1 phiX pair in 111.7 M |

This run is also the first time the `fetchngs → mag` conversion has been consumed: mag
5.5.0 accepted the `--target mag` sheet and ran to completion.

### Per-sample results

Read pairs are counted after fastp, as they enter phiX removal. Contig counts and lengths
are QUAST's headline rows. Proteins are `>` headers in the Prodigal `.faa.gz`.

| Sample | QC'd pairs | phiX pairs | Contigs (all) | Contigs (QUAST) | Assembly length | N50 | Largest contig | Proteins | Bins | Binned length |
|---|---|---|---|---|---|---|---|---|---|---|
| LMO_20160315_MG_a | 40,891,009 | 1 | 416,113 | 152,971 | 153.4 Mb | 969 | 235,899 | 507,173 | 27 | 46.2 Mb |
| LMO_20160803_MG_a | 40,446,582 | 0 | 795,419 | 323,869 | 368.1 Mb | 1,222 | 240,064 | 1,074,480 | 63 | 103.9 Mb |
| LMO_20171031_MG_a | 30,382,657 | 0 | 663,225 | 261,270 | 298.3 Mb | 1,202 | 240,519 | 931,406 | 70 | 84.1 Mb |
| **Total** | **111,720,248** | **1** | | | | | | **2,513,059** | **160** | **234.2 Mb** |

N50 near 1 kb is what you'd expect from short-read assembly of a diverse brackish community.
The 2016-03-15 sample has the most reads but the smallest assembly and the fewest bins,
so binning yield does not simply track read depth.

### phiX: one read pair, which confirms detaxizer is not needed upstream

mag's built-in bowtie2 phiX removal matched **1 concordant pair out of 111,720,248**, all
in the 2016-03-15 library. The metatranscriptome libraries (run 04) had 1 phiX pair in
936,301, so the metagenome rate is about two orders of magnitude lower. The decision to
keep detaxizer out of this run is therefore backed by a measured number, not an
assumption.

### Proteins: 12.7× run 02, and not directly comparable

2,513,059 metagenome proteins against run 02's 198,252 metatranscriptome proteins. The
ratio is not a biological result on its own:

- These are **three separate assemblies**. A genome present on all three dates contributes
  its ORFs up to three times. Run 02 was one co-assembly, so each gene was counted once.
- Metagenome assembly recovers whole genomes. Metatranscriptome assembly only recovers
  what was being transcribed.

**Decision (2026-09-18): the three FASTAs go to proteinfamilies as one concatenated row.**
That pools the dates the same way run 02's co-assembly did. The redundant copies are
removed by clustering. Expect proteinfamilies to run on roughly 12× run 03's input.

### BUSCO columns in `bin_summary.tsv` are unreliable

Bin counts, bin lengths and depths are sound. The BUSCO fields are not, for three
separate reasons:

1. **Mixed database generations in one run.** BUSCO 6.1.0 auto-lineage chose odb12.2
   datasets for 23 of 27 bins on 2016-03-15, but odb10 for 61 of 63 on 2016-08-03 and all
   70 on 2017-10-31. The two generations use different marker sets, so completeness
   can't be compared across dates.
2. **Wrong domain labels.** 82 bins have `Dataset = eukaryota_*`. In the odb10 rows, which
   are column-aligned, their `n_markers` is 124 (bacteria_odb10) or 194 (archaea_odb10),
   never 255 (eukaryota_odb10), and `Complete` equals a prokaryotic domain score. The
   numbers are prokaryotic; only the label is wrong.
3. **Shifted columns in the odb12.2 rows.** Values fall under the wrong headers: the
   translation table value `11` sits under `Internal stop codon percent`, and the domain
   score strings sit under `Translation table`. mag concatenates the per-sample
   `batch_summary.txt` files by header name (`qsv cat rowskey`). That suggests the
   batch files themselves mix odb10- and odb12-shaped rows under a single header.

Two bins (2016-03-15 `.4` and `.6`) have no BUSCO result at all, and 13 bins of
0.2–0.4 Mb were placed on `varicellovirus_odb10`.

**Cause, confirmed 2026-09-18: state leaking between genomes in BUSCO 6.1.0's batch mode.**
mag runs one `busco --auto-lineage` call per sample over the whole bin set (batch mode).
Both the 6.1.0 source and the per-sample `busco.log` processing order confirm it:

- `BaseConfig.load_dataset_config` (`BuscoConfig.py`) writes the chosen dataset's ODB
  generation back into the **shared** batch config. Virus lineages exist only as odb10.
  `BatchRunner.run` resets `datasets_version` only when it is empty, and
  `AutoSelectLineage.__init__` reads it for every later bin. The log shows this directly.
  On 2016-08-03 the first two bins ran odb12.2. The third fell back to
  `alphabaculovirus_odb10` and finished on `chordopoxvirinae_odb10`, and all 60 bins after
  it ran odb10. On 2017-10-31 the very first bin did the same, so all 70 ran odb10. On
  2016-03-15 two bins hit the virus fallback but both finished on `bacteria_odb12.2`, so
  the batch never switched.
- **Domain labels:** for 82 bins, `busco.log` reports `bacteria_*` (78) or `archaea_*` (4)
  as selected, but the summary row says `eukaryota_*`. No row anywhere carries a
  `bacteria_*` or `archaea_*` label.
- `BatchRunner.write_batch_summary` builds **one** header. The `Scores_*` names come from
  the **last** genome's root datasets, and `Translation table` / `Internal stop codon percent`
  are added if **any** genome needed them. `format_run_summary` writes each row in that
  row's own shape. The three per-sample headers really do differ in both respects, and
  rows of mixed shape under one header produce the column shift.

The root cause is in BUSCO, but mag's defaults expose it and mag publishes the result as
its bin QC. Filed 2026-09-18 as [nf-core/mag#1115](https://github.com/nf-core/mag/issues/1115),
proposing either one BUSCO task per bin or a consistency check before publishing. The same
class of bug is already open upstream as [ezlab/busco#841](https://gitlab.com/ezlab/busco/-/issues/841).
This project has not filed it with BUSCO.

**BUSCO numbers from this run do not go into the paper.** Bin quality comes from CheckM2
instead (next section): it is the usual tool for MIMAG reporting, and the one seqsubmit
uses anyway.

### Bin quality: CheckM2

**Provenance (CheckM2 re-run):** <https://cloud.seqera.io/user/vangelis/watch/2Nloa7fgPEWnlX>

Re-run 2026-09-18 with `-resume` and `run_checkm2: true` (CheckM2 database: Zenodo record
14897628, the mag 5.5.0 default, saved with `save_checkm2_data`). The re-run reproduced
the same 160 bins, split 27 / 63 / 70 by date, so the bins are unchanged. mag merges CheckM2
into `bin_summary.tsv` by bin name and exits on any mismatch, so these columns cannot shift
the way the BUSCO ones did. All 160 bins have a CheckM2 result.

Tiers use the MIMAG completeness/contamination thresholds (Bowers et al. 2017,
[doi:10.1038/nbt.3893](https://doi.org/10.1038/nbt.3893), PMID 28787424):

| Sample | Bins | ≥90% compl., <5% contam. | ≥50%, <10% | <50%, <10% | ≥10% contam. | Median compl. | Median contam. |
|---|---|---|---|---|---|---|---|
| LMO_20160315_MG_a | 27 | 4 | 7 | 11 | 5 | 60.2 | 0.45 |
| LMO_20160803_MG_a | 63 | 10 | 20 | 29 | 4 | 55.3 | 1.73 |
| LMO_20171031_MG_a | 70 | 10 | 22 | 35 | 3 | 46.6 | 1.24 |
| **Total** | **160** | **24** | **49** | **75** | **12** | 54.4 | 1.29 |

How to report these:

- **Call the 24 "near-complete", not "MIMAG high-quality".** MIMAG high quality also requires
  the 23S, 16S and 5S rRNA genes and at least 18 tRNAs, and this run did not check them.
  The 49 in the ≥50% / <10% tier do meet MIMAG medium quality as defined.
- **73 of 160 bins (46%) reach at least medium quality.** The other 87 are either less than
  50% complete or at least 10% contaminated.
- **CheckM2 used its general model for 62 bins (39%)** and its specific model for 98.
  CheckM2 switches to the general model when a genome is far from its training genomes, so
  a large share of these bins come from lineages poorly represented in reference databases.
  That is plausible for a Baltic brackish-water community, but GTDB-Tk was skipped, so
  there is no taxonomy to confirm it.
- The 2016-03-15 sample gives the fewest bins but the highest median completeness. As
  with the bin counts, quality does not simply follow read depth.

---

## 06 — proteinfamilies, families from the metagenome ORFs

**Status: SUCCESS, 2026-09-21.**

**Provenance:** Seqera run link pending (run name `compassionate_almeida`).

| | |
|---|---|
| Pipeline | `nf-core/proteinfamilies` `-r 2.5.0` (`v2.5.0-gf8c0b18`) |
| Nextflow | 26.04.4 |
| Input | one row, 2,513,059 proteins — run 05's three per-sample Prodigal FASTAs, pooled with sample-prefixed headers |
| Samplesheet | generated on-cluster by `scripts/converters/mag_to_proteinfamilies.py --expect 3` |
| Params | [`runs/06_proteinfamilies/params.yml`](runs/06_proteinfamilies/params.yml) — identical to run 03 |
| Date | 2026-09-21 |
| Outcome | Success — **5,864 protein families**, plus downstream samplesheets for proteinfold and proteinannotator |

This is the first time `mag → proteinfamilies` has been consumed: proteinfamilies 2.5.0
accepted the pooled one-row sheet unmodified and ran to completion.

### From proteins to families

Numbers from the run's MultiQC report (SeqFu before/after preprocessing, the MMseqs
cluster-size distribution, and the family metadata table):

| Stage | Count |
|---|---|
| Proteins in | 2,513,059 (mean 139.3 aa, longest 7,403) |
| After SeqKit preprocessing (length 30–5,000 aa, gap trimming, duplicate removal) | 2,415,819 — 97,240 removed (3.9%) |
| MMseqs initial clusters | 1,030,275, of which 782,124 (76%) are singletons |
| Clusters of ≥25 sequences, which seed a family (`cluster_size_threshold 25`) | 10,749, holding 614,725 sequences (25% of the filtered input) |
| Families after family building and redundancy removal | **5,864** |

### Against run 03: not yet a biological result

Run 03 gave 405 families from 198,252 metatranscriptome proteins. Run 06 has 12.7× the
input proteins and gives 14.5× the families. Method is held constant (Prodigal at assembly
level, proteinfamilies 2.5.0, identical parameters), but two things still differ besides
the omics layer:

- **Redundancy.** mag assembled each date separately, so a genome present on several dates
  contributes near-identical copies of its proteins. That inflates cluster sizes, and more
  clusters clear the size threshold than a co-assembly would allow. The family count is
  biased upward by an unknown amount.
- **Separate family sets.** The 405 and the 5,864 were built independently. Counting them
  says nothing about how many families the two layers share. That needs the families
  compared directly, which has not been done yet.

Both runs emitted `proteinfold/` and `proteinannotator/` samplesheets. None has been
consumed yet.

---

## Conversion scripts

`scripts/converters/` holds the conversions the validation table calls for. Each has an
assert-based `--selftest` that runs with no arguments and no fixtures:

| Script | Edge | Guards against |
|--------|------|----------------|
| `fetchngs_to_reads_samplesheet.py` | fetchngs → metatdenovo / ampliseq / viralmetagenome (`--target reads`), → detaxizer (`--target detaxizer`), → mag (`--target mag`) | stale `sample_alias` dates leaking into sample names; duplicate sample names silently merging samples. Sample names are identical across targets, which is what makes runs 02, 04 and 05 comparable. `--target mag` additionally refuses a long-read `instrument_platform` in `short_reads_platform`, and refuses an empty `group` — the column mag requires and [detaxizer#100](https://github.com/nf-core/detaxizer/issues/100) writes blank |
| `mag_to_proteinfamilies.py` | mag → proteinfamilies | pooling per-sample Prodigal FASTAs with plain `cat`, which repeats IDs because MEGAHIT names contigs `k141_<n>` in every assembly — headers are prefixed `<sample>-<id>` instead; a missing assembly (`--expect`); an empty Prodigal file; an output name or sample name proteinfamilies would reject |
| `metatdenovo_to_proteinfamilies.py` | metatdenovo → proteinfamilies | emitting a samplesheet proteinfamilies would reject (the transdecoder `.pep` case); more than one protein FASTA, which would mean the co-assembly assumption broke |
| `detaxizer_to_reads_samplesheet.py` | detaxizer → metatdenovo / ampliseq / viralmetagenome | picking up `filter/removed/` instead of `filter/filtered/`; an orphaned mate reaching a co-assembler; silently writing an empty sheet when `--skip_filter` meant no filtered reads were ever published. Handles both `--filtering_tool` naming schemes |

```bash
python3 scripts/converters/fetchngs_to_reads_samplesheet.py --selftest
python3 scripts/converters/metatdenovo_to_proteinfamilies.py --selftest
python3 scripts/converters/mag_to_proteinfamilies.py --selftest
python3 scripts/converters/detaxizer_to_reads_samplesheet.py --selftest
```

Generated samplesheets are **not committed** — they contain absolute cluster paths.
Regenerate them on the cluster from the previous pipeline's output.
