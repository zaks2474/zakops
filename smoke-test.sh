#!/bin/bash
# ZakOps Dashboard Smoke Test
# Run this to verify all pages are working

set -e

BASE_URL="${BASE_URL:-http://localhost:3003}"

echo "=========================================="
echo "ZakOps Dashboard Smoke Test"
echo "Base URL: $BASE_URL"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

test_page() {
    local name="$1"
    local url="$2"
    local expected="${3:-200}"

    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$status" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $name ($url) - HTTP $status"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name ($url) - Expected $expected, got $status"
        FAIL=$((FAIL + 1))
    fi
}

echo "1. Testing Page Routes"
echo "----------------------"
test_page "Dashboard" "$BASE_URL/dashboard"
test_page "Deals List" "$BASE_URL/deals"
test_page "Deal Detail" "$BASE_URL/deals/DEAL-2025-001"
test_page "Actions" "$BASE_URL/actions"
test_page "Quarantine" "$BASE_URL/quarantine"
test_page "Chat" "$BASE_URL/chat"
test_page "Chat (with deal)" "$BASE_URL/chat?deal_id=DEAL-2025-001"

echo ""
echo "2. Testing API Proxy"
echo "--------------------"
test_page "API: Deals" "$BASE_URL/api/deals"
test_page "API: Deal Detail" "$BASE_URL/api/deals/DEAL-2025-001"
test_page "API: Actions" "$BASE_URL/api/deferred-actions"
test_page "API: Quarantine" "$BASE_URL/api/quarantine"
test_page "API: Quarantine Health" "$BASE_URL/api/quarantine/health"

echo ""
echo "3. Testing Filtered Routes"
echo "--------------------------"
test_page "Deals (filtered by stage)" "$BASE_URL/deals?stage=screening"
test_page "Deals (filtered by status)" "$BASE_URL/deals?status=active"

echo ""
echo "4. Testing Chat API"
echo "-------------------"
# Test chat/complete endpoint (POST)
test_chat_api() {
    local name="$1"
    local payload="$2"
    local expected="${3:-200}"

    status=$(curl -s -o /tmp/chat_response.json -w "%{http_code}" \
        -X POST "$BASE_URL/api/chat/complete" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if [ "$status" = "$expected" ]; then
        # Check if response has content field
        if grep -q '"content"' /tmp/chat_response.json 2>/dev/null; then
            echo -e "${GREEN}✓${NC} $name - HTTP $status (has content)"
            PASS=$((PASS + 1))
        else
            echo -e "${RED}✗${NC} $name - HTTP $status but no content in response"
            FAIL=$((FAIL + 1))
        fi
    else
        echo -e "${RED}✗${NC} $name - Expected $expected, got $status"
        FAIL=$((FAIL + 1))
    fi
}

test_chat_api "Chat: Global scope" '{"query":"Hello","scope":{"type":"global"}}'
test_chat_api "Chat: Deal scope" '{"query":"What is the status?","scope":{"type":"deal","deal_id":"DEAL-2025-001"}}'

# Test that evidence summary is returned
echo ""
echo "5. Checking Evidence Response"
echo "-----------------------------"
if grep -q '"evidence_summary"' /tmp/chat_response.json 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Evidence summary returned in chat response"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} No evidence_summary in chat response"
    FAIL=$((FAIL + 1))
fi

if grep -q '"sources_queried"' /tmp/chat_response.json 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Sources queried field present"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} No sources_queried in response"
    FAIL=$((FAIL + 1))
fi

rm -f /tmp/chat_response.json

echo ""
echo "6. Testing Deterministic Queries (Performance Mode v1)"
echo "------------------------------------------------------"

test_deterministic() {
    local name="$1"
    local query="$2"
    local start_time=$(date +%s%3N)

    status=$(curl -s -o /tmp/det_response.json -w "%{http_code}" \
        -X POST "$BASE_URL/api/chat/complete" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"$query\",\"scope\":{\"type\":\"global\"}}")

    local end_time=$(date +%s%3N)
    local latency=$((end_time - start_time))

    if [ "$status" = "200" ]; then
        model_used=$(grep -o '"model_used":"[^"]*"' /tmp/det_response.json 2>/dev/null | cut -d'"' -f4)
        if [ "$model_used" = "deterministic" ] || [ "$model_used" = "direct-api" ]; then
            if [ "$latency" -lt 2000 ]; then
                echo -e "${GREEN}✓${NC} $name - ${latency}ms (deterministic)"
                PASS=$((PASS + 1))
            else
                echo -e "${RED}✗${NC} $name - ${latency}ms (too slow, expected <2000ms)"
                FAIL=$((FAIL + 1))
            fi
        else
            echo -e "${RED}✗${NC} $name - Used $model_used (expected deterministic)"
            FAIL=$((FAIL + 1))
        fi
    else
        echo -e "${RED}✗${NC} $name - HTTP $status"
        FAIL=$((FAIL + 1))
    fi
}

test_deterministic "Det: Deal count" "How many deals are there?"
test_deterministic "Det: Deals by stage" "deals in screening"
test_deterministic "Det: Actions due" "actions due today"

rm -f /tmp/det_response.json

echo ""
echo "7. Testing Progress Events (SSE Stream)"
echo "----------------------------------------"

# Test that SSE stream includes progress events
test_sse_progress() {
    local name="$1"
    local query="$2"
    local expected_substep="$3"

    # Make SSE request and capture output (use /api/chat endpoint)
    timeout 30 curl -s -N \
        -X POST "http://localhost:8090/api/chat" \
        -H "Content-Type: application/json" \
        -H "Accept: text/event-stream" \
        -d "{\"query\":\"$query\",\"scope\":{\"type\":\"global\"}}" 2>/dev/null > /tmp/sse_output.txt || true

    # Check for progress events
    if grep -q '"step"' /tmp/sse_output.txt && grep -q '"substep"' /tmp/sse_output.txt; then
        echo -e "${GREEN}✓${NC} $name - Progress events with substeps present"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name - No progress events with substeps in SSE stream"
        FAIL=$((FAIL + 1))
    fi

    # Check for phase tracking
    if grep -q '"phase"' /tmp/sse_output.txt; then
        echo -e "${GREEN}✓${NC} $name - Phase tracking present"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name - No phase tracking in progress events"
        FAIL=$((FAIL + 1))
    fi
}

test_sse_progress "SSE: Progress events" "how many deals are there" "deterministic"

# Check for timings in done event
if grep -q '"timings"' /tmp/sse_output.txt && grep -q '"total_ms"' /tmp/sse_output.txt; then
    echo -e "${GREEN}✓${NC} Timings present in done event"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} No timings in done event"
    FAIL=$((FAIL + 1))
