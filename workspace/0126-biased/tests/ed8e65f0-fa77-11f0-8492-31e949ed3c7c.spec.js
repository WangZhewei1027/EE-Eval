import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e65f0-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Space Complexity Visualization - ed8e65f0-fa77-11f0-8492-31e949ed3c7c', () => {
  // Shared arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (logs, warnings, errors) for later inspection.
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors (e.g., ReferenceError, TypeError).
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Clear collections to avoid cross-test leakage (not strictly necessary in this simple suite)
    consoleMessages = [];
    pageErrors = [];
  });

  // Test the initial "Idle" state (S0_Idle) rendering and evidence presence.
  test('Initial Idle state renders correctly with expected DOM elements', async ({ page }) => {
    // Validate the page title/header is present and correct (evidence for S0_Idle)
    const h1 = await page.locator('h1');
    await expect(h1).toHaveText('Space Complexity');

    // Validate the primary action button exists and has correct label
    const revealBtn = page.locator('#revealBtn');
    await expect(revealBtn).toBeVisible();
    await expect(revealBtn).toHaveText('Reveal the Concepts');

    // Validate visual components (boxes) exist with expected inner text
    const bigBoxInner = page.locator('.box.big .inner.big');
    const mediumBoxInner = page.locator('.box.medium .inner.medium');
    const smallBoxInner = page.locator('.box.small .inner.small');

    await expect(bigBoxInner).toBeVisible();
    await expect(bigBoxInner).toHaveText('O(n^2)');

    await expect(mediumBoxInner).toBeVisible();
    await expect(mediumBoxInner).toHaveText('O(n log n)');

    await expect(smallBoxInner).toBeVisible();
    await expect(smallBoxInner).toHaveText('O(n)');

    // Validate description paragraph exists
    const description = page.locator('.description p');
    await expect(description).toBeVisible();
    await expect(description).toContainText('Observe how different algorithms utilize space');

    // Verify that there are no uncaught page errors upon initial render
    expect(pageErrors.length, `Expected no page errors on initial load, but got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Check for console.error messages (none expected)
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages on initial load, got: ${JSON.stringify(consoleErrors)}`).toBe(0);

    // Verify that a function named renderPage is NOT defined on the window (FSM mentioned renderPage() as an entry action,
    // but the implementation does not define it — we assert its absence rather than attempt to call it)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  // Test the RevealConcepts event/transition: clicking the button should trigger an alert dialog
  test('RevealConcepts transition: clicking the button displays the expected alert (S0 -> S1)', async ({ page }) => {
    const expectedAlertText = 'Space Complexity measures the amount of memory space required by an algorithm as a function of the input size.';

    // Ensure the onclick handler is present and contains the expected alert text
    const onclickType = await page.evaluate(() => typeof document.getElementById('revealBtn').onclick);
    expect(onclickType).toBe('function');

    // Check the string source of the onclick handler to ensure it references the expected message
    const onclickSource = await page.evaluate(() => document.getElementById('revealBtn').onclick.toString());
    expect(onclickSource).toContain(expectedAlertText);

    // Wait for the dialog event that should be triggered by the click
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#revealBtn'),
    ]);

    // Validate dialog message and accept it (this represents transition to S1_Concept_Revealed)
    expect(dialog.message()).toBe(expectedAlertText);
    await dialog.accept();

    // After the alert, assert there are still no uncaught page errors
    expect(pageErrors.length, `Unexpected page errors after clicking reveal: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  // Edge case: clicking the reveal button multiple times should produce multiple alerts; ensure each dialog appears and can be accepted.
  test('Clicking the reveal button multiple times triggers multiple alerts', async ({ page }) => {
    const expectedAlertText = 'Space Complexity measures the amount of memory space required by an algorithm as a function of the input size.';

    // Click twice and capture two dialog events sequentially
    const dialog1Promise = page.waitForEvent('dialog');
    await page.click('#revealBtn');
    const dialog1 = await dialog1Promise;
    expect(dialog1.message()).toBe(expectedAlertText);
    await dialog1.accept();

    const dialog2Promise = page.waitForEvent('dialog');
    await page.click('#revealBtn');
    const dialog2 = await dialog2Promise;
    expect(dialog2.message()).toBe(expectedAlertText);
    await dialog2.accept();

    // Ensure no page errors after repeated interactions
    expect(pageErrors.length, `Unexpected page errors after repeated clicks: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  // Test keyboard accessibility: pressing Enter while the button is focused should activate it and show the alert.
  test('Keyboard activation (Enter) triggers the same alert as clicking', async ({ page }) => {
    const expectedAlertText = 'Space Complexity measures the amount of memory space required by an algorithm as a function of the input size.';

    // Focus the button and press Enter; wait for dialog
    await page.focus('#revealBtn');
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.keyboard.press('Enter'),
    ]);

    expect(dialog.message()).toBe(expectedAlertText);
    await dialog.accept();

    // Confirm no page errors were thrown
    expect(pageErrors.length, `Unexpected page errors after keyboard activation: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  // Observability test: ensure no unexpected console.error or uncaught exceptions occurred during the suite interactions
  test('Console and pageerror observability - no unexpected errors or uncaught exceptions', async ({ page }) => {
    // This test assumes previous interactions may have produced console messages collected in beforeEach.
    // Re-check the page once more to ensure basic interactions still function without errors.
    const revealBtn = page.locator('#revealBtn');
    await expect(revealBtn).toBeVisible();

    // No console.error messages expected
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    expect(consoleErrors.length, `Found console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);

    // No uncaught page errors expected
    expect(pageErrors.length, `Found page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  // Defensive test: verify the onclick property points to a function that invokes alert (by checking the string contains 'alert(')
  test('Onclick handler source contains an alert invocation', async ({ page }) => {
    const onclickSource = await page.evaluate(() => document.getElementById('revealBtn').onclick.toString());
    expect(onclickSource).toContain('alert(');
  });
});