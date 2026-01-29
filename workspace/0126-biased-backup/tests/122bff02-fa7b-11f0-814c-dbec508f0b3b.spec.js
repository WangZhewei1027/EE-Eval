import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bff02-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Floyd-Warshall page to encapsulate selectors and common actions
class FloydWarshallPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.resetBtn = page.locator('#reset-btn');
    this.solveBtn = page.locator('#solve-btn');
    this.viewBtn = page.locator('#view-btn');
    this.nInput = page.locator('#n-btn');
    this.dInput = page.locator('#d-btn');
    this.epsilonInput = page.locator('#epsilon-btn');
    this.fwTextarea = page.locator('#f-w-btn');
    this.wTextarea = page.locator('#w-btn');
    this.w2Textarea = page.locator('#w2-btn');
    this.w3Textarea = page.locator('#w3-btn');
    this.w4Textarea = page.locator('#w4-btn');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Utility to fill and trigger input event (Playwright fill already triggers input)
  async setN(value) {
    await this.nInput.fill(String(value));
  }
  async setD(value) {
    await this.dInput.fill(String(value));
  }
  async setEpsilon(value) {
    await this.epsilonInput.fill(String(value));
  }

  // Utility to dispatch change event on a textarea to invoke change handlers
  async setTextareaAndTriggerChange(selector, value) {
    await this.page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        el.value = value;
        // Dispatch a native change event
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      { selector, value }
    );
  }
}

