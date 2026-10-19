import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMonthlyDashboardTotals, getCurrentDashboardMonth, isDashboardMonth } from '../src/utils/dashboard.ts';

const work = (fechaInicio, montoAprobado, createdAt = `${fechaInicio}T12:00:00Z`) => ({ fechaInicio, montoAprobado, createdAt });
const receipt = (fecha, monto) => ({ fecha, monto });

test('sales include only the selected month and year, not accumulated historical sales', () => {
  const obras = [work('2026-09-30', 900), work('2026-10-01', 100), work('2026-10-31', 200), work('2026-11-01', 800), work('2025-10-15', 700)];
  assert.deepEqual(calculateMonthlyDashboardTotals(obras, [], '2026-10'), { ventas: 300, cobrado: 0 });
  assert.equal(calculateMonthlyDashboardTotals(obras, [], '2026-09').ventas, 900);
  assert.equal(calculateMonthlyDashboardTotals(obras, [], '2025-10').ventas, 700);
});

test('receipts use their own payment date even when the related sale is in a different month', () => {
  const obras = [work('2026-09-10', 1000)];
  const cobros = [receipt('2026-09-30', 100), receipt('2026-10-01', 200), receipt('2026-10-31', 300), receipt('2026-11-01', 400)];
  assert.deepEqual(calculateMonthlyDashboardTotals(obras, cobros, '2026-10'), { ventas: 0, cobrado: 500 });
});

test('switching months recalculates totals without changing the full work/receipt arrays', () => {
  const obras = Object.freeze([Object.freeze(work('2026-09-10', 100)), Object.freeze(work('2026-10-10', 200))]);
  const cobros = Object.freeze([Object.freeze(receipt('2026-09-20', 25)), Object.freeze(receipt('2026-10-20', 50))]);
  assert.deepEqual(calculateMonthlyDashboardTotals(obras, cobros, '2026-09'), { ventas: 100, cobrado: 25 });
  assert.deepEqual(calculateMonthlyDashboardTotals(obras, cobros, '2026-10'), { ventas: 200, cobrado: 50 });
  assert.deepEqual(calculateMonthlyDashboardTotals(obras, cobros, '2026-12'), { ventas: 0, cobrado: 0 });
  assert.equal(obras.length, 2);
  assert.equal(cobros.length, 2);
});

test('explicit business dates take precedence over record creation timestamps', () => {
  const obras = [work('2026-09-10', 100, '2026-10-10T12:00:00Z')];
  assert.equal(calculateMonthlyDashboardTotals(obras, [], '2026-09').ventas, 100);
  assert.equal(calculateMonthlyDashboardTotals(obras, [], '2026-10').ventas, 0);
});

test('legacy works without a start date fall back to creation month in Paraguay', () => {
  const obras = [work('', 100, '2026-10-01T02:59:59Z'), work('', 200, '2026-10-01T03:00:00Z')];
  assert.equal(calculateMonthlyDashboardTotals(obras, [], '2026-09').ventas, 100);
  assert.equal(calculateMonthlyDashboardTotals(obras, [], '2026-10').ventas, 200);
});

test('date-only fields are not shifted into the previous month by time-zone conversion', () => {
  assert.deepEqual(calculateMonthlyDashboardTotals([work('2026-10-01', 100)], [receipt('2026-10-01', 50)], '2026-10'), { ventas: 100, cobrado: 50 });
});

test('timestamps and the default month respect Paraguay midnight and year boundaries', () => {
  assert.equal(getCurrentDashboardMonth(new Date('2027-01-01T02:59:59Z')), '2026-12');
  assert.equal(getCurrentDashboardMonth(new Date('2027-01-01T03:00:00Z')), '2027-01');
  const cobros = [receipt('2026-10-01T02:59:59Z', 100), receipt('2026-10-01T03:00:00Z', 200)];
  assert.equal(calculateMonthlyDashboardTotals([], cobros, '2026-10').cobrado, 200);
});

test('leap years and month-end boundaries are validated without date rollovers', () => {
  const obras = [work('2024-02-29', 100), work('2026-02-29', 200), work('2026-04-31', 300)];
  assert.equal(calculateMonthlyDashboardTotals(obras, [], '2024-02').ventas, 100);
  assert.equal(calculateMonthlyDashboardTotals(obras, [], '2026-03').ventas, 0);
  assert.equal(calculateMonthlyDashboardTotals(obras, [], '2026-05').ventas, 0);
});

test('invalid or missing dates and non-finite amounts cannot pollute monthly totals', () => {
  const obras = [work('invalid', 100), work('', 200, ''), work('2026-10-10', NaN), work('2026-10-10', Infinity), work('2026-10-10', 50)];
  const cobros = [receipt('', 200), receipt('invalid', 300), receipt('2026-10-10', NaN), receipt('2026-10-10', 25)];
  assert.deepEqual(calculateMonthlyDashboardTotals(obras, cobros, '2026-10'), { ventas: 50, cobrado: 25 });
});

test('invalid/empty month never becomes an unfiltered all-time total', () => {
  const obras = [work('2026-10-10', 100)];
  for (const month of ['', '2026-1', '2026-00', '2026-13', '0000-10', 'all', '2026-10-10']) {
    assert.equal(isDashboardMonth(month), false);
    assert.deepEqual(calculateMonthlyDashboardTotals(obras, [], month), { ventas: 0, cobrado: 0 });
  }
  assert.equal(isDashboardMonth('2026-10'), true);
});
