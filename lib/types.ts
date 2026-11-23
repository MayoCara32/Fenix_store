export type Promotion = { quantity: number; price: number };
export type Product = { id: string; name: string; price: number; stock: number; category: string; promotion: Promotion | null; image?: string | null };
export type CartItem = { id: string; quantity: number };
export type PaymentMethod = 'cash' | 'terminal' | 'pending';
