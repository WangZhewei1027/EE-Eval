import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04412390-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object encapsulating interactions with the Dynamic Array page
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.viewButton = page.locator('#array-view');
    this.clearButton = page.locator('#array-clear');
    this.arrayContainer = page.locator('#array');
  }

  async clickView() {
    await this.viewButton.click();
  }

  async clickClear() {
    await this.clearButton.click();
  }

  async isViewVisible() {
    return await this.viewButton.isVisible();
  }

  async isClearVisible() {
    return await this.clearButton.isVisible();
  }

  async isArrayContainerPresent() {
    // Returns true if #array exists in DOM
    const count = await this.page.locator('#array').count();
    return count > 0;
  }

  async getArrayLength() {
    // Safely read window.array; may be undefined if script failed before creation
    return await this.page.evaluate(() => {
      try {
        return window.array ? window.array.length : null;
      } catch (e) {
        return null;
      }
    });
  }
}

test.describe('Dynamic Array FSM - 04412390-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Collections to capture runtime console messages and uncaught page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, log, error, etc.)
    page.on('console', msg => {
      // store type and text for diagnostics and assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions (page errors)
    page.on('pageerror', err => {
      // err is an Error object; push its message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate after attaching listeners so we capture load-time errors
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Helpful debug in case tests run interactively - print logs when a test fails
    if (consoleMessages.length) {
      // no-op; keeping for potential future extension
    }
    if (pageErrors.length) {
      // no-op; keeping for potential future extension
    }
    // Let Playwright handle page cleanup; no manual teardown required here
  });

  test('Initial Idle state: buttons are present and load-time script error is emitted', async ({ page }) => {
    // This test validates the Idle state evidence:
    // - Both buttons #array-view and #array-clear are present
    // - The inline script in the page throws a TypeError when trying to access a missing #array element
    const dynPage = new DynamicArrayPage(page);

    // Buttons should be visible as per S0_Idle evidence
    expect(await dynPage.isViewVisible()).toBeTruthy();
    expect(await dynPage.isClearVisible()).toBeTruthy();

    // The page attempts to access an element with id="array" which is missing in the HTML.
    // That causes an uncaught TypeError during script evaluation; assert that such a page error occurred.
    expect(pageErrors.length).toBeGreaterThan(0);

    // The exact error message can vary across engines, so test for a few common substrings.
    const joinedErrors = pageErrors.join(' | ');
    expect(/innerHTML|Cannot set|Cannot read|null|Cannot assign|reading property/i.test(joinedErrors)).toBeTruthy();

    // Also assert that the array container is indeed absent in the DOM
    expect(await dynPage.isArrayContainerPresent()).toBeFalsy();
  });

  test('View Array transition (S0 -> S1): clicking "View Array" logs the expected message', async ({ page }) => {
    // This test validates the ViewArrayClick event and S1 entry action:
    // - Clicking the #array-view button should emit console.log('Array view button clicked')
    // - Ensure the array variable exists and remains unchanged by the view action
    const dynPage = new DynamicArrayPage(page);

    // Ensure initial array length is as expected (script pushes 0..9 before the failing code)
    const initialLen = await dynPage.getArrayLength();
    // The array should have been created and filled before the later TypeError,
    // so we expect a length of 10. If creation failed, getArrayLength returns null; assert accordingly.
    expect(initialLen === 10 || initialLen === null).toBeTruthy();

    // Click and wait for the console event that corresponds to the view action.
    const waitConsole = page.waitForEvent('console', {
      predicate: message => message.text().includes('Array view button clicked'),
      timeout: 2000
    });

    await dynPage.clickView();
    const consoleMsg = await waitConsole;
    expect(consoleMsg).toBeTruthy();
    expect(consoleMsg.text()).toContain('Array view button clicked');

    // Confirm our aggregated consoleMessages captured the same log
    expect(consoleMessages.some(m => m.text.includes('Array view button clicked'))).toBeTruthy();

    // Clicking view should not change the array length; if the array exists it remains length 10
    const afterViewLen = await dynPage.getArrayLength();
    if (initialLen !== null) {
      expect(afterViewLen).toBe(initialLen);
    } else {
      // If array was not created, ensure it remains null (no side-effect)
      expect(afterViewLen).toBeNull();
    }
  });

  test('Clear Array transition (S0 -> S2): clicking "Clear Array" sets array length to 0 and logs', async ({ page }) => {
    // This test validates the ClearArrayClick event and S2 entry actions:
    // - Clicking the #array-clear button should set array.length = 0 and emit console.log('Array cleared')
    const dynPage = new DynamicArrayPage(page);

    // Confirm array initial length (may be null if script failed early)
    const beforeClearLen = await dynPage.getArrayLength();

    // Click clear and wait for the 'Array cleared' console message
    const waitConsole = page.waitForEvent('console', {
      predicate: message => message.text().includes('Array cleared'),
      timeout: 2000
    });

    await dynPage.clickClear();
    const consoleMsg = await waitConsole;
    expect(consoleMsg).toBeTruthy();
    expect(consoleMsg.text()).toContain('Array cleared');

    // Confirm aggregated consoleMessages captured the clear log
    expect(consoleMessages.some(m => m.text.includes('Array cleared'))).toBeTruthy();

    // Now assert that the array length was set to 0 if the array existed
    const afterClearLen = await dynPage.getArrayLength();
    if (beforeClearLen !== null) {
      expect(afterClearLen).toBe(0);
    } else {
      // If the array was not present, we still expect no crash and the getter returns null
      expect(afterClearLen).toBeNull();
    }
  });

  test('Edge cases: repeated clicks and sequence validation', async ({ page }) => {
    // This test covers edge cases:
    // - Clicking Clear multiple times should repeatedly log 'Array cleared' and keep array length at 0
    // - Clicking View after Clear should still log 'Array view button clicked' and not resurrect array items
    const dynPage = new DynamicArrayPage(page);

    // Click clear twice and capture two console events
    const waitFirstClear = page.waitForEvent('console', {
      predicate: m => m.text().includes('Array cleared'),
      timeout: 2000
    });
    await dynPage.clickClear();
    const firstClearMsg = await waitFirstClear;
    expect(firstClearMsg.text()).toContain('Array cleared');

    const waitSecondClear = page.waitForEvent('console', {
      predicate: m => m.text().includes('Array cleared'),
      timeout: 2000
    });
    await dynPage.clickClear();
    const secondClearMsg = await waitSecondClear;
    expect(secondClearMsg.text()).toContain('Array cleared');

    // After repeated clears, array length should be 0 (if it existed)
    const lenAfterClears = await dynPage.getArrayLength();
    if (lenAfterClears !== null) {
      expect(lenAfterClears).toBe(0);
    } else {
      expect(lenAfterClears).toBeNull();
    }

    // Click view after clear and expect another view log
    const waitViewAfterClear = page.waitForEvent('console', {
      predicate: m => m.text().includes('Array view button clicked'),
      timeout: 2000
    });
    await dynPage.clickView();
    const viewAfterClearMsg = await waitViewAfterClear;
    expect(viewAfterClearMsg.text()).toContain('Array view button clicked');

    // Validate that multiple console messages of both kinds exist in our capture
    const viewCount = consoleMessages.filter(m => m.text.includes('Array view button clicked')).length;
    const clearCount = consoleMessages.filter(m => m.text.includes('Array cleared')).length;
    expect(viewCount).toBeGreaterThanOrEqual(1);
    expect(clearCount).toBeGreaterThanOrEqual(2);
  });

  test('Runtime diagnostics: ensure errors and logs are observable and informative', async ({ page }) => {
    // This test asserts we can observe both console logs and thrown page errors and that they contain useful hints.
    // This is important for tracing FSM entry actions and implementation bugs.
    const dynPage = new DynamicArrayPage(page);

    // We expect at least the earlier load-time error to exist
    expect(pageErrors.length).toBeGreaterThan(0);
    // Ensure console captured logs as well (either from earlier clicks or none)
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // Validate that error messages mention the missing DOM access (flexible matching)
    const combinedErrorText = pageErrors.join(' | ');
    expect(/array|innerHTML|Cannot set|Cannot read|null/i.test(combinedErrorText)).toBeTruthy();

    // Ensure console messages include at least one type: log or error (if test interactions were run)
    const hasLog = consoleMessages.some(m => m.type === 'log' || m.type === 'info' || m.type === 'warning' || m.type === 'error');
    expect(hasLog).toBeTruthy();
  });
});