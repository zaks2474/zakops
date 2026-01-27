# ZakOps Agent Constraints
## Behavioral Rules and Forbidden Patterns

**Last Updated**: 2026-01-27
**Version**: 1.0.0

---

## ABSOLUTE CONSTRAINTS (VIOLATION = FAILURE)

### 1. PORT 8090 IS FORBIDDEN

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   PORT 8090 IS A LEGACY SERVICE THAT HAS BEEN DECOMMISSIONED.                ║
║                                                                               ║
║   - DO NOT start any service on port 8090                                    ║
║   - DO NOT reference port 8090 in code                                       ║
║   - DO NOT use claude-code-api.service                                       ║
║   - If you find references to 8090, they are LEGACY and must be removed      ║
║                                                                               ║
║   The Agent API is on PORT 8095. Use that instead.                           ║
║   The Backend API is on PORT 8091.                                           ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 2. BROWSER VERIFICATION REQUIRED

```
API testing (curl) is NOT sufficient proof that UI works.

You MUST verify in actual browser for any UI-related claim:
- Open the page in browser
- Verify expected content appears
- Check browser console for errors
- Check network tab for failed requests

"curl returns 200" ≠ "User sees correct data"
```

### 3. EVIDENCE FOR EVERY CLAIM

```
Every claim you make must have evidence:

CLAIM: "Deals now display correctly"
REQUIRED EVIDENCE:
- Screenshot of deals page showing deals
- OR detailed description of what you observed
- curl output is supporting evidence, not primary proof
```

### 4. NO ASSUMPTIONS ABOUT ARCHITECTURE

```
If you're not sure about:
- Which port a service uses
- How services communicate
- What authentication is required
- What data format is expected

DO NOT GUESS. Read docs/ARCHITECTURE.md or investigate.
```

---

## VERIFICATION STANDARDS

### For API Changes

1. Test the endpoint with curl
2. Verify response matches expected schema
3. Test error cases (invalid input, missing auth)
4. Verify in browser if there's a UI component

### For UI Changes

1. Build/rebuild the application
2. Open in browser (not just check build succeeds)
3. Verify visual appearance
4. Check browser console for errors
5. Check network tab for failed requests

### For Database Changes

1. Verify migration runs without error
2. Query database directly to confirm schema
3. Test API endpoints that use the changed tables
4. Verify UI displays data correctly

### For Configuration Changes

1. Document what was changed and why
2. Verify services restart cleanly
3. Test affected functionality end-to-end

---

## FORBIDDEN PATTERNS

| Pattern | Why Forbidden | Do Instead |
|---------|---------------|------------|
| References to port 8090 | Legacy, decommissioned | Use port 8091 (backend) or 8095 (agent) |
| `claude-code-api` service | Legacy service name | Use `zakops-agent-api` |
| `zakops-api-8090` service | Legacy service | Services masked, do not unmask |
| Hardcoded secrets in code | Security risk | Use environment variables |
| Skipping browser verification | Leads to false "fixed" claims | Always verify in browser |
| Modifying files outside scope | Scope creep | Stay within approved directories |
| `localhost:8090` in code | Legacy URL | Use `localhost:8091` or `localhost:8095` |

---

## SCOPE RULES

### Approved Directories for Most Tasks

```
apps/dashboard/src/          # Frontend code
apps/backend/src/            # Backend code
apps/agent-api/app/          # Agent code
docs/                        # Documentation
deployments/                 # Docker configs
tools/                       # Utility scripts
```

### Requires Explicit Approval

```
/etc/systemd/               # System services
Database migrations         # Schema changes
.env files                  # Config changes (document changes)
```

### Never Modify

```
node_modules/               # Dependencies
.git/                       # Version control
/etc/                       # System configuration
/var/                       # System data
```

---

## SERVICE TOKEN AUTHENTICATION

### Rule: Dashboard Must Authenticate to Agent API

The Agent API requires authentication. Dashboard uses service tokens:

```typescript
// CORRECT: Include service token
const headers = {
  'Content-Type': 'application/json',
  'X-Service-Token': process.env.DASHBOARD_SERVICE_TOKEN
};

// WRONG: No authentication (will get 401)
const headers = {
  'Content-Type': 'application/json'
};
```

### Token Configuration

Both services must have the **same token**:

| Service | Environment Variable | Location |
|---------|---------------------|----------|
| Agent API | `DASHBOARD_SERVICE_TOKEN` | `.env.development` |
| Dashboard | `DASHBOARD_SERVICE_TOKEN` | docker-compose environment |

---

## ERROR RECOVERY

### If You Break Something

1. **Stop immediately** - don't try to "fix forward"
2. **Document what happened** - what command, what error
3. **Check if it's reversible** - can you undo?
4. **Report to user** - be honest about the problem
5. **Propose recovery steps** - don't just say "it's broken"

### If Tests Fail

1. **Read the actual error message** - don't guess
2. **Check if it's your change or pre-existing** - run tests on clean state
3. **Fix the root cause** - don't just make the test pass
4. **Verify the fix** - run tests again

### If You're Stuck

1. **State what you've tried** - don't silently struggle
2. **State what you expected vs. what happened**
3. **Ask for clarification** - it's okay to not know
4. **Don't fabricate progress** - honesty > appearing competent

---

## PRE-FLIGHT CHECKLIST

Before starting ANY task, verify:

```bash
# 1. Port 8090 must be DEAD (legacy)
lsof -i :8090 && echo "FAIL: Legacy port alive" || echo "PASS: 8090 dead"

# 2. Required ports must be ALIVE
for port in 3003 8091 8095; do
  lsof -i :$port > /dev/null 2>&1 && echo "PASS: $port" || echo "FAIL: $port"
done

# 3. Services must be healthy
curl -s http://localhost:3003/api/chat | jq -r '.status' 2>/dev/null || echo "Dashboard: check needed"
curl -s http://localhost:8091/health | jq -r '.status' 2>/dev/null || echo "Backend: check needed"
curl -s http://localhost:8095/health | jq -r '.status' 2>/dev/null || echo "Agent: check needed"
```

---

## DOCUMENTATION RULES

### Always Document

- What you changed and why
- Files modified with line numbers
- Commands run and their output
- How to verify the fix

### Never Skip

- Recording changes in `/home/zaks/bookkeeping/CHANGES.md`
- Committing work with descriptive messages
- Updating relevant documentation if architecture changes

---

## ATOMIC TASK RULES

See `docs/ATOMIC_TASKS.md` for full details.

Key rules:
1. Break every task into small, verifiable steps
2. Each step must have clear pass/fail criteria
3. Collect evidence for each step
4. Stop if something unexpected happens
5. Don't combine multiple changes without intermediate verification

---

## QUICK REFERENCE: CORRECT PORTS

| What | Correct Port | Wrong Port |
|------|--------------|------------|
| Dashboard | 3003 | - |
| Backend API | 8091 | 8090 ❌ |
| Agent API | 8095 | 8090 ❌ |
| PostgreSQL | 5432 | - |
| Redis | 6379 | - |
| RAG (optional) | 8052 | - |

---

## VIOLATION CONSEQUENCES

If you violate these constraints:

1. **Port 8090 usage**: Task rejected, must redo
2. **Missing browser verification**: Claim not accepted
3. **No evidence**: Claim not accepted
4. **Assumption without investigation**: Must investigate first
5. **Breaking production services**: Immediate stop, document, recover

These are not suggestions. They are requirements.
