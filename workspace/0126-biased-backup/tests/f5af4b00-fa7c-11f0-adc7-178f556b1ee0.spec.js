import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5af4b00-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Dynamic Array App - FSM validation (f5af4b00-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Shared variables to collect console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  // Setup: runs before each test. Navigates to the page and attaches listeners.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect browser console messages
    page.on('console', (msg) => {
      try {
        // Store the text representation for assertions
        consoleMessages.push(msg.text());
      } catch (e) {
        // In the unlikely event of serialization issues, store fallback
        consoleMessages.push(String(msg));
      }
    });

    // Collect unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the provided application URL
    await page.goto(APP_URL);
  });

  // Teardown: runs after each test (no special teardown required here)
  test.afterEach(async ({ page }) => {
    // Ensure any attached listeners can't leak; remove all listeners we added.
    // (Playwright will dispose of the page fixture; this is a best-effort cleanup.)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Idle state: Page renders and button exists (S0_Idle)', async ({ page }) => {
    // This test validates the initial Idle state: the page should be rendered
    // and the button #dynamic-array-example should be present with expected text.

    const button = page.locator('#dynamic-array-example');

    // Button exists and is visible
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();

    // Button has expected text content
    await expect(button).toHaveText('Click to see an example');

    // No console logs should be produced just by loading the page (script logs happen on click)
    expect(consoleMessages.length).toBe(0);

    // No page errors initially
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: Clicking the example button shows dynamic array logs (S0_Idle -> S1_ExampleShown)', async ({ page }) => {
    // This test validates the transition from Idle to ExampleShown by clicking the button,
    // and verifies expected console outputs reflecting dynamic array operations.

    const button = page.locator('#dynamic-array-example');

    // Click the button to trigger the example code
    await button.click();

    // Wait until at least the expected number of console logs appear.
    // The script logs 6 arrays/states in the example; wait for at least 6 console messages.
    await expect.poll(() => consoleMessages.length, { timeout: 2000 }).toBeGreaterThanOrEqual(6);

    // Basic assertions on the presence of expected values in console output:
    // Join all console messages to make substring checks simpler.
    const joined = consoleMessages.join(' | ');

    // The initial log should contain zeros (Array of 10 zeros)
    expect(joined).toContain('0');

    // After pushes, we should see '3' in one of the messages (arr.push(3))
    expect(joined).toMatch(/3/);

    // After pop() the value '3' should no longer be present in the subsequent log.
    // To assert sequence behavior, find the first message that contains '3', then ensure
    // the next message after it does not contain '3'.
    const idxWith3 = consoleMessages.findIndex(m => /(^|\[|,|\s)3($|,|\]|\s)/.test(m));
    if (idxWith3 !== -1 && idxWith3 + 1 < consoleMessages.length) {
      // The next message should not include '3' (reflecting the pop())
      expect(/(^|\[|,|\s)3($|,|\]|\s)/.test(consoleMessages[idxWith3 + 1])).toBeFalsy();
    } else {
      // If we didn't find a message with 3 or can't inspect next, at minimum assert overall presence
      expect(idxWith3).toBeGreaterThanOrEqual(0);
    }

    // After unshift operations there should be messages containing repeated 1 and 2 values.
    // At least one console message should include '1' and '2' together.
    const has1and2 = consoleMessages.some(m => /1/.test(m) && /2/.test(m));
    expect(has1and2).toBeTruthy();

    // Final splice removes an element; final log should include at least '1' and '2' (the final [1,2])
    const lastMsg = consoleMessages[consoleMessages.length - 1] || '';
    expect(lastMsg).toMatch(/1/);
    expect(lastMsg).toMatch(/2/);

    // No unexpected page errors during normal flow
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Clicking the example button twice produces repeated logs', async ({ page }) => {
    // Validate repeated interactions: clicking multiple times appends logs each time.

    const button = page.locator('#dynamic-array-example');

    // Click twice
    await button.click();
    await button.click();

    // Wait until at least 12 messages appear (6 logs per click x2)
    await expect.poll(() => consoleMessages.length, { timeout: 3000 }).toBeGreaterThanOrEqual(12);

    // Ensure messages are present from both invocations: check that '3' appears at least twice.
    const occurrencesOf3 = consoleMessages.filter(m => /(^|\[|,|\s)3($|,|\]|\s)/.test(m)).length;
    expect(occurrencesOf3).toBeGreaterThanOrEqual(2);

    // No page errors produced by repeated clicking
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: Attempt to click a non-existent element results in an error', async ({ page }) => {
    // This test intentionally attempts to interact with a non-existent element
    // to validate that the system surfaces an appropriate error (edge case).

    // Confirm the non-existent selector is absent
    const missing = page.locator('#non-existent-button');
    await expect(missing).toHaveCount(0);

    // Attempting to click it should result in a Timeout error from Playwright.
    let threw = false;
    try {
      // Small timeout to fail fast
      await page.click('#non-existent-button', { timeout: 1000 });
    } catch (err) {
      threw = true;
      // Basic assertions on the thrown error to ensure it's a Playwright timeout-like error
      expect(err).toBeTruthy();
      const msg = err.message || String(err);
      expect(msg).toMatch(/Timeout|waiting for selector|No node found/i);
    }
    expect(threw).toBeTruthy();
  });

  test('Deliberate ReferenceError: Evaluate undefined function on page and assert pageerror is captured', async ({ page }) => {
    // This test intentionally triggers a ReferenceError in page context by calling a function
    // that does not exist, to validate that page errors are emitted and captured.

    // Clear any previous errors/messages
    consoleMessages = [];
    pageErrors = [];

    // Trigger ReferenceError inside the page context
    let evalError = null;
    try {
      await page.evaluate(() => {
        // Intentionally call a non-existent function to provoke a ReferenceError.
        // This does not modify the page, only invokes code that naturally throws.
        // We let this happen naturally; Playwright will surface the error.
        // eslint-disable-next-line no-undef
        nonExistentFunction();
      });
    } catch (err) {
      evalError = err;
    }

    // The evaluation should throw an error
    expect(evalError).toBeTruthy();
    const evalMsg = evalError.message || String(evalError);
    // The message should indicate a reference to undefined / not defined
    expect(evalMsg).toMatch(/nonExistentFunction|not defined|is not defined|ReferenceError/i);

    // The pageerror listener should have captured a message (depending on engine)
    // We allow either immediate capture or slight delay; poll briefly.
    await expect.poll(() => pageErrors.length, { timeout: 1000 }).toBeGreaterThanOrEqual(1);

    // Confirm that the captured page error references the missing function
    const joinedErrors = pageErrors.join(' | ');
    expect(joinedErrors).toMatch(/nonExistentFunction|not defined|ReferenceError/i);
  });

  test('State evidence/assertions: verify FSM-referenced text snippets exist in DOM', async ({ page }) => {
    // This test checks the static textual evidence included in the FSM (examples in <pre> and explanatory text).
    // It ensures the page contains explanatory content referenced by the FSM (educational goal / evidence).

    // Verify there is descriptive text about dynamic arrays
    await expect(page.locator('text=What is a Dynamic Array?')).toBeVisible();
    await expect(page.locator('text=How do you create a dynamic array?')).toBeVisible();
    await expect(page.locator('pre')).toHaveCountGreaterThan(0);

    // Check that one of the example pre blocks contains 'Array.from'
    const preTexts = await page.locator('pre').allTextContents();
    const hasArrayFrom = preTexts.some(t => t.includes('Array.from'));
    expect(hasArrayFrom).toBeTruthy();
  });

  test('Accessibility / focusability: button can be focused and activated via keyboard', async ({ page }) => {
    // Validate that the example button is focusable and keyboard-activatable (accessibility check).

    const button = page.locator('#dynamic-array-example');
    await button.focus();
    await expect(button).toBeFocused();

    // Press Enter to activate the button (should trigger same logs as click)
    await page.keyboard.press('Enter');

    // Wait for logs to appear
    await expect.poll(() => consoleMessages.length, { timeout: 2000 }).toBeGreaterThanOrEqual(6);

    // Basic verification that logs were generated
    expect(consoleMessages.length).toBeGreaterThanOrEqual(6);
    expect(pageErrors.length).toBe(0);
  });
});