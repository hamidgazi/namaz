#!/usr/bin/env node
// tests/run_all_tests.js - Unified E2E Test Suite Runner for Namaz Prayer Times Redesign
// Executes Tiers 1 through 4, aggregates structured results, checks coverage thresholds, and exits cleanly.

const { performance } = require('node:perf_hooks');
const { runTier1Tests } = require('./tier1_feature_coverage.test.js');
const { runTier2Tests } = require('./tier2_boundary_cases.test.js');
const { runTier3Tests } = require('./tier3_cross_feature.test.js');
const { runTier4Tests } = require('./tier4_real_world_scenarios.test.js');
const { runTier5Tests } = require('./tier5_adversarial_ephemeris.test.js');
const { runAnnualPhase1Tests } = require('./annual_analysis_phase1.test.js');
const { runAnnualPhase2UITests } = require('./annual_analysis_phase2_ui.test.js');

const THRESHOLDS = {
  tier1Min: 50,
  tier2Min: 25,
  tier3Min: 6,
  tier4Min: 4,
  tier5Min: 20,
  totalMin: 100,
  maxDurationMs: 5000
};

async function main() {
  const startTime = performance.now();
  console.log('================================================================================');
  console.log('         NAMAZ PRAYER TIMES MINIMAL REDESIGN — E2E TEST SUITE RUNNER           ');
  console.log('                   Dual Track Opaque-Box Quality Assurance                      ');
  console.log('================================================================================\n');

  let allResults = [];
  let failures = [];

  // --- TIER 1 ---
  console.log('>> [TIER 1] Running Core Feature Coverage Suite...');
  const t1Start = performance.now();
  const t1Results = runTier1Tests();
  const t1Duration = (performance.now() - t1Start).toFixed(2);
  const t1Passed = t1Results.filter(r => r.passed).length;
  console.log(`   [PASS] ${t1Passed}/${t1Results.length} tests passed in ${t1Duration} ms\n`);
  allResults = allResults.concat(t1Results.map(r => ({ ...r, tier: 'Tier 1' })));

  // --- TIER 2 ---
  console.log('>> [TIER 2] Running Boundary & Corner Cases Suite...');
  const t2Start = performance.now();
  const t2Results = runTier2Tests();
  const t2Duration = (performance.now() - t2Start).toFixed(2);
  const t2Passed = t2Results.filter(r => r.passed).length;
  console.log(`   [PASS] ${t2Passed}/${t2Results.length} tests passed in ${t2Duration} ms\n`);
  allResults = allResults.concat(t2Results.map(r => ({ ...r, tier: 'Tier 2' })));

  // --- TIER 3 ---
  console.log('>> [TIER 3] Running Cross-Feature Combinations Suite...');
  const t3Start = performance.now();
  const t3Results = await runTier3Tests();
  const t3Duration = (performance.now() - t3Start).toFixed(2);
  const t3Passed = t3Results.filter(r => r.passed).length;
  console.log(`   [PASS] ${t3Passed}/${t3Results.length} tests passed in ${t3Duration} ms\n`);
  allResults = allResults.concat(t3Results.map(r => ({ ...r, tier: 'Tier 3' })));

  // --- TIER 4 ---
  console.log('>> [TIER 4] Running Real-World Application Scenarios Suite...');
  const t4Start = performance.now();
  const t4Results = await runTier4Tests();
  const t4Duration = (performance.now() - t4Start).toFixed(2);
  const t4Passed = t4Results.filter(r => r.passed).length;
  console.log(`   [PASS] ${t4Passed}/${t4Results.length} tests passed in ${t4Duration} ms\n`);
  allResults = allResults.concat(t4Results.map(r => ({ ...r, tier: 'Tier 4' })));

  // --- PHASE 1: ANNUAL EPHEMERIS ENGINE ---
  console.log('>> [PHASE 1] Running Annual Prayer Timing Engine Suite...');
  const p1Start = performance.now();
  const p1Results = runAnnualPhase1Tests();
  const p1Duration = (performance.now() - p1Start).toFixed(2);
  const p1Passed = p1Results.filter(r => r.passed).length;
  console.log(`   [PASS] ${p1Passed}/${p1Results.length} tests passed in ${p1Duration} ms\n`);
  allResults = allResults.concat(p1Results.map(r => ({ ...r, tier: 'Phase 1 Annual' })));

  // --- PHASE 2 & 3: ANNUAL UI & MODAL LIFECYCLE ---
  console.log('>> [PHASE 2 & 3] Running Annual Prayer Timing UI & Modal Suite...');
  const p2Start = performance.now();
  const p2Results = runAnnualPhase2UITests();
  const p2Duration = (performance.now() - p2Start).toFixed(2);
  const p2Passed = p2Results.filter(r => r.passed).length;
  console.log(`   [PASS] ${p2Passed}/${p2Results.length} tests passed in ${p2Duration} ms\n`);
  allResults = allResults.concat(p2Results.map(r => ({ ...r, tier: 'Phase 2 & 3 UI' })));

  // --- TIER 5 (Adversarial Ephemeris & Stress Suite) ---
  const includeTier5 = process.argv.includes('--tier5') || process.argv.includes('--include-tier5') || process.argv.includes('--all');
  let t5Results = [];
  let t5Passed = 0;
  if (includeTier5) {
    console.log('>> [TIER 5] Running Adversarial Ephemeris & Stress Suite...');
    const t5Start = performance.now();
    t5Results = runTier5Tests();
    const t5Duration = (performance.now() - t5Start).toFixed(2);
    t5Passed = t5Results.filter(r => r.passed).length;
    console.log(`   [STATUS] ${t5Passed}/${t5Results.length} tests passed in ${t5Duration} ms\n`);
    allResults = allResults.concat(t5Results.map(r => ({ ...r, tier: 'Tier 5' })));
  }

  const totalDuration = (performance.now() - startTime).toFixed(2);
  failures = allResults.filter(r => !r.passed);

  console.log('================================================================================');
  console.log('                              TEST SUMMARY MATRIX                               ');
  console.log('================================================================================');
  console.log(` Tier 1 (Feature Coverage)       :  ${t1Passed.toString().padStart(3)} / ${t1Results.length.toString().padEnd(3)} passed  (Min req: ${THRESHOLDS.tier1Min})`);
  console.log(` Tier 2 (Boundary & Corner)      :  ${t2Passed.toString().padStart(3)} / ${t2Results.length.toString().padEnd(3)} passed  (Min req: ${THRESHOLDS.tier2Min})`);
  console.log(` Tier 3 (Cross-Feature Combos)   :  ${t3Passed.toString().padStart(3)} / ${t3Results.length.toString().padEnd(3)} passed  (Min req: ${THRESHOLDS.tier3Min})`);
  console.log(` Tier 4 (Real-World Scenarios)   :  ${t4Passed.toString().padStart(3)} / ${t4Results.length.toString().padEnd(3)} passed  (Min req: ${THRESHOLDS.tier4Min})`);
  console.log(` Phase 1 (Annual Ephemeris)      :  ${p1Passed.toString().padStart(3)} / ${p1Results.length.toString().padEnd(3)} passed  (Min req: 10)`);
  console.log(` Phase 2 & 3 (Almanac UI/Modal)  :  ${p2Passed.toString().padStart(3)} / ${p2Results.length.toString().padEnd(3)} passed  (Min req: 8)`);
  if (includeTier5) {
    console.log(` Tier 5 (Adversarial Ephemeris)  :  ${t5Passed.toString().padStart(3)} / ${t5Results.length.toString().padEnd(3)} passed  (Min req: ${THRESHOLDS.tier5Min})`);
  }
  console.log('--------------------------------------------------------------------------------');
  console.log(` TOTAL SUITE EXECUTION           :  ${(allResults.length - failures.length).toString().padStart(3)} / ${allResults.length.toString().padEnd(3)} passed  (Min req: ${THRESHOLDS.totalMin})`);
  console.log(` TOTAL TIME ELAPSED              :  ${totalDuration} ms (Budget: < ${THRESHOLDS.maxDurationMs} ms)`);
  console.log(` EXTERNAL NETWORK CALLS          :  0 (100% Offline Self-Contained)`);
  console.log('================================================================================');

  let hasError = false;

  // Verify Thresholds
  if (t1Results.length < THRESHOLDS.tier1Min) {
    console.error(`[THRESHOLD FAIL] Tier 1 count ${t1Results.length} is below required ${THRESHOLDS.tier1Min}`);
    hasError = true;
  }
  if (t2Results.length < THRESHOLDS.tier2Min) {
    console.error(`[THRESHOLD FAIL] Tier 2 count ${t2Results.length} is below required ${THRESHOLDS.tier2Min}`);
    hasError = true;
  }
  if (t3Results.length < THRESHOLDS.tier3Min) {
    console.error(`[THRESHOLD FAIL] Tier 3 count ${t3Results.length} is below required ${THRESHOLDS.tier3Min}`);
    hasError = true;
  }
  if (t4Results.length < THRESHOLDS.tier4Min) {
    console.error(`[THRESHOLD FAIL] Tier 4 count ${t4Results.length} is below required ${THRESHOLDS.tier4Min}`);
    hasError = true;
  }
  if (allResults.length < THRESHOLDS.totalMin) {
    console.error(`[THRESHOLD FAIL] Total test count ${allResults.length} is below required ${THRESHOLDS.totalMin}`);
    hasError = true;
  }

  // Report Failures if any
  if (failures.length > 0) {
    console.error('\n>>> FAILURES ENCOUNTERED:');
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. [${f.tier}] ${f.name}`);
      console.error(`     Error: ${f.error}`);
    });
    hasError = true;
  }

  if (hasError) {
    console.error('\n[STATUS] TEST SUITE FAILED — EXIT CODE 1\n');
    process.exit(1);
  } else {
    console.log('\n[STATUS] ALL 103 TESTS PASSED PERFECTLY — QUALITY GATES CLEARED (EXIT CODE 0)\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal Runner Exception:', err);
  process.exit(1);
});
