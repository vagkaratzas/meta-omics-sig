# AGENTS.md — Bot Operational Context

This file is for AI assistants working in this repository. It contains operational
context, conventions, resource pointers, and guardrails. It is not a project overview
(see README.md), a decision framework (see PLAN.md), or the dataset candidate list
(see DATASETS.md).

---

## What This Repository Is

A planning and execution workspace for the nf-core meta-omics SIG end-to-end use case.
There is currently no pipeline code here — the repo holds documentation and planning
artifacts. Tasks will include: dataset investigation, samplesheet format research,
pipeline chaining validation, and eventually workflow orchestration scripts.

**Read [Home.md](Home.md) first.** It is the map of content: which file owns which
question. Use it to route a request to the right canonical file instead of grepping
blindly across all of them.

The repository doubles as an Obsidian vault, which imposes one hard rule:

- **Use standard relative Markdown links, never `[[wikilink]]` syntax.** Obsidian resolves
  `[text](FILE.md)` for graph and backlinks just fine, whereas wikilinks render as literal
  brackets on GitHub and in the `docs/` Pages site. Every link in this repo is
  GitHub-safe; keep it that way.
- **Do not move or rename the canonical docs.** `docs/data.json`, `README.md` and
  `Home.md` all reference them by path, and `docs/index.html` builds links from
  `meta.plan` / `meta.datasets_doc` / `meta.runs_doc`.
- After editing links, run `python3 scripts/check_links.py`. It fails on broken links,
  orphaned files, and wikilinks, and exits non-zero. A file with no inbound links is
  invisible in the vault — that is how `ACRONYMS.md` went unnoticed until
  2026-08-10.

---

## Key Resources (Always Check Before Answering)

| Resource | URL | Use it for |
|----------|-----|------------|
| Meta-omics SIG page | https://nf-co.re/special-interest-groups/meta-omics | Current pipeline list, group goals |
| GitHub project board | https://github.com/orgs/nf-core/projects/79/views/1 | In-flight tasks, issue tracking |
| HackMD meeting notes | https://hackmd.io/@nf-core/SyCCVMkT0 | Prior decisions, discussion history |
| nf-core pipeline docs | https://nf-co.re/pipelines | Canonical I/O formats per pipeline |
| nf-core Slack | #meta-omics channel | Active SIG discussion |

---

## nf-core Conventions Relevant to This Project

### Samplesheet chaining
The standard inter-pipeline handoff in nf-core is a CSV samplesheet. Each pipeline
defines its own schema (usually in `assets/schema_input.json`). When checking whether
pipeline A's output can feed pipeline B, verify both schemas directly — do not assume
compatibility from pipeline names or descriptions alone.

### FASTQ samplesheet standard fields
Most nf-core pipelines that accept raw reads expect at minimum:
```
sample,fastq_1,fastq_2
```
Some add `strandedness`, `run_accession`, `instrument_platform`, etc. Always confirm
against the target pipeline's schema.

### Fetchngs output
nf-core/fetchngs emits a `samplesheet.csv` compatible with several downstream nf-core
pipelines (taxprofiler, mag, etc.). Check the fetchngs docs for the exact column set
and which pipelines it is tested against.

### Nextflow parameter files
Pipeline runs in this project should use `-params-file params.yml` to keep parameters
reproducible and reviewable.

### Singularity containers without `/etc/resolv.conf` (no DNS in container)
Singularity bind-mounts the host `/etc/resolv.conf` into containers, but a file bind
requires the target to already exist in the image. Minimal biocontainers often lack it,
and with overlay/underlay disabled in `singularity.conf` the mount is silently skipped —
the container then has no resolver and every network task fails. Symptom:

```
WARNING: Skipping mount .../session/etc/resolv.conf [files]: /etc/resolv.conf doesn't exist in container
wget: unable to resolve host address 'ftp.sra.ebi.ac.uk'
```

Looks like a firewall, is not. Diagnose in three commands before working around it:

```bash
cat <workdir>/.command.err                      # names DNS vs routing
getent hosts <host>                             # host-side resolution
singularity exec <image> cat /etc/resolv.conf   # container-side resolution
```

