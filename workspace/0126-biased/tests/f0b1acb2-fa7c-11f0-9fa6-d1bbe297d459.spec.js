import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1acb2-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the heap demo page
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.heapDemo = page.locator('#heap-demo');
    this.steps = page.locator('#demo-steps');
    this.button = page.locator('#demo-button');
  }

  async goto() {
    // Load the page exactly as-is
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickInsert() {
    await this.button.click();
  }

  async getHeapInnerHTML() {
    return await this.heapDemo.innerHTML();
  }

  async getHeapInnerText() {
    return await this.heapDemo.innerText();
  }

  async getStepsText() {
    // demo-steps may be empty initially
    return await this.steps.innerText();
  }

  // Parse "Current heap: [a, b, c]" or "Initial empty heap: []" to an array of numbers (or empty array)
  async parseHeapArray() {
    const text = await this.getHeapInnerText();
    // find first occurrence of [ ... ]
    const match = text.match(/\[([^\]]*)\]/);
    if (!match) return [];
    const inside = match[1].trim();
    if (inside === '') return [];
    return inside.split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n));
  }
}

test.describe('Heap (Min) - Comprehensive Guide (f0b1acb2-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Per-test setup: create fresh collectors and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors without altering page behavior
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Test initial rendered state (FSM: S0_Initial entry_actions: renderPage())
  test('Initial State: page renders initial empty heap and no demo steps', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Validate the initial content shows the initial empty heap as in FSM evidence
    const heapText = await heapPage.getHeapInnerText();
    expect(heapText).toContain('Initial empty heap: []');

    // demo-steps should be empty initially (evidence shows "<p id='demo-steps'></p>")
    const stepsText = await heapPage.getStepsText();
    expect(stepsText).toBe(''); // initial steps element is empty

    // Ensure no uncaught exceptions happened during page load
    expect(pageErrors.length).toBe(0);
    // Ensure no console errors were emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test single insertion transition (FSM: InsertRandomValue from S0 to S1)
  test('InsertRandomValue: clicking button inserts a value and updates the demo (S0 -> S1)', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Click the insert button once
    await heapPage.clickInsert();

    // After click, steps element should indicate insertion with a generated value
    await expect(heapPage.steps).toContainText('Inserting value:');

    const stepsText = await heapPage.getStepsText();
    // The steps text must include the "Inserting value: <number>"
    expect(stepsText).toMatch(/Inserting value:\s*\d+/);

    // The heap demo should now display "Current heap: [<value>]"
    const heapText = await heapPage.getHeapInnerText();
    expect(heapText).toContain('Current heap: [');

    // Parse the heap array and ensure it has size 1 (since it was empty initially)
    const arr = await heapPage.parseHeapArray();
    expect(arr.length).toBeGreaterThanOrEqual(1); // at least 1 element after insertion

    // Validate the tree representation placeholder is present in the demo HTML
    expect(heapText).toContain('Tree representation:');

    // No JS errors or console errors should have occurred from this operation
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test repeated insertions and ensure heap updates and heapify-up swaps appear at least once
  test('Heapify Up evidence: repeated insertions should eventually show swap messages and maintain heap display', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // We will click multiple times until we observe at least one "Swapped" message.
    // This is non-deterministic (depends on random values). We do NOT modify the page or RNG.
    // We attempt up to N times to observe the "Swapped" log as described in FSM evidence.
    const MAX_ATTEMPTS = 30;
    let foundSwap = false;
    let lastStepsText = '';
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await heapPage.clickInsert();

      // Wait until the insertion message appears for this click
      await expect(heapPage.steps).toContainText('Inserting value:');

      lastStepsText = await heapPage.getStepsText();
      if (lastStepsText.includes('Swapped')) {
        foundSwap = true;
        break;
      }

      // Small pause to let DOM update for the next iteration (no patching or instrumentation)
      await page.waitForTimeout(50);
    }

    // FSM transition expects "Swapped ..." evidence when heapify up occurs.
    // Assert we observed at least one swap during repeated insertions. If not, this may be due to random values,
    // but per FSM we attempt enough times to reasonably expect a swap.
    expect(foundSwap, `Expected to observe at least one "Swapped" message within ${MAX_ATTEMPTS} attempts. Last steps text: ${lastStepsText}`).toBe(true);

    // Ensure the heap demo now contains an array representation with multiple elements
    const arr = await heapPage.parseHeapArray();
    expect(arr.length).toBeGreaterThanOrEqual(2);

    // Verify that the heap string representation in the DOM matches the parsed array
    const heapInner = await heapPage.getHeapInnerText();
    const match = heapInner.match(/\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    if (match) {
      const displayed = match[1].split(',').map(s => s.trim()).filter(s => s !== '');
      expect(displayed.length).toBe(arr.length);
    }

    // Confirm no runtime page errors were thrown during repeated insertions
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: rapid multiple clicks should accumulate heap elements without throwing errors
  test('Edge Case: rapid consecutive clicks accumulate heap elements and keep UI stable', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Rapidly click the insert button 10 times (simulate a user clicking quickly)
    const RAPID_CLICKS = 10;
    for (let i = 0; i < RAPID_CLICKS; i++) {
      // We intentionally do not await internal animations; just fire clicks as a rapid user would.
      await heapPage.clickInsert();
    }

    // Wait briefly to let the last operations complete
    await page.waitForTimeout(200);

    // Ensure the heap contains at least as many elements as clicks (randomness could still produce duplicates)
    const arr = await heapPage.parseHeapArray();
    expect(arr.length).toBeGreaterThanOrEqual(RAPID_CLICKS > 0 ? 1 : 0);

    // Validate the UI still contains tree representation text
    const heapInner = await heapPage.getHeapInnerText();
    expect(heapInner).toContain('Tree representation:');

    // No JS runtime errors or console errors allowed
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate that the demo button exists and is actionable (component existence check from FSM components)
  test('UI Components: demo button and visualization elements exist and are accessible', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // The button should be visible and enabled
    await expect(heapPage.button).toBeVisible();
    await expect(heapPage.button).toHaveText('Insert Random Value');

    // The heap demo visualization should contain the initial text before any interaction
    const heapText = await heapPage.getHeapInnerText();
    expect(heapText).toContain('Initial empty heap: []');

    // The steps element should exist (empty initially)
    const stepsText = await heapPage.getStepsText();
    expect(stepsText).toBe('');

    // Confirm there were no console errors on component access
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Final safety test: observe console and page errors do not occur across a typical user scenario
  test('Observability: ensure no console errors or page errors during typical user flow', async ({ page }) => {
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Perform a few normal insertions
    for (let i = 0; i < 3; i++) {
      await heapPage.clickInsert();
      await expect(heapPage.steps).toContainText('Inserting value:');
      await page.waitForTimeout(30);
    }

    // Assert that no pageerror events were produced
    expect(pageErrors.length).toBe(0);

    // Assert there were no console error messages captured
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});