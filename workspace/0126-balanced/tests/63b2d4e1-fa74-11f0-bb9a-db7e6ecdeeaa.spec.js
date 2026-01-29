import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2d4e1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object Model for the paging demonstration
class PagingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.itemsLocator = page.locator('#items li');
    this.pagingInfo = page.locator('#paging-info');
    this.firstBtn = page.locator('#firstBtn');
    this.prevBtn = page.locator('#prevBtn');
    this.nextBtn = page.locator('#nextBtn');
    this.lastBtn = page.locator('#lastBtn');

    // Known constants from the implementation
    this.totalItems = 123;
    this.pageSize = 10;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize); // 13
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // Wait for initial render; the script renders page 1 on load
    await expect(this.pagingInfo).toContainText('Page 1 of', { timeout: 2000 });
  }

  async getVisibleItemsText() {
    return await this.itemsLocator.allTextContents();
  }

  async getPagingInfoText() {
    return (await this.pagingInfo.textContent()) || '';
  }

  async clickFirst() {
    return await this.firstBtn.click();
  }

  async clickPrev() {
    return await this.prevBtn.click();
  }

  async clickNext() {
    return await this.nextBtn.click();
  }

  async clickLast() {
    return await this.lastBtn.click();
  }

  async isDisabled(locator) {
    return await locator.evaluate((el) => el.hasAttribute('disabled'));
  }

  getExpectedItemsForPage(page) {
    const start = (page - 1) * this.pageSize + 1;
    const end = Math.min(page * this.pageSize, this.totalItems);
    const arr = [];
    for (let i = start; i <= end; i++) {
      arr.push(`Item ${i}`);
    }
    return arr;
  }

  async expectPageState(page) {
    // Verify the list items
    const actual = await this.getVisibleItemsText();
    const expected = this.getExpectedItemsForPage(page);
    expect(actual, `Items on page ${page} should match expected range`).toEqual(expected);

    // Verify paging info text contains page and totalPages
    await expect(this.pagingInfo).toContainText(`Page ${page} of ${this.totalPages}`);

    // Verify button disabled states
    const firstDisabled = await this.isDisabled(this.firstBtn);
    const prevDisabled = await this.isDisabled(this.prevBtn);
    const nextDisabled = await this.isDisabled(this.nextBtn);
    const lastDisabled = await this.isDisabled(this.lastBtn);

    expect(firstDisabled).toBe(page === 1);
    expect(prevDisabled).toBe(page === 1);
    expect(nextDisabled).toBe(page === this.totalPages);
    expect(lastDisabled).toBe(page === this.totalPages);
  }
}

