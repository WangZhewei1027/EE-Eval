import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a30f00-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object model for the interpreter demo page
class InterpreterDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = "button[onclick='showDemo()']";
    this.demoSelector = '#demo';
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Show Simple Code Execution button
  async clickShowDemo() {
    await this.page.click(this.buttonSelector);
  }

  // Get the inline display style value of the demo element
  async getDemoDisplayStyle() {
    return await this.page.$eval(this.demoSelector, el => getComputedStyle(el).display);
  }

  // Return true if demo is visible (computed style display !== 'none')
  async isDemoVisible() {
    const display = await this.getDemoDisplayStyle();
    return display !== 'none';
  }

  // Get the button text content
  async getButtonText() {
    const btn = await this.page.$(this.buttonSelector);
    if (!btn) return null;
    return btn.innerText();
  }

  // Get demo inner text (for verifying content when visible)
  async getDemoText() {
    return await this.page.$eval(this.demoSelector, el => el.innerText);
  }
}

test.describe('Understanding Interpreters — FSM-driven tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset captured errors before each test
    pageErrors = [];
    consoleErrors = [];

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages at the 'error' level for inspection
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure listeners are removed to avoid cross-test leakage
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('Initial page render should show the toggle button and demo hidden (Idle state)', async ({ page }) => {
      // This test validates the initial FSM state (S0_Idle) — "renderPage()" is listed in FSM entry actions
      // but the implementation does not define renderPage(). We simply load the page and assert DOM state.
      const demoPage = new InterpreterDemoPage(page);
      await demoPage.goto();

      // Button should exist and have expected label
      const button = await page.waitForSelector(demoPage.buttonSelector, { state: 'visible' });
      const buttonText = await button.innerText();
      expect(buttonText).toContain('Show Simple Code Execution');

      // Demo should exist in DOM and be hidden via style display: none
      const demoHandle = await page.waitForSelector(demoPage.demoSelector);
      const displayStyle = await demoPage.getDemoDisplayStyle();
      expect(displayStyle).toBe('none');
      expect(await demoPage.isDemoVisible()).toBeFalsy();

      // No unexpected page errors or console errors on initial load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transitions triggered by ShowDemo event (button click)', () => {
    test('S0_Idle -> S1_DemoVisible: clicking the button displays the demo', async ({ page }) => {
      // Validate the transition from Idle to Demo Visible
      const demoPage = new InterpreterDemoPage(page);
      await demoPage.goto();

      // Click the button to show the demo
      await demoPage.clickShowDemo();

      // After the click, the demo should be visible (display: block)
      await page.waitForFunction(selector => {
        const el = document.querySelector(selector);
        return window.getComputedStyle(el).display !== 'none';
      }, demoPage.demoSelector);

      const displayStyle = await demoPage.getDemoDisplayStyle();
      expect(displayStyle).toBe('block');
      expect(await demoPage.isDemoVisible()).toBeTruthy();

      // Verify demo content appears (basic content assertion)
      const demoText = await demoPage.getDemoText();
      expect(demoText).toMatch(/Demonstration of Simple Python Code Execution|Hello, world!/i);

      // No page-level errors introduced by the click handler
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('S1_DemoVisible -> S2_DemoHidden: clicking again hides the demo', async ({ page }) => {
      // Validate toggling from visible to hidden
      const demoPage = new InterpreterDemoPage(page);
      await demoPage.goto();

      // Show first
      await demoPage.clickShowDemo();
      await page.waitForFunction(selector => {
        const el = document.querySelector(selector);
        return window.getComputedStyle(el).display !== 'none';
      }, demoPage.demoSelector);

      // Now click to hide
      await demoPage.clickShowDemo();

      // Wait until it's hidden again
      await page.waitForFunction(selector => {
        const el = document.querySelector(selector);
        return window.getComputedStyle(el).display === 'none';
      }, demoPage.demoSelector);

      const displayStyle = await demoPage.getDemoDisplayStyle();
      expect(displayStyle).toBe('none');
      expect(await demoPage.isDemoVisible()).toBeFalsy();

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('S2_DemoHidden -> S1_DemoVisible: clicking from hidden shows the demo again', async ({ page }) => {
      // Validate toggling from hidden to visible again
      const demoPage = new InterpreterDemoPage(page);
      await demoPage.goto();

      // Ensure hidden initial, click to show, click to hide, then click to show again
      await demoPage.clickShowDemo(); // show
      await page.waitForFunction(selector => window.getComputedStyle(document.querySelector(selector)).display !== 'none', demoPage.demoSelector);
      await demoPage.clickShowDemo(); // hide
      await page.waitForFunction(selector => window.getComputedStyle(document.querySelector(selector)).display === 'none', demoPage.demoSelector);

      // Click to show again
      await demoPage.clickShowDemo();
      await page.waitForFunction(selector => window.getComputedStyle(document.querySelector(selector)).display !== 'none', demoPage.demoSelector);

      const displayStyle = await demoPage.getDemoDisplayStyle();
      expect(displayStyle).toBe('block');
      expect(await demoPage.isDemoVisible()).toBeTruthy();

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Rapid toggling: multiple quick clicks should consistently toggle visibility and not produce errors', async ({ page }) => {
      // This validates robustness when the button is clicked rapidly multiple times
      const demoPage = new InterpreterDemoPage(page);
      await demoPage.goto();

      // Perform 7 quick clicks
      for (let i = 0; i < 7; i++) {
        await demoPage.clickShowDemo();
        // short non-blocking pause to simulate human rapid clicks
        await page.waitForTimeout(30);
      }

      // After 7 toggles, demo should be visible (odd number of toggles from initial hidden)
      const visible = await demoPage.isDemoVisible();
      expect(visible).toBeTruthy();

      // No unhandled errors should have occurred during rapid toggling
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Intentional error scenario: invoking missing renderPage() in page context should produce a ReferenceError (unhandled)', async ({ page }) => {
      // The FSM listed an entry action renderPage() for S0_Idle, but the implementation does not define it.
      // We intentionally trigger an unhandled call to renderPage() asynchronously so the browser will emit a pageerror.
      const demoPage = new InterpreterDemoPage(page);
      await demoPage.goto();

      // Wait for an emitted pageerror resulting from an asynchronous call to an undefined function.
      // We schedule the call via setTimeout inside the page context so that it becomes an unhandled exception in the page.
      const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 });

      // Schedule an async call to the missing function (this will be unhandled in the page).
      await page.evaluate(() => {
        setTimeout(() => {
          // This should throw a ReferenceError in the page context because renderPage is not defined.
          // We do NOT catch it here so that it becomes an unhandled exception and triggers the pageerror event.
          // This matches the requirement to observe and assert natural ReferenceError behavior.
          // eslint-disable-next-line no-undef
          renderPage();
        }, 0);
      });

      // Await the pageerror event and assert it's a ReferenceError related to renderPage
      const pageError = await pageErrorPromise;
      expect(pageError).toBeDefined();
      // The message can vary by browser engine; assert that it mentions either 'renderPage' or 'ReferenceError'
      const msg = pageError.message || '';
      expect(/renderPage/i.test(msg) || /referenceerror/i.test(msg)).toBeTruthy();
    });

    test('Verifies showDemo function exists and is callable (implementation check)', async ({ page }) => {
      // This test ensures the event handler used by the button exists on window and is a function.
      // This is a sanity check to ensure that clicking will call a real function rather than undefined.
      const demoPage = new InterpreterDemoPage(page);
      await demoPage.goto();

      const typeofShowDemo = await page.evaluate(() => typeof window.showDemo);
      expect(typeofShowDemo).toBe('function');

      // Call the function directly from test context to ensure it runs without throwing
      // We call it synchronously and then check DOM changed — the function is defined in the page and should toggle the demo.
      await page.evaluate(() => window.showDemo());
      // Wait until demo becomes visible
      await page.waitForFunction(selector => window.getComputedStyle(document.querySelector(selector)).display !== 'none', demoPage.demoSelector);
      expect(await demoPage.isDemoVisible()).toBeTruthy();

      // Clean up by hiding it again
      await page.evaluate(() => window.showDemo());
      await page.waitForFunction(selector => window.getComputedStyle(document.querySelector(selector)).display === 'none', demoPage.demoSelector);

      // No new page errors should have been produced by invoking showDemo directly
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});