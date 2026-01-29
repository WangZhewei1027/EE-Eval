import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac7651-fa78-11f0-812d-c9788050701f.html';

test.describe('DNS Visualization FSM - 72ac7651-fa78-11f0-812d-c9788050701f', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  // Setup a fresh page per test and collect runtime errors/logs
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // even if reading msg properties throws, record basic info
        consoleErrors.push({ text: String(msg), location: null });
      }
    });

    // Capture page runtime exceptions (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the app under test
    await page.goto(APP_URL);
    // Wait for main UI to be present
    await page.waitForSelector('#animateBtn');
    await page.waitForSelector('#resetBtn');
  });

  test.afterEach(async () => {
    // No teardown modifications required; collected errors remain per-test for assertions
  });

  test.describe('State S0_Idle (Initial state) - renderPage()', () => {
    test('Initial Idle state renders expected elements and no runtime errors', async ({ page }) => {
      // This test validates initial page render (S0_Idle) and presence of key UI components.
      // It also asserts that initial load produced no console errors or page errors.

      // Buttons exist and visible
      const animateBtn = page.locator('#animateBtn');
      const resetBtn = page.locator('#resetBtn');

      await expect(animateBtn).toBeVisible();
      await expect(resetBtn).toBeVisible();

      // Reset button has the highlight class per FSM/component evidence
      await expect(resetBtn).toHaveClass(/highlight/);

      // Connections exist and none should be active initially
      const connections = page.locator('.connection');
      await expect(connections).toHaveCount(4);

      for (let i = 0; i < 4; i++) {
        await expect(page.locator(`.connection-${i + 1}`)).not.toHaveClass(/active/);
      }

      // Nodes exist (5 nodes in the visualization)
      const nodes = page.locator('.node');
      await expect(nodes).toHaveCount(5);

      // No pulse elements on initial load
      await expect(page.locator('.pulse')).toHaveCount(0);

      // Assert no console errors or page errors occurred during load
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ShowDnsLookup (S0_Idle -> S1_Animating) and animateConnections()', () => {
    test('Clicking Show DNS Lookup activates connections sequentially and creates pulses', async ({ page }) => {
      // This test validates that clicking the animate button transitions the app to the Animating state,
      // that connections gain the "active" class in sequence, and that pulse elements are created.

      const animateBtn = page.locator('#animateBtn');

      // Click the animate button to trigger animation
      await animateBtn.click();

      // First connection (connection-1) is scheduled with timeout 0 -> should become active quickly
      await page.waitForSelector('.connection-1.active', { timeout: 2000 });

      // Each subsequent connection activates roughly every 1s. We'll wait for each in order with timeouts.
      await page.waitForSelector('.connection-2.active', { timeout: 2500 });
      await page.waitForSelector('.connection-3.active', { timeout: 3500 });
      await page.waitForSelector('.connection-4.active', { timeout: 4500 });

      // Pulses are created for each activation; at least one pulse should exist during the animation.
      // Pulses are transient (removed after ~1000ms), so allow some leeway.
      await page.waitForSelector('.pulse', { timeout: 2000 });

      // After the final connection activation, animationInProgress is set to false after 1s.
      // Wait a little longer to let the internal flag clear (observational only).
      await page.waitForTimeout(1200);

      // After the animation completes, all connections should still have the 'active' class until reset.
      for (let i = 1; i <= 4; i++) {
        await expect(page.locator(`.connection-${i}`)).toHaveClass(/active/);
      }

      // Ensure no runtime errors occurred during animation
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Show DNS Lookup twice quickly does not throw errors and results in expected activations', async ({ page }) => {
      // Edge case: validate that rapid successive clicks do not cause runtime exceptions
      // and that the animation still results in the expected connections becoming active.
      const animateBtn = page.locator('#animateBtn');

      // Click twice rapidly
      await animateBtn.click();
      await animateBtn.click(); // second click should be ignored by animationInProgress guard

      // Ensure the sequence still completes: wait for the last connection to become active
      await page.waitForSelector('.connection-4.active', { timeout: 6000 });

      // Confirm all connections are active
      for (let i = 1; i <= 4; i++) {
        await expect(page.locator(`.connection-${i}`)).toHaveClass(/active/);
      }

      // The key assertion here is that no console or page errors were produced by the rapid interactions
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ResetAnimation (S1_Animating -> S0_Idle) and resetAnimation()', () => {
    test('Reset Animation removes active classes and pulses (full flow)', async ({ page }) => {
      // This test triggers the animation, waits for at least one active connection/pulse,
      // then clicks Reset Animation and asserts that active styling and pulses are removed,
      // verifying the onExit/resetAnimation behavior described in the FSM.

      const animateBtn = page.locator('#animateBtn');
      const resetBtn = page.locator('#resetBtn');

      // Start animation
      await animateBtn.click();

      // Wait for first connection to become active and for a pulse to appear
      await page.waitForSelector('.connection-1.active', { timeout: 2000 });
      await page.waitForSelector('.pulse', { timeout: 2000 });

      // Now click Reset to invoke resetAnimation()
      await resetBtn.click();

      // After reset, no connections should have the 'active' class
      for (let i = 1; i <= 4; i++) {
        await expect(page.locator(`.connection-${i}`)).not.toHaveClass(/active/);
      }

      // All pulses should be removed from the DOM
      await expect(page.locator('.pulse')).toHaveCount(0);

      // Ensure animationInProgress is false by attempting to start animation again and observing normal behavior:
      // Start again and ensure first connection becomes active (meaning animation can be started after reset)
      await animateBtn.click();
      await page.waitForSelector('.connection-1.active', { timeout: 2000 });

      // Clean up by resetting again
      await resetBtn.click();
      for (let i = 1; i <= 4; i++) {
        await expect(page.locator(`.connection-${i}`)).not.toHaveClass(/active/);
      }

      // Assert no runtime errors during reset flow
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Reset when nothing is animating is safe and idempotent', async ({ page }) => {
      // Edge case: pressing Reset in Idle state should not cause errors and should be safe to call repeatedly.
      const resetBtn = page.locator('#resetBtn');

      // Ensure we are in Idle: connections should not be active
      for (let i = 1; i <= 4; i++) {
        await expect(page.locator(`.connection-${i}`)).not.toHaveClass(/active/);
      }

      // Click reset multiple times
      await resetBtn.click();
      await resetBtn.click();
      await resetBtn.click();

      // Still no active classes and no pulses
      for (let i = 1; i <= 4; i++) {
        await expect(page.locator(`.connection-${i}`)).not.toHaveClass(/active/);
      }
      await expect(page.locator('.pulse')).toHaveCount(0);

      // No errors should be generated by redundant resets
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability: Console and runtime error monitoring', () => {
    test('No unexpected ReferenceError, SyntaxError, or TypeError on load and interactions', async ({ page }) => {
      // This test exercises the page minimally and asserts that no critical runtime errors (ReferenceError, SyntaxError, TypeError)
      // were thrown during load and typical interactions.

      const animateBtn = page.locator('#animateBtn');
      const resetBtn = page.locator('#resetBtn');

      // Basic interactions
      await animateBtn.click();
      // Allow a small amount of time for any potential errors to manifest
      await page.waitForTimeout(500);
      await resetBtn.click();
      await page.waitForTimeout(500);

      // If any page errors were thrown, they would have been collected; assert none occurred
      expect(pageErrors.length).toBe(0);

      // Inspect console errors for common JS error names; if any exist, fail the test.
      const foundCriticalErrors = consoleErrors.filter(e => {
        const text = (e && e.text) ? String(e.text) : '';
        return /ReferenceError|TypeError|SyntaxError|Uncaught/.test(text);
      });

      expect(foundCriticalErrors.length).toBe(0);
    });
  });
});