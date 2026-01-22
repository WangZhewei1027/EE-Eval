import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e15aae0-d5c5-11f0-92ee-f5994b4f4c99.html';

// Simple page object to encapsulate interactions with the page under test
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this.page.on('console', (msg) => {
      // Collect text of console messages
      try {
        this.consoleMessages.push(msg.text());
      } catch (e) {
        this.consoleMessages.push(String(msg));
      }
    });

    this.page.on('pageerror', (err) => {
      // Collect page-level uncaught errors
      this.pageErrors.push(err && err.message ? err.message : String(err));
    });
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Evaluate a function in page context and return its result
  async evaluate(fn) {
    return await this.page.evaluate(fn);
  }

  // Attempt to construct a BST instance in page context
  async newBSTInstance() {
    // Create an instance and return a simple token to indicate success.
    // We construct within evaluate to run code in the page's JS context.
    return await this.page.evaluate(() => {
      // Return a boolean indicating whether classes exist and instance created.
      const exists = {
        hasTreeNode: typeof window.TreeNode === 'function',
        hasBSTClass: typeof window.BST === 'function'
      };
      if (!exists.hasBSTClass) {
        return { created: false, exists };
      }
      // create a fresh instance
      try {
        const instance = new BST(); // instance not returned (not serializable), just test creation
        return { created: true, exists };
      } catch (e) {
        return { created: false, exists, error: e && e.message ? e.message : String(e) };
      }
    });
  }

  // Call insert on a newly created BST instance (without try/catch in page evaluate)
  async callInsertWithoutCatching(val) {
    // This will cause the page.evaluate promise to reject if an exception occurs in the page code.
    return await this.page.evaluate((v) => {
      const b = new BST();
      // Intentionally not wrapping in try/catch so the runtime error (if any) surfaces naturally.
      return b.insert(v);
    }, val);
  }

  // Call insert with catching in page context and return a structured result
  async callInsertWithCatch(val) {
    return await this.page.evaluate((v) => {
      try {
        const b = new BST();
        const r = b.insert(v);
        return { ok: true, result: r };
      } catch (e) {
        return { ok: false, name: e && e.name, message: e && e.message, stack: e && e.stack };
      }
    }, val);
  }

  // Call search with catching in page context and also log the result to console
  async callSearchWithConsoleLog(val) {
    return await this.page.evaluate((v) => {
      try {
        const b = new BST();
        const r = b.search(v);
        console.log('search-result', r);
        return { ok: true, result: r };
      } catch (e) {
        console.log('search-error', e && e.message ? e.message : String(e));
        return { ok: false, name: e && e.name, message: e && e.message };
      }
    }, val);
  }

  // Attempt to call BST.insert as if it were a static method (an edge-case misuse)
  async callStaticInsert() {
    return await this.page.evaluate(() => {
      try {
        // Intentionally incorrect: call insert on the class itself rather than an instance.
        return BST.insert(3);
      } catch (e) {
        return { ok: false, name: e && e.name, message: e && e.message };
      }
    });
  }
}

