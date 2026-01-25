#!/bin/bash
# Phase 2 Trust UX Gate
# Verifies that Trust UX components exist and have required features

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=============================================="
echo "Phase 2 Trust UX Gate"
echo "=============================================="

ERRORS=0

# Check ApprovalCard exists
echo "Checking ApprovalCard component..."
if [ ! -f "$REPO_ROOT/apps/dashboard/src/components/approvals/ApprovalCard.tsx" ]; then
    echo "  ❌ ApprovalCard.tsx not found"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ ApprovalCard.tsx exists"

    # Check for required features
    if grep -q "Approve" "$REPO_ROOT/apps/dashboard/src/components/approvals/ApprovalCard.tsx"; then
        echo "  ✓ Approve button found"
    else
        echo "  ❌ Approve button not found"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "Reject" "$REPO_ROOT/apps/dashboard/src/components/approvals/ApprovalCard.tsx"; then
        echo "  ✓ Reject button found"
    else
        echo "  ❌ Reject button not found"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "riskLevel\|risk" "$REPO_ROOT/apps/dashboard/src/components/approvals/ApprovalCard.tsx"; then
        echo "  ✓ Risk level indicator found"
    else
        echo "  ❌ Risk level indicator not found"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Check AuditLogViewer exists
echo ""
echo "Checking AuditLogViewer component..."
if [ ! -f "$REPO_ROOT/apps/dashboard/src/components/audit/AuditLogViewer.tsx" ]; then
    echo "  ❌ AuditLogViewer.tsx not found"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ AuditLogViewer.tsx exists"

    # Check for required features
    if grep -q "actorFilter\|Actor" "$REPO_ROOT/apps/dashboard/src/components/audit/AuditLogViewer.tsx"; then
        echo "  ✓ Actor filter found"
    else
        echo "  ❌ Actor filter not found"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "actionFilter\|Action" "$REPO_ROOT/apps/dashboard/src/components/audit/AuditLogViewer.tsx"; then
        echo "  ✓ Action filter found"
    else
        echo "  ❌ Action filter not found"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "request_id\|requestId" "$REPO_ROOT/apps/dashboard/src/components/audit/AuditLogViewer.tsx"; then
        echo "  ✓ Request ID visible"
    else
        echo "  ❌ Request ID not found"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "Copyable\|clipboard\|copy" "$REPO_ROOT/apps/dashboard/src/components/audit/AuditLogViewer.tsx"; then
        echo "  ✓ Copy functionality found"
    else
        echo "  ❌ Copy functionality not found"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "exportAsJson\|JSON" "$REPO_ROOT/apps/dashboard/src/components/audit/AuditLogViewer.tsx"; then
        echo "  ✓ JSON export found"
    else
        echo "  ❌ JSON export not found"
        ERRORS=$((ERRORS + 1))
    fi

    if grep -q "exportAsCsv\|CSV" "$REPO_ROOT/apps/dashboard/src/components/audit/AuditLogViewer.tsx"; then
        echo "  ✓ CSV export found"
    else
        echo "  ❌ CSV export not found"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Check Trust UX checklist exists
echo ""
echo "Checking documentation..."
if [ ! -f "$REPO_ROOT/docs/ux/TRUST_UX_CHECKLIST.md" ]; then
    echo "  ❌ TRUST_UX_CHECKLIST.md not found"
    ERRORS=$((ERRORS + 1))
else
    echo "  ✓ TRUST_UX_CHECKLIST.md exists"
fi

echo ""
echo "=============================================="

if [ $ERRORS -eq 0 ]; then
    echo "✅ Phase 2 Trust UX Gate PASSED"
    exit 0
else
    echo "❌ Phase 2 Trust UX Gate FAILED ($ERRORS errors)"
    exit 1
fi
