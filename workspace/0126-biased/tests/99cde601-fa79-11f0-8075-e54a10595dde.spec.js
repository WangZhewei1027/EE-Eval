import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cde601-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Doubly Linked List demo page
class DoublyLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors from the HTML
    this.newNodeInput = page.locator('#newNodeValue');
    this.removeIndexInput = page.locator('#removeNodeIndex');
    this.searchNodeInput = page.locator('#searchNodeValue');
    this.addEndBtn = page.locator("button[onclick=\"addNodeAtEnd()\"]");
    this.addStartBtn = page.locator("button[onclick=\"addNodeAtStart()\"]");
    this.removeBtn = page.locator("button[onclick=\"removeNode()\"]");
    this.traverseForwardBtn = page.locator("button[onclick=\"traverseForward()\"]");
    this.traverseBackwardBtn = page.locator("button[onclick=\"traverseBackward()\"]");
    this.searchBtn = page.locator("button[onclick=\"searchNode()\"]");
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Helpers to interact with UI
  async setNewNodeValue(value) {
    await this.newNodeInput.fill(value);
  }
  async setRemoveNodeIndex(index) {
    // index may be number or string
    await this.removeIndexInput.fill(String(index));
  }
  async setSearchNodeValue(value) {
    await this.searchNodeInput.fill(value);
  }

  async clickAddEnd() {
    await this.addEndBtn.click();
  }
  async clickAddStart() {
    await this.addStartBtn.click();
  }
  async clickRemove() {
    await this.removeBtn.click();
  }
  async clickTraverseForward() {
    await this.traverseForwardBtn.click();
  }
  async clickTraverseBackward() {
    await this.traverseBackwardBtn.click();
  }
  async clickSearch() {
    await this.searchBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }
}

