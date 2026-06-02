import { NextResponse } from 'next/server';

/** Storefront liveness probe — used by Helm chart. */
export function GET() {
  return NextResponse.json({ status: 'ok', service: 'storefront' });
}
