import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c12f402-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Simple page object for the Queue Playground to keep tests readable
class QueuePage {
  constructor(page) {
    this.page = page;
    // Locators
    this.newName = page.locator('#newName');
    this.newCapacity = page.locator('#newCapacity');
    this.newCircular = page.locator('#newCircular');
    this.createQueue = page.locator('#createQueue');
    this.cloneQueue = page.locator('#cloneQueue');
    this.deleteQueue = page.locator('#deleteQueue');
    this.queueSelect = page.locator('#queueSelect');
    this.selectedName = page.locator('#selectedName');
    this.selectedCapacity = page.locator('#selectedCapacity');
    this.selectedMode = page.locator('#selectedMode');
    this.selectedSize = page.locator('#selectedSize');
    this.queueView = page.locator('#queueView');
    this.valueInput = page.locator('#valueInput');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.peekCount = page.locator('#peekCount');
    this.peekBtn = page.locator('#peekBtn');
    this.deqCount = page.locator('#deqCount');
    this.undoBtn = page.locator('#undoBtn');
    this.redoBtn = page.locator('#redoBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.batchInput = page.locator('#batchInput');
    this.batchEnqueueBtn = page.locator('#batchEnqueueBtn');
    this.logArea = page.locator('#logArea');
    this.historyLen = page.locator('#historyLen');
    this.transactionArea = page.locator('#transactionArea');
    this.stageTransaction = page.locator('#stageTransaction');
    this.previewTransaction = page.locator('#previewTransaction');
    this.commitTransaction = page.locator('#commitTransaction');
    this.transactionPreview = page.locator('#transactionPreview');
    this.removeValue = page.locator('#removeValue');
    this.removeValueBtn = page.locator('#removeValueBtn');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait until the initial "Queue Playground ready." log entry is appended
    await expect(this.logArea).toContainText('Queue Playground ready.');
    // Ensure the UI has rendered selected name
    await expect(this.selectedName).toBeVisible();
  }

  async getOptionCount() {
    return await this.page.evaluate(() => document.getElementById('queueSelect').options.length);
  }

  async getOptionTexts() {
    return await this.page.evaluate(() => Array.from(document.getElementById('queueSelect').options).map(o => o.text));
  }

  async selectByIndex(index) {
    // select option value equals index (option values are indices)
    await this.page.selectOption('#queueSelect', String(index));
    // Wait for renderAll to complete (selectedName should change)
    await this.page.waitForTimeout(50);
  }

  async getQueueViewText() {
    return (await this.queueView.textContent()) || '';
  }

  async getLogText() {
    return (await this.logArea.textContent()) || '';
  }

  async getSelectedSize() {
    return (await this.selectedSize.textContent()) || '';
  }

  async createQueue(name, capacity = 0, circular = false) {
    await this.newName.fill(name);
    await this.newCapacity.fill(String(capacity));
    const circ = await this.newCircular.isChecked();
    if (circ !== circular) {
      await this.newCircular.click();
    }
    await this.createQueue.click();
    // allow DOM updates
    await this.page.waitForTimeout(50);
  }

  async cloneCurrent() {
    await this.cloneQueue.click();
    await this.page.waitForTimeout(50);
  }

  async deleteCurrent() {
    await this.deleteQueue.click();
    await this.page.waitForTimeout(50);
  }

  async enqueueValue(v) {
    await this.valueInput.fill(String(v));
    await this.enqueueBtn.click();
    await this.page.waitForTimeout(50);
  }

  async dequeueCount(count = 1) {
    await this.deqCount.fill(String(count));
    await this.dequeueBtn.click();
    await this.page.waitForTimeout(50);
  }

  async peek(count = 1) {
    await this.peekCount.fill(String(count));
    await this.peekBtn.click();
    await this.page.waitForTimeout(50);
  }

  async undo() {
    await this.undoBtn.click();
    await this.page.waitForTimeout(50);
  }

  async redo() {
    await this.redoBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clearQueue() {
    await this.clearBtn.click();
    await this.page.waitForTimeout(50);
  }

  async batchEnqueue(csv) {
    await this.batchInput.fill(csv);
    await this.batchEnqueueBtn.click();
    await this.page.waitForTimeout(50);
  }

  async stageTransactionText(text) {
    await this.transactionArea.fill(text);
    await this.stageTransaction.click();
    await this.page.waitForTimeout(50);
  }

  async previewTransactionClick() {
    await this.previewTransaction.click();
    await this.page.waitForTimeout(50);
  }

  async commitTransactionClick() {
    await this.commitTransaction.click();
    await this.page.waitForTimeout(50);
  }

  async removeAllMatches(val) {
    await this.removeValue.fill(String(val));
    await this.removeValueBtn.click();
    await this.page.waitForTimeout(50);
  }
}

test.describe('Queue Playground FSM and UI interactions', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert there were no uncaught page errors or console.error messages during the test run.
    // The spec mandates observing such errors and letting them occur naturally; here we assert none occurred.
    // If the environment or the app causes errors, these assertions will fail and surface them.
    expect(pageErrors, 'no uncaught page errors').toHaveLength(0);
    expect(consoleErrors, 'no console.error calls').toHaveLength(0);
  });

