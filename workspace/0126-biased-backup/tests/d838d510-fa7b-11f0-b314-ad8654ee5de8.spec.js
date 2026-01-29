import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d838d510-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('TCP/IP Demo FSM tests (Application d838d510-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Shared variables to collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  // Setup: navigate to the page fresh before each test and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (including errors)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the application page as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: assert no unexpected runtime errors happened during a test
  test.afterEach(async ({ page }) => {
    // Emit helpful debug information in case of failures (Playwright will show console on failure)
    if (pageErrors.length > 0 || consoleMessages.some(m => m.type === 'error')) {
      // If there are page errors or console errors, fail the test with diagnostics
      const consoleErrs = consoleMessages.filter(m => m.type === 'error').map(m => m.text).join('\n---\n');
      const pageErrs = pageErrors.map(e => String(e)).join('\n---\n');
      // Use an explicit expectation to fail with useful message if any errors occurred
      expect(consoleErrs + pageErrs).toBe('', { // will cause test to fail if non-empty
        // message content comes from the concatenated strings above
      });
    } else {
      // Otherwise, assert explicitly that there were no page errors or console errors
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
      expect(pageErrors.length).toBe(0);
    }
  });

  test.describe('State S0_Idle (Initial page state)', () => {
    test('renders expected interactive components and static content (Idle state)', async ({ page }) => {
      // Validate that the initial "Idle" state (S0_Idle) is represented by the DOM:
      // - demo button present, enabled, has expected aria-controls
      // - demo output region exists with initial instructional text and aria-live polite
      const demoBtn = page.locator('button#demoBtn');
      const demoOut = page.locator('#demoOutput');

      // Button should be visible and enabled in idle state
      await expect(demoBtn).toBeVisible();
      await expect(demoBtn).toBeEnabled();

      // Check button text content matches expected label from FSM/components
      await expect(demoBtn).toHaveText('Run TCP Handshake & Slow Start Demo');

      // Button should declare it controls demoOutput
      await expect(demoBtn).toHaveAttribute('aria-controls', 'demoOutput');

      // Demo output region should be present and contain the initial placeholder text
      await expect(demoOut).toBeVisible();
      await expect(demoOut).toHaveAttribute('aria-live', 'polite');

      const initialText = await demoOut.textContent();
      expect(initialText).toContain('Press the button to begin the demonstration');
      expect(initialText.length).toBeGreaterThan(10); // sanity check that it's not empty

      // There should be no console errors or page errors immediately after load
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ButtonClick -> S1_DemoRunning (Demo execution)', () => {
    test('clicking demo button transitions to Demo Running and appends output progressively', async ({ page }) => {
      const demoBtn = page.locator('button#demoBtn');
      const demoOut = page.locator('#demoOutput');

      // Capture initial content for later comparison
      const beforeClickText = await demoOut.textContent();

      // Click the button to trigger runDemo (transition S0_Idle -> S1_DemoRunning)
      await demoBtn.click();

      // Immediately after click, the script disables the button and clears output
      await expect(demoBtn).toBeDisabled();

      // The runDemo function clears out the output immediately; assert that it no longer contains the initial placeholder
      await expect(demoOut).not.toContainText('Press the button to begin the demonstration');

      // Verify the first header line of the demo appears within a reasonable timeout
      // This confirms that runDemo() started and appended output
      await expect(demoOut).toContainText('=== TCP Three-Way Handshake (textual) ===', { timeout: 5000 });

      // Verify that output continues to grow over time (progressive append behavior)
      // Record length at two intervals and assert growth
      const snapshot1 = await demoOut.textContent();
      // Wait a small amount of time to allow more lines to be appended
      await page.waitForTimeout(800);
      const snapshot2 = await demoOut.textContent();
      expect(snapshot2.length).toBeGreaterThanOrEqual(snapshot1.length);

      // Wait for some later content indicating slow start progression (Round-Trip 4 -> cwnd = 8 MSS)
      await expect(demoOut).toContainText('Round-Trip 4', { timeout: 15000 });
      await expect(demoOut).toContainText('cwnd = 8 MSS', { timeout: 15000 });

      // Wait until the demo completes (final appended "Demo complete.")
      await expect(demoOut).toContainText('Demo complete.', { timeout: 30000 });

      // Ensure the demo output contains multiple distinct sections from the run (handshake and slow start)
      const finalText = await demoOut.textContent();
      expect(finalText).toContain('Client -> Server: [SYN]');
      expect(finalText).toContain('=== TCP Slow Start (illustrative) ===');

      // The button is intentionally left disabled at the end of the demo per implementation
      await expect(demoBtn).toBeDisabled();

      // No console errors or uncaught exceptions should have occurred while running the demo
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
      expect(pageErrors.length).toBe(0);
    });

    test('attempting to click the disabled demo button after run does not start a second run or produce errors', async ({ page }) => {
      const demoBtn = page.locator('button#demoBtn');
      const demoOut = page.locator('#demoOutput');

      // First click to run the demo
      await demoBtn.click();

      // Wait for initial parts to appear to ensure run started
      await expect(demoOut).toContainText('=== TCP Three-Way Handshake (textual) ===', { timeout: 5000 });

      // Wait for demo to complete
      await expect(demoOut).toContainText('Demo complete.', { timeout: 30000 });

      // Count occurrences of the completion marker
      const content = await demoOut.textContent();
      const completionMatches = (content.match(/Demo complete\./g) || []).length;
      expect(completionMatches).toBe(1);

      // Attempt to click the disabled button (should be ignored by the page)
      // Playwright will still attempt the action, but the page's button is disabled, so no handler should execute
      await demoBtn.click({ timeout: 1000 }).catch(() => {
        // Some browsers may reject clicking disabled elements; ignore that exception here.
        // We will rely on content checks and console/page errors to assert behavior.
      });

      // Wait briefly and assert content hasn't gained an extra "Demo complete." marker
      await page.waitForTimeout(600);
      const contentAfterSecondClick = await demoOut.textContent();
      const completionMatchesAfter = (contentAfterSecondClick.match(/Demo complete\./g) || []).length;
      expect(completionMatchesAfter).toBe(1);

      // No console errors or page errors should have been produced by the second click attempt
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM and accessibility related validations', () => {
    test('demo output region is accessible and updates are announced (aria attributes)', async ({ page }) => {
      const demoBtn = page.locator('button#demoBtn');
      const demoOut = page.locator('#demoOutput');

      // Ensure initial aria attributes are present
      await expect(demoOut).toHaveAttribute('aria-live', 'polite');
      await expect(demoBtn).toHaveAttribute('aria-controls', 'demoOutput');

      // Run the demo and verify aria-live continues to be present during updates
      await demoBtn.click();
      await expect(demoOut).toContainText('=== TCP Three-Way Handshake (textual) ===', { timeout: 5000 });
      await expect(demoOut).toHaveAttribute('aria-live', 'polite');

      // No accessibility-related console errors (sanity)
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
      expect(pageErrors.length).toBe(0);
    });

    test('verifies the page represents the S0_Idle entry action by rendering expected static content', async ({ page }) => {
      // The FSM mentions an entry action renderPage() for S0_Idle; while the function is not defined globally,
      // the visible DOM after load should reflect that the page was "rendered".
      // Validate presence of key headings and sections to assert the page rendered correctly.
      const heading = page.locator('h1');
      await expect(heading).toHaveText(/TCP\/IP — A Comprehensive Educational Guide/);

      // A few representative sections that should be present after "renderPage"
      await expect(page.locator('h2#overview')).toBeVisible();
      await expect(page.locator('h2#demo')).toBeVisible();

      // Confirm the demo-area region exists and contains the button and output container
      await expect(page.locator('.demo-area [role="region"]')).toContainText('Demo area');
      await expect(page.locator('button#demoBtn')).toBeVisible();
      await expect(page.locator('#demoOutput')).toBeVisible();

      // No runtime errors
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases & resilience', () => {
    test('page remains stable when user does not interact (no spontaneous errors or changes)', async ({ page }) => {
      const demoOut = page.locator('#demoOutput');

      // Snapshot the content and wait; ensure nothing changes without interaction
      const snapshot = await demoOut.textContent();
      await page.waitForTimeout(1200);
      const snapshotAfter = await demoOut.textContent();
      expect(snapshotAfter).toBe(snapshot);

      // No console errors or page errors during idle period
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
      expect(pageErrors.length).toBe(0);
    });

    test('rapid repeated clicks before the first click is processed do not cause multiple demos or uncaught exceptions', async ({ page }) => {
      const demoBtn = page.locator('button#demoBtn');
      const demoOut = page.locator('#demoOutput');

      // Rapidly click multiple times in quick succession
      // Since runDemo disables the button at start, only the first click should take effect.
      await Promise.all([
        demoBtn.click().catch(() => {}),
        demoBtn.click().catch(() => {}),
        demoBtn.click().catch(() => {})
      ]);

      // Confirm the demo started and only one run completes
      await expect(demoOut).toContainText('=== TCP Three-Way Handshake (textual) ===', { timeout: 5000 });
      await expect(demoOut).toContainText('Demo complete.', { timeout: 30000 });

      const content = await demoOut.textContent();
      const completionMatches = (content.match(/Demo complete\./g) || []).length;
      expect(completionMatches).toBe(1);

      // No runtime errors
      expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
      expect(pageErrors.length).toBe(0);
    });
  });
});