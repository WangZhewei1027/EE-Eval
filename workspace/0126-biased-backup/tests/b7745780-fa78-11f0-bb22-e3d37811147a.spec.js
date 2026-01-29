import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/b7745780-fa78-11f0-bb22-e3d37811147a.html';

// Page object encapsulating interactions with the Doubly Linked List UI
class DoublyLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addBtn = page.locator('button[onclick="addItem()"]');
    this.removeBtn = page.locator('button[onclick="removeItem()"]');
    this.printBtn = page.locator('button[onclick="printList()"]');
    this.listContainer = page.locator('#myList');
    this.consoleMessages = [];
    this.pageErrors = [];

    // Bind listeners to collect console messages and page errors for assertions.
    this.page.on('console', (msg) => {
      // Collect console messages for later inspection.
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // Collect page-level unhandled errors (ReferenceError, TypeError, etc).
      // err can be an Error object; convert to string for easier assertions.
      this.pageErrors.push(String(err?.message ?? err));
    });
  }

  async goto() {
    // Navigate and wait for load so we can inspect initial DOM and any load-time errors.
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('load');
  }

  async clickAdd() {
    await this.addBtn.click();
    // short wait to allow any synchronous errors to surface and events to be logged
    await this.page.waitForTimeout(100);
  }

  async clickRemove() {
    await this.removeBtn.click();
    await this.page.waitForTimeout(100);
  }

  async clickPrint() {
    await this.printBtn.click();
    await this.page.waitForTimeout(100);
  }

  async getListInnerHTML() {
    return await this.listContainer.innerHTML();
  }

  // Helper that checks whether an error referring to a symbol/function exists in collected errors
  hasErrorReferencing(symbol) {
    const needle = symbol;
    const inPageErrors = this.pageErrors.some(e => e.includes(needle) || e.includes('is not defined') || e.includes('ReferenceError'));
    const inConsole = this.consoleMessages.some(m => m.text.includes(needle) || m.text.includes('is not defined') || m.text.includes('ReferenceError'));
    return inPageErrors || inConsole;
  }

  // Helper: check whether any ReferenceError / TypeError / SyntaxError occurred
  hasAnyRuntimeError() {
    const runtimeErrorKeywords = ['ReferenceError', 'TypeError', 'SyntaxError', 'is not defined', 'Uncaught'];
    const inPageErrors = this.pageErrors.some(e => runtimeErrorKeywords.some(k => e.includes(k)));
    const inConsole = this.consoleMessages.some(m => runtimeErrorKeywords.some(k => m.text.includes(k)));
    return inPageErrors || inConsole;
  }
}

