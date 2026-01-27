# Agent Provider Architecture

## Overview

The Dashboard uses a pluggable agent provider system to communicate with AI backends. This abstraction allows switching between different LLM services without changing application code.

## Configuration

Set the provider via environment variables in `.env.local`:

```bash
# Provider type: local | openai | anthropic | custom
AGENT_PROVIDER=local

# Local Provider (ZakOps Agent API)
AGENT_LOCAL_URL=http://localhost:8095
AGENT_LOCAL_API_KEY=your-service-token-here
AGENT_LOCAL_TIMEOUT=30000
```

## Available Providers

### Local Provider (Default)

Connects to the ZakOps Agent API on port 8095:

- **Endpoint**: `/api/v1/chatbot/chat`
- **Authentication**: `X-Service-Token` header
- **Features**: Chat, streaming, health check

### Future Providers

- `openai`: Direct OpenAI API (planned)
- `anthropic`: Direct Anthropic API (planned)
- `custom`: Custom endpoint URL (planned)

## Usage

```typescript
import { agentProvider } from '@/lib/agent/provider-service';

// Health check
const healthy = await agentProvider.healthCheck();

// Chat request
const response = await agentProvider.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  session_id: 'optional-session-id',
});

// Response structure
console.log(response.messages);  // Full conversation history
console.log(response.content);   // Last assistant message
```

## File Structure

```
apps/dashboard/src/lib/agent/
├── types.ts              # TypeScript interfaces
├── provider-service.ts   # Singleton provider service
├── providers/
│   └── local.ts          # Local vLLM provider
└── index.ts              # Public exports
```

## Key Interfaces

### AgentProvider

```typescript
interface AgentProvider {
  readonly name: string;
  healthCheck(): Promise<boolean>;
  chat(request: AgentRequest): Promise<AgentResponse>;
  chatStream?(request: AgentRequest): AsyncGenerator<AgentStreamChunk>;
}
```

### AgentRequest

```typescript
interface AgentRequest {
  messages: AgentMessage[];
  session_id?: string;
  options?: Record<string, unknown>;
}
```

### AgentResponse

```typescript
interface AgentResponse {
  content: string;
  messages?: AgentMessage[];
  citations?: Citation[];
  proposals?: Proposal[];
  model_used?: string;
  latency_ms?: number;
  warnings?: string[];
}
```

## Environment Variable Fallbacks

For backward compatibility, the local provider checks multiple env var names:

1. `AGENT_LOCAL_API_KEY` (preferred)
2. `DASHBOARD_SERVICE_TOKEN`
3. `AGENT_SERVICE_TOKEN`

## Adding a New Provider

1. Create `providers/newprovider.ts` implementing `AgentProvider`
2. Add case to `createProvider()` in `provider-service.ts`
3. Add config type to `types.ts`
4. Update `.env.example` with new variables

## Troubleshooting

### Provider Health Check Fails

```bash
# Check Agent API is running
curl http://localhost:8095/health

# Verify token in .env.local matches Agent API config
```

### Authentication Errors

Ensure `AGENT_LOCAL_API_KEY` matches the token configured in the Agent API's `SERVICE_TOKENS` list.

### Timeout Errors

Increase `AGENT_LOCAL_TIMEOUT` for slow responses (default: 30000ms).
