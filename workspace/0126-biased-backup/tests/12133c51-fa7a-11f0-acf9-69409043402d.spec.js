import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/12133c51-fa7a-11f0-acf9-69409043402d.html';

// Page object for interacting with the Heap app
class HeapPage {
  constructor(page) {
    this.page = page;
    // selectors
    this.inputValues = page.locator('#inputValues');
    this.btnBuild = page.locator('#btnBuild');
    this.insertValue = page.locator('#insertValue');
    this.btnInsert = page.locator('#btnInsert');
    this.btnExtractMin = page.locator('#btnExtractMin');
    this.extractedMinDisplay = page.locator('#extractedMinDisplay');
    this.btnPeekMin = page.locator('#btnPeekMin');
    this.peekMinDisplay = page.locator('#peekMinDisplay');
    this.btnClearHeap = page.locator('#btnClearHeap');
    this.bulkCount = page.locator('#bulkCount');
    this.btnBulkRandomInsert = page.locator('#btnBulkRandomInsert');
    this.btnSerialize = page.locator('#btnSerialize');
    this.btnDeserialize = page.locator('#btnDeserialize');
    this.heapSerialization = page.locator('#heapSerialization');
    this.stepIndex = page.locator('#stepIndex');
    this.btnStepDownHeapify = page.locator('#btnStepDownHeapify');
    this.btnStepUpHeapify = page.locator('#btnStepUpHeapify');
    this.btnResetStep = page.locator('#btnResetStep');
    this.heapDisplay = page.locator('#heapDisplay');
    this.stepHeapDisplay = page.locator('#stepHeapDisplay');
  }

  async goto() {
    await this.page.goto(BASE);
  }

  // Build heap from a comma/space separated string
  async buildFromString(str) {
    await this.inputValues.fill(str);
    await this.btnBuild.click();
  }

  // Insert single integer
  async insertValueNum(n) {
    await this.insertValue.fill(String(n));
    await this.btnInsert.click();
  }

  // Extract min
  async extractMin() {
    await this.btnExtractMin.click();
  }

  // Peek min
  async peekMin() {
    await this.btnPeekMin.click();
  }

  // Clear heap
  async clearHeap() {
    await this.btnClearHeap.click();
  }

  // Bulk insert count
  async bulkInsertCount(count) {
    await this.bulkCount.fill(String(count));
    await this.btnBulkRandomInsert.click();
  }

  // Serialize
  async serialize() {
    await this.btnSerialize.click();
    return (await this.heapSerialization.inputValue());
  }

  // Deserialize given JSON string
  async deserialize(text) {
    await this.heapSerialization.fill(text);
    await this.btnDeserialize.click();
  }

  // Step-by-step actions
  async setStepIndex(i) {
    await this.stepIndex.fill(String(i));
  }

  async stepDown() {
    await this.btnStepDownHeapify.click();
  }

  async stepUp() {
    await this.btnStepUpHeapify.click();
  }

  async resetStep() {
    await this.btnResetStep.click();
  }

  async getHeapDisplayText() {
    return (await this.heapDisplay.textContent()) || '';
  }

  async getStepHeapDisplayText() {
    return (await this.stepHeapDisplay.textContent()) || '';
  }

  async getExtractedMinText() {
    return (await this.extractedMinDisplay.textContent()) || '';
  }

  async getPeekMinText() {
    return (await this.peekMinDisplay.textContent()) || '';
  }
}

