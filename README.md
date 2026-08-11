# nf-core meta-omics SIG — End-to-End Use Case

This repository tracks the design and execution of an end-to-end multi-omics benchmark
for the [nf-core meta-omics Special Interest Group](https://nf-co.re/special-interest-groups/meta-omics).

**📊 Live project site: <https://vagkaratzas.github.io/meta-omics-sig/>** — an interactive
view of the pipeline chain: what each pipeline needs as input, which handoffs have been
exercised so far, and where a bridge is still needed.

## Goal

Build a reproducible, publicly documented workflow that traverses as many nf-core meta-omics
pipelines as possible using real multi-omic sequencing data, with sequential samplesheet
chaining between pipelines. The use case will:

- Validate the meta-omics "metro map" pipeline-chaining diagram in practice
- Demonstrate and document current samplesheet handoffs between nf-core pipelines
- Serve as a community benchmark and basis for an nf-core publication

## The Meta-Omics Metro Map

![The nf-core meta-omics pipeline chaining diagram: three stages left to right — data input
(fetchngs, detaxizer, createtaxdb), primary analysis (ampliseq, taxprofiler, mag,
viralmetagenome, metatdenovo, eager, magmap), and secondary analysis (differentialabundance,
metapep, phageannotator, funcscan, phyloplace, proteinfamilies, proteinfold) — with coloured
tracks for amplicon reads, shotgun reads and contigs/genomes, and file icons marking where
FASTQ, FASTA and profile artefacts pass between pipelines.](images/pipeline_chain.png)

The SIG's chaining diagram, and the starting point for this project. It sets out how these
pipelines **could** chain together — a roadmap of intended synergy, where each track marks a
potential route rather than a guarantee that the handoff works today. Walking those routes on
real data, and reporting back what we find, is the work described in
[PLAN.md](PLAN.md); live per-edge status is on the
**[project site](https://vagkaratzas.github.io/meta-omics-sig/)**.

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
| ENA submission | seqsubmit | MAGs / bins / assemblies / reads |

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
| `scripts/check_links.py` | Link-hygiene check for the vault — broken links, orphans, wikilinks |
| `docs/` | Source for the [live site](https://vagkaratzas.github.io/meta-omics-sig/); `data.json` mirrors the PLAN.md validation table |
| [`AGENTS.md`](AGENTS.md) | Bot/AI operational context — conventions, resource pointers, guardrails |
| [`ACRONYMS.md`](ACRONYMS.md) | Glossary of acronyms used across these documents |
| [`LOG.md`](LOG.md) | Dated activity log |

## Obsidian Vault

This repository doubles as an **Obsidian vault**. There is no separate vault directory —
the vault *is* the repo, so the notes and the canonical docs can never drift apart. Graph
view and backlinks are built from the ordinary relative Markdown links already in these
files. **No `[[wikilink]]` syntax is used**, because it renders as literal brackets on
GitHub and in the `docs/` site; `scripts/check_links.py` enforces that.

### Install (Ubuntu)

```bash
sudo snap install obsidian --classic
```

`--classic` is required. The snap is published by `obsidianmd` (official, not a
repackage), and classic confinement is also what lets Obsidian read a vault outside
`~/snap`. The `.deb` from <https://obsidian.md/download> works equally well.

### First open — must be the GUI

Launch Obsidian → **Open folder as vault** → select this repository's root directory.
Then open [`Home.md`](Home.md), the map of content.

This step cannot be scripted: Obsidian has no command-line argument for opening a folder,
and the `obsidian://` URI only opens vaults that are **already registered**. Register once
by hand, then reopen from the terminal:

```bash
xdg-open "obsidian://open?path=$(python3 -c 'import urllib.parse,os;print(urllib.parse.quote(os.getcwd()))')"
```

Worth a shell function in `~/.bashrc`, since it reopens whatever repo you are standing in:

```bash
obs() { xdg-open "obsidian://open?path=$(python3 -c 'import urllib.parse,os;print(urllib.parse.quote(os.getcwd()))')"; }
```

### Day-to-day

| Shortcut | Does | Use it for |
|----------|------|------------|
| `Ctrl+O` | Quick switcher | Jump to a file by name — faster than the file tree |
| `Ctrl+Shift+F` | Search all files | Find every mention of an accession or a status string across all docs |
| `Ctrl+G` | Graph view | `runs/` blue, `scripts/` green, canonical docs amber, agent docs grey |
| `Ctrl+P` | Command palette | Everything else, incl. **Open local graph** |
| `Ctrl+E` | Toggle edit / reading | Files open in reading view by default |
| `Ctrl`+hover | Peek a link | Check a cross-reference without leaving the page |

Three checks this makes cheap:

- **Cross-doc consistency.** `Ctrl+Shift+F` an accession such as `PRJEB82694` to see every
  mention at once. This is how a figure updated in one file but not another gets caught.
- **The PLAN.md ↔ `docs/data.json` mirror.** Search a `repoStatus` string; you should get
  exactly two hits, one per file. One hit means the mirror is broken.
- **Impact before a refactor.** Open a canonical doc, then `Ctrl+P` → *Open local graph* to
  see everything that depends on it.

### Before committing doc changes

```bash
python3 scripts/check_links.py
```

Fails on broken links, orphaned files (no inbound links — invisible in the graph), and
wikilinks. Exits non-zero, so it works as a pre-commit hook.

Personal Obsidian state is gitignored (`workspace*`, `cache`, `plugins/`, `themes/`), so
installing plugins or rearranging panes will not touch anyone else's setup.

## SIG Resources

- **Project site (this work):** https://vagkaratzas.github.io/meta-omics-sig/
- **SIG page:** https://nf-co.re/special-interest-groups/meta-omics
- **GitHub project board:** https://github.com/orgs/nf-core/projects/79/views/1
- **Meeting notes (HackMD):** https://hackmd.io/@nf-core/SyCCVMkT0
- **Slack:** `#meta-omics` channel on nf-core Slack