Usually it is **one bad image**, not the cluster. The diagnosis below stays useful for any
image; the specific fetchngs case is fixed upstream in 1.13.0 (2026-09-15), which ships
`wget` 1.25.0, so drop the override once a 1.13.0 run confirms it. Confirmed on codon (2026-08-10):
`depot.galaxyproject.org/singularity/wget:1.20.1` has no `/etc/resolv.conf`, while
`quay.io/biocontainers/gnu-wget:1.18--h60da905_7` and the pipeline's Python containers are
fine. Preferred fix is a per-process `container` override in the site config, which keeps
the run containerized:

```groovy
process { withName: 'SRA_FASTQ_FTP' { container = 'quay.io/biocontainers/gnu-wget:1.18--h60da905_7' } }
```

Fall back to `-profile conda` only if no substitute image exists. The systemic fix is
enabling overlay in `singularity.conf` (cluster-admin change) so Singularity can create
missing mount points. Affects any stage touching the network — downloads, database
fetches, API calls.

### Nextflow 26.04+ strict config parser
Nextflow 26.04 made the strict (v2) config parser the default. It rejects Groovy function
definitions in `nextflow.config`, which **every pre-nf-core-3.x pipeline still contains**
as the `check_max(obj, type)` resource helper. Symptom:

```
Error nextflow.config:<line>: Unexpected input: '('
 │ def check_max(obj, type) {
ERROR ~ Config parsing failed
```

Fix is `export NXF_SYNTAX_PARSER=v1`, not a pipeline downgrade or a `-r dev` switch —
`dev` branches are unpinned and unsuitable for a benchmark meant for publication. Expect
this for any pipeline in the chain whose latest release predates ~2024; check with
`curl -s https://raw.githubusercontent.com/nf-core/<pipeline>/<tag>/nextflow.config | grep -c check_max`.

### Nextflow head JVM `OutOfMemoryError` on large runs
When a task stages thousands of input files, the Nextflow head process (not the task)
can run out of heap while writing the task wrappers. It writes one staging line per
file per task. Symptom, in `.nextflow.log`, while tasks are being submitted:

```
error [java.lang.OutOfMemoryError]: Java heap space
  at nextflow.executor.SimpleFileCopyStrategy.getStageInputFilesScript(...)
```

