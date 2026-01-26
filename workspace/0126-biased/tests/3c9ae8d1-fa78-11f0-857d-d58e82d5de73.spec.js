import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9ae8d1-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the Unit Testing demo page
class UnitTestPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btn = page.locator('.btn-refresh');
    this.codeLines = page.locator('.code-wrapper .code-line');
    this.passLines = page.locator('.code-wrapper .code-line.pass');
    this.failLines = page.locator('.code-wrapper .code-line.fail');
    this.passBar = page.locator('.result-pass');
    this.failBar = page.locator('.result-fail');
    this.resultText = page.locator('.result-text');
    this.container = page.locator('.container');
  }

  // Navigate to the app and wait until loaded
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure initial script execution completed
    await this.page.waitForTimeout(50);
  }

  // Click run tests button
  async clickRun() {
    await this.btn.click();
  }

  // Returns numeric counts of pass/fail computed from DOM classes
  async getPassFailCounts() {
    const pass = await this.passLines.count();
    const fail = await this.failLines.count();
    return { pass, fail };
  }

  // Returns the text content of the result summary
  async getResultText() {
    const txt = await this.resultText.textContent();
    return txt ? txt.trim() : '';
  }

  // Returns current button disabled state and text
  async getButtonState() {
    const disabled = await this.btn.isDisabled();
    const text = (await this.btn.textContent())?.trim() ?? '';
    return { disabled, text };
  }

  // Wait until the button returns to idle (enabled and text 'Run Tests Again')
  async waitForIdleButton(timeout = 3000) {
    await this.page.waitForFunction(() => {
      const btn = document.querySelector('.btn-refresh');
      return btn && !btn.disabled && btn.textContent.trim() === 'Run Tests Again';
    }, {}, { timeout });
  }

  // Helper to call updateTests in page context with a specific array
  async callUpdateTests(resultsArray) {
    await this.page.evaluate((arr) => {
      // call existing function defined by the app
      // intentionally not modifying or patching any functions
      // this will throw if updateTests is not defined (which we'll catch in tests)
      updateTests(arr);
    }, resultsArray);
  }

  // Helper to read flexGrow numeric values from bars
  async getFlexGrowValues() {
    const passGrow = await this.passBar.evaluate((el) => el.style.flexGrow);
    const failGrow = await this.failBar.evaluate((el) => el.style.flexGrow);
    return { passGrow, failGrow };
  }
}

