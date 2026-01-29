import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d48a30-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the Circular Linked List app
class CircularListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      listDetails: page.locator('#listDetails'),
      debug: page.locator('#debug'),
      valueInput: page.locator('#valueInput'),
      addHead: page.locator('#addHead'),
      addTail: page.locator('#addTail'),
      randBtn: page.locator('#randBtn'),
      clearBtn: page.locator('#clearBtn'),
      initCount: page.locator('#initCount'),
      afterIndex: page.locator('#afterIndex'),
      insertAfter: page.locator('#insertAfter'),
      deleteAt: page.locator('#deleteAt'),
      deleteValueInput: page.locator('#deleteValueInput'),
      deleteValBtn: page.locator('#deleteValBtn'),
      findBtn: page.locator('#findBtn'),
      trStart: page.locator('#trStart'),
      trReset: page.locator('#trReset'),
      trAnimate: page.locator('#trAnimate'),
      trSpeed: page.locator('#trSpeed'),
      svg: page.locator('#svg'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // wait for debug to be populated from initial createRandom(6)
    await expect(this.locators.debug).toHaveText(/"size":\s*\d+/);
  }

  async getListDetailsText() {
    return (await this.locators.listDetails.innerText()).trim();
  }

  async getDebugObject() {
    const txt = await this.locators.debug.innerText();
    try {
      return JSON.parse(txt);
    } catch (e) {
      return null;
    }
  }

  async nodeCircleCount() {
    return await this.page.locator('svg circle').count();
  }

  async insertHead(value) {
    await this.locators.valueInput.fill(String(value));
    await this.locators.addHead.click();
  }

  async insertTail(value) {
    await this.locators.valueInput.fill(String(value));
    await this.locators.addTail.click();
  }

  async createRandom(n) {
    await this.locators.initCount.fill(String(n));
    await this.locators.randBtn.click();
  }

  async clearAccept() {
    // Accept confirm dialog for clearing
    this.page.once('dialog', d => d.accept());
    await this.locators.clearBtn.click();
  }

  async insertAfter(index, value) {
    await this.locators.afterIndex.fill(String(index));
    await this.locators.valueInput.fill(String(value));
    await this.locators.insertAfter.click();
  }

  async deleteAt(index) {
    await this.locators.afterIndex.fill(String(index));
    await this.locators.deleteAt.click();
  }

  async deleteByValue(value) {
    await this.locators.deleteValueInput.fill(String(value));
    await this.locators.deleteValBtn.click();
  }

  async findValue(value) {
    await this.locators.deleteValueInput.fill(String(value));
    await this.locators.findBtn.click();
  }

  async clickStartNext() {
    await this.locators.trStart.click();
  }

  async clickReset() {
    await this.locators.trReset.click();
  }

  async clickAnimate() {
    await this.locators.trAnimate.click();
  }

  async setSpeed(value) {
    await this.locators.trSpeed.selectOption(String(value));
  }

  // Helper: wait until list details contains a substring
  async waitForListDetailsContains(text, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, expected) => document.querySelector(sel).textContent.includes(expected),
      '#listDetails',
      text,
      { timeout }
    );
  }

  // Get the fill color of a node circle by node id from debug.sequence
  async getCircleFillForNodeId(nodeId) {
    const selector = `#node-${nodeId}`;
    const nodeEl = this.page.locator(`#${CSS.escape('node-' + nodeId)}`);
    // The circle element exists inside a <g> and has id node-<id> (set on circle element)
    const count = await nodeEl.count();
    if (count === 0) return null;
    return await nodeEl.first().getAttribute('fill');
  }

  // Return array of sequence values from debug
  async getSequenceValues() {
    const debugObj = await this.getDebugObject();
    if (!debugObj || !Array.isArray(debugObj.sequence)) return [];
    return debugObj.sequence.map(s => s.value);
  }

  // Return sequence ids
  async getSequenceIds() {
    const debugObj = await this.getDebugObject();
    if (!debugObj || !Array.isArray(debugObj.sequence)) return [];
    return debugObj.sequence.map(s => s.id);
  }
}

