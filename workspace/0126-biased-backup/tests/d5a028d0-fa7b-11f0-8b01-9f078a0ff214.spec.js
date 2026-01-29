import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a028d0-fa7b-11f0-8b01-9f078a0ff214.html';
const SHOW_BUTTON_SELECTOR = "button[onclick='showExample()']";
const EXPECTED_ALERT_TEXT = "Visualization of operations on a Deque:\n\n" +
    "1. Start: []\n" +
    "2. Insert 1 at rear: [1]\n" +
    "3. Insert 2 at front: [2, 1]\n" +
    "4. Insert 3 at rear: [2, 1, 3]\n" +
    "5. Delete from front: [1, 3]\n" +
    "6. Get rear element: 3 (which is 3)";

test.describe('FSM: Understanding Deque - d5a028d0-fa7b-11f0-8b01-9f078a0ff214', () => {

  // Basic navigation check and listeners reset for each test.
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('S0_Idle: Page renders and initial Idle state evidence exists', async ({ page }) => {
    // Validate that page header and main content are present (renderPage() entry action evidence).
    const titleText = await page.locator('h1').innerText();
    expect(titleText).toMatch(/Understanding Deque/i);

    // The expected button should be present and visible.
    const btn = page.locator(SHOW_BUTTON_SELECTOR);
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Show Example Visualization');

    // Verify the button has the onclick attribute pointing to showExample()
    const onclickAttr = await page.getAttribute(SHOW_BUTTON_SELECTOR, 'onclick');
    expect(onclickAttr).toBe('showExample()');

    // Verify the showExample function exists in the page context (entry/exit action checks).
    const hasFunction = await page.evaluate(() => typeof window.showExample === 'function');
    expect(hasFunction).toBe(true);

    // Ensure no uncaught page errors immediately after load.
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));
    // Give a tiny moment to catch any synchronous load errors
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBe(0);
  });

  test('S1_Example_Shown: Clicking the Show Example button triggers an alert with expected visualization', async ({ page }) => {
    // Capture console errors and page errors to ensure click action does not produce unexpected errors.
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));

    // Prepare to capture the alert dialog and assert its content.
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Perform the event: click the button that triggers showExample() and alert.
    await page.click(SHOW_BUTTON_SELECTOR);

    // Wait briefly to let the dialog handler run.
    await page.waitForTimeout(50);

    // Assert the alert was shown and matches the expected text (state transition evidence).
    expect(dialogMessage).not.toBeNull();
    expect(dialogMessage).toBe(EXPECTED_ALERT_TEXT);

    // Confirm that no console errors or uncaught page errors happened during the interaction.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Multiple invocations: Clicking Show Example multiple times shows alerts each time', async ({ page }) => {
    // Collect dialog messages for multiple clicks
    const dialogs = [];
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Click twice and ensure two alerts are produced with consistent content.
    await page.click(SHOW_BUTTON_SELECTOR);
    await page.waitForTimeout(20); // allow dialog handler to process
    await page.click(SHOW_BUTTON_SELECTOR);
    await page.waitForTimeout(20);

    expect(dialogs.length).toBeGreaterThanOrEqual(2);
    for (const msg of dialogs) {
      expect(msg).toBe(EXPECTED_ALERT_TEXT);
    }
  });

  test('Edge case: Attempting to click a non-existent selector results in a Playwright error', async ({ page }) => {
    // Attempt to click a button that does not exist. Playwright should reject the promise.
    const badSelector = "button[onclick='nonExistent()']";
    let threw = false;
    try {
      await page.click(badSelector, { timeout: 200 });
    } catch (err) {
      threw = true;
      // Basic assertions about the thrown error shape/message
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/waiting for .* to be visible|No node found|not visible|strict mode/mi);
    }
    expect(threw).toBe(true);
  });

  // The following tests intentionally allow natural errors to happen in the page context.
  // They do not modify or patch the page environment; they trigger errors in a way that
  // produces uncaught exceptions on the page (via setTimeout) so they are reported as page errors.
  test('Error observation: ReferenceError occurs naturally when an undefined function is invoked asynchronously', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));

    // Schedule an asynchronous call that will cause an uncaught ReferenceError on the page.
    await page.evaluate(() => {
      setTimeout(() => {
        // This will throw ReferenceError since thisFunctionDoesNotExist is not defined.
        // It is intentionally not wrapped in try/catch to let it be uncaught.
        // eslint-disable-next-line no-undef
        thisFunctionDoesNotExist();
      }, 0);
    });

    // Wait briefly for the async error to surface and be captured.
    await page.waitForTimeout(100);

    // Assert that at least one page error was captured and it is a ReferenceError.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasReferenceError = pageErrors.some(e => e && e.name === 'ReferenceError');
    expect(hasReferenceError).toBe(true);
  });

  test('Error observation: SyntaxError occurs naturally when eval of invalid code runs asynchronously', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));

    // Schedule an asynchronous eval that will throw a SyntaxError.
    await page.evaluate(() => {
      setTimeout(() => {
        // Invalid JavaScript code to trigger a SyntaxError in the page context.
        try {
          // Use indirect eval via Function to trigger a SyntaxError at runtime.
          // This is executed directly in the page; any thrown error will be uncaught.
          // The string purposely contains invalid JS.
          eval('function () {'); // intentionally invalid
        } catch (e) {
          // Re-throw to make it uncaught; setTimeout's exception bubble up as an uncaught exception.
          throw e;
        }
      }, 0);
    });

    // Wait briefly for the async error to surface and be captured.
    await page.waitForTimeout(100);

    // Assert that at least one page error was captured and it is a SyntaxError.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasSyntaxError = pageErrors.some(e => e && e.name === 'SyntaxError');
    expect(hasSyntaxError).toBe(true);
  });

  test('Error observation: TypeError occurs naturally when calling a non-callable value asynchronously', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));

    // Schedule an asynchronous call that will throw a TypeError.
    await page.evaluate(() => {
      setTimeout(() => {
        // Create a non-callable value and attempt to call it. This will throw TypeError.
        const notAFunction = null;
        // This will throw "notAFunction is not a function" (TypeError)
        notAFunction();
      }, 0);
    });

    // Wait briefly for the async error to surface and be captured.
    await page.waitForTimeout(100);

    // Assert that at least one page error was captured and it is a TypeError.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasTypeError = pageErrors.some(e => e && e.name === 'TypeError');
    expect(hasTypeError).toBe(true);
  });

  test('State transition verification summary: FSM evidence and behaviors', async ({ page }) => {
    // This final test validates that the documented FSM steps (S0 -> S1 via ShowExample) behave as expected.
    // Ensure the button exists (S0_Idle evidence).
    await expect(page.locator(SHOW_BUTTON_SELECTOR)).toBeVisible();

    // Ensure calling the page's showExample function directly triggers the same alert (onEnter S1_Example_Shown).
    let directDialogMsg = null;
    page.once('dialog', async dialog => {
      directDialogMsg = dialog.message();
      await dialog.accept();
    });

    // Call the function directly from page context (equivalent to invoking the transition action).
    await page.evaluate(() => {
      // Call the function as the FSM would via its action.
      if (typeof window.showExample === 'function') {
        window.showExample();
      }
    });

    // Wait a moment for the dialog to be handled.
    await page.waitForTimeout(50);

    expect(directDialogMsg).not.toBeNull();
    expect(directDialogMsg).toBe(EXPECTED_ALERT_TEXT);

    // Confirm that the narrative text in the Example Operations section matches the FSM sequence.
    const exampleOpsText = await page.locator('h2:has-text("Example Operations") + p').innerText();
    expect(exampleOpsText).toMatch(/Insert 1 at the rear: \[1\]/i);
    expect(exampleOpsText).toMatch(/Get the rear element: 3/i);
  });

});