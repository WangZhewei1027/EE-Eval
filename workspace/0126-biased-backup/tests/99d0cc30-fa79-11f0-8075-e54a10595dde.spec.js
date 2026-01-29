import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0cc30-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputField');
    this.submitButton = page.locator('button', { hasText: 'Submit' });
    this.submitResult = page.locator('#submitResult');
    this.slider = page.locator('#slider');
    this.sliderValue = page.locator('#sliderValue');
    this.resetButton = page.locator('button', { hasText: 'Reset All' });
    this.testResults = page.locator('#testResults');
    this.testResultItems = page.locator('#testResults li');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for core UI elements to be present
    await Promise.all([
      this.heading.waitFor({ state: 'visible' }),
      this.input.waitFor({ state: 'visible' }),
      this.slider.waitFor({ state: 'visible' }),
      this.testResults.waitFor({ state: 'visible' }),
    ]);
  }

  async setInput(value) {
    await this.input.fill(value);
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async setSliderAndTrigger(value) {
    // For range inputs, set value and dispatch an input event so oninput fires
    await this.page.$eval('#slider', (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getSubmitResultText() {
    return (await this.submitResult.innerText()).trim();
  }

  async getSliderValueText() {
    return (await this.sliderValue.innerText()).trim();
  }

  async getInputValue() {
    return (await this.input.inputValue()).trim();
  }

  async getTestResultItemsText() {
    const count = await this.testResultItems.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.testResultItems.nth(i).innerText()).trim());
    }
    return texts;
  }

  async getTestResultsCount() {
    return await this.testResultItems.count();
  }
}

