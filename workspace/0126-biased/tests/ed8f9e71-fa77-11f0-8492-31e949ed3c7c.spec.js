import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f9e71-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('SDLC Interactive App - ed8f9e71-fa77-11f0-8492-31e949ed3c7c', () => {
  // Arrays to collect runtime console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    consoleMessages = [];
    pageErrors = [];

    // listen to console messages and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // push Error object so we can inspect message and name
      pageErrors.push(err);
    });

    // navigate to the exact page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Basic sanity: ensure console listener arrays are cleared between tests by test.beforeEach
    // (This is to illustrate teardown steps; Playwright automatically closes pages between tests.)
  });

  test('Initial Idle state - page renders and description is hidden (S0_Idle)', async ({ page }) => {
    // Validate the "Idle" state: button present and description is hidden (opacity 0).
    const button = page.locator('.button');
    const description = page.locator('.description');

    // Button should be visible and contain the expected text
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Learn More');

    // The description element should exist in DOM
    await expect(description).toBeVisible(); // visible as element, but opacity is 0 (hidden visually)
    // Check computed opacity is '0' as per initial CSS state
    const initialOpacity = await description.evaluate((el) => getComputedStyle(el).opacity);
    expect(initialOpacity).toBe('0');

    // Verify the inline onclick attribute exists and references showDescription()
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe('showDescription()');

    // Ensure no uncaught page errors were emitted during load
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error messages were emitted during load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: clicking "Learn More" triggers showDescription and description becomes visible (S0 -> S1)', async ({ page }) => {
    // Validate the event and transition from Idle to Description Visible.
    const button = page.locator('.button');
    const description = page.locator('.description');

    // Precondition: description initially invisible
    await expect(description).toBeVisible();
    let beforeOpacity = await description.evaluate((el) => getComputedStyle(el).opacity);
    expect(beforeOpacity).toBe('0');

    // Click the Learn More button (this triggers showDescription via onclick attribute)
    await button.click();

    // Wait until description's computed opacity becomes '1'
    await expect.poll(async () => {
      return await description.evaluate((el) => getComputedStyle(el).opacity);
    }).toBe('1');

    // Confirm the inline style changed to make it visible
    const inlineOpacity = await description.evaluate((el) => el.style.opacity);
    expect(inlineOpacity).toBe('1');

    // Verify no unexpected page errors during the transition
    expect(pageErrors.length).toBe(0);

    // Verify no console.error messages during the transition
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Direct invocation of showDescription function sets description visibility (explicit entry action)', async ({ page }) => {
    // Check showDescription is present as a function and calling it directly causes same state change.
    const description = page.locator('.description');

    // Ensure currently hidden
    const initialOpacity = await description.evaluate((el) => getComputedStyle(el).opacity);
    expect(initialOpacity).toBe('0');

    // Confirm the function exists on window
    const typeOfShowDescription = await page.evaluate(() => typeof window.showDescription);
    expect(typeOfShowDescription).toBe('function');

    // Call the function directly and verify effect
    await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      showDescription();
    });

    // Wait for opacity to become '1'
    await expect.poll(async () => {
      return await description.evaluate((el) => getComputedStyle(el).opacity);
    }).toBe('1');

    // Confirm no page errors were emitted as a result of calling the function
    expect(pageErrors.length).toBe(0);

    // And no console.error messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotency: clicking "Learn More" multiple times keeps description visible and does not produce errors', async ({ page }) => {
    // Click the button multiple times and ensure state remains stable and no errors are logged.
    const button = page.locator('.button');
    const description = page.locator('.description');

    // Click first time
    await button.click();
    await expect.poll(async () => {
      return await description.evaluate((el) => getComputedStyle(el).opacity);
    }).toBe('1');

    // Click additional times
    await button.click();
    await button.click();

    // Ensure opacity still '1'
    const finalOpacity = await description.evaluate((el) => getComputedStyle(el).opacity);
    expect(finalOpacity).toBe('1');

    // No page errors expected from repeated invocations
    expect(pageErrors.length).toBe(0);

    // No console.error messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: invoking an FSM-declared entry action renderPage() that is not implemented should throw ReferenceError', async ({ page }) => {
    // The FSM mentions an entry action renderPage(), but the provided HTML/JS does not define it.
    // We attempt to call it and assert that a ReferenceError (or similar "not defined") is thrown naturally.
    let caughtError = null;

    try {
      // Attempt to call the missing function in page context. This should throw.
      await page.evaluate(() => {
        // Intentionally call a function that is not defined in the page scope.
        // We do not define or patch anything; we let the runtime throw naturally.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      // Capture the thrown error from Playwright's evaluate wrapper
      caughtError = err;
    }

    // We expect an error to have been thrown when attempting to call renderPage
    expect(caughtError).not.toBeNull();

    // The error message should reference renderPage (likely "renderPage is not defined")
    expect(String(caughtError.message)).toContain('renderPage');

    // Additionally, the page may have emitted a pageerror event for this ReferenceError.
    // Check if any collected page errors mention renderPage.
    const matchingPageErrors = pageErrors.filter((pe) => {
      if (!pe || !pe.message) return false;
      return pe.message.includes('renderPage');
    });

    // It's acceptable if the pageerror event was emitted; assert that either it was emitted or that the evaluate call produced the thrown error.
    // At minimum, we assert that calling the missing function resulted in an explicit failure (caughtError).
    expect(caughtError).toBeTruthy();

    // If a pageerror was recorded, ensure its message indicates the missing function
    if (matchingPageErrors.length > 0) {
      expect(matchingPageErrors[0].message).toContain('renderPage');
    }
  });

  test('Observe console.log side-effects and ensure expected info logs (if any) and absence of errors', async ({ page }) => {
    // This test demonstrates observing console logs and verifying no console.error entries exist.
    // The page does not intentionally log anything to console by default, but we capture and assert.
    // At this point in the test lifecycle the page has already loaded; inspect collected messages.
    const allConsoleTexts = consoleMessages.map((m) => `${m.type}: ${m.text}`);
    // No console errors expected
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Ensure collected messages are an array (could be empty)
    expect(Array.isArray(allConsoleTexts)).toBe(true);

    // Also confirm there are no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Negative scenario: ensure calling an undefined function other than renderPage produces a ReferenceError on page', async ({ page }) => {
    // Try another undefined function to validate consistent runtime behavior for missing functions.
    let thrown = null;
    try {
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        return someCompletelyMissingFunction();
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(String(thrown.message)).toContain('someCompletelyMissingFunction');
    // Optionally, check pageErrors captured mention the function
    const found = pageErrors.some((pe) => pe && pe.message && pe.message.includes('someCompletelyMissingFunction'));
    // It may or may not emit a pageerror event depending on timing; accept either but ensure evaluate threw.
    expect(thrown).toBeTruthy();
  });
});