import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a09e00-fa7b-11f0-8b01-9f078a0ff214.html';

// Keep tests grouped and descriptive for the FSM: S0_Idle and ShowDemonstrationNote event
test.describe('FSM: d5a09e00-fa7b-11f0-8b01-9f078a0ff214 - Priority Queue interactive app', () => {
  // Verify the page loads and the main button/component from the FSM is present
  test('S0_Idle: initial render contains expected headings and Show Demonstration Note button', async ({ page }) => {
    // Track console messages for later assertions in this test
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the page exactly as provided
    await page.goto(APP_URL);

    // Verify the title and main heading exist (sanity check for correct page)
    await expect(page).toHaveTitle(/What is a Priority Queue\?/i);
    const heading = await page.locator('h1').innerText();
    expect(heading).toMatch(/Understanding Priority Queues/i);

    // The FSM lists a single button with selector button[onclick] and visible text
    const btn = page.locator('button[onclick]');
    await expect(btn).toHaveCount(1);
    await expect(btn).toBeVisible();

    // Check the visible text matches the FSM/component spec
    const btnText = await btn.innerText();
    expect(btnText.trim()).toBe('Show Demonstration Note');

    // Ensure the onclick attribute exists and contains expected substring
    const onclickAttr = await btn.getAttribute('onclick');
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain('Demonstration: Enqueue and Dequeue');

    // Confirm there were no console error messages emitted during normal page load
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  // Test the FSM event: clicking the button should trigger an alert dialog (transition's expected observable)
  test('Event ShowDemonstrationNote: clicking button displays alert dialog with expected message', async ({ page }) => {
    await page.goto(APP_URL);

    // Use waitForEvent to capture the dialog and ensure we assert its message
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick]') // triggers the inline alert in the provided HTML
    ]);

    // Validate the alert message contains the descriptive demonstration text
    const dlgMessage = dialog.message();
    expect(dlgMessage).toContain('Demonstration: Enqueue and Dequeue operations on a Priority Queue');

    // Accept the alert to allow the page to continue functioning
    await dialog.accept();

    // After dismissing, verify the page still has the button and it is clickable again
    await expect(page.locator('button[onclick]')).toBeVisible();
  });

  // Edge case: clicking the button multiple times should show an alert each time (state loops to itself)
  test('Transition loop: repeated clicks each raise a dialog (S0_Idle -> S0_Idle repeatedly)', async ({ page }) => {
    await page.goto(APP_URL);

    const btnLocator = page.locator('button[onclick]');
    await expect(btnLocator).toBeVisible();

    // Click the button multiple times and handle each dialog
    for (let i = 0; i < 3; i++) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        btnLocator.click()
      ]);
      expect(dialog.message()).toContain('Demonstration: Enqueue and Dequeue operations on a Priority Queue');
      await dialog.accept();
    }

    // After repeated dialogs, confirm the button still exists and the DOM hasn't been unexpectedly modified
    await expect(btnLocator).toHaveCount(1);
  });

  // Verify the FSM's mentioned entry action renderPage() — since the provided HTML does not define renderPage,
  // deliberately invoking it should produce a ReferenceError that surfaces as a page error.
  test('Entry action validation: invoking renderPage() should produce a ReferenceError (as it is not defined)', async ({ page }) => {
    await page.goto(APP_URL);

    // Wait for the pageerror event caused by calling the undefined function renderPage().
    // This simulates verifying the onEnter action which the FSM lists but the implementation lacks.
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Trigger the undefined function in the page context so the error is generated naturally.
    // Do not catch it in the page context — we want it to surface as an uncaught page error.
    await page.evaluate(() => {
      // Intentionally call a function that is not defined in the HTML to allow the runtime to raise an error.
      // This is done to validate that the expected onEnter action (renderPage) is missing and raises an error.
      // eslint-disable-next-line no-undef
      renderPage();
    }).catch(() => {
      // The evaluate will reject because the function is not defined; swallow here because we are separately awaiting the pageerror.
      // We don't rethrow because we want to assert on the pageerror event below rather than failing this evaluate call.
    });

    // Now capture the emitted page error
    const err = await pageErrorPromise;

    // The error should be a ReferenceError (or similar) and should mention renderPage
    expect(err).toBeTruthy();
    // Some browsers include different error message formats; assert it references renderPage and/or ReferenceError
    const message = String(err.message || err.toString());
    expect(message).toMatch(/renderPage/i);
    // The error name should indicate a ReferenceError in typical engines
    if (err.name) {
      expect(err.name).toMatch(/ReferenceError|Error/i);
    }
  });

  // Observe console logs and page errors across typical and error scenarios.
  // This test collects console entries and page errors while interacting with the page and verifies we capture them.
  test('Observability: capture console messages and page errors while interacting with the app', async ({ page }) => {
    const consoleEntries = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleEntries.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    await page.goto(APP_URL);

    // Trigger a benign console log via evaluate to ensure console capturing works (the page itself does not log by default)
    await page.evaluate(() => {
      // Create a console log inside the page context to verify we capture it
      // eslint-disable-next-line no-console
      console.log('TEST_LOG: page console capturing working');
    });

    // Trigger the dialog to ensure that such interactions do not create unexpected page errors
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick]')
    ]);
    expect(dialog.message()).toContain('Demonstration: Enqueue and Dequeue operations on a Priority Queue');
    await dialog.accept();

    // Ensure the test-generated console log was captured
    const foundTestLog = consoleEntries.find(e => e.text.includes('TEST_LOG: page console capturing working'));
    expect(foundTestLog).toBeTruthy();

    // There should be no unexpected page errors from normal interactions (dialogs and console logs are not errors)
    // Note: earlier tests intentionally created a pageerror when calling renderPage; that is not part of normal interaction here.
    expect(pageErrors.length).toBe(0);
  });

  // Edge error scenario: explicitly call another undefined symbol to ensure unhandled ReferenceErrors are captured
  test('Error scenario: invoking a different undefined function surfaces as a pageerror', async ({ page }) => {
    await page.goto(APP_URL);

    // Set up listener for the specific pageerror
    const errorPromise = page.waitForEvent('pageerror');

    // Invoke a different undefined function so a ReferenceError is emitted naturally
    await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      nonExistentFunction12345(); // intentionally undefined
    }).catch(() => {
      // swallow evaluate rejection here; we will assert on the pageerror event
    });

    const err = await errorPromise;
    expect(err).toBeDefined();
    const msg = String(err.message || err.toString());
    expect(msg).toMatch(/nonExistentFunction12345|nonExistentFunction/i);
    if (err.name) {
      expect(err.name).toMatch(/ReferenceError|Error/i);
    }
  });
});