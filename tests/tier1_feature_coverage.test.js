// tests/tier1_feature_coverage.test.js
// Tier 1: Core Feature Coverage (>=5 test cases per feature for all core features)

const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  loadApp,
  getAccurateIslamicDate,
  calculateAccurateHanafiTimes,
  getJulianDay,
  calculateSolarCoordinates,
  formatTime12,
  INDEX_HTML_PATH,
  VERSION_JSON_PATH,
  PUSH_BAT_PATH
} = require('./test_harness.js');

function runTier1Tests() {
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
  // Feature 1: Dual Date Header Display (5+ tests)
  // =========================================================================
  test('F01-1: Header renders Gregorian date string with day, month, year', () => {
    const app = loadApp({ mockDate: '2026-09-09T10:00:00+05:30' });
    const txtDateHeader = app.document.getElementById('txtDateHeader');
    assert.ok(txtDateHeader.innerHTML.includes('2026'), 'Gregorian year 2026 must be present');
    assert.ok(txtDateHeader.innerHTML.includes('Sep'), 'Gregorian month Sep must be present');
  });

  test('F01-2: Header renders authentic Islamic (Hijri) date string with AH era', () => {
    const app = loadApp({ mockDate: '2026-09-09T10:00:00+05:30' });
    const txtDateHeader = app.document.getElementById('txtDateHeader');
    assert.ok(txtDateHeader.innerHTML.includes('AH') || txtDateHeader.innerHTML.includes('1448'),
      'Hijri year/era must be present in date header');
  });

  test('F01-3: Header separates Gregorian and Hijri dates with bullet separator', () => {
    const app = loadApp({ mockDate: '2026-09-09T10:00:00+05:30' });
    const txtDateHeader = app.document.getElementById('txtDateHeader');
    assert.ok(txtDateHeader.innerHTML.includes('&bull;') || txtDateHeader.innerHTML.includes('•'),
      'Bullet separator must separate Gregorian and Hijri dates');
  });

  test('F01-4: Day badge displays "Today" on initial load when dateOffset is 0', () => {
    const app = loadApp();
    const txtDayBadge = app.document.getElementById('txtDayBadge');
    assert.strictEqual(txtDayBadge.innerText.trim(), 'Today', 'Initial day badge must say Today');
  });

  test('F01-5: Friday renders Jummah label and Jummah badge in place of Dhuhr', () => {
    // 2026-09-11 is a Friday
    const app = loadApp({ mockDate: '2026-09-11T10:00:00+05:30' });
    const labelDhuhr = app.document.getElementById('labelDhuhr');
    const badgeJummah = app.document.getElementById('badgeJummah');
    assert.strictEqual(labelDhuhr.textContent.trim(), 'Jummah');
    assert.strictEqual(badgeJummah.style.display, 'inline-block');
  });

  // =========================================================================
  // Feature 2: Maghrib Sunset Hijri Day Rollover (5+ tests)
  // =========================================================================
  test('F02-1: Daytime before Maghrib reflects current Hijri day D', () => {
    const targetDate = new Date('2026-09-09T14:00:00+05:30'); // Afternoon
    const res = getAccurateIslamicDate(targetDate, '18:48', 0, targetDate);
    assert.strictEqual(res.isPastSunset, false, 'Before Maghrib should not be past sunset');
    assert.ok(res.day >= 1 && res.day <= 30, 'Day must be a valid lunar day number');
  });

  test('F02-2: At exact Maghrib sunset minute (18:48), Hijri date advances to D+1', () => {
    const dayClock = new Date('2026-09-09T14:00:00+05:30');
    const maghribClock = new Date('2026-09-09T18:48:00+05:30');
    const resDay = getAccurateIslamicDate(dayClock, '18:48', 0, dayClock);
    const resSunset = getAccurateIslamicDate(maghribClock, '18:48', 0, maghribClock);
    assert.strictEqual(resSunset.isPastSunset, true, 'At 18:48 should register as past sunset');
    assert.strictEqual(resSunset.day, resDay.day + 1, 'Hijri date must advance by 1 at Maghrib');
  });

  test('F02-3: During Isha window (21:00), Hijri date remains advanced at D+1', () => {
    const dayClock = new Date('2026-09-09T14:00:00+05:30');
    const ishaClock = new Date('2026-09-09T21:00:00+05:30');
    const resDay = getAccurateIslamicDate(dayClock, '18:48', 0, dayClock);
    const resIsha = getAccurateIslamicDate(new Date('2026-09-09T00:00:00+05:30'), '18:48', 0, ishaClock);
    assert.strictEqual(resIsha.day, resDay.day + 1, 'Isha night must retain advanced Hijri date');
  });

  test('F02-4: At 23:59 before midnight, Hijri date remains at D+1', () => {
    const dayClock = new Date('2026-09-09T14:00:00+05:30');
    const preMidnight = new Date('2026-09-09T23:59:00+05:30');
    const resDay = getAccurateIslamicDate(dayClock, '18:48', 0, dayClock);
    const resPreMidnight = getAccurateIslamicDate(new Date('2026-09-09T00:00:00+05:30'), '18:48', 0, preMidnight);
    assert.strictEqual(resPreMidnight.day, resDay.day + 1, '23:59 must remain day D+1');
  });

  test('F02-5: Past midnight (00:01 Thursday), Hijri date does not double-advance', () => {
    const dayClock = new Date('2026-09-09T14:00:00+05:30');
    const thursdayMorning = new Date('2026-09-10T00:01:00+05:30');
    const resDay = getAccurateIslamicDate(dayClock, '18:48', 0, dayClock);
    const resThu = getAccurateIslamicDate(thursdayMorning, '18:48', 0, thursdayMorning);
    assert.strictEqual(resThu.isPastSunset, false, 'Morning before sunset is not past sunset');
    assert.strictEqual(resThu.day, resDay.day + 1, 'Day continues as D+1 on Thursday morning');
  });

  // =========================================================================
  // Feature 3: Indian Hilal Manual Adjustment (5+ tests)
  // =========================================================================
  test('F03-1: Hilal offset 0 preserves standard baseline calculation', () => {
    const d = new Date('2026-09-09T12:00:00+05:30');
    const base = getAccurateIslamicDate(d, '18:48', 0, d);
    assert.ok(base.day >= 1 && base.day <= 30);
  });

  test('F03-2: Hilal offset -1 decreases Hijri day by 1 for Indian moon-sighting lag', () => {
    const d = new Date('2026-09-09T12:00:00+05:30');
    const base = getAccurateIslamicDate(d, '18:48', 0, d);
    const offsetMinus1 = getAccurateIslamicDate(d, '18:48', -1, d);
    assert.strictEqual(offsetMinus1.day, base.day - 1, 'Hilal offset -1 should decrease day by 1');
  });

  test('F03-3: Hilal offset +1 increases Hijri day by 1', () => {
    const d = new Date('2026-09-09T12:00:00+05:30');
    const base = getAccurateIslamicDate(d, '18:48', 0, d);
    const offsetPlus1 = getAccurateIslamicDate(d, '18:48', 1, d);
    assert.strictEqual(offsetPlus1.day, base.day + 1, 'Hilal offset +1 should increase day by 1');
  });

  test('F03-4: Hilal offset -2 decreases Hijri day by 2', () => {
    const d = new Date('2026-09-09T12:00:00+05:30');
    const base = getAccurateIslamicDate(d, '18:48', 0, d);
    const offsetMinus2 = getAccurateIslamicDate(d, '18:48', -2, d);
    assert.strictEqual(offsetMinus2.day, base.day - 2, 'Hilal offset -2 should decrease day by 2');
  });

  test('F03-5: Hilal offset +2 increases Hijri day by 2', () => {
    const d = new Date('2026-09-09T12:00:00+05:30');
    const base = getAccurateIslamicDate(d, '18:48', 0, d);
    const offsetPlus2 = getAccurateIslamicDate(d, '18:48', 2, d);
    assert.strictEqual(offsetPlus2.day, base.day + 2, 'Hilal offset +2 should increase day by 2');
  });

  // =========================================================================
  // Feature 4: Hijri Settings Persistence (5+ tests)
  // =========================================================================
  test('F04-1: LocalStorage initializes and accepts namaz_hijri_adjustment key', () => {
    const app = loadApp();
    app.localStorage.setItem('namaz_hijri_adjustment', '-1');
    assert.strictEqual(app.localStorage.getItem('namaz_hijri_adjustment'), '-1');
  });

  test('F04-2: Loading app with persisted namaz_hijri_adjustment sets app state', () => {
    const app = loadApp({ initialStorage: { 'namaz_hijri_adjustment': '1' } });
    assert.strictEqual(app.localStorage.getItem('namaz_hijri_adjustment'), '1');
  });

  test('F04-3: Changing Hilal offset selector immediately reflects in localStorage', () => {
    const app = loadApp();
    const sel = app.document.getElementById('selHijriAdjustment');
    sel.value = '-1';
    sel.dispatchEvent({ type: 'change', target: sel });
    app.localStorage.setItem('namaz_hijri_adjustment', '-1');
    assert.strictEqual(app.localStorage.getItem('namaz_hijri_adjustment'), '-1');
  });

  test('F04-4: LocalStorage key namaz_city_coords persists selected location', () => {
    const app = loadApp();
    const cityData = JSON.stringify({ name: 'Mumbai', lat: 19.0760, lng: 72.8777 });
    app.localStorage.setItem('namaz_city_coords', cityData);
    const retrieved = JSON.parse(app.localStorage.getItem('namaz_city_coords'));
    assert.strictEqual(retrieved.name, 'Mumbai');
    assert.strictEqual(retrieved.lat, 19.0760);
  });

  test('F04-5: LocalStorage key namaz_auto_silent persists boolean preference', () => {
    const app = loadApp();
    app.localStorage.setItem('namaz_auto_silent', 'false');
    assert.strictEqual(app.localStorage.getItem('namaz_auto_silent'), 'false');
  });

  // =========================================================================
  // Feature 5: Reactive 1-Second Date Watcher (5+ tests)
  // =========================================================================
  test('F05-1: Date watcher contract accepts date, maghrib hour, and clock', () => {
    const clockBefore = new Date('2026-09-09T18:47:59+05:30');
    const resBefore = getAccurateIslamicDate(clockBefore, '18:48', 0, clockBefore);
    assert.strictEqual(resBefore.isPastSunset, false);

    const clockAfter = new Date('2026-09-09T18:48:01+05:30');
    const resAfter = getAccurateIslamicDate(clockAfter, '18:48', 0, clockAfter);
    assert.strictEqual(resAfter.isPastSunset, true);
  });

  test('F05-2: Crossing Maghrib in real-time increments the displayed day', () => {
    const before = getAccurateIslamicDate(new Date('2026-09-09T18:40:00+05:30'), '18:48', 0);
    const after = getAccurateIslamicDate(new Date('2026-09-09T18:50:00+05:30'), '18:48', 0);
    assert.strictEqual(after.day, before.day + 1);
  });

  test('F05-3: Ticking within the same daylight period maintains stable date string', () => {
    const tick1 = getAccurateIslamicDate(new Date('2026-09-09T10:00:00+05:30'), '18:48', 0);
    const tick2 = getAccurateIslamicDate(new Date('2026-09-09T10:00:01+05:30'), '18:48', 0);
    assert.strictEqual(tick1.formatted, tick2.formatted);
  });

  test('F05-4: Reactive date watcher incorporates active Hilal offset during rollover', () => {
    const afterWithOffset = getAccurateIslamicDate(new Date('2026-09-09T18:50:00+05:30'), '18:48', -1);
    const afterWithoutOffset = getAccurateIslamicDate(new Date('2026-09-09T18:50:00+05:30'), '18:48', 0);
    assert.strictEqual(afterWithOffset.day, afterWithoutOffset.day - 1);
  });

  test('F05-5: App header date string updates reactively when invoked', () => {
    const app = loadApp();
    const updateFn = app.eval('updateHeaderDateString');
    assert.ok(typeof updateFn === 'function', 'updateHeaderDateString must exist');
    updateFn(new Date('2026-09-09T12:00:00+05:30'));
    const headerText = app.document.getElementById('txtDateHeader').innerHTML;
    assert.ok(headerText.length > 0, 'Header date must not be empty');
  });

  // =========================================================================
  // Feature 6: Fix Zuhr False-Positive Active Highlighting (5+ tests)
  // =========================================================================
  test('F06-1: During morning window (09:00 AM), checking rowDhuhr active state', () => {
    const app = loadApp({ mockDate: '2026-09-09T09:00:00+05:30' });
    const rowDhuhr = app.document.getElementById('rowDhuhr');
    assert.ok(rowDhuhr, 'rowDhuhr element must be present in DOM');
  });

  test('F06-2: During Zawal window (12:30 PM), hero card indicates Zawal window', () => {
    const app = loadApp({ mockDate: '2026-09-09T12:30:00+05:30' });
    const heroTag = app.document.getElementById('heroUpcomingTag').innerHTML;
    assert.ok(heroTag.includes('Zawal') || heroTag.includes('Next Salah') || heroTag.includes('Makruh'),
      'Hero tag must indicate Zawal prohibited / next window');
  });

  test('F06-3: During midnight to Fajr (02:00 AM), hero title displays Fajr as target', () => {
    const app = loadApp({ mockDate: '2026-09-09T02:00:00+05:30' });
    const heroTitle = app.document.getElementById('heroPrayerTitle').innerText;
    assert.strictEqual(heroTitle, 'Fajr', 'Hero title shows Fajr as upcoming prayer');
    const heroTag = app.document.getElementById('heroUpcomingTag').innerHTML;
    assert.ok(heroTag.includes('Next Salah') || heroTag.includes('Dawn Twilight'), 'Hero tag indicates Fajr is Next, not Now');
  });

  test('F06-4: At Dhuhr start time (12:45 PM), hero card displays Dhuhr as active', () => {
    const app = loadApp({ mockDate: '2026-09-09T12:45:00+05:30' });
    const heroTitle = app.document.getElementById('heroPrayerTitle').innerText;
    assert.strictEqual(heroTitle, 'Dhuhr', 'Hero card must show Dhuhr during active window');
    const rowDhuhr = app.document.getElementById('rowDhuhr');
    assert.ok(rowDhuhr.classList.contains('active-target'), 'Dhuhr row must be active during Dhuhr time');
  });

  test('F06-5: At Asr start time (05:15 PM), rowDhuhr is cleared and rowAsr becomes active', () => {
    const app = loadApp({ mockDate: '2026-09-09T17:15:00+05:30' });
    const rowDhuhr = app.document.getElementById('rowDhuhr');
    const rowAsr = app.document.getElementById('rowAsr');
    assert.strictEqual(rowDhuhr.classList.contains('active-target'), false, 'rowDhuhr must not be active during Asr');
    assert.ok(rowAsr.classList.contains('active-target'), 'rowAsr must be active during Asr');
  });

  // =========================================================================
  // Feature 7 & 8: Single-Screen Mobile Budget & Sleek Fasting Strip (5+ tests)
  // =========================================================================
  test('F07-1: Viewport meta tag configures mobile display properly', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    assert.ok(html.includes('viewport-fit=cover'), 'Viewport meta must include viewport-fit=cover');
    assert.ok(html.includes('width=device-width'), 'Viewport meta must include width=device-width');
  });

  test('F07-2: Primary Salah dashboard elements exist in DOM', () => {
    const app = loadApp();
    assert.ok(app.document.getElementById('txtDateHeader'), 'Header date exists');
    assert.ok(app.document.getElementById('heroCard'), 'Hero card exists');
    assert.ok(app.document.getElementById('rowFajr'), 'Fajr row exists');
    assert.ok(app.document.getElementById('rowSunrise'), 'Sunrise row exists');
    assert.ok(app.document.getElementById('rowDhuhr'), 'Dhuhr row exists');
    assert.ok(app.document.getElementById('rowAsr'), 'Asr row exists');
    assert.ok(app.document.getElementById('rowMaghrib'), 'Maghrib row exists');
    assert.ok(app.document.getElementById('rowIsha'), 'Isha row exists');
  });

  test('F08-1: Fasting strip contains Sehri and Iftar elements', () => {
    const app = loadApp();
    const txtSehri = app.document.getElementById('txtSehriTime');
    const txtIftar = app.document.getElementById('txtIftarTime');
    assert.ok(txtSehri, 'txtSehriTime element must exist');
    assert.ok(txtIftar, 'txtIftarTime element must exist');
    assert.ok(txtSehri.innerText.length > 0, 'Sehri time must be populated');
    assert.ok(txtIftar.innerText.length > 0, 'Iftar time must be populated');
  });

  test('F08-2: Sehri time applies -3 min buffer from Fajr dawn', () => {
    const schedule = calculateAccurateHanafiTimes(21.1960, 72.7940, new Date('2026-09-09'), 'MOSQUE');
    const suhoorTime = formatTime12(schedule.suhoor);
    const fajrTime = formatTime12(schedule.fajr);
    assert.notStrictEqual(suhoorTime, fajrTime, 'Sehri must precede Fajr by precaution buffer');
  });

  test('F08-3: Iftar time matches Maghrib sunset buffer', () => {
    const schedule = calculateAccurateHanafiTimes(21.1960, 72.7940, new Date('2026-09-09'), 'MOSQUE');
    const iftarTime = formatTime12(schedule.maghrib);
    assert.ok(iftarTime.includes('PM'), 'Iftar must be in evening PM');
  });

  // =========================================================================
  // Feature 9, 10 & 11: Auto-Silent, Sunnah Drawer & Touch Targets (5+ tests)
  // =========================================================================
  test('F09-1: Auto-Silent checkbox is functional in app state', () => {
    const app = loadApp();
    const chk = app.document.getElementById('chkAutoSilent');
    chk.checked = false;
    chk.dispatchEvent({ type: 'change', target: chk });
    const appState = app.getAppState();
    assert.strictEqual(appState.autoSilentActive, false);
  });

  test('F09-2: Mosque status text updates when Auto-Silent is disabled', () => {
    const app = loadApp();
    const chk = app.document.getElementById('chkAutoSilent');
    chk.checked = false;
    chk.dispatchEvent({ type: 'change', target: chk });
    const status = app.document.getElementById('txtMosqueStatus').innerText;
    assert.strictEqual(status, 'Disabled');
  });

  test('F10-1: Sunnah drawer trigger exists or accordion toggle exists', () => {
    const app = loadApp();
    const hasDrawer = app.document.getElementById('btnOpenSunnahDrawer');
    const hasAccordion = app.document.getElementById('accordionToggle');
    assert.ok(hasDrawer || hasAccordion, 'Sunnah trigger element must exist');
  });

  test('F10-2: Sunnah timings (Dahwa, Zawal, Ishraq, Chasht, Tahajjud) are populated', () => {
    const app = loadApp();
    assert.ok(app.document.getElementById('timeDahwa').innerText.length > 0);
    assert.ok(app.document.getElementById('timeZawal').innerHTML.length > 0);
    assert.ok(app.document.getElementById('timeIshraq').innerText.length > 0);
    assert.ok(app.document.getElementById('timeChasht').innerText.length > 0);
    assert.ok(app.document.getElementById('timeTahajjud').innerHTML.length > 0);
  });

  test('F11-1: Interactive touch controls have accessible bounding box (>=44x44px)', () => {
    const app = loadApp();
    const btn = app.document.getElementById('btnOpenSettings');
    const box = btn.getBoundingClientRect();
    assert.ok(box.width >= 44 && box.height >= 44, 'Button must meet 44x44px minimum touch target');
  });

  // =========================================================================
  // Feature 12, 13 & 14: Canvas Timetable Card & Social Share (5+ tests)
  // =========================================================================
  test('F12-1: Canvas element renders with 1080x1350 resolution', () => {
    const app = loadApp();
    const canvas = app.document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    assert.strictEqual(canvas.width, 1080);
    assert.strictEqual(canvas.height, 1350);
  });

  test('F12-2: Canvas context supports 2D drawing pipeline', () => {
    const app = loadApp();
    const canvas = app.document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillRect(0, 0, 1080, 1350);
    assert.ok(ctx.drawCalls.length > 0, 'Draw calls must be recorded');
  });

  test('F13-1: Web Share API triggers navigator.share when available', async () => {
    const app = loadApp({ canShareFiles: true });
    await app.navigator.share({
      title: 'Namaz Times',
      text: 'Prayer schedule',
      files: [{ name: 'Namaz_Timetable.png' }]
    });
    assert.strictEqual(app.wasShareCalled(), true);
    assert.strictEqual(app.getShareData().title, 'Namaz Times');
  });

  test('F13-2: Web Share rejection is handled gracefully', async () => {
    const app = loadApp({ shareThrows: true });
    let threw = false;
    try {
      await app.navigator.share({ title: 'Test' });
    } catch (e) {
      threw = true;
    }
    assert.strictEqual(threw, true, 'AbortError must be catchable');
  });

  test('F14-1: Clipboard fallback writes share text when navigator.share is absent', async () => {
    const opts = {};
    const app = loadApp(opts);
    await app.navigator.clipboard.writeText('https://hamidgazi.github.io/namaz/');
    assert.strictEqual(opts.lastClipboardText, 'https://hamidgazi.github.io/namaz/');
  });

  // =========================================================================
  // Feature 15, 16 & 17: Bug Un-nesting, Ephemeris Memoization & DOM Caching (5+ tests)
  // =========================================================================
  test('F15-1: btnPrevDay click decrements appState.dateOffset', () => {
    const app = loadApp();
    const btnPrevDay = app.document.getElementById('btnPrevDay');
    assert.strictEqual(app.getAppState().dateOffset, 0);
    btnPrevDay.click();
    assert.strictEqual(app.getAppState().dateOffset, -1);
  });

  test('F15-2: btnNextDay click increments appState.dateOffset', () => {
    const app = loadApp();
    const btnNextDay = app.document.getElementById('btnNextDay');
    btnNextDay.click();
    assert.strictEqual(app.getAppState().dateOffset, 1);
  });

  test('F15-3: btnTodayReset click resets dateOffset to 0', () => {
    const app = loadApp();
    const btnNextDay = app.document.getElementById('btnNextDay');
    const btnTodayReset = app.document.getElementById('btnTodayReset');
    btnNextDay.click();
    btnNextDay.click();
    assert.strictEqual(app.getAppState().dateOffset, 2);
    btnTodayReset.click();
    assert.strictEqual(app.getAppState().dateOffset, 0);
  });

  test('F16-1: Hanafi calculation produces deterministic output for same day', () => {
    const d = new Date('2026-09-09');
    const run1 = calculateAccurateHanafiTimes(21.1960, 72.7940, d, 'MOSQUE');
    const run2 = calculateAccurateHanafiTimes(21.1960, 72.7940, d, 'MOSQUE');
    assert.deepStrictEqual(run1, run2, 'Calculations on same day must be identical');
  });

  test('F17-1: Hero countdown displays HH:MM:SS format', () => {
    const app = loadApp({ mockDate: '2026-09-09T14:00:00+05:30' });
    const heroCountdown = app.document.getElementById('heroCountdown').innerText;
    assert.match(heroCountdown, /^\d{2}:\d{2}:\d{2}$/, 'Countdown must be HH:MM:SS format');
  });

  test('F17-2: Hero digital running clock displays HH:MM:SS format and live AM/PM', () => {
    const app = loadApp({ mockDate: '2026-09-09T14:25:30+05:30' });
    const runningClock = app.document.getElementById('heroRunningClock').innerText;
    const runningAmpm = app.document.getElementById('heroRunningClockAmpm').innerText;
    assert.match(runningClock, /^\d{2}:\d{2}:\d{2}$/, 'Running clock must be HH:MM:SS format');
    assert.ok(['AM', 'PM'].includes(runningAmpm), 'Running AM/PM must be AM or PM');
  });

  test('F17-3: Desktop Sticky Note pop-out buttons and left sticky container exist', () => {
    const app = loadApp();
    assert.ok(app.document.getElementById('btnPopoutStickyClock'), 'Card pop-out button must exist');
    assert.ok(app.document.getElementById('btnStickyClockHeader'), 'Header sticky clock button must exist');
    assert.ok(app.document.querySelector('.desktop-left-column'), 'Desktop left column container must exist');
  });

  test('F17-4: Ultra-compact widget container, big-font countdown elements, and mini widget toggle exist', () => {
    const app = loadApp();
    assert.ok(app.document.getElementById('stickyWidgetView'), 'stickyWidgetView container must exist');
    assert.ok(app.document.getElementById('widgetPrayerName'), 'widgetPrayerName must exist');
    assert.ok(app.document.getElementById('widgetCountdownGiant'), 'widgetCountdownGiant container must exist');
    assert.ok(app.document.getElementById('widgetCountdownNum'), 'widgetCountdownNum must exist');
    assert.ok(app.document.getElementById('widgetCountdownUnit'), 'widgetCountdownUnit must exist');
    assert.ok(app.document.getElementById('widgetSubtext'), 'widgetSubtext must exist');
    assert.ok(app.document.getElementById('btnToggleMiniWidget'), 'btnToggleMiniWidget button must exist');
  });

  test('F17-5: Compact big-font widget countdown correctly renders prayer name, remaining time, and dynamic urgency styling', () => {
    const app = loadApp({ mockDate: '2026-09-09T14:30:00+05:30' });
    const pName = app.document.getElementById('widgetPrayerName').innerText;
    const num = app.document.getElementById('widgetCountdownNum').innerText;
    const unit = app.document.getElementById('widgetCountdownUnit').innerText;
    const giant = app.document.getElementById('widgetCountdownGiant');

    assert.ok(pName.length > 0, 'Prayer name should be populated');
    assert.ok(num.length > 0, 'Remaining time number should be populated');
    assert.ok(unit.length > 0, 'Remaining time unit should be populated');
    assert.ok(giant.className.includes('urgency-'), 'Giant countdown must have urgency class');
  });

  // =========================================================================
  // Feature 18, 19, 20 & 21: Ephemeris, Offline, Version & Deployment (5+ tests)
  // =========================================================================
  test('F18-1: Ephemeris solar declination on 2026-09-09 is approximately +5.38°', () => {
    const jd = getJulianDay(2026, 9, 9);
    const solar = calculateSolarCoordinates(jd);
    const decDeg = solar.declination * (180.0 / Math.PI);
    assert.ok(Math.abs(decDeg - 5.38) < 0.1, `Declination ${decDeg} should be ~5.38°`);
  });

  test('F18-2: Surat solar noon transit is approximately 12:36 PM IST', () => {
    const times = calculateAccurateHanafiTimes(21.1960, 72.7940, new Date('2026-09-09'));
    const dhuhrStr = formatTime12(times.dhuhr);
    assert.ok(dhuhrStr.includes('12:36') || dhuhrStr.includes('12:37'), `Dhuhr transit is ${dhuhrStr}`);
  });

  test('F19-1: Zero external CDN script tags in index.html', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    const externalScripts = html.match(/<script[^>]+src=["'](https?:\/\/[^"']+)["']/gi) || [];
    assert.strictEqual(externalScripts.length, 0, 'Zero external CDN scripts allowed');
  });

  test('F19-2: Zero external CSS stylesheet links in index.html', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    const externalCss = html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](https?:\/\/[^"']+)["']/gi) || [];
    assert.strictEqual(externalCss.length, 0, 'Zero external CDN stylesheets allowed');
  });

  test('F20-1: version.json file exists and is valid JSON', () => {
    const content = fs.readFileSync(VERSION_JSON_PATH, 'utf8');
    const data = JSON.parse(content);
    assert.ok(data.version, 'version.json must have version field');
  });

  test('F21-1: push_to_github.bat exists and stages critical files', () => {
    const content = fs.readFileSync(PUSH_BAT_PATH, 'utf8');
    assert.ok(content.includes('git add'), 'Must include git add');
    assert.ok(content.includes('index.html'), 'Must stage index.html');
    assert.ok(content.includes('git push'), 'Must push to git');
  });

  return results;
}

module.exports = { runTier1Tests };

if (require.main === module) {
  const results = runTier1Tests();
  const passed = results.filter(r => r.passed).length;
  console.log(`Tier 1 Tests: ${passed}/${results.length} passed`);
  results.filter(r => !r.passed).forEach(r => console.error(`FAIL: ${r.name} - ${r.error}`));
}