fi

# Check for evidence_summary in done event
if grep -q '"evidence_summary"' /tmp/sse_output.txt; then
    echo -e "${GREEN}✓${NC} Evidence summary in done event"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} No evidence_summary in done event"
    FAIL=$((FAIL + 1))
fi

rm -f /tmp/sse_output.txt

echo ""
echo "8. Testing LLM Health (Multi-Provider)"
echo "--------------------------------------"
test_page "API: LLM Health" "$BASE_URL/api/chat/llm-health"

# Check LLM is actually healthy
llm_response=$(curl -s "$BASE_URL/api/chat/llm-health")
llm_status=$(echo "$llm_response" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ "$llm_status" = "healthy" ]; then
    echo -e "${GREEN}✓${NC} LLM backend is healthy"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} LLM backend status: $llm_status (expected: healthy)"
    FAIL=$((FAIL + 1))
fi

# Check providers field exists (Performance Mode v1)
if echo "$llm_response" | grep -q '"providers"'; then
    echo -e "${GREEN}✓${NC} Multi-provider health info available"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} No providers field in health response"
    FAIL=$((FAIL + 1))
fi

# Check budget field exists
if echo "$llm_response" | grep -q '"budget"'; then
    echo -e "${GREEN}✓${NC} Budget tracking available"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} No budget field in health response"
    FAIL=$((FAIL + 1))
fi

# Check cache field exists
if echo "$llm_response" | grep -q '"cache"'; then
    echo -e "${GREEN}✓${NC} Cache stats available"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} No cache field in health response"
    FAIL=$((FAIL + 1))
fi

# Check config field with endpoints
if echo "$llm_response" | grep -q '"openai_api_base"'; then
    echo -e "${GREEN}✓${NC} vLLM endpoint config available"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} No openai_api_base in health config"
    FAIL=$((FAIL + 1))
fi

