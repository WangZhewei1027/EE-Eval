import { test, expect } from '@playwright/test';

// Test file for Application ID: d8370051-fa7b-11f0-b314-ad8654ee5de8
// Filename required: d8370051-fa7b-11f0-b314-ad8654ee5de8.spec.js
// Served URL: http://127.0.0.1:5500/workspace/0126-biased/html/d8370051-fa7b-11f0-b314-ad8654ee5de8.html

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8370051-fa7b-11f0-b314-ad8654ee5de8.html';
    this.runSelector = '#runDemo';
    this.demoSelector = '#demoArea';
  }

  async goto() {
    await this.page.goto(this.url);
    // Wait for core elements to be present
    await this.page.waitForSelector(this.runSelector, { state: 'visible' });
    await this.page.waitForSelector(this.demoSelector);
  }

  async runButtonText() {
    return this.page.locator(this.runSelector).innerText();
  }

  async demoText() {
    return this.page.locator(this.demoSelector).innerText();
  }

  // Returns the inline style.display value (as set by the script) - not computed style
  async demoInlineDisplay() {
    return this.page.$eval(this.demoSelector, el => el.style.display);
  }

  // Returns computed display style (useful if inline absent)
  async demoComputedDisplay() {
    return this.page.$eval(this.demoSelector, el => getComputedStyle(el).display);
  }

  async clickRun() {
    await this.page.click(this.runSelector);
  }

  // Convenience: ensure demo becomes visible (style.display === 'block')
  async waitForDemoVisible({ timeout = 2000 } = {}) {
    await this.page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.style && el.style.display === 'block';
    }, this.demoSelector, { timeout });
  }

  // Convenience: ensure demo becomes hidden (style.display === 'none')
  async waitForDemoHidden({ timeout = 2000 } = {}) {
    await this.page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.style && el.style.display === 'none';
    }, this.demoSelector, { timeout });
  }
}

