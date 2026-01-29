import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12127901-fa7a-11f0-acf9-69409043402d.html';

// Utility page object encapsulating common interactions for the demo
class CircularListPage {
  constructor(page) {
    this.page = page;
    // selectors used widely
    this.selectors = {
      initialNodes: '#initialNodes',
      createListBtn: '#createListBtn',
      listDisplay: '#listDisplay',
      insertValue: '#insertValue',
      insertPosition: '#insertPosition',
      beforeRadio: '#before',
      afterRadio: '#after',
      insertBtn: '#insertBtn',
      deletePosition: '#deletePosition',
      deleteBtn: '#deleteBtn',
      deleteValue: '#deleteValue',
      deleteValueBtn: '#deleteValueBtn',
      moveNextBtn: '#moveNextBtn',
      movePrevBtn: '#movePrevBtn',
      resetCursorBtn: '#resetCursorBtn',
      cursorPosDisplay: '#cursorPosDisplay',
      cursorSteps: '#cursorSteps',
      moveCursorStepsBtn: '#moveCursorStepsBtn',
      moveCursorBackStepsBtn: '#moveCursorBackStepsBtn',
      showCursorNodeBtn: '#showCursorNodeBtn',
      cursorNodeValue: '#cursorNodeValue',
      searchValue: '#searchValue',
      searchBtn: '#searchBtn',
      searchResult: '#searchResult',
      showInternalLinksBtn: '#showInternalLinksBtn',
      showFullStructureBtn: '#showFullStructureBtn',
      reverseListBtn: '#reverseListBtn',
      rotateListBtn: '#rotateListBtn',
      rotateSteps: '#rotateSteps',
      breakLoopBtn: '#breakLoopBtn',
      restoreLoopBtn: '#restoreLoopBtn'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getDisplayText() {
    return (await this.page.locator(this.selectors.listDisplay).innerText()).trim();
  }

  async getCursorPosText() {
    return (await this.page.locator(this.selectors.cursorPosDisplay).innerText()).trim();
  }

  async getCursorNodeValueText() {
    return (await this.page.locator(this.selectors.cursorNodeValue).innerText()).trim();
  }

  async getSearchResultText() {
    return (await this.page.locator(this.selectors.searchResult).innerText()).trim();
  }

  async setInitialNodes(n) {
    await this.page.fill(this.selectors.initialNodes, String(n));
  }

  async clickCreateList() {
    await this.page.click(this.selectors.createListBtn);
  }

  async insertNode(value, position = 0, beforeAfter = 'before') {
    await this.page.fill(this.selectors.insertValue, value);
    await this.page.fill(this.selectors.insertPosition, String(position));
    if (beforeAfter === 'before') {
      await this.page.check(this.selectors.beforeRadio);
    } else {
      await this.page.check(this.selectors.afterRadio);
    }
    await this.page.click(this.selectors.insertBtn);
  }

  async deleteAtPosition(pos) {
    await this.page.fill(this.selectors.deletePosition, String(pos));
    await this.page.click(this.selectors.deleteBtn);
  }

  async deleteByValue(val) {
    await this.page.fill(this.selectors.deleteValue, val);
    await this.page.click(this.selectors.deleteValueBtn);
  }

  async moveCursorNext() {
    await this.page.click(this.selectors.moveNextBtn);
  }

  async moveCursorPrev() {
    await this.page.click(this.selectors.movePrevBtn);
  }

  async resetCursor() {
    await this.page.click(this.selectors.resetCursorBtn);
  }

  async moveCursorSteps(steps) {
    await this.page.fill(this.selectors.cursorSteps, String(steps));
    await this.page.click(this.selectors.moveCursorStepsBtn);
  }

  async moveCursorBackSteps(steps) {
    await this.page.fill(this.selectors.cursorSteps, String(steps));
    await this.page.click(this.selectors.moveCursorBackStepsBtn);
  }

  async showCursorNodeValue() {
    await this.page.click(this.selectors.showCursorNodeBtn);
  }

  async searchValue(val) {
    await this.page.fill(this.selectors.searchValue, val);
    await this.page.click(this.selectors.searchBtn);
  }

  async showInternalLinks() {
    await this.page.click(this.selectors.showInternalLinksBtn);
  }

  async showFullStructure() {
    await this.page.click(this.selectors.showFullStructureBtn);
  }

  async reverseList() {
    await this.page.click(this.selectors.reverseListBtn);
  }

  async rotateList(steps) {
    await this.page.fill(this.selectors.rotateSteps, String(steps));
    await this.page.click(this.selectors.rotateListBtn);
  }

  async breakLoop() {
    await this.page.click(this.selectors.breakLoopBtn);
  }

  async restoreLoop() {
    await this.page.click(this.selectors.restoreLoopBtn);
  }
}

// Group tests by functionality and FSM states
test.describe('Circular Linked List Interactive Demo - FSM Validation', () => {
  // Shared per-test arrays to capture console & page errors & dialogs
  test.beforeEach(async ({ page }) => {
    // Setup a small delay for reliability
    await page.goto('about:blank');
  });

  // Each test will attach its own listeners to capture events
  test('S0 -> S1: Create/Reset List (CreateList) and initial rendering', async ({ page }) => {
    // Validate Idle -> ListCreated via clicking Create Empty/Reset
    const pageErrors = [];
    const consoleMsgs = [];
    const dialogs = [];

    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const p = new CircularListPage(page);
    await p.goto();

    // Initial state: should show [Empty list]
    expect(await p.getDisplayText()).toContain('[Empty list]');

    // Create list with 3 nodes
    await p.setInitialNodes(3);
    await p.clickCreateList();

    // After creation expect 1 -> 2 -> 3 -> [back to head]
    const disp = await p.getDisplayText();
    expect(disp).toContain('1 -> 2 -> 3 -> [back to head]');

    // Cursor should be at head index 0
    expect(await p.getCursorPosText()).toBe('0');

    // Ensure no page errors occurred during normal create
    expect(pageErrors.length).toBe(0);

    // keep console messages captured for debugging if needed
    expect(Array.isArray(consoleMsgs)).toBeTruthy();
    expect(Array.isArray(dialogs)).toBeTruthy();
  });

  test.describe('Insert and Delete Transitions (S2, S3)', () => {
    test('Insert Node: Insert at head and invalid insert shows alert', async ({ page }) => {
      const pageErrors = [];
      const dialogs = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      const p = new CircularListPage(page);
      await p.goto();

      // Create initial list with 2 nodes
      await p.setInitialNodes(2);
      await p.clickCreateList();
      expect(await p.getDisplayText()).toContain('1 -> 2 -> [back to head]');

      // Insert 'A' before position 0 => becomes new head
      await p.insertNode('A', 0, 'before');
      expect(await p.getDisplayText()).toContain("A -> 1 -> 2 -> [back to head]");

      // Try inserting with empty value -> should trigger alert "Enter a value to insert."
      // Clear the value field to ensure empty
      await page.fill(p.selectors.insertValue, '');
      await page.click(p.selectors.insertBtn);
      // dialog should have been captured
      expect(dialogs.some(m => m.includes('Enter a value to insert.'))).toBeTruthy();

      // Ensure no unexpected page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Delete Node and Delete by Value (including invalid position alert)', async ({ page }) => {
      const pageErrors = [];
      const dialogs = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      const p = new CircularListPage(page);
      await p.goto();

      // Create initial list with 3 nodes
      await p.setInitialNodes(3);
      await p.clickCreateList();
      expect(await p.getDisplayText()).toContain('1 -> 2 -> 3 -> [back to head]');

      // Delete node at position 1 (value '2')
      await p.deleteAtPosition(1);
      expect(await p.getDisplayText()).toContain('1 -> 3 -> [back to head]');

      // Insert a unique value 'X' at tail (after index length-1)
      // Use insertAt with position = current length (special handling in implementation)
      const currentDisplay = await p.getDisplayText();
      // determine current length by splitting
      const len = currentDisplay.includes('[Empty list]') ? 0 : currentDisplay.split('->').length - 1;
      await p.insertNode('X', len, 'after'); // should append
      const afterInsert = await p.getDisplayText();
      expect(afterInsert).toContain('X');

      // Now delete by value 'X'
      await p.deleteByValue('X');
      expect(await p.getDisplayText()).not.toContain('X');

      // Attempt to delete invalid position -> should alert
      // Provide a position out of range for current list (e.g., 99)
      await page.fill(p.selectors.deletePosition, '99');
      await page.click(p.selectors.deleteBtn);
      expect(dialogs.some(m => m.includes('Delete position must be between'))).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Cursor Movements and Traversal (S4)', () => {
    test('Move Cursor Next/Prev/Reset/Steps and show current node', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      page.on('pageerror', err => pageErrors.push(err));

      const p = new CircularListPage(page);
      await p.goto();

      // Create list with 3 nodes
      await p.setInitialNodes(3);
      await p.clickCreateList();

      // Initially cursor at 0
      expect(await p.getCursorPosText()).toBe('0');

      // Move next -> cursor 1
      await p.moveCursorNext();
      expect(await p.getCursorPosText()).toBe('1');

      // Move prev -> back to 0
      await p.moveCursorPrev();
      expect(await p.getCursorPosText()).toBe('0');

      // Move forward steps 2 -> cursor at index 2
      await p.moveCursorSteps(2);
      expect(await p.getCursorPosText()).toBe('2');

      // Show current node value -> should be '3'
      await p.showCursorNodeValue();
      expect(await p.getCursorNodeValueText()).toContain("Cursor node value: '3'");

      // Reset cursor to head -> index 0
      await p.resetCursor();
      expect(await p.getCursorPosText()).toBe('0');

      // Edge case: when cursor not set (empty list) -> moving should alert
      // Create/Reset to empty list
      await p.setInitialNodes(0);
      await p.clickCreateList();

      // Try moveNext when cursor not set
      await page.click(p.selectors.moveNextBtn);
      expect(dialogs.some(m => m.includes('Cursor not set. Create or reset list first.'))).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Search and Information Displays (S5 and Advanced Exploration)', () => {
    test('Search for existing and non-existing values and empty-search alert', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      page.on('pageerror', err => pageErrors.push(err));

      const p = new CircularListPage(page);
      await p.goto();

      // Create with 3 nodes
      await p.setInitialNodes(3);
      await p.clickCreateList();

      // Search existing '2'
      await p.searchValue('2');
      expect(await p.getSearchResultText()).toBe("Value '2' found at position 1.");

      // Search non-existing 'X'
      await p.searchValue('X');
      expect(await p.getSearchResultText()).toBe("Value 'X' not found in list.");

      // Empty search -> should alert and be captured
      await page.fill(p.selectors.searchValue, '');
      await page.click(p.selectors.searchBtn);
      expect(dialogs.some(m => m.includes('Enter a value to search.'))).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });

    test('Show raw links and full structure (internal links)', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const p = new CircularListPage(page);
      await p.goto();

      // Create 2 nodes
      await p.setInitialNodes(2);
      await p.clickCreateList();

      // Show internal links -> display should contain Node #0 and Node #1
      await p.showInternalLinks();
      const raw = await p.getDisplayText();
      expect(raw).toContain('Node #0');
      expect(raw).toContain('Node #1');

      // Show full structure -> should include list length and circular info
      await p.showFullStructure();
      const full = await p.getDisplayText();
      expect(full).toContain('List length = 2');
      expect(full).toContain('Is circular loop: Yes');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Reverse, Rotate, Break & Restore (S6, S7, S8, S9)', () => {
    test('Reverse and Rotate list operations reflect expected head/ordering', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const p = new CircularListPage(page);
      await p.goto();

      // Create list 3 -> 1,2,3
      await p.setInitialNodes(3);
      await p.clickCreateList();
      const original = await p.getDisplayText();
      expect(original).toContain('1 -> 2 -> 3 -> [back to head]');

      // Reverse -> expect 3 -> 2 -> 1 -> back to head
      await p.reverseList();
      const reversed = await p.getDisplayText();
      expect(reversed).toContain('3 -> 2 -> 1 -> [back to head]');

      // Rotate: restore original first by rotating (reverse again gets back? We'll recreate)
      await p.setInitialNodes(3);
      await p.clickCreateList();
      await p.rotateList(1); // head should become '2'
      const rotated = await p.getDisplayText();
      expect(rotated).toContain('2 -> 3 -> 1 -> [back to head]');

      expect(pageErrors.length).toBe(0);
    });

    test('Break loop causes a runtime page error (observed) and restore fixes it', async ({ page }) => {
      // This test explicitly asserts that the implementation produces a runtime error when breaking the loop
      // (as the UI attempts to render the list after breaking the circular linkage).
      const pageErrors = [];
      const pageErrorPromise = new Promise(resolve => {
        page.on('pageerror', err => {
          pageErrors.push(err);
          resolve(err);
        });
      });
      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      const p = new CircularListPage(page);
      await p.goto();

      // Create 3 nodes
      await p.setInitialNodes(3);
      await p.clickCreateList();
      expect(await p.getDisplayText()).toContain('1 -> 2 -> 3 -> [back to head]');

      // Click break loop - according to implementation, this will break the circular links
      // and then renderList() calls list.display() which will attempt to traverse nodes assuming circularity,
      // potentially causing a TypeError (reading property of null). We assert that a pageerror occurs.
      await p.breakLoop();

      // Wait for pageerror to be emitted (with timeout)
      // If the application did not error, the test will continue but we'll assert below that at least one error occurred.
      await Promise.race([
        pageErrorPromise,
        new Promise(r => setTimeout(r, 250)) // brief timeout to allow synchronous errors to surface
      ]);

      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // After the error, attempt to restore loop - implementation should reconnect and then render successfully.
      // The restore handler shows an alert if list already circular; not expected here.
      await p.restoreLoop();

      // After restore, the display should show proper circular list again
      const afterRestore = await p.getDisplayText();
      expect(afterRestore).toContain('1 -> 2 -> 3 -> [back to head]');
      // Also full structure should indicate circularity
      await p.showFullStructure();
      const full = await p.getDisplayText();
      expect(full).toContain('Is circular loop: Yes');
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('Rotate / Reverse on empty list produce alerts', async ({ page }) => {
      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const p = new CircularListPage(page);
      await p.goto();

      // Ensure empty
      await p.setInitialNodes(0);
      await p.clickCreateList();

      // Reverse empty -> should alert "Empty list to reverse."
      await p.reverseList();
      expect(dialogs.some(m => m.includes('Empty list to reverse.'))).toBeTruthy();

      // Rotate empty -> should alert "Empty list to rotate."
      await p.rotateList(1);
      expect(dialogs.some(m => m.includes('Empty list to rotate.'))).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });

    test('Rotate with invalid steps triggers alert', async ({ page }) => {
      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      const p = new CircularListPage(page);
      await p.goto();

      // Create list with nodes
      await p.setInitialNodes(2);
      await p.clickCreateList();

      // Fill rotateSteps with invalid value (e.g., 0 or non-numeric)
      await page.fill(p.selectors.rotateSteps, '0');
      await page.click(p.selectors.rotateListBtn);
      expect(dialogs.some(m => m.includes('Rotate steps must be 1 to 100'))).toBeTruthy();

      // Non-numeric
      await page.fill(p.selectors.rotateSteps, 'abc');
      await page.click(p.selectors.rotateListBtn);
      expect(dialogs.some(m => m.includes('Rotate steps must be 1 to 100'))).toBeTruthy();
    });
  });
});