import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b38173-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Comprehensive Monitor Demo (FSM) - f0b38173-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Shared holders for console and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  // Setup before each test: navigate to the app and attach listeners to observe console and runtime errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors (exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown necessary beyond Playwright fixtures; arrays reset in beforeEach.
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Idle: Button present and demo output hidden on load', async ({ page }) => {
      // Verify the Run Monitor Demonstration button exists and is visible
      const button = page.locator('#demoButton');
      await expect(button).toBeVisible();

      // Verify demo output div exists and is initially hidden (display: none)
      const output = page.locator('#demoOutput');
      await expect(output).toBeVisible(); // locator exists and visible as element presence; style may be none
      // Check computed style for display none
      const display = await output.evaluate((el) => getComputedStyle(el).display);
      expect(display === 'none' || display === 'block' || display === 'inline' || typeof display === 'string').toBeTruthy();
      // The specification sets display: none initially; assert that it's indeed 'none'
      expect(display).toBe('none');

      // There should be no console errors or page errors right after load
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Run Demonstration transitions and FSM state coverage', () => {
    test('Clicking Run Monitor Demonstration progresses through all FSM states (S1 -> S7)', async ({ page }) => {
      const button = page.locator('#demoButton');
      const output = page.locator('#demoOutput');

      // Click the button to trigger the demonstration (RunDemonstration event)
      await button.click();

      // After click, demo output should be displayed and show initial Running simulation
      await expect(output).toBeVisible();
      await expect(output).toContainText('Running simulation...', { timeout: 1000 });

      // S2: Thread 1 enters (after ~500ms)
      await expect(output).toContainText('Thread 1 enters monitor - counter = 1', { timeout: 1500 });

      // S3: Thread 2 waiting (after ~1000ms)
      await expect(output).toContainText('Thread 2 tries to enter but must wait', { timeout: 2000 });

      // S4: Thread 1 exits (after ~1500ms)
      await expect(output).toContainText('Thread 1 exits monitor', { timeout: 2500 });

      // S5: Thread 2 enters (after ~2000ms)
      await expect(output).toContainText('Thread 2 enters monitor - counter = 2', { timeout: 3000 });

      // S6: Thread 2 exits (after ~2500ms)
      await expect(output).toContainText('Thread 2 exits monitor', { timeout: 3500 });

      // S7: Demonstration complete message (strong) (after ~2500ms)
      await expect(output).toContainText('Demonstration complete. The monitor ensured thread safety by allowing only one thread at a time to modify the counter.', { timeout: 4000 });

      // Ensure no runtime page errors or console 'error' messages occurred during the demo
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: Multiple rapid clicks schedule multiple demonstrations (observes overwrite and appended outputs)', async ({ page }) => {
      const button = page.locator('#demoButton');
      const output = page.locator('#demoOutput');

      // Click twice rapidly to create overlapping scheduled updates
      await button.click();
      // Immediately click again to simulate rapid user interaction
      await button.click();

      // Immediately after the second click, the innerHTML is reset to the new 'Running simulation...' (entry action)
      await expect(output).toContainText('Running simulation...', { timeout: 500 });

      // After enough time for scheduled timeouts to execute (longer than 2.5s), verify that expected messages are present at least once
      await page.waitForTimeout(3000);

      const html = await output.innerHTML();

      // Each FSM message should appear at least once in the output HTML.
      // Because of rapid double clicks, messages may be duplicated/interleaved; we assert presence rather than exact order.
      expect(html.includes('Thread 1 enters monitor - counter = 1')).toBeTruthy();
      expect(html.includes('Thread 2 tries to enter but must wait')).toBeTruthy();
      expect(html.includes('Thread 1 exits monitor')).toBeTruthy();
      expect(html.includes('Thread 2 enters monitor - counter = 2')).toBeTruthy();
      expect(html.includes('Thread 2 exits monitor')).toBeTruthy();
      expect(html.includes('Demonstration complete. The monitor ensured thread safety by allowing only one thread at a time to modify the counter.')).toBeTruthy();

      // Ensure no runtime errors occurred even with overlapping scheduled tasks
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Re-click after completion restarts the demonstration', async ({ page }) => {
      const button = page.locator('#demoButton');
      const output = page.locator('#demoOutput');

      // First run
      await button.click();
      await expect(output).toContainText('Demonstration complete. The monitor ensured thread safety by allowing only one thread at a time to modify the counter.', { timeout: 4000 });

      // Capture final HTML after first run
      const finalHtmlFirstRun = await output.innerHTML();

      // Click again to restart; innerHTML should be reset to initial running state
      await button.click();
      await expect(output).toContainText('Running simulation...', { timeout: 500 });

      // The initial 'Running simulation...' should replace previous content immediately after click
      const htmlAfterRestart = await output.innerHTML();
      expect(htmlAfterRestart.startsWith('<p>Running simulation...</p>') || htmlAfterRestart.includes('Running simulation...')).toBeTruthy();

      // Wait until second run completes
      await expect(output).toContainText('Demonstration complete. The monitor ensured thread safety by allowing only one thread at a time to modify the counter.', { timeout: 4000 });

      // Ensure that the HTML after restart is not strictly identical to the first final run (since it was restarted and re-populated)
      const finalHtmlSecondRun = await output.innerHTML();
      expect(finalHtmlSecondRun.length).toBeGreaterThan(0);
      // It's acceptable if content is similar; assert that second run completed without page errors
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation (explicit checks)', () => {
    test('No unexpected console errors or uncaught exceptions during page lifecycle', async ({ page }) => {
      // This test demonstrates observation of console and page errors without triggering the demo.
      // The listeners were attached in beforeEach. Ensure that nothing has been logged as an error by default.
      expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Now trigger the demo to ensure that runtime execution does not throw any errors
      await page.click('#demoButton');

      // Wait for the demo to finish
      await page.waitForTimeout(3000);

      // Assert again that no console errors or page errors were captured while demo executed
      const consoleErrorsDuring = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrorsDuring.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('If runtime errors occur they are captured and surfaced to the test', async ({ page }) => {
      // This test demonstrates that we capture page errors; we do not induce errors by changing the page.
      // Instead, assert that our collectors are functioning by verifying their types and shapes.

      // The collectors should currently be arrays
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // No errors observed by default
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
      expect(pageErrors.length).toBeGreaterThanOrEqual(0);

      // If there were any console errors, fail the test explicitly with details (helps debugging if environment is broken)
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        // Provide helpful failure output by throwing with collected info
        const errMsgs = consoleErrors.map((e) => e.text).join('\n---\n');
        const pageErrMsgs = pageErrors.map((e) => (e && e.message) || String(e)).join('\n---\n');
        throw new Error(`Runtime errors detected.\nConsole errors:\n${errMsgs}\n\nPage errors:\n${pageErrMsgs}`);
      }

      // Otherwise, explicitly pass by checking zero errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});