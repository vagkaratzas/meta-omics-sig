# Run 03 — proteinfamilies (families from LMO metatranscriptome ORFs)

Third pipeline of the chain. Clusters the protein sequences predicted by
[run 02, metatdenovo](../02_metatdenovo/README.md) into families and builds family models.

- Pipeline: `nf-core/proteinfamilies` **2.5.0** (requires Nextflow `>=26.04.0`)
- Input: `samplesheet.csv`, **generated on the cluster** — not committed
- Params: [`params.yml`](params.yml)

## Why this edge exists

metatdenovo, with `--orf_caller prodigal`, emits protein FASTA directly:
`prodigal/<assembly>.faa.gz`, an extension proteinfamilies accepts without modification.
That makes `metatdenovo → proteinfamilies` a short, schema-compatible route into the
protein nodes. It was proposed to the SIG off the back of this run and **is now drawn on
the metro map** — metatdenovo feeds the shared `fasta` interchange, which is what the
protein stations hang off. Recorded as a row in
[PLAN.md](../../PLAN.md#samplesheet-chaining--validation-table).

## Build the samplesheet

```bash
python3 scripts/converters/metatdenovo_to_proteinfamilies.py \
    <metatdenovo-outdir> \
    runs/03_proteinfamilies/samplesheet.csv
```

proteinfamilies requires `sample,fasta`. Because metatdenovo co-assembles, there is
exactly one protein FASTA and therefore exactly one row. The converter:

- finds the protein FASTA across all three ORF-caller layouts,
- **refuses** to write a sheet proteinfamilies would reject — specifically the
  transdecoder case, where the file is `*.transdecoder.pep.gz` and `.pep` is not in the
  schema's accepted set (`.fa`, `.fasta`, `.faa`, `.fas`, optionally `.gz`), printing the
  exact rename needed,
- fails loudly if more than one protein FASTA is present, since that would mean the
  co-assembly assumption no longer holds.

## Run

```bash
nextflow run nf-core/proteinfamilies \
  -r 2.5.0 \
  -profile slurm,singularity \
  -c /path/to/your-site.config \
  -params-file params.yml \
  -resume
```

## Parameters left at default, deliberately

This run exists to prove the handoff, not to tune clustering. Values that will matter when
results are interpreted:

| Param | Default | Why it matters here |
|-------|---------|---------------------|
| `min_seq_length` | 30 | Prodigal on a metatranscriptome co-assembly yields many short partial ORFs; a visible fraction will be dropped. Count them before reading anything into family totals. |
| `max_seq_length` | 5000 | Unlikely to bind. |
| `clustering_tool` | `cluster` | mmseqs `cluster`; switch to `linclust` if the ORF set proves too large. |
| `cluster_seq_identity` | 0.3 | Family granularity. |
| `cluster_coverage` | 0.5 | Family granularity. |
| `cluster_size_threshold` | 25 | Minimum cluster size to seed an MSA. |
| `family_generation_algorithm` | `standard` | New in 2.5.0. `iterative` hands chunks of clusters to mgnifam, repeating HMM build / recruit / realign until each family converges. Left at `standard` for the handoff test. |

## The two parameters that are *not* left at default

```yaml
skip_proteinfold_samplesheet: false
skip_proteinannotator_samplesheet: false
```

Both default to `true`. Turning them off makes proteinfamilies 2.5.0 publish a ready-made
samplesheet for its two successors — the thing this whole project is trying to find more of:

| Published path | Consumer | Columns |
|----------------|----------|---------|
| `proteinfold/samplesheet.csv` | [nf-core/proteinfold](https://nf-co.re/proteinfold) | `id,fasta` |
| `proteinannotator/samplesheet.csv` | [nf-core/proteinannotator](https://nf-co.re/proteinannotator) | `id,fasta` |

Both sheets are built from the same channel (`main.nf`, `publish:` block) and point at the
family representatives, `<samplename>/<samplename>_reps.faa`. Before this run, **detaxizer
was the only pipeline in the chain known to emit downstream samplesheets natively**; it is
now the second of two. That claim is corrected wherever it appeared —
[PLAN.md](../../PLAN.md) and the [project site](https://vagkaratzas.github.io/meta-omics-sig/).

Two things to check before feeding either sheet onward:

- **proteinfold version matters.** proteinfold **2.0.0** accepts an `id` column
  (`anyOf: sequence|id`) and a `.faa` extension, so the sheet transfers unmodified.
  proteinfold **1.1.1** requires the column to be named `sequence` and the file to match
  `^\S+\.fa(sta)?$` — `.faa` is rejected. Pin 2.0.0 or the native sheet is not native.
  proteinannotator 1.1.0 takes `id` + `.fa|.fasta|.faa|.fas` (± `.gz`), so it has no such trap.
- **`_reps.faa` is one multi-FASTA holding every family representative**, not one file per
  structure. proteinfold's own documented invocation for this sheet adds `--split_fasta`.

## Verify

```bash
# how many ORFs went in, and how many survived length filtering
zcat <metatdenovo-outdir>/prodigal/*.faa.gz | grep -c '^>'

# families produced
ls <outdir>/

# downstream samplesheets, and the representatives they point at
cat <outdir>/proteinfold/samplesheet.csv <outdir>/proteinannotator/samplesheet.csv
grep -c '^>' <outdir>/proteinfold/*/*_reps.faa
```

## Status

| Step | Status |
|------|--------|
| Samplesheet conversion | **DONE** — one row, 198,252 proteins, accepted by proteinfamilies 2.5.0 |
| proteinfamilies run | **SUCCESS** 2026-08-11 — **405 protein families** |
| Downstream samplesheets | **EMITTED** — `proteinfold/` and `proteinannotator/`, neither consumed by a run yet |

Provenance: <https://cloud.seqera.io/user/vangelis/watch/H1MTwbD6IUKz3>

Full run record: [RUNS.md](../../RUNS.md).
