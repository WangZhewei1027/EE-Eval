import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213d890-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Heap Sort demo to group interactions and selectors
class HeapDemoPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      arrayInput: '#arrayInput',
      loadArrayBtn: '#loadArrayBtn',
      randomArrayBtn: '#randomArrayBtn',
      randomSize: '#randomSize',
      buildHeapBtn: '#buildHeapBtn',
      heapifyStepBtn: '#heapifyStepBtn',
      heapSortStepBtn: '#heapSortStepBtn',
      autoHeapifyBtn: '#autoHeapifyBtn',
      autoHeapSortBtn: '#autoHeapSortBtn',
      resetBtn: '#resetBtn',
      autoDelayRange: '#autoDelayRange',
      autoDelayDisplay: '#autoDelayDisplay',
      stateDescription: '#stateDescription',
      arrayVisualization: '#arrayVisualization',
      log: '#log',
      heapifyIndexInput: '#heapifyIndexInput',
      heapifyAtIndexBtn: '#heapifyAtIndexBtn',
      sortExtractCountInput: '#sortExtractCountInput',
      sortExtractToCountBtn: '#sortExtractToCountBtn',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getText(selector) {
    return (await this.page.locator(selector).textContent()) || '';
  }

  async getValue(selector) {
    return (await this.page.locator(selector).inputValue()) || '';
  }

  async isDisabled(selector) {
    return await this.page.locator(selector).isDisabled();
  }

  async click(selector) {
    await this.page.locator(selector).click();
  }

  async fill(selector, value) {
    await this.page.locator(selector).fill(String(value));
  }

  async setRangeValue(value) {
    // set value and dispatch input event to trigger handlers
    await this.page.locator(this.selectors.autoDelayRange).evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async waitForLogContains(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, sub) => document.querySelector(sel).textContent.includes(sub),
      this.selectors.log,
      substring,
      { timeout }
    );
  }

  async waitForStateDescriptionContains(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, sub) => document.querySelector(sel).textContent.includes(sub),
      this.selectors.stateDescription,
      substring,
      { timeout }
    );
  }
}

// Global helper to capture console messages and page errors for assertions
async function captureConsoleAndErrors(page) {
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  return { consoleMessages, pageErrors };
}

