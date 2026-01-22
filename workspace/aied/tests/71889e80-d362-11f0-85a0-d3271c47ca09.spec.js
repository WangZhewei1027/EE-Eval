import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/71889e80-d362-11f0-85a0-d3271c47ca09.html';

test.describe('Priority Queue App (71889e80-d362-11f0-85a0-d3271c47ca09) - FSM and implementation checks', () => {
  // Arrays to collect runtime issues and console output from the page
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    pageErrors = [];
    consoleMessages = [];

    // Capture unhandled exceptions that bubble to the Page (pageerror)
    page.on('pageerror', (err) => {
      // store the Error object for assertions
      pageErrors.push(err);
    });

    // Capture console.* messages from the page for additional evidence
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app and wait for load (script executes on load)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('S0_Initialized: global "queue" variable should be declared and populated (evidence: var queue = [] and push loop)', async ({ page }) => {
    // This validates the initial state evidence: queue should exist and contain 10 items (0..9)
    // We intentionally do NOT modify the page script - just observe existing globals.
    const queueExists = await page.evaluate(() => typeof window.queue !== 'undefined');
    expect(queueExists).toBe(true);

    const length = await page.evaluate(() => Array.isArray(window.queue) ? window.queue.length : -1);
    expect(length).toBe(10);

    // Validate first and last values to ensure the for-loop executed as expected
    const firstAndLast = await page.evaluate(() => {
      return { first: window.queue[0], last: window.queue[window.queue.length - 1] };
    });
    expect(firstAndLast.first).toBe(0);
    expect(firstAndLast.last).toBe(9);
  });

  test('Script load produces a runtime error due to missing Array.prototype.isEmpty -> TypeError observed (validates broken transition execution)', async () => {
    // The implementation calls queue.isEmpty() which does not exist -> TypeError expected.
    // Assert that at least one pageerror was captured and that it indicates the missing function.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Convert to messages for easier pattern matching
    const messages = pageErrors.map(e => (e && e.message) ? e.message : String(e));

    // Expect at least one of the errors to mention "isEmpty" or "is not a function"
    const matched = messages.some(msg =>
      /isEmpty/.test(msg) || /is not a function/.test(msg) || /is not defined/.test(msg)
    );
    expect(matched).toBe(true);
  });

  test('S1_QueueNotEmpty expected transitions did NOT complete due to error: #console remains empty and no "popped/enqueued/dequeued/check" messages', async ({ page }) => {
    // The inline script intends to update #console on each transition.
    // Because of the early TypeError, those updates should not have happened.
    const consoleHtml = await page.locator('#console').innerHTML();
    // If the script succeeded, we would see texts like "The popped element is ..." etc.
    // Expect it to be empty (no transitions executed)
    expect(consoleHtml.trim()).toBe('', 'Expected #console to remain empty because script failed before DOM updates.');

    // Ensure none of the expected transition messages are present in consoleMessages (logged via console.* if any)
    const combinedConsoleText = consoleMessages.map(m => m.text).join('\n');
    expect(combinedConsoleText).not.toContain('The popped element is');
    expect(combinedConsoleText).not.toContain('The enqueued element is');
    expect(combinedConsoleText).not.toContain('The dequeued element is');
    expect(combinedConsoleText).not.toContain('The check result is');
  });

  test('Event helper functions for ENQUEUE/DEQUEUE/CHECK are not defined on the window (evidence of missing handlers)', async ({ page }) => {
    // We check typeof to avoid invoking undefined symbols (which would throw).
    const types = await page.evaluate(() => {
      return {
        queueEnqueue: typeof window.queueEnqueue,
        queueDequeue: typeof window.queueDequeue,
        queueCheck: typeof window.queueCheck
      };
    });

    // According to the broken implementation these helpers are not implemented; expect 'undefined'
    expect(types.queueEnqueue).toBe('undefined');
    expect(types.queueDequeue).toBe('undefined');
    expect(types.queueCheck).toBe('undefined');
  });

  test('FSM State S2_QueueEmpty: ensure that "empty" state transition did not execute (no check result) and queue remains non-empty after error', async ({ page }) => {
    // Because the script crashed early, queue should still contain items (so S1 condition "Queue Not Empty" holds)
    const length = await page.evaluate(() => Array.isArray(window.queue) ? window.queue.length : -1);
    expect(length).toBeGreaterThan(0);

    // The "Check" transition was supposed to write "The check result is ..." — ensure it did not occur.
    const consoleHtml = await page.locator('#console').innerHTML();
    expect(consoleHtml).not.toContain('The check result is');
  });

  test('Edge case: no silent success - ensure that at least one unhandled error appeared in the console (captures regression where errors might be swallowed)', async () => {
    // If the page silently swallowed the error, pageErrors would be empty. We assert that it is not.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Also assert that captured pageErrors include either TypeError or ReferenceError text to match expectations
    const messages = pageErrors.map(e => (e && e.message) ? e.message : String(e));
    const hasExpectedErrorType = messages.some(msg => /TypeError|ReferenceError|SyntaxError/.test(msg));
    expect(hasExpectedErrorType).toBe(true);
  });

  test('Sanity checks: title and static content exist (ensures page rendered despite script error)', async ({ page }) => {
    // Static content should have loaded
    await expect(page.locator('h1')).toHaveText('Priority Queue');
    // Elements list exists
    const listItems = await page.locator('ul >> li').allTextContents();
    // There is an elements list in the HTML with at least 1 item
    expect(listItems.length).toBeGreaterThanOrEqual(1);
    // Size section text present
    await expect(page.locator('h2', { hasText: 'Size' })).toBeTruthy();
  });
});