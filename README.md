# nf-core meta-omics SIG — End-to-End Use Case

This repository tracks the design and execution of an end-to-end multi-omics benchmark
for the [nf-core meta-omics Special Interest Group](https://nf-co.re/special-interest-groups/meta-omics).

## Goal

Build a reproducible, publicly documented workflow that traverses as many nf-core meta-omics
pipelines as possible using real multi-omic sequencing data, with sequential samplesheet
chaining between pipelines. The use case will:

- Validate the meta-omics "metro map" pipeline-chaining diagram in practice
- Demonstrate and document current samplesheet handoffs between nf-core pipelines
- Serve as a community benchmark and basis for an nf-core publication

## The Meta-Omics Metro Map

The pipelines in scope are organized by stage:

| Stage | Pipelines | Data type in |
|-------|-----------|--------------|
| Data retrieval | fetchngs | SRA / ENA accessions |
| Host decontamination | detaxizer | FASTQ |
| Taxonomy DB creation | createtaxdb | Reference sequences |
| Amplicon analysis | ampliseq | Amplicon reads |
| Taxonomic profiling | taxprofiler | Shotgun reads |
| Metagenome assembly | mag | Shotgun reads |
| MAG read mapping | magmap | Contigs / genomes |
| Viral metagenomics | viralmetagenome | Shotgun reads |
| Metatranscriptome assembly | metatdenovo | Shotgun RNA reads |
| aDNA / low-input preprocessing | eager | Shotgun reads |
| Differential abundance | differentialabundance | Abundance profiles |
| Functional annotation | funcscan | Assembled contigs / FASTA |
| Phage annotation | phageannotator | Assembled contigs / FASTA |
| Phylogenetic placement | phyloplace | Assembled contigs / FASTA |
| Peptide / protein analysis | metapep | Predicted proteins / FASTA |
| Protein family inference | proteinfamilies | Predicted proteins / FASTA |
| Protein structure prediction | proteinfold | Predicted proteins / FASTA |

## Key Open Questions

Two decisions gate all downstream work; neither is resolved yet:

1. **Dataset selection** — no public dataset found so far satisfies both the
   amplicon + MG + MT requirement and "host-related with modern replicates."
   See `DATASETS.md`.
2. **Pipeline chain scope** — which edges of the metro map can be validated with
   the chosen dataset, and which require separate data or a stretch run.

## Repository Contents

| File | Purpose |
|------|---------|
| [`Home.md`](Home.md) | Map of content — which file owns which question. Start here in Obsidian |
| [`PLAN.md`](PLAN.md) | Decision framework, selection constraints, pipeline chain design, roadmap, open questions |
| [`DATASETS.md`](DATASETS.md) | Candidate datasets (accessions, omics layers, trade-offs) and the scoring matrix |
| [`RUNS.md`](RUNS.md) | Execution ledger — every pipeline run, with Seqera Platform provenance links |
| `runs/<NN>_<pipeline>/` | Per-run inputs, params, and troubleshooting notes |
| `scripts/converters/` | Samplesheet conversions between pipelines, each with a `--selftest` |
| `docs/` | GitHub Pages site; `data.json` mirrors the PLAN.md validation table |
| [`AGENTS.md`](AGENTS.md) | Bot/AI operational context — conventions, resource pointers, guardrails |
| [`ACRONYMS.md`](ACRONYMS.md) | Glossary of acronyms used across these documents |
| [`LOG.md`](LOG.md) | Dated activity log |

This repository doubles as an **Obsidian vault** — open the folder in Obsidian and start
at [`Home.md`](Home.md). Graph view and backlinks work off the ordinary relative Markdown
links already in these files; no `[[wikilink]]` syntax is used, so everything renders
identically on GitHub.

## SIG Resources

- **SIG page:** https://nf-co.re/special-interest-groups/meta-omics
- **GitHub project board:** https://github.com/orgs/nf-core/projects/79/views/1
- **Meeting notes (HackMD):** https://hackmd.io/@nf-core/SyCCVMkT0
- **Slack:** `#meta-omics` channel on nf-core Slack
