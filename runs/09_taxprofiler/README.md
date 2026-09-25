# Run 09 — taxprofiler (taxonomic profiles of the metatranscriptome, from detaxizer's own samplesheet)

Consumes the output of [run 04, detaxizer](../04_detaxizer/README.md): the six phiX-filtered
metatranscriptome libraries.

- Pipeline: `nf-core/taxprofiler` **2.0.1**, the latest release as of 2026-09-25 (requires
  Nextflow `>=25.10.4`)
- Input: `<detaxizer-outdir>/downstream_samplesheets/taxprofiler.csv`, **as emitted by run 04**
- Databases: `databases.csv`, **built on the cluster**, not committed
- Params: [`params.yml`](params.yml)

## Which edge this exercises

`detaxizer → taxprofiler` is **NATIVE**, and no run has exercised it yet. Run 04 emitted
`taxprofiler.csv` on 2026-08-11 and it validated against taxprofiler 2.0.1, but no run has
consumed it. This would be the second native handoff in the chain. The first was
proteinfamilies → proteinannotator in [run 07](../07_proteinannotator/README.md).
**The sheet must go in exactly as emitted.** Editing it, even with a sed, turns the
result into "conversion required".

What detaxizer 1.3.0 writes (`SAMPLESHEET_TAXPROFILER`):

| Column | Value |
|---|---|
| `sample` | `meta.id`, e.g. `LMO_20160315_MT_a` |
| `run_accession` | the same as `sample`, not the ERR accession |
| `instrument_platform` | `ILLUMINA` |
| `fastq_1`, `fastq_2` | **absolute** paths into `<detaxizer-outdir>/filter/filtered/` |
| `fasta` | empty |

The absolute paths are the fragile part. The sheet only works if run 04's outdir is still
in place, and it breaks if that outdir was moved or cleaned. The fix would belong in the
emitter, not in the sheet.

The sheet has no database column; taxprofiler takes databases from a separate `--databases`
sheet. detaxizer cannot produce that sheet, and should not, so it does not count against
the edge.

MT only, not MG. Only the MT libraries went through detaxizer. Adding the three MG libraries
would mean appending rows by hand, so the sheet would no longer be native. An MG profile
would be a separate run from a converter or fetchngs sheet.

## What is missing before launch

| Item | Status | Size |
|---|---|---|
| Run 04 filtered reads still on disk | **check** (step 1) | — |
| Kraken2 PlusPF-16 (2026-06-26) | **download** | 11.1 GB archive, 14.9 GB untarred |
| sylph GTDB r232 `-c 200` database, `dbv1` | **download** | 24 GB |
| sylph-tax GTDB r232 metadata | **download** | small |
| `databases.csv` | **write** (step 3) | — |

### Why these two databases

- **sylph + GTDB r232** is the same GTDB release as run 08's amplicon taxonomy (sbdi-gtdb
  R11-RS232-1). Amplicon and MT profiles can therefore be compared by taxon name, with no
  taxonomy translation. Use the `dbv1` `.syldb`, not the smaller two-stage `.syl2db`. The
  `.syl2db` format needs sylph 1.0.0, and taxprofiler 2.0.1 ships sylph 0.7.0. The `.syldb`
  format has not changed since sylph 0.5, but step 2 checks that 0.7.0 reads it.
- **Kraken2 PlusPF-16** classifies each read, so it copes with metatranscriptome coverage.
  sylph does not: its abundances assume coverage is roughly even across a genome, and MT
  coverage follows expression. PlusPF also contains protozoa and fungi, which matters
  because a quarter of the MT-only protein families look eukaryotic. The 16 GB cap
  subsamples minimizers, which costs some sensitivity compared with full PlusPF (85 GB).
- **Rejected:** Kraken2 GTDB r226 (501 GB archive), because of its size. MetaPhlAn and
  mOTUs profile marker genes, which assumes DNA copy number and does not hold for an MT
  library.

Either database row can be dropped. taxprofiler runs only the profilers that have both a
`run_*` flag and a database row.

## Step by step

### 1. Check that the input sheet still resolves

```bash
SHEET=<detaxizer-outdir>/downstream_samplesheets/taxprofiler.csv
cat $SHEET
tail -n +2 $SHEET | cut -d, -f4,5 | tr , '\n' | xargs ls -l
```

