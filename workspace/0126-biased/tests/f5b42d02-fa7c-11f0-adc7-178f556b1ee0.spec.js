import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b42d02-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object Model for the Neural Networks demo page.
 * Encapsulates selectors and helpful actions to keep tests readable.
 */
class NeuralPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick="document.getElementById(\'demo\').style.display=\\\'block\\\';"]';
    this.demoSelector = '#demo';
    this.resultSelector = '#result';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for basic elements to be attached
    await Promise.all([
      this.page.waitForSelector('h1'),
      this.page.waitForSelector(this.buttonSelector),
      this.page.waitForSelector(this.demoSelector),
      this.page.waitForSelector(this.resultSelector)
    ]);
  }

  async clickExplore() {
    await this.page.click(this.buttonSelector);
  }

  async getResultText() {
    return await this.page.locator(this.resultSelector).evaluate((el) => el.innerText || el.textContent || '');
  }

  async isDemoDisplayed() {
    return await this.page.locator(this.demoSelector).evaluate((el) => {
      // Return true if computed display is not 'none'
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none';
    });
  }

  async callPredict(input, output) {
    return await this.page.evaluate(
      ([i, o]) => {
        // Call the page's predict function directly (do not redefine it)
        // This will throw if predict is missing; tests will observe that naturally.
        // We intentionally do not patch or redefine predict.
        // Return its result or the thrown error message.
        try {
          // eslint-disable-next-line no-undef
          const r = predict(i, o);
          return { ok: true, result: r };
        } catch (err) {
          return { ok: false, name: err && err.name, message: err && err.message };
        }
      },
      [input, output]
    );
  }
}

