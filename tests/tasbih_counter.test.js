// tests/tasbih_counter.test.js - Digital Tasbih & Dhikr Counter Verification Suite
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function runTasbihCounterTests() {
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
  const indexHtmlPath = path.join(rootDir, 'index.html');
  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  // Test 1: Featured Tools Grid Button
  test('TASBIH-01: Tools grid contains featured Tasbih button with icon and counter description', () => {
    assert.ok(html.includes('id="btnOpenTasbih"'), 'Must contain id="btnOpenTasbih"');
    assert.ok(html.includes('tasbih-featured-tile'), 'Must have class tasbih-featured-tile for Golden Ratio prominence');
    assert.ok(html.includes('Digital Tasbih'), 'Must have clear feature title');
    assert.ok(html.includes('Interactive Dhikr counter &amp; beads with haptics'), 'Must describe features clearly');
  });

  // Test 2: Modal Tasbih Structure
  test('TASBIH-02: modalTasbih dialog contains header, presets, tap sphere, and footer controls', () => {
    assert.ok(html.includes('id="modalTasbih"'), 'Must contain id="modalTasbih" backdrop');
    assert.ok(html.includes('modal-tasbih-card'), 'Must contain .modal-tasbih-card');
    assert.ok(html.includes('id="btnCloseTasbih"'), 'Must contain close button');
    assert.ok(html.includes('id="btnToggleTasbihSound"'), 'Must contain sound toggle button');
    assert.ok(html.includes('id="btnToggleTasbihVibrate"'), 'Must contain vibrate toggle button');
    assert.ok(html.includes('id="tasbihLapBadge"'), 'Must contain lap counter badge');
    assert.ok(html.includes('class="tasbih-preset-bar"'), 'Must contain preset selection bar');
    assert.ok(html.includes('id="btnTasbihTap"'), 'Must contain giant tap sphere button');
    assert.ok(html.includes('tasbih-progress-ring'), 'Must contain SVG circular progress ring');
    assert.ok(html.includes('id="tasbihCountDisplay"'), 'Must contain primary counter display');
    assert.ok(html.includes('id="tasbihTargetDisplay"'), 'Must contain target counter indicator');
    assert.ok(html.includes('id="tasbihArabicText"'), 'Must display Arabic Dhikr');
    assert.ok(html.includes('id="tasbihTranslitText"'), 'Must display transliteration');
    assert.ok(html.includes('id="tasbihMeaningText"'), 'Must display English meaning');
    assert.ok(html.includes('id="btnTasbihReset"'), 'Must contain reset button');
    assert.ok(html.includes('id="btnTasbihNextStep"'), 'Must contain next step button');
  });

  // Test 3: Golden Ratio CSS and Accessibility
  test('TASBIH-03: Golden Ratio styling (max-width 440px, 184px sphere) and touch target accessibility', () => {
    assert.ok(html.includes('max-width: 440px;'), 'Card width adheres to golden ratio max-width');
    assert.ok(html.includes('width: 184px;') && html.includes('height: 184px;'), 'Giant sphere button has 184px dimensions');
    assert.ok(html.includes('.tasbih-sphere-btn:active'), 'Active tap visual depression state defined');
    assert.ok(html.includes('stroke-dasharray: 552.92;'), 'Progress ring circumference accurately calibrated (2 * PI * 88)');
  });

  // Test 4: Presets & Chaining Configuration
  test('TASBIH-04: TASBIH_PRESETS defines 5 spiritual presets with Tasbih-e-Fatimah 33/33/34 chaining', () => {
    assert.ok(html.includes('const TASBIH_PRESETS = {'), 'Must declare TASBIH_PRESETS map');
    assert.ok(html.includes("fatimah:"), 'Must include Tasbih-e-Fatimah');
    assert.ok(html.includes("target: 33") && html.includes("target: 34"), 'Must chain 33 SubhanAllah, 33 Alhamdulillah, 34 Allahu Akbar');
    assert.ok(html.includes("istighfar:"), 'Must include Astaghfirullah preset');
    assert.ok(html.includes("durood:"), 'Must include Durood Ibrahim preset');
    assert.ok(html.includes("kalimah:"), 'Must include Kalimah Tayyibah preset');
    assert.ok(html.includes("free:"), 'Must include Free Dhikr preset');
  });

  // Test 5: Sound, Haptics, and Local Storage
  test('TASBIH-05: Web Audio API synthesis, haptic feedback, and localStorage persistence are implemented', () => {
    assert.ok(html.includes('function playTasbihClick('), 'Must implement playTasbihClick()');
    assert.ok(html.includes('createOscillator') && html.includes('exponentialRampToValueAtTime'), 'Uses synthesized sine-wave click without external audio assets');
    assert.ok(html.includes('function triggerTasbihHaptic('), 'Must implement triggerTasbihHaptic()');
    assert.ok(html.includes('navigator.vibrate'), 'Uses navigator.vibrate for tactile haptics');
    assert.ok(html.includes('namaz_tasbih_count'), 'Persists active count in localStorage');
    assert.ok(html.includes('namaz_tasbih_preset'), 'Persists active preset in localStorage');
    assert.ok(html.includes('namaz_tasbih_lap'), 'Persists lap counter in localStorage');
  });

  // Test 6: Auto-close and Keyboard Interaction
  test('TASBIH-06: Tools menu auto-close array includes btnOpenTasbih and Spacebar triggers tap', () => {
    assert.ok(html.includes("'btnOpenTasbih'"), 'Tools menu auto-close array must register btnOpenTasbih');
    assert.ok(html.includes("e.code === 'Space' || e.key === ' '"), 'Keyboard spacebar must trigger tap when Tasbih modal is open');
  });

  return results;
}

if (require.main === module) {
  const results = runTasbihCounterTests();
  const passed = results.filter(r => r.passed).length;
  console.log(`Tasbih Counter Tests: ${passed}/${results.length} passed`);
  if (passed < results.length) {
    results.filter(r => !r.passed).forEach(r => console.error(`[FAIL] ${r.name}: ${r.error}`));
    process.exit(1);
  }
}

module.exports = { runTasbihCounterTests };
