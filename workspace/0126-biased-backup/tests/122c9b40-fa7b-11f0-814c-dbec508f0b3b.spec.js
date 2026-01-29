import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c9b40-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object to encapsulate common interactions and queries
class TimeComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.start = page.locator('#start-button');
    this.stop = page.locator('#stop-button');
    this.reset = page.locator('#reset-button');
    this.durationSlider = page.locator('#duration-slider');
    this.timeInput = page.locator('#time-input');
    this.calculateButton = page.locator('#calculate-button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click helpers
  async clickStart() { await this.start.click(); }
  async clickStop() { await this.stop.click(); }
  async clickReset() { await this.reset.click(); }

  // Input helpers
  async setSlider(value) { await this.durationSlider.evaluate((el, v) => el.value = v, String(value)); await this.durationSlider.dispatchEvent('input'); }
  async typeTimeInput(text) { await this.timeInput.fill(text); await this.timeInput.dispatchEvent('input'); }

  // State queries
  async isStartDisabled() { return await this.start.evaluate(el => el.disabled); }
  async isStopDisabled() { return await this.stop.evaluate(el => el.disabled); }
  async isCalculateDisabled() { return await this.calculateButton.evaluate(el => el.disabled); }
  async isSliderDisabled() { return await this.durationSlider.evaluate(el => el.disabled); }
  async isTimeInputDisabled() { return await this.timeInput.evaluate(el => el.disabled); }
  async calculateButtonColor() { return await this.calculateButton.evaluate(el => {
    // Normalize to computed background color if inline not set
    const inline = el.style.backgroundColor;
    if (inline) return inline;
    return window.getComputedStyle(el).backgroundColor;
  }); }
  async getTimeInputValue() { return await this.timeInput.evaluate(el => el.value); }
  async getSliderValue() { return await this.durationSlider.evaluate(el => el.value); }
}

