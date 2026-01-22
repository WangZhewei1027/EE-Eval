import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba87610-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Binary Tree interactive application (FSM validation)', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages (especially errors)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        try {
          consoleErrors.push(msg.text());
        } catch {
          consoleErrors.push(String(msg));
        }
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Load the page under test (we expect the page to possibly throw JS errors)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // no-op teardown, listeners are per-page and cleaned automatically by Playwright
  });

  test.describe('States (FSM) - verify initial render and evidence for Idle state', () => {
    test('S0_Idle: Page renders header and main components (h1, forms, table)', async ({ page }) => {
      // Validate initial DOM evidence for Idle state
      const header = await page.locator('h1').textContent();
      expect(header).toBeTruthy();
      expect(header.trim()).toBe('Binary Tree'); // evidence from FSM: <h1>Binary Tree</h1>

      // Ensure both forms exist
      const insertForm = page.locator('#insert-node-form');
      const searchForm = page.locator('#search-node-form');
      await expect(insertForm).toBeVisible();
      await expect(searchForm).toBeVisible();

      // Ensure the table exists with the expected headers
      const table = page.locator('#binary-tree');
      await expect(table).toBeVisible();
      await expect(table.locator('th')).toHaveCount(3);
      const headers = await table.locator('th').allTextContents();
      expect(headers.map(h => h.trim())).toEqual(['Value', 'Left Child', 'Right Child']);

      // The application HTML/JS is known to contain runtime issues.
      // We assert that a JS error occurred during page load (e.g., SyntaxError due to duplicate let)
      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);

      // At least one of the captured errors should look like a declaration/syntax error that mentions 'root' or 'already been declared' or 'SyntaxError'
      const joinedErrors = pageErrors.concat(consoleErrors).join(' | ');
      const syntaxLike = /Identifier\s+'?root'?|already been declared|SyntaxError|Unexpected token|has already been declared/i;
      expect(syntaxLike.test(joinedErrors)).toBeTruthy();
    });

    test('S1_NodeInserted and S2_NodeSearched: function definitions should be present in source but not necessarily executed', async ({ page }) => {
      // The HTML includes textual function definitions in the inline script.
      // We can still check the raw page source contains function names as text.
      const content = await page.content();
      expect(content).toContain('function insertNode(value, node) {');
      expect(content).toContain('function searchNode(value, node) {');

      // However, due to script errors during parsing/execution, these functions may not be available on window.
      // Verify that attempting to access them from the page context returns undefined or throws.
      const functionsExist = await page.evaluate(() => {
        return {
          hasInsert: typeof window.insertNode !== 'undefined',
          hasSearch: typeof window.searchNode !== 'undefined'
        };
      }).catch(() => {
        // If evaluation fails (page error), assume functions not defined
        return { hasInsert: false, hasSearch: false };
      });

      // At minimum, we expect that execution failed and these functions are not defined on the global scope
      // (This is consistent with a parse-time SyntaxError preventing script execution).
      expect(functionsExist.hasInsert || functionsExist.hasSearch).toBe(false);
    });
  });

  test.describe('Events and Transitions (FSM) - interactions validation', () => {
    test('InsertNode event: submitting the insert form should not crash the test runner; table remains unchanged due to runtime errors', async ({ page }) => {
      // Fill the insert form's input. Note: there are duplicate inputs with id="value" in the markup;
      // select the input inside the insert form to avoid ambiguity.
      const insertInput = page.locator('#insert-node-form input[type="number"]');
      await expect(insertInput).toBeVisible();
      await insertInput.fill('10');

      // Click the Insert button; forms have no action and may trigger navigation/reload.
      const insertButton = page.locator('#insert-node-form button[type="submit"]');
      await expect(insertButton).toBeVisible();

      // Submit the form; allow page navigation if it happens but do not modify page internals.
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 2000 }).catch(() => null),
        insertButton.click()
      ]);

      // After submit, the script issues are expected to persist. Verify the tree-body remains empty (no rows added).
      const treeBody = page.locator('#tree-body');
      const rowCount = await treeBody.locator('tr').count();
      // Because the inline displayTree is broken, we expect 0 rows in tbody
      expect(rowCount).toBeLessThanOrEqual(0);

      // Confirm that page errors were recorded (syntax or runtime)
      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);
      const joined = pageErrors.concat(consoleErrors).join(' | ');
      expect(/Identifier\s+'?root'?|already been declared|TypeError|ReferenceError|SyntaxError/i.test(joined)).toBeTruthy();
    });

    test('SearchNode event: submitting the search form should not show a result element and should surface JS errors', async ({ page }) => {
      // Fill the search form's input (choose the one within search form explicitly)
      const searchInput = page.locator('#search-node-form input[type="number"]');
      await expect(searchInput).toBeVisible();
      await searchInput.fill('5');

      const searchButton = page.locator('#search-node-form button[type="submit"]');
      await expect(searchButton).toBeVisible();

      // Submit the search form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 2000 }).catch(() => null),
        searchButton.click()
      ]);

      // There is no dedicated result area in the implementation; any search feedback would come from alert()
      // Because the inline script failed to execute, we expect no alert and no DOM changes to indicate a search result.
      // Check that tree-body still has no rows added as a result of search submit.
      const treeBody = page.locator('#tree-body');
      const rowCount = await treeBody.locator('tr').count();
      expect(rowCount).toBeLessThanOrEqual(0);

      // Ensure JS errors are still present and include a syntax-like message
      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);
      const joined = pageErrors.concat(consoleErrors).join(' | ');
      expect(/Identifier\s+'?root'?|already been declared|TypeError|ReferenceError|SyntaxError/i.test(joined)).toBeTruthy();
    });

    test('DisplayTree event: clicking the table should not populate rows because displayTree did not execute properly', async ({ page }) => {
      // Click the table body / table to simulate DisplayTree event (the FSM expects clicking #binary-tree)
      const table = page.locator('#binary-tree');
      await expect(table).toBeVisible();

      // Click the table - any event handler would be attached by the broken script, so likely nothing happens.
      await table.click();

      // Verify no new rows or cells were appended to '#tree-body'
      const treeBody = page.locator('#tree-body');
      const cells = await treeBody.locator('td').count();
      expect(cells).toBe(0);

      // Confirm that the displayTree textual evidence exists in source, even if not executed
      const source = await page.content();
      expect(source).toContain('displayTree(root);');

      // Again, assert that JS errors exist
      expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);
    });
  });

  test.describe('Edge cases & error scenarios', () => {
    test('Attempt to access global variables/functions should reflect script parse/execution failure', async ({ page }) => {
      // Try to read `root` from the page. Because the script redeclares `root` with let twice,
      // the script likely failed to execute, so `root` should be undefined on window.
      const rootType = await page.evaluate(() => {
        try {
          // Access as a property of window to avoid ReferenceError if not defined.
          return typeof window.root;
        } catch (err) {
          return 'error:' + String(err && err.message ? err.message : err);
        }
      }).catch((e) => 'error:' + String(e));

      // Expect that root is not a usable object; either 'undefined' or an error occurred.
      expect(/undefined|error/.test(rootType)).toBeTruthy();

      // Try to call insertNode via page.evaluate, which should either be undefined or throw if not present.
      const insertCallResult = await page.evaluate(() => {
        try {
          if (typeof window.insertNode === 'function') {
            // If present (unexpected), attempt to call it defensively
            return { invoked: true, resultType: typeof window.insertNode(1, window.root) };
          } else {
            return { invoked: false };
          }
        } catch (err) {
          return { invoked: false, error: String(err && err.message ? err.message : err) };
        }
      }).catch(e => ({ invoked: false, error: String(e) }));

      // We expect that insertNode is not invocable due to earlier script failure.
      expect(insertCallResult.invoked).toBe(false);

      // Ensure errors captured include syntax/parse/runtime variety
      const allErrors = pageErrors.concat(consoleErrors).join(' | ');
      expect(/Identifier\s+'?root'?|already been declared|SyntaxError|TypeError|ReferenceError/i.test(allErrors)).toBeTruthy();
    });
  });
});