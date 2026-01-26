import { test, expect } from '@playwright/test';

// Test file for Application ID: 122c7432-fa7b-11f0-814c-dbec508f0b3b
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/122c7432-fa7b-11f0-814c-dbec508f0b3b.html
// This test suite validates the FSM states (S0_Idle and S1_Calculated), events (ButtonClick and SliderInput),
// visual feedback, DOM updates, and captures console/page errors. It follows modern ES module syntax
// and uses a small page object to encapsulate interactions.

// Page Object for the Big-Theta page
class BigThetaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url =
      'http://127.0.0.1:5500/workspace/0126-biased/html/122c7432-fa7b-11f0-814c-dbec508f0b3b.html';
    this.h1 = page.locator('h1');
    this.description = page.locator('p').first();
    this.slider = page.locator('#slider');
    this.button = page.locator('#button');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'load' });
  }

  // Set slider value without dispatching input (useful to test button-triggered calculation)
  async setSliderValueDirect(value) {
    await this.page.$eval('#slider', (el, v) => {
      el.value = String(v);
    }, value);
  }

  // Set slider and dispatch an input event (useful to test slider input behavior)
  async setSliderValueWithInput(value) {
    await this.page.$eval('#slider', (el, v) => {
      el.value = String(v);
      // Dispatch input event as the app listens to 'input' to trigger calculation
      const event = new Event('input', { bubbles: true });
      el.dispatchEvent(event);
    }, value);
  }

  async clickCalculate() {
    await this.button.click();
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }

  async getSliderValue() {
    return await this.slider.evaluate((el) => el.value);
  }
}

