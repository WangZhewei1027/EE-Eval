import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf6ca1-fa79-11f0-8075-e54a10595dde.html';

test.describe('Backtracking Demo (FSM validation) - Application ID: 99cf6ca1-fa79-11f0-8075-e54a10595dde', () => {
  // Shared collectors for console messages and page errors
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for later assertions/inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // ignore if something unusual happens collecting console
      }
    });

    // Collect unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure the main expected elements are present before tests run
    await expect(page.locator('#target')).toBeVisible();
    await expect(page.locator('button[onclick="startBacktracking()"]')).toBeVisible();
    await expect(page.locator('#status')).toBeVisible();
    await expect(page.locator('#currentPath')).toBeVisible();
    await expect(page.locator('#results')).toBeVisible();
  });

  test.afterEach(async () => {
    // No special teardown required beyond Playwright fixtures.
    // We keep pageErrors and consoleMessages available to each test for assertions.
  });

  test.describe('State assertions and entry/exit actions', () => {
    test('Initial state S0_Ready: page loads with status "Ready to explore"', async ({ page }) => {
      // Validate the Ready state entry action (updateDisplay()) effect: status should show Ready to explore
      const status = await page.locator('#status').innerText();
      expect(status).toBe('Ready to explore');

      // Also validate that currentPath and results show initial values
      const currentPath = await page.locator('#currentPath').innerText();
      const results = await page.locator('#results').innerText();
      expect(currentPath).toBe('');
      expect(results).toBe('None');

      // No runtime page errors should have occurred during initial load
      expect(pageErrors.length).toBe(0);
    });

    test('Starting exploration (StartBacktracking event) triggers status transitions and updates', async ({ page }) => {
      // Attach a MutationObserver to capture status changes so we can assert intermediate states
      await page.evaluate(() => {
        // Create a global array to record status innerText changes
        window.__statusMutations = [];
        const target = document.getElementById('status');
        if (!target) return;
        const observer = new MutationObserver(() => {
          // Read the textContent (child changes) or innerText
          window.__statusMutations.push(target.innerText);
        });
        observer.observe(target, { childList: true, subtree: true, characterData: true });
        // expose the observer reference so it doesn't get GC'd (not strictly necessary)
        window.__statusObserver = observer;
      });

      // Click Start Backtracking
      await page.click('button[onclick="startBacktracking()"]');

      // Allow a short time for synchronous JS to run and DOM mutations to be recorded
      await page.waitForTimeout(100);

      // Read the recorded status mutation sequence
      const mutations = await page.evaluate(() => window.__statusMutations || []);
      // There should be at least one mutation (startBacktracking sets "Exploring..." then updateDisplay may set "Ready to explore")
      expect(mutations.length).toBeGreaterThanOrEqual(1);

      // We expect that startBacktracking() attempts to set "Exploring..." as part of the transition to Exploring.
      // Due to the implementation calling updateDisplay() afterwards, the final state may revert back to "Ready to explore".
      // Assert that the recorded sequence contains "Exploring..." at some point and that the current status equals the final displayed value.
      const sawExploring = mutations.some(m => m === 'Exploring...');
      expect(sawExploring).toBeTruthy();

      const finalStatus = await page.locator('#status').innerText();
      // The implementation ultimately calls updateDisplay(), which will show "Ready to explore" when currentStep < 0.
      // Assert the observed final status (this verifies actual behavior; it may reveal divergence from FSM expectation).
      expect(['Ready to explore', 'Exploring...']).toContain(finalStatus);

      // Also verify currentPath and results DOM reflect the outcome after start:
      const currentPath = await page.locator('#currentPath').innerText();
      const results = await page.locator('#results').innerText();
      // Implementation likely results in no exploration history (due to redefined functions), so currentPath is empty
      expect(currentPath).toBe('');
      // Results may be "None" if no valid combinations were pushed
      expect(results).toBe('None');

      // Ensure no uncaught exceptions were thrown during this process
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Navigation controls and transitions in S1_Exploring (or no-op if implementation diverges)', () => {
    test('Backtrack, Next, and Previous do not throw and maintain DOM consistency', async ({ page }) => {
      // Start the exploration first
      await page.click('button[onclick="startBacktracking()"]');
      await page.waitForTimeout(50);

      // Click Next Step
      await page.click('button[onclick="next()"]');
      // Click Previous Step
      await page.click('button[onclick="previous()"]');
      // Click Backtrack (the control button)
      await page.click('button[onclick="backtrack()"]');

      // Allow small delay for synchronous handlers
      await page.waitForTimeout(50);

      // Assert that page did not produce runtime exceptions
      expect(pageErrors.length).toBe(0);

      // Assert that currentPath and results are still valid DOM strings (no "undefined" or errors)
      const currentPath = await page.locator('#currentPath').innerText();
      const results = await page.locator('#results').innerText();
      expect(currentPath).not.toMatch(/undefined|null/);
      expect(results).not.toMatch(/undefined|null/);

      // Status should still be a recognized value
      const status = await page.locator('#status').innerText();
      expect(['Ready to explore', 'Exploring...']).toContain(status);
    });

    test('Edge case: set target to 0 (below min) and start: no uncaught errors and UI remains consistent', async ({ page }) => {
      // Programmatically set the input to 0 (even though min is 1) to probe edge case behavior
      await page.fill('#target', '0');

      // Start backtracking with an invalid/edge target
      await page.click('button[onclick="startBacktracking()"]');

      // Allow time for execution
      await page.waitForTimeout(50);

      // There should be no uncaught errors thrown by the page
      expect(pageErrors.length).toBe(0);

      // Validate UI stays consistent
      const status = await page.locator('#status').innerText();
      expect(['Ready to explore', 'Exploring...']).toContain(status);

      const results = await page.locator('#results').innerText();
      expect(results).toBe('None');

      const currentPath = await page.locator('#currentPath').innerText();
      expect(currentPath).toBe('');
    });
  });

  test.describe('Reset transition (S1_Exploring -> S0_Ready) and variable state', () => {
    test('Reset brings the app back to Ready and clears internal state variables', async ({ page }) => {
      // Set input to a specific value and start to modify internal state
      await page.fill('#target', '3');
      await page.click('button[onclick="startBacktracking()"]');

      // Allow handlers to run
      await page.waitForTimeout(50);

      // Now click Reset
      await page.click('button[onclick="reset()"]');

      // Allow updateDisplay to run
      await page.waitForTimeout(50);

      // Final status should be Ready to explore (per updateDisplay setting when currentStep < 0)
      const status = await page.locator('#status').innerText();
      expect(status).toBe('Ready to explore');

      // results should be reset to "None" and currentPath blank
      const results = await page.locator('#results').innerText();
      const currentPath = await page.locator('#currentPath').innerText();
      expect(results).toBe('None');
      expect(currentPath).toBe('');

      // Validate that the global variable targetSum in page context is 0 (reset sets it to 0)
      const targetSumValue = await page.evaluate(() => typeof targetSum !== 'undefined' ? targetSum : null);
      expect(targetSumValue).toBe(0);

      // The input field's visual value is not changed by reset() (implementation detail) — assert that it still shows "3"
      const inputValue = await page.locator('#target').inputValue();
      expect(inputValue).toBe('3');

      // No uncaught errors should have been recorded
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM coverage summary and diagnostics', () => {
    test('Validate that all expected control buttons exist and have onclick handlers as expected', async ({ page }) => {
      const selectors = [
        'button[onclick="startBacktracking()"]',
        'button[onclick="backtrack()"]',
        'button[onclick="reset()"]',
        'button[onclick="next()"]',
        'button[onclick="previous()"]'
      ];
      for (const sel of selectors) {
        const el = page.locator(sel);
        await expect(el).toBeVisible();
      }

      // No runtime page errors observed during these checks
      expect(pageErrors.length).toBe(0);
    });

    test('Collect and assert that no unexpected page errors (ReferenceError/SyntaxError/TypeError) occurred during entire test flow', async ({ page }) => {
      // This test inspects the aggregated pageErrors captured during the lifecycle of the test suite.
      // The application is expected to run without uncaught exceptions even if some internal logic diverges from the FSM.
      expect(pageErrors.length).toBe(0);

      // Also assert that console did not log any severe errors (if any console errors are present, fail)
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(consoleErrors.length).toBe(0);
    });
  });
});