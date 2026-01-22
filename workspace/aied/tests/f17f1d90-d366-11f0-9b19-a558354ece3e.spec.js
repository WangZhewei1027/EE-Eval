import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f17f1d90-d366-11f0-9b19-a558354ece3e.html';

// Simple Page Object for the Arrays Demo page
class ArraysDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Element getters
  async arrayCreation() { return this.page.locator('#arrayCreation'); }
  async pushPopDemo() { return this.page.locator('#pushPopDemo'); }
  async shiftUnshiftDemo() { return this.page.locator('#shiftUnshiftDemo'); }
  async sliceSpliceDemo() { return this.page.locator('#sliceSpliceDemo'); }
  async iterationArray() { return this.page.locator('#iterationArray'); }
  async iterationResult() { return this.page.locator('#iterationResult'); }
  async multiDimensional() { return this.page.locator('#multiDimensional'); }

  // Button getters
  async btnShowArrayCreation() { return this.page.locator("button[onclick='demoArrayCreation()']"); }
  async btnPushItem() { return this.page.locator("button[onclick='pushItem()']"); }
  async btnPopItem() { return this.page.locator("button[onclick='popItem()']"); }
  async btnShiftItem() { return this.page.locator("button[onclick='shiftItem()']"); }
  async btnUnshiftItem() { return this.page.locator("button[onclick='unshiftItem()']"); }
  async btnDemoSlice() { return this.page.locator("button[onclick='demoSlice()']"); }
  async btnDemoSplice() { return this.page.locator("button[onclick='demoSplice()']"); }
  async btnForEach() { return this.page.locator("button[onclick='demoForEach()']"); }
  async btnMap() { return this.page.locator("button[onclick='demoMap()']"); }
  async btnFilter() { return this.page.locator("button[onclick='demoFilter()']"); }
  async btnReduce() { return this.page.locator("button[onclick='demoReduce()']"); }
  async btnShowMatrix() { return this.page.locator("button[onclick='demoMultiDimensional()']"); }

  // Helpers to parse display text "Current array: [a, b, c]"
  static parseArrayFromDisplay(text) {
    const match = text.match(/\[(.*)\]/);
    if (!match) return [];
    const inside = match[1].trim();
    if (inside === '') return [];
    return inside.split(',').map(s => s.trim());
  }
}

