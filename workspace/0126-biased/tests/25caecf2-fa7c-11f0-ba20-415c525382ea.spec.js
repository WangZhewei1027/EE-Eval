import { test, expect } from '@playwright/test';

// Test file for Application ID: 25caecf2-fa7c-11f0-ba20-415c525382ea
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/25caecf2-fa7c-11f0-ba20-415c525382ea.html
//
// Notes:
// - Tests load the page as-is and do NOT modify page globals or patch runtime.
// - Console messages and page errors are observed and asserted (we assert there are no unexpected errors).
// - Tests validate the FSM states: S0_Idle (initial UI), S1_Computing (after clicking the compute button).
// - Tests validate the transition triggered by clicking #computeFibBtn and verify output in #fib-output.

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/25caecf2-fa7c-11f0-ba20-415c525382ea.html';

// Simple helper to compute expected Fibonacci sequence (used only in test assertions).
function computeFibSequence(n) {
  const dp = [];
  for (let i = 0; i <= n; i++) {
    if (i === 0) dp[i] = 0;
    else if (i === 1) dp[i] = 1;
    else dp[i] = dp[i - 1] + dp[i - 2];
  }
  return dp;
}

// Page Object for the demo page
class FibonacciDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#computeFibBtn';
    this.outputSelector = '#fib-output';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure DOM is loaded
    await this.page.waitForSelector(this.buttonSelector, { state: 'visible', timeout: 2000 });
    await this.page.waitForSelector(this.outputSelector, { state: 'attached', timeout: 2000 });
  }

  async getComputeButton() {
    return this.page.locator(this.buttonSelector);
  }

  async clickComputeButton() {
    await this.page.click(this.buttonSelector);
  }

  async getOutputText() {
    const el = this.page.locator(this.outputSelector);
    // textContent preserves newline characters in <pre> when using textContent
    return (await el.textContent()) ?? '';
  }

  async isOutputEmpty() {
    const text = await this.getOutputText();
    return text.trim().length === 0;
  }

  async getOutputElement() {
    return this.page.locator(this.outputSelector);
  }
}

