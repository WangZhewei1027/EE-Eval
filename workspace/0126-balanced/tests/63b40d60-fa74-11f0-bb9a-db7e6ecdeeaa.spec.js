import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b40d60-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.jsButton = '#run-js-demo';
    this.tcButton = '#run-typecheck-demo';
    this.jsOutput = '#js-output';
    this.tcOutput = '#tc-output';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickRunJs() {
    await this.page.click(this.jsButton);
  }

  async clickRunTypeChecker() {
    await this.page.click(this.tcButton);
  }

  async getJsOutputText() {
    return (await this.page.locator(this.jsOutput).innerText()).trim();
  }

  async getTcOutputText() {
    return (await this.page.locator(this.tcOutput).innerText()).trim();
  }

  // Utility to prefill outputs to validate clearing behavior
  async setJsOutputText(text) {
    await this.page.evaluate((sel, t) => {
      document.querySelector(sel).textContent = t;
    }, this.jsOutput, text);
  }

  async setTcOutputText(text) {
    await this.page.evaluate((sel, t) => {
      document.querySelector(sel).textContent = t;
    }, this.tcOutput, text);
  }

  // Wait helper for output containing substring
  async waitForJsOutputContains(substring, opts = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (sel, sub) => document.querySelector(sel).textContent.includes(sub),
      { timeout: opts.timeout },
      this.jsOutput,
      substring
    );
  }

  async waitForTcOutputContains(substring, opts = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (sel, sub) => document.querySelector(sel).textContent.includes(sub),
      { timeout: opts.timeout },
      this.tcOutput,
      substring
    );
  }
}