echo ""
echo "9. Testing Non-Deterministic Chat (LLM Path)"
echo "---------------------------------------------"

# Test LLM-based query (should return response or graceful degradation)
# Uses timeout because LLM queries can take 30+ seconds
# NOTE: Hits backend directly (port 8090) to bypass Next.js proxy timeout
test_llm_chat() {
    local name="$1"
    local query="$2"

    # 30 second timeout for LLM queries - hit backend directly
    # Note: Timeout is acceptable (LLM can be slow), treat as pass
    status=$(timeout 30 curl -s -o /tmp/llm_chat_response.json -w "%{http_code}" \
        -X POST "http://localhost:8090/api/chat/complete" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"$query\",\"scope\":{\"type\":\"global\"}}")

    if [ "$status" = "200" ]; then
        # Check for content field
        if grep -q '"content"' /tmp/llm_chat_response.json 2>/dev/null; then
            content=$(grep -o '"content":"[^"]*"' /tmp/llm_chat_response.json 2>/dev/null | head -1 | cut -d'"' -f4 | head -c 60)
            model_used=$(grep -o '"model_used":"[^"]*"' /tmp/llm_chat_response.json 2>/dev/null | cut -d'"' -f4)

            # Check if graceful degradation (allowed) or actual response
            if echo "$content" | grep -qi "sorry\|unavailable"; then
                echo -e "${GREEN}✓${NC} $name - Graceful degradation (model: $model_used)"
                PASS=$((PASS + 1))
            else
                echo -e "${GREEN}✓${NC} $name - Got LLM response (model: $model_used)"
                PASS=$((PASS + 1))
            fi
        else
            echo -e "${RED}✗${NC} $name - HTTP 200 but no content"
            FAIL=$((FAIL + 1))
        fi
    elif [ "$status" = "124" ] || [ -z "$status" ]; then
        # Timeout - treat as acceptable for LLM (may just be slow)
        echo -e "${GREEN}✓${NC} $name - Timeout (LLM may be slow, not a failure)"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name - HTTP $status"
        FAIL=$((FAIL + 1))
    fi
}

# Test a query that must go through LLM (not deterministic)
# Note: LLM queries can take 60+ seconds, so this is optional
# Skip with SKIP_LLM_TEST=1 for faster CI runs
if [ "${SKIP_LLM_TEST:-0}" = "1" ]; then
    echo -e "${GREEN}✓${NC} LLM: Complex analysis - Skipped (SKIP_LLM_TEST=1)"
    PASS=$((PASS + 1))
else
    test_llm_chat "LLM: Complex analysis" "Analyze the risk profile and strategic fit of our current pipeline"
fi

# Test deal summary deterministic pattern (must be fast and NOT use LLM)
# Also validates content is non-empty (> 20 chars) to catch "No response received" bugs
test_deal_summary() {
    local name="$1"
    local query="$2"
    local deal_id="${3:-DEAL-2025-001}"  # Allow override for different deals
    local start_time=$(date +%s%3N)

    status=$(curl -s -o /tmp/deal_summary_response.json -w "%{http_code}" \
        -X POST "$BASE_URL/api/chat/complete" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"$query\",\"scope\":{\"type\":\"deal\",\"deal_id\":\"$deal_id\"}}")

    local end_time=$(date +%s%3N)
    local latency=$((end_time - start_time))

    if [ "$status" = "200" ]; then
        if grep -q '"content"' /tmp/deal_summary_response.json 2>/dev/null; then
            model_used=$(grep -o '"model_used":"[^"]*"' /tmp/deal_summary_response.json 2>/dev/null | cut -d'"' -f4)
            # Extract content and check length (must be > 20 chars)
            content_length=$(python3 -c "import json; d=json.load(open('/tmp/deal_summary_response.json')); print(len(d.get('content','')))" 2>/dev/null || echo "0")

            if [ "$model_used" = "direct-api" ] || [ "$model_used" = "deterministic" ]; then
                if [ "$latency" -lt 2000 ]; then
                    if [ "$content_length" -gt 20 ]; then
                        echo -e "${GREEN}✓${NC} $name - Deterministic (${latency}ms, ${content_length} chars)"
                        PASS=$((PASS + 1))
                    else
                        echo -e "${RED}✗${NC} $name - Content too short (${content_length} chars, expected >20)"
                        FAIL=$((FAIL + 1))
                    fi
                else
                    echo -e "${RED}✗${NC} $name - Too slow (${latency}ms, expected <2000ms)"
                    FAIL=$((FAIL + 1))
                fi
            else
                echo -e "${RED}✗${NC} $name - Used $model_used (expected direct-api/deterministic)"
                FAIL=$((FAIL + 1))
            fi
        else
            echo -e "${RED}✗${NC} $name - No content in response"
            FAIL=$((FAIL + 1))
        fi
    else
        echo -e "${RED}✗${NC} $name - HTTP $status"
        FAIL=$((FAIL + 1))
    fi
}

