# Run 08 — ampliseq (16S V3-V4 amplicons from the LMO amplicon layer)

Eighth run of the chain, and the first to touch the **amplicon** layer. Runs 02–07 used
only the metatranscriptome and metagenome. Fed from
[run 01, fetchngs](../01_fetchngs/README.md) through the converter. detaxizer is not
upstream.

- Pipeline: `nf-core/ampliseq` **2.18.0** (requires Nextflow `>=25.10.4`)
- Input: `samplesheet.csv`, **generated on the cluster**, not committed
- Params: [`params.yml`](params.yml)

## Which edge this exercises

This run uses `fetchngs 1.12.0 → converter → ampliseq`, **not** the native
`--nf_core_pipeline ampliseq` emitter. Run 01 used 1.12.0, which has no ampliseq option.
The native emitter arrived in 1.13.0 and stays unexercised. It will be tested with the
latest fetchngs on another dataset. Here the reads and the converter are already in hand,
so the run costs only the ampliseq compute.

`--target reads` writes `sample,fastq_1,fastq_2`. ampliseq 2.18.0 accepts that spelling:
its schema takes either `sampleID/forwardReads/reverseReads` or `sample/fastq_1/fastq_2`,
and `run` is optional. Sample names such as `LMO_20160315_AMP` match ampliseq's
`^[a-zA-Z][a-zA-Z0-9_]+$`.

## Why detaxizer is not upstream

ampliseq removes phiX itself. Its `DADA2_FILTNTRIM` passes `rm.phix = TRUE` for any
non-PacBio input (`conf/modules.config`, 2.18.0). A detaxizer pass would repeat that
filter. It is also a different edge: `detaxizer → ampliseq` is **CONVERSION REQUIRED**,
and detaxizer excludes ampliseq from `--generate_downstream_samplesheets`.
[Run 04](../04_detaxizer/README.md) filtered only the metatranscriptome, so it holds no
amplicon reads to pass on anyway.

## Primers

The three amplicon studies (PRJEB52780, PRJEB52782, PRJEB52828) describe their reads as
"Bacterial (and some archaeal) V3V4 sequences". The LMO group amplifies V3-V4 with
**341F / 805R**:

