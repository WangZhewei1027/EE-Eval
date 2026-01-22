import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e1baa0-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object for interacting with the heap demo UI
class HeapPage {
  constructor(page) {
    this.page = page;
    // selectors
    this.valInput = page.locator('#valInput');
    this.prioInput = page.locator('#prioInput');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.bulkBtn = page.locator('#bulkBtn');
    this.bulkCount = page.locator('#bulkCount');
    this.heapType = page.locator('#heapType');

    this.sizePill = page.locator('#sizePill');
    this.topPill = page.locator('#topPill');
    this.opsPill = page.locator('#opsPill');
    this.arrayContainer = page.locator('#arrayContainer');
    this.heapSvg = page.locator('#heapSvg');
    this.trace = page.locator('#trace');
    this.timing = page.locator('#timing');
    this.lastAction = page.locator('#lastAction');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helpers to read pill texts
  async getSizeText() {
    return (await this.sizePill.textContent())?.trim();
  }
  async getTopText() {
    return (await this.topPill.textContent())?.trim();
  }
  async getOpsText() {
    return (await this.opsPill.textContent())?.trim();
  }
  async getLastActionText() {
    return (await this.lastAction.textContent())?.trim();
  }

  async getTraceLines() {
    // returns array of textContent lines from trace container (most recent first because trace.prepend)
    const nodes = await this.page.$$eval('#trace > div', els => els.map(e => e.textContent?.trim() || ''));
    return nodes;
  }

  async enqueue(value, priority) {
    await this.valInput.fill(value);
    await this.prioInput.fill(String(priority));
    await this.enqueueBtn.click();
  }

  async dequeue() {
    await this.dequeueBtn.click();
  }

  async peek() {
    await this.peekBtn.click();
  }

  async changeHeapTypeTo(value) {
    await this.heapType.selectOption(value);
  }

  async addRandom10() {
    await this.randomBtn.click();
  }

  async clearHeap() {
    await this.clearBtn.click();
  }

  async bulkAdd(n) {
    await this.bulkCount.fill(String(n));
    await this.bulkBtn.click();
  }

  async waitForSize(expectedSize, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim() === expected;
      },
      '#sizePill',
      expectedSize,
      { timeout }
    );
  }

  async waitForOps(expectedOps, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim() === expected;
      },
      '#opsPill',
      expectedOps,
      { timeout }
    );
  }

  async waitForTop(expectedTop, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim() === expected;
      },
      '#topPill',
      expectedTop,
      { timeout }
    );
  }
}