test.describe('Type System Demonstration - FSM driven tests', () => {
  // Collect console messages and page errors for each test to assert on them
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect page errors (uncaught exceptions) that bubble up to the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages, keeping track of error-level logs
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });
  });

  test.describe('Initial state (S0_Idle) verification', () => {
    test('should render page with expected controls and empty outputs', async ({ page }) => {
      const demo = new DemoPage(page);
      // Navigate to the page
      await demo.goto();

      // Verify buttons exist and are visible
      await expect(page.locator(demo.jsButton)).toBeVisible();
      await expect(page.locator(demo.tcButton)).toBeVisible();

      // Verify output containers exist and are empty initially
      await expect(page.locator(demo.jsOutput)).toBeVisible();
      await expect(page.locator(demo.tcOutput)).toBeVisible();
      const jsText = await demo.getJsOutputText();
      const tcText = await demo.getTcOutputText();

      // Entry action renderPage() is implicit in loading HTML; assert outputs empty
      expect(jsText).toBe('');
      expect(tcText).toBe('');

      // Assert no uncaught page errors or console errors happened during initial render
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('JavaScript Demo Running (S1_JavaScriptDemoRunning) and transitions', () => {
    test('clicking Run Demo Code clears js-output and produces expected demonstration output', async ({ page }) => {
      const demo1 = new DemoPage(page);
      await demo.goto();

      // Prefill js-output to ensure clearOutput('js-output') happens on entry to S1
      await demo.setJsOutputText('PREVIOUS OUTPUT'); // ensures clearing is tested

      // Click the JS demo button (trigger event RunJavaScriptDemo)
      await demo.clickRunJs();

      // Wait for an expected piece of output that indicates the demo ran
      await demo.waitForJsOutputContains('Initial value:', { timeout: 2000 });

      const out = await demo.getJsOutputText();

      // Validate that previous content was cleared (should not include PREVIOUS OUTPUT)
      expect(out).not.toContain('PREVIOUS OUTPUT');

      // Validate key lines from the JS demo were output
      expect(out).toContain('Initial value: 42 (type)');
      expect(out).toContain('After reassignment: hello (type)');
      // The demo logs 2 + "3" = "23" but output formatting uses JS join logic -> check for 23
      expect(out).toContain('2 + "3" = 23');
      expect(out).toContain('0 == false: true');
      expect(out).toContain('0 === false: false');

      // Ensure no uncaught page errors or console error-level logs occurred during the demo click
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('clicking Run Demo Code multiple times resets and re-runs the demo', async ({ page }) => {
      const demo2 = new DemoPage(page);
      await demo.goto();

      // First run
      await demo.clickRunJs();
      await demo.waitForJsOutputContains('Initial value:', { timeout: 2000 });
      const first = await demo.getJsOutputText();
      expect(first).toContain('Initial value: 42');

      // Second run should clear and re-produce same content (no duplication)
      await demo.clickRunJs();
      await demo.waitForJsOutputContains('Initial value:', { timeout: 2000 });
      const second = await demo.getJsOutputText();
      expect(second).toContain('Initial value: 42');
      // Ensure outputs are not appended but replaced (the output should be consistent, not contain two "Initial value")
      const occurrences = (second.match(/Initial value:/g) || []).length;
      expect(occurrences).toBe(1);

      // No page errors expected
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Type Checker Demo Running (S2_TypeCheckerDemoRunning) and transitions', () => {
    test('clicking Run Type Checker Demo clears tc-output and shows type checking and errors for invalid expr', async ({ page }) => {
      const demo3 = new DemoPage(page);
      await demo.goto();

      // Prefill tc-output to ensure clearOutput('tc-output') happens
      await demo.setTcOutputText('OLD_TC_OUTPUT');

      // Click the type checker demo button
      await demo.clickRunTypeChecker();

      // Wait for output indicating the expression was type-checked
      await demo.waitForTcOutputContains('Expression type:', { timeout: 2000 });

      const out1 = await demo.getTcOutputText();

      // Ensure previous content was cleared
      expect(out).not.toContain('OLD_TC_OUTPUT');

      // Validate that the valid expression was reported and evaluation result printed
      expect(out).toContain('Expression type: number');
      expect(out).toContain('Evaluation result:');

      // Validate that the invalid expression produced a TypeError message as handled by the code
      expect(out).toMatch(/TypeError: '\+' requires number \+ number|TypeError: '\+' requires number \+ number, got/);
      // The implementation appends a message like:
      // "TypeError: '+' requires number + number, got boolean + number"
      expect(out).toContain("TypeError");

      // No uncaught page errors should be present because errors are handled in try/catch blocks
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('clicking Run Type Checker Demo multiple times resets output and reproduces messages', async ({ page }) => {
      const demo4 = new DemoPage(page);
      await demo.goto();

      // Run once
      await demo.clickRunTypeChecker();
      await demo.waitForTcOutputContains('Expression type:', { timeout: 2000 });
      const first1 = await demo.getTcOutputText();
      expect(first).toContain('Expression type: number');

      // Run again and validate there is only one set of messages (not appended duplicates)
      await demo.clickRunTypeChecker();
      await demo.waitForTcOutputContains('Expression type:', { timeout: 2000 });
      const second1 = await demo.getTcOutputText();
      const occurrences1 = (second.match(/Expression type:/g) || []).length;
      expect(occurrences).toBe(1);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error observation', () => {
    test('no unexpected uncaught ReferenceError/SyntaxError/TypeError occur during normal interactions', async ({ page }) => {
      const demo5 = new DemoPage(page);
      await demo.goto();

      // Interact with both demos
      await demo.clickRunJs();
      await demo.waitForJsOutputContains('Initial value:', { timeout: 2000 });

      await demo.clickRunTypeChecker();
      await demo.waitForTcOutputContains('Expression type:', { timeout: 2000 });

      // At this point, the page's code handles its own errors internally; assert that no uncaught errors bubbled up
      // We log any page.error or console.error events into arrays in beforeEach
      expect(pageErrors.length).toBe(0, `Expected no uncaught page errors but found: ${pageErrors.map(e=>String(e)).join('; ')}`);
      expect(consoleErrors.length).toBe(0, `Expected no console.error messages but found: ${JSON.stringify(consoleErrors)}`);
    });

    test('verify that clicking buttons does not throw unhandled exceptions (monitoring console and page errors)', async ({ page }) => {
      const demo6 = new DemoPage(page);
      await demo.goto();

      // Attempt multiple interactions
      for (let i = 0; i < 3; i++) {
        await demo.clickRunJs();
        await demo.waitForJsOutputContains('Initial value:', { timeout: 2000 });
        await demo.clickRunTypeChecker();
        await demo.waitForTcOutputContains('Expression type:', { timeout: 2000 });
      }

      // After repeated interactions, assert again that no uncaught errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});