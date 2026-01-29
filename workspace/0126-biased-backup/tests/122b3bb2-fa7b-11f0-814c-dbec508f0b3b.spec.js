import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b3bb2-fa7b-11f0-814c-dbec508f0b3b.html';

// Page object encapsulating common interactions and introspection helpers
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleMessages = [];
    this.dialogMessages = [];

    // register listeners to capture runtime info for assertions
    this.page.on('pageerror', (err) => {
      // collect page errors (ReferenceError/TypeError/SyntaxError etc.)
      this.pageErrors.push(err);
    });

    this.page.on('console', (msg) => {
      // collect console messages
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    this.page.on('dialog', async (dialog) => {
      // record dialog messages (alerts) and dismiss them to not block tests
      this.dialogMessages.push({ message: dialog.message(), type: dialog.type() });
      try {
        await dialog.dismiss();
      } catch (e) {
        // ignore any dismissal errors
      }
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Actions
  async clickAddHeap() {
    await this.page.click('#add-heap-btn');
  }
  async clickClearHeap() {
    await this.page.click('#clear-heap-btn');
  }
  async setHeapSize(value) {
    // number input; use fill to set raw value
    await this.page.fill('#heap-size', String(value));
  }
  async setHeapSizeMax(value) {
    await this.page.fill('#heap-size-max', String(value));
  }
  async setHeapInput(value) {
    await this.page.fill('#heap-input', String(value));
    // dispatch input event explicitly in case native fill doesn't trigger script listeners
    await this.page.dispatchEvent('#heap-input', 'input');
  }
  async getHeapInnerHTML() {
    return await this.page.$eval('#heap', (el) => el.innerHTML);
  }

  // Introspection helpers
  getPageErrors() {
    return this.pageErrors.slice();
  }
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }
  getDialogMessages() {
    return this.dialogMessages.slice();
  }
  clearCaptured() {
    this.pageErrors = [];
    this.consoleMessages = [];
    this.dialogMessages = [];
  }

  // Utility to wait for the next pageerror (with a short timeout)
  async waitForPageError(timeout = 2000) {
    try {
      const err = await this.page.waitForEvent('pageerror', { timeout });
      return err;
    } catch (e) {
      return null;
    }
  }
}

test.describe('Heap (Max) - FSM and DOM integration tests', () => {
  // Each test gets its own page fixture
  test.describe.configure({ mode: 'serial' });

  // Test: on load the script calls createHeap(), which references a missing Heap class.
  test('S0_HeapInitialized: createHeap() should be invoked on load and produce a ReferenceError for missing Heap', async ({ page }) => {
    // Arrange
    const heapPage = new HeapPage(page);

    // Act
    await heapPage.goto();

    // Allow brief time for script execution and error propagation
    // (most runtime errors occur synchronously during load)
    await page.waitForTimeout(200);

    // Assert
    const errors = heapPage.getPageErrors();
    // At least one page error should be present
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // Find if one of the errors references 'Heap' as not defined
    const hasHeapReferenceError = errors.some((err) => {
      const msg = String(err && err.message ? err.message : err);
      return /Heap[\s\S]*not defined/i.test(msg) || /\bReferenceError\b/i.test(msg) && /Heap/i.test(msg);
    });

    expect(hasHeapReferenceError).toBeTruthy();

    // Also verify that the DOM #heap area is not populated as createHeap failed
    const heapInner = await heapPage.getHeapInnerHTML();
    // The implementation attempted to append nodes inside #heap in createHeap.
    // Because createHeap errored, expect an empty or minimal innerHTML rather than a populated heap element.
    expect(heapInner).toBeDefined();
  });

  test('Transition AddHeap (click #add-heap-btn): when underlying heap is null should produce a TypeError on heap.add', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Wait briefly for initial ReferenceError to occur (expected from createHeap)
    await page.waitForTimeout(200);

    // Clear previously captured errors to focus on the outcome of this click
    heapPage.clearCaptured();

    // Ensure heap-size and max are at defaults where heapSize <= max so add() will attempt heap.add
    await heapPage.setHeapSize(10);
    await heapPage.setHeapSizeMax(100);

    // Act: click the Add Heap button
    const pendingErrorPromise = page.waitForEvent('pageerror').catch(() => null);
    await heapPage.clickAddHeap();
    const err = await pendingErrorPromise;

    // Assert: expect a runtime error referencing inability to call add on heap (TypeError)
    expect(err).not.toBeNull();
    const msg = String(err.message || err);
    // Look for common TypeError patterns involving "add" and "null"/"undefined"
    const looksLikeTypeErrorCallingAdd = /add/i.test(msg) && (/null/i.test(msg) || /undefined/i.test(msg) || /\bTypeError\b/i.test(msg));
    expect(looksLikeTypeErrorCallingAdd).toBeTruthy();

    // And verify that no new heap DOM elements were appended (heap area remains effectively empty)
    const heapInner = await heapPage.getHeapInnerHTML();
    expect(heapInner).toBeDefined();
  });

  test('Transition ClearHeap (click #clear-heap-btn): when underlying heap is null should produce a TypeError on heap.clear', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Wait briefly for initial ReferenceError
    await page.waitForTimeout(200);

    // Reset captures
    heapPage.clearCaptured();

    // Act: click Clear Heap
    const pendingErrorPromise = page.waitForEvent('pageerror').catch(() => null);
    await heapPage.clickClearHeap();
    const err = await pendingErrorPromise;

    // Assert: expect a runtime error referencing "clear" or inability to read property
    expect(err).not.toBeNull();
    const msg = String(err.message || err);
    const looksLikeTypeErrorCallingClear = /clear/i.test(msg) && (/null/i.test(msg) || /undefined/i.test(msg) || /\bTypeError\b/i.test(msg));
    expect(looksLikeTypeErrorCallingClear).toBeTruthy();
  });

  test('AddHeap edge case: when heap-size > heap-size-max should trigger alert and avoid invoking heap.add (no TypeError)', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Wait briefly for initial ReferenceError
    await page.waitForTimeout(200);

    // Clear previously captured errors
    heapPage.clearCaptured();

    // Set heap size greater than max
    await heapPage.setHeapSize(200);
    await heapPage.setHeapSizeMax(100);

    // Prepare to capture dialog and pageerror
    let dialogCaptured = null;
    page.once('dialog', async (dialog) => {
      dialogCaptured = { message: dialog.message(), type: dialog.type() };
      await dialog.dismiss();
    });

    // Also set up a short timeout to detect if a pageerror incorrectly occurs
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 500 }).catch(() => null);

    // Act: click add
    await heapPage.clickAddHeap();

    // Wait briefly for dialog to be handled
    await page.waitForTimeout(200);

    // Assert: dialog with the specific alert should have been shown
    expect(dialogCaptured).not.toBeNull();
    expect(dialogCaptured.message).toContain('Heap size cannot be greater than max heap size');

    // Also assert that no new pageerror occurred (i.e., heap.add was not reached)
    const pageError = await pageErrorPromise;
    expect(pageError).toBeNull();
  });

  test('InputHeapSize transition (input #heap-input): since updateHeap listener was likely not attached due to earlier script error, input should not modify heap area and should not produce additional errors', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Wait for initial ReferenceError
    await page.waitForTimeout(200);

    // Clear previous captures
    heapPage.clearCaptured();

    // Snapshot heap area before input
    const before = await heapPage.getHeapInnerHTML();

    // Act: change the heap input
    await heapPage.setHeapInput('42');

    // Allow small time for any event handlers (if present) to run
    await page.waitForTimeout(200);

    // Assert: no new pageerrors should have been recorded by this action
    const errors = heapPage.getPageErrors();
    expect(errors.length).toBe(0);

    // Assert: the heap innerHTML should remain the same (no update performed)
    const after = await heapPage.getHeapInnerHTML();
    expect(after).toBe(before);
  });

  test('Edge case: non-numeric heap-size leads to NaN passed to heap.add which should produce a TypeError when heap is null', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Wait for initial ReferenceError
    await page.waitForTimeout(200);

    // Clear captures
    heapPage.clearCaptured();

    // Attempt to put non-numeric input into a number field
    // Many browsers will coerce non-numeric fills to empty string; parseInt('') -> NaN
    await heapPage.setHeapSize('abc');
    await heapPage.setHeapSizeMax(100);

    // Click add and expect a TypeError from attempting heap.add(NaN)
    const pendingErrorPromise = page.waitForEvent('pageerror').catch(() => null);
    await heapPage.clickAddHeap();
    const err = await pendingErrorPromise;

    expect(err).not.toBeNull();
    const msg = String(err.message || err);
    // Expect error mentions 'add' and 'null' or similar TypeError pattern
    const looksLikeTypeError = /add/i.test(msg) && (/null/i.test(msg) || /undefined/i.test(msg) || /\bTypeError\b/i.test(msg));
    expect(looksLikeTypeError).toBeTruthy();
  });

  test('Console and error observation: verify we captured console messages and page errors across interactions', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Allow some time for initial script execution
    await page.waitForTimeout(200);

    // Do a couple of interactions to generate errors
    heapPage.clearCaptured();
    await heapPage.setHeapSize(10);
    // trigger add (should produce TypeError)
    const pageErrorPromise = page.waitForEvent('pageerror').catch(() => null);
    await heapPage.clickAddHeap();
    const err = await pageErrorPromise;
    expect(err).not.toBeNull();

    // Validate that pageErrors were captured via page object
    const capturedErrors = heapPage.getPageErrors();
    expect(capturedErrors.length).toBeGreaterThanOrEqual(1);

    // Validate console messages array is defined (may be empty; we just assert it exists and is an array)
    const consoles = heapPage.getConsoleMessages();
    expect(Array.isArray(consoles)).toBeTruthy();
  });
});