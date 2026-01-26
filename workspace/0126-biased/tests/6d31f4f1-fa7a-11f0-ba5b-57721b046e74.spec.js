import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d31f4f1-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Unit Testing Playground
class PlaygroundPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Navigation helpers: show sections by clicking header buttons
  async showSuiteSection() {
    await this.page.click('button[onclick="showSection(\'suiteSection\')"]');
  }
  async showAddTestsSection() {
    await this.page.click('button[onclick="showSection(\'testSection\')"]');
  }
  async showRunSection() {
    await this.page.click('button[onclick="showSection(\'runSection\')"]');
  }
  async showHistorySection() {
    await this.page.click('button[onclick="showSection(\'historySection\')"]');
  }
  async showExamplesSection() {
    await this.page.click('button[onclick="showSection(\'examplesSection\')"]');
  }

  // Suite actions
  async createNewSuite(name, description = '') {
    await this.showSuiteSection();
    await this.page.fill('#suiteName', name);
    await this.page.fill('#suiteDescription', description);
    await this.page.click('button[onclick="createNewSuite()"]');
  }
  async getCurrentSuiteText() {
    return this.page.textContent('#currentSuite');
  }

  // Add test actions
  async addTestByUi(name, code) {
    await this.showAddTestsSection();
    if (name !== null) await this.page.fill('#testName', name);
    if (code !== null) await this.page.fill('#testCode', code);
    await this.page.click('button[onclick="addTest()"]');
  }
  async getTestListItems() {
    return this.page.$$eval('#testList li', nodes => nodes.map(n => n.textContent));
  }
  async deleteTestAtIndex(index) {
    // delete button is appended as a child of the li; select nth li's button
    const buttons = await this.page.$$('#testList li button');
    if (buttons[index]) await buttons[index].click();
  }

  // Examples actions
  async selectExample(value) {
    await this.showExamplesSection();
    await this.page.selectOption('#exampleSelect', value);
  }
  async clickLoadExample() {
    await this.page.click('button[onclick="loadExample()"]');
  }

  // Run tests actions
  async selectAssertionLibrary(value) {
    await this.showRunSection();
    await this.page.selectOption('#assertionLibrary', value);
  }
  async runAllTests() {
    await this.showRunSection();
    await this.page.click('button[onclick="runTests()"]');
  }
  async getResultCounts() {
    const passed = await this.page.textContent('#passedCount');
    const failed = await this.page.textContent('#failedCount');
    const total = await this.page.textContent('#totalCount');
    return {
      passed: Number(passed),
      failed: Number(failed),
      total: Number(total)
    };
  }
  async getResultsListTexts() {
    return this.page.$$eval('#resultsList li', nodes => nodes.map(n => n.textContent));
  }

  // History actions
  async getHistoryItems() {
    return this.page.$$eval('#historyList li', nodes => nodes.map(n => n.textContent));
  }
  async clickHistoryItem(index = 0) {
    const items = await this.page.$$('#historyList li');
    if (items[index]) await items[index].click();
  }
  async getHistoryDetailsText() {
    return this.page.textContent('#historyDetails');
  }

  // Utility to read global variable on the page
  async getGlobalVariable(varName) {
    return this.page.evaluate(name => window[name], varName);
  }

  // Utility to attempt calling a function name on the page (used to validate missing onEnter actions like renderPage)
  async callGlobalFunctionExpectThrow(functionName) {
    // Attempt to call a global function; return the serialized error if thrown
    return this.page.evaluate(name => {
      try {
        // Intentionally call the function if present; if not present this throws ReferenceError
        // Let the error propagate to be caught by the caller (Playwright will reject)
        // But we catch here and return an object for inspection.
        // Note: We purposely DO NOT define or patch functions on the page.
        window[name]();
        return { ok: true };
      } catch (e) {
        // Return the error details so tests can assert on them (this does not modify page code)
        return { ok: false, message: e && e.message, name: e && e.name };
      }
    }, functionName);
  }
}

