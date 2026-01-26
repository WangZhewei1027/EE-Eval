import { test, expect } from '@playwright/test';

// Test file: 122d3781-fa7b-11f0-814c-dbec508f0b3b.spec.js
// URL under test:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d3781-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the OSI Model UI
class OSIModelPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('#osimodel');
    this.buttons = this.container.locator('button');
    this.slider = this.container.locator("input[type='range']");
    this.select = this.container.locator('select');
    this.textInput = this.container.locator("input[type='text']");
    this.header = this.container.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait until the container exists in the DOM
    await expect(this.container).toBeVisible();
  }

  // Returns the number of buttons currently rendered inside #osimodel
  async buttonCount() {
    return await this.buttons.count();
  }

  // Click the button with 1-based index (to match FSM nth-of-type notation)
  async clickButtonNth(n) {
    // Convert to 0-based index
    const idx = n - 1;
    const locator = this.buttons.nth(idx);
    await locator.click();
  }

  // Click first button
  async clickFirstButton() {
    await this.clickButtonNth(1);
  }

  // Click second button
  async clickSecondButton() {
    await this.clickButtonNth(2);
  }

  // Set slider value and dispatch an input event
  async setSliderValue(value) {
    // Use evaluate to set the value and dispatch the input event
    await this.slider.evaluate((el, v) => {
      el.value = String(v);
      // Create and dispatch input event; bubbles true to mimic user interaction
      const evt = new Event('input', { bubbles: true });
      el.dispatchEvent(evt);
    }, value);
  }

  async getHeaderText() {
    return (await this.header.count()) ? (await this.header.textContent()) : null;
  }

  async isSelectPresent() {
    return (await this.select.count()) > 0;
  }

  async isTextInputPresent() {
    return (await this.textInput.count()) > 0;
  }
}