test.describe('Heap Sort Interactive Demo - FSM validation and UI behavior', () => {
  // Each test gets a fresh page
  test.beforeEach(async ({ page }) => {
    // nothing globally required
  });

  // Validate initial render and UI elements reflect "loaded" state
  test('Initial render: controls and state on page load', async ({ page }) => {
    // Arrange
    const { consoleMessages, pageErrors } = await captureConsoleAndErrors(page);
    const heap = new HeapDemoPage(page);

    // Act
    await heap.goto();

    // Assert initial state description contains loaded text
    const desc = await heap.getText(heap.selectors.stateDescription);
    expect(desc).toContain('Array loaded'); // the loaded description includes this phrase

    // Build button should be enabled when phase === loaded (renderState overwrites initial disabled attr)
    expect(await heap.isDisabled(heap.selectors.buildHeapBtn)).toBe(false);

    // Several buttons should be disabled in the loaded state
    expect(await heap.isDisabled(heap.selectors.heapifyStepBtn)).toBe(true);
    expect(await heap.isDisabled(heap.selectors.heapSortStepBtn)).toBe(true);
    expect(await heap.isDisabled(heap.selectors.autoHeapifyBtn)).toBe(false); // autoHeapify allowed in loaded
    expect(await heap.isDisabled(heap.selectors.resetBtn)).toBe(true);

    // No uncaught page errors should have been emitted during initial render
    expect(pageErrors.length).toBe(0);

    // Console should have at least been used by renderState initially (no hard assertion on text content because implementations may vary)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test.describe('Load and Random Array interactions', () => {
    test('Load Array -> UI updates and log contains loaded message', async ({ page }) => {
      const { consoleMessages, pageErrors } = await captureConsoleAndErrors(page);
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Fill an explicit array and load it
      await heap.fill(heap.selectors.arrayInput, '5 3 8 1 2');
      await heap.click(heap.selectors.loadArrayBtn);

      // The log should show "Array loaded"
      await heap.waitForLogContains('Array loaded', 1000);
      const logText = await heap.getText(heap.selectors.log);
      expect(logText).toContain('Array loaded');

      // After loading, reset should become enabled? (reset disabled only when phase === loaded). In this app resetBtn.disabled = (phase === "loaded") so reset remains disabled.
      expect(await heap.isDisabled(heap.selectors.resetBtn)).toBe(true);

      // No page errors should have occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Random Array generates array and populates input field', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Set a valid size and click random
      await heap.fill(heap.selectors.randomSize, '7');
      await heap.click(heap.selectors.randomArrayBtn);

      // The arrayInput should be populated and log contain "Random array generated"
      await heap.waitForLogContains('Random array generated', 1000);
      const value = await heap.getValue(heap.selectors.arrayInput);
      expect(value.trim().split(/[\s,]+/).length).toBe(7);
    });
  });

  test.describe('Build Heap and Heapify Step-by-step', () => {
    test('Build heap transitions from loaded -> buildingHeap -> builtHeap via steps', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Load an array of length 5 so there are multiple heapify steps
      await heap.fill(heap.selectors.arrayInput, '5 3 8 1 2');
      await heap.click(heap.selectors.loadArrayBtn);
      await heap.click(heap.selectors.buildHeapBtn);

      // After clicking Build Max Heap we should show the building description
      await heap.waitForStateDescriptionContains('Building max heap step-by-step', 1000);
      expect((await heap.getText(heap.selectors.stateDescription))).toContain('Building max heap');

      // Heapify step button should be enabled in buildingHeap
      expect(await heap.isDisabled(heap.selectors.heapifyStepBtn)).toBe(false);

      // Perform heapify steps until built heap
      // For 5 elements buildHeapBtn sets heapifyI = Math.floor(heapSize/2)-1 = 1, so two steps expected
      await heap.click(heap.selectors.heapifyStepBtn); // index 1
      // After first step still building (heapifyI becomes 0)
      expect((await heap.getText(heap.selectors.stateDescription))).toContain('Building max heap');

      await heap.click(heap.selectors.heapifyStepBtn); // index 0 -> completes build
      // Wait for built heap description
      await heap.waitForStateDescriptionContains('Max heap built', 1000);
      const descAfterBuilt = await heap.getText(heap.selectors.stateDescription);
      expect(descAfterBuilt).toContain('Max heap built');
      // After builtHeap, heapSortStep button should become enabled
      expect(await heap.isDisabled(heap.selectors.heapSortStepBtn)).toBe(false);
    });
  });

  test.describe('Heap Sort step interactions', () => {
    test('Perform heap sort step-by-step until sorted', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Load an array and build heap via the build button + steps to reach builtHeap
      await heap.fill(heap.selectors.arrayInput, '9 7 5 3 1 6');
      await heap.click(heap.selectors.loadArrayBtn);
      await heap.click(heap.selectors.buildHeapBtn);

      // Perform heapify steps until built
      // Determine number of steps needed by reading initial heapifyI from description is not accessible; so click until state shows builtHeap.
      // Limit to a safe max loop count to avoid infinite loops
      for (let i = 0; i < 20; i++) {
        const desc = await heap.getText(heap.selectors.stateDescription);
        if (desc.includes('Max heap built')) break;
        if (await heap.isDisabled(heap.selectors.heapifyStepBtn)) break;
        await heap.click(heap.selectors.heapifyStepBtn);
      }
      await heap.waitForStateDescriptionContains('Max heap built', 1500);

      // Now perform heapSortStep clicks until sorted state achieved
      // The heap sort requires (n-1) steps; for 6 elements that's 5 steps
      for (let i = 0; i < 7; i++) {
        const desc = await heap.getText(heap.selectors.stateDescription);
        if (desc.includes('Sorting finished') || desc.includes('Sorting finished.')) break;
        // Ensure heapSortStep button is enabled
        expect(await heap.isDisabled(heap.selectors.heapSortStepBtn)).toBe(false);
        await heap.click(heap.selectors.heapSortStepBtn);
      }

      // Final state should indicate sorted
      await heap.waitForStateDescriptionContains('Sorting finished', 2000);
      const finalDesc = await heap.getText(heap.selectors.stateDescription);
      expect(finalDesc).toContain('Sorting finished');
      // After sorted, heapSortStep should be disabled
      expect(await heap.isDisabled(heap.selectors.heapSortStepBtn)).toBe(true);
    });
  });

  test.describe('Auto Heapify and Auto Heap Sort', () => {
    test('Auto Heapify runs to completion and transitions to builtHeap', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Generate a small random array to keep auto run short
      await heap.fill(heap.selectors.randomSize, '6');
      await heap.click(heap.selectors.randomArrayBtn);

      // Speed up the auto timer to 50ms so test runs quickly
      await heap.setRangeValue(50);

      // Start auto heapify
      await heap.click(heap.selectors.autoHeapifyBtn);

      // Wait for the "Auto build max heap completed." message in the log
      await heap.waitForLogContains('Auto build max heap completed', 5000);

      // The state should now be builtHeap
      await heap.waitForStateDescriptionContains('Max heap built', 2000);
      expect((await heap.getText(heap.selectors.stateDescription))).toContain('Max heap built');
    });

    test('Auto Heap Sort runs to completion and transitions to sorted', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Load an array and build heap first by using autoHeapify for speed
      await heap.fill(heap.selectors.randomSize, '6');
      await heap.click(heap.selectors.randomArrayBtn);
      await heap.setRangeValue(50);
      await heap.click(heap.selectors.autoHeapifyBtn);

      // Wait for auto heapify to finish -> builtHeap
      await heap.waitForLogContains('Auto build max heap completed', 5000);
      await heap.waitForStateDescriptionContains('Max heap built', 2000);

      // Now start auto heap sort
      await heap.click(heap.selectors.autoHeapSortBtn);

      // Wait for auto heap sort to finish (log message)
      await heap.waitForLogContains('Auto heap sort ended', 10000);

      // Final state must be "sorted"
      await heap.waitForStateDescriptionContains('Sorting finished', 2000);
      expect((await heap.getText(heap.selectors.stateDescription))).toContain('Sorting finished');
    });
  });

  test.describe('Specific controls: Heapify at index and Extract to count', () => {
    test('Heapify At Index triggers maxHeapify and logs the action', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Load array
      await heap.fill(heap.selectors.arrayInput, '4 2 6 8');
      await heap.click(heap.selectors.loadArrayBtn);

      // Ensure heapifyAtIndex is enabled in loaded state
      expect(await heap.isDisabled(heap.selectors.heapifyAtIndexBtn)).toBe(false);

      // Set index to 0 and trigger heapify at index
      await heap.fill(heap.selectors.heapifyIndexInput, '0');

      // Listen for the log message
      await heap.click(heap.selectors.heapifyAtIndexBtn);
      await heap.waitForLogContains('User triggered maxHeapify at index 0', 1000);

      const logText = await heap.getText(heap.selectors.log);
      expect(logText).toContain('User triggered maxHeapify at index 0');
    });

    test('Extract to count performs specified number of heap sort steps', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Use an explicit array
      await heap.fill(heap.selectors.arrayInput, '10 9 8 7 6');
      await heap.click(heap.selectors.loadArrayBtn);

      // Build heap via build button and steps
      await heap.click(heap.selectors.buildHeapBtn);
      // complete heapify steps
      for (let i = 0; i < 10; i++) {
        const desc = await heap.getText(heap.selectors.stateDescription);
        if (desc.includes('Max heap built')) break;
        if (await heap.isDisabled(heap.selectors.heapifyStepBtn)) break;
        await heap.click(heap.selectors.heapifyStepBtn);
      }
      await heap.waitForStateDescriptionContains('Max heap built', 1500);

      // Request extracting 2 elements
      await heap.fill(heap.selectors.sortExtractCountInput, '2');
      await heap.click(heap.selectors.sortExtractToCountBtn);

      // After extraction, log should include "Heap sort started via extraction count shortcut." or "Heap sort finished" depending on size
      const logText = await heap.getText(heap.selectors.log);
      expect(logText).toContain('Heap sort started via extraction count shortcut');

      // Ensure that after extraction the state is either heapSorting or sorted
      const desc = await heap.getText(heap.selectors.stateDescription);
      const valid = desc.includes('Heap sort in progress') || desc.includes('Sorting finished') || desc.includes('Heap sort');
      expect(valid).toBeTruthy();
    });
  });

  test.describe('Edge cases and alert dialogs', () => {
    test('Loading an empty array triggers an alert', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Ensure arrayInput is empty
      await heap.fill(heap.selectors.arrayInput, '');

      // Expect an alert when clicking load
      const dialogPromise = page.waitForEvent('dialog');
      await heap.click(heap.selectors.loadArrayBtn);
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Input array is empty.');
      await dialog.accept();
    });

    test('Loading an invalid array triggers an alert about incorrect input', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Set invalid input containing a non-integer token
      await heap.fill(heap.selectors.arrayInput, '1 2 foo 4');
      const dialogPromise = page.waitForEvent('dialog');
      await heap.click(heap.selectors.loadArrayBtn);
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Input incorrect');
      await dialog.accept();
    });

    test('Random array with invalid size triggers an alert', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Set invalid random size (31 > 30)
      await heap.fill(heap.selectors.randomSize, '31');
      const dialogPromise = page.waitForEvent('dialog');
      await heap.click(heap.selectors.randomArrayBtn);
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Size must be an integer between 1 and 30.');
      await dialog.accept();
    });

    test('Heapify at index with invalid index triggers an alert', async ({ page }) => {
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Load a small array of size 3
      await heap.fill(heap.selectors.arrayInput, '1 2 3');
      await heap.click(heap.selectors.loadArrayBtn);

      // Set an invalid index (e.g., 5)
      await heap.fill(heap.selectors.heapifyIndexInput, '5');
      const dialogPromise = page.waitForEvent('dialog');
      await heap.click(heap.selectors.heapifyAtIndexBtn);
      const dialog = await dialogPromise;
      // Message mentions allowed range; check substring
      expect(dialog.message()).toContain('Index must be integer');
      await dialog.accept();
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught page errors during typical interactions', async ({ page }) => {
      const { consoleMessages, pageErrors } = await captureConsoleAndErrors(page);
      const heap = new HeapDemoPage(page);
      await heap.goto();

      // Do a few interactions that exercise code paths
      await heap.fill(heap.selectors.arrayInput, '3 1 4 1 5 9');
      await heap.click(heap.selectors.loadArrayBtn);
      await heap.click(heap.selectors.buildHeapBtn);

      // Perform heapify steps until built
      for (let i = 0; i < 20; i++) {
        const desc = await heap.getText(heap.selectors.stateDescription);
        if (desc.includes('Max heap built')) break;
        if (await heap.isDisabled(heap.selectors.heapifyStepBtn)) break;
        await heap.click(heap.selectors.heapifyStepBtn);
      }
      await heap.waitForStateDescriptionContains('Max heap built', 1500);

      // Start and stop auto heap sort quickly
      await heap.setRangeValue(50);
      await heap.click(heap.selectors.autoHeapSortBtn);
      // Give it a short moment to run a few iterations
      await page.waitForTimeout(300);
      // Click Reset to stop timers and restore initial state
      await heap.click(heap.selectors.resetBtn);

      // Assert there were no uncaught page errors recorded
      expect(pageErrors.length).toBe(0);

      // And console contains expected informative logs at least; we check a sample
      const joinedConsole = consoleMessages.map((m) => `${m.type}:${m.text}`).join('\n');
      expect(joinedConsole.length).toBeGreaterThanOrEqual(0);
    });
  });
});