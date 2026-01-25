/**
 * Completed Actions Count API Endpoint
 * GET /api/actions/completed-count?age=all|7d|30d
 *
 * Returns the count of completed actions for the given age filter.
 * Used to show preview counts in the Clear Completed dropdown.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const age = searchParams.get('age') || 'all';

  if (!['all', '7d', '30d'].includes(age)) {
    return NextResponse.json(
      { count: 0, error: 'age must be "all", "7d", or "30d"' },
      { status: 400 }
    );
  }

  try {
    // Try to proxy to backend
    const backendResponse = await fetch(
      `${BACKEND_URL}/api/actions/completed-count?age=${age}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (backendResponse.ok) {
      const data = await backendResponse.json();
      return NextResponse.json(data);
    }

    // If backend returns 404, the endpoint might not exist yet
    if (backendResponse.status === 404) {
      // Mock implementation for development
      const mockCounts: Record<string, number> = {
        all: 25,
        '7d': 8,
        '30d': 15,
      };
      const count = mockCounts[age] || 0;
      console.log(`[Mock] Getting completed count for age ${age}: ${count}`);
      return NextResponse.json({ count, age });
    }

    // Forward backend error
    const errorText = await backendResponse.text();
    return NextResponse.json(
      { count: 0, error: errorText || 'Failed to get count' },
      { status: backendResponse.status }
    );
  } catch (error) {
    // Backend not available - use mock implementation
    const mockCounts: Record<string, number> = {
      all: 25,
      '7d': 8,
      '30d': 15,
    };
    const count = mockCounts[age] || 0;
    console.log(`[Mock] Backend unavailable. Completed count for age ${age}: ${count}`);
    return NextResponse.json({ count, age });
  }
}
