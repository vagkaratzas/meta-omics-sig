# Meta-Omics End-to-End Use Case — Implementation Plan

## Problem Statement

The nf-core meta-omics SIG maintains a "metro map" showing how its pipelines could chain
together across data types and analysis stages. It is a roadmap of intended synergy — the
edges indicate potential routes, not guarantees that a handoff works today. Turning that
roadmap into a travelled route means someone has to walk it end to end on real data. This
project does that, and feeds what it learns back to the pipelines. It will:

1. Select a real, public multi-omics dataset
2. Run it through as many metro-map pipelines as data layers allow
3. Document every samplesheet handoff — what works today, what needs a bridge, and what
   the bridge is
4. Contribute the resulting bug reports, feature requests and reusable converters upstream
5. Publish the workflow and findings as an nf-core community paper

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
| metapep / proteinfamilies | Predicted proteins (FASTA), downstream of MAG/assembly |
| proteinfold | Representative sequences emitted by proteinfamilies |
| funcscan / phageannotator / phyloplace | Assembled contigs or MAG FASTA |
| differentialabundance | Abundance profiles, requires ≥2 conditions with replicates |

A dataset missing any layer reduces the pipelines reachable. Dataset selection is
therefore the gating decision.

> **Metaproteomics (MP) is out of scope.** The nf-core meta-omics SIG has no pipeline
> that consumes mass-spec metaproteomic data. `metapep` / `proteinfamilies` /
> `proteinfold` take *predicted* protein FASTA downstream of MAG/assembly — they do not
> need an MP layer. MP availability is therefore no longer a dataset selection criterion
> and PRIDE accessions are ignored for now.

> **Hard requirement (SIG decision):** a candidate must provide **all three** of
> amplicon + shotgun MG + shotgun MT. Candidates missing any of the three are excluded
> from selection regardless of score.

---

## Dataset Candidates and Decision Matrix

Moved to **[DATASETS.md](DATASETS.md)** — eight candidate datasets with accessions, omics
layers, strengths/weaknesses, and the weighted scoring matrix (including the
amplicon + MG + MT gate applied above).

**Current status:** open — not yet decided. Four candidates pass the gate; LMO is the
working recommendation pending SIG sign-off and resolution of its metadata discrepancy.

---

## Proposed Pipeline Chain (Subject to Dataset Decision)

The following chain assumes a dataset passing the three-layer gate — amplicon + MG + MT
(e.g. LMO or PRJNA693457). Edges marked [UNTESTED] are potential routes from the metro map
that we have not yet exercised on real data.

```
fetchngs (SRA accessions)
  └─► detaxizer (remove host reads, if host-related data) [UNTESTED — NOT RUN FOR LMO]
        ├─► ampliseq (amplicon reads → taxonomy profiles) [UNTESTED]
        │     └─► differentialabundance (profiles, condition comparison) [UNTESTED]
        ├─► createtaxdb (build custom reference DB) [UNTESTED]
        │     └─► taxprofiler (shotgun MG reads → taxonomy profiles) [UNTESTED]
        │           └─► differentialabundance [UNTESTED]
        ├─► mag (shotgun MG reads → MAGs/contigs) [UNTESTED]
        │     ├─► seqsubmit (MAGs/bins → ENA accessions) [NOT IN METRO MAP]
        │     ├─► magmap (MAGs → read abundance profiles) [UNTESTED]
        │     ├─► funcscan (contigs → functional annotation) [UNTESTED]
        │     ├─► phageannotator (contigs → phage annotation) [UNTESTED]
        │     ├─► phyloplace (contigs → phylogenetic placement) [UNTESTED]
        │     └─► metapep / proteinfamilies (predicted proteins) [UNTESTED]
        │           └─► proteinfold (family representatives → structures) [UNTESTED]
        ├─► viralmetagenome (shotgun MG reads → viral contigs) [UNTESTED]
        │     ├─► phageannotator (viral contigs + reads → phage annotation) [UNTESTED]
        │     └─► phyloplace (viral contigs → placement on a reference tree) [UNTESTED]
        └─► metatdenovo (shotgun MT reads → metatranscriptome assembly) [UNTESTED]
              └─► proteinfamilies (prodigal .faa.gz → protein families) [NOT IN METRO MAP]
```

> The `metatdenovo → proteinfamilies` branch is not yet on the metro map. It is included
> here because metatdenovo is the only pipeline in the chain that emits protein FASTA
> directly, which makes it the shortest schema-compatible route into the protein nodes —
> a candidate addition to propose to the SIG.

