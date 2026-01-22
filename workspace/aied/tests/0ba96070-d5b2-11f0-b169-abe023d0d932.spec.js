import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba96070-d5b2-11f0-b169-abe023d0d932.html';

// Page Object for the Heap Sort page to encapsulate interactions and observers
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Collect console messages and page errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach listeners immediately so we capture logs/errors during navigation
    this.page.on('console', (msg) => {
      // Normalize message text and type
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // Capture page error objects for later assertions
      this.pageErrors.push(err);
    });
  }

  // Navigate to the page under test
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return the collected console messages
  getConsoleMessages() {
    return this.consoleMessages.map((m) => m.text);
  }

  // Return the collected page error messages (string)
  getPageErrorMessages() {
    return this.pageErrors.map((e) => (e && e.message) || String(e));
  }

  // Attempt to call a global function name on the page and return the raw Promise
  // This is intentionally used to assert missing functions throw ReferenceError naturally.
  async callGlobalFunction(functionExpression) {
    // functionExpression should be a string expression callable in page context, e.g., 'renderPage()'
    return this.page.evaluate(functionExpression);
  }

  // Call the defined heapSort on the page with given input and return result
  async callHeapSort(inputArray) {
    // Serialize the input into page context and call heapSort
    return this.page.evaluate((arr) => {
      // call the function defined in the page context
      return heapSort(arr);
    }, inputArray);
  }

  // Utility: count interactive elements on the page
  async countInteractiveElements() {
    // Buttons, inputs, selects, textareas, and links with href
    return this.page.evaluate(() => {
      const selectors = ['button', 'input', 'select', 'textarea', 'a[href]'];
      return selectors.reduce((sum, sel) => sum + document.querySelectorAll(sel).length, 0);
    });
  }
}