test.describe('Dynamic Programming - Fibonacci demo (FSM states & transitions)', () => {
  // Collect console messages and uncaught page errors during each test
  let consoleMessages;
  let pageErrors;

  // Reusable page object
  let demo;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // store type and text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // store Error objects for later assertions
      pageErrors.push(err);
    });

    demo = new FibonacciDemoPage(page);
    await demo.goto();
  });

  test.afterEach(async ({ }, testInfo) => {
    // Attach captured console messages and errors to the test results for debugging
    if (consoleMessages.length > 0) {
      testInfo.attach('console-messages', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json'
      });
    }
    if (pageErrors.length > 0) {
      testInfo.attach('page-errors', {
        body: JSON.stringify(pageErrors.map(e => ({ message: e.message, stack: e.stack })), null, 2),
        contentType: 'application/json'
      });
    }
  });

  test('S0_Idle: initial UI renders correctly (button and empty output)', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) per the FSM:
    // - The "Compute Fibonacci Sequence (0 to 20)" button exists.
    // - The fib output area exists and is initially empty.
    const btn = await demo.getComputeButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('id', 'computeFibBtn');
    await expect(btn).toHaveText('Compute Fibonacci Sequence (0 to 20)');

    const outEl = await demo.getOutputElement();
    await expect(outEl).toBeVisible();
    // It should be empty initially (no pre-filled text)
    const isEmpty = await demo.isOutputEmpty();
    expect(isEmpty).toBe(true);

    // Verify accessibility attribute mentioned in the FSM/components
    await expect(outEl).toHaveAttribute('aria-live', 'polite');

    // Confirm no uncaught page errors were emitted while rendering the page (reasonable expectation)
    expect(pageErrors.length).toBe(0);

    // Check that the console did not contain error-level messages on initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Computing transition: clicking the Compute button updates #fib-output with Fib(0..20)', async ({ page }) => {
    // This test validates the transition from Idle -> Computing (S0 -> S1)
    // - Click Compute button
    // - #fib-output.textContent should be updated with Fib(0) through Fib(20)
    // - Validate specific values (Fib(0)=0, Fib(1)=1, Fib(20)=6765) and full formatting

    // Click the compute button once
    await demo.clickComputeButton();

    // Wait for the output to be non-empty. We expect the script to update #fib-output synchronously,
    // but give a small timeout in case of microtask scheduling.
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return (el.textContent || '').trim().length > 0;
      },
      demo.outputSelector,
      { timeout: 1000 }
    );

    const output = await demo.getOutputText();

    // Build expected output string
    const fibs = computeFibSequence(20);
    const expectedLines = fibs.map((v, i) => `Fib(${i}) = ${v}`);
    // The page uses newline '\n' between lines and textContent will reflect that
    const expectedOutput = expectedLines.join('\n') + '\n';

    // Validate the entire output matches exactly
    expect(output).toBe(expectedOutput);

    // Spot-check a few values to be explicit about known Fibonacci numbers
    expect(output).toContain('Fib(0) = 0');
    expect(output).toContain('Fib(1) = 1');
    expect(output).toContain('Fib(20) = 6765');

    // Ensure no uncaught page errors occurred during the click/compute action
    expect(pageErrors.length).toBe(0);

    // Ensure the console did not receive any error-level messages during compute
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotency & repeated interactions: clicking compute multiple times yields stable output and no duplication', async ({ page }) => {
    // Validate that clicking the compute button multiple times does not append or duplicate output.
    // The implementation sets textContent (not append), so repeated clicks should result in same output.

    // Click first time
    await demo.clickComputeButton();
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && (el.textContent || '').trim().length > 0;
      },
      demo.outputSelector
    );
    const firstOutput = await demo.getOutputText();

    // Click second time
    await demo.clickComputeButton();
    // Small wait to allow any synchronous update
    await page.waitForTimeout(50);
    const secondOutput = await demo.getOutputText();

    // Outputs should be identical (textContent overwritten, not appended)
    expect(secondOutput).toBe(firstOutput);

    // Ensure count of lines is still 21 (0..20)
    const lines = secondOutput.split('\n').filter(l => l.length > 0);
    expect(lines.length).toBe(21);

    // Verify no new console errors or page errors appeared after repeated interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('FSM onEnter/onExit verification & error observation: ensure renderPage was not erroneously invoked and no ReferenceError occurred', async ({ page }) => {
    // The FSM description mentions an entry action renderPage(). The provided HTML does not call renderPage().
    // We assert that the page did NOT produce a ReferenceError related to renderPage on load.
    // This checks that there were no unexpected attempts to invoke missing functions.

    // Search captured console messages and page errors for ReferenceError or mention of 'renderPage'
    const refErrors = pageErrors.filter(e => /ReferenceError/i.test(e.message));
    const refInConsole = consoleMessages.filter(m => /ReferenceError|renderPage/i.test(m.text));

    // We expect no ReferenceError or console mention of renderPage since the page source does not call it.
    expect(refErrors.length).toBe(0);
    expect(refInConsole.length).toBe(0);

    // Also assert no other syntax/type errors were emitted
    const syntaxOrTypeErrors = pageErrors.filter(e => /SyntaxError|TypeError/i.test(e.message));
    expect(syntaxOrTypeErrors.length).toBe(0);

    // Sanity check: the button still exists and is functional
    await demo.clickComputeButton();
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && (el.textContent || '').includes('Fib(20) =');
      },
      demo.outputSelector
    );
    expect((await demo.getOutputText()).includes('Fib(20) = 6765')).toBe(true);
  });

  test('Edge cases: verify output formatting and newline handling', async ({ page }) => {
    // Ensure the output uses newline separators and ends with a trailing newline as in the implementation.
    await demo.clickComputeButton();

    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && (el.textContent || '').endsWith('\n');
      },
      demo.outputSelector
    );

    const text = await demo.getOutputText();
    // Confirm trailing newline
    expect(text.endsWith('\n')).toBe(true);

    // Confirm that each expected line begins with "Fib(" and follows the exact pattern
    const lines = text.split('\n').filter(l => l.length > 0);
    for (let i = 0; i <= 20; i++) {
      expect(lines[i]).toBe(`Fib(${i}) = ${computeFibSequence(20)[i]}`);
    }

    // Confirm aria-live politeness attribute still present
    const outEl = await demo.getOutputElement();
    await expect(outEl).toHaveAttribute('aria-live', 'polite');

    // No runtime errors during these checks
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });
});