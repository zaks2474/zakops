/**
 * Checkpoints API Endpoint
 * GET /api/checkpoints
 *
 * Returns the list of active checkpoints/operations.
 */

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:8091';

export async function GET() {
  try {
    // Try to proxy to backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/checkpoints`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      return NextResponse.json(data);
    }

    // If backend returns 404, return empty array (no active checkpoints)
    if (backendResponse.status === 404) {
      return NextResponse.json([]);
    }

    // Forward backend error
    const errorText = await backendResponse.text();
    return NextResponse.json(
      { error: errorText || 'Failed to get checkpoints' },
      { status: backendResponse.status }
    );
  } catch (error) {
    // Backend not available - return empty array
    console.log('[Checkpoints] Backend unavailable, returning empty array');
    return NextResponse.json([]);
  }
}
