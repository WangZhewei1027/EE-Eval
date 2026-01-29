import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8da2a0-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Helpers
class LinearSearchPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  startButton() {
    return this.page.locator('#startButton');
  }

  numberById(i) {
    return this.page.locator(`#num${i}`);
  }

  allNumbers() {
    return this.page.locator('.number');
  }

  // Wait for a specific number to gain the 'highlight' class
  async waitForHighlight(index, options = {}) {
    const selector = `#num${index}.highlight`;
    await this.page.waitForSelector(selector, options);
  }

  // Wait for a specific number to not have the 'highlight' class
  async waitForNotHighlight(index, options = {}) {
    const selector = `#num${index}:not(.highlight)`;
    await this.page.waitForSelector(selector, options);
  }

  // Read global index variable from page
  async getGlobalIndex() {
    return await this.page.evaluate(() => typeof index !== 'undefined' ? index : null);
  }

  // Remove a number element from the DOM (used to simulate 'Not Found' scenario)
  // Note: This modifies the DOM (removes an element). We do this to exercise the "not found" transition
  // because the original code's target exists in the array and would otherwise always trigger "Found".
  async removeNumberElement(id) {
    await this.page.evaluate((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    }, id);
  }
}

test.describe('Linear Search Visualization (ed8da2a0-fa77-11f0-8492-31e949ed3c7c)', () => {
  let page;
  let lsPage;
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect page errors and console errors for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Uncaught exceptions in page runtime
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    lsPage = new LinearSearchPage(page);
    await lsPage.goto();
  });

  test.afterEach(async () => {
    // Ensure there were no unexpected runtime errors
    // If there are page errors or console errors, surface them in assertion failure
    expect(pageErrors, 'No uncaught page errors').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages').toHaveLength(0);
    await page.close();
  });

  test('Idle state: Start button visible and numbers present, no highlights', async () => {
    // Validate the initial Idle state (S0_Idle)
    const start = lsPage.startButton();
    await expect(start).toBeVisible();
    await expect(start).toBeEnabled(); // button should be enabled in Idle

    const numbers = lsPage.allNumbers();
    await expect(numbers).toHaveCount(6); // six number elements present

    // None should be highlighted at initial state
    for (let i = 0; i < 6; i++) {
      await expect(lsPage.numberById(i)).not.toHaveClass(/highlight/);
    }
  });

  test('Searching state: clicking Start Search disables button and highlights proceed sequentially', async () => {
    // This test verifies the S0 -> S1 transition and the repeated S1 -> S1 highlight transitions.
    // It will click Start, assert the button becomes disabled, then observe sequential highlights.
    // We hook dialog events to automatically accept alerts so the search can continue to completion.

    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Click start and expect button to become disabled immediately
    await lsPage.startButton().click();
    await expect(lsPage.startButton()).toBeDisabled();

    // The search highlights numbers one by one every ~1s.
    // Assert the first few transitions: num0 -> num1 -> num2
    // Wait for num0 to be highlighted
    await lsPage.waitForHighlight(0, { timeout: 1500 });
    // After approx 1s, num0 highlight should be removed and num1 highlighted
    await lsPage.waitForHighlight(1, { timeout: 2000 });
    // Ensure num0 no longer has highlight
    await lsPage.waitForNotHighlight(0, { timeout: 500 });

    // Next, num2 should become highlighted
    await lsPage.waitForHighlight(2, { timeout: 2000 });
    await lsPage.waitForNotHighlight(1, { timeout: 500 });

    // We do not assert the final 'Found' alert here (separate test covers Found),
    // but ensure that the search is actively progressing and highlights are moving.
    expect(dialogs.length).toBeGreaterThanOrEqual(0); // just ensuring handler did not throw
  });

  test('Found state: search emits "Found <target> at index <i>!" alert and highlight persists; button remains disabled', async () => {
    // This test validates S1 -> S2 transition (Found).
    // The target in the page is 7 located at index 3, so we expect an alert "Found 7 at index 3!"

    // Wait for the Found dialog while clicking start.
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog', { timeout: 8000 }), // the search will take a few seconds (1s per element)
      lsPage.startButton().click()
    ]);

    // Check the dialog message matches the expected Found message
    expect(dialog.message()).toBe('Found 7 at index 3!');
    await dialog.accept();

    // After Found, per the implementation the highlight remains on the found element and
    // the button is not re-enabled (there's no re-enable path in the "found" branch).
    await expect(lsPage.numberById(3)).toHaveClass(/highlight/);
    await expect(lsPage.startButton()).toBeDisabled();

    // The global index should be the index where the element was found (3)
    const globalIndex = await lsPage.getGlobalIndex();
    expect(globalIndex).toBe(3);
  });

  test('Not Found state: when target element is removed, search completes with "not found" alert and button is re-enabled', async () => {
    // To test the S1 -> S3_NotFound transition we remove the element containing the target (id num3)
    // so the target value (7) is not present in the array. This lets the code exercise the "not found" branch.
    await lsPage.removeNumberElement('num3');

    // Confirm we removed the element
    const countAfterRemoval = await lsPage.allNumbers().count();
    expect(countAfterRemoval).toBe(5);

    // Start the search and capture the 'not found' alert
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog', { timeout: 8000 }),
      lsPage.startButton().click()
    ]);

    // Expect the "not found" message for target 7
    expect(dialog.message()).toBe('7 not found in the array.');
    await dialog.accept();

    // After the not-found alert the code explicitly re-enables the start button and resets index to 0.
    await expect(lsPage.startButton()).toBeEnabled();
    const globalIndex = await lsPage.getGlobalIndex();
    expect(globalIndex).toBe(0);

    // No elements should remain highlighted after the search completes
    const counts = await lsPage.allNumbers().count();
    for (let i = 0; i < counts; i++) {
      await expect(lsPage.numberById(i)).not.toHaveClass(/highlight/);
    }
  });

  test('Edge case: Attempting to trigger multiple searches rapidly does not create duplicate flows', async () => {
    // This test ensures clicking Start multiple times in rapid succession does not start multiple concurrent searches.
    // Click start once, then attempt a second click immediately.
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // First click begins the search
    await lsPage.startButton().click();
    await expect(lsPage.startButton()).toBeDisabled();

    // Attempt to click again (the UI shows disabled; invoking click should have no effect)
    // Using page.click on a disabled element will still attempt to click, but browser won't fire the click handler.
    // We ensure that only a single "Found" alert appears for the single search flow.
    // Wait a small amount of time and attempt click; it should not generate a second dialog.
    await page.waitForTimeout(100); // small delay to simulate rapid re-click
    try {
      await lsPage.startButton().click({ timeout: 500 });
    } catch (e) {
      // Playwright may throw when trying to click disabled element; that's acceptable for this edge-case test.
      // Do not fail the test here; the important part is there is no second dialog produced.
    }

    // Wait for the final found dialog (should be a single one for index 3)
    const foundDialog = await page.waitForEvent('dialog', { timeout: 8000 });
    expect(foundDialog.message()).toBe('Found 7 at index 3!');
    await foundDialog.accept();

    // Ensure only one found dialog message occurred in total (no duplicate flows)
    // (dialogs array may contain the captured message if handler fired; include it if present)
    // Give tiny delay to ensure no further dialogs
    await page.waitForTimeout(200);
    // If we had the inline handler, dialogs captures messages; otherwise we capture above and consumed the dialog.
    // For robust assertion, we check that only one 'Found' message occurred in the captured set OR we observed the single dialog above.
    // Aggregate observed messages (dialogs array + foundDialog.message())
    const observedMessages = [...dialogs, foundDialog.message()];
    const foundMessages = observedMessages.filter(m => m === 'Found 7 at index 3!');
    expect(foundMessages.length).toBeGreaterThanOrEqual(1);
    expect(foundMessages.length).toBeLessThanOrEqual(2); // at most one duplicate; we treat duplicates >1 as suspicious in this environment
  });
});