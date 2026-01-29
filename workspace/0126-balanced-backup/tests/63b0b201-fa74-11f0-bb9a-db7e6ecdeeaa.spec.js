import { test, expect } from '@playwright/test';

const BASE_URL =
  'http://127.0.0.1:5500/workspace/0126-balanced/html/63b0b201-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object encapsulating interactions and queries for the heap page
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.insertBtn = page.locator('#insertBtn');
    this.extractBtn = page.locator('#extractBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.svg = page.locator('#heapSVG');
    this.log = page.locator('#log');
    this.circle = page.locator('#heapSVG circle');
    this.textNodes = page.locator('#heapSVG text');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  // Insert a numeric value using the input field and Insert button
  async insertValue(val) {
    await this.input.fill(String(val));
    await this.insertBtn.click();
  }

  // Simulate Enter key on the input to trigger insertion
  async insertValueByEnter(val) {
    await this.input.fill(String(val));
    await this.input.press('Enter');
  }

  async extractMax() {
    await this.extractBtn.click();
  }

  async clearHeap() {
    await this.clearBtn.click();
  }

  // Returns number of circles (nodes) in the SVG
  async nodeCount() {
    return await this.circle.count();
  }

  // Returns number of text elements in the SVG
  async textCount() {
    return await this.textNodes.count();
  }

  // Returns the text content of the n-th text element (0-based)
  async nodeTextAt(index) {
    return await this.textNodes.nth(index).textContent();
  }

  // Get the visible log lines as an array of strings
  async getLogLines() {
    return await this.page.evaluate(() => {
      const logEl = document.getElementById('log');
      return Array.from(logEl.children).map(c => c.textContent || '');
    });
  }

  // Get raw innerHTML of log (useful if testing tags appear; in this app log uses textContent intentionally)
  async getLogInnerHTML() {
    return await this.page.locator('#log').innerHTML();
  }

  // Returns whether SVG has any child nodes
  async svgHasChildren() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('heapSVG');
      return svg && svg.children && svg.children.length > 0;
    });
  }
}