test.describe('Paging Demonstration - FSM validation', () => {
  // Each test will capture console messages and page errors so we can assert no unexpected runtime errors happen.
  test.beforeEach(async ({ page }) => {
    // Reduce default timeout noise for small DOM waits
    page.setDefaultTimeout(5000);
  });

  test('Initial state (S1_Page1) renders correctly and buttons reflect first page', async ({ page }) => {
    // Capture console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app = new PagingPage(page);
    await app.goto();

    // Validate that initial state corresponds to Page 1 (S1_Page1)
    // - Items 1..10 should be visible
    // - first and prev should be disabled
    // - next and last should be enabled
    await app.expectPageState(1);

    // Ensure no page errors or console errors of type 'error' were emitted during initial render
    expect(pageErrors.length, 'No uncaught page errors should occur on initial render').toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'No console.error calls should be emitted on initial render').toBe(0);
  });

  test('Next page transitions through all states S1 -> S13 using Next button', async ({ page }) => {
    const consoleMessages1 = [];
    const pageErrors1 = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app1 = new PagingPage(page);
    await app.goto();

    // Starting at page 1; click Next repeatedly and validate each state's rendering (S2..S13)
    for (let target = 2; target <= app.totalPages; target++) {
      // Click next and wait for paging info to change to target page
      await app.clickNext();
      await expect(app.pagingInfo).toContainText(`Page ${target} of ${app.totalPages}`);
      // Validate page content and button states
      await app.expectPageState(target);
    }

    // After reaching the last page, verify Next is disabled and clicking it fails
    const nextDisabled1 = await app.isDisabled(app.nextBtn);
    expect(nextDisabled).toBe(true);

    // Attempting to click the disabled Next button should cause Playwright to reject the click promise
    // This verifies the UI correctly prevents Next on the last page (edge case)
    await expect(app.nextBtn.click()).rejects.toThrow();

    // Ensure we encountered no uncaught runtime errors during the navigation
    expect(pageErrors.length, 'No uncaught page errors during Next navigation').toBe(0);
    const consoleErrors1 = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'No console.error calls during Next navigation').toBe(0);
  });

  test('Prev transitions back from S13 -> S1 and validates Prev behavior for each state', async ({ page }) => {
    const consoleMessages2 = [];
    const pageErrors2 = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app2 = new PagingPage(page);
    await app.goto();

    // Jump to last page using Last button and verify
    await app.clickLast();
    await expect(app.pagingInfo).toContainText(`Page ${app.totalPages} of ${app.totalPages}`);
    await app.expectPageState(app.totalPages);

    // Click Prev repeatedly back to page 1
    for (let target = app.totalPages - 1; target >= 1; target--) {
      await app.clickPrev();
      await expect(app.pagingInfo).toContainText(`Page ${target} of ${app.totalPages}`);
      await app.expectPageState(target);
    }

    // On page 1, Prev should be disabled and clicking it should fail
    const prevDisabled1 = await app.isDisabled(app.prevBtn);
    expect(prevDisabled).toBe(true);
    await expect(app.prevBtn.click()).rejects.toThrow();

    // Verify no runtime errors during Prev navigation
    expect(pageErrors.length, 'No uncaught page errors during Prev navigation').toBe(0);
    const consoleErrors2 = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'No console.error calls during Prev navigation').toBe(0);
  });

  test('First and Last buttons cause correct onEnter actions (renderPage) and update UI accordingly', async ({ page }) => {
    const consoleMessages3 = [];
    const pageErrors3 = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app3 = new PagingPage(page);
    await app.goto();

    // From initial state (page 1), clicking First should be a no-op and the button should be disabled.
    const firstDisabledBefore = await app.isDisabled(app.firstBtn);
    expect(firstDisabledBefore).toBe(true);

    // Clicking the disabled First button should be rejected by Playwright (edge case)
    await expect(app.firstBtn.click()).rejects.toThrow();

    // Click Last to jump to the final state S13
    await app.clickLast();
    await app.expectPageState(app.totalPages);

    // Now click First to go back to S1 and validate we render page 1
    await app.clickFirst();
    await app.expectPageState(1);

    // Verify no runtime errors during First/Last operations
    expect(pageErrors.length, 'No uncaught page errors during First/Last operations').toBe(0);
    const consoleErrors3 = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'No console.error calls during First/Last operations').toBe(0);
  });

  test('Edge cases: ensure clicking disabled controls is blocked and does not change state', async ({ page }) => {
    const consoleMessages4 = [];
    const pageErrors4 = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app4 = new PagingPage(page);
    await app.goto();

    // On page 1, prev and first are disabled
    expect(await app.isDisabled(app.prevBtn)).toBe(true);
    expect(await app.isDisabled(app.firstBtn)).toBe(true);

    // Try clicking disabled Prev and First and ensure they reject and page remains on Page 1
    await expect(app.prevBtn.click()).rejects.toThrow();
    await expect(app.firstBtn.click()).rejects.toThrow();
    await app.expectPageState(1);

    // Jump to last page
    await app.clickLast();
    await app.expectPageState(app.totalPages);

    // On last page, next and last are disabled
    expect(await app.isDisabled(app.nextBtn)).toBe(true);
    expect(await app.isDisabled(app.lastBtn)).toBe(true);

    // Try clicking disabled Next and Last and ensure they reject and page remains on last page
    await expect(app.nextBtn.click()).rejects.toThrow();
    await expect(app.lastBtn.click()).rejects.toThrow();
    await app.expectPageState(app.totalPages);

    // Final check: no uncaught runtime errors were produced while exercising disabled behavior
    expect(pageErrors.length, 'No uncaught page errors during disabled-control tests').toBe(0);
    const consoleErrors4 = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'No console.error calls during disabled-control tests').toBe(0);
  });

  test('Comprehensive traversal: random access via sequences of Next/Prev/First/Last and validate states', async ({ page }) => {
    const consoleMessages5 = [];
    const pageErrors5 = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app5 = new PagingPage(page);
    await app.goto();

    // Sequence of actions designed to traverse multiple transitions in the FSM
    // 1. Next x2 -> should be page 3
    await app.clickNext();
    await app.clickNext();
    await expect(app.pagingInfo).toContainText('Page 3 of');
    await app.expectPageState(3);

    // 2. Prev -> page 2
    await app.clickPrev();
    await app.expectPageState(2);

    // 3. Last -> page 13
    await app.clickLast();
    await app.expectPageState(app.totalPages);

    // 4. Prev x3 -> page 10
    for (let i = 0; i < 3; i++) {
      await app.clickPrev();
    }
    await app.expectPageState(10);

    // 5. First -> page 1
    await app.clickFirst();
    await app.expectPageState(1);

    // Verify no runtime errors during the random traversal
    expect(pageErrors.length, 'No uncaught page errors during random traversal').toBe(0);
    const consoleErrors5 = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'No console.error calls during random traversal').toBe(0);
  });

  test('Monitor for JS errors: assert that no ReferenceError/SyntaxError/TypeError occurred during full test sequence', async ({ page }) => {
    // This test intentionally navigates through the entire flow and then asserts no JS runtime errors were captured.
    const consoleMessages6 = [];
    const pageErrors6 = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app6 = new PagingPage(page);
    await app.goto();

    // Do a full traversal: Next to last, Prev to first, Last, First
    for (let i = 1; i < app.totalPages; i++) {
      await app.clickNext();
    }
    await app.expectPageState(app.totalPages);

    for (let i = app.totalPages; i > 1; i--) {
      await app.clickPrev();
    }
    await app.expectPageState(1);

    await app.clickLast();
    await app.expectPageState(app.totalPages);

    await app.clickFirst();
    await app.expectPageState(1);

    // Now assert there were no page errors captured
    // If any of ReferenceError, SyntaxError, TypeError or any other uncaught exceptions happened, they would be in pageErrors
    expect(pageErrors.length, 'There should be no uncaught page errors across full traversal').toBe(0);

    // Also ensure console did not emit any messages of type 'error'
    const consoleErrors6 = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'Console should not contain error messages across full traversal').toBe(0);

    // Additionally ensure none of the console messages indicate TypeError/ReferenceError/SyntaxError strings
    const criticalErrorStrings = ['TypeError', 'ReferenceError', 'SyntaxError'];
    const foundCritical = consoleMessages.some((m) =>
      criticalErrorStrings.some((s) => m.text.includes(s))
    );
    expect(foundCritical, 'No console message should include a critical JS error string').toBe(false);
  });
});