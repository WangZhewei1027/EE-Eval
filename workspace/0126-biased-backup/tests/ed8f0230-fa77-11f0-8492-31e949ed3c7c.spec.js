import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f0230-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object Model for the NoSQL Visual Experience page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class NoSQLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
    this.infoSelector = '#info';
    this.containerSelector = '.container';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButton() {
    return this.page.locator(this.buttonSelector);
  }

  async getInfo() {
    return this.page.locator(this.infoSelector);
  }

  async clickLearnMore() {
    await this.page.click(this.buttonSelector);
  }

  async isInfoVisible() {
    // Use computed style because style attribute may be changed inline by JS
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return window.getComputedStyle(el).display !== 'none';
    }, this.infoSelector);
  }

  async getInfoText() {
    return await this.page.locator(this.infoSelector).innerText();
  }

  async hasOnClickHandler() {
    // Check that the element has an onclick attribute containing showInfo()
    return await this.page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (!btn) return false;
      const onclick = btn.getAttribute('onclick') || '';
      return onclick.includes('showInfo');
    }, this.buttonSelector);
  }

  async showInfoFunctionExists() {
    return await this.page.evaluate(() => typeof window.showInfo === 'function');
  }

  async getInfoDisplayStyle() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return el.style.display;
    }, this.infoSelector);
  }
}

