import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c4d20-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object model to encapsulate interactions with the app
class DivideAndConquerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button1 = page.locator('#button1');
    this.button2 = page.locator('#button2');
    this.button3 = page.locator('#button3');
    this.slider1 = page.locator('#slider1');
    this.slider2 = page.locator('#slider2');
    this.slider3 = page.locator('#slider3');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickButton1() {
    await this.button1.click();
  }
  async clickButton2() {
    await this.button2.click();
  }
  async clickButton3() {
    await this.button3.click();
  }

  // Set slider value programmatically and dispatch 'input' event to trigger handlers
  async setSliderValue(sliderLocator, value) {
    // Ensure value is a string (input.value expects string)
    await sliderLocator.evaluate((el, v) => {
      el.value = String(v);
      // Dispatch input event so handlers run
      const evt = new Event('input', { bubbles: true });
      el.dispatchEvent(evt);
    }, String(value));
  }

  async setSlider1(value) {
    await this.setSliderValue(this.slider1, value);
  }
  async setSlider2(value) {
    await this.setSliderValue(this.slider2, value);
  }
  async setSlider3(value) {
    await this.setSliderValue(this.slider3, value);
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }

  async getState() {
    // Access global 'state' variable defined in the page
    return await this.page.evaluate(() => {
      // If state is not defined for any reason, return null to let test assert
      // (We MUST not inject/define state; just observe)
      return typeof state === 'undefined' ? null : state;
    });
  }

  async getSliderValue(sliderLocator) {
    return await sliderLocator.evaluate(el => el.value);
  }

  async runWorkflow() {
    // workflow is defined as a global variable in the page. Call it if present.
    return await this.page.evaluate(() => {
      if (typeof workflow === 'function') {
        workflow();
        return true;
      }
      return false;
    });
  }
}

