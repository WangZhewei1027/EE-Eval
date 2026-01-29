import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ebf55-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the paging application
class PagingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.itemsSelector = '#itemsContainer .item';
    this.prevBtn = '#prevBtn';
    this.nextBtn = '#nextBtn';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial items to be rendered
    await this.page.waitForSelector(this.itemsSelector);
  }

  async clickNext() {
    return this.page.click(this.nextBtn);
  }

  async clickPrev() {
    return this.page.click(this.prevBtn);
  }

  async isPrevDisabled() {
    return this.page.$eval(this.prevBtn, (btn) => btn.disabled);
  }

  async isNextDisabled() {
    return this.page.$eval(this.nextBtn, (btn) => btn.disabled);
  }

  async getItemsText() {
    return this.page.$$eval(this.itemsSelector, (els) => els.map(e => e.textContent.trim()));
  }

  async getCurrentPage() {
    // Access the global variable currentPage created by the page script
    return this.page.evaluate(() => window.currentPage);
  }
}

test.describe('Paging Example - FSM validation and transitions', () => {
  // Containers for console messages and page errors observed during each test
  let consoleErrors;
  let pageErrors;

  // Attach listeners for console and page errors before each test and clear after each
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : undefined
          });
        }
      } catch (e) {
        // Defensive: if something goes wrong reading msg, still record it
        consoleErrors.push({ text: 'unreadable console message' });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });
  });

  test.afterEach(async () => {
    // After each test assert that no console errors or page errors were emitted.
    // This validates that running the app as-is didn't produce runtime errors.
    expect(consoleErrors, 'No console.error messages should occur').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
  });

  test('Initial state (Page 1) displays first 5 items and prev disabled', async ({ page }) => {
    // This test validates the initial FSM state S1_Page1:
    // - currentPage should be 1
    // - items 1..5 should be displayed
    // - prev button should be disabled, next enabled
    const app = new PagingPage(page);
    await app.goto();

    const currentPage = await app.getCurrentPage();
    expect(currentPage).toBe(1);

    const items = await app.getItemsText();
    expect(items.length).toBe(5);
    expect(items[0]).toBe('Item 1');
    expect(items[4]).toBe('Item 5');

    const prevDisabled = await app.isPrevDisabled();
    const nextDisabled = await app.isNextDisabled();

    expect(prevDisabled).toBe(true);
    expect(nextDisabled).toBe(false);
  });

  test('Navigate forward through all pages 1 -> 10 and validate item ranges and button states', async ({ page }) => {
    // This test walks the FSM from S1_Page1 through to S10_Page10 by clicking Next.
    // For each page it validates:
    // - window.currentPage matches expected
    // - visible items correspond to expected item numbers
    // - prev/next buttons enabled/disabled appropriately
    const app = new PagingPage(page);
    await app.goto();

    // Validate page 1 explicitly (already covered, but kept here for sequence completeness)
    let current = await app.getCurrentPage();
    expect(current).toBe(1);

    for (let expectedPage = 2; expectedPage <= 10; expectedPage++) {
      // Click Next to transition to the next page
      await app.clickNext();

      // After clicking, ensure currentPage updated
      current = await app.getCurrentPage();
      expect(current).toBe(expectedPage);

      // Validate displayed items correspond to page
      const items = await app.getItemsText();
      // For last page, it should still be 5 items given 50 items / 5 per page = 10 pages
      expect(items.length).toBe(5);

      const startItemNumber = (expectedPage - 1) * 5 + 1;
      expect(items[0]).toBe(`Item ${startItemNumber}`);
      expect(items[items.length - 1]).toBe(`Item ${startItemNumber + items.length - 1}`);

      // prev should be enabled on pages > 1
      const prevDisabled = await app.isPrevDisabled();
      expect(prevDisabled).toBe(false);

      // next disabled only on page 10
      const nextDisabled = await app.isNextDisabled();
      if (expectedPage === 10) {
        expect(nextDisabled).toBe(true);
      } else {
        expect(nextDisabled).toBe(false);
      }
    }
  });

  test('Navigate backward through all pages 10 -> 1 and validate transitions', async ({ page }) => {
    // This test navigates to page 10 first, then steps back to page 1,
    // validating the FSM backward transitions and DOM updates.
    const app = new PagingPage(page);
    await app.goto();

    // Move to page 10
    for (let i = 0; i < 9; i++) {
      await app.clickNext();
    }
    let current = await app.getCurrentPage();
    expect(current).toBe(10);

    // Now move backward from 10 to 1
    for (let expectedPage = 9; expectedPage >= 1; expectedPage--) {
      await app.clickPrev();

      current = await app.getCurrentPage();
      expect(current).toBe(expectedPage);

      const items = await app.getItemsText();
      const startItemNumber = (expectedPage - 1) * 5 + 1;

      // Items should match expected page
      expect(items[0]).toBe(`Item ${startItemNumber}`);
      expect(items[items.length - 1]).toBe(`Item ${startItemNumber + items.length - 1}`);

      // next should be enabled for pages < 10
      const nextDisabled = await app.isNextDisabled();
      expect(nextDisabled).toBe(false);

      // prev disabled only on page 1
      const prevDisabled = await app.isPrevDisabled();
      if (expectedPage === 1) {
        expect(prevDisabled).toBe(true);
      } else {
        expect(prevDisabled).toBe(false);
      }
    }
  });

  test('Edge cases: clicking disabled buttons should be reflected in disabled state and not allowed by UI', async ({ page }) => {
    // This test verifies edge behaviors:
    // - prev is disabled on page 1 and Playwright should find it disabled
    // - next is disabled on page 10 and Playwright should find it disabled
    // It does NOT force clicking disabled buttons; it asserts the disabled attribute is present.
    const app = new PagingPage(page);
    await app.goto();

    // On initial page (1), prev is disabled
    expect(await app.getCurrentPage()).toBe(1);
    expect(await app.isPrevDisabled()).toBe(true);

    // Attempting to click with Playwright without forcing should raise - rather than performing an action.
    // We assert the button is disabled and avoid forceful clicks to respect the UI state.
    let clickError = null;
    try {
      // This will normally throw because the element is disabled; we capture that to assert behavior.
      await page.click('#prevBtn', { timeout: 500 });
    } catch (err) {
      clickError = err;
    }
    expect(clickError).not.toBeNull();

    // Move to page 10 and validate next disabled
    for (let i = 0; i < 9; i++) {
      await app.clickNext();
    }
    expect(await app.getCurrentPage()).toBe(10);
    expect(await app.isNextDisabled()).toBe(true);

    // Similarly, clicking next without force should throw an error due to disabled state
    clickError = null;
    try {
      await page.click('#nextBtn', { timeout: 500 });
    } catch (err) {
      clickError = err;
    }
    expect(clickError).not.toBeNull();
  });

  test('Verify displayItems (entry action) is reflected by DOM updates on each transition', async ({ page }) => {
    // This test indirectly validates the "onEnter" action displayItems() by observing that
    // after each transition the items container is re-rendered with correct content.
    // We check multiple pages and ensure items change between pages.
    const app = new PagingPage(page);
    await app.goto();

    const snapshotPage1 = await app.getItemsText();

    // Move to page 2 and ensure items differ from page 1
    await app.clickNext();
    const snapshotPage2 = await app.getItemsText();
    expect(snapshotPage2).not.toEqual(snapshotPage1);

    // Move to page 3 and ensure items update again
    await app.clickNext();
    const snapshotPage3 = await app.getItemsText();
    expect(snapshotPage3).not.toEqual(snapshotPage2);

    // Move back to page 2 - items should match the earlier snapshot for page 2
    await app.clickPrev();
    const snapshotPage2Again = await app.getItemsText();
    expect(snapshotPage2Again).toEqual(snapshotPage2);
  });

  test('Assert no unexpected console errors or page errors occur while exercising all FSM transitions', async ({ page }) => {
    // This test exercises all transitions in the FSM (both directions across all pages)
    // while verifying that no runtime errors (console.error or uncaught exceptions) happen.
    // The afterEach will assert there are no console/page errors collected.
    const app = new PagingPage(page);
    await app.goto();

    // Walk forward to page 10
    for (let i = 0; i < 9; i++) {
      await app.clickNext();
    }
    expect(await app.getCurrentPage()).toBe(10);

    // Walk back to page 1
    for (let i = 0; i < 9; i++) {
      await app.clickPrev();
    }
    expect(await app.getCurrentPage()).toBe(1);

    // Final sanity checks on DOM
    const items = await app.getItemsText();
    expect(items[0]).toBe('Item 1');
    expect(items[items.length - 1]).toBe('Item 5');

    // The afterEach hook will assert that consoleErrors and pageErrors are empty arrays,
    // ensuring no ReferenceError/SyntaxError/TypeError or other uncaught errors occurred.
  });
});