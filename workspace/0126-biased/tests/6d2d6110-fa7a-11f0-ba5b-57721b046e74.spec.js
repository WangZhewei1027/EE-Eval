import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d6110-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object encapsulating interactions with the Max Heap demo
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertBtn = page.locator('#insert-btn');
    this.manualInsertBtn = page.locator('#manual-insert-btn');
    this.extractMaxBtn = page.locator('#extract-max-btn');
    this.heapifyBtn = page.locator('#heapify-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.insertValueInput = page.locator('#insert-value');
    this.heapArrayDiv = page.locator('#heap-array');
    this.explanation = page.locator('#explanation');
    this.heapVisualization = page.locator('#heap-visualization');
    this.heapSizeSlider = page.locator('#heap-size-slider');
    this.heapSizeValue = page.locator('#heap-size-value');
    this.speedSlider = page.locator('#speed-slider');
    this.speedValue = page.locator('#speed-value');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure initial render has happened
    await expect(this.explanation).toContainText('Current Operation');
  }

  async clickInsertRandom() {
    await this.insertBtn.click();
  }

  async manualInsert(value) {
    // set value and trigger insert
    await this.insertValueInput.fill(String(value));
    await this.manualInsertBtn.click();
  }

  async clickExtractMax() {
    await this.extractMaxBtn.click();
  }

  async clickHeapify() {
    await this.heapifyBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async setHeapSize(value) {
    // set range input value and dispatch input event
    await this.page.evaluate((v) => {
      const el = document.getElementById('heap-size-slider');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async setSpeed(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed-slider');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async heapArrayText() {
    return (await this.heapArrayDiv.textContent())?.trim() ?? '';
  }

  async explanationText() {
    // explanation contains heading and <p>; fetch the <p> text to inspect current operation message
    return this.page.locator('#explanation p').textContent();
  }

  async heapNodeCount() {
    return await this.page.locator('.heap-node').count();
  }

  async firstNodeIsMax() {
    const first = this.page.locator('.heap-node').first();
    return await first.getAttribute('class').then(cls => cls && cls.split(' ').includes('max'));
  }

  // Wait until the explanation paragraph contains one of the completion phrases
  async waitForOperationComplete(timeout = 5000) {
    const finalPatterns = [
      /Insertion complete/i,
      /Extracted max value/i,
      /Heap built successfully/i,
      /Heap is now empty/i,
      /Heap cleared/i,
      /Heap property restored/i,
      /now in the heap/i
    ];
    const p = this.page.locator('#explanation p');

    await this.page.waitForFunction(
      (selector, patterns) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const text = el.textContent || '';
        return patterns.some((r) => new RegExp(r, 'i').test(text));
      },
      '#explanation p',
      finalPatterns.map(r => r.source),
      { timeout }
    );
    return p.textContent();
  }
}

test.describe('Interactive Max Heap - FSM state/transition tests', () => {
  // Capture console errors and page errors for each test to assert runtime stability.
  test.beforeEach(async ({ page }) => {
    // no-op here; listeners are attached per test to ensure isolation
  });

  test('Initial Idle state renders correctly (S0_Idle)', async ({ page }) => {
    // Validate the initial idle state: explanation text and empty heap rendering
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Explanation should show initial guidance text
    const explanationText = await heap.explanationText();
    expect(explanationText).toContain('No operation in progress');

    // Heap array should be empty
    expect(await heap.heapArrayText()).toBe('[]');

    // No heap nodes rendered (only the "Heap is empty" paragraph)
    expect(await heap.heapNodeCount()).toBe(0);

    // Ensure no runtime console or page errors occurred during load
    expect(consoleErrors.length, `console errors: ${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.join('\n')}`).toBe(0);
  });

  test('Insert Random transitions: Idle -> Inserting -> Idle (S0 -> S1 -> S0)', async ({ page }) => {
    // This test validates Insert Random event triggers insertion, shows inserting explanation,
    // and completes resulting in the heap updated and final explanation.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Speed up animations to keep tests fast
    await heap.setSpeed(100);

    // Click Insert Random and wait for completion
    await heap.clickInsertRandom();

    const final = await heap.waitForOperationComplete(8000);
    expect(final).toMatch(/Insertion complete|now in the heap/i);

    // Heap array should not be empty now
    const arrText = await heap.heapArrayText();
    expect(arrText).not.toBe('[]');

    // Root node should exist and have class 'max'
    expect(await heap.heapNodeCount()).toBeGreaterThan(0);
    expect(await heap.firstNodeIsMax()).toBe(true);

    // No console/page errors
    expect(consoleErrors.length, `console errors: ${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.join('\n')}`).toBe(0);
  });

  test('Manual Insert transitions and invalid input edge case (S0 -> S1 -> S0)', async ({ page }) => {
    // Validate manual insert with a specific value, then validate that invalid/manual blank input does nothing.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Ensure heap is empty
    expect(await heap.heapArrayText()).toBe('[]');

    // Insert a known value 42
    await heap.manualInsert(42);
    const final = await heap.waitForOperationComplete(8000);
    expect(final).toMatch(/Insertion complete|now in the heap/i);

    // Heap array should contain 42
    const arrText = await heap.heapArrayText();
    expect(arrText).toContain('42');

    // Edge case: clear insert value input and click manual insert - should be ignored gracefully
    await page.locator('#insert-value').fill(''); // blank value -> parseInt yields NaN in app code
    await page.locator('#manual-insert-btn').click();

    // Wait a short moment to allow any (non-existent) operation to start
    await page.waitForTimeout(300);
    // Explanation should still contain the last completed message (no new error-based explanation)
    const explanationText = await heap.explanationText();
    expect(explanationText).toMatch(/Insertion complete|now in the heap/i);

    // Heap array unchanged (still contains 42)
    expect(await heap.heapArrayText()).toContain('42');

    // No console/page errors
    expect(consoleErrors.length, `console errors: ${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.join('\n')}`).toBe(0);
  });

  test('Extract Max transitions: S0 -> S2_ExtractingMax -> S0', async ({ page }) => {
    // Validate extracting the maximum value removes the max and completes correctly.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();
    await heap.setSpeed(100);

    // Insert two known values so we control the max
    await heap.manualInsert(10);
    await heap.waitForOperationComplete(8000);
    await heap.manualInsert(20);
    await heap.waitForOperationComplete(8000);

    // Confirm array contains both values and max 20
    let arrText = await heap.heapArrayText();
    expect(arrText).toContain('10');
    expect(arrText).toContain('20');

    // Extract max
    await heap.clickExtractMax();

    // Wait for extraction completion which contains "Extracted max value" or "Heap is now empty"
    const final = await heap.waitForOperationComplete(10000);
    expect(final).toMatch(/Extracted max value|Heap is now empty|Heap property restored/i);

    // After extraction, 20 should no longer be the root; heap-array length should be reduced or root changed
    const afterText = await heap.heapArrayText();
    // If only one element remained and was removed, array will be []
    // Otherwise it shouldn't contain 20 at index 0 necessarily, so at minimum it should not equal previous exact string
    expect(afterText).not.toBe(arrText); // some change must have occurred

    // No console/page errors
    expect(consoleErrors.length, `console errors: ${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.join('\n')}`).toBe(0);
  });

  test('Heapify Array transitions: S0 -> S3_Heapifying -> S0', async ({ page }) => {
    // Validate heapify builds a heap from an array of random values and completes.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Set heap size to 5 and trigger heapify
    await heap.setHeapSize(5);
    // confirm UI updated
    expect(await heap.heapSizeValue.textContent()).toBe('5');

    // Speed up animations to avoid long waits
    await heap.setSpeed(100);

    await heap.clickHeapify();

    // Wait for heap built completion
    const final = await heap.waitForOperationComplete(20000);
    expect(final).toMatch(/Heap built successfully|Max heap property satisfied/i);

    // Heap array should have 5 elements
    const arrText = await heap.heapArrayText();
    // extract numbers from string like [a, b, c]
    const numbers = arrText.replace(/[\[\]\s]/g, '').split(',').filter(Boolean);
    expect(numbers.length).toBe(5);

    // There should be rendered nodes
    expect(await heap.heapNodeCount()).toBeGreaterThan(0);

    // No console/page errors
    expect(consoleErrors.length, `console errors: ${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.join('\n')}`).toBe(0);
  });

  test('Clear Heap transitions: S0 -> S4_Clearing -> S0', async ({ page }) => {
    // Validate clearing the heap empties the array and updates explanation.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Insert to ensure heap is non-empty
    await heap.manualInsert(7);
    await heap.waitForOperationComplete(8000);
    expect((await heap.heapArrayText()).length).toBeGreaterThan(2); // not '[]'

    // Click clear
    await heap.clickClear();

    // Explanation should be 'Heap cleared.'
    await page.waitForFunction(() => {
      const p = document.querySelector('#explanation p');
      return p && /Heap cleared/i.test(p.textContent || '');
    }, { timeout: 3000 });

    expect(await heap.heapArrayText()).toBe('[]');

    // No console/page errors
    expect(consoleErrors.length, `console errors: ${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.join('\n')}`).toBe(0);
  });

  test('Heap size and speed sliders update UI and do not cause runtime errors', async ({ page }) => {
    // Validate the sliders update the displayed values and do not cause console errors.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Change heap size to 8
    await heap.setHeapSize(8);
    expect(await heap.heapSizeValue.textContent()).toBe('8');

    // Change speed to 1500ms and verify label updated
    await heap.setSpeed(1500);
    expect(await heap.speedValue.textContent()).toBe('1500ms');

    // Changing speed should not throw errors and allows subsequent operations; test by inserting
    await heap.clickInsertRandom();
    const final = await heap.waitForOperationComplete(15000);
    expect(final).toMatch(/Insertion complete|now in the heap/i);

    // No console/page errors
    expect(consoleErrors.length, `console errors: ${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.join('\n')}`).toBe(0);
  });

  test('Edge case: Extract Max when heap empty leaves state unchanged and no errors', async ({ page }) => {
    // Ensure clicking extract on empty heap does not cause errors nor change explanation
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const heap = new HeapPage(page);
    await heap.goto();

    // Confirm initial explanation
    const initial = await heap.explanationText();

    // Click extract on empty heap
    await heap.clickExtractMax();

    // Wait briefly and confirm explanation unchanged
    await page.waitForTimeout(300);
    const after = await heap.explanationText();
    expect(after).toBe(initial);

    // No console/page errors
    expect(consoleErrors.length, `console errors: ${consoleErrors.join('\n')}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.join('\n')}`).toBe(0);
  });
});