// Group tests related to the FSM and UI
test.describe('Divide and Conquer - FSM and UI integration (Application ID: 122c4d20-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Arrays to capture console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  // Setup a fresh context before each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console "error" messages emitted by the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture unhandled exceptions in the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Teardown: basic sanity checks for captured errors after each test
  test.afterEach(async () => {
    // Ensure we reset arrays (they will be per-test)
    // No global teardown actions required beyond assertions inside tests
  });

  test('Initial State (S0_Idle) should be loaded with expected DOM and no runtime errors', async ({ page }) => {
    // This test validates the initial state entry and initial workflow invocation
    const p = new DivideAndConquerPage(page);
    await p.goto();

    // Validate no console errors or page errors during load
    expect(consoleErrors, 'No console.error messages should be emitted during page load').toHaveLength(0);
    expect(pageErrors, 'No page errors (unhandled exceptions) should occur during page load').toHaveLength(0);

    // The initial global state variable should exist and equal 0 per implementation
    const state = await p.getState();
    expect(state).toBe(0);

    // Verify initial result text produced by workflow(); given all sliders default to 50,
    // the workflow() sets "Not all sliders are within the range"
    const resultText = await p.getResultText();
    expect(resultText).toBe('Not all sliders are within the range');

    // Verify sliders exist and their initial values are 50 (as in HTML)
    const s1 = await p.getSliderValue(p.slider1);
    const s2 = await p.getSliderValue(p.slider2);
    const s3 = await p.getSliderValue(p.slider3);
    expect(s1).toBe('50');
    expect(s2).toBe('50');
    expect(s3).toBe('50');
  });

  test.describe('Button click transitions from Idle (S0_Idle) to S1/S2/S3 and state/results checks', () => {
    test('Clicking Button 1 transitions to S1_Button1Clicked and updates result', async ({ page }) => {
      // Validate transition: S0 -> S1 on Button1_Click
      const p = new DivideAndConquerPage(page);
      await p.goto();

      // Click Button 1
      await p.clickButton1();

      // After click, state must be 1 (per implementation)
      const state = await p.getState();
      expect(state).toBe(1);

      // Result DOM must reflect the event
      const resultText = await p.getResultText();
      expect(resultText).toBe('Button 1 clicked');

      // No runtime errors or console errors during interaction
      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('Clicking Button 2 transitions to S2_Button2Clicked and updates result', async ({ page }) => {
      const p = new DivideAndConquerPage(page);
      await p.goto();

      await p.clickButton2();
      const state = await p.getState();
      expect(state).toBe(2);

      const resultText = await p.getResultText();
      expect(resultText).toBe('Button 2 clicked');

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('Clicking Button 3 transitions to S3_Button3Clicked and updates result', async ({ page }) => {
      const p = new DivideAndConquerPage(page);
      await p.goto();

      await p.clickButton3();
      const state = await p.getState();
      expect(state).toBe(3);

      const resultText = await p.getResultText();
      expect(resultText).toBe('Button 3 clicked');

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Slider input transitions within respective clicked states (S1, S2, S3)', () => {
    test('While in S1 (after Button1), Slider1 input updates state and result accordingly', async ({ page }) => {
      // Verify S1 -> S1 on Slider1_Input expected behavior
      const p = new DivideAndConquerPage(page);
      await p.goto();

      // Ensure we're in S1
      await p.clickButton1();
      expect(await p.getState()).toBe(1);
      expect(await p.getResultText()).toBe('Button 1 clicked');

      // Change slider1 to 30
      await p.setSlider1(30);

      // State should remain 1
      expect(await p.getState()).toBe(1);

      // Result should reflect the slider's value
      expect(await p.getResultText()).toBe('Slider 1 value: 30');

      // Also test another value (e.g., 80) to ensure handler uses the new value
      await p.setSlider1(80);
      expect(await p.getResultText()).toBe('Slider 1 value: 80');

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('While in S2 (after Button2), Slider2 input updates state and result accordingly', async ({ page }) => {
      const p = new DivideAndConquerPage(page);
      await p.goto();

      await p.clickButton2();
      expect(await p.getState()).toBe(2);
      expect(await p.getResultText()).toBe('Button 2 clicked');

      await p.setSlider2(10);
      expect(await p.getState()).toBe(2);
      expect(await p.getResultText()).toBe('Slider 2 value: 10');

      await p.setSlider2(99);
      expect(await p.getResultText()).toBe('Slider 2 value: 99');

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('While in S3 (after Button3), Slider3 input updates state and result accordingly', async ({ page }) => {
      const p = new DivideAndConquerPage(page);
      await p.goto();

      await p.clickButton3();
      expect(await p.getState()).toBe(3);
      expect(await p.getResultText()).toBe('Button 3 clicked');

      await p.setSlider3(5);
      expect(await p.getState()).toBe(3);
      expect(await p.getResultText()).toBe('Slider 3 value: 5');

      await p.setSlider3(75);
      expect(await p.getResultText()).toBe('Slider 3 value: 75');

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Workflow edge cases and combined interactions', () => {
    test('Setting all sliders below 50 then invoking workflow() produces "All sliders are within the range"', async ({ page }) => {
      // This test covers the branch inside workflow() that sets result to "All sliders are within the range"
      const p = new DivideAndConquerPage(page);
      await p.goto();

      // Set all sliders to 10 (below 50)
      await p.setSlider1(10);
      await p.setSlider2(10);
      await p.setSlider3(10);

      // Call workflow() explicitly (it was defined in page scope)
      const called = await p.runWorkflow();
      expect(called, 'workflow() must be defined on the page and callable').toBe(true);

      // After running workflow, the result should reflect the "all sliders" message
      expect(await p.getResultText()).toBe('All sliders are within the range');

      // Ensure that state variable remains consistent with last explicit assignment:
      // The slider input handlers set state to 1/2/3 respectively; because we set all three,
      // the last one executed determines the state. We can't rely on order across async operations,
      // but ensure state is either 1,2 or 3 (not null/undefined).
      const state = await p.getState();
      expect([1, 2, 3]).toContain(state);

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('Edge case: rapid repeated clicks and slider movements should not produce runtime errors', async ({ page }) => {
      // This test stresses the event handlers by performing rapid interactions and asserting stability
      const p = new DivideAndConquerPage(page);
      await p.goto();

      // Rapid interactions
      for (let i = 0; i < 5; i++) {
        await p.clickButton1();
        await p.setSlider1(20 + i);
        await p.clickButton2();
        await p.setSlider2(30 + i);
        await p.clickButton3();
        await p.setSlider3(40 + i);
      }

      // After the burst of events, ensure there are no console errors or page errors
      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);

      // Validate DOM still responding: pick one check
      const res = await p.getResultText();
      // Final result should reflect the last slider3 input (since last operation set slider3)
      expect(res).toMatch(/^Slider 3 value:/);
    });

    test('Sanity check: attempting to get non-existent global variables should not be injected or modified by tests', async ({ page }) => {
      // We do not create or inject globals; just assert the page's own globals behave as expected
      const p = new DivideAndConquerPage(page);
      await p.goto();

      // Ensure 'state' exists, but some other random global likely doesn't
      const hasState = await p.page.evaluate(() => typeof state !== 'undefined');
      const hasSomeRandom = await p.page.evaluate(() => typeof __SOME_RANDOM_TEST_GLOBAL__ !== 'undefined');

      expect(hasState).toBe(true);
      expect(hasSomeRandom).toBe(false);

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Accessibility and DOM contract checks', () => {
    test('Buttons and sliders exist with expected attributes and labels', async ({ page }) => {
      const p = new DivideAndConquerPage(page);
      await p.goto();

      // Buttons text
      await expect(p.button1).toHaveText('Button 1');
      await expect(p.button2).toHaveText('Button 2');
      await expect(p.button3).toHaveText('Button 3');

      // Slider attributes: type range, min 0, max 100, value 50
      const s1Type = await p.slider1.evaluate(el => el.getAttribute('type'));
      const s1Min = await p.slider1.evaluate(el => el.getAttribute('min'));
      const s1Max = await p.slider1.evaluate(el => el.getAttribute('max'));
      const s1Value = await p.slider1.evaluate(el => el.getAttribute('value'));

      expect(s1Type).toBe('range');
      expect(s1Min).toBe('0');
      expect(s1Max).toBe('100');
      expect(s1Value).toBe('50');

      // Similar quick asserts for slider2 and slider3
      const s2Value = await p.slider2.evaluate(el => el.getAttribute('value'));
      const s3Value = await p.slider3.evaluate(el => el.getAttribute('value'));
      expect(s2Value).toBe('50');
      expect(s3Value).toBe('50');

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });
});