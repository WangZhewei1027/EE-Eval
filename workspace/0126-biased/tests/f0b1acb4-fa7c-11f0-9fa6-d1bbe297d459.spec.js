import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1acb4-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object for the Priority Queue demo page.
 * Encapsulates selectors and common interactions.
 */
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demoButton');
    this.demoOutput = page.locator('#demoOutput');
    this.heapVisualization = page.locator('#heap-visualization');
    // A locator to find the raw JavaScript text that appears in the DOM as a section
    // This page includes a block of JS code as plain text in a section element.
    this.inlineJsTextLocator = page.locator('section', { hasText: "document.getElementById('demoButton').addEventListener('click'" });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickDemoButton() {
    await this.demoButton.click();
  }

  // Returns number of paragraph children inside #demoOutput
  async demoOutputParagraphCount() {
    return await this.demoOutput.locator('p').count();
  }

  // Returns the visible text of demoOutput (trimmed)
  async demoOutputText() {
    return (await this.demoOutput.innerText()).trim();
  }

  // Whether the inline JS-like text block exists in the DOM (as text, not executed)
  async hasInlineJsTextBlock() {
    return (await this.inlineJsTextLocator.count()) > 0;
  }

  // Evaluate whether a global function renderPage exists on the page
  async isRenderPageDefined() {
    return await this.page.evaluate(() => {
      // Do not create or modify any globals. Just check the type safely.
      try {
        return typeof renderPage !== 'undefined';
      } catch (e) {
        // If accessing causes an error (shouldn't), return false and preserve natural error observation elsewhere
        return false;
      }
    });
  }
}

