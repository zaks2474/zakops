import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/chat/session/{sessionId}
 *
 * Get chat session history.
 * Note: This is a placeholder - full implementation requires backend support.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // For now, return empty session since Backend doesn't have session storage
  // Full implementation would query the chat_orchestrator's session store
  return NextResponse.json({
    session_id: sessionId,
    messages: [],
    created_at: new Date().toISOString(),
    note: 'Session persistence not yet implemented in orchestration API',
  });
}
