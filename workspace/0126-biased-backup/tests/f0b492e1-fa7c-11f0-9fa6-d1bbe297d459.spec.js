import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b492e1-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the Refactoring Demo page
class RefactoringDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.header = page.locator('h1');
    this.toggleButton = page.locator("button[onclick='showRefactoringDemo()']");
    this.demoResult = page.locator('#demoResult');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getHeaderText() {
    return this.header.textContent();
  }

  async isDemoVisible() {
    // Use Playwright's isVisible to reflect actual visibility to user
    return this.demoResult.isVisible();
  }

  async clickToggle() {
    await this.toggleButton.click();
  }

  async getDemoInnerText() {
    return this.demoResult.innerText();
  }
}

test.describe('FSM: Comprehensive Guide to Refactoring - States and Transitions', () => {
  // Arrays to collect runtime console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages with type and text
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', err => {
      // Push the error message and stack for later assertions / debugging
      pageErrors.push({
        message: err?.message || String(err),
        stack: err?.stack || ''
      });
    });
  });

  // Test initial state S0_Idle: page rendered and demo hidden
  test('S0_Idle: Page renders initial content and demo is hidden (entry action effect)', async ({ page }) => {
    // Validate initial render and that the demo result is hidden by default.
    const demoPage = new RefactoringDemoPage(page);
    await demoPage.goto();

    // The FSM S0_Idle entry action is "renderPage()". Verify observable effect: header is present.
    const headerText = await demoPage.getHeaderText();
    expect(headerText).toContain('Comprehensive Guide to Code Refactoring');

    // By FSM/component definition #demoResult should start hidden (style="display: none;")
    const visible = await demoPage.isDemoVisible();
    expect(visible).toBe(false);

    // Ensure no runtime page errors were emitted during page load (edge case verification)
    expect(pageErrors.length, `Expected no page errors on initial load, got: ${JSON.stringify(pageErrors)}`).toBe(0);

    // Also capture console output exists as an array (we don't expect errors)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMessages.length, `Unexpected console errors/warnings: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
  });

  // Test transition S0 -> S1 (ShowRefactoringDemo click makes demo visible)
  test('Transition S0 -> S1: clicking the Show Refactoring Example button displays #demoResult', async ({ page }) => {
    const demoPage = new RefactoringDemoPage(page);
    await demoPage.goto();

    // Precondition: hidden
    expect(await demoPage.isDemoVisible()).toBe(false);

    // Click the button (event: ShowRefactoringDemo)
    await demoPage.clickToggle();

    // After click: S1_DemoVisible
    expect(await demoPage.isDemoVisible()).toBe(true);

    // Check that expected content is present inside demoResult (evidence of demo rendering)
    const innerText = await demoPage.getDemoInnerText();
    expect(innerText).toContain('Before Refactoring');
    expect(innerText).toContain('After Refactoring');

    // Ensure no runtime page errors were emitted during the transition
    expect(pageErrors.length, `Expected no page errors after showing demo, got: ${JSON.stringify(pageErrors)}`).toBe(0);

    // No console errors
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMessages.length, `Unexpected console errors/warnings after click: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
  });

  // Test transition S1 -> S2 (second click hides demo)
  test('Transition S1 -> S2: clicking the button when demo is visible hides #demoResult', async ({ page }) => {
    const demoPage = new RefactoringDemoPage(page);
    await demoPage.goto();

    // Show demo first
    await demoPage.clickToggle();
    expect(await demoPage.isDemoVisible()).toBe(true);

    // Click again to hide
    await demoPage.clickToggle();

    // After second click: S2_DemoHidden
    expect(await demoPage.isDemoVisible()).toBe(false);

    // Verify the element still exists in DOM but is hidden (structure check)
    const demoLocator = page.locator('#demoResult');
    expect(await demoLocator.count()).toBe(1);

    // No page errors during hide
    expect(pageErrors.length, `Expected no page errors after hiding demo, got: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  // Test transition S2 -> S1 (toggle back to visible)
  test('Transition S2 -> S1: toggling twice more returns demo to visible state', async ({ page }) => {
    const demoPage = new RefactoringDemoPage(page);
    await demoPage.goto();

    // Ensure hidden -> show -> hide -> show sequence
    expect(await demoPage.isDemoVisible()).toBe(false);

    // show (S0 -> S1)
    await demoPage.clickToggle();
    expect(await demoPage.isDemoVisible()).toBe(true);

    // hide (S1 -> S2)
    await demoPage.clickToggle();
    expect(await demoPage.isDemoVisible()).toBe(false);

    // show again (S2 -> S1)
    await demoPage.clickToggle();
    expect(await demoPage.isDemoVisible()).toBe(true);

    // Confirm content still present and consistent
    const innerText = await demoPage.getDemoInnerText();
    expect(innerText).toContain('function calculateTotal(items)');
    expect(innerText).toContain('applyDiscount');

    // Confirm no uncaught page errors
    expect(pageErrors.length, `Expected no page errors after multiple toggles, got: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  // Edge cases & error observation tests
  test('Edge cases: rapid toggling and runtime error observation (ensure no uncaught runtime errors)', async ({ page }) => {
    const demoPage = new RefactoringDemoPage(page);
    await demoPage.goto();

    // Rapidly click the toggle button multiple times to ensure toggle logic is stable
    for (let i = 0; i < 6; i++) {
      await demoPage.clickToggle();
    }

    // Final visibility is dependent on parity of clicks (6 clicks = even -> back to initial hidden state)
    const finalVisible = await demoPage.isDemoVisible();
    // initial hidden -> 6 toggles -> hidden
    expect(finalVisible).toBe(false);

    // No uncaught runtime page errors have been recorded
    expect(pageErrors.length, `Expected zero page errors after rapid toggling; found: ${JSON.stringify(pageErrors)}`).toBe(0);

    // No console errors/warnings during the stress interactions
    const consoleErrs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrs.length, `Expected no console errors after rapid toggling; found: ${JSON.stringify(consoleErrs)}`).toBe(0);
  });

  // Observability test: confirm we can capture console and pageerror events (even if none occur)
  test('Observability: confirm console and pageerror listeners are functional', async ({ page }) => {
    const demoPage = new RefactoringDemoPage(page);

    // Navigate and perform a basic interaction to ensure listeners have opportunity to collect events
    await demoPage.goto();
    await demoPage.clickToggle();
    await demoPage.clickToggle();

    // At this point, the arrays should be defined (listeners attached in beforeEach)
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // Assert there are no uncaught page errors as part of healthy application validation.
    // This is important to detect regressions: if a ReferenceError, TypeError, or SyntaxError were present,
    // pageErrors would contain entries and this assertion would fail, surfacing the problem.
    expect(pageErrors.length, `Expected no page errors (uncaught exceptions). If there are errors, they are: ${JSON.stringify(pageErrors)}`).toBe(0);

    // If there are console error messages, fail the test and print them for debugging
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorMessages.length, `Console reported error/warning messages: ${JSON.stringify(consoleErrorMessages)}`).toBe(0);
  });
});