> `mag → seqsubmit` is not on the metro map either — seqsubmit 1.0.0 was released on
> 2026-08-04, after the map was drawn. It is the chain's only exit back to the archive:
> everything else consumes ENA data, this one deposits into it.

### Core chain (high confidence, data-driven)
fetchngs → [ampliseq | taxprofiler | mag | metatdenovo]

detaxizer is omitted from the LMO core chain — no host, so nothing to remove. It re-enters
the chain for the first host-related dataset, where it also unlocks a test of its native
`--generate_downstream_samplesheets` emitter.

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

Each edge is a potential route. This table records what we have exercised, what works
today, and where a bridge is needed — so that the bridges can be built, contributed
upstream, or shipped as reusable converters.

> **Evidence (fetchngs 1.12.0, `nextflow_schema.json`, checked 2026-08-10):**
> `--nf_core_pipeline` accepts `rnaseq`, `atacseq`, `viralrecon`, `taxprofiler`. Three of
> the four core-chain entry points — ampliseq, mag, metatdenovo — are not yet covered by
> it, so reaching them from the generic `samplesheet.csv` needs a conversion step. The
> conversion is small (column rename/subset), and extending the `--nf_core_pipeline` enum
> would remove it for a lot of users: a good feature request, filed as such.

> **Candidate new edge — `metatdenovo → proteinfamilies` (schemas checked 2026-08-10,
> handoff executed 2026-08-11):** not yet on the metro map, and worth adding — the case is
> now a run rather than a schema reading: metatdenovo's 198,252 predicted proteins were
> handed to proteinfamilies 2.5.0 through a generated one-row samplesheet, which the
> pipeline accepted. metatdenovo 1.4.0 with
> `--orf_caller prodigal` publishes `prodigal/<assembly>.faa.gz`; proteinfamilies 2.5.0
> accepts `.fa|.fasta|.faa|.fas` (± `.gz`), so the protein FASTA transfers with no
> reformatting — only a one-row `sample,fasta` samplesheet. The mapped route,
> `mag → proteinfamilies`, needs one more piece: mag does not itself emit protein FASTA,
> so an ORF-calling step belongs between those two stations. The ORF caller is decisive:
> `transdecoder` publishes `*.transdecoder.pep.gz`, and `.pep` is not in proteinfamilies'
> accepted extensions — a one-line schema addition upstream would make that route work
> too.

> **Candidate new edge — `mag → seqsubmit` (schemas checked 2026-08-11):** nf-core/seqsubmit
> 1.0.0 (released 2026-08-04) submits reads, metagenomic assemblies, MAGs and bins to ENA,
> and it is the only pipeline in the chain that closes the loop back to the archive
> `fetchngs` pulls from. In `mags`/`bins` mode it takes gzipped MAG FASTA, which is what mag
> emits, so the *files* transfer unchanged. The row around each file is the work:
> `accession` (the ENA run or assembly the MAG derives from), `assembly_software` and
> `binning_software` with versions, `binning_parameters`, and four ENVO/MIxS environment
> fields — `metagenome`, `broad_environment`, `local_environment`, `environmental_medium`.
> None of that is in mag's output. A converter can fill the software and accession columns
> from run provenance the chain already has; the environment terms are a per-dataset human
> judgement. `completeness`/`contamination` are optional — seqsubmit recomputes them with
> CheckM2 when absent. Two further prerequisites: `ENA_WEBIN`/`ENA_WEBIN_PASSWORD` as
> Nextflow secrets, and the source reads or assembly already deposited (seqsubmit's own
> `reads` and `metagenomic_assemblies` modes do that step). Submitting MAGs built from
> public LMO reads is legitimate — they are new derived records with their own accessions —
> and `--upload_tpa` exists to flag third-party assemblies.

