# ZakOps Dashboard

The frontend application for ZakOps Deal Lifecycle OS.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI Library**: Radix UI + shadcn/ui
- **Styling**: Tailwind CSS
- **State**: React hooks + SSE streaming
- **Language**: TypeScript

## Features

- 📊 **Dashboard** — Real-time Agent Activity Widget, Pipeline Funnel, Deal Inbox
- 🤖 **Agent Visibility** — Drawer, panels, status indicators, run timeline
- 📁 **Deal Workspace** — Stage tracking, case files, documents, actions
- ✅ **Actions** — Approval workflows, due/overdue categorization
- 📥 **Quarantine** — Email triage with resolution flow
- 🚀 **Onboarding** — 5-step wizard with agent demo
- ⌨️ **Command Palette** — Cmd+K for quick navigation
- 💬 **Chat** — AI assistant with RAG and action proposals

## Architecture

This dashboard is the **UI Layer** in the Four-Plane Architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                     UI LAYER ← This Repo                         │
│                   (Next.js Dashboard)                            │
│         Dashboard • Deal Workspace • Agent Visibility            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXECUTION PLANE                             │
│                    (zakops-backend)                              │
│      Deal Lifecycle API • MCP Agent Bridge • Workers             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA PLANE                                │
│              (PostgreSQL + Filesystem + Vector)                  │
└─────────────────────────────────────────────────────────────────┘
```

## Related Repositories

| Repository | Purpose |
|------------|---------|
| [zakops-backend](../zakops-backend) | Python backend services (FastAPI, MCP, Workers) |
| [Zaks-llm](../Zaks-llm) | LangGraph agent development |

## Getting Started

### Prerequisites

- Node.js 18+ (tested with 20.x)
- npm 10+
- Backend API running (see [zakops-backend](../zakops-backend))

### Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp env.example.txt .env.local

# Start development server
npm run dev
```

Open [http://localhost:3003](http://localhost:3003)

### Environment Variables

Create `.env.local`:

```bash
# Backend API URL
API_URL=http://localhost:8090

# Feature Flags
NEXT_PUBLIC_ENABLE_AGENT_DEMO=true
NEXT_PUBLIC_ENABLE_ONBOARDING=true
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/          # Main dashboard
│   ├── deals/              # Deal workspace
│   │   └── [id]/           # Deal detail page
│   ├── actions/            # Action management
│   ├── agent/              # Agent activity page
│   ├── onboarding/         # Onboarding wizard
│   ├── quarantine/         # Email quarantine
│   └── api/                # Next.js API routes
├── components/
│   ├── agent/              # Agent drawer, panel, timeline
│   ├── dashboard/          # Activity widget, inbox
│   ├── deal-workspace/     # Deal components
│   ├── layout/             # Sidebar, header
│   ├── onboarding/         # Wizard steps
│   └── ui/                 # Radix UI primitives
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and API client
└── types/                  # TypeScript definitions
```

## API Integration

The dashboard uses **Next.js rewrites** to proxy `/api/*` requests to the backend.

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/deals` | List deals (with filters) |
| `/api/deals/:id` | Get deal details |
| `/api/deals/:id/events` | Get deal events |
| `/api/deals/:id/case-file` | Get case file |
| `/api/actions` | List actions |
| `/api/actions/quarantine` | List quarantine items |
| `/api/chat/complete` | Chat with SSE streaming |

### API Client

All API calls go through `src/lib/api.ts` with:

- **Zod validation** — Response shapes validated and normalized
- **Error handling** — Consistent `ApiError` class
- **Array normalization** — Prevents "filter is not a function" errors

```typescript
import { getDeals, getDeal, getActions } from '@/lib/api';

const deals = await getDeals({ status: 'active' });  // Always Deal[]
const deal = await getDeal('DEAL-2025-001');         // DealDetail | null
const actions = await getActions({ deal_id });       // Always Action[]
```

## Development

### Make Commands

| Command | Description |
|---------|-------------|
| `make install` | Install dependencies |
| `make dev` | Start dev server (port 3003) |
| `make build` | Build for production |
| `make test` | Run smoke tests |
| `make lint` | Run linter |

### Testing

```bash
# Start dev server
npm run dev

# In another terminal, run smoke test
./smoke-test.sh
```

## Production

```bash
# Build
npm run build

# Start (port 3001)
npm run start
```

## Credits

Based on [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter).
