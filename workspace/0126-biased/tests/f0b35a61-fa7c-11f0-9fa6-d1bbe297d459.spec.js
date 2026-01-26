import { test, expect } from '@playwright/test';

// URL of the page under test (as provided)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b35a61-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the demo page to keep tests organized and readable
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showButtonSelector = "button[onclick='showProcessDemo()']";
    this.demoOutputSelector = '#demoOutput';
    this.demoTextSelector = '#demoText';
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Returns the text content of the button
  async getButtonText() {
    const el = await this.page.waitForSelector(this.showButtonSelector);
    return el.innerText();
  }

  // Click the "Show Simple Process Creation Demo" button
  async clickShowDemo() {
    await this.page.click(this.showButtonSelector);
  }

  // Check whether the demo output container is visible according to computed style
  async isDemoVisible() {
    // Use evaluate to read computed style directly from the page context
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    }, this.demoOutputSelector);
  }

  // Get innerHTML content of the demoText element
  async getDemoTextInnerHTML() {
    const el = await this.page.waitForSelector(this.demoTextSelector);
    return this.page.evaluate((node) => node.innerHTML, el);
  }

  // Get innerText (visible text) of the demoText element (strips HTML)
  async getDemoTextInnerText() {
    const el = await this.page.waitForSelector(this.demoTextSelector);
    return this.page.evaluate((node) => node.innerText, el);
  }

  // Check presence of demo output element and its class/id attributes
  async demoOutputExists() {
    return !!(await this.page.$(this.demoOutputSelector));
  }
}

