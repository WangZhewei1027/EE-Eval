import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f2942-fa77-11f0-8492-31e949ed3c7c.html';
const ALERT_TEXT = 'Optimized queries lead to faster data retrieval and improved application performance.';

test.describe('Query Optimization app - FSM tests', () => {
  // Validate Idle state: initial render and presence of primary components
  test('Idle state renders correctly and entry elements present', async ({ page }) => {
    // Collect console and page errors to assert on them
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);

    // Verify top-level content loaded (title, header)
    await expect(page).toHaveTitle(/Query Optimization/);
    await expect(page.locator('header h1')).toHaveText('Query Optimization');
    await expect(page.locator('.card-header')).toHaveText('Understanding Query Optimization');

    // Verify the Learn More button exists and is visible (evidence of S0_Idle)
    const learnBtn = page.locator('#learnMoreBtn');
    await expect(learnBtn).toBeVisible();
    await expect(learnBtn).toHaveText('Learn More');

    // Verify the onclick handler exists as a function (this inspects the existing runtime without patching)
    const onclickType = await page.$eval('#learnMoreBtn', (btn) => {
      // typeof is serializable and safe to return
      return typeof btn.onclick;
    });
    expect(onclickType).toBe('function');

    // Ensure no uncaught exceptions or console error messages were emitted during initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Also check that there is at least one console message (optional info) or none - but we assert there were no errors
    // This confirms S0_Idle entry actions (renderPage) resulted in expected DOM without runtime exceptions
  });

  // Validate transition: clicking Learn More triggers an alert (S0_Idle -> S1_AlertDisplayed)
  test('Learn More click triggers alert and transitions to Alert Displayed state', async ({ page }) => {
    const dialogMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('dialog', async (dialog) => {
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      // Accept the dialog to let the page continue running naturally
      await dialog.accept();
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Click the button which should trigger a native alert dialog
    await page.click('#learnMoreBtn');

    // Ensure a dialog was observed and its message matches the expected alert text (evidence of S1_AlertDisplayed)
    expect(dialogMessages.length).toBe(1);
    expect(dialogMessages[0].type).toBe('alert');
    expect(dialogMessages[0].message).toBe(ALERT_TEXT);

    // Verify no fatal page errors occurred as a result of the transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Validate repeated interactions: multiple clicks produce multiple alerts
  test('Repeated Learn More clicks produce multiple alert dialogs', async ({ page }) => {
    const dialogMessages = [];

    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await page.goto(APP_URL);

    // Click the button three times in succession
    await page.click('#learnMoreBtn');
    await page.click('#learnMoreBtn');
    await page.click('#learnMoreBtn');

    // Ensure three dialogs were observed with the expected message each time
    expect(dialogMessages.length).toBe(3);
    for (const msg of dialogMessages) {
      expect(msg).toBe(ALERT_TEXT);
    }
  });

  // Inspect the actual handler source for evidence that it contains the alert string
  test('Event handler source contains the expected alert invocation', async ({ page }) => {
    await page.goto(APP_URL);

    // Obtain the onclick function's source as a string (this does not modify the page)
    const handlerSource = await page.$eval('#learnMoreBtn', (btn) => btn.onclick && btn.onclick.toString ? btn.onclick.toString() : '');

    // The handler's source should include the alert text or at least the 'alert(' invocation
    expect(typeof handlerSource).toBe('string');
    expect(handlerSource.length).toBeGreaterThan(0);
    // Check for evidence of alert being invoked in the handler
    expect(handlerSource.includes('alert(') || handlerSource.includes('alert')).toBeTruthy();
    // Also check that the handler source includes at least part of the message string
    expect(handlerSource.includes('Optimized queries')).toBeTruthy();
  });

  // Edge case: clicking a non-existent selector should throw a Playwright error (we observe natural error)
  test('Clicking a missing selector throws an error (edge case)', async ({ page }) => {
    await page.goto(APP_URL);

    let caught = null;
    try {
      // This selector does not exist in the DOM - letting Playwright throw naturally
      await page.click('#nonExistentButton', { timeout: 1000 });
    } catch (err) {
      caught = err;
    }

    // We expect an error to have been thrown by Playwright when trying to click a missing element
    expect(caught).not.toBeNull();
    // The thrown error should be an instance of Error and contain helpful Playwright diagnostic text
    expect(caught).toBeInstanceOf(Error);
    expect(String(caught.message).toLowerCase()).toContain('no node found for selector'.replace('selector', '') || ''); // broad check; don't rely on exact wording
  });

  // Observe console and page errors across navigation and interactions - assert that there are no uncaught runtime errors
  test('Observe console and page errors during typical interactions', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Perform a safe interaction: click the learn more button once
    page.on('dialog', async (d) => await d.accept());
    await page.click('#learnMoreBtn');

    // After interaction, assert that no page-level errors or console.error messages occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});