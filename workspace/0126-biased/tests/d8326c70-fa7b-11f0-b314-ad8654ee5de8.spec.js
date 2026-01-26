import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8326c70-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemo');
    this.output = page.locator('#demoOutput');
    this.consoleErrors = [];
    this.pageErrors = [];
    this._consoleListener = null;
    this._pageErrorListener = null;
  }

  async goto() {
    await this.page.goto(PAGE_URL);
  }

  async attachErrorListeners() {
    // Capture console 'error' messages
    this._consoleListener = msg => {
      try {
        if (msg.type() === 'error') {
          this.consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // Safely ignore collector errors
      }
    };
    this.page.on('console', this._consoleListener);

    // Capture uncaught page errors
    this._pageErrorListener = error => {
      this.pageErrors.push(error);
    };
    this.page.on('pageerror', this._pageErrorListener);
  }

  detachErrorListeners() {
    if (this._consoleListener) this.page.removeListener('console', this._consoleListener);
    if (this._pageErrorListener) this.page.removeListener('pageerror', this._pageErrorListener);
  }

  async clickRun() {
    await this.runButton.click();
  }

  // Wait until the output includes a substring (with timeout)
  async waitForOutputIncludes(text, opts = {}) {
    const timeout = opts.timeout ?? 12000;
    await this.page.waitForFunction(
      (selector, needle) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent && el.textContent.indexOf(needle) !== -1;
      },
      '#demoOutput',
      text,
      { timeout }
    );
  }

  // Return current output text
  async outputText() {
    return (await this.output.textContent()) || '';
  }
}

