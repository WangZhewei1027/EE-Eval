import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2a661-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the B-Tree demo page
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleMessages = [];

    // Collect page errors and console messages for assertions
    this.page.on('pageerror', (err) => {
      // store error objects for later assertions
      this.pageErrors.push(err);
    });

    this.page.on('console', (msg) => {
      // store console messages
      this.consoleMessages.push(msg);
    });
  }

  // Navigate to the app URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Demonstrate button
  async clickDemonstrate() {
    await this.page.click('#demonstration-button');
  }

  // Return current innerHTML of the main text paragraph
  async getMainText() {
    return this.page.$eval('#text', (el) => el.innerHTML);
  }

  // Return whether the demonstration button is visible
  async isDemonstrationButtonVisible() {
    return this.page.isVisible('#demonstration-button');
  }

  // Wait for a single pageerror event and return it
  async waitForPageError(timeout = 3000) {
    return this.page.waitForEvent('pageerror', { timeout });
  }

  // Return numbers of captured page errors so far
  getCapturedPageErrorsCount() {
    return this.pageErrors.length;
  }

  // Return captured console messages
  getCapturedConsoleMessages() {
    return this.consoleMessages;
  }

  // Check if expected global functions are defined in the page
  async getDefinedFunctions() {
    return this.page.evaluate(() => {
      return {
        generateBTreeIndex: typeof generateBTreeIndex,
        rebalanceBTree: typeof rebalanceBTree,
        rotateLeft: typeof rotateLeft,
        rotateRight: typeof rotateRight,
        insertData: typeof insertData,
        display: typeof display,
        insert: typeof insert,
        search: typeof search
      };
    });
  }

  // Small helper to click and collect any resulting pageerror (non-blocking)
  async clickAndCollectError() {
    const errorPromise = this.page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null);
    await this.clickDemonstrate();
    const err = await errorPromise;
    return err;
  }
}

