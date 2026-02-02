/**
 * Next.js Middleware — REMEDIATION-V4 [F-003]
 *
 * Intercepts write requests (POST/PUT/DELETE/PATCH) to /api/* and proxies them
 * to the backend with the X-API-Key header. GET requests pass through to the
 * rewrite proxy (no key needed for reads).
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:8091';
const API_KEY = process.env.ZAKOPS_API_KEY || '';

const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

export async function middleware(request: NextRequest) {
  // Only intercept write methods to /api/*
  if (!WRITE_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip if there's already a dedicated API route handler (actions, chat, etc.)
  // Those routes already use backendHeaders(). Only proxy for routes handled by rewrites.
  const handledByRoutes = [
    '/api/actions/',
    '/api/chat',
    '/api/events',
    '/api/agent/',
    '/api/alerts',
    '/api/checkpoints',
    '/api/deferred-actions',
    '/api/pipeline',
    '/api/quarantine/health',
  ];
  for (const prefix of handledByRoutes) {
    if (request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(prefix + '/')) {
      return NextResponse.next();
    }
  }

  // Proxy the write request to backend with API key
  const backendUrl = `${BACKEND_URL}${request.nextUrl.pathname}${request.nextUrl.search}`;

  const headers: Record<string, string> = {
    'Content-Type': request.headers.get('Content-Type') || 'application/json',
  };
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  // Forward idempotency key if present
  const idempotencyKey = request.headers.get('X-Idempotency-Key');
  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  try {
    const body = request.body ? await request.text() : undefined;

    const backendResponse = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
    });

    const responseBody = await backendResponse.text();
    return new NextResponse(responseBody, {
      status: backendResponse.status,
      headers: {
        'Content-Type': backendResponse.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'backend_unavailable', message: 'Failed to reach backend API' },
      { status: 502 }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
