import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d309561-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object representing the paging UI
class PagingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.dataContainer = page.locator('#data-container');
    this.pageInfo = page.locator('#page-info');
    this.currentPageInput = page.locator('#current-page');
    this.pageSizeInput = page.locator('#number-of-pages');
    this.searchInput = page.locator('#search-input');
    this.searchButton = page.locator('button', { hasText: 'Search' });
    this.clearButton = page.locator('button', { hasText: 'Clear' });
    this.pagination = page.locator('#pagination');
  }

  // Returns array of visible data item texts
  async getDataItemsText() {
    const items = await this.dataContainer.locator('div').allInnerTexts();
    return items;
  }

  async getPageInfoText() {
    return this.pageInfo.innerText();
  }

  // Click an advanced control button by its exact text (Reset, Middle, Last)
  async clickAdvancedButton(text) {
    await this.page.click(`button:has-text("${text}")`);
  }

  // Click the Random button (text in label)
  async clickRandomButton() {
    await this.page.click('button:has-text("Random")');
  }

  // Set number of items per page and dispatch change event
  async setNumberOfPages(value) {
    await this.pageSizeInput.fill(String(value));
    // Dispatch change to invoke inline onchange handler
    await this.pageSizeInput.dispatchEvent('change');
  }

  // Set current page via input and dispatch change event
  async jumpToPage(value) {
    await this.currentPageInput.fill(String(value));
    await this.currentPageInput.dispatchEvent('change');
  }

  // Click a pagination control button with given label text (e.g., '>>', '<', '>')
  async clickPaginationButton(label) {
    await this.page.click(`#pagination >> text="${label}"`);
  }

  // Perform a search using the search input and Search button
  async search(query) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  // Click Clear search
  async clearSearch() {
    await this.clearButton.click();
  }

  async getCurrentPageValue() {
    const val = await this.currentPageInput.inputValue();
    return parseInt(val || '0', 10);
  }
}