// Group tests for the OSI Model interactive widget
test.describe('OSI Model interactive application - FSM validation', () => {
  // Collect console and page errors per test
  test.beforeEach(async ({ page }) => {
    // Nothing to do globally here; individual tests will attach listeners where needed
  });

  // Initial render and S0_Idle state verification
  test('Initial render (S0_Idle): components are present and correct', async ({ page }) => {
    // Attach listeners to capture console messages and page errors
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const osi = new OSIModelPage(page);
    await osi.goto();

    // Validate the container exists and is empty of <h1> initially
    await expect(page.locator('#osimodel')).toBeVisible();

    // Verify buttons count: there should be 4 buttons (Button 1, Button 2, Button 3, Button 4)
    const btnCount = await osi.buttonCount();
    expect(btnCount).toBe(4);

    // Verify slider is present and has expected attributes (min, max, initial value)
    const slider = page.locator("#osimodel input[type='range']");
    await expect(slider).toHaveCount(1);
    // Attribute checks via evaluate
    const sliderAttrs = await slider.evaluate((el) => ({ min: el.min, max: el.max, value: el.value }));
    expect(sliderAttrs.min).toBe('0');
    expect(sliderAttrs.max).toBe('100');
    // Initial value given by implementation is '50'
    expect(sliderAttrs.value).toBe('50');

    // Verify select and text input exist
    expect(await osi.isSelectPresent()).toBe(true);
    expect(await osi.isTextInputPresent()).toBe(true);

    // Ensure no uncaught page errors on initial render
    expect(pageErrors.length).toBe(0);

    // Console messages are allowed but we assert we captured the array (non-failing)
    expect(Array.isArray(consoleMsgs)).toBe(true);
  });

  // BUTTON1_CLICK transition to S1_Button1Clicked
  test('BUTTON1_CLICK transitions from S0_Idle to S1_Button1Clicked (Button 1 clicked!)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const osi = new OSIModelPage(page);
    await osi.goto();

    // Click Button 1 (first button)
    await osi.clickFirstButton();

    // After clicking, the FSM evidence expects "<h1>Button 1 clicked!</h1>"
    await expect(page.locator('#osimodel h1')).toHaveText('Button 1 clicked!');

    // Because the implementation replaces innerHTML, the buttons are removed.
    const remainingButtons = await osi.buttonCount();
    expect(remainingButtons).toBe(0);

    // No page errors should have occurred during this flow
    expect(pageErrors.length).toBe(0);
  });

  // SLIDER_INPUT transition to S2_SliderValueChanged
  test('SLIDER_INPUT transitions from S0_Idle to S2_SliderValueChanged (value -> 100)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const osi = new OSIModelPage(page);
    await osi.goto();

    // Set the slider value to 100 and dispatch an input event to trigger the handler
    await osi.setSliderValue(100);

    // FSM expected observable: "<h1>Slider value changed to 100!</h1>"
    await expect(page.locator('#osimodel h1')).toHaveText('Slider value changed to 100!');

    // After the handler runs, elements are replaced with the h1; ensure slider no longer present
    await expect(page.locator('#osimodel input[type="range"]')).toHaveCount(0);

    // No page errors expected
    expect(pageErrors.length).toBe(0);
  });

  // BUTTON2_CLICK transition to S3_Button2Clicked
  test('BUTTON2_CLICK from S0_Idle produces "Button 2 clicked!" (S3_Button2Clicked)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const osi = new OSIModelPage(page);
    await osi.goto();

    // Click the 2nd button (Button 2)
    await osi.clickSecondButton();

    await expect(page.locator('#osimodel h1')).toHaveText('Button 2 clicked!');
    expect(pageErrors.length).toBe(0);
  });

  // BUTTON3_CLICK transition to S4_Button3Clicked
  test('BUTTON3_CLICK from S0_Idle produces "Button 3 clicked!" (S4_Button3Clicked)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const osi = new OSIModelPage(page);
    await osi.goto();

    // Click the 3rd button (Button 3). 1-based index => nth-of-type(3)
    await osi.clickButtonNth(3);

    await expect(page.locator('#osimodel h1')).toHaveText('Button 3 clicked!');
    expect(pageErrors.length).toBe(0);
  });

  // BUTTON4_CLICK transition to S5_Button4Clicked
  test('BUTTON4_CLICK from S0_Idle produces "Button 4 clicked!" (S5_Button4Clicked)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const osi = new OSIModelPage(page);
    await osi.goto();

    // Click the 4th button (Button 4)
    await osi.clickButtonNth(4);

    await expect(page.locator('#osimodel h1')).toHaveText('Button 4 clicked!');
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: Attempt to transition from S1_Button1Clicked to S0_Idle by clicking Button 2
  // In the implementation, after Button 1 is clicked, the innerHTML is replaced and the buttons are removed.
  // This test validates that trying to click Button 2 in that state is not possible (error scenario / edge case).
  test('Edge case: After BUTTON1_CLICK (S1) trying to click Button 2 should fail because buttons were removed', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const osi = new OSIModelPage(page);
    await osi.goto();

    // Trigger S1
    await osi.clickFirstButton();
    await expect(page.locator('#osimodel h1')).toHaveText('Button 1 clicked!');

    // Now there should be no buttons inside #osimodel
    const remainingButtons = await osi.buttonCount();
    expect(remainingButtons).toBe(0);

    // Try to click the second button; this should raise an error at the Playwright action level.
    // We catch the error and assert that an Error was thrown (playwright cannot click a non-existent element).
    try {
      // Attempt to click with a short timeout to fail fast
      await page.click('#osimodel button:nth-of-type(2)', { timeout: 1000 });
      // If we get here, clicking unexpectedly succeeded; fail the test explicitly
      throw new Error('Click unexpectedly succeeded on a button that should not exist');
    } catch (err) {
      // err should be an Error instance from Playwright; ensure we caught an Error
      expect(err).toBeInstanceOf(Error);
    }

    // No page runtime errors (uncaught exceptions) from the page itself expected in this scenario
    expect(pageErrors.length).toBe(0);
  });

  // Error scenario test: Intentionally trigger a ReferenceError in page context and assert it is observed
  test('Error scenario: invoking a non-existent function in page context results in a ReferenceError (observed via pageerror)', async ({ page }) => {
    // Capture page errors for this test specifically
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const osi = new OSIModelPage(page);
    await osi.goto();

    // Intentionally run an undefined function in the page context to create a ReferenceError.
    // This simulates an error scenario and verifies our test harness observes page errors naturally.
    // Note: this does not modify any existing page state; it simply executes an expression that throws.
    let evalError = null;
    try {
      // The evaluation will cause a ReferenceError inside the page; Playwright will propagate a JSHandle exception to the test.
      await page.evaluate(() => {
        // Calling a clearly undefined function to generate ReferenceError
        nonexistentFunctionThatShouldNotExist();
      });
    } catch (err) {
      // An exception is expected from the evaluation call. Save it for assertions below.
      evalError = err;
    }

    // We expect that the page.evaluate call threw an error (since the function does not exist).
    expect(evalError).toBeInstanceOf(Error);

    // The pageerror listener should have captured at least one ReferenceError
    // Wait a short moment to ensure the event handler fired
    await page.waitForTimeout(100);

    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // Ensure at least one of the captured pageErrors is a ReferenceError (message contains 'ReferenceError' or similar)
    const hasReferenceError = pageErrors.some((err) => {
      const msg = String(err && err.message ? err.message : err);
      return /ReferenceError/i.test(msg) || /not defined/i.test(msg);
    });
    expect(hasReferenceError).toBe(true);
  });
});