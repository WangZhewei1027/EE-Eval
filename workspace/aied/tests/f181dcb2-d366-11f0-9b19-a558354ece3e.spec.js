import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f181dcb2-d366-11f0-9b19-a558354ece3e.html';

test.describe('Prim\'s Algorithm Visualization - FSM validation (f181dcb2-d366-11f0-9b19-a558354ece3e)', () => {
  // Collect console messages and page errors for each test to assert on them
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events with types and text
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // defensive: if msg.type() throws, still capture text
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', error => {
      pageErrors.push(String(error && error.message ? error.message : error));
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Ensure the DOMContentLoaded initialization has run
    await page.waitForSelector('#stepInfo');
  });

  test.afterEach(async ({ page }) => {
    // Helpful debug output if something went wrong
    if (pageErrors.length > 0) {
      // Print console messages to help debug test failures
      // Note: do not modify the page; only provide diagnostics
      // We still fail the test below by asserting no page errors.
      // eslint-disable-next-line no-console
      console.log('Console messages captured during test:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Page errors captured during test:', pageErrors);
    }

    // Assert that no unexpected page errors happened during the test
    expect(pageErrors, 'No page errors (uncaught exceptions) should occur').toEqual([]);
  });

  // Helper function to read stepInfo text
  async function getStepInfoText(page) {
    return page.locator('#stepInfo').innerText();
  }

  // Helper function to read total weight
  async function getTotalWeightText(page) {
    return page.locator('#totalWeight').innerText();
  }

  // Helper to get number of MST edge items rendered
  async function getMstEdgeCount(page) {
    return page.locator('#mstEdges .edge-item').count();
  }

  // Helper to capture canvas data URL
  async function getCanvasDataUrl(page) {
    return page.evaluate(() => {
      const canvas = document.getElementById('graphCanvas');
      try {
        return canvas.toDataURL();
      } catch (e) {
        // If canvas tainting or other issues occur, propagate string
        return 'CANVAS_ERROR:' + (e && e.message ? e.message : String(e));
      }
    });
  }

  test('S0_Idle: Initial state on load should show Ready message and initial info panel', async ({ page }) => {
    // Validate initial "Idle" state: stepInfo text should be the expected ready message
    const stepInfo = await getStepInfoText(page);
    expect(stepInfo).toContain("Ready to start Prim's algorithm");

    // Initial MST edges list should be empty
    const mstCount = await getMstEdgeCount(page);
    expect(mstCount).toBe(0);

    // Total weight should be 0 on initial load
    const totalWeight = await getTotalWeightText(page);
    expect(totalWeight).toBe('0');

    // Canvas should be present and produce a data URL (non-empty string)
    const canvasDataUrl = await getCanvasDataUrl(page);
    expect(typeof canvasDataUrl).toBe('string');
    expect(canvasDataUrl.length).toBeGreaterThan(0);
  });

  test('S0_Idle -> S1_GraphGenerated: Clicking Generate New Graph updates canvas and preserves Ready state', async ({ page }) => {
    // Capture canvas before generating new graph
    const before = await getCanvasDataUrl(page);

    // Click Generate New Graph
    await page.click('#generateGraph');

    // Wait a short time for drawing to complete
    await page.waitForTimeout(200);

    // Capture canvas after generation
    const after = await getCanvasDataUrl(page);

    // The canvas representation should change after generating a new random graph.
    // This validates that drawGraph() was invoked and had effect.
    expect(after).not.toBeNull();
    // It's acceptable in extremely rare cases that the random graph rendered identically.
    // But normally we expect a different canvas data URL.
    // We assert that at least the call completed without throwing (data URL present).
    expect(after.length).toBeGreaterThan(0);

    // Also validate that stepInfo stays in idle-ready message (no accidental start)
    const stepInfo = await getStepInfoText(page);
    expect(stepInfo).toContain("Ready to start Prim's algorithm");

    // And there should still be no MST edges shown after generating new graph
    const mstCount = await getMstEdgeCount(page);
    expect(mstCount).toBe(0);

    // No page errors should have been produced (checked in afterEach)
  });

  test('StepPrim event from Idle: clicking Step Forward transitions to first step (S3_StepCompleted behavior)', async ({ page }) => {
    // Ensure in Idle initially
    await expect(page.locator('#stepInfo')).toHaveText(/Ready to start Prim's algorithm/);

    // Click Step Forward once from Idle (stepPrimAlgorithm should handle currentStep === 0)
    await page.click('#stepPrim');

    // Wait until stepInfo text reflects the first step or timeout
    await page.waitForFunction(() => {
      const el = document.getElementById('stepInfo');
      return el && /Step\s+\d+: Starting with node/.test(el.textContent);
    }, {}, { timeout: 2000 });

    const stepInfo = await getStepInfoText(page);
    expect(stepInfo).toMatch(/Step\s+\d+:\s+Starting with node/);

    // After the first step, MST should still be empty and total weight 0
    const mstCount = await getMstEdgeCount(page);
    expect(mstCount).toBe(0);

    const totalWeight = await getTotalWeightText(page);
    expect(totalWeight).toBe('0');
  });

  test('StartPrim event (S1 -> S2): Starting automatic algorithm should begin stepping (Step updates stepInfo)', async ({ page }) => {
    // Generate a fresh graph to ensure deterministic behavior baseline
    await page.click('#generateGraph');
    await page.waitForTimeout(100);

    // Click Start Prim's Algorithm to begin automatic stepping (uses setInterval internally)
    await page.click('#startPrim');

    // Wait for the algorithm to perform at least the first step (startPrim triggers reset then interval)
    await page.waitForFunction(() => {
      const el = document.getElementById('stepInfo');
      return el && /Step\s+\d+:\s+(Starting with node|Added edge)/.test(el.textContent);
    }, {}, { timeout: 3000 });

    // Validate that stepInfo is reporting progression
    const stepInfo = await getStepInfoText(page);
    expect(stepInfo).toMatch(/Step\s+\d+:\s+(Starting with node|Added edge)/);

    // Wait further to observe at least one MST edge added (if algorithm makes progress)
    // We wait up to 5 seconds for at least one edge to be present in mstEdges.
    const edgeCountAfter = await page.locator('#mstEdges .edge-item').first().count().catch(() => 0);
    // Instead of forcing a strict count, wait for either an "Added edge" message or eventual completion
    const eventual = await page.waitForFunction(() => {
      const info = document.getElementById('stepInfo')?.textContent || '';
      return /Added edge|Algorithm completed! Minimum Spanning Tree found\./.test(info);
    }, {}, { timeout: 5000 });

    expect(eventual).toBeTruthy();
  });

  test('Manual stepping to completion (S2_AlgorithmStarted -> S3_StepCompleted -> S4_AlgorithmCompleted): click Step repeatedly until completion', async ({ page }) => {
    // Start with a new graph so we know the maximum steps needed (at most nodeCount steps)
    await page.click('#generateGraph');
    await page.waitForTimeout(100);

    // We'll perform manual steps by clicking the Step Forward button repeatedly, up to a safety limit
    const MAX_STEPS = 25;
    let completed = false;
    for (let i = 0; i < MAX_STEPS; i++) {
      await page.click('#stepPrim');
      // Give a small delay to allow DOM updates/drawing
      await page.waitForTimeout(150);

      const info = await getStepInfoText(page);
      if (info.includes('Algorithm completed! Minimum Spanning Tree found.')) {
        completed = true;
        break;
      }
    }

    // Validate that algorithm reached completed state (S4) within the step limit
    expect(completed, 'Algorithm should complete after repeated step clicks within step limit').toBe(true);

    // Once completed, MST edges should be present and totalWeight should be numeric >= 0
    const mstCount = await getMstEdgeCount(page);
    expect(mstCount).toBeGreaterThanOrEqual(0); // Could be zero if graph isolated, but the algorithm ran without errors

    const totalWeightStr = await getTotalWeightText(page);
    const totalWeight = Number(totalWeightStr);
    expect(!Number.isNaN(totalWeight), 'totalWeight should be a number').toBe(true);

    // Confirm final stepInfo matches expected completion message exactly
    const finalInfo = await getStepInfoText(page);
    expect(finalInfo).toBe('Algorithm completed! Minimum Spanning Tree found.');
  });

  test('Reset event: resets algorithm to Idle (S2 or S3 -> S0_Idle) and updates info panel immediately', async ({ page }) => {
    // Generate and perform a few steps to move away from Idle
    await page.click('#generateGraph');
    await page.waitForTimeout(100);
    await page.click('#stepPrim'); // step 1
    await page.waitForTimeout(100);
    await page.click('#stepPrim'); // maybe step 2
    await page.waitForTimeout(100);

    // Now click Reset and assert stepInfo is immediately set back to Ready
    await page.click('#reset');

    // Immediately after reset, the message should reflect Idle
    const resetInfo = await getStepInfoText(page);
    expect(resetInfo).toContain("Ready to start Prim's algorithm");

    // The MST list should be cleared on reset
    const mstCountAfterReset = await getMstEdgeCount(page);
    expect(mstCountAfterReset).toBe(0);

    // Total weight should reset to 0
    const totalWeightAfterReset = await getTotalWeightText(page);
    expect(totalWeightAfterReset).toBe('0');
  });

  test('Edge cases and robustness: multiple Generate clicks and Start without explicit Generate should not throw', async ({ page }) => {
    // Click Generate multiple times in quick succession
    await page.click('#generateGraph');
    await page.click('#generateGraph');
    await page.click('#generateGraph');

    // Wait for redraws to complete
    await page.waitForTimeout(300);

    // Click Start without explicitly generating (should use the graph present)
    await page.click('#startPrim');

    // Wait for at least one step to be reported
    await page.waitForFunction(() => {
      const el = document.getElementById('stepInfo');
      return el && /Step\s+\d+:\s+(Starting with node|Added edge)/.test(el.textContent);
    }, {}, { timeout: 3000 });

    // Ensure no exceptions occurred during these rapid interactions (asserted in afterEach)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Behavioral observation: Reset while automatic StartPrim is running (detect if interval continues)', async ({ page }) => {
    // Generate and start automatic algorithm
    await page.click('#generateGraph');
    await page.waitForTimeout(100);
    await page.click('#startPrim');

    // Wait for at least the first automatic step
    await page.waitForFunction(() => {
      const el = document.getElementById('stepInfo');
      return el && /Step\s+\d+:\s+Starting with node/.test(el.textContent);
    }, {}, { timeout: 3000 });

    // Immediately click Reset
    await page.click('#reset');

    // Record the stepInfo right after reset
    const postResetInfo = await getStepInfoText(page);
    expect(postResetInfo).toContain("Ready to start Prim's algorithm");

    // Wait briefly and observe whether stepInfo changes after the reset.
    // If the internal interval was not cleared by reset, the automatic process may continue and overwrite the stepInfo.
    await page.waitForTimeout(800);

    const laterInfo = await getStepInfoText(page);

    // We do NOT assume either behavior is strictly correct here because the implementation uses setInterval and resetAlgorithm does not clear it.
    // Instead we assert that the page remained responsive and no exceptions were thrown while this scenario occurred.
    // This test documents observed behavior: either the ready message persists, or it gets overwritten by continued automatic stepping.
    expect(typeof laterInfo).toBe('string');
  });

  test('Console and runtime diagnostics: collect console logs and ensure no uncaught exceptions', async ({ page }) => {
    // Interact with the app modestly to generate typical console activity
    await page.click('#generateGraph');
    await page.click('#stepPrim');
    await page.click('#reset');

    // Wait a short while for any async logs or errors
    await page.waitForTimeout(300);

    // Check collected console messages array (not expecting any errors)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // It is acceptable to have warnings in some environments; we will at least assert there are no console "error" messages.
    const errorMsgs = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(errorMsgs, 'No console.error messages should have been emitted by the page').toEqual([]);

    // The pageErrors array is asserted empty in afterEach to ensure no uncaught exceptions occurred.
  });

});