test.describe('Max Heap Visualization - FSM states and transitions', () => {
  // Capture console and page errors and dialogs for assertions
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    // Auto accept any dialogs but capture the message
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });
  });

  test.afterEach(async () => {
    // After each test ensure no unexpected console/page errors were emitted
    // This asserts the runtime didn't produce uncaught exceptions; if there are known errors,
    // tests would need to assert for them explicitly instead.
    expect(consoleErrors, 'Expected no console.error messages').toHaveLength(0);
    expect(pageErrors, 'Expected no page errors (uncaught exceptions)').toHaveLength(0);
  });

  test('S0_Idle - initial render shows demo heap and log entry', async ({ page }) => {
    // Validate the Idle state: initial demo heap constructed and rendered
    const heap = new HeapPage(page);
    await heap.goto();

    // Wait for the initial log entry to appear
    await expect(page.locator('#log')).toBeVisible();

    const logs = await heap.getLogLines();
    // The initial demo uses log('Initial heap built with values: ' + demoValues.join(', '))
    expect(
      logs.some(l => l.includes('Initial heap built with values: 40, 30, 20, 15, 10, 12, 18')),
    ).toBeTruthy();

    // There should be 7 initial nodes (the demo values length)
    const circleCount = await heap.nodeCount();
    const textCount = await heap.textCount();
    expect(circleCount).toBe(7);
    expect(textCount).toBe(7);

    // Spot check the root value is the maximum of demo values (40)
    const rootText = await heap.nodeTextAt(0);
    expect(rootText?.trim()).toBe('40');
  });

  test('S0_Idle -> S1_HeapUpdated via Insert button (insert 50)', async ({ page }) => {
    // Test inserting via the Insert button transitions heap to updated state:
    // - log contains "Inserted <strong>50</strong> into the heap."
    // - SVG has one more node
    // - root becomes 50 (max heap)
    const heap = new HeapPage(page);
    await heap.goto();

    const beforeCount = await heap.nodeCount();

    await heap.insertValue(50);

    // Validate log contains insertion message (textContent contains literal <strong> tags)
    const logs = await heap.getLogLines();
    expect(logs.some(l => l.includes('Inserted <strong>50</strong> into the heap.'))).toBeTruthy();

    // Node count increased by 1
    const afterCount = await heap.nodeCount();
    expect(afterCount).toBe(beforeCount + 1);

    // Root should be the newly inserted max value 50
    const rootText = await heap.nodeTextAt(0);
    expect(rootText?.trim()).toBe('50');
  });

  test('S1_HeapUpdated -> S1_HeapUpdated via InputEnter (press Enter to insert 35)', async ({
    page,
  }) => {
    // Test that pressing Enter on the input triggers the same insert flow
    const heap = new HeapPage(page);
    await heap.goto();

    const beforeCount = await heap.nodeCount();

    await heap.insertValueByEnter(35);

    const logs = await heap.getLogLines();
    expect(logs.some(l => l.includes('Inserted <strong>35</strong> into the heap.'))).toBeTruthy();

    const afterCount = await heap.nodeCount();
    expect(afterCount).toBe(beforeCount + 1);

    // Ensure one of the nodes contains 35 (it might not be root depending on heap order)
    const texts = await Promise.all(
      Array.from({ length: await heap.textCount() }, (_, i) => heap.nodeTextAt(i)),
    );
    expect(texts.some(t => t && t.trim() === '35')).toBeTruthy();
  });

  test('S1_HeapUpdated -> S1_HeapUpdated via ExtractMax (extract inserted max)', async ({
    page,
  }) => {
    // Insert a known max (50), then extract and verify:
    // - log includes "Extracted max <strong>50</strong> from the heap."
    // - node count decreases by 1
    // - root value becomes next max (40 from initial demo)
    const heap = new HeapPage(page);
    await heap.goto();

    // Start by inserting 50 so we know what max will be
    await heap.insertValue(50);
    const countAfterInsert = await heap.nodeCount();

    await heap.extractMax();

    const logs = await heap.getLogLines();
    expect(logs.some(l => l.includes('Extracted max <strong>50</strong> from the heap.'))).toBeTruthy();

    const countAfterExtract = await heap.nodeCount();
    expect(countAfterExtract).toBe(countAfterInsert - 1);

    // After extracting 50, the root should be the next largest from the demo (40)
    const rootText = await heap.nodeTextAt(0);
    expect(rootText?.trim()).toBe('40');
  });

  test('S1_HeapUpdated -> S2_HeapCleared via Clear button (clear heap)', async ({ page }) => {
    // Validate clear behavior:
    // - SVG is cleared (no children)
    // - Log is cleared and only contains "Heap cleared."
    const heap = new HeapPage(page);
    await heap.goto();

    // Ensure there are nodes to be cleared
    const countBefore = await heap.nodeCount();
    expect(countBefore).toBeGreaterThan(0);

    await heap.clearHeap();

    // The app clears log and svg then logs 'Heap cleared.' so there should be exactly one log entry
    const logs = await heap.getLogLines();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    // Last log line should be 'Heap cleared.' (exact textContent)
    const last = logs[logs.length - 1];
    expect(last && last.trim()).toBe('Heap cleared.');

    // SVG should have no children
    const hasChildren = await heap.svgHasChildren();
    expect(hasChildren).toBe(false);

    // Also ensure node counts are zero
    expect(await heap.nodeCount()).toBe(0);
    expect(await heap.textCount()).toBe(0);
  });

  test('Edge case: Insert invalid input shows alert and does not change heap', async ({ page }) => {
    // Validate behavior when invalid input is provided:
    // - An alert is shown with correct message
    // - No insertion occurs (node count unchanged)
    const heap = new HeapPage(page);
    await heap.goto();

    const beforeCount = await heap.nodeCount();

    // Ensure input empty
    await page.locator('#inputValue').fill('');
    // Trigger insert with empty input
    await page.locator('#insertBtn').click();

    // The dialog listener in beforeEach will accept and record messages
    // Wait briefly for dialog to be handled and potential effects to settle
    await page.waitForTimeout(100);

    // We expect an alert about invalid number
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1]).toBe('Please enter a valid number.');

    // Node count should remain unchanged
    const afterCount = await heap.nodeCount();
    expect(afterCount).toBe(beforeCount);
  });

  test('Edge case: Extract from empty heap shows alert and does nothing', async ({ page }) => {
    // Clear heap first, then attempt to extract to trigger the "Heap is empty" alert
    const heap = new HeapPage(page);
    await heap.goto();

    await heap.clearHeap();

    // Clear any recorded dialogs from previous operations
    dialogs = [];

    // Try to extract from the now-empty heap
    await heap.extractMax();

    // Wait to ensure dialog was handled
    await page.waitForTimeout(100);

    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1]).toBe('Heap is empty. Nothing to extract.');

    // Ensure still empty
    expect(await heap.nodeCount()).toBe(0);
  });
});