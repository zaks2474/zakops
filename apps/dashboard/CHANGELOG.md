# Changelog

All notable changes to the ZakOps Dashboard project.

## [1.1.0] - 2025-12-27 (chat-front-door-v1)

### Added
- **Chat page** (`/chat`) - AI-powered chat assistant with scope selector (Global/Deal/Document)
- **SSE streaming** - Real-time token streaming for responsive chat experience
- **Evidence builder** - Gathers context from RAG, events, case file, registry, and actions
- **Citations** - Grounded responses with clickable citation references
- **Proposals** - AI can suggest actions (stage transitions, notes) with approval workflow
- **Chat button** on deal detail page - Quick access to deal-scoped chat
- **Chat navigation** - Added to main sidebar with `g,c` keyboard shortcut

### Backend
- `POST /api/chat` - SSE streaming chat endpoint
- `POST /api/chat/complete` - Non-streaming chat endpoint
- `POST /api/chat/execute-proposal` - Execute approved proposals
- `GET /api/chat/session/:id` - Get session history
- `chat_evidence_builder.py` - Evidence bundle construction module
- `chat_orchestrator.py` - LLM orchestration with local vLLM support

### Technical Details
- Evidence sources: RAG (dataroom.local), events, case files, registry, deferred actions
- Secret scanning gate prevents sensitive data from reaching cloud LLMs
- Session management for conversation history
- Proposal approval workflow (never auto-execute)

---

## [1.0.0] - 2025-12-27 (dashboard-stable-v1)

### Added
- **Dashboard page** (`/dashboard`) - Pipeline funnel with clickable stage filters, deal table, due actions rail, quarantine status, alerts panel
- **Deals list** (`/deals`) - Sortable/filterable table with search, stage and status filters
- **Deal workspace** (`/deals/[id]`) - Case file viewer, event history, stage transitions, add notes
- **Actions page** (`/actions`) - Due/overdue/today/week/upcoming categorization with tabs
- **Quarantine inbox** (`/quarantine`) - Health status, pending items, resolution flow (link to deal, create new, discard)
- **Centralized API client** (`src/lib/api.ts`) - Zod schema validation with graceful fallbacks
- **Smoke test script** (`smoke-test.sh`) - 12 automated tests for pages and API endpoints

### Changed
- Adapted from Kiranism/next-shadcn-dashboard-starter template
- Removed Clerk authentication (simplified for internal use)
- Removed Sentry error tracking
- Configured Next.js rewrites to proxy `/api/*` to backend (port 8090)

### Fixed
- **Zod validation** - Added `coerceToNumber()` preprocessor for numeric fields that arrive as strings (e.g., `"TBD"` → `null`)
- **Select component** - Fixed "empty string value" error by using `__all__` sentinel value
- **Error handling** - Added `userMessage` getter to ApiError, improved error UI with endpoint info
- **Graceful degradation** - `getDeal()` returns partial data on validation warnings instead of failing

### Technical Details
- Next.js 15.5.9 with App Router
- shadcn/ui components with Tailwind CSS
- Zod for API response validation
- date-fns for date formatting
- Dev server port: 3003 (production: 3001)