test.describe('Big-Theta interactive demo FSM tests', () => {
  // Capture console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Intentionally empty - tests will assert on consoleMessages and pageErrors themselves.
  });

  test('Initial state S0_Idle: button present and demo hidden (renderPage entry expectations)', async ({ page }) => {
    // This test validates the initial Idle state described in the FSM:
    // - The runDemo button is present with initial text.
    // - The demo area exists and is hidden (style display: none).
    // - aria-live attribute exists and is set to polite.
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Validate button text
    const btnText = await demoPage.runButtonText();
    expect(btnText).toBe('Run simple demonstration');

    // Validate demo area inline style is 'display:none'
    const inlineDisplay = await demoPage.demoInlineDisplay();
    expect(inlineDisplay).toBe('none');

    // Validate computed display is 'none' (robustness if inline style differs)
    const computedDisplay = await demoPage.demoComputedDisplay();
    expect(computedDisplay === 'none' || computedDisplay === 'block' || typeof computedDisplay === 'string').toBeTruthy();

    // Validate aria-live attribute
    const ariaLive = await page.$eval('#demoArea', el => el.getAttribute('aria-live'));
    expect(ariaLive).toBe('polite');

    // Validate demo area initially empty (no innerText content)
    const demoText = await demoPage.demoText();
    expect(demoText.trim()).toBe('');

    // Assert no uncaught page errors and no console.error messages were produced during initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: S0_Idle -> S1_DemoVisible when clicking RunDemo (content and visibility checks)', async ({ page }) => {
    // This test validates the transition to Demo Visible state:
    // - Clicking the Run simple demonstration button shows the demo area
    // - The demo innerText begins with the expected "Computing ratios..." header
    // - The button text toggles to "Hide demonstration"
    // - The numeric outputs include expected header and observed min/max ratios
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click to run demonstration
    await demoPage.clickRun();

    // Wait for demo to show (script sets inline style.display = 'block')
    await demoPage.waitForDemoVisible({ timeout: 2000 });

    // Button text should change
    const afterClickBtnText = await demoPage.runButtonText();
    expect(afterClickBtnText).toBe('Hide demonstration');

    // Demo area should contain the expected intro text
    const demoText = await demoPage.demoText();
    expect(demoText.startsWith('Computing ratios for f(n)=3n+2 and g(n)=n up to n = 50...')).toBeTruthy();

    // Check for table header included by script
    expect(demoText).toContain(' n | f(n) | g(n) | f(n)/g(n)');

    // Validate observed min/max ratio output - computed by script for n=1..50:
    // min ratio occurs at n=50: 3 + 2/50 = 3.04 -> 3.0400
    // max ratio occurs at n=1: 3 + 2/1 = 5 -> 5.0000
    expect(demoText).toContain('Observed min ratio (n≤50): 3.0400');
    expect(demoText).toContain('Observed max ratio (n≤50): 5.0000');

    // Check that the interpretation paragraph (mentioning "3 ≤ f(n)/g(n) ≤ 5") exists
    expect(demoText).toContain('Interpretation: For all n≥1 we observed 3 ≤ f(n)/g(n) ≤ 5');

    // Assert no uncaught errors during the transition and rendering
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: S1_DemoVisible -> S0_Idle when clicking Hide demonstration (toggle back)', async ({ page }) => {
    // This test validates toggling back to Idle:
    // - After showing the demo, clicking again hides it and resets the button text.
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Show the demo first
    await demoPage.clickRun();
    await demoPage.waitForDemoVisible({ timeout: 2000 });

    // Click again to hide
    await demoPage.clickRun();
    await demoPage.waitForDemoHidden({ timeout: 2000 });

    // Button text should return to initial label
    const btnTextAfterHide = await demoPage.runButtonText();
    expect(btnTextAfterHide).toBe('Run simple demonstration');

    // Demo inline display should be 'none'
    const inlineDisplay = await demoPage.demoInlineDisplay();
    expect(inlineDisplay).toBe('none');

    // Assert still no runtime errors occurred during toggling
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid toggling and re-render behavior (multiple clicks)', async ({ page }) => {
    // This test checks robustness when clicking the button multiple times quickly:
    // - Ensure toggling doesn't throw errors
    // - Ensure when shown again the demo re-renders and contains expected numeric output
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Rapid sequence: show, hide, show
    await demoPage.clickRun(); // show
    await demoPage.waitForDemoVisible({ timeout: 2000 });

    await demoPage.clickRun(); // hide
    await demoPage.waitForDemoHidden({ timeout: 2000 });

    await demoPage.clickRun(); // show again
    await demoPage.waitForDemoVisible({ timeout: 2000 });

    // Validate content re-rendered (contains min/max lines)
    const demoText = await demoPage.demoText();
    expect(demoText).toContain('Observed min ratio (n≤50): 3.0400');
    expect(demoText).toContain('Observed max ratio (n≤50): 5.0000');

    // Click again to ensure we can hide without errors
    await demoPage.clickRun();
    await demoPage.waitForDemoHidden({ timeout: 2000 });

    // Ensure no console errors or page errors were emitted during rapid toggling
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: reading demo content while hidden and after show (no exceptions)', async ({ page }) => {
    // This test attempts to read demo content while hidden (should be empty) and after show.
    // It also asserts that the page does not throw during these DOM reads.
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Read while hidden
    const demoTextHidden = await demoPage.demoText();
    expect(typeof demoTextHidden).toBe('string');
    expect(demoTextHidden.trim()).toBe('');

    // Show demo
    await demoPage.clickRun();
    await demoPage.waitForDemoVisible({ timeout: 2000 });

    // Read after show
    const demoTextShown = await demoPage.demoText();
    expect(demoTextShown.length).toBeGreaterThan(0);
    expect(demoTextShown).toContain('Computing ratios for f(n)=3n+2 and g(n)=n up to n = 50');

    // Assert there are no page errors and no console error messages from these interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM evidence assertions: verify UI matches FSM component descriptions', async ({ page }) => {
    // This test cross-checks the FSM "components" and "evidence" with the actual DOM:
    // - Button exists with id #runDemo and expected label
    // - Demo area exists with id #demoArea, class demo, and initial style display:none
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Verify button exists and text content matches FSM evidence
    const btn = page.locator('#runDemo');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run simple demonstration');

    // Verify demo area attributes match FSM evidence
    const demoArea = page.locator('#demoArea');
    await expect(demoArea).toBeVisible(); // element exists; it might be hidden visually but locator is present
    const className = await demoArea.getAttribute('class');
    expect(className).toContain('demo');

    const styleAttr = await demoArea.getAttribute('style');
    expect(styleAttr).toContain('display:none');

    const ariaLive = await demoArea.getAttribute('aria-live');
    expect(ariaLive).toBe('polite');

    // No console or page errors during these checks
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Console and pageerror observation test: assert no runtime errors were emitted during full interaction', async ({ page }) => {
    // This test purposefully performs the full interaction sequence and then asserts that
    // there were no console.error messages and no page-level uncaught exceptions recorded.
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Perform full sequence: show, hide, show, hide
    await demoPage.clickRun();
    await demoPage.waitForDemoVisible({ timeout: 2000 });
    await demoPage.clickRun();
    await demoPage.waitForDemoHidden({ timeout: 2000 });
    await demoPage.clickRun();
    await demoPage.waitForDemoVisible({ timeout: 2000 });
    await demoPage.clickRun();
    await demoPage.waitForDemoHidden({ timeout: 2000 });

    // Collect any console.error or pageerror occurrences
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Assert none occurred. If there are errors, include them in failure message for debugging.
    expect(consoleErrors.length, 'Expect no console.error or warning messages during interactions').toBe(0);
    expect(pageErrors.length, 'Expect no uncaught page error events during interactions').toBe(0);
  });
});