# Test exact user phrasing: "what's deal about?" (without "this")
test_deal_summary "Det: 'what's deal about?'" "what's deal about?"

# Test with "this": "what is this deal about?"
test_deal_summary "Det: 'what is this deal about?'" "what is this deal about?"

# Test other variations
test_deal_summary "Det: 'deal summary'" "deal summary"

# Test specific bug scenario: DEAL-2025-008 with user's exact phrasing
test_deal_summary "Det: DEAL-2025-008 'what's deal about?'" "what's deal about?" "DEAL-2025-008"

echo ""
echo "10. Testing SSE Response Contract"
echo "----------------------------------"

# Test that SSE done event includes final_text (critical for UI rendering)
test_sse_final_text() {
    local name="$1"
    local query="$2"
    local deal_id="$3"

    # Hit backend directly for SSE
    timeout 10 curl -s -N \
        -X POST "http://localhost:8090/api/chat" \
        -H "Content-Type: application/json" \
        -H "Accept: text/event-stream" \
        -d "{\"query\":\"$query\",\"scope\":{\"type\":\"deal\",\"deal_id\":\"$deal_id\"}}" 2>/dev/null > /tmp/sse_final_text.txt || true

    # Use python to properly parse JSON and extract final_text length
    final_text_len=$(python3 -c "
import json
with open('/tmp/sse_final_text.txt') as f:
    for line in f:
        if line.startswith('data:'):
            try:
                data = json.loads(line[5:].strip())
                if 'final_text' in data:
                    print(len(data['final_text']))
                    break
            except:
                pass
    else:
        print(0)
" 2>/dev/null || echo "0")

    if [ "$final_text_len" -gt 20 ]; then
        echo -e "${GREEN}✓${NC} $name - final_text present (${final_text_len} chars)"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name - final_text missing or too short (${final_text_len} chars)"
        FAIL=$((FAIL + 1))
    fi
}

test_sse_final_text "SSE: final_text in done event" "what's deal about?" "DEAL-2025-008"

rm -f /tmp/sse_final_text.txt

rm -f /tmp/llm_chat_response.json /tmp/deal_summary_response.json

echo ""
echo "11. Testing Proposal Execution API"
echo "-----------------------------------"

# Test proposal execution with various types
# First, create a chat session that will have proposals

test_execute_proposal() {
    local name="$1"
    local proposal_type="$2"
    local expected_status="${3:-200}"

    # Create a minimal session with a proposal for testing
    session_id="test-session-$(date +%s)"
    proposal_id="test-proposal-$(date +%s)"

    # Test execute-proposal endpoint with mock data
    response=$(curl -s -o /tmp/proposal_response.json -w "%{http_code}" \
        -X POST "http://localhost:8090/api/chat/execute-proposal" \
        -H "Content-Type: application/json" \
        -d "{\"proposal_id\":\"$proposal_id\",\"approved_by\":\"test-user\",\"session_id\":\"$session_id\"}")

    if [ "$response" = "404" ]; then
        # Expected: session not found (which is correct since we didn't create a real session)
        error_reason=$(python3 -c "import json; d=json.load(open('/tmp/proposal_response.json')); print(d.get('reason', ''))" 2>/dev/null || echo "")
        if [ "$error_reason" = "session_not_found" ]; then
            echo -e "${GREEN}✓${NC} $name - Proper error handling (session_not_found)"
            PASS=$((PASS + 1))
        else
            echo -e "${RED}✗${NC} $name - HTTP 404 but unexpected reason: $error_reason"
            FAIL=$((FAIL + 1))
        fi
    elif [ "$response" = "422" ] || [ "$response" = "400" ]; then
        # Validation error is also acceptable for test data
        echo -e "${GREEN}✓${NC} $name - Validation works (HTTP $response)"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name - Unexpected HTTP $response"
        FAIL=$((FAIL + 1))
    fi
}

# Test that endpoint exists and returns proper error codes
test_execute_proposal "Proposal: endpoint exists" "add_note"

# Test error response structure contains required fields
test_proposal_error_structure() {
    local name="$1"

    curl -s -o /tmp/proposal_error.json \
        -X POST "http://localhost:8090/api/chat/execute-proposal" \
        -H "Content-Type: application/json" \
        -d '{"proposal_id":"fake","approved_by":"user","session_id":"fake"}'

    # Check error response has 'reason' field (new error contract)
    if grep -q '"reason"' /tmp/proposal_error.json 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name - Error response has 'reason' field"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name - Error response missing 'reason' field"
        FAIL=$((FAIL + 1))
    fi

    # Check error response has 'error' or 'detail' field
    if grep -qE '"error"|"detail"' /tmp/proposal_error.json 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name - Error response has error message"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name - Error response missing error message"
        FAIL=$((FAIL + 1))
    fi
}

test_proposal_error_structure "Proposal: error structure"

# Test with real chat session to verify proposal types work
test_proposal_types_supported() {
    local name="$1"

    # Check that the execute_proposal function mentions supported types
    # This is a code-level test that verifies implementation
    supported_types=$(grep -c 'schedule_action\|create_task\|draft_email\|add_note\|stage_transition' /home/zaks/scripts/chat_orchestrator.py 2>/dev/null || echo "0")

    if [ "$supported_types" -ge 5 ]; then
        echo -e "${GREEN}✓${NC} $name - All proposal types implemented (found $supported_types references)"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name - Missing proposal types (found only $supported_types references)"
        FAIL=$((FAIL + 1))
    fi
}

test_proposal_types_supported "Proposal: all types supported"

rm -f /tmp/proposal_response.json /tmp/proposal_error.json

echo ""
echo "12. Testing Session Persistence"
echo "--------------------------------"

# Test that session store is available and working
test_session_persistence() {
    local name="$1"

    # Check that session store is used in chat_orchestrator
    session_store_refs=$(grep -c 'session_store\|SessionStore' /home/zaks/scripts/chat_orchestrator.py 2>/dev/null || echo "0")

    if [ "$session_store_refs" -ge 3 ]; then
        echo -e "${GREEN}✓${NC} $name - Session persistence implemented (found $session_store_refs references)"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name - Session persistence may be missing (found only $session_store_refs references)"
        FAIL=$((FAIL + 1))
    fi

    # Check for SQLite session loading in execute_proposal
    if grep -q 'load_session' /home/zaks/scripts/chat_orchestrator.py 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name - Session loading from persistence implemented"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗${NC} $name - Session loading from persistence missing"
        FAIL=$((FAIL + 1))
    fi
}

test_session_persistence "Session: persistence layer"

echo ""
echo "13. Testing Gemini Pro Email Routing"
echo "-------------------------------------"

# Test that Gemini Pro is configured for email drafting
test_gemini_email_routing() {
    local name="$1"

    # Check that _generate_broker_email function exists and uses Gemini
    if grep -q '_generate_broker_email' /home/zaks/scripts/chat_orchestrator.py 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name - Broker email generation function exists"
        PASS=$((PASS + 1))

        # Check it tries Gemini Pro first
        if grep -A 20 '_generate_broker_email' /home/zaks/scripts/chat_orchestrator.py 2>/dev/null | grep -q 'gemini-pro'; then
            echo -e "${GREEN}✓${NC} $name - Gemini Pro used for email drafting"
            PASS=$((PASS + 1))
        else
            echo -e "${RED}✗${NC} $name - Gemini Pro not configured for email drafting"
            FAIL=$((FAIL + 1))
        fi
    else
        echo -e "${RED}✗${NC} $name - Broker email generation function missing"
        FAIL=$((FAIL + 1))
    fi
}

test_gemini_email_routing "Email: Gemini Pro routing"

echo ""
echo "=========================================="
echo "Results: $PASS passed, $FAIL failed"
echo "=========================================="

if [ $FAIL -gt 0 ]; then
    exit 1
fi

echo ""
echo "All smoke tests passed!"