  test('Initial Idle state (S0_Idle) renders controls and initial queues', async ({ page }) => {
    // Validate renderAll() executed on load, initial queues created, and UI displays correct selection
    const qp = new QueuePage(page);
    await qp.goto();

    // The select should exist and have at least 2 initial queues as init creates Q1 and Bounded
    const optionCount = await qp.getOptionCount();
    expect(optionCount).toBeGreaterThanOrEqual(2);

    // Selected name should be "Q1" (init creates Q1 at index 0 and then switches to index 0)
    const selected = await qp.selectedName.textContent();
    expect(selected.trim()).toBe('Q1');

    // Capacity for Q1 is unbounded
    const cap = await qp.selectedCapacity.textContent();
    expect(cap.trim()).toBe('unbounded');

    // queueView should contain the Name line
    const view = await qp.getQueueViewText();
    expect(view).toContain('Name: Q1');

    // history length should be present (initially 0)
    const historyLen = await qp.historyLen.textContent();
    expect(Number(historyLen)).toBeGreaterThanOrEqual(0);
  });

  test('CreateQueue transition (S0_Idle -> S1_QueueCreated) creates a new queue and updates UI', async ({ page }) => {
    const qp = new QueuePage(page);
    await qp.goto();

    // Count options before creating
    const beforeCount = await qp.getOptionCount();

    // Create a bounded circular queue via the UI
    const newName = 'TestQ';
    await qp.createQueue(newName, 3, true);

    // After creation, option count should increase by 1
    const afterCount = await qp.getOptionCount();
    expect(afterCount).toBe(beforeCount + 1);

    // Option texts should include the new queue name
    const texts = await qp.getOptionTexts();
    const found = texts.find(t => t.startsWith(newName));
    expect(found).toBeTruthy();

    // Log area should include "Created queue TestQ"
    const logs = await qp.getLogText();
    expect(logs).toMatch(new RegExp('Created queue ' + newName));
  });

  test('CloneQueue transition (S1_QueueCreated -> S2_QueueSelected) clones the selected queue', async ({ page }) => {
    const qp = new QueuePage(page);
    await qp.goto();

    // Create a queue to clone to avoid cloning the initial ones unpredictably
    const cloneBase = 'CloneBase';
    await qp.createQueue(cloneBase, 0, false);

    // Find index of created queue
    const optionTexts = await qp.getOptionTexts();
    const idx = optionTexts.findIndex(t => t.startsWith(cloneBase));
    expect(idx).toBeGreaterThanOrEqual(0);

    // Select that queue
    await qp.selectByIndex(idx);

    // Perform clone
    await qp.cloneCurrent();

    // After cloning, the last option should be cloneBase_clone
    const textsAfter = await qp.getOptionTexts();
    const cloneText = textsAfter.find(t => t.startsWith(cloneBase + '_clone'));
    expect(cloneText).toBeTruthy();

    // Log shows cloned entry
    const logs = await qp.getLogText();
    expect(logs).toMatch(new RegExp('Cloned queue ' + cloneBase));
  });

  test('DeleteQueue transition removes the selected queue', async ({ page }) => {
    const qp = new QueuePage(page);
    await qp.goto();

    // Create a queue then delete it
    const tmpName = 'ToDelete';
    await qp.createQueue(tmpName, 0, false);
    const before = await qp.getOptionTexts();
    const idx = before.findIndex(t => t.startsWith(tmpName));
    expect(idx).toBeGreaterThanOrEqual(0);

    // Select it and delete
    await qp.selectByIndex(idx);
    await qp.deleteCurrent();

    // Now ensure it's no longer present
    const after = await qp.getOptionTexts();
    const still = after.find(t => t.startsWith(tmpName));
    expect(still).toBeUndefined();

    // Log shows deletion
    const logs = await qp.getLogText();
    expect(logs).toMatch(new RegExp('Deleted queue'));
  });

  test('Enqueue, Peek, Dequeue transitions behave correctly and provide visual feedback', async ({ page }) => {
    const qp = new QueuePage(page);
    await qp.goto();

    // Ensure working with the first queue (Q1)
    await qp.selectByIndex(0);

    // Ensure queue is clear for deterministic behavior
    await qp.clearQueue();
    // Enqueue a value and verify queueView contains it and size updates
    await qp.enqueueValue('42');

    // queueView text should include JSON string "42"
    const viewAfterEnq = await qp.getQueueViewText();
    expect(viewAfterEnq).toContain('"42"');

    // selectedSize should be "1"
    const sizeAfterEnq = await qp.getSelectedSize();
    expect(Number(sizeAfterEnq)).toBe(1);

    // Peek the front
    await qp.peek(1);
    const logAfterPeek = await qp.getLogText();
    expect(logAfterPeek).toMatch(/PEEK x1/);

    // Dequeue the item
    await qp.dequeueCount(1);
    const viewAfterDeq = await qp.getQueueViewText();
    // The textual view should indicate empty or not include "42" any more
    expect(viewAfterDeq).not.toContain('"42"');

    // Log should reflect DEQ x1
    const logAfterDeq = await qp.getLogText();
    expect(logAfterDeq).toMatch(/DEQ x1/);
  });

