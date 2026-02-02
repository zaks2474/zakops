import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8091';

/**
 * GET /api/deferred-actions
 *
 * Returns all deferred actions. Proxies to /api/actions.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const url = `${BACKEND_URL}/api/actions${queryString ? '?' + queryString : ''}`;

    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error('[deferred-actions] Backend error: status', response.status);
      return NextResponse.json(
        { error: 'backend_unavailable', message: `Backend returned ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Deferred Actions] Error:', error);
    return NextResponse.json(
      { error: 'backend_unavailable', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 }
    );
  }
}