test.describe('Unit Testing Playground - FSM and UI validations', () => {
  // Collect console and page errors for observation
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle state: verify default section visibility and navigation between sections', async ({ page }) => {
    // This test validates S0_Idle and navigation to other states S1..S5 by clicking header buttons.
    const pp = new PlaygroundPage(page);
    await pp.goto();

    // Initially suiteSection should be visible and others hidden
    const suiteDisplay = await page.$eval('#suiteSection', el => getComputedStyle(el).display);
    const testDisplay = await page.$eval('#testSection', el => getComputedStyle(el).display);
    const runDisplay = await page.$eval('#runSection', el => getComputedStyle(el).display);
    const historyDisplay = await page.$eval('#historySection', el => getComputedStyle(el).display);
    const examplesDisplay = await page.$eval('#examplesSection', el => getComputedStyle(el).display);

    expect(suiteDisplay).toBe('block'); // S0_Idle entry renders suite section as visible
    expect(testDisplay).toBe('none');
    expect(runDisplay).toBe('none');
    expect(historyDisplay).toBe('none');
    expect(examplesDisplay).toBe('none');

    // Navigate to Add Tests (S2_AddTests)
    await pp.showAddTestsSection();
    expect(await page.$eval('#testSection', el => getComputedStyle(el).display)).toBe('block');

    // Navigate to Run Tests (S3_RunTests)
    await pp.showRunSection();
    expect(await page.$eval('#runSection', el => getComputedStyle(el).display)).toBe('block');

    // Navigate to History (S4_TestHistory)
    await pp.showHistorySection();
    expect(await page.$eval('#historySection', el => getComputedStyle(el).display)).toBe('block');

    // Navigate to Examples (S5_Examples)
    await pp.showExamplesSection();
    expect(await page.$eval('#examplesSection', el => getComputedStyle(el).display)).toBe('block');
  });

  test('Verify onEnter action mentioned in FSM (renderPage) is absent and produces ReferenceError if invoked', async ({ page }) => {
    // FSM mentions a renderPage() entry action. The implementation does not define it.
    // We will attempt to call it to validate the expected ReferenceError occurs naturally.
    const pp = new PlaygroundPage(page);
    await pp.goto();

    const result = await pp.callGlobalFunctionExpectThrow('renderPage');
    // The page evaluates and returns an object describing the caught error.
    // We assert that renderPage is absent and a ReferenceError-like response is returned.
    expect(result.ok).toBe(false);
    expect(result.name).toMatch(/ReferenceError|TypeError|Error/); // different engines can label differently
    expect(String(result.message)).toContain('renderPage');
  });

  test.describe('Test Suite lifecycle and Add Tests interactions', () => {
    test('Create new suite transition (S1_TestSuite) and verify UI updates', async ({ page }) => {
      // Validates CreateNewSuite event and S1 state behavior
      const pp = new PlaygroundPage(page);
      await pp.goto();

      await pp.createNewSuite('My Suite', 'A description');
      const currentSuite = await pp.getCurrentSuiteText();
      expect(currentSuite).toBe('My Suite');

      // Ensure inputs cleared after creation
      const suiteNameVal = await page.$eval('#suiteName', el => el.value);
      const suiteDescVal = await page.$eval('#suiteDescription', el => el.value);
      expect(suiteNameVal).toBe('');
      expect(suiteDescVal).toBe('');

      // Ensure the page's global currentTestSuite has the new name (inspect global variable)
      const nameOnPage = await pp.getGlobalVariable('currentTestSuite');
      expect(nameOnPage).toBeTruthy();
      expect(nameOnPage.name).toBe('My Suite');
    });

    test('Add Test event (S2_AddTests): validation, addition, and deletion', async ({ page }) => {
      // This test covers edge cases: adding without name/code, adding valid test, deleting it.
      const pp = new PlaygroundPage(page);
      await pp.goto();

      // Try adding with missing fields - should not create an entry
      await pp.addTestByUi('', ''); // both empty
      let items = await pp.getTestListItems();
      expect(items.length).toBe(0);

      // Add valid test
      await pp.addTestByUi('Sample test', 'assert.equal(1+1, 2, "math works");');
      items = await pp.getTestListItems();
      expect(items.length).toBe(1);
      expect(items[0]).toContain('Sample test - not run');

      // Delete the test
      await pp.deleteTestAtIndex(0);
      items = await pp.getTestListItems();
      expect(items.length).toBe(0);
    });
  });

  test.describe('Examples -> Add Tests transition and Running tests', () => {
    test('Load Example (S5_Examples) then inspect tests in AddTests (S2_AddTests)', async ({ page }) => {
      // Load math example and ensure the test suite has expected tests
      const pp = new PlaygroundPage(page);
      await pp.goto();

      // Ensure we have a named suite so history shows a non-empty suite name after run
      await pp.createNewSuite('Example Suite', 'Used for examples');

      await pp.selectExample('math');
      await pp.clickLoadExample();

      // Now show the Add Tests section and validate test list length and names
      await pp.showAddTestsSection();
      const items = await pp.getTestListItems();
      // Math example contains 3 tests in the implementation
      expect(items.length).toBe(3);
      expect(items[0]).toContain('Addition test');
      expect(items[1]).toContain('Multiplication test');
      expect(items[2]).toContain('Division test');
    });

    test('Run All Tests (S3_RunTests) for math examples and validate results, history and UI colors', async ({ page }) => {
      // Run the math example tests and assert expected pass/fail counts
      const pp = new PlaygroundPage(page);
      await pp.goto();

      // Create a suite and load math example
      await pp.createNewSuite('Math Suite', 'Testing math');
      await pp.selectExample('math');
      await pp.clickLoadExample();

      // Run tests
      await pp.runAllTests();
      const counts = await pp.getResultCounts();

      // In the provided implementation:
      // - Addition test: should pass
      // - Multiplication test: should pass
      // - Division test: expects throw on division by zero; but 1/0 is Infinity in JS, no throw => test fails
      expect(counts.total).toBe(3);
      expect(counts.passed).toBe(2);
      expect(counts.failed).toBe(1);

      const results = await pp.getResultsListTexts();
      // Check that at least one failed result mentions the assertion message about expected throw
      const hasFailed = results.some(r => /Expected function to throw|throw/.test(r));
      expect(hasFailed).toBeTruthy();

      // History should record the run
      const history = await pp.getHistoryItems();
      expect(history.length).toBeGreaterThanOrEqual(1);
      // Click the most recent history entry and validate details box content
      await pp.clickHistoryItem(0);
      const details = await pp.getHistoryDetailsText();
      expect(details).toContain('Suite: Math Suite');
      expect(details).toContain('Passed: 2');
      expect(details).toContain('Failed: 1');
    });
  });

  test.describe('Edge cases and explicit error scenarios (ReferenceError, SyntaxError, TypeError)', () => {
    test('Add tests that produce ReferenceError, SyntaxError and TypeError and assert run displays those errors', async ({ page }) => {
      // This test intentionally adds test code that triggers various JS errors
      const pp = new PlaygroundPage(page);
      await pp.goto();

      await pp.createNewSuite('Error Suite', 'Contains failing tests');

      // Add a ReferenceError-producing test
      await pp.addTestByUi('Ref Error Test', 'nonexistentVar++;');

      // Add a TypeError-producing test
      await pp.addTestByUi('Type Error Test', 'throw new TypeError("explicit type error");');

      // Add a SyntaxError-producing test - invalid JS code inside function body
      // When new Function is invoked in runTests it will throw a SyntaxError during construction
      await pp.addTestByUi('Syntax Error Test', 'function () {'); // invalid

      // Run tests
      await pp.runAllTests();
      const counts = await pp.getResultCounts();
      // All three should fail
      expect(counts.total).toBe(3);
      expect(counts.passed).toBe(0);
      expect(counts.failed).toBe(3);

      const results = await pp.getResultsListTexts().then(arr => arr.join('\n'));

      // Assert that ReferenceError message appears
      expect(results).toMatch(/ReferenceError|nonexistentVar/);

      // Assert that TypeError message appears
      expect(results).toMatch(/TypeError|explicit type error/);

      // Assert that SyntaxError or Unexpected token appears (message varies by engine)
      expect(results).toMatch(/SyntaxError|Unexpected token|Unexpected end of input/);
    });

    test('Running tests when none exist should report totals of zero', async ({ page }) => {
      // Ensures runTests handles empty test suite gracefully
      const pp = new PlaygroundPage(page);
      await pp.goto();

      await pp.createNewSuite('Empty Suite', 'No tests');
      // Ensure there are no tests
      const testsBefore = await pp.getTestListItems();
      expect(testsBefore.length).toBe(0);

      // Run all tests - should show zero counts and not throw uncaught exceptions
      await pp.runAllTests();
      const counts = await pp.getResultCounts();
      expect(counts.total).toBe(0);
      expect(counts.passed).toBe(0);
      expect(counts.failed).toBe(0);
    });
  });

  test('Change assertion library dropdown (ChangeAssertionLibrary event) updates page global', async ({ page }) => {
    // Validate that onchange event changes the global assertionLibrary variable
    const pp = new PlaygroundPage(page);
    await pp.goto();

    // Default is 'assert' initially
    const initial = await pp.getGlobalVariable('assertionLibrary');
    expect(initial).toBe('assert');

    // Change to chai and validate global value updates
    await pp.selectAssertionLibrary('chai');
    const changed = await pp.getGlobalVariable('assertionLibrary');
    expect(changed).toBe('chai');

    // Change to jasmine and validate
    await pp.selectAssertionLibrary('jasmine');
    const changed2 = await pp.getGlobalVariable('assertionLibrary');
    expect(changed2).toBe('jasmine');
  });

  test('Observe console messages and page errors during testing flow', async ({ page }) => {
    // This test demonstrates capturing console messages and page errors while exercising the app.
    const pp = new PlaygroundPage(page);
    await pp.goto();

    // Perform some interactions that may produce console messages (none expected by default)
    await pp.createNewSuite('Console Suite', 'For console observation');
    await pp.addTestByUi('Log Test', 'console.log("inside test"); assert.equal(1,1);');

    // Run tests, which will execute console.log inside the new Function context; that should produce a console message
    await pp.runAllTests();

    // Small sleep to let console events be delivered
    await page.waitForTimeout(100);

    // Check collected console messages include the test's console.log call
    const logs = consoleMessages.map(m => m.text).join('\n');
    expect(logs).toContain('inside test');

    // There should be no uncaught page errors in normal flows we've just executed
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Optional: top-level sanity that page didn't emit unexpected uncaught errors during tests
    // (Some tests intentionally generate errors but they are caught inside the app and do not surface as pageerrors.)
    // We assert that any uncaught pageerrors are intentional; here we fail if truly unhandled errors were emitted.
    // For the purpose of this test suite we expect no uncaught page errors.
    expect(pageErrors.length).toBe(0);
  });
});