---
name: update-metro-map
description: Use when the nf-core meta-omics SIG metro map needs a change or a re-render, e.g. "add <pipeline> to the map", "connect X to Y on the map", "update the metro map", "new map for the SIG page", a SIG action point about the map, or a new meta-omics pipeline's first release.
---

# Update the meta-omics metro map

The map is text: [`images/nf-core-meta-omics-metromap.mmd`](../../../images/nf-core-meta-omics-metromap.mmd), rendered with [nf-metro](https://github.com/seqeralabs/nf-metro) (syntax: its [guide](https://seqeralabs.github.io/nf-metro/latest/)). It replaced the hand-drawn Inkscape map in Nov 2026. The rendered PNG/SVG sit next to it and on the [SIG page](https://nf-co.re/special-interest-groups/meta-omics).

## What goes on the map

- **The SIG decides** which stations and edges are drawn (an action point in the [meeting notes](https://hackmd.io/@nf-core/SyCCVMkT0)). A pipeline goes on after its first release (SIG, 17 Sep 2026). Don't add one on your own judgement.
- **Every edge must make sense in/out.** Before drawing A → B, read B's input contract at its latest release tag and A's output docs, e.g.
  `gh api "repos/nf-core/<B>/contents/assets/schema_input.json?ref=<tag>" --jq .content | base64 -d`, plus B's `nextflow_schema.json` (database or extra sheet params) and A's `docs/output.md`. Record the reasoning (native, needs a converter, which columns) in the commit message.
- **Lines are data types**, not pipelines: amplicon reads, shotgun reads, metatranscriptome contigs, MAGs, viral contigs, reference database. A new data type gets its own line, so a reader can trace which pipeline feeds which.
- A hidden junction (`_reads`) carries an optional step (detaxizer) without a fake station. A file icon (`magmap_reads`) stands in for an input whose line would have to loop across the map.

## Steps

1. Edit the `.mmd`. Declare each station once inside its section; cross-section edges go after all `subgraph` blocks.
2. Check connections against the validation table: `python3 scripts/check_map.py` (and `--selftest`). It lists edges only on the map and only in `docs/data.json`; each must be explained. A new SIG edge goes into `docs/data.json` and PLAN.md's validation table (same commit, see [AGENTS.md](../../../AGENTS.md)). Known differences: proteinfold and proteinannotator are table-only (off the map since Aug 2026); eager, the reads into viralmetagenome and metatdenovo → differentialabundance are on the map, untracked by the table.
3. Render. nf-metro needs Python ≥ 3.11 (`pip install nf-metro`, or a venv: `uv venv -p 3.12 && uv pip install nf-metro`):
   ```bash
   nf-metro validate images/nf-core-meta-omics-metromap.mmd
   nf-metro render images/nf-core-meta-omics-metromap.mmd -o images/nf-core-meta-omics-metromap.svg -o images/nf-core-meta-omics-metromap.png
   ```
4. **Look at the PNG** before committing:
   - a station sitting on another pipeline's track reads as a false edge (why magmap is in secondary analysis, not after eager);
   - lines swapping order where they enter a section (amplicon and shotgun into secondary analysis);
   - lines the theme hides (keep `%%metro mode: light`: the nf-core page is light);
   - overlapping labels.

   `nf-metro explain` says why a layout decision was made. Some orderings crash the router ("defective bundle curves", nf-metro 2.1.0): change the line declaration order and re-render.
5. Show the SIG a draft first: the PNG plus the edges added and removed.
6. Ship after the SIG agrees:
   - here: `.mmd`, PNG and SVG in `images/`, plus `docs/data.json` and PLAN.md for new edges; `python3 scripts/check_links.py` passes;
   - [nf-core/website](https://github.com/nf-core/website): replace `sites/main-site/src/assets/images/special-interest-groups/meta-omics/nf-core-meta-omics-metromap.{png,svg}` (same names; the page's `index.mdx` imports the PNG) on a branch off `main`, and open a PR.
