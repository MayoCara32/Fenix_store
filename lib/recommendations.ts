import type { Product } from './types';

const normalize = (value: string) => value.trim().toLocaleLowerCase('es');

export function dailyRecommendations(products: Product[], sales: unknown[][], date: Date): Product[] {
  const names = new Map<string, Product[]>();
  for (const product of products) {
    const key = normalize(product.name);
    names.set(key, [...(names.get(key) ?? []), product]);
  }
  const totals = new Map<string, number>();
  for (const row of sales) {
    const matches = names.get(normalize(String(row[3] ?? '')));
    const quantity = Number(row[4]);
    if (matches?.length === 1 && Number.isInteger(quantity) && quantity > 0) {
      const id = matches[0].id;
      totals.set(id, (totals.get(id) ?? 0) + quantity);
    }
  }
  const ranked = products.filter(p => p.stock > 0 && (totals.get(p.id) ?? 0) > 0)
    .sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) || a.id.localeCompare(b.id))
    .slice(0, 10);
  if (!ranked.length) return [];
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, dayOfMonth) / 86400000);
  const start = ((dayNumber % ranked.length) + ranked.length) % ranked.length;
  return Array.from({ length: Math.min(5, ranked.length) }, (_, index) => ranked[(start + index) % ranked.length]);
}
