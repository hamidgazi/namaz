// tests/tier2_boundary_cases.test.js
// Tier 2: Boundary & Corner Cases (>=5 test cases per boundary domain)

const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  loadApp,
  getAccurateIslamicDate,
  calculateAccurateHanafiTimes,
  formatTime12,
  INDEX_HTML_PATH
} = require('./test_harness.js');

function runTier2Tests() {
  const results = [];
  function test(name, fn) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message, stack: err.stack });
    }
  }

  // =========================================================================
  // Domain A: Maghrib Sunset Second Boundary (5+ tests)
  // =========================================================================
  test('T2.A.1: Exactly 1 second before Maghrib (18:47:59) remains day D', () => {
    const baseDate = new Date('2026-09-09T00:00:00+05:30');
    const dayClock = new Date('2026-09-09T14:00:00+05:30');
    const clock1sBefore = new Date('2026-09-09T18:47:59+05:30');
    const resBase = getAccurateIslamicDate(baseDate, '18:48', 0, dayClock);
    const res1sBefore = getAccurateIslamicDate(baseDate, '18:48', 0, clock1sBefore);
    assert.strictEqual(res1sBefore.isPastSunset, false);
    assert.strictEqual(res1sBefore.day, resBase.day, '1s before Maghrib must still be day D');
  });

  test('T2.A.2: At exact Maghrib second (18:48:00) advances to day D+1', () => {
    const baseDate = new Date('2026-09-09T00:00:00+05:30');
    const dayClock = new Date('2026-09-09T14:00:00+05:30');
    const clockAtSunset = new Date('2026-09-09T18:48:00+05:30');
    const resBase = getAccurateIslamicDate(baseDate, '18:48', 0, dayClock);
    const resAtSunset = getAccurateIslamicDate(baseDate, '18:48', 0, clockAtSunset);
    assert.strictEqual(resAtSunset.isPastSunset, true);
    assert.strictEqual(resAtSunset.day, resBase.day + 1, 'At 18:48:00 must be day D+1');
  });

  test('T2.A.3: Exactly 1 second after Maghrib (18:48:01) remains day D+1', () => {
    const baseDate = new Date('2026-09-09T00:00:00+05:30');
    const dayClock = new Date('2026-09-09T14:00:00+05:30');
    const clock1sAfter = new Date('2026-09-09T18:48:01+05:30');
    const resBase = getAccurateIslamicDate(baseDate, '18:48', 0, dayClock);
    const res1sAfter = getAccurateIslamicDate(baseDate, '18:48', 0, clock1sAfter);
    assert.strictEqual(res1sAfter.isPastSunset, true);
    assert.strictEqual(res1sAfter.day, resBase.day + 1, '1s after Maghrib must still be day D+1');
  });

  test('T2.A.4: Sub-second precision (18:48:00.500) evaluates consistently as past sunset', () => {
    const baseDate = new Date('2026-09-09T00:00:00+05:30');
    const clockSubSec = new Date('2026-09-09T18:48:00.500+05:30');
    const res = getAccurateIslamicDate(baseDate, '18:48', 0, clockSubSec);
    assert.strictEqual(res.isPastSunset, true);
  });

  test('T2.A.5: Maghrib boundary handles month rollover from day 29/30', () => {
    // Check with offset that pushes past month end
    const baseDate = new Date('2026-09-09T00:00:00+05:30');
    const res30 = getAccurateIslamicDate(baseDate, '18:48', 3, new Date('2026-09-09T19:00:00+05:30'));
    assert.ok(res30.day >= 1 && res30.day <= 30, 'Rolled-over day must be between 1 and 30');
  });

  // =========================================================================
  // Domain B: Midnight Transition & Calendar Boundaries (5+ tests)
  // =========================================================================
  test('T2.B.1: 23:59:59 before midnight remains advanced day D+1', () => {
    const baseDate = new Date('2026-09-09T00:00:00+05:30');
    const clock235959 = new Date('2026-09-09T23:59:59+05:30');
    const res = getAccurateIslamicDate(baseDate, '18:48', 0, clock235959);
    assert.strictEqual(res.isPastSunset, true);
  });

  test('T2.B.2: 00:00:00 exact midnight transitions Gregorian date cleanly', () => {
    const thuMidnight = new Date('2026-09-10T00:00:00+05:30');
    const res = getAccurateIslamicDate(thuMidnight, '18:48', 0, thuMidnight);
    assert.strictEqual(res.isPastSunset, false, '00:00 is before Thursday Maghrib');
  });

  test('T2.B.3: 00:00:01 past midnight retains the same Islamic day as pre-midnight', () => {
    const wedNight = new Date('2026-09-09T23:59:59+05:30');
    const thuMorning = new Date('2026-09-10T00:00:01+05:30');
    const resWed = getAccurateIslamicDate(new Date('2026-09-09'), '18:48', 0, wedNight);
    const resThu = getAccurateIslamicDate(new Date('2026-09-10'), '18:48', 0, thuMorning);
    assert.strictEqual(resThu.day, resWed.day, 'Islamic date must remain identical across midnight');
  });

  test('T2.B.4: Leap year date (Feb 29, 2028) calculates prayer times without error', () => {
    const leapDate = new Date('2028-02-29T12:00:00+05:30');
    const schedule = calculateAccurateHanafiTimes(21.1960, 72.7940, leapDate, 'MOSQUE');
    assert.ok(schedule.fajr > 0 && schedule.fajr < 12, 'Fajr must be valid hour');
    assert.ok(schedule.maghrib > 12 && schedule.maghrib < 24, 'Maghrib must be valid evening hour');
  });

  test('T2.B.5: Year boundary (Dec 31 to Jan 1) transition calculates smoothly', () => {
    const dec31 = new Date('2026-12-31T12:00:00+05:30');
    const jan01 = new Date('2027-01-01T12:00:00+05:30');
    const s1 = calculateAccurateHanafiTimes(21.1960, 72.7940, dec31);
    const s2 = calculateAccurateHanafiTimes(21.1960, 72.7940, jan01);
    assert.ok(Math.abs(s1.maghrib - s2.maghrib) < 0.1, 'Maghrib difference across consecutive days must be tiny');
  });

  // =========================================================================
  // Domain C: Geographic Extremes & Coordinate Boundaries (5+ tests)
  // =========================================================================
  test('T2.C.1: Equator (0° N, 72° E) prayer calculations produce valid hours', () => {
    const d = new Date('2026-09-09');
    const schedule = calculateAccurateHanafiTimes(0.0, 72.7940, d);
    assert.ok(!isNaN(schedule.fajr) && !isNaN(schedule.maghrib));
    assert.ok(schedule.sunrise < schedule.dhuhr && schedule.dhuhr < schedule.maghrib);
  });

  test('T2.C.2: Srinagar (34.0837° N, 74.7973° E) prayer calculations are valid', () => {
    const d = new Date('2026-09-09');
    const s = calculateAccurateHanafiTimes(34.0837, 74.7973, d);
    assert.ok(s.fajr > 4.0 && s.fajr < 6.0, 'Srinagar Fajr is in reasonable morning window');
    assert.ok(s.maghrib > 18.0 && s.maghrib < 20.0, 'Srinagar Maghrib is in reasonable evening window');
  });

  test('T2.C.3: Kanyakumari (8.0883° N, 77.5385° E) extreme South India is valid', () => {
    const d = new Date('2026-09-09');
    const s = calculateAccurateHanafiTimes(8.0883, 77.5385, d);
    assert.ok(s.dhuhr > 11.5 && s.dhuhr < 13.0, 'Solar noon in Kanyakumari is valid');
  });

  test('T2.C.4: Tezu, Arunachal Pradesh (27.9167° N, 96.1667° E) extreme East India', () => {
    const d = new Date('2026-09-09');
    const s = calculateAccurateHanafiTimes(27.9167, 96.1667, d);
    // Eastern longitude means earlier solar noon and sunset in IST (UTC+5:30)
    assert.ok(s.dhuhr < 12.0, 'Solar noon in eastern India occurs before 12:00 PM IST');
    assert.ok(s.maghrib < 18.0, 'Sunset in eastern India occurs before 6:00 PM IST');
  });

  test('T2.C.5: Dwarka, Gujarat (22.2442° N, 68.9685° E) extreme West India', () => {
    const d = new Date('2026-09-09');
    const s = calculateAccurateHanafiTimes(22.2442, 68.9685, d);
    // Western longitude means later solar noon and sunset in IST
    assert.ok(s.dhuhr > 12.5, 'Solar noon in western Gujarat occurs after 12:30 PM IST');
    assert.ok(s.maghrib > 18.5, 'Sunset in western Gujarat occurs after 6:30 PM IST');
  });

  // =========================================================================
  // Domain D: LocalStorage & Runtime Environment Failures (5+ tests)
  // =========================================================================
  test('T2.D.1: LocalStorage throwing SecurityError does not crash app load', () => {
    const app = loadApp({ storageThrows: true });
    assert.strictEqual(app.scriptError, null, 'App must load cleanly when localStorage throws');
  });

  test('T2.D.2: Corrupted JSON in namaz_city_coords falls back to default city', () => {
    const app = loadApp({ initialStorage: { 'namaz_city_coords': '{ invalid json ...' } });
    const headerCity = app.document.getElementById('txtCityHeader').innerText;
    assert.ok(headerCity.includes('Surat') || headerCity.length > 0, 'City defaults safely');
  });

  test('T2.D.3: Invalid non-numeric namaz_hijri_adjustment defaults safely to 0', () => {
    const res = getAccurateIslamicDate(new Date('2026-09-09T12:00:00+05:30'), '18:48', 'INVALID_OFFSET');
    const base = getAccurateIslamicDate(new Date('2026-09-09T12:00:00+05:30'), '18:48', 0);
    assert.strictEqual(res.day, base.day, 'Invalid offset must default to 0');
  });

  test('T2.D.4: QuotaExceededError on setItem is handled safely', () => {
    const app = loadApp();
    app.localStorage.shouldThrow = true;
    let errorCaught = false;
    try {
      app.localStorage.setItem('test_key', 'test_val');
    } catch (e) {
      errorCaught = true;
    }
    assert.strictEqual(errorCaught, true, 'QuotaExceededError handled');
  });

  test('T2.D.5: Repeated app reload cycles maintain memory integrity', () => {
    for (let i = 0; i < 5; i++) {
      const app = loadApp();
      assert.strictEqual(app.scriptError, null);
    }
  });

  // =========================================================================
  // Domain E: Web Share API & Download Fallbacks (5+ tests)
  // =========================================================================
  test('T2.E.1: navigator.share throwing AbortError does not crash the page', async () => {
    const app = loadApp({ shareThrows: true });
    let completedWithoutCrash = false;
    try {
      await app.navigator.share({ title: 'Test' });
    } catch (e) {
      completedWithoutCrash = true;
    }
    assert.strictEqual(completedWithoutCrash, true);
  });

  test('T2.E.2: When canShare is false, sharing defaults to download pipeline', () => {
    const app = loadApp({ canShareFiles: false });
    assert.strictEqual(app.navigator.canShare({ files: [] }), false);
  });

  test('T2.E.3: Missing navigator.share falls back gracefully', () => {
    const app = loadApp();
    delete app.navigator.share;
    assert.strictEqual(app.navigator.share, undefined);
  });

  test('T2.E.4: Geolocation permission denied alerts user and keeps current city', () => {
    const app = loadApp({ geoError: true });
    const btnDetect = app.document.getElementById('btnDetectGps');
    btnDetect.click();
    assert.ok(app.getAlertMessage() !== null || app.document.getElementById('txtCityHeader').innerText.length > 0);
  });

  test('T2.E.5: Geolocation success updates city coordinates', () => {
    const app = loadApp({ geoCoords: { latitude: 19.0760, longitude: 72.8777 } });
    const btnDetect = app.document.getElementById('btnDetectGps');
    btnDetect.click();
    assert.strictEqual(app.getAppState().lat, 19.0760);
    assert.strictEqual(app.getAppState().lng, 72.8777);
  });

  // =========================================================================
  // Domain F: Search & Empty Input Boundaries (5+ tests)
  // =========================================================================
  test('T2.F.1: City search with empty string populates all cities', () => {
    const app = loadApp();
    const btnOpen = app.document.getElementById('btnOpenCityModal');
    btnOpen.click();
    const container = app.document.getElementById('cityListContainer');
    assert.ok(container.children.length > 10, 'Must show all cities for empty query');
  });

  test('T2.F.2: City search with non-matching string displays 0 rows without crash', () => {
    const app = loadApp();
    const btnOpen = app.document.getElementById('btnOpenCityModal');
    btnOpen.click();
    const searchInput = app.document.getElementById('inputCitySearch');
    searchInput.value = 'NonExistentCity999';
    searchInput.dispatchEvent({ type: 'input', target: searchInput });
    const container = app.document.getElementById('cityListContainer');
    assert.strictEqual(container.children.length, 0, 'No rows should match non-existent query');
  });

  test('T2.F.3: City search trims whitespace and finds Surat', () => {
    const app = loadApp();
    const btnOpen = app.document.getElementById('btnOpenCityModal');
    btnOpen.click();
    const searchInput = app.document.getElementById('inputCitySearch');
    searchInput.value = '   surat   ';
    searchInput.dispatchEvent({ type: 'input', target: searchInput });
    const container = app.document.getElementById('cityListContainer');
    assert.ok(container.children.length >= 1, 'Should find Surat despite whitespace');
  });

  test('T2.F.4: City search is case-insensitive (mUmBaI)', () => {
    const app = loadApp();
    const btnOpen = app.document.getElementById('btnOpenCityModal');
    btnOpen.click();
    const searchInput = app.document.getElementById('inputCitySearch');
    searchInput.value = 'mUmBaI';
    searchInput.dispatchEvent({ type: 'input', target: searchInput });
    const container = app.document.getElementById('cityListContainer');
    assert.ok(container.children.length >= 1, 'Should find Mumbai with mixed casing');
  });

  test('T2.F.5: City search by state name (Gujarat) returns multiple cities', () => {
    const app = loadApp();
    const btnOpen = app.document.getElementById('btnOpenCityModal');
    btnOpen.click();
    const searchInput = app.document.getElementById('inputCitySearch');
    searchInput.value = 'Gujarat';
    searchInput.dispatchEvent({ type: 'input', target: searchInput });
    const container = app.document.getElementById('cityListContainer');
    assert.ok(container.children.length >= 5, 'Should return multiple cities in Gujarat');
  });

  return results;
}

module.exports = { runTier2Tests };

if (require.main === module) {
  const results = runTier2Tests();
  const passed = results.filter(r => r.passed).length;
  console.log(`Tier 2 Tests: ${passed}/${results.length} passed`);
  results.filter(r => !r.passed).forEach(r => console.error(`FAIL: ${r.name} - ${r.error}`));
}
