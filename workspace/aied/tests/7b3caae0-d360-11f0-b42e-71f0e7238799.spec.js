import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3caae0-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Sliding Window App
class SlidingWindowApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async startButton() {
    return this.page.locator('#startBtn');
  }

  async windowSizeInput() {
    return this.page.locator('#windowSize');
  }

  async arrayValuesSpan() {
    return this.page.locator('#arrayValues');
  }

  async arrayBars() {
    return this.page.locator('#arrayContainer .bar');
  }

  // Click the Start button (triggers generation and visualization)
  async clickStart() {
    await this.page.click('#startBtn');
  }

  // Set the window size value in the input
  async setWindowSize(value) {
    const input = await this.windowSizeInput();
    await input.fill(String(value));
    // ensure the value is set
    await expect(input).toHaveValue(String(value));
  }

  // Read the textual array values ("1, 2, 3, ...") and return as numbers array
  async getArrayValuesAsNumbers() {
    const text = (await this.arrayValuesSpan().innerText()).trim();
    if (!text) return [];
    return text.split(',').map(s => Number(s.trim()));
  }

  // Read bars' text contents as numbers
  async getBarValues() {
    const count = await this.arrayBars().count();
    const vals = [];
    for (let i = 0; i < count; i++) {
      const el = this.arrayBars().nth(i);
      const txt = await el.innerText();
      vals.push(Number(txt.trim()));
    }
    return vals;
  }

  // Read computed background color (rgb(...)) for a given bar index
  async getBarBackgroundColor(index) {
    const el = this.arrayBars().nth(index);
    // Read the inline style backgroundColor (if set) or computed style
    return await this.page.evaluate((e) => {
      return window.getComputedStyle(e).backgroundColor;
    }, await el.elementHandle());
  }

  // Wait for alert (dialog) to appear and capture its message; accepts the dialog
  async captureAlertMessage() {
    return new Promise((resolve) => {
      const onDialog = async (dialog) => {
        try {
          const msg = dialog.message();
          await dialog.accept();
          this.page.off('dialog', onDialog);
          resolve(msg);
        } catch (err) {
          // still resolve with error message if accept fails
          this.page.off('dialog', onDialog);
          resolve(`__DIALOG_ACCEPT_ERROR__: ${err?.message ?? String(err)}`);
        }
      };
      this.page.on('dialog', onDialog);
      // Note: caller should trigger the action that causes the dialog after attaching this handler
    });
  }
}

