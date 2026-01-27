import { NextRequest, NextResponse } from 'next/server';

const AGENT_API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || process.env.AGENT_API_URL || 'http://localhost:8095';
const AGENT_SERVICE_TOKEN = process.env.AGENT_SERVICE_TOKEN || process.env.DASHBOARD_SERVICE_TOKEN || '';

/**
 * POST /api/chat/complete
 *
 * Non-streaming chat endpoint - returns complete response.
 * Proxies to Agent API's chatbot endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Transform request
    const messages = body.messages || [
      { role: 'user', content: body.query || body.message || '' }
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add service token for authentication if configured
    if (AGENT_SERVICE_TOKEN) {
      headers['X-Service-Token'] = AGENT_SERVICE_TOKEN;
    }

    const response = await fetch(`${AGENT_API_URL}/api/v1/chatbot/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        session_id: body.session_id,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        {
          error: 'Chat requires authentication',
          detail: 'Agent API requires authentication for chat functionality.',
        },
        { status: 503 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Chat complete API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get chat response',
        detail: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
