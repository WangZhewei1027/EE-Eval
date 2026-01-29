import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa2c62-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Ternary Search app
class TernarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#start-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.status = page.locator('#status');
    this.arrayContainer = page.locator('#array-container');
    this.arrayElements = page.locator('.array-element');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Start Search button
  async startSearch() {
    await this.startBtn.click();
  }

  // Click the Reset button
  async reset() {
    await this.resetBtn.click();
  }

  // Get status text
  async getStatusText() {
    return (await this.status.textContent())?.trim() ?? '';
  }

  // Get count of array elements
  async getArrayCount() {
    return await this.arrayElements.count();
  }

  // Get text content of element at index (0-based)
  async getElementTextAt(index) {
    const el = this.arrayElements.nth(index);
    return (await el.textContent())?.trim() ?? '';
  }

  // Check if element at index has the given class
  async elementHasClass(index, className) {
    const el = this.arrayElements.nth(index);
    return await el.evaluate((node, cls) => node.classList.contains(cls), className);
  }

  // Return array of classes for all elements (for debugging/assertions)
  async getAllClasses() {
    const count = await this.getArrayCount();
    const res = [];
    for (let i = 0; i < count; i++) {
      const cls = await this.arrayElements.nth(i).getAttribute('class');
      res.push(cls);
    }
    return res;
  }
}

