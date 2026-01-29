import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b3bf41-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Unit Testing Demo page
class UnitTestingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runTestsBtn');
    this.results = page.locator('#testResults');
    this.pre = page.locator('pre');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runBtn.click();
  }

  // Returns array of text content for immediate children of #testResults (excluding the summary)
  async getResultChildrenText() {
    return await this.results.evaluate((el) => {
      // collect all direct children except the final summary which has bold fontWeight,
      // but we keep everything and let tests decide.
      return Array.from(el.children).map((c) => c.innerText || c.textContent || '');
    });
  }

  async getSummaryText() {
    return await this.results.locator('div').last().innerText();
  }

  // Count elements by class inside #testResults
  async countByClass(className) {
    return await this.results.locator(`.${className}`).count();
  }

  // Return whether runAllTests is defined on the page
  async hasRunAllTestsFunction() {
    return await this.page.evaluate(() => typeof runAllTests === 'function');
  }

  // Return number of tests defined in the page's tests array
  async getDefinedTestsCount() {
    return await this.page.evaluate(() => Array.isArray(tests) ? tests.length : 0);
  }
}

test.describe('Unit Testing Demo (FSM validation)', () => {
  // Capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // collect console messages that are errors
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', (err) => {
      // collect uncaught exceptions from the page
      pageErrors.push(err);
    });
  });

  test('S0_Idle: Initial render shows Run Unit Tests button and empty results', async ({ page }) => {
    // Validate the Idle state entry action (renderPage) by loading the page
    const app = new UnitTestingPage(page);
    await app.goto();

    // Page should have rendered heading and preformatted add function
    await expect(app.heading).toHaveText('Unit Testing Demo');
    const preText = await app.pre.textContent();
    expect(preText).toBeTruthy();
    expect(preText).toContain('function add'); // validate the example function is shown

    // Run button exists and is visible
    await expect(app.runBtn).toBeVisible();
    await expect(app.runBtn).toHaveText('Run Unit Tests');

    // testResults should be present and initially empty (no children)
    const resultChildren = await app.results.evaluate((el) => el.children.length);
    expect(resultChildren).toBe(0);

    // Internal test framework objects exist on the page
    const hasRunFunc = await app.hasRunAllTestsFunction();
    expect(hasRunFunc).toBe(true);

    const definedTests = await app.getDefinedTestsCount();
    expect(definedTests).toBe(5); // 5 tests defined in the HTML

    // Ensure no console error or page error occurred during initial render
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1_Testing: Clicking Run Unit Tests transitions to Testing state and displays results', async ({ page }) => {
    // This test validates the transition from Idle -> Testing triggered by clicking the button.
    const app1 = new UnitTestingPage(page);
    await app.goto();

    // Ensure preconditions
    expect(await app.getDefinedTestsCount()).toBe(5);
    expect(await app.results.evaluate((el) => el.children.length)).toBe(0);

    // Click to run tests (this should invoke runAllTests())
    await app.clickRun();

    // After clicking, #testResults should be populated
    await expect(app.results).toBeVisible();

    // Wait for results to be appended - there should be at least the 5 test result items + summary
    await page.waitForFunction(() => {
      const el = document.getElementById('testResults');
      return el && el.children.length >= 1;
    });

    // Count pass/fail elements
    const passCount = await app.countByClass('test-pass');
    const failCount = await app.countByClass('test-fail');

    // All tests in the provided HTML should pass
    expect(passCount).toBe(5);
    expect(failCount).toBe(0);

    // Verify summary shows Passed: 5, Failed: 0
    const summaryText = await app.getSummaryText();
    expect(summaryText).toContain('Passed: 5');
    expect(summaryText).toContain('Failed: 0');

    // Verify that each pass element starts with a check mark and the proper test name
    const resultTexts = await app.getResultChildrenText();
    const passItems = resultTexts.filter((t) => t.includes('✓'));
    expect(passItems.length).toBe(5);
    expect(passItems.some((t) => t.includes('add(1, 2)'))).toBe(true);
    expect(passItems.some((t) => t.includes("add('Hello'")) || passItems.some((t) => t.includes('Hello'))).toBe(true);

    // Ensure no console errors or uncaught page errors happened during test run
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Clicking Run Unit Tests multiple times clears previous results and re-runs tests', async ({ page }) => {
    // Validate that runAllTests clears previous results and produces fresh output each click
    const app2 = new UnitTestingPage(page);
    await app.goto();

    // First run
    await app.clickRun();
    await page.waitForFunction(() => {
      const el1 = document.getElementById('testResults');
      return el && el.children.length >= 1;
    });
    const firstPassCount = await app.countByClass('test-pass');
    expect(firstPassCount).toBe(5);

    // Mutate the DOM slightly to ensure clearing is observable:
    // We will read the text of the first child to compare after the second run.
    const firstChildTextBefore = await app.results.locator('div').first().innerText();

    // Second run - should clear previous results and re-render
    await app.clickRun();

    // Wait for re-render by ensuring the first child text either matches or updates quickly
    await page.waitForFunction(() => {
      const el2 = document.getElementById('testResults');
      return el && el.children.length >= 1;
    });

    const firstChildTextAfter = await app.results.locator('div').first().innerText();

    // The content should still be a test-pass and present; it may be identical text but DOM was cleared and recreated.
    expect(firstChildTextAfter).toBeTruthy();
    const secondPassCount = await app.countByClass('test-pass');
    expect(secondPassCount).toBe(5);

    // It's acceptable for the text to be equal (same results), but ensure that results are still present after rerun.
    expect(secondPassCount).toBe(firstPassCount);

    // Ensure summary is correct after second run
    const summaryText1 = await app.getSummaryText();
    expect(summaryText).toContain('Passed: 5');
    expect(summaryText).toContain('Failed: 0');

    // No console or page errors expected during repeated runs
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity checks: Validate DOM classes and styling hints for pass/fail results', async ({ page }) => {
    // Validate that passing results have class test-pass and failing results (none here) would have test-fail
    const app3 = new UnitTestingPage(page);
    await app.goto();

    await app.clickRun();

    await page.waitForFunction(() => {
      const el3 = document.getElementById('testResults');
      return el && el.children.length >= 1;
    });

    const passCount1 = await app.countByClass('test-pass');
    const failCount1 = await app.countByClass('test-fail');

    // There should be 5 pass and 0 fail as defined by the embedded tests
    expect(passCount).toBe(5);
    expect(failCount).toBe(0);

    // Check computed color style for a pass element (green color expected by CSS .test-pass)
    // This verifies that visual feedback is applied (color might be reported differently across browsers;
    // we check that the element has class 'test-pass' and that a color is computed).
    const firstPassColor = await app.results.locator('.test-pass').first().evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(firstPassColor).toBeTruthy();

    // Ensure that the fail class is absent in DOM (no failing tests)
    const failElements = await app.results.locator('.test-fail').count();
    expect(failElements).toBe(0);

    // No console or page errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Final safety checks after each test to ensure the page didn't raise unexpected errors during interactions.
    // The arrays are captured in the beforeEach and mutated by listeners.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // Close page to clean up
    await page.close();
  });
});