import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/sheets';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json({ products: await getProducts() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { console.error(error); return NextResponse.json({ error: 'No pudimos cargar los productos. Intenta de nuevo más tarde.' }, { status: 503 }); }
}