test.describe('Interactive Paging System (6d309561-fa7a-11f0-ba5b-57721b046e74)', () => {
  // We'll collect page errors and console errors each test to assert expected/unexpected errors.
  test.beforeEach(async ({ page }) => {
    // No-op, per-test listeners are attached inside each test to ensure test-level isolation.
  });

  // Initial load and Idle state verification
  test('Initial load should render first page and controls (S0_Idle entry actions observed)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(BASE);

    const app = new PagingPage(page);

    // Expect initial data to be rendered (default pageSize 10), so 10 items shown
    const items = await app.getDataItemsText();
    expect(items.length).toBe(10);
    // First item should be "Item 1 - ..."
    expect(items[0]).toContain('Item 1');

    // Page info should reflect page 1 of 10 with 100 total items
    const pageInfoText = await app.getPageInfoText();
    expect(pageInfoText).toMatch(/Page\s+1\s+of\s+10\s+\(100 total items\)/i);

    // current-page input should be set to 1 by updateControls()
    const current = await app.getCurrentPageValue();
    expect(current).toBe(1);

    // On initial load we expect no page-level runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Page navigation events and transitions', () => {
    test('Go to Last Page (GoToPage) via Advanced Control should navigate to page 10 (S0 -> S1)', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      await page.goto(BASE);
      const app = new PagingPage(page);

      // Navigate to last page using the dedicated button labelled "Go to Last Page"
      await app.clickAdvancedButton('Go to Last Page');

      // Verify page-info shows Page 10 of 10 and last item displayed
      const pageInfo = await app.getPageInfoText();
      expect(pageInfo).toMatch(/Page\s+10\s+of\s+10/i);

      const items = await app.getDataItemsText();
      // On last page with pageSize 10, last item should be Item 100
      expect(items[items.length - 1]).toContain('Item 100');

      // No page errors expected for this navigation
      expect(pageErrors.length).toBe(0);
    });

    test('Go to Middle Page (GoToMiddlePage) should navigate to floor(totalPages/2) (S0 -> S1)', async ({ page }) => {
      await page.goto(BASE);
      const app = new PagingPage(page);

      // Confirm initial totalPages is 10 (from page-info) and compute expected middle
      const pageInfoText = await app.getPageInfoText();
      const match = pageInfoText.match(/Page\s+\d+\s+of\s+(\d+)/i);
      expect(match).not.toBeNull();
      const totalPages = parseInt(match[1], 10);
      const expectedMiddle = Math.floor(totalPages / 2);

      await app.clickAdvancedButton('Go to Middle Page');

      // After clicking expect current page to be expectedMiddle
      const current = await app.getCurrentPageValue();
      expect(current).toBe(expectedMiddle);

      // Data should be for that page: first item should correspond appropriately
      const items = await app.getDataItemsText();
      const firstItemText = items[0];
      const expectedItemNumber = (expectedMiddle - 1) * 10 + 1;
      expect(firstItemText).toContain(`Item ${expectedItemNumber}`);
    });

    test('Reset to First Page should set page to 1 (ResetToFirstPage)', async ({ page }) => {
      await page.goto(BASE);
      const app = new PagingPage(page);

      // Go to page 4 first using jumpToPage
      await app.jumpToPage(4);
      let current = await app.getCurrentPageValue();
      expect(current).toBe(4);

      // Click "Reset to First Page"
      await app.clickAdvancedButton('Reset to First Page');

      current = await app.getCurrentPageValue();
      expect(current).toBe(1);

      const items = await app.getDataItemsText();
      expect(items[0]).toContain('Item 1');
    });

    test('Random Jump should set currentPage within [1, totalPages] (JumpToRandomPage)', async ({ page }) => {
      await page.goto(BASE);
      const app = new PagingPage(page);

      // Determine totalPages from page-info
      const info = await app.getPageInfoText();
      const match = info.match(/Page\s+\d+\s+of\s+(\d+)/i);
      expect(match).not.toBeNull();
      const totalPages = parseInt(match[1], 10);

      // Click Random button
      await app.clickRandomButton();

      const current = await app.getCurrentPageValue();
      expect(current).toBeGreaterThanOrEqual(1);
      expect(current).toBeLessThanOrEqual(totalPages);
    });
  });

  test.describe('Page size and jump interactions with edge cases', () => {
    test('Changing page size uses broken handler and should trigger a runtime TypeError (ChangePageSize)', async ({ page }) => {
      // This test intentionally observes a runtime error caused by the implementation:
      // changePageSize() reads from element id "page-size" which does not exist in DOM.
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      await page.goto(BASE);
      const app = new PagingPage(page);

      // Trigger change - this should cause a TypeError in the page context
      await app.setNumberOfPages(20);

      // Wait a short moment to ensure error is captured if thrown asynchronously
      await page.waitForTimeout(100);

      // We expect at least one page error referencing inability to read property 'value' of null
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const messages = pageErrors.map(e => e.message).join('\n');
      // The error message may vary across browsers/runtimes; check for characteristic substrings
      expect(messages.toLowerCase()).toMatch(/(?:page-size|'page-size'|page-size)/);
      // Also typical phrasing from DOM null access
      expect(messages.toLowerCase()).toMatch(/cannot read|cannot read property|cannot read.*of null|cannot read properties/);
    });

    test('Jumping to a valid page via input (JumpToPage) should navigate and render correct items (S1 -> S1)', async ({ page }) => {
      // This test is isolated and should not rely on the failing changePageSize test above.
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      await page.goto(BASE);
      const app = new PagingPage(page);

      // Jump to page 2
      await app.jumpToPage(2);

      const current = await app.getCurrentPageValue();
      expect(current).toBe(2);

      const items = await app.getDataItemsText();
      // Page 2 should start with Item 11 given pageSize 10
      expect(items[0]).toContain('Item 11');

      // No runtime errors expected for jumpToPage path
      expect(pageErrors.length).toBe(0);
    });

    test('Jumping to an invalid page resets input back to current page (edge case)', async ({ page }) => {
      await page.goto(BASE);
      const app = new PagingPage(page);

      // Current page should be 1
      const initial = await app.getCurrentPageValue();
      expect(initial).toBe(1);

      // Attempt to jump to an out-of-range page (e.g., 999)
      await app.jumpToPage(999);

      // Because jumpToPage validates, it should revert input to currentPage (1)
      const after = await app.getCurrentPageValue();
      expect(after).toBe(1);
    });
  });

  test.describe('Search functionality and filtering (S0 -> S2 DataFiltered)', () => {
    test('Search filters data and updates pagination (SearchData)', async ({ page }) => {
      await page.goto(BASE);
      const app = new PagingPage(page);

      // Search for the term "Item 5" which should match "Item 5" and "Item 50-59" etc.
      await app.search('Item 5');

      // After search, currentPage should be reset to 1
      const current = await app.getCurrentPageValue();
      expect(current).toBe(1);

      // Page info should show fewer total items; determine numbers by parsing page-info
      const infoText = await app.getPageInfoText();
      // Expect the phrase "Page 1 of"
      expect(infoText).toMatch(/Page\s+1\s+of\s+\d+/i);

      // At least the first visible item should contain "Item 5"
      const items = await app.getDataItemsText();
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0]).toContain('Item 5');

      // Ensure pagination controls are rendered (ellipsis or page buttons)
      const paginationHTML = await page.locator('#pagination').innerHTML();
      expect(paginationHTML.length).toBeGreaterThan(0);
    });

    test('Clear Search restores the full dataset (ClearSearch)', async ({ page }) => {
      await page.goto(BASE);
      const app = new PagingPage(page);

      // Perform search then clear
      await app.search('Item 5');
      // Ensure filtered state
      const filteredInfo = await app.getPageInfoText();
      expect(filteredInfo).toMatch(/Page\s+1\s+of\s+\d+/i);

      // Click Clear and verify data is restored
      await app.clearSearch();

      const infoAfterClear = await app.getPageInfoText();
      // After clearing, we expect full dataset and default page size => Page 1 of 10 (100 items)
      expect(infoAfterClear).toMatch(/Page\s+1\s+of\s+10\s+\(100 total items\)/i);

      const items = await app.getDataItemsText();
      expect(items.length).toBe(10);
      expect(items[0]).toContain('Item 1');
    });
  });

  // Final test to ensure no unexpected global runtime errors occurred across a full user scenario
  test('End-to-end scenario: navigate, search, clear, random - ensure runtime stability except known bug', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(BASE);
    const app = new PagingPage(page);

    // Navigate to page 3
    await app.jumpToPage(3);
    expect(await app.getCurrentPageValue()).toBe(3);

    // Search
    await app.search('Item 2');
    expect(await app.getCurrentPageValue()).toBe(1);
    let info = await app.getPageInfoText();
    expect(info).toMatch(/Page\s+1\s+of\s+\d+/i);

    // Clear search
    await app.clearSearch();
    expect((await app.getPageInfoText())).toMatch(/Page\s+1\s+of\s+10\s+\(100 total items\)/i);

    // Trigger the broken ChangePageSize to affirm the known bug is reproducible and captured
    await app.setNumberOfPages(15);
    // Give a small pause for error propagation
    await page.waitForTimeout(100);

    // We expect at least one pageerror from the bad handler reading 'page-size'
    const foundTypeError = pageErrors.some(e => /page-size|cannot read|cannot read property/i.test(e.message));
    expect(foundTypeError).toBeTruthy();

    // Aside from the known error, ensure there are no other unexpected console errors (we tolerate the known TypeError)
    // consoleErrors may include the same error; ensure at least that known error appears
    const foundConsoleError = consoleErrors.some(text => /page-size|cannot read/i.test(text.toLowerCase()));
    expect(foundConsoleError).toBeTruthy();
  });
});