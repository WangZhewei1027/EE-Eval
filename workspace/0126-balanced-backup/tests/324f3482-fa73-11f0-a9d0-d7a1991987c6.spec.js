import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f3482-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object model for the DNS demo page
class DNSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Selector for the resolve button
  resolveButton() {
    return this.page.locator("button[onclick='resolveDNS()']");
  }

  // Locator for the result div
  resultDiv() {
    return this.page.locator('#result');
  }

  // Click the resolve button
  async clickResolve() {
    await this.resolveButton().click();
  }

  // Get trimmed innerText of result div
  async getResultText() {
    return (await this.resultDiv().innerText()).trim();
  }

  // Wait until the result div contains the resolved text (DNS Resolution Complete!)
  async waitForResolved(timeout = 4000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('result');
      if (!el) return false;
      return el.innerText.includes('DNS Resolution Complete!');
    }, { timeout });
  }

  // Wait until the result contains at least `count` occurrences of the resolved message
  async waitForResolvedCount(count = 1, timeout = 6000) {
    await this.page.waitForFunction((expectedCount) => {
      const el = document.getElementById('result');
      if (!el) return false;
      const matches = el.innerText.match(/DNS Resolution Complete!/g);
      return (matches && matches.length >= expectedCount) || false;
    }, count, { timeout });
  }
}

