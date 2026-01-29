import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b3bb1-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the heap app controls
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.minBtn = page.locator('#min-btn');
    this.maxBtn = page.locator('#max-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.sizeInput = page.locator('#size-input');
    this.dataInput = page.locator('#data-input');
    this.addBtn = page.locator('#add-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.dataContainer = page.locator('#data-container');
    this.outputContainer = page.locator('#output-container');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getWindowValue(name) {
    return this.page.evaluate((n) => {
      // Access global var safely
      // eslint-disable-next-line no-undef
      return window[n];
    }, name);
  }
}

test.describe('Heap (Min) interactive application - FSM validation', () => {
  let heapPage;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect page errors so tests can assert on them
    pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console errors as well for additional evidence
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        pageErrors.push(new Error(`Console:${msg.text()}`));
      }
    });

    heapPage = new HeapPage(page);
    await heapPage.goto();
  });

  test.afterEach(async () => {
    // no-op teardown placeholder (page is torn down by Playwright)
  });

  test.describe('Idle state (S0_Idle) - initial presence and defaults', () => {
    test('should render all controls and default values', async () => {
      // Validate existence of controls as evidence for Idle state
      await expect(heapPage.minBtn).toBeVisible();
      await expect(heapPage.maxBtn).toBeVisible();
      await expect(heapPage.resetBtn).toBeVisible();
      await expect(heapPage.sizeInput).toBeVisible();
      await expect(heapPage.dataInput).toBeVisible();
      await expect(heapPage.addBtn).toBeVisible();
      await expect(heapPage.clearBtn).toBeVisible();

      // Default size input value should be 5 as per HTML
      const sizeVal = await heapPage.sizeInput.inputValue();
      expect(sizeVal).toBe('5');

      // Data and output containers start empty
      await expect(heapPage.dataContainer).toBeEmpty();
      await expect(heapPage.outputContainer).toBeEmpty();

      // No page errors should have occurred simply from loading the page
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Heap initialization transitions (S1_MinHeapInitialized, S2_MaxHeapInitialized)', () => {
    test('MinHeapStart: clicking Min should attempt to create MinHeap and produce a ReferenceError', async () => {
      // Clicking min-btn is expected to call new MinHeap(size) which is not defined in the page,
      // so a ReferenceError should be emitted naturally.
      await heapPage.minBtn.click();

      // Allow microtasks / event listeners to run
      await heapPage.page.waitForTimeout(50);

      // There should be at least one page error and it should indicate MinHeap is not defined
      expect(pageErrors.length).toBeGreaterThan(0);
      const hasMinHeapRefError = pageErrors.some(err =>
        /MinHeap/.test(err.message) && /not|undefined|is not defined/i.test(err.message)
      );
      expect(hasMinHeapRefError).toBe(true);

      // Because the handler threw at new MinHeap(size), subsequent assignments (like disabling buttons)
      // should not have executed. The script defined let heap = null initially, so heap should remain null.
      const heapValue = await heapPage.getWindowValue('heap');
      expect(heapValue).toBe(null);

      // addBtn and clearBtn were not set by the handler (handler would set them after constructing),
      // so they remain in their initial enabled state (not disabled).
      await expect(heapPage.addBtn).toBeEnabled();
      await expect(heapPage.clearBtn).toBeEnabled();
    });

    test('MaxHeapStart: clicking Max should attempt to create MaxHeap and produce a ReferenceError', async () => {
      // Clicking max-btn should call new MaxHeap(size) -> ReferenceError expected.
      await heapPage.maxBtn.click();
      await heapPage.page.waitForTimeout(50);

      expect(pageErrors.length).toBeGreaterThan(0);
      const hasMaxHeapRefError = pageErrors.some(err =>
        /MaxHeap/.test(err.message) && /not|undefined|is not defined/i.test(err.message)
      );
      expect(hasMaxHeapRefError).toBe(true);

      // heap should be untouched (initially null)
      const heapValue = await heapPage.getWindowValue('heap');
      expect(heapValue).toBe(null);

      // Handler attempted to set addBtn.disabled = false and clearBtn.disabled = false after constructing heap.
      // Because construction failed, expected no change (stays enabled).
      await expect(heapPage.addBtn).toBeEnabled();
      await expect(heapPage.clearBtn).toBeEnabled();
    });
  });

  test.describe('Data input and size input events (SizeInputChange, DataInputChange)', () => {
    test('SizeInputChange: changing the size input updates window.size with parsed integer', async () => {
      // Change size input to a valid number and trigger input event
      await heapPage.sizeInput.fill('10');
      await heapPage.sizeInput.dispatchEvent('input');

      // Allow event handler to run
      await heapPage.page.waitForTimeout(20);

      // No errors expected for valid numeric input
      const sizeErrs = pageErrors.filter(e => /MinHeap|MaxHeap|JSON|SyntaxError/.test(e.message));
      expect(sizeErrs.length).toBe(0);

      // Verify global size variable updated
      const sizeVal = await heapPage.getWindowValue('size');
      expect(sizeVal).toBe(10);
    });

    test('DataInputChange: valid JSON in data-input should update window.data', async () => {
      // Provide a valid JSON array string
      await heapPage.dataInput.fill('[1,2,3]');
      await heapPage.dataInput.dispatchEvent('input');

      await heapPage.page.waitForTimeout(20);

      // No errors expected for valid JSON
      const hasSyntaxError = pageErrors.some(e => e instanceof Error && /Unexpected token|JSON/.test(e.message));
      expect(hasSyntaxError).toBe(false);

      // The page's data variable should reflect the parsed array
      const dataVal = await heapPage.getWindowValue('data');
      expect(Array.isArray(dataVal)).toBe(true);
      expect(dataVal).toEqual([1, 2, 3]);
    });

    test('DataInputChange: invalid JSON should produce a SyntaxError', async () => {
      // Provide invalid JSON (common user mistake)
      await heapPage.dataInput.fill('1,2,3'); // not valid JSON
      await heapPage.dataInput.dispatchEvent('input');

      // Wait for handler and error propagation
      await heapPage.page.waitForTimeout(50);

      // Expect a SyntaxError / JSON parse error was emitted to page errors
      const hasSyntaxErr = pageErrors.some(err =>
        /Unexpected token|JSON/.test(err.message) || /SyntaxError/.test(err.name)
      );
      expect(hasSyntaxErr).toBe(true);

      // The global data should remain as whatever it was previously (likely from page initialization or prior test).
      // We assert it's not an array parsed from invalid input. If previous state was array it may remain unchanged.
      // Here, just ensure the page did not silently set data to some malformed value by checking that it is defined.
      const dataVal = await heapPage.getWindowValue('data');
      expect(dataVal !== undefined).toBe(true);
    });
  });

  test.describe('Add and Clear operations (S3_DataAdded, S4_DataCleared)', () => {
    test('AddData: clicking Add should attempt new MinHeap => ReferenceError and should NOT mutate data when error occurs', async () => {
      // Ensure data-input has comma-separated numbers (the code expects CSV)
      await heapPage.dataInput.fill('4,5,6');

      // Capture current data snapshot before clicking add
      const beforeData = await heapPage.getWindowValue('data');

      // Click Add - the handler will call new MinHeap(size) first (ReferenceError expected),
      // so subsequent data.push shouldn't execute.
      await heapPage.addBtn.click();
      await heapPage.page.waitForTimeout(50);

      // Verify that a ReferenceError referencing MinHeap occurred
      const hasRefErr = pageErrors.some(err =>
        /MinHeap/.test(err.message) && /not|undefined|is not defined/i.test(err.message)
      );
      expect(hasRefErr).toBe(true);

      // Because the first line threw, data should be unchanged from before
      const afterData = await heapPage.getWindowValue('data');
      expect(afterData).toEqual(beforeData);

      // The handler would have set addBtn.disabled = true if it had run fully.
      // Since it threw, the button should remain enabled.
      await expect(heapPage.addBtn).toBeEnabled();

      // Output container update listener might still have run; but because output array was empty,
      // output container should be unaffected or empty string. Assert it's a string (no crash).
      const outputHtml = await heapPage.outputContainer.innerHTML();
      expect(typeof outputHtml).toBe('string');
    });

    test('ClearData: clicking Clear should attempt new MinHeap => ReferenceError and should NOT clear data when error occurs', async () => {
      // Start by setting a known data value via valid JSON input
      await heapPage.dataInput.fill('[9]');
      await heapPage.dataInput.dispatchEvent('input');
      await heapPage.page.waitForTimeout(20);

      const beforeData = await heapPage.getWindowValue('data');
      expect(beforeData).toEqual([9]);

      // Click Clear - expected to call new MinHeap(size) first and throw
      await heapPage.clearBtn.click();
      await heapPage.page.waitForTimeout(50);

      // Expect a ReferenceError for MinHeap (because new MinHeap is used in clear handler)
      const hasClearRefErr = pageErrors.some(err =>
        /MinHeap/.test(err.message) && /not|undefined|is not defined/i.test(err.message)
      );
      expect(hasClearRefErr).toBe(true);

      // Because handler threw early, data should remain unchanged (not cleared)
      const afterData = await heapPage.getWindowValue('data');
      expect(afterData).toEqual(beforeData);

      // clearBtn disabled state would have been set in handler; since it didn't complete, expect it remains enabled
      await expect(heapPage.clearBtn).toBeEnabled();
    });
  });

  test.describe('Edge cases and combined interactions', () => {
    test('Sequence: change size, set valid JSON data, click Min then Add - expect MinHeap ReferenceError but global variables preserved', async () => {
      // Change size to 7
      await heapPage.sizeInput.fill('7');
      await heapPage.sizeInput.dispatchEvent('input');
      await heapPage.page.waitForTimeout(20);
      const sizeVal = await heapPage.getWindowValue('size');
      expect(sizeVal).toBe(7);

      // Set valid JSON data
      await heapPage.dataInput.fill('[10,20]');
      await heapPage.dataInput.dispatchEvent('input');
      await heapPage.page.waitForTimeout(20);
      let dataVal = await heapPage.getWindowValue('data');
      expect(dataVal).toEqual([10, 20]);

      // Click Min (initialization) - expect ReferenceError for MinHeap
      await heapPage.minBtn.click();
      await heapPage.page.waitForTimeout(50);

      const hasMinErr = pageErrors.some(err => /MinHeap/.test(err.message));
      expect(hasMinErr).toBe(true);

      // Now click Add - because MinHeap is still undefined, Add handler will throw again.
      await heapPage.addBtn.click();
      await heapPage.page.waitForTimeout(50);

      const addErr = pageErrors.some(err => /MinHeap/.test(err.message));
      expect(addErr).toBe(true);

      // Ensure global data remains the same (the add handler's data.push should not have executed due to the early throw)
      dataVal = await heapPage.getWindowValue('data');
      expect(dataVal).toEqual([10, 20]);

      // heap variable should still be null as construction failed
      const heapVal = await heapPage.getWindowValue('heap');
      expect(heapVal).toBe(null);
    });

    test('Robustness: rapid invalid JSON typing should produce at least one SyntaxError without crashing the page', async () => {
      // Rapidly type invalid JSON fragments to trigger input handler repeatedly
      await heapPage.dataInput.fill('[');
      await heapPage.dataInput.dispatchEvent('input');
      await heapPage.page.waitForTimeout(5);
      await heapPage.dataInput.fill('[1,');
      await heapPage.dataInput.dispatchEvent('input');
      await heapPage.page.waitForTimeout(5);
      await heapPage.dataInput.fill('[1,2');
      await heapPage.dataInput.dispatchEvent('input');
      await heapPage.page.waitForTimeout(50);

      // Expect that at least one SyntaxError / JSON parse error was emitted
      const syntaxErrorOccurred = pageErrors.some(err =>
        /Unexpected token|JSON|SyntaxError/.test(err.message) || /SyntaxError/.test(err.name)
      );
      expect(syntaxErrorOccurred).toBe(true);

      // The application should still be responsive: controls still visible and clickable
      await expect(heapPage.minBtn).toBeVisible();
      await expect(heapPage.addBtn).toBeVisible();
      await expect(heapPage.clearBtn).toBeVisible();
    });
  });
});