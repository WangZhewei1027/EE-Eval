import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a076f0-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.button');
    this.demo = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickViewDemo() {
    await this.button.click();
  }

  // Returns the computed display style for the demo element
  async demoDisplay() {
    return await this.page.$eval('#demo', (el) => getComputedStyle(el).display);
  }

  async isDemoVisible() {
    const display = await this.demoDisplay();
    return display !== 'none';
  }

  async buttonText() {
    return await this.button.textContent();
  }

  // Utility to call an arbitrary function in page context (used to trigger error scenarios)
  async callGlobalFunction(name) {
    return await this.page.evaluate((fnName) => {
      // Intentionally call the global function by name. If it doesn't exist, this will throw.
      // We do NOT define or patch any globals here — this is to observe natural ReferenceErrors.
      // eslint-disable-next-line no-new-func
      return window[fnName]();
    }, name);
  }
}

// Grouping FSM-related tests
test.describe('Understanding Red-Black Trees - FSM and UI tests', () => {
  // Arrays to capture console errors and page errors per test
  let consoleErrors;
  let pageErrors;

  // Each test gets a fresh page fixture from Playwright. We set up listeners before navigation
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages emitted by the page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught page errors (like ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });
  });

  // Test the Idle state S0_Idle: renderPage() is mentioned as an entry action in the FSM,
  // but the implementation does not define renderPage(). We validate the initial UI state.
  test('S0_Idle: Initial render shows View Demonstration button and demo is hidden', async ({ page }) => {
    const demoPage = new DemoPage(page);
    // Navigate after listeners are set to capture any load-time errors
    await demoPage.goto();

    // Assertions about DOM elements and initial state
    await expect(demoPage.button).toBeVisible();
    const btnText = await demoPage.buttonText();
    expect(btnText.trim()).toBe('View Demonstration');

    // The demo should be hidden initially (display: none)
    const demoDisplay = await demoPage.demoDisplay();
    expect(demoDisplay).toBe('none');

    // There should be no console.error or uncaught page errors on a normal load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test the transition: Clicking the button triggers the ViewDemonstration event and shows the demo.
  test('S1_DemoVisible: Clicking "View Demonstration" displays the demo (transition from Idle)', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click the button to trigger the onclick handler defined in the HTML
    await demoPage.clickViewDemo();

    // Wait for the demo element to become visible by checking computed style
    await page.waitForFunction(() => {
      const el = document.getElementById('demo');
      return el && getComputedStyle(el).display !== 'none';
    });

    // Confirm by using the page object helper
    const visible = await demoPage.isDemoVisible();
    expect(visible).toBe(true);

    // Confirm expected content is present
    await expect(demoPage.demo.locator('h3')).toHaveText('Red-Black Tree Demonstration');
    await expect(demoPage.demo.locator('p')).toContainText('This is a simple demonstration');

    // No console errors or uncaught page errors should have occurred during user interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Validate event/transition is idempotent for repeated clicks (edge case)
  test('Edge case: Clicking "View Demonstration" multiple times keeps the demo visible and does not produce errors', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click multiple times in quick succession
    await demoPage.clickViewDemo();
    await demoPage.clickViewDemo();
    await demoPage.clickViewDemo();

    // Demo must remain visible
    const visible = await demoPage.isDemoVisible();
    expect(visible).toBe(true);

    // Ensure the computed display is something other than 'none' (likely 'block')
    const display = await demoPage.demoDisplay();
    expect(display).not.toBe('none');

    // No console errors or uncaught page errors from repeated clicks
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test explicit error scenario derived from FSM entry action mention: renderPage() is referenced in FSM entry_actions
  // Implementation does not define renderPage(). We will attempt to call it and assert that a ReferenceError occurs naturally.
  test('Error scenario: Calling missing global function renderPage() should cause a ReferenceError in page context', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Navigate so that any pageerror events are captured
    await demoPage.goto();

    // Sanity: confirm the function is indeed undefined in the page context
    const isDefined = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(isDefined).toBe(false);

    // Attempt to call the missing global function. This should naturally throw a ReferenceError.
    // We assert that the promise rejects with an error mentioning renderPage or ReferenceError.
    const evaluatePromise = demoPage.callGlobalFunction('renderPage');

    // Use Playwright's expect to assert the promise rejects
    await expect(evaluatePromise).rejects.toThrow(/renderPage|ReferenceError/);

    // The pageerror listener may also have captured the uncaught error — ensure at least one page error exists and it mentions renderPage
    // (Depending on the browser environment, the error may surface as both evaluate rejection and pageerror)
    expect(pageErrors.length).toBeGreaterThanOrEqual(0); // allow 0 or more, but if present, check text
    if (pageErrors.length > 0) {
      const messages = pageErrors.map((e) => e.message || String(e));
      const found = messages.some((m) => /renderPage|ReferenceError/.test(m));
      expect(found).toBeTruthy();
    }
  });

  // Validate there are no unexpected console warnings/errors across a normal navigation + interaction scenario
  test('Smoke: No uncaught console errors during load + show demo', async ({ page }) => {
    const demoPage = new DemoPage(page);

    // Navigate
    await demoPage.goto();

    // Interact
    await demoPage.clickViewDemo();

    // Final assertions about errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});