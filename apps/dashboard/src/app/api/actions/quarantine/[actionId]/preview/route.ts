import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8091';

/**
 * GET /api/actions/quarantine/:actionId/preview
 *
 * Returns preview data for a quarantine item.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  const { actionId } = await params;

  try {
    // Try to get the action details
    const response = await fetch(`${BACKEND_URL}/api/actions/${actionId}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    const action = await response.json();

    // Transform to preview format
    const preview = {
      action_id: action.action_id,
      status: action.status,
      created_at: action.created_at,
      deal_id: action.deal_id,
      message_id: action.inputs?.message_id,
      thread_id: action.inputs?.thread_id,
      from: action.inputs?.from || action.inputs?.sender,
      to: action.inputs?.to || action.inputs?.recipient,
      received_at: action.inputs?.received_at || action.created_at,
      subject: action.inputs?.subject || action.title,
      summary: action.inputs?.summary || [action.summary || ''],
      extracted_fields: action.inputs?.extracted_fields || {},
      attachments: action.inputs?.attachments || {},
      links: action.inputs?.links || {},
      email: action.inputs?.email || {},
      quarantine_dir: action.inputs?.quarantine_dir,
      thread_resolution: action.inputs?.thread_resolution,
    };

    return NextResponse.json(preview);
  } catch (error) {
    console.error('[Quarantine Preview] Error:', error);
    return NextResponse.json({ error: 'Failed to get preview' }, { status: 500 });
  }
}
