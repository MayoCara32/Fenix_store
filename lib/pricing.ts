import type { Product } from './types';

export function lineTotal(product: Pick<Product, 'price' | 'promotion'>, quantity: number) {
  const unitCents = Math.round(product.price * 100);
  if (!product.promotion) return unitCents * quantity / 100;
  const bundles = Math.floor(quantity / product.promotion.quantity);
  const remaining = quantity % product.promotion.quantity;
  return (bundles * Math.round(product.promotion.price * 100) + remaining * unitCents) / 100;
}
