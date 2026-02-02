/**
 * SSE Proxy Route for Real-Time Agent Events
 *
 * Thread-based streaming is not yet implemented.
 * Returns 501 until agent thread infrastructure is available.
 */

import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return new Response(
    JSON.stringify({ error: 'not_implemented', message: 'Agent thread streaming is not yet available' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } }
  );
}
