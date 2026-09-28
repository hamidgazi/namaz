// tests/annual_analysis_phase2_ui.test.js - Phase 2 & 3 UI & Modal Lifecycle Tests
const assert = require('node:assert/strict');
const harness = require('./test_harness.js');

function runAnnualPhase2UITests() {
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

  const btnOpenAlmanac = app.document.getElementById('btnOpenAlmanac');
  const modalAlmanac = app.document.getElementById('modalAlmanac');
  const btnCloseAlmanac = app.document.getElementById('btnCloseAlmanac');
  const btnOpenAlmanacFromSettings = app.document.getElementById('btnOpenAlmanacFromSettings');
  const modalSettings = app.document.getElementById('modalSettings');
  const almanacBodyContent = app.document.getElementById('almanacBodyContent');
  const almanacLocationSubtitle = app.document.getElementById('almanacLocationSubtitle');

  test('P2-01: btnOpenAlmanac exists in header toolbar with accessibility attributes', () => {
    assert.ok(btnOpenAlmanac, 'btnOpenAlmanac must exist in DOM');
    assert.ok(btnOpenAlmanac.className.includes('icon-btn'), 'Must have icon-btn class');
    assert.ok(btnOpenAlmanac.getAttribute('title').includes('Almanac'), 'Must have descriptive title');
    assert.ok(btnOpenAlmanac.getAttribute('aria-label').includes('Almanac'), 'Must have aria-label');
  });

  test('P2-02: modalAlmanac exists with dialog semantics', () => {
    assert.ok(modalAlmanac, 'modalAlmanac must exist in DOM');
    assert.equal(modalAlmanac.getAttribute('role'), 'dialog');
    assert.equal(modalAlmanac.getAttribute('aria-modal'), 'true');
    assert.ok(modalAlmanac.className.includes('modal-backdrop'));
  });

  test('P2-03: btnCloseAlmanac exists inside modal header', () => {
    assert.ok(btnCloseAlmanac, 'btnCloseAlmanac must exist in DOM');
  });

  test('P2-04: btnOpenAlmanacFromSettings exists inside Settings modal', () => {
    assert.ok(btnOpenAlmanacFromSettings, 'btnOpenAlmanacFromSettings must exist');
  });

  test('P2-05: Clicking btnOpenAlmanac opens modal and renders analytics cards', () => {
    btnOpenAlmanac.click();
    assert.ok(modalAlmanac.classList.contains('open'), 'Modal must have open class');
    assert.equal(app.document.body.style.overflow, 'hidden', 'Body overflow must be hidden');
    
    // Check rendered content
    const html = almanacBodyContent.innerHTML;
    assert.ok(html.includes('Annual Prayer Extremes'), 'Extremes section must be rendered');
    assert.ok(html.includes('Fasting (Roza) Seasonal Dynamics'), 'Fasting section must be rendered');
    assert.ok(html.includes('Available Prayer Window Spans'), 'Windows section must be rendered');
    assert.ok(html.includes('12-Month Reference Timetable'), '12-Month table must be rendered');
    assert.ok(html.includes('04:32 AM'), 'Earliest Fajr time must appear in rendered HTML');
    assert.ok(html.includes('14h 54m'), 'Longest fast duration must appear in rendered HTML');
    
    // Check subtitle
    assert.ok(almanacLocationSubtitle.textContent.includes('Surat'), 'Location subtitle must show Surat');
  });

  test('P2-06: Clicking btnCloseAlmanac closes modal and restores scroll', () => {
    btnCloseAlmanac.click();
    assert.ok(!modalAlmanac.classList.contains('open'), 'Modal must not have open class');
    assert.equal(app.document.body.style.overflow, '', 'Body overflow must be restored');
  });

  test('P2-07: Clicking backdrop closes modal', () => {
    btnOpenAlmanac.click();
    assert.ok(modalAlmanac.classList.contains('open'));
    modalAlmanac.click();
    assert.ok(!modalAlmanac.classList.contains('open'), 'Modal must close on backdrop click');
  });

  test('P2-08: Pressing Escape key closes modalAlmanac', () => {
    btnOpenAlmanac.click();
    assert.ok(modalAlmanac.classList.contains('open'));
    app.document.dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.ok(!modalAlmanac.classList.contains('open'), 'Modal must close on Escape key');
  });

  test('P2-09: Opening from settings closes settings and opens Almanac modal', () => {
    app.eval('openModal(modalSettings)');
    assert.ok(modalSettings.classList.contains('open'), 'Settings should be open');
    
    btnOpenAlmanacFromSettings.click();
    assert.ok(!modalSettings.classList.contains('open'), 'Settings should close');
    assert.ok(modalAlmanac.classList.contains('open'), 'Almanac should open');
    
    btnCloseAlmanac.click();
    assert.ok(!modalAlmanac.classList.contains('open'));
  });

  test('P2-10: City switch dynamically re-renders Almanac modal with new coordinates', () => {
    // Switch to Delhi
    const appState = app.getAppState();
    appState.cityName = 'Delhi';
    appState.cityState = 'Delhi';
    appState.lat = 28.6139;
    appState.lng = 77.2090;
    app.eval('clearScheduleCache()');

    btnOpenAlmanac.click();
    assert.ok(modalAlmanac.classList.contains('open'));
    assert.ok(almanacLocationSubtitle.textContent.includes('Delhi'), 'Subtitle must show Delhi');
    assert.ok(almanacBodyContent.innerHTML.includes('03:49 AM'), 'Must render Delhi earliest Fajr (03:49 AM)');
    
    btnCloseAlmanac.click();
  });

  return results;
}

if (require.main === module) {
  console.log('>> [PHASE 2 & 3] Running Annual Prayer Timing UI & Modal Suite...');
  const res = runAnnualPhase2UITests();
  const passed = res.filter(r => r.passed).length;
  console.log(`[STATUS] ${passed}/${res.length} tests passed.`);
  res.forEach(r => {
    if (!r.passed) console.error(`  FAIL: ${r.name} - ${r.error}`);
    else console.log(`  PASS: ${r.name}`);
  });
  if (passed !== res.length) process.exit(1);
}

module.exports = { runAnnualPhase2UITests };
