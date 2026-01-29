import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c139043-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object model for the priority queue demo
class PQPage {
  constructor(page) {
    this.page = page;
    // Controls
    this.impl = page.locator('#impl');
    this.mode = page.locator('#mode');
    this.stable = page.locator('#stable');
    this.valueInput = page.locator('#valueInput');
    this.priorityInput = page.locator('#priorityInput');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.clearBtn = page.locator('#clearBtn');

    this.generateCount = page.locator('#generateCount');
    this.randomBtn = page.locator('#randomBtn');
    this.randomPreset = page.locator('#randomPreset');
    this.randomSeed = page.locator('#randomSeed');

    this.bulkInput = page.locator('#bulkInput');
    this.bulkBtn = page.locator('#bulkBtn');

    this.targetIndex = page.locator('#targetIndex');
    this.newPriority = page.locator('#newPriority');
    this.changePriorityBtn = page.locator('#changePriorityBtn');
    this.removeBtn = page.locator('#removeBtn');

    this.stepModeBtn = page.locator('#stepModeBtn');
    this.autoRunBtn = page.locator('#autoRunBtn');
    this.stopAutoBtn = page.locator('#stopAutoBtn');
    this.stepPrevBtn = page.locator('#stepPrevBtn');
    this.stepNextBtn = page.locator('#stepNextBtn');

    this.cloneBtn = page.locator('#cloneBtn');
    this.mergeBtn = page.locator('#mergeBtn');
    this.exportBtn = page.locator('#exportBtn');
    this.importBtn = page.locator('#importBtn');
    this.importArea = page.locator('#importArea');

    this.undoBtn = page.locator('#undoBtn');
    this.redoBtn = page.locator('#redoBtn');

    // Views
    this.arrayView = page.locator('#arrayView');
    this.treeView = page.locator('#treeView');
    this.instrView = page.locator('#instr');
    this.stepsView = page.locator('#stepsView');
    this.simArrayView = page.locator('#simArrayView');
    this.sizeLabel = page.locator('#size');
    this.implLabel = page.locator('#implLabel');
    this.logArea = page.locator('#logArea');
    this.historyInfo = page.locator('#historyInfo');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for initialization log to appear in logArea
    await expect(this.arrayView).toHaveText('[]');
  }

  async getArraySnapshot() {
    const text = (await this.arrayView.textContent()) || '[]';
    try {
      return JSON.parse(text);
    } catch (e) {
      // fallback: return raw text
      return text;
    }
  }

  async getSize() {
    const t = (await this.sizeLabel.textContent()) || '0';
    return Number(t.trim());
  }

  async lastLogLines(n = 5) {
    const txt = (await this.logArea.inputValue()) || '';
    const lines = txt.split('\n').filter(Boolean);
    return lines.slice(-n);
  }

  // utility to parse importArea content as JSON if present
  async getImportAreaJSON() {
    const text = (await this.importArea.inputValue()) || '';
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}

test.describe('Priority Queue Interactive Demo — FSM transitions and UI behavior', () => {
  let page;
  let pq;
  let consoleErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    pq = new PQPage(page);
    consoleErrors = [];
    // capture console errors and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });
    await pq.goto();
  });

  test.afterEach(async () => {
    // Assert no catastrophic runtime errors like ReferenceError/SyntaxError/TypeError were emitted
    const problematic = consoleErrors.filter(msg =>
      /ReferenceError|SyntaxError|TypeError/.test(msg)
    );
    expect(problematic, `No Reference/Syntax/Type errors in console, got: ${JSON.stringify(problematic)}`).toHaveLength(0);
    await page.close();
  });

  test('Initial state S0_Initialized: page initialized with empty queue and baseline history', async () => {
    // Validate initial UI state: empty queue, size 0, implementation label set, history at least 1
    await expect(pq.arrayView).toHaveText('[]');
    await expect(pq.sizeLabel).toHaveText('0');
    const implLabel = await pq.implLabel.textContent();
    expect(implLabel).toContain('binary'); // default implementation is binary
    const hist = await pq.historyInfo.textContent();
    // history should indicate at least "history 1/1" after init
    expect(hist).toMatch(/history \d+\/\d+/);
    // log should include initialization message (implementation logs this)
    const last = await pq.lastLogLines(1);
    expect(last.length).toBeGreaterThanOrEqual(1);
    expect(last[0].toLowerCase()).toContain('initialized');
  });

