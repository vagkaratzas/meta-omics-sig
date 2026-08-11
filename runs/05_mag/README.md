# Run 05 — mag (metagenome assembly and binning from the LMO shotgun MG layer)

Fifth pipeline of the chain, and the first to touch the **metagenome** layer — runs 02–04
all worked on the metatranscriptome. Fed directly from
[run 01, fetchngs](../01_fetchngs/README.md); detaxizer is deliberately not upstream.

- Pipeline: `nf-core/mag` **5.5.0**
- Input: `samplesheet.csv`, **generated on the cluster** — not committed
- Params: [`params.yml`](params.yml)

## Why mag, and why now

mag is the chain's biggest hub. Six rows of PLAN.md's validation table hang off it —
magmap, funcscan, phageannotator, phyloplace, metapep/proteinfamilies, seqsubmit — and
none has ever been touched. It is also the prerequisite for `mag → seqsubmit`, the chain's
only exit back to the archive.

It was chosen over `fetchngs → viralmetagenome`, which was considered and rejected for this
pilot: LMO metagenomes are collected **on** a 0.2 µm filter with `library_selection: RANDOM`,
so free virions are in the discarded filtrate; and viralmetagenome is a consensus-genome /
intra-host-variant pipeline whose defaults (`k2_viral`, RVDB reference pool, Virosaurus
annotation, human host removal) target known viruses in enriched samples. Both of its
downstream edges are blocked besides — phageannotator has **no tagged release** and
phyloplace needs per-clade reference inputs no pipeline emits.

## mag emits protein FASTA

mag 5.5.0 `docs/output.md`:

| Published path | Level | Runs by default |
|---|---|---|
| `Annotation/Prodigal/[assembler]-[sample].faa.gz` | whole assembly, gzipped | yes (`skip_prodigal` off) |
| `Annotation/Prokka/[assembler]/[bin]/[assembler]-[binner]-[bin].faa` | per bin | yes (`skip_prokka` off) |

Both extensions are in proteinfamilies' accepted set, so `mag → proteinfamilies` needs a
samplesheet and no ORF-calling step.

The Prodigal file is the more useful of the two here: same tool, same extension and same
assembly-level scope as metatdenovo's `prodigal/<assembly>.faa.gz`. That makes
run 05 → proteinfamilies **directly comparable with run 03** — metagenome-derived versus
metatranscriptome-derived proteins, one ORF caller, one clustering pipeline, one parameter
set.

## Why detaxizer is not upstream

mag removes phiX itself: `keep_phix` defaults off, with a bundled `phix_reference`. Putting
[run 04](../04_detaxizer/README.md) in front of mag would run the same filter twice. On the
MT layer that filter removed 0.000107% of pairs and left nothing detectable in the assembly,
so there is no reason to expect it to matter here either.

The `detaxizer → mag` edge is still worth exercising eventually — it is the sheet mag
rejects, [nf-core/detaxizer#100](https://github.com/nf-core/detaxizer/issues/100) — but
that is a chaining test, not a prerequisite, and it is cheaper once the upstream fix lands
than by hand-patching a sheet now.

## Build the samplesheet

```bash
python3 scripts/converters/fetchngs_to_reads_samplesheet.py \
    <fetchngs-outdir>/samplesheet/samplesheet.csv \
    runs/05_mag/samplesheet.csv \
    --strategy WGS --target mag --group 0
```

Produces three rows, one per collection date:

```csv
sample,group,short_reads_1,short_reads_2,short_reads_platform
LMO_20160315_MG_a,0,.../ERR13967264_1.fastq.gz,.../ERR13967264_2.fastq.gz,ILLUMINA
LMO_20160803_MG_a,0,.../ERR13967258_1.fastq.gz,.../ERR13967258_2.fastq.gz,ILLUMINA
LMO_20171031_MG_a,0,.../ERR13967244_1.fastq.gz,.../ERR13967244_2.fastq.gz,ILLUMINA
```

Validated against mag 5.5.0's `assets/schema_input.json` — accepted, no errors.

`--target mag` is **not** a pure column rename, unlike `reads` and `detaxizer`:

- `short_reads_platform` is copied from fetchngs' `instrument_platform`. ENA uses mag's own
  spellings so `ILLUMINA` transfers unchanged, but the converter checks it against mag's
  enum and refuses long-read platforms rather than passing them through.
- `group` comes from `--group`, because **no upstream pipeline can supply it**. In mag it
  selects which samples share a co-abundance binning set. One group across all three dates
  gives every assembly the differential coverage of the whole series, which is what makes
  binning work; three singleton groups would throw that away.

`group` is the one field automation cannot fill — and it is exactly the field detaxizer
hardcodes to `""` ([#100](https://github.com/nf-core/detaxizer/issues/100)).

## Run

```bash
nextflow run nf-core/mag \
  -r 5.5.0 \
  -profile slurm,singularity \
  -c /path/to/your-site.config \
  -params-file params.yml \
  -resume
```

## The two decisions that dominate cost

| Default | Cost if left alone | Set here |
|---|---|---|
| `skip_gtdbtk` off — GTDB-Tk runs and auto-downloads GTDB | **>100 GB database**, the single largest cost in mag | **skipped** — this run produces contigs, bins and protein FASTA; none of that needs GTDB |
| Six binners on (MetaBAT2, MaxBin2, CONCOCT, COMEBin, MetaBinner, SemiBin2) | a binner benchmark nobody asked for | **MetaBAT2 only** |

Both are reversible once bins are being interpreted rather than handed onward. Note that
skipping GTDB-Tk and CAT also means no `NCBI_lineage` for a future seqsubmit submission.

## Verify

```bash
# assemblies and bins
ls <outdir>/Assembly/MEGAHIT/
ls <outdir>/GenomeBinning/MetaBAT2/bins/

# the protein FASTA that feeds proteinfamilies — assembly level, one per sample
ls <outdir>/Annotation/Prodigal/*.faa.gz
zcat <outdir>/Annotation/Prodigal/*.faa.gz | grep -c '^>'   # compare against run 02's 198,252

# bin quality
cat <outdir>/GenomeBinning/QC/busco_summary.tsv
```

## Next edges this opens

| Edge | Blocked on |
|---|---|
| `mag → proteinfamilies` | nothing — Prodigal `.faa.gz` transfers unchanged. The run-03 comparison |
| `mag → metapep` | metapep 1.0.0 input schema not yet read |
| `mag → funcscan` | funcscan 4.0.0, pinnable, contigs transfer |
| `mag → magmap` | needs `--genomeinfo` (accno, genome_fna) plus its own read samplesheet — two inputs |
| `mag → seqsubmit` | per-MAG submission metadata + ENA credentials as Nextflow secrets |
| `mag → phyloplace` | external `refseqfile` / `refphylogeny` / `model` per row |
| `mag → phageannotator` | **no tagged release** |

## Status

| Step | Status |
|------|--------|
| `fetchngs → mag` samplesheet conversion | **READY** — `--target mag`, selftested, output validated against mag 5.5.0's schema |
| mag run | **NOT RUN** |
| `mag → proteinfamilies` comparison against run 03 | **NOT RUN** — blocked on the above |

Full run record and provenance, once executed: [RUNS.md](../../RUNS.md).
