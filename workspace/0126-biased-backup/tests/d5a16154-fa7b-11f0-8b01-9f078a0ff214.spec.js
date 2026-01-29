import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a16154-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe("d5a16154-fa7b-11f0-8b01-9f078a0ff214 - Kruskal's Algorithm Explained (FSM) ", () => {

  // Increase default timeout in case the local server is slow to respond
  test.setTimeout(30_000);

  // Helper to instrument console and page errors for a given page
  const instrumentPage = (page) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push(err && err.message ? err.message : String(err));
    });
    return { consoleMessages, pageErrors };
  };

  test.beforeEach(async ({ page }) => {
    // Default: nothing to set up globally - each test will navigate itself
  });

  test.afterEach(async ({ page }) => {
    // Ensure any dialogs are dismissed if accidentally left open
    try {
      // No direct API to dismiss all dialogs; using try/catch around potential leftover dialog handlers
      await page.waitForTimeout(50);
    } catch (e) {
      // swallow - cleanup only
    }
  });

  test('Initial idle state S0_Idle: page renders expected content and button exists', async ({ page }) => {
    // Validate entry_actions -> renderPage() is represented by rendered DOM (h1 and content)
    const { consoleMessages, pageErrors } = instrumentPage(page);

    const response = await page.goto(APP_URL, { waitUntil: 'load' });
    expect(response && response.ok()).toBeTruthy(); // page served successfully

    // Verify top-level heading text renders
    const h1 = page.locator('h1');
    await expect(h1).toHaveText("Kruskal's Algorithm Explained");

    // Verify the "See Demonstration" button exists with the expected class and text
    const button = page.locator('.button');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('See Demonstration');

    // Verify inline onclick attribute contains the expected alert call
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert('Demonstration Available!')");

    // Ensure no unexpected page errors or console error messages on initial load
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Entry action renderPage() - calling undefined renderPage() should throw ReferenceError naturally', async ({ page }) => {
    // This test intentionally calls the conceptual entry action renderPage() which is not defined
    // to observe the natural ReferenceError and pageerror emission per the testing instructions.
    const { consoleMessages, pageErrors } = instrumentPage(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Attempt to call renderPage() from the page context. It is NOT defined in the provided HTML,
    // so this should throw a ReferenceError in the page and be captured as a rejected promise.
    let caughtError = null;
    try {
      await page.evaluate(() => {
        // Direct call to an undefined function will raise a ReferenceError: renderPage is not defined
        // We intentionally do not wrap this in a try/catch inside the page to let it bubble up.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      caughtError = err;
    }

    // We expect an error to have been thrown when calling an undefined function.
    expect(caughtError).not.toBeNull();
    // The message should indicate renderPage is not defined (ReferenceError)
    // Different engines might format messages slightly differently, so check for substring.
    const msg = String(caughtError && caughtError.message ? caughtError.message : caughtError);
    expect(msg.toLowerCase()).toContain('renderpage');

    // The pageerror listener should have captured the ReferenceError as well.
    // Allow for at least one page error that references renderPage.
    const pageErrorMatches = pageErrors.some(pe => pe.toLowerCase().includes('renderpage'));
    expect(pageErrorMatches).toBeTruthy();

    // Confirm no console.error entries beyond possible natural error reporting (we accept pageErrors)
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    // It's acceptable for engines to log something to console, but at minimum we assert that
    // the ReferenceError was observed in pageErrors (done above). Here we assert console error count >= 0.
    expect(Array.isArray(consoleErrorMsgs)).toBeTruthy();
  });

  test('Transition SeeDemonstration: clicking button shows an alert with expected message', async ({ page }) => {
    // Validate the FSM transition: clicking the .button triggers alert('Demonstration Available!')
    const { consoleMessages, pageErrors } = instrumentPage(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Prepare to capture dialog
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      // Capture dialog message and accept it to allow further interactions
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Click the button to trigger the alert
    await page.click('.button');

    // Ensure a dialog was captured and the content matches expected observable
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].type).toBe('alert');
    expect(dialogs[0].message).toBe("Demonstration Available!");

    // After the alert, verify that the DOM remains in the Idle state (button still present)
    await expect(page.locator('.button')).toHaveCount(1);
    await expect(page.locator('.button')).toHaveText('See Demonstration');

    // No new page errors should be present as a result of clicking the button (alert is expected behavior)
    expect(pageErrors.length).toBe(0);

    // No console.error messages should be present because alert is synchronous and expected
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  test('Repeated transitions: multiple clicks show repeated alerts and do not mutate DOM', async ({ page }) => {
    // Validate repeated triggering of the same transition (S0_Idle -> S0_Idle) keeps behavior consistent.
    const { consoleMessages, pageErrors } = instrumentPage(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    const capturedDialogs = [];
    page.on('dialog', async dialog => {
      capturedDialogs.push(dialog.message());
      await dialog.accept();
    });

    // Click the button three times sequentially
    await page.click('.button');
    await page.click('.button');
    await page.click('.button');

    // Confirm three alerts were shown with identical messages
    expect(capturedDialogs.length).toBe(3);
    capturedDialogs.forEach(msg => expect(msg).toBe("Demonstration Available!"));

    // Verify button still present and unchanged
    const button = page.locator('.button');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('See Demonstration');

    // No page-level errors introduced by repeated alerts
    expect(pageErrors.length).toBe(0);

    // Confirm console has no error-level messages
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  test('Edge case: clicking a non-existent selector should fail naturally (error scenario)', async ({ page }) => {
    // This test attempts to click a selector that does not exist to ensure the runtime throws naturally.
    await page.goto(APP_URL, { waitUntil: 'load' });

    let clickError = null;
    try {
      // Use a short timeout to make the error rapid and deterministic
      await page.click('.this-selector-does-not-exist', { timeout: 2000 });
    } catch (err) {
      clickError = err;
    }

    // We expect Playwright to throw because the selector does not exist
    expect(clickError).not.toBeNull();
    const msg = String(clickError.message || clickError);
    // The error message should indicate waiting for selector or not found
    const lowered = msg.toLowerCase();
    expect(
      lowered.includes('waiting for selector') ||
      lowered.includes('no node found') ||
      lowered.includes('failed to find')
    ).toBeTruthy();
  });

  test('Accessibility / DOM sanity checks for all major components described in FSM', async ({ page }) => {
    // Verify that the descriptive content (articles, headings, lists) present as expected,
    // ensuring the entry state renders the educational content described in the FSM.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Check presence of multiple article sections
    const articles = page.locator('article');
    await expect(articles).toHaveCountGreaterThan(0);

    // Ensure there is at least one h2 and that the Example section exists
    await expect(page.locator('h2', { hasText: 'Example' })).toHaveCount(1);

    // Confirm the example list contains the expected edge descriptions (A-B, A-C, etc)
    const listItems = page.locator('article >> text=A-B (4)');
    await expect(listItems).toHaveCount(1);

    // Confirm the button container exists and contains the button
    await expect(page.locator('.button-container')).toHaveCount(1);
    await expect(page.locator('.button-container .button')).toHaveCount(1);
  });

});