test.describe('Sliding Window Visualization - FSM validation', () => {
  let app;
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // reset collected errors/messages
    pageErrors = [];
    consoleMessages = [];

    // listen for uncaught errors from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    app = new SlidingWindowApp(page);
    await app.goto();
  });

  test.afterEach(async ({ page }) => {
    // detach listeners (playwright test runner ensures page closed per test).
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('S0_Idle: Initial page renders Start button and window size input', async ({ page }) => {
    // Validate initial state S0_Idle: Start button present, input has expected attributes
    const startBtn = await app.startButton();
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toHaveText('Start');

    const input = await app.windowSizeInput();
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('3'); // default as per HTML

    // Check input attributes min and max exist (reflect FSM component evidence)
    const min = await page.getAttribute('#windowSize', 'min');
    const max = await page.getAttribute('#windowSize', 'max');
    expect(min).toBe('1');
    expect(max).toBe('10');
  });

  test('Transition S0 -> S1: Clicking Start generates array and renders bars', async ({ page }) => {
    // Attach a short-circuit dialog handler to prevent blocking (but we will capture it separately)
    const alertPromise = app.captureAlertMessage();

    // Click the start button once to trigger array generation & visualization
    await app.clickStart();

    // After click, arrayValues should be populated
    const arrText = await app.arrayValuesSpan().innerText();
    expect(arrText.trim().length).toBeGreaterThan(0);
    const numbers = await app.getArrayValuesAsNumbers();
    expect(numbers.length).toBe(10); // generateArray(10) expected

    // Bars should be rendered: one .bar per array element
    const barCount = await app.arrayBars().count();
    expect(barCount).toBe(10);

    // Each bar's displayed text should match the array values
    const barValues = await app.getBarValues();
    expect(barValues).toEqual(numbers);

    // Wait for alert and accept it to allow visualization completion
    const dialogMessage = await alertPromise;
    // Alert message should mention the chosen window size (default 3) and the max sum
    expect(dialogMessage).toContain('Maximum sum of any window of size 3 is');

    // Verify that console had no fatal logs (information only)
    const severeConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Not asserting zero here strictly; just capturing; but fail if severe errors were captured
    expect(severeConsole.length).toBe(0);

    // Also ensure no uncaught page errors occurred during this valid scenario
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1 -> S2 -> S3: Visualization highlights windows and alert shows correct max sum', async ({ page }) => {
    // Explicitly set window size to 3 to exercise visualization loops deterministically
    await app.setWindowSize(3);

    // Prepare to capture the alert triggered at the end of visualization
    const alertPromise = app.captureAlertMessage();

    // Start the process
    await app.clickStart();

    // The array text should be present
    const numbers = await app.getArrayValuesAsNumbers();
    expect(numbers.length).toBe(10);

    // Compute expected max sum for window size 3 locally
    const w = 3;
    let expectedMax = Number.NEGATIVE_INFINITY;
    for (let i = 0; i + w <= numbers.length; i++) {
      const sum = numbers.slice(i, i + w).reduce((a, b) => a + b, 0);
      if (sum > expectedMax) expectedMax = sum;
    }

    // Wait for alert and assert its message content
    const alertMsg = await alertPromise;
    expect(alertMsg).toBe(`Maximum sum of any window of size ${w} is ${expectedMax}`);

    // After visualization completes (alert accepted), verify final DOM coloring:
    // The implementation highlights the last window (final windowEnd = n-1),
    // so indices (n-w) .. (n-1) should be highlighted in red (#e74c3c -> rgb(231, 76, 60))
    const n = numbers.length;
    const startIndex = n - w;
    for (let i = 0; i < n; i++) {
      const color = await app.getBarBackgroundColor(i);
      if (i >= startIndex && i <= n - 1) {
        // highlighted in red
        expect(color).toMatch(/231,\s*76,\s*60/);
      } else {
        // other bars should be default blue (#3498db -> rgb(52,152,219))
        expect(color).toMatch(/52,\s*152,\s*219/);
      }
    }

    // No uncaught page errors expected in this normal flow
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: window size of 1 should compute max element and alert accordingly', async ({ page }) => {
    // Set window size to 1 (edge case; sliding window reduces to max element)
    await app.setWindowSize(1);

    const alertPromise = app.captureAlertMessage();
    await app.clickStart();

    const numbers = await app.getArrayValuesAsNumbers();
    expect(numbers.length).toBe(10);

    // Expected max is the max element
    const expectedMax = Math.max(...numbers);

    const alertMsg = await alertPromise;
    expect(alertMsg).toBe(`Maximum sum of any window of size 1 is ${expectedMax}`);

    // Final highlighted bar should be the last element (implementation highlights last)
    const lastColor = await app.getBarBackgroundColor(numbers.length - 1);
    expect(lastColor).toMatch(/231,\s*76,\s*60/);

    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: window size greater than array length should produce a runtime error (unpatched)', async ({ page }) => {
    // This test intentionally sets a window size larger than array length (10) to allow
    // the page's native code to throw naturally (we must not patch or fix it).
    await app.setWindowSize(15);

    // Prepare to capture page errors
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Click start which will run generateArray, renderArray, then visualizeSlidingWindow
    await app.clickStart();

    // We expect a pageerror to be emitted due to attempts to access undefined bar elements
    const err = await pageErrorPromise;
    // Assert that an error object was emitted and contains an explanatory message
    expect(err).toBeInstanceOf(Error);
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);

    // It is acceptable for no dialog to have been created (visualization likely crashed before alert)
    // Confirm that no alert dialog occurred by waiting briefly for any dialog event (negative check)
    // We attach a one-time listener that will fail the test if a dialog unexpectedly appears
    let dialogAppeared = false;
    const onDialog = () => { dialogAppeared = true; };
    page.on('dialog', onDialog);
    // give a short grace period
    await new Promise(r => setTimeout(r, 200));
    page.off('dialog', onDialog);

    expect(dialogAppeared).toBe(false);

    // Ensure we captured at least one page error recorded in pageErrors array as well
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Robustness: repeated Start clicks should produce deterministic behavior (multiple runs)', async ({ page }) => {
    // Run start multiple times and ensure each run produces its own alert and consistent array rendering
    for (let run = 0; run < 3; run++) {
      // Use window size 4 for these runs
      await app.setWindowSize(4);
      const alertPromise = app.captureAlertMessage();
      await app.clickStart();

      const numbers = await app.getArrayValuesAsNumbers();
      expect(numbers.length).toBe(10);

      // Compute expected max for window size 4
      const w = 4;
      let expectedMax = Number.NEGATIVE_INFINITY;
      for (let i = 0; i + w <= numbers.length; i++) {
        const sum = numbers.slice(i, i + w).reduce((a, b) => a + b, 0);
        if (sum > expectedMax) expectedMax = sum;
      }

      const alertMsg = await alertPromise;
      expect(alertMsg).toBe(`Maximum sum of any window of size ${w} is ${expectedMax}`);

      // After alert accepted, verify bars count still equals array length
      const barCount = await app.arrayBars().count();
      expect(barCount).toBe(10);

      // Confirm no uncaught page errors across runs
      expect(pageErrors.length).toBe(0);
    }
  });
});