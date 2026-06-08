# Meta-Omics End-to-End Use Case — Implementation Plan

## Problem Statement

The nf-core meta-omics SIG maintains a "metro map" showing how its pipelines chain
together across data types and analysis stages. That diagram makes claims about
samplesheet handoffs (output of pipeline A feeds pipeline B) that have not yet been
validated end-to-end on real data. This project will:

1. Select a real, public multi-omics dataset
2. Run it through as many metro-map pipelines as data layers allow
3. Document every samplesheet handoff (validating or falsifying each edge)
4. Publish the workflow and findings as an nf-core community paper

**Publication target:** nf-core community paper (joint authorship across SIG members).

---

## Core Constraint: Datasets and Pipelines Are Coupled

Pain point 1 (dataset) and pain point 2 (pipelines) are not independent. Each branch of
the metro map requires a specific data layer:

| Pipeline branch | Required data layer |
|----------------|---------------------|
| ampliseq | 16S / ITS amplicon reads |
| taxprofiler / mag / magmap | Shotgun metagenomic reads |
| metatdenovo | Shotgun metatranscriptomic reads |
| viralmetagenome | Shotgun metagenomic reads |
| metapep / proteinfamilies / proteinfold | Predicted proteins (FASTA), downstream of MAG/assembly |
| funcscan / phageannotator / phyloplace | Assembled contigs or MAG FASTA |
| differentialabundance | Abundance profiles, requires ≥2 conditions with replicates |

A dataset missing any layer reduces the pipelines reachable. Dataset selection is
therefore the gating decision.

---

## Dataset Candidates

### Candidate 1 — PRJNA682552 (Culture KS)

| Property | Value |
|----------|-------|
| Accession | PRJNA682552 |
| Environment | Freshwater sediment enrichment culture (Bremen, Germany) |
| Organism | *Ferrigenium straubiae*, *Rhodanobacter* spp. (nitrate-reducing iron-oxidizing) |
| Omics layers | 16S amplicon + Illumina/Nanopore shotgun MG + MT (2 conditions, 3 replicates) + MP |
| SRA experiments | 31 |
| Vintage | ~2019–2021 |
| Strengths | Full 4-omics stack; biological replicates; long-read MG for better assembly |
| Weaknesses | Cultured enrichment (not host-related); small community complexity; old vintage |

### Candidate 2 — PRJNA693457 (Culture BP)

| Property | Value |
|----------|-------|
| Accession | PRJNA693457 |
| Environment | Freshwater sediment enrichment culture (Bremen, Germany) |
| Organism | *Candidatus Ferrigenium bremense*, *Geothrix*, *Rhodoferax*, *Thiobacillus* spp. |
| Omics layers | 16S amplicon (MiSeq + PacBio) + Illumina NovaSeq shotgun MG + MT (2 conditions, 3 replicates) + MP |
| SRA experiments | 78 |
| Assembled genomes | 13 |
| Vintage | ~2019–2021 |
| Strengths | Largest SRA experiment count; multi-platform amplicon; 13 pre-assembled genomes |
| Weaknesses | Same study system as KS — cultured enrichment, not host-related; old vintage |

### Candidate 3 — MetaGT study datasets (MG + MT pairs)

| Property | Value |
|----------|-------|
| Key accessions | Mock16: SRR5947833, SRR5947907; HumanGut: SRR10175815, SRR10175826; SnailGut: SRR8397925, SRR8416101 |
| Omics layers | Paired shotgun MG + MT only |
| Strengths | Real human gut data (HumanGut); high-complexity; metatdenovo-relevant |
| Weaknesses | No amplicon; no MP; limited replicates per study |

### Candidate 4 — Rausch et al. 2019 (metaorganism study)

