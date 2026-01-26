import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bb0e3-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object Model for the Binary Search page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#start-button');
    this.resetButton = page.locator('#reset-button');
    this.rangeSlider = page.locator('#range-slider');
    this.stepSlider = page.locator('#step-slider');
    this.rangeStepSlider = page.locator('#range-step-slider');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async setRange(value) {
    // value should be number or string
    await this.rangeSlider.evaluate((el, v) => el.value = v, String(value));
    // dispatch input/change events so listeners (if any) are triggered
    await this.rangeSlider.dispatchEvent('input');
    await this.rangeSlider.dispatchEvent('change');
  }

  async setStep(value) {
    await this.stepSlider.evaluate((el, v) => el.value = v, String(value));
    await this.stepSlider.dispatchEvent('input');
    await this.stepSlider.dispatchEvent('change');
  }

  async setRangeStep(value) {
    await this.rangeStepSlider.evaluate((el, v) => el.value = v, String(value));
    await this.rangeStepSlider.dispatchEvent('input');
    await this.rangeStepSlider.dispatchEvent('change');
  }

  async getResultText() {
    // Use innerText to preserve newline-like content
    return (await this.result.innerText()).trim();
  }

  async isResultEmpty() {
    const text = await this.getResultText();
    return text === '';
  }

  async getSliderValue(locator) {
    return await locator.evaluate(el => el.value);
  }
}

