import { NextResponse } from 'next/server';
import { getProducts, getRecommendations } from '@/lib/sheets';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const products = await getProducts();
    let recommendations: string[] = [];
    try { recommendations = await getRecommendations(products); } catch (error) { console.error('No se pudieron cargar las recomendaciones', error); }
    return NextResponse.json({ products, recommendations }, { headers: { 'Cache-Control': 'no-store' } });
  }
  catch (error) { console.error(error); return NextResponse.json({ error: 'No pudimos cargar los productos. Intenta de nuevo más tarde.' }, { status: 503 }); }
}
