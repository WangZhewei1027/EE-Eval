import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1215ad53-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Paging Demo
class PagingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Inputs and buttons
    this.totalItemsInput = page.locator('#totalItemsInput');
    this.setTotalItemsBtn = page.locator('#setTotalItemsBtn');
    this.pageSizeInput = page.locator('#pageSizeInput');
    this.setPageSizeBtn = page.locator('#setPageSizeBtn');
    this.filterInput = page.locator('#filterInput');
    this.applyFilterBtn = page.locator('#applyFilterBtn');
    this.clearFilterBtn = page.locator('#clearFilterBtn');

    this.firstPageBtn = page.locator('#firstPageBtn');
    this.prevPageBtn = page.locator('#prevPageBtn');
    this.currentPageInput = page.locator('#currentPageInput');
    this.goPageBtn = page.locator('#goPageBtn');
    this.nextPageBtn = page.locator('#nextPageBtn');
    this.lastPageBtn = page.locator('#lastPageBtn');

    this.visiblePagesRange = page.locator('#visiblePagesRange');
    this.visiblePagesLabel = page.locator('#visiblePagesLabel');
    this.pageButtonsContainer = page.locator('#pageButtonsContainer');

    this.itemsList = page.locator('#itemsList > li');

    this.jumpStepInput = page.locator('#jumpStepInput');
    this.jumpForwardBtn = page.locator('#jumpForwardBtn');
    this.jumpBackwardBtn = page.locator('#jumpBackwardBtn');

    this.customPageInput = page.locator('#customPageInput');
    this.addBookmarkBtn = page.locator('#addBookmarkBtn');
    this.bookmarksList = page.locator('#bookmarksList > li');

    this.toggleAdvancedBtn = page.locator('#toggleAdvancedBtn');
    this.advancedOptions = page.locator('#advancedOptions');
    this.enableLoopPagingChk = page.locator('#enableLoopPaging');

    this.fastJumpMultiplierInput = page.locator('#fastJumpMultiplier');
    this.fastJumpForwardBtn = page.locator('#fastJumpForwardBtn');
    this.fastJumpBackwardBtn = page.locator('#fastJumpBackwardBtn');

    this.pageRangeInput = page.locator('#pageRangeInput');
    this.setPageRangeBtn = page.locator('#setPageRangeBtn');
    this.clearPageRangeBtn = page.locator('#clearPageRangeBtn');
  }

  // Navigation helpers
  async setTotalItems(n) {
    await this.totalItemsInput.fill(String(n));
    await this.setTotalItemsBtn.click();
  }

  async setPageSize(n) {
    await this.pageSizeInput.fill(String(n));
    await this.setPageSizeBtn.click();
  }

  async applyFilter(text) {
    await this.filterInput.fill(text);
    await this.applyFilterBtn.click();
  }

  async clearFilter() {
    await this.clearFilterBtn.click();
  }

  async goToFirst() {
    await this.firstPageBtn.click();
  }

  async goToPrev() {
    await this.prevPageBtn.click();
  }

  async goToNext() {
    await this.nextPageBtn.click();
  }

  async goToLast() {
    await this.lastPageBtn.click();
  }

  async goToPage(n) {
    await this.currentPageInput.fill(String(n));
    await this.goPageBtn.click();
  }

  async goToPageEnterKey(n) {
    await this.currentPageInput.fill(String(n));
    await this.currentPageInput.press('Enter');
  }

  async setVisiblePagesRange(n) {
    await this.visiblePagesRange.fill(String(n));
  }

  async jumpForward(step = undefined) {
    if (typeof step !== 'undefined') {
      await this.jumpStepInput.fill(String(step));
    }
    await this.jumpForwardBtn.click();
  }

  async jumpBackward(step = undefined) {
    if (typeof step !== 'undefined') {
      await this.jumpStepInput.fill(String(step));
    }
    await this.jumpBackwardBtn.click();
  }

  async addBookmark(pageNum) {
    await this.customPageInput.fill(String(pageNum));
    await this.addBookmarkBtn.click();
  }

  async toggleAdvanced() {
    await this.toggleAdvancedBtn.click();
  }

  async enableLoopPaging(value = true) {
    const checked = await this.enableLoopPagingChk.isChecked();
    if (checked !== value) {
      await this.enableLoopPagingChk.click();
    }
  }

  async fastJumpForward() {
    await this.fastJumpForwardBtn.click();
  }

  async fastJumpBackward() {
    await this.fastJumpBackwardBtn.click();
  }

  async setPageRange(text) {
    await this.pageRangeInput.fill(text);
    await this.setPageRangeBtn.click();
  }

  async clearPageRange() {
    await this.clearPageRangeBtn.click();
  }

  // Observers
  async itemsCount() {
    return await this.itemsList.count();
  }

  async getItemsText() {
    const count = await this.itemsCount();
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(await this.itemsList.nth(i).textContent());
    }
    return arr;
  }

  async currentPageValue() {
    return (await this.currentPageInput.inputValue()).trim();
  }

  async bookmarksCount() {
    return await this.bookmarksList.count();
  }

  async getBookmarksText() {
    const count = await this.bookmarksCount();
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(await this.bookmarksList.nth(i).textContent());
    }
    return arr;
  }

  async advancedDisplayed() {
    return await this.advancedOptions.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async visiblePagesLabelText() {
    return (await this.visiblePagesLabel.textContent()).trim();
  }

  async pageButtonsCount() {
    return await this.pageButtonsContainer.locator('button').count();
  }

  async firstPageButtonDisabled() {
    return await this.firstPageBtn.isDisabled();
  }

  async lastPageButtonDisabled() {
    return await this.lastPageBtn.isDisabled();
  }
}

