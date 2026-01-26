import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122ac682-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Deque Example (FSM validation) - Application ID 122ac682-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Arrays to collect runtime diagnostics per test
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate before each test so we capture load-time errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors printed to console)
    page.on('console', (msg) => {
      // Record text and type for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page under test (we intentionally do not fix or patch any runtime errors)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No global teardown required; Playwright will close pages/contexts automatically.
    // This hook exists to emphasize test isolation.
  });

  test('Page should load and report runtime errors (expect ReferenceError from missing Deque)', async ({ page }) => {
    // This test validates that the page attempted to construct `new Deque()` and failed,
    // causing a ReferenceError during script execution. According to instructions, we must
    // observe and assert that such errors occur naturally.
    // Wait briefly to ensure pageerror(s) are captured (navigation already done in beforeEach).
    await page.waitForTimeout(100); // small delay to allow onpageerror to fire

    // We expect at least one page error due to `let deque = new Deque()` in the script.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the errors should be about `Deque` not being defined (ReferenceError).
    const hasDequeReferenceError = pageErrors.some((err) =>
      /Deque is not defined|Deque is not a constructor|Deque is not defined/i.test(err.message)
    );
    expect(hasDequeReferenceError).toBeTruthy();

    // Also check that the browser console captured an error message related to `Deque`.
    const consoleHasDequeError = consoleMessages.some((c) =>
      c.type === 'error' && /Deque is not defined|Deque is not a constructor/i.test(c.text)
    );
    expect(consoleHasDequeError).toBeTruthy();
  });

  test('All declared buttons from FSM should be present in the DOM', async ({ page }) => {
    // Verify presence and visibility of the core buttons defined in FSM evidence.
    const selectors = [
      `button[onclick="addDeque('deque')"]`,
      `button[onclick="printDeque()"]`,
      `button[onclick="removeDeque()"]`,
      `button[onclick="clearDeque()"]`,
      `button[onclick="insertAtFront('deque')"]`,
      `button[onclick="insertAtBack('deque')"]`,
      `button[onclick="removeFromFront()"]`,
      `button[onclick="removeFromBack()"]`,
      `button[onclick="getSize()"]`,
      `button[onclick="getFront()"]`,
      `button[onclick="getBack()"]`,
      `button[onclick="peek()"]`,
    ];

    for (const sel of selectors) {
      const locator = page.locator(sel).first();
      // Ensure the element exists in the DOM (some selectors are present multiple times; we check the first)
      await expect(locator).toHaveCount(1);
      await expect(locator).toBeVisible();
    }
  });

  // Define FSM events and expected global function names invoked by onclick attributes.
  const events = [
    { id: 'AddDeque', selector: `button[onclick="addDeque('deque')"]`, fnName: 'addDeque' },
    { id: 'PrintDeque', selector: `button[onclick="printDeque()"]`, fnName: 'printDeque' },
    { id: 'RemoveDeque', selector: `button[onclick="removeDeque()"]`, fnName: 'removeDeque' },
    { id: 'ClearDeque', selector: `button[onclick="clearDeque()"]`, fnName: 'clearDeque' },
    { id: 'InsertAtFront', selector: `button[onclick="insertAtFront('deque')"]`, fnName: 'insertAtFront' },
    { id: 'InsertAtBack', selector: `button[onclick="insertAtBack('deque')"]`, fnName: 'insertAtBack' },
    { id: 'RemoveFromFront', selector: `button[onclick="removeFromFront()"]`, fnName: 'removeFromFront' },
    { id: 'RemoveFromBack', selector: `button[onclick="removeFromBack()"]`, fnName: 'removeFromBack' },
    { id: 'GetSize', selector: `button[onclick="getSize()"]`, fnName: 'getSize' },
    { id: 'GetFront', selector: `button[onclick="getFront()"]`, fnName: 'getFront' },
    { id: 'GetBack', selector: `button[onclick="getBack()"]`, fnName: 'getBack' },
    { id: 'Peek', selector: `button[onclick="peek()"]`, fnName: 'peek' },
  ];

  // Generate a test for each event/transition to validate runtime behavior when triggered.
  for (const evt of events) {
    test(`Triggering event "${evt.id}" should produce a runtime error because "${evt.fnName}" is not defined`, async ({ page }) => {
      const locator = page.locator(evt.selector).first();
      // Confirm the button exists and is interactable before clicking
      await expect(locator).toBeVisible();

      // Clicking will try to call a global function that was not defined due to earlier script error.
      // We wait for a pageerror to be emitted as a result of clicking the button.
      const [error] = await Promise.all([
        // Wait for the pageerror that arises from the click
        page.waitForEvent('pageerror', { timeout: 2000 }),
        // Perform the click that triggers the undefined function call
        locator.click(),
      ]);

      // The error message should reference the undefined function name (e.g., "addDeque is not defined")
      expect(error).toBeTruthy();
      expect(error.message).toMatch(new RegExp(`${evt.fnName}.*is not defined|${evt.fnName}`, 'i'));

      // Additionally assert that the console captured an error referencing the same function name
      const foundConsoleError = consoleMessages.some((c) =>
        c.type === 'error' && new RegExp(evt.fnName, 'i').test(c.text)
      );
      expect(foundConsoleError).toBeTruthy();
    });
  }

  test('Clicking multiple times on the same event should consistently produce errors (idempotent error behavior)', async ({ page }) => {
    // Use AddDeque which has an onclick attribute and occurs multiple times in the markup.
    const selector = `button[onclick="addDeque('deque')"]`;
    const locator = page.locator(selector).first();
    await expect(locator).toBeVisible();

    // Click multiple times and ensure each click leads to an uncaught page error event.
    const errorMessages = [];
    for (let i = 0; i < 3; i++) {
      const [err] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }),
        locator.click(),
      ]);
      errorMessages.push(err.message);
    }

    // Expect three errors captured and each references the same missing function
    expect(errorMessages.length).toBe(3);
    for (const msg of errorMessages) {
      expect(msg).toMatch(/addDeque.*is not defined|addDeque/i);
    }
  });

  test('No successful deque console logs should appear because Deque construction failed (edge-case verification)', async ({ page }) => {
    // If the Deque object had been constructed and functions run, we'd see logs like "Deque:" or "Deque size:".
    // Because the page throws early, assert that such success logs are NOT present in captured console messages.
    const successPatterns = [/Deque:/i, /Deque size:/i, /Front element:/i, /Back element:/i, /Peek:/i];

    for (const pat of successPatterns) {
      const hasSuccessLog = consoleMessages.some((c) => c.type === 'log' && pat.test(c.text));
      expect(hasSuccessLog).toBeFalsy();
    }
  });

  test('Edge case: invoking remove operations on an uninitialized deque should still surface errors', async ({ page }) => {
    // Test removeFromFront and removeFromBack click handlers specifically as edge-case transitions.
    const selectors = [
      `button[onclick="removeFromFront()"]`,
      `button[onclick="removeFromBack()"]`,
      `button[onclick="removeDeque()"]`,
    ];

    for (const s of selectors) {
      const locator = page.locator(s).first();
      await expect(locator).toBeVisible();

      const [err] = await Promise.all([page.waitForEvent('pageerror', { timeout: 2000 }), locator.click()]);
      // Expect the error to indicate the onclick handler is not defined
      expect(err.message).toMatch(/is not defined|not a function/i);
    }
  });

  test('Verify that the expected number of FSM-declared components exist on the page (count check)', async ({ page }) => {
    // FSM declared 12 button components. Verify we can locate at least that many buttons matching the onclick patterns.
    // We search for all buttons that have onclick attributes and count occurrences of the handlers mentioned in the FSM.
    const allSelectors = [
      `button[onclick="addDeque('deque')"]`,
      `button[onclick="printDeque()"]`,
      `button[onclick="removeDeque()"]`,
      `button[onclick="clearDeque()"]`,
      `button[onclick="insertAtFront('deque')"]`,
      `button[onclick="insertAtBack('deque')"]`,
      `button[onclick="removeFromFront()"]`,
      `button[onclick="removeFromBack()"]`,
      `button[onclick="getSize()"]`,
      `button[onclick="getFront()"]`,
      `button[onclick="getBack()"]`,
      `button[onclick="peek()"]`,
    ];

    // Sum counts (there are duplicates in the HTML; we ensure at least 12 matching nodes exist)
    let total = 0;
    for (const sel of allSelectors) {
      total += await page.locator(sel).count();
    }

    expect(total).toBeGreaterThanOrEqual(12);
  });
});