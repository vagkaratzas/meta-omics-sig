# AGENTS.md — Bot Operational Context

This file is for AI assistants working in this repository. It contains operational
context, conventions, resource pointers, and guardrails. It is not a project overview
(see README.md) or a decision framework (see PLAN.md).

---

## What This Repository Is

A planning and execution workspace for the nf-core meta-omics SIG end-to-end use case.
There is currently no pipeline code here — the repo holds documentation and planning
artifacts. Tasks will include: dataset investigation, samplesheet format research,
pipeline chaining validation, and eventually workflow orchestration scripts.

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
| proteinfamilies | Protein family inference | Protein FASTA | Protein family clusters |
| proteinfold | Protein structure prediction | Protein FASTA | Predicted structures |

> **Note on eager:** Designed for ancient/degraded DNA. Its inclusion in a modern
> environmental or clinical dataset workflow is unlikely to be biologically appropriate.
> Flag this to the user before including it in any proposed chain.

> **Note on metapep:** Verify the exact input format and analysis type against nf-core
> docs. Metaproteomic mass-spec data processing is a distinct pipeline concern from
> in-silico peptide prediction; do not conflate them.

---

## Dataset Accessions in Scope

Do not invent or guess SRA accessions. Only use these confirmed ones:

| Dataset label | Accessions | Omics layers |
|---------------|-----------|--------------|
| Culture KS | PRJNA682552 | 16S amplicon, MG (Illumina+Nanopore), MT, MP |
| Culture BP | PRJNA693457 | 16S amplicon (MiSeq+PacBio), MG (NovaSeq), MT, MP |
| MetaGT Mock16 | SRR5947833, SRR5947907 | MG + MT |
| MetaGT HumanGut | SRR10175815, SRR10175826 | MG + MT |
| MetaGT SnailGut | SRR8397925, SRR8416101 | MG + MT |

If asked to find more datasets, search SRA/ENA directly or use the PubMed tool — do
not fabricate accessions.

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
Score candidates against the criteria in PLAN.md. Prioritize: 4-omics coverage,
host-related context, ≥3 replicates per condition, post-2021 vintage.

**Pipeline chaining:** To check if pipeline A's output can feed pipeline B, fetch both
pipelines' samplesheet schemas from their GitHub repos and compare column sets. Report
gaps that would require a conversion step.

**Parameter file generation:** Use confirmed dataset accessions and pipeline schema
files. Never generate parameter values from memory alone.

**Roadmap tracking:** PLAN.md is the canonical roadmap. Update it when decisions are
made. Do not create a separate status file.
