import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b20a22-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the P vs NP demo page
class PvsNPPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.header = page.locator('.header');
    this.text = page.locator('.text');
    this.buttonWrapper = page.locator('.button'); // wrapper div with class "button"
    this.learnMoreButton = page.locator("button[onclick='showDemo()']");
    // collectors for observing console and page errors
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Attach listeners to capture console messages and page errors
  attachObservers() {
    this.page.on('console', (msg) => {
      // store whole message for later assertions
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });
    this.page.on('pageerror', (err) => {
      // pageerror provides an Error object
      this.pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickLearnMore() {
    await this.learnMoreButton.click();
  }

  // Return computed display style for a selector
  async getDisplay(selector) {
    return await this.page.$eval(selector, (el) => {
      return window.getComputedStyle(el).display;
    });
  }

  // Utility to check whether any console messages contain JS runtime error names
  findConsoleErrorsOfTypes() {
    const errorTypes = ['ReferenceError', 'SyntaxError', 'TypeError'];
    return this.consoleMessages.filter((m) =>
      errorTypes.some((t) => m.text.includes(t) || (m.type === 'error' && m.text.includes(t)))
    );
  }

  // Check page error names for runtime errors
  findPageErrorsOfTypes() {
    const errorTypes = ['ReferenceError', 'SyntaxError', 'TypeError'];
    return this.pageErrors.filter((e) => errorTypes.includes(e.name));
  }
}

test.describe('P vs NP interactive demo (FSM validation)', () => {
  // Use the default Playwright page fixture
  test.beforeEach(async ({ page }) => {
    // no-op here; page objects constructed inside tests
  });

  test.afterEach(async ({ page }) => {
    // ensure we close any leftover dialogs/popups if present (defensive)
    try {
      await page.close();
    } catch (e) {
      // ignore if already closed
    }
  });

  test('Initial Idle state: DOM structure and visibility match S0_Idle evidence', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle) from the FSM:
    // - container, header, text, and button elements must be present and visible
    const p = new PvsNPPage(page);
    p.attachObservers();
    await p.goto();

    // Verify the main structural elements exist and are visible
    await expect(p.container).toBeVisible({ timeout: 2000 });
    await expect(p.header).toBeVisible();
    await expect(p.text).toBeVisible();
    await expect(p.buttonWrapper).toBeVisible();
    await expect(p.learnMoreButton).toBeVisible();

    // Verify the button has the expected onclick attribute (evidence component)
    const onclickAttr = await p.learnMoreButton.getAttribute('onclick');
    expect(onclickAttr).toBe('showDemo()');

    // Verify computed display styles are not 'none' (should be visible)
    const containerDisplay = await p.getDisplay('.container');
    const textDisplay = await p.getDisplay('.text');
    const buttonWrapperDisplay = await p.getDisplay('.button');
    expect(containerDisplay).not.toBe('none');
    expect(textDisplay).not.toBe('none');
    expect(buttonWrapperDisplay).not.toBe('none');

    // Assert that no runtime page errors occurred on initial load
    // (collectors may capture messages asynchronously; give a short pause)
    await page.waitForTimeout(50);
    const pageErrors = p.pageErrors;
    const consoleErrors = p.findConsoleErrorsOfTypes();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Learn More click triggers transition to Demo Shown (S0_Idle -> S1_DemoShown)', async ({ page }) => {
    // This test validates the event LearnMoreClick and the transition to S1_DemoShown:
    // - Clicking the Learn More button should result in .button, .text, .container having display = 'block'
    const p = new PvsNPPage(page);
    p.attachObservers();
    await p.goto();

    // Click the Learn More button (event trigger)
    await p.clickLearnMore();

    // Wait briefly for any JS to run
    await page.waitForTimeout(100);

    // The FSM's evidence for S1_DemoShown checks for style.display = 'block'
    const containerDisplay = await p.getDisplay('.container');
    const textDisplay = await p.getDisplay('.text');
    const buttonWrapperDisplay = await p.getDisplay('.button');

    // Assert they are exactly 'block' as per the FSM evidence
    expect(containerDisplay).toBe('block');
    expect(textDisplay).toBe('block');
    expect(buttonWrapperDisplay).toBe('block');

    // Ensure the visible button still exists and is interactable
    await expect(p.learnMoreButton).toBeVisible();
    await expect(p.learnMoreButton).toBeEnabled();

    // Verify no runtime errors were thrown by the handler
    await page.waitForTimeout(50);
    const pageErrors = p.pageErrors;
    const runtimeConsoleErrors = p.findConsoleErrorsOfTypes();
    expect(pageErrors.length).toBe(0);
    expect(runtimeConsoleErrors.length).toBe(0);
  });

  test('Idempotent and repeated interactions: clicking Learn More multiple times has no adverse effects', async ({ page }) => {
    // This test covers edge cases: multiple clicks should not cause errors or state corruption.
    const p = new PvsNPPage(page);
    p.attachObservers();
    await p.goto();

    // Click the button multiple times rapidly
    for (let i = 0; i < 5; i++) {
      await p.clickLearnMore();
    }

    // Allow any potential errors to surface
    await page.waitForTimeout(150);

    // After repeated clicks, elements should remain visible and display = 'block'
    expect(await p.getDisplay('.container')).toBe('block');
    expect(await p.getDisplay('.text')).toBe('block');
    expect(await p.getDisplay('.button')).toBe('block');

    // No page errors should have been recorded during repeated interactions
    const pageErrors = p.pageErrors;
    const consoleRuntimeErrors = p.findConsoleErrorsOfTypes();
    expect(pageErrors.length).toBe(0);
    expect(consoleRuntimeErrors.length).toBe(0);

    // Also ensure no unexpected console.error messages were emitted
    const consoleErrorMessages = p.consoleMessages.filter((m) => m.type === 'error').map(m => m.text);
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('FSM onEnter/onExit actions: none specified, ensure no side effects like navigation or reload', async ({ page }) => {
    // The FSM does not declare onEnter/onExit actions. This test ensures no navigation or reload occurs as a result of interactions.
    const p = new PvsNPPage(page);
    p.attachObservers();
    await p.goto();

    // Record the initial URL
    const initialURL = page.url();

    // Click the Learn More button
    await p.clickLearnMore();

    // Wait briefly and check URL remains the same
    await page.waitForTimeout(100);
    expect(page.url()).toBe(initialURL);

    // Ensure no errors were thrown onEnter/onExit (none defined)
    expect(p.pageErrors.length).toBe(0);
    expect(p.findConsoleErrorsOfTypes().length).toBe(0);
  });

  test('Observe console and page errors: collect and assert there are no ReferenceError/SyntaxError/TypeError', async ({ page }) => {
    // This explicit test captures console and page errors across normal load and interaction,
    // then asserts that none of the specific runtime error types occurred.
    const p = new PvsNPPage(page);
    p.attachObservers();
    await p.goto();

    // Interact with the page once
    await p.clickLearnMore();
    await page.waitForTimeout(100);

    // Inspect collected console messages and page errors
    // Look for ReferenceError, SyntaxError, TypeError in both console messages and page errors
    const consoleErrors = p.findConsoleErrorsOfTypes();
    const pageRuntimeErrors = p.findPageErrorsOfTypes();

    // Log counts (helpful for debugging test failures)
    // Assertions: no such runtime errors should have occurred during normal usage of the page
    expect(consoleErrors.length).toBe(0);
    expect(pageRuntimeErrors.length).toBe(0);

    // Additionally ensure no generic page errors were recorded
    expect(p.pageErrors.length).toBe(0);
  });
});