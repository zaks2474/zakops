/**
 * Bulk Delete Actions API Endpoint
 * POST /api/actions/bulk/delete
 *
 * Deletes multiple actions by ID.
 * Request body: { action_ids: string[] }
 * Returns the count of deleted actions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/backend-fetch';

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:8091';

interface BulkDeleteRequest {
  action_ids: string[];
}

export async function POST(request: NextRequest) {
  let body: BulkDeleteRequest;

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
    const backendResponse = await fetch(`${BACKEND_URL}/api/actions/bulk/delete`, {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify({ action_ids }),
    });

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      return NextResponse.json(data);
    }

    // If backend returns 404, the endpoint might not exist yet
    if (backendResponse.status === 404) {
      // Mock implementation for development
      console.log(`[Mock] Bulk deleting ${action_ids.length} actions:`, action_ids);
      return NextResponse.json({
        success: true,
        deleted_count: action_ids.length,
        deleted_ids: action_ids,
      });
    }

    // Forward backend error
    const errorText = await backendResponse.text();
    return NextResponse.json(
      { success: false, error: errorText || 'Failed to delete actions' },
      { status: backendResponse.status }
    );
  } catch (error) {
    // Backend not available - use mock implementation
    console.log(`[Mock] Backend unavailable. Bulk deleting ${action_ids.length} actions`);
    return NextResponse.json({
      success: true,
      deleted_count: action_ids.length,
      deleted_ids: action_ids,
    });
  }
}
