import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f2941-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Elegant Transaction Visualization - FSM validation (ed8f2941-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Will collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages emitted by the page
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // swallow listening errors; they will be asserted later if needed
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the provided HTML page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test, assert that there were no unexpected runtime errors in the page
    // This validates that SyntaxError/ReferenceError/TypeError did not occur unexpectedly
    expect(pageErrors.length, `Expected no uncaught page errors but found: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);

    // Also assert that there are no console messages with level 'error'
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length, `Expected no console.error messages but found: ${errorConsoleMsgs.map(m => m.text).join(' | ')}`).toBe(0);
  });

  test('Initial state (S0_Overview): Transaction Overview is displayed with expected components', async ({ page }) => {
    // Validate header text exists and matches the FSM evidence
    const header = await page.locator('.header');
    await expect(header).toHaveText('Transaction Overview');

    // Validate that the transaction-info block is present and displays expected content
    const txInfo = await page.locator('.transaction-info');
    await expect(txInfo).toBeVisible();
    await expect(txInfo).toContainText('Total Amount: $1,250.50');
    await expect(txInfo).toContainText('Transaction ID: #ABC123456');
    await expect(txInfo).toContainText('Date: October 5, 2023');

    // Validate both buttons exist and are visible as extracted in the FSM
    const viewDetailsBtn = page.locator('#viewDetails');
    const closeBtn = page.locator('#close');
    await expect(viewDetailsBtn).toBeVisible();
    await expect(viewDetailsBtn).toHaveText('View Details');
    await expect(closeBtn).toBeVisible();
    await expect(closeBtn).toHaveText('Close');
  });

  test('Event: ViewDetailsClick triggers an alert dialog with expected message', async ({ page }) => {
    // Prepare to capture the dialog triggered by clicking the "View Details" button
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('#viewDetails') // click triggers alert("Transaction details are displayed here.")
    ]);

    // Assert the alert message equals expected string from FSM transition actions
    expect(dialog.message()).toBe('Transaction details are displayed here.');

    // Accept (close) the dialog to allow the page to continue functioning
    await dialog.accept();

    // Ensure clicking did not produce any page errors or console.error messages
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Event: CloseClick hides the transaction overview (container) as expected', async ({ page }) => {
    // Click the Close button which should set .container style.display = 'none'
    await page.click('#close');

    // Verify that the container's inline style was changed to hide it
    const containerHandle = await page.$('.container');
    // Evaluate the computed and inline styles to verify the hiding behavior
    const displayValue = await containerHandle.evaluate(el => {
      return {
        inlineDisplay: el.style.display,
        computedDisplay: window.getComputedStyle(el).getPropertyValue('display')
      };
    });

    // The inline style should be 'none' per implementation
    expect(displayValue.inlineDisplay).toBe('none');

    // Computed display should be 'none' as well after setting inline style to 'none'
    expect(displayValue.computedDisplay).toBe('none');

    // The container should not be visible to the user
    await expect(page.locator('.container')).not.toBeVisible();

    // Verify no page errors were raised by this action
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Programmatic click of View Details after container is hidden still triggers alert', async ({ page }) => {
    // Close first to hide the container
    await page.click('#close');

    // Ensure container is hidden
    await expect(page.locator('.container')).not.toBeVisible();

    // Programmatically trigger the click on the hidden button via page.evaluate.
    // This simulates an edge case where events are invoked on hidden elements.
    const dialogPromise = page.waitForEvent('dialog');

    // Use page.evaluate to call click on the element even when hidden.
    // This does not modify application code; it merely triggers the existing event handler.
    await page.evaluate(() => {
      const btn = document.getElementById('viewDetails');
      // Defensive: if button exists, trigger click(); otherwise no-op
      if (btn) btn.click();
    });

    const dialog = await dialogPromise;

    // The alert should still show the same message per FSM transition action
    expect(dialog.message()).toBe('Transaction details are displayed here.');
    await dialog.accept();

    // Container must remain hidden after this programmatic interaction
    const computedDisplay = await page.$eval('.container', el => window.getComputedStyle(el).getPropertyValue('display'));
    expect(computedDisplay).toBe('none');

    // Confirm no uncaught page errors occurred during this edge-case flow
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case and error observation: Non-existent elements and missing handlers', async ({ page }) => {
    // Try to locate a selector that doesn't exist - this should simply return null/empty,
    // not throw errors in the page. Validate that Playwright returns no locator match.
    const nonExistent = await page.$('#nonExistentButton');
    expect(nonExistent).toBeNull();

    // Ensure that attempting to query a non-existent element did not create any page errors
    expect(pageErrors.length).toBe(0);

    // Also verify that console.error was not emitted during these queries
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('FSM invariants: Repeated interactions keep behavior stable (idempotence check)', async ({ page }) => {
    // Click View Details multiple times and ensure alert is shown each time with expected message
    for (let i = 0; i < 3; i++) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#viewDetails')
      ]);
      expect(dialog.message()).toBe('Transaction details are displayed here.');
      await dialog.accept();
    }

    // Now click Close multiple times. The first will hide the container; subsequent clicks should not throw.
    await page.click('#close');

    // After container is hidden, clicking via Playwright (which requires visibility) would fail.
    // But we can ensure that calling click on the element handle is not possible because it's hidden.
    // Attempt to click and expect Playwright to throw an error about element not visible.
    let clickThrew = false;
    try {
      await page.click('#close', { timeout: 1000 });
    } catch (e) {
      clickThrew = true;
      // We expect an error complaining about element not visible or detached; assert it's a Playwright error
      expect(e.message).toMatch(/element|not visible|not attached|is not visible|Timeout/);
    }
    expect(clickThrew).toBe(true);

    // Confirm no uncaught runtime page errors during repeated interactions
    expect(pageErrors.length).toBe(0);
  });
});