#!/usr/bin/env bash
# Search one proteinfamilies run's family HMMs against another run's family representatives.
#
# Written for run 03 (metatranscriptome) vs run 06 (metagenome): which metatranscriptome
# families have a counterpart among the metagenome families. Both runs used the same
# pipeline, revision and parameters, so the only thing that differs is the omics layer.
#
# Inputs are proteinfamilies 2.5.0 outputs:
#   hmm/library/<sample>.lib.gz              one gzipped file of concatenated family HMMs
#   family_reps/<sample>/<sample>_reps.faa   one representative sequence per family
#
# Usage:
#   hmmsearch_families.sh HMM_LIB REPS.faa OUT_PREFIX [CPUS]
#
#   # metatranscriptome HMMs vs metagenome representatives
#   hmmsearch_families.sh \
#       <run03-outdir>/hmm/library/LMO_MT_coassembly.lib.gz \
#       <run06-outdir>/family_reps/LMO_MG_pooled/LMO_MG_pooled_reps.faa \
#       output/mt_hmms_vs_mg_reps 8
#
# Swap the inputs (run 06 HMMs vs run 03 reps) for the reverse question: which metagenome
# families have a metatranscriptome counterpart.
#
# Writes OUT_PREFIX.tbl and OUT_PREFIX.domtbl. Summarise with summarise_family_hits.py.
# The E-value cut here is deliberately loose; the real thresholds are applied when
# summarising, so they can be changed without searching again.
#
# HMMER 3.4, the version the pipeline used. To run it from a container instead of PATH:
#   HMMSEARCH="singularity exec <hmmer-3.4-image> hmmsearch" hmmsearch_families.sh ...
set -euo pipefail

if [[ $# -lt 3 ]]; then
    sed -n '2,/^set -euo/p' "$0" | sed '$d; s/^# \{0,1\}//'
    exit 1
fi

lib=$1 reps=$2 out=$3 cpus=${4:-8}
mkdir -p "$(dirname "$out")"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# ponytail: decompress rather than rely on HMMER reading a gzipped HMM file.
zcat -f "$lib" > "$tmp/lib.hmm"

${HMMSEARCH:-hmmsearch} --cpu "$cpus" -E 1e-3 --domE 1e-3 --noali -o /dev/null \
    --tblout "$out.tbl" --domtblout "$out.domtbl" \
    "$tmp/lib.hmm" "$reps"

echo "models searched: $(grep -c '^NAME ' "$tmp/lib.hmm")"
echo "target sequences: $(grep -c '^>' "$reps")"
echo "wrote $out.tbl and $out.domtbl"