  test('Enqueue (S1_Enqueued), Peek (S3_Peeked), Dequeue (S2_Dequeued) and Undo/Redo (S12,S13)', async () => {
    // Enqueue an item
    await pq.valueInput.fill('alpha');
    await pq.priorityInput.fill('5');
    await pq.enqueueBtn.click();
    // After enqueue, size should be 1 and array must contain the item value
    await expect(pq.sizeLabel).toHaveText('1');
    const arrAfterEnq = await pq.getArraySnapshot();
    expect(Array.isArray(arrAfterEnq)).toBeTruthy();
    expect(arrAfterEnq.length).toBeGreaterThanOrEqual(1);
    const found = arrAfterEnq.find(x => x.value === 'alpha' && Number(x.priority) === 5);
    expect(found, 'Enqueued item must appear in array snapshot').toBeTruthy();

    // Peek: should not change size, should log peek result
    await pq.peekBtn.click();
    await expect(pq.sizeLabel).toHaveText('1');
    const peekLog = (await pq.lastLogLines(3)).join('\n');
    expect(peekLog).toMatch(/Peek =>/);

    // Dequeue: size should reduce to 0 and log should show Dequeue result
    await pq.dequeueBtn.click();
    await expect(pq.sizeLabel).toHaveText('0');
    const arrAfterDeq = await pq.getArraySnapshot();
    if (Array.isArray(arrAfterDeq)) expect(arrAfterDeq.length).toBe(0);

    // Undo: revert dequeue -> should restore previous snapshot (size 1)
    await pq.undoBtn.click();
    // Undo may be asynchronous; wait until historyInfo updates to reflect change
    await expect(pq.sizeLabel).toHaveText('1');
    const arrAfterUndo = await pq.getArraySnapshot();
    expect(Array.isArray(arrAfterUndo)).toBeTruthy();
    expect(arrAfterUndo.length).toBeGreaterThanOrEqual(1);

    // Redo: should re-apply dequeue and return to size 0
    await pq.redoBtn.click();
    await expect(pq.sizeLabel).toHaveText('0');
  });

  test('Clear (S4_Cleared) and Bulk Enqueue (S5_BulkEnqueued) via CSV and JSON', async () => {
    // Ensure queue is cleared using Clear button
    await pq.clearBtn.click();
    await expect(pq.sizeLabel).toHaveText('0');
    const arrCleared = await pq.getArraySnapshot();
    expect(Array.isArray(arrCleared)).toBeTruthy();
    expect(arrCleared.length).toBe(0);

    // Bulk enqueue using CSV-style input
    await pq.bulkInput.fill('x:11,y:22');
    await pq.bulkBtn.click();
    // After bulk, size should be 2 and array should include both values
    await expect(pq.sizeLabel).toHaveText('2');
    const arrCsv = await pq.getArraySnapshot();
    const vx = arrCsv.find(i => i.value === 'x' && Number(i.priority) === 11);
    const vy = arrCsv.find(i => i.value === 'y' && Number(i.priority) === 22);
    expect(vx).toBeTruthy();
    expect(vy).toBeTruthy();

    // Clear then bulk enqueue using JSON array format of objects
    await pq.clearBtn.click();
    await expect(pq.sizeLabel).toHaveText('0');
    await pq.bulkInput.fill(JSON.stringify([{ value: 'ja', priority: 9 }, { value: 'jb', priority: 3 }]));
    await pq.bulkBtn.click();
    await expect(pq.sizeLabel).toHaveText('2');
    const arrJson = await pq.getArraySnapshot();
    expect(arrJson.find(i => i.value === 'ja')).toBeTruthy();
    expect(arrJson.find(i => i.value === 'jb')).toBeTruthy();
  });

  test('Change priority (S6_PriorityChanged) and Remove item (S7_ItemRemoved) including edge cases', async () => {
    // Start fresh
    await pq.clearBtn.click();
    await expect(pq.sizeLabel).toHaveText('0');

    // Enqueue two items via direct inputs
    await pq.valueInput.fill('cval');
    await pq.priorityInput.fill('10');
    await pq.enqueueBtn.click();

    await pq.valueInput.fill('dval');
    await pq.priorityInput.fill('20');
    await pq.enqueueBtn.click();

    await expect(pq.sizeLabel).toHaveText('2');

    // Change priority of 'cval' to 50
    await pq.targetIndex.fill('cval');
    await pq.newPriority.fill('50');
    await pq.changePriorityBtn.click();

    // After change, snapshot must show updated priority for value 'cval'
    const arrAfterChange = await pq.getArraySnapshot();
    const changed = arrAfterChange.find(i => i.value === 'cval');
    expect(changed).toBeTruthy();
    expect(Number(changed.priority)).toBe(50);

    // Remove 'dval'
    await pq.targetIndex.fill('dval');
    await pq.removeBtn.click();
    // After remove, size should be 1 and 'dval' must not be present
    await expect(pq.sizeLabel).toHaveText('1');
    const arrAfterRemove = await pq.getArraySnapshot();
    expect(arrAfterRemove.find(i => i.value === 'dval')).toBeFalsy();

    // Edge case: changePriority for non-existent item should be handled gracefully and logged
    await pq.targetIndex.fill('nonexistent');
    await pq.newPriority.fill('7');
    await pq.changePriorityBtn.click();
    const logs = await pq.lastLogLines(5);
    const joined = logs.join('\n');
    // Implementation logs either 'not found' or similar; at minimum it should not throw.
    expect(joined.length).toBeGreaterThan(0);

    // Edge case: remove with empty target should do nothing (UI returns early)
    await pq.targetIndex.fill('');
    await pq.removeBtn.click();
    // Size should remain unchanged
    await expect(pq.sizeLabel).toHaveText('1');
  });

