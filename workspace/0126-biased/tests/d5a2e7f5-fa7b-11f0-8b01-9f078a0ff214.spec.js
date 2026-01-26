import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2e7f5-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Understanding Compilers demo page
class CompilersDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showButtonSelector = "button[onclick='displayDemo()']";
    this.demoOutputSelector = '#demoOutput';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async isShowButtonVisible() {
    return await this.page.isVisible(this.showButtonSelector);
  }

  async clickShowButton() {
    await this.page.click(this.showButtonSelector);
  }

  async isDemoOutputVisible() {
    return await this.page.isVisible(this.demoOutputSelector);
  }

  async getDemoOutputText() {
    return await this.page.textContent(this.demoOutputSelector);
  }

  async demoOutputDisplayStyle() {
    return await this.page.$eval(this.demoOutputSelector, (el) => getComputedStyle(el).display);
  }

  // Check whether displayDemo is defined on window
  async isDisplayDemoDefined() {
    return await this.page.evaluate(() => typeof window.displayDemo === 'function');
  }

  // Check whether renderPage is defined on window (FSM mentioned it but page may not have it)
  async isRenderPageDefined() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }
}

test.describe('Understanding Compilers - FSM and UI tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with their types
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });
  });

  test.afterEach(async () => {
    // Basic global teardown assertions:
    // Ensure there were no uncaught page errors (e.g., ReferenceError, SyntaxError, TypeError).
    // The test checks and reports the errors if present.
    expect(pageErrors, 'Expected no uncaught page errors during the test run').toEqual([]);
    // Also assert that no console messages of type 'error' were emitted.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors, 'Expected no console errors').toEqual([]);
  });

  test('Initial state (S0_Idle): button present and demo output hidden', async ({ page }) => {
    // Validate Idle state: the page should render with the "Show Compilation Stages" button
    // and the demo output <pre id="demoOutput"> should be hidden initially.
    const demo = new CompilersDemoPage(page);
    await demo.goto();

    // Verify button exists and is visible - evidence for S0_Idle
    expect(await demo.isShowButtonVisible()).toBe(true);

    // Verify demoOutput exists and is hidden initially (display: none)
    const isVisible = await demo.isDemoOutputVisible();
    expect(isVisible).toBe(false);

    // Also verify computed style is 'none' (explicit style attribute in the HTML)
    const displayStyle = await demo.demoOutputDisplayStyle();
    expect(displayStyle).toBe('none');

    // Verify that displayDemo function exists on the page (so click handler will work)
    const hasDisplayDemo = await demo.isDisplayDemoDefined();
    expect(hasDisplayDemo).toBe(true);

    // FSM mentioned renderPage() as entry action for S0_Idle; page does not define it.
    // We assert that renderPage is not defined (ensuring we don't call or patch it).
    const hasRenderPage = await demo.isRenderPageDefined();
    expect(hasRenderPage).toBe(false);
  });

  test('Transition ShowDemo (S0_Idle -> S1_DemoDisplayed): clicking button reveals demo output and updates text', async ({ page }) => {
    // Validate the transition defined in the FSM: clicking the button should display the demo output
    // and set its text content to the demo message (entry action displayDemo()).
    const demo = new CompilersDemoPage(page);
    await demo.goto();

    // Click the button to trigger ShowDemo event
    await demo.clickShowButton();

    // After clicking, demo output should be visible
    expect(await demo.isDemoOutputVisible()).toBe(true);

    // The computed display style should be 'block' per implementation
    const displayStyle = await demo.demoOutputDisplayStyle();
    expect(displayStyle).toBe('block');

    // The text content should include the list of compilation stages. Trim whitespace and assert presence.
    const rawText = await demo.getDemoOutputText();
    expect(typeof rawText).toBe('string');

    const normalized = rawText.replace(/\s+/g, ' ').trim();
    expect(normalized).toContain('1. Lexical Analysis');
    expect(normalized).toContain('2. Syntax Analysis');
    expect(normalized).toContain('3. Semantic Analysis');
    expect(normalized).toContain('4. Intermediate Code Generation');
    expect(normalized).toContain('5. Code Optimization');
    expect(normalized).toContain('6. Code Generation');

    // Confirm that clicking triggered the inline function and did not throw any runtime errors
    // (pageErrors and consoleErrors assertions are performed in afterEach).
  });

  test('Idempotent behavior and repeated interaction: multiple clicks keep correct state and content', async ({ page }) => {
    // Edge case: clicking the button multiple times should not break the UI.
    const demo = new CompilersDemoPage(page);
    await demo.goto();

    // Click twice in quick succession
    await demo.clickShowButton();
    await demo.clickShowButton();

    // It should still be visible and have the same content
    expect(await demo.isDemoOutputVisible()).toBe(true);

    const firstText = (await demo.getDemoOutputText() || '').replace(/\s+/g, ' ').trim();
    // Click again
    await demo.clickShowButton();
    const secondText = (await demo.getDemoOutputText() || '').replace(/\s+/g, ' ').trim();

    expect(firstText).toBe(secondText);
    expect(firstText.length).toBeGreaterThan(0);

    // Ensure expected key phrases are present after repeated clicks
    expect(firstText).toContain('Lexical Analysis');
    expect(firstText).toContain('Code Generation');
  });

  test('Accessibility and semantics: button has accessible name and #demoOutput is a preformatted block', async ({ page }) => {
    // Validate some semantic aspects of the DOM that support the FSM evidence and user interaction.
    const demo = new CompilersDemoPage(page);
    await demo.goto();

    // The button should have accessible name equal to its visible text
    const buttonText = await page.textContent(demo.showButtonSelector);
    expect(buttonText.trim()).toBe('Show Compilation Stages');

    // #demoOutput should be a <pre> element; check tagName via evaluate
    const tagName = await page.$eval(demo.demoOutputSelector, (el) => el.tagName.toLowerCase());
    expect(tagName).toBe('pre');

    // Now click to ensure content gets placed in the preformatted element
    await demo.clickShowButton();
    const demoText = await demo.getDemoOutputText();
    // It should contain newline characters in raw content (it's a pre), but we won't assert exact whitespace
    expect(typeof demoText).toBe('string');
    expect(demoText.length).toBeGreaterThan(0);
  });

  test('FSM entry/exit actions verification: displayDemo exists and renderPage absent (onEnter/onExit checks)', async ({ page }) => {
    // The FSM lists entry actions: renderPage() for S0_Idle and displayDemo() for S1_DemoDisplayed.
    // We verify what exists in the runtime: displayDemo should be present; renderPage should not.
    const demo = new CompilersDemoPage(page);
    await demo.goto();

    // displayDemo should be present and callable (we won't call it via evaluate to avoid duplicating clicks)
    const hasDisplayDemo = await demo.isDisplayDemoDefined();
    expect(hasDisplayDemo).toBe(true);

    // renderPage was mentioned by the FSM but is NOT implemented in the page; this should be undefined.
    const hasRenderPage = await demo.isRenderPageDefined();
    expect(hasRenderPage).toBe(false);
  });

  test('Observe console and page errors while interacting with the app', async ({ page }) => {
    // This test explicitly observes console messages and page errors while performing interactions.
    // The test will assert that no uncaught page errors (pageerror events) occurred and that there are
    // no console errors. The page listeners are set up in beforeEach and final assertions run in afterEach,
    // but we also make immediate assertions here about the console message stream being benign.
    const demo = new CompilersDemoPage(page);
    await demo.goto();

    // Interact with the app to potentially surface runtime errors
    await demo.clickShowButton();

    // Wait a short moment to allow any async console/page errors to surface
    await page.waitForTimeout(200);

    // Analyze captured console messages stored in the outer scope variable
    // Ensure there are no console 'error' messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Ensure there are no uncaught page errors captured
    expect(pageErrors.length).toBe(0);
  });

  test('Negative case: assert that calling a non-existent function would throw (sanity check without invoking it)', async ({ page }) => {
    // This test does not call renderPage (which is not defined), but demonstrates the environment
    // by verifying that attempting to read a non-existent global returns undefined.
    // We avoid invoking it to prevent intentional exceptions per instructions.
    const demo = new CompilersDemoPage(page);
    await demo.goto();

    // renderPage should be undefined; attempting to call it would throw a ReferenceError/TypeError.
    const hasRenderPage = await demo.isRenderPageDefined();
    expect(hasRenderPage).toBe(false);

    // For explicitness, verify that the value is indeed undefined on the window object
    const val = await page.evaluate(() => window.hasOwnProperty('renderPage') ? window.renderPage : undefined);
    expect(val).toBeUndefined();
  });
});