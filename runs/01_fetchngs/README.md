# Run 01 — fetchngs (LMO pilot)

First pipeline of the chain. Downloads FASTQ + metadata for a **3-date pilot subset** of
the LMO dataset (Candidate 8 in [DATASETS.md](../../DATASETS.md)) before committing to the
full 26-date, 404 GB benchmark run.

- Pipeline: `nf-core/fetchngs` **1.12.0** (latest release; requires Nextflow `>=23.04.0`)
- Input: [`ids.csv`](ids.csv) — 12 run accessions, one per line (fetchngs takes a bare ID
  list, **not** a CSV samplesheet)
- Params: [`params.yml`](params.yml)
- Volume: **34.5 GB**

## Why these three dates

Chosen to hit **all five core accessions** and three seasons in one pilot, so a single
run exercises every study we will later scale to. Each date carries amplicon (0.2) + MG +
MT with 2 MT replicates. `2016-07-05` was deliberately avoided — its MG run is a 73 GB
outlier, 10x the others.

| Date | Season | 16S study | Runs | GB |
|------|--------|-----------|------|-----|
| 2016-03-15 | Early spring | PRJEB52780 | 4 | 10.5 |
| 2016-08-03 | Summer | PRJEB52782 | 4 | 11.9 |
| 2017-10-31 | Autumn | PRJEB52828 | 4 | 12.1 |

## Selected runs

| Run | Study | Date | Strategy | Instrument | GB |
|-----|-------|------|----------|------------|-----|
| ERR9715801 | PRJEB52780 | 2016-03-15 | AMPLICON | MiSeq | 0.42 |
| ERR12258632 | PRJEB69280 | 2016-03-15 | RNA-Seq | HiSeq 2500 | 2.22 |
| ERR12258633 | PRJEB69280 | 2016-03-15 | RNA-Seq | HiSeq 2500 | 2.16 |
| ERR13967264 | PRJEB82694 | 2016-03-15 | WGS | NovaSeq 6000 | 5.74 |
| ERR9717120 | PRJEB52782 | 2016-08-03 | AMPLICON | MiSeq | 0.09 |
| ERR12258650 | PRJEB69280 | 2016-08-03 | RNA-Seq | HiSeq 2500 | 3.25 |
| ERR12258651 | PRJEB69280 | 2016-08-03 | RNA-Seq | HiSeq 2500 | 2.83 |
| ERR13967258 | PRJEB82694 | 2016-08-03 | WGS | NovaSeq 6000 | 5.70 |
| ERR9726503 | PRJEB52828 | 2017-10-31 | AMPLICON | MiSeq | 0.05 |
| ERR12258626 | PRJEB69280 | 2017-10-31 | RNA-Seq | HiSeq 2500 | 3.96 |
| ERR12258627 | PRJEB69280 | 2017-10-31 | RNA-Seq | HiSeq 2500 | 3.70 |
| ERR13967244 | PRJEB82694 | 2017-10-31 | WGS | NovaSeq 6000 | 4.37 |

Selection criteria applied: amplicon restricted to `filter fraction:0.2` (MG and MT are
0.2 exclusively, so it is the only like-for-like fraction); MT restricted to the
rRNA-depleted study PRJEB69280; dates restricted to the 26 carrying all three layers.

## How this list was derived

```bash
# Per study, then filter on `filter fraction:0.2` in sample_title and intersect dates.
curl -s "https://www.ebi.ac.uk/ena/portal/api/filereport\
?accession=<PRJEB>&result=read_run\
&fields=study_accession,run_accession,sample_accession,sample_alias,sample_title,\
collection_date,library_strategy,instrument_model,read_count,fastq_bytes\
&format=tsv&limit=0"
```

**Date key is `collection_date`, never `sample_alias`.** In PRJEB82694 the aliases retain
pre-correction dates and disagree with `collection_date` for 23 of 26 samples; ENA aliases
are immutable so this will not be fixed upstream.

## Run

```bash
nextflow run nf-core/fetchngs \
  -r 1.12.0 \
  -profile singularity \
  -c /path/to/your-site.config \
  -params-file params.yml \
  -resume
```

## Verify before scaling up

```bash
# 12 runs downloaded, paired-end
wc -l results/01_fetchngs/samplesheet/samplesheet.csv     # expect 13 (12 + header)

# collection_date survived into the metadata — the whole point of ena_metadata_fields
head -1 results/01_fetchngs/metadata/*.tsv | tr '\t' '\n' | grep -c collection_date

# alias/collection_date conflict is visible and collection_date is the sane one
cut -f<alias>,<collection_date> results/01_fetchngs/metadata/*.tsv
```

## Known gotchas

- **Compute nodes often cannot reach the internet.** fetchngs' download processes need
  outbound HTTPS/FTP to ENA. If the cluster firewalls compute nodes, route the download
  processes to a data-transfer queue in your site config, or run fetchngs on a login node
  with `-profile singularity` and a `local` executor, then run everything downstream on
  SLURM.
- `--nf_core_pipeline` has no `ampliseq` / `mag` / `metatdenovo` option (enum is
  `rnaseq, atacseq, viralrecon, taxprofiler`). Those three handoffs require a conversion
  step — that is a finding for the validation table, not a blocker.
- fetchngs 1.12.0 predates the nf-core 3.x template, so it uses `--max_cpus` /
  `--max_memory` rather than the newer resource-limits syntax.

## Status

| Step | Status |
|------|--------|
| Pilot run | NOT YET RUN |
| Scale to matched-26 (102 runs, 404 GB) | BLOCKED on pilot |