  test('Clone (S8_Cloned) and Merge (S9_Merged) behavior', async () => {
    // Prepare a queue with two items
    await pq.clearBtn.click();
    await pq.valueInput.fill('m1');
    await pq.priorityInput.fill('1');
    await pq.enqueueBtn.click();
    await pq.valueInput.fill('m2');
    await pq.priorityInput.fill('2');
    await pq.enqueueBtn.click();
    const before = await pq.getArraySnapshot();
    const beforeLen = Array.isArray(before) ? before.length : 0;
    expect(beforeLen).toBeGreaterThanOrEqual(2);

    // Clone queue
    await pq.cloneBtn.click();
    const cloneLog = (await pq.lastLogLines(3)).join('\n');
    expect(cloneLog.toLowerCase()).toContain('cloned');

    // Merge clone: merges clone into current queue, so size should increase by cloned length
    await pq.mergeBtn.click();
    await expect(pq.sizeLabel).toHaveText(String(beforeLen * 2));
    const afterMerge = await pq.getArraySnapshot();
    // There should be at least two occurrences of 'm1' or 'm2' values
    const countM1 = afterMerge.filter(i => i.value === 'm1').length;
    expect(countM1).toBeGreaterThanOrEqual(2);
  });

  test('Export (S10_Exported) and Import (S11_Imported) JSON', async () => {
    // Ensure there are items to export
    await pq.clearBtn.click();
    await pq.valueInput.fill('e1');
    await pq.priorityInput.fill('7');
    await pq.enqueueBtn.click();

    // Export to importArea
    await pq.exportBtn.click();
    const importedJSON = await pq.getImportAreaJSON();
    expect(importedJSON).not.toBeNull();
    expect(importedJSON).toHaveProperty('arr');

    // Clear queue and import back
    await pq.clearBtn.click();
    await expect(pq.sizeLabel).toHaveText('0');
    // importArea already has JSON; click import
    await pq.importBtn.click();
    // After import, size should match exported arr length
    await expect(pq.sizeLabel).toHaveText(String(importedJSON.arr.length));

    // Edge case: import invalid JSON should log an error but not throw
    await pq.importArea.fill('not a json');
    await pq.importBtn.click();
    const logsAfterInvalid = await pq.lastLogLines(5);
    // Should contain 'Import failed' or 'format invalid' or similar; ensure logged message exists
    expect(logsAfterInvalid.join('\n').length).toBeGreaterThan(0);
  });

  test('Step mode, recorded steps, step navigation and auto-run', async () => {
    // Ensure queue is empty
    await pq.clearBtn.click();
    await expect(pq.sizeLabel).toHaveText('0');

    // Enable step mode
    await pq.stepModeBtn.click();
    const stepBtnLabel = await pq.stepModeBtn.textContent();
    expect(stepBtnLabel.toLowerCase()).toContain('step mode');

    // Enqueue in step mode: this should produce recorded steps and simulate array changes
    await pq.valueInput.fill('stepA');
    await pq.priorityInput.fill('33');
    await pq.enqueueBtn.click();

    // stepsView should not be "No steps recorded."
    await expect(pq.stepsView).not.toHaveText('No steps recorded.');

    // Simulate step navigation: click next step and ensure simArrayView updates to a JSON string
    await pq.stepNextBtn.click();
    const simText1 = await pq.simArrayView.textContent();
    expect(simText1.trim().length).toBeGreaterThan(0);

    // Step prev/back should also update (no crash)
    await pq.stepPrevBtn.click();
    const simText2 = await pq.simArrayView.textContent();
    expect(simText2).toBeTruthy();

    // Auto-run steps: call auto-run and then stop to ensure auto-run logic executes without throwing
    await pq.autoRunBtn.click();
    // Allow some time for auto-run to progress a bit; then stop
    await page.waitForTimeout(300);
    await pq.stopAutoBtn.click();
    // After stopping, ensure UI still responsive
    await expect(pq.arrayView).toBeTruthy();
  });

  test('Undo transition from initial state and boundary behavior', async () => {
    // From initial state, calling undo should be a no-op (historyIndex <= 0)
    // Record current size and history info
    const sizeBefore = await pq.getSize();
    const histBefore = await pq.historyInfo.textContent();
    await pq.undoBtn.click();
    // Expect no change
    const sizeAfter = await pq.getSize();
    const histAfter = await pq.historyInfo.textContent();
    expect(sizeAfter).toBe(sizeBefore);
    expect(histAfter).toMatch(/history \d+\/\d+/);
  });

});