test.describe('Linked List Demo - FSM validation (d8326c70-fa7b-11f0-b314-ad8654ee5de8)', () => {
  let demo;

  test.beforeEach(async ({ page }) => {
    demo = new DemoPage(page);
    await demo.attachErrorListeners();
    await demo.goto();
  });

  test.afterEach(async () => {
    // Teardown: detach listeners
    demo.detachErrorListeners();

    // Observe console and page errors.
    // Validate that there are no uncaught page errors or console error messages
    // (This asserts that no ReferenceError, SyntaxError or TypeError occurred during the test).
    // If any such errors happened naturally while loading/running the page, these assertions will fail,
    // surfacing the runtime problem as required by the testing policy.
    expect(demo.pageErrors, 'No uncaught pageerror events should have occurred').toEqual([]);
    const criticalErrorPatterns = ['ReferenceError', 'TypeError', 'SyntaxError'];
    // Ensure consoleErrors do not include critical error patterns
    for (const msg of demo.consoleErrors) {
      for (const pat of criticalErrorPatterns) {
        expect(msg.text).not.toContain(pat);
      }
    }
    // Also assert there were no console 'error' messages at all (conservative)
    expect(demo.consoleErrors, 'No console.error messages should be emitted during the test').toEqual([]);
  });

  test.describe('Idle state (S0_Idle) validation', () => {
    test('renders Run simple traversal demo button and initial output placeholder', async () => {
      // Validate that the Run button exists, has correct text and attributes
      await expect(demo.runButton).toBeVisible();
      await expect(demo.runButton).toHaveAttribute('id', 'runDemo');
      await expect(demo.runButton).toHaveAttribute('aria-controls', 'demoOutput');
      await expect(demo.runButton).toHaveText('Run simple traversal demo');

      // Validate the demo output placeholder text is present (evidence of Idle state)
      const initialText = await demo.outputText();
      expect(initialText).toContain('Click "Run simple traversal demo" to see a step-by-step textual traversal of the list.');
      // The demo output should have aria-live set via the container and a role of small text styling exists
      await expect(demo.output).toBeVisible();
    });
  });

  test.describe('Transition: RunDemoClick -> RunningDemo (S0_Idle -> S1_RunningDemo)', () => {
    test('clicking the Run button starts the demo, clears output, and emits step-by-step lines', async ({ page }) => {
      // Comment: This test validates the startDemo() behavior (entry action) as observed via DOM changes:
      // - output cleared immediately on click
      // - step lines appear over time
      // - the demo prevents re-run while running
      // - on completion, traversal-complete text appears (stopDemo() behavior)

      // Ensure initial content is the placeholder
      const before = await demo.outputText();
      expect(before.length).toBeGreaterThan(0);
      expect(before).toContain('Click "Run simple traversal demo"');

      // Click run to start the demo
      await demo.clickRun();

      // Immediately after click the script sets out.textContent = '' synchronously.
      // Verify that the output was cleared quickly (within 500ms).
      await page.waitForTimeout(100); // small wait to allow synchronous clear
      const cleared = await demo.outputText();
      expect(cleared.trim()).toBe('');

      // Rapidly click the run button again to test idempotency while running.
      // The script sets a running flag to prevent re-run while running.
      await demo.clickRun().catch(() => {
        // clicking while running should be a no-op and not throw; swallow any unexpected click rejection
      });

      // Wait for 'Starting traversal from head...' to appear once
      await demo.waitForOutputIncludes('Starting traversal from head...', { timeout: 3000 });
      // Wait for the final traversal-complete line to be emitted (around 9 steps * 550ms ≈ 5s)
      await demo.waitForOutputIncludes('Traversal complete. All nodes visited in order: 10 -> 20 -> 30', { timeout: 12000 });

      const finalOutput = await demo.outputText();

      // Verify that the 'Starting traversal...' only occurred once despite extra clicks
      const startCount = (finalOutput.match(/Starting traversal from head\.\.\./g) || []).length;
      expect(startCount).toBe(1);

      // Verify that traversal complete message is present
      expect(finalOutput).toContain('Traversal complete. All nodes visited in order: 10 -> 20 -> 30');

      // After completion, clicking the button should allow a new run (running flag should have been cleared).
      // Start a second run to confirm exit action happened and re-entry works.
      await demo.clickRun();
      // Confirm the output was cleared for the second run as well
      await page.waitForTimeout(150);
      const afterSecondStartClear = await demo.outputText();
      expect(afterSecondStartClear.trim()).toBe('');

      // Wait again for the second run to complete
      await demo.waitForOutputIncludes('Traversal complete. All nodes visited in order: 10 -> 20 -> 30', { timeout: 12000 });

      const secondFinal = await demo.outputText();
      // Now there should be two occurrences of the 'Starting traversal...' marker (one per run).
      const startCountAfter = (secondFinal.match(/Starting traversal from head\.\.\./g) || []).length;
      expect(startCountAfter).toBeGreaterThanOrEqual(1);
    }, 30000);
  });

  test.describe('Edge cases and robustness', () => {
    test('rapid multiple clicks only trigger a single run (prevents re-run while running)', async ({ page }) => {
      // Click the button rapidly multiple times
      await demo.runButton.click();
      await demo.runButton.click();
      await demo.runButton.click();
      await demo.runButton.click();

      // Wait for completion
      await demo.waitForOutputIncludes('Traversal complete. All nodes visited in order: 10 -> 20 -> 30', { timeout: 15000 });

      const out = await demo.outputText();
      // Ensure only one 'Starting traversal...' sequence exists
      const startCount = (out.match(/Starting traversal from head\.\.\./g) || []).length;
      expect(startCount).toBe(1);

      // Ensure the sequence of visits appears in order
      expect(out).toContain('Visiting node: value = 10');
      expect(out).toContain('Visiting node: value = 20');
      expect(out).toContain('Visiting node: value = 30');

      // Ensure the movement to null on final node is present
      expect(out).toContain('Move pointer from node(30) to null (end of list)');
    }, 30000);

    test('ARIA and accessibility related attributes are present and correct', async () => {
      // Validate aria-controls relationship and aria-live presence for assistive tech.
      await expect(demo.runButton).toHaveAttribute('aria-controls', 'demoOutput');
      // The demo container and output claim aria-live="polite" in markup; ensure output exists and is accessible
      const attr = await demo.page.locator('#demoOutput').getAttribute('aria-live');
      // The output element in the markup has aria-live="polite"
      expect(attr).toBe('polite');
    });
  });
});