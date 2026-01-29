import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca7b4801-fa75-11f0-9854-e7309e7cf385.html';

test.describe('Indexing app FSM - ca7b4801-fa75-11f0-9854-e7309e7cf385', () => {
  // Shared collectors for console messages and page errors
  let consoleMessages = [];
  let pageErrors = [];

  // Setup before each test: navigate to the page and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions / runtime page errors
    page.on('pageerror', err => {
      // Push the Error object so tests can inspect message/name
      pageErrors.push(err);
    });

    // Navigate to the app exactly as-is
    await page.goto(APP_URL);
  });

  // Teardown: after each test we log a compact summary (kept minimal to not spam test output)
  test.afterEach(async ({}, testInfo) => {
    // Attach small summary to test output (Playwright test reporter will capture it)
    testInfo.attach('console-summary', {
      body: JSON.stringify({ consoleCount: consoleMessages.length, pageErrorCount: pageErrors.length }, null, 2),
      contentType: 'application/json'
    });
  });

  test('Initial Idle state renders correctly (S0_Idle evidence)', async ({ page }) => {
    // This test validates the initial/idle state per FSM:
    // - Page renders (renderPage())
    // - The "Index" button is present with the expected onclick attribute
    // - Static content (header, description, list items) is present
    const title = await page.title();
    expect(title).toBe('Indexing');

    // Header and description checks
    await expect(page.locator('h1')).toHaveText('Indexing');
    await expect(page.locator('text=Indexing is the process of finding a specific element or group within a collection or array.')).toBeVisible();

    // Check list items count and content
    const items = page.locator('ul li');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('Apple');
    await expect(items.nth(1)).toContainText('Banana');
    await expect(items.nth(2)).toContainText('Cucumber');

    // Check the Index button exists and matches FSM selector evidence
    const indexButton = page.locator("button[onclick='index()']");
    await expect(indexButton).toHaveCount(1);
    await expect(indexButton).toHaveText('Index');

    // Ensure no page errors have happened just from rendering
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking Index triggers transition to Indexed (S0 -> S1) and results in a page error from missing index()', async ({ page }) => {
    // This test validates the transition described in the FSM:
    // - Clicking the button (event IndexButtonClick) attempts to run index()
    // - Because index() is not defined in the page, a ReferenceError (pageerror) should occur naturally
    const indexButton1 = page.locator("button[onclick='index()']");
    await expect(indexButton).toBeVisible();

    // Set up a promise that waits for the pageerror event, then click the button
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      indexButton.click()
    ]);

    // The runtime should throw an error because index() is not defined in the global scope.
    // We assert the error exists and its message references "index" or indicates it's not defined.
    expect(error).toBeTruthy();
    const msg = String(error.message || '');
    expect(msg.toLowerCase()).toContain('index');

    // Be permissive about wording but assert it's a reference / undefined related error
    const lower = msg.toLowerCase();
    expect(
      lower.includes('is not defined') ||
      lower.includes('referenceerror') ||
      lower.includes('not defined') ||
      lower.includes('is not a function') ||
      lower.includes('cannot')
    ).toBeTruthy();

    // FSM evidence: S1_Indexed still includes the button; verify button still exists after the failed action
    await expect(page.locator("button[onclick='index()']")).toBeVisible();

    // The FSM expected observable "Indexing process initiated." is NOT present in the real DOM/console.
    // Assert the page does not contain a textual indicator of success because the implementation lacks it.
    const successText = page.locator('text=Indexing process initiated.');
    await expect(successText).toHaveCount(0);
  });

  test('Multiple rapid clicks produce multiple page errors (edge case)', async ({ page }) => {
    // This test validates repeated triggering of the event handler when function is missing.
    // Each click should produce a pageerror since index() remains undefined.

    const indexButton2 = page.locator("button[onclick='index()']");
    await expect(indexButton).toBeVisible();

    // Do 3 rapid clicks, capturing a pageerror for each click
    const errorPromises = [];
    for (let i = 0; i < 3; i++) {
      // Prepare to wait for a pageerror before clicking to ensure we capture it
      const p = page.waitForEvent('pageerror');
      await indexButton.click();
      errorPromises.push(p);
    }

    // Await all captured errors
    const errors = await Promise.all(errorPromises);

    // We expect one error per click
    expect(errors.length).toBe(3);
    for (const err of errors) {
      expect(String(err.message).toLowerCase()).toContain('index');
    }
  });

  test('Console and error observability when interacting - ensure natural errors are visible', async ({ page }) => {
    // This test inspects console messages and page errors produced by interacting with the app.
    const indexButton3 = page.locator("button[onclick='index()']");
    await expect(indexButton).toBeVisible();

    // Trigger the page error by clicking
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      indexButton.click()
    ]);

    // Confirm the captured pageErrors array (via listener) also recorded the error
    // Note: our beforeEach listener pushes to pageErrors; ensure it captured at least one
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Validate the error shape and message content
    expect(err).toBeTruthy();
    const messageLower = String(err.message).toLowerCase();
    expect(messageLower).toContain('index');

    // Ensure there is no positive console.log indicating "Indexing process initiated."
    const foundSuccessConsole = consoleMessages.some(m => m.text && m.text.includes('Indexing process initiated.'));
    expect(foundSuccessConsole).toBeFalsy();

    // Also ensure there are no DOM nodes that claim success (defensive check)
    const successLocator = page.locator('text=Indexing process initiated.');
    await expect(successLocator).toHaveCount(0);
  });

  test('FSM state evidence persists: button remains after attempted transition (S1 evidence same as S0)', async ({ page }) => {
    // This test verifies FSM evidence for both S0_Idle and S1_Indexed which both include the same button.
    // Ensure the button exists before and after clicking (even if the action errors).
    const indexBtn = page.locator("button[onclick='index()']");
    await expect(indexBtn).toBeVisible();

    // Click and wait for the natural page error
    await Promise.all([page.waitForEvent('pageerror'), indexBtn.click()]);

    // After the click (transition attempt), the evidence for the resulting state includes the same button;
    // verify it is still present so the FSM evidence is consistent with the implementation.
    await expect(page.locator("button[onclick='index()']")).toBeVisible();
  });

});