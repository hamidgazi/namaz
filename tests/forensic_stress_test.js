// forensic_stress_test.js - Adversarial Stress-Testing & Boundary Mining
const fs = require('fs');
const assert = require('assert');
const harness = require('./test_harness.js');

console.log('================================================================================');
console.log('         ADVERSARIAL STRESS-TESTING & EDGE-CASE MINING SUITE                    ');
console.log('================================================================================');

let passed = 0;
let failed = 0;

function stress(name, fn) {
  try {
    fn();
    passed++;
    console.log(`[PASS] Stress: ${name}`);
  } catch (err) {
    failed++;
    console.log(`[FAIL] Stress: ${name}`);
    console.log(`       Error: ${err.message}`);
  }
}

// Augment mock context for canvas testing
harness.MockHTMLCanvasElement.prototype.getContext = function(t) {
  if (t === '2d') {
    if (!this._ctx.createRadialGradient) {
      this._ctx.createRadialGradient = function() {
        return { addColorStop: () => {} };
      };
    }
    return this._ctx;
  }
  return null;
};

const app = harness.loadApp();

// 1. Exact Second Rollover Test at Maghrib
stress('Exact second boundary: 18:47:59 (pre) vs 18:48:00 (exact) vs 18:48:01 (post)', () => {
  const dPre = new Date('2026-09-09T18:47:59+05:30');
  const dExact = new Date('2026-09-09T18:48:00+05:30');
  const dPost = new Date('2026-09-09T18:48:01+05:30');

  const rPre = app.eval(`getAccurateIslamicDate(new Date('2026-09-09T18:47:59+05:30'), '18:48', 0, new Date('2026-09-09T18:47:59+05:30'))`);
  const rExact = app.eval(`getAccurateIslamicDate(new Date('2026-09-09T18:48:00+05:30'), '18:48', 0, new Date('2026-09-09T18:48:00+05:30'))`);
  const rPost = app.eval(`getAccurateIslamicDate(new Date('2026-09-09T18:48:01+05:30'), '18:48', 0, new Date('2026-09-09T18:48:01+05:30'))`);

  assert.strictEqual(rPre.isPastSunset, false, '18:47:59 must be pre-sunset');
  assert.strictEqual(rExact.isPastSunset, true, '18:48:00 must trigger sunset');
  assert.strictEqual(rPost.isPastSunset, true, '18:48:01 must remain past sunset');
  assert.strictEqual(rExact.day, rPre.day + 1, 'Day must increment at exact minute');
});

// 2. Year Boundary Rollover: December 31 -> January 1
stress('Gregorian year transition across Maghrib (Dec 31 23:59 -> Jan 1)', () => {
  const dec31Pre = app.eval(`getAccurateIslamicDate(new Date('2026-12-31T17:30:00+05:30'), '18:00', 0, new Date('2026-12-31T17:30:00+05:30'))`);
  const dec31Post = app.eval(`getAccurateIslamicDate(new Date('2026-12-31T18:15:00+05:30'), '18:00', 0, new Date('2026-12-31T18:15:00+05:30'))`);

  assert.strictEqual(dec31Pre.isPastSunset, false);
  assert.strictEqual(dec31Post.isPastSunset, true);
  assert.strictEqual(dec31Post.day, dec31Pre.day + 1);
});

// 3. Hijri Adjustment Boundary Stress: -2, -1, 0, +1, +2 and invalid strings
stress('Hijri adjustment boundary values and invalid string resilience', () => {
  const d = new Date('2026-09-09T12:00:00+05:30');
  const base = app.eval(`getAccurateIslamicDate(new Date('2026-09-09T12:00:00+05:30'), '18:48', 0, new Date('2026-09-09T12:00:00+05:30'))`);
  const plus2 = app.eval(`getAccurateIslamicDate(new Date('2026-09-09T12:00:00+05:30'), '18:48', '+2', new Date('2026-09-09T12:00:00+05:30'))`);
  const minus2 = app.eval(`getAccurateIslamicDate(new Date('2026-09-09T12:00:00+05:30'), '18:48', '-2', new Date('2026-09-09T12:00:00+05:30'))`);
  const invalid = app.eval(`getAccurateIslamicDate(new Date('2026-09-09T12:00:00+05:30'), '18:48', 'garbage_string', new Date('2026-09-09T12:00:00+05:30'))`);

  assert.strictEqual(plus2.day, base.day + 2);
  assert.strictEqual(minus2.day, base.day - 2);
  assert.strictEqual(invalid.day, base.day, 'Invalid offset must fallback to 0');
});

