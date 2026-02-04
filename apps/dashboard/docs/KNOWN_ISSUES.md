# Known Issues Registry

This document tracks known issues, their root causes, and applied fixes.

---

## ZK-SCHEMA-001: ZodError "Expected string, received null"

**Status:** RESOLVED (2026-02-04)

### Symptoms
- Browser console shows ZodError validation failures
- Errors: "Expected string, received null" for fields like `subject`, `email_subject`, `received_at`
- `invalid_union` errors with paths like `[0, "subject"]`
- Dashboard functionality works but console is polluted with errors

### Root Cause
Zod schemas used `.optional()` modifier which only handles **MISSING** fields (undefined), but fails when backend returns explicit `null` values.

```typescript
// BEFORE (FAILS on null):
email_subject: z.string().optional()

// AFTER (WORKS):
email_subject: z.string().nullable().optional()
```

### Zod Behavior Reference
| Modifier | Handles `undefined` | Handles `null` |
|----------|---------------------|----------------|
| `.optional()` | YES | NO |
| `.nullable()` | NO | YES |
| `.nullable().optional()` | YES | YES |

### Fix Applied
1. Changed all optional string/array/number fields to `.nullable().optional()` pattern
2. Added `.passthrough()` to all response schemas to allow extra fields
3. Verified with fresh dashboard compilation

### Files Modified
- `src/lib/api.ts` — QuarantineItemSchema, QuarantinePreviewSchema, DealMaterialsSchema, ActionSchema, EventSchema, AlertSchema, Agent*Schema
- `src/lib/api-schemas.ts` — AuditEntrySchema, ArtifactSchema, DealEventSchema, DealAliasSchema, ActionSchema

### Prevention
- **Pattern:** Always use `.nullable().optional()` for optional fields in API response schemas
- **Verification:** Run `scripts/validate-schemas.sh` before committing schema changes
- **Testing:** Test with data containing explicit `null` values

### Related
- Commit: SCHEMA-GUARD-001 regression guard
- QA Report: QA VERIFICATION + REMEDIATION: ZODERROR SCHEMA FIX MISSION

---

## Issue Template

### ZK-ISSUE-XXX: [Title]

**Status:** OPEN | IN PROGRESS | RESOLVED

#### Symptoms
- [What the user sees]

#### Root Cause
[Technical explanation]

#### Fix Applied
[What was changed]

#### Files Modified
- [file1]
- [file2]

#### Prevention
- [How to prevent recurrence]
