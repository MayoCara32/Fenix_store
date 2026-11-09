import type { PaymentMethod } from './types';

export function paymentDetails(method: PaymentMethod, balance: number, total: number) {
  return {
    status: method === 'cash' ? 'Pagado en efectivo' : 'Pendiente',
    balance: method === 'cash' ? balance : Math.round((balance + total) * 100) / 100,
  };
}
