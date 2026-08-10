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
export NXF_SYNTAX_PARSER=v1   # REQUIRED — see below

nextflow run nf-core/fetchngs \
  -r 1.12.0 \
  -profile slurm,singularity \
  -c /path/to/your-site.config \
  -params-file params.yml \
  -resume
```

### `NXF_SYNTAX_PARSER=v1` is not optional

Nextflow **26.04 made the strict (v2) config parser the default**. It rejects Groovy
function definitions in `nextflow.config`, and fetchngs 1.12.0 — the latest release,
Feb 2024, predating the nf-core 3.x template — defines `check_max(obj, type)` at
`nextflow.config:230`. Without the flag the run dies before doing anything:

```
Error nextflow.config:230:14: Unexpected input: '('
 │ 230 | def check_max(obj, type) {
ERROR ~ Config parsing failed
```

The pipeline's `dev` branch has been modernised and parses under v2, but it is unpinned
and unreleased — not suitable for a benchmark intended for publication. Pin 1.12.0 and
set the parser.

## Verify params.yml before running

`ena_metadata_fields` is interpolated **unquoted** into the shell command at
`modules/local/sra_ids_to_runinfo/main.nf:20`. One stray space costs a full run:

```bash
python3 -c "
import yaml,urllib.request
d=yaml.safe_load(open('params.yml'))
v=d['ena_metadata_fields']
assert len(v.split())==1, 'whitespace in ena_metadata_fields -> argparse exit 2'
valid={l.split(chr(9))[0] for l in urllib.request.urlopen(
  'https://www.ebi.ac.uk/ena/portal/api/returnFields?result=read_run&format=tsv'
).read().decode().splitlines()[1:]}
bad=[f for f in v.split(',') if f not in valid]
assert not bad, f'invalid ENA fields: {bad}'
assert {'run_accession','experiment_accession','library_layout','fastq_ftp','fastq_md5'} <= set(v.split(','))
assert 'collection_date' in v.split(',')
assert set(d['sample_mapping_fields'].split(',')) <= set(v.split(','))
print('params.yml OK')
"
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

- **Compute nodes often cannot reach the internet.** `SRA_FASTQ_FTP` is a `wget` wrapper
  (`ext.args = '-t 5 -nv -c -T 60'`), so its exit status names the fault directly:
  `3` file I/O, **`4` network failure**, `5` SSL verification, `8` server error response.
  An exit 4 on every download task with the metadata stages green means DNS or routing,
  not data. **Read `.command.err` before assuming a firewall** — on codon the actual cause
  was DNS inside the container, not the network:

  ```
  WARNING: Skipping mount .../session/etc/resolv.conf [files]: /etc/resolv.conf doesn't exist in container
  wget: unable to resolve host address 'ftp.sra.ebi.ac.uk'
  ```

  **This is one bad image, not a broken cluster.** `depot.galaxyproject.org/singularity/wget:1.20.1`
  ships without `/etc/resolv.conf`, and a Singularity file bind needs the target to exist
  in the image, so the mount is skipped and the container gets no resolver. Confirmed
  scope: `SRA_IDS_TO_RUNINFO` and `SRA_RUNINFO_TO_FTP` reach the ENA API from their Python
  containers and pass, and `quay.io/biocontainers/gnu-wget:1.18--h60da905_7` shows the
  host's `resolv.conf` correctly. Fix — override that single container:

  ```groovy
  process {
      withName: 'SRA_FASTQ_FTP' {
          container = 'quay.io/biocontainers/gnu-wget:1.18--h60da905_7'
      }
  }
  ```

  All flags the module uses (`-t 5 -nv -c -T 60 -O`) exist in wget 1.18, and the
  version-capture `sed` still parses. Preferred over `-profile conda` because a benchmark
  intended for publication should stay containerized end to end. Diagnose before
  reaching for the workaround:

  ```bash
  cat <workdir>/.command.err                                   # says resolv.conf or routing
  getent hosts ftp.sra.ebi.ac.uk                               # host-side DNS
  singularity exec <image> cat /etc/resolv.conf                # container-side DNS
  ```

  If a future image fails the same way and no substitute exists, fall back to
  `-profile slurm,conda` (the module declares `conda "conda-forge::wget=1.20.1"`), or ask
  admins to enable overlay in `singularity.conf` so Singularity can create missing mount
  points itself.
- `--nf_core_pipeline` has no `ampliseq` / `mag` / `metatdenovo` option (enum is
  `rnaseq, atacseq, viralrecon, taxprofiler`). Those three handoffs require a conversion
  step — that is a finding for the validation table, not a blocker.
- fetchngs 1.12.0 predates the nf-core 3.x template, so it uses `--max_cpus` /
  `--max_memory` rather than the newer `resourceLimits` syntax — and needs
  `NXF_SYNTAX_PARSER=v1` on Nextflow 26.04+.
- Every path in `params.yml` is absolute. `--outdir` on the command line overrides the
  params file; `input` does not have a CLI equivalent here, so it must be correct in the
  file or the run fails schema validation (`exists: true`).
- **`ena_metadata_fields` must be a single unbroken line with no whitespace.** The module
  interpolates it unquoted, so spaces become extra shell arguments and every
  `SRA_IDS_TO_RUNINFO` task dies with an argparse usage message and exit 2. A YAML folded
  scalar (`>-`) reintroduces this: it folds newlines into spaces.
- **`-resume` collides with the execution reports.** A resumed run keeps the original
  session timestamp, so `pipeline_info/execution_report_<ts>.html` already exists and
  Nextflow aborts the render. Add to your site config:
  ```groovy
  report.overwrite   = true
  timeline.overwrite = true
  trace.overwrite    = true
  dag.overwrite      = true
  ```
- `TowerReports - Error copying reports file ... Operation not supported` is cosmetic —
  the `nf-tower` plugin cannot copy its TSV between those two filesystems. It does not
  fail the run.

## Status

| Step | Status |
|------|--------|
| `SRA_IDS_TO_RUNINFO` + `SRA_RUNINFO_TO_FTP` (12 runs each) | **PASS** — 24/24 tasks |
| `collection_date` present in runinfo | **PASS** — column 33 (`sample_alias` at 11) |
| `SRA_FASTQ_FTP` download | BLOCKED — `wget:1.20.1` image lacks `/etc/resolv.conf`; retrying with a `container` override |
| Samplesheet emitted + curated | BLOCKED on download |
| Scale to matched-26 (102 runs, 404 GB) | BLOCKED on pilot |

Environment findings from the pilot, all recorded in [AGENTS.md](../../AGENTS.md):
`NXF_SYNTAX_PARSER=v1` required on Nextflow 26.04+; `ena_metadata_fields` must be
whitespace-free; Singularity containers on codon have no working DNS.
