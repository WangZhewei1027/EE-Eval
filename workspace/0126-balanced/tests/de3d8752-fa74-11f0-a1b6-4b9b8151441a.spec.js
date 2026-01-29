import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d8752-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Unit Testing Demo page
class UnitTestingDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.calcButton = page.locator("button[onclick='runCalculatorTests()']");
    this.stringButton = page.locator("button[onclick='runStringTests()']");
    this.asyncButton = page.locator("button[onclick='runAsyncTests()']");

    this.test1Results = page.locator('#test1-results');
    this.test2Results = page.locator('#test2-results');
    this.test3Results = page.locator('#test3-results');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click actions
  async clickCalculator() {
    await this.calcButton.click();
  }
  async clickString() {
    await this.stringButton.click();
  }
  async clickAsync() {
    await this.asyncButton.click();
  }

  // Helpers to assert intermediate "Running ..." header appears
  async expectRunningHeader(containerLocator, expectedText) {
    // Wait for the <h3> Running ... text to be present
    const header = containerLocator.locator('h3');
    await expect(header).toHaveText(expectedText, { timeout: 2000 });
  }

  // Helpers to get counts of pass/fail results in a container
  async countPass(containerLocator) {
    return await containerLocator.locator('.pass').count();
  }
  async countFail(containerLocator) {
    return await containerLocator.locator('.fail').count();
  }

  // Get all result texts in a container
  async getAllResultTexts(containerLocator) {
    const items = containerLocator.locator('.pass, .fail');
    const count = await items.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await items.nth(i).innerText());
    }
    return texts;
  }
}

