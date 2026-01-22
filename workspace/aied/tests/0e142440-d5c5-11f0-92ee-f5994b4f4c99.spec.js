import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e142440-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Queue interactive application (FSM validation) - 0e142440-d5c5-11f0-92ee-f5994b4f4c99', () => {
  // Arrays to collect console and page errors for inspection in tests
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages for later assertions / debugging
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      // Playwright provides Error objects here
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // no-op cleanup placeholder (kept for clarity / future use)
  });

  test('UI sanity: #queue element exists and is a container', async ({ page }) => {
    // Validate that the #queue component exists in the DOM (FSM component)
    const queueHandle = await page.$('#queue');
    expect(queueHandle).not.toBeNull();

    // The HTML implementation appends text nodes (not <li> items).
    // Ensure the element is present and is a div container.
    const tagName = await page.evaluate(() => document.querySelector('#queue')?.tagName ?? null);
    expect(tagName).toBe('DIV');

    // There should be no child <li> elements (the implementation uses strings, and dequeue empties).
    const liCount = await page.evaluate(() => document.querySelectorAll('#queue li').length);
    expect(liCount).toBe(0);

    // No uncaught page errors during initial load (we'll assert this explicitly too)
    expect(pageErrors.length).toBeGreaterThan(-1); // trivial check to ensure pageErrors defined
  });

  test('Final state S1_EmptyQueue: queue is empty after script executes', async ({ page }) => {
    // The script enqueues several items then calls dequeue() which empties #queue.
    // Verify the final observable: #queue is empty.
    const queueContent = await page.evaluate(() => {
      const el = document.querySelector('#queue');
      return {
        text: el ? el.textContent : null,
        innerHTML: el ? el.innerHTML : null,
        childElementCount: el ? el.childElementCount : null
      };
    });

    // Expect the textContent and innerHTML to be empty strings and no child elements.
    expect(queueContent.text).toBe('');
    expect(queueContent.innerHTML).toBe('');
    expect(queueContent.childElementCount).toBe(0);

    // Confirm there are no <li> elements (evidence lines in FSM reference li selection)
    const liCount = await page.evaluate(() => document.querySelectorAll('#queue li').length);
    expect(liCount).toBe(0);

    // No uncaught page errors were fired during page load/run
    expect(pageErrors.length).toBe(0);

    // Also assert that there are no console messages at "error" level recorded during load
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('S0_Initialized evidence: enqueue operations happened prior to dequeue (inferred) and functions are not global', async ({ page }) => {
    // The implementation defines enqueue/dequeue inside a jQuery ready callback (closure).
    // They are not attached to the global window. Assert they are not globally accessible.
    const globals = await page.evaluate(() => {
      return {
        typeofWindowEnqueue: typeof window.enqueue,
        typeofWindowDequeue: typeof window.dequeue,
      };
    });

    expect(globals.typeofWindowEnqueue).toBe('undefined');
    expect(globals.typeofWindowDequeue).toBe('undefined');

    // We infer enqueue was executed because the script enqueues then dequeues.
    // Since final state is empty (asserted elsewhere), we cannot directly observe the intermediate state.
    // However, ensure that #queue had no <li> elements (consistent with implementation looking for li).
    const liCount = await page.evaluate(() => document.querySelectorAll('#queue li').length);
    expect(liCount).toBe(0);
  });

  test('Attempting to call dequeue/enqueue by identifier triggers natural ReferenceError (edge case assertion)', async ({ page }) => {
    // Call dequeue() as an unqualified identifier to intentionally trigger a ReferenceError
    // because the functions are not defined in the global scope. We catch the error inside the page
    // context to allow assertion of the error type/message without throwing in the test runner.
    const result = await page.evaluate(() => {
      try {
        // This will throw if dequeue is not defined in the global scope
        // (natural ReferenceError should occur if not present).
        // We intentionally do not reference window.dequeue to provoke ReferenceError instead of TypeError.
        // Wrap in try/catch so the page does not have an uncaught error.
        dequeue();
        return { called: true, caught: false };
      } catch (e) {
        return { called: false, caught: true, name: e.name, message: e.message };
      }
    });

    // We expect a ReferenceError because dequeue is not declared in the global scope.
    expect(result.caught).toBe(true);
    expect(result.name).toBe('ReferenceError');

    // Similarly test enqueue() call results in ReferenceError
    const resultEnqueue = await page.evaluate(() => {
      try {
        enqueue('x');
        return { called: true, caught: false };
      } catch (e) {
        return { called: false, caught: true, name: e.name, message: e.message };
      }
    });

    expect(resultEnqueue.caught).toBe(true);
    expect(resultEnqueue.name).toBe('ReferenceError');
  });

  test('Edge case: calling jQuery selection and removal behaves without runtime errors', async ({ page }) => {
    // The implementation uses $('#queue').find('li') and then empty(). Ensure these calls are safe.
    const jqResult = await page.evaluate(() => {
      try {
        const $ = window.jQuery;
        if (typeof $ !== 'function') {
          return { jQueryPresent: false };
        }
        const item = $('#queue').find('li');
        const length = item.length;
        // Attempt remove and empty as in the implementation
        try {
          item.remove();
        } catch (innerErr) {
          return { jQueryPresent: true, length, innerError: innerErr.name, innerMessage: innerErr.message };
        }
        $('#queue').empty();
        return { jQueryPresent: true, length, innerError: null };
      } catch (err) {
        return { exception: err.name, message: err.message };
      }
    });

    // Ensure jQuery was present and operations did not cause exceptions
    expect(jqResult.jQueryPresent).toBe(true);
    expect(jqResult.length).toBe(0);
    expect(jqResult.innerError).toBeNull();
  });

  test('Observability: capture and report any console errors or page errors (if present) for debugging', async ({ page }) => {
    // This test purposely collects console and page errors; if any exist, fail with details.
    // This helps ensure that surprises on the page are visible in CI logs.
    if (pageErrors.length > 0) {
      // Provide useful diagnostics in the failure message
      const summary = pageErrors.map(e => `${e.name}: ${e.message}`).join(' | ');
      // Fail the test with details
      expect(pageErrors.length, `Uncaught page errors detected: ${summary}`).toBe(0);
    }

    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    if (errorConsole.length > 0) {
      const summary = errorConsole.map(c => c.text).join(' | ');
      expect(errorConsole.length, `Console.error messages detected: ${summary}`).toBe(0);
    }

    // If no errors, assert success explicitly
    expect(pageErrors.length).toBe(0);
    expect(errorConsole.length).toBe(0);
  });
});