test.describe('Integration Testing Live Demo - FSM validations', () => {
  // Capture console messages and page errors to assert on them later
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events and page errors
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();
  });

  test('Initial state (S0_Idle) - page rendered with expected defaults', async ({ page }) => {
    const demo = new DemoPage(page);

    // Verify the heading is present (evidence of renderPage entry action)
    await expect(demo.heading).toHaveText('Integration Testing Live Demo');

    // Input should be empty
    expect(await demo.getInputValue()).toBe('', 'Input field should start empty');

    // Default slider value should be 50 (both input value and displayed span)
    const sliderValueText = await demo.getSliderValueText();
    expect(sliderValueText).toBe('50', 'Displayed slider value should initialize to 50');

    // submitResult should be empty initially
    const submitResult = await demo.getSubmitResultText();
    expect(submitResult).toBe('', 'No submit result should be displayed on initial load');

    // testResults should show the placeholder "No tests run yet."
    const results = await demo.getTestResultItemsText();
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]).toMatch(/No tests run yet\./);

    // Ensure there were no uncaught page errors or console 'error' messages during render
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('UpdateSlider transition (S2_SliderUpdated) updates displayed slider value and not test results', async ({ page }) => {
    const demo = new DemoPage(page);

    // Change the slider to 75 and ensure the displayed value updates
    await demo.setSliderAndTrigger(75);
    await expect(demo.sliderValue).toHaveText('75');

    // testResults should still contain the placeholder only
    const results = await demo.getTestResultItemsText();
    expect(results.length).toBe(1);
    expect(results[0]).toMatch(/No tests run yet\./);

    // No page errors should have been emitted by the slider update
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('SubmitValue transition (S1_ValueSubmitted) with valid numeric input logs and displays result', async ({ page }) => {
    const demo = new DemoPage(page);

    // Set input to a numeric value and slider to a known value
    await demo.setInput('42');
    await demo.setSliderAndTrigger(80);

    // Submit the value
    await demo.clickSubmit();

    // Verify submit result text is shown per FSM evidence
    const expectedText = 'Submitted Value: 42, Slider Value: 80';
    await expect(demo.submitResult).toHaveText(expectedText);

    // Verify that testResults list has been updated with one item and correct text
    const resultItems = await demo.getTestResultItemsText();
    expect(resultItems.length).toBe(1);
    expect(resultItems[0]).toBe(`Test 1: ${expectedText}`);

    // Input value should remain (function doesn't clear it)
    expect(await demo.getInputValue()).toBe('42');

    // No page errors should have been emitted by submitting
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('SubmitValue handles invalid inputs (edge cases): empty and non-numeric', async ({ page }) => {
    const demo = new DemoPage(page);

    // Ensure starting from a clean state: Reset All to be explicit
    await demo.clickReset();

    // 1) Empty input should display validation message and not append to testResults
    await demo.setInput('');
    await demo.clickSubmit();
    await expect(demo.submitResult).toHaveText('Please enter a valid number.');

    let results = await demo.getTestResultItemsText();
    // Should still be only the placeholder
    expect(results.length).toBe(1);
    expect(results[0]).toMatch(/No tests run yet\./);

    // 2) Non-numeric input like 'abc' should also show validation and not log
    await demo.setInput('abc');
    await demo.clickSubmit();
    await expect(demo.submitResult).toHaveText('Please enter a valid number.');

    results = await demo.getTestResultItemsText();
    expect(results.length).toBe(1);
    expect(results[0]).toMatch(/No tests run yet\./);

    // No page errors should have been emitted by validation
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Multiple submissions append results in order and are reflected in testResults list', async ({ page }) => {
    const demo = new DemoPage(page);

    // Reset first to ensure starting clean
    await demo.clickReset();

    // Submit first value
    await demo.setInput('10');
    await demo.setSliderAndTrigger(10);
    await demo.clickSubmit();

    // Submit second value
    await demo.setInput('20');
    await demo.setSliderAndTrigger(20);
    await demo.clickSubmit();

    // Submit third value
    await demo.setInput('30');
    await demo.setSliderAndTrigger(30);
    await demo.clickSubmit();

    const resultItems = await demo.getTestResultItemsText();
    expect(resultItems.length).toBe(3);
    expect(resultItems[0]).toBe('Test 1: Submitted Value: 10, Slider Value: 10');
    expect(resultItems[1]).toBe('Test 2: Submitted Value: 20, Slider Value: 20');
    expect(resultItems[2]).toBe('Test 3: Submitted Value: 30, Slider Value: 30');

    // No page errors occurred while adding multiple test results
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('ResetAll transition (S3_AllReset) returns UI and results to initial state', async ({ page }) => {
    const demo = new DemoPage(page);

    // Prepare state: submit a result so there's something to reset
    await demo.setInput('5');
    await demo.setSliderAndTrigger(55);
    await demo.clickSubmit();

    // Verify there is at least one result before reset
    let resultsBefore = await demo.getTestResultItemsText();
    expect(resultsBefore.length).toBeGreaterThanOrEqual(1);

    // Click reset
    await demo.clickReset();

    // Input cleared
    expect(await demo.getInputValue()).toBe('', 'Input field should be cleared after reset');

    // submitResult cleared
    expect(await demo.getSubmitResultText()).toBe('', 'Submit result area should be cleared after reset');

    // slider value reset to 50 and displayed value updated
    await expect(demo.slider).toHaveValue('50');
    await expect(demo.sliderValue).toHaveText('50');

    // testResults should show the placeholder again
    const resultsAfter = await demo.getTestResultItemsText();
    expect(resultsAfter.length).toBe(1);
    expect(resultsAfter[0]).toMatch(/No tests run yet\./);

    // No page errors should have been emitted during reset
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Observability: capture console and page errors while interacting (should be none)', async ({ page }) => {
    const demo = new DemoPage(page);

    // Interact with page: slider, submit valid and invalid, reset
    await demo.setSliderAndTrigger(33);
    await demo.setInput('7');
    await demo.clickSubmit();
    await demo.setInput('not-a-number');
    await demo.clickSubmit();
    await demo.clickReset();

    // Examine captured console messages and page errors
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');

    // Assert that no unhandled page errors or console-level errors occurred during normal use.
    // This validates that the provided implementation did not throw ReferenceError/SyntaxError/TypeError unexpectedly.
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);

    // Also assert that some informational console messages (if any) can be inspected; benign if zero
    // We don't require console output, only ensure no errors were observed.
  });
});