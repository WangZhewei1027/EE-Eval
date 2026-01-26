import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b00e52-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Application: Red-Black Tree (FSM f5b00e52-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Shared holders for console and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test and navigate to the page exactly as-is.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page and wait for full load. We must load the page exactly as-is.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners by creating a new blank page (Playwright will clean up automatically),
    // but we ensure no further side-effects here. This is mainly a placeholder for teardown.
    // No modification of the application is performed.
    await page.close();
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('Initial render: Idle state should present "Display Tree" button and empty #tree', async ({ page }) => {
      // Validate that the Display Tree button exists and is visible
      const button = page.locator('button[onclick="displayTree()"]');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Display Tree');

      // Validate that the tree container exists and is initially empty
      const tree = page.locator('#tree');
      await expect(tree).toBeVisible();
      await expect(tree).toBeEmpty();

      // Assert that there were no uncaught page errors during initial load
      // (we observe and assert the current captured pageErrors array)
      expect(pageErrors.length).toBe(0);

      // Collect console messages at load; assert they exist but not errors
      // (we don't expect any particular console output, but we ensure no console.error messages)
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });

    test('Entry action renderPage() is not defined in implementation — invoking it should throw ReferenceError', async ({ page }) => {
      // The FSM indicates an entry_action renderPage(), but the HTML implementation does not define it.
      // Calling renderPage() from the page context should result in a ReferenceError.
      await expect(page.evaluate(() => {
        // Intentionally call missing function to let ReferenceError happen naturally
        // We do not redefine or patch anything on the page.
        return renderPage();
      })).rejects.toThrow(/ReferenceError|is not defined/);
    });
  });

  test.describe('Transition: DisplayTree (S0_Idle -> S1_TreeDisplayed)', () => {
    test('Clicking "Display Tree" shows the tree structure in #tree and matches expected HTML', async ({ page }) => {
      // Ensure initial state
      await expect(page.locator('#tree')).toBeEmpty();

      // Click the Display Tree button to trigger displayTree()
      await page.click('button[onclick="displayTree()"]');

      // After clicking, #tree.innerHTML should be populated with three <p> lines.
      const treeInner = await page.locator('#tree').innerHTML();

      // Build expected HTML based on the implementation's stringification of objects.
      // The implementation iterates keys "1","2","3" and appends <p>${node}: ${tree[node]}</p>
      // where tree[node] is an object, so it stringifies to "[object Object]".
      const expectedHtml = '<p>1: [object Object]</p><p>2: [object Object]</p><p>3: [object Object]</p>';

      expect(treeInner).toBe(expectedHtml);

      // Also verify that the visible text matches the expected lines
      const visibleText = await page.locator('#tree').textContent();
      expect(visibleText).toContain('1: [object Object]');
      expect(visibleText).toContain('2: [object Object]');
      expect(visibleText).toContain('3: [object Object]');

      // Verify no uncaught page errors were emitted as part of this transition
      expect(pageErrors.length).toBe(0);

      // Validate no console.error messages associated with click/display
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Clicking the button multiple times is idempotent (still shows same treeHtml)', async ({ page }) => {
      // Click once
      await page.click('button[onclick="displayTree()"]');
      const first = await page.locator('#tree').innerHTML();

      // Click second time
      await page.click('button[onclick="displayTree()"]');
      const second = await page.locator('#tree').innerHTML();

      // Content should be identical (the implementation sets innerHTML, not appending)
      expect(first).toBe(second);

      // Expect exactly three <p> elements
      const pCount = await page.locator('#tree p').count();
      expect(pCount).toBe(3);
    });

    test('DOM structure after display: each <p> contains node id and object-string for node value', async ({ page }) => {
      await page.click('button[onclick="displayTree()"]');

      // Validate each paragraph's text content specifically and ordering
      const paragraphs = page.locator('#tree p');
      await expect(paragraphs.nth(0)).toHaveText('1: [object Object]');
      await expect(paragraphs.nth(1)).toHaveText('2: [object Object]');
      await expect(paragraphs.nth(2)).toHaveText('3: [object Object]');
    });
  });

  test.describe('Edge cases and error scenarios (observe natural errors)', () => {
    test('Invoking an explicitly undefined function triggers a ReferenceError and is captured as a pageerror', async ({ page }) => {
      // Ensure we start with zero captured page errors
      expect(pageErrors.length).toBe(0);

      // Evaluate a call to a clearly undefined function; this should throw in the page context.
      // We wrap the expect around the evaluate promise to assert a rejection with ReferenceError.
      await expect(page.evaluate(() => {
        // Intentionally trigger a ReferenceError in the page
        // This lets us observe the runtime behavior without modifying the page.
        return nonExistentFunctionCallThatDoesNotExist();
      })).rejects.toThrow(/ReferenceError|is not defined/);

      // Give the pageerror handler a brief moment to collect the error (if it emits asynchronously)
      // (Normally page.error is emitted synchronously for such evals, but we ensure stability)
      await page.waitForTimeout(50);

      // Assert that at least one pageerror was captured
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // The first page error message should mention ReferenceError or the undefined identifier name
      const firstErr = pageErrors[0];
      expect(String(firstErr)).toMatch(/ReferenceError|is not defined/);
    });

    test('Attempting to call displayTree via page.evaluate works (function exists) and does not throw', async ({ page }) => {
      // Ensure the displayTree function exists in the page and can be invoked directly via evaluate
      // This validates that the event handler present on the button corresponds to a callable function.
      await expect(page.evaluate(() => {
        // Call the function directly; it should execute and return undefined (no explicit return)
        return displayTree();
      })).resolves.toBeUndefined();

      // After calling, #tree should contain expected HTML as in previous tests
      const treeHtml = await page.locator('#tree').innerHTML();
      const expectedHtml = '<p>1: [object Object]</p><p>2: [object Object]</p><p>3: [object Object]</p>';
      expect(treeHtml).toBe(expectedHtml);

      // No page errors should have been produced by calling displayTree directly
      expect(pageErrors.length).toBe(0);
    });

    test('Observing console output: ensure no console.error messages during normal interactions', async ({ page }) => {
      // Clear any messages collected so far
      consoleMessages = [];
      pageErrors = [];

      // Perform a normal interaction
      await page.click('button[onclick="displayTree()"]');

      // Wait briefly for any console activity
      await page.waitForTimeout(50);

      // Ensure no page errors occurred
      expect(pageErrors.length).toBe(0);

      // Ensure no console.error messages were emitted
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });
  });
});