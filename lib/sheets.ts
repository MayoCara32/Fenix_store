import 'server-only';
import { google } from 'googleapis';
import twilio from 'twilio';
import type { CartItem, Product } from './types';

const spreadsheetId = () => {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('Falta configurar GOOGLE_SHEET_ID.');
  return id;
};
function client() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Faltan las credenciales de Google Sheets.');
  return google.sheets({ version: 'v4', auth: new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] }) });
}
const number = (value: unknown) => Number(String(value ?? '').replace(/[$,\s]/g, ''));
type InventoryRow = { product: Product; minimum: number; alerted: boolean; row: number };
async function inventory(): Promise<InventoryRow[]> {
  const response = await client().spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: 'Inventario!A2:F' });
  return (response.data.values ?? []).flatMap((r, index) => {
    const price = number(r[2]); const stock = number(r[3]); const minimum = number(r[4]);
    if (!r[0] || !r[1] || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || !Number.isFinite(minimum)) return [];
    return [{ product: { id: String(r[0]), name: String(r[1]), price, stock }, minimum, alerted: ['true', 'si', 'sí', '1'].includes(String(r[5] ?? '').trim().toLowerCase()), row: index + 2 }];
  });
}
export async function getProducts() { return (await inventory()).map(x => x.product); }

export async function purchase(name: string, items: CartItem[]) {
  const sheets = client(); const id = spreadsheetId();
  const rows = await inventory();
  const selected = items.map(item => {
    const matches = rows.filter(row => row.product.id === item.id);
    if (matches.length !== 1) throw new Error('Un producto ya no está disponible. Actualiza el catálogo.');
    const row = matches[0];
    if (item.quantity > row.product.stock) throw new Error(`Solo quedan ${row.product.stock} unidades de ${row.product.name}.`);
    return { ...row, quantity: item.quantity, remaining: row.product.stock - item.quantity };
  });
  const total = selected.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const users = (await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'Usuarios!A2:C' })).data.values ?? [];
  const matches = users.map((row, index) => ({ row, index })).filter(x => String(x.row[0] ?? '').trim().toLocaleLowerCase('es') === name.toLocaleLowerCase('es'));
  if (matches.length > 1) throw new Error('Hay usuarios duplicados con ese nombre. Pide ayuda al administrador.');
  const existing = matches[0];
  const balance = existing ? number(existing.row[1]) : 0;
  if (!Number.isFinite(balance) || balance < 0) throw new Error('El saldo del usuario no es válido. Pide ayuda al administrador.');
  const now = new Date().toISOString(); const saleId = crypto.randomUUID();
  const data: { range: string; values: (string | number)[][] }[] = selected.map(item => ({ range: `Inventario!D${item.row}`, values: [[item.remaining]] }));
  if (existing) data.push({ range: `Usuarios!B${existing.index + 2}`, values: [[Math.round((balance + total) * 100) / 100]] });
  else data.push({ range: `Usuarios!A${users.length + 2}:C${users.length + 2}`, values: [[name, total, now]] });
  // Append sales first: a failed subsequent update is surfaced as requiring reconciliation.
  await sheets.spreadsheets.values.append({ spreadsheetId: id, range: 'Ventas!A:G', valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: selected.map(item => [saleId, now, name, item.product.name, item.quantity, item.product.price * item.quantity, 'Pendiente']) } });
  try { await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: 'RAW', data } }); }
  catch (error) { console.error('Venta registrada pero requiere conciliación', saleId, error); throw new Error(`La venta ${saleId} requiere revisión del administrador. No vuelvas a enviarla.`); }
  for (const item of selected.filter(x => x.remaining <= x.minimum && !x.alerted)) {
    try {
      const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_NUMBER: from, ADMIN_WHATSAPP_NUMBER: to } = process.env;
      if (!sid || !token || !from || !to) continue;
      await twilio(sid, token).messages.create({ from, to, body: `⚠️ Tiendita Fénix: ${item.product.name} tiene ${item.remaining} unidades disponibles (mínimo: ${item.minimum}).` });
      await sheets.spreadsheets.values.update({ spreadsheetId: id, range: `Inventario!F${item.row}`, valueInputOption: 'RAW', requestBody: { values: [[true]] } });
    } catch (error) { console.error('No se pudo enviar o registrar la alerta de inventario', error); }
  }
  return { saleId, total };
}
