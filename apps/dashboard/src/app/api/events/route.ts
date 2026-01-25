/**
 * SSE Proxy Route for Real-Time Agent Events
 *
 * Proxies SSE events from the backend API with:
 * - Session-based authentication (future)
 * - Event ID pass-through for resume capability
 * - Connection keepalive
 */

import { NextRequest } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9200';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const threadId = searchParams.get('thread_id');
  const runId = searchParams.get('run_id');
  const lastEventId = request.headers.get('Last-Event-ID') || searchParams.get('last_event_id');

  if (!threadId || !runId) {
    return new Response(
      JSON.stringify({ error: 'thread_id and run_id are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Build upstream URL
  const upstreamUrl = new URL(
    `${API_BASE_URL}/api/threads/${threadId}/runs/${runId}/stream`
  );
  if (lastEventId) {
    upstreamUrl.searchParams.set('Last-Event-ID', lastEventId);
  }

  // TODO: Add session-based authentication
  // For now, proxy directly to backend

  try {
    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a TransformStream to pass through events
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Read from upstream and write to client
    const reader = response.body?.getReader();
    if (!reader) {
      return new Response(
        JSON.stringify({ error: 'No response body from upstream' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process stream in background
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            await writer.close();
            break;
          }

          await writer.write(value);
        }
      } catch (error) {
        console.error('SSE proxy error:', error);
        try {
          // Send error event to client
          await writer.write(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`
            )
          );
          await writer.close();
        } catch {
          // Writer may already be closed
        }
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('SSE proxy connection error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to connect to upstream' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