test.describe('3c9ae8d1-fa78-11f0-857d-d58e82d5de73 — FSM: Unit Testing UI', () => {
  // Arrays to capture console messages and page errors across each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events so tests can assert on them
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test fails, attach captured console and page errors as test output for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => String(e)));
    }
  });

  test('Initial Idle state: UI elements present and initial test results applied', async ({ page }) => {
    // Validate initial "Idle" state per FSM entry action: updateTests([...]) is executed on load
    const app = new UnitTestPage(page);
    await app.goto();

    // Button should be present, enabled, and show "Run Tests Again" as per S0_Idle
    const { disabled, text } = await app.getButtonState();
    expect(disabled).toBeFalsy(); // button is enabled in Idle
    expect(text).toBe('Run Tests Again');

    // The page script calls updateTests([...]) on init; verify DOM state matches that call
    // We expect code-line classes to reflect the initial scenario provided in the script.
    const counts = await app.getPassFailCounts();
    // The implementation's initial scenario array (in the script) had 6 trues and 2 falses.
    expect(counts.pass).toBe(6);
    expect(counts.fail).toBe(2);

    // Result text should reflect the same numbers
    const resultText = await app.getResultText();
    // Extract numbers robustly (many spaces/nbsp may exist); make sure numbers match the DOM counts
    const match = resultText.match(/(\d+)\s*Passed.*?(\d+)\s*Failed/);
    expect(match).not.toBeNull();
    const [, passTxt, failTxt] = match!;
    expect(Number(passTxt)).toBe(counts.pass);
    expect(Number(failTxt)).toBe(counts.fail);

    // Visual bar flexGrow values should be present and be parsable floats
    const fg = await app.getFlexGrowValues();
    expect(fg.passGrow).toBeTruthy();
    expect(fg.failGrow).toBeTruthy();

    // There should be no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);
    // Also assert there are no console 'error' messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition to RunningTests: clicking button disables it and shows Running...', async ({ page }) => {
    // Validate S0 -> S1 transition effects on button on click
    const app = new UnitTestPage(page);
    await app.goto();

    // Attach a small listener capture to ensure click handler runs (we rely on page effects)
    // Click the run button to start tests
    await app.clickRun();

    // Immediately after click, the FSM's onEnter for RunningTests should set disabled = true and text = 'Running...'
    const stateAfterClick = await app.getButtonState();
    expect(stateAfterClick.disabled).toBeTruthy();
    expect(stateAfterClick.text).toBe('Running...');

    // Container should have a temporary brightness filter applied per implementation
    const containerFilter = await app.container.evaluate((el) => el.style.filter);
    // The script sets container.style.filter = 'brightness(1.15)' synchronously during click
    expect(containerFilter).toContain('brightness(1.15)');

    // There should be no uncaught page errors as a result of the click (handler is synchronous until timeout)
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Clean up: wait until the run completes (we'll wait in next test for final state)
  });

  test('Transition back to Idle after run completes and UI updates results', async ({ page }) => {
    // Validate S1 -> S0 transition: after ~1400ms, button is re-enabled and text reset, results updated
    const app = new UnitTestPage(page);
    await app.goto();

    // Trigger run
    await app.clickRun();

    // Wait for the FSM exit actions to restore the button; the implementation uses a 1400ms timeout.
    // We wait for the button to become enabled and contain 'Run Tests Again'
    await app.waitForIdleButton(4000); // generous timeout for CI slowness

    // After returning to Idle, ensure button is enabled with correct text
    const finalBtnState = await app.getButtonState();
    expect(finalBtnState.disabled).toBeFalsy();
    expect(finalBtnState.text).toBe('Run Tests Again');

    // Ensure result text and classes are consistent (counts in DOM match the text)
    const counts = await app.getPassFailCounts();
    const resultText = await app.getResultText();
    const match = resultText.match(/(\d+)\s*Passed.*?(\d+)\s*Failed/);
    expect(match).not.toBeNull();
    const [, passTxt, failTxt] = match!;
    expect(Number(passTxt)).toBe(counts.pass);
    expect(Number(failTxt)).toBe(counts.fail);

    // Validate visual transition: pass/fail bars should have flexGrow numbers (strings)
    const { passGrow, failGrow } = await app.getFlexGrowValues();
    // Values should be decimal strings; ensure they can be parsed to numbers and are > 0
    expect(Number(passGrow)).toBeGreaterThan(0);
    expect(Number(failGrow)).toBeGreaterThan(0);

    // No uncaught errors expected during the asynchronous run
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: calling updateTests with a shorter array marks missing entries as fail', async ({ page }) => {
    // This test exercises edge behavior of updateTests: when results array is shorter than code lines
    const app = new UnitTestPage(page);
    await app.goto();

    // Call updateTests with a single-true element; script's updateTests should mark other lines as fail
    await app.callUpdateTests([true]);

    // After calling, DOM should reflect 1 pass and 7 fails (8 lines total)
    const counts = await app.getPassFailCounts();
    expect(counts.pass).toBe(1);
    expect(counts.fail).toBe(7);

    // Result text must echo these counts
    const resultText = await app.getResultText();
    const match = resultText.match(/(\d+)\s*Passed.*?(\d+)\s*Failed/);
    expect(match).not.toBeNull();
    const [, passTxt, failTxt] = match!;
    expect(Number(passTxt)).toBe(counts.pass);
    expect(Number(failTxt)).toBe(counts.fail);

    // No uncaught page errors should be produced by calling the function with a smaller array
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: calling updateTests with empty array marks all tests as fail', async ({ page }) => {
    // When updateTests([]) is called, every entry should be marked as fail
    const app = new UnitTestPage(page);
    await app.goto();

    await app.callUpdateTests([]);

    const counts = await app.getPassFailCounts();
    expect(counts.pass).toBe(0);
    expect(counts.fail).toBe(8);

    const resultText = await app.getResultText();
    const match = resultText.match(/(\d+)\s*Passed.*?(\d+)\s*Failed/);
    expect(match).not.toBeNull();
    const [, passTxt, failTxt] = match!;
    expect(Number(passTxt)).toBe(0);
    expect(Number(failTxt)).toBe(8);

    // Check the result bars have reasonable flexGrow strings (should not be empty)
    const { passGrow, failGrow } = await app.getFlexGrowValues();
    expect(passGrow).toBeTruthy();
    expect(failGrow).toBeTruthy();

    // No uncaught errors should be present
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: multiple clicks during RunningTests should not break FSM (button remains disabled until run completes)', async ({ page }) => {
    // Verify that once the RunningTests state is entered, the UI prevents additional user-triggered runs
    const app = new UnitTestPage(page);
    await app.goto();

    // Click to start tests
    await app.clickRun();

    // Immediately assert the button is disabled
    expect(await app.btn.isDisabled()).toBeTruthy();

    // Attempt to click again with Playwright; this will try to perform a user click but the element is disabled.
    // Playwright's locator.click will still attempt to click unless prevented; we check that the button remains disabled
    // and that no errors occurred. We avoid forcing additional clicks to not pollute the natural behavior.
    try {
      // Use evaluate to simulate a user-initiated click; if the element is disabled, browser should not trigger the handler.
      await page.evaluate(() => {
        const b = document.querySelector('.btn-refresh');
        if (b) {
          // Attempt to dispatch a real MouseEvent like a user (not programmatic .click())
          const ev = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true });
          b.dispatchEvent(ev);
        }
      });
    } catch (e) {
      // Do not fail the test on an exception here; we'll rely on page error captures below
    }

    // Still disabled immediately after attempted re-click
    expect(await app.btn.isDisabled()).toBeTruthy();

    // Wait for the run to complete to avoid flakiness in subsequent tests
    await app.waitForIdleButton(4000);

    // After completion, button should be enabled
    expect(await app.btn.isDisabled()).toBeFalsy();

    // No uncaught errors should be present as a result of attempting to re-click
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: tooltips (data-tip) exist on code lines and match expected content format', async ({ page }) => {
    // Verify some visual/ARIA hints: each code line should have a data-tip attribute for tooltip text
    const app = new UnitTestPage(page);
    await app.goto();

    const count = await app.codeLines.count();
    expect(count).toBeGreaterThan(0); // ensure lines exist

    // Check first few lines have data-tip attributes and that they are non-empty strings
    for (let i = 0; i < Math.min(4, count); i++) {
      const tip = await app.codeLines.nth(i).getAttribute('data-tip');
      expect(typeof tip).toBe('string');
      expect((tip ?? '').length).toBeGreaterThan(0);
    }

    // No page errors or console error messages introduced by reading attributes
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});