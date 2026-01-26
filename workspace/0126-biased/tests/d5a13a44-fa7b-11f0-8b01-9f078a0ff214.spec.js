import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a13a44-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page Object Model for the Ternary Search Demo page.
 * Encapsulates interactions and queries against the page under test.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = "button[onclick='showDemo()']";
    this.demoSelector = '#demo';
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Return the text content of the show demo button
  async getButtonText() {
    const el = await this.page.locator(this.buttonSelector);
    return el.innerText();
  }

  // Return the raw onclick attribute value from the button
  async getButtonOnclickAttribute() {
    return this.page.getAttribute(this.buttonSelector, 'onclick');
  }

  // Check if the demo element is visible according to Playwright's visibility check
  async isDemoVisible() {
    return this.page.locator(this.demoSelector).isVisible();
  }

  // Get computed display style of the demo element (e.g., 'none' or 'block')
  async getDemoDisplayStyle() {
    return this.page.$eval(this.demoSelector, el => getComputedStyle(el).display);
  }

  // Click the "See Step-by-Step Demonstration" button
  async clickShowDemo() {
    await this.page.locator(this.buttonSelector).click();
  }

  // Get demo heading text
  async getDemoHeadingText() {
    return this.page.locator(`${this.demoSelector} h3`).innerText();
  }

  // Get main demo descriptive paragraph text
  async getDemoParagraphText() {
    return this.page.locator(`${this.demoSelector} p`).nth(0).innerText();
  }

  // Check whether the global function showDemo is present and is a function
  async isShowDemoFunctionPresent() {
    return this.page.evaluate(() => typeof showDemo === 'function');
  }
}

