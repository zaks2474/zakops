import { NextRequest, NextResponse } from 'next/server';
import { agentProvider } from '@/lib/agent/provider-service';
import type { AgentMessage } from '@/lib/agent/types';

const AGENT_API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || process.env.AGENT_API_URL || 'http://localhost:8095';
const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8091';

/**
 * POST /api/chat
 *
 * Handles chat requests with multiple fallback strategies:
 * 1. Try Agent Provider (configured backend - local vLLM by default)
 * 2. Try Backend agent invoke endpoint (for deal-scoped queries)
 * 3. Return a helpful response if both fail
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extract the user's message
    const userMessage = body.query || body.message ||
      (body.messages && body.messages[body.messages.length - 1]?.content) || '';

    if (!userMessage) {
      return NextResponse.json(
        { error: 'No message provided' },
        { status: 400 }
      );
    }

    // Transform the request to match Agent API's expected format
    const messages: AgentMessage[] = body.messages || [
      { role: 'user', content: userMessage }
    ];

    // Extract provider selection from options (for future multi-provider support)
    const selectedProvider = body.options?.provider || 'local';
    console.log(`[Chat] Provider: ${selectedProvider}, Message: ${userMessage.slice(0, 50)}...`);

    // Strategy 1: Try Agent Provider (uses configured backend)
    // TODO: Route to different providers based on selectedProvider when implemented
    try {
      const response = await agentProvider.chat({
        messages,
        session_id: body.session_id,
        options: body.options,
      });

      // Extract the assistant's response content
      const assistantContent = response.content ||
        (response.messages && response.messages.length > 0
          ? response.messages[response.messages.length - 1]?.content
          : '') || '';

      // Return as SSE stream (frontend expects SSE, not JSON)
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Send the full response as a single token event
          // (Agent API doesn't stream, so we send it all at once)
          if (assistantContent) {
            const tokenEvent = `event: token\ndata: ${JSON.stringify({ token: assistantContent })}\n\n`;
            controller.enqueue(encoder.encode(tokenEvent));
          }

          // Send done event with metadata
          const doneEvent = `event: done\ndata: ${JSON.stringify({
            citations: response.citations || [],
            proposals: response.proposals || [],
            session_id: response.session_id || body.session_id,
            model_used: response.model_used || 'local',
            latency_ms: response.latency_ms || 0,
            warnings: response.warnings || [],
            final_text: assistantContent,
          })}\n\n`;
          controller.enqueue(encoder.encode(doneEvent));
          controller.close();
        },
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (agentError) {
      console.log('[Chat] Agent Provider error:', agentError instanceof Error ? agentError.message : agentError);
    }

    // Strategy 2: Try Backend agent invoke (for deal-scoped queries)
    if (body.scope?.deal_id) {
      try {
        const backendUrl = `${BACKEND_URL}/api/agent/invoke`;
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deal_id: body.scope.deal_id,
            task: userMessage,
            actor_id: body.actor_id || 'dashboard-user',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const backendContent = data.response || data.output || JSON.stringify(data);

          // Return as SSE stream
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              const tokenEvent = `event: token\ndata: ${JSON.stringify({ token: backendContent })}\n\n`;
              controller.enqueue(encoder.encode(tokenEvent));

              const doneEvent = `event: done\ndata: ${JSON.stringify({
                citations: [],
                proposals: [],
                model_used: 'backend-agent',
                latency_ms: 0,
                final_text: backendContent,
              })}\n\n`;
              controller.enqueue(encoder.encode(doneEvent));
              controller.close();
            },
          });

          return new NextResponse(stream, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        }
      } catch (backendError) {
        console.log('[Chat] Backend agent also unavailable');
      }
    }

    // Strategy 3: Return a helpful assistant response as SSE stream
    // This ensures the chat UI works even when agents are unavailable
    const helpfulResponse = generateHelpfulResponse(userMessage, body.scope);

    // Create SSE stream for fallback response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Stream the response token by token for a better UX
        const words = helpfulResponse.split(' ');
        let accumulated = '';

        // Send tokens in chunks
        for (let i = 0; i < words.length; i++) {
          accumulated += (i > 0 ? ' ' : '') + words[i];
          if (i % 5 === 4 || i === words.length - 1) {
            const tokenEvent = `event: token\ndata: ${JSON.stringify({ token: accumulated })}\n\n`;
            controller.enqueue(encoder.encode(tokenEvent));
            accumulated = '';
          }
        }

        // Send done event with full response
        const doneEvent = `event: done\ndata: ${JSON.stringify({
          citations: [],
          proposals: [],
          model_used: 'fallback',
          latency_ms: 0,
          warnings: ['AI agent service is currently unavailable. Showing helpful guidance instead.'],
        })}\n\n`;
        controller.enqueue(encoder.encode(doneEvent));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process chat',
        detail: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a helpful response when AI agents are unavailable
 */
