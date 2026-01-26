import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0443bba2-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page Object for the Paging UI
 * Encapsulates common interactions and queries.
 */
class PagingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this._consoleListener = msg => {
      try {
        this.consoleMessages.push(msg.text());
      } catch {
        // ignore
      }
    };
    this._pageErrorListener = err => {
      try {
        // err is an Error with message property
        this.pageErrors.push(err.message);
      } catch {
        // ignore
      }
    };

    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  // Navigate to the application and wait for load
  async goto() {
    this.consoleMessages.length = 0;
    this.pageErrors.length = 0;
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // give any runtime script errors a moment to surface
    await this.page.waitForTimeout(100);
  }

  // Cleanup listeners (called in teardown)
  async dispose() {
    this.page.off('console', this._consoleListener);
    this.page.off('pageerror', this._pageErrorListener);
  }

  // Return the text of the currently active pagination item
  async getActivePageText() {
    const el = await this.page.locator('.pagination li.active').first();
    if (await el.count() === 0) return null;
    return (await el.textContent()).trim();
  }

  // Return number of pagination items and their text contents
  async getPaginationItems() {
    const items = this.page.locator('.pagination li');
    const count = await items.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await items.nth(i).textContent()).trim());
    }
    return texts;
  }

  // Click Next button (button with onclick='page(2)')
  async clickNext() {
    await this.page.click(".button[onclick='page(2)']");
    // give errors/time for DOM changes (if any)
    await this.page.waitForTimeout(100);
  }

  // Click Previous button (button with onclick='page(1)')
  async clickPrevious() {
    await this.page.click(".button[onclick='page(1)']");
    await this.page.waitForTimeout(100);
  }

  // Click a pagination item by its visible number (1..5)
  async clickPageNumber(n) {
    // find li with exact text n
    const locator = this.page.locator('.pagination li', { hasText: String(n) }).first();
    await locator.click();
    await this.page.waitForTimeout(100);
  }

  // Check onclick attribute of a pagination item by number
  async getOnclickAttributeForNumber(n) {
    const el = this.page.locator('.pagination li', { hasText: String(n) }).first();
    return el.getAttribute('onclick');
  }

  // Get collected console and page error messages
  getCollectedMessages() {
    return {
      console: [...this.consoleMessages],
      pageErrors: [...this.pageErrors]
    };
  }
}

test.describe('Paging FSM - 0443bba2-fa79-11f0-8a8e-bbe4f11717c6', () => {
  let paging;

  test.beforeEach(async ({ page }) => {
    paging = new PagingPage(page);
    await paging.goto();
  });

  test.afterEach(async () => {
    await paging.dispose();
  });

  test.describe('Initial state and DOM sanity checks', () => {
    test('Initial active page should be "1" and five pagination items exist', async () => {
      // Validate initial visual state: first li has class active and is "1"
      const activeText = await paging.getActivePageText();
      expect(activeText).toBe('1');

      // Validate there are five pagination numbers labeled 1..5
      const items = await paging.getPaginationItems();
      expect(items.length).toBe(5);
      expect(items).toEqual(['1', '2', '3', '4', '5']);
    });

    test('Each pagination item should have an onclick attribute referencing page(n)', async () => {
      // Validate onclick attributes for each pagination item exist and reference page(n)
      for (let i = 1; i <= 5; i++) {
        const onclick = await paging.getOnclickAttributeForNumber(i);
        // The implementation uses inline onclick handlers like: onclick="page(1)"
        expect(onclick).toBeTruthy();
        expect(onclick).toContain(`page(${i})`);
      }
    });

    test('Page script likely has a syntax/runtime error which should be reported', async () => {
      // The provided HTML contains an invalid line in the script that should cause a SyntaxError
      const { console: consoles, pageErrors } = paging.getCollectedMessages();

      // At least one error or console message should be present; capture both syntax and potential page errors
      const combined = [...consoles, ...pageErrors].join(' || ');
      // Expect to see evidence of a SyntaxError or other script-related error OR that page function is not defined
      const sawError = /SyntaxError|Unexpected|page is not defined|ReferenceError|TypeError/i.test(combined);
      expect(sawError).toBe(true);
    });
  });

  test.describe('Pagination number clicks (Pagination_Click events)', () => {
    test('Clicking the currently active page (1) should not change active state and should surface errors', async () => {
      // Clear previously captured messages
      paging.consoleMessages.length = 0;
      paging.pageErrors.length = 0;

      // Click page 1
      await paging.clickPageNumber(1);

      // Active should remain 1 because function is broken/unavailable
      const activeText = await paging.getActivePageText();
      expect(activeText).toBe('1');

      // Verify that an error surfaced (e.g., page is not defined or other)
      const { console: consoles, pageErrors } = paging.getCollectedMessages();
      const combined = [...consoles, ...pageErrors].join(' || ');
      expect(/page is not defined|ReferenceError|SyntaxError|Unexpected/i.test(combined)).toBe(true);
    });

    test('Clicking page 2 should attempt transition to Page 2 but surface errors and not change DOM', async () => {
      paging.consoleMessages.length = 0;
      paging.pageErrors.length = 0;

      await paging.clickPageNumber(2);

      // Because the script is erroneous, we expect the active class not to move to 2
      const activeText = await paging.getActivePageText();
      expect(activeText).toBe('1');

      // The onclick attribute is present and includes page(2) — evidence the UI wired the handler
      const onclick = await paging.getOnclickAttributeForNumber(2);
      expect(onclick).toContain('page(2)');

      const { console: consoles, pageErrors } = paging.getCollectedMessages();
      const combined = [...consoles, ...pageErrors].join(' || ');
      // Expect a ReferenceError mentioning page is not defined or related syntax error
      expect(/page is not defined|ReferenceError|SyntaxError|Unexpected/i.test(combined)).toBe(true);
    });

    // Additional tests for clicking pages 3,4,5 to satisfy FSM coverage
    for (let n = 3; n <= 5; n++) {
      test(`Clicking page ${n} should attempt transition to Page ${n} but result in error and no DOM change`, async () => {
        paging.consoleMessages.length = 0;
        paging.pageErrors.length = 0;

        await paging.clickPageNumber(n);

        const activeText = await paging.getActivePageText();
        expect(activeText).toBe('1', `Active should remain on 1 because runtime is broken after clicking ${n}`);

        const onclick = await paging.getOnclickAttributeForNumber(n);
        expect(onclick).toContain(`page(${n})`);

        const { console: consoles, pageErrors } = paging.getCollectedMessages();
        const combined = [...consoles, ...pageErrors].join(' || ');
        expect(/page is not defined|ReferenceError|SyntaxError|Unexpected/i.test(combined)).toBe(true);
      });
    }
  });

  test.describe('Previous/Next button clicks (Previous_Click and Next_Click events)', () => {
    test('Clicking Next from Page 1 should attempt to go to Page 2 but surface errors and keep DOM at Page 1', async () => {
      paging.consoleMessages.length = 0;
      paging.pageErrors.length = 0;

      await paging.clickNext();

      // Active should remain page 1 due to broken script
      const activeText = await paging.getActivePageText();
      expect(activeText).toBe('1');

      // Confirm the Next button exists and has the expected onclick
      const nextBtnOnclick = await paging.page.locator(".button[onclick='page(2)']").get