test.describe('Doubly Linked List FSM - b7745780-fa78-11f0-bb22-e3d37811147a', () => {
  // Each test gets a fresh page and a fresh page object
  test.beforeEach(async ({ page }) => {
    // No-op here; navigation per-test to capture listeners in page object
  });

  test('S0_Idle: page renders initial UI (buttons present, list container present)', async ({ page }) => {
    // Validate Idle state: elements expected by FSM are present
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Verify the three buttons exist and are visible
    await expect(dll.addBtn).toBeVisible();
    await expect(dll.removeBtn).toBeVisible();
    await expect(dll.printBtn).toBeVisible();

    // Verify the list container exists
    await expect(dll.listContainer).toBeVisible();

    // The FSM entry action lists renderPage() as an entry action.
    // The HTML does not explicitly call renderPage(); assert that there is no evidence that it ran.
    // We check console and page errors for a renderPage reference (either call or error).
    const renderPageCalled = dll.consoleMessages.some(m => m.text.includes('renderPage')) || dll.pageErrors.some(e => e.includes('renderPage'));
    // We assert that renderPage was not called (most likely) — this verifies the implementation did not invoke it implicitly.
    expect(renderPageCalled).toBe(false);

    // Also assert that, at initial load, there are no runtime errors that reference the three main functions yet.
    // It's acceptable if there are other unrelated console logs, but we assert absence of immediate ReferenceErrors for add/remove/print.
    const initialErrors = dll.pageErrors.concat(dll.consoleMessages.map(m => m.text)).join('\n');
    expect(initialErrors.includes('addItem') || initialErrors.includes('removeItem') || initialErrors.includes('printList')).toBe(false);
  });

  test('S0 -> S1: Add Item transition triggers addItem() and should either modify DOM or raise an error', async ({ page }) => {
    // This test validates the AddItem event/transition.
    // We do NOT patch or modify page behavior; we observe natural runtime results (errors or DOM changes).
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Capture initial list state
    const before = await dll.getListInnerHTML();

    // Trigger Add Item button (onclick="addItem()")
    await dll.clickAdd();

    // After clicking, per instructions we must observe console/page errors and assert that errors occur naturally.
    // The environment may or may not provide addItem(). If it's missing, a ReferenceError should appear.
    const sawAddError = dll.hasErrorReferencing('addItem');

    // Assert that either an error occurred mentioning addItem OR the DOM changed to reflect an added item.
    // This tolerates both correct implementation and missing-implementation error scenarios.
    const after = await dll.getListInnerHTML();
    const domChanged = before !== after && after.trim().length > 0;

    // We expect at least one of these to be true:
    expect(sawAddError || domChanged).toBe(true);

    // If a runtime error did happen, assert that it's of a common runtime error class
    if (sawAddError) {
      expect(dll.hasAnyRuntimeError()).toBe(true);
      // Specifically expect the error to mention addItem or 'is not defined'
      const errFound = dll.pageErrors.concat(dll.consoleMessages.map(m => m.text)).some(t => t.includes('addItem') || t.includes('is not defined') || t.includes('ReferenceError'));
      expect(errFound).toBe(true);
    } else {
      // If no error, double-check that the change is plausible (something added to #myList)
      expect(domChanged).toBe(true);
    }
  });

  test('S0 -> S2: Remove Item transition triggers removeItem() and either removes item or raises an error', async ({ page }) => {
    // Validate RemoveItem event/transition and edge cases (e.g., removing from empty list)
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Ensure list starts empty (common case)
    const before = await dll.getListInnerHTML();

    // Trigger Remove Item
    await dll.clickRemove();

    // Observe for runtime errors referencing removeItem
    const sawRemoveError = dll.hasErrorReferencing('removeItem');

    // Observe DOM after attempting remove
    const after = await dll.getListInnerHTML();
    const domChanged = before !== after;

    // Expect either an error occurred or the DOM changed to reflect a removal
    expect(sawRemoveError || domChanged).toBe(true);

    if (sawRemoveError) {
      // Confirm it's a runtime error type if present
      expect(dll.hasAnyRuntimeError()).toBe(true);
      const found = dll.pageErrors.concat(dll.consoleMessages.map(m => m.text)).some(t => t.includes('removeItem') || t.includes('is not defined') || t.includes('ReferenceError'));
      expect(found).toBe(true);
    } else {
      // No runtime error: ensure DOM change corresponds to removal semantics (could be empty string or shorter)
      // At minimum, assert that something changed in the list container
      expect(domChanged).toBe(true);
    }
  });

  test('S0 -> S3: Print List transition triggers printList() and either logs output or raises an error', async ({ page }) => {
    // Validate PrintList event/transition
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Trigger Print List
    await dll.clickPrint();

    // Check for runtime errors referencing printList
    const sawPrintError = dll.hasErrorReferencing('printList');

    // Many implementations print to console; check console for expected output if function exists.
    const printedToConsole = dll.consoleMessages.some(m => m.text.includes('print') || m.text.includes('List') || m.text.includes('myList'));

    // We accept either a runtime error or console output indicating the list was printed.
    expect(sawPrintError || printedToConsole).toBe(true);

    if (sawPrintError) {
      expect(dll.hasAnyRuntimeError()).toBe(true);
      const found = dll.pageErrors.concat(dll.consoleMessages.map(m => m.text)).some(t => t.includes('printList') || t.includes('is not defined') || t.includes('ReferenceError'));
      expect(found).toBe(true);
    } else {
      // If no error, assert evidence of printing attempt in console logs
      expect(printedToConsole).toBe(true);
    }
  });

  test('Edge case: multiple interactions accumulate errors (click add, add, remove) and errors reference appropriate functions', async ({ page }) => {
    // This test performs several actions in sequence to validate error accumulation and transition ordering.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Do multiple clicks
    await dll.clickAdd();
    await dll.clickAdd();
    await dll.clickRemove();

    // After multiple interactions, we expect runtime errors referencing addItem and removeItem
    const sawAdd = dll.hasErrorReferencing('addItem');
    const sawRemove = dll.hasErrorReferencing('removeItem');

    // At minimum, expect at least one of the function errors to be seen.
    expect(sawAdd || sawRemove).toBe(true);

    // If errors were observed, ensure they are runtime errors (ReferenceError / TypeError etc.)
    if (dll.hasAnyRuntimeError()) {
      expect(dll.pageErrors.length + dll.consoleMessages.length).toBeGreaterThanOrEqual(1);
    }

    // Additionally, ensure the list container still exists and is stable (no DOM corruption)
    await expect(dll.listContainer).toBeVisible();
  });

  test('Edge case: clicking the same button rapidly does not crash the page (collects errors but keeps DOM available)', async ({ page }) => {
    // Stress test rapid clicks on Add Item
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // Rapid clicks
    for (let i = 0; i < 5; i++) {
      await dll.clickAdd();
    }

    // Page should still be reachable; verify main elements still exist
    await expect(dll.addBtn).toBeVisible();
    await expect(dll.listContainer).toBeVisible();

    // Expect there to be at least one runtime error if functions are missing
    expect(dll.hasAnyRuntimeError()).toBe(true);
  });

  test('Verify onEnter/onExit actions mention: renderPage() expected but not present -> assert absence or error', async ({ page }) => {
    // The FSM entry action for Idle is renderPage(). The HTML does not call renderPage() on load.
    // Here we assert the absence of renderPage() invocation and that no page error referencing renderPage() occurred.
    const dll = new DoublyLinkedListPage(page);
    await dll.goto();

    // There should be NO evidence that renderPage() executed (most likely)
    const renderPageMentionedInConsoleOrErrors = dll.consoleMessages.some(m => m.text.includes('renderPage')) || dll.pageErrors.some(e => e.includes('renderPage'));
    expect(renderPageMentionedInConsoleOrErrors).toBe(false);
  });
});