Expect 6 rows and 12 existing files. If any file is missing, stop. Re-running detaxizer
(run 04, `-resume`) regenerates both the reads and the sheet. Copying reads elsewhere and
fixing the paths would not be a native test.

### 2. Get the databases

```bash
DB=<shared-db-dir>
cd $DB
wget https://genome-idx.s3.amazonaws.com/kraken/k2_pluspf_16_GB_20260626.tar.gz
mkdir k2_pluspf_16gb_20260626 && tar -xzf k2_pluspf_16_GB_20260626.tar.gz -C k2_pluspf_16gb_20260626
ls k2_pluspf_16gb_20260626      # hash.k2d opts.k2d taxo.k2d must be present

wget http://faust.compbio.cs.cmu.edu/sylph-stuff/gtdb-r232-c200-dbv1.syldb
wget https://zenodo.org/records/19646381/files/gtdb_r232_metadata.tsv.gz

# sylph 0.7.0 is the version taxprofiler runs; confirm it reads this database
singularity exec https://depot.galaxyproject.org/singularity/sylph:0.7.0--h919a2d8_0 \
    sylph inspect gtdb-r232-c200-dbv1.syldb | head
```

Pointing taxprofiler at the untarred Kraken2 directory avoids an `UNTAR` task on every
launch. The `.tar.gz` also works as `db_path`. Sources:
[Kraken2 indexes](https://benlangmead.github.io/aws-indexes/k2),
[sylph databases](https://sylph-docs.github.io/pre%E2%80%90built-databases/),
[sylph-tax metadata](https://github.com/bluenote-1577/sylph-tax).

### 3. Build the database sheet

```bash
cat > runs/09_taxprofiler/databases.csv <<EOF
tool,db_name,db_params,db_type,db_path
kraken2,k2_pluspf_16gb_20260626,,short,$DB/k2_pluspf_16gb_20260626
sylph,gtdb_r232_c200,,short,$DB/gtdb-r232-c200-dbv1.syldb
EOF
```

`db_params` stays empty so every profiler runs at its defaults.

### 4. Fill in `params.yml`

Set `input` to `$SHEET`, `databases` to the file above, `sylph_taxonomy` to
`$DB/gtdb_r232_metadata.tsv.gz`, and `outdir`.

### 5. Run

```bash
nextflow run nf-core/taxprofiler \
  -r 2.0.1 \
  -profile slurm,singularity \
  -c /path/to/your-site.config \
  -params-file params.yml \
  -resume
```

No `NXF_SYNTAX_PARSER=v1`, because taxprofiler 2.0.1 has no `check_max`. No module in
2.0.1 points at a legacy `containers.biocontainers.pro` image, so the
[run 08 pull hang](../08_ampliseq/README.md) should not recur.

Resources: `SYLPH_PROFILE` and `KRAKEN2` run at `process_high` (12 CPUs, 72 GB). Both load
their whole database into memory, 24 GB and 15 GB respectively, which fits.

### 6. Verify

```bash
OUT=<taxprofiler-outdir>
ls $OUT/kraken2/k2_pluspf_16gb_20260626/ $OUT/sylph/gtdb_r232_c200/

# classified share per library: the unclassified line of each kraken2 report
grep -P '\tunclassified$' $OUT/kraken2/k2_pluspf_16gb_20260626/*report.txt

# merged tables
ls $OUT/taxpasta/ $OUT/sylph/

# phylum level from sylph, to set against run 08's Table 3
zcat -f $OUT/sylph/sylph_*_combined_reports.tsv | grep -P '\|p__[^|]+\t' | head -20
```

For each library, record the kraken2 classified share, the number of genomes sylph
detected, and the top phyla from each profiler. The comparison with run 08 is by name and
per date. The `_a` and `_b` libraries give two MT profiles for each amplicon profile.

## Status

| Step | Status |
|------|--------|
| Input sheet | **Emitted** by run 04 (2026-08-11), not yet consumed |
| Databases | **Not downloaded** |
| taxprofiler run | **Not run** |

Full run record, once it runs: [RUNS.md](../../RUNS.md).
