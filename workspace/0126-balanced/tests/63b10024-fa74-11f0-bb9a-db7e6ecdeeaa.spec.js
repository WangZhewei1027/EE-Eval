import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b10024-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Heap Sort Visualization page
class HeapSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayContainer = page.locator('#arrayContainer');
    this.generateBtn = page.locator('#generateBtn');
    this.startBtn = page.locator('#startBtn');
    this.arraySizeInput = page.locator('#arraySize');
    this.log = page.locator('#log');
    this.bars = page.locator('#arrayContainer .bar');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial rendering is complete by waiting for at least one bar to be present
    await this.page.waitForSelector('#arrayContainer .bar', { timeout: 10000 });
  }

  // Set array size via input
  async setArraySize(size) {
    await this.arraySizeInput.fill(String(size));
  }

  // Click generate button
  async clickGenerate() {
    await this.generateBtn.click();
  }

  // Click start button
  async clickStart() {
    await this.startBtn.click();
  }

  // Return number of bars currently rendered
  async getBarCount() {
    return await this.bars.count();
  }

  // Return number of bars with 'sorted' class
  async getSortedBarCount() {
    return await this.page.locator('#arrayContainer .bar.sorted').count();
  }

  // Return log lines as array of strings
  async getLogLines() {
    return await this.page.$$eval('#log div', nodes => nodes.map(n => n.textContent || ''));
  }

  // Wait until the log contains the completion message (heap sort finished)
  async waitForSortComplete(timeout = 30000) {
    await this.page.waitForFunction(
      () => document.getElementById('log') && document.getElementById('log').innerText.includes('Heap Sort complete. Array sorted.'),
      null,
      { timeout }
    );
  }

  // Wait until log contains the "Starting Heap Sort" message (sorting has begun)
  async waitForSortStart(timeout = 10000) {
    await this.page.waitForFunction(
      () => document.getElementById('log') && document.getElementById('log').innerText.includes('Starting Heap Sort on array:'),
      null,
      { timeout }
    );
  }
}

