import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7187b420-d362-11f0-85a0-d3271c47ca09.html';

test.describe('Heap interactive app - Application ID: 7187b420-d362-11f0-85a0-d3271c47ca09', () => {
  // We will capture console messages and uncaught page errors emitted during page load.
  // Many of the application's entry actions are invoked immediately on load, but the
  // provided script contains syntax/runtime issues. Tests below assert that those errors
  // naturally occur and that the DOM reflects the failed execution (no heap output).

  test('S0_Initial: page load should emit script errors (SyntaxError/RuntimeError) and not silently succeed', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    // Capture console messages (including errors)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled exceptions / page errors
    page.on('pageerror', err => {
      // pageerror provides an Error object; stringify message for assertions
      pageErrors.push({ message: err.message || String(err), stack: err.stack || '' });
    });

    // Navigate to the app and wait for load to complete.
    // Errors during script parsing/execution will be caught by the listeners above.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Assert that at least one page error was emitted (we expect syntax/runtime errors)
    expect(pageErrors.length).toBeGreaterThan(0);

    // At least one of the page errors should indicate a parsing/runtime problem.
    // We allow several possible messages across browsers, so assert a flexible match.
    const combinedMessages = pageErrors.map(e => e.message.toLowerCase()).join(' ');
    const looksLikeSyntaxOrRuntime =
      combinedMessages.includes('syntaxerror') ||
      combinedMessages.includes('unexpected token') ||
      combinedMessages.includes('unexpected identifier') ||
      combinedMessages.includes('unexpected end of input') ||
      combinedMessages.includes('maximum call stack size exceeded') ||
      combinedMessages.includes('rangeerror') ||
      combinedMessages.includes('referenceerror');

    expect(looksLikeSyntaxOrRuntime).toBeTruthy();

    // Also assert that the browser console captured error-level logs
    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(errorConsoleCount).toBeGreaterThanOrEqual(1);

    // Provide more feedback in assertion messages (these are not printed but help with failures)
    // Ensure that the DOM did not show any heap items printed by the broken script.
    const heapInnerHTML = await page.locator('#heap').innerHTML();
    expect(heapInnerHTML).toBe('', 'Expected #heap to be empty because script failed before printing heap items');

    // Ensure page title and static content still render (HTML outside of script should be present)
    await expect(page.locator('h1')).toHaveText('Heap');
    await expect(page.locator('p')).toContainText('Heap is a data structure');
  });

  test('S0_Initial entry actions (heapify/insert/printHeap) should not be available as callable functions after a parse error', async ({ page }) => {
    // Attach listeners to capture errors during navigation
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL, { waitUntil: 'load' });

    // If the script failed to parse/execute, functions it defines should be absent.
    // We do not call or modify them; we only read typeof to observe what the runtime has.
    const types = await page.evaluate(() => {
      return {
        heapType: typeof heap,
        heapifyType: typeof heapify,
        insertType: typeof insert,
        printHeapType: typeof printHeap
      };
    });

    // Because the <script> contains syntax errors, it's expected that these are not defined.
    // At minimum, heapify/insert/printHeap should not be functions.
    expect(['undefined', 'object', 'function']).toContain(types.heapType);
    // For the functions that are meant to be declared, assert they are not available as functions.
    expect(types.heapifyType).not.toBe('function');
    expect(types.insertType).not.toBe('function');
    expect(types.printHeapType).not.toBe('function');

    // There should also have been page errors emitted during load
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  test('DOM and UI checks: no interactive elements or transitions present; static content only', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // The FSM/extraction summary indicated no interactive elements were detected.
    // Validate this: ensure no common interactive elements exist.
    const interactiveCount = await page.evaluate(() => {
      const selectors = ['button', 'input', 'select', 'textarea', '[role="button"]', 'a[href^="javascript:"]'];
      return selectors.reduce((acc, sel) => acc + document.querySelectorAll(sel).length, 0);
    });

    expect(interactiveCount).toBe(0);

    // Also ensure there are no inline onclick attributes (a crude check for transitions)
    const onclickCount = await page.evaluate(() => document.querySelectorAll('[onclick]').length);
    expect(onclickCount).toBe(0);

    // Validate that the heap output area exists but is empty due to script failure
    const heapText = await page.locator('#heap').textContent();
    expect(heapText.trim()).toBe('', 'Heap output area should be empty because printHeap failed to run');
  });

  test('Edge cases: confirm that attempting to call the intended functions from the page context throws or is not allowed (do not redefine or patch)', async ({ page }) => {
    // We must not inject or redefine functions. We only evaluate their availability and,
    // if present unexpectedly, attempt a harmless invocation check using try/catch inside the page.
    await page.goto(APP_URL, { waitUntil: 'load' });

    const callResults = await page.evaluate(() => {
      const result = { heapifyCalled: null, insertCalled: null, printHeapCalled: null };

      try {
        result.heapifyCalled = typeof heapify === 'function' ? (() => { try { heapify([1,2,3]); return 'called'; } catch (e) { return 'threw:' + e.message; } })() : 'not-function';
      } catch (e) {
        result.heapifyCalled = 'eval-error:' + e.message;
      }

      try {
        result.insertCalled = typeof insert === 'function' ? (() => { try { insert([1,2,3]); return 'called'; } catch (e) { return 'threw:' + e.message; } })() : 'not-function';
      } catch (e) {
        result.insertCalled = 'eval-error:' + e.message;
      }

      try {
        result.printHeapCalled = typeof printHeap === 'function' ? (() => { try { printHeap(); return 'called'; } catch (e) { return 'threw:' + e.message; } })() : 'not-function';
      } catch (e) {
        result.printHeapCalled = 'eval-error:' + e.message;
      }

      return result;
    });

    // Because the original script is broken, we expect these to be 'not-function' or to have thrown.
    expect(['not-function', 'threw:', 'eval-error:']).toContainEqual(
      callResults.heapifyCalled.startsWith('not-function') ? 'not-function' : callResults.heapifyCalled.split(':')[0] + ':'
    );
    expect(['not-function', 'threw:', 'eval-error:']).toContainEqual(
      callResults.insertCalled.startsWith('not-function') ? 'not-function' : callResults.insertCalled.split(':')[0] + ':'
    );
    expect(['not-function', 'threw:', 'eval-error:']).toContainEqual(
      callResults.printHeapCalled.startsWith('not-function') ? 'not-function' : callResults.printHeapCalled.split(':')[0] + ':'
    );
  });
});