> **detaxizer already ships a downstream samplesheet generator — a pattern worth
> propagating** (detaxizer 1.3.0 `nextflow_schema.json`, checked 2026-08-10). It exposes
> `--generate_downstream_samplesheets`, with `--generate_pipeline_samplesheets` defaulting
> to `taxprofiler,mag` and constrained by
> `^(taxprofiler|mag)(?:,(taxprofiler|mag)){0,1}`. This is the clearest existing example
> in the chain of a pipeline handing its successor a ready-made input, and it shows the
> mechanism already works. Generalising it — more source pipelines, more targets — is
> probably the single highest-leverage improvement available to inter-pipeline chaining
> in this SIG, and it is worth raising as a cross-pipeline proposal rather than as
> individual issues.
>
> Two limits of that generator: the regex admits at most two pipelines and excludes
> `ampliseq` and `metatdenovo` entirely, so those edges still need conversion. And
> detaxizer's own `--input` schema is
> `sample, short_reads_fastq_1, short_reads_fastq_2, long_reads_fastq_1` — not
> `sample, fastq_1, fastq_2` — so `fetchngs → detaxizer` needs a conversion too.
>
> **Scope decision (2026-08-10):** detaxizer is **not run for the LMO pilot.** LMO is
> Baltic brackish seawater with no host, `tax2filter` defaults to *Homo sapiens*, and
> filtering before a metatranscriptome co-assembly risks removing conserved or
> low-complexity reads for no expected biological gain. Deferred to a future
> host-related dataset (human gut is the obvious candidate) where the step has biological
> meaning as well as validation value. Its statuses above are recorded from schemas, not
> from a run.

> **Conversion scripts:** the conversions this table calls for live in
> `scripts/converters/`, each with an assert-based `--selftest`. They are the deliverable
> that turns "CONVERSION REQUIRED" from a finding into a working handoff.

> **Reading the Status column:** the status itself is the **mechanism** — whether the
> upstream pipeline hands its successor a ready-made samplesheet (OPEN, pending
> verification) or a converter has to sit between them (CONVERSION REQUIRED). Running the
> chain never changes that: a handoff that needed a converter still needs one afterwards.
> Execution is recorded as a separate **exercised `<date>`** clause, which says a real run
> consumed the handed-over file. On the metro map the mechanism is the edge colour and
> execution is the moving dot, so the two never overwrite each other.

| From | To | Samplesheet handoff mechanism | Status |
|------|----|-------------------------------|--------|
| fetchngs | detaxizer | generic `samplesheet.csv`; no `--nf_core_pipeline` support, and detaxizer's columns are `short_reads_fastq_1/2`, not `fastq_1/2` | **CONVERSION REQUIRED** |
| fetchngs | ampliseq | generic `samplesheet.csv`; **no `--nf_core_pipeline` option** | **CONVERSION REQUIRED** |
| fetchngs | taxprofiler | `--nf_core_pipeline taxprofiler` emits a purpose-built samplesheet | OPEN — flag exists, output not yet verified |
| fetchngs | mag | generic `samplesheet.csv`; **no `--nf_core_pipeline` option** | **CONVERSION REQUIRED** |
| fetchngs | metatdenovo | generic `samplesheet.csv`; **no `--nf_core_pipeline` option** | **CONVERSION REQUIRED** — exercised 2026-08-11 via `scripts/converters/fetchngs_to_reads_samplesheet.py`; metatdenovo 1.4.0 ran to completion on the converted sheet |
| **fetchngs** | **viralmetagenome** | generic `samplesheet.csv`; **no `--nf_core_pipeline` option**; wants `sample,fastq_1[,fastq_2]` — the same shape metatdenovo takes | **CONVERSION REQUIRED** — existing converter covers it unchanged |
| detaxizer | ampliseq | filtered FASTQ → ampliseq samplesheet; **excluded** from `--generate_pipeline_samplesheets` | **CONVERSION REQUIRED** |
| detaxizer | taxprofiler | `--generate_downstream_samplesheets` emits a taxprofiler samplesheet natively | OPEN — native emitter exists, output not yet verified |
| detaxizer | mag | `--generate_downstream_samplesheets` emits a mag samplesheet natively | OPEN — native emitter exists, output not yet verified |
| createtaxdb | taxprofiler | db output path referenced in taxprofiler params | OPEN |
| **mag** | **seqsubmit** | MAG/bin FASTA → `--mode mags\|bins` (`schema_input_genome.json`); gzipped FASTA transfers unchanged | **CONVERSION REQUIRED** — metadata, not just columns |
| mag | funcscan | MAG/contig FASTA → funcscan input | OPEN |
| mag | phageannotator | contig FASTA → phageannotator input | OPEN |
| mag | phyloplace | contig FASTA → phyloplace input | OPEN |
| mag | magmap | MAG FASTA → magmap reference input | OPEN |
| mag | metapep / proteinfamilies | predicted proteins FASTA → input | OPEN |
| **metatdenovo** | **proteinfamilies** | `--orf_caller prodigal` publishes `prodigal/<assembly>.faa.gz`, an extension proteinfamilies accepts | **CONVERSION REQUIRED** — one-row samplesheet, no reformatting; exercised 2026-08-11, 198,252 proteins accepted by proteinfamilies 2.5.0 |
| **viralmetagenome** | **phageannotator** | viral contig FASTA → input, but the sheet also wants `group` and `fastq_1` | **CONVERSION REQUIRED** — two-source join, and `.combined.fa` is not gzipped |
| **viralmetagenome** | **phyloplace** | viral contig FASTA → `queryseqfile` | **CONVERSION REQUIRED** — `refseqfile`, `refphylogeny`, `model` are external per-row inputs |
| proteinfamilies | proteinfold | representative sequence per family → protein FASTA input | OPEN |
| taxprofiler | differentialabundance | abundance profile → differentialabundance input | OPEN |
| ampliseq | differentialabundance | QIIME2/BIOM profile → differentialabundance input | OPEN |
| magmap | differentialabundance | coverage profiles → differentialabundance input | OPEN |

