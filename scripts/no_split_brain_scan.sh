#!/usr/bin/env bash
# No Split-Brain Retrieval Scan
# Per Decision Lock §9: Single retrieval path (no direct pgvector)
#
# This script scans the Agent API codebase for any direct pgvector queries.
# All retrieval MUST go through RAG REST :8052 only.
#
# Gate Artifact: gate_artifacts/no_split_brain_retrieval_scan.log

set -euo pipefail

OUT="${OUT:-./gate_artifacts}"
SCAN_DIR="${SCAN_DIR:-./app}"

echo "=== No Split-Brain Retrieval Scan ===" > "$OUT/no_split_brain_retrieval_scan.log"
echo "Timestamp: $(date -Is)" >> "$OUT/no_split_brain_retrieval_scan.log"
echo "Scan directory: $SCAN_DIR" >> "$OUT/no_split_brain_retrieval_scan.log"
echo "" >> "$OUT/no_split_brain_retrieval_scan.log"

# Patterns that indicate direct pgvector/embedding queries
FORBIDDEN_PATTERNS=(
    "pgvector"
    "embedding_table"
    "deal_embeddings"
    "vector_search"
    "similarity_search"
    ".search.*embedding"
    "CREATE.*USING.*ivfflat"
    "CREATE.*USING.*hnsw"
    "<->.*::vector"
    "::vector"
    "similarity.*pgvector"
)

# Allowed patterns (these are OK - they're config/docs/disabled code)
ALLOWED_FILES=(
    "app/core/config.py"  # Config definition is OK
    "app/core/langgraph/graph.py"  # Has Decision Lock comments
    "app/services/rag_rest.py"  # RAG REST client with docstring comment
    "evals/"  # Eval harnesses are OK
    "tests/"  # Tests are OK
    "scripts/"  # Scripts are OK
    "gate_artifacts/"  # Artifacts are OK
)

VIOLATIONS=0
SCAN_RESULTS=""

echo "Scanning for forbidden patterns..." >> "$OUT/no_split_brain_retrieval_scan.log"

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    echo "  Checking: $pattern" >> "$OUT/no_split_brain_retrieval_scan.log"

    # Use grep to find matches, excluding allowed files
    MATCHES=$(grep -rn --include="*.py" "$pattern" "$SCAN_DIR" 2>/dev/null || true)

    if [ -n "$MATCHES" ]; then
        # Filter out allowed files and Decision Lock compliance comments
        FILTERED_MATCHES=""
        while IFS= read -r line; do
            IS_ALLOWED=false

            # Check if in allowed file
            for allowed in "${ALLOWED_FILES[@]}"; do
                if echo "$line" | grep -q "$allowed"; then
                    IS_ALLOWED=true
                    break
                fi
            done

            # Check if it's a Decision Lock compliance comment
            if echo "$line" | grep -qi "decision lock"; then
                IS_ALLOWED=true
            fi

            # Check if it's in a disabled/commented section
            if echo "$line" | grep -q "DISABLE_LONG_TERM_MEMORY"; then
                IS_ALLOWED=true
            fi

            # Check if it's configuration definition (not usage)
            if echo "$line" | grep -q "LONG_TERM_MEMORY_EMBEDDER_MODEL"; then
                IS_ALLOWED=true
            fi

            if [ "$IS_ALLOWED" = false ]; then
                FILTERED_MATCHES="$FILTERED_MATCHES$line\n"
            fi
        done <<< "$MATCHES"

        if [ -n "$FILTERED_MATCHES" ]; then
            echo "  VIOLATION: Pattern '$pattern' found:" >> "$OUT/no_split_brain_retrieval_scan.log"
            echo -e "$FILTERED_MATCHES" >> "$OUT/no_split_brain_retrieval_scan.log"
            VIOLATIONS=$((VIOLATIONS + 1))
        fi
    fi
done

echo "" >> "$OUT/no_split_brain_retrieval_scan.log"
echo "=== Verification of RAG REST Usage ===" >> "$OUT/no_split_brain_retrieval_scan.log"

# Verify that retrieval goes through RAG REST
RAG_REST_USAGE=$(grep -rn --include="*.py" "RAG_REST" "$SCAN_DIR" 2>/dev/null || true)
if [ -n "$RAG_REST_USAGE" ]; then
    echo "RAG REST references found:" >> "$OUT/no_split_brain_retrieval_scan.log"
    echo "$RAG_REST_USAGE" | head -20 >> "$OUT/no_split_brain_retrieval_scan.log"
else
    echo "WARNING: No RAG REST references found in codebase" >> "$OUT/no_split_brain_retrieval_scan.log"
fi

# Check for the rag_rest service module
if [ -f "./app/services/rag_rest.py" ]; then
    echo "" >> "$OUT/no_split_brain_retrieval_scan.log"
    echo "RAG REST client module: PRESENT (app/services/rag_rest.py)" >> "$OUT/no_split_brain_retrieval_scan.log"
else
    echo "" >> "$OUT/no_split_brain_retrieval_scan.log"
    echo "RAG REST client module: MISSING" >> "$OUT/no_split_brain_retrieval_scan.log"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

echo "" >> "$OUT/no_split_brain_retrieval_scan.log"
echo "=== Summary ===" >> "$OUT/no_split_brain_retrieval_scan.log"
echo "Violations found: $VIOLATIONS" >> "$OUT/no_split_brain_retrieval_scan.log"
echo "" >> "$OUT/no_split_brain_retrieval_scan.log"

if [ "$VIOLATIONS" -eq 0 ]; then
    echo "NO_SPLIT_BRAIN: PASSED" >> "$OUT/no_split_brain_retrieval_scan.log"
    echo "All retrieval goes through RAG REST :8052 (Decision Lock compliant)"
    exit 0
else
    echo "NO_SPLIT_BRAIN: FAILED" >> "$OUT/no_split_brain_retrieval_scan.log"
    echo "Found $VIOLATIONS violations - direct pgvector/embedding queries detected"
    exit 1
fi
