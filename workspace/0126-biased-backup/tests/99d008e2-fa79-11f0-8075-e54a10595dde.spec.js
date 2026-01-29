import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d008e2-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the pagination app
class PaginationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.itemsPerPage = page.locator('#itemsPerPage');
    this.totalItems = page.locator('#totalItems');
    this.firstButton = page.locator('button[onclick="goToPage(1)"]');
    this.previousButton = page.locator('button[onclick="goToPreviousPage()"]');
    this.nextButton = page.locator('button[onclick="goToNextPage()"]');
    // The Last Page button uses onclick="goToPage(totalPages)"
    this.lastButton = page.locator('button[onclick="goToPage(totalPages)"]');
    this.goToPageInput = page.locator('#goToPageInput');
    this.pageInfo = page.locator('#pageInfo');
    this.content = page.locator('#content');
  }

  // Helper to get the page info text, e.g., "Page 1 of 10"
  async getPageInfoText() {
    return (await this.pageInfo.innerText()).trim();
  }

  // Get item texts displayed in the content area
  async getContentItemsText() {
    return this.content.locator('div').allInnerTexts();
  }

  // Get count of displayed items
  async getContentItemsCount() {
    return await this.content.locator('div').count();
  }

  // Set itemsPerPage value and dispatch a change event (so onchange handlers run)
  async setItemsPerPage(value) {
    await this.itemsPerPage.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  // Set totalItems value and dispatch a change event
  async setTotalItems(value) {
    await this.totalItems.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  // Set goToPageInput value and dispatch change event (triggers goToPage(parseInt(this.value)))
  async setGoToPageInput(value) {
    await this.goToPageInput.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  // Click navigational buttons
  async clickFirst() { await this.firstButton.click(); }
  async clickPrevious() { await this.previousButton.click(); }
  async clickNext() { await this.nextButton.click(); }
  async clickLast() { await this.lastButton.click(); }

  // Returns the max attribute of the goToPage input (should equal totalPages)
  async getGoToPageMax() {
    return await this.goToPageInput.getAttribute('max');
  }
}

test.describe('Paging Example (Application ID: 99d008e2-fa79-11f0-8075-e54a10595dde)', () => {
  // Arrays to capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // If msg.type() or other call throws, record the thrown error message
        consoleErrors.push({ text: 'console listener error: ' + String(e) });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page and wait for initial render to finish
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the initial render() call has populated the UI
    await page.waitForSelector('#pageInfo');
    await page.waitForSelector('#content');
  });

  test.afterEach(async () => {
    // Assert that no runtime page errors occurred during the test
    expect(pageErrors, `No runtime page errors expected, but got: ${pageErrors.map(e => e.message).join(' | ')}`).toHaveLength(0);
    // Assert that no console.error messages were emitted during the test
    expect(consoleErrors, `No console.error messages expected, but got: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test('Initial render: shows default page info and first page items', async ({ page }) => {
    // Validate initial state: itemsPerPage = 5, totalItems = 50 => totalPages = 10
    const app = new PaginationPage(page);

    // Page info should reflect Page 1 of 10
    const pageInfo = await app.getPageInfoText();
    expect(pageInfo).toBe('Page 1 of 10');

    // Content should show 5 items: Item 1 .. Item 5
    const itemsCount = await app.getContentItemsCount();
    expect(itemsCount).toBe(5);

    const itemsText = await app.getContentItemsText();
    expect(itemsText[0]).toBe('Item 1');
    expect(itemsText[itemsText.length - 1]).toBe('Item 5');

    // The goToPage input max should be set to totalPages (10)
    const maxAttr = await app.getGoToPageMax();
    expect(maxAttr).toBe('10');
  });

  test('Change items per page: update rendering and pageInfo (itemsPerPage -> 10)', async ({ page }) => {
    // This validates the ItemsPerPageChange transition and expected observables
    const app = new PaginationPage(page);

    // Increase items per page to 10
    await app.setItemsPerPage(10);

    // Now totalPages = ceil(50/10) = 5; page should remain 1
    expect(await app.getPageInfoText()).toBe('Page 1 of 5');

    // Content should show 10 items on first page
    expect(await app.getContentItemsCount()).toBe(10);

    const items = await app.getContentItemsText();
    expect(items[0]).toBe('Item 1');
    expect(items[items.length - 1]).toBe('Item 10');

    // goToPageInput.max should update to 5
    expect(await app.getGoToPageMax()).toBe('5');
  });

  test('Change total items: update totalPages and clamp currentPage', async ({ page }) => {
    // This validates the TotalItemsChange transition and clamping behavior
    const app = new PaginationPage(page);

    // Navigate to page 5 first (so we can test clamping)
    await app.setGoToPageInput(5);
    expect(await app.getPageInfoText()).toBe('Page 5 of 10');

    // Now reduce total items down to 12 -> with itemsPerPage=5 totalPages = 3; currentPage should clamp to 3
    await app.setTotalItems(12);

    expect(await app.getPageInfoText()).toBe('Page 3 of 3');

    // Content should show items 11-12 on the last page (2 items)
    const items = await app.getContentItemsText();
    expect(items.length).toBe(2);
    expect(items[0]).toBe('Item 11');
    expect(items[1]).toBe('Item 12');

    // goToPageInput.max should reflect new totalPages = 3
    expect(await app.getGoToPageMax()).toBe('3');
  });

  test('Navigation buttons: First, Previous, Next, Last behave correctly', async ({ page }) => {
    // This test validates FirstPageClick, PreviousPageClick, NextPageClick, LastPageClick transitions
    const app = new PaginationPage(page);

    // Start at 1; clicking Previous should keep us on Page 1 (edge case)
    expect(await app.getPageInfoText()).toBe('Page 1 of 10');
    await app.clickPrevious();
    expect(await app.getPageInfoText()).toBe('Page 1 of 10');

    // Click Next -> Page 2
    await app.clickNext();
    expect(await app.getPageInfoText()).toBe('Page 2 of 10');
    // Content should show Item 6..Item10
    let items = await app.getContentItemsText();
    expect(items[0]).toBe('Item 6');
    expect(items[items.length - 1]).toBe('Item 10');

    // Click First -> returns to Page 1
    await app.clickFirst();
    expect(await app.getPageInfoText()).toBe('Page 1 of 10');

    // Click Last -> Page 10
    await app.clickLast();
    expect(await app.getPageInfoText()).toBe('Page 10 of 10');

    // On last page, content should show Item 46..Item50 (5 items)
    items = await app.getContentItemsText();
    expect(items[0]).toBe('Item 46');
    expect(items[items.length - 1]).toBe('Item 50');

    // Click Next on last page should keep us at last page (no change)
    await app.clickNext();
    expect(await app.getPageInfoText()).toBe('Page 10 of 10');
  });

  test('Go to specific page via input: valid and invalid inputs', async ({ page }) => {
    // This validates GoToPageInputChange transition including boundary checks
    const app = new PaginationPage(page);

    // Go to page 3
    await app.setGoToPageInput(3);
    expect(await app.getPageInfoText()).toBe('Page 3 of 10');
    let items = await app.getContentItemsText();
    expect(items[0]).toBe('Item 11');
    expect(items[items.length - 1]).toBe('Item 15');

    // Attempt to go to an invalid page (e.g., 999) - should NOT change current page
    await app.setGoToPageInput(999);
    // Still should be page 3
    expect(await app.getPageInfoText()).toBe('Page 3 of 10');

    // Attempt to go to page 0 (below min) - should not change
    await app.setGoToPageInput(0);
    expect(await app.getPageInfoText()).toBe('Page 3 of 10');

    // Valid boundary: go to last page using the input (max should be 10)
    await app.setGoToPageInput(10);
    expect(await app.getPageInfoText()).toBe('Page 10 of 10');
  });

  test('Edge case: set itemsPerPage larger than totalItems -> one page showing all items', async ({ page }) => {
    // This validates behavior when itemsPerPage > totalItems (totalPages should become 1)
    const app = new PaginationPage(page);

    // Set itemsPerPage to 60 while totalItems is default 50
    await app.setItemsPerPage(60);

    // Now totalPages = 1 and page info should be Page 1 of 1
    expect(await app.getPageInfoText()).toBe('Page 1 of 1');

    // Content should show all 50 items
    const count = await app.getContentItemsCount();
    expect(count).toBe(50);

    // Ensure the first and last items are correct
    const items = await app.getContentItemsText();
    expect(items[0]).toBe('Item 1');
    expect(items[items.length - 1]).toBe('Item 50');

    // goToPageInput max should be '1'
    expect(await app.getGoToPageMax()).toBe('1');

    // Clicking Next or Last should keep us on the single page
    await app.clickNext();
    expect(await app.getPageInfoText()).toBe('Page 1 of 1');
    await app.clickLast();
    expect(await app.getPageInfoText()).toBe('Page 1 of 1');
  });

  test('Edge case: reduce totalItems to 1 and verify UI updates', async ({ page }) => {
    // This verifies updateTotalItems handles small totals and UI clamps appropriately
    const app = new PaginationPage(page);

    // Set totalItems to 1
    await app.setTotalItems(1);

    expect(await app.getPageInfoText()).toBe('Page 1 of 1');
    expect(await app.getContentItemsCount()).toBe(1);
    const items = await app.getContentItemsText();
    expect(items[0]).toBe('Item 1');

    // goToPageInput max should be '1'
    expect(await app.getGoToPageMax()).toBe('1');

    // Try to navigate to previous/next - should remain unchanged
    await app.clickPrevious();
    expect(await app.getPageInfoText()).toBe('Page 1 of 1');
    await app.clickNext();
    expect(await app.getPageInfoText()).toBe('Page 1 of 1');
  });
});