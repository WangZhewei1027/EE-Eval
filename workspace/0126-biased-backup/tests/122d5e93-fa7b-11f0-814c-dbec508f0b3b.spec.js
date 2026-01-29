import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d5e93-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Load Balancing app
class LoadBalancingApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      // store full text for easier assertions
      try {
        this.consoleMessages.push(msg.text());
      } catch (e) {
        // ignore unexpected serialization issues
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  locator(selector) {
    return this.page.locator(selector);
  }

  // Actions mapped to UI elements / FSM events
  async clickLoadBalancing() {
    await this.page.click(".button[onclick='loadBalancing()']");
  }
  async clickReset() {
    await this.page.click(".button[onclick='reset()']");
  }
  async clickSave() {
    await this.page.click(".button[onclick='save()']");
  }
  async clickClear() {
    await this.page.click(".button[onclick='clear()']");
  }
  async clickExample1() {
    await this.page.click(".input-field[onclick='example1()']");
  }
  async clickExample2() {
    await this.page.click(".input-field[onclick='example2()']");
  }
  async clickExample3() {
    await this.page.click(".button[onclick='example3()']");
  }

  // Get current values of input1 and slider1
  async getInputValue() {
    return await this.page.locator('#input1').evaluate((el) => el.value);
  }
  async getSliderValue() {
    return await this.page.locator('#slider1').evaluate((el) => el.value);
  }

  // Helpers to inspect messages and errors
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }
  getPageErrors() {
    return this.pageErrors.slice();
  }

  // wait/poll for console message to appear (timeout ms)
  async waitForConsoleMessageIncludes(substring, timeout = 1000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.consoleMessages.some((m) => m.includes(substring))) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }
}

