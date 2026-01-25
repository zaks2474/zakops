#!/bin/bash
# Release Ready Gate - Validates repository hygiene for releases
set -e

CYAN='\033[36m'
GREEN='\033[32m'
RED='\033[31m'
RESET='\033[0m'

echo -e "${CYAN}=== Release Ready Gate ===${RESET}"

ERRORS=0

# Check required files exist
REQUIRED_FILES=(
    "LICENSE"
    "README.md"
    "SECURITY.md"
    "CONTRIBUTING.md"
    ".env.example"
    ".github/CODEOWNERS"
)

echo "Checking required files..."
for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo -e "  ${GREEN}✓${RESET} $file"
    else
        echo -e "  ${RED}✗${RESET} $file (MISSING)"
        ((ERRORS++))
    fi
done

# Check LICENSE is Proprietary
echo ""
echo "Checking license type..."
if grep -q "Proprietary" LICENSE 2>/dev/null; then
    echo -e "  ${GREEN}✓${RESET} LICENSE is Proprietary"
else
    echo -e "  ${RED}✗${RESET} LICENSE must be Proprietary"
    ((ERRORS++))
fi

# Check no secrets in tracked files
echo ""
echo "Checking for exposed secrets..."
# Exclude gate scripts and example files from check
if git ls-files | grep -v "release_ready_gate.sh" | grep -v ".env.example" | xargs grep -l "OPENAI_API_KEY=sk-" 2>/dev/null; then
    echo -e "  ${RED}✗${RESET} Found exposed API keys"
    ((ERRORS++))
else
    echo -e "  ${GREEN}✓${RESET} No exposed secrets found"
fi

# Check .env is gitignored
echo ""
echo "Checking .env is gitignored..."
if git check-ignore .env >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${RESET} .env is gitignored"
else
    echo -e "  ${RED}✗${RESET} .env should be in .gitignore"
    ((ERRORS++))
fi

# Summary
echo ""
if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}Release ready gate PASSED${RESET}"
    exit 0
else
    echo -e "${RED}Release ready gate FAILED with $ERRORS error(s)${RESET}"
    exit 1
fi