test.describe('Time Complexity Interactive App - FSM Validation', () => {
  // Arrays to collect runtime errors and console error messages
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Listen for uncaught exceptions on the page (pageerror)
    page.on('pageerror', error => {
      // store error objects for assertions
      pageErrors.push(error);
    });

    // Listen for console messages, capture errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
  });

  test.afterEach(async () => {
    // No teardown beyond default - we will assert on pageErrors/consoleErrors in tests below
  });

  test('Initial Idle state: page renders required controls', async ({ page }) => {
    // Validate renderPage() entry: elements exist and are interactable
    const p = new TimeComplexityPage(page);
    await p.goto();

    // Verify DOM elements presence
    await expect(p.start).toBeVisible();
    await expect(p.stop).toBeVisible();
    await expect(p.reset).toBeVisible();
    await expect(p.durationSlider).toBeVisible();
    await expect(p.timeInput).toBeVisible();
    await expect(p.calculateButton).toBeVisible();

    // The HTML does not set disabled attributes initially; assert current enabled/disabled statuses are consistent with implementation
    // Initial state expectations (based on provided HTML): none of the buttons are disabled by markup
    expect(await p.isStartDisabled()).toBe(false);
    expect(await p.isStopDisabled()).toBe(false); // markup shows Stop enabled by default
    expect(await p.isCalculateDisabled()).toBe(false);
    expect(await p.isSliderDisabled()).toBe(false);
    expect(await p.isTimeInputDisabled()).toBe(false);

    // No runtime errors should have occurred on initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('StartEvent transitions Idle -> Started and updates controls and visuals', async ({ page }) => {
    // This test validates the StartEvent transition: clicking Start should set start.disabled = true, stop.disabled = false, calculate enabled, slider and input enabled, and calculate button visual feedback
    const p = new TimeComplexityPage(page);
    await p.goto();

    // Precondition: ensure start is enabled so we can click it
    expect(await p.isStartDisabled()).toBe(false);

    // Click Start
    await p.clickStart();

    // After start(): start disabled true, stop disabled false, calculate disabled false, slider & time input enabled
    expect(await p.isStartDisabled()).toBe(true);
    expect(await p.isStopDisabled()).toBe(false);
    expect(await p.isCalculateDisabled()).toBe(false);
    expect(await p.isSliderDisabled()).toBe(false);
    expect(await p.isTimeInputDisabled()).toBe(false);

    // calculateButton style changed to green per start()
    const color = await p.calculateButtonColor();
    // style applied inline as 'green' - could be 'green' or rgb(...) depending on browser; check substring
    expect(String(color)).toContain('green');

    // No uncaught page errors produced by the action
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('StopEvent transitions Started -> Stopped and updates controls and visuals', async ({ page }) => {
    // This test validates StopEvent when called from Started state
    const p = new TimeComplexityPage(page);
    await p.goto();

    // Move to Started first
    await p.clickStart();
    expect(await p.isStartDisabled()).toBe(true);

    // Now click Stop
    await p.clickStop();

    // stop(): startButton.disabled = false; stopButton.disabled = true; calculate, slider, timeInput disabled; calculate color red
    expect(await p.isStartDisabled()).toBe(false);
    expect(await p.isStopDisabled()).toBe(true);
    expect(await p.isCalculateDisabled()).toBe(true);
    expect(await p.isSliderDisabled()).toBe(true);
    expect(await p.isTimeInputDisabled()).toBe(true);

    const color = await p.calculateButtonColor();
    expect(String(color)).toContain('red');

    // No runtime errors observed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetEvent from Started transitions to Reset and resets values, then Start from Reset transitions back to Started', async ({ page }) => {
    // This test validates Reset behavior when invoked from Started state and subsequent Start from Reset
    const p = new TimeComplexityPage(page);
    await p.goto();

    // Move to Started
    await p.clickStart();
    expect(await p.isStartDisabled()).toBe(true);

    // Now Reset
    await p.clickReset();

    // The reset() function toggles multiple times but final expected visible state per implementation:
    // duration resets to 10 (internal), time resets to 0 (internal), start disabled false, stop disabled true, calculate disabled true
    expect(await p.isStartDisabled()).toBe(false);
    expect(await p.isStopDisabled()).toBe(true);
    expect(await p.isCalculateDisabled()).toBe(true);

    // Time input should reflect the calculated time from last calculate (reset doesn't call calculate but sets time variable to 0).
    // Because reset doesn't update timeInput.value directly, but calculate sets it; still we assert internal contract: time should be 0.
    // We cannot access internal JS variables; instead we rely on visible side-effects: calculator is disabled and button color is likely green from reset() then disabled = true; final color expectation per last assignment sets it to disabled true and style maybe unchanged. We'll assert the element exists and no exceptions occurred.
    await expect(p.timeInput).toBeVisible();

    // Now Start from Reset should move to Started
    await p.clickStart();
    expect(await p.isStartDisabled()).toBe(true);
    expect(await p.isStopDisabled()).toBe(false);
    expect(await p.isCalculateDisabled()).toBe(false);

    // No runtime errors from sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetEvent from Stopped transitions to Reset (via Stop -> Reset)', async ({ page }) => {
    // Validate Reset when invoked from Stopped state
    const p = new TimeComplexityPage(page);
    await p.goto();

    // Move to Started then Stop to reach Stopped
    await p.clickStart();
    await p.clickStop();

    expect(await p.isStopDisabled()).toBe(true);
    expect(await p.isStartDisabled()).toBe(false);

    // Now Reset
    await p.clickReset();

    // After reset the expected final visible states:
    expect(await p.isStartDisabled()).toBe(false);
    expect(await p.isStopDisabled()).toBe(true);
    expect(await p.isCalculateDisabled()).toBe(true);

    // No runtime errors observed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('CalculateEvent via duration slider and time input: updates UI and handles non-updated internal variables gracefully', async ({ page }) => {
    // This test verifies calculate() is wired to both slider and text input and that it produces deterministic DOM changes even if internal vars are surprising
    const p = new TimeComplexityPage(page);
    await p.goto();

    // Ensure calculate button exists and can change color
    // Trigger input on duration slider - note implementation: calculate() uses internal `duration` and `time` variables, not the DOM value
    await p.setSlider(25);

    // calculate() sets time = duration * time; initial time is 0 so expected timeInput.value becomes "0"
    expect(await p.getTimeInputValue()).toBe('0');

    // calculate button style should be green after calculate()
    const colorAfterSlider = await p.calculateButtonColor();
    expect(String(colorAfterSlider)).toContain('green');

    // Now type some non-numeric into time input to test edge handling
    await p.typeTimeInput('abc');

    // calculate() again runs; because calculate uses internal `time` variable (a number) the DOM input will be overwritten with the internal numeric time value (likely "0")
    expect(await p.getTimeInputValue()).toBe('0');

    // No uncaught errors happened during input events
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid repeated clicks and operations do not produce uncaught exceptions', async ({ page }) => {
    // This test rapidly invokes Start/Stop/Reset to check for race conditions or runtime exceptions
    const p = new TimeComplexityPage(page);
    await p.goto();

    // Rapid sequence: Start, Start (again), Stop, Stop (again), Reset, Reset (again)
    await p.clickStart();
    // second click might be ignored because disabled, but we do it deliberately to ensure no errors thrown
    try { await p.clickStart(); } catch (e) { /* clicking a disabled element may throw; catch to continue - we'll assert page errors separately */ }

    await p.clickStop();
    try { await p.clickStop(); } catch (e) { /* ignore */ }

    await p.clickReset();
    try { await p.clickReset(); } catch (e) { /* ignore */ }

    // After the sequence, assert no uncaught page errors nor console.error logs
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: ensure no console.error or page errors occurred during full interaction flow', async ({ page }) => {
    // This test performs a full flow and then asserts on the recorded pageErrors and consoleErrors arrays collected via listeners
    const p = new TimeComplexityPage(page);
    await p.goto();

    // Full flow: Start -> slider input -> type numeric -> Stop -> Reset -> Start
    await p.clickStart();
    await p.setSlider(50);
    await p.typeTimeInput('5'); // input event triggers calculate (but does not change internal time var)
    await p.clickStop();
    await p.clickReset();
    await p.clickStart();

    // Validate final expected state: Started
    expect(await p.isStartDisabled()).toBe(true);
    expect(await p.isStopDisabled()).toBe(false);

    // Assert there were no runtime page errors or console.error messages during the flow
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});