// Test suite
test.describe('Interactive Paging Demonstration - FSM tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // capture console messages and page errors for assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts) so tests can assert their messages and continue
    page.on('dialog', async (dialog) => {
      // store the dialog message on page context so tests can examine it if needed
      // We cannot modify global environment; but storing on page object via evaluate is allowed.
      // We'll attach a temporary property to window for tests to read.
      try {
        await page.evaluate((message) => {
          window.__lastTestDialogMessage = message;
        }, dialog.message());
      } catch (e) {
        // ignore if evaluate fails (we must not patch runtime beyond storing simple info)
      }
      await dialog.accept();
    });

    // Navigate to application
    await page.goto(APP_URL);
  });

  // After each test ensure no unexpected runtime errors occurred
  test.afterEach(async ({ page }) => {
    // Make the captured console messages and page errors available for debugging failure logs
    // Primary assertion: no uncaught page errors and no console errors (unless intentional test expects them)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors, 'There should be no uncaught page errors').toHaveLength(0);
    expect(errorConsoleMessages.length, 'There should be no console.error messages').toBe(0);
    // Clear any stored dialog message on window to not leak between tests
    try {
      await page.evaluate(() => { delete window.__lastTestDialogMessage; });
    } catch (e) {
      // swallow any error
    }
  });

  test('Initial state: refreshAllItems() called and items rendered', async ({ page }) => {
    // Validate entry action refreshAllItems() produced the initial items and page controls
    const p = new PagingPage(page);

    // By default pageSize is 10 and totalItems is 123, so itemsList should show 10 items
    await expect(p.itemsList.first()).toBeVisible();
    const itemsCount = await p.itemsCount();
    expect(itemsCount).toBeGreaterThanOrEqual(1);
    expect(itemsCount).toBe(10);

    // current page input should be at 1
    expect(await p.currentPageValue()).toBe('1');

    // page buttons should be present; visiblePagesLabel defaults to 7
    expect(await p.visiblePagesLabelText()).toBe('7');
    const btnCount = await p.pageButtonsCount();
    // Should be at least 3 buttons (min) and <= visiblePagesLabel value
    expect(btnCount).toBeGreaterThanOrEqual(3);
    expect(btnCount).toBeLessThanOrEqual(7);
  });

  test('Set total items updates item list and pages', async ({ page }) => {
    // Test SetTotalItems transition and resulting UI update
    const p = new PagingPage(page);

    // Change total items to a smaller number and assert the list reflects that
    await p.setTotalItems(50);
    // After update itemsList should still show pageSize (10) items
    const itemsCount = await p.itemsCount();
    expect(itemsCount).toBe(10);

    // Set an invalid total items (0) to trigger alert (edge case)
    await p.totalItemsInput.fill('0');
    // Click and expect an alert to appear; dialog handler saves message to window.__lastTestDialogMessage
    await p.setTotalItemsBtn.click();
    // read the last dialog message
    const msg = await page.evaluate(() => window.__lastTestDialogMessage || null);
    expect(msg).toContain('Total items must be a positive integer');
  });

  test('Set page size updates items per page and respects limits', async ({ page }) => {
    // Test SetPageSize transition and edge-case invalid input handling
    const p = new PagingPage(page);

    // Set page size to 20 and verify itemsList count changes
    await p.setPageSize(20);
    const itemsCount = await p.itemsCount();
    expect(itemsCount).toBe(20);

    // Invalid page size (non-numeric) should trigger alert
    await p.pageSizeInput.fill('abc');
    await p.setPageSizeBtn.click();
    const msg = await page.evaluate(() => window.__lastTestDialogMessage || null);
    expect(msg).toContain('Page size must be a positive integer');
  });

  test('Apply and Clear filter update displayed items', async ({ page }) => {
    // Test ApplyFilter and ClearFilter transitions
    const p = new PagingPage(page);

    // Apply a filter that matches items containing '1' in their number (e.g., 1,10,11,...)
    await p.applyFilter('1');
    const itemsTextFiltered = await p.getItemsText();
    expect(itemsTextFiltered.length).toBeGreaterThan(0);
    // Every displayed item should contain '1' (case-insensitive)
    for (const txt of itemsTextFiltered) {
      expect(txt.toLowerCase()).toContain('1');
    }

    // Clear filter and verify that itemsList now contains a general set of items (not filtered)
    await p.clearFilter();
    const itemsTextCleared = await p.getItemsText();
    // After clearing there should still be items and the first item should likely be "Item #1"
    expect(itemsTextCleared.length).toBeGreaterThan(0);
    expect(itemsTextCleared[0].toLowerCase()).toContain('item #');
  });

  test('Navigate between pages using first, prev, next, last and go', async ({ page }) => {
    // Test FirstPage, PrevPage, NextPage, LastPage and GoPage transitions and UI updates
    const p = new PagingPage(page);

    // Go to last page using last button
    await p.goToLast();
    const lastPageValue = await p.currentPageValue();
    // Since default totalItems=123 and pageSize=10 => max page 13
    expect(Number(lastPageValue)).toBeGreaterThanOrEqual(1);

    // Prev should move page backward
    const prevValBefore = Number(await p.currentPageValue());
    await p.goToPrev();
    const prevValAfter = Number(await p.currentPageValue());
    expect(prevValAfter).toBe(Math.max(1, prevValBefore - 1));

    // First should go to page 1
    await p.goToFirst();
    expect(await p.currentPageValue()).toBe('1');

    // Go to a specific page via Go button
    await p.currentPageInput.fill('5');
    await p.goPageBtn.click();
    expect(await p.currentPageValue()).toBe('5');

    // Press Enter in currentPageInput to trigger Go event
    await p.goToPageEnterKey(3);
    expect(await p.currentPageValue()).toBe('3');
  });

  test('Jump forward and backward by step, including loop paging behavior', async ({ page }) => {
    // Test JumpForward and JumpBackward transitions and loop paging edge cases
    const p = new PagingPage(page);

    // Default jump step is 5; current page 1 -> jump forward to 6
    await p.jumpForward();
    expect(Number(await p.currentPageValue())).toBe(6);

    // Jump backward step 5 -> back to 1
    await p.jumpBackward();
    expect(Number(await p.currentPageValue())).toBe(1);

    // Enable loop paging and test wrap-around behavior
    await p.toggleAdvanced();
    await p.enableLoopPaging(true);

    // Move to near last page then jump forward beyond max to test wrapping
    await p.goToLast();
    const before = Number(await p.currentPageValue());
    // use a big step to go beyond max
    await p.jumpForward(1000);
    const after = Number(await p.currentPageValue());
    // When loopPaging enabled, new page should be within valid range (wrap)
    expect(after).toBeGreaterThanOrEqual(1);
    expect(after).toBeLessThanOrEqual(before); // wrap might set anywhere, but must be valid
  });

  test('Bookmarks can be added, navigated to and removed', async ({ page }) => {
    // Test AddBookmark and the bookmarks UI updates
    const p = new PagingPage(page);

    // Add bookmark for page 2
    await p.addBookmark(2);
    // bookmarksList should now have an entry (or more)
    const bookmarksText = await p.getBookmarksText();
    // Ensure that the bookmarks list contains a 'Go to page 2' button text
    const joined = bookmarksText.join(' ');
    expect(joined).toContain('Go to page 2');

    // Click the bookmark's "Go to page 2" button to navigate
    // Find the button inside bookmarksList items and click it
    const bkLi = page.locator('#bookmarksList > li').filter({ hasText: 'Go to page 2' }).first();
    const goBtn = bkLi.locator('button').first();
    await goBtn.click();
    expect(await p.currentPageValue()).toBe('2');

    // Remove the bookmark using the 'Remove' button
    const removeBtn = bkLi.locator('button', { hasText: 'Remove' }).first();
    await removeBtn.click();
    // After removal the bookmarks UI should reflect removal; either show "(No bookmarks)" or not contain the previous text
    const newBookmarksText = await page.locator('#bookmarksList').textContent();
    expect(newBookmarksText).not.toContain('Go to page 2');
  });

  test('Advanced options: toggle display, fast jumps, and page range filter', async ({ page }) => {
    // Test ToggleAdvancedOptions, fast jumps, SetPageRange and ClearPageRange transitions
    const p = new PagingPage(page);

    // Initially advanced options hidden
    expect(await p.advancedDisplayed()).toBe(false);

    // Show advanced options
    await p.toggleAdvanced();
    expect(await p.advancedDisplayed()).toBe(true);

    // Test fast jump forward/backward with multiplier set to 1 (should move by pageSize*1)
    await p.fastJumpMultiplierInput.fill('1');
    await p.goToFirst();
    const before = Number(await p.currentPageValue());
    await p.fastJumpForward();
    const afterForward = Number(await p.currentPageValue());
    expect(afterForward).toBeGreaterThan(before);

    // Fast jump backward returns toward start
    await p.fastJumpBackward();
    const afterBackward = Number(await p.currentPageValue());
    expect(afterBackward).toBeLessThanOrEqual(afterForward);

    // Set page range to a small span to restrict items (edge-case valid)
    await p.setPageRange('10,15');
    // Items shown should only be between 10 and 15 inclusive
    const itemsText = await p.getItemsText();
    for (const txt of itemsText) {
      const match = txt.match(/\d+$/);
      if (match) {
        const num = Number(match[0]);
        expect(num).toBeGreaterThanOrEqual(10);
        expect(num).toBeLessThanOrEqual(15);
      }
    }

    // Clear the page range and ensure items revert to normal
    await p.clearPageRange();
    const itemsText2 = await p.getItemsText();
    expect(itemsText2.length).toBeGreaterThan(0);
  });

  test('Visible pages control updates label and page buttons change', async ({ page }) => {
    // Test visible pages range input and the rendering of page buttons with ellipsis logic
    const p = new PagingPage(page);

    // Initially label is 7
    expect(await p.visiblePagesLabelText()).toBe('7');
    const initialButtons = await p.pageButtonsCount();

    // Change visible pages to 11 (should increase buttons count, but capped by max pages)
    await p.visiblePagesRange.fill('11');
    // Trigger the input event by focusing and pressing a key (the page script listens to input event)
    await p.visiblePagesRange.press('ArrowLeft');
    // wait for UI update
    await page.waitForTimeout(50);
    expect(await p.visiblePagesLabelText()).toBe('11');
    const newButtons = await p.pageButtonsCount();
    // newButtons should be >= initialButtons
    expect(newButtons).toBeGreaterThanOrEqual(initialButtons);

    // Ensure page buttons include an aria-current='page' on the current page
    const currentButton = page.locator('#pageButtonsContainer button[aria-current="page"]');
    await expect(currentButton).toHaveCount(1);
  });

  test('Page buttons are interactive and keyboard navigation works', async ({ page }) => {
    // Validate that clicking a page button changes the current page and that keyboard navigation within the container moves focus
    const p = new PagingPage(page);

    // Ensure there are page buttons
    const count = await p.pageButtonsCount();
    expect(count).toBeGreaterThanOrEqual(3);

    // Click the second page button (if exists) to navigate there
    const secondBtn = page.locator('#pageButtonsContainer button').nth(1);
    const secondText = await secondBtn.textContent();
    await secondBtn.click();
    // current page input should reflect that page number
    expect(await p.currentPageValue()).toBe(secondText.trim());

    // Test keyboard navigation: focus first button then press ArrowRight to move focus
    const firstBtn = page.locator('#pageButtonsContainer button').first();
    await firstBtn.focus();
    // Press ArrowRight
    await page.keyboard.press('ArrowRight');
    // After pressing, the active element should not be the first button (unless only one), assert focus moved
    const activeTag = await page.evaluate(() => document.activeElement.textContent.trim());
    expect(activeTag).not.toBe(await firstBtn.textContent());
  });

  test('Edge cases: invalid bookmark and invalid page range produce alerts', async ({ page }) => {
    // Test errors and validation dialogs for bookmarks and page range invalid input
    const p = new PagingPage(page);

    // Attempt to add bookmark with an out-of-range page number (e.g., 99999)
    await p.addBookmark(99999);
    const bkDialogMsg = await page.evaluate(() => window.__lastTestDialogMessage || null);
    expect(bkDialogMsg).toContain('Bookmark page must be a valid page number within range.');

    // Attempt to set an invalid page range format
    await p.toggleAdvanced();
    await p.pageRangeInput.fill('invalid-format');
    await p.setPageRangeBtn.click();
    const prDialogMsg = await page.evaluate(() => window.__lastTestDialogMessage || null);
    expect(prDialogMsg).toContain('Invalid format');
  });
});