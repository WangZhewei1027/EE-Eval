import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b16de2-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Topological Sort Interactive Application (f5b16de2-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // We'll capture console messages and uncaught page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      try {
        // record concatenated text for easier assertions
        consoleMessages.push(msg.text());
      } catch (e) {
        // ignore unexpected console handling issues
      }
    });

    // Capture unhandled errors in the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application, listeners attached before navigation
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure the page closes between tests (Playwright will typically handle this)
    await page.close();
  });

  test.describe('State: Idle (S0_Idle) - initial rendering and expectations', () => {
    test('renders the page and shows static content including the Try it out button', async ({ page }) => {
      // Validate static DOM elements that constitute the Idle state
      // Check title and headings
      await expect(page.locator('h1')).toHaveText('Topological Sort');

      // Check explanation text exists
      const explanation = page.locator('.text-explanation');
      await expect(explanation).toBeVisible();
      await expect(explanation).toContainText('Topological Sort is a linear ordering');

      // Check example and demo sections are visible
      await expect(page.locator('.text-example')).toBeVisible();
      await expect(page.locator('.text-demo')).toBeVisible();

      // Confirm the primary interactive component (button) exists and is visible
      const button = page.locator('.button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Try it out');

      // Assert that initial script executed and logged the topological sort results to console.
      // The page script logs two entries on load: "Topological Sort Order:" and "Topological Sort Order (second graph):"
      // Wait briefly for console messages to be captured
      await page.waitForTimeout(200); // allow any pending console logs to be processed

      const hasFirstLog = consoleMessages.some((m) => m.includes('Topological Sort Order:'));
      const hasSecondLog = consoleMessages.some((m) => m.includes('Topological Sort Order (second graph):'));

      expect(hasFirstLog).toBeTruthy();
      expect(hasSecondLog).toBeTruthy();

      // Ensure there were no uncaught page errors during initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ButtonClick event and Sorting (S1_Sorting)', () => {
    test('clicking "Try it out" does not throw and does not modify DOM unexpectedly (implementation has no click handler)', async ({ page }) => {
      const button = page.locator('.button');

      // Record console count before click
      const consoleCountBefore = consoleMessages.length;

      // Click the button — per provided implementation there's no onclick handler wired up,
      // so we expect no new sorting logs to be automatically created by the click.
      await button.click();

      // Allow brief time to capture any potential console output triggered by click
      await page.waitForTimeout(200);

      const consoleCountAfter = consoleMessages.length;

      // Because the implementation does not attach an onclick to the button, confirm that no new
      // "Topological Sort Order" logs were produced as a result of the click.
      const newConsoleMessages = consoleMessages.slice(consoleCountBefore);
      const producedSortLog = newConsoleMessages.some((m) => m.includes('Topological Sort Order'));
      expect(producedSortLog).toBeFalsy();

      // Also verify the DOM remains consistent (button still present)
      await expect(button).toBeVisible();

      // Ensure no uncaught page errors resulted from clicking the button
      expect(pageErrors.length).toBe(0);
    });

    test('explicitly call topologicalSort from page context to emulate transition action and verify result & console output', async ({ page }) => {
      // We call the existing topologicalSort function defined by the page's script to validate its behavior.
      // Provide a small graph and check returned order and that we can observe a console message when logging the result.
      const result = await page.evaluate(() => {
        // Create a simple DAG: 0 -> 1
        const testGraph = {
          0: [1],
          1: []
        };
        const testVertices = Object.keys(testGraph);
        const ordering = topologicalSort(testGraph, testVertices); // should return [0,1]
        // Emit a console log so the test harness can observe it
        console.log('manual call result', ordering);
        return ordering;
      });

      // Verify the returned ordering matches expectation
      expect(Array.isArray(result)).toBeTruthy();
      expect(result.map(String)).toEqual(['0', '1']); // values are strings because vertices were keys

      // Confirm that console captured the manual call output
      const observedManualLog = consoleMessages.some((m) => m.includes('manual call result'));
      expect(observedManualLog).toBeTruthy();

      // No new uncaught page errors produced by this operation
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('calling topologicalSort with invalid inputs should throw a TypeError (vertices undefined)', async ({ page }) => {
      // Attempting to call topologicalSort(undefined, undefined) will access vertices.length and should throw.
      // We assert that calling it from the page context rejects with an error.
      await expect(page.evaluate(() => {
        // This will throw in the page context; Playwright will surface it as a rejected promise.
        return topologicalSort(undefined, undefined);
      })).rejects.toThrow();
    });

    test('uncaught ReferenceError on the page should be observable via pageerror', async ({ page }) => {
      // Schedule an uncaught ReferenceError in the page context using setTimeout so it's unhandled.
      // We'll then wait for the pageerror event to be emitted and validate its message contains the missing identifier.
      const errorPromise = page.waitForEvent('pageerror');

      // Schedule a callback that triggers a ReferenceError by calling an undefined function/variable
      // We do not redefine page globals; this is a one-off invocation to produce an error naturally.
      await page.evaluate(() => {
        setTimeout(() => {
          // Intentionally reference a non-existent variable to trigger ReferenceError
          // This will be uncaught and should surface as a pageerror.
          // eslint-disable-next-line no-undef
          nonExistentFunctionTriggeringReferenceError();
        }, 0);
      });

      // Await the uncaught page error
      const err = await errorPromise;

      // Ensure we captured at least one page error and it looks like a ReferenceError
      expect(err).toBeTruthy();
      // err.message may differ by engine, but confirm it's an Error object with a message containing 'nonExistentFunctionTriggeringReferenceError' or 'nonExistent'
      const message = err.message || '';
      const containsIdentifier = message.includes('nonExistentFunctionTriggeringReferenceError') || message.toLowerCase().includes('nonexistent');
      expect(containsIdentifier).toBeTruthy();

      // Also ensure our pageErrors array captured it via the page.on('pageerror') handler
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Miscellaneous validations and robustness checks', () => {
    test('verify the example/demo lists contain expected number of items (static content integrity)', async ({ page }) => {
      // The simple example list contained 5 <li> items; the demo list contained 7 <li> items in the provided HTML.
      const exampleListItems = await page.locator('.text-example li').count();
      const demoListItems = await page.locator('.text-demo li').count();

      expect(exampleListItems).toBe(5);
      expect(demoListItems).toBe(7);

      // Ensure no uncaught errors from these queries
      expect(pageErrors.length).toBe(0);
    });
  });
});