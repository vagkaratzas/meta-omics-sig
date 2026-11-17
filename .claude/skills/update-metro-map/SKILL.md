---
name: update-metro-map
description: Use when the nf-core meta-omics SIG metro map needs a change or a re-render, e.g. "add <pipeline> to the map", "connect X to Y on the map", "update the metro map", "new map for the SIG page", a SIG action point about the map, or a new meta-omics pipeline's first release.
---

# Update the meta-omics metro map

The map is drawn in [draw.io](https://app.diagrams.net) and exported as light and dark PNG/SVG in [`images/`](../../../images/) (`nf-core-meta-omics-metromap_{light,dark}.{png,svg}`), also used on the [SIG page](https://nf-co.re/special-interest-groups/meta-omics). It replaced the hand-drawn Inkscape map and the nf-metro render in Nov 2026.

- **The editable source is embedded in every PNG/SVG**: open `images/nf-core-meta-omics-metromap_light.svg` in draw.io (File > Open from > Device), then File > Save as to your own Drive.
- **The script is the source of truth**: [`scripts/sig_map.js`](scripts/sig_map.js) holds the `EDGES` list (pipeline → pipeline; `scripts/check_map.py` compares it with `docs/data.json`) and the routes that draw them. An edge change goes in **both**, next to each other in that file.
- The generic how-to (Claude in Chrome, export, install) is the `drawio-nf-core-metromaps` skill from [vagkaratzas/skills](https://github.com/vagkaratzas/skills). This skill needs only `scripts/sig_map.js`.

## What goes on the map

- **The SIG decides** which stations and edges are drawn (an action point in the [meeting notes](https://hackmd.io/@nf-core/SyCCVMkT0)). A pipeline goes on after its first release (SIG, 17 Sep 2026). Don't add one on your own judgement.
- **Every edge must make sense in/out.** Before drawing A → B, read B's input contract at its latest release tag and A's output docs, e.g.
  `gh api "repos/nf-core/<B>/contents/assets/schema_input.json?ref=<tag>" --jq .content | base64 -d`, plus B's `nextflow_schema.json` (database or extra sheet params) and A's `docs/output.md`. Record the reasoning (native, needs a converter, which columns) in the commit message.
- **Lines are data types**, not pipelines: amplicon reads, shotgun reads, metatranscriptome contigs, MAGs, viral contigs, reference database. A new data type gets its own colour and a legend row, so a reader can trace which pipeline feeds which.
- A station is a pipeline (its nf-core logo is the label). A file icon (the FASTA reference genomes in data input) stands in for an input that is not a pipeline. A dashed line is an input that is optional or a database (magmap's MAGs from mag: it also runs on public or the user's own genomes, per the magmap maintainer, 16 Nov).

## Steps

1. **Edit the edge list**: add or remove the edge in `EDGES` in `scripts/sig_map.js`. Check it against the validation table: `python3 scripts/check_map.py` (and `--selftest`). It lists edges only on the map and only in `docs/data.json`; each must be explained. A new SIG edge goes into `docs/data.json` and PLAN.md's validation table (same commit, see [AGENTS.md](../../../AGENTS.md)). Known differences: proteinfold and proteinannotator are table-only (off the map since Aug 2026), and so is phageannotator (no release yet: only released pipelines are drawn, SIG 16 Nov); eager, the reads into viralmetagenome and magmap, createtaxdb → metatdenovo, funcprofiler and bacmodel, and metatdenovo → differentialabundance are on the map, untracked by the table (run the script to see the exact list).
2. **Draw it** with Claude in Chrome (load the `chrome-browser` skill first):
   - open a blank draw.io diagram (or your Drive copy) in a new tab and `resize_window` to about 1600×1300;
   - paste `scripts/sig_map.js` into `javascript_tool` (again after every page reload);
   - `await MM.loadLogos()` (pulls each pipeline's logo from nf-core GitHub into the page; no upload), then `await MM.build()`, then `await MM.view(0.5)` and take a screenshot;
   - edit the routes (`E(...)` lines: change a row `y` or a channel `x`) and the station list `S` in a copy of the script, and rebuild until it reads well. **A rebuild wipes the page**: once someone has tweaked the diagram by hand, make only targeted edits (find cells by id or position) and never `MM.build()` again;
   - optional: drag the file-icon asset from the draw.io `nf-core_components` library onto the page, `await MM.useAssetIcon('<its cell id>')`, then `await MM.build()` again (it keeps that icon and uses it for the FASTA input instead of the plain stand-in).
3. **Check it**: `await MM.check()` must return `ok`. It tests what reviewers flagged before (website PR #4561): equal gaps between the boxes, equal bottom padding in every box, one corner radius, evenly spaced stations in a single-column box (box 3), a station column centred in its box (box 2), every logo >= 8 px clear of every line, white logo text in dark mode, and every logo stored at 2x its drawn width (a lower ratio reads blurry next to the others). It also works on a hand-edited page. `build()` sizes the boxes from their content (`PAD`, `GAP` in the script), so a rebuild passes unless a rule was broken by hand.
4. **Look at it** before exporting, zoomed in (`MM.view(1, dx, dy)` plus the `zoom` action):
   - every fork and corner is one continuous path: no gaps, no stubs sticking out of an arc;
   - lines cross only on straight segments. A corner within 40 px of another lane means a kink: move the row or channel;
   - a station sitting on another pipeline's track reads as a false edge (seqsubmit once sat on the metatdenovo and mag lanes behind proteinfamilies: those lanes now run down their own channel to seqsubmit);
   - labels do not touch lines or each other.
5. **Export**: `await MM.exportAll('nf-core-meta-omics-metromap')` (light and dark PNG + SVG), then `MM.preview('nf-core-meta-omics-metromap_dark.png')` and screenshot it: logos swap to their dark versions, and the yellow line must stay bright. `MM.preview(null)` closes it. Then `await MM.waitSaved()`.
6. **Download**: `await MM.downloadButton('meta_omics_metromaps.zip')`, find the "Download metro maps" link and click it. Chrome may ask where to save: the person at the keyboard presses Save.
7. **Install** into `images/` here and into the website branch (every SVG needs a final newline for the nf-core `end-of-file-fixer` hook):
   ```bash
   unzip -o ~/Downloads/meta_omics_metromaps.zip -d <dest>
   for f in <dest>/*.svg; do [[ -z "$(tail -c 1 "$f")" ]] || echo >> "$f"; done
   ```
   Check `grep -o 'color-scheme: [a-z]*'` matches each SVG's theme, `grep -c @font-face` > 0 and `grep -a -c mxfile` on the PNGs is 1. Never strip the embedded diagram or fonts.
8. **Ship** after the SIG agrees (show a draft first: the PNG plus the edges added and removed):
   - here: the four images in `images/`, plus `docs/data.json` and PLAN.md for new edges; `python3 scripts/check_links.py` passes; README embeds the `_light.png`;
   - [nf-core/website](https://github.com/nf-core/website): only the two PNGs go to `sites/main-site/src/assets/images/special-interest-groups/meta-omics/` (a draw.io SVG there fails the Astro build: `NoImageMetadata`, its editable diagram sits in the root `<svg>` tag, past the 1000 bytes Astro probes); the page's `index.mdx` imports the `_light.png`. Run the build before pushing: Node 24 (`~/.nvm/versions/node/v24.14.1/bin`), `npm ci --allow-git=all --ignore-scripts`, then `GITHUB_TOKEN=$(gh auth token) node ../../node_modules/astro/bin/astro.mjs build` in `sites/main-site`. Do it on a branch off `main` and open a PR.

## Gotchas

- Logos are stored at 2x their drawn width (`LW` in the script; `loadLogos` reads it). A new station's width goes in `LW`, not only in `build`.
- Logos are trimmed of their transparent margins on load (`trim`): the repos' PNGs carry uneven padding, so without it the label-to-pill gap varied 8-21 px and mag looked detached (#4561). Label placement assumes a trimmed logo.
- Branches off one trunk all leave it the same way (up, then right); where a second lane shares the station, order the lanes so the branch never crosses it inside a corner (proteinfamilies: metatranscriptome above at 740, MAG below at 750). Box 4's top is set from seqsubmit's logo (`HEAD`), not from box 3.
- The logos are embedded three times (visible copy plus the editable diagram in both PNG and SVG), so they dominate the file size. `loadLogos` shrinks them to 8-bit palette PNGs (`MM.quant`), same pixels at a quarter of the bytes; don't swap in the raw logos.
- `javascript_tool` output is cut at about 1.5k characters and a result that looks like `key=value` comes back as `[BLOCKED]`: return short summaries.
- Lines cross straight through each other at junctions, as the SIG preferred (16 Nov: the hop on magmap's reads line was removed, then magmap moved into the primary box). `E(..., true)` in `sig_map.js` would draw a hop (`jumpStyle=arc;jumpSize=20`, route drawn last) if it is ever wanted again. Cross on straight segments only.
- draw.io's `getChildCells` skips hidden cells: clear a page with `getChildren` (as `MM.build` does), or the hidden dark logos pile up on every rebuild.
- A plain `#FFFFFF`/`#000000` is inverted in the dark export: pin it as `light-dark(X,X)`. Line colours too (yellow goes dim otherwise).
- draw.io's CSP blocks `eval` and `fetch` to localhost: the script cannot be loaded from a file or URL inside the page. Paste its text as the `javascript_tool` code itself (comment-only lines can be dropped to save tokens).
- The Google Drive connector cannot read the file by its `#G<id>`; work in the open tab.