test.describe('Priority Queue Demo - FSM Validation (f0b1acb4-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Containers to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (logs, warnings, errors, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      // Save the error object/stack/text for later assertions
      pageErrors.push(err);
    });

    // Navigate to the app page (load exactly as-is)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // For visibility when debugging tests, attach captured console errors to test results
    if (consoleMessages.length) {
      testInfo.attach('console-messages', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json',
      });
    }
    if (pageErrors.length) {
      testInfo.attach('page-errors', {
        body: JSON.stringify(pageErrors.map(e => String(e)), null, 2),
        contentType: 'application/json',
      });
    }
  });

  test('Initial state (S0_Idle): page renders with demo button and demoOutput is present and empty', async ({ page }) => {
    // This test validates the Idle state described in the FSM.
    // It checks that the DOM elements evidencing the Idle state are present:
    // - The demo button with id #demoButton and text "Run Insertion Demo"
    // - The demo output container #demoOutput exists and starts empty
    // - The page does not define the renderPage() function (entry action in FSM is not implemented)
    const pq = new PriorityQueuePage(page);

    // Ensure the main header is present to confirm page load
    await expect(page.locator('h1')).toHaveText(/Priority Queue/i);

    // The demo button should exist and be visible
    await expect(pq.demoButton).toBeVisible();
    await expect(pq.demoButton).toHaveText('Run Insertion Demo');

    // The demo output container should exist
    await expect(pq.demoOutput).toBeVisible();

    // Initially there should be no paragraphs in demoOutput (Idle state)
    const initialCount = await pq.demoOutputParagraphCount();
    expect(initialCount).toBe(0);

    // The FSM entry action mentions renderPage(); verify that the global function is not defined on the page.
    // We assert its non-existence by checking typeof renderPage === 'undefined'.
    const renderPageDefined = await pq.isRenderPageDefined();
    expect(renderPageDefined).toBe(false);

    // Ensure there were no uncaught runtime errors during initial load (observing console and pageerrors)
    // We allow other console logs, but there should be no uncaught page errors collected.
    expect(pageErrors.length).toBe(0);
  });

  test('Transition (RunInsertionDemo): clicking demo button - validate behavior and observables', async ({ page }) => {
    // This test attempts to exercise the RunInsertionDemo event transition from S0_Idle -> S1_InsertionDemo.
    // The FSM and the HTML suggest that clicking the #demoButton should populate #demoOutput with step paragraphs.
    // The provided HTML, however, includes the event handler code as plain text inside a section (i.e., not executable).
    // This test:
    // - clicks the button
    // - waits a short time for any immediate output (the real implementation would append the first step with setTimeout(..., 0))
    // - asserts whether demoOutput gained content
    // - checks for the presence of the raw JS text block which indicates the script was rendered as text and not executed
    const pq = new PriorityQueuePage(page);

    // Sanity: no paragraphs at start
    expect(await pq.demoOutputParagraphCount()).toBe(0);

    // Click the demo button once to trigger any attached handler (if present)
    await pq.clickDemoButton();

    // Wait a brief moment to allow any immediate setTimeout(..., 0) scheduled tasks to run if the handler exists
    await page.waitForTimeout(800);

    // Count paragraphs after the click
    const afterClickCount = await pq.demoOutputParagraphCount();

    // Because the actual event-binding code is present only as text later in the DOM, the event listener is likely not attached.
    // Assert that no demo steps were appended (this asserts a discrepancy between FSM expectation and actual implementation)
    expect(afterClickCount).toBe(0);

    // Confirm that the page contains the inline JS-like text block (evidence that the developer put the handler as text in the page)
    const hasInlineJsText = await pq.hasInlineJsTextBlock();
    expect(hasInlineJsText).toBe(true);

    // Confirm again there were no uncaught runtime errors produced by the click (unless the page naturally generated them)
    // If such errors exist, we will expose them via the pageErrors array (and the test will fail here).
    expect(pageErrors.length).toBe(0);

    // Additionally assert that no console messages of type 'error' were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks do not produce partial or duplicate output when handler is not attached', async ({ page }) => {
    // This test simulates rapid/frequent user interaction (clicking the demo button many times)
    // and asserts that the page remains stable and that no demo steps appear when the handler isn't wired.
    const pq = new PriorityQueuePage(page);

    // Rapidly click the button several times
    for (let i = 0; i < 5; i++) {
      await pq.clickDemoButton();
    }

    // Wait a moment to allow any potential handlers to run if they existed
    await page.waitForTimeout(1000);

    // The demo output should remain empty in this implementation
    expect(await pq.demoOutputParagraphCount()).toBe(0);

    // Ensure no uncaught runtime errors were produced by repeated clicks
    expect(pageErrors.length).toBe(0);

    // Ensure that the inline JS text block remains present in the DOM (indicating it was not executed)
    expect(await pq.hasInlineJsTextBlock()).toBe(true);
  });

  test('Runtime error observation: check for ReferenceError / SyntaxError / TypeError occurrences', async ({ page }) => {
    // This test explicitly inspects captured page errors and console messages for common JS runtime errors.
    // We do not inject or patch anything. We only observe what happens naturally and assert the results.
    // If any of these errors happened on the page naturally, we will fail the test to surface the issue.
    const hasReferenceError = pageErrors.some(e => String(e).includes('ReferenceError'));
    const hasSyntaxError = pageErrors.some(e => String(e).includes('SyntaxError'));
    const hasTypeError = pageErrors.some(e => String(e).includes('TypeError'));

    // Also inspect console messages for mention of these errors (some frameworks log errors via console.error)
    const consoleText = consoleMessages.map(m => m.text).join('\n');
    const consoleHasReferenceError = consoleText.includes('ReferenceError');
    const consoleHasSyntaxError = consoleText.includes('SyntaxError');
    const consoleHasTypeError = consoleText.includes('TypeError');

    // We expect that there are no uncaught ReferenceError, SyntaxError, or TypeError occurrences during a normal page load
    // If any are present, the implementation has a runtime problem that should be addressed.
    expect(hasReferenceError || consoleHasReferenceError).toBe(false);
    expect(hasSyntaxError || consoleHasSyntaxError).toBe(false);
    expect(hasTypeError || consoleHasTypeError).toBe(false);
  });
});