test.describe('Neural Networks FSM - f5b42d02-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Capture console messages and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages; capture errors and warnings for assertions.
    page.on('console', (msg) => {
      try {
        const type = msg.type(); // 'log', 'error', 'warning', etc.
        const text = msg.text();
        if (type === 'error' || /ReferenceError|TypeError|SyntaxError/i.test(text)) {
          consoleErrors.push({ type, text });
        }
      } catch (e) {
        // If something goes wrong capturing the console, push a generic entry so tests can observe it.
        consoleErrors.push({ type: 'capture-error', text: String(e) });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Provide basic debugging info in case of failure (Playwright will also capture)
    if (testInfo.status !== testInfo.expectedStatus) {
      // Nothing to mutate in the page; this is only for traceability in CI logs.
      // Do not modify the page or global runtime.
    }
  });

  test('Initial state S0_Idle: page renders and demo() executes on load', async ({ page }) => {
    // This test validates the Idle state after page load.
    // It asserts that the page content is present, that the demo container exists and is visible,
    // and that the demo() function executed as the HTML includes a call to demo() at the end of the script.
    const np = new NeuralPage(page);
    await np.goto();

    // Basic content assertions
    await expect(page.locator('h1')).toHaveText('Neural Networks');
    await expect(page.locator('p')).toContainText('What is a Neural Network?');

    // The demo container should exist and be displayed (computed display not 'none').
    const demoVisible = await np.isDemoDisplayed();
    expect(demoVisible).toBe(true);

    // The demo() function is invoked on load in the provided HTML (demo();).
    // Check that the #result contains the expected introductory text.
    const resultText = await np.getResultText();
    expect(resultText).toContain('The neural network learned the patterns in the inputs and outputs.');

    // Ensure that the demo iteration results are present for each input in the script.
    // The demo() function appends lines like "Input: 1, Output: 0, Prediction: Incorrect"
    expect(resultText).toMatch(/Input: 1, Output: 0, Prediction:/);
    expect(resultText).toMatch(/Input: 2, Output: 1, Prediction:/);
    expect(resultText).toMatch(/Input: 3, Output: 1, Prediction:/);

    // Assert no uncaught page errors of severe types were emitted on load.
    // We observe console and pageerror listeners; expect none to be present.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition ExploreNeuralNetworks: clicking button shows #demo and does not re-run demo()', async ({ page }) => {
    // This test validates the ExploreNeuralNetworks event and transition from S0_Idle to S1_Exploring.
    // According to the FSM, clicking the button should set #demo.display to 'block' and (expected) update #result.
    // In the provided HTML the button only sets display='block' and demo() is called once on load.
    // We verify the actual implemented behavior: #demo is visible and #result remains stable after click.
    const np = new NeuralPage(page);
    await np.goto();

    const beforeResult = await np.getResultText();

    // Click the Explore Neural Networks button
    await np.clickExplore();

    // After click, #demo should be displayed (explicitly set to 'block' by the onclick).
    const demoVisibleAfterClick = await np.isDemoDisplayed();
    expect(demoVisibleAfterClick).toBe(true);

    // The page's demo() is NOT called by the onclick in the HTML (onclick only toggles display),
    // so the #result content should be unchanged from before the click.
    const afterResult = await np.getResultText();
    expect(afterResult).toBe(beforeResult);

    // Sanity: the #result still contains the expected learning summary.
    expect(afterResult).toContain('The neural network learned the patterns in the inputs and outputs.');

    // Assert that clicking did not produce console or page errors.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: multiple clicks do not cause errors and #demo remains displayed', async ({ page }) => {
    // This test validates robustness: clicking the Explore button multiple times should not cause runtime errors
    // nor change the visibility state unexpectedly.
    const np = new NeuralPage(page);
    await np.goto();

    // Perform multiple clicks
    for (let i = 0; i < 5; i++) {
      await np.clickExplore();
    }

    // Confirm demo is still displayed
    const visible = await np.isDemoDisplayed();
    expect(visible).toBe(true);

    // No console/page errors should be recorded after repeated interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Internal function predict: returns expected labels for sample inputs (no patching)', async ({ page }) => {
    // This test calls the page's predict function directly to validate its logic without modifying the runtime.
    // We do not redefine or patch predict; we let the page's implementation run as-is.
    const np = new NeuralPage(page);
    await np.goto();

    // Call predict(1, 1) -> should be "Correct"
    const r1 = await np.callPredict(1, 1);
    expect(r1.ok).toBe(true);
    expect(r1.result).toBe('Correct');

    // Call predict(1, 2) -> should be "Incorrect"
    const r2 = await np.callPredict(1, 2);
    expect(r2.ok).toBe(true);
    expect(r2.result).toBe('Incorrect');

    // Ensure that invoking predict directly did not produce any uncaught page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Verify onEnter/onExit semantics as implemented vs. FSM expectations', async ({ page }) => {
    // The FSM suggests demo() should be called on entering Exploring state.
    // The actual HTML calls demo() on load (unconditional), and the button's onclick does not invoke demo().
    // This test documents and asserts the actual observed behavior:
    // - demo() is called on load (so #result is populated before any click)
    // - clicking the button does not re-invoke demo() (so #result does not change)
    const np = new NeuralPage(page);
    await np.goto();

    // Confirm demo ran on load
    const initialResult = await np.getResultText();
    expect(initialResult).toContain('The neural network learned the patterns in the inputs and outputs.');

    // Record timestamp-like marker: length of content
    const beforeLength = initialResult.length;

    // Click explore button which, per HTML, only sets display to block
    await np.clickExplore();

    // Ensure result content length is unchanged (demo() was not re-run by the click)
    const afterResult = await np.getResultText();
    expect(afterResult.length).toBe(beforeLength);

    // There should be no pageerrors or console errors as a result of this mismatch between FSM expectation and HTML.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console/page errors if any appear naturally (do not inject or patch)', async ({ page }) => {
    // This test intentionally focuses on observing runtime errors that may occur naturally.
    // It does NOT cause or inject errors; it simply loads the page and records errors if present.
    // The test asserts that either:
    //  - no runtime errors of interest occurred (common for the provided HTML), OR
    //  - if errors occurred, they are captured in the collectors so they can be asserted/inspected.
    const np = new NeuralPage(page);
    await np.goto();

    // Allow a short period for any asynchronous errors to surface (if they will).
    await page.waitForTimeout(200);

    // If there are errors, fail the test with useful diagnostics.
    // The instruction set requires observing errors naturally and asserting them.
    // Here we assert that no ReferenceError/TypeError/SyntaxError occurred.
    // If any did occur, include diagnostic details in the failure message.
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Build diagnostic strings
      const pe = pageErrors.map((e) => `${e.name || 'PageError'}: ${e.message || String(e)}`).join('\n');
      const ce = consoleErrors.map((c) => `${c.type}: ${c.text}`).join('\n');
      // Fail with diagnostics
      throw new Error(`Runtime errors observed during page load:\nPageErrors:\n${pe}\nConsoleErrors:\n${ce}`);
    }

    // If no errors were captured, assert that explicitly.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});