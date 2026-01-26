import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83886f1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for interacting with the demo
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemo');
    this.output = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickRun() {
    await this.runButton.click();
  }

  async isButtonDisabled() {
    return await this.runButton.evaluate((b) => b.disabled);
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  // Wait until we see a completion indicator in the demo output.
  // Completion indicators include "Final balances:", "ROLLBACK", or "COMMIT successful."
  async waitForCompletion(timeout = 7000) {
    await this.page.waitForFunction(() => {
      const out = document.getElementById('demo');
      if (!out) return false;
      const txt = out.textContent || '';
      return txt.includes('Final balances:') || txt.includes('ROLLBACK') || txt.includes('COMMIT successful.');
    }, null, { timeout });
  }

  // Wait until demo contains the given substring
  async waitForLogLine(substring, timeout = 5000) {
    await this.page.waitForFunction(s => {
      const out = document.getElementById('demo');
      if (!out) return false;
      return (out.textContent || '').includes(s);
    }, substring, { timeout });
  }
}

test.describe('Transactions demo – FSM validation and behaviors', () => {
  let pageConsoleMessages = [];
  let pageErrors = [];

  // Attach console and pageerror listeners on each test to capture runtime logs/errors
  test.beforeEach(async ({ page }) => {
    pageConsoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // collect console messages for inspection in tests
      pageConsoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // collect uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  test.describe('Initial (Idle) state', () => {
    test('renders page with Run Demo button and initial demo text', async ({ page }) => {
      const demo = new DemoPage(page);
      // Navigate to the page
      await demo.goto();

      // Validate the Run Demo button exists and is enabled (Idle state evidence)
      await expect(demo.runButton).toBeVisible();
      await expect(demo.runButton).toHaveText('Run Demo: Transfer $100 (possible crash)');
      const disabled = await demo.isButtonDisabled();
      expect(disabled).toBeFalsy();

      // Validate demo area contains initial descriptive text
      const out = await demo.getOutputText();
      expect(out).toContain('Demo output will appear here');
      // Check aria-live attribute exists (accessibility evidence)
      const ariaLive = await page.locator('#demo').getAttribute('aria-live');
      expect(ariaLive).toBe('polite');
    });
  });

  test.describe('Transaction flows and state transitions', () => {
    test('Transaction Begin -> Prepare -> Commit OR Crash (single run assertions)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Click to start the demo and immediately assert that the button becomes disabled (transaction in progress)
      await demo.clickRun();
      expect(await demo.isButtonDisabled()).toBeTruthy();

      // The demo logs "BEGIN TRANSACTION T1" (Transaction Begin state entry action)
      await demo.waitForLogLine('BEGIN TRANSACTION T1', 3000);
      let out = await demo.getOutputText();
      expect(out).toContain('BEGIN TRANSACTION T1');

      // The demo should log reading the balance
      expect(out).toMatch(/Read balance\(A\) = \$\d+/);

      // The demo logs prepare messages on the prepare path
      await demo.waitForLogLine('Prepare: deduct $100 from A (private).', 3000);
      await demo.waitForLogLine('Prepare: add $100 to B (private).', 3000);
      out = await demo.getOutputText();
      expect(out).toContain('Prepare: deduct $100 from A (private).');
      expect(out).toContain('Prepare: add $100 to B (private).');

      // Wait for completion (either crash rollback or commit path)
      await demo.waitForCompletion(8000);
      out = await demo.getOutputText();

      // Validate either crash path evidence OR commit path evidence
      const isCrash = out.includes('<<< SYSTEM CRASH BEFORE COMMIT >>>') || out.includes('Recovery: transaction not committed -> undo private changes.') || out.includes('ROLLBACK') && out.includes('Final balances: A = $500, B = $300');
      const isCommit = out.includes('Log COMMIT record to durable log (conceptual).') || out.includes('COMMIT successful.') || out.includes('Final balances: A = $400, B = $400');

      expect(isCrash || isCommit).toBeTruthy();

      // Ensure the button is re-enabled after completion
      expect(await demo.isButtonDisabled()).toBeFalsy();
    });

    test('Insufficient Funds path is not reachable with default balances (guard validation)', async ({ page }) => {
      // The page initializes accounts.A = 500 and amount = 100 so the 'INSUFFICIENT FUNDS' guard should not trigger.
      const demo = new DemoPage(page);
      await demo.goto();

      // Run the demo several times to increase confidence that insufficient funds path isn't taken
      const attempts = 3;
      for (let i = 0; i < attempts; i++) {
        await demo.clickRun();
        await demo.waitForCompletion(8000);
        const out = await demo.getOutputText();
        // Assert the insufficient funds message never appears in these runs
        expect(out).not.toContain('INSUFFICIENT FUNDS -> ROLLBACK');
      }
    });

    test('Over multiple runs observe both Crash Before Commit and Transaction Commit outcomes (stochastic coverage)', async ({ page }) => {
      // Because crashChance is random, we run multiple times and attempt to observe both outcomes.
      const demo = new DemoPage(page);
      await demo.goto();

      let sawCrash = false;
      let sawCommit = false;
      const maxAttempts = 40; // high attempt count to reduce flakiness; increases chance to see both paths
      let attempts = 0;

      while (attempts < maxAttempts && (!sawCrash || !sawCommit)) {
        attempts++;
        await demo.clickRun();
        // While running, ensure button disabled prevents concurrent runs
        expect(await demo.isButtonDisabled()).toBeTruthy();

        await demo.waitForCompletion(8000);
        const out = await demo.getOutputText();

        if (out.includes('<<< SYSTEM CRASH BEFORE COMMIT >>>') ||
            out.includes('Recovery: transaction not committed -> undo private changes.')) {
          sawCrash = true;
        }
        if (out.includes('Log COMMIT record to durable log (conceptual).') ||
            out.includes('COMMIT successful.')) {
          sawCommit = true;
        }

        // Ensure demo resets (button re-enabled) before next iteration
        expect(await demo.isButtonDisabled()).toBeFalsy();
      }

      // We expect to observe at least one commit and at least one crash across many attempts.
      // If the random seed is unfortunate this assertion could fail; however the attempt count above
      // makes that probability extremely small for practical test runs.
      expect(sawCommit).toBeTruthy();
      expect(sawCrash).toBeTruthy();
    });

    test('Clicking while demo running: second click should be ignored because button is disabled', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Start demo
      await demo.clickRun();
      expect(await demo.isButtonDisabled()).toBeTruthy();

      // Attempt a second click while disabled; should have no effect (no immediate second "BEGIN TRANSACTION" line)
      // We'll try to click (Playwright may still send click but button disabled property prevents handler); still assert no doubled logs.
      await demo.runButton.click().catch(() => { /* ignore click failure if any */ });

      // Capture output and ensure only a single BEGIN TRANSACTION line exists
      await demo.waitForLogLine('BEGIN TRANSACTION T1', 3000);
      const out = await demo.getOutputText();
      // Count occurrences of BEGIN TRANSACTION
      const beginCount = (out.match(/BEGIN TRANSACTION T1/g) || []).length;
      expect(beginCount).toBe(1);

      await demo.waitForCompletion(8000);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('no uncaught page errors (ReferenceError, SyntaxError, TypeError) should occur during navigation and interactions', async ({ page }) => {
      // Attach listeners already in beforeEach; just navigate and run a single demo
      const demo = new DemoPage(page);
      await demo.goto();

      // Start demo once to exercise script paths
      await demo.clickRun();
      await demo.waitForCompletion(8000);

      // Allow tiny delay for any asynchronous page errors to surface
      await page.waitForTimeout(250);

      // Inspect captured page errors
      // We assert that there were zero uncaught exceptions during the test execution.
      // Collect types and messages for debugging if the assertion fails.
      if (pageErrors.length > 0) {
        console.error('Captured page errors:', pageErrors.map(e => e.message || String(e)));
      }
      expect(pageErrors.length).toBe(0);

      // Inspect console messages for anything at severity 'error'
      const consoleErrors = pageConsoleMessages.filter(m => m.type === 'error');
      if (consoleErrors.length > 0) {
        console.error('Console error messages:', consoleErrors);
      }
      expect(consoleErrors.length).toBe(0);

      // Additionally ensure that normal informational logs are present (BEGIN TRANSACTION etc.)
      const infoMsgs = pageConsoleMessages.filter(m => m.type === 'log' || m.type === 'info');
      // It's acceptable if page uses DOM output instead of console logs; we just assert no runtime errors.
      expect(Array.isArray(pageConsoleMessages)).toBeTruthy();
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Helpful debug output on failure: if a test failed, print captured console messages and page errors.
    if (testInfo.status !== testInfo.expectedStatus) {
      // Note: We do not alter the page or DOM; only log diagnostics for CI output.
      if (pageConsoleMessages.length) {
        console.log('--- Captured console messages: ---');
        for (const m of pageConsoleMessages) {
          console.log(`${m.type}: ${m.text}`);
        }
      }
      if (pageErrors.length) {
        console.log('--- Captured page errors: ---');
        for (const e of pageErrors) {
          console.log(e && e.stack ? e.stack : String(e));
        }
      }
    }
  });
});