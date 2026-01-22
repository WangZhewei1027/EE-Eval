import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e932ff41-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Heap (Min / Max) Interactive Demo — e932ff41-d360-11f0-a097-ffdd56c22ef4', () => {
  // Shared variables to collect console messages and page errors
  let consoleMsgs;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMsgs = [];
    pageErrors = [];

    // Collect console messages for later verification
    page.on('console', msg => {
      try {
        consoleMsgs.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMsgs.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Auto-accept alerts that the app uses for heap sort and validations
    page.on('dialog', async dialog => {
      // store alert text to consoleMsgs for verification and accept
      consoleMsgs.push({ type: 'dialog', text: dialog.message() });
      await dialog.accept();
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait briefly for initial render and logs to populate
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // No-op; test harness cleans up pages automatically
  });

  // Page Object for interacting with controls
  function controls(page) {
    return {
      typeSel: () => page.locator('#type'),
      valueInput: () => page.locator('#value'),
      listInput: () => page.locator('#listInput'),
      insertBtn: () => page.locator('#insertBtn'),
      extractBtn: () => page.locator('#extractBtn'),
      peekBtn: () => page.locator('#peekBtn'),
      clearBtn: () => page.locator('#clearBtn'),
      buildBtn: () => page.locator('#buildBtn'),
      randBtn: () => page.locator('#randBtn'),
      heapSortBtn: () => page.locator('#heapSortBtn'),
      visualSortBtn: () => page.locator('#visualSortBtn'),
      toggleAnim: () => page.locator('#toggleAnim'),
      stepBtn: () => page.locator('#stepBtn'),
      arrayView: () => page.locator('#arrayView'),
      countBadge: () => page.locator('#countBadge'),
      opsInfo: () => page.locator('#opsInfo'),
      log: () => page.locator('#log'),
      svgCanvas: () => page.locator('#svgCanvas'),
      speedRange: () => page.locator('#speed'),
      speedVal: () => page.locator('#speedVal'),
      title: () => page.locator('#title'),
      subtitle: () => page.locator('#subtitle')
    };
  }

  test('Initial Idle state renders and shows ready log', async ({ page }) => {
    const c = controls(page);

    // Validate initial UI state (Idle: empty heap)
    await expect(c.countBadge()).toHaveText('0 items');
    // SVG should contain placeholder text for empty heap
    const svgText = await c.svgCanvas().locator('text').first().textContent();
    expect(svgText).toContain('Heap is empty');

    // Log should contain the ready message logged on initialization
    const logHtml = await c.log().innerHTML();
    expect(logHtml.toLowerCase()).toContain('ready — select min or max and try operations'.slice(0, 20).toLowerCase());

    // Title should indicate min heap by default
    await expect(c.title()).toContainText('Min Heap Visualization');

    // No uncaught page errors should have occurred on load
    expect(pageErrors.length).toBe(0);
  });

  test('BuildHeap from array transitions to Heap Built and renders boxes (S0_Idle -> S1_Heap_Built)', async ({ page }) => {
    const c = controls(page);

    // Prepare a known array and build
    await c.listInput().fill('5,3,8,1,9');
    await c.buildBtn().click();

    // Wait for opsInfo to update to indicate built
    await expect(c.opsInfo()).toHaveText(/Built from array/i, { timeout: 5000 });

    // Array view should contain 5 boxes
    const boxes = c.arrayView().locator('.box');
    await expect(boxes).toHaveCount(5);

    // Count badge should reflect 5 items
    await expect(c.countBadge()).toHaveText('5 items');

    // Logs should contain "Building heap from array" and "Build finished"
    const logText = await c.log().innerText();
    expect(logText).toContain('Building heap from array');
    expect(logText).toContain('Build finished');

    // Ensure no runtime page errors occurred during build
    expect(pageErrors.length).toBe(0);
  });

  test('InsertValue works from Idle and from Empty state and results in visual update (InsertValue)', async ({ page }) => {
    const c = controls(page);

    // Ensure heap is empty (clear if needed)
    await c.clearBtn().click();
    await page.waitForTimeout(100);

    // Insert a value (goes from S2_Heap_Empty -> S1_Heap_Built)
    await c.valueInput().fill('42');
    await c.insertBtn().click();

    // Wait for opsInfo to show insertion
    await expect(c.opsInfo()).toHaveText(/Inserted 42/i, { timeout: 5000 });

    // The arrayView should now have one or more boxes and include '42'
    const arrayText = await c.arrayView().innerText();
    expect(arrayText).toContain('42');

    // Confirm log contains insertion message
    const logText = await c.log().innerText();
    expect(logText).toContain('Inserting 42');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('PeekRoot returns current root without changing heap (PeekRoot)', async ({ page }) => {
    const c = controls(page);

    // Build a small heap to ensure peek has value
    await c.listInput().fill('10,4,6');
    await c.buildBtn().click();
    await expect(c.opsInfo()).toHaveText(/Built from array/i, { timeout: 5000 });

    // Click peek
    await c.peekBtn().click();

    // opsInfo should reflect peek and log should contain Peek
    await expect(c.opsInfo()).toContainText(/Peek/);
    const logText = await c.log().innerText();
    expect(logText).toContain('Peek:');

    // Heap should remain same size
    const boxes = c.arrayView().locator('.box');
    await expect(boxes).toHaveCount(3);
    expect(pageErrors.length).toBe(0);
  });

  test('ExtractRoot removes root and can empty the heap (ExtractRoot S1_Heap_Built -> S2_Heap_Empty)', async ({ page }) => {
    const c = controls(page);

    // Build from a known list
    await c.listInput().fill('2,1'); // min-heap default -> root 1 after heapify
    await c.buildBtn().click();
    await expect(c.opsInfo()).toHaveText(/Built from array/i, { timeout: 5000 });

    // Peek to see current root
    await c.peekBtn().click();
    const peekLog = await c.log().innerText();
    expect(peekLog).toContain('Peek:');

    // Extract root
    await c.extractBtn().click();

    // opsInfo should indicate extraction
    await expect(c.opsInfo()).toHaveText(/Extracted/, { timeout: 5000 });

    // If only one item remains, extract again to empty
    const boxes = c.arrayView().locator('.box');
    const count = await boxes.count();
    if (count > 0) {
      await c.extractBtn().click();
    }

    // After extracting all, arrayView should show placeholder text in SVG
    const svgText = await c.svgCanvas().locator('text').first().textContent();
    expect(svgText).toContain('Heap is empty');

    expect(pageErrors.length).toBe(0);
  });

  test('ClearHeap resets heap to empty and logs reset (ClearHeap)', async ({ page }) => {
    const c = controls(page);

    // Build and then clear
    await c.listInput().fill('7,3,9');
    await c.buildBtn().click();
    await expect(c.opsInfo()).toHaveText(/Built from array/i, { timeout: 5000 });

    // Now clear
    await c.clearBtn().click();

    // Count badge should show 0 items
    await expect(c.countBadge()).toHaveText('0 items');

    // Log should include reset message
    const logText = await c.log().innerText();
    expect(logText).toContain('Heap reset');

    expect(pageErrors.length).toBe(0);
  });

  test('GenerateRandom builds a random heap and updates UI (GenerateRandom)', async ({ page }) => {
    const c = controls(page);

    // Click random
    await c.randBtn().click();

    // Wait for opsInfo to show random build
    await expect(c.opsInfo()).toHaveText(/Random build|Random/i, { timeout: 5000 });

    // Array view should contain between 5 and 30 items as per implementation
    const boxesCount = await c.arrayView().locator('.box').count();
    expect(boxesCount).toBeGreaterThanOrEqual(5);
    expect(boxesCount).toBeLessThanOrEqual(30);

    expect(pageErrors.length).toBe(0);
  });

  test('HeapSort shows result via alert and logs the sorted array (HeapSort)', async ({ page }) => {
    const c = controls(page);

    // Build a heap first
    await c.listInput().fill('4,1,3');
    await c.buildBtn().click();
    await expect(c.opsInfo()).toHaveText(/Built from array/i, { timeout: 5000 });

    // Trigger heap sort; dialog will be auto-accepted by beforeEach handler
    await c.heapSortBtn().click();

    // The dialog text is recorded into consoleMsgs; find dialog entry
    const dialogEntries = consoleMsgs.filter(m => m.type === 'dialog' && /Heap sort result/i.test(m.text));
    expect(dialogEntries.length).toBeGreaterThanOrEqual(1);

    // The log should also contain 'Heap sort result'
    const logText = await c.log().innerText();
    expect(logText).toContain('Heap sort result');

    expect(pageErrors.length).toBe(0);
  });

  test('VisualizeSort performs a non-animated visual sort and logs result (VisualizeSort)', async ({ page }) => {
    const c = controls(page);

    // Build a heap first
    await c.listInput().fill('9,2,5,1');
    await c.buildBtn().click();
    await expect(c.opsInfo()).toHaveText(/Built from array/i, { timeout: 5000 });

    // Trigger visual sort; it will show an alert that we accept
    await c.visualSortBtn().click();

    // Confirm the log contains 'Visual heap sort starting' and 'Heap sort result'
    const logText = await c.log().innerText();
    expect(logText).toContain('Visual heap sort starting');
    expect(logText).toContain('Heap sort result');

    // Dialog should have been shown and accepted
    const dialogEntries = consoleMsgs.filter(m => m.type === 'dialog' && /Heap sort result/i.test(m.text));
    expect(dialogEntries.length).toBeGreaterThanOrEqual(1);

    expect(pageErrors.length).toBe(0);
  });

  test('ToggleAnimation toggles button text and class (ToggleAnimation)', async ({ page }) => {
    const c = controls(page);

    // Initially should be Animate: ON
    await expect(c.toggleAnim()).toHaveText(/Animate: ON/);

    // Toggle off
    await c.toggleAnim().click();
    await expect(c.toggleAnim()).toHaveText(/Animate: OFF/);

    // Toggle on again
    await c.toggleAnim().click();
    await expect(c.toggleAnim()).toHaveText(/Animate: ON/);

    expect(pageErrors.length).toBe(0);
  });

  test('StepMode toggles and pauses operations until stepped (StepMode)', async ({ page }) => {
    const c = controls(page);

    // Make sure heap is empty then build a small heap
    await c.clearBtn().click();
    await c.listInput().fill('3,6,2');
    await c.buildBtn().click();
    await expect(c.opsInfo()).toHaveText(/Built from array/i, { timeout: 5000 });

    // Enable step mode
    await c.stepBtn().click();
    await expect(c.stepBtn()).toHaveText(/Step: ON/);

    // Make a visual operation that will produce steps (insert)
    await c.valueInput().fill('8');
    await c.insertBtn().click();

    // When in step mode, opsInfo should eventually show 'Waiting for Next Step...'
    // The exact timing depends on internal steps; give a generous timeout
    await page.waitForFunction(() => {
      const ops = document.getElementById('opsInfo');
      return ops && /Waiting for Next Step/.test(ops.textContent);
    }, { timeout: 5000 });

    // Now click the step button to release the pending step (acts also as Next)
    await c.stepBtn().click();

    // After releasing, opsInfo should change to reflect the insertion completed
    await expect(c.opsInfo()).toHaveText(/Inserted|Insert/, { timeout: 5000 });

    // Turn off step mode if still on
    const stepText = await c.stepBtn().textContent();
    if (/Step: ON/.test(stepText)) {
      await c.stepBtn().click();
    }

    expect(pageErrors.length).toBe(0);
  });

  test('ChangeHeapType toggles between Min and Max and resets heap (ChangeHeapType)', async ({ page }) => {
    const c = controls(page);

    // Change to Max heap via select
    await c.typeSel().selectOption('max');

    // Title/subtitle should update
    await expect(c.title()).toContainText('Max Heap Visualization');
    await expect(c.subtitle()).toContainText('largest');

    // Log should contain reset message
    const logText = await c.log().innerText();
    expect(logText).toContain('Heap reset to Max'.replace('Max', 'Max') || 'Heap reset');

    // Now switch back to Min
    await c.typeSel().selectOption('min');
    await expect(c.title()).toContainText('Min Heap Visualization');

    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: build with empty input and invalid list trigger alerts (error scenarios)', async ({ page }) => {
    const c = controls(page);

    // Build with empty input: should trigger alert prompting to paste list
    await c.listInput().fill('');
    await c.buildBtn().click();

    // Dialog messages captured in consoleMsgs should contain the validation alert
    const emptyListAlert = consoleMsgs.find(m => m.type === 'dialog' && /Please paste a comma-separated list/i.test(m.text));
    expect(emptyListAlert).toBeTruthy();

    // Build with invalid items should show alert too
    await c.listInput().fill('1, two, 3');
    await c.buildBtn().click();
    const invalidListAlert = consoleMsgs.find(m => m.type === 'dialog' && /Invalid list: ensure all items are numbers/i.test(m.text));
    expect(invalidListAlert).toBeTruthy();

    expect(pageErrors.length).toBe(0);
  });

  test('Clicking on array box triggers remove confirmation and removal when accepted (arrayView click removal)', async ({ page }) => {
    const c = controls(page);

    // Build a known list
    await c.listInput().fill('11,22,33');
    await c.buildBtn().click();
    await expect(c.opsInfo()).toHaveText(/Built from array/i, { timeout: 5000 });

    // Intercept confirm dialogs (remove element) by overriding window.confirm via dialog handling:
    // Since the page uses confirm(), Playwright treats confirm as dialog. We accept it in page.on('dialog').
    // Click on first box element (closest .box)
    const firstBox = c.arrayView().locator('.box').first();
    await firstBox.click();

    // Wait a little for removal to happen and log to update
    await page.waitForTimeout(200);

    // Log should indicate removal
    const logText = await c.log().innerText();
    expect(logText).toContain('Removed element at index');

    // Count should be reduced (initially 3 -> now 2)
    const count = await c.arrayView().locator('.box').count();
    expect(count).toBeLessThanOrEqual(2);

    expect(pageErrors.length).toBe(0);
  });

  test('Collect and assert there were no unexpected runtime errors in the page', async ({ page }) => {
    // Final sanity check: ensure there were no uncaught page errors recorded during tests
    expect(pageErrors.length).toBe(0);

    // Also verify we saw at least one 'Ready' log during initial load
    const foundReady = consoleMsgs.some(m => m.text && /Ready — select min or max and try operations/i.test(m.text));
    // If not found in console messages, also check inner text of log element on the page
    if (!foundReady) {
      const logContent = await page.locator('#log').innerText();
      expect(logContent).toContain('Ready');
    }
  });

});