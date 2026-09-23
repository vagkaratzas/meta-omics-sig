# Run 07 — proteinannotator (annotating run 03's family representatives)

Seventh run of the chain. It annotates the 405 family representatives from
[run 03, proteinfamilies](../03_proteinfamilies/README.md) with protein domains, InterPro
signatures and secondary structure.

- Pipeline: `nf-core/proteinannotator` **1.1.0** (requires Nextflow `>=25.10.4`)
- Input: `proteinannotator/samplesheet.csv`, **published by run 03 itself**. No converter, nothing committed
- Params: [`params.yml`](params.yml). Everything at default

## Why this edge exists

It exercises `proteinfamilies → proteinannotator`, marked **NATIVE** in
[PLAN.md](../../PLAN.md#samplesheet-chaining--validation-table) since 2026-08-11 but never
consumed. PLAN.md's open question 10 names this as the cheapest remaining test of nf-core
samplesheet standardisation, because the file already exists and the only cost is compute.
It is the first handoff in the chain that needs **no conversion step at all**: every edge
exercised so far went through a script in `scripts/converters/`.

It also gives the comparison in [RUNS.md, run 06](../../RUNS.md#metatranscriptome-families-against-metagenome-families)
something to work with. Of run 03's 405 families, 248 match a metagenome family and 157 do
not. Annotation can show what the two groups are.

## Why run 03 and not run 06

Run 03 has 405 representatives and run 06 has 5,864. The handoff is the same either way,
so the smaller set tests it for about 7% of the compute. The databases downloaded here can
then be reused for run 06 (see `params.yml`).

## The input, as emitted

Run 03 set `skip_proteinannotator_samplesheet: false`, so proteinfamilies 2.5.0 published:

```csv
id,fasta
LMO,/.../03_proteinfamilies/family_reps/LMO/LMO_reps.faa
```

proteinannotator 1.1.0's `assets/schema_input.json` requires `id` (no spaces) and `fasta`
matching `.fa|.fasta|.faa|.fas`, optionally `.gz`, and the file must exist. The sheet
satisfies all three, as long as run 03's output directory is still where it was written.
The path is absolute, so if run 03's results were moved, the sheet points nowhere. Check
that before launching:

```bash
cat <run03-outdir>/proteinannotator/samplesheet.csv
ls -l "$(tail -n1 <run03-outdir>/proteinannotator/samplesheet.csv | cut -d, -f2)"
grep -c '^>' "$(tail -n1 <run03-outdir>/proteinannotator/samplesheet.csv | cut -d, -f2)"   # expect 405
```

If the path is stale, record that as a finding rather than editing the sheet quietly: an
absolute path is what makes an emitted sheet break when results are moved.

## Run

```bash
nextflow run nf-core/proteinannotator \
  -r 1.1.0 \
  -profile slurm,singularity \
  -c /path/to/your-site.config \
  -params-file params.yml \
  -resume
```

All five databases (Pfam, FunFam, NMPFams, metagRoot, InterProScan) are downloaded inside
containers on the first run. If a download fails with `unable to resolve host address`,
that is the missing-`/etc/resolv.conf` container problem in
[AGENTS.md](../../AGENTS.md#singularity-containers-without-etcresolvconf-no-dns-in-container),
not a firewall.

## InterProScan needs a bind mount until upstream fixes land

At 1.1.0, `INTERPROSCAN` ignores `--interproscan_db` and reads the container's unpressed
sample database, so any real run fails in `hmmpress`
([nf-core/modules#13009](https://github.com/nf-core/modules/issues/13009)). The default
`interproscan_db_url` (5.72-103.0) also does not match the 5.59-91.0 container
([nf-core/proteinannotator#114](https://github.com/nf-core/proteinannotator/issues/114)).
Workaround used by this run:

1. Download and untar `interproscan-5.59-91.0-64-bit.tar.gz` once, then press its HMMs:
   `python3 setup.py -f interproscan.properties` inside the untarred folder.
2. Bind its `data/` folder over the container's copy, in the site config:

```groovy
process {
    withName: '.*:INTERPROSCAN' {
        containerOptions = '-B <interproscan-5.59-91.0>/data:/usr/local/share/InterProScan/data'
    }
}
```

Remove the bind once the module fix reaches a proteinannotator release.

## Things to know before joining results back to families

- **Headers change.** proteinannotator's SeqKit preprocessing replaces `/` with `_`
  (`seqkit replace -p "/" -r "_"`). Representatives are named `<protein>/<start>-<end>`,
  so `k141_1_1/4-125` comes out as `k141_1_1_4-125`. Apply the same substitution when
  joining annotations to `family_reps/LMO/LMO_meta_mqc.csv` or to the run 06 comparison.
- **Representatives are trimmed to the aligned region.** Domain annotations describe that
  region, not the full ORF.
- **The length filter can drop sequences.** `min_seq_length 30` and duplicate removal
  apply again here. Count what reaches annotation against the 405 that went in.

## Verify

```bash
# the sheet was consumed as emitted: 405 in, and how many survived preprocessing
grep -c '^>' <run03-outdir>/family_reps/LMO/LMO_reps.faa                  # expect 405
ls <outdir>/qc/LMO/

# annotation outputs
ls <outdir>/
ls <outdir>/downloaded_dbs/          # keep for reuse

# still to record in RUNS.md: sequences annotated per source
cat <outdir>/qc/LMO/LMO_after.tsv                   # sequences left after SeqKit
cut -f1 <outdir>/functional_annotation/interproscan/LMO/LMO.tsv | sort -u | wc -l
cut -f4 <outdir>/functional_annotation/interproscan/LMO/LMO.tsv | sort | uniq -c   # hits per member DB
awk -F'\t' '{print NF}' <outdir>/functional_annotation/interproscan/LMO/LMO.tsv | sort -u  # 11 = no InterPro/GO columns
```

## Status

| Step | Status |
|------|--------|
| Samplesheet | **EMITTED** by run 03 on 2026-08-11. Used as-is, no conversion |
| proteinannotator run | **SUCCESS**, 2026-09-22, Nextflow 26.04.4. [Seqera run](https://cloud.seqera.io/user/vangelis/watch/24aruma1zIUWbf) |
| InterProScan | **Needed a workaround.** Container bind of a pressed 5.59-91.0 `data/` folder; see [below](#interproscan-needs-a-bind-mount-until-upstream-fixes-land) |
| Annotation counts | **Not recorded yet.** Run the Verify commands |

Full run record: [RUNS.md, run 07](../../RUNS.md#07--proteinannotator-annotating-the-metatranscriptome-family-representatives).