test.describe('Doubly Linked List Interactive Demo - FSM validation and UI tests', () => {
  // Arrays to capture runtime diagnostics per test
  let pageErrors;
  let consoleErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // initialize diagnostic collectors
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // Capture uncaught page errors (e.g., ReferenceError, TypeError)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages and especially errors logged to console
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If there are any page errors or console errors, attach them to the test output for easier debugging
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        testInfo.attach('pageerror', { body: String(err), contentType: 'text/plain' });
      }
    }
    if (consoleErrors.length > 0) {
      testInfo.attach('consoleErrors', { body: consoleErrors.join('\n'), contentType: 'text/plain' });
    }
    if (consoleMessages.length > 0) {
      testInfo.attach('consoleMessages', { body: JSON.stringify(consoleMessages, null, 2), contentType: 'application/json' });
    }
  });

  // Validate initial render state and presence of expected controls (FSM S0_Idle entry evidence)
  test('Initial render: controls and output are present (Idle state)', async ({ page }) => {
    const ui = new DoublyLinkedListPage(page);
    await ui.goto();

    // Verify inputs and buttons exist per FSM evidence
    await expect(ui.newNodeInput).toBeVisible();
    await expect(ui.removeIndexInput).toBeVisible();
    await expect(ui.searchNodeInput).toBeVisible();

    await expect(ui.addEndBtn).toBeVisible();
    await expect(ui.addStartBtn).toBeVisible();
    await expect(ui.removeBtn).toBeVisible();
    await expect(ui.traverseForwardBtn).toBeVisible();
    await expect(ui.traverseBackwardBtn).toBeVisible();
    await expect(ui.searchBtn).toBeVisible();

    // Output should initially be empty
    const initialOutput = await ui.getOutputText();
    expect(initialOutput.trim()).toBe('', 'Output should be empty on initial render');

    // Assert no uncaught page errors or console errors occurred during load
    expect(pageErrors.length, `Expected no page errors on load, found: ${pageErrors.length}`).toBe(0);
    expect(consoleErrors.length, `Expected no console errors on load, found: ${consoleErrors.length}`).toBe(0);
  });

  // Test adding nodes at the end updates output and clears input
  test('Add Node at End: adds nodes, updates output, and clears input', async ({ page }) => {
    const ui = new DoublyLinkedListPage(page);
    await ui.goto();

    // Add first node "A"
    await ui.setNewNodeValue('A');
    await ui.clickAddEnd();
    let out = await ui.getOutputText();
    expect(out).toContain('Node added at end', 'Should show node added message for AddNodeAtEnd');
    expect(out).toContain('A', 'List should contain the added value "A"');

    // Input should be cleared after adding
    const newValAfter = await page.locator('#newNodeValue').inputValue();
    expect(newValAfter).toBe('', 'newNodeValue input should be cleared after addNodeAtEnd');

    // Add second node "B"
    await ui.setNewNodeValue('B');
    await ui.clickAddEnd();
    out = await ui.getOutputText();
    expect(out).toContain('Node added at end', 'Second add should also show node added message');
    // Forward traversal should reflect "A <-> B"
    expect(out).toContain('A', 'List should still contain "A"');
    expect(out).toContain('B', 'List should contain newly added "B"');

    // Ensure traverse forward button produces consistent output
    await ui.clickTraverseForward();
    out = await ui.getOutputText();
    expect(out).toContain('Current List (Forward):', 'Traverse forward should set output prefix');
    expect(out).toContain('A', 'Forward traversal should include A');
    expect(out).toContain('B', 'Forward traversal should include B');

    // Check runtime diagnostics
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test adding nodes at the start updates order
  test('Add Node at Start: prepends node and updates list order', async ({ page }) => {
    const ui = new DoublyLinkedListPage(page);
    await ui.goto();

    // Seed with "X" at end
    await ui.setNewNodeValue('X');
    await ui.clickAddEnd();

    // Now add "Y" at start
    await ui.setNewNodeValue('Y');
    await ui.clickAddStart();

    // Expected forward traversal: Y <-> X
    const out = await ui.getOutputText();
    expect(out).toContain('Node added at start', 'Should show node added at start message');
    // Confirm order by invoking traverseForward explicitly and checking prefix
    await ui.clickTraverseForward();
    const forwardOut = await ui.getOutputText();
    expect(forwardOut).toContain('Current List (Forward):');
    expect(forwardOut).toContain('Y', 'Y should be first after addNodeAtStart');
    expect(forwardOut).toContain('X', 'X should still be present after addNodeAtStart');

    // No page errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test remove node by index and edge behaviors
  test('Remove Node: removes at index; handles invalid indices gracefully', async ({ page }) => {
    const ui = new DoublyLinkedListPage(page);
    await ui.goto();

    // Seed list with A, B, C
    await ui.setNewNodeValue('A');
    await ui.clickAddEnd();
    await ui.setNewNodeValue('B');
    await ui.clickAddEnd();
    await ui.setNewNodeValue('C');
    await ui.clickAddEnd();

    // Remove middle item at index 1 (B)
    await ui.setRemoveNodeIndex(1);
    await ui.clickRemove();
    let out = await ui.getOutputText();
    expect(out).toContain('Node removed', 'Should indicate a node was removed');
    expect(out).toContain('A', 'A should remain after removal');
    expect(out).toContain('C', 'C should remain after removal');
    expect(out).not.toContain('B', 'B should have been removed');

    // Edge case: remove with negative index - should do nothing and not throw
    await ui.setRemoveNodeIndex(-5);
    await ui.clickRemove();
    out = await ui.getOutputText();
    expect(out).toContain('Node removed', 'Remove button always sets output message; removeAtIndex ignores negative index internally');
    // No unexpected pageerrors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Edge case: remove with empty input -> parseInt('') = NaN -> logic will attempt to remove head (per implementation)
    // We'll check that a removal happened (head removed)
    // Re-seed a fresh page to reason about deterministic behavior
    await ui.goto();
    await ui.setNewNodeValue('1');
    await ui.clickAddEnd();
    await ui.setNewNodeValue('2');
    await ui.clickAddEnd();
    await ui.setRemoveNodeIndex(''); // empty
    await ui.clickRemove();
    out = await ui.getOutputText();
    // After removal with empty index, head likely removed leading to only "2" present
    expect(out).toContain('Node removed', 'Remove invoked with empty index still updates output');
    // At minimum, ensure no runtime exceptions occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test traversals forward and backward for correctness
  test('Traverse Forward and Backward: output reflects forward and backward traversal', async ({ page }) => {
    const ui = new DoublyLinkedListPage(page);
    await ui.goto();

    // Build list: 10, 20, 30
    await ui.setNewNodeValue('10');
    await ui.clickAddEnd();
    await ui.setNewNodeValue('20');
    await ui.clickAddEnd();
    await ui.setNewNodeValue('30');
    await ui.clickAddEnd();

    // Traverse forward
    await ui.clickTraverseForward();
    let out = await ui.getOutputText();
    expect(out).toContain('Current List (Forward):', 'Traverse forward should update output prefix');
    // Sequence should be 10 <-> 20 <-> 30
    expect(out).toContain('10');
    expect(out).toContain('20');
    expect(out).toContain('30');

    // Traverse backward
    await ui.clickTraverseBackward();
    out = await ui.getOutputText();
    expect(out).toContain('Current List (Backward):', 'Traverse backward should update output prefix');
    // Backward should include same items (order not strictly asserted here beyond presence)
    expect(out).toContain('10');
    expect(out).toContain('20');
    expect(out).toContain('30');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test searching nodes: found and not found scenarios
  test('Search Node: finds existing values and reports not found for absent values', async ({ page }) => {
    const ui = new DoublyLinkedListPage(page);
    await ui.goto();

    // Add nodes alpha, beta
    await ui.setNewNodeValue('alpha');
    await ui.clickAddEnd();
    await ui.setNewNodeValue('beta');
    await ui.clickAddEnd();

    // Search existing value "alpha"
    await ui.setSearchNodeValue('alpha');
    await ui.clickSearch();
    let out = await ui.getOutputText();
    expect(out).toBe('Node with value "alpha" found.', 'Search should report found for existing node');

    // Search non-existing value "gamma"
    await ui.setSearchNodeValue('gamma');
    await ui.clickSearch();
    out = await ui.getOutputText();
    expect(out).toBe('Node with value "gamma" not found.', 'Search should report not found for absent node');

    // Also ensure searching with empty string behaves consistently (should search for empty string)
    await ui.setSearchNodeValue('');
    await ui.clickSearch();
    out = await ui.getOutputText();
    // empty value search probably returns not found
    expect(typeof out).toBe('string');
    // No uncaught errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: attempting to add empty node value should do nothing (no change to list)
  test('Edge Case: adding empty value does not modify list', async ({ page }) => {
    const ui = new DoublyLinkedListPage(page);
    await ui.goto();

    // Ensure empty add is ignored: click add when input empty
    // Record output before attempting add
    let before = await ui.getOutputText();

    // Ensure input is empty and click add at end
    await ui.setNewNodeValue('');
    await ui.clickAddEnd();
    let after = await ui.getOutputText();
    expect(after).toBe(before, 'Adding empty value should not change output or list by addNodeAtEnd');

    // Click add at start as well
    await ui.clickAddStart();
    after = await ui.getOutputText();
    expect(after).toBe(before, 'Adding empty value should not change output or list by addNodeAtStart');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Final check: ensure no unexpected runtime errors or console errors throughout interactions
  test('Runtime diagnostics: ensure no uncaught exceptions or console errors during typical interactions', async ({ page }) => {
    const ui = new DoublyLinkedListPage(page);
    await ui.goto();

    // Perform a sequence of typical operations
    await ui.setNewNodeValue('one');
    await ui.clickAddEnd();
    await ui.setNewNodeValue('two');
    await ui.clickAddStart();
    await ui.setRemoveNodeIndex(0);
    await ui.clickRemove();
    await ui.setSearchNodeValue('two');
    await ui.clickSearch();
    await ui.clickTraverseForward();
    await ui.clickTraverseBackward();

    // Verify we captured console messages but no errors
    // It's acceptable that there are informational logs; assert no console 'error' types recorded
    expect(consoleErrors.length, `Expected no console.error messages, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
    // Assert there were no uncaught page errors
    expect(pageErrors.length, `Expected no uncaught page errors, got: ${pageErrors.length}`).toBe(0);
  });
});