import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1d684-fa7b-11f0-8b01-9f078a0ff214.html';

// Simple Page Object for the NP-Completeness interactive page
class NPCompletenessPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
    this.exampleSelector = '#subsetSumExample';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButton() {
    return this.page.$(this.buttonSelector);
  }

  async clickButton() {
    await this.page.click(this.buttonSelector);
  }

  async isExampleVisible() {
    // Use computed style to determine visibility robustly
    const display = await this.page.$eval(this.exampleSelector, (el) => {
      return window.getComputedStyle(el).display;
    });
    return display !== 'none';
  }

  async getExampleText() {
    return this.page.$eval(this.exampleSelector, (el) => el.innerText);
  }

  async getButtonOnclickAttribute() {
    return this.page.$eval(this.buttonSelector, (el) => el.getAttribute('onclick'));
  }
}

test.describe('Understanding NP-Completeness Interactive - FSM validation', () => {
  let pageConsoleMessages = [];
  let pageErrors = [];

  // Attach listeners each test to capture console messages and page errors
  test.beforeEach(async ({ page }) => {
    pageConsoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // collect all console messages for later assertions
      pageConsoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      // collect unhandled page errors
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack || '',
      });
    });
  });

  test.afterEach(async () => {
    // basic sanity: tests should assert specifics; here we do no forcing cleanup
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('Initial page load should present the button and hide the subset sum example', async ({ page }) => {
      // This test validates the Idle state from the FSM:
      // - The "Show Subset Sum Example" button exists
      // - The example div (#subsetSumExample) exists and is hidden (display:none)
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Ensure the button exists and has expected text
      const button = await app.getButton();
      expect(button).not.toBeNull();
      const buttonText = await page.$eval(app.buttonSelector, (b) => b.innerText.trim());
      expect(buttonText).toBe('Show Subset Sum Example');

      // The example element must exist in the DOM
      const exampleHandle = await page.$(app.exampleSelector);
      expect(exampleHandle).not.toBeNull();

      // Example should be hidden initially
      const visible = await app.isExampleVisible();
      expect(visible).toBe(false);

      // The button should include the inline onclick evidence as described in the FSM
      const onclickAttr = await app.getButtonOnclickAttribute();
      expect(onclickAttr).toContain('showSubsetSumExample');

      // No unhandled page errors should have occurred during a clean load
      expect(pageErrors.length).toBe(0);

      // No console.error messages by default on clean load
      const consoleErrors = pageConsoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('The FSM mentions an entry action renderPage() for S0; verify calling it raises a ReferenceError (edge case)', async ({ page }) => {
      // This test intentionally calls the non-existent renderPage() function in the page context
      // to validate the behavior described by the FSM (verify onEnter action presence/absence).
      // We capture the unhandled page error that results.
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Prepare to wait for a pageerror event triggered by calling renderPage()
      const pageErrorPromise = new Promise((resolve) => {
        const onError = (err) => {
          // once we get the pageerror, resolve with the error object
          page.off('pageerror', onError);
          resolve(err);
        };
        page.on('pageerror', onError);
      });

      // Attempt to invoke renderPage() without try/catch so the pageerror event should fire
      // We catch the evaluate rejection to avoid failing the test flow; the actual error will be captured via pageerror
      try {
        // This evaluate will reject because renderPage is not defined; swallow its rejection
        await page.evaluate(() => {
          // Intentionally call undefined function to reproduce ReferenceError as "natural" occurrence
          // This aligns with verifying the FSM's onEnter action that is not implemented in the HTML.
          // We do not catch here so that the error becomes an unhandled exception in the page
          // and triggers a 'pageerror' event which we are listening for above.
          // NOTE: This is performed purely to validate the FSM-specified entry action.
          // eslint-disable-next-line no-undef
          renderPage();
        });
      } catch (e) {
        // evaluate throws on the test side as well; swallow to await the pageerror event
      }

      // Wait briefly for the pageerror event; if none occurs, the promise will hang,
      // so use Promise.race with a timeout wrapper
      const result = await Promise.race([
        pageErrorPromise,
        new Promise((res) => setTimeout(() => res(null), 1000)),
      ]);

      // We expect a ReferenceError because renderPage is not implemented in the page
      if (result === null) {
        // No pageerror fired - assert that renderPage is indeed undefined via typeof check
        const typeofResult = await page.evaluate(() => typeof renderPage);
        expect(typeofResult).toBe('undefined');
      } else {
        // If a pageerror was captured, ensure it is a ReferenceError mentioning renderPage
        expect(result).toBeTruthy();
        expect(result.name).toBe('ReferenceError');
        expect(result.message).toMatch(/renderPage|is not defined/);
      }
    });
  });

  test.describe('Transition: ShowSubsetSumExample (S0 -> S1)', () => {
    test('Clicking the button transitions the page to show the Subset Sum example (S1_SubsetSumExampleVisible)', async ({ page }) => {
      // This test validates the primary transition described in the FSM:
      // Clicking the .button triggers showSubsetSumExample() and makes #subsetSumExample visible.
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Sanity check initial hidden state per FSM
      expect(await app.isExampleVisible()).toBe(false);

      // Capture any page errors while clicking
      const clickErrs = [];
      const onPageError = (err) => {
        clickErrs.push(err);
      };
      page.on('pageerror', onPageError);

      // Click the button to trigger the transition
      await app.clickButton();

      // Wait for the example to be visible using DOM observation
      await page.waitForSelector(app.exampleSelector, { state: 'visible', timeout: 2000 });

      // Verify the example is visible
      expect(await app.isExampleVisible()).toBe(true);

      // Verify content of the example contains expected description text
      const exampleText = await app.getExampleText();
      expect(exampleText).toContain('Subset Sum Problem Example');
      expect(exampleText).toContain('{3, 34, 4, 12, 5, 2}');
      expect(exampleText).toContain('4 + 5 = 9');

      // There should be no unexpected unhandled errors during the transition
      expect(clickErrs.length).toBe(0);

      page.off('pageerror', onPageError);
    });

    test('Repeated clicks do not hide the example and do not produce page errors (idempotency / edge case)', async ({ page }) => {
      // This test validates the behavior when the user clicks the button multiple times:
      // - The example stays visible after the first click
      // - Additional clicks do not cause errors or change visibility negatively
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Click once to show
      await app.clickButton();
      await page.waitForSelector(app.exampleSelector, { state: 'visible', timeout: 2000 });
      expect(await app.isExampleVisible()).toBe(true);

      // Capture any page errors across repeated interactions
      const capturedErrors = [];
      const onErr = (err) => capturedErrors.push(err);
      page.on('pageerror', onErr);

      // Click multiple times
      for (let i = 0; i < 3; i++) {
        await app.clickButton();
      }

      // Example should still be visible
      expect(await app.isExampleVisible()).toBe(true);

      // No unhandled errors should have been fired during repeated clicks
      expect(capturedErrors.length).toBe(0);

      page.off('pageerror', onErr);
    });

    test('Direct invocation of the inline function showSubsetSumExample from the page context works and updates DOM', async ({ page }) => {
      // This test directly invokes the function showSubsetSumExample inside the page context
      // to validate the FSM's onEnter action for S1 (showSubsetSumExample) exists and is functional.
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Ensure initial state hidden
      expect(await app.isExampleVisible()).toBe(false);

      // Call the function within page context and return the computed display property
      const invokeResult = await page.evaluate(() => {
        // If the function exists, call it and return the computed display style after calling.
        if (typeof showSubsetSumExample === 'function') {
          showSubsetSumExample();
          const el = document.getElementById('subsetSumExample');
          return window.getComputedStyle(el).display;
        } else {
          // indicate that function is absent
          return null;
        }
      });

      // If function existed, it should set display to something other than 'none'
      if (invokeResult === null) {
        // function absent - surface that as a test expectation (this would be surprising given the HTML)
        // but still assert that the onclick attribute references the function (evidence)
        const onclickAttr = await app.getButtonOnclickAttribute();
        expect(onclickAttr).toContain('showSubsetSumExample');
      } else {
        expect(invokeResult).not.toBe('none');
      }

      // Final check: the element should be visible from the page POV
      expect(await app.isExampleVisible()).toBe(true);
    });
  });

  test.describe('Observability and evidence checks', () => {
    test('The page includes the evidence elements described by the FSM (onclick attribute and #subsetSumExample element)', async ({ page }) => {
      // This test ensures the HTML includes the evidence described in the FSM extraction:
      // - The button has the inline onclick attribute referencing the function
      // - The #subsetSumExample element exists with initial style display:none
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Check onclick attribute on the button
      const onclick = await app.getButtonOnclickAttribute();
      expect(onclick).toBeTruthy();
      expect(onclick).toContain('showSubsetSumExample');

      // Check the subset example element style attribute contains display:none (as per evidence)
      const styleAttr = await page.$eval(app.exampleSelector, (el) => el.getAttribute('style'));
      expect(styleAttr).toBeTruthy();
      expect(styleAttr.replace(/\s+/g, '')).toContain('display:none;');
    });

    test('No unexpected console errors appear during typical usage (load, show example, repeated clicks)', async ({ page }) => {
      // This test exercises the normal user flows and asserts that console.error wasn't used.
      const app = new NPCompletenessPage(page);
      await app.goto();

      // Click to show
      await app.clickButton();
      await page.waitForSelector(app.exampleSelector, { state: 'visible', timeout: 2000 });

      // Click multiple times
      await app.clickButton();
      await app.clickButton();

      // Inspect collected console messages for error-level logs
      const errorMessages = pageConsoleMessages.filter((m) => m.type === 'error');
      expect(errorMessages.length).toBe(0);

      // Also ensure no unhandled page errors were captured
      expect(pageErrors.length).toBe(0);
    });
  });
});