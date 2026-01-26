import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8377581-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Amortized Analysis demo (FSM validation) - d8377581-fa7b-11f0-b314-ad8654ee5de8', () => {
  let consoleMessages;
  let pageErrors;

  // Setup listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warning, error, etc.)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If reading message fails for some reason, still capture a placeholder
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the app exactly as provided
    await page.goto(APP_URL);
  });

  // Teardown assertions: ensure no uncaught page errors and no console.error calls occurred
  test.afterEach(async () => {
    // Assert there were no uncaught page errors
    expect(pageErrors.length, `Expected no uncaught page errors, got: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);

    // Assert there were no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages, got: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('State S0_Idle (initialization and reset behavior)', () => {
    test('Initial page load should be in Idle (S0_Idle): resetDemo executed and UI shows idle state', async ({ page }) => {
      // Elements
      const btn = page.locator('#demoBtn');
      const status = page.locator('#demoStatus');
      const output = page.locator('#demoOutput');
      const log = page.locator('#demoLog');

      // Button initial text and aria-pressed
      await expect(btn).toHaveText('Show dynamic-array demonstration');
      await expect(btn).toHaveAttribute('aria-pressed', 'false');

      // Status text should indicate idle as per FSM evidence
      await expect(status).toHaveText('Demo is idle. Click to run 12 append operations.');

      // Output should be hidden (display:none)
      const display = await output.evaluate(el => window.getComputedStyle(el).display);
      expect(display).toBe('none');

      // Log should be empty on idle
      const logText = await log.evaluate(el => el.textContent || '');
      expect(logText.trim()).toBe('');

      // No console errors or page errors should have occurred during initialization (checked in afterEach)
    });
  });

  test.describe('Transitions and runtime behavior (S0 -> S1 -> S2 and resets)', () => {
    test('Clicking the button starts the demo (S0_Idle -> S1_Running): UI shows running state and begins logging', async ({ page }) => {
      const btn = page.locator('#demoBtn');
      const status = page.locator('#demoStatus');
      const output = page.locator('#demoOutput');
      const log = page.locator('#demoLog');

      // Trigger the demo (ShowDemo event)
      await btn.click();

      // Immediately after click, button text and aria should reflect running state
      await expect(btn).toHaveText('Running... (click to reset)');
      await expect(btn).toHaveAttribute('aria-pressed', 'true');

      // Output should be visible (block)
      await expect.soft(async () => {
        const display = await output.evaluate(el => window.getComputedStyle(el).display);
        expect(display).toBe('block');
      }).not.toThrow();

      // Status should indicate running per FSM evidence
      await expect(status).toHaveText('Demo running: illustrating 12 appends (doubling on full).');

      // The textual log should start to get entries. Wait up to 6s for the first entry (animation interval ~540ms)
      await page.waitForFunction(() => {
        const lg = document.getElementById('demoLog');
        return lg && (lg.textContent || '').includes('Op 1:');
      }, null, { timeout: 7000 });

      // Confirm that the log now contains at least one operation line
      const logContent = await log.evaluate(el => el.textContent || '');
      expect(logContent).toContain('Op 1: append');

      // No uncaught exceptions should have occurred so far (checked in afterEach)
    });

    test('Demo completes and transitions to Finished (S1_Running -> S2_Finished): final status and summary are shown', async ({ page }) => {
      const btn = page.locator('#demoBtn');
      const status = page.locator('#demoStatus');
      const output = page.locator('#demoOutput');
      const log = page.locator('#demoLog');

      // Start the demo
      await btn.click();

      // Wait for the demo to finish. The demo animates 12 steps at ~540ms each -> allow generous timeout
      await page.waitForFunction(() => {
        const st = document.getElementById('demoStatus');
        return st && (st.textContent || '').startsWith('Demo finished:');
      }, null, { timeout: 20000 });

      // After completion, button text resets to initial label and aria-pressed false
      await expect(btn).toHaveText('Show dynamic-array demonstration');
      await expect(btn).toHaveAttribute('aria-pressed', 'false');

      // Status should include the number of appends and total/amortized cost as per FSM evidence
      const statusText = await status.evaluate(el => el.textContent || '');
      expect(statusText).toMatch(/Demo finished:\s*12 appends\./);
      expect(statusText).toMatch(/Total cost = \d+/);
      expect(statusText).toMatch(/Amortized cost per append = \d+\.\d{3}/);

      // Output should remain visible (the demo output area is shown while finished)
      const display = await output.evaluate(el => window.getComputedStyle(el).display);
      expect(display).toBe('block');

      // The log should contain the final operation line (Op 12)
      const logText = await log.evaluate(el => el.textContent || '');
      expect(logText).toContain('Op 12:');

      // No uncaught exceptions or console errors (checked in afterEach)
    });

    test('Clicking the button while running resets immediately to Idle (S1_Running -> S0_Idle)', async ({ page }) => {
      const btn = page.locator('#demoBtn');
      const status = page.locator('#demoStatus');
      const output = page.locator('#demoOutput');
      const log = page.locator('#demoLog');

      // Start demo
      await btn.click();

      // Wait a short moment to allow running state to initialize
      await page.waitForFunction(() => {
        const st = document.getElementById('demoStatus');
        return st && (st.textContent || '').includes('Demo running:');
      }, null, { timeout: 5000 });

      // Click again while running - according to implementation this should reset
      await btn.click();

      // After reset, UI should show idle state
      await expect(status).toHaveText('Demo is idle. Click to run 12 append operations.');
      await expect(btn).toHaveText('Show dynamic-array demonstration');
      await expect(btn).toHaveAttribute('aria-pressed', 'false');

      // Output should be hidden and log cleared
      const display = await output.evaluate(el => window.getComputedStyle(el).display);
      expect(display).toBe('none');
      const logText = await log.evaluate(el => el.textContent || '');
      expect(logText.trim()).toBe('');

      // No uncaught errors should have occurred (checked in afterEach)
    });

    test('Rapid multiple clicks do not cause JS errors and result in a stable state (edge-case interaction)', async ({ page }) => {
      const btn = page.locator('#demoBtn');
      const status = page.locator('#demoStatus');
      const output = page.locator('#demoOutput');

      // Rapid clicks: start, then immediately click several times
      await btn.click();
      // Immediately click a few times to test event handling robustness
      await btn.click();
      await btn.click();
      await btn.click();

      // Final expected state after these rapid clicks is Idle because a subsequent click while running triggers reset
      // Wait briefly for the handler to settle
      await page.waitForTimeout(500);

      // Check we have a consistent idle state
      await expect(status).toHaveText('Demo is idle. Click to run 12 append operations.');
      await expect(btn).toHaveText('Show dynamic-array demonstration');
      const display = await output.evaluate(el => window.getComputedStyle(el).display);
      expect(display).toBe('none');

      // Confirm there were no console.error messages or uncaught page errors (checked in afterEach)
    });
  });

  test.describe('FSM invariants and additional checks', () => {
    test('Reset on initialization is idempotent and safe to call multiple times', async ({ page }) => {
      const btn = page.locator('#demoBtn');
      const status = page.locator('#demoStatus');
      const output = page.locator('#demoOutput');

      // Call reset indirectly by clicking start then reset twice quickly to ensure idempotence
      await btn.click();           // start
      await page.waitForTimeout(200);
      await btn.click();           // reset
      await page.waitForTimeout(100);
      await btn.click();           // start again
      await page.waitForTimeout(200);
      await btn.click();           // reset again

      // Final should be idle
      await expect(status).toHaveText('Demo is idle. Click to run 12 append operations.');
      const display = await output.evaluate(el => window.getComputedStyle(el).display);
      expect(display).toBe('none');

      // No uncaught exceptions (checked in afterEach)
    });

    test('Full run produces expected cumulative total cost consistent with textual log', async ({ page }) => {
      const btn = page.locator('#demoBtn');
      const status = page.locator('#demoStatus');
      const log = page.locator('#demoLog');

      // Start the demo and wait for finish
      await btn.click();
      await page.waitForFunction(() => {
        const st = document.getElementById('demoStatus');
        return st && (st.textContent || '').startsWith('Demo finished:');
      }, null, { timeout: 20000 });

      // Extract total cost number from status text
      const statusText = await status.evaluate(el => el.textContent || '');
      const totalCostMatch = statusText.match(/Total cost = (\d+)/);
      expect(totalCostMatch, 'Status should contain "Total cost = <number>"').not.toBeNull();
      const totalCost = Number(totalCostMatch[1]);

      // Estimate cumulative cost from the final line of the log: the last appearance of "cumulative cost = N"
      const logText = await log.evaluate(el => el.textContent || '');
      const matches = Array.from(logText.matchAll(/cumulative cost = (\d+)/g));
      expect(matches.length, 'Expected multiple cumulative cost entries in the log').toBeGreaterThanOrEqual(1);
      const lastCumulative = Number(matches[matches.length - 1][1]);

      // The total cost in status should match the last cumulative cost from the log
      expect(totalCost).toBe(lastCumulative);

      // Also check amortized cost per append is computed as total/12
      const amortizedMatch = statusText.match(/Amortized cost per append = ([0-9]+\.[0-9]{3})/);
      expect(amortizedMatch).not.toBeNull();
      const amortized = Number(amortizedMatch[1]);
      expect(amortized).toBeCloseTo(totalCost / 12, 3);

      // No uncaught exceptions (checked in afterEach)
    });
  });
});