test.describe('Interactive Min Heap Explorer - FSM and UI tests', () => {
  // Collect console.error messages and page errors
  let consoleErrors = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture JS alert/confirm/prompt dialogs
    page.on('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // automatically accept alerts so test can continue
      await dialog.accept();
    });

    // Navigate to the app
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test ensure there were no unexpected runtime errors
    // The implementation may show alert dialogs in expected error scenarios;
    // we assert the test's expected dialogs explicitly within each test.
    expect(pageErrors.length).toBe(0);
    // No console.error messages should be emitted in normal operation
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Build / Display / Reset behaviors (S0 -> S1 and resets)', () => {
    test('Build Heap from valid array displays level-order heap and initializes step visualizer', async ({ page }) => {
      const heap = new HeapPage(page);

      // Build from a known array; the min element should be Level 0
      await heap.buildFromString('5, 3, 8, 1, 2');

      const heapText = await heap.getHeapDisplayText();
      // The heap display should not be empty and should contain Level lines
      expect(heapText).toContain('Level 0:');
      // The root must be the minimum element of the input (1)
      expect(heapText).toContain('Level 0: 1');

      // Step visualizer was reset by resetAll(); it should show same root
      const stepText = await heap.getStepHeapDisplayText();
      expect(stepText).toContain('Level 0: 1');

      // No unexpected dialogs should have appeared
      expect(dialogs.length).toBe(0);
    });

    test('Build with invalid input triggers alert and does not modify heap', async ({ page }) => {
      const heap = new HeapPage(page);

      // Start empty: heap display should indicate empty heap
      const before = await heap.getHeapDisplayText();
      expect(before).toBe('(empty heap)');

      // Build with invalid array -> triggers alert (captured), and heap stays empty
      await heap.buildFromString('1, two, 3');
      // An alert should have been shown for invalid input
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[dialogs.length - 1].message).toContain('Invalid input');

      // Heap remains empty
      const after = await heap.getHeapDisplayText();
      expect(after).toBe('(empty heap)');
    });

    test('Build with empty input triggers alert', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.inputValues.fill('   ');
      await heap.btnBuild.click();

      // Expect an alert complaining about empty input
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[dialogs.length - 1].message).toContain('Input is empty');

      // Heap still empty
      expect(await heap.getHeapDisplayText()).toBe('(empty heap)');
    });
  });

  test.describe('Insert / Extract / Peek / Clear (S2, S3, S4, S5)', () => {
    test('Insert integer updates heap and becomes new root when appropriate', async ({ page }) => {
      const heap = new HeapPage(page);

      // Start with a known heap
      await heap.buildFromString('5,7,9');
      expect((await heap.getHeapDisplayText())).toContain('Level 0: 5');

      // Insert a smaller value to become new root
      await heap.insertValueNum(2);

      // After insert and resetAll, heapDisplay should show 2 as root
      const display = await heap.getHeapDisplayText();
      expect(display).toContain('Level 0: 2');

      // No dialogs expected
      expect(dialogs.length).toBe(0);
    });

    test('Insert invalid (non-integer) shows alert and does not change heap', async ({ page }) => {
      const heap = new HeapPage(page);

      await heap.buildFromString('4,6');
      const before = await heap.getHeapDisplayText();

      // Insert an invalid decimal -> triggers alert
      await heap.insertValue.fill('3.14');
      await heap.btnInsert.click();

      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[dialogs.length - 1].message).toContain('Please enter a valid integer');

      const after = await heap.getHeapDisplayText();
      expect(after).toBe(before);
    });

    test('Extract min updates heap display; extracted text gets cleared by resetAll (implementation quirk)', async ({ page }) => {
      const heap = new HeapPage(page);

      // Build a heap where min is known
      await heap.buildFromString('4,7,6');
      // Confirm root is 4
      expect((await heap.getHeapDisplayText())).toContain('Level 0: 4');

      // Extract min -> implementation sets extracted text then calls resetAll(),
      // which clears the extractedMinDisplay. We assert the actual behavior.
      await heap.extractMin();

      // Because resetAll() was called by the handler, the extractedMinDisplay is cleared
      const extractedText = await heap.getExtractedMinText();
      expect(extractedText).toBe(''); // actual implementation clears it

      // The heap display should reflect the new root (expected 6)
      const display = await heap.getHeapDisplayText();
      expect(display).toContain('Level 0: 6');
    });

    test('Peek min shows the min without modifying heap', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.buildFromString('10,3,8,4');
      await heap.peekMin();

      // Peek display should show min: 3
      const peek = await heap.getPeekMinText();
      expect(peek).toContain('Min: 3');

      // Heap display should remain unchanged (root still 3)
      const display = await heap.getHeapDisplayText();
      expect(display).toContain('Level 0: 3');
    });

    test('Peek on empty heap shows "Heap is empty."', async ({ page }) => {
      const heap = new HeapPage(page);
      // Ensure heap is empty by clearing
      await heap.clearHeap();
      await heap.peekMin();
      const peek = await heap.getPeekMinText();
      expect(peek).toContain('Heap is empty.');
    });

    test('Clear heap empties display and step visualizer', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.buildFromString('2,3,4');
      // Now clear
      await heap.clearHeap();

      // Heap display should indicate empty
      expect(await heap.getHeapDisplayText()).toBe('(empty heap)');

      // Step visualizer should indicate no heap loaded
      const stepText = await heap.getStepHeapDisplayText();
      expect(stepText).toContain('(No heap loaded for step-by-step)');
    });
  });

  test.describe('Bulk Insert and Serialization (S6, S7, S8)', () => {
    test('Bulk random insert inserts expected count (serialized length matches)', async ({ page }) => {
      const heap = new HeapPage(page);

      // Ensure starting from empty
      await heap.clearHeap();

      // Insert 5 random elements
      await heap.bulkInsertCount(5);

      // Serialize and parse JSON to assert length
      const serialized = await heap.serialize();
      let arr = [];
      try {
        arr = JSON.parse(serialized);
      } catch (e) {
        arr = null;
      }
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBe(5);
      // values should be integers
      for (const v of arr) {
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    test('Serialize after build yields JSON with root = min(input)', async ({ page }) => {
      const heap = new HeapPage(page);
      const inputArr = [5, 3, 8, 1, 2];
      await heap.buildFromString(inputArr.join(','));
      const serialized = await heap.serialize();
      const arr = JSON.parse(serialized);
      // The root (index 0) must be the minimum of the input array
      expect(arr[0]).toBe(Math.min(...inputArr));
      expect(arr.length).toBe(inputArr.length);
    });

    test('Deserialize valid JSON updates the heap display', async ({ page }) => {
      const heap = new HeapPage(page);
      // Provide a serialized array where min is known
      const serialized = JSON.stringify([9, 4, 6]);
      await heap.deserialize(serialized);

      // After deserialize, resetAll is called which updates displays; root should be min (4)
      const display = await heap.getHeapDisplayText();
      expect(display).toContain('Level 0: 4');
    });

    test('Deserialize invalid JSON triggers alert and does not update heap', async ({ page }) => {
      const heap = new HeapPage(page);
      // Start empty
      await heap.clearHeap();
      const before = await heap.getHeapDisplayText();
      // Provide invalid serialized data
      await heap.heapSerialization.fill('not a json');
      await heap.btnDeserialize.click();

      // Dialog should indicate invalid serialized data
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[dialogs.length - 1].message).toContain('Invalid serialized data');

      const after = await heap.getHeapDisplayText();
      expect(after).toBe(before);
    });
  });

  test.describe('Step-by-step Heapify Visualization (S9, S10, S11)', () => {
    test('Step actions with no loaded step heap show an alert', async ({ page }) => {
      const heap = new HeapPage(page);
      // Ensure no heap loaded for step-by-step: clear main heap and reset step
      await heap.clearHeap();
      // Now try step down
      await heap.stepDown();
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[dialogs.length - 1].message).toContain('No heap loaded for step-by-step');

      // Try step up, expect another alert
      await heap.stepUp();
      expect(dialogs[dialogs.length - 1].message).toContain('No heap loaded for step-by-step');
    });

    test('StepDown/StepUp on a valid loaded step heap typically alerts when node is already correct (implementation behavior)', async ({ page }) => {
      const heap = new HeapPage(page);
      // Build a valid heap so stepHeap is populated
      await heap.buildFromString('1,2,3,4,5');

      // Set step index to 0 (root). For a valid min-heap, heapifyDown will often return false and the implementation alerts.
      await heap.setStepIndex(0);
      await heap.stepDown();

      // Expect an alert telling node already correct (since heap was a valid min-heap)
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[dialogs.length - 1].message).toContain('Heapify down');

      // Test step up similarly
      await heap.setStepIndex(4); // a leaf index, typically already correct
      await heap.stepUp();
      expect(dialogs[dialogs.length - 1].message).toContain('Heapify up');
    });

    test('Reset step restores the step visualizer to original copied data', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.buildFromString('7,3,9,10');

      // Make sure step visualizer shows something
      const before = await heap.getStepHeapDisplayText();
      expect(before).toContain('Level 0: 3');

      // Modify step index and trigger reset (reset simply reloads originalHeapData)
      await heap.setStepIndex(2);
      await heap.resetStep();

      const after = await heap.getStepHeapDisplayText();
      // Reset should not fail and should display Level lines again
      expect(after).toContain('Level 0: 3');
    });
  });

  test.describe('Edge cases and error flows', () => {
    test('Bulk insert with invalid count triggers alert', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.clearHeap();

      // Try non-integer bulk count
      await heap.bulkCount.fill('abc');
      await heap.btnBulkRandomInsert.click();
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[dialogs.length - 1].message).toContain('Enter a positive integer');

      // Try out-of-range value
      await heap.bulkCount.fill('1001');
      await heap.btnBulkRandomInsert.click();
      expect(dialogs[dialogs.length - 1].message).toContain('Enter a positive integer');
    });

    test('Deserialize non-array JSON triggers alert', async ({ page }) => {
      const heap = new HeapPage(page);
      await heap.heapSerialization.fill(JSON.stringify({ a: 1 }));
      await heap.btnDeserialize.click();

      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[dialogs.length - 1].message).toContain('Invalid serialized data');
    });

    test('Step actions with out-of-bounds index trigger alert', async ({ page }) => {
      const heap = new HeapPage(page);
      // Build to ensure step heap exists
      await heap.buildFromString('2,4,6');

      // Set index to a large out-of-range value
      await heap.setStepIndex(100);
      await heap.stepDown();
      expect(dialogs.length).toBeGreaterThan(0);
      expect(dialogs[dialogs.length - 1].message).toContain('Index must be an integer within heap indices');

      // Step up out-of-bounds
      await heap.setStepIndex(-1);
      await heap.stepUp();
      expect(dialogs[dialogs.length - 1].message).toContain('Index must be an integer within heap indices');
    });
  });
});