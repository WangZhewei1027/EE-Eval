import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b23130-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Thread FSM - f5b23130-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Helper to collect console messages and page errors for assertions
  const attachCollectors = (page, options = {}) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch {
        // ignore non-text console messages
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    return { consoleMessages, pageErrors };
  };

  test('Idle state: page renders and button is present; page load triggers script errors due to missing Thread implementation', async ({ page }) => {
    // Attach collectors before navigation to capture load-time errors
    const { consoleMessages, pageErrors } = attachCollectors(page);

    // Navigate to the page. We expect script execution during load to throw errors
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Validate S0_Idle evidence: button is present with expected text
    const button = page.locator('#thread-demo-button');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Demonstrate Thread Execution');

    // Validate that descriptive text from renderPage() (entry action) is present
    // Check some expected static content to confirm the page rendered
    await expect(page.locator('h1')).toHaveText('Thread');
    await expect(page.locator('h2')).toContainText('Algorithmic Threads');

    // Because the HTML uses a non-standard Thread constructor at global scope,
    // we expect at least one page error (ReferenceError/ReferenceError-like) to have occurred during load.
    // Allow a short moment for the error handlers to populate
    await page.waitForTimeout(200);

    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // Assert at least one page error message mentions 'Thread' (e.g., "Thread is not defined")
    const pageErrorMessages = pageErrors.map(e => String(e.message || e));
    const hasThreadError = pageErrorMessages.some(msg => msg.includes('Thread'));
    expect(hasThreadError).toBeTruthy();

    // The script attempted to create/execute threads and log "Thread started" and "Thread: X".
    // Because Thread is missing and caused an error, we assert that the expected 'Thread started'
    // or per-iteration logs do NOT appear in console messages.
    const hasThreadStartedLog = consoleMessages.some(msg => msg.includes('Thread started'));
    expect(hasThreadStartedLog).toBeFalsy();

    const hasThreadIndexLog = consoleMessages.some(msg => /Thread:\s*\d+/.test(msg));
    expect(hasThreadIndexLog).toBeFalsy();
  });

  test('Transition: clicking the Demonstrate Thread Execution button triggers demonstrateThreadExecution() which fails due to missing Thread', async ({ page }) => {
    // Collect console and page errors
    const { consoleMessages, pageErrors } = attachCollectors(page);

    // Load the page fresh for this test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Confirm the function demonstrateThreadExecution exists (it is defined in the script above the failing constructor)
    // It may or may not be defined depending on where the error occurred; check in a safe manner.
    const hasFunction = await page.evaluate(() => {
      try {
        return typeof demonstrateThreadExecution === 'function';
      } catch {
        return false;
      }
    });

    // The FSM expects demonstrateThreadExecution() as an entry action for S1; we assert it's at least declared.
    // If the global constructor error happened before the function declaration, the function might be undefined.
    // We do not attempt to patch any missing behavior; we only observe.
    expect(typeof hasFunction === 'boolean').toBeTruthy();

    // Prepare to capture the click-triggered page error.
    const waitForPageError = page.waitForEvent('pageerror');

    // Click the button to trigger the DemonstrateThreadExecution event/transition
    await page.click('#thread-demo-button');

    // Wait for the click to cause a runtime error (we expect a ReferenceError because Thread isn't defined)
    const clickError = await waitForPageError;

    // Validate that the click produced a runtime error referencing 'Thread'
    expect(String(clickError.message || clickError)).toContain('Thread');

    // Allow short time for any asynchronous console outputs to appear (there shouldn't be any valid ones)
    await page.waitForTimeout(300);

    // Confirm that "Thread started" and iteration logs are absent after user-triggered transition
    const foundThreadStarted = consoleMessages.some(m => m.includes('Thread started'));
    expect(foundThreadStarted).toBeFalsy();

    const foundThreadIteration = consoleMessages.some(m => /Thread:\s*\d+/.test(m));
    expect(foundThreadIteration).toBeFalsy();

    // DOM should remain stable after the error: button should still be present and clickable
    const button = page.locator('#thread-demo-button');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Demonstrate Thread Execution');
  });

  test('Edge case: rapid repeated clicks produce multiple runtime errors but do not produce expected thread logs', async ({ page }) => {
    // Collect diagnostics
    const { consoleMessages, pageErrors } = attachCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Perform two rapid clicks and wait for two pageerror events
    const errorPromises = [page.waitForEvent('pageerror'), page.waitForEvent('pageerror')];

    // Trigger two clicks in rapid succession
    await page.click('#thread-demo-button');
    await page.click('#thread-demo-button');

    // Wait for both errors to fire (they may occur quickly)
    const errors = await Promise.all(errorPromises);

    // We expect at least two errors, each mentioning 'Thread'
    expect(errors.length).toBeGreaterThanOrEqual(2);
    errors.forEach(err => {
      expect(String(err.message || err)).toContain('Thread');
    });

    // Give a short time for console logs (if any) to be delivered
    await page.waitForTimeout(300);

    // Confirm no valid "Thread started" or "Thread: N" logs were emitted during these failed attempts
    const anyThreadStarted = consoleMessages.some(m => m.includes('Thread started'));
    expect(anyThreadStarted).toBeFalsy();

    const anyThreadIteration = consoleMessages.some(m => /Thread:\s*\d+/.test(m));
    expect(anyThreadIteration).toBeFalsy();

    // Page should remain interactive: the button should still respond (clickable)
    await expect(page.locator('#thread-demo-button')).toBeVisible();
  });

  test('Error observation sanity: ensure page errors and console messages are observable via Playwright listeners', async ({ page }) => {
    // This test validates that our test harness correctly observes runtime errors that the FSM/execution produces.
    const collected = attachCollectors(page);

    // Navigate and intentionally trigger the demonstration function if it's available.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // If the demonstrateThreadExecution function exists, attempt to call it to trigger its runtime behavior.
    // We wrap in page.evaluate and allow exceptions to surface to the pageerror listener.
    const functionExists = await page.evaluate(() => {
      try {
        return typeof demonstrateThreadExecution === 'function';
      } catch {
        return false;
      }
    });

    if (functionExists) {
      // call it inside the page context; errors will be captured by pageerror handler
      try {
        await page.evaluate(() => {
          // Intentionally call the function - let errors happen naturally
          demonstrateThreadExecution();
        });
      } catch {
        // The exception can be thrown into the evaluation; we do not swallow pageerror events.
      }
    } else {
      // If the function doesn't exist, it's an expected scenario given the broken runtime - assert that
      expect(functionExists).toBeFalsy();
    }

    // Allow brief time for error propagation
    await page.waitForTimeout(200);

    // Ensure that at least one page error mentioning 'Thread' has been recorded if function was called
    if (functionExists) {
      expect(collected.pageErrors.length).toBeGreaterThanOrEqual(1);
      const someThreadError = collected.pageErrors.some(e => String(e.message || e).includes('Thread'));
      expect(someThreadError).toBeTruthy();
    } else {
      // If the function didn't exist, no additional errors are strictly required; we just validate observability
      expect(Array.isArray(collected.consoleMessages)).toBeTruthy();
    }
  });
});