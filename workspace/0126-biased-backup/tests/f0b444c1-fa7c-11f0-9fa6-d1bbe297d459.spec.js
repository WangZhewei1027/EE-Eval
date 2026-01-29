import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b444c1-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the REST API demo page
class RestApiPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('.demo-button');
    this.demoResult = page.locator('#demo-result');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRunDemo() {
    await this.demoButton.click();
  }

  async getDemoResultInnerHTML() {
    return this.page.evaluate(() => {
      const el = document.getElementById('demo-result');
      return el ? el.innerHTML : null;
    });
  }

  async isDemoResultDisplayed() {
    // Use computed style to determine display state
    return this.page.evaluate(() => {
      const el = document.getElementById('demo-result');
      if (!el) return false;
      const cs = window.getComputedStyle(el);
      return cs && cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }

  async getDemoResultComputedDisplay() {
    return this.page.evaluate(() => {
      const el = document.getElementById('demo-result');
      if (!el) return null;
      return window.getComputedStyle(el).display;
    });
  }

  async getButtonOnclickAttribute() {
    return this.demoButton.getAttribute('onclick');
  }

  async getButtonText() {
    return this.demoButton.textContent();
  }

  async hasGlobalFunction(name) {
    return this.page.evaluate((n) => {
      return typeof window[n] === 'function';
    }, name);
  }
}

test.describe('FSM: Comprehensive Guide to REST APIs (Application f0b444c1-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to capture console messages and page errors during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warn, error, log, etc.)
    page.on('console', (msg) => {
      // store text and type for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Basic sanity: ensure arrays exist (no runtime leak)
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  test.describe('State S0_Idle (Initial render) validations', () => {
    test('Initial state: Idle - button present, demo result hidden, entry action absence verified', async ({ page }) => {
      // This test validates the S0_Idle state described in the FSM.
      // It checks that the page initially shows the "Run API Demo" button and that the demo result area is hidden.
      const model = new RestApiPage(page);
      await model.goto();

      // Verify the demo button exists and has correct text
      await expect(model.demoButton).toBeVisible();
      const btnText = await model.getButtonText();
      expect(btnText.trim()).toBe('Run API Demo');

      // Verify the button has an onclick attribute that calls runDemo()
      const onclickAttr = await model.getButtonOnclickAttribute();
      // The HTML contains onclick="runDemo()" so assert that substring is present
      expect(onclickAttr).toBeTruthy();
      expect(onclickAttr.replace(/\s/g, '')).toBe('runDemo()');

      // Verify #demo-result exists and is initially hidden (display: none)
      const demoResultExists = await model.demoResult.count();
      expect(demoResultExists).toBe(1);
      const initialDisplay = await model.getDemoResultComputedDisplay();
      expect(initialDisplay).toBe('none');

      // As the FSM mentions an S0 entry action renderPage(), verify that no global renderPage function is defined
      // This confirms that the declared entry action in the FSM is not present in the current implementation.
      const hasRenderPage = await model.hasGlobalFunction('renderPage');
      expect(hasRenderPage).toBe(false);

      // The runDemo function should be present on the page (defined in the script)
      const hasRunDemo = await model.hasGlobalFunction('runDemo');
      expect(hasRunDemo).toBe(true);

      // Ensure no uncaught page errors occurred during initial load
      expect(pageErrors.length).toBe(0);

      // Collect console messages for debugging visibility (should not contain errors)
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });

  test.describe('Transition RunDemo (S0_Idle -> S1_DemoRunning)', () => {
    test('Clicking "Run API Demo" transitions to Demo Running state and shows simulated API request/response', async ({ page }) => {
      // This test validates the RunDemo event and the S1_DemoRunning state.
      // It checks that clicking the demo button makes #demo-result visible and populates it with the expected content.
      const model = new RestApiPage(page);
      await model.goto();

      // Confirm initial state preconditions
      expect(await model.getDemoResultComputedDisplay()).toBe('none');
      const beforeHTML = await model.getDemoResultInnerHTML();
      expect(beforeHTML.trim()).toBe('');

      // Click the button (Trigger the RunDemo event)
      await model.clickRunDemo();

      // After clicking, wait for the result element to become visible and assert its content
      await expect(model.demoResult).toBeVisible();
      const displayed = await model.isDemoResultDisplayed();
      expect(displayed).toBe(true);

      const afterHTML = await model.getDemoResultInnerHTML();
      expect(afterHTML).toBeTruthy();

      // Verify that the simulated API request and response snippets are present in innerHTML
      expect(afterHTML).toContain('Simulated API Request');
      expect(afterHTML).toContain('Simulated API Response');
      // Check for a key snippet expected from the implementation
      expect(afterHTML).toContain('GET /api/users/123');
      expect(afterHTML).toContain('HTTP/1.1 200 OK');

      // The demo-result must remain a block element (not 'none')
      const displayAfter = await model.getDemoResultComputedDisplay();
      expect(displayAfter).not.toBe('none');

      // Verify clicking the button did not produce any uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Ensure console didn't report errors during the transition
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Repeated clicks: re-running demo keeps behavior stable and does not throw', async ({ page }) => {
      // This test validates idempotent behavior / stability when the user triggers the transition multiple times.
      // It ensures no page errors are produced and the content remains as expected across clicks.
      const model = new RestApiPage(page);
      await model.goto();

      // Click once
      await model.clickRunDemo();
      await expect(model.demoResult).toBeVisible();
      const firstHTML = (await model.getDemoResultInnerHTML()) || '';

      // Click again to ensure re-running the demo function does not cause errors or unexpected DOM growth
      await model.clickRunDemo();
      await expect(model.demoResult).toBeVisible();
      const secondHTML = (await model.getDemoResultInnerHTML()) || '';

      // The implementation replaces innerHTML with the same content, so content should be identical
      expect(secondHTML).toBe(firstHTML);

      // No uncaught page errors recorded
      expect(pageErrors.length).toBe(0);

      // No console errors recorded
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error expectations based on FSM vs Implementation', () => {
    test('FSM declares an entry action renderPage() for S0_Idle; verify calling it would cause a ReferenceError (function absent)', async ({ page }) => {
      // This test intentionally inspects the discrepancy between the FSM (declared entry action) and the actual implementation.
      // We DO NOT modify the page or inject functions. We only observe and assert the absence of renderPage.
      const model = new RestApiPage(page);
      await model.goto();

      // Confirm renderPage is not defined
      const hasRenderPage = await model.hasGlobalFunction('renderPage');
      expect(hasRenderPage).toBe(false);

      // Confirm runDemo is defined (so the UI event can be triggered as expected)
      const hasRunDemo = await model.hasGlobalFunction('runDemo');
      expect(hasRunDemo).toBe(true);

      // OPTIONALLY: Demonstrate that calling a missing function would be an error by evaluating a safe predicate
      // We will not call renderPage() because invoking undefined in the page context would throw and create a page error.
      // Instead we assert that invoking typeof window.renderPage === 'undefined' which indicates a subsequent invocation would raise.
      const renderPageType = await page.evaluate(() => typeof window['renderPage']);
      expect(renderPageType).toBe('undefined');

      // Ensure no page errors were observed during this check
      expect(pageErrors.length).toBe(0);
    });

    test('Verify onclick attribute presence and that direct DOM click triggers the same behavior', async ({ page }) => {
      // This test validates that the HTML inline handler is present and that programmatic dispatch of a click event produces the same result.
      const model = new RestApiPage(page);
      await model.goto();

      // Ensure onclick attribute exists and references runDemo()
      const onclickAttr = await model.getButtonOnclickAttribute();
      expect(onclickAttr).toBe('runDemo()');

      // Programmatically dispatch a click event (same as user click)
      await page.evaluate(() => {
        const btn = document.querySelector('.demo-button');
        if (btn) {
          const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
          btn.dispatchEvent(ev);
        }
      });

      // Confirm result visible and content populated
      await expect(model.demoResult).toBeVisible();
      const html = await model.getDemoResultInnerHTML();
      expect(html).toContain('Simulated API Request');
      expect(html).toContain('Simulated API Response');

      // No uncaught errors produced by programmatic dispatch
      expect(pageErrors.length).toBe(0);
    });
  });
});