test.describe('DNS Concept Demonstration FSM - 324f3482-fa73-11f0-a9d0-d7a1991987c6', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let page;
  let dnsPage;

  // Setup: navigate to the application and attach listeners to capture console and page errors
  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleMessages = [];

    page = await browser.newPage();

    // Capture console messages for later assertions and debugging
    page.on('console', (msg) => {
      // Store type and text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (error) => {
      // Store the error object/message
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    });

    // Load the application exactly as-is
    await page.goto(APP_URL);

    dnsPage = new DNSPage(page);
  });

  // Teardown: close page after each test
  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  // Helper assertion to ensure there are no unexpected console.error or page errors
  async function assertNoPageErrors() {
    // Check for captured page errors (uncaught exceptions)
    expect(pageErrors, `Expected no page errors, but found: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);

    // Check console messages for any 'error' type entries
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error' || m.type === 'exception');
    expect(errorConsoleMessages, `Expected no console.error or exception messages, but found: ${JSON.stringify(errorConsoleMessages, null, 2)}`).toEqual([]);
  }

  test('Initial Idle state: page renders with button and empty result', async () => {
    // Validate initial state S0_Idle: the button exists and the result div is empty
    const button = dnsPage.resolveButton();
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Resolve DNS for example.com');

    const resultText = await dnsPage.getResultText();
    // Result should be empty initially
    expect(resultText === '' || resultText === '\n' || resultText === '\r\n').toBeTruthy();

    // Ensure no page errors or console.error messages happened during load
    await assertNoPageErrors();
  });

  test('Clicking Resolve DNS triggers Resolving state immediately', async () => {
    // Comment: This validates transition S0_Idle -> S1_Resolving on ResolveDNS click
    // Click the resolve button and assert the "Resolving example.com..." message appears promptly
    await dnsPage.clickResolve();

    // The page action sets innerHTML = "Resolving example.com...<br>";
    await expect(dnsPage.resultDiv()).toContainText('Resolving example.com');

    // Ensure the result contains the 'Resolving' phrase and no immediate resolution yet
    const resultNow = await dnsPage.getResultText();
    expect(resultNow).toContain('Resolving example.com');

    // The resolved messages should not yet appear immediately
    expect(resultNow).not.toContain('DNS Resolution Complete!');
    expect(resultNow).not.toContain('93.184.216.34');

    // Ensure no page errors or console.error messages happened
    await assertNoPageErrors();
  });

  test('After timeout transitions to Resolved state with IP address', async () => {
    // Comment: This validates transition S1_Resolving -> S2_Resolved that happens after ~2s
    await dnsPage.clickResolve();

    // Wait for the resolution to complete (implementation uses 2000ms)
    await dnsPage.waitForResolved(4000);

    // Assert that the resolved messages are present
    const finalText = await dnsPage.getResultText();
    expect(finalText).toContain('DNS Resolution Complete!');
    expect(finalText).toContain('example.com resolves to IP: 93.184.216.34');

    // Visual/DOM checks: the result div should still exist and contain expected text
    await expect(dnsPage.resultDiv()).toBeVisible();

    // Ensure no page errors or console.error messages happened during the whole flow
    await assertNoPageErrors();
  });

  test('Edge case: clicking the button multiple times schedules multiple resolutions', async () => {
    // Comment: Clicking multiple times resets innerHTML each click and schedules multiple timeouts.
    // We validate that multiple "DNS Resolution Complete!" occurrences can appear after multiple clicks.

    // Click twice in rapid succession
    await dnsPage.clickResolve();
    await dnsPage.clickResolve();

    // Wait for at least two resolution completions to be appended (each click schedules a timeout)
    // The function uses setTimeout 2000ms; allow extra time.
    await dnsPage.waitForResolvedCount(2, 6000);

    const textAfterTwo = await dnsPage.getResultText();
    // There should be at least two occurrences of the completion message (due to two scheduled timeouts)
    const matches = textAfterTwo.match(/DNS Resolution Complete!/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // The final resolved text should include the domain and IP at least once
    expect(textAfterTwo).toContain('example.com resolves to IP: 93.184.216.34');

    // Ensure no errors occurred
    await assertNoPageErrors();
  });

  test('Clicking again after resolved starts a new resolution cycle', async () => {
    // Comment: Validate that after reaching S2_Resolved, clicking again returns to S1_Resolving and then S2_Resolved again.

    // First cycle
    await dnsPage.clickResolve();
    await dnsPage.waitForResolved(4000);
    const afterFirst = await dnsPage.getResultText();
    expect(afterFirst).toContain('DNS Resolution Complete!');
    expect(afterFirst).toContain('example.com resolves to IP: 93.184.216.34');

    // Capture number of completion occurrences after first cycle
    const firstMatches = afterFirst.match(/DNS Resolution Complete!/g) || [];
    const firstCount = firstMatches.length;

    // Trigger another resolution after resolved
    await dnsPage.clickResolve();

    // Immediately after click we should observe "Resolving" text (state S1)
    await expect(dnsPage.resultDiv()).toContainText('Resolving example.com');

    // Wait for the subsequent resolution to finish
    await dnsPage.waitForResolved(4000);

    const afterSecond = await dnsPage.getResultText();
    const secondMatches = afterSecond.match(/DNS Resolution Complete!/g) || [];

    // Ensure that the number of 'DNS Resolution Complete!' messages increased (or at least one exists)
    expect(secondMatches.length).toBeGreaterThanOrEqual(firstCount);

    // Ensure IP text is still present
    expect(afterSecond).toContain('example.com resolves to IP: 93.184.216.34');

    // Ensure no page errors occurred during repeated usage
    await assertNoPageErrors();
  });

  test('Observes console logs and uncaught page errors (assert none occurred)', async () => {
    // Comment: Explicitly validate that console was observed and no errors were emitted during normal operation.

    // Perform the normal flow
    await dnsPage.clickResolve();
    await dnsPage.waitForResolved(4000);

    // We captured console messages; ensure they are an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // For clarity in failure messages, if there are console messages, log their summary to the assertion message
    const hasErrorConsole = consoleMessages.some((m) => m.type === 'error' || m.type === 'exception');
    const consoleSummary = consoleMessages.map((m) => `[${m.type}] ${m.text}`).slice(0, 20);

    // No console errors expected
    expect(hasErrorConsole, `Unexpected console errors found: ${consoleSummary.join('\n')}`).toBeFalsy();

    // No captured page errors expected
    expect(pageErrors.length === 0, `Unexpected page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBeTruthy();
  });

  test('Edge/error scenario: ensure missing global functions would surface as page errors (observe natural behavior)', async () => {
    // Comment: The app as provided should not throw ReferenceError or SyntaxError.
    // This test is prepared to observe such errors if they occur naturally in the environment.
    // We reload the page and assert again that no such errors exist.

    // Reload to capture any errors that might appear at load-time
    await page.reload();

    // Small delay to allow any synchronous errors to surface
    await page.waitForTimeout(200);

    // Assert there are no page errors (uncaught exceptions) after reload
    expect(pageErrors.length === 0, `Page errors were observed on reload: ${JSON.stringify(pageErrors, null, 2)}`).toBeTruthy();

    // Assert there are no console error/exception messages
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error' || m.type === 'exception');
    expect(consoleErrorMessages.length === 0, `Console error messages were observed on reload: ${JSON.stringify(consoleErrorMessages, null, 2)}`).toBeTruthy();
  });
});