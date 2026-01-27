# Atomic Task Decomposition Standards
## Breaking Work Into Verifiable Steps

**Last Updated**: 2026-01-27
**Version**: 1.0.0

---

## Core Principle

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   Every task must be broken into ATOMIC steps that are:                       ║
║                                                                               ║
║   1. SMALL - One action, one verification                                    ║
║   2. INDEPENDENT - Can be verified without other steps                       ║
║   3. VERIFIABLE - Has a clear pass/fail test                                 ║
║   4. REVERSIBLE - Can be undone if it fails                                  ║
║                                                                               ║
║   "I fixed the dashboard" is NOT atomic.                                     ║
║   "I verified the database has 3 deals" IS atomic.                           ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Why Atomic Tasks?

| Problem with Big Tasks | Solution with Atomic Tasks |
|------------------------|---------------------------|
| Hard to verify | Each step has clear test |
| Failure is unclear | Know exactly where it broke |
| Can't partially succeed | Each step succeeds or fails |
| Hard to debug | Narrow scope for investigation |
| Easy to fabricate | Evidence is specific and checkable |

---

## Task Decomposition Template

### BAD (Too Broad)

```
Task: Fix the dashboard and chat
```

### GOOD (Atomic)

```
Task: Fix dashboard deals display

Step 1: Verify database state
- Command: SELECT COUNT(*) FROM deals WHERE status='active'
- Expected: Returns count > 0
- Evidence: Raw query output
- Pass/Fail: ___

Step 2: Verify backend API
- Command: curl http://localhost:8091/api/deals
- Expected: JSON array with deals
- Evidence: Raw response (first 500 chars)
- Pass/Fail: ___

Step 3: Verify dashboard API
- Command: curl http://localhost:3003/api/deals
- Expected: JSON array with deals
- Evidence: Raw response (first 500 chars)
- Pass/Fail: ___

Step 4: Identify gap (if any step failed)
- If Step 2 fails: Problem is in backend
- If Step 3 fails: Problem is in dashboard API route
- If all pass but UI shows 0: Problem is in frontend rendering

Step 5: Apply fix
- File modified: ___
- Line changed: ___
- What was changed: ___
- Evidence: git diff output

Step 6: Verify fix in browser
- URL: http://localhost:3003/deals
- Expected: Deals visible in UI
- Evidence: Screenshot or description
- Pass/Fail: ___
```

---

## Atomic Patterns by Task Type

### For Bug Fixes

```
1. Reproduce the bug (evidence: error message/screenshot)
2. Identify root cause (evidence: file:line)
3. Apply minimal fix (evidence: diff)
4. Verify fix works (evidence: test passing)
5. Verify no regression (evidence: other tests still pass)
6. Verify in browser if UI-related (evidence: screenshot)
```

### For New Features

```
1. Understand requirement (evidence: restate in your own words)
2. Identify files to modify (evidence: list with reasons)
3. Implement change (evidence: diff)
4. Test happy path (evidence: test output)
5. Test error cases (evidence: test output)
6. Verify in browser if UI-related (evidence: screenshot)
```

### For Configuration Changes

```
1. Document current state (evidence: current config)
2. Apply change (evidence: new config)
3. Restart affected services (evidence: service status)
4. Verify services healthy (evidence: health checks)
5. Verify functionality (evidence: test output)
```

### For Debugging/Investigation

```
1. State the symptom (evidence: error message)
2. Form hypothesis (evidence: reasoning)
3. Test hypothesis (evidence: test command + output)
4. If wrong, form new hypothesis (repeat)
5. If right, document finding (evidence: root cause identified)
```

---

## Evidence Requirements by Step Type

| Step Type | Required Evidence |
|-----------|------------------|
| Database query | Raw query + output |
| API call | curl command + response |
| Code change | git diff or file diff |
| Build | Command + success/failure |
| Browser check | Screenshot or detailed description |
| Service status | systemctl status or docker ps output |

---

## Gate Pattern

For multi-step tasks, use gates:

```
GATE 0: Pre-flight
- [ ] Environment verified (ports correct)
- [ ] Documentation read (ARCHITECTURE.md, CONSTRAINTS.md)
- [ ] Scope understood

GATE 1: Discovery Complete
- [ ] Current state documented
- [ ] Root cause identified (if bug fix)
- [ ] Approach defined

GATE 2: Implementation Complete
- [ ] Code changes applied
- [ ] No syntax errors
- [ ] Builds successfully

GATE 3: Verification Complete
- [ ] API tests pass
- [ ] Browser verification done (if UI)
- [ ] No regressions

GATE 4: Documentation Complete
- [ ] Changes documented in CHANGES.md
- [ ] Evidence collected
- [ ] Ready for review/commit
```

**Rule: Do not proceed to next gate until current gate passes.**

---

## Anti-Patterns to Avoid

### 1. "It should work"

```
BAD: "I made the change, it should work now"
GOOD: "I made the change. Here's the test showing it works: [evidence]"
```

### 2. Skipping Verification

```
BAD: "Fixed the API" (no evidence)
GOOD: "Fixed the API. curl http://localhost:8091/api/deals returns: [output]"
```

