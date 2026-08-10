# Run 03 — proteinfamilies (families from LMO metatranscriptome ORFs)

Third pipeline of the chain. Clusters the protein sequences predicted by
[run 02, metatdenovo](../02_metatdenovo/README.md) into families and builds family models.

- Pipeline: `nf-core/proteinfamilies` **2.4.0** (requires Nextflow `>=25.10.4`)
- Input: `samplesheet.csv`, **generated on the cluster** — not committed
- Params: [`params.yml`](params.yml)

## Why this edge exists

The metro map routes proteins into proteinfamilies **from mag**, and PLAN.md's validation
table has a single `mag → metapep / proteinfamilies` row. But mag does not emit protein
FASTA — an ORF-calling step is missing from that arrow, which is why it is still OPEN.

metatdenovo, with `--orf_caller prodigal`, **does** emit protein FASTA directly:
`prodigal/<assembly>.faa.gz`, an extension proteinfamilies accepts without modification.
So `metatdenovo → proteinfamilies` is a shorter and better-supported route to
proteinfamilies than the one the diagram draws — and it is an edge the metro map does not
show at all. Recorded as a new row in
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
  -r 2.4.0 \
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

## Verify

```bash
# how many ORFs went in, and how many survived length filtering
zcat <metatdenovo-outdir>/prodigal/*.faa.gz | grep -c '^>'

# families produced
ls <outdir>/
```

## Status

| Step | Status |
|------|--------|
| Samplesheet conversion | **READY** — converter written and selftested |
| proteinfamilies run | BLOCKED on run 02 |

Full run record and provenance: [RUNS.md](../../RUNS.md).
