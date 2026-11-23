import type { PaymentMethod } from './types';

export function paymentDetails(method: PaymentMethod, balance: number, total: number) {
  return {
    status: method === 'cash' ? 'Pagado en efectivo' : method === 'terminal' ? 'Pagado por terminal' : 'Pendiente',
    balance: method !== 'pending' ? balance : Math.round((balance + total) * 100) / 100,
  };
}
