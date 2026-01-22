import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6aff7171-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe('Deque Visualization (Application ID: 6aff7171-d5c3-11f0-b41f-b131cbd11f51)', () => {
  // Helper to navigate and capture console/page errors produced while loading the page.
  async function gotoAndCaptureErrors(page) {
    const errors = [];
    const consoleListener = (msg) => {
      try {
        if (msg.type && msg.type() === 'error') {
          errors.push(msg.text());
        }
      } catch {
        // ignore
      }
    };
    const pageErrorListener = (err) => {
      try {
        errors.push(err.message || String(err));
      } catch {
        // ignore
      }
    };

    page.on('console', consoleListener);
    page.on('pageerror', pageErrorListener);

    // Load the page and give it a moment to emit console/page errors.
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait briefly to ensure any runtime/parse errors are captured.
    await page.waitForTimeout(500);

    // Remove listeners to avoid leaking between tests.
    page.removeListener('console', consoleListener);
    page.removeListener('pageerror', pageErrorListener);

    return errors;
  }

  test.describe('Static DOM and script error detection', () => {
    test('should load the page and report a syntax/runtime error from the script', async ({ page }) => {
      // Capture console and page errors emitted during load.
      const errors = await gotoAndCaptureErrors(page);

      // We expect there to be at least one error because the provided script is truncated.
      expect(errors.length).toBeGreaterThan(0);

      // At least one captured error should indicate a SyntaxError or unexpected end of input.
      const hasSyntax = errors.some(e =>
        /syntax/i.test(e) ||
        /unexpected end/i.test(e) ||
        /unexpected token/i.test(e)
      );

      expect(hasSyntax).toBeTruthy();
    });

    test('initial visual state S0_Empty is present in the DOM (static fallback)', async ({ page }) => {
      // Even if JS fails, the static HTML includes the empty deque message.
      await page.goto(APP_URL, { waitUntil: 'load' });

      const dequeEmptyLocator = page.locator('#deque .deque-empty');
      await expect(dequeEmptyLocator).toHaveCount(1);

      // Verify the message text matches the expected empty-state evidence.
      await expect(dequeEmptyLocator).toHaveText('Deque is empty. Add elements using the controls below.');
    });

    test('all expected controls and inputs are present in the DOM', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Buttons
      const selectors = [
        '#addFront',
        '#addBack',
        '#removeFront',
        '#removeBack',
        '#clearDeque',
        '#randomDeque',
        '#checkEmpty',
        '#frontValue',
        '#backValue',
        '#log'
      ];

      for (const sel of selectors) {
        const loc = page.locator(sel);
        await expect(loc).toHaveCount(1);
      }

      // Check visible labels to ensure correct buttons are present
      await expect(page.locator('#addFront')).toHaveText('Add to Front');
      await expect(page.locator('#addBack')).toHaveText('Add to Back');
      await expect(page.locator('#removeFront')).toHaveText('Remove from Front');
      await expect(page.locator('#removeBack')).toHaveText('Remove from Back');
    });
  });

  test.describe('FSM transitions and interactions (observing effects or lack thereof due to script error)', () => {
    test('clicking Add to Front should NOT update visualization or log because script likely failed to execute', async ({ page }) => {
      // Capture errors while loading
      const errors = await gotoAndCaptureErrors(page);

      // Ensure page loaded static DOM
      const dequeEmpty = page.locator('#deque .deque-empty');
      await expect(dequeEmpty).toHaveCount(1);

      // Fill front input and click Add to Front
      await page.fill('#frontValue', 'X-front');
      await page.click('#addFront');

      // Because the inline script is syntactically broken, event handlers likely didn't attach.
      // Verify that visualization did not change (no .deque-element children).
      const dequeElements = page.locator('#deque .deque-element');
      await expect(dequeElements).toHaveCount(0);

      // Verify that the operation log did not receive an entry.
      const logEntries = page.locator('#log > div');
      await expect(logEntries).toHaveCount(0);

      // Because the script did not run, the input value should remain unchanged (no code cleared it).
      const frontValue = await page.inputValue('#frontValue');
      expect(frontValue).toBe('X-front');

      // Confirm that an error indicating a syntax problem was captured.
      const hasSyntax = errors.some(e => /syntax/i.test(e) || /unexpected end/i.test(e) || /unexpected token/i.test(e));
      expect(hasSyntax).toBeTruthy();
    });

    test('clicking Add to Back should NOT update visualization or log due to broken script', async ({ page }) => {
      await gotoAndCaptureErrors(page);

      // Fill back input and click Add to Back
      await page.fill('#backValue', 'Y-back');
      await page.click('#addBack');

      // Visualization unchanged: no deque-element found
      await expect(page.locator('#deque .deque-element')).toHaveCount(0);

      // Log remains empty
      await expect(page.locator('#log > div')).toHaveCount(0);

      // Input retains value
      const backValue = await page.inputValue('#backValue');
      expect(backValue).toBe('Y-back');
    });

    test('attempting Remove from Front/Back on empty deque should not produce logs or throw from UI (script not running)', async ({ page }) => {
      const errors = await gotoAndCaptureErrors(page);

      // Ensure starting empty state
      await expect(page.locator('#deque .deque-empty')).toHaveCount(1);

      // Click remove buttons
      await page.click('#removeFront');
      await page.click('#removeBack');

      // No log entries should be present since handlers didn't run
      await expect(page.locator('#log > div')).toHaveCount(0);

      // Still no deque elements
      await expect(page.locator('#deque .deque-element')).toHaveCount(0);

      // Confirm syntax error presence as cause
      const hasSyntax = errors.some(e => /syntax/i.test(e) || /unexpected end/i.test(e));
      expect(hasSyntax).toBeTruthy();
    });

    test('Clear Deque and Generate Random Deque buttons are inert when script parsing failed', async ({ page }) => {
      await gotoAndCaptureErrors(page);

      // Click clear and random buttons
      await page.click('#clearDeque');
      await page.click('#randomDeque');

      // No change in visualization: still only static empty message
      await expect(page.locator('#deque .deque-empty')).toHaveCount(1);
      await expect(page.locator('#deque .deque-element')).toHaveCount(0);

      // No log entries
      await expect(page.locator('#log > div')).toHaveCount(0);
    });

    test('Check if Empty button should be present but clicking it does nothing when script is broken', async ({ page }) => {
      await gotoAndCaptureErrors(page);

      // Click the checkEmpty button
      await page.click('#checkEmpty');

      // Because JS didn't attach the final listener (and likely the whole script failed),
      // there should be no new log entries and the static empty message remains.
      await expect(page.locator('#log > div')).toHaveCount(0);
      await expect(page.locator('#deque .deque-empty')).toHaveCount(1);
    });
  });

  test.describe('Edge cases and resilience checks', () => {
    test('page still serves static content even if interactive behaviors are broken', async ({ page }) => {
      await gotoAndCaptureErrors(page);

      // Static header and description should be visible
      await expect(page.locator('header h1')).toHaveText('Understanding Deque');
      await expect(page.locator('.description')).toContainText('deque');

      // Tabs and other static content should be present and accessible
      await expect(page.locator('.tabs .tab')).toHaveCount(3);
      await expect(page.locator('#explanation')).toBeVisible();
      await expect(page.locator('#operations')).not.toBeVisible();
    });

    test('document does not unexpectedly modify static DOM nodes when script errors occur', async ({ page }) => {
      await gotoAndCaptureErrors(page);

      // Snapshot some counts to ensure nothing else mutated the DOM unexpectedly
      const tabCount = await page.locator('.tabs .tab').count();
      const controlGroupCount = await page.locator('.control-group').count();
      const operationLogExists = await page.locator('.operation-log').count();

      expect(tabCount).toBe(3);
      expect(controlGroupCount).toBeGreaterThanOrEqual(3);
      expect(operationLogExists).toBe(1);
    });
  });

  test.describe('Diagnostic test to capture and assert the exact syntax error text (if available)', () => {
    test('captures the specific syntax error message containing "Unexpected end" or "SyntaxError"', async ({ page }) => {
      const errors = await gotoAndCaptureErrors(page);

      // Look for familiar phrases
      const matched = errors.find(e =>
        /unexpected end/i.test(e) ||
        /syntax/i.test(e) ||
        /unterminated/i.test(e) ||
        /unexpected token/i.test(e)
      );

      // It's acceptable if message text varies across engines, but we must assert at least one matches.
      expect(Boolean(matched)).toBeTruthy();
    });
  });
});