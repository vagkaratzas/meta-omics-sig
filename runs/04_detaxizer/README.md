# Run 04 — detaxizer (phiX removal, and the first test of a native downstream samplesheet)

Sits between [run 01, fetchngs](../01_fetchngs/README.md) and a re-run of
[run 02, metatdenovo](../02_metatdenovo/README.md). It is numbered 04 because the numbering
is execution order, not chain order.

- Pipeline: `nf-core/detaxizer` **1.3.0**
- Input: `samplesheet.csv`, **generated on the cluster** — not committed
- Params: [`params.yml`](params.yml)

Two questions, one run:

1. **How much phiX is in the LMO metatranscriptome libraries, and does removing it change
   the co-assembly?** Run 02 co-assembled six libraries into 198,252 predicted proteins.
   Any phiX-derived ORFs in that number are spike-in, not biology.
2. **Does a natively generated nf-core samplesheet actually run?** detaxizer is one of two
   pipelines in the chain that emit one (proteinfamilies is the other, see run 03), and
   nothing has yet consumed a detaxizer-generated sheet. This is the sharpest available
   test of nf-core samplesheet standardisation.

## Why phiX and not human — the maintainer's two suggestions, weighed

The detaxizer maintainer raised both:

> 1. You could have sample handler/lab scientist contamination, and the human DNA from when
>    they sneezed on a sample could cause false positive hits if you have contaminated
>    reference genomes in some of the pipelines (ok probably the fraction will be very low
>    given these are contemporary samples, but still!)
> 2. It would be overkill but you could use detaxizer to remove sequencing spike in controls
>    like phiX

**Point 2 is the stronger one, and it is not overkill.** phiX is not biology. It is a
deliberately added Illumina control that is *supposed* to be absent from the result, it
assembles into contigs, and those contigs yield ORFs. Unlike human reads, there is no
scenario in which keeping phiX is the biologically correct choice, so the filter carries no
risk of removing signal. It also has a measurable downstream consequence in a run this
project has already executed: run 03 clustered 198,252 proteins, and nobody has checked how
many of them are phage φX174.

**Point 1 is worth doing, but as measurement rather than filtering.** The maintainer's own
hedge — "probably the fraction will be very low" — is exactly why the number is interesting:
"how much human is in a Baltic seawater metatranscriptome" is a publishable figure whichever
way it comes out, and it is the evidence the 2026-08-10 scope decision was made without.
What has not changed is the objection to *filtering* on it: dropping metatranscriptome reads
on human k-mer hits, ahead of a co-assembly, risks taking conserved and low-complexity
microbial reads with them. Measure, then decide — do not fold it into the same filter.

So: **neither is overkill, but they are two different jobs.** This run does the phiX filter.
The human quantification is a separate decision, below.

## Compatibility, checked against detaxizer 1.3.0 source

| Question | Answer |
|---|---|
| `fetchngs → detaxizer` samplesheet | **Conversion required.** Columns are `sample, short_reads_fastq_1, short_reads_fastq_2, long_reads_fastq_1` — not `fastq_1/fastq_2`. `--target detaxizer` on the existing converter handles it |
| FASTQ extension | `^([\S\s]*\/)?[^\s\/]+\.f(ast)?q\.gz$` — gzipped only. fetchngs emits `.fastq.gz`, so it passes |
| `detaxizer → metatdenovo` samplesheet | **Conversion required.** `--generate_pipeline_samplesheets` is constrained by `^(taxprofiler\|mag)(?:,(taxprofiler\|mag)){0,1}`; metatdenovo is not in the enum |
| **Do R1 and R2 stay synchronised?** | **Yes.** `MERGE_IDS` unions the per-mate / per-classifier hit lists into one id file per sample, and `modules/local/filter.nf` applies that same list to both mates with `seqkit grep -v -f`. The mate of a removed read is removed too. This is the prerequisite for feeding a co-assembler |
| phiX without a 60 GB database | **Yes.** `--classification_bbduk` takes an arbitrary contaminant FASTA via `--fasta_bbduk`, and with `--classification_kraken2 false` the `KRAKEN2PREPARATION` block never runs, so `kraken2db` is never downloaded |
| Detect-only + samplesheet emitter | **Mutually exclusive.** `GENERATE_DOWNSTREAM_SAMPLESHEETS` is fed `ch_filtered_reads`, which stays `Channel.empty()` unless the filter ran. `--skip_filter true` therefore silently produces no downstream sheets |

### Upstream bug found while checking synchronisation

`modules/local/filter.nf` indexes the id-file array with `${array2[$(COUNTER-1)]}`, which is
command substitution — it runs a command literally named `COUNTER-1` — where
`$((COUNTER-1))` was meant. Every paired-end FILTER task therefore prints
`COUNTER-1: command not found` to stderr, and the subscript collapses to the empty string,
which bash coerces to `0`.

