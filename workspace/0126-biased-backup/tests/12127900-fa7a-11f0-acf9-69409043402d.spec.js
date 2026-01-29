import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12127900-fa7a-11f0-acf9-69409043402d.html';

// Page Object representing the Doubly Linked List demo page
class DoublyLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Inputs
    this.newNodeValue = page.locator('#newNodeValue');
    this.removeValueInput = page.locator('#removeValueInput');
    this.targetValueInput = page.locator('#targetValueInput');
    this.jumpIndexInput = page.locator('#jumpIndexInput');
    this.stepDelayInput = page.locator('#stepDelayInput');
    this.searchValueInput = page.locator('#searchValueInput');

    // Buttons
    this.insertHeadBtn = page.locator('#insertHeadBtn');
    this.insertTailBtn = page.locator('#insertTailBtn');
    this.removeHeadBtn = page.locator('#removeHeadBtn');
    this.removeTailBtn = page.locator('#removeTailBtn');
    this.removeValueBtn = page.locator('#removeValueBtn');
    this.insertBeforeBtn = page.locator('#insertBeforeBtn');
    this.insertAfterBtn = page.locator('#insertAfterBtn');
    this.traverseHeadBtn = page.locator('#traverseHeadBtn');
    this.traversePrevBtn = page.locator('#traversePrevBtn');
    this.traverseNextBtn = page.locator('#traverseNextBtn');
    this.traverseTailBtn = page.locator('#traverseTailBtn');
    this.jumpIndexBtn = page.locator('#jumpIndexBtn');
    this.searchBtn = page.locator('#searchBtn');
    this.showAllBtn = page.locator('#showAllBtn');
    this.reverseListBtn = page.locator('#reverseListBtn');
    this.clearListBtn = page.locator('#clearListBtn');
    this.autoNextBtn = page.locator('#autoNextBtn');
    this.autoPrevBtn = page.locator('#autoPrevBtn');
    this.autoStopBtn = page.locator('#autoStopBtn');
    this.toggleVerboseBtn = page.locator('#toggleVerboseBtn');

    // Info elements
    this.listSize = page.locator('#listSize');
    this.currentIndex = page.locator('#currentIndex');
    this.currentValue = page.locator('#currentValue');
    this.listForward = page.locator('#listDisplayForward');
    this.listBackward = page.locator('#listDisplayBackward');
    this.verboseOutput = page.locator('#verboseOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  // Setters
  async setNewNodeValue(val) {
    await this.newNodeValue.fill(String(val));
  }
  async setRemoveValue(val) {
    await this.removeValueInput.fill(String(val));
  }
  async setTargetValue(val) {
    await this.targetValueInput.fill(String(val));
  }
  async setJumpIndex(idx) {
    await this.jumpIndexInput.fill(String(idx));
  }
  async setStepDelay(ms) {
    await this.stepDelayInput.fill(String(ms));
  }
  async setSearchValue(val) {
    await this.searchValueInput.fill(String(val));
  }

  // Click actions
  async clickInsertHead() { await this.insertHeadBtn.click(); }
  async clickInsertTail() { await this.insertTailBtn.click(); }
  async clickRemoveHead() { await this.removeHeadBtn.click(); }
  async clickRemoveTail() { await this.removeTailBtn.click(); }
  async clickRemoveByValue() { await this.removeValueBtn.click(); }
  async clickInsertBefore() { await this.insertBeforeBtn.click(); }
  async clickInsertAfter() { await this.insertAfterBtn.click(); }
  async clickTraverseHead() { await this.traverseHeadBtn.click(); }
  async clickTraversePrev() { await this.traversePrevBtn.click(); }
  async clickTraverseNext() { await this.traverseNextBtn.click(); }
  async clickTraverseTail() { await this.traverseTailBtn.click(); }
  async clickJumpIndex() { await this.jumpIndexBtn.click(); }
  async clickSearch() { await this.searchBtn.click(); }
  async clickShowAll() { await this.showAllBtn.click(); }
  async clickReverseList() { await this.reverseListBtn.click(); }
  async clickClearList() { await this.clearListBtn.click(); }
  async clickAutoNext() { await this.autoNextBtn.click(); }
  async clickAutoPrev() { await this.autoPrevBtn.click(); }
  async clickAutoStop() { await this.autoStopBtn.click(); }
  async clickToggleVerbose() { await this.toggleVerboseBtn.click(); }

  // Getters / assertions helpers
  async getListSizeText() { return (await this.listSize.textContent()).trim(); }
  async getCurrentIndexText() { return (await this.currentIndex.textContent()).trim(); }
  async getCurrentValueText() { return (await this.currentValue.textContent()).trim(); }
  async getForwardText() { return (await this.listForward.textContent()).trim(); }
  async getBackwardText() { return (await this.listBackward.textContent()).trim(); }
  async getToggleVerboseText() { return (await this.toggleVerboseBtn.textContent()).trim(); }
  async isVerboseVisible() { return await this.verboseOutput.isVisible(); }
}