test.describe('Big-Theta Notation - FSM and UI tests', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // If anything unexpected happens while reading console msg, record it
        consoleErrors.push(`Error reading console message: ${String(e)}`);
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(err?.message ?? String(err));
      } catch (e) {
        pageErrors.push(`Error reading pageerror: ${String(e)}`);
      }
    });
  });

  test.afterEach(async () => {
    // Intentionally do not modify the runtime environment.
    // Tests below will assert on consoleErrors/pageErrors where appropriate.
  });

  test('Initial state S0_Idle renders correctly (entry action: renderPage())', async ({ page }) => {
    // This test validates the initial UI rendering expected by the S0_Idle state.
    const app = new BigThetaPage(page);
    await app.goto();

    // Verify the primary header is present
    await expect(app.h1).toHaveText('Big-Theta Notation');

    // Verify descriptive paragraph exists and contains expected text
    await expect(app.description).toContainText(
      'This is a demonstration of Big-Theta Notation'
    );

    // Slider should be present with default value '5' as per HTML attributes
    await expect(app.slider).toBeVisible();
    const sliderValue = await app.getSliderValue();
    expect(sliderValue).toBe('5');

    // Button should be present
    await expect(app.button).toBeVisible();
    await expect(app.button).toHaveText('Calculate Big-Theta');

    // Result paragraph should exist but be empty initially (S0_Idle evidence)
    const initialResult = await app.getResultText();
    expect(initialResult.trim()).toBe('');

    // Capture that there were no uncaught runtime errors upon initial render
    // We assert that there are zero page errors and zero console 'error' messages.
    // This ensures renderPage() executed without causing runtime exceptions.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Calculated via ButtonClick updates result text correctly', async ({ page }) => {
    // This test validates the ButtonClick event, which should compute and set the result text.
    const app = new BigThetaPage(page);
    await app.goto();

    // Set slider to a value without triggering 'input' (we want calculation to come from button click)
    const testValue = 6;
    await app.setSliderValueDirect(testValue);

    // Ensure slider value updated in DOM
    const sliderValue = await app.getSliderValue();
    expect(sliderValue).toBe(String(testValue));

    // Click the calculate button (ButtonClick event)
    await app.clickCalculate();

    // The page's calculateBigTheta sets:
    // const timeComplexity = value;
    // const spaceComplexity = 1 / value;
    // resultElement.innerText = `Big-Theta Notation: Time Complexity: ${timeComplexity}O, Space Complexity: ${spaceComplexity}O`;
    const expectedTime = testValue;
    const expectedSpace = 1 / testValue;
    const expectedString = `Big-Theta Notation: Time Complexity: ${expectedTime}O, Space Complexity: ${expectedSpace}O`;

    // Verify result text exactly matches expected string
    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe(expectedString);

    // No uncaught errors should have occurred during this transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Calculated via SliderInput updates result text correctly', async ({ page }) => {
    // This test validates the SliderInput event (input event) triggers calculation immediately.
    const app = new BigThetaPage(page);
    await app.goto();

    // Choose a non-default slider value
    const testValue = 3;
    await app.setSliderValueWithInput(testValue); // sets value and dispatches input event

    // Expected calculation
    const expectedTime = testValue;
    const expectedSpace = 1 / testValue;
    const expectedString = `Big-Theta Notation: Time Complexity: ${expectedTime}O, Space Complexity: ${expectedSpace}O`;

    // Verify the result updated as a consequence of slider input
    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe(expectedString);

    // Again, ensure no uncaught errors occurred as a side effect of input handling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: slider min and max produce expected results', async ({ page }) => {
    // This test examines edge inputs (min and max) and verifies numerical results are computed/displayed.
    const app = new BigThetaPage(page);
    await app.goto();

    // Test minimum value (1)
    const minVal = 1;
    await app.setSliderValueWithInput(minVal);
    let resultText = (await app.getResultText()).trim();
    let expected = `Big-Theta Notation: Time Complexity: ${minVal}O, Space Complexity: ${1 / minVal}O`;
    expect(resultText).toBe(expected);

    // Test maximum value (10)
    const maxVal = 10;
    await app.setSliderValueWithInput(maxVal);
    resultText = (await app.getResultText()).trim();
    expected = `Big-Theta Notation: Time Complexity: ${maxVal}O, Space Complexity: ${1 / maxVal}O`;
    expect(resultText).toBe(expected);

    // No uncaught errors for edge interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid slider changes cause the result to update to the latest value (robustness)', async ({ page }) => {
    // This test simulates a user quickly changing the slider multiple times.
    const app = new BigThetaPage(page);
    await app.goto();

    const sequence = [2, 7, 4, 9, 1, 10]; // last one should be reflected in result
    for (const val of sequence) {
      // For each value, set and dispatch input quickly
      await app.setSliderValueWithInput(val);
    }

    // The result should reflect the last value in the rapid sequence
    const last = sequence[sequence.length - 1];
    const expected = `Big-Theta Notation: Time Complexity: ${last}O, Space Complexity: ${1 / last}O`;
    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe(expected);

    // No uncaught errors during rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Captures console and page errors (assert none occurred during typical flows)', async ({ page }) => {
    // This test ensures we observed console messages and page errors arrays and asserts expected absence of runtime errors.
    // It demonstrates the "observe console logs and page errors" requirement.
    const app = new BigThetaPage(page);
    await app.goto();

    // Perform a typical interaction to exercise event handlers
    await app.setSliderValueWithInput(5);
    await app.clickCalculate();

    // The arrays should be defined; assert they are arrays and contain zero error messages in healthy runtime.
    expect(Array.isArray(consoleErrors)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // In this application implementation there are no intentional runtime exceptions, so assert zero errors.
    // If the implementation had ReferenceError/SyntaxError/TypeError, they would be captured in these arrays.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Behavior documentation check: validate evidence strings exist in DOM (sanity)', async ({ page }) => {
    // This test cross-checks the FSM evidence by checking for specific DOM fragments/text that were listed as evidence.
    const app = new BigThetaPage(page);
    await app.goto();

    // Evidence for S0_Idle included the header and description paragraphs. Validate they exist.
    await expect(app.h1).toHaveText('Big-Theta Notation');
    await expect(app.description).toContainText('Big-Theta Notation, a measure of the time or space complexity');

    // Evidence for S1_Calculated is the format of resultElement.innerText after calculation => exercise once and check format.
    const testValue = 8;
    await app.setSliderValueWithInput(testValue);
    const resultText = (await app.getResultText()).trim();
    expect(resultText.startsWith('Big-Theta Notation: Time Complexity:')).toBe(true);
    expect(resultText.includes('Space Complexity:')).toBe(true);

    // No runtime errors as part of this evidence verification
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});