Today that is harmless and in fact *correct*, because `MERGE_IDS` emits one id file per
sample and index 0 is the only valid index. It is a latent hazard rather than a live bug:
the surrounding loop is written as though `array2` were per-mate, and if detaxizer ever
passes per-mate id files, R2 would be silently filtered with R1's ids and the output would
desynchronise — exactly the failure a co-assembler cannot detect. One-character fix.

Filed 2026-08-11: [nf-core/detaxizer#99](https://github.com/nf-core/detaxizer/issues/99).
The `metatdenovo` addition to `--generate_pipeline_samplesheets` is still to file.

## Build the samplesheet

```bash
python3 scripts/converters/fetchngs_to_reads_samplesheet.py \
    <fetchngs-outdir>/samplesheet/samplesheet.csv \
    runs/04_detaxizer/samplesheet.csv \
    --strategy RNA-Seq --target detaxizer
```

`--target detaxizer` only renames the two FASTQ columns; the sample-naming rules are shared
with run 02, so the names match — `LMO_20160315_MT_a` and friends, built from
`collection_date` and never from `sample_alias`. That matters here: run 02 and run 04 must
be comparable sample by sample.

## Get the phiX reference

```bash
curl -sL "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_001422.1&rettype=fasta&retmode=text" \
    > phix174_NC_001422.1.fasta
grep -c '^>' phix174_NC_001422.1.fasta   # 1
```

`NC_001422.1` is Enterobacteria phage φX174, 5,386 bp — the genome Illumina's PhiX Control
v3 is built from. Point `fasta_bbduk` at it in `params.yml`.

## Run

```bash
nextflow run nf-core/detaxizer \
  -r 1.3.0 \
  -profile slurm,singularity \
  -c /path/to/your-site.config \
  -params-file params.yml \
  -resume
```

If Nextflow rejects `nextflow.config` with `Unexpected input: '('`, export
`NXF_SYNTAX_PARSER=v1` — see [AGENTS.md](../../AGENTS.md).

## Feed metatdenovo

```bash
python3 scripts/converters/detaxizer_to_reads_samplesheet.py \
    <detaxizer-outdir> \
    runs/02_metatdenovo/samplesheet.csv
```

Reads `<outdir>/filter/filtered/` and emits `sample,fastq_1,fastq_2`. It handles both
`--filtering_tool` naming schemes (`<sample>_R1_filtered.fastq.gz` from seqkit,
`<sample>_filtered_1.fastq.gz` from bbmap), never picks up `filter/removed/`, and refuses to
write a sheet when one mate of a pair is missing — an orphaned mate must not reach a
co-assembler.

## Verify

```bash
# how many reads were removed as phiX, per library
zcat <outdir>/filter/removed/*_R1_removed.fastq.gz | echo $((`wc -l`/4))

# same as a fraction: compare against the input
zcat <fetchngs-outdir>/fastq/<run>_1.fastq.gz | echo $((`wc -l`/4))

# detaxizer's own tally
cat <outdir>/summary/summary.tsv

# the sheets detaxizer generated for its successors
head <outdir>/downstream_samplesheets/taxprofiler.csv
head <outdir>/downstream_samplesheets/mag-pe.csv
```

Record the phiX fraction per library in [RUNS.md](../../RUNS.md) before re-running
metatdenovo — the comparison against run 02's 198,252 proteins is the point, and it needs
both numbers.

## The human question — a decision, not a step

Quantifying human content needs kraken2, which means the ~60 GB `k2_standard` download this
run deliberately avoids. Two ways to get the number once that cost is accepted:

| Approach | Cost | Caveat |
|---|---|---|
| Separate run with `--classification_kraken2 true`, `--tax2filter 'Homo sapiens'`, `--skip_filter true` | kraken2 DB + one pass | Detect-only, so no reads are altered and **no downstream samplesheets are produced** |
| `--classification_kraken2_post_filtering true` on a filtering run | kraken2 DB + classification of both filtered and removed reads | Classifies the output rather than the input; answers "what survived", not "what came in" |

Do **not** simply add `--classification_kraken2 true` to this run's `params.yml`: with both
classifiers on, `MERGE_IDS` unions their hits and the filter removes human-classified reads
along with phiX, which reintroduces the risk the 2026-08-10 scope decision was made to avoid
and makes the phiX number unrecoverable.

## Status

| Step | Status |
|------|--------|
| `fetchngs → detaxizer` samplesheet conversion | **READY** — `--target detaxizer`, selftested, not yet run |
| `detaxizer → metatdenovo` samplesheet conversion | **READY** — `detaxizer_to_reads_samplesheet.py`, selftested, not yet run |
| phiX reference | Fetch on the cluster, see above |
| detaxizer run | **NOT RUN** |
| metatdenovo re-run on filtered reads | **NOT RUN** — blocked on the above |

Full run record and provenance, once executed: [RUNS.md](../../RUNS.md).