### 3. Combining Steps

```
BAD: "I fixed the database, API, and frontend"
GOOD:
  "Step 1: Fixed database query - [evidence]
   Step 2: Fixed API endpoint - [evidence]
   Step 3: Fixed frontend component - [evidence]"
```

### 4. Vague Evidence

```
BAD: "Tested and it works"
GOOD: "Tested with: curl -X POST http://localhost:8091/api/deals
       Response: {"id": "DL-0004", "status": "created"}
       HTTP 201 confirms creation succeeded"
```

### 5. Assuming Success

```
BAD: "Restarted the service" (no verification)
GOOD: "Restarted the service:
       docker restart zakops-agent-api
       Health check: curl http://localhost:8095/health
       Response: {"status": "healthy"}
       Service confirmed running"
```

---

## Checklist for Every Task

### Before Starting

- [ ] Read docs/ARCHITECTURE.md
- [ ] Read docs/CONSTRAINTS.md
- [ ] Verify environment (ports 8090 dead, 3003/8091/8095 alive)
- [ ] Understand scope clearly

### During Work

- [ ] Break into atomic steps
- [ ] Collect evidence for each step
- [ ] Stop if something unexpected happens
- [ ] Don't skip verification steps

### After Completing

- [ ] All steps have evidence
- [ ] Browser verification done (if UI-related)
- [ ] No forbidden patterns used (especially port 8090)
- [ ] Changes documented in /home/zaks/bookkeeping/CHANGES.md
- [ ] Ready for commit

---

## Example: Complete Atomic Task

### Task: Fix chat returning fallback responses

```
GATE 0: Pre-flight ✅
- [x] Read ARCHITECTURE.md - understood chat flow
- [x] Read CONSTRAINTS.md - noted auth requirement
- [x] Verified ports: 8090 dead ✅, 3003 ✅, 8091 ✅, 8095 ✅

GATE 1: Discovery ✅
Step 1.1: Check Agent API health
  Command: curl http://localhost:8095/health
  Output: {"status": "healthy"}
  Result: PASS - Agent API is running

Step 1.2: Test chat without auth
  Command: curl -X POST http://localhost:8095/api/v1/chatbot/chat \
           -H "Content-Type: application/json" \
           -d '{"messages":[{"role":"user","content":"test"}]}'
  Output: {"detail": "Not authenticated"}
  Result: 401 - confirms auth is required

Step 1.3: Check if Dashboard sends auth
  File: apps/dashboard/src/app/api/chat/route.ts
  Finding: No X-Service-Token header being sent
  Root cause: Dashboard not authenticating to Agent API

GATE 2: Implementation ✅
Step 2.1: Add service token to config
  File: apps/agent-api/app/core/config.py
  Change: Added DASHBOARD_SERVICE_TOKEN setting
  Evidence: git diff shows +3 lines

Step 2.2: Add flexible auth dependency
  File: apps/agent-api/app/api/v1/auth.py
  Change: Created get_session_or_service() function
  Evidence: git diff shows +55 lines

Step 2.3: Update chatbot to use flexible auth
  File: apps/agent-api/app/api/v1/chatbot.py
  Change: Changed dependency from get_current_session to get_session_or_service
  Evidence: git diff shows 2 lines changed

Step 2.4: Update Dashboard to send token
  File: apps/dashboard/src/app/api/chat/route.ts
  Change: Added X-Service-Token header
  Evidence: git diff shows +8 lines

GATE 3: Verification ✅
Step 3.1: Test with service token
  Command: curl -X POST http://localhost:8095/api/v1/chatbot/chat \
           -H "Content-Type: application/json" \
           -H "X-Service-Token: <token>" \
           -d '{"messages":[{"role":"user","content":"test"}]}'
  Output: {"messages": [{"role": "assistant", "content": "Hello!..."}]}
  Result: PASS - 200 OK with real response

Step 3.2: Rebuild and restart Dashboard
  Command: docker compose build --no-cache dashboard && docker compose up -d dashboard
  Result: Container recreated successfully

Step 3.3: Test through Dashboard
  Command: curl -X POST http://localhost:3003/api/chat \
           -H "Content-Type: application/json" \
           -d '{"query": "What is 2+2?"}'
  Output: {"messages": [..., {"content": "2 + 2 equals 4"}]}
  Result: PASS - Real LLM response, not fallback

GATE 4: Documentation ✅
- [x] Added entry to /home/zaks/bookkeeping/CHANGES.md
- [x] Committed with descriptive message
- [x] Evidence packet complete
```

---

## Quick Reference: Step Evidence Types

```
┌─────────────────┬─────────────────────────────────────┐
│ Action          │ Required Evidence                   │
├─────────────────┼─────────────────────────────────────┤
│ API test        │ curl command + full response        │
│ Code change     │ git diff or file diff               │
│ Config change   │ Before and after values             │
│ Service restart │ docker ps / systemctl status output │
│ Build           │ Build command + success/error       │
│ Browser test    │ Description or screenshot           │
│ Database query  │ Query + result set                  │
│ Health check    │ Endpoint + response                 │
└─────────────────┴─────────────────────────────────────┘
```
