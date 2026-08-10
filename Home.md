---
tags:
  - moc
---

# nf-core meta-omics SIG — Home

Map of content for this repository. Nothing here is authoritative: every statement lives
in the file that owns it, and this note only says which file that is. If a fact appears
both here and in a canonical doc, the canonical doc wins.

> Graph view and backlinks are built from the ordinary relative Markdown links already in
> these files — there are no `[[wikilinks]]`, because those render as literal brackets on
> GitHub and this repo is read there too.
>
> Install, first-open and the shortcuts worth learning live in
> [README.md § Obsidian Vault](README.md#obsidian-vault) — kept there rather than repeated
> here, so there is one copy to keep true.

## What this project is

Testing nf-core meta-omics pipeline synergy end to end. The "metro map" sets out how these
pipelines could chain together — a roadmap of potential routes, not guarantees. We walk it
on a real multi-omics dataset, contribute the resulting bug reports, feature requests and
reusable converters back upstream, and publish the result as an nf-core community paper.

Start at [README.md](README.md) for the overview.

## Who owns what

| Question | Canonical file |
|----------|----------------|
| What are we building, and what is the pipeline chain? | [PLAN.md](PLAN.md) |
| Which handoffs are validated, which need conversion, which are untested? | [PLAN.md](PLAN.md) § Samplesheet Chaining — Validation Table |
| Which dataset should we use, and how do candidates score? | [DATASETS.md](DATASETS.md) |
| What has actually been executed, with what provenance? | [RUNS.md](RUNS.md) |
| How should an AI agent work in this repo? Conventions, guardrails, environment gotchas | [AGENTS.md](AGENTS.md) |
| What does this acronym mean? | [ACRONYMS.md](ACRONYMS.md) |
| What happened when? | [LOG.md](LOG.md) |

[CLAUDE.md](CLAUDE.md) exists only to point at [AGENTS.md](AGENTS.md), so that every
coding agent reads the same file.

## Runs

Each run directory holds its inputs, params and troubleshooting notes. The ledger entry
with the Seqera Platform provenance link lives in [RUNS.md](RUNS.md).

| # | Pipeline | Notes |
|---|----------|-------|
| 01 | fetchngs | [runs/01_fetchngs/README.md](runs/01_fetchngs/README.md) |
| 02 | metatdenovo | [runs/02_metatdenovo/README.md](runs/02_metatdenovo/README.md) |
| 03 | proteinfamilies | [runs/03_proteinfamilies/README.md](runs/03_proteinfamilies/README.md) |

## Scripts

`scripts/converters/` holds the samplesheet conversions that the validation table marks
CONVERSION REQUIRED. Each has an assert-based `--selftest` that runs with no arguments and
no fixtures. They are the deliverable that turns a finding into a working handoff.

`scripts/check_links.py` checks link hygiene for this vault — broken links, orphaned notes,
and `[[wikilink]]` syntax that would not render on GitHub. Run it after editing links:

```bash
python3 scripts/check_links.py          # full report, exits non-zero on failure
python3 scripts/check_links.py --quiet  # failures only
```

## Published site

`docs/` is a GitHub Pages site rendering the chain as a conveyor belt. `docs/data.json` is
hand-maintained and **mirrors** PLAN.md — its `repoStatus` strings are copied verbatim from
the validation table. Change PLAN.md and you must change `docs/data.json` in the same
commit, or the site starts lying.

## Conventions worth knowing before editing

- **Never commit absolute cluster paths.** Generated samplesheets contain them and are
  gitignored; provenance lives in Seqera links, not filesystem paths.
- **Three vocabularies in `docs/data.json` must not blend:** `repoStatus` (verbatim from
  PLAN.md), site annotations (`caveat`, `siteState`, `routable`), and `statusClass`
  (a render class only).
- **Do not declare a handoff working without evidence.** The value is in actually walking
  the routes, not in restating the roadmap.
- **Findings are contributions, not criticism.** The metro map indicates potential routes;
  nobody promised they work today. Write every gap as something to fix upstream or bridge
  with a converter.
- **Do not resolve the dataset decision unilaterally** — that is the SIG's call.

## Open threads

Tracked properly in [PLAN.md](PLAN.md) § Open Questions. The two that gate everything else:

1. No host-related dataset passing the amplicon + MG + MT gate has been found. Every
   selectable candidate is environmental.
2. The LMO sample-count discrepancy with the data owner is unresolved — independent ENA
   counts do not reproduce the submitter's tally.
