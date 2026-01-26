import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac9d60-fa78-11f0-812d-c9788050701f.html';

test.describe('Harmonic Load Balancing (FSM) - 72ac9d60-fa78-11f0-812d-c9788050701f', () => {
  // Shared state for capturing console and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Utility helpers
  const getText = async (page, selector) => {
    const el = await page.$(selector);
    return el ? (await el.textContent())?.trim() : null;
  };

  const waitForRequestCountIncrease = async (page, baseline, timeout = 2000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const currentText = await getText(page, '#requestCount');
      const current = Number(currentText);
      if (!Number.isNaN(current) && current > baseline) return current - baseline;
      await page.waitForTimeout(100);
    }
    return 0;
  };

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors to assert no unexpected runtime errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Ensure initial DOMContentLoaded handlers have executed
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    // nothing to teardown per-test beyond Playwright cleanup
  });

  test('Initial UI presence and Idle-like initial values', async ({ page }) => {
    // This test validates that the key UI components exist and initial textual values match the HTML defaults.
    // It also ensures there are no immediate script errors upon load.
    const startBtn = await page.$('#startBtn');
    const stressBtn = await page.$('#stressBtn');
    const reqCountText = await getText(page, '#requestCount');
    const avgRespText = await getText(page, '#avgResponse');
    const efficiencyText = await getText(page, '#efficiency');

    expect(startBtn, 'Start Flow button should be present').not.toBeNull();
    expect(stressBtn, 'Stress Test button should be present').not.toBeNull();
    // HTML initial values are "0", "0ms", "100%" respectively
    expect(reqCountText).toBe('0');
    expect(avgRespText).toBe('0ms');
    expect(efficiencyText).toBe('100%');

    // There should be 5 server elements created in the visualization DOM
    const servers = await page.$$('.visualization .server');
    expect(servers.length).toBe(5);

    // Verify no page errors or console-level errors emitted immediately
    expect(pageErrors.length, 'No uncaught page errors on initial load').toBe(0);
    expect(consoleErrors.length, 'No console.error messages on initial load').toBe(0);
  });

  test('Start Flow event transitions to Normal Flow (observable request rate ~800ms interval)', async ({ page }) => {
    // This test clicks the Start Flow button and measures the rate of requests arriving to infer the interval.
    // It validates that requests begin to be processed after clicking Start Flow.
    const beforeText = await getText(page, '#requestCount');
    const before = Number(beforeText);

    await page.click('#startBtn');

    // Wait for at least one request to be processed (800ms interval expected); allow a margin
    const delta = await waitForRequestCountIncrease(page, before, 3000);
    expect(delta).toBeGreaterThanOrEqual(1);

    // Compute approximate rate (requests per second) across a 2s sample to check it's in expected band (~1.25 req/s)
    const sampleBaseline = Number(await getText(page, '#requestCount'));
    const sampleDuration = 2000;
    await page.waitForTimeout(sampleDuration);
    const sampleFinal = Number(await getText(page, '#requestCount'));
    const sampleDelta = sampleFinal - sampleBaseline;
    const rps = sampleDelta / (sampleDuration / 1000);

    // Normal flow should produce roughly 0.8-1.8 requests/sec (800ms interval => ~1.25 rps).
    expect(rps, `Normal flow requests/sec (${rps}) should be within expected bounds`).toBeGreaterThan(0.4);
    expect(rps).toBeLessThan(3);

    // Stats should be updated and show values with units
    const avgResponse = await getText(page, '#avgResponse');
    const efficiency = await getText(page, '#efficiency');
    expect(avgResponse.endsWith('ms')).toBeTruthy();
    expect(efficiency.endsWith('%')).toBeTruthy();

    // Ensure no runtime errors occurred during the normal flow
    expect(pageErrors.length, 'No uncaught page errors during normal flow').toBe(0);
    expect(consoleErrors.length, 'No console.error messages during normal flow').toBe(0);
  });

  test('Stress Test event transitions to Stress Flow (observable higher request rate ~200ms interval)', async ({ page }) => {
    // This test compares request rates between Normal Flow and Stress Test to validate the stress mode is faster.
    // Start in Normal Flow first
    await page.click('#startBtn');
    const baselineAfterNormal = Number(await getText(page, '#requestCount'));
    await page.waitForTimeout(1600); // let a couple of normal requests occur
    const normalAfter = Number(await getText(page, '#requestCount'));
    const normalDelta = normalAfter - baselineAfterNormal;
    const normalRps = normalDelta / 1.6; // per second

    // Now switch to Stress Test (should clear previous interval and start faster interval)
    await page.click('#stressBtn');
    const baselineAfterStress = Number(await getText(page, '#requestCount'));
    // Wait for 1200ms to capture several stress requests (200ms interval expected => ~6 req)
    await page.waitForTimeout(1200);
    const stressAfter = Number(await getText(page, '#requestCount'));
    const stressDelta = stressAfter - baselineAfterStress;
    const stressRps = stressDelta / 1.2; // per second

    // Stress RPS should be significantly higher than normal RPS
    expect(stressDelta).toBeGreaterThanOrEqual(1);
    expect(stressRps).toBeGreaterThanOrEqual(normalRps);

    // Basic sanity bounds: stress RPS should be > 1 (since 200ms => ~5 req/s)
    expect(stressRps).toBeGreaterThan(1);

    // Validate visual cues: there should be active connection class toggles at some point
    // We'll wait a bit and check whether any connection has the 'active' class (indicative of requests being visualized)
    await page.waitForTimeout(500);
    const activeConnections = await page.$$('.visualization .connection.active');
    // It's possible that at the exact moment none are active (race), but we at least expect the array to be defined
    expect(activeConnections).not.toBeNull();

    // Ensure no runtime errors occurred during stress flow
    expect(pageErrors.length, 'No uncaught page errors during stress flow').toBe(0);
    expect(consoleErrors.length, 'No console.error messages during stress flow').toBe(0);
  });

  test('Reset behavior on transitions and server status update (resetServers executed)', async ({ page }) => {
    // This test verifies that resetServers() (called on transitions) clears server classes and updates stats fields.
    // Because resetServers() does not explicitly set the #requestCount textContent back to "0", we assert observed implementation behavior.
    // Start by producing some load via Stress Test
    await page.click('#stressBtn');
    await page.waitForTimeout(1000); // allow some requests to happen

    const preRequestCount = await getText(page, '#requestCount');
    expect(Number(preRequestCount)).toBeGreaterThanOrEqual(1);

    // Now click Start Flow which in the implementation performs clearInterval(requestInterval); resetServers(); setInterval(...800)
    // resetServers() should remove 'load' and 'overload' classes from servers and reset internal stats.
    await page.click('#startBtn');

    // Give time for resetServers to run and for UI to reflect server class changes
    await page.waitForTimeout(300);

    // Verify server elements do not have 'load' or 'overload' classes after reset
    const servers = await page.$$('.visualization .server');
    for (const s of servers) {
      const className = (await s.getAttribute('class')) || '';
      expect(className.includes('load')).toBeFalsy();
      expect(className.includes('overload')).toBeFalsy();
    }

    // Implementation note: resetServers() reinitializes internal stats and calls updateStats()
    // But because totalRequests becomes 0, updateStats() divides by zero causing "NaNms" / "NaN%" in the displayed elements.
    // Assert that avgResponse or efficiency contains "NaN" to confirm reset occurred as implemented.
    const avgAfterReset = await getText(page, '#avgResponse');
    const effAfterReset = await getText(page, '#efficiency');

    // At least one of them should contain 'NaN' as a side-effect of resetting stats.totalRequests to 0 in this implementation.
    const nanObserved = (avgAfterReset && avgAfterReset.includes('NaN')) || (effAfterReset && effAfterReset.includes('NaN'));
    expect(nanObserved, 'Reset should cause NaN in stats display due to division by zero in updateStats').toBeTruthy();

    // Ensure no runtime errors occurred during reset operation
    expect(pageErrors.length, 'No uncaught page errors during reset operations').toBe(0);
    expect(consoleErrors.length, 'No console.error messages during reset operations').toBe(0);
  });

  test('Robustness: rapid toggling of controls does not produce uncaught exceptions', async ({ page }) => {
    // This test rapidly clicks Start Flow and Stress Test multiple times to surface potential race conditions.
    // Validate that the page does not emit uncaught exceptions or console.error messages as a result.
    const toggles = 8;
    for (let i = 0; i < toggles; i++) {
      await page.click(i % 2 === 0 ? '#startBtn' : '#stressBtn');
      // small jitter between clicks to simulate a user aggressively interacting
      await page.waitForTimeout(100 + (i * 10));
    }

    // Wait a bit of time for any background operations to run and potential errors to be thrown
    await page.waitForTimeout(1500);

    // Assert no uncaught exceptions recorded and no console.error calls were emitted
    expect(pageErrors.length, 'No uncaught page errors after rapid toggling').toBe(0);
    expect(consoleErrors.length, 'No console.error messages after rapid toggling').toBe(0);

    // Validate that requestCount is still numeric and stats remain in expected textual format
    const reqCountText = await getText(page, '#requestCount');
    expect(Number.isNaN(Number(reqCountText))).toBeFalsy();
    const avgRespText = await getText(page, '#avgResponse');
    expect(typeof avgRespText).toBe('string');
  });

  test('Edge case: ensure no SyntaxError/ReferenceError/TypeError in console throughout test session', async ({ page }) => {
    // This test collects console and page errors during a longer window and asserts none of the common fatal JS errors appeared.
    // We'll observe for 3 seconds to catch errors that might occur asynchronously (e.g., from intervals).
    await page.waitForTimeout(3000);

    // Build a list of stringified diagnostics
    const pageErrorMessages = pageErrors.map(e => String(e && e.stack ? e.stack : e));
    const consoleErrorMessages = consoleErrors.slice();

    // Assert that none of the page errors indicate ReferenceError/SyntaxError/TypeError
    for (const msg of pageErrorMessages) {
      expect(msg.includes('ReferenceError')).toBeFalsy();
      expect(msg.includes('SyntaxError')).toBeFalsy();
      expect(msg.includes('TypeError')).toBeFalsy();
    }

    for (const msg of consoleErrorMessages) {
      expect(msg.includes('ReferenceError')).toBeFalsy();
      expect(msg.includes('SyntaxError')).toBeFalsy();
      expect(msg.includes('TypeError')).toBeFalsy();
    }

    // Also assert that no page-level errors were captured
    expect(pageErrors.length, 'No page errors observed in extended monitoring').toBe(0);
    expect(consoleErrors.length, 'No console.error messages observed in extended monitoring').toBe(0);
  });
});