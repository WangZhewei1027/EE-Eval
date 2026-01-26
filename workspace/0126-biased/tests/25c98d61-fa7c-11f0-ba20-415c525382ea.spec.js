import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c98d61-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the Trie Demo page
class TrieDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#run-demo');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRunDemo() {
    await this.button.click();
  }

  async getButtonText() {
    return (await this.button.textContent()) || '';
  }

  async isButtonDisabled() {
    return await this.button.isDisabled();
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async waitForOutputNonEmpty(timeout = 3000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.textContent && el.textContent.length > 0;
    }, null, { timeout });
  }
}

test.describe('Trie Demo FSM and UI Tests (Application ID: 25c98d61-fa7c-11f0-ba20-415c525382ea)', () => {
  let page;
  let triePage;
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // New context & page per test to isolate console/pageerror listeners
    const context = await browser.newContext();
    page = await context.newPage();
    triePage = new TrieDemoPage(page);

    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (text + type)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await triePage.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('Initial render shows Run Trie Demo button enabled and output area present', async () => {
      // Validate presence and initial state indicators of S0_Idle
      const btnText = await triePage.getButtonText();
      expect(btnText.trim()).toBe('Run Trie Demo'); // evidence: <button id="run-demo">Run Trie Demo</button>
      expect(await triePage.isButtonDisabled()).toBe(false); // should be enabled initially

      // pre#demo-output exists and has required ARIA attributes
      const outputEl = page.locator('#demo-output');
      await expect(outputEl).toBeVisible();
      await expect(outputEl).toHaveAttribute('aria-live', 'polite');
      await expect(outputEl).toHaveAttribute('aria-atomic', 'true');

      // Initially the output should be empty
      const initialOutput = await triePage.getOutputText();
      expect(initialOutput.trim()).toBe('');

      // Ensure no runtime page errors happened during initial load
      expect(pageErrors.length).toBe(0);
      // No console errors expected on initial render
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.text.includes('ReferenceError') || m.text.includes('TypeError') || m.text.includes('SyntaxError'));
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: S0_Idle -> S1_DemoRunning (RunDemoClick)', () => {
    test('Clicking Run Demo immediately disables button and changes text to "Running demo..."', async () => {
      // Click the run demo button and assert immediate S1_DemoRunning evidence
      await triePage.clickRunDemo();

      // Immediately after clicking, the button should be disabled and show 'Running demo...'
      // These are synchronous changes in the click handler, so no wait needed.
      expect(await triePage.isButtonDisabled()).toBe(true); // evidence: btn.disabled = true;
      const runningText = await triePage.getButtonText();
      expect(runningText.trim()).toBe('Running demo...'); // evidence: btn.textContent = 'Running demo...';

      // Also ensure still no page errors raised at this point
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.text.includes('ReferenceError') || m.text.includes('TypeError') || m.text.includes('SyntaxError'));
      expect(consoleErrors.length).toBe(0);
    });

    test('Rapid double click does not produce duplicate demo runs (button becomes disabled immediately)', async () => {
      // Attempt to click twice in rapid succession.
      // Because the click handler synchronously disables the button,
      // the second click should not trigger a separate run.
      await triePage.clickRunDemo();

      // Try to click again - but since button is disabled, Playwright will throw if attempt to click a disabled element.
      // Instead, attempt to dispatch a click via JS to simulate a noisy user (but we must NOT inject/modify functions).
      // We will attempt to click via locator which will fail while disabled — capture that behavior.
      let secondClickFailed = false;
      try {
        await triePage.clickRunDemo(); // this is expected to throw because button is disabled
      } catch (e) {
        secondClickFailed = true;
      }
      expect(secondClickFailed).toBe(true);

      // Wait for demo to finish
      await triePage.waitForOutputNonEmpty(2000);

      const output = await triePage.getOutputText();
      // Count "Inserted" occurrences to ensure only one run took place (should be 4 inserted words)
      const insertedMatches = (output.match(/Inserted "/g) || []).length;
      expect(insertedMatches).toBe(4);

      // After completion, button should have returned to original state
      expect(await triePage.isButtonDisabled()).toBe(false);
      expect((await triePage.getButtonText()).trim()).toBe('Run Trie Demo');

      // No page errors expected
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.text.includes('ReferenceError') || m.text.includes('TypeError') || m.text.includes('SyntaxError'));
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: S1_DemoRunning -> S2_DemoCompleted (Demo completes and output set)', () => {
    test('Demo completes and outputEl.textContent is populated with expected log lines; button restored', async () => {
      // Start demo
      await triePage.clickRunDemo();

      // Confirm S1 immediate evidence
      expect(await triePage.isButtonDisabled()).toBe(true);
      expect((await triePage.getButtonText()).trim()).toBe('Running demo...');

      // Wait for the async demo to complete (the page uses setTimeout 100ms before demo runs)
      await triePage.waitForOutputNonEmpty(2000);

      // Validate S2 evidence: outputEl.textContent = log;
      const output = await triePage.getOutputText();
      expect(output).toContain('--- Trie Demonstration ---');
      expect(output).toContain('Inserting words: car, cat, dog, deal');

      // Validate that insertion lines for each word exist
      expect(output).toContain('Inserted "car"');
      expect(output).toContain('Inserted "cat"');
      expect(output).toContain('Inserted "dog"');
      expect(output).toContain('Inserted "deal"');

      // Validate search results are present and correct as per demo logic
      expect(output).toContain('Search for word "cat": Found');
      expect(output).toContain('Search for word "car": Found');
      expect(output).toContain('Search for word "cap": Not Found');
      expect(output).toContain('Search for word "dog": Found');
      expect(output).toContain('Search for word "de": Not Found'); // because 'de' was not marked as end of word
      expect(output).toContain('Search for word "deal": Found');

      // Validate prefix checks
      expect(output).toContain('Starts with prefix "ca": Yes');
      expect(output).toContain('Starts with prefix "do": Yes');
      expect(output).toContain('Starts with prefix "de": Yes');
      expect(output).toContain('Starts with prefix "fa": No');

      // After demo completes, button should be restored to initial text and enabled
      expect(await triePage.isButtonDisabled()).toBe(false);
      expect((await triePage.getButtonText()).trim()).toBe('Run Trie Demo');

      // Check that the output element indeed contains the entire log (no empty)
      expect(output.trim().length).toBeGreaterThan(0);

      // Ensure no runtime page errors occurred
      expect(pageErrors.length).toBe(0);

      // Collect console errors if any and assert none of the critical JS errors occurred
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.text.includes('ReferenceError') || m.text.includes('TypeError') || m.text.includes('SyntaxError'));
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenario observations', () => {
    test('Clicking after completion starts a new demo run and app remains stable', async () => {
      // First run
      await triePage.clickRunDemo();
      await triePage.waitForOutputNonEmpty(2000);
      const output1 = await triePage.getOutputText();

      // Start a second run
      await triePage.clickRunDemo();
      // Immediately should be in running state
      expect(await triePage.isButtonDisabled()).toBe(true);
      expect((await triePage.getButtonText()).trim()).toBe('Running demo...');

      await triePage.waitForOutputNonEmpty(2000);
      const output2 = await triePage.getOutputText();

      // The second run appends new log text replacing outputEl.textContent = log; (in this implementation, log is overwritten)
      // So after second run, output should still contain the expected markers
      expect(output2).toContain('--- Trie Demonstration ---');
      expect(output2).toContain('Inserted "car"');

      // Ensure demo completed and button restored
      expect(await triePage.isButtonDisabled()).toBe(false);
      expect((await triePage.getButtonText()).trim()).toBe('Run Trie Demo');

      // Ensure no page errors recorded across interactions
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.text.includes('ReferenceError') || m.text.includes('TypeError') || m.text.includes('SyntaxError'));
      expect(consoleErrors.length).toBe(0);
    });

    test('No unexpected ReferenceError/TypeError/SyntaxError in console or page errors during interactions', async () => {
      // Run the demo to exercise code paths
      await triePage.clickRunDemo();
      await triePage.waitForOutputNonEmpty(2000);

      // Inspect captured console messages for explicit mentions of common JS errors
      const errorLikeMessages = consoleMessages.filter(m =>
        m.text.includes('ReferenceError') ||
        m.text.includes('TypeError') ||
        m.text.includes('SyntaxError') ||
        m.type === 'error'
      );

      // Assert that the page did not produce any explicit JS runtime exceptions
      // (This test validates that the page runs without throwing the critical errors listed)
      expect(errorLikeMessages.length).toBe(0, `Found unexpected console errors: ${JSON.stringify(errorLikeMessages, null, 2)}`);

      // Also assert that page 'pageerror' events weren't emitted
      expect(pageErrors.length).toBe(0);
    });
  });
});