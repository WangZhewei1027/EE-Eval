import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a330a64-ffc5-11f0-8b43-1ffa87931c43.html';

class LinearSearchPage {
  /**
   * Page object for the Linear Search demonstration
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayContainer = page.locator('#arrayContainer');
    this.arrayElements = page.locator('#arrayContainer .arrayElement');
    this.startBtn = page.locator('#startBtn');
    this.searchInput = page.locator('#searchInput');
    this.message = page.locator('#message');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial render completed
    await expect(this.arrayContainer).toBeVisible();
  }

  async enterSearchValue(value) {
    await this.searchInput.fill(String(value));
  }

  async clearSearchInput() {
    await this.searchInput.fill('');
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async getArrayValues() {
    const count = await this.arrayElements.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(Number(await this.arrayElements.nth(i).textContent()));
    }
    return values;
  }

  async getMessageText() {
    return (await this.message.textContent()) || '';
  }

  async elementHasClass(index, className) {
    return await this.arrayElements.nth(index).evaluate((el, cls) => el.classList.contains(cls), className);
  }

  async waitForMessageContains(text, timeout = 30000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        return el && el.textContent.includes(expected);
      },
      '#message',
      text,
      { timeout }
    );
  }

  async waitForExactMessage(text, timeout = 30000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        return el && el.textContent.trim() === expected;
      },
      '#message',
      text,
      { timeout }
    );
  }
}

test.describe('Linear Search Demonstration - FSM validation', () => {
  let page;
  let lp;
  let consoleErrors;
  let pageErrors;

  // Set up a fresh page and listeners for console and page errors on each test
  test.beforeEach(async ({ browser, context }) => {
    page = await context.newPage();
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // swallow listener errors
      }
    });

    // Capture runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        // swallow
      }
    });

    lp = new LinearSearchPage(page);
    await lp.goto();
  });

  test.afterEach(async () => {
    // Close page to cleanup
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('Initial state (S0_Idle): array elements exist, controls enabled, no runtime errors', async () => {
    // This test validates the initial Idle state:
    // - createArrayElements() should have created DOM elements
    // - controls should be enabled
    // - message box should be empty
    // - no console/page errors occurred on load

    // Verify number of array elements and their numeric values match the implementation array
    const values = await lp.getArrayValues();
    expect(values.length).toBe(10);
    expect(values).toEqual([7, 13, 5, 9, 20, 2, 15, 8, 10, 11]);

    // Controls enabled
    await expect(lp.startBtn).toBeEnabled();
    await expect(lp.searchInput).toBeEnabled();

    // Message empty
    const msg = await lp.getMessageText();
    expect(msg.trim()).toBe('');

    // No console errors and no page errors were emitted during load
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('StartSearch event validation: clicking Start without input shows validation and remains idle', async () => {
    // This tests the edge case where the user clicks Start Search without entering a number.
    // Expect a validation message and no change in controls (still enabled) and no runtime errors.

    await lp.clearSearchInput();
    await lp.clickStart();

    // Validation message should be displayed immediately
    await lp.waitForMessageContains('Please enter a valid number to search.', 5000);
    const msg = await lp.getMessageText();
    expect(msg).toContain('Please enter a valid number to search.');

    // Controls should remain enabled (no search started)
    await expect(lp.startBtn).toBeEnabled();
    await expect(lp.searchInput).toBeEnabled();

    // No console/page errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Transition S0 -> S1: Starting linear search observable and controls disabled', async () => {
    // This test ensures that when a valid number is provided and Start is clicked:
    // - message briefly shows 'Starting linear search...'
    // - start button and input are disabled while searching
    // - no runtime errors occur

    await lp.enterSearchValue(9); // value exists in array
    await lp.clickStart();

    // Immediately (or shortly after) the 'Starting linear search...' message is expected
    await lp.waitForMessageContains('Starting linear search...', 5000);
    const midMsg = await lp.getMessageText();
    expect(midMsg).toContain('Starting linear search...');

    // Controls should be disabled during search
    await expect(lp.startBtn).toBeDisabled();
    await expect(lp.searchInput).toBeDisabled();

    // No runtime errors so far
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Searching -> Found (S1 -> S2): value found path and visual feedback', async () => {
    // This test validates the full "found" path of the FSM:
    // - Search for a value known to be at index 3 (value 9)
    // - Wait for final message indicating found
    // - Verify the element at index 3 has class "found"
    // - Verify controls are re-enabled after completion
    // - Ensure no console/page errors

    const target = 9;
    const expectedIndex = 3;

    await lp.enterSearchValue(target);
    await lp.clickStart();

    // Wait for final found message (this may take several seconds due to intentional sleeps in the app)
    await lp.waitForExactMessage(`Value ${target} found at index ${expectedIndex}!`, 20000);

    const finalMsg = await lp.getMessageText();
    expect(finalMsg).toBe(`Value ${target} found at index ${expectedIndex}!`);

    // Verify the element at expectedIndex has the 'found' class
    const hasFoundClass = await lp.elementHasClass(expectedIndex, 'found');
    expect(hasFoundClass).toBe(true);

    // Verify controls are re-enabled after search completes
    await expect(lp.startBtn).toBeEnabled();
    await expect(lp.searchInput).toBeEnabled();

    // No runtime errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Searching -> NotFound (S1 -> S3): value not found path and visual feedback', async () => {
    // This test validates the full "not found" path of the FSM:
    // - Search for a value that does not exist in the array
    // - Wait for final "not found" message
    // - Verify last-checked element (final index) has class "notFound" per implementation
    // - Verify controls are re-enabled after completion
    // - Ensure no runtime errors

    const target = 999; // not in array
    const arrLength = await lp.arrayElements.count();
    const lastIndex = arrLength - 1;

    await lp.enterSearchValue(target);
    await lp.clickStart();

    // Wait for final NOT FOUND message; may take ~15s given internal sleeps
    await lp.waitForExactMessage(`Value ${target} not found in the array.`, 30000);

    const finalMsg = await lp.getMessageText();
    expect(finalMsg).toBe(`Value ${target} not found in the array.`);

    // Per implementation only the current element has the status class at one time.
    // After full scan the last element should have 'notFound' class.
    const lastHasNotFound = await lp.elementHasClass(lastIndex, 'notFound');
    expect(lastHasNotFound).toBe(true);

    // Controls re-enabled
    await expect(lp.startBtn).toBeEnabled();
    await expect(lp.searchInput).toBeEnabled();

    // No runtime errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('UI behavior: cannot start a new search while searching (Start ignored while disabled)', async () => {
    // This test attempts to trigger a second search while the first is underway.
    // Because the UI disables the Start button at the beginning of linearSearch, a second click should be ignored.
    // We validate by starting a search and attempting to click Start again; message should reflect the original search result.

    // Choose a value that will be found at index 6 to ensure some runtime time passes
    const firstTarget = 15; // index 6 in the array
    const secondTarget = 2; // index 5, would yield a different result if second click took effect

    await lp.enterSearchValue(firstTarget);
    await lp.clickStart();

    // Immediately attempt to click start again (the button should become disabled very quickly)
    // Use try/catch in case button becomes disabled and click throws; that's fine.
    try {
      await lp.clickStart();
    } catch (e) {
      // ignore errors from attempted click on disabled button
    }

    // Wait for the first search's completion message
    await lp.waitForExactMessage(`Value ${firstTarget} found at index 6!`, 25000);
    const finalMsg = await lp.getMessageText();
    expect(finalMsg).toBe(`Value ${firstTarget} found at index 6!`);

    // If the second click had erroneously restarted the search: message would reflect the second target.
    // Confirm the final message corresponds to the first target (i.e., the second click had no effect).
    expect(finalMsg).not.toContain(`Value ${secondTarget} found`);

    // No runtime errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Sanity: ensure legend and accessibility attributes are present', async () => {
    // Small additional checks to validate presence of ancillary components referenced in FSM components list
    await expect(page.locator('#arrayContainer')).toHaveAttribute('aria-label', 'Array elements for searching');
    await expect(page.locator('#message')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#message')).toHaveAttribute('aria-live', 'polite');

    // Legend color boxes exist
    await expect(page.locator('#legend')).toBeVisible();
    await expect(page.locator('.colorCurrent')).toBeVisible();
    await expect(page.locator('.colorFound')).toBeVisible();
    await expect(page.locator('.colorNotFound')).toBeVisible();

    // No runtime errors from these checks
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});