test.describe('Binary Search FSM - Application 122bb0e3-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught errors on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown: ensure page is closed between tests if needed by the runner
    try {
      await page.close();
    } catch (e) {
      // ignore close errors
    }
  });

  test('Initial Idle state: page renders controls and default slider values', async ({ page }) => {
    // Validate initial render (FSM S0_Idle entry_actions: renderPage())
    const bs = new BinarySearchPage(page);

    // Buttons exist and are visible
    await expect(bs.startButton).toBeVisible();
    await expect(bs.resetButton).toBeVisible();

    // Sliders exist and have expected default values based on HTML
    await expect(bs.rangeSlider).toHaveAttribute('min', '1');
    await expect(bs.rangeSlider).toHaveAttribute('max', '100');
    await expect(bs.rangeSlider).toHaveValue('50');

    await expect(bs.stepSlider).toHaveAttribute('min', '1');
    await expect(bs.stepSlider).toHaveAttribute('max', '100');
    await expect(bs.stepSlider).toHaveValue('5');

    await expect(bs.rangeStepSlider).toHaveAttribute('min', '1');
    await expect(bs.rangeStepSlider).toHaveAttribute('max', '100');
    await expect(bs.rangeStepSlider).toHaveValue('10');

    // Result container should be empty in Idle state
    expect(await bs.isResultEmpty()).toBe(true);

    // Assert no uncaught page errors occurred during initial render
    expect(pageErrors.length).toBe(0);

    // Assert no console error-level messages were emitted during initial render
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('StartClick transitions to Searching: clicking Start populates result', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Searching via StartClick and checks start() behavior
    const bs = new BinarySearchPage(page);

    // Click Start to trigger start()
    await bs.clickStart();

    // The start() implementation is synchronous; wait for result to be non-empty
    await expect(bs.result).not.toHaveText('', { timeout: 2000 });

    const resultText = await bs.getResultText();

    // The implementation appends lines including "Step" and "End of range" or "Start of range"
    // Validate that we see at least one recognizable token
    const hasStep = resultText.includes('Step');
    const hasEnd = resultText.includes('End of range');
    const hasStart = resultText.includes('Start of range');

    expect(hasStep || hasEnd || hasStart).toBe(true);

    // Ensure result is displayed (expected_observables: "result displayed")
    expect(resultText.length).toBeGreaterThan(0);

    // Verify no uncaught errors during execution
    expect(pageErrors.length).toBe(0);

    // Check console didn't reveal ReferenceError/SyntaxError/TypeError
    const errorMsgs = consoleMessages
      .filter(m => m.type === 'error')
      .map(m => m.text)
      .join('\n');
    expect(errorMsgs).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
  });

  test('ResetClick transitions to Reset: clicking Reset clears the result', async ({ page }) => {
    // Validate transition S1_Searching -> S2_Reset and the reset() behavior
    const bs = new BinarySearchPage(page);

    // Produce a result first
    await bs.clickStart();
    await expect(bs.result).not.toHaveText('', { timeout: 2000 });
    expect(await bs.getResultText().then(Boolean)).toBe(true);

    // Click reset and expect result cleared (evidence: result = ''; document.getElementById('result').innerHTML = '';)
    await bs.clickReset();
    await expect(bs.result).toHaveText('', { timeout: 2000 });

    // Confirm S2_Reset left result empty
    expect(await bs.isResultEmpty()).toBe(true);

    // No uncaught errors on reset
    expect(pageErrors.length).toBe(0);

    const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorEntries.length).toBe(0);
  });

  test('Start after Reset returns to Searching: S2_Reset -> S0_Idle -> S1_Searching on Start', async ({ page }) => {
    // This test validates starting after a reset (transition S2_Reset -> S0_Idle -> S1_Searching)
    const bs = new BinarySearchPage(page);

    // Click Start, then Reset, then Start again
    await bs.clickStart();
    await expect(bs.result).not.toHaveText('', { timeout: 2000 });
    await bs.clickReset();
    await expect(bs.result).toHaveText('', { timeout: 2000 });

    // Start again
    await bs.clickStart();
    await expect(bs.result).not.toHaveText('', { timeout: 2000 });

    // Validate some content is present after second start
    const resultText = await bs.getResultText();
    expect(resultText.length).toBeGreaterThan(0);

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Confirm no console-level ReferenceError/SyntaxError/TypeError messages
    const badConsole = consoleMessages.filter(m =>
      m.type === 'error' && /(ReferenceError|SyntaxError|TypeError)/.test(m.text)
    );
    expect(badConsole.length).toBe(0);
  });

  test('Sliders adjustment affects result: startValue < endValue produces empty result', async ({ page }) => {
    // Edge scenario: when range-slider (startValue) is less than step-slider (endValue)
    // The FSM expects different behavior; we assert the concrete implementation behavior:
    // when startValue < endValue no loops should append results -> empty result
    const bs = new BinarySearchPage(page);

    // Set startValue to 10 and endValue to 20 so startValue < endValue
    await bs.setRange(10);
    await bs.setStep(20);
    await bs.setRangeStep(5); // arbitrary

    // Sanity-check the values are set
    expect(await bs.getSliderValue(bs.rangeSlider)).toBe('10');
    expect(await bs.getSliderValue(bs.stepSlider)).toBe('20');
    expect(await bs.getSliderValue(bs.rangeStepSlider)).toBe('5');

    // Click Start and expect result to be empty (no loops triggered)
    await bs.clickStart();

    // Allow a short time for synchronous execution and DOM updates
    await new Promise(r => setTimeout(r, 200));

    const resultText = await bs.getResultText();
    expect(resultText).toBe(''); // expected no output in this configuration

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Sliders extremes and large iterations do not cause uncaught errors or infinite loops', async ({ page }) => {
    // Stress test: set sliders to extremes to exercise loops and ensure termination
    // Use a conservative timeout via Playwright's assertion to detect potential hangs
    const bs = new BinarySearchPage(page);

    // Set start high, end low, and small rangeStep to produce many iterations
    await bs.setRange(100);     // startValue
    await bs.setStep(1);        // endValue
    await bs.setRangeStep(1);   // range step of 1 -> many iterations but should terminate

    // Click Start and wait for result to be non-empty (it should finish quickly)
    await bs.clickStart();

    // Wait for the result to be populated
    await expect(bs.result).not.toHaveText('', { timeout: 5000 });

    const resultText = await bs.getResultText();
    // result should contain step and range markers
    expect(resultText.length).toBeGreaterThan(0);
    expect(/Step|End of range|Start of range/.test(resultText)).toBe(true);

    // Ensure no uncaught page errors (important for robustness)
    expect(pageErrors.length).toBe(0);

    // Confirm no console-level runtime errors indicating broken JS execution
    const runtimeErrors = consoleMessages.filter(m => m.type === 'error');
    expect(runtimeErrors.length).toBe(0);
  });

  test('Click Reset before Start is safe and results in empty output', async ({ page }) => {
    // Edge case: user clicks Reset while still in Idle (S0_Idle)
    const bs = new BinarySearchPage(page);

    // Click reset immediately
    await bs.clickReset();

    // Expect result still empty and no errors
    expect(await bs.isResultEmpty()).toBe(true);
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: confirm event handler evidence presence (click triggers start/reset functions)', async ({ page }) => {
    // This test asserts the presence of expected event handlers by interaction behavior.
    // We cannot introspect attached listeners directly in cross-browser ways reliably,
    // so we validate by clicking and observing DOM changes (evidence in FSM).
    const bs = new BinarySearchPage(page);

    // Reset first to ensure clean state
    await bs.clickReset();
    expect(await bs.isResultEmpty()).toBe(true);

    // Click Start: if listener present, result should change
    await bs.clickStart();
    await expect(bs.result).not.toHaveText('', { timeout: 2000 });
    const afterStart = await bs.getResultText();
    expect(afterStart.length).toBeGreaterThan(0);

    // Click Reset: if listener present, result should clear
    await bs.clickReset();
    await expect(bs.result).toHaveText('', { timeout: 2000 });
    expect(await bs.isResultEmpty()).toBe(true);

    // Verify again no uncaught page errors were emitted
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page errors summary: assert no ReferenceError/SyntaxError/TypeError occurred throughout tests', async ({ page }) => {
    // This test verifies that the page did not produce common fatal JS errors when loaded and interacted with.
    // Note: In this test run we only check the collected console messages for the current page instance.
    const bs = new BinarySearchPage(page);

    // Interact to potentially surface errors
    await bs.clickStart();
    await bs.clickReset();

    // Give a short breather for any async pageerror handlers
    await new Promise(r => setTimeout(r, 200));

    // No page errors should be present
    expect(pageErrors.length).toBe(0);

    // Ensure no console error messages that include common JS exception names
    const errorConsoleTexts = consoleMessages
      .filter(m => m.type === 'error')
      .map(m => m.text)
      .join('\n');

    expect(errorConsoleTexts).not.toMatch(/ReferenceError/);
    expect(errorConsoleTexts).not.toMatch(/SyntaxError/);
    expect(errorConsoleTexts).not.toMatch(/TypeError/);
  });
});