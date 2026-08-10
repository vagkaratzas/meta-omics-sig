# Dataset Candidates and Decision Matrix

Candidate datasets for the meta-omics SIG end-to-end use case, and the scoring matrix used
to compare them. Selection constraints (the three-layer gate, MP scope) are defined in
**[PLAN.md](PLAN.md)** — read that first. Roadmap and open questions also live in PLAN.md.

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
| Strengths | Passes the three-layer gate; strong replicate design (5/condition); well-published by the Wilmes lab (the MP layer is no longer a scoring advantage) |
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

### Candidate 8 — LMO Linnaeus Microbial Observatory (Baltic Sea time series)

Proposed by Daniel Lundin (SIG member, nf-core/metatdenovo maintainer); data submitted by
his group.

| Property | Value |
|----------|-------|
| Accessions | 16S: PRJEB52780, PRJEB52782, PRJEB52828 · MG: PRJEB82694 · MT (rRNA-depleted): PRJEB69280 · MT (polyA): PRJEB90631 (2017), PRJEB90671 (2016) |
| Environment | Brackish surface water (2 m), Linnaeus Microbial Observatory, Baltic Sea off Öland, Sweden (56.9309 N, 17.0607 E) |
| Organism | Natural brackish marine microbial community |
| Omics layers | 16S amplicon + Illumina NovaSeq shotgun MG + HiSeq MT (both rRNA-depleted and polyA); **no MP** (none in PRIDE — now out of scope) |
| Time span | 2015-09-29 → 2017-12-12, ~biweekly time series |
| Filter fractions | 0.2 (free-living, no prefilter), 3–0.2 (prefiltered), 3 (particle-associated) — amplicon only; MG and MT are 0.2 exclusively |
| Sample counts (ENA, 0.2 fraction) | 16S 13 + 19 + 12 = 44 dates · MG 26 samples / 26 dates · MT 64 runs / 33 dates (31 dates ×2 replicates) |
| **Matched all-3-omics dates** | **26** (amplicon 0.2 ∩ MG ∩ MT); MG date set ⊂ MT date set |
| Data volume | ~235 GB (~366 GB including polyA MT) |
| Conditions | Seasonal / longitudinal — supports differentialabundance via season or bloom-phase contrasts |
| Strengths | All three required layers on the **same water sample** for 26 dates; SIG-internal data owner (metadata questions resolvable same-day); 6× smaller than PRJNA230567; MT has 2 replicates per date; two independent MT chemistries usable as a methods comparison |
| Weaknesses | Environmental (not host-related); no MP (moot); sampled 2015–2017; time series rather than a factorial replicate design |

> **Metadata caveat (open, 2026-08-10):** in PRJEB82694 the immutable `sample_alias`
> dates disagree with `collection_date` / `sample_title` for 23 of 26 samples (Daniel
> issued a correction after submission; aliases cannot be re-written in ENA). Alias dates
> run chronologically with library numbers `P14909_101..132`; the corrected
> `collection_date` values are a permutation of that ordering. **Any samplesheet built
> for this dataset must key on `collection_date`, not `sample_alias`.** Independent ENA
> counts also do not reproduce Daniel's tally (his: 8 / 29 / 14 / 51 / 51 across the five
> accessions, totalling 51 selected dates; ENA gives 13 / 19 / 12 / 26 / 33-dates and a
> 46-date union). Resolve with Daniel before Phase 1.

### Additional datasets to search (open)

A systematic PubMed + bioRxiv search was run (June 2026) using `lit-synthesizer`. Recurring
themes across 11 retrieved papers: integration frameworks (gNOMO2, MetaPUF), gut microbiome
dysbiosis, IBD, T1DM, standardised multi-omics workflows. Key finding: **no published
host-related dataset carrying amplicon + MG + MT was identified.** Further search targets
(MP-linked targets dropped now that MP is out of scope):

- IBD multi-omics studies (UCSD/Rob Knight group, HMP2 / iHMP)
- iHMP (integrative Human Microbiome Project) — PRJNA398945 / PRJEB27928; may have MG + MT
- Any post-2022 human gut study combining 16S + shotgun MG + MT — the single highest-value
  find would be a host-related candidate that passes the three-layer gate