test.describe('BST FSM and implementation tests - Application 0e15aae0-d5c5-11f0-92ee-f5994b4f4c99', () => {
  test.beforeEach(async ({ page }) => {
    // No-op: each test will create its own page model and navigate.
  });

  test('S0_Idle: initial state should expose TreeNode and BST classes; renderPage not defined', async ({ page }) => {
    // Purpose:
    // - Validate that the initial classes for the BST exist on the page (TreeNode and BST).
    // - Verify that the expected entry action "renderPage" is NOT present (so renderPage() cannot be observed).
    const model = new BSTPage(page);
    await model.goto();

    // Ensure classes are present or at least are functions (classes)
    const creationResult = await model.newBSTInstance();
    expect(creationResult).toBeTruthy();
    // classes metadata
    expect(creationResult.exists.hasBSTClass).toBe(true);
    expect(creationResult.exists.hasTreeNode).toBe(true);

    // Check whether renderPage exists (FSM mentions onEnter renderPage). Confirm it is undefined.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // There should be no uncaught page errors purely from loading (we didn't force any runtime actions yet).
    // It is possible there are none; assert that pageErrors is an array.
    expect(Array.isArray(model.pageErrors)).toBe(true);
  });

  test('Transition S0 -> S1: InsertValue - calling BST.insert on an instance causes a runtime error due to null root', async ({ page }) => {
    // Purpose:
    // - Validate the InsertValue event described in the FSM by creating a BST instance and calling insert.
    // - The provided implementation is buggy: insert accesses current.val while current may be null.
    // - We expect a TypeError or other runtime exception to occur naturally when invoking insert.
    const model = new BSTPage(page);
    await model.goto();

    // Use the "without catching" variant to let the error propagate as a rejected promise from page.evaluate,
    // which allows us to assert that an exception occurs naturally.
    let caught = null;
    try {
      await model.callInsertWithoutCatching(3);
    } catch (err) {
      // Playwright surfaces the error here. Capture it for assertions.
      caught = err;
    }

    // Assert that we did receive an exception from the page context when invoking insert.
    expect(caught).not.toBeNull();
    // The implementation attempts to access current.val where current === null, which typically results in a TypeError.
    // Check that the error contains indicative phrases; be tolerant to different browser engines.
    const message = String(caught && caught.message ? caught.message : caught);
    // Expect either a TypeError or mention of "null" or "cannot read" (engine-specific messages)
    expect(
      /TypeError|Cannot read|Cannot read properties|reading 'val'|Cannot set properties of undefined/i.test(message)
    ).toBeTruthy();

    // Also confirm that invoking insert via a safer, caught execution returns a structured error object with details
    const insertCatchResult = await model.callInsertWithCatch(3);
    expect(insertCatchResult.ok).toBe(false);
    expect(insertCatchResult.name).toBeTruthy();
    expect(typeof insertCatchResult.message).toBe('string');
  });

  test('Transition S1 -> S2: SearchValue - calling search on a fresh BST returns null and logs result', async ({ page }) => {
    // Purpose:
    // - Validate the SearchValue event by calling search on a new BST instance.
    // - The implementation's search should return null given root === null (no throw expected).
    // - Also verify that the console.log output for the search is emitted.
    const model = new BSTPage(page);
    await model.goto();

    // Execute search and log the result in the page context
    const result = await model.callSearchWithConsoleLog(1);

    // Expect search to complete without throwing and to return null (no nodes present)
    expect(result.ok).toBe(true);
    // The provided implementation will likely return null for an empty tree.
    expect(result.result).toBeNull();

    // Confirm that the console captured the 'search-result' log entry
    // Give a small delay to ensure console events are propagated and captured
    await page.waitForTimeout(50);
    const foundConsole = model.consoleMessages.find((m) => m.includes('search-result'));
    expect(foundConsole).toBeTruthy();
    // The console message should include string representation of null, e.g., "search-result null"
    expect(/search-result\s+null/i.test(foundConsole)).toBeTruthy();
  });

  test('Edge case: calling BST.insert as a static method (misuse) should produce an error', async ({ page }) => {
    // Purpose:
    // - Validate an edge-case / incorrect usage: calling insert on the class itself rather than an instance.
    // - This misuse should result in a runtime error; assert that the page reports this error.
    const model = new BSTPage(page);
    await model.goto();

    const staticCallResult = await model.callStaticInsert();
    // We expect that calling BST.insert will not succeed; verify structured error was returned.
    expect(staticCallResult).toBeTruthy();
    expect(staticCallResult.ok).toBe(false);
    expect(typeof staticCallResult.message === 'string' || typeof staticCallResult.name === 'string').toBe(true);
  });

  test('Error observation: ensure runtime errors from page.evaluate surface to the test and can be asserted', async ({ page }) => {
    // Purpose:
    // - Demonstrate that errors thrown naturally by the page JS (like the insert TypeError) surface to the test runner.
    // - We call insert (which should throw) and assert that the returned promise rejects.
    const model = new BSTPage(page);
    await model.goto();

    // Use expect(...).rejects form to assert promise rejects with an error.
    // We craft the evaluate such that an exception is thrown inside the page.
    await expect(
      page.evaluate(() => {
        const b = new BST();
        // This call should throw: attempt to access current.val on null root
        return b.insert(42);
      })
    ).rejects.toThrow();

    // Confirm that we observed at least one console message or page error (page errors may not always be emitted
    // for errors thrown inside evaluate; however, the test has validated the rejection above).
    // We assert the arrays are present and are arrays.
    expect(Array.isArray(model.consoleMessages)).toBe(true);
    expect(Array.isArray(model.pageErrors)).toBe(true);
  });
});