test.describe('Ternary Search Demo FSM and UI', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages and page errors without altering page behavior
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // pageerror events capture unhandled exceptions in the page context
      pageErrors.push(err);
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright's automatic teardown,
    // but tests will make assertions about consoleMessages & pageErrors.
  });

  test('Initial state S0_Idle: button exists and demo is hidden', async ({ page }) => {
    // This test validates the FSM initial state: S0_Idle
    const demoPage = new DemoPage(page);

    // Ensure the "See Step-by-Step Demonstration" button exists and has the expected text
    const buttonText = await demoPage.getButtonText();
    expect(buttonText).toContain('See Step-by-Step Demonstration');

    // Verify the button has an inline onclick attribute wired to showDemo()
    const onclickAttr = await demoPage.getButtonOnclickAttribute();
    expect(onclickAttr).toBe('showDemo()');

    // The demo element (#demo) should start hidden per the FSM evidence and HTML (style display: none;)
    const displayStyle = await demoPage.getDemoDisplayStyle();
    expect(displayStyle).toBe('none');

    // Playwright's visibility predicate should reflect hidden state
    const visible = await demoPage.isDemoVisible();
    expect(visible).toBe(false);

    // Confirm that the showDemo function is defined on the page (onEnter action reference)
    const hasShowDemo = await demoPage.isShowDemoFunctionPresent();
    expect(hasShowDemo).toBe(true);

    // Assert that no console.error messages or page errors occurred during page load
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition ShowDemo: clicking button reveals demo (S1_DemoVisible)', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_DemoVisible when the ShowDemo event occurs
    const demoPage = new DemoPage(page);

    // Sanity check: demo hidden before interaction
    expect(await demoPage.isDemoVisible()).toBe(false);

    // Trigger the event: click the button identified in FSM triggers showDemo()
    await demoPage.clickShowDemo();

    // After clicking, the demo should be visible. Use Playwright's toBeVisible assertion for clarity.
    await expect(page.locator('#demo')).toBeVisible();

    // Also verify computed display style changed to something visible (commonly 'block' per implementation)
    const displayStyle = await demoPage.getDemoDisplayStyle();
    expect(displayStyle === 'block' || displayStyle === 'inline' || displayStyle === 'flex').toBeTruthy();

    // Validate that the demo contains the expected heading and explanatory text per implementation
    const heading = await demoPage.getDemoHeadingText();
    expect(heading.toLowerCase()).toContain('step-by-step');

    const para = await demoPage.getDemoParagraphText();
    expect(para.length).toBeGreaterThan(10); // basic content sanity check

    // Ensure the onclick handler (showDemo) is not causing script errors when triggered
    const runtimeErrors = consoleMessages.filter(m => m.type === 'error');
    expect(runtimeErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Idempotency and repeated interaction: clicking the button multiple times keeps demo visible', async ({ page }) => {
    // This validates an edge case: repeated ShowDemo events should not break the visible state
    const demoPage = new DemoPage(page);

    // Click once
    await demoPage.clickShowDemo();
    await expect(page.locator('#demo')).toBeVisible();

    // Capture state after first click
    const displayAfterFirst = await demoPage.getDemoDisplayStyle();

    // Click second time, should remain visible and not throw errors
    await demoPage.clickShowDemo();

    // Confirm still visible
    await expect(page.locator('#demo')).toBeVisible();
    const displayAfterSecond = await demoPage.getDemoDisplayStyle();

    // The display style should remain consistent (idempotent effect)
    expect(displayAfterSecond).toBe(displayAfterFirst);

    // No page errors or console errors produced by repeated clicks
    const runtimeErrors = consoleMessages.filter(m => m.type === 'error');
    expect(runtimeErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM onEnter action presence: showDemo function exists and does not throw when inspected', async ({ page }) => {
    // This test explicitly checks the presence of the onEnter action (showDemo) and ensures simply referencing it is safe.
    const demoPage = new DemoPage(page);

    // Confirm it's declared
    const declared = await demoPage.isShowDemoFunctionPresent();
    expect(declared).toBe(true);

    // Evaluate typeof showDemo in page context; this should not throw and should return 'function'
    const typeofShowDemo = await page.evaluate(() => typeof showDemo);
    expect(typeofShowDemo).toBe('function');

    // Do NOT call showDemo() directly via evaluate beyond regular UI click (we rely on UI click test above).
    // Ensure no console or page errors were observed just from inspecting the function.
    const runtimeErrors = consoleMessages.filter(m => m.type === 'error');
    expect(runtimeErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Accessibility and semantic checks: demo content and button attributes', async ({ page }) => {
    // Validate semantic presence of the demo region and that content aligns with expectations
    const demoPage = new DemoPage(page);

    // Button accessible name should match visible text
    const btnText = await demoPage.getButtonText();
    expect(btnText.trim().length).toBeGreaterThan(0);

    // The demo container should exist in the DOM even when hidden
    const demoLocator = page.locator('#demo');
    expect(await demoLocator.count()).toBe(1);

    // Validate that the demo contains at least one heading element and at least one paragraph
    await expect(demoLocator.locator('h3')).toHaveCount(1);
    await expect(demoLocator.locator('p')).toHaveCount(2);

    // Check that toggling visibility via the exposed UI works (click button)
    await demoPage.clickShowDemo();
    await expect(demoLocator).toBeVisible();

    // After interaction, confirm still no page-level exceptions
    expect(pageErrors.length).toBe(0);
    const runtimeErrors = consoleMessages.filter(m => m.type === 'error');
    expect(runtimeErrors.length).toBe(0);
  });

  test('Observability: collect and report any console messages and page errors (should be none)', async ({ page }) => {
    // This test asserts that no unintended console errors or page errors occurred during normal usage.
    // It's important to surface issues like ReferenceError/SyntaxError/TypeError if they occur naturally.

    const demoPage = new DemoPage(page);

    // Perform a typical user flow: verify initial state and click to show demo
    expect(await demoPage.isDemoVisible()).toBe(false);
    await demoPage.clickShowDemo();
    await expect(page.locator('#demo')).toBeVisible();

    // After normal interactions, assert there were no console.error messages
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // We treat warnings separately but still assert that there are no errors; warnings can be allowed but we'll assert zero for strictness
    expect(errorConsoleMessages.length).toBe(0);

    // Assert no unhandled exceptions bubbled up to pageerror
    expect(pageErrors.length).toBe(0);

    // For transparency in failure runs, attach collected messages to the test output if available
    // (Playwright will surface expect failures with details)
  });
});