test.describe('Load Balancing App - FSM behavior and UI', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new LoadBalancingApp(page);
    await app.goto();
    // give the page a brief moment to execute inline scripts and populate listeners
    await page.waitForTimeout(50);
  });

  test.afterEach(async ({ page }) => {
    // nothing special to teardown beyond Playwright's fixtures
    // keep this here for clarity and potential future teardown steps
    await page.waitForTimeout(10);
  });

  test('Initial render: main controls and default values are present', async ({ page }) => {
    // Validate that the main UI elements (as described in the FSM) are present
    // and that the initial values match what the HTML declares (slider default 50, input empty).
    await expect(page.locator("button[class='button'][onclick='loadBalancing()']")).toHaveCount(1);
    await expect(page.locator(".button[onclick='reset()']")).toHaveCount(1);
    await expect(page.locator(".button[onclick='save()']")).toHaveCount(1);
    await expect(page.locator(".button[onclick='clear()']")).toHaveCount(1);

    await expect(page.locator(".input-field[onclick='example1()']")).toHaveCount(1);
    await expect(page.locator(".input-field[onclick='example2()']")).toHaveCount(1);
    await expect(page.locator(".button[onclick='example3()']")).toHaveCount(1);

    const inputVal = await app.getInputValue();
    const sliderVal = await app.getSliderValue();

    // Input should start empty and slider default value is "50" per HTML
    expect(inputVal).toBe('');
    expect(sliderVal).toBe('50');

    // Ensure no uncaught page errors on initial load
    const pageErrors = app.getPageErrors();
    expect(Array.isArray(pageErrors)).toBe(true);
    expect(pageErrors.length).toBe(0);
  });

  test('Load Balancing button triggers Example 1 and logs appropriate messages', async () => {
    // Click the "Load Balancing" button which should call loadBalancing()
    // loadBalancing() logs and then triggers example1()
    await app.clickLoadBalancing();

    // Wait for expected console logs indicating actions executed
    const sawLoadLog = await app.waitForConsoleMessageIncludes('Load balancing initiated.', 1000);
    const sawExample1Log = await app.waitForConsoleMessageIncludes('Example 1 initiated.', 1000);
    expect(sawLoadLog).toBe(true);
    expect(sawExample1Log).toBe(true);

    // Verify DOM changes: Example 1 sets input1 and slider1 to known values
    const inputVal = await app.getInputValue();
    const sliderVal = await app.getSliderValue();
    expect(inputVal).toBe('Example 1 input value');
    expect(sliderVal).toBe('50');

    // No uncaught JS errors expected for this transition
    expect(app.getPageErrors().length).toBe(0);
  });

  test('Clicking Example 1 directly loads Example 1 (S1_Example1)', async () => {
    // Clicking the Example 1 button should set values and log
    await app.clickExample1();

    const sawExample1Log = await app.waitForConsoleMessageIncludes('Example 1 initiated.', 1000);
    expect(sawExample1Log).toBe(true);

    const inputVal = await app.getInputValue();
    const sliderVal = await app.getSliderValue();
    expect(inputVal).toBe('Example 1 input value');
    expect(sliderVal).toBe('50');

    expect(app.getPageErrors().length).toBe(0);
  });

  test('Clicking Example 2 loads Example 2 (S2_Example2) and updates inputs', async () => {
    // Example 2 should set input and slider to Example 2 values
    await app.clickExample2();

    const sawExample2Log = await app.waitForConsoleMessageIncludes('Example 2 initiated.', 1000);
    expect(sawExample2Log).toBe(true);

    const inputVal = await app.getInputValue();
    const sliderVal = await app.getSliderValue();
    expect(inputVal).toBe('Example 2 input value');
    expect(sliderVal).toBe('70');

    expect(app.getPageErrors().length).toBe(0);
  });

  test('Clicking Example 3 loads Example 3 (S3_Example3) and updates inputs', async () => {
    await app.clickExample3();

    const sawExample3Log = await app.waitForConsoleMessageIncludes('Example 3 initiated.', 1000);
    expect(sawExample3Log).toBe(true);

    const inputVal = await app.getInputValue();
    const sliderVal = await app.getSliderValue();
    expect(inputVal).toBe('Example 3 input value');
    expect(sliderVal).toBe('90');

    expect(app.getPageErrors().length).toBe(0);
  });

  test('Save from Example 1 logs the saved values (transition S1_Example1 -> S0_Idle via Save)', async () => {
    // Prepare state S1 by loading Example1
    await app.clickExample1();
    await app.waitForConsoleMessageIncludes('Example 1 initiated.', 500);

    // Now click Save
    await app.clickSave();

    // Verify save flow logged
    const sawSaveLog = await app.waitForConsoleMessageIncludes('Save initiated.', 1000);
    expect(sawSaveLog).toBe(true);

    // The save() implementation logs the input and slider values; assert their presence
    const messages = app.getConsoleMessages();
    const containsInputLog = messages.some((m) => m.includes('Example 1 input value') || m.includes('Example 1 input value:'));
    const containsSliderLog = messages.some((m) => m.includes('Example 1 slider value') || m.includes('50'));
    expect(containsInputLog).toBe(true);
    expect(containsSliderLog).toBe(true);

    // After save, no uncaught errors
    expect(app.getPageErrors().length).toBe(0);
  });

  test('Reset and Clear actions set input to empty and slider to 0 (tested from Example2)', async () => {
    // Load Example2 state first
    await app.clickExample2();
    await app.waitForConsoleMessageIncludes('Example 2 initiated.', 500);

    // Reset should clear input and set slider to 0
    await app.clickReset();
    const sawResetLog = await app.waitForConsoleMessageIncludes('Reset initiated.', 1000);
    expect(sawResetLog).toBe(true);

    let inputVal = await app.getInputValue();
    let sliderVal = await app.getSliderValue();
    expect(inputVal).toBe('');
    expect(sliderVal).toBe('0');

    // Now reload Example2 to test Clear
    await app.clickExample2();
    await app.waitForConsoleMessageIncludes('Example 2 initiated.', 500);

    await app.clickClear();
    const sawClearLog = await app.waitForConsoleMessageIncludes('Clear initiated.', 1000);
    expect(sawClearLog).toBe(true);

    inputVal = await app.getInputValue();
    sliderVal = await app.getSliderValue();
    expect(inputVal).toBe('');
    expect(sliderVal).toBe('0');

    expect(app.getPageErrors().length).toBe(0);
  });

  test('Edge case: Saving when inputs are empty logs empty values (reset then save)', async () => {
    // Ensure cleared state
    await app.clickReset();
    await app.waitForConsoleMessageIncludes('Reset initiated.', 500);

    // Now save in empty state
    await app.clickSave();
    const sawSaveLog = await app.waitForConsoleMessageIncludes('Save initiated.', 1000);
    expect(sawSaveLog).toBe(true);

    // The logs should include an empty input (empty string) and slider value "0"
    const messages = app.getConsoleMessages();
    // We expect at least the Save initiated message and a log for slider value "0"
    expect(messages.some((m) => m.includes('Save initiated.'))).toBe(true);
    expect(messages.some((m) => m.includes('0'))).toBe(true);

    expect(app.getPageErrors().length).toBe(0);
  });

  test('Collect and assert console logs and page errors are observable through the test harness', async () => {
    // This test validates we can observe console logs produced by actions and that there are no uncaught errors.
    await app.clickExample3();
    await app.waitForConsoleMessageIncludes('Example 3 initiated.', 500);

    await app.clickSave();
    await app.waitForConsoleMessageIncludes('Save initiated.', 500);

    const messages = app.getConsoleMessages();
    // Ensure some expected messages are present
    expect(messages.some((m) => m.includes('Example 3 initiated.'))).toBe(true);
    expect(messages.some((m) => m.includes('Save initiated.'))).toBe(true);
    expect(messages.some((m) => m.includes('Example 3 input value'))).toBe(true);

    // Observe page errors (edge scenario: if the application had ReferenceError/SyntaxError/TypeError they'd be captured)
    // For this implementation we assert there are zero uncaught page errors.
    // This both documents behavior and fulfills the requirement to observe and assert page errors (presence or absence).
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });
});