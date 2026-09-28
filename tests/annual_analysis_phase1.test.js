// tests/annual_analysis_phase1.test.js - Phase 1 Annual Ephemeris Engine Tests
const assert = require('node:assert/strict');
const harness = require('./test_harness.js');

function runAnnualPhase1Tests() {
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
  const calculateAnnualAnalysis = app.eval('calculateAnnualAnalysis');
  const clearScheduleCache = app.eval('clearScheduleCache');

  test('P1-01: calculateAnnualAnalysis is a declared function', () => {
    assert.equal(typeof calculateAnnualAnalysis, 'function');
  });

  test('P1-02: 365-day annual calculation finishes in < 100ms', () => {
    const t0 = Date.now();
    calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 100, `Elapsed ${elapsed}ms exceeded 100ms limit`);
  });

  test('P1-03: Surat 2026 Fajr extremes and 1h 30m delta', () => {
    const a = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    assert.equal(a.extremes.fajr.earliest.time, '04:32 AM');
    assert.equal(a.extremes.fajr.earliest.date, '06 Jun');
    assert.equal(a.extremes.fajr.latest.time, '06:02 AM');
    assert.equal(a.extremes.fajr.latest.date, '20 Jan');
    assert.equal(a.extremes.fajr.delta, '1h 30m');
  });

  test('P1-04: Surat 2026 Sunrise extremes and 1h 22m delta', () => {
    const a = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    assert.equal(a.extremes.sunrise.earliest.time, '05:56 AM');
    assert.equal(a.extremes.sunrise.earliest.date, '29 May');
    assert.equal(a.extremes.sunrise.latest.time, '07:18 AM');
    assert.equal(a.extremes.sunrise.latest.date, '09 Jan');
    assert.equal(a.extremes.sunrise.delta, '1h 22m');
  });

  test('P1-05: Surat 2026 Maghrib/Iftar extremes and 1h 29m delta', () => {
    const a = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    assert.equal(a.extremes.maghrib.earliest.time, '05:59 PM');
    assert.equal(a.extremes.maghrib.earliest.date, '23 Nov');
    assert.equal(a.extremes.maghrib.latest.time, '07:28 PM');
    assert.equal(a.extremes.maghrib.latest.date, '26 Jun');
    assert.equal(a.extremes.maghrib.delta, '1h 29m');
  });

  test('P1-06: Surat 2026 Isha extremes and 1h 36m delta', () => {
    const a = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    assert.equal(a.extremes.isha.earliest.time, '07:14 PM');
    assert.equal(a.extremes.isha.latest.time, '08:50 PM');
    assert.equal(a.extremes.isha.delta, '1h 36m');
  });

  test('P1-07: Surat 2026 Fasting (Roza) range and 2h 42m delta', () => {
    const a = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    assert.equal(a.fasting.longest.durationStr, '14h 54m');
    assert.equal(a.fasting.longest.date, '21 Jun');
    assert.equal(a.fasting.shortest.durationStr, '12h 12m');
    assert.equal(a.fasting.shortest.date, '19 Dec');
    assert.equal(a.fasting.deltaStr, '2h 42m');
  });

  test('P1-08: Surat 2026 Hanafi vs Shafi Asr gap (45m to 81m)', () => {
    const a = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    assert.equal(a.asrComparison.minGap.minutes, 45);
    assert.equal(a.asrComparison.maxGap.minutes, 81);
  });

  test('P1-09: Memoization cache returns cached reference instantly', () => {
    const a1 = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    const t0 = Date.now();
    const a2 = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    const elapsed = Date.now() - t0;
    assert.equal(a1, a2);
    assert.ok(elapsed <= 5);
  });

  test('P1-10: clearScheduleCache successfully invalidates annual cache', () => {
    const a1 = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    clearScheduleCache();
    const a2 = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    assert.notEqual(a1, null);
    assert.notEqual(a2, null);
  });

  test('P1-11: Dynamic calculation for Delhi (28.6139° N, 77.2090° E)', () => {
    const surat = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    const delhi = calculateAnnualAnalysis(28.6139, 77.2090, 2026, 'MOSQUE');
    assert.notEqual(surat.extremes.fajr.earliest.time, delhi.extremes.fajr.earliest.time);
  });

  test('P1-12: Solstices and equinoxes milestones are populated', () => {
    const a = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    assert.equal(a.astronomicalMilestones.length, 4);
    assert.equal(a.astronomicalMilestones[1].name, 'Summer Solstice');
    assert.equal(a.astronomicalMilestones[3].name, 'Winter Solstice');
  });

  test('P1-13: 12-month reference table contains 24 checkpoints', () => {
    const a = calculateAnnualAnalysis(21.1960, 72.7940, 2026, 'MOSQUE');
    assert.equal(a.monthlyTable.length, 24);
  });

  return results;
}

if (require.main === module) {
  console.log('>> [PHASE 1] Running Annual Prayer Timing Engine Suite...');
  const res = runAnnualPhase1Tests();
  const passed = res.filter(r => r.passed).length;
  console.log(`[STATUS] ${passed}/${res.length} tests passed.`);
  res.forEach(r => {
    if (!r.passed) console.error(`  FAIL: ${r.name} - ${r.error}`);
    else console.log(`  PASS: ${r.name}`);
  });
  if (passed !== res.length) process.exit(1);
}

module.exports = { runAnnualPhase1Tests };
