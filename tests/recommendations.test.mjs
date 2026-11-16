import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = await readFile(new URL('../lib/recommendations.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { dailyRecommendations } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('selecciona hasta cinco de los diez más vendidos y cambia cada día', () => {
  const products = Array.from({ length: 12 }, (_, i) => ({ id: String(i).padStart(2, '0'), name: `Producto ${i}`, stock: 1 }));
  const sales = products.map((p, i) => ['', '', '', p.name, 12 - i]);
  const today = dailyRecommendations(products, sales, new Date('2026-11-16T18:00:00Z'));
  const tomorrow = dailyRecommendations(products, sales, new Date('2026-11-17T18:00:00Z'));
  assert.equal(today.length, 5);
  assert.ok(today.every(p => Number(p.id) < 10));
  assert.notDeepEqual(today.map(p => p.id), tomorrow.map(p => p.id));
});

test('excluye productos agotados, ventas inválidas y nombres ambiguos', () => {
  const products = [{ id: '1', name: 'A', stock: 1 }, { id: '2', name: 'B', stock: 0 }, { id: '3', name: 'Duplicado', stock: 1 }, { id: '4', name: 'duplicado', stock: 1 }];
  const sales = [['', '', '', ' a ', 2], ['', '', '', 'B', 10], ['', '', '', 'Duplicado', 20], ['', '', '', 'A', -4]];
  assert.deepEqual(dailyRecommendations(products, sales, new Date('2026-11-16T18:00:00Z')).map(p => p.id), ['1']);
  assert.deepEqual(dailyRecommendations(products, [], new Date()), []);
});
