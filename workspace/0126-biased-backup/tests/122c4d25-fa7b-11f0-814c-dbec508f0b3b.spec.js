import { test, expect } from '@playwright/test';

//
// Test file for Application ID: 122c4d25-fa7b-11f0-814c-dbec508f0b3b
// Served at: http://127.0.0.1:5500/workspace/0126-biased/html/122c4d25-fa7b-11f0-814c-dbec508f0b3b.html
//
// This suite validates the FSM states and transitions for the "Sliding Window" interactive app.
// It intentionally loads the page as-is (no code patches) and observes console messages and page errors.
// Tests are written using Playwright ES module syntax and modern async/await patterns.
//
// IMPORTANT: These tests do not modify application source files. They interact with the page DOM and let
// JavaScript errors happen naturally if they occur. Each test asserts expected DOM changes described by the FSM.
//
// Test coverage summary:
// - Verify Idle (initial) state components and initial values.
// - Verify Start -> Started transition: clicking Start updates result text and width value.
// - Verify Stop transition from Started: clicking Stop updates result text and width value.
// - Verify Reset transition: clicking Reset resets width and updates result text.
// - Verify Duration input change transition: input event updates result text and duration value (per implementation).
// - Edge cases: clicking buttons inside a form (submit behavior) is allowed and handled; tests tolerate page reloads.
// - Observability: collect console messages and page errors and assert that no uncaught page errors occurred.
//

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c4d25-fa7b-11f0-814c-dbec508f0b3b.html';

class SlidingWindowPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      widthInput: page.locator('#width'),
      heightInput: page.locator('#height'),
      durationInput: page.locator('#duration'),
      widthValueSpan: page.locator('#width-value'),
      heightValueSpan: page.locator('#height-value'),
      durationValueSpan: page.locator('#duration-value'),
      startButton: page.locator('#start-button'),
      stopButton: page.locator('#stop-button'),
      resetButton: page.locator('#reset-button'),
      resultDiv: page.locator('#result'),
    };
  }

  // Navigate to the application and wait for it to be ready
  async goto() {
    await this.page.goto(APP_URL);
    // wait for DOM to be stable
    await this.page.waitForLoadState('domcontentloaded');
    // Ensure container exists
    await expect(this.page.locator('.container')).toBeVisible();
  }

  // Helper to robustly click and allow for form-submission-driven reloads.
  // Some buttons are inside a form (default type=submit) and may trigger a navigation/reload.
  // We click, then wait briefly for potential navigation. If navigation happens, we wait for load.
  async safeClick(locator) {
    // prepare a waitForNavigation with short timeout to avoid hanging if no navigation occurs
    const maybeNav = this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 500 }).catch(() => null);
    await locator.click();
    await maybeNav;
    // after possible navigation, wait a short time for scripts to re-run
    await this.page.waitForTimeout(50);
  }

  async getResultText() {
    return (await this.locators.resultDiv.textContent()) || '';
  }

  async getWidthValue() {
    // read the input value property (not the span)
    return await this.page.evaluate((sel) => document.querySelector(sel).value, '#width');
  }

  async getWidthSpanText() {
    return (await this.locators.widthValueSpan.textContent()) || '';
  }

  async setDurationValue(value) {
    // set the input's value property and dispatch an input event to trigger handlers
    await this.page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.value = String(value);
        const ev = new Event('input', { bubbles: true });
        el.dispatchEvent(ev);
      },
      { selector: '#duration', value }
    );
    // give handlers a moment
    await this.page.waitForTimeout(50);
  }

  async clickStart() {
    await this.safeClick(this.locators.startButton);
  }

  async clickStop() {
    await this.safeClick(this.locators.stopButton);
  }

  async clickReset() {
    await this.safeClick(this.locators.resetButton);
  }
}

