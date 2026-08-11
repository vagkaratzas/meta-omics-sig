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
| proteinfold / proteinannotator | Representative sequences emitted by proteinfamilies |
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
  └─► detaxizer (remove contaminant reads — phiX spike-in for LMO, host for host data) [PREPARED, RUN 04]
        ├─► ampliseq (amplicon reads → taxonomy profiles) [UNTESTED]
        │     └─► differentialabundance (profiles, condition comparison) [UNTESTED]
        ├─► createtaxdb (build custom reference DB) [UNTESTED]
        │     └─► taxprofiler (shotgun MG reads → taxonomy profiles) [UNTESTED]
        │           └─► differentialabundance [UNTESTED]
        ├─► mag (shotgun MG reads → MAGs/contigs) [UNTESTED]
        │     ├─► seqsubmit (MAGs/bins → ENA accessions) [UNTESTED]
        │     ├─► magmap (MAGs → read abundance profiles) [UNTESTED]
        │     ├─► funcscan (contigs → functional annotation) [UNTESTED]
        │     ├─► phageannotator (contigs → phage annotation) [UNTESTED]
        │     ├─► phyloplace (contigs → phylogenetic placement) [UNTESTED]
        │     └─► metapep / proteinfamilies (predicted proteins) [UNTESTED]
        ├─► viralmetagenome (shotgun MG reads → viral contigs) [UNTESTED]
        │     ├─► phageannotator (viral contigs + reads → phage annotation) [UNTESTED]
        │     └─► phyloplace (viral contigs → placement on a reference tree) [UNTESTED]
        └─► metatdenovo (shotgun MT reads → metatranscriptome assembly) [RUN 2026-08-11]
              └─► proteinfamilies (prodigal .faa.gz → protein families) [RUN 2026-08-11]
                    ├─► proteinfold (representatives → structures) [SHEET EMITTED, NOT CONSUMED]
                    └─► proteinannotator (representatives → annotation) [SHEET EMITTED, NOT CONSUMED]
