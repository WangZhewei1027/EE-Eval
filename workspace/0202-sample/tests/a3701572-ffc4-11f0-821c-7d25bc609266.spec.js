import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3701572-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the Deque Demo page
class DequeDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  runButton() {
    return this.page.locator('#run-demo');
  }

  output() {
    return this.page.locator('#demo-output');
  }

  // Click the Run Demo button (normal user interaction)
  async clickRunDemo() {
    await this.page.click('#run-demo');
  }

  async getOutputText() {
    return (await this.output().innerText()).trim();
  }

  async getOutputLines() {
    const text = await this.getOutputText();
    // split by newline and filter empty lines
    return text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  }

  async isRunButtonDisabled() {
    return await this.runButton().evaluate((btn) => btn.disabled);
  }
}

test.describe('Deque Demo FSM (a3701572-ffc4-11f0-821c-7d25bc609266)', () => {
  // Collect console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore any unexpected console parsing errors
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial State: S0_Initial', () => {
    test('renders the page with expected elements and initial state', async ({ page }) => {
      // This test validates the S0_Initial state: page is rendered and the Run Deque Demo button exists.
      const demo = new DequeDemoPage(page);
      await demo.goto();

      // Verify main heading exists and describes the app (evidence of page render)
      const heading = page.locator('h1');
      await expect(heading).toHaveText(/Understanding Deque/i);

      // Verify Run Deque Demo button exists and is enabled
      const runButton = demo.runButton();
      await expect(runButton).toBeVisible();
      await expect(runButton).toBeEnabled();

      // The demo output container should be present and initially empty
      const output = demo.output();
      await expect(output).toBeVisible();
      const text = await output.innerText();
      expect(text.trim()).toBe('', 'Demo output should be empty before running the demo');

      // Ensure no uncaught page errors occurred during initial render
      expect(pageErrors.length).toBe(0);
      // Also assert no console errors were logged
      const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(consoleErrorCount).toBe(0);
    });
  });

  test.describe('Run Demo and Transitions: S0 -> S1 -> S2', () => {
    test('clicking Run Deque Demo executes the demo, logs expected output, and toggles button disabled state', async ({ page }) => {
      // This test validates:
      // - The transition from S0_Initial to S1_DemoRunning when the Run button is clicked
      // - The demo produces expected textual output (start header, operations, full error, final state, end header)
      // - The button is disabled during the demo call and re-enabled afterward
      const demo = new DequeDemoPage(page);
      await demo.goto();

      // Prepare: ensure no prior output
      await expect(demo.output()).toHaveText('');

      // Click the Run Demo button
      // Immediately after the click handler runs, the button should be disabled (handler sets disabled = true)
      await demo.clickRunDemo();

      // After click, verify the button is disabled (S1_DemoRunning entry side-effect)
      // Use the page object helper to check disabled
      const disabledImmediately = await demo.isRunButtonDisabled();
      expect(disabledImmediately).toBe(true);

      // Wait a short while to allow demo to complete and the re-enable timeout to fire (200ms in implementation).
      // Use a slightly larger timeout to avoid flakiness.
      await page.waitForTimeout(350);

      // After the timeout, the button should be re-enabled
      const disabledAfter = await demo.isRunButtonDisabled();
      expect(disabledAfter).toBe(false);

      // Now inspect the output contents
      const outputText = await demo.getOutputText();
      expect(outputText.length).toBeGreaterThan(0, 'Demo output should contain log lines after running demo');

      // The demo should include the start and end headers per FSM evidence
      expect(outputText).toContain('=== Deque Demonstration (Array-based with capacity 5) ===');
      expect(outputText).toContain('=== End of Demonstration ===');

      // The demo should report attempts and results of push/pop operations including the "full deque" error line
      expect(outputText).toContain('push_back(10): Front=0, Rear=1, Size=1');
      expect(outputText).toContain('push_back(20): Front=0, Rear=2, Size=2');
      expect(outputText).toContain('push_front(5): Front=4, Rear=2, Size=3');
      expect(outputText).toContain('push_back(30): Front=4, Rear=3, Size=4');
      expect(outputText).toContain('push_front(2): Front=3, Rear=3, Size=5');

      // Edge case: pushing into a full deque should log an error message
      expect(outputText).toContain('Error: Deque is full. Cannot push_back(40).');

      // Confirm pop operations reported
      expect(outputText).toMatch(/pop_front\(\) => 2: Front=4, Rear=3, Size=4/);
      expect(outputText).toMatch(/pop_back\(\) => 30: Front=4, Rear=2, Size=3/);

      // Final Deque State should include the expected contents derived from the demo's sequence:
      // Final deque contents expected: [1, 10, 20]
      expect(outputText).toContain('Final Deque State:');
      expect(outputText).toContain('Deque contents (front→back): [1, 10, 20]');

      // Ensure no uncaught page errors occurred during the demo run
      expect(pageErrors.length).toBe(0);

      // Also ensure no console.error messages were produced
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('disabled Run button blocks additional clicks while demo is running', async ({ page }) => {
      // This test asserts that the click handler sets the button disabled and prevents user from triggering the demo again until re-enabled.
      // It does not attempt to patch or override page code, only interacts naturally.
      const demo = new DequeDemoPage(page);
      await demo.goto();

      // Start the demo (this will set disabled = true at the start)
      await demo.clickRunDemo();

      // Immediately the button should be disabled
      await expect(demo.runButton()).toBeDisabled();

      // Attempt to click while disabled; Playwright will normally throw if the element is not enabled.
      // We assert that clicking while disabled is not allowed by expecting an error if we try a normal click.
      let clickThrew = false;
      try {
        await demo.clickRunDemo();
      } catch (e) {
        clickThrew = true;
      }
      // The second click should either throw or simply be ignored; we expect it to throw because the element is disabled.
      expect(clickThrew).toBe(true);

      // Allow demo to finish and button to re-enable
      await page.waitForTimeout(350);
      await expect(demo.runButton()).toBeEnabled();
    });
  });

  test.describe('Error handling and edge cases', () => {
    test('demo logs specific error messages for invalid operations (underflow/full)', async ({ page }) => {
      // The provided demo includes a test of full deque push which should log an error.
      // This test focuses on ensuring those error messages are present in the demo output.
      const demo = new DequeDemoPage(page);
      await demo.goto();

      await demo.clickRunDemo();
      await page.waitForTimeout(350);

      const lines = await demo.getOutputLines();

      // Check that an explicit "Error: Deque is full. Cannot push_back(40)." line exists
      const hasFullError = lines.some(l => l.includes('Error: Deque is full. Cannot push_back(40).'));
      expect(hasFullError).toBe(true);

      // The demo's pop methods do not attempt to pop from an empty deque in this script, thus no underflow error is expected.
      // Confirm there's no "underflow" or "Cannot pop" messages in the output
      const hasUnderflow = lines.some(l => /underflow/i.test(l) || /Cannot pop/i.test(l));
      expect(hasUnderflow).toBe(false);

      // No runtime errors should have appeared on the page
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM state coverage and evidence assertions', () => {
    test('verifies FSM evidence lines exist in output corresponding to states S1 and S2', async ({ page }) => {
      // This test verifies the presence of evidence strings from the FSM definition:
      // - S1: "=== Deque Demonstration (Array-based with capacity 5) ==="
      // - S2: "=== End of Demonstration ==="
      const demo = new DequeDemoPage(page);
      await demo.goto();

      await demo.clickRunDemo();
      await page.waitForTimeout(350);

      const out = await demo.getOutputText();
      expect(out).toContain('=== Deque Demonstration (Array-based with capacity 5) ===');
      expect(out).toContain('=== End of Demonstration ===');

      // Also ensure that the demo run produced multiple lines (evidence of runDemo() doing work)
      const lines = out.split('\n').map(s => s.trim()).filter(Boolean);
      expect(lines.length).toBeGreaterThan(5);
    });
  });
});