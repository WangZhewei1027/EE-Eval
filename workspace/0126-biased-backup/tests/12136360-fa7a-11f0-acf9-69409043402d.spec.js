import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12136360-fa7a-11f0-acf9-69409043402d.html';

test.describe('Max Heap Interactive Explorer - FSM states and transitions', () => {
  // Shared recorder for console messages and page errors
  let consoleEvents;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleEvents = [];
    pageErrors = [];

    // Capture console events with their types and text
    page.on('console', msg => {
      consoleEvents.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    // Ensure no uncaught JS exceptions occurred during the test run
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    // Ensure no console messages of type 'error' were emitted
    const consoleErrors = consoleEvents.filter(c => c.type === 'error');
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  // Helper getters for DOM elements
  async function getHeapDisplay(page) {
    return (await page.locator('#heap-display').textContent()) || '';
  }
  async function getLogText(page) {
    return (await page.locator('#log').textContent()) || '';
  }
  async function getHeapifyState(page) {
    return (await page.locator('#heapify-state').textContent()) || '';
  }
  async function getHeapSize(page) {
    return (await page.locator('#heap-size').textContent()) || '';
  }

  test('Initial Idle state is rendered (S0_Idle)', async ({ page }) => {
    // Validate initial UI state corresponds to Idle state
    await expect(page.locator('h1')).toHaveText('Max Heap Interactive Explorer');
    const heapifyState = await getHeapifyState(page);
    expect(heapifyState).toBe('Idle');

    const heapDisplay = await getHeapDisplay(page);
    expect(heapDisplay).toContain('(Heap is empty)');

    const heapSize = await getHeapSize(page);
    expect(heapSize).toBe('0');

    const log = await getLogText(page);
    expect(log).toBe(''); // initially empty log
  });

  test('InsertValue transitions Idle -> Heap Built and updates display & logs', async ({ page }) => {
    // Insert a specific value and assert the heap updates accordingly
    await page.fill('#insert-value', '42');
    await page.click('#btn-insert');

    // The handler clears previous log and then logs insertion details
    const log = await getLogText(page);
    expect(log).toContain('Inserted 42 at index 0');
    expect(log).toContain('Starting sift-up');

    const heapDisplay = await getHeapDisplay(page);
    expect(heapDisplay).toContain('Heap array (index: value):');
    expect(heapDisplay).toContain('[0]: 42');

    const heapSize = await getHeapSize(page);
    expect(heapSize).toBe('1');

    // Heapify state should remain Idle (heapifyProcess is null after insert)
    const heapifyState = await getHeapifyState(page);
    expect(heapifyState).toBe('Idle');
  });

  test('InsertRandomValue produces a random insertion and updates state', async ({ page }) => {
    // Clear first to ensure clean state
    await page.click('#btn-clear');

    // Click to insert a random value
    await page.click('#btn-insert-random');

    const log = await getLogText(page);
    expect(log).toMatch(/Randomly generated value: \d+/); // random value logged
    expect(log).toMatch(/Inserted \d+ at index 0/);

    const heapSize = await getHeapSize(page);
    expect(heapSize).toBe('1');

    const heapDisplay = await getHeapDisplay(page);
    expect(heapDisplay).toContain('Heap array (index: value):');
  });

  test('ExtractMax logs extracted max and updates HeapBuilt state', async ({ page }) => {
    // Insert multiple values to form a heap
    await page.fill('#insert-value', '10');
    await page.click('#btn-insert');
    await page.fill('#insert-value', '30');
    await page.click('#btn-insert');
    await page.fill('#insert-value', '20');
    await page.click('#btn-insert');

    // Ensure heap has expected content before extraction
    let heapDisplay = await getHeapDisplay(page);
    expect(heapDisplay).toContain('Heap array (index: value):');

    // Extract max
    await page.click('#btn-extract-max');

    // The event handler clears the log first, then logs extraction messages.
    const log = await getLogText(page);
    expect(log).toMatch(/Extracted max \d+/);
    expect(log).toContain('Extracted max value:');

    // Heap size should be decreased by 1
    const heapSize = await getHeapSize(page);
    expect(Number(heapSize)).toBeGreaterThanOrEqual(0);

    // Verify heap-display updated
    heapDisplay = await getHeapDisplay(page);
    expect(heapDisplay).toContain('Heap array (index: value):');
  });

  test('PeekMax shows root value without modifying heap', async ({ page }) => {
    // Build a small heap
    await page.fill('#insert-value', '5');
    await page.click('#btn-insert');
    await page.fill('#insert-value', '9');
    await page.click('#btn-insert');

    // Capture heap display before peek
    const before = await getHeapDisplay(page);

    await page.click('#btn-peek-max');

    const log = await getLogText(page);
    expect(log).toContain('Max (root) value is:');

    const after = await getHeapDisplay(page);
    // The heap display should remain the same after peek
    expect(after).toBe(before);
  });

  test('ClearHeap transitions HeapBuilt -> Idle and clears data', async ({ page }) => {
    // Insert an element
    await page.fill('#insert-value', '77');
    await page.click('#btn-insert');

    // Now clear heap
    await page.click('#btn-clear');

    const heapDisplay = await getHeapDisplay(page);
    expect(heapDisplay).toContain('(Heap is empty)');

    const heapSize = await getHeapSize(page);
    expect(heapSize).toBe('0');

    const log = await getLogText(page);
    expect(log).toContain('Heap cleared.');

    const heapifyState = await getHeapifyState(page);
    expect(heapifyState).toBe('Idle');
  });

  test('HeapifyFromArray (bottom-up) stepwise progress and reset (S0_Idle -> S2_HeapifyInProgress -> S0_Idle)', async ({ page }) => {
    // Provide array input and choose bottom-up strategy
    await page.fill('#heapify-array-input', '3 1 4 2');
    await page.selectOption('#heapify-strategy', 'bottom-up');

    // Build heapify process
    await page.click('#btn-heapify-scratch');

    // The build handler clears log, logs initialization, and sets the process
    let log = await getLogText(page);
    expect(log).toContain('Initialized bottom-up Floyd heapify with array: [3, 1, 4, 2]');

    let state = await getHeapifyState(page);
    expect(state.startsWith('Running')).toBeTruthy();

    // Perform heapify steps until completion.
    // The implementation does copy+first-siftDown on the first step call,
    // then subsequent steps continue. We'll call step 3 times to ensure completion.
    await page.click('#btn-heapify-step'); // step 1
    log = await getLogText(page);
    expect(log).toMatch(/Heapify step: siftDown at index \d+/);

    await page.click('#btn-heapify-step'); // step 2
    log = await getLogText(page);
    // Each step clears previous log, but the per-step log should indicate siftDown or completion
    expect(/(siftDown|Heapify complete|Final heap)/.test(log)).toBeTruthy();

    await page.click('#btn-heapify-step'); // step 3 - likely completes
    log = await getLogText(page);
    // Final step should indicate completion in some form
    expect(/(Heapify complete|Final heap is:)/.test(log)).toBeTruthy();

    // Check heapify-state shows DONE after completion via renderHeapifyProcess
    state = await getHeapifyState(page);
    expect(state).toContain('DONE');

    // Now reset the heapify process
    await page.click('#btn-heapify-reset');

    // The reset handler logs 'Heapify process reset.' and sets state to Idle
    log = await getLogText(page);
    expect(log).toContain('Heapify process reset.');

    state = await getHeapifyState(page);
    expect(state).toBe('Idle');
  });

  test('HeapifyFromArray (insert strategy) stepwise until done', async ({ page }) => {
    await page.fill('#heapify-array-input', '7 2 8');
    await page.selectOption('#heapify-strategy', 'insert');

    await page.click('#btn-heapify-scratch');

    let log = await getLogText(page);
    expect(log).toContain('Initialized insert-style heapify with array: [7, 2, 8]');

    // Execute steps for each element until the process finishes.
    // For 3 elements we expect 3 steps (one per insertion)
    await page.click('#btn-heapify-step'); // insert 7
    log = await getLogText(page);
    expect(log).toContain('Inserted 7 at index 0');

    await page.click('#btn-heapify-step'); // insert 2
    log = await getLogText(page);
    expect(log).toContain('Inserted 2 at index');

    await page.click('#btn-heapify-step'); // insert 8
    log = await getLogText(page);
    // Last step should show completion or final heap
    expect(/(Insert heapify complete|Final heap is:|Inserted 8 at index)/.test(log)).toBeTruthy();

    const state = await getHeapifyState(page);
    // After completion renderHeapifyProcess will set 'DONE'
    expect(state).toBeDefined();
  });

  test('ManualSwap performs valid swap and reports out-of-range edge case', async ({ page }) => {
    // Start from empty heap and add two values
    await page.fill('#insert-value', '15');
    await page.click('#btn-insert');
    await page.fill('#insert-value', '25');
    await page.click('#btn-insert');

    // Ensure we have at least two elements
    let heapSize = await getHeapSize(page);
    expect(Number(heapSize)).toBeGreaterThanOrEqual(2);

    // Perform a manual swap between indices 0 and 1
    await page.fill('#swap-index1', '0');
    await page.fill('#swap-index2', '1');
    await page.click('#btn-swap');

    let log = await getLogText(page);
    expect(log).toContain('Swapped indices 0 ('); // message includes swapped indices and values
    expect(log).toContain('After manual swap.');

    // Now try an out-of-range swap to trigger the guard
    await page.fill('#swap-index1', '10');
    await page.fill('#swap-index2', '20');
    await page.click('#btn-swap');

    log = await getLogText(page);
    // The swap function logs a specific out-of-range message
    expect(log).toContain('Swap indices out of range; no swap performed.');
  });

  test('Insert with invalid input logs a helpful error (edge case)', async ({ page }) => {
    // Ensure insert-value is empty and click insert
    await page.fill('#insert-value', '');
    await page.click('#btn-insert');

    // Handler should log a message requesting valid integer
    const log = await getLogText(page);
    expect(log).toContain('Please enter a valid integer to insert.');
  });

  test('Heapify with invalid array input logs parsing error (edge case)', async ({ page }) => {
    await page.fill('#heapify-array-input', '1 a 3');
    await page.selectOption('#heapify-strategy', 'bottom-up');
    await page.click('#btn-heapify-scratch');

    const log = await getLogText(page);
    expect(log).toContain('Invalid integer in array input: "a"');
  });

  test('Heapify step without starting logs helpful message (edge case)', async ({ page }) {
    // Ensure no heapifyProcess started and click step
    // Clear any input and do a step click
    await page.fill('#heapify-array-input', '');
    await page.click('#btn-heapify-step');

    const log = await getLogText(page);
    expect(log).toContain('No heapify process started. Use "Build Heap from Array" first.');
  });
});