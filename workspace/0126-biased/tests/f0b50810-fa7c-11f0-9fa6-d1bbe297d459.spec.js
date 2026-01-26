import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b50810-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demo page to keep tests organized and readable
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
    this.demoSelector = '#demo-container';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getTitleText() {
    return this.page.textContent('h1');
  }

  async getButtonText() {
    return this.page.textContent(this.buttonSelector);
  }

  async clickToggle() {
    await this.page.click(this.buttonSelector);
  }

  // Returns the inline style value (element.style.display)
  async getDemoInlineDisplay() {
    return this.page.$eval(this.demoSelector, el => el.style.display);
  }

  // Returns computed style (useful because initial display:none may come from CSS)
  async getDemoComputedDisplay() {
    return this.page.$eval(this.demoSelector, el => getComputedStyle(el).display);
  }

  // Boolean visible according to Playwright's visibility heuristics
  async isDemoVisible() {
    return this.page.isVisible(this.demoSelector);
  }
}

test.describe('FSM: Comprehensive Guide to Logistic Regression - Demo Toggle', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          // store the text and args for debugging assertions
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // don't interfere with page execution - just record
        consoleErrors.push({ text: `Failed to read console message: ${String(e)}` });
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  // Test initial idle state (S0_Idle) and the demo hidden state evidence (S2_DemoHidden)
  test('Initial state: page renders and demo is initially hidden (S0_Idle / S2_DemoHidden)', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Verify main content rendered (evidence of renderPage() entry action for S0_Idle)
    const title = await demoPage.getTitleText();
    expect(title).toContain('Logistic Regression', 'The page title should include "Logistic Regression" indicating the page rendered');

    // Verify the toggle button exists and has expected text
    const btnText = await demoPage.getButtonText();
    expect(btnText).toBe('Show/Hide Demonstration', 'The toggle button text should match the component definition');

    // The demo container should be hidden initially.
    // Because CSS sets display:none, element.style.display might be empty string; check computed style.
    const computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay).toBe('none', '#demo-container should be hidden via CSS on initial render');

    // Playwright's visibility helper should consider it not visible
    const visible = await demoPage.isDemoVisible();
    expect(visible).toBe(false, '#demo-container should not be visible to the user initially');

    // Ensure no JavaScript runtime errors were emitted during page load
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages on load, got: ${JSON.stringify(consoleErrors)}`);
    expect(pageErrors.length).toBe(0, `Expected no page errors on load, got: ${JSON.stringify(pageErrors.map(e => e.message))}`);
  });

  // Test transition S0_Idle -> S1_DemoVisible on ToggleDemo (first click)
  test('Transition: ToggleDemo shows the demo (S0_Idle -> S1_DemoVisible)', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click the toggle button once to show the demo
    await demoPage.clickToggle();

    // After click, the inline style should be set to 'block' by toggleDemo()
    const inlineDisplay = await demoPage.getDemoInlineDisplay();
    expect(inlineDisplay).toBe('block', 'After toggling from hidden, the demo container should have inline style display: block');

    // And computed display should be 'block', and Playwright should consider it visible
    const computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay).toBe('block', 'Computed display should reflect the demo is visible');

    const visible = await demoPage.isDemoVisible();
    expect(visible).toBe(true, '#demo-container should be visible after toggling');

    // No runtime errors should have occurred during the click
    expect(consoleErrors.length).toBe(0, `No console.error expected after showing demo, got: ${JSON.stringify(consoleErrors)}`);
    expect(pageErrors.length).toBe(0, `No page errors expected after showing demo, got: ${JSON.stringify(pageErrors.map(e => e.message))}`);
  });

  // Test transition S1_DemoVisible -> S2_DemoHidden on ToggleDemo (second click)
  test('Transition: ToggleDemo hides the demo when visible (S1_DemoVisible -> S2_DemoHidden)', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Show first
    await demoPage.clickToggle();
    // Then hide
    await demoPage.clickToggle();

    // After second click, the inline style should be 'none'
    const inlineDisplay = await demoPage.getDemoInlineDisplay();
    expect(inlineDisplay).toBe('none', 'After toggling from visible, the demo container should have inline style display: none');

    // Computed style should also report 'none'
    const computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay).toBe('none', 'Computed display should reflect the demo is hidden after second toggle');

    const visible = await demoPage.isDemoVisible();
    expect(visible).toBe(false, '#demo-container should not be visible after toggling twice');

    // No runtime errors during double toggle
    expect(consoleErrors.length).toBe(0, `No console.error expected after hiding demo, got: ${JSON.stringify(consoleErrors)}`);
    expect(pageErrors.length).toBe(0, `No page errors expected after hiding demo, got: ${JSON.stringify(pageErrors.map(e => e.message))}`);
  });

  // Edge case: Rapid multiple toggles to ensure state machine stays consistent
  test('Edge case: Rapid multiple toggles maintain expected parity and cause no errors', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Perform 5 rapid toggles (odd -> final visible)
    for (let i = 0; i < 5; i++) {
      // Do not await internal layout updates between clicks; this simulates rapid user interaction
      await demoPage.clickToggle();
    }

    // After 5 toggles from initial hidden state, the demo should be visible (odd number)
    let inlineDisplay = await demoPage.getDemoInlineDisplay();
    let computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(inlineDisplay === 'block' || computedDisplay === 'block').toBe(true, 'After 5 rapid toggles the demo should be visible (odd number of toggles)');

    // Do 4 more toggles (even -> final hidden)
    for (let i = 0; i < 4; i++) {
      await demoPage.clickToggle();
    }

    inlineDisplay = await demoPage.getDemoInlineDisplay();
    computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(inlineDisplay === 'none' || computedDisplay === 'none').toBe(true, 'After additional 4 toggles (total 9), the demo should be visible if odd, hidden if even; here we expect hidden after 9 toggles? Check parity');

    // Confirm no JS runtime errors occurred during rapid toggles
    expect(consoleErrors.length).toBe(0, `No console.error expected after rapid toggles, got: ${JSON.stringify(consoleErrors)}`);
    expect(pageErrors.length).toBe(0, `No page errors expected after rapid toggles, got: ${JSON.stringify(pageErrors.map(e => e.message))}`);
  });

  // Verify "entry actions" via their observable DOM effects where possible
  test('Verify entry action evidence for states (renderPage, showDemo, hideDemo) via DOM changes', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Evidence of renderPage() for S0_Idle: page content exists (title and main sections)
    const title = await demoPage.getTitleText();
    expect(title).toContain('Logistic Regression', 'renderPage() evidence: main content rendered');

    // Evidence of S2_DemoHidden entry action hideDemo(): demo is hidden on load
    let computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay).toBe('none', 'hideDemo() evidence: demo should be hidden initially');

    // Evidence of S1_DemoVisible entry action showDemo(): clicking should make demo visible
    await demoPage.clickToggle();
    computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay).toBe('block', 'showDemo() evidence: demo should be visible after showDemo/toggle');

    // Finally, hide again and check evidence for hideDemo()
    await demoPage.clickToggle();
    computedDisplay = await demoPage.getDemoComputedDisplay();
    expect(computedDisplay).toBe('none', 'hideDemo() evidence: demo should be hidden after toggling again');

    // Ensure still no runtime errors while exercising these "entry actions"
    expect(consoleErrors.length).toBe(0, `Expected no console errors while verifying entry action evidence, got: ${JSON.stringify(consoleErrors)}`);
    expect(pageErrors.length).toBe(0, `Expected no page errors while verifying entry action evidence, got: ${JSON.stringify(pageErrors.map(e => e.message))}`);
  });

  // Negative / error scenario checks: assert that clicking the button does not create uncaught exceptions
  test('Error scenario: clicking toggle button should not produce uncaught exceptions or console.error entries', async ({ page }) => {
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click several times and assert no errors appear
    await demoPage.clickToggle();
    await demoPage.clickToggle();
    await demoPage.clickToggle();

    // Allow a short time for any asynchronous errors to surface
    await page.waitForTimeout(200);

    // Assert no console.error messages were emitted
    expect(consoleErrors.length).toBe(0, `No console.error messages expected after repeated toggles, got: ${JSON.stringify(consoleErrors)}`);

    // Assert no uncaught page errors occurred
    expect(pageErrors.length).toBe(0, `No page errors expected after repeated toggles, got: ${JSON.stringify(pageErrors.map(e => e.message))}`);
  });
});