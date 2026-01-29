import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122dfad2-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object encapsulating selectors and common interactions
class LogisticPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button1 = page.locator('#button1');
    this.button2 = page.locator('#button2');
    this.input1 = page.locator('#input1');
    this.input2 = page.locator('#input2');
    this.input3 = page.locator('#input3');
    this.submit = page.locator('#submit-button');
    this.results = page.locator('#results');
    this.interface = page.locator('#interface');
    this.heading = page.locator('#interface h1');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickButton1() {
    await this.button1.click();
  }

  async clickButton2() {
    await this.button2.click();
  }

  async fillInput1(value) {
    // Use fill to trigger input events
    await this.input1.fill(value);
  }

  async fillInput2(value) {
    await this.input2.fill(value);
  }

  async clickSubmit() {
    await this.submit.click();
  }
}

test.describe('Logistic Regression Interactive App - FSM Validation', () => {
  // Collects console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will set up its own listeners to capture events for that run.
  });

  // Test initial state S0_Idle (entry_actions: renderPage())
  test('S0_Idle: page renders initial interface with expected elements', async ({ page }) => {
    // Capture page errors and console messages for this test
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const lp = new LogisticPage(page);
    await lp.goto();

    // Validate entry state: interface and heading exist
    await expect(lp.interface).toBeVisible();
    await expect(lp.heading).toHaveText('Logistic Regression');

    // Validate all UI controls exist and are in expected default state
    await expect(lp.button1).toBeVisible();
    await expect(lp.button2).toBeVisible();
    await expect(lp.input1).toHaveValue('');
    await expect(lp.input2).toHaveValue('');
    await expect(lp.input3).toHaveValue('');
    await expect(lp.submit).toBeVisible();
    await expect(lp.results).toHaveText(''); // results empty initially

    // There should be no fatal page errors simply from rendering the page
    expect(pageErrors.length).toBe(0);
    // Console messages may be empty or contain benign logs; just ensure we captured the stream
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  // Test transition: Button1_Click -> S1_InputFilled
  test('Button1_Click fills Input 1 (S1_InputFilled): clicking Button 1 sets Input1 value', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const lp = new LogisticPage(page);
    await lp.goto();

    // Click Button 1 and assert input1 is filled as per implementation
    await lp.clickButton1();

    await expect(lp.input1).toHaveValue('Hello, World!');

    // Because the code sets input1.value programmatically (without dispatching an 'input' event),
    // input3 is not expected to update automatically in this transition.
    await expect(lp.input3).toHaveValue('');

    // Ensure no unexpected page errors occurred as a result of this click
    expect(pageErrors.length).toBe(0);
  });

  // Test transition: Button2_Click -> S1_InputFilled
  test('Button2_Click fills Input 2 (S1_InputFilled): clicking Button 2 sets Input2 value', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const lp = new LogisticPage(page);
    await lp.goto();

    // Click Button 2 and assert input2 is filled as per implementation
    await lp.clickButton2();

    await expect(lp.input2).toHaveValue('This is a test input.');

    // Input3 should remain unchanged since programmatic assignment doesn't trigger input events
    await expect(lp.input3).toHaveValue('');

    // No page errors expected from this simple handler
    expect(pageErrors.length).toBe(0);
  });

  // Test Input1_Change: typing into Input1 updates Input3
  test('Input1_Change updates Input3: typing into Input1 should propagate to Input3', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const lp = new LogisticPage(page);
    await lp.goto();

    // Simulate user typing into input1 which triggers the 'input' event listener
    const testValue = 'User typed value';
    await lp.fillInput1(testValue);

    // Input3 should update to match input1
    await expect(lp.input3).toHaveValue(testValue);

    // No errors expected from input propagation
    expect(pageErrors.length).toBe(0);
  });

  // Test Input2_Change: typing into Input2 updates Input3
  test('Input2_Change updates Input3: typing into Input2 should propagate to Input3', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const lp = new LogisticPage(page);
    await lp.goto();

    // Simulate user typing into input2 which triggers the 'input' event listener
    const testValue = 'Second input content';
    await lp.fillInput2(testValue);

    // Input3 should update to match input2
    await expect(lp.input3).toHaveValue(testValue);

    // No page errors expected
    expect(pageErrors.length).toBe(0);
  });

  // Test Submit_Click transition to S2_PredictionsDisplayed and verify error scenario described in code
  test('Submit_Click should attempt to display predictions but triggers a TypeError (predictions.join is not a function)', async ({ page }) => {
    // Collect page errors emitted during this test
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const lp = new LogisticPage(page);
    await lp.goto();

    // Prepare inputs with numeric-like values to make predict run numeric math.
    // Regardless, the implementation returns a number and the handler expects an array and calls .join,
    // which should cause a TypeError: predictions.join is not a function
    await lp.fillInput1('1.0');
    await lp.fillInput2('2.0');
    await lp.fillInput1('1.0'); // ensure input3 also has a numeric-like value via input1 change
    // Wait briefly to ensure input3 updated
    await page.waitForTimeout(20);

    // Click submit and wait a short time for the event handler to execute and an error (if any) to be thrown
    await lp.clickSubmit();

    // Allow event loop to process the thrown error
    await page.waitForTimeout(50);

    // We expect a TypeError to have been thrown due to .join on a number.
    // Assert that at least one page error occurred and that one matches a TypeError message related to 'join'
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    const hasJoinTypeError = pageErrors.some(e => {
      // e is an Error: check name/message
      const name = e.name || '';
      const msg = (e.message || '').toLowerCase();
      return name === 'TypeError' || msg.includes('join') || msg.includes('is not a function');
    });

    expect(hasJoinTypeError).toBeTruthy();

    // Verify that results div was NOT populated due to the thrown error
    // The assignment to resultsDiv.innerHTML occurs after evaluating predictions.join(...),
    // so it should not have been executed.
    await expect(lp.results).toHaveText('');
  });

  // Edge case: non-numeric inputs (strings) -> predict will produce NaN internally, then join error still occurs
  test('Submit_Click with non-numeric inputs triggers same TypeError and leaves results empty', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const lp = new LogisticPage(page);
    await lp.goto();

    // Provide non-numeric inputs
    await lp.fillInput1('hello'); // will cause NaN in numeric operations
    await lp.fillInput2('world');
    // input3 will be updated by input2 or input1 depending on last input; irrelevant here
    await lp.fillInput2('world');

    await lp.clickSubmit();
    await page.waitForTimeout(50);

    // Expect an error to have occurred and be a TypeError related to join
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasJoinTypeError = pageErrors.some(e => {
      const name = e.name || '';
      const msg = (e.message || '').toLowerCase();
      return name === 'TypeError' || msg.includes('join') || msg.includes('is not a function');
    });
    expect(hasJoinTypeError).toBeTruthy();

    // Results should remain empty due to exception
    await expect(lp.results).toHaveText('');
  });

  // Verify that repeated input changes maintain the expected behavior (stability of S1 state)
  test('Multiple input changes keep S1_InputFilled consistent and propagate latest value to Input3', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const lp = new LogisticPage(page);
    await lp.goto();

    // Type several times into input1 and ensure input3 matches the latest content
    await lp.fillInput1('first');
    await expect(lp.input3).toHaveValue('first');

    await lp.fillInput1('second');
    await expect(lp.input3).toHaveValue('second');

    // Now type into input2 and ensure input3 reflects input2 (input2 listener overwrites)
    await lp.fillInput2('override');
    await expect(lp.input3).toHaveValue('override');

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });
});