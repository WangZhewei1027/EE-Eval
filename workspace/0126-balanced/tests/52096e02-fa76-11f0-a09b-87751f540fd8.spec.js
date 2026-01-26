import { test, expect } from '@playwright/test';

test.describe('A* Search Algorithm Visualization - FSM validation (52096e02-fa76-11f0-a09b-87751f540fd8)', () => {
  // Arrays to capture console messages and page errors for assertions
  let pageErrors;
  let consoleMessages;

  // URL of the page under test
  const URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52096e02-fa76-11f0-a09b-87751f540fd8.html';

  // Setup: navigate to the page and attach listeners to collect errors and console output.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions / runtime errors from the page
    page.on('pageerror', (err) => {
      // err is an Error object; capture its message for assertions
      pageErrors.push(err.message || String(err));
    });

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Load the page exactly as provided
    await page.goto(URL);
    // Wait briefly to allow synchronous scripts to run and potentially throw errors
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // Ensure any state is cleaned up: close the page (Playwright test runner will handle contexts)
    await page.close();
  });

  test('S0_Idle: Grid element exists, but grid initialization did not produce DOM cell elements and createStartAndEnd produced a runtime error', async ({ page }) => {
    // Validate the grid container exists in the DOM (entry action createGrid() referred to it)
    const grid = page.locator('#grid');
    await expect(grid).toBeVisible();

    // Because createGrid() in the implementation populates an internal `cells` array with HTML strings
    // (instead of actual DOM nodes), there should be no .cell elements in the DOM at this stage.
    await expect(page.locator('.cell')).toHaveCount(0);

    // The implementation calls createStartAndEnd() which attempts to access classList on an array,
    // causing a TypeError. Assert that at least one page error was recorded.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Ensure the error message indicates the nature of the failure (classList/add/reading property)
    const combinedErrors = pageErrors.join(' | ');
    const plausibleError = /classList|add|Cannot read|is not a function|undefined/.test(combinedErrors);
    expect(plausibleError).toBeTruthy();
  });

  test('S1_AlgorithmStarted: Start button is not appended to DOM and attempting to interact with it results in errors', async ({ page }) => {
    // The script creates a startButton variable but does not append it to the DOM.
    // Assert there are no <button> elements visible in the document.
    await expect(page.locator('button')).toHaveCount(0);

    // Attempting to reference the page-scoped `startButton` variable from evaluate should throw a ReferenceError.
    // We intentionally allow the error to happen and assert it occurs.
    await expect(page.evaluate(() => startButton)).rejects.toThrow(/startButton|is not defined|ReferenceError/);

    // Attempting to click a non-existent button via Playwright should reject. This validates the event
    // handler transition (StartButtonClick) cannot be triggered via DOM click because the element is absent.
    await expect(page.click('button')).rejects.toThrow();
  });

  test('S2_PathVisualized: Attempting to access algorithm internals (aStar, path) from page context throws / is inaccessible', async ({ page }) => {
    // The implementation defines a function aStar(...) but later shadows it with `let aStar = false;`
    // and variables are block-scoped; accessing these names directly from the test environment should fail.
    // Assert that direct access to `aStar` variable throws a ReferenceError in the page context.
    await expect(page.evaluate(() => aStar)).rejects.toThrow(/aStar|is not defined|ReferenceError/);

    // Confirm that there are no console logs for 'path' (the path logging happens only if the nested click handler runs).
    // Since the nested click handler should never have executed (no DOM button was appended), there should be no such logs.
    const pathLogs = consoleMessages.filter(m => /path/.test(m));
    expect(pathLogs.length).toBe(0);

    // Also check that window-scoped references are not present (window.aStar should be undefined)
    const windowAstar = await page.evaluate(() => {
      // Accessing window.aStar is safe: it returns undefined rather than throwing.
      return typeof window !== 'undefined' ? window.aStar : undefined;
    });
    expect(windowAstar).toBeUndefined();
  });

  test('FSM transitions and errors: verify that attempted transitions lead to runtime errors and no visual path is painted', async ({ page }) => {
    // Verify initially there are no .cell DOM elements painted (no visualization)
    await expect(page.locator('.cell')).toHaveCount(0);

    // Because the page script failed during initialization (createStartAndEnd), there should be runtime errors captured.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Attempt to programmatically invoke an algorithm click sequence by trying to invoke the nested click handler.
    // We do not inject or patch anything; calling the nested handler requires access to the variable environment,
    // which is not available — we expect ReferenceError.
    await expect(page.evaluate(() => {
      // Trying to access a nested function that is not exposed should throw.
      return invokeNestedStartClick(); // intentionally not defined in the page scope
    })).rejects.toThrow();

    // Ensure no cells have had their style changed to indicate visualization (no red/blue backgrounds).
    // Even if some DOM nodes were created later, none should have a red or blue background set by the path visualization.
    const redOrBlueCells = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.cell'));
      return nodes.filter(n => {
        const bg = window.getComputedStyle(n).backgroundColor || n.style.background;
        return /rgb\(0, 0, 255\)|blue|rgb\(255, 0, 0\)|red/.test(bg);
      }).length;
    });
    expect(redOrBlueCells).toBe(0);
  });

  test('Edge cases: Accessing page-scoped variables via typeof vs direct reference demonstrates ReferenceError behavior', async ({ page }) => {
    // Using typeof on an undeclared variable inside evaluate is safe and returns "undefined" rather than throwing.
    // This test demonstrates the difference: typeof startButton should not throw but return "undefined".
    const typeOfStartButton = await page.evaluate(() => {
      try {
        return typeof startButton;
      } catch (e) {
        return 'THREW';
      }
    });
    // Depending on script execution, typeof may be 'undefined' (expected). It should not be the string 'THREW'
    expect(typeOfStartButton).not.toBe('THREW');

    // Direct reference to the same identifier should throw (we assert that this throws).
    await expect(page.evaluate(() => startButton)).rejects.toThrow(/startButton|is not defined|ReferenceError/);
  });

  test('Sanity check: Ensure at least one page error contains clues about createStartAndEnd or classList misuse', async ({ page }) => {
    // Combine messages and assert presence of a message mentioning classList or add or similar
    const found = pageErrors.some(msg => /createStartAndEnd|classList|add|Cannot read|is not a function|undefined/.test(msg));
    expect(found).toBeTruthy();
  });
});