Workaround: `export NXF_OPTS="-Xms2g -Xmx16g"` and relaunch with `-resume`. Confirmed on
codon (2026-09-21) for proteinfamilies 2.5.0 `MERGE_SEEDS` at ~2.4 M proteins (run 06). The
real fix is upstream, staging fewer files per task:
[nf-core/proteinfamilies#191](https://github.com/nf-core/proteinfamilies/issues/191).

### nf-core `interproscan` module ignores the staged database
Any pipeline using `modules/nf-core/interproscan` (proteinannotator 1.1.0 confirmed) reads
the container's small, unpressed sample database whatever `--interproscan_db` says, because
the module exports a relative `INTERPROSCAN_CONF`. Real runs fail with:

```
Running hmmpress (/usr/local/bin//hmmpress) on data/pirsf/3.10/sf_hmm_all
failed to open SSI index data/pirsf/3.10/sf_hmm_all.h3i
```

Workaround (codon, 2026-09-22, run 07): press a release matching the container (5.59-91.0)
once with `python3 setup.py -f interproscan.properties`, then bind its `data/` over the
container's copy:

```groovy
process { withName: '.*:INTERPROSCAN' { containerOptions = '-B <interproscan-5.59-91.0>/data:/usr/local/share/InterProScan/data' } }
```

Drop it once [nf-core/modules#13009](https://github.com/nf-core/modules/issues/13009) and
[nf-core/proteinannotator#114](https://github.com/nf-core/proteinannotator/issues/114) ship.

### Legacy `containers.biocontainers.pro` `.img` images hang the Singularity pull
A container URL of the form `https://containers.biocontainers.pro/s3/SingImgsRepo/...img`
is an old Singularity 2.x squashfs image, not a SIF. The header is
`#!/usr/bin/env run-singularity` followed directly by `hsqs`. With singularity-ce 3.10.3 on
codon, the pull downloads the whole file and then never finishes, even with
`singularity.pullTimeout = "3 hours"`. The run sits at:

```
Pulling Singularity image https://containers.biocontainers.pro/s3/SingImgsRepo/biocontainers/v1.2.0_cv1/biocontainers_v1.2.0_cv1.img [cache ...]
```

The `.pulling.<timestamp>` files in `singularity.cacheDir` reach full size and stay there.
This is not a Slurm or network problem; the pull runs on the head node before any job is
submitted. The cause of the hang after the download is unconfirmed (likely the conversion
of the legacy image to SIF). Confirmed for ampliseq 2.18.0 `FORMAT_TAXONOMY` (2026-09-24,
run 08). Workaround: pull the Docker image instead. This works for any module with the
standard nf-core container ternary:

```groovy
process { withName: '.*:FORMAT_TAXONOMY' { ext.singularity_pull_docker_container = true } }
```

Kill the stuck `singularity pull` and delete the `.pulling.*` files before relaunching with
`-resume`. Drop the override once
[nf-core/ampliseq#1081](https://github.com/nf-core/ampliseq/issues/1081) ships. To check
another pipeline for the same problem:
`grep -rn 'containers.biocontainers.pro' modules/`.

---

## Pipeline Quick Reference

These descriptions are intentionally conservative. Verify I/O details against nf-core
docs before generating any samplesheet or parameter file.

| Pipeline | Primary purpose | Main input | Main output |
|----------|----------------|-----------|-------------|
| fetchngs | Fetch public sequencing data | SRA/ENA accessions | FASTQ + samplesheet.csv |
| detaxizer | Remove host/contaminant reads | FASTQ | Filtered FASTQ |
| createtaxdb | Build custom taxonomy databases | Reference genomes/sequences | Database files |
| ampliseq | 16S/ITS/COI amplicon analysis | Amplicon FASTQ | Taxonomy tables, diversity |
| taxprofiler | Taxonomic profiling of shotgun reads | Shotgun FASTQ | Abundance profiles |
| mag | Metagenome assembly and binning | Shotgun FASTQ | Contigs, MAG FASTA |
| magmap | Map reads against a MAG/genome set | Contigs/genomes + reads | Coverage/abundance profiles |
| viralmetagenome | Viral metagenome analysis | Shotgun FASTQ | Viral contigs |
| metatdenovo | Metatranscriptome de novo assembly | Shotgun RNA FASTQ | Transcripts, contigs |
| eager | aDNA / low-input DNA preprocessing | Shotgun FASTQ | Processed FASTQ |
| differentialabundance | Differential abundance testing | Abundance profiles + metadata | Differentially abundant features |
| funcscan | Functional annotation of contigs | Assembled contigs / FASTA | Functional annotations |
| phageannotator | Phage identification and annotation | Assembled contigs / FASTA | Phage annotations |
| phyloplace | Phylogenetic placement | Query FASTA + reference tree | Placement results |
| metapep | Peptide analysis from (meta)proteomes | Protein FASTA | Peptide predictions |
| proteinfamilies | Protein family inference | Protein FASTA | Protein family clusters + optional proteinfold / proteinannotator samplesheets |
| proteinfold | Protein structure prediction | Protein FASTA | Predicted structures |
| proteinannotator | Sequence-level annotation of amino acid sequences (InterProScan et al.) | Protein FASTA | Functional annotations per sequence |
| seqsubmit | ENA submission of reads, assemblies, MAGs and bins | MAG/bin FASTA + submission metadata | ENA accessions |

> **Note on eager:** Designed for ancient/degraded DNA. Its inclusion in a modern
> environmental or clinical dataset workflow is unlikely to be biologically appropriate.
> Flag this to the user before including it in any proposed chain.

> **Note on metapep:** Verify the exact input format and analysis type against nf-core
> docs. Metaproteomic mass-spec data processing is a distinct pipeline concern from
> in-silico peptide prediction; do not conflate them.

---

## Dataset Accessions in Scope

Do not invent or guess SRA accessions. Only use these confirmed ones. Full candidate
write-ups and the scoring matrix live in **DATASETS.md**; this table is the accession
registry only.

**Selection gate (SIG decision):** a usable candidate must carry amplicon + shotgun MG +
shotgun MT. **Metaproteomics (MP) is out of scope** — the SIG has no pipeline consuming
mass-spec MP data, so PRIDE/PXD accessions below are recorded for completeness but do not
count toward selection.

| Dataset label | Accessions | Omics layers | Host context |
|---------------|-----------|--------------|--------------|
| Culture KS | PRJNA682552 | 16S amplicon, MG (Illumina+Nanopore), MT, MP | Environmental enrichment |
| Culture BP | PRJNA693457 | 16S amplicon (MiSeq+PacBio), MG (NovaSeq), MT, MP | Environmental enrichment |
| MetaGT Mock16 | SRR5947833, SRR5947907 | MG + MT | Synthetic community |
| MetaGT HumanGut | SRR10175815, SRR10175826 | MG + MT | Human gut |
| MetaGT SnailGut | SRR8397925, SRR8416101 | MG + MT | Deep-sea snail gut |
| Herold wastewater | PRJNA230567 (SRA) + PXD013655 (PRIDE) | 16S amplicon + MG + MT + MP — **only confirmed 4-omics public dataset** | Environmental (wastewater) |
| Heintz-Buschart T1DM | PRJNA289586 (SRA) + PRIDE TBC | MG (WGS) + MT (RNA-Seq) + MP; no amplicon | Human gut, T1DM families |
| Granata oral cancer | PRJNA700849 (SRA) + PXD022859 (PRIDE) | 16S amplicon + MP; no shotgun MG or MT | Human saliva, OSCC |
| LMO (Linnaeus Microbial Observatory) | 16S: PRJEB52780, PRJEB52782, PRJEB52828 · MG: PRJEB82694 · MT rRNA-depleted: PRJEB69280 · MT polyA: PRJEB90631, PRJEB90671 | 16S amplicon + MG + MT — **passes the gate**; no MP | Environmental (Baltic Sea brackish water, 2 m) |
| Geodia parva sponge (ASG) | PRJEB65620 umbrella (NCBI UID 1011691, not PRJNA1011691) · reads PRJEB65619 · MAGs PRJEB66616 | Holobiont WGS (HiFi+Illumina+Hi-C) + polyA RNA-Seq; no amplicon — **fails the gate** | Animal host (deep-sea sponge) |

If asked to find more datasets, search SRA/ENA directly or use the PubMed tool — do
not fabricate accessions. The iHMP (PRJNA398945) is a high-priority unverified candidate
to investigate.

### LMO-specific handling

- **Amplicon studies carry three filter fractions** — `0.2` (free-living, no prefilter),
  `3-0.2` (prefiltered), `3` (particle-associated) — encoded in `sample_title` as
  `filter fraction:<x>`. MG and MT are `0.2` only. Selections targeting the free-living
  fraction must match `0.2` exactly and **exclude `3-0.2`**.
- **Use `collection_date`, never `sample_alias`, as the date key.** In PRJEB82694 the
  aliases retain pre-correction dates and disagree with `collection_date` /`sample_title`
  for 23 of 26 samples. ENA aliases are immutable, so this will not be fixed upstream.
- Verified counts (ENA, 2026-08-10, fraction `0.2`): PRJEB52780 13 · PRJEB52782 19 ·
  PRJEB52828 12 · PRJEB82694 26 · PRJEB69280 64 runs over 33 dates. 26 dates carry all
  three layers. These do **not** match the submitter's own tally — see DATASETS.md,
  Candidate 8. Do not treat either count as settled.
- Query counts via the ENA portal API rather than trusting cached numbers, e.g.
  `curl -s "https://www.ebi.ac.uk/ena/portal/api/filereport?accession=<PRJEB>&result=read_run&fields=run_accession,sample_accession,sample_alias,sample_title,collection_date&format=tsv&limit=0"`

---

## Recommended External Tools (ClawBio Skills)

These [ClawBio skills](https://github.com/ClawBio/ClawBio/tree/main/skills) complement
the nf-core pipeline chain. Install via the ClawBio plugin; skills are invoked by
keyword trigger or explicit name.

| Skill | Repo link | When to use | Scope |
|-------|-----------|-------------|-------|
| **`lit-synthesizer`** | [link](https://github.com/ClawBio/ClawBio/tree/main/skills/lit-synthesizer) | Dataset discovery (Phase 0); related-work section of the paper (Phase 6) | Searches PubMed + bioRxiv, extracts themes across abstracts, builds citation graphs |
| **`ncbi-datasets`** | [link](https://github.com/ClawBio/ClawBio/tree/main/skills/ncbi-datasets) | Fetching reference genomes for `createtaxdb` (Phase 1); inspecting BioProject metadata before committing to SRA downloads | Downloads by taxon, GCF/GCA accession, or gene symbol; never invents identifiers |
| **`busco-assessor`** | [link](https://github.com/ClawBio/ClawBio/tree/main/skills/busco-assessor) | MAG completeness after `nf-core/mag`; transcript completeness after `nf-core/metatdenovo` (Phase 2a) | Genome, transcriptome, and protein modes; use BUSCO v6 + SEPP 4.5.5 exactly |
| **`multiqc-reporter`** | [link](https://github.com/ClawBio/ClawBio/tree/main/skills/multiqc-reporter) | Aggregating QC across all pipeline runs for a unified report (Phase 5a) | Auto-detects outputs from 100+ tools; requires MultiQC ≥1.20 on PATH |
| **`claw-metagenomics`** | [link](https://github.com/ClawBio/ClawBio/tree/main/skills/claw-metagenomics) | Independent sanity-check of taxonomy outputs alongside nf-core runs (Phase 2) | Kraken2 → Bracken → HUMAnN3 on raw FASTQ; not a replacement for `taxprofiler`/`mag` |

> **Scope boundary:** These tools supplement the nf-core chain — they do not replace it.
> Pipeline runs for the use case must use the nf-core pipelines listed in PLAN.md;
> ClawBio skills are for QC, validation, and research acceleration only.

---

## Guardrails

1. **Do not declare samplesheet handoffs as working without evidence.** All edges in
   the pipeline chain in PLAN.md are marked OPEN/UNVALIDATED. The project's value is in
   testing them, not assuming them.

2. **Do not resolve the dataset decision unilaterally.** The dataset selection is an
   open question for the SIG to decide. Summarize trade-offs; present options; don't
   pick one as final.

3. **Verify pipeline I/O against nf-core docs.** Pipeline behavior changes between
   releases. Schema files in the pipeline repo are authoritative over any description
   in this repo.

4. **Publication framing.** This project targets a community publication. Framing
   should emphasize what is validated vs. what remains to be done. Avoid overclaiming.

5. **Authorship and credit.** Any generated text destined for a paper or SIG
   communication must preserve references and attributions to the source datasets
   and tools. Always include DOIs and PMIDs when referencing literature.

---

## How to Help With This Project

**Dataset research:** Use the `lit-synthesizer` ClawBio skill (PubMed + bioRxiv) and the
PubMed MCP tool for literature search. Use `ncbi-datasets` to inspect BioProject metadata.
Score candidates against the matrix in DATASETS.md. Apply the gate first (amplicon + MG +
MT — no gate, no selection), then prioritize: host-related context, ≥3 replicates per
condition, post-2021 vintage, community complexity. Do not score MP availability.

**Pipeline chaining:** To check if pipeline A's output can feed pipeline B, fetch both
pipelines' samplesheet schemas from their GitHub repos and compare column sets. Report
gaps that would require a conversion step.

**Parameter file generation:** Use confirmed dataset accessions and pipeline schema
files. Never generate parameter values from memory alone.

**Roadmap tracking:** PLAN.md is the canonical roadmap; DATASETS.md is the canonical
dataset candidate list and scoring matrix; RUNS.md is the canonical execution ledger.
Update them when decisions are made or runs complete. Do not create a separate status
file.

**Recording runs:** every execution gets a RUNS.md entry with pipeline, revision,
Nextflow version, input manifest, Seqera Platform link, and outcome. **Never write
absolute cluster paths into tracked files** — they are site-specific and go stale. Output
directories are gitignored; the Seqera link is the durable provenance record.

**Companion website:** live at <https://vagkaratzas.github.io/meta-omics-sig/>, built from
`docs/` — a dependency-free GitHub Pages site rendering the pipeline chain as a conveyor
belt. It is public, so treat its wording as outward-facing.
**When you change PLAN.md's samplesheet validation table, change
`docs/data.json` in the same commit** — `repoStatus` strings there are verbatim copies of that
table's Status column and are the site's only source of authority. Site-specific judgements
(`siteState`, `caveat`, `routable`) are labelled as annotations and must never be presented as
repo-recorded status. Serve locally with `python3 -m http.server -d docs 8080`.
