import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = await readFile(new URL('../lib/pricing.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { lineTotal } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('aplica paquetes completos y cobra unidades restantes al precio normal', () => {
  const product = { price: 3, promotion: { quantity: 2, price: 5 } };
  assert.deepEqual([1, 2, 3, 4, 5].map(n => lineTotal(product, n)), [3, 5, 8, 10, 13]);
});
test('conserva el precio normal para productos sin promoción', () => {
  assert.equal(lineTotal({ price: 12.5, promotion: null }, 3), 37.5);
});
test('calcula promociones con centavos sin errores de punto flotante', () => {
  assert.equal(lineTotal({ price: 0.1, promotion: { quantity: 3, price: 0.25 } }, 7), 0.6);
});