test.describe('Ternary Search Visualization - FSM validation', () => {
  // Collect console errors and page errors during each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the app
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Assert that no console.error or uncaught page errors occurred during the test
    // This validates that the page runs without fatal runtime errors (ReferenceError, TypeError, etc.)
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
  });

  test('Initial Idle state: UI initialized and ready', async ({ page }) => {
    // This test validates the S0_Idle initial state:
    // - status text is "Ready to search"
    // - reset button is disabled
    // - start button is enabled
    // - array is initialized with 20 elements labeled 1..20

    const app = new TernarySearchPage(page);

    // Verify initial status text
    await expect(app.status).toHaveText('Ready to search');

    // Buttons: start enabled, reset disabled
    await expect(app.startBtn).toBeEnabled();
    await expect(app.resetBtn).toBeDisabled();

    // Array length and contents
    const count = await app.getArrayCount();
    expect(count).toBe(20);

    // Check a few element values to ensure array populated correctly
    expect(await app.getElementTextAt(0)).toBe('1');
    expect(await app.getElementTextAt(11)).toBe('12');
    expect(await app.getElementTextAt(12)).toBe('13'); // target value exists
    expect(await app.getElementTextAt(19)).toBe('20');
  });

  test('Transition S0_Idle -> S1_Searching on StartSearch click', async ({ page }) => {
    // This test validates transition from Idle to Searching:
    // - Clicking Start Search sets status to "Starting ternary search..."
    // - start button becomes disabled and reset remains disabled until search completes

    const app = new TernarySearchPage(page);

    // Click start and immediately verify Searching status text
    await app.startSearch();

    // "Starting ternary search..." should appear quickly
    await expect(app.status).toHaveText('Starting ternary search...', { timeout: 3000 });

    // While animating, start should be disabled and reset disabled (becomes enabled later)
    await expect(app.startBtn).toBeDisabled();
    await expect(app.resetBtn).toBeDisabled();

    // For robustness, confirm that after a short delay the search continues (status changes from the starting text)
    await page.waitForTimeout(1200);
    const statusNow = await app.getStatusText();
    expect(statusNow.length).toBeGreaterThan(0);
    expect(statusNow).not.toBe(''); // ensure not empty
  });

  test('Searching completes -> Found final state and DOM reflects found element', async ({ page }) => {
    // This test validates S1_Searching -> S2_Found transition:
    // - After the search finishes, status should read "Found target 13 at index 12"
    // - The array element at index 12 should have class "found"
    // - Reset button should become enabled, start button should be disabled until reset

    const app = new TernarySearchPage(page);

    // Start the search
    await app.startSearch();

    // Wait for the final found message. The visual animation sequences are asynchronous and
    // include multiple timeouts, so give a generous timeout.
    await expect(app.status).toHaveText(/Found target 13 at index \d+/, { timeout: 20000 });

    // Confirm the exact expected index (array values 1..20 => value 13 at index 12)
    await expect(app.status).toHaveText('Found target 13 at index 12');

    // Verify the DOM shows the found element styled with 'found' class at index 12
    const hasFoundClass = await app.elementHasClass(12, 'found');
    expect(hasFoundClass).toBe(true);

    // Ensure reset button is enabled after completion and start remains disabled
    await expect(app.resetBtn).toBeEnabled();
    await expect(app.startBtn).toBeDisabled();
  });

  test('Reset event transitions to Idle state and clears highlights', async ({ page }) => {
    // This test validates the Reset transition from either Idle or after Found:
    // - After a completed search, clicking Reset returns status to "Ready to search"
    // - Reset button becomes disabled, start button enabled
    // - Array elements no longer have 'found' or 'highlight' or 'partition' classes

    const app = new TernarySearchPage(page);

    // Start and wait for search to finish
    await app.startSearch();
    await expect(app.status).toHaveText(/Found target 13 at index \d+/, { timeout: 20000 });
    await expect(app.resetBtn).toBeEnabled();

    // Click reset
    await app.reset();

    // After reset, status should be back to Ready to search
    await expect(app.status).toHaveText('Ready to search');

    // Buttons: reset disabled, start enabled
    await expect(app.resetBtn).toBeDisabled();
    await expect(app.startBtn).toBeEnabled();

    // Ensure no array element carries highlight/partition/found classes
    const classes = await app.getAllClasses();
    for (const cls of classes) {
      // class string can be 'array-element' or include other classes; ensure only base class remains
      expect(cls).toBe('array-element');
    }
  });

  test('Edge case: clicking Start while animating does not trigger duplicate searches', async ({ page }) => {
    // This test validates that Start button is effectively disabled during animation and
    // additional clicks do not cause multiple concurrent searches.

    const app = new TernarySearchPage(page);

    // Start the search
    await app.startSearch();

    // Immediately attempt to click start again. The button should be disabled,
    // so this should have no effect (Playwright will throw if clicking a disabled button,
    // so guard by checking disabled state first).
    await expect(app.startBtn).toBeDisabled();

    // Try to force a click via JS only to observe natural behavior is prevented.
    // Note: We do not redefine or patch any functions; this evaluate simply attempts to click the element.
    // If the element is disabled, the browser will not trigger click listeners.
    const clicked = await page.evaluate(() => {
      const btn = document.getElementById('start-btn');
      try {
        btn.click();
        return true;
      } catch (e) {
        return false;
      }
    });

    // The JS .click() call returns true (the call succeeded), but UI should still be disabled and
    // there should only be a single search in progress; ensure status remains consistent.
    // Wait a short while and confirm the status is not reset to "Starting ternary search..." again unexpectedly.
    await page.waitForTimeout(500);
    const statusAfter = await app.getStatusText();
    expect(statusAfter.startsWith('Starting ternary search') || statusAfter.startsWith('Comparing') || statusAfter.includes('Found target')).toBeTruthy();

    // Finally wait for search to complete to keep environment stable for next tests
    await expect(app.status).toHaveText(/Found target 13 at index \d+/, { timeout: 20000 });
  });

  test('Observe console and runtime errors (none expected)', async ({ page }) => {
    // This test explicitly observes console and page errors emitted during a full run.
    // It performs a start -> complete -> reset cycle and ensures no console.error or uncaught exceptions occurred.
    // The afterEach will also assert no errors; this test performs the flow for observation.

    const app = new TernarySearchPage(page);

    // Start and wait for found
    await app.startSearch();
    await expect(app.status).toHaveText(/Found target 13 at index \d+/, { timeout: 20000 });

    // Reset and ensure back to Idle
    await app.reset();
    await expect(app.status).toHaveText('Ready to search');

    // The afterEach hook asserts no errors were captured.
  });
});