test.describe('NoSQL Visual Experience - FSM and UI behavior', () => {
  // Collect console messages and page errors for each test to assert on them.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages from the page and store them for assertions
    page.on('console', (msg) => {
      // Record severity and text for later assertions/logging
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled exceptions (pageerror) from the page context
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    const app = new NoSQLPage(page);
    await app.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // If any console errors or page errors were recorded, include them in the failure message context.
    if (consoleMessages.some((m) => m.type === 'error') || pageErrors.length > 0) {
      const errorsSummary = {
        consoleErrors: consoleMessages.filter((m) => m.type === 'error'),
        pageErrors: pageErrors.map((e) => ({ message: e.message, stack: e.stack })),
      };
      // Attach to test output for easier debugging
      testInfo.attach('runtime-errors', { body: JSON.stringify(errorsSummary, null, 2), contentType: 'application/json' });
    }
  });

  test.describe('Initial idle state (S0_Idle) validations', () => {
    test('renders page and shows initial Idle state: Learn More button exists and info hidden', async ({ page }) => {
      // Validate initial state corresponds to S0_Idle per FSM:
      // - Button with class ".button" and onclick attribute exists
      // - #info is present and initially hidden (display:none)
      const app = new NoSQLPage(page);

      // Button exists and is visible
      const button = await app.getButton();
      await expect(button).toBeVisible();

      // Confirm onclick evidence: attribute includes showInfo()
      const hasOnClick = await app.hasOnClickHandler();
      expect(hasOnClick).toBe(true);

      // #info exists in DOM
      const info = await app.getInfo();
      await expect(info).toHaveCount(1);

      // #info inline style initially set to "display:none" (per HTML attribute)
      const inlineDisplay = await app.getInfoDisplayStyle();
      // The inline style attribute in HTML is "display:none;" so style.display may be "none"
      expect(inlineDisplay === 'none' || inlineDisplay === 'none;').toBeTruthy();

      // Computed style should be 'none' (not visible)
      const visible = await app.isInfoVisible();
      expect(visible).toBe(false);

      // Confirm that the showInfo function exists on window (handler implemented)
      const showInfoExists = await app.showInfoFunctionExists();
      expect(showInfoExists).toBe(true);

      // There should be no runtime page errors or console.error messages on initial load
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
    });

    test('info content contains expected explanatory text', async ({ page }) => {
      // Validate that the informational content is present (even when hidden)
      const app = new NoSQLPage(page);
      const infoText = await app.getInfoText();
      expect(infoText).toContain('NoSQL databases include document stores');
      // No console errors should have been produced while reading content
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
    });
  });

  test.describe('Transition: Learn More click toggles info visibility (S0_Idle <-> S1_InfoVisible)', () => {
    test('clicking Learn More once shows the info (S0_Idle -> S1_InfoVisible)', async ({ page }) => {
      // This test validates the FSM transition from Idle to Info Visible on Learn More click.
      const app = new NoSQLPage(page);

      // Precondition: info hidden
      expect(await app.isInfoVisible()).toBe(false);

      // Action: click the button
      await app.clickLearnMore();

      // After clicking, #info should be visible (entry observable: info.style.display = "block")
      expect(await app.isInfoVisible()).toBe(true);

      // Also check inline style was set to block by the function
      const inlineDisplayAfter = await app.getInfoDisplayStyle();
      // inline style should now be "block"
      expect(inlineDisplayAfter === 'block').toBeTruthy();

      // No page errors or console.error should have occurred during this interaction
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
    });

    test('clicking Learn More again hides the info (S1_InfoVisible -> S0_Idle)', async ({ page }) => {
      // This test validates the FSM transition back from Info Visible to Idle on a second click.
      const app = new NoSQLPage(page);

      // Ensure we start by showing the info first
      await app.clickLearnMore();
      expect(await app.isInfoVisible()).toBe(true);

      // Action: click again to hide
      await app.clickLearnMore();

      // Expectation: info is hidden
      expect(await app.isInfoVisible()).toBe(false);

      // Inline style should reflect "none" again
      const inlineDisplayAfter = await app.getInfoDisplayStyle();
      expect(inlineDisplayAfter === 'none' || inlineDisplayAfter === 'none;').toBeTruthy();

      // No runtime errors or console.error entries produced during toggling
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
    });

    test('rapid multiple clicks result in deterministic toggling (odd=visible, even=hidden)', async ({ page }) => {
      // This edge-case test clicks the Learn More button several times rapidly and
      // asserts that the visibility toggles deterministically according to odd/even clicks.
      const app = new NoSQLPage(page);

      // Perform a sequence of rapid clicks
      const clicks = 5; // odd number -> final state should be visible
      for (let i = 0; i < clicks; i++) {
        await app.clickLearnMore();
      }

      // After 5 clicks, info should be visible (odd)
      expect(await app.isInfoVisible()).toBe(true);

      // Click one more time to make it even (6) -> should be hidden
      await app.clickLearnMore();
      expect(await app.isInfoVisible()).toBe(false);

      // Ensure no page errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
    });

    test('activation via keyboard (Enter) toggles the same behavior as click', async ({ page }) => {
      // Validate accessibility: hitting Enter while focused on the button should trigger the same toggle.
      const app = new NoSQLPage(page);

      const button = await app.getButton();
      await button.focus();

      // Press Enter to activate the button
      await page.keyboard.press('Enter');

      // Info should now be visible
      expect(await app.isInfoVisible()).toBe(true);

      // Press Enter again to hide
      await page.keyboard.press('Enter');
      expect(await app.isInfoVisible()).toBe(false);

      // No console errors or page errors should result from keyboard activation
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
    });
  });

  test.describe('FSM evidence and robustness checks', () => {
    test('onclick evidence exists in DOM and matches showInfo() usage', async ({ page }) => {
      // Validate the DOM evidence specified in the FSM: the button contains onclick="showInfo()"
      const app = new NoSQLPage(page);
      const hasOnClick = await app.hasOnClickHandler();
      expect(hasOnClick).toBe(true);

      // Confirm the function showInfo is defined and callable (no ReferenceError when invoked indirectly by click)
      expect(await app.showInfoFunctionExists()).toBe(true);

      // Trigger a click to ensure no ReferenceError or other exceptions occur in runtime
      await app.clickLearnMore();
      expect(pageErrors.length).toBe(0);
    });

    test('no unexpected global or runtime errors related to missing entry action "renderPage" occurred', async ({ page }) => {
      // The FSM listed an entry action "renderPage()" for S0_Idle. The HTML does not define renderPage.
      // We validate that no ReferenceError occurred due to a missing renderPage function at load time.
      // This ensures the page didn't attempt to call a non-existent function during initialization.
      //
      // Because we must not modify the page, we only observe errors emitted by the runtime.
      expect(pageErrors.length).toBe(0);
      // There should also be no console.error messages mentioning renderPage or ReferenceError.
      const consoleErrorTexts = consoleMessages.filter((m) => m.type === 'error').map((m) => m.text);
      const problematic = consoleErrorTexts.some((t) => t && (t.includes('renderPage') || t.includes('ReferenceError')));
      expect(problematic).toBe(false);
    });

    test('attempting to query a non-existent element returns null and does not throw', async ({ page }) => {
      // Edge case: queries for selectors not present should gracefully return null or undefined in evaluation context.
      // We ensure such a query does not cause a runtime exception.
      const result = await page.evaluate(() => {
        try {
          const el = document.querySelector('#non-existent-element');
          return el === null;
        } catch (err) {
          // Bubble up indicator if an exception occurred
          return { error: err.message || String(err) };
        }
      });

      // Expect true (element missing) and not an error object
      expect(result).toBe(true);
      // No page errors were emitted
      expect(pageErrors.length).toBe(0);
      expect(consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
    });
  });
});