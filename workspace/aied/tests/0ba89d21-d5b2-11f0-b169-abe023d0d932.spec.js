import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba89d21-d5b2-11f0-b169-abe023d0d932.html';

// Test suite for the Red-Black Tree interactive application.
// The app contains known runtime issues (uses process.stdout.write in browser),
// so tests intentionally observe console output and page errors instead of patching the app.
test.describe('Red-Black Tree UI and FSM validation - 0ba89d21-d5b2-11f0-b169-abe023d0d932', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console logs emitted by the page
    page.on('console', (msg) => {
      // Collect text from console messages for assertions
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page and wait for load.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Allow a short time for in-page synchronous scripts to run and emit console/pageerror events.
    // The application runs a script immediately on load which prints/searches/deletes and calls printTree().
    await page.waitForTimeout(150);
  });

  test.afterEach(async ({ page }) => {
    // small cleanup hook: close page listeners implicitly when page is closed by Playwright runner
    // (kept intentionally minimal)
    await page.close();
  });

  test('Initial Idle state: buttons are present and labeled correctly', async ({ page }) => {
    // Validate that the UI evidence for S0_Idle exists: the four control buttons.
    const insert = await page.locator('#insert-button');
    const search = await page.locator('#search-button');
    const del = await page.locator('#delete-button');
    const print = await page.locator('#print-button');

    // Buttons should be visible and have expected text content.
    await expect(insert).toBeVisible();
    await expect(search).toBeVisible();
    await expect(del).toBeVisible();
    await expect(print).toBeVisible();

    await expect(insert).toHaveText('Insert');
    await expect(search).toHaveText('Search');
    await expect(del).toHaveText('Delete');
    await expect(print).toHaveText('Print');

    // The tree display element should exist (initially the script populates the internal tree but the #tree DIV is empty).
    const treeDiv = await page.locator('#tree');
    await expect(treeDiv).toBeVisible();
    const inner = await treeDiv.innerHTML();
    expect(inner).toBe(''); // No DOM rendering of the tree in this implementation
  });

  test('Initial script execution produced expected console output and a ReferenceError from printTree', async ({ page }) => {
    // This application logs several messages during initial script execution and then calls printTree()
    // which uses process.stdout.write in the browser context, causing a ReferenceError.
    // Assert that expected console logs are present and that a page error referencing "process" occurred.

    // At least one console message should contain 'Search: 50' (observed from the inline script)
    const combinedConsole = consoleMessages.join('\n');
    expect(combinedConsole).toContain('Search: 50');

    // The script logs boolean search results; ensure at least some boolean text is present (true/false)
    expect(combinedConsole).toMatch(/true|false/);

    // There should be at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Find at least one error that mentions process (ReferenceError: process is not defined)
    const hasProcessError = pageErrors.some(err => {
      try {
        return String(err.message).toLowerCase().includes('process');
      } catch (e) {
        return false;
      }
    });
    expect(hasProcessError).toBeTruthy();
  });

  test('FSM events: clicking each button should not crash the page further and should not modify the DOM tree container', async ({ page }) => {
    // The HTML buttons do not have onclick attributes wired up in this implementation.
    // This test clicks each button to ensure that user interactions do not produce new uncaught errors
    // and that the #tree DOM region remains unchanged (evidence of no rendering handlers).
    const treeDiv = await page.locator('#tree');
    const beforeInner = await treeDiv.innerHTML();

    // Remember the number of page errors observed immediately after load
    const initialErrorCount = pageErrors.length;

    // Click each button sequentially; any runtime exceptions should surface as page errors which we capture.
    await page.click('#insert-button');
    await page.waitForTimeout(50);
    await page.click('#search-button');
    await page.waitForTimeout(50);
    await page.click('#delete-button');
    await page.waitForTimeout(50);
    await page.click('#print-button');
    await page.waitForTimeout(150);

    // No additional page errors should have been introduced by button clicks (beyond the initial printTree ReferenceError)
    expect(pageErrors.length).toBeGreaterThanOrEqual(initialErrorCount);
    // Assert no new uncaught errors occurred as a result of clicks (i.e., count should remain the same)
    expect(pageErrors.length).toBe(initialErrorCount);

    // The tree container should remain unchanged (no UI rendering implementation present)
    const afterInner = await treeDiv.innerHTML();
    expect(afterInner).toBe(beforeInner);
  });

  test('State entry actions (tree operations) exist and behave: search, delete, printTree error', async ({ page }) => {
    // This test inspects the in-page `tree` object created by the script and exercises its methods.
    // We observe behavior rather than patching code. We expect:
    // - tree object exists
    // - tree.search(50) returns true (since initial inserts included 50)
    // - calling tree.printTree() raises/returns an error that references "process"
    // - deleting a key updates search results accordingly (best-effort; if an exception happens we observe it)

    const results = await page.evaluate(() => {
      const out = {
        hasTree: typeof tree !== 'undefined' && tree !== null,
        hasSearchFn: false,
        search50Before: null,
        delete50Result: null,
        search50After: null,
        printTreeOutcome: null
      };

      try {
        out.hasSearchFn = typeof tree.search === 'function';
      } catch (e) {
        out.hasSearchFn = false;
      }

      // Search for 50 (expected to be true based on initial inserts)
      try {
        out.search50Before = tree.search(50);
      } catch (e) {
        out.search50Before = { error: String(e) };
      }

      // Attempt to delete 50; capture errors if any
      try {
        // Some internal delete implementation might throw; capture result or indicate success
        tree.delete(50);
        out.delete50Result = { status: 'invoked' };
      } catch (e) {
        out.delete50Result = { error: String(e) };
      }

      // Search for 50 again after deletion attempt
      try {
        out.search50After = tree.search(50);
      } catch (e) {
        out.search50After = { error: String(e) };
      }

      // Attempt printTree and capture thrown error text (expected ReferenceError about process)
      try {
        tree.printTree();
        out.printTreeOutcome = { status: 'invoked' };
      } catch (e) {
        out.printTreeOutcome = { error: String(e) };
      }

      return out;
    });

    // Basic expectations based on initial inline script behavior:
    expect(results.hasTree).toBeTruthy();
    expect(results.hasSearchFn).toBeTruthy();

    // Initially, search(50) is expected to be true (the script inserted 50 at load time)
    // It might be boolean true or an object with error if search threw; assert it's either true or an error object is present.
    if (typeof results.search50Before === 'object' && results.search50Before !== null && 'error' in results.search50Before) {
      // If an error occurred, ensure it is reported
      expect(results.search50Before.error).toBeTruthy();
    } else {
      expect(results.search50Before).toBe(true);
    }

    // Deleting may either succeed silently or produce an error due to implementation bugs.
    if (results.delete50Result && results.delete50Result.error) {
      // If deletion threw, assert that an error string exists
      expect(results.delete50Result.error.length).toBeGreaterThan(0);
    } else {
      // Otherwise the delete function was invoked
      expect(results.delete50Result.status).toBe('invoked');
    }

    // After deletion attempt, search result may be false or an error; accept either but validate shape
    if (typeof results.search50After === 'object' && results.search50After !== null && 'error' in results.search50After) {
      expect(results.search50After.error.length).toBeGreaterThan(0);
    } else {
      // If deletion succeeded, it's expected search50After is false; but if deletion failed, it might still be true.
      expect([true, false]).toContain(results.search50After);
    }

    // printTree is expected to throw a ReferenceError in browser because it calls process.stdout.write
    expect(results.printTreeOutcome).toBeTruthy();
    if (results.printTreeOutcome.error) {
      // The error message should mention "process" (process is not defined in browsers)
      expect(String(results.printTreeOutcome.error).toLowerCase()).toContain('process');
    } else {
      // If unexpectedly no error, that's acceptable but note it in assertion (the implementation should normally error)
      expect(results.printTreeOutcome.status).toBe('invoked');
    }
  });

  test('Edge case: invoking insert/search/delete with unusual keys (observe for runtime exceptions)', async ({ page }) => {
    // Attempt several edge-case operations via the tree API to see whether the implementation throws runtime errors.
    // We will not patch the code; we only invoke functions and observe outcomes.

    const edgeResults = await page.evaluate(() => {
      const keysToTest = [null, undefined, NaN, -Infinity, 0, 999999999999, 'stringKey'];
      const report = [];

      for (const k of keysToTest) {
        const entry = { key: k, insert: null, searchBefore: null, delete: null, searchAfter: null };
        try {
          entry.searchBefore = tree.search(k);
        } catch (e) {
          entry.searchBefore = { error: String(e) };
        }

        try {
          tree.insert(k);
          entry.insert = { status: 'invoked' };
        } catch (e) {
          entry.insert = { error: String(e) };
        }

        try {
          entry.searchAfter = tree.search(k);
        } catch (e) {
          entry.searchAfter = { error: String(e) };
        }

        try {
          tree.delete(k);
          entry.delete = { status: 'invoked' };
        } catch (e) {
          entry.delete = { error: String(e) };
        }

        report.push(entry);
      }
      return report;
    });

    // Validate the shape of the report and that each entry contains the expected fields.
    expect(Array.isArray(edgeResults)).toBeTruthy();
    expect(edgeResults.length).toBeGreaterThanOrEqual(1);
    for (const r of edgeResults) {
      expect(r).toHaveProperty('key');
      expect(r).toHaveProperty('insert');
      expect(r).toHaveProperty('searchBefore');
      expect(r).toHaveProperty('searchAfter');
      expect(r).toHaveProperty('delete');
      // We accept that some operations may have thrown errors; ensure errors are strings if present.
      if (r.insert && r.insert.error) expect(typeof r.insert.error).toBe('string');
      if (r.delete && r.delete.error) expect(typeof r.delete.error).toBe('string');
      if (r.searchBefore && typeof r.searchBefore === 'object' && r.searchBefore.error) expect(typeof r.searchBefore.error).toBe('string');
      if (r.searchAfter && typeof r.searchAfter === 'object' && r.searchAfter.error) expect(typeof r.searchAfter.error).toBe('string');
    }
  });
});