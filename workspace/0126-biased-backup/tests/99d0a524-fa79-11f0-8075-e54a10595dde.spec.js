import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0a524-fa79-11f0-8075-e54a10595dde.html';

// Page Object to encapsulate interactions with the demo app
class DemoAppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Buttons
    this.runTestsBtn = "button[onclick='runTests()']";
    this.testAdditionBtn = "button[onclick='testAddition()']";
    this.calculateProductBtn = "button[onclick='calculateProduct()']";
    // Inputs
    this.calcInputA = 'input#calcInputA';
    this.calcInputB = 'input#calcInputB';
    this.multiplier = 'input#multiplier';
    this.baseNumber = 'input#baseNumber';
    // Outputs
    this.testOutput = '#testOutput';
    this.calcTestOutput = '#calcTestOutput';
    this.productOutput = '#productOutput';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRunTests() {
    await this.page.click(this.runTestsBtn);
  }

  async clickTestAddition() {
    await this.page.click(this.testAdditionBtn);
  }

  async clickCalculateProduct() {
    await this.page.click(this.calculateProductBtn);
  }

  async setCalcInputs(a, b) {
    // Use fill to set values (works for number inputs as well)
    await this.page.fill(this.calcInputA, String(a));
    await this.page.fill(this.calcInputB, String(b));
  }

  async setMultiplierAndBase(mult, base) {
    await this.page.fill(this.multiplier, String(mult));
    await this.page.fill(this.baseNumber, String(base));
  }

  async getTestOutputText() {
    return (await this.page.locator(this.testOutput).innerText()).trim();
  }

  async getCalcTestOutputText() {
    return (await this.page.locator(this.calcTestOutput).innerText()).trim();
  }

  async getProductOutputText() {
    return (await this.page.locator(this.productOutput).innerText()).trim();
  }

  async elementExists(selector) {
    return await this.page.locator(selector).count() > 0;
  }

  async getInputValue(selector) {
    return await this.page.locator(selector).inputValue();
  }
}

test.describe('Unit Testing Interactive Demo (FSM: Idle -> Testing)', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {DemoAppPage} */
  let app;
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    app = new DemoAppPage(page);

    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and categorize them
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught exceptions from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', error => {
      // error is an Error object
      pageErrors.push(error);
    });

    await app.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Idle state: initial render shows all controls and default values', async () => {
    // Verify presence of Run Tests, Test Addition, Calculate Product buttons
    await expect(page.locator(app.runTestsBtn)).toHaveCount(1);
    await expect(page.locator(app.testAdditionBtn)).toHaveCount(1);
    await expect(page.locator(app.calculateProductBtn)).toHaveCount(1);

    // Verify presence of calculator inputs
    await expect(page.locator(app.calcInputA)).toHaveCount(1);
    await expect(page.locator(app.calcInputB)).toHaveCount(1);

    // Verify presence and default values for multiplier and baseNumber
    await expect(page.locator(app.multiplier)).toHaveCount(1);
    await expect(page.locator(app.baseNumber)).toHaveCount(1);
    const multVal = await app.getInputValue(app.multiplier);
    const baseVal = await app.getInputValue(app.baseNumber);

    // Defaults in HTML markup are "1"
    expect(multVal).toBe('1');
    expect(baseVal).toBe('1');

    // Outputs should be present but empty initially
    expect(await app.getTestOutputText()).toBe('');
    expect(await app.getCalcTestOutputText()).toBe('');
    expect(await app.getProductOutputText()).toBe('');

    // Assert no runtime page errors occurred during initial render
    expect(pageErrors.length).toBe(0);
    // Assert no console 'error' messages were emitted
    expect(consoleErrors.length).toBe(0);
  });

  test('Run Tests transition: clicking Run Tests runs test suite and updates outputs', async () => {
    // Clicking Run Tests should invoke runTests(), which calls testAddition (the page's current definition)
    await app.clickRunTests();

    // Validate that the testOutput shows the result string expected from runTests()
    const testOutput = await app.getTestOutputText();
    // The runTests implementation sets "All Tests Passed!" unless a thrown error occurs
    expect(testOutput).toBe('All Tests Passed!');

    // Because testAddition invoked inside runTests() uses inputs (redefined), it will update calcTestOutput.
    // With blank numeric inputs the numeric conversion yields 0 + 0 => "Result: 0"
    const calcOutput = await app.getCalcTestOutputText();
    expect(calcOutput).toMatch(/^Result:\s*\d+$/); // e.g., "Result: 0"

    // No uncaught page errors should have been produced by running the tests
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Test Addition transition: uses provided numeric inputs and shows expected result', async () => {
    // Provide valid numbers and click Test Addition
    await app.setCalcInputs(2, 3);
    await app.clickTestAddition();

    // Validate output shows the expected sum "Result: 5"
    const calcOutput = await app.getCalcTestOutputText();
    expect(calcOutput).toBe('Result: 5');

    // Ensure the unit-test style behaviour transitioned to testing state (evidence: calcTestOutput changed)
    expect(calcOutput.length).toBeGreaterThan(0);

    // Ensure no page errors occurred during the action
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Test Addition edge case: invalid inputs produce user-facing message', async () => {
    // Fill an invalid (non-numeric) value into the number input. This simulates a user-provided invalid string.
    // The page's function uses Number(...) which will produce NaN and trigger the "Please enter valid numbers." branch.
    await page.fill(app.calcInputA, 'abc');
    await page.fill(app.calcInputB, '3'); // keep one valid
    await app.clickTestAddition();

    // Validate the page displays the expected error message for invalid numeric input
    const calcOutput = await app.getCalcTestOutputText();
    expect(calcOutput).toBe('Please enter valid numbers.');

    // Confirm that this condition doesn't emit uncaught page errors (handled by code path)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Calculate Product transition: default and custom values produce correct product output', async () => {
    // With default inputs (1 and 1) clicking Calculate Product should yield Product: 1
    await app.clickCalculateProduct();
    let productText = await app.getProductOutputText();
    expect(productText).toBe('Product: 1');

    // Now set custom multiplier and baseNumber and verify product computation
    await app.setMultiplierAndBase(4, 5);
    await app.clickCalculateProduct();
    productText = await app.getProductOutputText();
    expect(productText).toBe('Product: 20');

    // Validate no runtime exceptions or console errors were produced
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observes console messages and page errors while exercising all transitions', async () => {
    // Clear any previously captured messages for isolation
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Exercise all three transitions sequentially
    await app.setCalcInputs(7, 8); // prepare for Test Addition
    await app.clickTestAddition();

    await app.setMultiplierAndBase(6, 7);
    await app.clickCalculateProduct();

    await app.clickRunTests();

    // Gather textual outputs to ensure transitions occurred
    const calcOutput = await app.getCalcTestOutputText();
    const productOutput = await app.getProductOutputText();
    const testOutput = await app.getTestOutputText();

    // Sanity checks: outputs reflect actions performed
    expect(calcOutput).toBe('Result: 15'); // 7 + 8
    expect(productOutput).toBe('Product: 42'); // 6 * 7
    expect(testOutput).toBe('All Tests Passed!');

    // Inspect captured console messages: none should be of type 'error' for a healthy run
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);

    // Inspect page-level uncaught exceptions: expect none
    expect(pageErrors.length).toBe(0);

    // For diagnostics, if there were console messages, they should be string values (we still assert no errors)
    for (const msg of consoleMessages) {
      expect(typeof msg.text).toBe('string');
    }
  });
});