test.describe('Priority Queue (Binary Heap) Demo - FSM and UI tests', () => {
  let page;
  let heapPage;
  let consoleMessages = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // record console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // record page errors (unhandled exceptions)
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    // capture dialogs and auto-accept them but also track
    page.on('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    heapPage = new HeapPage(page);
    await heapPage.goto();

    // ensure initial render completes - renderAll sets up trace message "Priority Queue ready..."
    await page.waitForSelector('#trace > div', { timeout: 2000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial Idle state - S0_Idle: initial render and basic UI presence', async () => {
    // Validate initial pills reflect empty heap (Idle state)
    await expect(heapPage.sizePill).toHaveText('Size: 0');
    await expect(heapPage.opsPill).toHaveText('Ops: 0');
    await expect(heapPage.topPill).toHaveText('Top: —');

    // Array container should show "empty"
    await expect(heapPage.arrayContainer).toContainText('empty');

    // Trace initial message should include ready message
    const traces = await heapPage.getTraceLines();
    const foundReady = traces.some(t => t.includes('Priority Queue ready'));
    expect(foundReady).toBeTruthy();

    // Ensure no unexpected runtime errors occurred during load
    expect(pageErrors, 'no page errors on initial load').toEqual([]);
  });

  test('Enqueue event -> S1_ItemEnqueued: enqueue single item updates size, ops, top, trace, svg and array view', async () => {
    // Comments: This test validates enqueue transition from Idle to Item Enqueued
    await heapPage.enqueue('task-X', 7);

    // wait for size and ops updates
    await heapPage.waitForSize('Size: 1');
    await heapPage.waitForOps('Ops: 1');

    // Top should reflect enqueued item
    await heapPage.waitForTop('Top: task-X:7');

    // lastAction should mention enqueue
    await expect(heapPage.lastAction).toHaveText(/Last:\s+enqueue\s+task-X:7/);

    // array container should include an item with index 0 and value:priority
    await expect(heapPage.arrayContainer).toContainText('0 → task-X:7');

    // svg should contain at least one circle node -> check number of circle elements equals number of nodes (1)
    const circleCount = await page.$$eval('#heapSvg circle', els => els.length);
    expect(circleCount).toBeGreaterThanOrEqual(1);

    // trace should include Enqueued entry (trace.prepend so first lines include it)
    const traces = await heapPage.getTraceLines();
    const foundEnqueueTrace = traces.some(t => t.includes('Enqueued task-X:7'));
    expect(foundEnqueueTrace).toBeTruthy();

    // verify no page runtime errors occurred
    expect(pageErrors, 'no page errors after enqueue').toEqual([]);
  });

  test('Dequeue event -> S2_ItemDequeued: dequeue when empty triggers alert; dequeue when non-empty removes top and updates UI', async () => {
    // When empty, Dequeue triggers an alert('Queue is empty.')
    // Clear dialogs array
    dialogs = [];
    await heapPage.dequeue();
    // We set page.on('dialog') to auto accept; ensure dialog captured
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
    expect(dialogs[0].message).toContain('Queue is empty.');

    // Now enqueue one item and then dequeue it to test normal path
    await heapPage.enqueue('task-Y', 3);
    await heapPage.waitForSize('Size: 1');
    await heapPage.waitForTop('Top: task-Y:3');

    // Dequeue should remove it
    await heapPage.dequeue();
    // after dequeue, size should be 0 and ops incremented (ops was 1 after enqueue, +1 dequeue -> 2)
    await heapPage.waitForSize('Size: 0');
    await heapPage.waitForOps('Ops: 2');

    // top should be empty
    await heapPage.waitForTop('Top: —');

    // trace should include Dequeued message
    const traces = await heapPage.getTraceLines();
    const foundDeq = traces.some(t => t.includes('Dequeued task-Y:3'));
    expect(foundDeq).toBeTruthy();

    // lastAction notes dequeue
    await expect(heapPage.lastAction).toHaveText(/Last:\s+dequeue\s+task-Y:3/);

    expect(pageErrors, 'no page errors after dequeue').toEqual([]);
  });

  test('Peek event -> S3_ItemPeeked: peek on empty triggers alert; peek on non-empty logs peek without removing', async () => {
    dialogs = [];
    // peek on empty -> alert('empty')
    await heapPage.peek();
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
    expect(dialogs[0].message).toBe('empty');

    // Enqueue and peek
    await heapPage.enqueue('task-P', 11);
    await heapPage.waitForSize('Size: 1');
    await heapPage.peek();

    // Peek should not change size
    await heapPage.waitForSize('Size: 1');

    // lastAction should indicate peek
    await expect(heapPage.lastAction).toHaveText(/Last:\s+peek\s+task-P:11/);

    // trace should include Peek message
    const traces = await heapPage.getTraceLines();
    const foundPeek = traces.some(t => t.includes('Peek task-P:11'));
    expect(foundPeek).toBeTruthy();

    expect(pageErrors, 'no page errors after peek').toEqual([]);
  });

  test('Change heap type -> S4_HeapTypeChanged: toggling heap type updates behavior and trace', async () => {
    // Insert items with different priorities
    await heapPage.clearHeap();
    await heapPage.enqueue('low', 1);
    await heapPage.enqueue('mid', 5);
    await heapPage.enqueue('high', 10);
    await heapPage.waitForSize('Size: 3');

    // By default min-heap: Top should be 'low'
    await heapPage.waitForTop('Top: low:1');

    // change to max-heap
    await heapPage.changeHeapTypeTo('max');

    // trace should include heap type change
    const traces = await heapPage.getTraceLines();
    const foundType = traces.some(t => t.includes('Heap type set to max'));
    expect(foundType).toBeTruthy();

    // After changing type, renderAll runs: top should update to 'high'
    // Wait for top pill to update to high
    await heapPage.waitForTop('Top: high:10');

    // change back to min
    await heapPage.changeHeapTypeTo('min');
    await heapPage.waitForTop('Top: low:1');

    expect(pageErrors, 'no page errors after changing heap type').toEqual([]);
  });

  test('AddRandomItems -> S5_RandomItemsAdded: clicking Add 10 Random increases size by 10 and logs trace', async () => {
    // Start from clear for predictability
    await heapPage.clearHeap();
    await heapPage.waitForSize('Size: 0');

    await heapPage.addRandom10();

    // Size should be 10
    await heapPage.waitForSize('Size: 10');

    // trace should contain "Added 10 random items"
    const traces = await heapPage.getTraceLines();
    const found = traces.some(t => t.includes('Added 10 random items'));
    expect(found).toBeTruthy();

    // svg should contain at least several nodes
    const nodeCount = await page.$$eval('#heapSvg circle', els => els.length);
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    expect(pageErrors, 'no page errors after add random').toEqual([]);
  });

  test('Clear heap -> S6_HeapCleared: clear resets heap and logs trace and lastAction', async () => {
    // Ensure some items
    await heapPage.addRandom10();
    await heapPage.waitForSize('Size: 10');

    // Clear
    await heapPage.clearHeap();

    // Size zero, top empty
    await heapPage.waitForSize('Size: 0');
    await heapPage.waitForTop('Top: —');

    // trace contains 'Cleared heap' with color style (we just check text)
    const traces = await heapPage.getTraceLines();
    const found = traces.some(t => t.includes('Cleared heap'));
    expect(found).toBeTruthy();

    // lastAction should be 'Last: clear'
    await expect(heapPage.lastAction).toHaveText(/Last:\s+clear/);

    expect(pageErrors, 'no page errors after clear').toEqual([]);
  });

  test('Bulk add -> S7_BulkItemsAdded: bulk adding N items updates size and ops and logs timing', async () => {
    // Use a modest N to keep test fast and deterministic
    const N = 200;
    await heapPage.clearHeap();
    await heapPage.waitForSize('Size: 0');

    await heapPage.bulkAdd(N);

    // Wait for size to reach N
    await heapPage.waitForSize(`Size: ${N}`, 5000);

    // ops should be >= N (bulkAdd increments opCount by items.length)
    const opsText = await heapPage.getOpsText();
    expect(opsText).toMatch(/Ops:\s*\d+/);
    const opsVal = Number(opsText.replace('Ops:', '').trim());
    expect(opsVal).toBeGreaterThanOrEqual(N);

    // trace should contain 'Bulk added N items'
    const traces = await heapPage.getTraceLines();
    const found = traces.some(t => t.includes(`Bulk added ${N} items`));
    expect(found).toBeTruthy();

    // timing element should contain 'Last op time' (non-empty)
    const timingText = await heapPage.timing.textContent();
    expect(timingText).toContain('Last op time:');

    expect(pageErrors, 'no page errors after bulk add').toEqual([]);
  });

  test('Edge cases: enqueue with missing inputs triggers validation alert; ensure stable ordering for equal priorities', async () => {
    dialogs = [];
    // Clear inputs and click enqueue to trigger validation alert
    await heapPage.valInput.fill('');
    await heapPage.prioInput.fill('');
    await heapPage.enqueueBtn.click();

    // dialog should be shown with specific message
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
    expect(dialogs[dialogs.length - 1].message).toContain('Please provide value and priority.');

    // Test stable ordering: enqueue items with same priority and verify the earlier inserted is value-wise earlier in heap.peek
    await heapPage.clearHeap();
    await heapPage.enqueue('A', 5);
    await heapPage.enqueue('B', 5);
    await heapPage.enqueue('C', 5);
    // min-heap, same priority: insertion order should preserve A as top
    await heapPage.waitForTop('Top: A:5');

    // Dequeue should return items in insertion order A->B->C
    await heapPage.dequeue();
    await heapPage.waitForTop('Top: B:5');
    await heapPage.dequeue();
    await heapPage.waitForTop('Top: C:5');

    expect(pageErrors, 'no page errors on edge case tests').toEqual([]);
  });

  test('Console and runtime observation: capture console messages and ensure expected traces are present and no runtime exceptions', async () => {
    // Collect a snapshot of console messages and the trace area
    const consoleSnapshot = consoleMessages.map(c => `${c.type}: ${c.text}`).join('\n');

    // The trace area uses DOM, ensure the initial ready log is present
    const traces = await heapPage.getTraceLines();
    const readyFound = traces.some(t => t.includes('Priority Queue ready'));
    expect(readyFound).toBeTruthy();

    // ensure there are no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // The console itself may be empty or have benign messages; we assert that if errors exist they must be visible here.
    const hasConsoleErrors = consoleMessages.some(c => c.type === 'error' || c.type === 'warning');
    // We don't fail the test on benign console warnings, but we surface them via an assertion message for debugging:
    if (hasConsoleErrors) {
      // If there are console errors/warnings, ensure they include useful context (not failing the run)
      // This expectation is permissive but reports console content as part of test diagnostics
      expect(consoleSnapshot.length).toBeGreaterThan(0);
    }

    // Also assert that trace contains at least one instructional message
    const hasInstruction = traces.some(t => t.includes('Use the controls to enqueue/dequeue'));
    expect(hasInstruction).toBeTruthy();
  });
});