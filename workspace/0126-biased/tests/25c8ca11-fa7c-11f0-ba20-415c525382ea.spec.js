import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c8ca11-fa7c-11f0-ba20-415c525382ea.html';

/**
 * Page Object for the Deque demo page
 */
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demoButton');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickDemo() {
    await this.demoButton.click();
  }

  async getOutputText() {
    const txt = await this.output.textContent();
    return txt ?? '';
  }

  async getOutputLines() {
    const txt = await this.getOutputText();
    // normalize CRLF and split, remove any empty trailing lines
    return txt.replace(/\r/g, '').split('\n').filter(line => line.trim().length > 0);
  }

  async isDemoButtonVisible() {
    return await this.demoButton.isVisible();
  }

  async demoButtonText() {
    return await this.demoButton.textContent();
  }
}

test.describe('Deque Interactive Demo - FSM Validation and UI behavior', () => {
  // Arrays to collect console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info, log, error, warning, etc.)
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert there were no uncaught page errors.
    // This validates that loading and interacting with the page did not produce runtime errors.
    // If errors are expected in the environment, this assertion can be adapted. For this implementation
    // we assert no uncaught page errors occurred.
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Initial State (S0_Initial) validations', () => {
    test('Initial render: button exists and demo output is empty (S0_Initial entry state)', async ({ page }) => {
      // Validate the page loads and initial state matches FSM S0_Initial
      const p = new DequePage(page);
      await p.goto();

      // Button should be visible with expected label
      expect(await p.isDemoButtonVisible()).toBe(true);
      const btnText = (await p.demoButtonText())?.trim();
      expect(btnText).toBe('Show Simple Deque Operations');

      // The demo output should be empty initially, representing "Initially, the deque is empty."
      const outputText = await p.getOutputText();
      expect(outputText.trim()).toBe('');

      // Ensure no console errors were emitted during initial load
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });

  test.describe('Transitions and Demo Running (S0_Initial -> S1_DemoRunning)', () => {
    test('Clicking demo button triggers demo sequence and produces expected steps (S1_DemoRunning)', async ({ page }) => {
      // This test validates the transition ShowDemo and evidence of initializeDeque() behavior:
      // - Output contains the expected step-by-step logs
      // - Final deque state matches expected [5]
      const p = new DequePage(page);
      await p.goto();

      // Click the demo button to trigger sequence
      await p.clickDemo();

      // Wait for the demo output to be populated (it is synchronous but we await content change to be robust)
      await page.waitForFunction(() => {
        const out = document.getElementById('demo-output');
        return out && out.textContent && out.textContent.trim().length > 0;
      });

      const lines = await p.getOutputLines();

      // The implementation produces 15 log lines; assert count matches expected
      expect(lines.length).toBe(15);

      // Validate first few and last lines to confirm sequence semantics
      expect(lines[0]).toBe('Step 1: Start with empty deque: []');
      expect(lines[1]).toBe('Step 2: push_back(5)');
      expect(lines[2]).toBe('Deque now: [5]');
      expect(lines[3]).toBe('Step 3: push_front(3)');
      expect(lines[4]).toBe('Deque now: [3,5]');

      // Check removal steps present
      expect(lines).toContain('Removed element: 3');
      expect(lines).toContain('Removed element: 7');

      // Final steps: Step 7 and final deque state printed as JSON array
      expect(lines[13]).toBe('Step 7: Final deque state');
      expect(lines[14]).toBe('[5]'); // final deque should be [5]

      // Ensure no console-level errors were emitted during the demo run
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('Clicking demo button twice resets output between runs (validates resetOutput exit_action behavior)', async ({ page }) => {
      // This test validates that on each demo invocation the output is reset (demoOutput.textContent = '')
      // Behaviorally this demonstrates the FSM exit_action resetOutput() from S1_DemoRunning (if any)
      const p = new DequePage(page);
      await p.goto();

      // First run
      await p.clickDemo();
      await page.waitForFunction(() => {
        const out = document.getElementById('demo-output');
        return out && out.textContent && out.textContent.trim().length > 0;
      });
      const firstRunText = await p.getOutputText();

      // Second run - simulate user clicking again (the code resets output at start of the click handler)
      await p.clickDemo();
      await page.waitForFunction(() => {
        const out = document.getElementById('demo-output');
        return out && out.textContent && out.textContent.trim().length > 0;
      });
      const secondRunText = await p.getOutputText();

      // The output for the second run should not be the first run appended to itself.
      // Instead it should be a fresh run (equal content, not doubled).
      expect(secondRunText).toBe(firstRunText);

      // Ensure the output lines count is still the expected 15 lines after the second click
      const lines = (await p.getOutputLines());
      expect(lines.length).toBe(15);

      // No page console errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('Rapid repeated clicks produce consistent outputs and do not accumulate previous runs (edge case)', async ({ page }) => {
      // This edge-case test clicks the demo button multiple times in quick succession
      // and verifies the output remains consistent (each run resets output before producing logs).
      const p = new DequePage(page);
      await p.goto();

      // Perform several quick clicks
      await Promise.all([
        p.clickDemo(),
        p.clickDemo(),
        p.clickDemo()
      ]);

      // Wait for output to stabilize
      await page.waitForFunction(() => {
        const out = document.getElementById('demo-output');
        return out && out.textContent && out.textContent.trim().length > 0;
      });

      const lines = await p.getOutputLines();

      // The demo is synchronous and resets the output at each click. After rapid clicks,
      // we expect a single coherent run to exist in the output (15 lines).
      expect(lines.length).toBe(15);
      expect(lines[0]).toBe('Step 1: Start with empty deque: []');
      expect(lines[14]).toBe('[5]');

      // Check that there were no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Also ensure no console.error messages were emitted
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });

  test.describe('Implementation Observability & Error Monitoring', () => {
    test('Observe console output and ensure there are no JS runtime errors or ReferenceErrors', async ({ page }) => {
      // This test's goal is to explicitly observe console and page errors while interacting with the app.
      // It does not modify the runtime; it only collects and asserts on observed errors.
      const p = new DequePage(page);
      await p.goto();

      // Click to cause the demo logs to run
      await p.clickDemo();
      await page.waitForFunction(() => {
        const out = document.getElementById('demo-output');
        return out && out.textContent && out.textContent.trim().length > 0;
      });

      // Inspect collected console messages for any 'ReferenceError', 'TypeError', or 'SyntaxError' text
      const errorTextMessages = consoleMessages
        .filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text))
        .map(m => m.text);

      // Assert none of these error types appeared during the test
      expect(errorTextMessages.length).toBe(0);

      // Also assert the pageerror events array is empty (no uncaught exceptions)
      expect(pageErrors.length).toBe(0);
    });

    test('Verify that the demo output is styled and present in the DOM (visual/DOM feedback)', async ({ page }) => {
      // This test validates that the demo-output element is present and has expected CSS properties applied.
      const p = new DequePage(page);
      await p.goto();

      // The #demo-output element should exist and be visible
      const outputLocator = page.locator('#demo-output');
      await expect(outputLocator).toBeVisible();

      // It should have a min-height style as per the page CSS and white-space property preserving newlines
      const minHeight = await outputLocator.evaluate(el => window.getComputedStyle(el).getPropertyValue('min-height'));
      // normalize values like "4em" or "64px" - we accept a non-empty computed value
      expect(minHeight).toBeTruthy();

      const whiteSpace = await outputLocator.evaluate(el => window.getComputedStyle(el).getPropertyValue('white-space'));
      expect(whiteSpace).toContain('pre'); // expects 'pre-wrap' or similar

      // No runtime page errors produced by reading styles
      expect(pageErrors.length).toBe(0);
    });
  });
});