test.describe('Unit Testing Demo - FSM States and Transitions', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test initial Idle state: buttons present and result containers empty
  test('Idle state: initial render shows test buttons and empty result areas', async ({ page }) => {
    const app = new UnitTestingDemoPage(page);
    // Load the page exactly as-is
    await app.goto();

    // Verify buttons exist (evidence of Idle state's UI)
    await expect(app.calcButton).toBeVisible();
    await expect(app.stringButton).toBeVisible();
    await expect(app.asyncButton).toBeVisible();

    // Verify result containers exist and are initially empty (or do not contain test results)
    await expect(app.test1Results).toBeVisible();
    await expect(app.test2Results).toBeVisible();
    await expect(app.test3Results).toBeVisible();

    // They may be empty strings or contain only whitespace/newlines
    await expect(app.test1Results).toHaveText('', { timeout: 1000 });
    await expect(app.test2Results).toHaveText('', { timeout: 1000 });
    await expect(app.test3Results).toHaveText('', { timeout: 1000 });

    // Assert no console or page errors occurred during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Transition: Run Calculator Tests -> CalculatorTestsRunning state
  test('Transition: Run Calculator Tests shows running header then test results', async ({ page }) => {
    const app1 = new UnitTestingDemoPage(page);
    await app.goto();

    // Click the Run Calculator Tests button (event trigger)
    await app.clickCalculator();

    // On enter: immediate UI should show Running Calculator Tests...
    await app.expectRunningHeader(app.test1Results, 'Running Calculator Tests...');

    // After async tests complete (~500ms), expect five passing test results
    // Wait for .pass elements to appear (five expected)
    await expect(app.test1Results.locator('.pass')).toHaveCount(5, { timeout: 3000 });

    // Ensure there are no failed tests
    const failCount = await app.countFail(app.test1Results);
    expect(failCount).toBe(0);

    // Verify that expected test labels are present in the results
    const texts1 = await app.getAllResultTexts(app.test1Results);
    expect(texts.some(t => t.includes('Add 2 and 3'))).toBeTruthy();
    expect(texts.some(t => t.includes('Subtract 3 from 5'))).toBeTruthy();
    expect(texts.some(t => t.includes('Multiply 2 and 4'))).toBeTruthy();
    expect(texts.some(t => t.includes('Divide 10 by 2'))).toBeTruthy();
    expect(texts.some(t => t.includes('Divide by zero'))).toBeTruthy();

    // Assert no unexpected console or page errors during this interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Transition: Run String Tests -> StringTestsRunning state
  test('Transition: Run String Tests shows running header then string test results', async ({ page }) => {
    const app2 = new UnitTestingDemoPage(page);
    await app.goto();

    // Click Run String Tests
    await app.clickString();

    // Immediate running header must appear
    await app.expectRunningHeader(app.test2Results, 'Running String Tests...');

    // After async completion, expect four passing results
    await expect(app.test2Results.locator('.pass')).toHaveCount(4, { timeout: 3000 });

    // Ensure no fail classes present
    const failCount1 = await app.countFail(app.test2Results);
    expect(failCount).toBe(0);

    // Validate expected test names are present
    const texts2 = await app.getAllResultTexts(app.test2Results);
    expect(texts.some(t => t.includes('Reverse "hello"'))).toBeTruthy();
    expect(texts.some(t => t.includes('Check "racecar" is palindrome'))).toBeTruthy();
    expect(texts.some(t => t.includes('Check "hello" is not palindrome'))).toBeTruthy();
    expect(texts.some(t => t.includes('Check complex palindrome'))).toBeTruthy();

    // Assert no unexpected console or page errors during this interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Transition: Run Async Tests -> AsyncTestsRunning state
  test('Transition: Run Async Tests shows running header then async test results', async ({ page }) => {
    const app3 = new UnitTestingDemoPage(page);
    await app.goto();

    // Click Run Async Tests
    await app.clickAsync();

    // Async tests set the running header synchronously, so assert immediate header
    await app.expectRunningHeader(app.test3Results, 'Running Async Tests...');

    // After the promise resolves (~500ms), expect two passing assertions
    await expect(app.test3Results.locator('.pass')).toHaveCount(2, { timeout: 3000 });

    // Confirm no failures
    const failCount2 = await app.countFail(app.test3Results);
    expect(failCount).toBe(0);

    // Confirm expected labels for async results
    const texts3 = await app.getAllResultTexts(app.test3Results);
    expect(texts.some(t => t.includes('Check returned data id'))).toBeTruthy();
    expect(texts.some(t => t.includes('Check returned data name'))).toBeTruthy();

    // Assert no unexpected console or page errors during this interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: multiple rapid clicks while tests are running
  test('Edge case: Multiple clicks while tests are running should still produce expected results (idempotency/duplication check)', async ({ page }) => {
    const app4 = new UnitTestingDemoPage(page);
    await app.goto();

    // Rapidly click the calculator button twice to simulate concurrency/race condition
    await Promise.all([
      app.clickCalculator(),
      app.clickCalculator()
    ]);

    // Running header should exist
    await app.expectRunningHeader(app.test1Results, 'Running Calculator Tests...');

    // After completion, there should be at least 5 passing results.
    // Implementation may append results twice (10) due to two scheduled timeouts; assert >=5 and that all are passes.
    await expect(app.test1Results.locator('.pass')).toHaveCount(/.*/, { timeout: 3000 }); // Wait until any pass elements appear

    const passCount = await app.countPass(app.test1Results);
    expect(passCount).toBeGreaterThanOrEqual(5);

    // Ensure no fail elements are present
    const failCount3 = await app.countFail(app.test1Results);
    expect(failCount).toBe(0);

    // Assert no unexpected console or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Validate that running headers are present as onEnter actions for each event (extra verification)
  test('onEnter action verification: Running headers are used as entry indicators for each test type', async ({ page }) => {
    const app5 = new UnitTestingDemoPage(page);
    await app.goto();

    // Calculator
    await app.clickCalculator();
    await app.expectRunningHeader(app.test1Results, 'Running Calculator Tests...');
    // Clear by waiting for results to appear so next test area is not affected by timing
    await expect(app.test1Results.locator('.pass')).toHaveCount(5, { timeout: 3000 });

    // String
    await app.clickString();
    await app.expectRunningHeader(app.test2Results, 'Running String Tests...');
    await expect(app.test2Results.locator('.pass')).toHaveCount(4, { timeout: 3000 });

    // Async
    await app.clickAsync();
    await app.expectRunningHeader(app.test3Results, 'Running Async Tests...');
    await expect(app.test3Results.locator('.pass')).toHaveCount(2, { timeout: 3000 });

    // Assert no console or page errors during the sequence
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // After each test we also ensure no uncaught errors were emitted (redundant safety check)
  test.afterEach(async () => {
    // The actual assertions are performed inside each test to ensure visibility into failures.
    // This afterEach is kept to indicate teardown boundary; nothing to do here.
  });
});