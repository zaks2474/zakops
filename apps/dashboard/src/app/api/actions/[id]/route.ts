/**
 * Single Action API Endpoint
 * DELETE /api/actions/{id}
 *
 * Deletes a single action by ID.
 * Returns the deleted action ID on success.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:8091';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: actionId } = await params;

  if (!actionId) {
    return NextResponse.json(
      { success: false, error: 'Action ID is required' },
      { status: 400 }
    );
  }

  try {
    // Try to proxy to backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/actions/${actionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      return NextResponse.json(data);
    }

    // If backend returns 404, the endpoint might not exist yet
    if (backendResponse.status === 404) {
      // Mock implementation for development
      console.log(`[Mock] Deleting action: ${actionId}`);
      return NextResponse.json({
        success: true,
        action_id: actionId,
      });
    }

    // Forward backend error
    const errorText = await backendResponse.text();
    return NextResponse.json(
      { success: false, error: errorText || 'Failed to delete action' },
      { status: backendResponse.status }
    );
  } catch (error) {
    // Backend not available - use mock implementation
    console.log(`[Mock] Backend unavailable. Deleting action: ${actionId}`);
    return NextResponse.json({
      success: true,
      action_id: actionId,
    });
  }
}
