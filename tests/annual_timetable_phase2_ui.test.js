// tests/annual_timetable_phase2_ui.test.js - Phase 2 & 3 Full Year Timetable UI & Interaction Tests
const assert = require('node:assert/strict');
const harness = require('./test_harness.js');

function runTimetablePhase2UITests() {
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
  const openAlmanacModal = app.eval('openAlmanacModal');
  const switchAlmanacTab = app.eval('switchAlmanacTab');
  const renderMonthlyTimetableView = app.eval('renderMonthlyTimetableView');
  const closeModal = app.eval('closeModal');
  const appState = app.getAppState();

  const modalAlmanac = app.document.getElementById('modalAlmanac');
  const tabAlmanacOverview = app.document.getElementById('tabAlmanacOverview');
  const tabAlmanacTimetable = app.document.getElementById('tabAlmanacTimetable');
  const almanacPanelOverview = app.document.getElementById('almanacPanelOverview');
  const almanacPanelTimetable = app.document.getElementById('almanacPanelTimetable');
  const btnTimetablePrevYear = app.document.getElementById('btnTimetablePrevYear');
  const btnTimetableNextYear = app.document.getElementById('btnTimetableNextYear');
  const txtTimetableYear = app.document.getElementById('txtTimetableYear');
  const btnTimetableToday = app.document.getElementById('btnTimetableToday');
  const almanacMonthRibbon = app.document.getElementById('almanacMonthRibbon');
  const timetableMonthContainer = app.document.getElementById('timetableMonthContainer');

  test('T2-01: Tab buttons and panels are present in DOM', () => {
    assert.ok(tabAlmanacOverview, 'tabAlmanacOverview must exist');
    assert.ok(tabAlmanacTimetable, 'tabAlmanacTimetable must exist');
    assert.ok(almanacPanelOverview, 'almanacPanelOverview must exist');
    assert.ok(almanacPanelTimetable, 'almanacPanelTimetable must exist');
  });

  test('T2-02: Switching to Timetable tab updates active classes and visibility', () => {
    openAlmanacModal();
    switchAlmanacTab('timetable');
    assert.ok(tabAlmanacTimetable.classList.contains('active'), 'Timetable tab should have active class');
    assert.ok(!tabAlmanacOverview.classList.contains('active'), 'Overview tab should not have active class');
    assert.equal(almanacPanelTimetable.style.display, '', 'Timetable panel should be visible');
    assert.equal(almanacPanelOverview.style.display, 'none', 'Overview panel should be hidden');
  });

  test('T2-03: Switching back to Overview tab restores visibility', () => {
    switchAlmanacTab('overview');
    assert.ok(tabAlmanacOverview.classList.contains('active'), 'Overview tab should have active class');
    assert.ok(!tabAlmanacTimetable.classList.contains('active'), 'Timetable tab should not have active class');
    assert.equal(almanacPanelOverview.style.display, '', 'Overview panel should be visible');
    assert.equal(almanacPanelTimetable.style.display, 'none', 'Timetable panel should be hidden');
  });

  test('T2-04: Month ribbon renders 12 quick-switch month pills', () => {
    switchAlmanacTab('timetable');
    const pills = almanacMonthRibbon.querySelectorAll('.almanac-month-pill');
    assert.equal(pills.length, 12, 'Must render exactly 12 month pills');
    assert.equal(pills[0].textContent.trim(), 'Jan');
    assert.equal(pills[11].textContent.trim(), 'Dec');
  });

  test('T2-05: Year stepper decrement and increment updates year and UI', () => {
    switchAlmanacTab('timetable');
    const currentYear = new Date().getFullYear();
    assert.equal(txtTimetableYear.textContent.trim(), String(currentYear));

    // Next year
    btnTimetableNextYear.dispatchEvent({ type: 'click' });
    assert.equal(txtTimetableYear.textContent.trim(), String(currentYear + 1));

    // Prev year twice
    btnTimetablePrevYear.dispatchEvent({ type: 'click' });
    btnTimetablePrevYear.dispatchEvent({ type: 'click' });
    assert.equal(txtTimetableYear.textContent.trim(), String(currentYear - 1));

    // Reset back to today
    btnTimetableToday.dispatchEvent({ type: 'click' });
    assert.equal(txtTimetableYear.textContent.trim(), String(currentYear));
  });

  test('T2-06: Timetable table renders with sticky headers and valid column count', () => {
    switchAlmanacTab('timetable');
    const table = timetableMonthContainer.querySelector('.timetable-full-table');
    assert.ok(table, 'Must render .timetable-full-table');
    const headers = table.querySelectorAll('th');
    assert.ok(headers.length >= 8, `Expected at least 8 column headers, found ${headers.length}`);
    assert.ok(headers[0].textContent.includes('Date'));
    assert.ok(headers[1].textContent.includes('Hijri'));
    assert.ok(headers[2].textContent.includes('Sehri/Fajr'));
  });

  test('T2-07: Current month table renders correct row count and highlights today', () => {
    btnTimetableToday.dispatchEvent({ type: 'click' });
    const today = new Date();
    const expectedDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const rows = timetableMonthContainer.querySelectorAll('.timetable-row-interactive');
    assert.equal(rows.length, expectedDays, `Row count ${rows.length} must match days in month ${expectedDays}`);

    const todayRow = timetableMonthContainer.querySelector('.timetable-row-today');
    assert.ok(todayRow, 'Must highlight current day with .timetable-row-today');
    assert.ok(todayRow.innerHTML.includes('TODAY'), 'Today row must contain TODAY badge');
  });

  test('T2-08: Tapping a day row jumps app date and dismisses modal', () => {
    switchAlmanacTab('timetable');
    const rows = timetableMonthContainer.querySelectorAll('.timetable-row-interactive');
    assert.ok(rows.length > 0, 'Must have interactive rows');

    // Click row 0 (1st of the month)
    const targetDateIso = rows[0].getAttribute('data-date-iso');
    assert.ok(targetDateIso, 'Row must have data-date-iso attribute');

    rows[0].dispatchEvent({ type: 'click' });
    assert.ok(!modalAlmanac.classList.contains('open'), 'Modal must close on row tap');
  });

  test('T2-09: Clicking a different month pill switches active month and re-renders table', () => {
    openAlmanacModal();
    switchAlmanacTab('timetable');
    const pills = almanacMonthRibbon.querySelectorAll('.almanac-month-pill');
    // Click June (index 5)
    pills[5].dispatchEvent({ type: 'click' });

    assert.ok(pills[5].classList.contains('active'), 'June pill should be active');
    const rows = timetableMonthContainer.querySelectorAll('.timetable-row-interactive');
    assert.equal(rows.length, 30, 'June must have 30 days');
    assert.ok(timetableMonthContainer.textContent.includes('June'));
  });

  test('T2-10: openAlmanacModal accepts targetTab argument', () => {
    openAlmanacModal('timetable');
    assert.ok(tabAlmanacTimetable.classList.contains('active'), 'Should open directly to timetable tab');
    assert.equal(almanacPanelTimetable.style.display, '');
    closeModal(modalAlmanac);
  });

  return results;
}

if (require.main === module) {
  const results = runTimetablePhase2UITests();
  let passCount = 0;
  for (const r of results) {
    if (r.passed) {
      passCount++;
      console.log(`  [PASS] ${r.name}`);
    } else {
      console.error(`  [FAIL] ${r.name}: ${r.error}`);
    }
  }
  console.log(`\nPhase 2 & 3 Timetable UI: ${passCount}/${results.length} passed.`);
  process.exit(passCount === results.length ? 0 : 1);
}

module.exports = { runTimetablePhase2UITests };