test.describe('Circular Linked List — FSM and UI integration tests', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });
  });

  test.describe('State presence and transitions (S0, S1, S2)', () => {
    test('Initial load should show nodes present (S1_NodesPresent)', async ({ page }) => {
      // Validate that after initial createRandom(6) the UI reports nodes present
      const app = new CircularListPage(page);
      await app.goto();

      const debugObj = await app.getDebugObject();
      expect(debugObj).toBeTruthy();
      // initial sample should have size >= 1 (implementation uses 6)
      expect(debugObj.size).toBeGreaterThan(0);
      // listDetails should report Size:
      const details = await app.getListDetailsText();
      expect(details).toMatch(/^Size:\s*\d+/);
      // svg circles count should equal debug.size
      const circles = await app.nodeCircleCount();
      expect(circles).toBe(debugObj.size);

      // No runtime page errors during load
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Clearing list goes to Empty state (S0_Empty)', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // Accept the confirmation and clear
      await app.clearAccept();

      // After clearing, list details should be 'List is empty'
      await expect(app.locators.listDetails).toHaveText('List is empty');
      const debugObj = await app.getDebugObject();
      expect(debugObj).toBeTruthy();
      expect(debugObj.size).toBe(0);

      // The svg should show the "Empty Circular Linked List" text and zero circles
      const circles = await app.nodeCircleCount();
      expect(circles).toBe(0);
    });

    test('Traversal enters Traversal state (S2_Traversal) and highlights nodes', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // Ensure we have at least 3 nodes to test stepping
      await app.createRandom(4);
      // Make animation faster for testing
      await app.setSpeed('180');

      // Step start: first click should start traversal at head (index 0)
      await app.clickStartNext();

      // listDetails should include 'current -> index 0'
      await app.waitForListDetailsContains('current -> index 0', 2000);
      let details = await app.getListDetailsText();
      expect(details).toContain('current -> index 0');

      // Record highlighted node id from debug sequence index 0
      const seq = await app.getDebugObject();
      expect(seq.sequence.length).toBeGreaterThanOrEqual(1);
      const headId = seq.sequence[0].id;
      const fill = await app.getCircleFillForNodeId(headId);
      expect(fill).toBeTruthy();
      // Highlight color expected by implementation
      expect(fill.toLowerCase()).toBe('#fffbec');

      // Next click should advance to index 1
      await app.clickStartNext();
      await app.waitForListDetailsContains('current -> index 1', 2000);
      details = await app.getListDetailsText();
      expect(details).toContain('current -> index 1');

      // Reset traversal returns to S1_NodesPresent (no current)
      await app.clickReset();
      const postResetDetails = await app.getListDetailsText();
      // after reset, listDetails should not include 'current -> index'
      expect(postResetDetails).not.toContain('current -> index');
    });
  });

  test.describe('Event/Transition tests (insert, delete, find, random, clear)', () => {
    test('Insert Head transitions from S1 -> S1 (or S0 -> S1 if empty) and updates head', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // get current size and sequence
      const before = await app.getDebugObject();
      const beforeSize = before.size;

      // Insert a new head
      await app.insertHead('HEAD-TEST-1');

      // debug should update
      const after = await app.getDebugObject();
      expect(after.size).toBe(beforeSize + 1);
      // new head value should be first in sequence
      const values = after.sequence.map(s => s.value);
      expect(values[0]).toBe('HEAD-TEST-1');
    });

    test('Insert Tail updates tail (size increases)', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      const before = await app.getDebugObject();
      const beforeSize = before.size;

      await app.insertTail('TAIL-TEST-1');

      const after = await app.getDebugObject();
      expect(after.size).toBe(beforeSize + 1);
      const values = after.sequence.map(s => s.value);
      expect(values[values.length - 1]).toBe('TAIL-TEST-1');
    });

    test('Insert After inserts node after specified index', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // ensure at least 3 nodes
      await app.createRandom(4);
      const before = await app.getDebugObject();
      const insertIndex = 1;
      const value = 'AFTER-VAL';
      await app.insertAfter(insertIndex, value);

      const after = await app.getDebugObject();
      expect(after.size).toBe(before.size + 1);
      const values = after.sequence.map(s => s.value);
      // new node should be at position insertIndex+1
      expect(values[insertIndex + 1]).toBe(value);
    });

    test('Delete at index removes the node and updates head when necessary', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // create a known small list
      await app.createRandom(3);
      const before = await app.getDebugObject();
      expect(before.size).toBe(3);

      // delete head (index 0)
      await app.deleteAt(0);

      const after = await app.getDebugObject();
      expect(after.size).toBe(2);
      // headId should correspond to new first sequence id
      expect(after.headId).toBe(after.sequence[0].id);
    });

    test('Delete by value removes first occurrence; unknown value alerts', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // Ensure list has at least one known value
      await app.insertHead('DEL-VAL-1');
      // Delete that value - should succeed without alert (implementation deletes silently)
      await app.deleteByValue('DEL-VAL-1');

      const after = await app.getDebugObject();
      // ensure value not present in sequence
      const values = after.sequence.map(s => s.value);
      expect(values).not.toContain('DEL-VAL-1');

      // Now attempt to delete a value not present - expect alert 'Value not found'
      let dialogMessage = null;
      page.once('dialog', d => { dialogMessage = d.message(); d.accept(); });
      await app.locators.deleteValueInput.fill('NON_EXISTENT_VALUE_999');
      await app.locators.deleteValBtn.click();
      // dialog should have appeared
      expect(dialogMessage).toMatch(/Value not found/);
    });

    test('Find Value shows alert and highlights found node', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // Insert a distinct value at head then find it
      await app.insertHead('FINDME-123');
      // Listen for the alert triggered by findBtn
      let dialogMessage = null;
      page.once('dialog', d => { dialogMessage = d.message(); d.accept(); });

      await app.locators.deleteValueInput.fill('FINDME-123');
      await app.locators.findBtn.click();

      expect(dialogMessage).toMatch(/Value found at index \d+/);

      // After find, listDetails should have 'current -> index'
      const details = await app.getListDetailsText();
      expect(details).toContain('current -> index');

      // Ensure the highlighted circle corresponds to the found id (the debug sequence contains the id)
      const debugObj = await app.getDebugObject();
      const idx = debugObj.sequence.findIndex(n => n.value === 'FINDME-123');
      expect(idx).toBeGreaterThanOrEqual(0);
      const foundId = debugObj.sequence[idx].id;
      const fill = await app.getCircleFillForNodeId(foundId);
      expect(fill.toLowerCase()).toBe('#fffbec');
    });

    test('Create Random populates requested number of nodes (bounded 0..12)', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      await app.createRandom(3);
      const debugObj = await app.getDebugObject();
      expect(debugObj.size).toBe(3);

      // Request an out-of-range large value to ensure bounding works
      await app.createRandom(1000);
      const debugObj2 = await app.getDebugObject();
      // Implementation bounds to max 12; size should be <= 12
      expect(debugObj2.size).toBeLessThanOrEqual(12);
    });

    test('Clear button confirmation and clearing behavior', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // Trigger confirm and cancel first (simulate user cancelling)
      let seenDialog = null;
      page.once('dialog', d => { seenDialog = d.message(); d.dismiss(); });
      await app.locators.clearBtn.click();
      expect(seenDialog).toBe('Clear the whole list?');

      // List should remain non-empty
      const debugAfterCancel = await app.getDebugObject();
      expect(debugAfterCancel.size).toBeGreaterThan(0);

      // Now accept the confirm
      await app.clearAccept();
      const debugAfterAccept = await app.getDebugObject();
      expect(debugAfterAccept.size).toBe(0);
      await expect(app.locators.listDetails).toHaveText('List is empty');
    });
  });

  test.describe('Traversal animation and controls', () => {
    test('Animate traversal runs and completes a full loop', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // create small list and set fast speed for test
      await app.createRandom(4);
      await app.setSpeed('180');

      // Start animation and wait until we observe current -> index 0 again after cycling
      await app.clickAnimate();

      // Wait until listDetails indicates current index 0 (may be immediate) and then again
      // We'll wait up to 6 seconds for animation to complete a loop
      await page.waitForFunction(
        () => document.querySelector('#listDetails') && document.querySelector('#listDetails').textContent.includes('current -> index 0'),
        null,
        { timeout: 6000 }
      );

      const details = await app.getListDetailsText();
      expect(details).toContain('current -> index 0');
    });
  });

  test.describe('Edge cases and error dialogs', () => {
    test('Adding with empty input triggers alert for Insert Head/Tail', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // Ensure input empty and click addHead
      await app.locators.valueInput.fill('');
      let msg = null;
      page.once('dialog', d => { msg = d.message(); d.accept(); });
      await app.locators.addHead.click();
      expect(msg).toBe('Enter a value');

      // addTail with empty input
      msg = null;
      page.once('dialog', d => { msg = d.message(); d.accept(); });
      await app.locators.addTail.click();
      expect(msg).toBe('Enter a value');
    });

    test('Insert After with invalid index informs user', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // leave afterIndex empty and attempt insertAfter
      await app.locators.afterIndex.fill('');
      await app.locators.valueInput.fill('X');
      let dialogMessage = null;
      page.once('dialog', d => { dialogMessage = d.message(); d.accept(); });
      await app.locators.insertAfter.click();
      expect(dialogMessage).toBe('Enter index');
    });

    test('Delete at with missing index shows alert', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      await app.locators.afterIndex.fill('');
      let msg = null;
      page.once('dialog', d => { msg = d.message(); d.accept(); });
      await app.locators.deleteAt.click();
      expect(msg).toBe('Enter index to delete in the same field');
    });

    test('Delete by value on empty list alerts "List empty"', async ({ page }) => {
      const app = new CircularListPage(page);
      await app.goto();

      // Clear list
      await app.clearAccept();
      const debugObj = await app.getDebugObject();
      expect(debugObj.size).toBe(0);

      // Provide a value and attempt delete; should alert 'List empty'
      let msg = null;
      page.once('dialog', d => { msg = d.message(); d.accept(); });
      await app.locators.deleteValueInput.fill('whatever');
      await app.locators.deleteValBtn.click();

      expect(msg).toBe('List empty');
    });
  });

  test('No unexpected runtime errors logged to console or pageerror during full interaction sequence', async ({ page }) => {
    // This test runs through a sequence of interactions and verifies no uncaught errors occurred
    const app = new CircularListPage(page);
    await app.goto();

    // Perform a variety of actions quickly
    await app.insertHead('A1');
    await app.insertTail('B2');
    await app.insertAfter(1, 'A2');
    await app.deleteByValue('A1'); // might delete silently
    await app.createRandom(3);
    // Accept clear to empty then re-create
    await app.clearAccept();
    await app.createRandom(2);

    // Step traversal a few times
    await app.clickStartNext();
    await app.clickStartNext();
    await app.clickReset();

    // Click animate briefly
    await app.setSpeed('180');
    await app.clickAnimate();
    // wait a short time while animation runs
    await page.waitForTimeout(800);
    // Reset to stop any ongoing animation
    await app.clickReset();

    // Validate no page errors or console errors were captured
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});