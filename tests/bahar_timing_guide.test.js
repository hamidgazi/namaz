// tests/bahar_timing_guide.test.js - Bahar-e-Shariat Timing Guide & Color Logic Verification Suite
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function runBaharTimingGuideTests() {
  const results = [];
  function test(name, fn) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message, stack: err.stack });
    }
  }

  const rootDir = path.resolve(__dirname, '..');
  const guidePath = path.join(rootDir, 'PRAYER_TIMING_GUIDE.md');
  const indexHtmlPath = path.join(rootDir, 'index.html');
  const widgetHtmlPath = path.join(rootDir, 'widget.html');
  const namazWidgetCsPath = path.join(rootDir, 'NamazWidget.cs');

  // Test 1: PRAYER_TIMING_GUIDE.md exists and is comprehensive
  test('BG-01: PRAYER_TIMING_GUIDE.md exists and contains authentic citations', () => {
    assert.ok(fs.existsSync(guidePath), 'PRAYER_TIMING_GUIDE.md must exist in root');
    const content = fs.readFileSync(guidePath, 'utf8');
    assert.ok(content.includes('Bahar-e-Shariat'), 'Must cite Bahar-e-Shariat');
    assert.ok(content.includes('Allama Amjad Ali Azmi'), 'Must cite Sadrush Shariah Allama Amjad Ali Azmi');
    assert.ok(content.includes('20 minutes') || content.includes('۲۰ منٹ'), 'Must specify 20 minutes sunrise prohibition');
    assert.ok(content.includes('Masla 21'), 'Must cite Page 458 Masla 21');
    assert.ok(content.includes('Isfirar ash-Shams') || content.includes('Isfirar'), 'Must mention Asr Isfirar window');
    assert.ok(content.includes('Emerald Green') && content.includes('Solar Gold') && content.includes('Sunset Orange') && content.includes('Crimson Red'), 'Must detail 4-tier chromatic spectrum');
  });

  // Test 2: index.html integration
  test('BG-02: index.html contains modalTimingGuide, 4 segmented tabs, search box, and color simulator', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.ok(html.includes('id="btnOpenTimingGuide"'), 'Must contain btnOpenTimingGuide in header');
    assert.ok(html.includes('id="modalTimingGuide"'), 'Must contain modalTimingGuide backdrop');
    assert.ok(html.includes('id="btnCloseTimingGuide"'), 'Must contain close button');
    assert.ok(html.includes('id="inputSearchGuide"'), 'Must contain live search box in guide');
    assert.ok(html.includes('guide-tab-bar') && html.includes('guide-tab-btn'), 'Must contain 4-tab segmented control');
    assert.ok(html.includes('id="sliderColorSim"'), 'Must contain interactive color simulator slider');
    assert.ok(html.includes('urgency-amber'), 'Must contain .urgency-amber class in CSS');
    assert.ok(html.includes('tSunrise.getTime() + 20 * 60 * 1000'), 'Must use 20 minutes for sunrise prohibition');
  });

  // Test 3: widget.html integration
  test('BG-03: widget.html contains btnGuide and 4-tier urgency colors', () => {
    const widgetHtml = fs.readFileSync(widgetHtmlPath, 'utf8');
    assert.ok(widgetHtml.includes('id="btnGuide"'), 'Must contain btnGuide in header actions');
    assert.ok(widgetHtml.includes('urgency-amber'), 'Must define urgency-amber');
    assert.ok(widgetHtml.includes('amberThresh'), 'Must evaluate amberThresh for 4-tier spectrum');
    assert.ok(widgetHtml.includes('Stars clustered'), 'Must tag Maghrib stars clustered Makruh');
  });

  // Test 4: NamazWidget.cs WPF Desktop implementation
  test('BG-04: NamazWidget.cs contains minimal 2-button header, 4 tabs, and clean footer', () => {
    const cs = fs.readFileSync(namazWidgetCsPath, 'utf8');
    assert.ok(cs.includes('btnMenu = CreateSmallButton("⋯"'), 'Must have minimal 2-button header with btnMenu');
    assert.ok(cs.includes('tSunrise.AddMinutes(20)'), 'Sunrise prohibition must be exactly 20 minutes');
    assert.ok(cs.includes('ShowTimingGuideWindow'), 'Must implement ShowTimingGuideWindow()');
    assert.ok(cs.includes('CreateGuideTabButton'), 'Must implement tabbed guide navigation in WPF');
    assert.ok(cs.includes('Bahar-e-Shariat Timing Guide'), 'Menu and buttons must link to Bahar-e-Shariat Timing Guide');
    assert.ok(cs.includes('Stars clustered'), 'Must include Maghrib stars clustered Makruh subtext');
    assert.ok(cs.includes('Past Midnight (Makruh delay)'), 'Must include Isha past midnight Makruh delay subtext');
    assert.ok(!cs.includes('(Click for peek)'), 'Footer subtext must not contain truncated (Click for peek)');
  });

  return results;
}

if (require.main === module) {
  const results = runBaharTimingGuideTests();
  const passed = results.filter(r => r.passed).length;
  console.log(`Bahar Timing Guide Tests: ${passed}/${results.length} passed`);
  if (passed < results.length) {
    results.filter(r => !r.passed).forEach(r => console.error(`[FAIL] ${r.name}: ${r.error}`));
    process.exit(1);
  }
}

module.exports = { runBaharTimingGuideTests };
