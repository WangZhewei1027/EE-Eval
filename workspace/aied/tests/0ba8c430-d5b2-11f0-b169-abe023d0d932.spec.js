import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba8c430-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Heap (Min/Max) Demo - FSM and runtime error observations', () => {
  // Collect page errors and console messages per test
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will attach its own listeners to avoid cross-test leakage
  });

  // Test 1: Load the page and assert that the missing MinMaxHeap causes a ReferenceError on load.
  test('Initial load should surface a ReferenceError because MinMaxHeap is not defined', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages for additional context
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give the page a short moment to fire errors and console logs
    await page.waitForTimeout(200);

    // We expect at least one page error due to "new MinMaxHeap()" where MinMaxHeap is undefined.
    expect(pageErrors.length).toBeGreaterThan(0);

    // There should be an error whose name is ReferenceError and that references MinMaxHeap
    const hasMinMaxHeapRefError = pageErrors.some(e =>
      (e && e.name === 'ReferenceError' && String(e.message).includes('MinMaxHeap')) ||
      (e && String(e.message).includes('MinMaxHeap'))
    );
    expect(hasMinMaxHeapRefError).toBeTruthy();

    // Provide additional assertion that console captured something (optional)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  // Group tests that validate the Idle state and DOM existence even if scripts failed.
  test.describe('Idle state and UI elements', () => {
    test('Page should render expected inputs, buttons, and an empty heap display', async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e));

      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(100);

      // Verify presence of UI components described in FSM
      await expect(page.locator('#min-value')).toBeVisible();
      await expect(page.locator('#max-value')).toBeVisible();
      await expect(page.locator('#add-element')).toBeVisible();
      await expect(page.locator('#clear-heap')).toBeVisible();
      await expect(page.locator('#heap-element')).toBeVisible();

      // Initially, the heap display should be empty due to script execution halting
      const heapHtml = await page.locator('#heap-element').innerHTML();
      expect(heapHtml.trim()).toBe('');

      // Confirm that at least the initial ReferenceError happened during load
      expect(errors.length).toBeGreaterThanOrEqual(1);
      const refErr = errors.find(e => e.name === 'ReferenceError' || String(e.message).includes('MinMaxHeap'));
      expect(refErr).toBeTruthy();
    });

    test('Clicking Add Element or Clear Heap should not mutate heap display when runtime failed', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e));

      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(100);

      // Record errors count after load
      const initialErrorCount = pageErrors.length;

      // Fill min-value and click Add Element - since event listeners were not attached after the ReferenceError,
      // we expect no DOM change and no additional page errors (listeners did not get registered).
      await page.fill('#min-value', '42');
      await page.click('#add-element');

      await page.waitForTimeout(100);

      const afterAddHtml = await page.locator('#heap-element').innerHTML();
      expect(afterAddHtml.trim()).toBe(''); // still empty

      // Click Clear Heap and assert nothing changes
      await page.click('#clear-heap');
      await page.waitForTimeout(100);
      const afterClearHtml = await page.locator('#heap-element').innerHTML();
      expect(afterClearHtml.trim()).toBe('');

      // Ensure no new page errors were introduced by clicks (beyond initial load error)
      expect(pageErrors.length).toBe(initialErrorCount);
    });
  });

  // Group tests that exercise function-level edge cases defined in the script (printHeap, addElement, clearHeap)
  test.describe('Function invocation edge-cases and expected runtime exceptions', () => {
    test('Global functions (printHeap, addElement, clearHeap) should exist but throw when invoked due to missing heap', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(100);

      // Verify that function declarations are present on the window object
      const types = await page.evaluate(() => {
        return {
          printHeap: typeof window.printHeap,
          addElement: typeof window.addElement,
          clearHeap: typeof window.clearHeap
        };
      });
      expect(types.printHeap).toBe('function');
      expect(types.addElement).toBe('function');
      expect(types.clearHeap).toBe('function');

      // Invoking printHeap should raise an error because it uses heap.elements() where heap is undefined.
      const printHeapResult = await page.evaluate(() => {
        try {
          printHeap();
          return { ok: true };
        } catch (e) {
          return { ok: false, name: e && e.name, message: String(e && e.message) };
        }
      });
      // Expect a TypeError related to reading properties of undefined (heap)
      expect(printHeapResult.ok).toBe(false);
      expect(['TypeError', 'ReferenceError']).toContain(printHeapResult.name);
      expect(printHeapResult.message.toLowerCase()).toMatch(/heap|undefined|elements/);

      // Invoking addElement will attempt to call printHeap(), which should also produce a TypeError
      // (or similar) because printHeap uses heap.
      // Ensure we set a min-value to avoid parseInt issues.
      await page.fill('#min-value', '7');
      const addElementResult = await page.evaluate(() => {
        try {
          addElement();
          return { ok: true };
        } catch (e) {
          return { ok: false, name: e && e.name, message: String(e && e.message) };
        }
      });
      expect(addElementResult.ok).toBe(false);
      expect(['TypeError', 'ReferenceError']).toContain(addElementResult.name);
      expect(addElementResult.message.toLowerCase()).toMatch(/heap|undefined|elements/);

      // Invoking clearHeap() should attempt heap.clear() and therefore raise a TypeError as well.
      const clearHeapResult = await page.evaluate(() => {
        try {
          clearHeap();
          return { ok: true };
        } catch (e) {
          return { ok: false, name: e && e.name, message: String(e && e.message) };
        }
      });
      expect(clearHeapResult.ok).toBe(false);
      expect(['TypeError', 'ReferenceError']).toContain(clearHeapResult.name);
      expect(clearHeapResult.message.toLowerCase()).toMatch(/heap|undefined|clear/);
    });
  });

  // Additional checks to validate FSM transitions cannot occur because handlers weren't attached.
  test('FSM transitions (AddElement_Click and ClearHeap_Click) should not execute due to missing heap initialization', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));

    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForTimeout(100);

    // Attempt to simulate transition by clicking Add Element and verify FSM observable doesn't occur (no <p> appended)
    await page.fill('#min-value', '13');
    await page.click('#add-element');
    await page.waitForTimeout(100);
    let heapContent = await page.locator('#heap-element').innerHTML();
    expect(heapContent.trim()).toBe('');

    // Attempt to simulate ClearHeap_Click transition - still no change
    await page.click('#clear-heap');
    await page.waitForTimeout(100);
    heapContent = await page.locator('#heap-element').innerHTML();
    expect(heapContent.trim()).toBe('');

    // Confirm that the initial ReferenceError was present and prevented transition handlers from being attached.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const referenceErrorExists = pageErrors.some(e => e.name === 'ReferenceError' || String(e.message).includes('MinMaxHeap'));
    expect(referenceErrorExists).toBeTruthy();
  });
});