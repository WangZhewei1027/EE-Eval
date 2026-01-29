import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d5c2b1-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the Heap page
class HeapPage {
  constructor(page) {
    this.page = page;
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.changeBtn = page.locator('#changeBtn');
    this.removeBtn = page.locator('#removeBtn');
    this.heapType = page.locator('#heapType');

    this.valueInput = page.locator('#valueInput');
    this.priorityInput = page.locator('#priorityInput');
    this.changeValue = page.locator('#changeValue');
    this.changePriority = page.locator('#changePriority');

    this.sizeEl = page.locator('#size');
    this.topEl = page.locator('#topVal');
    this.arrayView = page.locator('#arrayView');
    this.logArea = page.locator('#log');
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getLogText() {
    return await this.logArea.textContent();
  }

  async getSize() {
    const t = (await this.sizeEl.textContent())?.trim();
    return Number(t);
  }

  async getTopText() {
    return (await this.topEl.textContent())?.trim();
  }

  async countArrayNodes() {
    return await this.arrayView.locator('.node').count();
  }

  // UI actions
  async enqueue(value, priority) {
    if (value !== undefined) {
      await this.valueInput.fill(String(value));
    } else {
      await this.valueInput.fill(''); // will choose fallback in UI
    }
    if (priority !== undefined) {
      await this.priorityInput.fill(String(priority));
    }
    await this.enqueueBtn.click();
    // Wait until button re-enabled (enqueue handler disables/re-enables)
    await this.page.waitForFunction(() => !document.getElementById('enqueueBtn').disabled, null, { timeout: 5000 });
  }

  async dequeue() {
    await this.dequeueBtn.click();
    await this.page.waitForFunction(() => !document.getElementById('dequeueBtn').disabled, null, { timeout: 5000 });
  }

  async peek() {
    await this.peekBtn.click();
    // peek is synchronous; wait a tick for log update
    await this.page.waitForTimeout(50);
  }

  async insertRandom6() {
    await this.randomBtn.click();
    // randomBtn is disabled during insertion and re-enabled after; wait for re-enabled
    await this.page.waitForFunction(() => !document.getElementById('randomBtn').disabled, null, { timeout: 15000 });
  }

  async clear() {
    await this.clearBtn.click();
    // small wait for render/log
    await this.page.waitForTimeout(50);
  }

  async changePriorityOf(value, newPriority) {
    await this.changeValue.fill(String(value));
    await this.changePriority.fill(String(newPriority));
    await this.changeBtn.click();
    // changeBtn disabled/enabled during operation
    await this.page.waitForFunction(() => !document.getElementById('changeBtn').disabled, null, { timeout: 5000 });
  }

  async removeValue(value) {
    await this.changeValue.fill(String(value));
    await this.removeBtn.click();
    await this.page.waitForFunction(() => !document.getElementById('removeBtn').disabled, null, { timeout: 5000 });
  }

  async switchHeapType(typeValue) {
    await this.heapType.selectOption(typeValue);
    // heapType is disabled during rebuild and re-enabled after, wait until re-enabled
    await this.page.waitForFunction(() => !document.getElementById('heapType').disabled, null, { timeout: 5000 });
  }
}

test.describe('Priority Queue Interactive Demo (FSM states & transitions)', () => {
  let page;
  let heap;
  let consoleMessages;
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    heap = new HeapPage(page);
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // capture console messages
    page.on('console', msg => {
      const type = msg.type(); // log, error, warning, etc
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // capture dialogs (alerts)
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    await heap.navigate();
    // ensure initial render done and initial "Ready" log present
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // always close page
    await page.close();
  });

  test('S0_Idle: initial state loads and shows Ready log, size 0 and top neutral', async () => {
    // Validate initial UI state (Idle)
    expect(await heap.getSize()).toBe(0);
    expect(await heap.getTopText()).toBe('—');

    const log = await heap.getLogText();
    // log should contain the Ready message as per entry action
    expect(log).toContain('Ready — use the controls to interact with the priority queue.');

    // No uncaught page errors should have occurred on load
    expect(pageErrors.length).toBe(0);
    // There should be console logs (info), but no console errors
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_ItemEnqueued: enqueue an item updates size/top/array and logs insertion', async () => {
    // Enqueue a known item
    await heap.enqueue('TaskA', 5);

    // After enqueue, size should be 1
    await page.waitForFunction(() => document.getElementById('size').textContent.trim() === '1', null, { timeout: 3000 });
    expect(await heap.getSize()).toBe(1);

    // Top should reflect the enqueued item
    const top = await heap.getTopText();
    expect(top).toContain('TaskA');
    expect(top).toContain('prio 5');

    // Array view should have a node with index 0 and the value text
    const nodesCount = await heap.countArrayNodes();
    expect(nodesCount).toBeGreaterThanOrEqual(1);
    const arrayText = await heap.arrayView.textContent();
    expect(arrayText).toContain('TaskA');

    // Log should contain 'Inserted at index' or 'Settled at index'
    const log1 = await heap.getLogText();
    expect(log).toMatch(/Inserted at index|Settled at index/);

    // No runtime page errors produced by enqueue
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S2_ItemDequeued: dequeue returns top and log shows removal; empty-dequeue edge-case', async () => {
    // Enqueue two items to have something to dequeue
    await heap.enqueue('D1', 10);
    await heap.enqueue('D2', 3);

    // Wait until size is 2
    await page.waitForFunction(() => document.getElementById('size').textContent.trim() === '2', null, { timeout: 5000 });

    // Dequeue once
    await heap.dequeue();

    // Size should decrease to 1
    await page.waitForFunction(() => Number(document.getElementById('size').textContent.trim()) === 1, null, { timeout: 5000 });
    expect(await heap.getSize()).toBe(1);

    // Log should include 'Dequeued top:'
    let log2 = await heap.getLogText();
    expect(log).toMatch(/Dequeued top:/);

    // Now remove remaining and then call dequeue on empty to test edge-case
    await heap.dequeue();
    // Wait for empty
    await page.waitForFunction(() => document.getElementById('size').textContent.trim() === '0', null, { timeout: 5000 });

    // Dequeue on empty heap
    await heap.dequeue();
    // small wait for log update
    await page.waitForTimeout(100);
    log = await heap.getLogText();
    expect(log).toContain('Dequeue called on empty heap');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S3_Peeked: peek on non-empty and empty heap logs expected messages', async () => {
    // Ensure empty peek logs 'heap empty'
    // First ensure heap cleared
    await heap.clear();
    await page.waitForFunction(() => document.getElementById('size').textContent.trim() === '0', null, { timeout: 3000 });

    await heap.peek();
    let log3 = await heap.getLogText();
    expect(log).toContain('Peek: heap empty');

    // Enqueue an item and peek should show it
    await heap.enqueue('PeekMe', 42);
    await heap.peek();
    log = await heap.getLogText();
    expect(log).toMatch(/Peek: PeekMe \(prio 42\)/);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S4_PriorityChanged: change priority of existing and non-existing values; missing inputs produce alert', async () => {
    // Start from clean heap
    await heap.clear();

    // Insert two items
    await heap.enqueue('C1', 30);
    await heap.enqueue('C2', 20);

    // Change priority of C1 to 10 (makes it higher priority for min-heap)
    await heap.changePriorityOf('C1', 10);

    // Log should include changed priority message
    let log4 = await heap.getLogText();
    expect(log).toMatch(/Changed priority of "C1", new index \d+/);

    // Changing a non-existing value should log not found
    await heap.changePriorityOf('NO_SUCH', 5);
    log = await heap.getLogText();
    expect(log).toContain('Value "NO_SUCH" not found');

    // Now test missing inputs cause alert for changeBtn
    // Clear inputs and click changeBtn directly to provoke alert
    await heap.changeValue.fill('');
    await heap.changePriority.fill('');
    await heap.changeBtn.click();
    // dialog should have been captured and accepted
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toContain('Enter both value and new priority');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S5_ItemRemoved: remove existing item and attempt removing missing one (alerts/logs)', async () => {
    // Clear then insert items
    await heap.clear();
    await heap.enqueue('RemMe', 7);
    await heap.enqueue('Other', 15);

    // Remove 'RemMe'
    await heap.removeValue('RemMe');
    // Log should include Removed ...
    let log5 = await heap.getLogText();
    expect(log).toMatch(/Removed RemMe \(prio 7\)/);

    // Attempt removing a non-existent value should log not found
    await heap.removeValue('DoesNotExist');
    log = await heap.getLogText();
    expect(log).toContain('Value "DoesNotExist" not found');

    // Attempt removing with empty input should trigger alert
    await heap.changeValue.fill('');
    await heap.removeBtn.click();
    // dialog captured and accepted
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog1 = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toContain('Enter value to remove (first match)');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S7_RandomItemsInserted: Insert random 6 increases size by ~6 and logs insertions', async () => {
    // Clear first for predictable baseline
    await heap.clear();
    await page.waitForFunction(() => document.getElementById('size').textContent.trim() === '0', null, { timeout: 3000 });

    // Click random insert; wait until button re-enabled
    await heap.insertRandom6();

    // After insertion, size should be >=6
    const size = await heap.getSize();
    expect(size).toBeGreaterThanOrEqual(6);

    // Log should include several 'Inserted at index' entries
    const log6 = await heap.getLogText();
    expect(/Inserted at index/.test(log)).toBeTruthy();

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S6_HeapCleared: clear button empties heap and logs cleared message', async () => {
    // Ensure there are items
    await heap.enqueue('A', 1);
    await heap.enqueue('B', 2);
    await page.waitForFunction(() => Number(document.getElementById('size').textContent.trim()) >= 2, null, { timeout: 3000 });

    // Clear
    await heap.clear();
    await page.waitForFunction(() => document.getElementById('size').textContent.trim() === '0', null, { timeout: 3000 });

    // UI reflects empty state
    expect(await heap.getSize()).toBe(0);
    expect(await heap.getTopText()).toBe('—');

    const log7 = await heap.getLogText();
    expect(log).toContain('Cleared heap');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S8_HeapRebuilt: switching heap type rebuilds heap and logs rebuild messages', async () => {
    // Clear and insert several items with varying priorities
    await heap.clear();
    await heap.enqueue('X', 5);
    await heap.enqueue('Y', 20);
    await heap.enqueue('Z', 12);

    // Switch to max-heap
    await heap.switchHeapType('max');

    // The log should include Switching and a rebuild log (rebuild message includes uppercased type)
    const log8 = await heap.getLogText();
    expect(log).toMatch(/Switching to MAX/);
    // Rebuild logs "Heap rebuilt with MAX"
    expect(log).toMatch(/Heap rebuilt with MAX/);

    // After rebuild, top should correspond to max priority among inserted items (Y priority 20)
    const top1 = await heap.getTopText();
    expect(top).toContain('Y');
    expect(top).toContain('prio 20');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Console and runtime error observation: collect console/page errors across interactions', async () => {
    // This test drives multiple operations and then asserts no uncaught JS errors happened.
    // Drive a few operations that exercise many code paths.
    await heap.clear();
    await heap.enqueue('Z1', 3);
    await heap.enqueue('Z2', 1);
    await heap.enqueue('Z3', 9);
    await heap.peek();
    await heap.changePriorityOf('Z3', 0); // bubble up
    await heap.removeValue('Z2');
    await heap.insertRandom6();
    await heap.switchHeapType('min');
    await heap.clear();

    // Wait a moment for any asynchronous logs/errors to surface
    await page.waitForTimeout(300);

    // Assert no uncaught page errors (ReferenceError, TypeError, SyntaxError) occurred
    expect(pageErrors.length).toBe(0);

    // Assert no console 'error' type messages were emitted
    expect(consoleErrors.length).toBe(0);

    // Optionally assert that we observed the Ready message initially and other action logs
    const log9 = await heap.getLogText();
    expect(log).toContain('Ready — use the controls to interact with the priority queue.');
    expect(log).toMatch(/Inserted at index|Removed|Dequeued|Peek:|Cleared heap|Heap rebuilt/);
  });
});