test.describe('Floyd-Warshall Interactive App - FSM and UI tests', () => {
  // We'll collect console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Ensure a fresh navigation before each test
    await page.goto(APP_URL);
  });

  test('Initial load: UI elements present and baseline Idle state checks', async ({ page }) => {
    // Validate presence of all expected components - corresponds to S0_Idle initial
    const fw = new FloydWarshallPage(page);

    // Basic DOM assertions to ensure the page loaded correctly
    await expect(fw.resetBtn).toBeVisible();
    await expect(fw.solveBtn).toBeVisible();
    await expect(fw.viewBtn).toBeVisible();
    await expect(fw.nInput).toBeVisible();
    await expect(fw.dInput).toBeVisible();
    await expect(fw.epsilonInput).toBeVisible();
    await expect(fw.fwTextarea).toBeVisible();
    await expect(fw.wTextarea).toBeVisible();
    await expect(fw.w2Textarea).toBeVisible();
    await expect(fw.w3Textarea).toBeVisible();
    await expect(fw.w4Textarea).toBeVisible();

    // Verify placeholders and types (sanity for the UI)
    await expect(fw.nInput).toHaveAttribute('placeholder', 'Enter number of vertices');
    await expect(fw.dInput).toHaveAttribute('placeholder', 'Enter maximum distance');
    await expect(fw.epsilonInput).toHaveAttribute('placeholder', 'Enter epsilon value');
    await expect(fw.fwTextarea).toHaveAttribute('placeholder', 'Enter Floyd-Warshall matrix values');

    // No page errors should occur just by loading (baseline)
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    // Give a short moment for any synchronous errors to surface
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Input events (InputN, InputD, InputEpsilon) - error observation and edge cases', () => {
    test('InputN with valid number BEFORE initialization triggers runtime error (TypeError) as expected', async ({ page }) => {
      // This test asserts that typing into #n-btn causes the page to run update() and solve()
      // without prior initialize() resulting in a runtime TypeError (accessing undefined arrays)
      const fw = new FloydWarshallPage(page);
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      // Fill n input with a positive integer - this triggers the input handler that calls update() and solve()
      await fw.setN('3');

      // Allow short time for handler execution and error propagation
      await page.waitForTimeout(100);

      // We expect at least one page error due to update() trying to index uninitialized arrays
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Accept either TypeError style messages across browsers
      const messages = pageErrors.map(e => e.message || String(e));
      const hasTypeErrorLike = messages.some(m => /TypeError|Cannot read properties of undefined|Cannot set property|undefined/.test(m));
      expect(hasTypeErrorLike).toBeTruthy();

      // Confirm that the Floyd-Warshall textarea was not populated successfully (because solve likely did not complete)
      await expect(fw.fwTextarea).toHaveValue('');
    });

    test('InputD with number triggers same update/solve sequence and may produce runtime error', async ({ page }) => {
      const fw = new FloydWarshallPage(page);
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      await fw.setD('5');
      await page.waitForTimeout(100);

      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const messages = pageErrors.map(e => e.message || String(e));
      const hasRangeOrType = messages.some(m => /RangeError|TypeError|Invalid array length|Cannot read properties of undefined/.test(m));
      expect(hasRangeOrType).toBeTruthy();

      // f-w textarea remains unchanged as update/solve didn't complete successfully
      await expect(fw.fwTextarea).toHaveValue('');
    });

    test('InputEpsilon with non-numeric or blank produces RangeError (invalid array length) on update', async ({ page }) => {
      const fw = new FloydWarshallPage(page);
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      // Clearing the input to create parseInt('') => NaN, which leads to new Array(NaN) and a RangeError
      await fw.epsilonInput.fill('');
      // Playwright's fill triggers input event
      await page.waitForTimeout(100);

      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const messages = pageErrors.map(e => e.message || String(e));
      // Some browsers produce RangeError: Invalid array length; others may present different messages. Use flexible matching.
      const hasRangeErrorLike = messages.some(m => /RangeError|Invalid array length|Cannot read properties of undefined|TypeError/.test(m));
      expect(hasRangeErrorLike).toBeTruthy();
    });
  });

  test.describe('Reset, Solve, and View transitions (S0 -> S1 -> S2 / S3) - happy path after initialization', () => {
    test('Reset after setting n initializes arrays and Solve produces expected zero matrix representation', async ({ page }) => {
      // This test follows the FSM path: InputN -> Reset -> update/solve (should move into Updated then Solved)
      const fw = new FloydWarshallPage(page);
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      // Set n first so initialize can create arrays correctly
      await fw.setN('2');

      // Click reset - reset() calls initialize(), update(), solve()
      await fw.resetBtn.click();

      // Wait for any synchronous scripts to run
      await page.waitForTimeout(150);

      // There should be no runtime errors after proper initialization
      expect(pageErrors.length).toBe(0);

      // For n=2, solve() should create a 2x2 matrix of zeros and display: "0,0,0,0"
      await expect(fw.fwTextarea).toHaveValue('0,0,0,0');

      // Clicking solve again should be idempotent and keep the same result
      await fw.solveBtn.click();
      await page.waitForTimeout(50);
      await expect(fw.fwTextarea).toHaveValue('0,0,0,0');
    });

    test('View (from Updated state) produces a matrix of ones', async ({ page }) => {
      const fw = new FloydWarshallPage(page);
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      // Prepare correct state by setting n and performing initialize via reset
      await fw.setN('2');
      await fw.resetBtn.click();
      await page.waitForTimeout(100);

      expect(pageErrors.length).toBe(0); // no errors expected after proper initialization

      // Click view which should populate the f-w textarea with ones for n=2 => "1,1,1,1"
      await fw.viewBtn.click();
      await page.waitForTimeout(50);
      await expect(fw.fwTextarea).toHaveValue('1,1,1,1');
    });
  });

  test.describe('Matrix change events (ChangeMatrixF and ChangeWeightMatrix1..4)', () => {
    test('ChangeMatrixF: changing the f-w textarea triggers displayMatrix and reflects the provided value', async ({ page }) => {
      const fw = new FloydWarshallPage(page);

      // We use a representative string matrix; displayMatrix simply sets value = matrix.toString()
      const inputValue = '[[1,2],[3,4]]';
      await fw.setTextareaAndTriggerChange('#f-w-btn', inputValue);

      // Allow any DOM handlers to run
      await page.waitForTimeout(50);

      // The code reads the textarea's value and sets it back via toString, so expected to be identical string
      await expect(fw.fwTextarea).toHaveValue(inputValue);
    });

    test('ChangeWeightMatrix handlers (w, w2, w3, w4) each respond to change events', async ({ page }) => {
      const fw = new FloydWarshallPage(page);

      const sample = 'weight-matrix-sample';
      // For each weight textarea we simulate change and assert the value remains the string after the handler runs
      await fw.setTextareaAndTriggerChange('#w-btn', sample);
      await page.waitForTimeout(30);
      await expect(fw.wTextarea).toHaveValue(sample);

      await fw.setTextareaAndTriggerChange('#w2-btn', sample + '2');
      await page.waitForTimeout(30);
      await expect(fw.w2Textarea).toHaveValue(sample + '2');

      await fw.setTextareaAndTriggerChange('#w3-btn', sample + '3');
      await page.waitForTimeout(30);
      await expect(fw.w3Textarea).toHaveValue(sample + '3');

      await fw.setTextareaAndTriggerChange('#w4-btn', sample + '4');
      await page.waitForTimeout(30);
      await expect(fw.w4Textarea).toHaveValue(sample + '4');
    });
  });

  test.describe('Edge cases and error scenarios to verify robust error observation', () => {
    test('Calling Reset with no valid n (blank) results in initialize setting NaN and subsequent update/solve in reset may cause RangeError or TypeError (observed as page error)', async ({ page }) => {
      const fw = new FloydWarshallPage(page);
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      // Ensure n input is blank
      await fw.setN('');
      // Click reset which calls initialize(), update(), solve()
      await fw.resetBtn.click();

      // Give time for handlers to run and errors to surface
      await page.waitForTimeout(100);

      // Accept either RangeError (Invalid array length) or TypeError (indexing undefined), ensure at least one error happened
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const messages = pageErrors.map(e => e.message || String(e));
      const matches = messages.some(m => /RangeError|Invalid array length|TypeError|Cannot read properties of undefined/.test(m));
      expect(matches).toBeTruthy();
    });

    test('Multiple sequential inputs produce errors when initialization not performed, demonstrating invalid transition order', async ({ page }) => {
      const fw = new FloydWarshallPage(page);
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      // Simulate user changing n, then d, then epsilon without reset/initialize between them
      await fw.setN('4');
      await page.waitForTimeout(50);
      await fw.setD('10');
      await page.waitForTimeout(50);
      await fw.setEpsilon('2');
      await page.waitForTimeout(150);

      // We expect errors to have occurred (first input likely caused TypeError/RangeError)
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      const messages = pageErrors.map(e => e.message || String(e));
      const errorDetected = messages.some(m => /TypeError|RangeError|Invalid array length|Cannot read properties of undefined/.test(m));
      expect(errorDetected).toBeTruthy();
    });
  });
});