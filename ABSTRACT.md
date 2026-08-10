# Nextflow Summit 2026 — abstract draft

> Working document. Delete once submitted.
> **Honesty check before sending:** see *Claims and their evidence* at the bottom. Some
> sentences describe work scheduled but not yet executed — adjust or cut depending on
> what has actually run by the submission deadline.

---

## Title options

1. **The metro map lies: stress-testing samplesheet handoffs across 16 nf-core meta-omics pipelines**
2. **Does pipeline A's output actually feed pipeline B? Auditing the nf-core meta-omics chain**
3. **Every arrow is a claim: validating inter-pipeline handoffs in nf-core meta-omics**

Recommended: **1** for a talk (the provocation earns attention and the content backs it
up), **2** for a poster (a question invites people to stop and ask).

---

## Abstract (~300 words)

The nf-core meta-omics Special Interest Group maintains a "metro map" showing how its
pipelines chain together across data types and analysis stages. Every arrow on that
diagram is a claim: that the output of one pipeline can be fed to the next. Those claims
have never been tested end to end on real data.

We are auditing them systematically. Using a matched multi-omics time series from the
Linnaeus Microbial Observatory in the Baltic Sea — 16S amplicon, shotgun metagenome and
metatranscriptome sampled from the same water on 26 dates — we route real data down the
chain and record, edge by edge, whether the handoff works, needs a conversion step, or
fails.

The early results are not what the diagram implies. Of 19 tracked handoffs, **none is yet
validated as working out of the box**, and six require an explicit conversion step. The
entry pipeline, `fetchngs`, can emit a purpose-built samplesheet for only one of the four
pipelines that begin the core chain — `ampliseq`, `mag` and `metatdenovo` all require
manual conversion, and the sample identifier it supplies is an ENA experiment accession
that would label every downstream result `ERX13368357`. Conversely, `detaxizer` — an
*optional* filtering step — is the only pipeline we have found that ships a downstream
samplesheet generator at all. We also identify a protein-level handoff absent from the
metro map that is better supported than the one drawn on it, and show that a single
parameter choice (`--orf_caller`) determines whether that handoff is possible, because one
ORF caller emits a file extension the next pipeline rejects.

Alongside the audit we contribute tested conversion scripts, upstream bug reports, and a
published, continuously updated site rendering the chain with each edge's status and its
evidence. Our aim is a reusable method for auditing pipeline interoperability — and a
sharper picture of what nf-core samplesheet standardisation still owes its users.

---

## Short version (~120 words, for a poster or a character-limited form)

Every arrow in the nf-core meta-omics "metro map" claims that one pipeline's output can
feed the next. None had been tested end to end. Using a matched amplicon + metagenome +
metatranscriptome time series from the Baltic Sea, we are auditing all 19 handoffs on real
data. So far none works unmodified: six need explicit conversion, and the entry pipeline
`fetchngs` can emit a ready samplesheet for just one of the four core-chain destinations,
while the *optional* `detaxizer` step is the only one shipping a samplesheet generator. We
also find a protein handoff missing from the map that works better than the one drawn on
it. We contribute tested conversion scripts, upstream bug reports, and a live site
recording each edge's status and evidence.

---

## Talk vs poster

**Talk.** The argument has a narrative shape — a diagram everyone trusts, a systematic
test, and a specific inversion (the optional step is better tooled than the mandatory one)
that reframes how the audience reads every nf-core chaining diagram. The live site gives a
strong closing demo. Ask for 15 minutes.

**Poster.** The per-edge status table is genuinely poster-shaped: 19 rows, colour-coded,
readable in 30 seconds, and it starts conversations with maintainers of individual
pipelines — who are exactly the people who can fix what we found. Lower risk if fewer
pipelines have run by November.

**If forced to choose now:** submit as a talk, offer to convert to a poster. The findings
already stand on schema evidence alone, so the talk does not depend on how many pipelines
finish running before the summit.

---

## Submission metadata

- **Authors:** Evangelos Karatzas, Daniel Lundin, and the nf-core meta-omics SIG.
  *Author list and order to be confirmed with the SIG before submission — PLAN.md Phase 6
  lists joint authorship as an open item.*
- **Affiliation:** to be completed.
- **Keywords:** nf-core, Nextflow, meta-omics, metagenomics, metatranscriptomics,
  interoperability, samplesheets, reproducibility, pipeline chaining
- **Data:** ENA PRJEB52780, PRJEB52782, PRJEB52828 (16S), PRJEB82694 (metagenome),
  PRJEB69280 (metatranscriptome) — Linnaeus Microbial Observatory, Baltic Sea
- **Code / site:** https://github.com/vagkaratzas/meta-omics-sig
- **Related SIG page:** https://nf-co.re/special-interest-groups/meta-omics

---

## Claims and their evidence

Check each line before submitting. Anything marked ⚠ depends on work not yet done.

| Claim in the abstract | Status |
|---|---|
| 19 tracked handoffs; none validated; 6 conversion-required | Solid — matches PLAN.md validation table and `docs/data.json` |
| `fetchngs --nf_core_pipeline` supports only 1 of the 4 core-chain destinations | Solid — enum is `[rnaseq, atacseq, viralrecon, taxprofiler]`, verified on 1.12.0 and `dev` |
| `sample` column is the ENA experiment accession | Solid — observed in the executed pilot, 12/12 rows |
| `detaxizer` is the only pipeline found shipping a downstream samplesheet generator | Solid *as stated* — "only one we have found". Re-check across the other 15 before submitting so the claim stays defensible |
| Protein handoff missing from the map, better supported than the drawn one | Solid at schema level — metatdenovo publishes `.faa.gz`; mag emits no protein FASTA |
| `--orf_caller` decides whether the handoff is possible | Solid — transdecoder publishes `.pep.gz`; proteinfamilies' schema accepts only `.fa/.fasta/.faa/.fas` |
| "26 dates" matched across three layers | Solid from ENA — **but** the sample-count discrepancy with the data owner is unresolved (DATASETS.md, Candidate 8). Resolve before publishing a number |
| "we route real data down the chain" | ⚠ One pipeline of 16 has run. True but thin today; will be stronger by November. Do not imply the full chain has been executed |
| "tested conversion scripts" | Solid — 3 scripts, each with an assert-based `--selftest` |
| "upstream bug reports" | ⚠ Five issues drafted in RUNS.md, **none filed yet**. File at least the two concrete `fetchngs` bugs before submitting, or soften to "bug reports prepared" |
| "continuously updated site" | Solid — `docs/` is live and mirrors the validation table |

**Biggest risk:** the abstract reads as though the whole chain has been run. It has not.
The findings are real and mostly schema-derived, which is defensible, but the phrasing
must not overclaim — the SIG's own guardrail is to emphasise what is validated versus what
remains open. Every number above is reproducible from the repository as it stands.
