import { test, expect } from '@playwright/test';

// Test file for application ID: f5b0f8b1-fa7c-11f0-adc7-178f556b1ee0
// This suite validates the FSM states and transitions for the Jump Search interactive page.
// Important: The page's script expects #target and #list inputs which are NOT present in the HTML.
// Per instructions, we must not modify the page; instead we observe natural runtime errors
// and assert that they occur as part of edge-case validation.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0f8b1-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Jump Search page
class JumpSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#jump-search-button');
    this.targetInput = page.locator('#target');
    this.listInput = page.locator('#list');
  }

  // Click the "Try Jump Search" button
  async clickTry() {
    await this.button.click();
  }

  // Returns true if target input exists in the DOM
  async hasTargetInput() {
    return (await this.targetInput.count()) > 0;
  }

  // Returns true if list input exists in the DOM
  async hasListInput() {
    return (await this.listInput.count()) > 0;
  }
}

test.describe('Jump Search FSM and interactive behavior', () => {
  // Arrays to collect console messages and page errors during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // capture text to an array for assertions
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Collect page errors (unhandled exceptions in page)
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Clean up listeners to avoid cross-test interference
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial Idle state: page renders "Try Jump Search" button', async ({ page }) => {
    // This test validates the S0_Idle state: the button exists on initial render.
    const jumpPage = new JumpSearchPage(page);

    // Button should be visible and contain the expected text.
    await expect(jumpPage.button).toBeVisible();
    await expect(jumpPage.button).toHaveText('Try Jump Search');

    // The FSM's entry action renderPage() is represented by the presence of the UI.
    // We cannot assert the existence of renderPage() function itself; we assert the visible evidence.
    // Also assert that the expected input fields are NOT present (edge case in this implementation).
    await expect(jumpPage.targetInput).toHaveCount(0);
    await expect(jumpPage.listInput).toHaveCount(0);
  });

  test('Transition to Searching on click triggers a runtime error due to missing inputs', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Searching triggered by clicking the button.
    // The page script attempts to read #target and #list which are missing, so we expect a TypeError (pageerror).
    const jumpPage = new JumpSearchPage(page);

    // Sanity: ensure button exists before clicking
    await expect(jumpPage.button).toBeVisible();

    // Click and wait for a pageerror event to be emitted.
    // We use Promise.all to ensure click happens and we wait for the error that should result.
    const pageErrorPromise = page.waitForEvent('pageerror');
    await jumpPage.clickTry();
    const error = await pageErrorPromise;

    // The runtime error should be a TypeError caused by attempting to access .value of null.
    // Different engines have slightly different messages; assert that the message references 'value'.
    expect(error).toBeTruthy();
    expect(typeof error.message).toBe('string');
    expect(error.message.toLowerCase()).toContain('value');

    // Ensure that no successful "Found target" or "Target ... not found" console logs were emitted,
    // because the script failed before those console.log calls could run.
    const combinedConsole = consoleMessages.join('\n');
    expect(combinedConsole).not.toContain('Found target');
    expect(combinedConsole).not.toMatch(/Target .* not found/);
  });

  test('Clicking multiple times produces repeated page errors and no successful search logs', async ({ page }) => {
    // This test validates repeated event handling and ensures consistent error behavior on multiple clicks.
    const jumpPage = new JumpSearchPage(page);

    // First click: wait for first error
    const firstErrorPromise = page.waitForEvent('pageerror');
    await jumpPage.clickTry();
    const firstError = await firstErrorPromise;
    expect(firstError).toBeTruthy();
    expect(firstError.message.toLowerCase()).toContain('value');

    // Second click: wait for second error
    const secondErrorPromise = page.waitForEvent('pageerror');
    await jumpPage.clickTry();
    const secondError = await secondErrorPromise;
    expect(secondError).toBeTruthy();
    expect(secondError.message.toLowerCase()).toContain('value');

    // At least two page errors should have been recorded in our pageErrors collection
    // (page.on handler also populates pageErrors array)
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);

    // No console "Found target" messages should be present
    const foundMessages = consoleMessages.filter(m => m.includes('Found target'));
    expect(foundMessages.length).toBe(0);
  });

  test('Edge case: verify that inputs are absent and clicking without inputs is handled by the runtime (error observed)', async ({ page }) => {
    // This test explicitly checks the absence of #target and #list and documents the behavior when clicked.
    const jumpPage = new JumpSearchPage(page);

    // Ensure inputs are absent
    expect(await jumpPage.hasTargetInput()).toBe(false);
    expect(await jumpPage.hasListInput()).toBe(false);

    // Click and capture the pageerror; assert on the error's stack/message shape to confirm it's due to missing DOM nodes.
    const errorPromise = page.waitForEvent('pageerror');
    await jumpPage.clickTry();
    const err = await errorPromise;
    // Confirm it's an error about reading properties of null/undefined (we check for 'null' or 'cannot' or 'reading')
    const msg = err.message.toLowerCase();
    const indicative = msg.includes('null') || msg.includes('cannot') || msg.includes('reading') || msg.includes('value');
    expect(indicative).toBe(true);
  });

  test('No unexpected console errors or logs occur on initial page load (before interaction)', async ({ page }) => {
    // This test ensures the page doesn't emit console errors on initial load (some runtime issues happen only after click).
    // We assert that there were no page errors prior to interaction.
    expect(pageErrors.length).toBe(0);

    // Console may contain informational logs; ensure it does not contain Jump Search result messages before any click.
    const joined = consoleMessages.join('\n');
    expect(joined).not.toContain('Found target');
    expect(joined).not.toMatch(/Target .* not found/);
  });
});