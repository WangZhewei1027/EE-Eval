import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8da2a2-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Jump Search page
class JumpSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      startButton: '#startButton',
      arrayContainer: '#arrayContainer',
      elementItems: '.element',
      highlighted: '.element.highlight',
      title: 'h1'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getElementCount() {
    return this.page.$$eval(this.selectors.elementItems, els => els.length);
  }

  async getElementTexts() {
    return this.page.$$eval(this.selectors.elementItems, els => els.map(e => e.innerText.trim()));
  }

  async clickStart() {
    await this.page.click(this.selectors.startButton);
  }

  async waitForAnyHighlight(timeout = 3000) {
    // Wait for a highlight to appear (Search "onEntry" visual feedback)
    return this.page.waitForSelector(this.selectors.highlighted, { state: 'attached', timeout });
  }

  async waitForNoHighlights(timeout = 3000) {
    return this.page.waitForSelector(this.selectors.highlighted, { state: 'detached', timeout });
  }

  async isTitleVisible() {
    return this.page.isVisible(this.selectors.title);
  }
}

test.describe('Jump Search Visualization - FSM tests', () => {
  // collectors for console and page errors to validate error scenarios
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // collect console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // collect uncaught exceptions
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // automatically accept dialogs but record messages
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      try {
        await dialog.accept();
      } catch (e) {
        // ignore accept errors (Playwright may throw if dialog already handled)
      }
    });

    // navigate to the app page
    await page.goto(APP_URL);
  });

  test('S0 Idle: On initial load visualizeArray() populates the array (Idle state)', async ({ page }) => {
    // Validate initial Idle state: array should be visualized with expected number of elements and values
    const app = new JumpSearchPage(page);

    // Title present (UI sanity)
    expect(await app.isTitleVisible()).toBe(true);

    // The initial script calls visualizeArray() on load. We expect 13 elements with the known values.
    const elements = await app.getElementTexts();

    // Expected array as per the HTML implementation
    const expected = ['1', '3', '5', '7', '9', '11', '13', '15', '17', '19', '21', '23', '25'];

    expect(elements.length).toBe(expected.length);
    expect(elements).toEqual(expected);

    // No element should be highlighted in the Idle state
    const highlighted = await page.$$('.element.highlight');
    expect(highlighted.length).toBe(0);

    // Ensure no runtime page errors or console.error have occurred on initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1 Searching -> S3 ElementNotFound: StartJumpSearch triggers searching and results in "not found" alert', async ({ page }) => {
    // This test validates:
    // - Clicking the Start button triggers the Searching state (visual highlights appear)
    // - Since the implementation's jump step is non-integer, the algorithm ends up NOT finding the element in this code path
    // - A dialog with "Element 19 not found" is shown (transition to ElementNotFound)
    const app = new JumpSearchPage(page);

    // Ensure we begin from a known state: the UI has elements
    const initialCount = await app.getElementCount();
    expect(initialCount).toBeGreaterThan(0);

    // Click the start button to trigger the jump search
    // The implementation clears and re-visualizes the array, then runs jumpSearch()
    await app.clickStart();

    // During Searching state we expect at least one highlight to appear briefly.
    // Wait for the highlight to appear (entry visual feedback)
    await app.waitForAnyHighlight(2000);

    // Also wait for highlight to be removed (exit visual for that step)
    // Note: The implementation highlights then removes for the first step; this confirms active searching behavior
    await app.waitForNoHighlights(2000);

    // Wait for the alert/dialog to appear indicating result (found or not found)
    // The page dialog handler records messages in `dialogs` array; wait until at least one is recorded
    await page.waitForFunction(() => window.__playwright_dialogs_recorded !== false, { timeout: 1 }).catch(() => {
      // Defensive: the above is just to no-op if not set. We will instead poll the recorded `dialogs` variable via evaluate.
    });

    // Since we recorded dialogs via page.on('dialog'), ensure at least one dialog was recorded
    // The implementation should produce "Element 19 not found"
    // Give some time for the dialog to be delivered if not yet captured
    await page.waitForTimeout(600); // jumpSearch uses delays; allow for dialog to appear

    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    // Assert that none of the dialogs claim the element was found (this implementation path produces "not found")
    const foundDialog = dialogs.find(msg => /found at index/i.test(msg));
    expect(foundDialog).toBeUndefined();

    // Assert presence of the expected "not found" message for x = 19
    const notFoundDialog = dialogs.find(msg => msg.includes('Element 19 not found'));
    expect(notFoundDialog).toBeDefined();

    // Verify arrayContainer was re-populated (start button clears and visualizes again)
    const afterCount = await app.getElementCount();
    expect(afterCount).toBe(initialCount); // should be same number after re-visualize

    // Confirm no uncaught exceptions or console errors occurred during the search run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Rapid repeated clicks cause multiple search runs and multiple alerts (robustness)', async ({ page }) => {
    // This test validates resilience to repeated Start events (multiple transitions S0 -> S1)
    // It asserts that multiple dialogs are produced and handled without uncaught exceptions.
    const app = new JumpSearchPage(page);

    // Clear any dialogs recorded so far
    dialogs.length = 0;

    // Click start twice in quick succession to simulate rapid user interaction
    await Promise.all([
      app.clickStart(),
      app.clickStart()
    ]);

    // Allow enough time for both runs to produce dialogs
    await page.waitForTimeout(1200);

    // We expect at least two dialogs since jumpSearch is started twice
    expect(dialogs.length).toBeGreaterThanOrEqual(2);

    // Verify each dialog carries the "not found" message for the configured x value
    const allNotFound = dialogs.every(msg => msg.includes('Element 19 not found'));
    expect(allNotFound).toBe(true);

    // Ensure no runtime page errors were generated during concurrent runs
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM completeness checks: Validate visibility of FSM states and transitions as observed', async ({ page }) => {
    // This test ties the FSM description to observed behavior:
    // - S0 (Idle): initial array rendered (visualizeArray called on load)
    // - S1 (Searching): upon StartJumpSearch, highlighting visual feedback occurs (onEnter jumpSearch)
    // - S2 (ElementFound): Not reachable with current code path; assert it did NOT occur
    // - S3 (ElementNotFound): Asserted via dialog message in previous tests

    const app = new JumpSearchPage(page);

    // Confirm Idle visual state
    const idleCount = await app.getElementCount();
    expect(idleCount).toBe(13);

    // Trigger searching once
    await app.clickStart();

    // Wait for highlight and then removal to confirm Searching occurred
    await app.waitForAnyHighlight(2000);
    await app.waitForNoHighlights(2000);

    // Wait briefly for dialog
    await page.waitForTimeout(600);

    // Check dialogs for "not found"
    const hasNotFound = dialogs.some(m => m.includes('Element 19 not found'));
    expect(hasNotFound).toBe(true);

    // Confirm there is no evidence of "found" transition (S2) in dialogs
    const hasFound = dialogs.some(m => /Element 19 found at index \d+/.test(m));
    expect(hasFound).toBe(false);

    // Also assert that the onEnter action visualizeArray() is observable by checking elements exist after transitions
    const afterCount = await app.getElementCount();
    expect(afterCount).toBe(idleCount);

    // Confirm no uncaught exceptions or console.error messages
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Final safety checks after each test run:
    // Ensure no lingering dialogs are open (Playwright auto-accepts them via handler),
    // and no new uncaught exceptions occurred.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Basic sanity: page should still be reachable and title visible
    const title = await page.title();
    expect(title).toContain('Jump Search Visualization');
  });
});