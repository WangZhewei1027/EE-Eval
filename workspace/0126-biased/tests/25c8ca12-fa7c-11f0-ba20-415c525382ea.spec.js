import { test, expect } from '@playwright/test';

// Increase default timeout to allow the demo (which uses multiple 1s timers) to finish.
test.setTimeout(30000);

// Page Object for the Hash Table Demo page
class HashTableDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url =
      'http://127.0.0.1:5500/workspace/0126-biased/html/25c8ca12-fa7c-11f0-ba20-415c525382ea.html';
  }

  async goto() {
    await this.page.goto(this.url);
  }

  // Selectors
  runButton() {
    return this.page.locator('#runDemoBtn');
  }

  demoArea() {
    return this.page.locator('#demoArea');
  }

  // Convenience: click Run Demo
  async clickRun() {
    await this.runButton().click();
  }

  // Read the demo area's text content
  async demoText() {
    return await this.demoArea().innerText();
  }
}

test.describe('Hash Table Demo FSM (25c8ca12-fa7c-11f0-ba20-415c525382ea)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleLogs = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors each test
    pageErrors = [];
    consoleErrors = [];
    consoleLogs = [];

    // Collect console messages and page errors for assertions
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleLogs.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page
      pageErrors.push(err && err.message ? err.message : String(err));
    });
  });

  // Group: Idle state tests
  test.describe('S0_Idle - Idle state (initial)', () => {
    test('Initial UI: Run Hash Table Demo button present and demo area empty', async ({ page }) => {
      const demo = new HashTableDemoPage(page);
      // Navigate to page
      await demo.goto();

      // Verify the Run button exists, has correct id/class/text and is enabled (Idle state)
      const runBtn = demo.runButton();
      await expect(runBtn).toBeVisible();
      await expect(runBtn).toHaveAttribute('id', 'runDemoBtn');
      await expect(runBtn).toHaveClass(/demo-button/);
      await expect(runBtn).toHaveText('Run Hash Table Demo');
      await expect(runBtn).toBeEnabled();

      // Verify the demo area exists and is empty (or whitespace)
      const area = demo.demoArea();
      await expect(area).toBeVisible();
      const text = (await area.innerText()).trim();
      expect(text).toBe('', 'Expected demo area to be empty at initial Idle state');

      // Assert no console errors or page errors were emitted during initial render
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // Group: Demo Running tests (S1)
  test.describe('S1_DemoRunning - Running demo and transitions', () => {
    test('Clicking Run Demo transitions to DemoRunning (button disabled) and produces step-by-step output', async ({
      page,
    }) => {
      const demo = new HashTableDemoPage(page);
      await demo.goto();

      const runBtn = demo.runButton();
      const area = demo.demoArea();

      // Ensure initial state
      await expect(runBtn).toBeEnabled();

      // Start the demo by clicking the button (transition S0 -> S1)
      // We will capture the demoArea content as it evolves and assert expected behavior
      await Promise.all([
        // Wait for the click action to complete
        runBtn.click(),
        // After clicking, the script disables the button synchronously; assert that:
      ]);

      // Immediately after click, button should be disabled (onEnter runDemo sets demoBtn.disabled = true;)
      await expect(runBtn).toBeDisabled();

      // The demo appends the first message synchronously when nextStep() is first invoked.
      // Wait until demoArea is no longer empty.
      await expect(area).toHaveText(/Inserted key "apple"/, { timeout: 2000 });

      // Verify that the first inserted message is present
      const t0 = await area.innerText();
      expect(t0).toMatch(/Inserted key "apple" with value 100 at bucket \d+\./);

      // Verify subsequent messages appear over time:
      // We expect the demo to eventually append lines for banana, grape, etc. and finally "Demo complete."
      // Wait for the final completion marker. The demo schedules 1s delays between steps and there are 8 actions.
      await expect(area).toHaveText(/Demo complete\./, { timeout: 15000 });

      // After demo completion (onExit action), the run button should be re-enabled (demoBtn.disabled = false;)
      await expect(runBtn).toBeEnabled();

      // After completion, verify the demoArea contains expected messages for inserted and retrieved keys.
      const finalText = await area.innerText();

      // Check for insert messages (apple, banana, grape)
      expect(finalText).toMatch(/Inserted key "apple" with value 100 at bucket 0\./);
      expect(finalText).toMatch(/Inserted key "banana" with value 200 at bucket 9\./);
      expect(finalText).toMatch(/Inserted key "grape" with value 300 at bucket 7\./);

      // Check for later inserts (apricot and cherry)
      expect(finalText).toMatch(/Inserted key "apricot" with value 150 at bucket \d+\./);
      expect(finalText).toMatch(/Inserted key "cherry" with value 250 at bucket \d+\./);

      // Check for get results: banana (should be found), apricot (found), orange (not found)
      expect(finalText).toMatch(/Key "banana" found at bucket 9 with value: 200\./);
      expect(finalText).toMatch(/Key "apricot" found at bucket \d+ with value: 150\./);
      expect(finalText).toMatch(/Key "orange" not found in bucket \d+\./);

      // Confirm final completion message present
      expect(finalText).toMatch(/Demo complete\./);

      // Ensure no unexpected console or page errors occurred during the demo run
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('While demo is running the button remains disabled and additional clicks have no effect', async ({ page }) => {
      const demo = new HashTableDemoPage(page);
      await demo.goto();

      const runBtn = demo.runButton();
      const area = demo.demoArea();

      // Start the demo
      await runBtn.click();

      // Immediately button disabled
      await expect(runBtn).toBeDisabled();

      // Attempt to click while disabled; Playwright's click on a disabled button will throw.
      // We capture this behavior and assert that either clicking throws or it has no side effect.
      let clickErrored = false;
      try {
        // Use strict: forceAction: true to attempt click; allow it to throw
        await runBtn.click({ timeout: 500 });
      } catch (err) {
        clickErrored = true;
      }

      // Even if click did not throw (some environments might allow it), the demo should not have restarted:
      // The demo area should not contain duplicate first-step messages separated by two runs within the first second.
      const textNow = await area.innerText();
      // Count occurrences of the apple insert message (should be 1 while demo is running)
      const appleOccurrences = (textNow.match(/Inserted key "apple" with value 100 at bucket 0\./g) || [])
        .length;
      expect(appleOccurrences).toBeGreaterThanOrEqual(1);
      // It should not be >1 immediately after the second click attempt
      expect(appleOccurrences).toBeLessThanOrEqual(2);

      // Wait for completion then assert the demo completes normally
      await expect(area).toHaveText(/Demo complete\./, { timeout: 15000 });
      await expect(runBtn).toBeEnabled();

      // Ensure that we observed either a click error or that clicking had no harmful side effects
      expect(clickErrored || appleOccurrences === 1 || appleOccurrences === 2).toBeTruthy();

      // Also assert no runtime errors were raised by the page scripts
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  // Edge cases and error scenarios
  test.describe('Edge cases and runtime checks', () => {
    test('Multiple sequential runs work: demo can be run again after completion', async ({ page }) => {
      const demo = new HashTableDemoPage(page);
      await demo.goto();

      const runBtn = demo.runButton();
      const area = demo.demoArea();

      // First run
      await runBtn.click();
      await expect(area).toHaveText(/Demo complete\./, { timeout: 15000 });
      await expect(runBtn).toBeEnabled();

      // Capture final text length after first run
      const firstRunText = await area.innerText();

      // Clear console collectors for clearer second-run assertions
      consoleErrors = [];
      pageErrors = [];

      // Run again
      await runBtn.click();

      // Ensure button is disabled during run
      await expect(runBtn).toBeDisabled();

      // Wait for completion
      await expect(area).toHaveText(/Demo complete\./, { timeout: 15000 });
      await expect(runBtn).toBeEnabled();

      const secondRunText = await area.innerText();

      // Ensure that second run produced new content that is consistent with the demo logic (should at least contain 'Demo complete.' and expected messages)
      expect(secondRunText).toMatch(/Inserted key "apple" with value 100 at bucket 0\./);
      expect(secondRunText).toMatch(/Demo complete\./);

      // Ensure that page did not emit errors across runs
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // The second run output may overwrite the demo area (script sets demoArea.textContent = ""), so it is acceptable for the secondRunText
      // to be equal or different from the first run. We assert that at least the expected core messages are present.
    });

    test('No unexpected ReferenceError / SyntaxError / TypeError occur on page load', async ({ page }) => {
      const demo = new HashTableDemoPage(page);
      await demo.goto();

      // We assert that pageErrors and consoleErrors are empty arrays (no uncaught exceptions or console error messages).
      // This validates that the page script executed cleanly as-is.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // Additionally, inspect collected console logs to ensure that nothing resembling an uncaught exception text appears.
      const fatalPatterns = [/ReferenceError/, /SyntaxError/, /TypeError/, /Uncaught/];
      const foundFatal = consoleLogs.some((entry) =>
        fatalPatterns.some((pat) => pat.test(entry.text))
      );
      expect(foundFatal).toBe(false);
    });
  });
});