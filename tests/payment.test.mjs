import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = await readFile(new URL('../lib/payment.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { paymentDetails } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('una compra pendiente se suma al saldo', () => {
  assert.deepEqual(paymentDetails('pending', 25.5, 12.25), { status: 'Pendiente', balance: 37.75 });
});

test('una compra en efectivo conserva el saldo anterior', () => {
  assert.deepEqual(paymentDetails('cash', 25.5, 12.25), { status: 'Pagado en efectivo', balance: 25.5 });
});

test('un usuario nuevo que paga en efectivo queda sin deuda', () => {
  assert.deepEqual(paymentDetails('cash', 0, 12.25), { status: 'Pagado en efectivo', balance: 0 });
});
