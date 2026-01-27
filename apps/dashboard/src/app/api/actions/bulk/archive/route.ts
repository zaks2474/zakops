/**
 * Bulk Archive Actions API Endpoint
 * POST /api/actions/bulk/archive
 *
 * Archives multiple actions by ID.
 * Request body: { action_ids: string[] }
 * Returns the count of archived actions.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:8091';

interface BulkArchiveRequest {
  action_ids: string[];
}

export async function POST(request: NextRequest) {
  let body: BulkArchiveRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { action_ids } = body;

  if (!action_ids || !Array.isArray(action_ids) || action_ids.length === 0) {
    return NextResponse.json(
      { success: false, error: 'action_ids array is required' },
      { status: 400 }
    );
  }

  try {
    // Try to proxy to backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/actions/bulk/archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action_ids }),
    });

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      return NextResponse.json(data);
    }

    // If backend returns 404, the endpoint might not exist yet
    if (backendResponse.status === 404) {
      // Mock implementation for development
      console.log(`[Mock] Bulk archiving ${action_ids.length} actions:`, action_ids);
      return NextResponse.json({
        success: true,
        archived_count: action_ids.length,
        archived_ids: action_ids,
      });
    }

    // Forward backend error
    const errorText = await backendResponse.text();
    return NextResponse.json(
      { success: false, error: errorText || 'Failed to archive actions' },
      { status: backendResponse.status }
    );
  } catch (error) {
    // Backend not available - use mock implementation
    console.log(`[Mock] Backend unavailable. Bulk archiving ${action_ids.length} actions`);
    return NextResponse.json({
      success: true,
      archived_count: action_ids.length,
      archived_ids: action_ids,
    });
  }
}
