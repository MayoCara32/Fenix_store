import 'server-only';
import { google } from 'googleapis';
import twilio from 'twilio';
import type { CartItem, PaymentMethod, Product } from './types';
import { paymentDetails } from './payment';
import { lineTotal } from './pricing';

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
type InventoryRow = { product: Product; minimum: number; alerted: boolean; row: number; stockColumn: string; alertColumn: string };
function columnName(index: number) {
  let value = index + 1; let result = '';
  while (value > 0) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
  return result;
}
async function inventory(): Promise<InventoryRow[]> {
  const response = await client().spreadsheets.values.get({ spreadsheetId: spreadsheetId(), range: 'Inventario!A1:ZZ' });
  const [headers = [], ...rows] = response.data.values ?? [];
  const names = headers.map(value => String(value).trim().toLowerCase());
  const required = ['id_producto', 'nombre', 'precio', 'stock_actual', 'stock_minimo', 'alerta_enviada', 'categoria', 'cantidad_promo', 'precio_promo'];
  if (required.some(name => names.filter(header => header === name).length !== 1)) throw new Error('Los encabezados de Inventario están incompletos o duplicados.');
  const col = Object.fromEntries(required.map(name => [name, names.indexOf(name)]));
  return rows.flatMap((r, index) => {
    const price = number(r[col.precio]); const stock = number(r[col.stock_actual]); const minimum = number(r[col.stock_minimo]);
    if (!r[col.id_producto] || !r[col.nombre] || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || !Number.isFinite(minimum)) return [];
    const quantityValue = String(r[col.cantidad_promo] ?? '').trim(); const priceValue = String(r[col.precio_promo] ?? '').trim();
    const quantity = number(quantityValue); const promoPrice = number(priceValue);
    if ((quantityValue || priceValue) && (!quantityValue || !priceValue || !Number.isInteger(quantity) || quantity < 2 || !Number.isFinite(promoPrice) || promoPrice < 0)) throw new Error(`Promoción inválida en Inventario, fila ${index + 2}.`);
    const promotion = quantityValue && priceValue ? { quantity, price: promoPrice } : null;
    return [{ product: { id: String(r[col.id_producto]), name: String(r[col.nombre]), price, stock, category: String(r[col.categoria] ?? '').trim(), promotion }, minimum, alerted: ['true', 'si', 'sí', '1'].includes(String(r[col.alerta_enviada] ?? '').trim().toLowerCase()), row: index + 2, stockColumn: columnName(col.stock_actual), alertColumn: columnName(col.alerta_enviada) }];
  });
}
export async function getProducts() { return (await inventory()).map(x => x.product); }

export async function purchase(name: string, items: CartItem[], paymentMethod: PaymentMethod, expectedTotal: number) {
  const sheets = client(); const id = spreadsheetId();
  const rows = await inventory();
  const selected = items.map(item => {
    const matches = rows.filter(row => row.product.id === item.id);
    if (matches.length !== 1) throw new Error('Un producto ya no está disponible. Actualiza el catálogo.');
    const row = matches[0];
    if (item.quantity > row.product.stock) throw new Error(`Solo quedan ${row.product.stock} unidades de ${row.product.name}.`);
    return { ...row, quantity: item.quantity, remaining: row.product.stock - item.quantity };
  });
  const total = selected.reduce((sum, item) => sum + Math.round(lineTotal(item.product, item.quantity) * 100), 0) / 100;
  if (Math.round(expectedTotal * 100) !== Math.round(total * 100)) throw new Error('Los precios o promociones cambiaron. Actualiza el catálogo y revisa tu compra.');
  const users = (await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'Usuarios!A2:C' })).data.values ?? [];
  const matches = users.map((row, index) => ({ row, index })).filter(x => String(x.row[0] ?? '').trim().toLocaleLowerCase('es') === name.toLocaleLowerCase('es'));
  if (matches.length > 1) throw new Error('Hay usuarios duplicados con ese nombre. Pide ayuda al administrador.');
  const existing = matches[0];
  const balance = existing ? number(existing.row[1]) : 0;
  if (!Number.isFinite(balance) || balance < 0) throw new Error('El saldo del usuario no es válido. Pide ayuda al administrador.');
  const payment = paymentDetails(paymentMethod, balance, total);
  const now = new Date().toISOString(); const saleId = crypto.randomUUID();
  const data: { range: string; values: (string | number)[][] }[] = selected.map(item => ({ range: `Inventario!${item.stockColumn}${item.row}`, values: [[item.remaining]] }));
  if (existing && paymentMethod === 'pending') data.push({ range: `Usuarios!B${existing.index + 2}`, values: [[payment.balance]] });
  else if (!existing) data.push({ range: `Usuarios!A${users.length + 2}:C${users.length + 2}`, values: [[name, payment.balance, now]] });
  // Append sales first: a failed subsequent update is surfaced as requiring reconciliation.
  await sheets.spreadsheets.values.append({ spreadsheetId: id, range: 'Ventas!A:G', valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: selected.map(item => [saleId, now, name, item.product.name, item.quantity, lineTotal(item.product, item.quantity), payment.status]) } });
  try { await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: 'RAW', data } }); }
  catch (error) { console.error('Venta registrada pero requiere conciliación', saleId, error); throw new Error(`La venta ${saleId} requiere revisión del administrador. No vuelvas a enviarla.`); }
  for (const item of selected.filter(x => x.remaining <= x.minimum && !x.alerted)) {
    try {
      const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_NUMBER: from, ADMIN_WHATSAPP_NUMBER: to } = process.env;
      if (!sid || !token || !from || !to) continue;
      await twilio(sid, token).messages.create({ from, to, body: `⚠️ Tiendita Fénix: ${item.product.name} tiene ${item.remaining} unidades disponibles (mínimo: ${item.minimum}).` });
      await sheets.spreadsheets.values.update({ spreadsheetId: id, range: `Inventario!${item.alertColumn}${item.row}`, valueInputOption: 'RAW', requestBody: { values: [[true]] } });
    } catch (error) { console.error('No se pudo enviar o registrar la alerta de inventario', error); }
  }
  return { saleId, total, paymentMethod };
}