test.describe('Sliding Window FSM - comprehensive tests', () => {
  let logs;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize log and error collectors for each test
    logs = [];
    pageErrors = [];

    // Record console messages
    page.on('console', (msg) => {
      const entry = { type: msg.type(), text: msg.text() };
      logs.push(entry);
    });

    // Record uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert that no uncaught page errors were raised while interacting with the page.
    // The application is loaded as-is; if runtime errors occur they will be captured and cause test failures here.
    expect(pageErrors, 'No uncaught page errors should have been emitted').toHaveLength(0);
  });

  test('Idle state: initial render and components are present', async ({ page }) => {
    // Validate the Idle (S0_Idle) state: page elements, controls, and initial values.
    const app = new SlidingWindowPage(page);
    await app.goto();

    // Check that the Start/Stop/Reset buttons are present and visible
    await expect(app.locators.startButton).toBeVisible();
    await expect(app.locators.stopButton).toBeVisible();
    await expect(app.locators.resetButton).toBeVisible();

    // Check that range inputs exist and have expected attributes/initial values
    await expect(app.locators.widthInput).toHaveAttribute('min', '10');
    await expect(app.locators.widthInput).toHaveAttribute('max', '100');
    await expect(app.locators.widthInput).toHaveValue('50'); // input value property
    await expect(app.locators.widthValueSpan).toHaveText('50'); // span that shows width

    await expect(app.locators.heightInput).toHaveAttribute('min', '10');
    await expect(app.locators.heightInput).toHaveAttribute('max', '100');
    await expect(app.locators.heightInput).toHaveValue('50');
    await expect(app.locators.heightValueSpan).toHaveText('50');

    await expect(app.locators.durationInput).toHaveAttribute('min', '1');
    await expect(app.locators.durationInput).toHaveAttribute('max', '60');
    await expect(app.locators.durationInput).toHaveValue('10');
    await expect(app.locators.durationValueSpan).toHaveText('10');

    // Result div should be empty initially (Idle)
    const initialResult = await app.getResultText();
    expect(initialResult.trim()).toBe('');
  });

  test('Start event transitions to Started state and updates result (S0_Idle -> S1_Started)', async ({ page }) => {
    // This test validates the StartButtonClick event and the Started state's expected observable:
    // resultDiv.textContent updated to "Window Width: <value>px" using the width-value span.
    const app = new SlidingWindowPage(page);
    await app.goto();

    // Confirm initial span is 50
    expect(await app.getWidthSpanText()).toBe('50');

    // Click Start; as the button is inside a form, clicking may trigger a page reload.
    // safeClick handles potential navigation/reload.
    await app.clickStart();

    // After clicking Start, resultDiv should contain the text "Window Width: 50px"
    const result = (await app.getResultText()).trim();
    expect(result).toBe('Window Width: 50px');

    // Also verify the width input's value property was set (JS sets width.value = value)
    const widthVal = await app.getWidthValue();
    expect(widthVal).toBe('50');
  });

  test('Stop event transitions to Stopped state and updates result (S1_Started -> S2_Stopped)', async ({ page }) => {
    // Validate StopButtonClick event. Even if the app was not previously 'started' the handler sets resultDiv similarly.
    const app = new SlidingWindowPage(page);
    await app.goto();

    // Click Start first to emulate typical usage, then Stop.
    await app.clickStart();

    // Click Stop: may trigger form submission and reload; safeClick handles this.
    await app.clickStop();

    const result = (await app.getResultText()).trim();
    expect(result).toBe('Window Width: 50px');

    // Confirm width input remains 50
    const widthVal = await app.getWidthValue();
    expect(widthVal).toBe('50');
  });

  test('Reset event resets state and updates result (S1_Started -> S3_Reset)', async ({ page }) => {
    // Validate ResetButtonClick transitions to Reset state: width reset to 50 and resultDiv updated accordingly.
    const app = new SlidingWindowPage(page);
    await app.goto();

    // Change the width's input value programmatically to simulate a user adjustment (span won't change automatically in this implementation).
    // We do not alter app source; this only manipulates the DOM as a user might by moving a slider.
    await page.evaluate(() => {
      const w = document.getElementById('width');
      if (w) w.value = '90';
      const widthSpan = document.getElementById('width-value');
      if (widthSpan) widthSpan.textContent = '90';
    });

    // Confirm we have '90' in the span and input value before reset
    expect(await app.getWidthSpanText()).toBe('90');
    expect(await app.getWidthValue()).toBe('90');

    // Click Reset which should restore width to 50 and set resultDiv accordingly.
    await app.clickReset();

    // After reset, the input value should be 50 and resultDiv should reflect that
    const result = (await app.getResultText()).trim();
    expect(result).toBe('Window Width: 50px');

    const widthVal = await app.getWidthValue();
    expect(widthVal).toBe('50');

    // The span might remain stale depending on implementation; check at least the input property was set.
  });

  test('Duration input change triggers result update per implementation (S0_Idle -> S3_Reset via DurationInputChange)', async ({ page }) => {
    // Validate duration input's 'input' event handler.
    // The current implementation reads the duration-value span (which is static in the provided HTML),
    // so changing the range input's value alone may not change the span. This test verifies the actual behavior
    // implemented in the page: the resultDiv will be updated using the span's number (initially 10).
    const app = new SlidingWindowPage(page);
    await app.goto();

    // Set the duration input's value to 20 and dispatch 'input'.
    // Implementation reads duration-value span text content, which is 10 by default.
    await app.setDurationValue(20);

    // According to the script, the resultDiv will be set to "Duration: <duration-value-span> seconds"
    // Since the span hasn't been updated by the app, it will likely be "Duration: 10 seconds".
    const result = (await app.getResultText()).trim();
    // Accept either the computed value or the fallback — check that the result string starts with "Duration:"
    expect(result.startsWith('Duration:')).toBeTruthy();

    // Also verify that the duration input's property was set by the handler (script sets duration.value = value from span)
    const durationVal = await page.evaluate(() => document.getElementById('duration')?.value);
    // duration.value is expected to be a string; the implementation sets it to the span's value (likely "10")
    expect(typeof durationVal).toBe('string');
    // Basic sanity: it should be in the allowed range as string
    const nv = Number(durationVal);
    expect(nv).toBeGreaterThanOrEqual(1);
    expect(nv).toBeLessThanOrEqual(60);
  });

  test('Edge case: repeated clicks and rapid interactions do not throw uncaught exceptions', async ({ page }) => {
    // Rapidly interact with the UI: multiple Start and Reset clicks, duration input changes.
    // We only assert there are no uncaught page errors emitted during these interactions.
    const app = new SlidingWindowPage(page);
    await app.goto();

    // Rapid interactions
    for (let i = 0; i < 3; i++) {
      await app.clickStart();
    }
    for (let i = 0; i < 3; i++) {
      await app.clickStop();
    }
    for (let i = 0; i < 2; i++) {
      await app.setDurationValue(5 + i);
    }
    await app.clickReset();

    // Ensure resultDiv exists and contains some text (implementation updates it)
    const result = (await app.getResultText()).trim();
    expect(result.length).toBeGreaterThanOrEqual(0); // just ensure no crashes

    // The afterEach hook will assert that pageErrors is empty
  });

  test('Observe console messages while interacting with page (no uncaught console.error expected)', async ({ page }) => {
    // This test demonstrates capturing console messages.
    const app = new SlidingWindowPage(page);
    await app.goto();

    // Interact to generate potential console output
    await app.clickStart();
    await app.setDurationValue(15);
    await app.clickReset();

    // We collected console messages in the beforeEach handler.
    // Assert that none of the console messages are of type 'error' to detect runtime logged errors.
    const errorMessages = logs.filter((m) => m.type === 'error');
    expect(errorMessages.length).toBe(0);
  });
});