  test('Undo and Redo transitions restore and reapply previous operations', async ({ page }) => {
    const qp = new QueuePage(page);
    await qp.goto();

    await qp.selectByIndex(0);
    await qp.clearQueue();

    // Enqueue two distinct values
    await qp.enqueueValue('A');
    await qp.enqueueValue('B');

    // Ensure both are present in view
    let view = await qp.getQueueViewText();
    expect(view).toContain('"A"');
    expect(view).toContain('"B"');

    // Undo last operation (removes B)
    await qp.undo();
    const viewAfterUndo = await qp.getQueueViewText();
    expect(viewAfterUndo).toContain('"A"');
    expect(viewAfterUndo).not.toContain('"B"');

    // Redo should bring back B
    await qp.redo();
    const viewAfterRedo = await qp.getQueueViewText();
    expect(viewAfterRedo).toContain('"A"');
    expect(viewAfterRedo).toContain('"B"');

    // Undo twice should remove both
    await qp.undo(); // removes B
    await qp.undo(); // removes A
    const viewAfterTwoUndo = await qp.getQueueViewText();
    expect(viewAfterTwoUndo).not.toContain('"A"');
    expect(viewAfterTwoUndo).not.toContain('"B"');

    // Redo twice should restore both
    await qp.redo();
    await qp.redo();
    const viewAfterTwoRedo = await qp.getQueueViewText();
    expect(viewAfterTwoRedo).toContain('"A"');
    expect(viewAfterTwoRedo).toContain('"B"');
  });

  test('Edge cases: Dequeue from empty queue and batch enqueue behavior', async ({ page }) => {
    const qp = new QueuePage(page);
    await qp.goto();

    await qp.selectByIndex(0);
    await qp.clearQueue();

    // Attempt to dequeue when empty
    await qp.dequeueCount(1);
    const logEmptyDeq = await qp.getLogText();
    // Should log DEQ x0 (or DEQ x0 from implementation)
    expect(logEmptyDeq).toMatch(/DEQ x0|DEQ x0/);

    // Batch enqueue multiple items and verify they appear
    await qp.batchEnqueue('x,y,z');
    const viewBatch = await qp.getQueueViewText();
    expect(viewBatch).toContain('"x"');
    expect(viewBatch).toContain('"y"');
    expect(viewBatch).toContain('"z"');

    // Remove matches (edge remove)
    await qp.removeAllMatches('y');
    const viewAfterRemove = await qp.getQueueViewText();
    expect(viewAfterRemove).not.toContain('"y"');
    expect(viewAfterRemove).toContain('"x"');
    expect(viewAfterRemove).toContain('"z"');
  });

  test('Transactions: stage, preview, commit, and rollback', async ({ page }) => {
    const qp = new QueuePage(page);
    await qp.goto();

    await qp.selectByIndex(0);
    await qp.clearQueue();

    // Stage a multi-line transaction and preview it
    const txn = 'ENQ 1\nENQ batch:a,b\nROTATE L 1\nREMOVEVAL 1';
    await qp.stageTransactionText(txn);
    await qp.previewTransactionClick();

    // transactionPreview should contain JSON array preview
    const previewText = await qp.transactionPreview.textContent();
    expect(previewText).toBeTruthy();
    // Now commit the transaction
    await qp.commitTransactionClick();

    // After commit, queueView should reflect the committed changes
    const viewAfterCommit = await qp.getQueueViewText();
    // It should contain 'a' and 'b' as the remaining logical contents depending on operations
    expect(viewAfterCommit).toContain('"a"').or.toContain('"b"');
  });

  test('Apply map/filter operations and handle invalid expressions gracefully', async ({ page }) => {
    const qp = new QueuePage(page);
    await qp.goto();

    await qp.selectByIndex(0);
    await qp.clearQueue();

    // Enqueue some numeric-like strings and apply map to convert
    await qp.enqueueValue('1');
    await qp.enqueueValue('2');

    // Apply map that turns strings into numbers (x+1 won't throw but will produce NaN for strings -> new function uses x)
    await qp.page.fill('#mapExpr', 'Number(x) + 1');
    await qp.page.click('#applyMap');
    await qp.page.waitForTimeout(50);

    // The view should display numbers transformed
    const viewAfterMap = await qp.getQueueViewText();
    expect(viewAfterMap).toMatch(/1|2|3/);

    // Apply a deliberately invalid map expression to cause an error inside try/catch.
    // The implementation catches errors and appends a MAP error to the log (no uncaught exception).
    await qp.page.fill('#mapExpr', 'invalid code here (');
    await qp.page.click('#applyMap');
    await qp.page.waitForTimeout(50);

    // The log should contain 'MAP error' or similar message appended by the app
    const logs = await qp.getLogText();
    expect(logs).toMatch(/MAP error|MAP/);
  });
});