> **Tool note:** `lit-synthesizer` + PubMed MCP were used for this search. `ncbi-datasets`
> CLI was not available in this environment — use `conda install -c conda-forge ncbi-datasets-cli`
> then run `datasets summary genome bioproject PRJNA230567 --as-json-lines` for genome metadata.

---

## Dataset Decision Matrix

Score 0–3 per criterion. **Open — not yet decided.**

Gate applied first: a candidate must carry amplicon + MG + MT. Candidates failing the
gate are scored for the record but are **not selectable**.

| Criterion | Weight | PRJNA682552 | PRJNA693457 | MetaGT (HumanGut) | Rausch 2019 | PRJNA230567 | PRJNA289586 | PRJNA700849 | **LMO** |
|-----------|--------|-------------|-------------|-------------------|-------------|-------------|-------------|-------------|---------|
| **Gate: amplicon + MG + MT** | — | ✅ | ✅ | ❌ no amplicon | ❌ no MT | ✅ | ❌ no amplicon | ❌ MG, MT | ✅ |
| 3-omics coverage (amplicon + MG + MT) | 3× | 3 | 3 | 2 | 2 | **3** | 2 | 1 | **3** |
| Host-related / clinically relevant | 2× | 0 | 0 | 2 | 3 | 0 | **3** | **3** | 0 |
| Biological replicates (≥3 per condition) | 2× | 3 | 3 | 1 | 2 | **3** | 1 | 2 | **3** |
| Data recency (post-2021 preferred) | 1× | 1 | 1 | 2 | 1 | 1 | 0 | 2 | 1 |
| Community complexity | 1× | 1 | 2 | 3 | 3 | 2 | **3** | 2 | 2 |
| **Weighted total** | | **17** | **18** | 17 | 20 | **18** | 17 | 17 | **18** |
| **Selectable** | | yes | yes | no | no | yes | no | no | **yes** |

Scoring key — 3-omics: 3=all 3 layers, 2=2 layers, 1=1 layer. Host-related: 3=human clinical, 2=animal/indirect, 0=environmental. Replicates: 3=≥5/condition or ≥20 matched timepoints, 2=3-4, 1=1-2. Recency: 2=2021-2022, 1=2018-2020, 0=pre-2018. Complexity: 3=human gut, 2=moderate, 1=low.

> **Note:** Rausch 2019 scores highest overall (20) purely on host-relevance but fails the
> gate — no MT. The gate, not the score, is decisive.

> **Updated finding (2026-08-10):** dropping MP from the criteria collapses the
> selectable field to four candidates tied or near-tied at 17–18: PRJNA682552 (17),
> PRJNA693457 (18), PRJNA230567 (18), LMO (18). All four are environmental — **no
> host-related dataset with amplicon + MG + MT has been found**, so the host-context
> criterion currently discriminates nothing among selectable options and the tie must be
> broken on practical grounds:
>
> | | PRJNA693457 (Culture BP) | PRJNA230567 (Herold) | LMO |
> |---|---|---|---|
> | Data volume | moderate | **1.5 TB** | **~235 GB** |
> | Matched all-3-omics samples | 2 conditions × 3 repl | seasonal, 5 repl/condition | **26 matched dates** |
> | Community complexity | low (enrichment culture) | moderate | moderate |
> | Metadata support | external, 2021 paper | external, Wilmes lab | **SIG-internal (D. Lundin)** |
> | Known metadata risk | — | — | alias/collection_date conflict, unresolved count mismatch |
>
> **Recommended path:** LMO as primary benchmark — cheapest to run, densest matched
> multi-omics design, and the only candidate whose data owner is in the SIG, which
> directly de-risks Phase 3 samplesheet debugging. Keep PRJNA230567 as fallback if the
> LMO metadata discrepancy cannot be resolved. Host-relevance stays an open search task
> (see [PLAN.md § Open Questions](PLAN.md#open-questions)), not a blocker.
> **Flag to SIG before committing.**