test.describe('Heap Sort Visualization - FSM based tests', () => {
  let page;
  let heapPage;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ context }) => {
    page = await context.newPage();
    heapPage = new HeapSortPage(page);

    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), args: msg.args() });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the app and wait for initial render
    await heapPage.goto();
  });

  test.afterEach(async () => {
    // Assert that no unexpected runtime errors were emitted to the console
    expect(consoleErrors, `Found console.error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toHaveLength(0);
    // Assert that no uncaught page errors occurred
    expect(pageErrors, `Found page errors: ${pageErrors.map(e => String(e)).join(' | ')}`).toHaveLength(0);

    await page.close();
  });

  test('Initial load triggers S0_Idle entry and transitions to S1_ArrayGenerated (array rendered and log contains Generated new array)', async () => {
    // This test validates the FSM initial state S0_Idle which should call generateArray(...) on enter
    // and then state S1_ArrayGenerated (renderArray + log entry).
    // Verify that bars are rendered and the log contains the generated message.

    // The input has default value 20 on the page; confirm bar count equals that value
    const sizeValue = await page.locator('#arraySize').inputValue();
    const expectedInitialSize = parseInt(sizeValue, 10);

    const barCount = await heapPage.getBarCount();
    expect(barCount).toBe(expectedInitialSize);

    // Verify that the log contains the "Generated new array" message
    const logs = await heapPage.getLogLines();
    const hasGeneratedMsg = logs.some(line => line.includes('Generated new array:'));
    expect(hasGeneratedMsg).toBe(true);
  });

  test('Generate New Array button transitions: S0_Idle -> S1_ArrayGenerated (with custom valid size)', async () => {
    // This test validates clicking the Generate button produces a new array and updates the log.

    // Set a small array size to speed up tests
    await heapPage.setArraySize(7);
    await heapPage.clickGenerate();

    // After clicking generate, new bars should be rendered with count 7
    const barCountAfter = await heapPage.getBarCount();
    expect(barCountAfter).toBe(7);

    // Verify the log shows the generated array message with 7 elements listed
    const logs = await heapPage.getLogLines();
    const generatedLine = logs.find(line => line.startsWith('Generated new array:'));
    expect(generatedLine).toBeTruthy();

    // Basic sanity: the comma-separated values inside the brackets should equal 7 numbers
    const match = generatedLine!.match(/\[([\d,\s]*)\]/);
    expect(match).not.toBeNull();
    if (match) {
      const values = match[1].split(',').map(s => s.trim()).filter(Boolean);
      expect(values.length).toBe(7);
    }
  });

  test('Invalid array size triggers alert (edge case)', async ({ page: testPage }) => {
    // Test that providing an invalid size (less than min) triggers the alert dialog and doesn't crash.
    // We attach a one-time dialog handler to assert the message.
    const dialogPromise = new Promise(resolve => {
      testPage.once('dialog', async dialog => {
        resolve(dialog.message());
        await dialog.dismiss();
      });
    });

    await heapPage.setArraySize(3);
    await heapPage.clickGenerate();

    // Wait for the dialog to appear and assert its text
    const dialogText = await dialogPromise;
    expect(dialogText).toBe('Array size must be between 5 and 50.');

    // After dismissing the dialog, the existing array should remain rendered (no crash)
    const barCount = await heapPage.getBarCount();
    expect(barCount).toBeGreaterThanOrEqual(5); // initial page had at least 5 (default 20)
  });

  test('Start Heap Sort triggers sorting (S1_ArrayGenerated -> S2_Sorting) and completes to S3_Sorted', async () => {
    // This test validates the full sorting transition: S1 -> S2 -> S3.
    // Use a small array size to keep the test fast and deterministic in timing.

    const size = 5;
    await heapPage.setArraySize(size);
    await heapPage.clickGenerate();

    // Start sorting
    await heapPage.clickStart();

    // Wait until the sorting has clearly started (log contains starting message)
    await heapPage.waitForSortStart();

    // Verify that "Starting Heap Sort" is the first cleared log message (heapSort clears logContainer at start)
    const logsDuring = await heapPage.getLogLines();
    const hasStart = logsDuring.some(l => l.includes('Starting Heap Sort on array:'));
    expect(hasStart).toBe(true);

    // Wait for the sorting process to complete (final log entry)
    await heapPage.waitForSortComplete(60000); // allow up to 60s on slower machines

    // After completion, all bars should have class 'sorted'
    const sortedCount = await heapPage.getSortedBarCount();
    expect(sortedCount).toBe(size);

    // Final log should include completion message
    const finalLogs = await heapPage.getLogLines();
    const completionLine = finalLogs.find(line => line.includes('Heap Sort complete. Array sorted.'));
    expect(completionLine).toBeTruthy();
  }, { timeout: 120000 });

  test('Clicking Generate while sorting is in-progress is a no-op (generateBtn ignored during sorting)', async () => {
    // This test validates the transition guard: generateBtn.onclick returns early if sorting is true.
    // We'll start a sort on a small array, then immediately attempt to generate a new array.
    // We assert that no "Generated new array:" entry appears in the log until after sorting completes.

    const size = 6;
    await heapPage.setArraySize(size);
    await heapPage.clickGenerate();

    // Start sorting
    await heapPage.clickStart();

    // Wait for sorting to start
    await heapPage.waitForSortStart();

    // Immediately attempt to generate a new array while sorting is in progress
    // If generateBtn is ignored while sorting, no "Generated new array:" message should be appended during sorting.
    await heapPage.clickGenerate();

    // Give a small amount of time for any unexpected behavior to surface
    await page.waitForTimeout(1000);

    // Collect current log content
    const logsMid = await heapPage.getLogLines();
    const hasGeneratedDuringSort = logsMid.some(line => line.includes('Generated new array:'));
    // We expect no "Generated new array:" entry while sorting is ongoing
    expect(hasGeneratedDuringSort).toBe(false);

    // Wait for sort to complete normally
    await heapPage.waitForSortComplete(60000);

    // After sort completes, clicking generate should work again (sanity)
    await heapPage.clickGenerate();
    const logsAfter = await heapPage.getLogLines();
    const hasGeneratedAfter = logsAfter.some(line => line.includes('Generated new array:'));
    expect(hasGeneratedAfter).toBe(true);
  }, { timeout: 120000 });

  test('No uncaught ReferenceError / SyntaxError / TypeError occurred during interactions', async () => {
    // This test explicitly inspects captured page errors and console.error messages
    // to ensure the app did not emit any uncaught runtime errors like ReferenceError, SyntaxError, or TypeError.

    // Perform some interactions
    await heapPage.setArraySize(5);
    await heapPage.clickGenerate();
    await heapPage.clickStart();

    // Wait for the sorting to start and then quickly wait for completion (bounded)
    await heapPage.waitForSortStart();
    await heapPage.waitForSortComplete(60000);

    // Verify that no page errors or console.error messages were captured (these are asserted globally in afterEach)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 120000 });
});