function generateHelpfulResponse(query: string, scope?: { type?: string; deal_id?: string }): string {
  const lowerQuery = query.toLowerCase();

  // Help with common questions
  if (lowerQuery.includes('help') || lowerQuery.includes('what can')) {
    return `I'm the ZakOps assistant. While the AI service is starting up, here's what I can help with:

**Deal Management:**
- View and filter deals by stage (Inbound, Screening, Qualified, etc.)
- Track deal progress and timelines
- Review deal materials and documents

**Actions & Approvals:**
- View pending actions requiring approval
- Monitor scheduled tasks
- Review action history

**Quarantine Queue:**
- Review items needing classification
- Approve or reject quarantined emails

Navigate using the sidebar to access these features directly.`;
  }

  if (lowerQuery.includes('deal') || scope?.type === 'deal') {
    return `To work with deals, you can:
- **View all deals**: Go to the Deals tab in the sidebar
- **Filter by stage**: Use the pipeline buttons on the Dashboard
- **See deal details**: Click on any deal to see its full profile

For specific deal questions, please ensure the deal ID is provided or navigate to the deal's page.`;
  }

  if (lowerQuery.includes('action') || lowerQuery.includes('approval')) {
    return `For actions and approvals:
- **Pending approvals**: Check the Actions tab or the Approval Queue on the Dashboard
- **Execute actions**: Review action details and approve/reject as needed
- **View history**: See completed actions in the Actions page

The Dashboard shows a summary of items needing your attention.`;
  }

  if (lowerQuery.includes('quarantine') || lowerQuery.includes('email')) {
    return `For quarantine and email management:
- **Review queue**: Go to the Quarantine tab to see items pending review
- **Classify emails**: Approve items to route them to deals, or reject to discard
- **Bulk actions**: Select multiple items for batch processing

The Dashboard shows quarantine health status.`;
  }

  // Default response
  return `I received your message: "${query}"

The AI assistant service is currently initializing. While it starts up, you can:
- **Dashboard**: See pipeline overview and pending items
- **Deals**: Browse and manage your deal portfolio
- **Actions**: Review and approve pending actions
- **Quarantine**: Process items needing classification

The full AI assistant will be available shortly to provide detailed answers.`;
}

/**
 * GET /api/chat
 *
 * Returns chat service status and capabilities.
 */
export async function GET() {
  try {
    // Check if Agent Provider is healthy
    const healthy = await agentProvider.healthCheck();

    if (healthy) {
      // Fetch additional health details
      const healthResponse = await fetch(`${AGENT_API_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const health = healthResponse.ok ? await healthResponse.json() : { status: 'unknown' };

      return NextResponse.json({
        status: 'available',
        provider: agentProvider.name,
        agent_api: AGENT_API_URL,
        agent_health: health,
        note: 'Chat is handled by Agent Provider. Authentication is configured.',
      });
    }

    return NextResponse.json({
      status: 'unavailable',
      provider: agentProvider.name,
      agent_api: AGENT_API_URL,
      error: 'Agent Provider health check failed',
    }, { status: 503 });

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      provider: agentProvider.name,
      agent_api: AGENT_API_URL,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