test.describe('B-Tree Index FSM and Implementation Tests', () => {
  // Basic smoke test verifying the page loads and Idle (S0_Idle) state is correct
  test('S0_Idle: initial render shows explanation and demonstration button without errors', async ({ page }) => {
    // Arrange - create page object and navigate
    const btPage = new BTreePage(page);
    await btPage.goto();

    // Assert - main heading and explanation paragraphs are present
    const title = await page.textContent('h1');
    expect(title).toContain('B-Tree Index');

    const mainText = await btPage.getMainText();
    // The application places a descriptive paragraph in #text
    expect(mainText).toContain('A B-Tree index is a data structure');

    const explanation = await page.textContent('#explanation');
    expect(explanation).toContain('self-balancing search tree');

    // Demonstration button should be visible and contain the expected label
    expect(await btPage.isDemonstrationButtonVisible()).toBeTruthy();
    const buttonText = await page.textContent('#demonstration-button');
    expect(buttonText).toBe('Demonstrate B-Tree Index');

    // No page errors should have been emitted yet (Idle state)
    expect(btPage.getCapturedPageErrorsCount()).toBe(0);

    // No console error messages recorded initially
    const consoleMsgs = btPage.getCapturedConsoleMessages();
    // There may be non-error console messages; assert no console.error was called by checking types
    const hasConsoleError = consoleMsgs.some(m => m.type() === 'error');
    expect(hasConsoleError).toBeFalsy();
  });

  // Tests for the Demonstrate click event and the S1_Demonstrating transition
  test.describe('S1_Demonstrating: clicking the Demonstrate button triggers insertData/display (and errors)', () => {
    // Verify that expected functions exist on the window before interaction
    test('page exposes B-Tree related functions', async ({ page }) => {
      const btPage = new BTreePage(page);
      await btPage.goto();

      const funcs = await btPage.getDefinedFunctions();
      // The implementation attempts to declare these functions; they should be functions
      expect(funcs.generateBTreeIndex).toBe('function');
      expect(funcs.rebalanceBTree).toBe('function');
      expect(funcs.rotateLeft).toBe('function');
      expect(funcs.rotateRight).toBe('function');
      expect(funcs.insertData).toBe('function');
      expect(funcs.display).toBe('function');
      expect(funcs.insert).toBe('function');
      expect(funcs.search).toBe('function');
    });

    test('DemonstrateClick transition: clicking the button attempts to build/display B-Tree and results in a runtime TypeError', async ({ page }) => {
      const btPage = new BTreePage(page);
      await btPage.goto();

      // Precondition: main text is unchanged
      const beforeText = await btPage.getMainText();
      expect(beforeText).toContain('A B-Tree index is a data structure');

      // Act: click the button and wait for pageerror (the implementation has a known bug that will cause a TypeError)
      const pageError = await btPage.clickAndCollectError();

      // Assert: a page error (runtime exception) should be emitted during the demonstration attempt
      expect(pageError).not.toBeNull();
      // The error message should indicate a TypeError (cannot read property/right of undefined/null)
      expect(pageError.message).toMatch(/TypeError|Cannot read properties|Cannot read property/i);

      // After the failed attempt, the visible #text paragraph should not have received the intended 'Key: ...' display content
      const afterText = await btPage.getMainText();
      // If display had worked, it would append "Key: ..." strings; ensure none were appended
      expect(afterText).toBe(beforeText);

      // Confirm that console recorded an error-level message (depending on browser this may be reported as console.error)
      const consoleErrors = btPage.getCapturedConsoleMessages().filter(m => m.type() === 'error');
      // It is acceptable if the runtime exception is only surfaced as a pageerror and not console.error;
      // Assert that either a console error exists or at least one pageerror was captured (we already asserted pageError).
      expect(btPage.getCapturedPageErrorsCount() >= 1 || consoleErrors.length >= 1).toBeTruthy();
    });

    test('Clicking multiple times produces multiple captured errors (edge-case robustness)', async ({ page }) => {
      const btPage = new BTreePage(page);
      await btPage.goto();

      // Click the button three times; each click should attempt the same flawed sequence and emit an error
      const errorPromises = [];
      for (let i = 0; i < 3; i++) {
        // set up a wait for pageerror for each click; allow short timeout so test proceeds
        errorPromises.push(btPage.page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null));
        await btPage.clickDemonstrate();
      }

      // Await all error promises
      const errors = await Promise.all(errorPromises);

      // We expect at least one non-null error, and likely multiple depending on how the runtime surfaces them.
      const nonNullErrors = errors.filter(e => e !== null);
      expect(nonNullErrors.length).toBeGreaterThanOrEqual(1);

      // Each captured error should look like a TypeError or similar property access failure
      for (const err of nonNullErrors) {
        expect(err.message).toMatch(/TypeError|Cannot read properties|Cannot read property/i);
      }
    });
  });

  // Negative and edge-case testing for search/insert function behavior via direct invocation
  test.describe('Edge cases & direct function invocations', () => {
    test('Direct calls to insert/search operate without throwing synchronously when used with safe inputs', async ({ page }) => {
      const btPage = new BTreePage(page);
      await btPage.goto();

      // Call insert with a null node to ensure it returns a node object rather than throwing
      const inserted = await page.evaluate(() => {
        try {
          // Use the declared insert function: insert(key, value, node)
          const node = insert('Zed', 99, null);
          return {
            ok: true,
            hasKey: !!node && node.key === 'Zed' && typeof node.left !== 'undefined' && typeof node.right !== 'undefined'
          };
        } catch (e) {
          return { ok: false, message: e && e.message };
        }
      });

      expect(inserted.ok).toBe(true);
      expect(inserted.hasKey).toBe(true);

      // Search for the inserted key in the newly created node should succeed
      const searchResult = await page.evaluate(() => {
        try {
          const root = insert('Zed', 99, null);
          return { found: search('Zed', root) };
        } catch (e) {
          return { found: false, error: e && e.message };
        }
      });

      expect(searchResult.found).toBe(true);
    });

    test('Calling generateBTreeIndex directly returns undefined (edge behavior) and does not throw, but display(root) will be ineffective', async ({ page }) => {
      const btPage = new BTreePage(page);
      await btPage.goto();

      // generateBTreeIndex is known to not return the constructed root (code bug). We assert that behavior.
      const genResult = await page.evaluate(() => {
        try {
          const out = generateBTreeIndex([
            ['Tom', 1],
            ['Jerry', 2]
          ]);
          return { typeofOut: typeof out, out: out === undefined };
        } catch (e) {
          return { error: e && e.message };
        }
      });

      // The function doesn't explicitly return a root, so out should be undefined
      expect(genResult.out).toBe(true);

      // Attempting to call display on undefined should be a no-op because display checks node != null,
      // but in other cases the internal rebalancing in generateBTreeIndex may have thrown; verify no new page error beyond what may already exist.
      // We'll confirm that calling display(undefined) does not throw by invoking it explicitly:
      const displaySafe = await page.evaluate(() => {
        try {
          display(undefined);
          return { ok: true };
        } catch (e) {
          return { ok: false, message: e && e.message };
        }
      });

      expect(displaySafe.ok).toBe(true);
    });
  });
});