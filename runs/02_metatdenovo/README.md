# Run 02 — metatdenovo (LMO pilot metatranscriptome)

Second pipeline of the chain. Co-assembles the six metatranscriptome libraries fetched in
[run 01](../01_fetchngs/README.md), calls ORFs, and — the reason for the parameter choices
below — emits a protein FASTA that feeds [run 03, proteinfamilies](../03_proteinfamilies/README.md).

- Pipeline: `nf-core/metatdenovo` **1.4.0** (requires Nextflow `>=25.10.4`)
- Input: `samplesheet.csv`, **generated on the cluster** — not committed
- Params: [`params.yml`](params.yml)
- Input volume: 6 runs, ~27 GB

Modern nf-core template — `NXF_SYNTAX_PARSER=v1` is **not** needed here, unlike fetchngs.

## Build the samplesheet

fetchngs cannot emit a metatdenovo samplesheet (`--nf_core_pipeline` enum is
`[rnaseq, atacseq, viralrecon, taxprofiler]`), so the conversion is explicit:

```bash
python3 scripts/converters/fetchngs_to_reads_samplesheet.py \
    <fetchngs-outdir>/samplesheet/samplesheet.csv \
    runs/02_metatdenovo/samplesheet.csv \
    --strategy RNA-Seq
```

metatdenovo 1.4.0 requires only `sample,fastq_1,fastq_2` — so the conversion is a column
subset plus, critically, a **sample rename**. fetchngs sets `sample` to the ENA experiment
accession, which would label every downstream result `ERX11668914`. The converter builds
names from `collection_date` (never `sample_alias`, whose LMO metagenome dates are stale)
and the replicate suffix:

| Generated sample | Run | Date | Replicate |
|------------------|-----|------|-----------|
| `LMO_20160315_MT_a` | ERR12258632 | 2016-03-15 | a |
| `LMO_20160315_MT_b` | ERR12258633 | 2016-03-15 | b |
| `LMO_20160803_MT_a` | ERR12258650 | 2016-08-03 | a |
| `LMO_20160803_MT_b` | ERR12258651 | 2016-08-03 | b |
| `LMO_20171031_MT_a` | ERR12258626 | 2017-10-31 | a |
| `LMO_20171031_MT_b` | ERR12258627 | 2017-10-31 | b |

The converter refuses to write a sheet with duplicate sample names, and
`--selftest` asserts that a stale alias date can never leak into a name.

## Run

```bash
nextflow run nf-core/metatdenovo \
  -r 1.4.0 \
  -profile slurm,singularity \
  -c /path/to/your-site.config \
  -params-file params.yml \
  -resume
```

## Why these parameters

**One co-assembly, not six.** The workflow collects all reads with `.toList()`/`.collect()`
before calling the assembler, so six libraries produce **one** assembly, **one** ORF set,
and therefore **one** protein FASTA — a single row for proteinfamilies. The six libraries
remain separate for read counting, which is what the per-sample quantification needs.

**`assembler: megahit`.** rnaSPAdes over a co-assembly of ~320 M read pairs is
memory-brutal; megahit is designed for this shape. `spades` with `spades_flavor: rna` is
the alternative if transcript contiguity proves limiting.

**`orf_caller: prodigal`** — this is the parameter that makes the proteinfamilies handoff
work at all:

| ORF caller | Published protein file | proteinfamilies accepts it? |
|------------|------------------------|------------------------------|
| **prodigal** | `prodigal/<assembly>.faa.gz` | **yes** |
| prokka | `prokka/prokka.faa.gz` | yes, but far slower here |
| transdecoder | `transdecoder/*.transdecoder.pep.gz` | **no — `.pep` fails schema validation** |

proteinfamilies' `assets/schema_input.json` only accepts `.fa`, `.fasta`, `.faa`, `.fas`
(optionally `.gz`). Switching to transdecoder therefore requires renaming its output as
well, or the next pipeline refuses the file.

prodigal also suits the biology: the 0.2 µm free-living fraction is bacteria-dominated and
the paired amplicon layer is 16S.

**`skip_eggnog` / `skip_kofamscan` / `skip_eukulele`.** All three run by default and each
wants a large database (eggnog alone is ~50 GB; `eukulele_db` has no default at all). This
run exists to produce the assembly, the ORFs and the protein FASTA. Annotation is a
separate concern and can be switched back on once the chain is validated.

## Verify before handing off

```bash
# exactly one protein FASTA, from one co-assembly
ls -l <outdir>/prodigal/*.faa.gz

# it is real protein sequence, not nucleotide
zcat <outdir>/prodigal/*.faa.gz | head -2
zcat <outdir>/prodigal/*.faa.gz | grep -c '^>'      # ORF count

# extension is one proteinfamilies accepts (.faa.gz)
ls <outdir>/prodigal/ | grep -E '\.(fa|fasta|faa|fas)(\.gz)?$'
```

## Status

| Step | Status |
|------|--------|
| Samplesheet conversion | **DONE** — converted sheet accepted by metatdenovo |
| metatdenovo co-assembly + ORF calling | **SUCCESS** 2026-08-11 — 198,252 predicted proteins |
| `.faa.gz` handed to proteinfamilies | **DONE** — run 03 started on it |

Full run record and provenance: [RUNS.md](../../RUNS.md).