```

> **Metro map, updated 2026-08-11.** Two branches that this document previously flagged as
> `[NOT IN METRO MAP]` are now drawn on it, and the map gained a fourth stage:
>
> - `metatdenovo → proteinfamilies` — proposed to the SIG off the back of the run 03
>   handoff and accepted. metatdenovo now feeds the shared `fasta` interchange that the
>   protein stations hang off. It is still the only pipeline in the chain that emits
>   protein FASTA directly, which is what made it the shortest schema-compatible route in.
> - `mag → seqsubmit` — seqsubmit 1.0.0 was released 2026-08-04, after the previous map was
>   drawn; it now sits in a new **4. Data upload** stage. It is the chain's only exit back
>   to the archive: everything else consumes ENA data, this one deposits into it.
> - `detaxizer → createtaxdb` is **no longer drawn.** The new map feeds createtaxdb from the
>   reference-FASTA input instead, which matches createtaxdb 3.1.0's documented contract
>   (`id`, `taxid`, `fasta_dna`/`fasta_aa` — not filtered reads). The inconsistency raised
>   for SIG review on 2026-08-10 is therefore resolved in the map's favour.
> - **`proteinfold` is no longer a station on the map**, but stays in scope here and on the
>   project site as a stretch node — it is reached from proteinfamilies, which emits its
>   samplesheet natively (see the validation table). `proteinannotator` is new to this
>   document for the same reason; it is not on the map either.

### Core chain (high confidence, data-driven)
fetchngs → [ampliseq | taxprofiler | mag | metatdenovo]

detaxizer was omitted from the LMO core chain on 2026-08-10 — no host, so nothing to remove.
Revised 2026-08-11: it re-enters as **run 04** with phiX rather than *Homo sapiens* as the
contaminant, which is a filter with a downstream consequence and no biological risk, and
which also unlocks the first test of its native `--generate_downstream_samplesheets` emitter
without waiting for a host-related dataset. Human decontamination remains deferred; see the
scope-decision note in the validation table below.

### Stretch nodes (additional omics layers or heavy compute)
- eager: for ancient DNA preprocessing — likely out of scope for modern environmental/clinical data
- proteinfold: computationally expensive; optional stretch goal. Off the metro map since
  2026-08-11, kept in scope — its input samplesheet already exists, emitted by run 03
- proteinannotator: InterProScan-style sequence annotation of the same family
  representatives; cheaper than proteinfold and its samplesheet also already exists
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

> **New edge — `metatdenovo → proteinfamilies` (schemas checked 2026-08-10,
> handoff executed 2026-08-11, added to the metro map 2026-08-11):** the case was
> a run rather than a schema reading: metatdenovo's 198,252 predicted proteins were
> handed to proteinfamilies 2.5.0 through a generated one-row samplesheet, which the
> pipeline accepted and ran to completion on, producing 405 families. metatdenovo 1.4.0 with
> `--orf_caller prodigal` publishes `prodigal/<assembly>.faa.gz`; proteinfamilies 2.5.0
> accepts `.fa|.fasta|.faa|.fas` (± `.gz`), so the protein FASTA transfers with no
> reformatting — only a one-row `sample,fasta` samplesheet. The mapped route,
> `mag → proteinfamilies`, needs one more piece: mag does not itself emit protein FASTA,
> so an ORF-calling step belongs between those two stations. The ORF caller is decisive:
> `transdecoder` publishes `*.transdecoder.pep.gz`, and `.pep` is not in proteinfamilies'
> accepted extensions — a one-line schema addition upstream would make that route work
> too.

> **New edge — `mag → seqsubmit` (schemas checked 2026-08-11, added to the metro map
> 2026-08-11):** nf-core/seqsubmit
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

> **New edges — `proteinfamilies → proteinfold` and `proteinfamilies → proteinannotator`
> (emitted 2026-08-11 by run 03):** proteinfamilies 2.5.0 publishes ready-made `id,fasta`
> samplesheets for both successors, gated behind `--skip_proteinfold_samplesheet` and
> `--skip_proteinannotator_samplesheet`, **which both default to `true`** — the emitters are
> off unless you ask for them. Run 03 asked, and got `proteinfold/samplesheet.csv` and
> `proteinannotator/samplesheet.csv`, each one row pointing at the family representatives
> `<samplename>_reps.faa`. Both are produced from the same channel via the new Nextflow
> workflow output syntax (`publish:` in `main.nf`), added in proteinfamilies 2.1.0 and 2.2.0
> respectively. **No conversion step is involved on either edge** — these are the first two
> native handoffs this project has actually held in its hands.
>
> Two caveats, both from the target schemas rather than the run: proteinfold **2.0.0**
> accepts an `id` column (`anyOf: sequence|id`) and a `.faa` extension so the sheet
> transfers unmodified, but proteinfold **1.1.1** requires the column to be named `sequence`
> and matches `^\S+\.fa(sta)?$`, rejecting `.faa` — the handoff is native only against
> 2.0.0. And `_reps.faa` is a single multi-FASTA of every representative, so proteinfold's
> own documented invocation for this sheet adds `--split_fasta`. proteinannotator 1.1.0
> accepts `id` + `.fa|.fasta|.faa|.fas` (± `.gz`) and needs neither.

> **Two pipelines in the chain now ship downstream samplesheet generators — a pattern worth
> propagating** (detaxizer 1.3.0 `nextflow_schema.json`, checked 2026-08-10;
> proteinfamilies 2.5.0, exercised 2026-08-11). detaxizer exposes
> `--generate_downstream_samplesheets`, with `--generate_pipeline_samplesheets` defaulting
> to `taxprofiler,mag` and constrained by
> `^(taxprofiler|mag)(?:,(taxprofiler|mag)){0,1}`; proteinfamilies uses one
> `--skip_<target>_samplesheet` flag per target and the workflow `publish:` block. Two
> pipelines, two unrelated interfaces for the same idea — which is the argument for
> standardising it rather than letting each pipeline invent its own. Generalising the
> pattern — more source pipelines, more targets, one convention — is probably the single
> highest-leverage improvement available to inter-pipeline chaining in this SIG, and it is
> worth raising as a cross-pipeline proposal rather than as individual issues.
>
> Two limits of that generator: the regex admits at most two pipelines and excludes
> `ampliseq` and `metatdenovo` entirely, so those edges still need conversion. And
> detaxizer's own `--input` schema is
> `sample, short_reads_fastq_1, short_reads_fastq_2, long_reads_fastq_1` — not
> `sample, fastq_1, fastq_2` — so `fetchngs → detaxizer` needs a conversion too.
>
> **Scope decision (2026-08-10), revised (2026-08-11):** detaxizer was deferred out of the
> LMO pilot because LMO is Baltic brackish seawater with no host, `tax2filter` defaults to
> *Homo sapiens*, and filtering before a metatranscriptome co-assembly risks removing
> conserved or low-complexity reads for no expected biological gain. **That reasoning still
> holds for human filtering and is unchanged.** What it missed is that detaxizer's
> contaminant is a parameter, not a fixed target. Prompted by the detaxizer maintainer,
> the pilot now includes a detaxizer run with a different contaminant:
>
> - **phiX, not human.** `--classification_bbduk` with `--fasta_bbduk` pointed at φX174
>   (NC_001422.1, 5,386 bp) filters the Illumina spike-in control. phiX is not biology —
>   it is *supposed* to be absent, it assembles into contigs, and those contigs yielded
>   ORFs that went into run 03's 198,252 proteins. There is no case for keeping it, so the
>   filter carries none of the risk the human filter does. With `--classification_kraken2
>   false` the `KRAKEN2PREPARATION` block never runs, so this costs a 5.4 kb FASTA rather
>   than the ~60 GB `k2_standard` database.
> - **Human becomes a measurement, not a filter.** "How much human is in a Baltic seawater
>   metatranscriptome" is a publishable number either way, and it is the evidence the
>   2026-08-10 decision was taken without. It needs kraken2 and therefore the 60 GB
>   database, so it is tracked as a separate decision in
>   [`runs/04_detaxizer/README.md`](runs/04_detaxizer/README.md), not bolted onto the phiX
>   run — with both classifiers on, `MERGE_IDS` unions their hits and the filter would
>   remove human-classified reads along with phiX.
>
> **Run 04 executed 2026-08-11: 172 phiX read pairs out of 161,043,840 (0.000107%).**
> "Negligible fraction" and "absent from the assembly" are separate claims — 172 pairs is an
> upper bound of 8× coverage of a 5,386 bp genome pooled across the co-assembly, above
> megahit's floor — so the second was checked directly: `seqkit locate` of φX174 against run
> 02's existing contigs at up to 5 mismatches returns **no hits**. phiX never reached
> assembly depth, none of run 03's 405 families can carry a phiX ORF, and **metatdenovo and
> proteinfamilies are not re-run**. A documented negative rather than an assumption; detail
> in [RUNS.md](RUNS.md).
>
> **The run's real finding is upstream, and it is the first time anything has consumed a
> detaxizer-generated samplesheet.** `taxprofiler.csv` validates against taxprofiler 2.0.1;
> `mag-pe.csv` is **rejected** by mag 5.5.0 on two counts — `group` is a required `^\S+$`
> property that detaxizer writes as `""`, and `short_reads_platform` is `dependentRequired`
> on `short_reads_1` but is never emitted. Both hold whether empty CSV cells are read as
> empty strings or dropped, so this is not an nf-schema edge case: detaxizer 1.3.0's mag
> emitter writes the column set mag wanted at an earlier release. **This is the concrete
> evidence for the standardisation argument** — a native emitter is only as good as its
> currency with the target's schema, and nothing tells either side when that drifts. Filed
> as [nf-core/detaxizer#100](https://github.com/nf-core/detaxizer/issues/100).
>
> **Detect-only and the native samplesheet emitter are mutually exclusive in 1.3.0.**
> `GENERATE_DOWNSTREAM_SAMPLESHEETS` is fed `ch_filtered_reads`, which stays
> `Channel.empty()` unless the filter ran, so `--skip_filter true` silently produces no
> downstream sheets. Testing the emitter requires actually filtering — which is a second
> reason the phiX filter, rather than a detect-only human pass, is the run worth doing.
>
> **Upstream bug, found reading `modules/local/filter.nf` to confirm mate synchronisation:**
> the id-file array is indexed with `${array2[$(COUNTER-1)]}` — command substitution running
> a command literally named `COUNTER-1` — where `$((COUNTER-1))` was meant. Every paired-end
> FILTER task prints `COUNTER-1: command not found` and the subscript collapses to the empty
> string, which bash coerces to `0`. Harmless and in fact correct today, because `MERGE_IDS`
> emits one id file per sample and `0` is the only valid index; a latent hazard if detaxizer
> ever passes per-mate id files, since R2 would then be filtered with R1's ids and the pairs
> would desynchronise undetectably. One-character fix. **Filed 2026-08-11 as
> [nf-core/detaxizer#99](https://github.com/nf-core/detaxizer/issues/99)** — the first
> upstream issue this project has actually filed rather than drafted. The `metatdenovo` enum
> request is still unfiled.

> **Conversion scripts:** the conversions this table calls for live in
> `scripts/converters/`, each with an assert-based `--selftest`. They are the deliverable
> that turns "CONVERSION REQUIRED" from a finding into a working handoff.

> **Reading the Status column:** the status itself is the **mechanism** — whether the
> upstream pipeline hands its successor a ready-made samplesheet (NATIVE, or OPEN while the
> emitter is only known from a schema) or a converter has to sit between them (CONVERSION
> REQUIRED). Running the chain never changes that: a handoff that needed a converter still
> needs one afterwards. Execution is recorded as separate clauses, because a samplesheet has
> two ends: **emitted `<date>`** says the upstream run produced the file, **exercised
> `<date>`** says a downstream run consumed it. An edge can be emitted without being
> exercised — that is exactly where `proteinfamilies → proteinfold` sits today. On the metro
> map the mechanism is the edge colour and execution is the moving dot, so the two never
> overwrite each other.

| From | To | Samplesheet handoff mechanism | Status |
|------|----|-------------------------------|--------|
| **fetchngs** | **detaxizer** | generic `samplesheet.csv`; no `--nf_core_pipeline` support, and detaxizer's columns are `short_reads_fastq_1/2`, not `fastq_1/2` | **CONVERSION REQUIRED** — covered by `scripts/converters/fetchngs_to_reads_samplesheet.py --target detaxizer`; column rename only, sample names shared with the `--target reads` output; exercised 2026-08-11, detaxizer 1.3.0 ran to completion on the converted sheet |
| fetchngs | ampliseq | generic `samplesheet.csv`; **no `--nf_core_pipeline` option** | **CONVERSION REQUIRED** |
| fetchngs | taxprofiler | `--nf_core_pipeline taxprofiler` emits a purpose-built samplesheet | OPEN — flag exists, output not yet verified |
| fetchngs | mag | generic `samplesheet.csv`; **no `--nf_core_pipeline` option** | **CONVERSION REQUIRED** |
| fetchngs | metatdenovo | generic `samplesheet.csv`; **no `--nf_core_pipeline` option** | **CONVERSION REQUIRED** — exercised 2026-08-11 via `scripts/converters/fetchngs_to_reads_samplesheet.py`; metatdenovo 1.4.0 ran to completion on the converted sheet |
| **fetchngs** | **viralmetagenome** | generic `samplesheet.csv`; **no `--nf_core_pipeline` option**; wants `sample,fastq_1[,fastq_2]` — the same shape metatdenovo takes | **CONVERSION REQUIRED** — existing converter covers it unchanged |
| detaxizer | ampliseq | filtered FASTQ → ampliseq samplesheet; **excluded** from `--generate_pipeline_samplesheets` | **CONVERSION REQUIRED** |
| **detaxizer** | **taxprofiler** | `--generate_downstream_samplesheets` emits `taxprofiler.csv` natively — `sample,run_accession,instrument_platform,fastq_1,fastq_2,fasta` | **NATIVE** — emitted 2026-08-11, validates against taxprofiler 2.0.1, not yet exercised; taxprofiler additionally needs a `--databases` sheet detaxizer cannot produce |
| **detaxizer** | **mag** | `--generate_downstream_samplesheets` emits `mag-pe.csv` natively | **NATIVE, REJECTED BY TARGET** — emitted 2026-08-11 and mag 5.5.0 refuses it: `group` is required but written empty, and `short_reads_platform` is `dependentRequired` on `short_reads_1` but never emitted |
| **detaxizer** | **metatdenovo** | filtered FASTQ → `sample,fastq_1,fastq_2`; **excluded** from `--generate_pipeline_samplesheets`, whose pattern admits only `taxprofiler` and `mag` | **CONVERSION REQUIRED** — covered by `scripts/converters/detaxizer_to_reads_samplesheet.py`; mates verified synchronised in 1.3.0 source (`MERGE_IDS` unions hits, `filter.nf` applies one id list to both mates) |
| createtaxdb | taxprofiler | db output path referenced in taxprofiler params | OPEN |
| **mag** | **seqsubmit** | MAG/bin FASTA → `--mode mags\|bins` (`schema_input_genome.json`); gzipped FASTA transfers unchanged | **CONVERSION REQUIRED** — metadata, not just columns |
| mag | funcscan | MAG/contig FASTA → funcscan input | OPEN |
| mag | phageannotator | contig FASTA → phageannotator input | OPEN |
| mag | phyloplace | contig FASTA → phyloplace input | OPEN |
| mag | magmap | MAG FASTA → magmap reference input | OPEN |
| mag | metapep / proteinfamilies | predicted proteins FASTA → input | OPEN |
| **metatdenovo** | **proteinfamilies** | `--orf_caller prodigal` publishes `prodigal/<assembly>.faa.gz`, an extension proteinfamilies accepts | **CONVERSION REQUIRED** — one-row samplesheet, no reformatting; exercised 2026-08-11, 198,252 proteins accepted by proteinfamilies 2.5.0, 405 families out |
| **viralmetagenome** | **phageannotator** | viral contig FASTA → input, but the sheet also wants `group` and `fastq_1` | **CONVERSION REQUIRED** — two-source join, and `.combined.fa` is not gzipped |
| **viralmetagenome** | **phyloplace** | viral contig FASTA → `queryseqfile` | **CONVERSION REQUIRED** — `refseqfile`, `refphylogeny`, `model` are external per-row inputs |
| **proteinfamilies** | **proteinfold** | `--skip_proteinfold_samplesheet false` (default `true`) publishes `proteinfold/samplesheet.csv` — `id,fasta`, pointing at the family representatives `<samplename>_reps.faa` | **NATIVE** — emitted 2026-08-11, not yet exercised; native against proteinfold 2.0.0 only, 1.1.1 wants a `sequence` column and rejects `.faa` |
| **proteinfamilies** | **proteinannotator** | `--skip_proteinannotator_samplesheet false` (default `true`) publishes `proteinannotator/samplesheet.csv` — the same `id,fasta` sheet from the same channel | **NATIVE** — emitted 2026-08-11, not yet exercised; proteinannotator 1.1.0 accepts `id` + `.faa` unmodified |
| taxprofiler | differentialabundance | abundance profile → differentialabundance input | OPEN |
| ampliseq | differentialabundance | QIIME2/BIOM profile → differentialabundance input | OPEN |
| magmap | differentialabundance | coverage profiles → differentialabundance input | OPEN |

---

## Roadmap

| Phase | Tasks | Tools | Status |
|-------|-------|-------|--------|
| 0 — Dataset decision | Extend search; score against the matrix in [DATASETS.md](DATASETS.md); SIG vote | `lit-synthesizer`, `ncbi-datasets` | OPEN |
| 1 — Scaffold | fetchngs run; verify raw data availability; build reference DBs | `ncbi-datasets` (reference genomes) | OPEN |
| 2 — Core chain | ampliseq / taxprofiler / mag / metatdenovo; detaxizer re-added as run 04 for phiX removal | `claw-metagenomics` (validation runs) | IN PROGRESS — metatdenovo run 2026-08-11; detaxizer prepared, not run |
| 2a — Assembly QC | Assess MAG and transcript completeness | `busco-assessor` | OPEN |
| 3 — Samplesheet handoffs | Test and document each edge in the validation table | — | OPEN |
| 4 — Secondary analysis | differentialabundance; funcscan; phageannotator; phyloplace | — | OPEN |
| 5 — Stretch nodes | metapep; proteinfamilies; viralmetagenome; proteinfold / proteinannotator off the emitted sheets | — | IN PROGRESS — proteinfamilies run 2026-08-11, 405 families |
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
9. ~~**Carried forward to the first host-related dataset:** run detaxizer and test
   `--generate_downstream_samplesheets` against taxprofiler and mag.~~
   **Partly resolved (2026-08-11):** detaxizer no longer waits for a host. Run 04 filters
   phiX instead of *Homo sapiens*, which puts the emitter test on the LMO pilot's critical
   path. What is still carried forward is **human** decontamination, which needs a host
   dataset to be biologically meaningful, and the question of whether taxprofiler and mag
   accept the generated sheets unmodified — run 04 produces them, but nothing consumes them
   until those two pipelines run.
10. **Do the two sheets proteinfamilies emitted actually run?** Run 03 produced
    `proteinfold/samplesheet.csv` and `proteinannotator/samplesheet.csv` on 2026-08-11 and
    nothing has consumed either. Feeding them straight into proteinfold 2.0.0 and
    proteinannotator 1.1.0 unmodified is the cheapest remaining test of nf-core samplesheet
    standardisation available to this project — the file already exists, so the only cost is
    compute. proteinannotator first: proteinfold needs `--split_fasta` and GPU-scale
    resources, proteinannotator does not.