test.describe('Doubly Linked List Interactive Demo - FSM Tests', () => {
  let dllPage;
  let pageErrors;
  let consoleErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Arrays to capture console and page errors/messages
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    dllPage = new DoublyLinkedListPage(page);
    await dllPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Assert that there were no fatal page errors and no console.error messages
    // This validates the environment remained stable while interacting.
    expect(pageErrors.map(e => String(e))).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Initial Idle state reflects empty list and UI elements are present', async ({ page }) => {
    // Validate initial UI values (Idle state entry_actions: updateListInfo())
    expect(await dllPage.getListSizeText()).toBe('0');
    expect(await dllPage.getCurrentIndexText()).toBe('-');
    expect(await dllPage.getCurrentValueText()).toBe('-');
    expect(await dllPage.getForwardText()).toBe('');
    expect(await dllPage.getBackwardText()).toBe('');
    // No verbose output visible by default
    expect(await dllPage.isVerboseVisible()).toBe(false);
  });

  test.describe('Insertion and basic removal operations', () => {
    test('Insert at Head and Insert at Tail update list and current node correctly', async ({ page }) => {
      // Insert head 'A'
      await dllPage.setNewNodeValue('A');
      // Expect an alert if blank is entered - not here
      await dllPage.clickInsertHead();
      expect(await dllPage.getListSizeText()).toBe('1');
      expect(await dllPage.getCurrentIndexText()).toBe('0');
      expect(await dllPage.getCurrentValueText()).toBe('A');
      expect(await dllPage.getForwardText()).toBe('A');

      // Insert tail 'B'
      await dllPage.setNewNodeValue('B');
      await dllPage.clickInsertTail();
      expect(await dllPage.getListSizeText()).toBe('2');
      // Current node should be the newly inserted tail
      expect(await dllPage.getCurrentIndexText()).toBe('1');
      expect(await dllPage.getCurrentValueText()).toBe('B');
      expect(await dllPage.getForwardText()).toBe('A <-> B');
      expect(await dllPage.getBackwardText()).toBe('B <-> A');
    });

    test('Removing head and tail adjust list size and current node appropriately', async ({ page }) => {
      // Prepare list: X, Y, Z
      await dllPage.setNewNodeValue('X'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('Y'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('Z'); await dllPage.clickInsertTail();

      // Move to head then remove head
      await dllPage.clickTraverseHead();
      expect(await dllPage.getCurrentValueText()).toBe('X');
      await dllPage.clickRemoveHead();
      // Now list should be Y <-> Z
      expect(await dllPage.getListSizeText()).toBe('2');
      // currentNode was the removed node (X), so code sets currentNode = dll.head -> Y
      expect(await dllPage.getCurrentValueText()).toBe('Y');
      expect(await dllPage.getForwardText()).toBe('Y <-> Z');

      // Remove tail
      await dllPage.clickRemoveTail();
      expect(await dllPage.getListSizeText()).toBe('1');
      // currentNode if equal removed node then set to dll.tail; here removed tail was Z, current might be Y so remains
      expect(await dllPage.getForwardText()).toBe('Y');
      expect(await dllPage.getBackwardText()).toBe('Y');
    });

    test('Insert operations with empty input show alert (edge case)', async ({ page }) => {
      // Ensure input is empty
      await dllPage.setNewNodeValue('');
      // Expect an alert to be shown - capture dialog
      const alertPromise = page.waitForEvent('dialog');
      await dllPage.clickInsertHead();
      const dialog = await alertPromise;
      expect(dialog.message()).toBe('Please enter a value to insert.');
      await dialog.accept();

      // InsertTail with empty
      const alertPromise2 = page.waitForEvent('dialog');
      await dllPage.clickInsertTail();
      const dialog2 = await alertPromise2;
      expect(dialog2.message()).toBe('Please enter a value to insert.');
      await dialog2.accept();
    });
  });

  test.describe('Remove by value and insert relative to target', () => {
    test('Remove by value removes all matching nodes and handles not-found cases', async ({ page }) => {
      // Build list: A, B, A, C
      await dllPage.setNewNodeValue('A'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('B'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('A'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('C'); await dllPage.clickInsertTail();

      expect(await dllPage.getForwardText()).toBe('A <-> B <-> A <-> C');
      // Remove value that doesn't exist -> alert
      await dllPage.setRemoveValue('Z');
      const notFoundAlert = page.waitForEvent('dialog');
      await dllPage.clickRemoveByValue();
      const dialog = await notFoundAlert;
      expect(dialog.message()).toBe('No nodes with value "Z" found.');
      await dialog.accept();

      // Now remove 'A' -> two nodes removed
      await dllPage.setRemoveValue('A');
      await dllPage.clickRemoveByValue();
      // Should update list to B <-> C
      expect(await dllPage.getForwardText()).toBe('B <-> C');
      expect(await dllPage.getListSizeText()).toBe('2');
    });

    test('Insert Before and Insert After target node behave correctly including missing target alerts', async ({ page }) => {
      // Start fresh: clear list if needed
      // Build list: 1,2,3
      await dllPage.setNewNodeValue('1'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('2'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('3'); await dllPage.clickInsertTail();

      // Insert 'X' before '2'
      await dllPage.setNewNodeValue('X');
      await dllPage.setTargetValue('2');
      await dllPage.clickInsertBefore();
      expect(await dllPage.getForwardText()).toBe('1 <-> X <-> 2 <-> 3');

      // Insert 'Y' after '2'
      await dllPage.setNewNodeValue('Y');
      await dllPage.setTargetValue('2');
      await dllPage.clickInsertAfter();
      expect(await dllPage.getForwardText()).toBe('1 <-> X <-> 2 <-> Y <-> 3');

      // Try inserting with missing target -> expect alert
      await dllPage.setNewNodeValue('Z');
      await dllPage.setTargetValue('NOPE');
      const alertPromise = page.waitForEvent('dialog');
      await dllPage.clickInsertAfter();
      const dialog = await alertPromise;
      expect(dialog.message()).toBe('Target node with value "NOPE" not found.');
      await dialog.accept();
    });
  });

  test.describe('Traversal and navigation', () => {
    test('Go to head/tail, next/prev navigation and boundary alerts', async ({ page }) => {
      // Build list: H, I, J
      await dllPage.setNewNodeValue('H'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('I'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('J'); await dllPage.clickInsertTail();

      // Go to head
      await dllPage.clickTraverseHead();
      expect(await dllPage.getCurrentValueText()).toBe('H');
      expect(await dllPage.getCurrentIndexText()).toBe('0');

      // Next -> I
      await dllPage.clickTraverseNext();
      expect(await dllPage.getCurrentValueText()).toBe('I');
      expect(await dllPage.getCurrentIndexText()).toBe('1');

      // Next -> J
      await dllPage.clickTraverseNext();
      expect(await dllPage.getCurrentValueText()).toBe('J');
      expect(await dllPage.getCurrentIndexText()).toBe('2');

      // Next at tail should alert
      const alertAtTail = page.waitForEvent('dialog');
      await dllPage.clickTraverseNext();
      const dialog1 = await alertAtTail;
      expect(dialog1.message()).toBe('Already at tail (no next node).');
      await dialog1.accept();

      // Prev -> I
      await dllPage.clickTraversePrev();
      expect(await dllPage.getCurrentValueText()).toBe('I');
      expect(await dllPage.getCurrentIndexText()).toBe('1');

      // Go to tail
      await dllPage.clickTraverseTail();
      expect(await dllPage.getCurrentValueText()).toBe('J');
      expect(await dllPage.getCurrentIndexText()).toBe('2');

      // Prev until head then one more prev triggers alert at head
      await dllPage.clickTraversePrev(); // now I
      await dllPage.clickTraversePrev(); // now H
      const alertAtHead = page.waitForEvent('dialog');
      await dllPage.clickTraversePrev(); // should alert that already at head
      const dialog2 = await alertAtHead;
      expect(dialog2.message()).toBe('Already at head (no previous node).');
      await dialog2.accept();
    });

    test('Jump to index validates bounds and updates current node', async ({ page }) => {
      // Build list: alpha, beta, gamma
      await dllPage.setNewNodeValue('alpha'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('beta'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('gamma'); await dllPage.clickInsertTail();

      // Invalid negative index
      await dllPage.setJumpIndex(-1);
      const invalidAlert = page.waitForEvent('dialog');
      await dllPage.clickJumpIndex();
      const d1 = await invalidAlert;
      expect(d1.message()).toContain('Invalid index. Must be between 0 and');
      await d1.accept();

      // Invalid too-large index
      await dllPage.setJumpIndex(100);
      const invalidAlert2 = page.waitForEvent('dialog');
      await dllPage.clickJumpIndex();
      const d2 = await invalidAlert2;
      expect(d2.message()).toContain('Invalid index. Must be between 0 and');
      await d2.accept();

      // Valid jump to index 1 -> beta
      await dllPage.setJumpIndex(1);
      await dllPage.clickJumpIndex();
      expect(await dllPage.getCurrentValueText()).toBe('beta');
      expect(await dllPage.getCurrentIndexText()).toBe('1');
    });

    test('Search operation finds nodes or shows not-found alerts', async ({ page }) => {
      // Create nodes: s1, s2
      await dllPage.setNewNodeValue('s1'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('s2'); await dllPage.clickInsertTail();

      // Search existing 's2' -> shows alert that found AND updates current node
      await dllPage.setSearchValue('s2');
      const foundDialogPromise = page.waitForEvent('dialog');
      await dllPage.clickSearch();
      const foundDialog = await foundDialogPromise;
      expect(foundDialog.message()).toBe('Found node with value "s2". Current node updated.');
      await foundDialog.accept();
      expect(await dllPage.getCurrentValueText()).toBe('s2');

      // Search non-existing 'zzz'
      await dllPage.setSearchValue('zzz');
      const notFoundPromise = page.waitForEvent('dialog');
      await dllPage.clickSearch();
      const notFoundDialog = await notFoundPromise;
      expect(notFoundDialog.message()).toBe('No node found with value "zzz".');
      await notFoundDialog.accept();
    });
  });

  test.describe('Show, reverse, clear and verbose features', () => {
    test('Show Entire List displays alert with forward list', async ({ page }) => {
      // Build list: showA, showB
      await dllPage.setNewNodeValue('showA'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('showB'); await dllPage.clickInsertTail();

      const dialogPromise = page.waitForEvent('dialog');
      await dllPage.clickShowAll();
      const d = await dialogPromise;
      expect(d.message()).toContain('List (Head to Tail):');
      expect(d.message()).toContain('showA <-> showB');
      await d.accept();
    });

    test('Reverse list flips forward/backward displays and resets current to new head', async ({ page }) => {
      // Build list: r1, r2, r3
      await dllPage.setNewNodeValue('r1'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('r2'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('r3'); await dllPage.clickInsertTail();

      // Current is last inserted r3 (tail)
      expect(await dllPage.getCurrentValueText()).toBe('r3');

      // Reverse
      await dllPage.clickReverseList();
      // After reverse, forward should be r3 <-> r2 <-> r1
      expect(await dllPage.getForwardText()).toBe('r3 <-> r2 <-> r1');
      // Current node reset to head (which is r3)
      expect(await dllPage.getCurrentValueText()).toBe('r3');
      expect(await dllPage.getCurrentIndexText()).toBe('0');
    });

    test('Clear list asks confirmation and empties data on accept; warns when already empty', async ({ page }) => {
      // Build list then clear
      await dllPage.setNewNodeValue('c1'); await dllPage.clickInsertTail();
      expect(await dllPage.getListSizeText()).toBe('1');

      // Intercept confirm - the dialog is a confirm; accept it to proceed
      const confirmPromise = page.waitForEvent('dialog');
      await dllPage.clickClearList();
      const confirmDialog = await confirmPromise;
      // Confirm prompt text check
      expect(confirmDialog.message()).toBe('Are you sure you want to clear the entire list?');
      await confirmDialog.accept();

      // After clearing
      expect(await dllPage.getListSizeText()).toBe('0');
      expect(await dllPage.getCurrentIndexText()).toBe('-');
      expect(await dllPage.getCurrentValueText()).toBe('-');

      // Attempt to clear an already empty list -> alert 'List is already empty.'
      const alertPromise = page.waitForEvent('dialog');
      await dllPage.clickClearList();
      const alert = await alertPromise;
      expect(alert.message()).toBe('List is already empty.');
      await alert.accept();
    });

    test('Toggle verbose mode reveals output area and updates button text', async ({ page }) => {
      // Initially verbose is off
      expect(await dllPage.getToggleVerboseText()).toContain('Off');
      expect(await dllPage.isVerboseVisible()).toBe(false);

      // Toggle on
      await dllPage.clickToggleVerbose();
      expect(await dllPage.getToggleVerboseText()).toContain('On');
      expect(await dllPage.isVerboseVisible()).toBe(true);

      // Toggle off
      await dllPage.clickToggleVerbose();
      expect(await dllPage.getToggleVerboseText()).toContain('Off');
      // verboseOutput is hidden again
      expect(await dllPage.isVerboseVisible()).toBe(false);
    });
  });

  test.describe('Auto traversal functionality (AutoNext, AutoPrev, AutoStop)', () => {
    test('Auto Next traverses forward for some steps and AutoStop halts it', async ({ page }) => {
      // Prepare list with 5 nodes
      await dllPage.setNewNodeValue('a1'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('a2'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('a3'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('a4'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('a5'); await dllPage.clickInsertTail();

      // Set short delay
      await dllPage.setStepDelay(100);

      // Start auto next - no dialog expected immediately
      await dllPage.clickAutoNext();
      // Wait a little so that at least one auto step happens
      await page.waitForTimeout(350); // allows ~3 steps at 100ms, but be conservative

      // Stop auto traversal
      await dllPage.clickAutoStop();

      // After stopping, current index should be >= 0 (some progress), and less than size
      const idxText = await dllPage.getCurrentIndexText();
      expect(idxText).not.toBe('-');
      const idx = Number(idxText);
      expect(Number.isFinite(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(Number(await dllPage.getListSizeText()));
    });

    test('Auto Prev traverses backwards for some steps and alerts when empty', async ({ page }) => {
      // First, ensure empty auto prev triggers alert
      // Clear list if anything exists by clicking clear and accepting if confirm; but simpler: attempt autoPrev on empty page
      // Ensure list is empty (if not, clear)
      const sizeText = await dllPage.getListSizeText();
      if (sizeText !== '0') {
        // clear with confirm
        const confirmPromise = page.waitForEvent('dialog');
        await dllPage.clickClearList();
        const confirmDialog = await confirmPromise;
        await confirmDialog.accept();
      }

      // Now try auto prev on empty -> alert
      const alertPromise = page.waitForEvent('dialog');
      await dllPage.clickAutoPrev();
      const alert = await alertPromise;
      expect(alert.message()).toBe('List is empty, cannot auto traverse.');
      await alert.accept();

      // Build list for a proper autoPrev run
      await dllPage.setNewNodeValue('p1'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('p2'); await dllPage.clickInsertTail();
      await dllPage.setNewNodeValue('p3'); await dllPage.clickInsertTail();

      await dllPage.setStepDelay(100);
      // Start auto prev
      await dllPage.clickAutoPrev();
      // Wait a bit to let it step
      await page.waitForTimeout(250);
      // Stop auto traversal
      await dllPage.clickAutoStop();

      // Index should be a valid number
      const idxText2 = await dllPage.getCurrentIndexText();
      expect(idxText2).not.toBe('-');
      const idx2 = Number(idxText2);
      expect(Number.isFinite(idx2)).toBe(true);
      expect(idx2).toBeGreaterThanOrEqual(0);
      expect(idx2).toBeLessThan(Number(await dllPage.getListSizeText()));
    });
  });

  test.describe('Edge cases and invalid input handling', () => {
    test('Remove head/tail when list empty shows alerts', async ({ page }) => {
      // Ensure empty
      const sizeText = await dllPage.getListSizeText();
      if (sizeText !== '0') {
        // clear with confirm
        const confirmPromise = page.waitForEvent('dialog');
        await dllPage.clickClearList();
        const confirmDialog = await confirmPromise;
        await confirmDialog.accept();
      }

      // Remove head on empty -> alert
      const alert1 = page.waitForEvent('dialog');
      await dllPage.clickRemoveHead();
      const a1 = await alert1;
      expect(a1.message()).toBe('List is empty, no head to remove.');
      await a1.accept();

      // Remove tail on empty -> alert
      const alert2 = page.waitForEvent('dialog');
      await dllPage.clickRemoveTail();
      const a2 = await alert2;
      expect(a2.message()).toBe('List is empty, no tail to remove.');
      await a2.accept();
    });

    test('Remove by value with empty input shows alert', async ({ page }) => {
      // Ensure removeValueInput is empty
      await dllPage.setRemoveValue('');
      const alertPromise = page.waitForEvent('dialog');
      await dllPage.clickRemoveByValue();
      const dialog = await alertPromise;
      expect(dialog.message()).toBe('Please enter a value to remove.');
      await dialog.accept();
    });

    test('Insert before/after with empty newNodeValue or empty target shows alerts', async ({ page }) => {
      // Build a node to be a valid target
      await dllPage.setNewNodeValue('T'); await dllPage.clickInsertTail();

      // empty new node value
      await dllPage.setNewNodeValue('');
      await dllPage.setTargetValue('T');
      const dialogPromise = page.waitForEvent('dialog');
      await dllPage.clickInsertBefore();
      const d = await dialogPromise;
      expect(d.message()).toBe('Please enter a value for the new node.');
      await d.accept();

      // empty target
      await dllPage.setNewNodeValue('U');
      await dllPage.setTargetValue('');
      const dialogPromise2 = page.waitForEvent('dialog');
      await dllPage.clickInsertAfter();
      const d2 = await dialogPromise2;
      expect(d2.message()).toBe('Please enter the target node value.');
      await d2.accept();
    });
  });

  // Final check that no uncaught exceptions or console error messages were emitted during tests
  test('No uncaught page errors or console.error logs were emitted during interactions', async ({ page }) => {
    // This test relies on page-level listeners defined in beforeEach and afterEach.
    // The afterEach already asserts there were no page errors or console.error messages.
    // We repeat a sanity check here for the current page instance.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
    // Also ensure we captured various console messages (even if none)
    // This assertion is lenient: it's valid for there to be zero console messages.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});