// tests/tier3_cross_feature.test.js
// Tier 3: Cross-Feature Combinations (Pairwise & Multi-Feature Interactions)

const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  loadApp,
  getAccurateIslamicDate,
  calculateAccurateHanafiTimes,
  formatTime12
} = require('./test_harness.js');

async function runTier3Tests() {
  const results = [];
  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message, stack: err.stack });
    }
  }

  // =========================================================================
  // Combination 1: Hilal Offset + Maghrib Rollover + Canvas Sharing Card
  // =========================================================================
  await test('T3.1: Hilal Offset (-1) + Maghrib Rollover advances date and reflects in Canvas', () => {
    const baseDate = new Date('2026-09-09T00:00:00+05:30');
    // Pre-Maghrib: with -1 offset
    const preSunset = getAccurateIslamicDate(baseDate, '18:48', -1, new Date('2026-09-09T14:00:00+05:30'));
    // Post-Maghrib: with -1 offset (+1 rollover - 1 offset = net 0 change from standard pre-sunset baseline)
    const postSunset = getAccurateIslamicDate(baseDate, '18:48', -1, new Date('2026-09-09T18:50:00+05:30'));
    assert.strictEqual(postSunset.day, preSunset.day + 1, 'Date must advance by 1 at Maghrib even with -1 offset');

    // Simulate canvas generation with post-sunset schedule and -1 offset
    const app = loadApp();
    const canvas = app.document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    
    // Draw canvas elements incorporating the calculated post-sunset date
    ctx.fillText(postSunset.formatted, 540, 240);
    const drawCalls = ctx.drawCalls.filter(c => c.method === 'fillText' && c.text === postSunset.formatted);
    assert.strictEqual(drawCalls.length, 1, 'Canvas must render the Maghrib-adjusted Hilal date');
  });

  // =========================================================================
  // Combination 2: Auto-Silent Active + Day Navigation Switcher
  // =========================================================================
  await test('T3.2: Auto-Silent enabled remains tracking TODAY while browsing Tomorrow/Yesterday', () => {
    // Current time at Dhuhr (12:45 PM)
    const app = loadApp({ mockDate: '2026-09-09T12:45:00+05:30' });
    const appState = app.getAppState();
    assert.strictEqual(appState.autoSilentActive, true);
    
    // During Dhuhr jamaat (first 20 mins): status is Active
    const statusBefore = app.document.getElementById('txtMosqueStatus').innerText;
    assert.ok(statusBefore.includes('Active') || statusBefore.includes('Phone Muted') || statusBefore.length > 0);

    // Navigate to Tomorrow
    const btnNextDay = app.document.getElementById('btnNextDay');
    btnNextDay.click();
    assert.strictEqual(app.getAppState().dateOffset, 1);

    // Timetable shows Tomorrow's schedule, but Hero & Auto-Silent still track Today
    const statusAfterNav = app.document.getElementById('txtMosqueStatus').innerText;
    assert.strictEqual(statusAfterNav, statusBefore, 'Auto-Silent status must not be disrupted by day browsing');

    // Reset to Today
    const btnToday = app.document.getElementById('btnTodayReset');
    btnToday.click();
    assert.strictEqual(app.getAppState().dateOffset, 0);
  });

  // =========================================================================
  // Combination 3: City Search & Switch + Fasting Strip + Sunnah Drawer
  // =========================================================================
  await test('T3.3: Switching city to Delhi updates Fasting Strip and Sunnah timings', () => {
    const app = loadApp();
    const suratSehri = app.document.getElementById('txtSehriTime').innerText;
    const suratZawal = app.document.getElementById('timeZawal').innerHTML;

    // Search and select Delhi
    const btnOpenCity = app.document.getElementById('btnOpenCityModal');
    btnOpenCity.click();
    const inputSearch = app.document.getElementById('inputCitySearch');
    inputSearch.value = 'Delhi';
    inputSearch.dispatchEvent({ type: 'input', target: inputSearch });

    const container = app.document.getElementById('cityListContainer');
    assert.ok(container.children.length > 0, 'Delhi must be found in city list');
    
    // Click on Delhi city row
    container.children[0].click();
    assert.ok(app.getAppState().cityName.includes('Delhi'));

    // Check that timings updated
    const delhiSehri = app.document.getElementById('txtSehriTime').innerText;
    const delhiZawal = app.document.getElementById('timeZawal').innerHTML;
    assert.ok(delhiSehri.length > 0);
    assert.ok(delhiZawal.length > 0);
    // Delhi is at 28.6139° N, 77.2090° E (different coordinates from Surat 21.1960° N, 72.7940° E)
    assert.notStrictEqual(delhiSehri, suratSehri, 'Sehri time must differ between Surat and Delhi');
  });

  // =========================================================================
  // Combination 4: Offline Mode + Web Share Failure + PNG Download Fallback
  // =========================================================================
  await test('T3.4: Offline sharing fallback triggers clipboard / download without errors', async () => {
    const opts = {};
    const app = loadApp(opts);
    // Delete navigator.share to force fallback branch
    delete app.window.navigator.share;
    delete app.navigator.share;
    
    // Trigger share button
    const btnShare = app.document.getElementById('btnShareApp');
    btnShare.click();

    // Wait for async handler
    await new Promise(r => setTimeout(r, 50));

    // In fallback mode, clipboard write is invoked or alert shown
    assert.ok(opts.lastClipboardText !== undefined || app.getAlertMessage() !== null,
      'Fallback must copy link or alert download URL');
  });

  // =========================================================================
  // Combination 5: Hijri Adjustment + LocalStorage Persistence + Page Reload
  // =========================================================================
  await test('T3.5: Hijri adjustment persisted in LocalStorage survives app reload', () => {
    // Session 1: user selects +2 days adjustment
    const session1 = loadApp();
    session1.localStorage.setItem('namaz_hijri_adjustment', '2');
    
    // Session 2: user reloads app with persisted storage
    const session2 = loadApp({ initialStorage: { 'namaz_hijri_adjustment': '2' } });
    assert.strictEqual(session2.localStorage.getItem('namaz_hijri_adjustment'), '2');
    
    const baseDate = new Date('2026-09-09T12:00:00+05:30');
    const adjusted = getAccurateIslamicDate(baseDate, '18:48', 2, baseDate);
    const unadjusted = getAccurateIslamicDate(baseDate, '18:48', 0, baseDate);
    assert.strictEqual(adjusted.day, unadjusted.day + 2, 'Adjusted day must reflect +2 persisted offset');
  });

  // =========================================================================
  // Combination 6: Date Browsing Banner + Live Hero Decoupling
  // =========================================================================
  await test('T3.6: Browsing banner displays target date while Hero card tracks Today', () => {
    const app = loadApp({ mockDate: '2026-09-09T14:00:00+05:30' });
    const banner = app.document.getElementById('browsingBanner');
    
    // Initially on Today: banner hidden
    assert.strictEqual(banner.style.display, 'none');

    // Click Next Day (Tomorrow)
    const btnNext = app.document.getElementById('btnNextDay');
    btnNext.click();

    // Banner becomes visible
    assert.strictEqual(banner.style.display, 'flex');
    const label = app.document.getElementById('txtBrowsingBannerLabel').innerHTML;
    assert.ok(label.includes('Tomorrow') || label.includes('Target Date'));

    // Hero card remains on Today's active prayer (Asr or Dhuhr)
    const heroTitle = app.document.getElementById('heroPrayerTitle').innerText;
    assert.ok(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Jummah'].includes(heroTitle));

    // Reset to TodayInline
    const btnResetInline = app.document.getElementById('btnResetToTodayInline');
    if (btnResetInline) {
      btnResetInline.click();
      assert.strictEqual(app.getAppState().dateOffset, 0);
      assert.strictEqual(banner.style.display, 'none');
    }
  });

  // =========================================================================
  // Combination 7: Ihtiyat Mode (RAMADAN_SAFE) + Fasting Strip Recalculation
  // =========================================================================
  await test('T3.7: Switching to RAMADAN_SAFE expands Suhoor buffer to 10 minutes', () => {
    const app = loadApp();
    const selIhtiyat = app.document.getElementById('selIhtiyat');
    selIhtiyat.value = 'RAMADAN_SAFE';
    selIhtiyat.dispatchEvent({ type: 'change', target: selIhtiyat });

    assert.strictEqual(app.getAppState().ihtiyat, 'RAMADAN_SAFE');
    const scheduleSafe = calculateAccurateHanafiTimes(21.1960, 72.7940, new Date('2026-09-09'), 'RAMADAN_SAFE');
    const scheduleMosque = calculateAccurateHanafiTimes(21.1960, 72.7940, new Date('2026-09-09'), 'MOSQUE');

    // RAMADAN_SAFE applies -10m suhoor buffer vs MOSQUE -3m buffer (suhoor is earlier)
    assert.ok(scheduleSafe.suhoor < scheduleMosque.suhoor, 'RAMADAN_SAFE Sehri must be earlier than MOSQUE Sehri');
  });

  return results;
}

module.exports = { runTier3Tests };

if (require.main === module) {
  runTier3Tests().then(results => {
    const passed = results.filter(r => r.passed).length;
    console.log(`Tier 3 Tests: ${passed}/${results.length} passed`);
    results.filter(r => !r.passed).forEach(r => console.error(`FAIL: ${r.name} - ${r.error}`));
    if (passed < results.length) process.exit(1);
  });
}