test.describe('Heap Sort Interactive Application - FSM and Page Validation', () => {
  // Per-test HeapPage instance
  let heap;

  // Setup: create HeapPage and navigate before each test, listeners attached in constructor
  test.beforeEach(async ({ page }) => {
    heap = new HeapPage(page);
    await heap.goto();
    // Ensure the page has loaded (simple check)
    await expect(page.locator('h1')).toHaveText('Heap Sort');
  });

  test.describe('Rendering and initial state (S0_Idle)', () => {
    test('Page renders title and heap container - verifies Idle state evidence', async () => {
      // Validate the evidence specified in the FSM for S0_Idle
      const title = await heap.page.locator('h1').textContent();
      expect(title).toBe('Heap Sort'); // Evidence: <h1>Heap Sort</h1>

      const heapDivExists = await heap.page.locator('#heap').count();
      expect(heapDivExists).toBeGreaterThan(0); // Evidence: <div id="heap"></div>

      // Verify the body is present (basic DOM check)
      const bodyExists = await heap.page.locator('body').count();
      expect(bodyExists).toBeGreaterThan(0);
    });

    test('Console logs from inline script are emitted (Original array & Sorted array)', async () => {
      // The page's script logs "Original array:" and "Sorted array:" on load.
      const messages = heap.getConsoleMessages();

      // There may be other logs; ensure we have the expected logs present
      const joined = messages.join('\n');

      expect(joined).toContain('Original array:');
      expect(joined).toContain('Sorted array:');

      // Additionally assert that the arrays are printed in console (approximate check)
      // Expect at least one message to include array notation like '['
      expect(messages.some(m => m.includes('[') && m.includes(']'))).toBeTruthy();
    });
  });

  test.describe('FSM entry action: renderPage()', () => {
    test('renderPage is not defined and calling it raises ReferenceError (entry action check)', async () => {
      // The FSM lists an entry action "renderPage()". The page does NOT define renderPage.
      // We assert that renderPage is not defined and that attempting to call it produces a ReferenceError.
      // Do not patch the page: call it and allow the ReferenceError to happen naturally.

      // Verify renderPage is not present as a function on window
      const isRenderPageDefined = await heap.page.evaluate(() => typeof window.renderPage === 'function');
      expect(isRenderPageDefined).toBe(false);

      // Attempt to call renderPage() and assert the evaluation rejects with a ReferenceError-like message.
      // We use a regex to be tolerant to variations in error text across runtimes.
      let caught = null;
      try {
        await heap.callGlobalFunction('renderPage()');
      } catch (err) {
        caught = err;
      }

      expect(caught).not.toBeNull();
      // Error message varies, but should mention ReferenceError or "is not defined"
      const message = String(caught && caught.message || caught);
      expect(message).toMatch(/ReferenceError|is not defined|renderPage/);

      // Ensure the pageerror event captured at least one error related to renderPage
      const pageErrors = heap.getPageErrorMessages();
      // It's possible the pageerror listener captured an Error instance; ensure something mentions renderPage
      expect(pageErrors.join('\n')).toMatch(/renderPage|ReferenceError|is not defined/);
    });
  });

  test.describe('Heap Sort algorithm functions (behavioral checks)', () => {
    test('heapSort sorts a simple numeric array correctly', async () => {
      // Verify heapSort is defined and works for a sample array
      const input = [3, 1, 4, 2];
      const sorted = await heap.callHeapSort(input);
      // Expect ascending sorted array
      expect(sorted).toEqual([1, 2, 3, 4]);
    });

    test('heapSort (page implementation) sorts the original example correctly', async () => {
      // The script sorts [12, 11, 13, 5, 6, 7] and logs the sorted array.
      // Re-run heapSort to verify same result programmatically.
      const example = [12, 11, 13, 5, 6, 7];
      const sorted = await heap.callHeapSort(example);
      expect(sorted).toEqual([5, 6, 7, 11, 12, 13]);
    });

    test('Calling heapSort with invalid input (null) produces a TypeError naturally', async () => {
      // Intentionally call heapSort(null) to exercise an error scenario (edge case)
      // We expect a TypeError (or similar) to be thrown by the page's implementation.
      let caught = null;
      try {
        await heap.page.evaluate(() => heapSort(null));
      } catch (err) {
        caught = err;
      }

      expect(caught).not.toBeNull();
      const message = String(caught && caught.message || caught);
      // The message typically contains TypeError or "reading 'length'"
      expect(message).toMatch(/TypeError|Cannot read|reading 'length'|of null/);

      // Confirm a pageerror was captured describing the TypeError
      const pageErrors = heap.getPageErrorMessages();
      expect(pageErrors.join('\n')).toMatch(/TypeError|Cannot read|reading 'length'|of null/);
    });
  });

  test.describe('Interactivity surface checks and FSM transitions (none expected)', () => {
    test('There are no interactive elements (buttons, inputs, selects, textareas, links) as extraction notes indicate', async () => {
      // The FSM extraction notes indicate "No interactive elements or event handlers found."
      const interactiveCount = await heap.countInteractiveElements();
      // Expect zero interactive elements by the definition provided
      expect(interactiveCount).toBe(0);
    });

    test('No transitions or events defined in FSM; ensure no clickable controls exist to trigger state changes', async () => {
      // Validate that clicking the #heap container does not throw an error and does not change DOM in unexpected ways.
      const locator = heap.page.locator('#heap');
      await expect(locator).toHaveCount(1);

      // Capture DOM snapshot before and after click
      const beforeHTML = await heap.page.evaluate(() => document.body.innerHTML);
      await heap.page.click('#heap');
      const afterHTML = await heap.page.evaluate(() => document.body.innerHTML);

      // Since there are no transitions, clicking should not change the DOM structure (no new elements expected)
      expect(afterHTML).toBe(beforeHTML);
    });
  });

  // Final test to assert that no unexpected runtime SyntaxErrors occurred during load.
  test('No SyntaxError occurred during initial parse of the page', async () => {
    // Inspect captured page errors to ensure none are SyntaxError
    const pageErrors = heap.getPageErrorMessages();
    const syntaxErrorFound = pageErrors.some(msg => /SyntaxError/.test(msg));
    // We assert that no SyntaxError occurred (the page's inline script should be syntactically valid)
    expect(syntaxErrorFound).toBeFalsy();
  });
});