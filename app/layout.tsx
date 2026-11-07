import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Tiendita Fénix', description: 'Tu pausa favorita en el taller.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