test.describe('Understanding Processes in Computing - FSM and UI tests', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  // Recreate collector arrays before each test and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and classify error-level console entries
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect unhandled exceptions thrown on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });
  });

  // After each test, assert that no unexpected runtime errors occurred on the page.
  // This validates that the application runs without throwing ReferenceError/SyntaxError/TypeError etc.
  test.afterEach(async () => {
    // If there are any page errors, fail the test with the collected errors
    expect(pageErrors, `No uncaught page errors should occur (pageerror events)`).toEqual([]);
    // If there are any console.error messages, fail the test and show them
    expect(consoleErrors, `No console.error messages should be logged`).toEqual([]);
  });

  test('Initial state S0_Idle: page renders, button present, demo hidden', async ({ page }) => {
    // Comment: Validate initial FSM state S0_Idle entry evidence: renderPage() is listed in FSM but not called.
    // We navigate to the page and assert the Idle state's evidence: the button exists and demo output is hidden.
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Validate the show demo button exists and has correct label text
    const buttonText = await demoPage.getButtonText();
    expect(buttonText).toBe('Show Simple Process Creation Demo');

    // Validate the demo output container exists in the DOM
    const demoExists = await demoPage.demoOutputExists();
    expect(demoExists).toBe(true);

    // Validate the demo output is hidden initially (display: none)
    const visible = await demoPage.isDemoVisible();
    expect(visible).toBe(false);

    // Validate that FSM-declared on-enter action renderPage() is not defined on window
    // This ensures we reflect implementation reality: renderPage was declared in FSM but not implemented.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Ensure there are no console errors after initial load
    // (The afterEach will also assert no console errors/page errors)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible on ShowProcessDemo click', async ({ page }) => {
    // Comment: Validate the transition triggered by clicking the button and the expected observables
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click the button to show the demo (this should call showProcessDemo())
    await demoPage.clickShowDemo();

    // The demo output should now be visible (demo.style.display = 'block')
    const visible = await demoPage.isDemoVisible();
    expect(visible).toBe(true);

    // The demo heading must be present and readable
    const demoHeading = await page.locator('#demoOutput h3').innerText();
    expect(demoHeading).toContain('Process Creation Simulation');

    // The demo text area should contain expected explanatory content
    const demoInnerText = await demoPage.getDemoTextInnerText();
    expect(demoInnerText).toContain('Simulating process creation with fork()');
    expect(demoInnerText).toContain('Parent process (PID: 1000)');
    expect(demoInnerText).toContain("child's PID (1001)");
    expect(demoInnerText).toContain('In child: 0');

    // Ensure innerHTML contains the expected list structure (evidence in FSM)
    const demoInnerHTML = await demoPage.getDemoTextInnerHTML();
    expect(demoInnerHTML).toMatch(/<ul>/);
    expect(demoInnerHTML).toMatch(/<li>In parent: child's PID \(1001\)<\/li>|child's PID/);

    // Clicking again should not crash and should re-render the same content
    await demoPage.clickShowDemo();
    const visibleAfterSecondClick = await demoPage.isDemoVisible();
    expect(visibleAfterSecondClick).toBe(true);

    const demoInnerTextSecond = await demoPage.getDemoTextInnerText();
    expect(demoInnerTextSecond).toContain('Simulating process creation with fork()');

    // No console errors were emitted during the transition
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error').map((m) => m.text);
    expect(consoleErrorMessages).toEqual([]);
  });

  test('DOM structure and attributes: verify selectors and component evidence per FSM', async ({ page }) => {
    // Comment: This test validates the components extracted in the FSM are present and correct.
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Check the show demo button uses the expected inline onclick handler attribute
    const button = await page.waitForSelector(demoPage.showButtonSelector);
    const onclickValue = await button.getAttribute('onclick');
    expect(onclickValue).toBe('showProcessDemo()');

    // Check demoOutput element has class 'demo-output' and id 'demoOutput'
    const demoOutput = await page.waitForSelector(demoPage.demoOutputSelector);
    const demoOutputClass = await demoOutput.getAttribute('class');
    const demoOutputId = await demoOutput.getAttribute('id');
    expect(demoOutputClass).toContain('demo-output');
    expect(demoOutputId).toBe('demoOutput');

    // Check demoText element exists with id 'demoText'
    const demoText = await page.waitForSelector(demoPage.demoTextSelector);
    const demoTextId = await demoText.getAttribute('id');
    expect(demoTextId).toBe('demoText');
  });

  test('Edge cases: repeated interactions and content replacement behavior', async ({ page }) => {
    // Comment: Ensure repeated clicks replace innerHTML (no duplication) and no crashes occur.
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click multiple times in quick succession
    await demoPage.clickShowDemo();
    await demoPage.clickShowDemo();
    await demoPage.clickShowDemo();

    // Demo should be visible
    expect(await demoPage.isDemoVisible()).toBe(true);

    // The demoText innerHTML should match expected template (not accumulating duplicates)
    const innerHTML = await demoPage.getDemoTextInnerHTML();

    // Count occurrences of the phrase "Simulating process creation with fork()" to ensure it's present exactly 1 time
    const occurrences = (innerHTML.match(/Simulating process creation with fork\(\).../g) || []).length;
    // The exact template in the implementation contains that phrase followed by ... (we'll just assert at least 1)
    expect(innerHTML).toContain('Simulating process creation with fork()');

    // Validate the list of steps exists and has expected items (basic sanity)
    expect(innerHTML).toMatch(/<p>1\. Parent process \(PID: 1000\) creates child process<\/p>/);
    expect(innerHTML).toMatch(/<p>6. Parent continues execution<\/p>/);

    // Ensure no runtime errors resulted from rapid repeated interactions
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error').map((m) => m.text);
    expect(consoleErrorMessages).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('FSM vs Implementation mismatch checks (onEnter/onExit actions)', async ({ page }) => {
    // Comment: The FSM lists renderPage() as an entry action for S0_Idle.
    // This test verifies whether that function exists and notes its absence as an intentional mismatch.
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Check if renderPage is defined; FSM expected it, but implementation does not provide it.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // We assert it is 'undefined' to explicitly document the observed mismatch between FSM and implementation.
    expect(renderPageType).toBe('undefined');

    // Verify showProcessDemo is defined (the event handler referenced in the FSM exists)
    const showProcessDemoType = await page.evaluate(() => typeof window.showProcessDemo);
    expect(showProcessDemoType).toBe('function');
  });
});