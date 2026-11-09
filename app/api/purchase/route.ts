import { NextResponse } from 'next/server';
import { purchase } from '@/lib/sheets';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    const items = body.items;
    const paymentMethod = body.paymentMethod;
    if (paymentMethod !== 'cash' && paymentMethod !== 'pending') return NextResponse.json({ error: 'Selecciona una forma de pago válida.' }, { status: 400 });
    if (typeof body.expectedTotal !== 'number' || !Number.isFinite(body.expectedTotal) || body.expectedTotal < 0) return NextResponse.json({ error: 'Revisa el total de tu compra.' }, { status: 400 });
    if (name.length < 3 || name.length > 100 || !Array.isArray(items) || !items.length || items.length > 100 || items.some(item => !item || typeof item.id !== 'string' || !item.id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) || new Set(items.map(item => item.id)).size !== items.length) return NextResponse.json({ error: 'Revisa tu nombre y los productos seleccionados.' }, { status: 400 });
    return NextResponse.json(await purchase(name, items, paymentMethod, body.expectedTotal));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error && (error.message.startsWith('Solo quedan') || error.message.startsWith('Un producto') || error.message.startsWith('Hay usuarios') || error.message.startsWith('El saldo') || error.message.startsWith('La venta') || error.message.startsWith('Los precios')) ? error.message : 'No pudimos completar tu compra. Contacta al administrador antes de intentar de nuevo.' }, { status: 500 });
  }
}
