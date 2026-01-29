import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9b36f1-fa78-11f0-857d-d58e82d5de73.html';

// Page object encapsulating interactions and selectors for the Interpreter demo
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btnEvaluate = page.locator('#btnEvaluate');
    this.btnReset = page.locator('#btnReset');
    this.outputWindow = page.locator('#outputWindow');
  }

  // Navigate to the app page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the evaluate button
  async clickEvaluate() {
    await this.btnEvaluate.click();
  }

  // Click the reset button
  async clickReset() {
    await this.btnReset.click();
  }

  // Return the textual content of the output window
  async getOutputText() {
    // textContent will reflect the text displayed (includes whitespace)
    return await this.outputWindow.textContent();
  }

  // Return aria-pressed attribute for evaluate button
  async evaluatePressed() {
    return await this.btnEvaluate.getAttribute('aria-pressed');
  }

  // Return aria-pressed attribute for reset button
  async resetPressed() {
    return await this.btnReset.getAttribute('aria-pressed');
  }
}

test.describe('Interpreter Concept — Visual Elegance (FSM validation)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events (including console.error)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture unhandled errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No-op teardown placeholder (keeps test structure explicit)
  });

  test('Initial Idle state: page renders controls and output window (S0_Idle)', async ({ page }) => {
    // This test validates the Idle state: UI elements exist, aria attributes, and initial output
    const app = new InterpreterPage(page);
    await app.goto();

    // Buttons should exist and have expected labels / aria attributes
    await expect(app.btnEvaluate).toBeVisible();
    await expect(app.btnEvaluate).toHaveText('Evaluate Expression');
    await expect(app.btnEvaluate).toHaveAttribute('aria-label', 'Evaluate expression to display result');
    await expect(app.btnEvaluate).toHaveAttribute('aria-pressed', 'false');

    await expect(app.btnReset).toBeVisible();
    await expect(app.btnReset).toHaveText('Reset Output');
    await expect(app.btnReset).toHaveAttribute('aria-label', 'Reset output display');
    await expect(app.btnReset).toHaveAttribute('aria-pressed', 'false');

    // Output window should be present and initialized (the HTML uses &nbsp; initially)
    const outputText = await app.getOutputText();
    // Expect initial textContent to be either a non-empty whitespace (non-breaking space) or similar
    expect(typeof outputText).toBe('string');
    // Trimmed should be empty but raw may contain a space / non-breaking space
    expect(outputText.trim()).toBe('');
    
    // Ensure no uncaught page errors occurred during initial render
    expect(pageErrors).toEqual([]);
  });

  test('Evaluate button transitions: Idle -> Evaluating -> ResultsDisplayed (S0 -> S1 -> S2)', async ({ page }) => {
    // Validates that clicking Evaluate clears output (onEnter Evaluating), animates typing, and displays final result
    const app = new InterpreterPage(page);
    await app.goto();

    // Start with a quick sanity check: initial output is whitespace
    const before = await app.getOutputText();
    expect(before.trim()).toBe('');

    // Click Evaluate: entry action should clear outputWindow.textContent = ''
    await app.clickEvaluate();

    // Immediately after click, aria-pressed toggles
    expect(await app.evaluatePressed()).toBe('true');
    expect(await app.resetPressed()).toBe('false');

    // The script sets outputWindow.textContent = '' right away; check that content is empty or quickly becomes empty.
    // Use a small retry loop to avoid potential race with the typing interval.
    const cleared = await page.waitForFunction(() => {
      const el = document.getElementById('outputWindow');
      if (!el) return false;
      // consider both empty string and empty after trimming as cleared
      return el.textContent === '' || el.textContent === null;
    }, {}, { timeout: 500 }).catch(() => null);
    // Ensure the cleared check passed (if not, at least the output changed from initial whitespace)
    if (!cleared) {
      // fallback: ensure output does not equal the initial raw HTML whitespace
      const now = await app.getOutputText();
      expect(now.trim()).not.toBe('');
    }

    // During typing animation the content should grow character by character.
    // Capture an intermediate state after 150ms - expect some progress (not necessarily full text)
    await page.waitForTimeout(150);
    const midText = (await app.getOutputText()) || '';
    // It should either be empty or a prefix of "Result: 11"
    expect('Result: 11'.startsWith(midText.trim())).toBeTruthy();

    // Wait for the animation to complete and full result to appear
    await page.waitForFunction(() => {
      const el = document.getElementById('outputWindow');
      return el && el.textContent && el.textContent.trim() === 'Result: 11';
    }, {}, { timeout: 5000 });

    const finalText = (await app.getOutputText())?.trim();
    expect(finalText).toBe('Result: 11');

    // After completion, ensure aria state remains true for evaluate (button sets to true on click)
    expect(await app.evaluatePressed()).toBe('true');

    // Confirm no runtime page errors (ReferenceError/SyntaxError/TypeError) occurred during evaluation
    expect(pageErrors).toEqual([]);

    // Also assert that there were no console.error messages logged
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset transitions and behavior (S0_Idle -> S3_Reset and Reset after ResultsDisplayed)', async ({ page }) => {
    // Validates Reset behavior from Idle and after results: toggles aria-pressed and sets output to single blank
    const app = new InterpreterPage(page);
    await app.goto();

    // 1) Reset from Idle
    await app.clickReset();
    // Buttons should reflect reset state
    expect(await app.resetPressed()).toBe('true');
    expect(await app.evaluatePressed()).toBe('false');

    // Output window should contain a single blank per implementation (textContent = ' ')
    const afterReset = await app.getOutputText();
    // The script sets textContent = ' ' (space). Ensure trimmed is empty but raw includes whitespace
    expect(afterReset.trim()).toBe('');

    // 2) Evaluate, wait for result, then Reset again
    await app.clickEvaluate();
    // Wait for final result
    await page.waitForFunction(() => {
      const el = document.getElementById('outputWindow');
      return el && el.textContent && el.textContent.trim() === 'Result: 11';
    }, {}, { timeout: 5000 });

    // Confirm final result is visible
    expect((await app.getOutputText()).trim()).toBe('Result: 11');

    // Click Reset to transition to S3_Reset
    await app.clickReset();
    // Now reset button aria-pressed should be true
    expect(await app.resetPressed()).toBe('true');
    expect(await app.evaluatePressed()).toBe('false');

    // Output should be set to a blank space as per code
    const afterReset2 = await app.getOutputText();
    expect(afterReset2.trim()).toBe('');

    // Confirm still no uncaught page errors
    expect(pageErrors).toEqual([]);
  });

  test('Edge cases: multiple rapid Evaluate clicks and robustness', async ({ page }) => {
    // This test simulates a user clicking Evaluate multiple times quickly to detect potential race conditions
    const app = new InterpreterPage(page);
    await app.goto();

    // Rapidly click Evaluate three times
    await app.clickEvaluate();
    await app.clickEvaluate();
    await app.clickEvaluate();

    // After rapid clicks, ensure no uncaught exceptions happened
    expect(pageErrors).toEqual([]);

    // Eventually the output should stabilize to the correct final value
    await page.waitForFunction(() => {
      const el = document.getElementById('outputWindow');
      return el && el.textContent && el.textContent.trim() === 'Result: 11';
    }, {}, { timeout: 7000 });

    expect((await app.getOutputText()).trim()).toBe('Result: 11');

    // Check console did not report errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console messages and page errors while interacting', async ({ page }) => {
    // This test explicitly demonstrates observation of console and page errors while exercising the UI
    const app = new InterpreterPage(page);
    await app.goto();

    // Interact: evaluate then reset
    await app.clickEvaluate();
    await page.waitForFunction(() => document.getElementById('outputWindow')?.textContent?.trim() === 'Result: 11', {}, { timeout: 5000 });
    await app.clickReset();

    // Assert that no page errors were captured during the session
    // If any of the distinct error types had occurred, they'd appear in pageErrors array
    // We assert that none occurred to ensure stable runtime (the HTML/JS are expected to be well-formed)
    expect(pageErrors.length).toBe(0);

    // Print diagnostic console messages count to help debugging if this test ever fails.
    // Note: We do not modify page environment; just assert there were no console.error entries.
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });
});