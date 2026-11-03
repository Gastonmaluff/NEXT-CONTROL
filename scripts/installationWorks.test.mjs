import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/utils/installationWorks.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { installationWorks, productionWorkId } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const order = (id, name, obraId) => ({ id, obraNombre: name, obraId });

test('production-only works appear without creating financial records', () => {
  const finance = [{ id: 'finance', nombre: 'Otra obra', estado: 'Aprobado' }];
  const orders = [order('1', 'Terraza')];
  const works = installationWorks(finance, orders, []);
  assert.equal(works.length, 2);
  assert.equal(works[0].nombre, 'Terraza');
  assert.equal(finance.length, 1);
  assert.equal(orders[0].obraId, undefined);
});
test('same production name groups orders despite whitespace and capitalization', () => {
  const orders = [order('1', ' Terraza  Norte '), order('2', 'terraza norte')];
  assert.equal(installationWorks([], orders, []).length, 1);
  assert.equal(productionWorkId(orders[0], []), productionWorkId(orders[1], []));
});
test('unlinked orders cannot appear under arbitrary financial work or another production work', () => {
  const orders = [order('1', 'Terraza'), order('2', 'Patio')];
  const works = installationWorks([{ id: 'finance', nombre: 'Terraza', estado: 'Finalizada' }], orders, []);
  assert.equal(works.length, 3);
  assert.equal(orders.filter(o => productionWorkId(o, []) === 'finance').length, 0);
  assert.deepEqual(orders.filter(o => productionWorkId(o, []) === works[0].id).map(o => o.obraNombre), [works[0].nombre]);
});
test('explicit work links retain financial identity and status', () => {
  const works = installationWorks([{ id: 'linked', nombre: 'Obra oficial', estado: 'Finalizada' }], [order('1', 'PDF name', 'linked')], []);
  assert.equal(works.length, 1);
  assert.equal(works[0].estado, 'Finalizada');
  assert.equal(works[0].nombre, 'Obra oficial');
});
test('re-import after source rename preserves original work and progress identity', () => {
  const units = [{ sourceOrderId: '1', obraId: 'legacy-work', obraNombre: 'Original', origin: 'produccion' }];
  assert.equal(productionWorkId(order('1', 'Renamed', 'new-link'), units), 'legacy-work');
  assert.equal(installationWorks([], [order('1', 'Renamed')], units)[0].nombre, 'Original');
});
test('field filters retain imported works without access to production orders', () => {
  const units = [{ sourceOrderId: '1', obraId: 'production-work', obraNombre: 'Terraza', origin: 'produccion' }];
  assert.equal(installationWorks([], [], units)[0].id, 'production-work');
});
test('encoded names produce stable Firestore-safe document references', () => {
  const id = productionWorkId(order('1', 'Casa / Patio'), []);
  assert.ok(!id.includes('/'));
  assert.equal(id, productionWorkId(order('2', 'Casa / Patio'), []));
});
test('a work created with a manual installation appears in the catalog for subsequent jobs', () => {
 const units=[{obraId:'instalacion:abc',obraNombre:'Casa de Fulano',origin:'manual',sourceOrderId:''}];
 const works=installationWorks([],[],units);
 assert.equal(works.length,1); assert.equal(works[0].id,'instalacion:abc'); assert.equal(works[0].nombre,'Casa de Fulano');
});