// 4. Multiple Coordinates Ephemeris Stress (Surat, Makkah, London, Sydney)
stress('Solar ephemeris across diverse global latitudes and longitudes', () => {
  const locations = [
    { name: 'Surat', lat: 21.1960, lng: 72.7940 },
    { name: 'Makkah', lat: 21.4225, lng: 39.8262 },
    { name: 'London', lat: 51.5074, lng: -0.1278 },
    { name: 'Sydney (Southern hemisphere)', lat: -33.8688, lng: 151.2093 }
  ];

  const d = new Date('2026-09-09T12:00:00Z');
  for (const loc of locations) {
    const t = app.eval(`calculateAccurateHanafiTimes(${loc.lat}, ${loc.lng}, new Date('${d.toISOString()}'), 'MOSQUE')`);
    assert.ok(t.fajr > 0 && t.fajr < 24, `${loc.name} fajr valid`);
    assert.ok(t.sunrise > 0 && t.sunrise < 24, `${loc.name} sunrise valid`);
    assert.ok(t.dhuhr > 0 && t.dhuhr < 24, `${loc.name} dhuhr valid`);
    assert.ok(t.asr > 0 && t.asr < 24, `${loc.name} asr valid`);
    assert.ok(t.maghrib > 0 && t.maghrib < 24, `${loc.name} maghrib valid`);
    assert.ok(t.isha > 0 && t.isha < 24, `${loc.name} isha valid`);
  }
});

// 5. Canvas Generator with Adversarial Inputs (Long city names, unicode, missing fields)
stress('Canvas timetable generation survives long strings, unicode, and varied schedules', () => {
  const d = new Date('2026-09-09T12:00:00+05:30');
  const sched = app.eval(`calculateAccurateHanafiTimes(21.1960, 72.7940, new Date('2026-09-09T12:00:00+05:30'), 'MOSQUE')`);

  const longState = {
    cityName: 'Very Long Metropolitan Mosque District & Cultural Center, Greater Surat Area (South Gujarat Region)',
    lat: 21.1960,
    lng: 72.7940,
    hijriOffset: 1,
    ihtiyat: 'RAMADAN_SAFE'
  };

  const canvas = app.eval(`generateSalahTimetableCanvas(${JSON.stringify(sched)}, new Date('2026-09-09T12:00:00+05:30'), ${JSON.stringify(longState)})`);
  assert.strictEqual(canvas.width, 1080);
  assert.strictEqual(canvas.height, 1350);

  const ctx = canvas.getContext('2d');
  const renderedText = ctx.drawCalls.filter(c => c.method === 'fillText').map(c => c.text);
  assert.ok(renderedText.some(t => t && t.includes('VERY LONG')), 'Long city name rendered');
  assert.ok(renderedText.some(t => t === 'Fajr'), 'Fajr rendered');
  assert.ok(renderedText.some(t => t === 'Maghrib'), 'Maghrib rendered');
});

// 6. Friday Jummah vs Weekday Dhuhr Label in Canvas
stress('Canvas prayer list shows Jummah on Fridays and Dhuhr on other days', () => {
  const friday = new Date('2026-09-11T12:00:00+05:30'); // Sept 11, 2026 is Friday
  const thursday = new Date('2026-09-10T12:00:00+05:30'); // Sept 10, 2026 is Thursday

  const schedFri = app.eval(`calculateAccurateHanafiTimes(21.1960, 72.7940, new Date('${friday.toISOString()}'), 'MOSQUE')`);
  const schedThu = app.eval(`calculateAccurateHanafiTimes(21.1960, 72.7940, new Date('${thursday.toISOString()}'), 'MOSQUE')`);
  const state = { cityName: 'Surat', lat: 21.1960, lng: 72.7940, hijriOffset: 0, ihtiyat: 'MOSQUE' };

  const cvsFri = app.eval(`generateSalahTimetableCanvas(${JSON.stringify(schedFri)}, new Date('${friday.toISOString()}'), ${JSON.stringify(state)})`);
  const cvsThu = app.eval(`generateSalahTimetableCanvas(${JSON.stringify(schedThu)}, new Date('${thursday.toISOString()}'), ${JSON.stringify(state)})`);

  const textFri = cvsFri.getContext('2d').drawCalls.filter(c => c.method === 'fillText').map(c => c.text);
  const textThu = cvsThu.getContext('2d').drawCalls.filter(c => c.method === 'fillText').map(c => c.text);

  assert.ok(textFri.includes('Jummah'), 'Friday timetable must display Jummah');
  assert.ok(!textFri.includes('Dhuhr'), 'Friday timetable must NOT display Dhuhr');
  assert.ok(textThu.includes('Dhuhr'), 'Thursday timetable must display Dhuhr');
});

console.log('\n================================================================================');
console.log(`STRESS-TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================================');
if (failed > 0) process.exit(1);
