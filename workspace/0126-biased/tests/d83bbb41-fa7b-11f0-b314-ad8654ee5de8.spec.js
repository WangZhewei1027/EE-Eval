import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83bbb41-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('d83bbb41-fa7b-11f0-b314-ad8654ee5de8 — FSM: Hash demo interactive', () => {
  // Common arrays to record console errors and page errors for each test.
  let consoleErrors;
  let pageErrors;

  // Helper to attach listeners per test instance.
  async function attachErrorListeners(page) {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      // record console messages that are errors
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      // uncaught exceptions on the page
      pageErrors.push(err.message || String(err));
    });
  }

  test.beforeEach(async ({ page }) => {
    await attachErrorListeners(page);
    // Load the page exactly as provided.
    await page.goto(APP_URL);
    // Ensure initial HTML is fully loaded
    await expect(page).toHaveTitle(/Hash Functions — Comprehensive Explanation/);
  });

  test.afterEach(async () => {
    // After each test, assert there were no console or page errors.
    // This validates the page executed without uncaught exceptions.
    expect(consoleErrors, 'No console error messages should be emitted').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
  });

  test.describe('Initial Idle state (S0_Idle)', () => {
    test('S0: Button and demo log render correctly (Idle state entry)', async ({ page }) => {
      // Validate the Run toy hash demo button exists with correct attributes and content.
      const btn = page.locator('#runDemo');
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText('Run toy hash demo');
      // Button should be enabled in idle state.
      await expect(btn).toBeEnabled();
      // aria-controls should reference demoLog
      await expect(btn).toHaveAttribute('aria-controls', 'demoLog');

      // Validate demo log initial content and aria-live attribute.
      const log = page.locator('#demoLog');
      await expect(log).toBeVisible();
      await expect(log).toHaveAttribute('aria-live', 'polite');
      await expect(log).toHaveText('Press the button to run the demonstration.');

      // No runtime errors should have occurred on load.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transitions: Run demo (S0 -> S1 -> S2)', () => {
    test('S0 -> S1: Clicking the button enters Running state (button disabled, text changes)', async ({ page }) => {
      const btn = page.locator('#runDemo');

      // Click the button to start the demo.
      await btn.click();

      // The entry actions should be applied synchronously:
      // btn.disabled = true and btn.textContent = 'Running...'
      await expect(btn).toBeDisabled();
      await expect(btn).toHaveText('Running...');

      // During the running period, the demo log should still contain the old text
      // until the asynchronous task completes. We assert it hasn't yet been overwritten
      // immediately after the click (very small timeout).
      const logText = await page.locator('#demoLog').textContent();
      // Either still the initial message or already processing; it must not contain the final header yet.
      expect(logText.includes('Toy hash demonstration for message:'), 'Log should not yet contain final demo content immediately after click').toBe(false);
    });

    test('S1 -> S2: Demo completes, log updated, and button returns to Idle (exit actions)', async ({ page }) => {
      const btn = page.locator('#runDemo');
      const log = page.locator('#demoLog');

      // Start the demo run.
      await btn.click();

      // Wait for the asynchronous demo to complete and update the log.
      // The page uses a setTimeout of 120ms before writing the log, so allow a generous timeout.
      await page.waitForFunction(() => {
        const el = document.getElementById('demoLog');
        return el && el.textContent && el.textContent.startsWith('Toy hash demonstration for message:');
      }, null, { timeout: 2000 });

      // After completion, the log should start with the expected header referencing the fixed message.
      const fullLog = await log.textContent();
      expect(fullLog).toBeTruthy();
      expect(fullLog).toContain('Toy hash demonstration for message: "Hello, world!"');

      // Validate that finalization and digest lines are present in the output.
      expect(fullLog).toContain('Final digest (128-bit hex):');

      // Extract the digest hex string from the log and validate format (32 hex chars => 128-bit).
      const digestMatch = fullLog.match(/Final digest \(128-bit hex\):\s*\n?([0-9a-fA-F]{32})/);
      expect(digestMatch, 'Digest line should include a 32-character hex string').not.toBeNull();
      const digestHex = digestMatch ? digestMatch[1] : null;
      expect(digestHex).toMatch(/^[0-9a-fA-F]{32}$/);

      // The exit actions should re-enable the button and reset its text.
      await expect(btn).toBeEnabled();
      await expect(btn).toHaveText('Run toy hash demo');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Clicking while running is not allowed (element disabled prevents a second interactive click)', async ({ page }) => {
      const btnSelector = '#runDemo';
      // Start the demo
      await page.click(btnSelector);

      // Immediately attempt to click again — Playwright should complain that the element is not actionable
      // because it is disabled. We assert that an error is thrown when trying to perform a second interactive click.
      let clickError = null;
      try {
        // Use a short timeout so the attempt fails fast if it is not actionable.
        await page.click(btnSelector, { timeout: 150 });
      } catch (e) {
        clickError = e;
      }
      expect(clickError, 'Attempting to perform a second click while the button is disabled should fail').not.toBeNull();
      // The message should indicate the element is not enabled/disabled (case-insensitive check).
      expect(String(clickError.message).toLowerCase()).toMatch(/disabled|not enabled|not actionable/);

      // Wait for original demo to finish to keep page state stable for teardown.
      await page.waitForFunction(() => {
        const el = document.getElementById('demoLog');
        return el && el.textContent && el.textContent.startsWith('Toy hash demonstration for message:');
      }, null, { timeout: 2000 });
    });

    test('Consecutive runs produce consistent digest output for the same fixed message', async ({ page }) => {
      const btn = page.locator('#runDemo');
      const log = page.locator('#demoLog');

      // First run
      await btn.click();
      await page.waitForFunction(() => {
        const el = document.getElementById('demoLog');
        return el && el.textContent && el.textContent.includes('Final digest (128-bit hex):');
      }, null, { timeout: 2000 });

      const firstLog = await log.textContent();
      const firstDigestMatch = firstLog.match(/Final digest \(128-bit hex\):\s*\n?([0-9a-fA-F]{32})/);
      expect(firstDigestMatch).not.toBeNull();
      const firstDigest = firstDigestMatch[1];

      // Second run (after the button has been reset)
      await btn.click();
      await page.waitForFunction(() => {
        const el = document.getElementById('demoLog');
        return el && el.textContent && el.textContent.includes('Final digest (128-bit hex):');
      }, null, { timeout: 2000 });

      const secondLog = await log.textContent();
      const secondDigestMatch = secondLog.match(/Final digest \(128-bit hex\):\s*\n?([0-9a-fA-F]{32})/);
      expect(secondDigestMatch).not.toBeNull();
      const secondDigest = secondDigestMatch[1];

      // For the deterministic fixed message "Hello, world!", both digests must match.
      expect(secondDigest).toBe(firstDigest);
    });

    test('Accessibility-related DOM attributes exist (aria-live & aria-controls)', async ({ page }) => {
      // Validate that demo log is announced region and the button points to it.
      const log = page.locator('#demoLog');
      const btn = page.locator('#runDemo');

      await expect(log).toHaveAttribute('aria-live', 'polite');
      await expect(btn).toHaveAttribute('aria-controls', 'demoLog');
    });
  });

  // Extra test to explicitly observe console/page errors during a run and assert none occurred.
  test('No runtime TypeError/ReferenceError/SyntaxError should occur during the demo run', async ({ page }) => {
    const btn = page.locator('#runDemo');

    // Perform a full demo run.
    await btn.click();
    await page.waitForFunction(() => {
      const el = document.getElementById('demoLog');
      return el && el.textContent && el.textContent.includes('Final digest (128-bit hex):');
    }, null, { timeout: 2000 });

    // At this point, ensure no page errors or console errors have been recorded.
    expect(consoleErrors.length, 'No console.error calls during demo run').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors during demo run').toBe(0);
  });
});