test.describe('JavaScript Arrays Demonstration - FSM Tests', () => {
  let page;
  let arraysPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Create a new page for each test to isolate state
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages and page errors for assertions later
    consoleMessages = [];
    pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push(msg);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    arraysPage = new ArraysDemoPage(page);

    // Navigate to the provided HTML file (do not modify the page)
    await page.goto(APP_URL);
    // Ensure the page has loaded initial UI
    await expect(page.locator('h1')).toHaveText('JavaScript Arrays Demonstration');
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors during the test run
    // (We observe and assert on console and page errors; the app may legitimately produce errors, but we will fail the test if any uncaught errors occurred)
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    // Provide helpful debugging if assertion fails by logging captured messages
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      console.log('Captured console errors:', consoleErrors.map(m => `${m.type()}: ${m.text()}`));
      console.log('Captured page errors:', pageErrors.map(e => e.toString()));
    }
    expect(consoleErrors.length, 'No console.error messages should occur').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should occur').toBe(0);

    await page.close();
  });

  test.describe('Idle state and initial UI', () => {
    test('renders expected controls and initial displays (S0_Idle)', async () => {
      // Validate the presence of all major buttons described in the FSM
      await expect(arraysPage.btnShowArrayCreation()).toBeVisible();
      await expect(arraysPage.btnPushItem()).toBeVisible();
      await expect(arraysPage.btnPopItem()).toBeVisible();
      await expect(arraysPage.btnShiftItem()).toBeVisible();
      await expect(arraysPage.btnUnshiftItem()).toBeVisible();
      await expect(arraysPage.btnDemoSlice()).toBeVisible();
      await expect(arraysPage.btnDemoSplice()).toBeVisible();
      await expect(arraysPage.btnForEach()).toBeVisible();
      await expect(arraysPage.btnMap()).toBeVisible();
      await expect(arraysPage.btnFilter()).toBeVisible();
      await expect(arraysPage.btnReduce()).toBeVisible();
      await expect(arraysPage.btnShowMatrix()).toBeVisible();

      // Validate initial displays reflect initial script initialization
      // push/pop and shift/unshift displays should start empty
      await expect(arraysPage.pushPopDemo()).toHaveText('Current array: []');
      await expect(arraysPage.shiftUnshiftDemo()).toHaveText('Current array: []');

      // iterationArray is rendered as a static display
      await expect(arraysPage.iterationArray()).toHaveText('[10, 20, 30, 40, 50]');

      // multi-dimensional display is initialized on page load (script calls demoMultiDimensional())
      const multiHTML = await arraysPage.multiDimensional().innerHTML();
      // Accept either trailing <br> or not - ensure rows exist
      expect(multiHTML).toContain('[1, 2, 3]');
      expect(multiHTML).toContain('[4, 5, 6]');
      expect(multiHTML).toContain('[7, 8, 9]');
    });
  });

  test.describe('Array creation demo (Transition S0 -> S1)', () => {
    test('Show Array Creation displays fruits and numbers', async () => {
      // Click the "Show Array Creation" button and assert the array creation output
      await arraysPage.btnShowArrayCreation().click();

      const content = await arraysPage.arrayCreation().innerHTML();
      expect(content).toContain('Fruits: [apple, banana, orange]');
      expect(content).toContain('Numbers: [1, 2, 3, 4, 5]');
    });
  });

  test.describe('Push/Pop interactions (S0 -> S2 -> S3)', () => {
    test('Push Item increases array and Pop Item decreases it', async () => {
      // Start with empty array
      await expect(arraysPage.pushPopDemo()).toHaveText('Current array: []');

      // Click push once
      await arraysPage.btnPushItem().click();
      let display = await arraysPage.pushPopDemo().textContent();
      expect(display).toMatch(/^Current array: \[(.+)\]$/);
      let items = ArraysDemoPage.parseArrayFromDisplay(display || '');
      expect(items.length).toBeGreaterThanOrEqual(1);

      // Click push again (S2_ItemPushed -> S2_ItemPushed)
      await arraysPage.btnPushItem().click();
      display = await arraysPage.pushPopDemo().textContent();
      items = ArraysDemoPage.parseArrayFromDisplay(display || '');
      expect(items.length).toBeGreaterThanOrEqual(2);

      // Click pop once (transition to S3_ItemPopped)
      await arraysPage.btnPopItem().click();
      display = await arraysPage.pushPopDemo().textContent();
      items = ArraysDemoPage.parseArrayFromDisplay(display || '');
      // After popping, length should be one less than previous (>=1)
      expect(items.length).toBeGreaterThanOrEqual(1);

      // Pop until empty to test pop edge case
      // Keep popping until array shows empty or until 10 attempts to avoid infinite loops
      for (let i = 0; i < 10; i++) {
        display = await arraysPage.pushPopDemo().textContent();
        items = ArraysDemoPage.parseArrayFromDisplay(display || '');
        if (items.length === 0) break;
        await arraysPage.btnPopItem().click();
      }
      display = await arraysPage.pushPopDemo().textContent();
      expect(ArraysDemoPage.parseArrayFromDisplay(display || '').length).toBe(0);

      // Pop when empty should do nothing and not throw
      await arraysPage.btnPopItem().click();
      display = await arraysPage.pushPopDemo().textContent();
      expect(display).toBe('Current array: []');
    });
  });

  test.describe('Shift/Unshift interactions (S0 -> S5 / S4)', () => {
    test('Unshift adds items to front and Shift removes from front; handle empty shift', async () => {
      // Initially empty
      await expect(arraysPage.shiftUnshiftDemo()).toHaveText('Current array: []');

      // Shift on empty should do nothing
      await arraysPage.btnShiftItem().click();
      await expect(arraysPage.shiftUnshiftDemo()).toHaveText('Current array: []');

      // Unshift once
      await arraysPage.btnUnshiftItem().click();
      let display = await arraysPage.shiftUnshiftDemo().textContent();
      let items = ArraysDemoPage.parseArrayFromDisplay(display || '');
      expect(items.length).toBeGreaterThanOrEqual(1);

      // Unshift again, should increase length
      await arraysPage.btnUnshiftItem().click();
      display = await arraysPage.shiftUnshiftDemo().textContent();
      items = ArraysDemoPage.parseArrayFromDisplay(display || '');
      expect(items.length).toBeGreaterThanOrEqual(2);

      // Shift removes from front
      await arraysPage.btnShiftItem().click();
      display = await arraysPage.shiftUnshiftDemo().textContent();
      items = ArraysDemoPage.parseArrayFromDisplay(display || '');
      // After one shift, length should decrease (>=1)
      expect(items.length).toBeGreaterThanOrEqual(1);

      // Remove all to test repeated shift behavior
      for (let i = 0; i < 10; i++) {
        display = await arraysPage.shiftUnshiftDemo().textContent();
        items = ArraysDemoPage.parseArrayFromDisplay(display || '');
        if (items.length === 0) break;
        await arraysPage.btnShiftItem().click();
      }
      display = await arraysPage.shiftUnshiftDemo().textContent();
      expect(ArraysDemoPage.parseArrayFromDisplay(display || '').length).toBe(0);
    });
  });

  test.describe('Slice and Splice demos (S0 -> S6 / S7)', () => {
    test('Slice shows original and sliced portion; Splice removes item and updates array', async () => {
      // Ensure the sliceSplice array is in its initial expected state
      // The page's initial div shows "Current array: [1, 2, 3, 4, 5]"
      await expect(arraysPage.sliceSpliceDemo()).toHaveText('Current array: [1, 2, 3, 4, 5]');

      // Slice (transition to S6_Sliced)
      await arraysPage.btnDemoSlice().click();
      let sliceHTML = await arraysPage.sliceSpliceDemo().innerHTML();
      // Expect both original and slice output present
      expect(sliceHTML).toContain('Original: [1, 2, 3, 4, 5]');
      expect(sliceHTML).toContain('Slice(1,4): [2, 3, 4]');

      // Splice (transition to S7_Spliced) - this mutates sliceSpliceArray
      await arraysPage.btnDemoSplice().click();
      let spliceHTML = await arraysPage.sliceSpliceDemo().innerHTML();
      // The removed item should be 3 and the new array should be [1, 2, 4, 5]
      expect(spliceHTML).toContain('Removed item: 3');
      expect(spliceHTML).toContain('New array: [1, 2, 4, 5]');
    });
  });

  test.describe('Iteration methods (S0 -> S8)', () => {
    test('forEach prints indexes and values', async () => {
      // Clear iterationResult then run forEach
      await arraysPage.btnForEach().click();
      const result = await arraysPage.iterationResult().innerHTML();
      expect(result).toContain('Index 0: 10');
      expect(result).toContain('Index 1: 20');
      expect(result).toContain('Index 2: 30');
      expect(result).toContain('Index 3: 40');
      expect(result).toContain('Index 4: 50');
    });

    test('map shows doubled values', async () => {
      await arraysPage.btnMap().click();
      const result = await arraysPage.iterationResult().innerHTML();
      expect(result).toContain('Original: [10, 20, 30, 40, 50]');
      expect(result).toContain('Mapped (doubled): [20, 40, 60, 80, 100]');
    });

    test('filter shows filtered values > 25', async () => {
      await arraysPage.btnFilter().click();
      const result = await arraysPage.iterationResult().innerHTML();
      expect(result).toContain('Original: [10, 20, 30, 40, 50]');
      expect(result).toContain('Filtered (>25): [30, 40, 50]');
    });

    test('reduce computes the sum correctly', async () => {
      await arraysPage.btnReduce().click();
      const result = await arraysPage.iterationResult().innerHTML();
      expect(result).toContain('Array: [10, 20, 30, 40, 50]');
      expect(result).toContain('Sum: 150');
    });
  });

  test.describe('Multi-dimensional array (S0 -> S9)', () => {
    test('Show Matrix displays 3x3 matrix', async () => {
      // Although demoMultiDimensional is called at init, validate button also re-renders correctly
      // Click the button to ensure event handler works
      await arraysPage.btnShowMatrix().click();
      const html = await arraysPage.multiDimensional().innerHTML();
      // Validate rows are present
      expect(html).toContain('[1, 2, 3]');
      expect(html).toContain('[4, 5, 6]');
      expect(html).toContain('[7, 8, 9]');
    });
  });

  test.describe('Edge cases and error observation', () => {
    test('No unexpected ReferenceError/SyntaxError/TypeError in console or page errors', async () => {
      // This test intentionally inspects captured console messages and page errors.
      // The beforeEach/afterEach already collects them and afterEach fails if any exist.
      // Here we also assert there are zero console.error messages explicitly.
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Additionally, assert that calling demonstration functions in rapid succession does not raise exceptions
      // (simulate rapid clicks across several controls)
      await Promise.all([
        arraysPage.btnPushItem().click(),
        arraysPage.btnUnshiftItem().click(),
        arraysPage.btnDemoSlice().click(),
        arraysPage.btnForEach().click(),
        arraysPage.btnShowMatrix().click()
      ]);

      // Give a short moment for any async errors to surface
      await page.waitForTimeout(200);

      const consoleErrorsAfter = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrorsAfter.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});