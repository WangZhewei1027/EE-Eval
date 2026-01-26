import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b14a1-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object encapsulating common interactions and queries for the BST app UI.
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      addBranch: '#add-branch',
      removeBranch: '#remove-branch',
      inputText: '#input-text',
      addNode: '#add-node',
      removeNode: '#remove-node',
      clearBranch: '#clear-branch',
      clearNode: '#clear-node',
      searchNode: '#search-node',
      insertNode: '#insert-node',
      deleteNode: '#delete-node',
      printBst: '#print-bst',
      resetBst: '#reset-bst',
      displayBst: '#display-bst'
    };
  }

  // Navigate to the app and collect any pageerrors and console messages that occur during load.
  async navigateAndCollectDiagnostics(timeout = 200) {
    const pageErrors = [];
    const consoleMessages = [];

    this.page.on('pageerror', (err) => {
      // Collect page-level errors (uncaught exceptions)
      pageErrors.push(err);
    });
    this.page.on('console', (msg) => {
      // Collect console messages for later inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application URL
    await this.page.goto(APP_URL);

    // Give the page a moment to emit any asynchronous diagnostics triggered during load.
    await this.page.waitForTimeout(timeout);

    return { pageErrors, consoleMessages };
  }

  // Get text content of a selector
  async getText(selector) {
    return this.page.locator(selector).innerText();
  }

  // Check element exists
  async exists(selector) {
    return await this.page.locator(selector).count().then(c => c > 0);
  }

  // Fill the input with value
  async fillInput(value) {
    const input = this.page.locator(this.selectors.inputText);
    await input.fill(value);
  }

  // Get input value
  async inputValue() {
    return this.page.locator(this.selectors.inputText).inputValue();
  }

  // Click a button
  async click(selector) {
    await this.page.click(selector);
  }

  // Return typeof a global name in page context
  async typeofGlobal(name) {
    return this.page.evaluate((n) => typeof window[n], name);
  }
}

test.describe('Binary Search Tree Application (FSM-driven tests)', () => {
  // Grouping: UI presence related tests
  test.describe('UI presence and structure', () => {
    test('Initial load renders DOM elements defined in the FSM', async ({ page }) => {
      const app = new BSTPage(page);

      // Navigate and collect diagnostics (errors/console)
      const { pageErrors } = await app.navigateAndCollectDiagnostics();

      // Verify all expected controls exist in the DOM regardless of runtime script errors
      const selectors = Object.values(app.selectors);
      for (const sel of selectors) {
        const exists = await app.exists(sel);
        expect(exists, `Expected selector ${sel} to exist in DOM`).toBeTruthy();
      }

      // Verify button labels / placeholder text where applicable
      expect(await app.getText(app.selectors.addBranch)).toContain('Add Branch');
      expect(await app.getText(app.selectors.removeBranch)).toContain('Remove Branch');
      expect(await app.page.locator(app.selectors.inputText).getAttribute('placeholder')).toContain('Enter node value');
      expect(await app.getText(app.selectors.addNode)).toContain('Add Node');
      expect(await app.getText(app.selectors.printBst)).toContain('Print BST');

      // The implementation tries to instantiate BinarySearchTree at the top-level script.
      // This should raise a ReferenceError on page load; assert that at least one page error occurred.
      expect(pageErrors.length).toBeGreaterThan(0);
      // Assert that the error message references the missing BinarySearchTree symbol.
      const messages = pageErrors.map(e => String(e.message || e));
      const found = messages.some(m => /BinarySearchTree/i.test(m) && /is not defined|not defined/i.test(m));
      expect(found, `Expected a ReferenceError mentioning BinarySearchTree; got: ${messages.join(' || ')}`).toBeTruthy();
    });
  });

  // Grouping: Runtime error behavior (we allow errors to happen; tests assert they occur)
  test.describe('Runtime errors and missing definitions', () => {
    test('Page should surface a ReferenceError for missing BinarySearchTree on load', async ({ page }) => {
      const app = new BSTPage(page);

      // Listen for a pageerror and navigate concurrently to reliably capture the error thrown during script execution.
      const [pageError] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.goto(APP_URL)
      ]);

      // Basic assertions about the page error
      expect(pageError).toBeTruthy();
      const msg = String(pageError.message || pageError);
      expect(msg).toMatch(/BinarySearchTree/i);
      expect(msg).toMatch(/is not defined|not defined/i);
    });

    test('Global functions expected by the FSM are undefined due to early script failure', async ({ page }) => {
      const app = new BSTPage(page);

      // Navigate and collect diagnostics to ensure page script had a chance to run (and fail)
      await app.navigateAndCollectDiagnostics();

      // The FSM lists many functions. Because script execution fails early, these should not be defined.
      const fns = [
        'addBranch', 'removeBranch', 'addNode', 'removeNode',
        'clearBranch', 'clearNode', 'searchNode', 'insertNode',
        'deleteNode', 'printBst', 'resetBst', 'displayBst',
        // Also there are duplicate helper names at the end of the script
        'print', 'reset', 'clear', 'display'
      ];

      for (const fn of fns) {
        const typeofFn = await app.typeofGlobal(fn);
        expect(typeofFn).toBe('undefined');
      }
    });

    test('Attempting to construct BinarySearchTree inside page context throws a ReferenceError', async ({ page }) => {
      // Ensure the page is loaded first (the constructor is not defined)
      await page.goto(APP_URL);

      // Expect a page.evaluate that tries to call new BinarySearchTree() to reject with a ReferenceError.
      await expect(page.evaluate(() => {
        // This will throw in the page context because BinarySearchTree is not defined.
        // We return something to ensure the Promise rejects on the thrown error.
        // Note: This is intentionally invoking the missing symbol as part of the test requirements.
        // eslint-disable-next-line no-undef
        return new BinarySearchTree();
      })).rejects.toThrow(/BinarySearchTree/i);
    });
  });

  // Grouping: Event interaction expectations (given the script failed early)
  test.describe('Event interactions and edge cases', () => {
    test('Clicking each button when handlers are not attached should not clear the input value', async ({ page }) => {
      const app = new BSTPage(page);

      // Navigate and allow pageerror to occur
      await app.navigateAndCollectDiagnostics();

      // Fill the input with a sentinel value
      await app.fillInput('42');

      // Click each button defined in the FSM. Because event listeners weren't attached (script failed),
      // clicking should not clear the input value. This validates the side-effect absence.
      const clickOrder = [
        app.selectors.addBranch,
        app.selectors.removeBranch,
        app.selectors.addNode,
        app.selectors.removeNode,
        app.selectors.clearBranch,
        app.selectors.clearNode,
        app.selectors.searchNode,
        app.selectors.insertNode,
        app.selectors.deleteNode,
        app.selectors.printBst,
        app.selectors.resetBst,
        app.selectors.displayBst
      ];

      for (const sel of clickOrder) {
        await app.click(sel);
        // After clicking, ensure the input still contains our sentinel value.
        const value = await app.inputValue();
        expect(value).toBe('42', `Clicking ${sel} unexpectedly changed the input value`);
      }
    });

    test('All FSM-declared UI components are present and accessible (edge case checking)', async ({ page }) => {
      const app = new BSTPage(page);

      await app.navigateAndCollectDiagnostics();

      // Validate each selector corresponds to exactly one element and that it is visible.
      for (const [key, sel] of Object.entries(app.selectors)) {
        const locator = page.locator(sel);
        const count = await locator.count();
        expect(count, `Expected exactly one element for ${sel}`).toBeGreaterThan(0);
        // Ensure element is attached and visible in the layout (some may be styled but should be present)
        expect(await locator.first().isVisible(), `Expected ${sel} to be visible`).toBeTruthy();
      }
    });

    test('No stealthy global repairs: globals remain undefined and page recovers no functions after user clicks', async ({ page }) => {
      const app = new BSTPage(page);

      // Navigate and gather diagnostics (this triggers the ReferenceError)
      await app.navigateAndCollectDiagnostics();

      // Click some buttons to exercise any late-bound handlers if they existed.
      await app.click(app.selectors.addBranch);
      await app.click(app.selectors.addNode);
      await app.click(app.selectors.printBst);

      // Verify that no new global functions have been introduced by clicking actions.
      const functionNames = ['addBranch', 'addNode', 'printBst'];
      for (const name of functionNames) {
        const typeOf = await app.typeofGlobal(name);
        expect(typeOf).toBe('undefined');
      }
    });
  });
});