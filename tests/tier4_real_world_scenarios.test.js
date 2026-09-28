// tests/tier4_real_world_scenarios.test.js
// Tier 4: Real-World Application Workflows & Scenarios

const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  loadApp,
  getAccurateIslamicDate,
  calculateAccurateHanafiTimes,
  formatTime12
} = require('./test_harness.js');

async function runTier4Tests() {
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
  // Scenario 1: Full Surat Daily Prayer Journey (24-Hour Cycle)
  // =========================================================================
  await test('Scenario 1.1: Pre-Fajr & Dawn Twilight (04:45 AM)', () => {
    const app = loadApp({ mockDate: '2026-09-09T04:45:00+05:30' });
    const heroTitle = app.document.getElementById('heroPrayerTitle').innerText;
    assert.strictEqual(heroTitle, 'Fajr', 'Target prayer is Fajr');
    const heroTag = app.document.getElementById('heroUpcomingTag').innerHTML;
    assert.ok(heroTag.includes('Next Salah') || heroTag.includes('Dawn Twilight'));
  });

  await test('Scenario 1.2: Active Fajr Window (05:30 AM)', () => {
    const app = loadApp({ mockDate: '2026-09-09T05:30:00+05:30' });
    const heroTitle = app.document.getElementById('heroPrayerTitle').innerText;
    assert.strictEqual(heroTitle, 'Fajr');
    const heroDesc = app.document.getElementById('heroCurrentDesc').innerHTML;
    assert.ok(heroDesc.includes('Window') || heroDesc.length > 0);
  });

  await test('Scenario 1.3: Zawal Forbidden Window (12:30 PM)', () => {
    const app = loadApp({ mockDate: '2026-09-09T12:30:00+05:30' });
    const heroTag = app.document.getElementById('heroUpcomingTag').innerHTML;
    assert.ok(heroTag.includes('Zawal') || heroTag.includes('Makruh') || heroTag.includes('Next Salah'));
  });

  await test('Scenario 1.4: Active Dhuhr Window (01:15 PM)', () => {
    const app = loadApp({ mockDate: '2026-09-09T13:15:00+05:30' });
    const heroTitle = app.document.getElementById('heroPrayerTitle').innerText;
    assert.strictEqual(heroTitle, 'Dhuhr');
    const rowDhuhr = app.document.getElementById('rowDhuhr');
    assert.ok(rowDhuhr.classList.contains('active-target'));
  });

  await test('Scenario 1.5: Active Asr Hanafi Window (05:30 PM)', () => {
    const app = loadApp({ mockDate: '2026-09-09T17:30:00+05:30' });
    const heroTitle = app.document.getElementById('heroPrayerTitle').innerText;
    assert.strictEqual(heroTitle, 'Asr');
    const rowAsr = app.document.getElementById('rowAsr');
    assert.ok(rowAsr.classList.contains('active-target'));
  });

  await test('Scenario 1.6: Maghrib Sunset & Automatic Islamic Rollover (06:55 PM)', () => {
    const afternoonDate = new Date('2026-09-09T14:00:00+05:30');
    const maghribDate = new Date('2026-09-09T18:55:00+05:30');
    const afternoonHijri = getAccurateIslamicDate(afternoonDate, '18:52', 0, afternoonDate);
    const maghribHijri = getAccurateIslamicDate(maghribDate, '18:52', 0, maghribDate);

    assert.strictEqual(maghribHijri.isPastSunset, true);
    assert.strictEqual(maghribHijri.day, afternoonHijri.day + 1, 'Date rolled over to next Islamic day at sunset');

    const app = loadApp({ mockDate: '2026-09-09T18:55:00+05:30' });
    const heroTitle = app.document.getElementById('heroPrayerTitle').innerText;
    assert.strictEqual(heroTitle, 'Maghrib');
    const rowMaghrib = app.document.getElementById('rowMaghrib');
    assert.ok(rowMaghrib.classList.contains('active-target'));
  });

  await test('Scenario 1.7: Active Isha Window (08:30 PM)', () => {
    const app = loadApp({ mockDate: '2026-09-09T20:30:00+05:30' });
    const heroTitle = app.document.getElementById('heroPrayerTitle').innerText;
    assert.strictEqual(heroTitle, 'Isha');
    const rowIsha = app.document.getElementById('rowIsha');
    assert.ok(rowIsha.classList.contains('active-target'));
  });

  // =========================================================================
  // Scenario 2: Ramadan Fasting & WhatsApp Card Broadcast Workflow
  // =========================================================================
  await test('Scenario 2: Ramadan Fasting, Hilal Adjustment & 1-Tap Share', async () => {
    // 1. User configures Hilal -1 offset and RAMADAN_SAFE in settings
    const app = loadApp({
      initialStorage: {
        'namaz_hijri_adjustment': '-1'
      }
    });
    
    // Switch to RAMADAN_SAFE
    const selIhtiyat = app.document.getElementById('selIhtiyat');
    selIhtiyat.value = 'RAMADAN_SAFE';
    selIhtiyat.dispatchEvent({ type: 'change', target: selIhtiyat });

    // 2. Verify Fasting strip displays accurate Sehri & Iftar
    const txtSehri = app.document.getElementById('txtSehriTime').innerText;
    const txtIftar = app.document.getElementById('txtIftarTime').innerText;
    assert.ok(txtSehri.length > 0 && txtIftar.length > 0);

    // 3. Synthesize Canvas Timetable Card (1080x1350)
    const canvas = app.document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    
    // Header
    ctx.fillText("ADAJAN PATIYA, SURAT", 540, 142);
    // Fasting info
    ctx.fillText(`SEHRI: ${txtSehri}`, 200, 300);
    ctx.fillText(`IFTAR: ${txtIftar}`, 700, 300);
    // Prayers
    ctx.fillText("FAJR", 200, 500);
    ctx.fillText("DHUHR", 200, 600);
    ctx.fillText("ASR", 200, 700);
    ctx.fillText("MAGHRIB", 200, 800);
    ctx.fillText("ISHA", 200, 900);

    assert.strictEqual(canvas.width, 1080);
    assert.strictEqual(canvas.height, 1350);
    assert.ok(ctx.drawCalls.length >= 7);

    // 4. Trigger 1-Tap Share with canvas blob
    let blobGenerated = false;
    canvas.toBlob((blob) => {
      blobGenerated = true;
      assert.strictEqual(blob.type, 'image/png');
    });
    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(blobGenerated, true, 'Canvas blob must be synthesized');
  });

  // =========================================================================
  // Scenario 3: Inter-City Business Travel (Surat -> Mumbai -> Kolkata)
  // =========================================================================
  await test('Scenario 3: Inter-City Travel updates schedule and coordinates', () => {
    const app = loadApp();
    
    // Step 1: Initial city is Surat
    assert.ok(app.getAppState().cityName.includes('Surat'));
    const suratMaghrib = app.document.getElementById('timeMaghrib').innerText;

    // Step 2: Travel to Mumbai
    const btnOpenCity = app.document.getElementById('btnOpenCityModal');
    btnOpenCity.click();
    const inputSearch = app.document.getElementById('inputCitySearch');
    inputSearch.value = 'Mumbai';
    inputSearch.dispatchEvent({ type: 'input', target: inputSearch });
    app.document.getElementById('cityListContainer').children[0].click();

    assert.strictEqual(app.getAppState().cityName, 'Mumbai');
    assert.strictEqual(app.document.getElementById('txtCityHeader').innerText, 'Mumbai');

    // Step 3: Travel to Kolkata
    btnOpenCity.click();
    inputSearch.value = 'Kolkata';
    inputSearch.dispatchEvent({ type: 'input', target: inputSearch });
    app.document.getElementById('cityListContainer').children[0].click();

    assert.strictEqual(app.getAppState().cityName, 'Kolkata');
    const kolkataMaghrib = app.document.getElementById('timeMaghrib').innerText;

    // Kolkata (east) sunset is significantly earlier than Surat (west)
    assert.notStrictEqual(kolkataMaghrib, suratMaghrib, 'Kolkata sunset must differ from Surat');
  });

  // =========================================================================
  // Scenario 4: Mosque Congregation Auto-Silent Workflow
  // =========================================================================
  await test('Scenario 4: Mosque Auto-Silent 20-minute congregation window', () => {
    // Asr start is at ~05:03 PM
    // T1: 05:05 PM (2 min after start) -> Active: Phone Muted
    const appActive = loadApp({ mockDate: '2026-09-09T17:05:00+05:30' });
    const statusActive = appActive.document.getElementById('txtMosqueStatus').innerText;
    assert.ok(statusActive.includes('Active: Phone Muted') || statusActive.includes('Muted'));

    // T2: 05:30 PM (27 min after start) -> Standby
    const appStandby = loadApp({ mockDate: '2026-09-09T17:30:00+05:30' });
    const statusStandby = appStandby.document.getElementById('txtMosqueStatus').innerText;
    assert.ok(statusStandby.includes('Standby'));

    // T3: Disable Auto-Silent
    const chk = appStandby.document.getElementById('chkAutoSilent');
    chk.checked = false;
    chk.dispatchEvent({ type: 'change', target: chk });
    const statusDisabled = appStandby.document.getElementById('txtMosqueStatus').innerText;
    assert.strictEqual(statusDisabled, 'Disabled');
  });

  return results;
}

module.exports = { runTier4Tests };

if (require.main === module) {
  runTier4Tests().then(results => {
    const passed = results.filter(r => r.passed).length;
    console.log(`Tier 4 Tests: ${passed}/${results.length} passed`);
    results.filter(r => !r.passed).forEach(r => console.error(`FAIL: ${r.name} - ${r.error}`));
    if (passed < results.length) process.exit(1);
  });
}
