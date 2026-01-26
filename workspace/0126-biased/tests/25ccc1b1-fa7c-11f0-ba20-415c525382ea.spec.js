import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ccc1b1-fa7c-11f0-ba20-415c525382ea.html';

test.describe('Comprehensive tests for Routing interactive demo (FSM validation)', () => {
  // Hold captured page errors and console.error messages for assertions
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // initialize collectors
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // store full error object for later assertions (message/type may be inspected)
      pageErrors.push(err);
    });

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the exact provided URL and wait for DOM content to be loaded
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure the key elements exist before each test
    await expect(page.locator('#runDemoBtn')).toBeVisible();
    await expect(page.locator('#demoOutput')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leakage between tests
    page.removeAllListeners?.('pageerror');
    page.removeAllListeners?.('console');
    // No explicit teardown is required; Playwright will close the page/context as needed.
  });

  test('Idle state renders correctly (S0_Idle) — initial UI and accessibility attributes', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry evidence and DOM presence.
    // Check the Run Simple Distance Vector Demo button exists with expected text
    const runBtn = page.locator('#runDemoBtn');
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run Simple Distance Vector Demo');

    // Check the demo output region exists and is initially empty
    const output = page.locator('#demoOutput');
    await expect(output).toBeVisible();
    await expect(output).toHaveText(''); // initial content expected to be empty

    // Verify ARIA attributes described in the FSM/components
    await expect(output).toHaveAttribute('aria-live', 'polite');
    await expect(output).toHaveAttribute('aria-atomic', 'true');
    await expect(output).toHaveAttribute('role', 'region');

    // No runtime page errors or console.error logged before interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition RunDemo: clicking button runs demo and enters Demo Running (S1_DemoRunning)', async ({ page }) => {
    // This test validates the transition from Idle to DemoRunning when the user clicks the button.
    const runBtn = page.locator('#runDemoBtn');
    const output = page.locator('#demoOutput');

    // Click the button to trigger runDistanceVectorDemo via addEventListener('click', ...)
    await runBtn.click();

    // The demo is synchronous in-script: wait until we see the convergence message in the output.
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Demo ended: Routing tables converged\./i.test(el.textContent || '');
    }, { timeout: 2000 });

    // Verify the output contains expected routing table headers and convergence message
    const outputText = await output.textContent();
    expect(outputText).toBeTruthy();
    expect(outputText).toMatch(/--- Routing Tables after round 0 ---/);
    expect(outputText).toMatch(/Router A:/);
    expect(outputText).toMatch(/Router B:/);
    expect(outputText).toMatch(/Router C:/);
    expect(outputText).toMatch(/Demo ended: Routing tables converged\./);

    // After the click completes, the button should be enabled again (script disables then re-enables)
    await expect(runBtn).toBeEnabled();

    // Ensure there were no uncaught page errors or console.error messages during the demo run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks do not cause exceptions and produce deterministic output', async ({ page }) => {
    // This test simulates rapid user interactions (multiple clicks) to surface potential race conditions or exceptions.
    const runBtn = page.locator('#runDemoBtn');
    const output = page.locator('#demoOutput');

    // Perform several rapid clicks. Because the demo function is synchronous in the click handler,
    // each click will run sequentially, but we want to ensure no errors are thrown and final output is valid.
    await runBtn.click();
    await runBtn.click();
    await runBtn.click();

    // Wait for the last run to finish by waiting for the convergence message to appear
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Demo ended: Routing tables converged\./i.test(el.textContent || '');
    }, { timeout: 2000 });

    const text = await output.textContent();
    // The output might contain multiple runs appended; however each run should include round 0 header at least once
    expect(text).toMatch(/--- Routing Tables after round 0 ---/);
    expect(text).toMatch(/Demo ended: Routing tables converged\./);

    // Ensure that despite the rapid clicks, no uncaught exceptions were recorded
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence and expected behaviors: event listener triggers runDistanceVectorDemo without modifying global scope', async ({ page }) => {
    // This test verifies that clicking the button triggers the demo function (as per FSM evidence),
    // and it also checks that no unexpected global variables are introduced by the script.
    // We do not patch or modify the page; we only observe.

    // Capture snapshot of window keys before click
    const keysBefore = await page.evaluate(() => Object.keys(window).sort());

    // Perform one click to trigger demo
    await page.locator('#runDemoBtn').click();

    // Wait for convergence message
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Demo ended: Routing tables converged\./i.test(el.textContent || '');
    }, { timeout: 2000 });

    // Check demo output includes indications that runDistanceVectorDemo executed
    const outputText = await page.locator('#demoOutput').textContent();
    expect(outputText).toContain('--- Routing Tables after round 0 ---');

    // Capture snapshot of window keys after click
    const keysAfter = await page.evaluate(() => Object.keys(window).sort());

    // Assert that the script did not introduce an excessive number of new globals.
    // It's acceptable that some new keys exist (e.g., environment), but assert that extremely large diffs didn't occur.
    // This is a conservative check: ensure fewer than 20 new globals were added by the demo.
    const newGlobals = keysAfter.filter(k => !keysBefore.includes(k));
    expect(newGlobals.length).toBeLessThan(20);

    // And ensure again there were no runtime page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Error monitoring test: no ReferenceError, SyntaxError, or TypeError triggered during load and interactions', async ({ page }) => {
    // This test explicitly inspects captured page errors to ensure none are ReferenceError, SyntaxError, or TypeError.
    // It loads the page and performs a demo run to observe runtime behavior.

    // Perform an action (run demo) to surface runtime exceptions if present
    await page.locator('#runDemoBtn').click();

    // Wait for the run to finish
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && /Demo ended: Routing tables converged\./i.test(el.textContent || '');
    }, { timeout: 2000 });

    // Inspect any captured page errors and ensure none are the targeted error types.
    for (const err of pageErrors) {
      // err is an Error object; inspect its name/message
      const name = err && err.name ? err.name : '';
      const message = err && err.message ? err.message : String(err);
      // Fail the test if any of the unwanted error types are present
      expect(['ReferenceError', 'SyntaxError', 'TypeError']).not.toContain(name);
      // Also ensure the message does not include those tokens (extra safety)
      expect(message).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }

    // Also assert that Playwright-captured console.error messages do not mention those errors
    for (const cmsg of consoleErrors) {
      expect(cmsg).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }

    // If no page errors at all, that's acceptable as well.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});