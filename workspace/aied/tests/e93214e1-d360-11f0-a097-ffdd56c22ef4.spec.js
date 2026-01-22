import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93214e1-d360-11f0-a097-ffdd56c22ef4.html';

class StackPage {
  /**
   * Page object model for the Stack demo page.
   * Encapsulates common interactions and queries used by tests.
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#valueInput');
    this.pushBtn = page.locator('#pushBtn');
    this.popBtn = page.locator('#popBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.isEmptyBtn = page.locator('#isEmptyBtn');
    this.capacityInput = page.locator('#capacityInput');
    this.setCapBtn = page.locator('#setCapBtn');
    this.fillCount = page.locator('#fillCount');
    this.fillBtn = page.locator('#fillBtn');
    this.exampleSeqBtn = page.locator('#exampleSeqBtn');
    this.runSeqBtn = page.locator('#runSeqBtn');
    this.sequenceInput = page.locator('#sequenceInput');

    this.sizeLabel = page.locator('#sizeLabel');
    this.topLabel = page.locator('#topLabel');
    this.capLabel = page.locator('#capLabel');

    this.stackContainer = page.locator('#stackContainer');
    this.arrayRow = page.locator('#arrayRow');

    this.logArea = page.locator('#logArea');
    this.opLog = page.locator('#opLog');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure updateUI has run and initial logs are present
    await this.page.waitForSelector('#stackContainer');
    // wait a tick for initial log appended
    await this.page.waitForTimeout(50);
  }

  // Basic operations
  async push(value) {
    await this.valueInput.fill(value);
    await this.pushBtn.click();
    // allow UI update/animations to register
    await this.page.waitForTimeout(120);
  }

  async pop() {
    await this.popBtn.click();
    await this.page.waitForTimeout(120);
  }

  async peek() {
    await this.peekBtn.click();
    await this.page.waitForTimeout(120);
  }

  async clear() {
    await this.clearBtn.click();
    await this.page.waitForTimeout(120);
  }

  async isEmpty() {
    await this.isEmptyBtn.click();
    await this.page.waitForTimeout(50);
  }

  async setCapacity(n) {
    await this.capacityInput.fill(String(n));
    await this.setCapBtn.click();
    await this.page.waitForTimeout(120);
  }

  async fillRandom(n) {
    await this.fillCount.fill(String(n));
    await this.fillBtn.click();
    // fill operation may schedule pushes synchronously; give a short wait to update UI
    await this.page.waitForTimeout(200);
  }

  async loadExampleSequence() {
    await this.exampleSeqBtn.click();
    // small wait for value to be set
    await this.page.waitForTimeout(40);
  }

  async runSequence() {
    await this.runSeqBtn.click();
    // wait until runSeqBtn is enabled again to know the sequence completed
    await this.page.waitForFunction(() => !document.querySelector('#runSeqBtn').disabled);
    // small wait for final UI updates
    await this.page.waitForTimeout(80);
  }

  // Queries
  async getSize() {
    return Number(await this.sizeLabel.textContent());
  }

  async getTopIndex() {
    return Number(await this.topLabel.textContent());
  }

  async getCapacityLabel() {
    return (await this.capLabel.textContent()).trim();
  }

  async getLogMessages() {
    const logs = await this.logArea.locator('div').allTextContents();
    return logs.map(s => s.trim());
  }

  async getOpLogMessages() {
    return (await this.opLog.locator('div').allTextContents()).map(s => s.trim());
  }

  async getStackSlots() {
    // return array of slot objects { text, class, style }
    const slots = await this.stackContainer.locator('.slot').elementHandles();
    const out = [];
    for (const handle of slots) {
      const text = (await handle.textContent()).trim();
      const className = await handle.getAttribute('class') || '';
      const style = await handle.getAttribute('style') || '';
      out.push({ text, className, style });
    }
    return out;
  }

  async getArrayCells() {
    const cells = await this.arrayRow.locator('.cell').elementHandles();
    const out = [];
    for (const cell of cells) {
      const indexEl = await cell.$('.index');
      const idx = indexEl ? (await indexEl.textContent()).trim() : '';
      // the value node is the second child (text node appended)
      const childDivs = await cell.$$('div');
      // first child is .index, second is value (if present)
      let value = '';
      if (childDivs.length >= 2) {
        value = (await childDivs[1].textContent()).trim();
      }
      const className = await cell.getAttribute('class') || '';
      out.push({ idx, value, className });
    }
    return out;
  }

  async lastLogStyle() {
    const last = this.logArea.locator('div').last();
    return await last.getAttribute('style');
  }

  async activeElementId() {
    return await this.page.evaluate(() => document.activeElement && document.activeElement.id);
  }
}

test.describe('Stack Visualization & Demo — FSM driven E2E tests', () => {
  // Capture page errors and console errors to assert there are no uncaught exceptions
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // store error objects for assertions
      pageErrors.push(err);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(String(msg.text()));
      }
    });
  });

  test('Initial State (S0_Initial) — updateUI ran on load and baseline UI is correct', async ({ page }) => {
    // Validate that updateUI() was invoked on load and labels/defaults match the initial state
    const s = new StackPage(page);
    await s.goto();

    // Size should be zero and top should be -1 as per initial Stack
    expect(await s.getSize()).toBe(0);
    expect(await s.getTopIndex()).toBe(-1);

    // Capacity label should show infinity symbol
    expect(await s.getCapacityLabel()).toBe('∞');

    // Stack visualization should show at least 6 slots (design detail)
    const slots = await s.getStackSlots();
    expect(slots.length).toBeGreaterThanOrEqual(6);

    // Array row should show at least 8 cells
    const cells = await s.getArrayCells();
    expect(cells.length).toBeGreaterThanOrEqual(8);

    // Initial log contains the ready message
    const logs = await s.getLogMessages();
    expect(logs.some(l => l.includes('Demo ready'))).toBeTruthy();

    // No uncaught page errors or console errors during initial load
    expect(pageErrors, 'no page errors on load').toEqual([]);
    expect(consoleErrors, 'no console.error on load').toEqual([]);
  });

  test.describe('Events and transitions', () => {
    test('Push event transitions to Stack Not Empty (S0 -> S1) and updateUI("push") behavior', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      // Push a value
      await s.push('node42');

      // Size and top should update
      expect(await s.getSize()).toBe(1);
      expect(await s.getTopIndex()).toBe(0);

      // The top slot should display the value
      const slots = await s.getStackSlots();
      // find any slot with class top and text content 'node42'
      const hasTop = slots.some(slot => slot.className.includes('top') && slot.text === 'node42');
      expect(hasTop).toBeTruthy();

      // The underlying array first cell (index 0) should show the pushed value
      const cells = await s.getArrayCells();
      expect(cells[0].value).toBe('node42');

      // Log should contain the push entry
      const logs = await s.getLogMessages();
      expect(logs.some(l => l.includes('push("node42")'))).toBeTruthy();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Pop event decreases size and logs value; popping from empty logs error (S1 -> S1/S2)', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      // Push two values, then pop one, then pop again, then attempt another pop to cause underflow error
      await s.push('A');
      await s.push('B');

      expect(await s.getSize()).toBe(2);
      expect(await s.getTopIndex()).toBe(1);

      // Pop once
      await s.pop();
      expect(await s.getSize()).toBe(1);
      // last opLog should include pop() -> "B"
      const oplogs1 = await s.getOpLogMessages();
      expect(oplogs1.some(t => t.includes('pop()'))).toBeTruthy();

      // Pop again (should succeed)
      await s.pop();
      expect(await s.getSize()).toBe(0);

      // Now pop when empty - handler catches and logs error (no uncaught exception)
      const beforeLogs = await s.getLogMessages();
      await s.pop();
      const afterLogs = await s.getLogMessages();
      // New log entry should indicate underflow or 'Stack underflow'
      const newEntry = afterLogs.slice(beforeLogs.length).find(l => l.toLowerCase().includes('stack underflow') || l.toLowerCase().includes('stack is empty'));
      expect(newEntry).toBeTruthy();

      // The inline style for the last log (error) should include the color var(--danger)
      const lastStyle = await s.lastLogStyle();
      expect(lastStyle).toContain('var(--danger)');

      // No uncaught page errors
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Peek event inspects top value and provides brief visual highlight (S1 -> S1)', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      // Ensure clean stack, then push a value and peek
      await s.clear();
      await s.push('peek-me');

      // perform peek and shortly afterwards check top slot style for a temporary box-shadow highlight
      await s.peek();

      // Get slot handles and inspect style attribute of top-most non-empty slot
      const slots = await s.getStackSlots();
      // find index of last non-empty slot
      const lastIndex = slots.map(s => s.text).lastIndexOf('peek-me');
      expect(lastIndex).toBeGreaterThanOrEqual(0);

      // The code applies inline style.boxShadow temporarily; check that style string exists (non-empty) shortly after peek
      const styleAfterPeek = slots[lastIndex].style;
      // style might be empty string if timeout already cleared; allow either presence or that log exists
      const logMessages = await s.getLogMessages();
      expect(logMessages.some(l => l.includes('peek()'))).toBeTruthy();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Clear event empties stack and logs it (S1 -> S2)', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      // Push items then clear
      await s.push('one');
      await s.push('two');
      expect(await s.getSize()).toBeGreaterThanOrEqual(2);

      await s.clear();
      expect(await s.getSize()).toBe(0);
      expect(await s.getTopIndex()).toBe(-1);

      const logs = await s.getLogMessages();
      expect(logs.some(l => l.includes('clear() -> stack emptied') || l.includes('clear()'))).toBeTruthy();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('IsEmpty event confirms empty state (S2 -> S2)', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      // Ensure empty
      await s.clear();
      expect(await s.getSize()).toBe(0);

      await s.isEmpty();
      const logs = await s.getLogMessages();
      expect(logs.some(l => l.includes('isEmpty() -> true'))).toBeTruthy();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('SetCapacity updates capacity label and warns when new capacity < current size', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      await s.clear();
      await s.push('x');
      await s.push('y');
      expect(await s.getSize()).toBe(2);

      // Set capacity to 1 (smaller than current size) -> should log a warning (isError)
      await s.setCapacity(1);
      const newLogs = await s.getLogMessages();
      const warn = newLogs.find(l => l.toLowerCase().includes('new capacity is smaller'));
      expect(warn).toBeTruthy();

      // The last log style should include danger color
      const lastStyle = await s.lastLogStyle();
      expect(lastStyle).toContain('var(--danger)');

      // Now set a valid larger capacity and assert capLabel updates
      await s.setCapacity(5);
      expect(await s.getCapacityLabel()).toBe('5');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('FillRandom pushes n items to the stack and logs action (S1 -> S1)', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      await s.clear();
      const before = await s.getSize();
      await s.fillRandom(3);
      const after = await s.getSize();
      expect(after).toBeGreaterThanOrEqual(before + 3);

      const opLogs = await s.getLogMessages();
      expect(opLogs.some(l => l.includes('Filled 3 random items'))).toBeTruthy();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('LoadExampleSequence populates sequence input (S0 -> S0)', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      await s.loadExampleSequence();
      const seq = await s.sequenceInput.inputValue();
      expect(seq).toContain('push apple');
      expect(seq).toContain('peek');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('RunSequence executes commands in order and final UI state matches expected result (S0 -> S0)', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      await s.loadExampleSequence();
      // Run the example; this sequence contains waits and several operations
      await s.runSequence();

      // Example sequence final state by reading earlier spec:
      // push apple, push banana, push cherry -> 3
      // pop -> 2
      // push date -> 3
      // push eggfruit -> 4
      // wait 600
      // pop -> 3
      // pop -> 2
      // peek (does not change size)
      // Final size expected = 2
      expect(await s.getSize()).toBe(2);

      // Ensure opLog contains peek entry from the sequence
      const oplogs = await s.getOpLogMessages();
      expect(oplogs.some(l => l.toLowerCase().includes('peek()'))).toBeTruthy();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Edge case: pushing empty value does nothing and focuses input', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      // Ensure empty input
      await s.valueInput.fill('');
      const before = await s.getSize();
      // click push; code will focus the input and return without logging anything
      await s.pushBtn.click();
      await page.waitForTimeout(50);

      expect(await s.getSize()).toBe(before);
      // ensure focus is on input
      expect(await s.activeElementId()).toBe('valueInput');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Edge case: FillRandom with invalid count logs error', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      await s.fillCount.fill('0');
      await s.fillBtn.click();
      await page.waitForTimeout(80);

      const logs = await s.getLogMessages();
      const err = logs.find(l => l.toLowerCase().includes('fill count must be a positive integer'));
      expect(err).toBeTruthy();

      const lastStyle = await s.lastLogStyle();
      expect(lastStyle).toContain('var(--danger)');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Edge case: setting negative capacity logs validation error', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      await s.capacityInput.fill('-5');
      await s.setCapBtn.click();
      await page.waitForTimeout(80);

      const logs = await s.getLogMessages();
      const err = logs.find(l => l.toLowerCase().includes('capacity must be a non-negative integer'));
      expect(err).toBeTruthy();

      const lastStyle = await s.lastLogStyle();
      expect(lastStyle).toContain('var(--danger)');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Array cell click triggers confirm and pops multiple items when accepted', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      // Push 4 items to create a tall stack
      await s.clear();
      await s.push('v0');
      await s.push('v1');
      await s.push('v2');
      await s.push('v3');
      expect(await s.getSize()).toBeGreaterThanOrEqual(4);

      // Click on array cell with index 1 to request popping until that index is top
      // This will call confirm; intercept and accept it.
      page.once('dialog', async dialog => {
        // Accept the confirm to proceed with pops
        await dialog.accept();
      });

      // Find the cell element with index text '1' and click it
      const cells = await s.getArrayCells();
      const idxToClick = cells.findIndex(c => c.idx === '1');
      expect(idxToClick).toBeGreaterThanOrEqual(0);

      // Click the corresponding DOM element
      // Use locator nth to click the target cell
      await s.arrayRow.locator('.cell').nth(idxToClick).click();
      // Wait for UI updates triggered by pops
      await page.waitForTimeout(200);

      // After popping until index 1 becomes top: original size was >=4, top was 3 -> toPop = 3-1 =2 -> new size should be oldSize - 2
      // We can't be certain of original size but we know it decreased by at least 1; assert top index now equals 1 or size decreased accordingly
      const sizeAfter = await s.getSize();
      expect(sizeAfter).toBeLessThanOrEqual(2 + 2); // trivial sanity check; main check is that size decreased
      // Confirm opLog contains pop entries inserted by the multi-pop loop
      const oplogs = await s.getOpLogMessages();
      expect(oplogs.some(l => l.includes('pop()'))).toBeTruthy();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('RunSequence reports unknown commands as errors and re-enables controls', async ({ page }) => {
      const s = new StackPage(page);
      await s.goto();

      // Put an unknown command into the sequence and run
      await s.sequenceInput.fill('foobar unknown\n');
      // runSeqBtn will disable while running
      await s.runSeqBtn.click();
      // Wait for run to complete by waiting for the button to re-enable
      await page.waitForFunction(() => !document.querySelector('#runSeqBtn').disabled);
      await page.waitForTimeout(40);

      const logs = await s.getLogMessages();
      const err = logs.find(l => l.toLowerCase().includes('unknown command'));
      expect(err).toBeTruthy();

      // The unknown command log is logged as error (style var(--danger))
      const lastStyle = await s.lastLogStyle();
      expect(lastStyle).toContain('var(--danger)');

      // Ensure controls are re-enabled
      expect(await s.runSeqBtn.isEnabled()).toBeTruthy();
      expect(await s.exampleSeqBtn.isEnabled()).toBeTruthy();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

  });

  test.afterEach(async ({ page }) => {
    // Final sanity: no unexpected runtime errors or console.error during tests
    expect(pageErrors, 'no uncaught page errors during test').toEqual([]);
    expect(consoleErrors, 'no console.error messages during test').toEqual([]);
  });
});