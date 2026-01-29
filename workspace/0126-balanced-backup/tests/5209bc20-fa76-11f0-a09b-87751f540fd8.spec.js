import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209bc20-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Greedy Algorithm Demo (Application ID: 5209bc20-fa76-11f0-a09b-87751f540fd8)', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // Collect text of console messages for inspection in tests
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If msg.text() throws, store a fallback
        consoleMessages.push({ type: msg.type(), text: String(msg) });
      }
    });

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate and wait for load event to ensure initial scripts run
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // remove listeners to avoid cross-test leakage
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('State S0_Idle: Page renders with expected title and static content (FSM Idle state evidence)', async ({ page }) => {
    // This validates the FSM Idle state's evidence: the page title is present.
    const title = await page.title();
    expect(title).toBe('Greedy Algorithm Demo');

    // The HTML contains an empty #result element; verify it exists and is empty initially.
    const resultText = await page.locator('#result').innerText();
    expect(resultText).toBe('');

    // Verify the main heading exists and matches expectations
    const heading = await page.locator('h1').textContent();
    expect(heading).toContain('Greedy Algorithm Demo');

    // FSM indicates an entry action renderPage() but the provided implementation does not define it.
    // Assert that renderPage is not present on the window (i.e., no global function by that name).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);
  });

  test('No interactive elements or transitions exist as per FSM extraction summary', async ({ page }) => {
    // Validate there are no interactive controls (buttons, inputs, selects, textarea, role=button)
    const interactiveCount = await page.evaluate(() => {
      const selectors = ['button', 'input', 'textarea', 'select', '[role="button"]', 'a[href]'];
      return selectors.reduce((acc, sel) => acc + document.querySelectorAll(sel).length, 0);
    });
    expect(interactiveCount).toBe(0);

    // FSM contained no events or transitions; assert no event-related elements are present.
    // (Meaning the page genuinely has no user-triggered controls.)
  });

  test('Console output: coinChange initial computation logs expected value (3)', async ({ page }) => {
    // The page script runs coinChange([1,2,5],11) and logs the result. We should have captured that console.log.
    // Wait briefly to ensure console events were processed
    await page.waitForTimeout(50);

    const messagesText = consoleMessages.map(m => m.text);
    // Find a console message that includes '3' (the expected log output)
    const found = messagesText.some(t => /\b3\b/.test(t));
    expect(found).toBe(true);
  });

  test('coinChange function: returns correct results for standard cases', async ({ page }) => {
    // Call the page's coinChange function for several cases via page.evaluate

    // 1) Standard example from the page: coins [1,2,5], target 11 => expected 3
    const res1 = await page.evaluate(() => {
      // Return actual value and its typeof for clarity
      const v = coinChange([1, 2, 5], 11);
      return { value: v, type: typeof v };
    });
    expect(res1.value).toBe(3);
    expect(res1.type).toBe('number');

    // 2) No solution case: coins [2], target 3 => "No solution"
    const res2 = await page.evaluate(() => coinChange([2], 3));
    expect(res2).toBe('No solution');

    // 3) Empty coins array: coins [], target 1 => "No solution"
    const res3 = await page.evaluate(() => coinChange([], 1));
    expect(res3).toBe('No solution');

    // 4) Another DP case: coins [1,3,4], target 6 => minimal number of coins should be 2 (3+3)
    const res4 = await page.evaluate(() => coinChange([1, 3, 4], 6));
    expect(res4).toBe(2);
  });

  test('Edge cases & error scenarios for coinChange', async ({ page }) => {
    // 1) Target zero should return 0
    const zeroRes = await page.evaluate(() => coinChange([1, 2, 5], 0));
    expect(zeroRes).toBe(0);

    // 2) Negative target: examine behavior (implementation does not throw; dp[target] will be undefined)
    const negativeRes = await page.evaluate(() => coinChange([1, 2], -1));
    // Based on the provided implementation, dp[-1] is undefined, so function returns undefined.
    expect(negativeRes).toBeUndefined();

    // 3) Non-numeric target that leads to invalid array length should throw a RangeError.
    // We capture the thrown error information (name & message) by doing try/catch inside evaluate.
    const nonNumeric = await page.evaluate(() => {
      try {
        coinChange([1], 'a'); // 'a' + 1 -> 'a1' -> new Array('a1') => should throw RangeError in many engines
        return { thrown: false };
      } catch (e) {
        return { thrown: true, name: e && e.name, message: e && e.message };
      }
    });
    // Expect an exception to have been thrown; name should indicate RangeError (engine dependent)
    expect(nonNumeric.thrown).toBe(true);
    // Check that the exception name exists and is a RangeError (common V8 behavior)
    // Allow for differences, but prefer RangeError; if not RangeError still assert there is a name string.
    expect(typeof nonNumeric.name).toBe('string');
    // If it is V8, name will equal 'RangeError'
    // Do not force exact match because environment may differ, but accept RangeError or other non-empty name.
    if (nonNumeric.name) {
      expect(nonNumeric.name.length).toBeGreaterThan(0);
    }
  });

  test('No runtime page errors occurred during initial load', async ({ page }) => {
    // We captured any pageerror events during page load in pageErrors array.
    // Assert there were zero uncaught runtime errors on load.
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity check: the #result element remains unaffected by console-only script', async ({ page }) => {
    // The script logs to console but does not modify DOM; assert #result stays empty after some time.
    await page.waitForTimeout(100);
    const resultContent = await page.locator('#result').textContent();
    expect(resultContent.trim()).toBe('');
  });

  test('FSM verification: ensure there are no defined transitions or events on the page', async ({ page }) => {
    // The provided FSM lists no events or transitions. From the DOM/script perspective, assert there is no evidence of handlers.
    // Heuristic: no inline onclick attributes and no elements with "data-event" attributes
    const hasInlineHandlers = await page.evaluate(() => {
      const anyOnAttr = Array.from(document.querySelectorAll('*')).some(el => {
        return Array.from(el.attributes).some(attr => attr.name.startsWith('on'));
      });
      const anyDataEvent = !!document.querySelector('[data-event]');
      return { anyOnAttr, anyDataEvent };
    });
    expect(hasInlineHandlers.anyOnAttr).toBe(false);
    expect(hasInlineHandlers.anyDataEvent).toBe(false);
  });
});