| Property | Value |
|----------|-------|
| PMID / DOI | 31521200 / [10.1186/s40168-019-0743-1](https://doi.org/10.1186/s40168-019-0743-1) (PubMed) |
| Journal | *Microbiome* (2019) |
| Environment | 10 animal host taxa (sponges to humans, including aquatic and terrestrial) |
| Omics layers | 16S amplicon (V1V2 and V3V4) + shotgun MG |
| Strengths | Host-related; diverse taxa; comparative amplicon vs shotgun design |
| Weaknesses | No MT; no MP; amplicon + MG only — limits pipeline coverage |

### Candidate 5 — PRJNA230567 + PXD013655 (Herold et al. wastewater, Luxembourg)

| Property | Value |
|----------|-------|
| Accessions | PRJNA230567 (amplicon + MG + MT), PXD013655 (MP, PRIDE) |
| Environment | Biological wastewater treatment plant (Luxembourg) |
| Organism | Mixed microbial community — lipid-accumulating bacteria |
| Omics layers | 16S amplicon + Illumina shotgun MG + MT + MP (full 4-omics stack) |
| SRA experiments | 189 (+ 29,484 PRIDE files) |
| Data volume | 1.5 TB (SRA) |
| Conditions | Summer vs. winter seasonal variation; 5 replicates per condition |
| Key publications | Herold et al. *Nat Commun* (2020); Martínez Arbas et al. *Nat Microbiol* (2021) |
| Strengths | **Only confirmed public dataset with all 4 omics layers**; strong replicate design; well-published by the Wilmes lab |
| Weaknesses | Environmental (not host-related); very large data volume (1.5 TB); wastewater context may reduce biological relevance for host-focused SIG |

### Candidate 6 — PRJNA289586 + PRIDE (Heintz-Buschart et al. T1DM gut, Luxembourg)

| Property | Value |
|----------|-------|
| Accessions | PRJNA289586 (MG + MT, SRA); PRIDE accession TBC |
| Environment | Human gut — 4 multiplex families with type 1 diabetes mellitus |
| Organism | Human gut microbiome (high complexity) |
| Omics layers | Shotgun MG (WGS, NextSeq/HiSeq) + MT (RNA-Seq) + MP (PRIDE, 7,734 proteins); **no amplicon** |
| SRA experiments | 221 |
| Data volume | ~950 GB |
| Conditions | Observational; T1DM cases vs. healthy family members; longitudinal sampling |
| Key publication | Heintz-Buschart et al. *Nat Microbiol* (2016) — landmark integrated MG+MT+MP study |
| Strengths | Human host, clinically relevant (T1DM); high community complexity; well-published reference dataset; same Wilmes lab as Candidate 5 |
| Weaknesses | No amplicon; old vintage (2016); family-based design gives sparse per-condition replicates; PRIDE accession needs confirming |

### Candidate 7 — PRJNA700849 + PXD022859 (Granata et al. oral cancer saliva)

| Property | Value |
|----------|-------|
| Accessions | PRJNA700849 (16S amplicon, SRA); PXD022859 (MP, PRIDE) |
| Environment | Human saliva — oral squamous cell carcinoma (OSCC) patients vs. controls |
| Organism | Oral microbiome (human) |
| Omics layers | 16S amplicon (MiSeq) + MP; **no shotgun MG, no MT** |
| SRA experiments | 68 |
| Data volume | ~10 GB |
| Conditions | Control vs. OSCC with resection (L0) vs. OSCC without resection (L1) |
| Key publication | Granata et al. (2021) |
| Strengths | Human host; disease context; small dataset size (fast to run); three clinical groups |
| Weaknesses | Only amplicon + MP — excludes most of the metro-map (no mag/taxprofiler/metatdenovo) |

### Additional datasets to search (open)

A systematic PubMed + bioRxiv search was run (June 2026) using `lit-synthesizer`. Recurring
themes across 11 retrieved papers: integration frameworks (gNOMO2, MetaPUF), gut microbiome
dysbiosis, IBD, T1DM, standardised multi-omics workflows. Key finding: **no published
host-related dataset with all 4 omics layers was identified** — PRJNA230567 (wastewater)
remains the only confirmed 4-omics public dataset. Further search targets:

- IBD multi-omics studies (UCSD/Rob Knight group, HMP2 / iHMP)
- iHMP (integrative Human Microbiome Project) — PRJNA398945 / PRJEB27928; may have MG + MT + MP
- EBI MGnify / PRIDE cross-linked studies (MetaPUF workflow datasets)
- Any post-2022 human gut study combining 16S + shotgun MG + MT

> **Tool note:** `lit-synthesizer` + PubMed MCP were used for this search. `ncbi-datasets`
> CLI was not available in this environment — use `conda install -c conda-forge ncbi-datasets-cli`
> then run `datasets summary genome bioproject PRJNA230567 --as-json-lines` for genome metadata.

---

## Dataset Decision Matrix

Score 0–3 per criterion. **Open — not yet decided.**

| Criterion | Weight | PRJNA682552 | PRJNA693457 | MetaGT (HumanGut) | Rausch 2019 | PRJNA230567 | PRJNA289586 | PRJNA700849 |
|-----------|--------|-------------|-------------|-------------------|-------------|-------------|-------------|-------------|
| 4-omics coverage (amplicon + MG + MT + MP) | 3× | 3 | 3 | 1 | 1 | **3** | 2 | 1 |
| Host-related / clinically relevant | 2× | 0 | 0 | 2 | 3 | 0 | **3** | **3** |
| Biological replicates (≥3 per condition) | 2× | 3 | 3 | 1 | 2 | **3** | 1 | 2 |
| Data recency (post-2021 preferred) | 1× | 1 | 1 | 2 | 1 | 1 | 0 | 2 |
| Community complexity | 1× | 1 | 2 | 3 | 3 | 2 | **3** | 2 |
| **Weighted total** | | **17** | **18** | **14** | **17** | **18** | **17** | **17** |

Scoring key — 4-omics: 3=all 4 layers, 2=3 layers, 1=1-2 layers. Host-related: 3=human clinical, 2=animal/indirect, 0=environmental. Replicates: 3=≥5/condition, 2=3-4, 1=1-2. Recency: 2=2021-2022, 1=2018-2020, 0=pre-2018. Complexity: 3=human gut, 2=moderate, 1=low.

> **Updated finding (lit-synthesizer search, June 2026):** PRJNA230567 (Herold wastewater)
> is the highest-scoring single dataset and the **only confirmed public dataset with all
> 4 omics layers** — but is environmental. PRJNA289586 (Heintz-Buschart T1DM) and
> PRJNA700849 (oral cancer) score equally well on host-relevance but lack one or more
> omics layers. The fundamental tension — 4-omics coverage vs. host context — remains
> unresolved. **Recommended path:** PRJNA230567 as the primary benchmark (maximises
> pipeline coverage) + PRJNA289586 as a host-related companion dataset for the gut /
> disease narrative. Flag to SIG before committing.

---

## Proposed Pipeline Chain (Subject to Dataset Decision)

The following chain assumes a dataset with the full 4-omics stack (e.g. PRJNA693457).
Edges marked [UNVALIDATED] are metro-map claims not yet confirmed by actual samplesheet
handoff testing.

```
fetchngs (SRA accessions)
  └─► detaxizer (remove host reads, if host-related data) [UNVALIDATED]
        ├─► ampliseq (amplicon reads → taxonomy profiles) [UNVALIDATED]
        │     └─► differentialabundance (profiles, condition comparison) [UNVALIDATED]
        ├─► createtaxdb (build custom reference DB) [UNVALIDATED]
        │     └─► taxprofiler (shotgun MG reads → taxonomy profiles) [UNVALIDATED]
        │           └─► differentialabundance [UNVALIDATED]
        ├─► mag (shotgun MG reads → MAGs/contigs) [UNVALIDATED]
        │     ├─► magmap (MAGs → read abundance profiles) [UNVALIDATED]
        │     ├─► funcscan (contigs → functional annotation) [UNVALIDATED]
        │     ├─► phageannotator (contigs → phage annotation) [UNVALIDATED]
        │     ├─► phyloplace (contigs → phylogenetic placement) [UNVALIDATED]
        │     └─► metapep / proteinfamilies / proteinfold (predicted proteins) [UNVALIDATED]
        ├─► viralmetagenome (shotgun MG reads → viral contigs) [UNVALIDATED]
        └─► metatdenovo (shotgun MT reads → metatranscriptome assembly) [UNVALIDATED]
```

### Core chain (high confidence, data-driven)
fetchngs → detaxizer → [ampliseq | taxprofiler | mag | metatdenovo]

### Stretch nodes (additional omics layers or heavy compute)
- eager: for ancient DNA preprocessing — likely out of scope for modern environmental/clinical data
- proteinfold: computationally expensive; optional stretch goal
- viralmetagenome: only meaningful if viral fraction is a study focus

### Supporting tools at key chain points
- After `mag` / `metatdenovo`: run the [ClawBio `busco-assessor` skill](https://github.com/ClawBio/ClawBio/tree/main/skills/busco-assessor)
  to evaluate MAG and transcript completeness (genome, transcriptome, or protein modes).
- After any full pipeline run: use the [ClawBio `multiqc-reporter` skill](https://github.com/ClawBio/ClawBio/tree/main/skills/multiqc-reporter)
  to aggregate QC outputs from all tools into a single MultiQC HTML report.
- For exploratory or validation runs: the [ClawBio `claw-metagenomics` skill](https://github.com/ClawBio/ClawBio/tree/main/skills/claw-metagenomics)
  runs Kraken2 → Bracken → HUMAnN3 on raw FASTQ and can sanity-check taxonomy outputs
  independently of the nf-core chain (not a replacement for taxprofiler/mag).

---

## Samplesheet Chaining — Validation Table

Each edge in the chain is a claim to be tested. Status tracked here.

| From | To | Samplesheet handoff mechanism | Status |
|------|----|-------------------------------|--------|
| fetchngs | detaxizer | fetchngs outputs nf-core FASTQ samplesheet | OPEN |
| fetchngs | ampliseq | fetchngs outputs nf-core FASTQ samplesheet | OPEN |
| fetchngs | taxprofiler | fetchngs outputs nf-core FASTQ samplesheet | OPEN |
| fetchngs | mag | fetchngs outputs nf-core FASTQ samplesheet | OPEN |
| fetchngs | metatdenovo | fetchngs outputs nf-core FASTQ samplesheet | OPEN |
| detaxizer | ampliseq | detaxizer filtered FASTQ → ampliseq samplesheet | OPEN |
| detaxizer | taxprofiler | detaxizer filtered FASTQ → taxprofiler samplesheet | OPEN |
| detaxizer | mag | detaxizer filtered FASTQ → mag samplesheet | OPEN |
| createtaxdb | taxprofiler | db output path referenced in taxprofiler params | OPEN |
| mag | funcscan | MAG/contig FASTA → funcscan input | OPEN |
| mag | phageannotator | contig FASTA → phageannotator input | OPEN |
| mag | phyloplace | contig FASTA → phyloplace input | OPEN |
| mag | magmap | MAG FASTA → magmap reference input | OPEN |
| mag | metapep / proteinfamilies / proteinfold | predicted proteins FASTA → input | OPEN |
| taxprofiler | differentialabundance | abundance profile → differentialabundance input | OPEN |
| ampliseq | differentialabundance | QIIME2/BIOM profile → differentialabundance input | OPEN |
| magmap | differentialabundance | coverage profiles → differentialabundance input | OPEN |

---

## Roadmap

| Phase | Tasks | Tools | Status |
|-------|-------|-------|--------|
| 0 — Dataset decision | Extend search; score against matrix; SIG vote | `lit-synthesizer`, `ncbi-datasets` | OPEN |
| 1 — Scaffold | fetchngs run; verify raw data availability; build reference DBs | `ncbi-datasets` (reference genomes) | OPEN |
| 2 — Core chain | detaxizer → ampliseq / taxprofiler / mag / metatdenovo | `claw-metagenomics` (validation runs) | OPEN |
| 2a — Assembly QC | Assess MAG and transcript completeness | `busco-assessor` | OPEN |
| 3 — Samplesheet handoffs | Test and document each edge in the validation table | — | OPEN |
| 4 — Secondary analysis | differentialabundance; funcscan; phageannotator; phyloplace | — | OPEN |
| 5 — Stretch nodes | metapep; proteinfamilies; viralmetagenome | — | OPEN |
| 5a — QC aggregation | Aggregate QC across all pipeline runs | `multiqc-reporter` | OPEN |
| 6 — Publication | Write-up; confirm authorship; submit to nf-core community journal | `lit-synthesizer` (related work section) | OPEN |

---

## Open Questions

1. Can we find a host-related dataset (human gut, IBD, etc.) with all four omics layers
   AND modern replicates? This is the highest-priority search task. Run `lit-synthesizer`
   before the next SIG meeting to triage the literature systematically.
2. Is a two-dataset strategy acceptable for the publication (e.g. PRJNA693457 for full
   omics coverage + MetaGT HumanGut for host-relevance narrative)?
3. Which samplesheet chaining edges already work out-of-the-box vs. require new
   nf-core module work? (Needs testing in Phase 3.)
4. How should eager fit in, if at all? It is designed for ancient/degraded DNA and
   may not belong in a modern environmental/clinical workflow.
5. What is the minimum viable chain for a first publication? Core chain only?
6. Does metaproteomics data processing fit within existing nf-core pipelines, or is
   metapep/proteinfamilies the proxy for the MP layer?
