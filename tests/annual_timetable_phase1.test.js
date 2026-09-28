// tests/annual_timetable_phase1.test.js - Phase 1 Monthly/Annual Timetable Engine Tests
const assert = require('node:assert/strict');
const harness = require('./test_harness.js');

function runTimetablePhase1Tests() {
  const results = [];
  function test(name, fn) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message, stack: err.stack });
    }
  }

  const app = harness.loadApp();
  const calculateMonthlyTimetable = app.eval('calculateMonthlyTimetable');
  const calculateYearTimetable = app.eval('calculateYearTimetable');
  const clearScheduleCache = app.eval('clearScheduleCache');

  test('T1-01: calculateMonthlyTimetable is a declared function', () => {
    assert.equal(typeof calculateMonthlyTimetable, 'function');
  });

  test('T1-02: calculateYearTimetable is a declared function', () => {
    assert.equal(typeof calculateYearTimetable, 'function');
  });

  test('T1-03: January 2026 returns 31 days with correct month metadata', () => {
    const jan = calculateMonthlyTimetable(21.1960, 72.7940, 2026, 0, 'MOSQUE', 0);
    assert.equal(jan.monthIndex, 0);
    assert.equal(jan.monthName, 'January');
    assert.equal(jan.shortMonthName, 'Jan');
    assert.equal(jan.daysInMonth, 31);
    assert.equal(jan.days.length, 31);
    assert.equal(jan.days[0].dayNum, 1);
    assert.equal(jan.days[0].dayNumPad, '01');
    assert.equal(jan.days[30].dayNum, 31);
  });

  test('T1-04: Leap year precision (Feb 2026 = 28 days, Feb 2024 = 29 days)', () => {
    const feb2026 = calculateMonthlyTimetable(21.1960, 72.7940, 2026, 1, 'MOSQUE', 0);
    assert.equal(feb2026.daysInMonth, 28);
    assert.equal(feb2026.days.length, 28);

    const feb2024 = calculateMonthlyTimetable(21.1960, 72.7940, 2024, 1, 'MOSQUE', 0);
    assert.equal(feb2024.daysInMonth, 29);
    assert.equal(feb2024.days.length, 29);
    assert.equal(feb2024.days[28].dayNum, 29);
  });

  test('T1-05: Surat Jan 01 2026 times are valid and well-formatted', () => {
    const jan = calculateMonthlyTimetable(21.1960, 72.7940, 2026, 0, 'MOSQUE', 0);
    const day1 = jan.days[0];
    const timeRegex = /^\d{2}:\d{2} (AM|PM)$/;
    assert.match(day1.sehri, timeRegex);
    assert.match(day1.fajr, timeRegex);
    assert.match(day1.sunrise, timeRegex);
    assert.match(day1.zawalStart, timeRegex);
    assert.match(day1.dhuhr, timeRegex);
    assert.match(day1.asr, timeRegex);
    assert.match(day1.maghrib, timeRegex);
    assert.match(day1.isha, timeRegex);
    assert.equal(day1.dateIso, '2026-01-01');
    assert.equal(day1.dayName, 'Thu');
  });

  test('T1-06: All days in month contain complete required structure', () => {
    const march = calculateMonthlyTimetable(21.1960, 72.7940, 2026, 2, 'MOSQUE', 0);
    assert.equal(march.days.length, 31);
    for (const d of march.days) {
      assert.ok(d.dayNum >= 1 && d.dayNum <= 31);
      assert.ok(typeof d.dayName === 'string' && d.dayName.length === 3);
      assert.ok(typeof d.hijriFormatted === 'string' && d.hijriFormatted.length > 0);
      assert.ok(typeof d.isToday === 'boolean');
      assert.ok(d.fajr.includes('AM'));
      assert.ok(d.maghrib.includes('PM'));
      assert.ok(d.isha.includes('PM'));
    }
  });

  test('T1-07: Performance budget: 31-day month calculated in < 15ms', () => {
    const t0 = Date.now();
    calculateMonthlyTimetable(28.6139, 77.2090, 2026, 5, 'MOSQUE', 0); // Delhi June (cold)
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 15, `Elapsed ${elapsed}ms exceeded 15ms limit`);
  });

  test('T1-08: Memoization cache returns identical instance in 0ms', () => {
    const m1 = calculateMonthlyTimetable(21.1960, 72.7940, 2026, 6, 'MOSQUE', 0);
    const m2 = calculateMonthlyTimetable(21.1960, 72.7940, 2026, 6, 'MOSQUE', 0);
    assert.equal(m1, m2);
  });

  test('T1-09: calculateYearTimetable returns all 12 months with 365 total days', () => {
    const yr = calculateYearTimetable(21.1960, 72.7940, 2026, 'MOSQUE', 0);
    assert.equal(yr.year, 2026);
    assert.equal(yr.months.length, 12);
    const totalDays = yr.months.reduce((sum, m) => sum + m.days.length, 0);
    assert.equal(totalDays, 365);
  });

  test('T1-10: calculateYearTimetable handles leap year (366 total days for 2024)', () => {
    const yr = calculateYearTimetable(21.1960, 72.7940, 2024, 'MOSQUE', 0);
    const totalDays = yr.months.reduce((sum, m) => sum + m.days.length, 0);
    assert.equal(totalDays, 366);
  });

  test('T1-11: clearScheduleCache clears monthly timetable cache', () => {
    const before = calculateMonthlyTimetable(21.1960, 72.7940, 2026, 3, 'MOSQUE', 0);
    clearScheduleCache();
    const after = calculateMonthlyTimetable(21.1960, 72.7940, 2026, 3, 'MOSQUE', 0);
    assert.notEqual(before, after);
    assert.deepEqual(before, after);
  });

  test('T1-12: Hijri offset shifts Hijri day correctly', () => {
    const base = calculateMonthlyTimetable(21.1960, 72.7940, 2026, 0, 'MOSQUE', 0);
    const shifted = calculateMonthlyTimetable(21.1960, 72.7940, 2026, 0, 'MOSQUE', 1);
    assert.notEqual(base, shifted);
    assert.equal(shifted.days[0].hijriDay, base.days[0].hijriDay + 1);
  });

  return results;
}

if (require.main === module) {
  const results = runTimetablePhase1Tests();
  let passCount = 0;
  for (const r of results) {
    if (r.passed) {
      passCount++;
      console.log(`  [PASS] ${r.name}`);
    } else {
      console.error(`  [FAIL] ${r.name}: ${r.error}`);
    }
  }
  console.log(`\nPhase 1 Timetable: ${passCount}/${results.length} passed.`);
  process.exit(passCount === results.length ? 0 : 1);
}

module.exports = { runTimetablePhase1Tests };