---

## Roadmap

| Phase | Tasks | Tools | Status |
|-------|-------|-------|--------|
| 0 — Dataset decision | Extend search; score against the matrix in [DATASETS.md](DATASETS.md); SIG vote | `lit-synthesizer`, `ncbi-datasets` | OPEN |
| 1 — Scaffold | fetchngs run; verify raw data availability; build reference DBs | `ncbi-datasets` (reference genomes) | OPEN |
| 2 — Core chain | ampliseq / taxprofiler / mag / metatdenovo (detaxizer deferred — no host in LMO) | `claw-metagenomics` (validation runs) | OPEN |
| 2a — Assembly QC | Assess MAG and transcript completeness | `busco-assessor` | OPEN |
| 3 — Samplesheet handoffs | Test and document each edge in the validation table | — | OPEN |
| 4 — Secondary analysis | differentialabundance; funcscan; phageannotator; phyloplace | — | OPEN |
| 5 — Stretch nodes | metapep; proteinfamilies; viralmetagenome | — | OPEN |
| 5a — QC aggregation | Aggregate QC across all pipeline runs | `multiqc-reporter` | OPEN |
| 6 — Publication | Write-up; confirm authorship; submit to nf-core community journal | `lit-synthesizer` (related work section) | OPEN |

---

## Open Questions

1. Can we find a host-related dataset (human gut, IBD, etc.) that passes the three-layer
   gate (amplicon + MG + MT) AND has modern replicates? Highest-priority search task —
   every selectable candidate today is environmental. Run `lit-synthesizer` before the
   next SIG meeting to triage the literature systematically.
2. Is a two-dataset strategy acceptable for the publication (e.g. LMO for the full
   three-layer chain + MetaGT HumanGut for host-relevance narrative)?
3. Which samplesheet chaining edges already work out-of-the-box vs. require new
   nf-core module work? (Needs testing in Phase 3.)
4. How should eager fit in, if at all? It is designed for ancient/degraded DNA and
   may not belong in a modern environmental/clinical workflow.
5. What is the minimum viable chain for a first publication? Core chain only?
6. ~~Does metaproteomics data processing fit within existing nf-core pipelines?~~
   **RESOLVED (2026-08-10):** no. The SIG has no pipeline consuming mass-spec MP data.
   MP is out of scope; `metapep` / `proteinfamilies` / `proteinfold` run on proteins
   predicted from MAGs, and PRIDE accessions are dropped from dataset scoring.
7. If LMO is selected: which MT chemistry is primary — rRNA-depleted (PRJEB69280) or
   polyA (PRJEB90631/PRJEB90671)? Running both is a defensible methods comparison for
   `metatdenovo` but doubles Phase 2 compute.
8. If LMO is selected: restrict to the 26 all-3-omics matched dates, or use all 44
   amplicon dates and accept ragged layer coverage? Matched-only is cleaner for
   samplesheet-handoff validation.
9. **Carried forward to the first host-related dataset:** run detaxizer and test
   `--generate_downstream_samplesheets` against taxprofiler and mag. It is the only
   pipeline in the chain found so far that emits downstream samplesheets natively, so
   whether those sheets are accepted unmodified is the sharpest available test of
   nf-core samplesheet standardisation. Deferred from the LMO pilot for lack of a host,
   not for lack of interest.
