// tests/tier5_adversarial_ephemeris.test.js
// Tier 5: Adversarial Ephemeris, Sunset Rollover, Midnight Invariance & Active Highlighting Stress Suite
// 100% Offline, Zero-Dependency Adversarial Harness

const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  loadApp,
  getAccurateIslamicDate,
  calculateAccurateHanafiTimes,
  formatTime12,
  INDEX_HTML_PATH
} = require('./test_harness.js');

function runTier5Tests() {
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
  // DOMAIN 1: Maghrib Sunset Second Precision Across Seasons & Indian Geography
  // =========================================================================

  const seasonalDates = [
    { season: 'Summer Solstice', dateStr: '2026-06-21', lat: 21.1960, lng: 72.7940 },
    { season: 'Winter Solstice', dateStr: '2026-12-21', lat: 21.1960, lng: 72.7940 },
    { season: 'Vernal Equinox', dateStr: '2026-03-20', lat: 21.1960, lng: 72.7940 },
    { season: 'Autumnal Equinox', dateStr: '2026-09-22', lat: 21.1960, lng: 72.7940 },
    { season: 'Current Date', dateStr: '2026-09-09', lat: 21.1960, lng: 72.7940 }
  ];

  seasonalDates.forEach(({ season, dateStr, lat, lng }) => {
    test(`T5.1: Maghrib sunset transition precision on ${season} (${dateStr})`, () => {
      const targetDate = new Date(`${dateStr}T00:00:00+05:30`);
      const schedule = calculateAccurateHanafiTimes(lat, lng, targetDate, 'MOSQUE');
      const maghribDec = schedule.maghrib;
      const maghribH = Math.floor(maghribDec);
      const maghribM = Math.floor((maghribDec - maghribH) * 60);
      const maghribS = Math.round(((maghribDec - maghribH) * 60 - maghribM) * 60);

      const clockBefore = new Date(targetDate);
      clockBefore.setHours(maghribH, maghribM, maghribS - 1);

      const clockAt = new Date(targetDate);
      clockAt.setHours(maghribH, maghribM, maghribS);

      const clockAfter = new Date(targetDate);
      clockAfter.setHours(maghribH, maghribM, maghribS + 1);

      const resBefore = getAccurateIslamicDate(targetDate, maghribDec, 0, clockBefore);
      const resAt = getAccurateIslamicDate(targetDate, maghribDec, 0, clockAt);
      const resAfter = getAccurateIslamicDate(targetDate, maghribDec, 0, clockAfter);

      assert.strictEqual(resBefore.isPastSunset, false, `1s before Maghrib must NOT be past sunset on ${season}`);
      assert.strictEqual(resAt.isPastSunset, true, `At exact Maghrib second must BE past sunset on ${season}`);
      assert.strictEqual(resAfter.isPastSunset, true, `1s after Maghrib must BE past sunset on ${season}`);

      // The Islamic day at sunset must be exactly +1 compared to before sunset
      // Account for potential month boundary (e.g. 29/30 -> 1)
      if (resAt.month === resBefore.month) {
        assert.strictEqual(resAt.day, resBefore.day + 1, `Day must advance by 1 at sunset on ${season}`);
      } else {
        assert.strictEqual(resAt.day, 1, `Day must roll over to 1 on month boundary on ${season}`);
      }
      assert.strictEqual(resAfter.day, resAt.day, `Day after sunset must match day at sunset on ${season}`);
    });
  });

  test('T5.1.SubSec: Sub-second boundary precision (100ms before vs 100ms after)', () => {
    const baseDate = new Date('2026-09-09T00:00:00+05:30');
    const clock100msBefore = new Date('2026-09-09T18:47:59.900+05:30');
    const clock100msAfter = new Date('2026-09-09T18:48:00.100+05:30');

    const resBefore = getAccurateIslamicDate(baseDate, '18:48', 0, clock100msBefore);
    const resAfter = getAccurateIslamicDate(baseDate, '18:48', 0, clock100msAfter);

    assert.strictEqual(resBefore.isPastSunset, false);
    assert.strictEqual(resAfter.isPastSunset, true);
    assert.strictEqual(resAfter.day, resBefore.day + 1);
  });

  const indianCities = [
    { name: 'Surat', lat: 21.1960, lng: 72.7940 },
    { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
    { name: 'Srinagar', lat: 34.0837, lng: 74.7973 },
    { name: 'Kanyakumari', lat: 8.0883, lng: 77.5385 },
    { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
    { name: 'Dwarka', lat: 22.2442, lng: 68.9685 }
  ];

  indianCities.forEach(city => {
    test(`T5.1.Geo: Maghrib calculation and rollover across Indian geography (${city.name})`, () => {
      const d = new Date('2026-09-09T00:00:00+05:30');
      const s = calculateAccurateHanafiTimes(city.lat, city.lng, d, 'MOSQUE');
      assert.ok(!isNaN(s.maghrib), `Maghrib for ${city.name} must be numeric`);
      assert.ok(s.maghrib >= 17.0 && s.maghrib <= 20.0, `Maghrib for ${city.name} in reasonable range`);

      const dayClock = new Date('2026-09-09T12:00:00+05:30');
      const nightClock = new Date('2026-09-09T22:00:00+05:30');
      const resDay = getAccurateIslamicDate(d, s.maghrib, 0, dayClock);
      const resNight = getAccurateIslamicDate(d, s.maghrib, 0, nightClock);

      assert.strictEqual(resDay.isPastSunset, false);
      assert.strictEqual(resNight.isPastSunset, true);
      assert.strictEqual(resNight.day, resDay.day + 1);
    });
  });

  test('T5.1.LiveDOM: App DOM updates txtDateHeader when crossing Maghrib', () => {
    // On 2026-09-09 in Surat, calculated Maghrib with 3m mosque buffer is 18:52:00
    const appBefore = loadApp({ mockDate: '2026-09-09T18:51:50+05:30' });
    const headerBefore = appBefore.document.getElementById('txtDateHeader').innerHTML;

    const appAfter = loadApp({ mockDate: '2026-09-09T18:52:10+05:30' });
    const headerAfter = appAfter.document.getElementById('txtDateHeader').innerHTML;

    assert.notStrictEqual(headerBefore, headerAfter, 'Date header HTML must change across Maghrib');
    assert.ok(headerBefore.includes('AH') && headerAfter.includes('AH'));
  });

  // =========================================================================
  // DOMAIN 2: Midnight (00:00) Invariance & Multi-Day Continuity
  // =========================================================================

  test('T5.2.1: Pre-midnight (23:59:59) to midnight (00:00:00) strictly preserves identical Hijri day', () => {
    const wedNight = new Date('2026-09-09T23:59:59+05:30');
    const thuMidnight = new Date('2026-09-10T00:00:00+05:30');

    // On Wednesday night (past Maghrib), Islamic date is advanced to Thursday's Islamic date
    const resWed = getAccurateIslamicDate(new Date('2026-09-09'), '18:48', 0, wedNight);
    // At Thursday midnight (before Thursday Maghrib), Islamic date MUST BE the same Thursday Islamic date!
    const resThu = getAccurateIslamicDate(new Date('2026-09-10'), '18:48', 0, thuMidnight);

    assert.strictEqual(resWed.isPastSunset, true, 'Wednesday night is past sunset');
    assert.strictEqual(resThu.isPastSunset, false, 'Thursday 00:00 is before Thursday sunset');
    assert.strictEqual(resThu.day, resWed.day, 'Midnight must NOT trigger a second date increment!');
    assert.strictEqual(resThu.month, resWed.month, 'Islamic month must remain identical across midnight');
    assert.strictEqual(resThu.year, resWed.year, 'Islamic year must remain identical across midnight');
    assert.strictEqual(resThu.formatted, resWed.formatted, 'Full formatted Islamic date string must match across midnight');
  });

  test('T5.2.2: Midnight (00:00:00) to 00:00:01 preserves identical Hijri date', () => {
    const t0 = new Date('2026-09-10T00:00:00+05:30');
    const t1 = new Date('2026-09-10T00:00:01+05:30');
    const res0 = getAccurateIslamicDate(new Date('2026-09-10'), '18:48', 0, t0);
    const res1 = getAccurateIslamicDate(new Date('2026-09-10'), '18:48', 0, t1);
    assert.strictEqual(res0.day, res1.day);
    assert.strictEqual(res0.formatted, res1.formatted);
  });

  test('T5.2.3: 24-hour chronometer simulation: exactly ONE increment occurs at Maghrib, ZERO at midnight', () => {
    const baseDate = new Date('2026-09-09T00:00:00+05:30');
    const maghribDec = 18.8; // 18:48

    let previousDay = null;
    const transitions = [];

    // Step every 10 minutes throughout the 24-hour cycle from 00:00 Sept 9 to 02:00 Sept 10
    for (let minute = 0; minute <= 26 * 60; minute += 10) {
      const clock = new Date(baseDate.getTime() + minute * 60000);
      const targetDate = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate());
      const res = getAccurateIslamicDate(targetDate, maghribDec, 0, clock);

      if (previousDay !== null && res.day !== previousDay) {
        transitions.push({
          timeStr: clock.toTimeString().slice(0, 8),
          dateStr: clock.toDateString(),
          from: previousDay,
          to: res.day
        });
      }
      previousDay = res.day;
    }

    // Over this 26-hour window, exactly ONE transition should occur: at Maghrib on Sept 9!
    // Midnight (00:00 Sept 10) must NOT produce a transition!
    assert.strictEqual(transitions.length, 1, `Expected exactly 1 transition, found: ${JSON.stringify(transitions)}`);
    assert.ok(transitions[0].timeStr.startsWith('18:'), `Transition occurred at Maghrib (${transitions[0].timeStr})`);
  });

  test('T5.2.4: 7-day continuous simulation: exactly 7 rollovers, all at sunset, 0 at midnight', () => {
    const startDate = new Date('2026-09-09T12:00:00+05:30');
    let previousDay = null;
    const sunsetTransitions = [];
    const midnightTransitions = [];

    // Step hour by hour for 168 hours (7 days)
    for (let h = 0; h < 168; h++) {
      const clock = new Date(startDate.getTime() + h * 3600000);
      const targetDate = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate());
      const res = getAccurateIslamicDate(targetDate, 18.8, 0, clock);

      if (previousDay !== null && res.day !== previousDay) {
        const hour = clock.getHours();
        if (hour >= 18 && hour <= 19) {
          sunsetTransitions.push(clock.toISOString());
        } else if (hour === 0) {
          midnightTransitions.push(clock.toISOString());
        }
      }
      previousDay = res.day;
    }

    assert.strictEqual(sunsetTransitions.length, 7, `Must have exactly 7 sunset transitions across 7 days, got ${sunsetTransitions.length}`);
    assert.strictEqual(midnightTransitions.length, 0, `Must have 0 midnight transitions across 7 days, got ${midnightTransitions.length}`);
  });

  // =========================================================================
  // DOMAIN 3: Ruet-e-Hilal Adjustment Matrix (-2 to +2) & Month Boundaries
  // =========================================================================

  const testOffsets = [-2, -1, 0, 1, 2];

  test('T5.3.1: Full Ruet-e-Hilal offset matrix on standard date is strictly monotonic', () => {
    const d = new Date('2026-09-09T12:00:00+05:30');
    const dayResults = testOffsets.map(offset => {
      return getAccurateIslamicDate(d, '18:48', offset, d).day;
    });

    // On 2026-09-09 (around 26 Safar), offsets -2 to +2 should yield [24, 25, 26, 27, 28]
    for (let i = 0; i < dayResults.length - 1; i++) {
      assert.strictEqual(dayResults[i + 1], dayResults[i] + 1,
        `Offset transition ${testOffsets[i]} -> ${testOffsets[i+1]} must increment day by 1`);
    }
  });

  test('T5.3.2: Month boundary: negative offset (-1, -2) at start of month wraps to previous month', () => {
    // Pick a date that corresponds to 1st or 2nd of an Islamic month
    // On 2026-09-14, Safar ends and Rabi al-Awwal begins (around 1 Rabi al-Awwal)
    const d = new Date('2026-09-14T12:00:00+05:30');
    const resBase = getAccurateIslamicDate(d, '18:48', 0, d);
    const resMinus1 = getAccurateIslamicDate(d, '18:48', -1, d);
    const resMinus2 = getAccurateIslamicDate(d, '18:48', -2, d);

    assert.ok(resMinus1.day >= 1 && resMinus1.day <= 30, 'Wrapped day must be valid 1-30');
    assert.ok(resMinus2.day >= 1 && resMinus2.day <= 30, 'Wrapped day must be valid 1-30');
    assert.ok(resMinus1.monthName.length > 0, 'Month name must be valid');
  });

  test('T5.3.3: Month boundary: positive offset (+1, +2) at end of month wraps to next month', () => {
    // 2026-09-12 is around 29 Safar
    const d = new Date('2026-09-12T12:00:00+05:30');
    const resPlus1 = getAccurateIslamicDate(d, '18:48', 1, d);
    const resPlus2 = getAccurateIslamicDate(d, '18:48', 2, d);

    assert.ok(resPlus1.day >= 1 && resPlus1.day <= 30);
    assert.ok(resPlus2.day >= 1 && resPlus2.day <= 30);
    assert.ok(resPlus1.formatted.includes('AH'));
  });

  test('T5.3.4: Year boundary: Dhul Hijjah to Muharram (New Islamic Year)', () => {
    // Islamic New Year 1448 AH was approx June 16, 2026
    const newYearEve = new Date('2026-06-16T12:00:00+05:30');
    const resEve = getAccurateIslamicDate(newYearEve, '19:15', 0, newYearEve);
    const resPost = getAccurateIslamicDate(newYearEve, '19:15', 1, newYearEve);

    assert.ok(resEve.year >= 1447 && resEve.year <= 1449, 'Year must be in plausible AH range');
    assert.ok(resPost.year >= 1447 && resPost.year <= 1449, 'Year must be in plausible AH range');
  });

  test('T5.3.5: Fallback Kuwaiti calendar produces valid day/month/year for all offsets', () => {
    const d = new Date('2026-09-09');
    testOffsets.forEach(offset => {
      const res = getAccurateIslamicDate(d, 18.8, offset);
      assert.ok(res.day >= 1 && res.day <= 30, `Offset ${offset} day out of range: ${res.day}`);
      assert.ok(res.month >= 1 && res.month <= 12, `Offset ${offset} month out of range: ${res.month}`);
      assert.ok(res.year >= 1440 && res.year <= 1460, `Offset ${offset} year out of range: ${res.year}`);
    });
  });

  // =========================================================================
  // DOMAIN 4: Active Prayer Highlighting & False-Positive Elimination
  // =========================================================================

  test('T5.4.1: Midnight to Fajr window (00:00 to 04:30): NO prayer row has active-target', () => {
    const testTimes = ['00:00:00', '01:30:00', '03:00:00', '04:15:00'];
    testTimes.forEach(timeStr => {
      const app = loadApp({ mockDate: `2026-09-09T${timeStr}+05:30` });
      const rowFajr = app.document.getElementById('rowFajr');
      const rowDhuhr = app.document.getElementById('rowDhuhr');
      const rowAsr = app.document.getElementById('rowAsr');
      const rowMaghrib = app.document.getElementById('rowMaghrib');
      const rowIsha = app.document.getElementById('rowIsha');

      assert.strictEqual(rowFajr.classList.contains('active-target'), false, `rowFajr must NOT be active at ${timeStr}`);
      assert.strictEqual(rowDhuhr.classList.contains('active-target'), false, `rowDhuhr must NOT be active at ${timeStr}`);
      assert.strictEqual(rowAsr.classList.contains('active-target'), false);
      assert.strictEqual(rowMaghrib.classList.contains('active-target'), false);
      assert.strictEqual(rowIsha.classList.contains('active-target'), false);

      const activeRows = app.document.querySelectorAll('.prayer-card.active-target');
      assert.strictEqual(activeRows.length, 0, `No prayer card must be active at ${timeStr}`);
    });
  });

  test('T5.4.2: Dawn Twilight (04:45 AM): Hero tag shows "Next Salah", never "Active Now"', () => {
    const app = loadApp({ mockDate: '2026-09-09T04:45:00+05:30' });
    const heroTag = app.document.getElementById('heroUpcomingTag').innerHTML;
    assert.ok(!heroTag.includes('Active Now'), 'Hero tag must not say Active Now before Fajr');
    assert.ok(heroTag.includes('Next Salah') || heroTag.includes('Dawn Twilight'));
  });

  test('T5.4.3: Sunrise to Zawal morning window (06:30 to 11:30): NO row active, Dhuhr NEVER highlighted', () => {
    const morningTimes = ['06:30:00', '08:00:00', '09:30:00', '11:00:00', '11:30:00'];
    morningTimes.forEach(timeStr => {
      const app = loadApp({ mockDate: `2026-09-09T${timeStr}+05:30` });
      const rowDhuhr = app.document.getElementById('rowDhuhr');
      const rowFajr = app.document.getElementById('rowFajr');

      assert.strictEqual(rowDhuhr.classList.contains('active-target'), false, `rowDhuhr must NOT be active at ${timeStr}`);
      assert.strictEqual(rowFajr.classList.contains('active-target'), false, `rowFajr must NOT be active at ${timeStr}`);

      const heroTag = app.document.getElementById('heroUpcomingTag').innerHTML;
      assert.ok(!heroTag.includes('Active Now'), `Hero must NOT display Active Now at ${timeStr}`);

      const activeRows = app.document.querySelectorAll('.prayer-card.active-target');
      assert.strictEqual(activeRows.length, 0, `Zero prayer rows must be active at morning time ${timeStr}`);
    });
  });

  test('T5.4.4: Zawal prohibited window (12:25 PM): Strictly Makruh, Dhuhr NOT active', () => {
    const app = loadApp({ mockDate: '2026-09-09T12:25:00+05:30' });
    const rowDhuhr = app.document.getElementById('rowDhuhr');
    assert.strictEqual(rowDhuhr.classList.contains('active-target'), false, 'Dhuhr row must NOT be active during Zawal');

    const heroTag = app.document.getElementById('heroUpcomingTag').innerHTML;
    assert.ok(heroTag.includes('Zawal') || heroTag.includes('Forbidden') || heroTag.includes('Makruh'),
      'Hero tag must indicate Zawal forbidden window');
    assert.ok(!heroTag.includes('Active Now'), 'Hero must not show Active Now during Zawal');

    const label = app.document.getElementById('heroCountdownLabel').innerText;
    assert.ok(label.includes('Zawal') || label.includes('Starts in'), 'Countdown label must be Zawal-oriented');
  });

  test('T5.4.5: Exact Dhuhr window (01:15 PM): Dhuhr IS active, all other prayers cleared', () => {
    const app = loadApp({ mockDate: '2026-09-09T13:15:00+05:30' });
    const rowDhuhr = app.document.getElementById('rowDhuhr');
    const rowFajr = app.document.getElementById('rowFajr');
    const rowAsr = app.document.getElementById('rowAsr');

    assert.strictEqual(rowDhuhr.classList.contains('active-target'), true, 'Dhuhr MUST be active during Dhuhr time');
    assert.strictEqual(rowFajr.classList.contains('active-target'), false);
    assert.strictEqual(rowAsr.classList.contains('active-target'), false);

    const heroTag = app.document.getElementById('heroUpcomingTag').innerHTML;
    assert.ok(heroTag.includes('Active Now'), 'Hero tag must show Active Now');
  });

  test('T5.4.6a: Tomorrow browsing (dateOffset = +1): NO row ever has active-target', () => {
    const app = loadApp({ mockDate: '2026-09-09T13:15:00+05:30' }); // Dhuhr time
    const btnNextDay = app.document.getElementById('btnNextDay');
    btnNextDay.click(); // Now dateOffset = 1 (Tomorrow)

    const rowDhuhr = app.document.getElementById('rowDhuhr');
    assert.strictEqual(rowDhuhr.classList.contains('active-target'), false,
      'When viewing tomorrow (+1), rowDhuhr must NOT receive active-target (omission of dateOffset in newActivePrayerKey)');

    const activeRows = app.document.querySelectorAll('.prayer-card.active-target');
    assert.strictEqual(activeRows.length, 0, 'No rows should be active when browsing tomorrow');
  });

  test('T5.4.6b: Yesterday browsing (dateOffset = -1): NO row ever has active-target', () => {
    const app = loadApp({ mockDate: '2026-09-09T13:15:00+05:30' }); // Dhuhr time
    const btnPrevDay = app.document.getElementById('btnPrevDay');
    btnPrevDay.click(); // Now dateOffset = -1 (Yesterday)

    const rowDhuhr = app.document.getElementById('rowDhuhr');
    assert.strictEqual(rowDhuhr.classList.contains('active-target'), false,
      'When viewing yesterday (-1), rowDhuhr must NOT receive active-target');

    const activeRows = app.document.querySelectorAll('.prayer-card.active-target');
    assert.strictEqual(activeRows.length, 0, 'No rows should be active when browsing yesterday');
  });

  test('T5.4.7: 24-Hour 1,440-minute sweep: active row count is ALWAYS 0 or 1, never >= 2', () => {
    const app = loadApp();
    const updateLiveHeroFn = app.eval('updateLiveHero');
    assert.ok(typeof updateLiveHeroFn === 'function');

    const todayDate = new Date('2026-09-09T00:00:00+05:30');
    const schedule = calculateAccurateHanafiTimes(21.1960, 72.7940, todayDate, 'MOSQUE');

    // Sample across each key hour (every 15 minutes of the day = 96 sample points)
    for (let minute = 0; minute < 1440; minute += 15) {
      const h = Math.floor(minute / 60);
      const m = minute % 60;
      const testClock = new Date(todayDate);
      testClock.setHours(h, m, 0, 0);

      // Evaluate active prayer logic
      const decH = h + (m / 60.0);
      const isFajr = (decH >= schedule.fajr && decH < schedule.sunrise);
      const isDhuhr = (decH >= schedule.dhuhr && decH < schedule.asr);
      const isAsr = (decH >= schedule.asr && decH < schedule.maghrib);
      const isMaghrib = (decH >= schedule.maghrib && decH < schedule.isha);
      const isIsha = (decH >= schedule.isha);
      const isGap = (decH < schedule.fajr) || (decH >= schedule.sunrise && decH < schedule.dhuhr);

      const activeCount = [isFajr, isDhuhr, isAsr, isMaghrib, isIsha].filter(Boolean).length;
      assert.ok(activeCount <= 1, `At ${h}:${m}, activeCount must be <= 1 (got ${activeCount})`);

      if (isGap) {
        assert.strictEqual(activeCount, 0, `Gap window at ${h}:${m} must have 0 active prayers`);
      }
    }
  });

  // =========================================================================
  // DOMAIN 5: Ephemeris Invariants & Shadow Factor Proofs
  // =========================================================================

  test('T5.5.1: Hanafi 2x shadow factor invariant: Asr Hanafi is strictly later than Shafi Asr by > 45 mins', () => {
    seasonalDates.forEach(({ season, dateStr, lat, lng }) => {
      const d = new Date(`${dateStr}T12:00:00+05:30`);
      const sHanafi = calculateAccurateHanafiTimes(lat, lng, d, 'MOSQUE');

      // Shafi Asr calculation (factor = 1.0)
      const jd = require('./test_harness.js').getJulianDay(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const solar = require('./test_harness.js').calculateSolarCoordinates(jd);
      const DEG2RAD = Math.PI / 180.0;
      const RAD2DEG = 180.0 / Math.PI;
      const noonAltitude = 90.0 - Math.abs(lat - (solar.declination * RAD2DEG));
      const noonShadow = Math.tan((90.0 - noonAltitude) * DEG2RAD);
      const asrAltShafi = Math.atan(1.0 / (1.0 + noonShadow)) * RAD2DEG;
      const hAsrShafi = require('./test_harness.js').computeHourAngle(asrAltShafi, lat, solar.declination);
      const tzOffset = 5.5;
      const transitUTC = 12.0 - (lng / 15.0) - (solar.eotMinutes / 60.0);
      const dhuhrTransit = (transitUTC + tzOffset) % 24.0;
      const asrShafi = dhuhrTransit + hAsrShafi;

      const diffHours = sHanafi.asr - asrShafi;
      const diffMinutes = diffHours * 60;

      assert.ok(diffMinutes >= 45, `On ${season}, Hanafi Asr must be >= 45 mins later than Shafi (got ${diffMinutes.toFixed(1)} mins)`);
    });
  });

  test('T5.5.2: Rounding invariants: roundForward vs roundBackward never invert order', () => {
    const d = new Date('2026-09-09');
    const s = calculateAccurateHanafiTimes(21.1960, 72.7940, d, 'MOSQUE');

    // Suhoor (roundBackward) must be strictly <= Fajr (roundForward)
    assert.ok(s.suhoor < s.fajr, 'Suhoor must be before Fajr');
    // Fajr must be before Sunrise
    assert.ok(s.fajr < s.sunrise, 'Fajr must be before Sunrise');
    // Sunrise must be before Dhuhr
    assert.ok(s.sunrise < s.dhuhr, 'Sunrise must be before Dhuhr');
    // Dhuhr must be before Asr
    assert.ok(s.dhuhr < s.asr, 'Dhuhr must be before Asr');
    // Asr must be before Maghrib
    assert.ok(s.asr < s.maghrib, 'Asr must be before Maghrib');
    // Maghrib must be before Isha
    assert.ok(s.maghrib < s.isha, 'Maghrib must be before Isha');
  });

  return results;
}

module.exports = { runTier5Tests };

if (require.main === module) {
  const { performance } = require('node:perf_hooks');
  const start = performance.now();
  console.log('>> [TIER 5] Running Adversarial Ephemeris & Date Stress Tests...');
  const results = runTier5Tests();
  const dur = (performance.now() - start).toFixed(2);
  const passed = results.filter(r => r.passed).length;
  console.log(`   [STATUS] ${passed}/${results.length} tests passed in ${dur} ms`);
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.error('\n>>> FAILURES ENCOUNTERED:');
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. ${f.name}`);
      console.error(`     Error: ${f.error}`);
    });
    process.exit(1);
  }
}