- Fridolfsson et al. 2023, *Sci Rep* 13:11865, [doi:10.1038/s41598-023-38816-0](https://doi.org/10.1038/s41598-023-38816-0)
  (PMID 37481661). LMO 2011–2018, 0.2 µm Sterivex, "341F-805R as described and validated
  in Hugerth et al.", MiSeq 2×300, processed with nf-core/ampliseq.
- Martínez-García et al. 2022, *Front Microbiol* 13:834675, [doi:10.3389/fmicb.2022.834675](https://doi.org/10.3389/fmicb.2022.834675)
  (PMID 36212867). LMO 2015–2016 free-living and particle-attached fractions, same primer
  pair, ampliseq with forward reads truncated to 259 bp and reverse reads to 199 bp.
  Its data are PRJEB52496, not one of the three studies used here.
- The primer pair itself: Herlemann et al. 2011, *ISME J* 5:1571–1579,
  [doi:10.1038/ismej.2011.41](https://doi.org/10.1038/ismej.2011.41) (PMID 21472016).
  Hugerth et al. 2014, [doi:10.1128/AEM.01403-14](https://doi.org/10.1128/AEM.01403-14)
  (PMID 24928874) describes the design.

No publication tied to PRJEB52780/82/28 was found, and none of the full texts available
through PubMed prints the sequences. The data author confirmed the sequences in
`params.yml` on 2026-09-23. They are the standard Herlemann sequences:

| Primer | Sequence |
|---|---|
| 341F | `CCTACGGGNGGCWGCAG` |
| 805R | `GACTACHVGGGTATCTAATCC` |

### Check the primers before running

The sequences are confirmed, but the reads could still have had them removed before
submission. cutadapt drops reads that lack the primer, so that would show up as empty
samples, not as an error. Count exact degenerate matches near the start of 10,000 reads
per mate. fetchngs names files `<ERX>_<ERR>_<mate>.fastq.gz`:

```bash
for r in <fetchngs-outdir>/fastq/*_ERR97{15801,17120,26503}_1.fastq.gz; do
  echo "$r $(zcat $r | head -40000 | awk 'NR%4==2' | grep -cE '^.{0,10}CCTACGGG[ACGT]GGC[AT]GCAG')"
done
for r in <fetchngs-outdir>/fastq/*_ERR97{15801,17120,26503}_2.fastq.gz; do
  echo "$r $(zcat $r | head -40000 | awk 'NR%4==2' | grep -cE '^.{0,10}GACTAC[ACT][ACG]GGGTATCTAATCC')"
done
```

Expect most of the 10,000. Near zero means the primers were already removed: set
`skip_cutadapt: true` and record it.

On codon (2026-09-23) R1 matched 9,739–9,825 and R2 9,642–9,804 of 10,000 reads. Every R1 read starts with
4 random bases before 341F (`NNNN CCTACGGGGGGCTGCAG…`). ampliseq 2.18.0 runs cutadapt
with an unanchored `-g`, which removes the primer and everything before it, so the spacer
needs no extra setting. A first version of this check dropped a `G` from the forward
pattern and matched almost nothing; the pattern above is corrected.

## Build the samplesheet

Run from the repo checkout on the cluster:

```bash
python3 scripts/converters/fetchngs_to_reads_samplesheet.py \
    <fetchngs-outdir>/samplesheet/samplesheet.csv \
    runs/08_ampliseq/samplesheet.csv \
    --strategy AMPLICON --target reads
```

Expected: three rows, one per collection date, with no replicate suffix:

```csv
sample,fastq_1,fastq_2
LMO_20160315_AMP,.../ERX9265004_ERR9715801_1.fastq.gz,.../ERX9265004_ERR9715801_2.fastq.gz
LMO_20160803_AMP,.../ERX..._ERR9717120_1.fastq.gz,.../ERX..._ERR9717120_2.fastq.gz
LMO_20171031_AMP,.../ERX..._ERR9726503_1.fastq.gz,.../ERX..._ERR9726503_2.fastq.gz
```

The dates match the MG and MT sample names from runs 02 and 05, so results can be joined
by date across all three layers.

## Run

```bash
nextflow run nf-core/ampliseq \
  -r 2.18.0 \
  -profile slurm,singularity \
  -c /path/to/your-site.config \
  -params-file runs/08_ampliseq/params.yml \
  -resume
```

The site config must also contain this override, otherwise the run hangs pulling the
`FORMAT_TAXONOMY` image
([nf-core/ampliseq#1081](https://github.com/nf-core/ampliseq/issues/1081); see
"Legacy `containers.biocontainers.pro` `.img` images" in [AGENTS.md](../../AGENTS.md)):

```groovy
process { withName: '.*:FORMAT_TAXONOMY' { ext.singularity_pull_docker_container = true } }
```

## Verify

```bash
# reads surviving each step, per sample: cutadapt, filtering, merging, chimeras
cat <outdir>/overall_summary.tsv

# ASVs and taxonomy
grep -c '^>' <outdir>/dada2/ASV_seqs.fasta
head <outdir>/dada2/ASV_tax.*.tsv
```

In `overall_summary.tsv`, a large loss at the merge step means the truncation lengths
leave too little overlap. A large loss at cutadapt means the primer check above was skipped
or failed.

## Next edges this opens

| Edge | Blocked on |
|---|---|
| `ampliseq → differentialabundance` | three samples, one per date: no replicated condition to test |
| amplicon vs MG / MT taxonomy | a taxonomic profile of the MG and MT layers (taxprofiler, or MAG / family taxonomy) |

## Status

| Step | Status |
|------|--------|
| Primers | **Confirmed**: 341F/805R, sequences confirmed by the data author and found in about 98% of R1 and R2 reads (2026-09-23) |
| Samplesheet | **Done**: converter command above, `--strategy AMPLICON --target reads`, accepted by ampliseq 2.18.0 |
| ampliseq run | **SUCCESS** 2026-09-24: 3 samples, 1,755 ASVs, 54–66% of raw reads retained ([results](#results)) |

## Results

Provenance: <https://cloud.seqera.io/user/vangelis/watch/4suWRAScaxYhzE>. The first launch on
2026-09-23 stalled on the `FORMAT_TAXONOMY` image pull. The run then completed on 2026-09-24
with `-resume` and the override above, and everything up to `BARRNAPSUMMARY` came from cache.

### Read retention (`overall_summary.tsv`)

| Sample | Raw pairs | cutadapt | filter | merge | non-chimeric | Final | Overall |
|---|---|---|---|---|---|---|---|
| LMO_20160315_AMP | 1,100,544 | 99.5% | **71.0%** | 94.4% | 82.8% | 591,380 | 53.7% |
| LMO_20160803_AMP | 275,555 | 99.2% | 90.1% | 94.4% | 82.1% | 181,527 | 65.9% |
| LMO_20171031_AMP | 180,474 | 99.6% | 93.7% | 91.7% | 78.6% | 112,492 | 62.3% |

The filter, merge and non-chimeric columns are the share of the previous step's output that
survives the step. The merge step uses the denoised pairs as its input.

- **Primers and truncation hold.** cutadapt kept over 99% of reads, and 92–94% of denoised
  pairs merged. The ~31 bp overlap left by 259 / 199 is enough.
- **Chimeras removed 17–21% of reads.** That is high but within the normal range for V3-V4.
- **The March sample lost 29% at the quality filter**, against 6–10% for the other two. It is
  also the deepest library (4–6× the others) and comes from a different study (PRJEB52780),
  so a lower-quality sequencing run is the likely cause. The FastQC report was not checked. The
  591,380 reads that remain are the most of any sample.
- **The taxonomy filter removed nothing.** `QIIME2_TABLEFILTERTAXA` ran with
  `taxa:mitochondria,chloroplast` and lost 0 reads. GTDB has no chloroplast or mitochondrial
  lineages, so the default `exclude_taxa` has nothing to match. Any chloroplast 16S reads from the
  spring bloom are still in the table, most likely as Cyanobacteriota or unassigned. That was not
  checked.

### ASVs and taxonomy

Database `sbdi-gtdb` resolved to **R11-RS232-1**. The output file is
`dada2/ASV_tax.sbdi-gtdb_R11-RS232-1.tsv`.

- **1,755 ASVs** in `dada2/ASV_seqs.fasta`.
- **Domain level:** Bacteria make up at least 99.9% of reads in every sample. Archaea make up
  ≤0.014%, and reads unassigned at domain level ≤0.07%.
- **Phylum level, by ASV count:** Pseudomonadota 552, Bacteroidota 280, Actinomycetota 174,
  **unassigned 164 (9.3%)**, Planctomycetota 120, Cyanobacteriota 99, Verrucomicrobiota 76.

**ASV lengths are clean.** 1,739 of 1,755 ASVs (99.1%) are 400–430 bp. There are two peaks,
at 402–407 bp and 420–428 bp; the most common lengths are 402 (340 ASVs) and 427 (332). Two
peaks are expected from V3-V4 length variation between taxa. Only 16 ASVs fall outside
400–430 bp, so there is no sign of off-target amplification.

**Read-weighted phylum profile** (`qiime2/rel_abundance_tables/rel-table-3.tsv`, share of
final reads):

| Phylum | 2016-03-15 | 2016-08-03 | 2017-10-31 |
|---|---|---|---|
| Bacteroidota | **30.5%** | 10.7% | 18.9% |
| Cyanobacteriota | 22.0% | **36.0%** | 8.1% |
| Pseudomonadota | 15.5% | 13.0% | 14.3% |
| Actinomycetota | 12.1% | 10.5% | **36.8%** |
| unassigned at phylum | 4.8% | **13.8%** | 6.8% |
| Planctomycetota | 4.5% | 5.8% | 5.9% |
| Patescibacteriota | 5.3% | 0.2% | 0.1% |
| Verrucomicrobiota | 1.6% | 4.6% | 3.6% |
| Chloroflexota | 2.1% | 1.1% | 0.4% |
| Desulfobacterota | 0.1% | 1.4% | 3.4% |

Each date has a different dominant phylum: Bacteroidota in March, Cyanobacteriota in August
and Actinomycetota in October. The profiles have not yet been compared with the published LMO
time series.

Two numbers need a check before they are interpreted:

- **Cyanobacteriota at 22% in March.** Cyanobacteria are usually a summer signal, and GTDB has
  no chloroplast lineage, so chloroplast 16S could land here. Checked at family level
  (`rel-table-6.tsv`): **no sign of chloroplasts.** In March, 15.2% of reads are Cyanobiaceae
  (the *Synechococcus* / *Cyanobium* family) and 5.5% Phormidesmidaceae. Cyanobacteriia with no
  family assigned, where a chloroplast would most likely fall, are 0.3% in March, 1.4% in August
  and 0.2% in October. This does not rule out chloroplasts forced into a named family.
- **13.8% unassigned at phylum in August.** This could be eukaryotic or chloroplast
  sequences, or bacteria that GTDB does not resolve.

**`sbdi-gtdb` has both a `Domain` and a `Kingdom` column, and both hold the domain name.** QIIME2
therefore counts ranks one level later than usual. `rel-table-2.tsv` is `Bacteria;Bacteria`, not
phylum level. **Phylum is `rel-table-3.tsv`**, and so on down. Take this into account before
comparing these tables with taxprofiler or any other GTDB profile by level number.

### barrnap and the unassigned reads

barrnap found an rRNA gene in 1,754 of 1,755 ASVs. For **1,750** the best-scoring model is
bacterial and for **4** it is archaeal. No ASV scores best against the eukaryotic or the
mitochondrial model. One ASV has no rRNA hit at all. It is probably the phylum-unassigned ASV
missing from a join of the barrnap and taxonomy files (163 unassigned there, against 164 in
the taxonomy file).

**Five ASVs make up most of August's reads with no phylum.** Together they hold 15,822 of
181,527 August reads (8.7%), about 63% of the 13.8% unassigned. barrnap scores all five best as
bacterial. That rules out eukaryotic nuclear rRNA, but not chloroplasts. Chloroplast 16S comes
from cyanobacteria and also scores best against the bacterial model, and barrnap has no
chloroplast model. The ASVs are either chloroplasts or bacteria that GTDB cannot place at
phylum level. Only BLAST or a SILVA classification can tell these apart.

| ASV | Mar | Aug | Oct |
|---|---|---|---|
| `b9a924b9f65ece84b5528ab8d640a6e7` | 1,446 | 6,287 | 48 |
| `83073fd45fe992e623cba8ef4b275cfd` | 236 | 3,939 | 678 |
| `cb8818c331eb97f13778cef034bb3af0` | 1,006 | 2,545 | 1,016 |
| `23e86eb2b1557088fb1b0c7f54772396` | 0 | 1,825 | 0 |
| `8a7a98a1eb1404d3a2cededbd43c5b3c` | 0 | 1,226 | 3 |

### Outputs for the next edges

- `qiime2/abundance_tables/feature-table.tsv` (ASV × sample counts, from the `.biom`) and
  `qiime2/rel_abundance_tables/rel-table-{2..6,ASV}.tsv` exist. These are the inputs for
  `ampliseq → differentialabundance`, which stays blocked because each date has only one sample.
- Sample names are `LMO_<date>_AMP`, the same date keys as the MG and MT runs.

### Resources and retries

- `QIIME2_EXPORT_RELTAX` **failed once with exit 137 at 1 GB** after 16 min, then passed on the
  automatic retry at 2 GB (peak RSS 1.2 GB). The retry handled it; no site-config change needed.
- `DADA2_TAXONOMY` peaked at **19.4 GB of its 20 GB** allocation. A larger reference or more
  ASVs would push it over the limit.
- The longest task was `DADA2_ERR`, at 22 min 47 s.

### Versions (`pipeline_info/software_versions.yml`)

nf-core/ampliseq v2.18.0-g2723d4c · Nextflow 26.04.4 · cutadapt 5.2 · DADA2 1.38.0 (R 4.5.2)
· QIIME2 2026.4.0 · barrnap 0.9 · FastQC 0.12.1 · phyloseq 1.50.0 · TreeSummarizedExperiment 2.10.0

### Not yet checked

- **TODO: classify the five top unassigned ASVs.** Run the sequences in `top_unassigned.fasta`
  (from the commands below) through SILVA SINA (<https://www.arb-silva.de/aligner/>) with "search
  and classify" on. SILVA has chloroplast and mitochondrial lineages, so this decides between
  chloroplast and bacteria GTDB cannot place. NCBI BLAST against nt, with uncultured/environmental
  sequences excluded, is the fallback. This does not block taxprofiler; it only changes how the
  August profile is described.

  ```bash
  TAX=dada2/ASV_tax.sbdi-gtdb_R11-RS232-1.tsv
  awk -F'\t' 'NR>1 && $4==""{print $1}' $TAX > unassigned.txt
  grep -Ff unassigned.txt qiime2/abundance_tables/feature-table.tsv | sort -k3,3gr | head -5 > top_unassigned.tsv
  cut -f1 top_unassigned.tsv | seqkit grep -f - dada2/ASV_seqs.fasta > top_unassigned.fasta
  ```
- Comparison of the profiles with the published LMO time series (Fridolfsson et al. 2023,
  doi:10.1038/s41598-023-38816-0).
