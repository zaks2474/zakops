import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8091';

/**
 * GET /api/actions/quarantine
 *
 * Returns quarantine queue items (actions with REVIEW_EMAIL type pending approval).
 * This maps to the email triage quarantine queue.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // First try the backend's quarantine endpoint
    let queryString = '';
    if (limit || offset) {
      const params = new URLSearchParams();
      if (limit) params.set('limit', limit);
      if (offset) params.set('offset', offset);
      queryString = '?' + params.toString();
    }

    const response = await fetch(`${BACKEND_URL}/api/quarantine${queryString}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.items || []);

      // Transform to quarantine item format expected by frontend
      const quarantineItems = items.map((item: any) => ({
        id: item.id || item.quarantine_id || item.action_id,
        quarantine_id: item.quarantine_id || item.id,
        action_id: item.action_id,
        email_subject: item.email_subject || item.subject,
        subject: item.subject || item.email_subject,
        sender: item.sender || item.from,
        from: item.from || item.sender,
        received_at: item.received_at || item.timestamp || item.created_at,
        timestamp: item.timestamp || item.received_at || item.created_at,
        quarantine_reason: item.quarantine_reason || item.reason,
        reason: item.reason || item.quarantine_reason,
        status: item.status || 'pending',
        classification: item.classification,
        urgency: item.urgency,
        company: item.company,
      }));

      return NextResponse.json(quarantineItems);
    }

    // Fallback: try to get from actions with EMAIL_TRIAGE type
    const actionsResponse = await fetch(`${BACKEND_URL}/api/actions?status=PENDING_APPROVAL`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (actionsResponse.ok) {
      const actions = await actionsResponse.json();
      const actionsList = Array.isArray(actions) ? actions : (actions.actions || []);

      // Filter for email triage review actions
      const emailActions = actionsList.filter((a: any) =>
        a.action_type?.includes('EMAIL') || a.action_type?.includes('REVIEW')
      );

      // Transform to quarantine format
      const quarantineItems = emailActions.map((action: any) => ({
        id: action.action_id,
        quarantine_id: action.action_id,
        action_id: action.action_id,
        email_subject: action.inputs?.subject || action.title,
        subject: action.inputs?.subject || action.title,
        sender: action.inputs?.from || action.inputs?.sender,
        from: action.inputs?.from || action.inputs?.sender,
        received_at: action.created_at,
        timestamp: action.created_at,
        quarantine_reason: action.summary || 'Requires review',
        reason: action.summary || 'Requires review',
        status: action.status === 'PENDING_APPROVAL' ? 'pending' : action.status,
        classification: action.inputs?.classification,
        urgency: action.inputs?.urgency,
      }));

      return NextResponse.json(quarantineItems);
    }

    // Return empty array if both fail
    return NextResponse.json([]);
  } catch (error) {
    console.error('[Actions Quarantine] Error:', error);
    return NextResponse.json([]);
  }
}
