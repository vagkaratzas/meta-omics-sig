# Nextflow Summit 2026 — abstract draft

> Working document. Delete once submitted.
> **Framing note:** the metro map presents *potential* chaining between pipelines — it was
> always a forward-looking plan, never a promise that edges work out of the box. This
> abstract is written as a collaborative effort to realise that plan, and every finding is
> framed as a contribution back to the pipelines, not as a deficiency in them.
> Check *Claims and their evidence* at the bottom before sending.

---

## Title options

1. **From reads to protein families: testing nf-core meta-omics pipeline synergy end to end**
2. **Making the metro map real: an end-to-end meta-omics use case across amplicon, metagenome and metatranscriptome**
3. **Chaining nf-core meta-omics pipelines: a real-data use case, reusable converters, and upstream contributions**

Recommended: **1** for a talk (concrete, shows the span in six words), **2** for a poster
(names the diagram people already recognise).

---

## Abstract (~300 words)

The nf-core meta-omics Special Interest Group maintains a "metro map" of how its pipelines
could chain together across data types and analysis stages. It is a roadmap of intended
synergy rather than a set of guarantees, and turning it into a travelled route requires
someone to walk it end to end on real data. That is what this project does.

We are running a matched multi-omics study through as much of the chain as its data layers
allow. The primary use case is the Linnaeus Microbial Observatory time series in the Baltic
Sea, which provides 16S amplicon, shotgun metagenome and metatranscriptome sequencing from
the same water sample across 26 collection dates — a rare opportunity to exercise the
amplicon, assembly, profiling and protein branches of the map with data that genuinely
belongs together.

Walking the chain surfaces exactly the practical detail a diagram cannot carry: which
handoffs already work, which need a small conversion, which parameter choices determine
whether a downstream pipeline will accept an input at all. We are feeding that back as
concrete, actionable contributions — bug reports and feature requests to individual
pipelines, including opportunities to extend existing samplesheet-generation support so
that fewer users need to bridge steps by hand. Where a bridge is needed today, we publish
tested converter scripts that any user can reuse.

Alongside the runs we maintain an educational site that renders the chain interactively:
what each pipeline requires as input, what it emits, the current status and evidence for
every handoff, and the progression of the dataset analysis as it advances. It is intended
as a practical entry point for anyone assembling their own meta-omics workflow, and as the
living record behind the community publication this effort will produce.

We present the method, what we have learned so far, and how others can apply both to their
own pipeline chains.

---

## Short version (~120 words, for a poster or a character-limited form)

The nf-core meta-omics "metro map" sets out how its pipelines could chain together. Turning
that roadmap into a travelled route takes someone walking it end to end on real data. We
are doing that with a Baltic Sea time series carrying 16S amplicon, metagenome and
metatranscriptome from the same water sample across 26 dates, exercising the amplicon,
assembly, profiling and protein branches together. Along the way we contribute bug reports
and feature requests back to individual pipelines, publish tested converter scripts users
can reuse where a bridge is needed today, and maintain an educational site showing each
pipeline's inputs and outputs, the status and evidence for every handoff, and the analysis
progression. Both feed a forthcoming nf-core community publication.

---

## Talk vs poster

**Talk.** The material has a natural arc — a roadmap the community already knows, a real
dataset walked through it, and a set of concrete improvements handed back. The interactive
site is a strong closing demo. Ask for 15 minutes.

**Poster.** The per-pipeline requirements and handoff-status table is genuinely
poster-shaped and starts the right conversations: maintainers of individual pipelines stop,
look at their own row, and discuss it directly. That is the fastest route from finding to
merged fix.

**If forced to choose now:** submit as a talk and offer to convert. The contribution stands
on the method and the tooling, so it does not depend on how many pipelines have finished
running by November.

---

## Submission metadata

- **Authors:** Evangelos Karatzas, Daniel Lundin, and the nf-core meta-omics SIG.
  *Author list and order to be confirmed with the SIG before submission — PLAN.md Phase 6
  lists joint authorship as an open item.*
- **Affiliation:** to be completed.
- **Keywords:** nf-core, Nextflow, meta-omics, metagenomics, metatranscriptomics, amplicon,
  pipeline chaining, samplesheets, interoperability, reproducibility
- **Data:** ENA PRJEB52780, PRJEB52782, PRJEB52828 (16S amplicon), PRJEB82694 (metagenome),
  PRJEB69280 (metatranscriptome) — Linnaeus Microbial Observatory, Baltic Sea.
  Data generated by Daniel Lundin's group; acknowledge accordingly.
- **Code / site:** https://github.com/vagkaratzas/meta-omics-sig
- **SIG page:** https://nf-co.re/special-interest-groups/meta-omics

---

## Claims and their evidence

Check each line before submitting. ⚠ marks anything depending on work not yet done.

| Claim in the abstract | Status |
|---|---|
| Matched amplicon + MG + MT from the same water sample, 26 dates | Solid from ENA — **but** the sample-count discrepancy with the data owner is unresolved (DATASETS.md, Candidate 8). Settle it before publishing the number |
| "which handoffs already work, which need a small conversion" | Solid — 19 tracked handoffs, 6 currently marked conversion-required, in PLAN.md and mirrored on the site |
| "parameter choices determine whether a downstream pipeline will accept an input" | Solid — `--orf_caller transdecoder` emits `.pep.gz`; proteinfamilies accepts only `.fa/.fasta/.faa/.fas` |
| "opportunities to extend existing samplesheet-generation support" | Solid — `detaxizer` ships `--generate_downstream_samplesheets` (taxprofiler, mag); `fetchngs --nf_core_pipeline` covers `rnaseq, atacseq, viralrecon, taxprofiler` |
| "tested converter scripts" | Solid — 3 scripts, each with an assert-based `--selftest` |
| "bug reports and feature requests" | ⚠ Five are drafted in RUNS.md, **none filed**. File at least the two concrete `fetchngs` bugs before submitting, or soften to "prepared" |
| "educational site … rendering the chain interactively" | Solid — `docs/` is live and mirrors the validation table |
| "running a matched multi-omics study through as much of the chain as its data layers allow" | ⚠ One pipeline of 16 has run; two more are configured. True as a description of the project, but do not let it read as though the full chain is complete |
| "forthcoming community publication" | Solid as an intention — PLAN.md Phase 6. Keep it stated as forthcoming |

**Tone check.** No sentence should read as though the pipelines or their maintainers
promised something they did not. The map indicates potential; we are testing that potential
and contributing what we learn. Findings are opportunities, not failures.

**Biggest risk.** The abstract should not imply the chain has been fully executed. The
method, the tooling and the site are real today; the run coverage is still growing.
