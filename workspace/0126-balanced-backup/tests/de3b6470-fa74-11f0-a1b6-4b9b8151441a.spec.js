import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b6470-fa74-11f0-a1b6-4b9b8151441a.html';

// Helper to parse the array display text "[30, 20, 25]" => [30,20,25]
async function getArrayValues(page) {
  const text = await page.locator('#arrayDisplay').innerText();
  // text may be like "30, 20, 25" or with spaces; we expect the surrounding brackets removed by locator selection,
  // but the span itself contains "30, 20, 25" since the static text before is "Array representation: "
  // However the implementation sets arrayDisplay.textContent = `[${...}]`, so #arrayDisplay innerText will include the brackets.
  const matched = text.match(/\[([\d\s,]*)\]/);
  if (!matched) return [];
  const content = matched[1].trim();
  if (content === '') return [];
  return content.split(',').map(s => Number(s.trim()));
}

async function getHeapNodeTexts(page) {
  const nodes = page.locator('.heap-node');
  const count = await nodes.count();
  const texts = [];
  for (let i = 0; i < count; i++) {
    texts.push((await nodes.nth(i).innerText()).trim());
  }
  return texts;
}

test.describe('Max Heap Visualization (FSM) - de3b6470-fa74-11f0-a1b6-4b9b8151441a', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Ensure the main elements are present
    await expect(page.locator('h1')).toHaveText(/Max Heap Visualization/);
    await expect(page.locator('#arrayDisplay')).toBeVisible();
    await expect(page.locator('#heapContainer')).toBeVisible();
  });

  test.afterEach(async () => {
    // After each test, assert that no uncaught page errors occurred
    // and that there were no console errors indicating ReferenceError/SyntaxError/TypeError.
    // This validates that the page ran without unexpected runtime errors.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    if (pageErrors.length > 0) {
      // If there are page errors, fail with details
      throw new Error(`Uncaught page errors detected: ${pageErrors.map(e => e.message).join(' | ')}`);
    }
    if (consoleErrors.length > 0) {
      // Provide details of console errors for debugging
      throw new Error(`Console errors detected: ${consoleErrors.map(e => e.text).join(' | ')}`);
    }
  });

  test('Initial state S0_Idle renders initial heap and array (entry action renderHeap)', async ({ page }) => {
    // This validates the S0_Idle entry action renderHeap has run and the pre-populated heap is displayed.
    // Expected heap after initial sequence of inserts is [30,20,25,15,5,10]
    const values = await getArrayValues(page);
    expect(values).toEqual([30, 20, 25, 15, 5, 10]);

    // DOM should contain one node for each heap element
    const nodeTexts = await getHeapNodeTexts(page);
    expect(nodeTexts.length).toBe(values.length);
    // The root node should be the max value 30
    expect(nodeTexts[0]).toBe('30');
  });

  test('InsertValue event: inserting a larger value updates heap (S0 -> S1 and S1 -> S1)', async ({ page }) => {
    // This test validates insertion flow: input value -> click Insert -> heap updated and renderHeap called.
    const beforeValues = await getArrayValues(page);
    const beforeCount = beforeValues.length;

    // Insert a new value larger than current max to ensure it becomes root
    await page.fill('#insertValue', '40');
    await page.click('button[onclick="insertValue()"]');

    // After insertion, the input should be cleared
    expect(await page.locator('#insertValue').inputValue()).toBe('');

    // Array display should include the new value and count increased by 1
    const afterValues = await getArrayValues(page);
    expect(afterValues.length).toBe(beforeCount + 1);
    expect(afterValues).toContain(40);

    // New root should be 40 as it's the largest value
    const nodeTexts = await getHeapNodeTexts(page);
    expect(nodeTexts[0]).toBe('40');
  });

  test('ExtractMax event: extracts max and re-renders heap (S1 -> S1)', async ({ page }) => {
    // This validates extractMax() behavior and that renderHeap() updates the DOM accordingly.
    // Capture the current max from array display
    let values = await getArrayValues(page);
    expect(values.length).toBeGreaterThan(0);
    const currentMax = values[0];

    // Handle the alert dialog that shows extracted max
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="extractMax()"]')
    ]);
    expect(dialog.message()).toMatch(new RegExp(`Extracted max value: ${currentMax}`));
    await dialog.accept();

    // After accepting, heap should no longer contain the extracted max as its first element
    const afterValues = await getArrayValues(page);
    // If there was only one element, array should be empty
    if (values.length === 1) {
      expect(afterValues.length).toBe(0);
    } else {
      // Otherwise the first element should be <= previous max
      expect(afterValues.length).toBe(values.length - 1);
      if (afterValues.length > 0) {
        expect(afterValues[0]).toBeLessThanOrEqual(currentMax);
      }
    }

    // The number of .heap-node elements should reflect the removal
    const nodeTexts = await getHeapNodeTexts(page);
    expect(nodeTexts.length).toBe(afterValues.length);
  });

  test('ClearHeap event: clears the heap (S1 -> S0)', async ({ page }) => {
    // This validates clearHeap() empties the internal heap and renderHeap() clears the DOM.
    // Ensure there is something to clear
    const before = await getArrayValues(page);
    expect(before.length).toBeGreaterThanOrEqual(0);

    await page.click('button[onclick="clearHeap()"]');

    // After clearing, array display should show empty array
    const afterValues = await getArrayValues(page);
    expect(afterValues.length).toBe(0);

    // heap container should have no .heap-level children (or no .heap-node)
    const nodes = page.locator('.heap-node');
    await expect(nodes).toHaveCount(0);
  });

  test('GenerateRandomHeap event: generates random heap (S0 -> S1)', async ({ page }) => {
    // Ensure heap is cleared first to be in S0_Idle
    await page.click('button[onclick="clearHeap()"]');
    let values = await getArrayValues(page);
    expect(values.length).toBe(0);

    // Click Random Heap to generate a new heap (default size 10)
    await page.click('button[onclick="generateRandomHeap()"]');

    // After generation expect 10 values in the array display and 10 nodes rendered
    const generatedValues = await getArrayValues(page);
    expect(generatedValues.length).toBe(10);

    const nodeTexts = await getHeapNodeTexts(page);
    expect(nodeTexts.length).toBe(10);

    // Validate that each entry is a number between 1 and 100 (as implementation uses Math.random() * 100 + 1)
    for (const v of generatedValues) {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  test('Edge case: Insert with empty input does nothing', async ({ page }) => {
    // Validate that clicking Insert with empty input does not change the heap
    const beforeValues = await getArrayValues(page);
    await page.fill('#insertValue', ''); // ensure empty
    await page.click('button[onclick="insertValue()"]');

    const afterValues = await getArrayValues(page);
    expect(afterValues).toEqual(beforeValues);
  });

  test('Edge case: Extract from empty heap triggers "Heap is empty!" alert', async ({ page }) => {
    // Clear the heap to ensure it's empty
    await page.click('button[onclick="clearHeap()"]');
    const values = await getArrayValues(page);
    expect(values.length).toBe(0);

    // Click Extract Max and expect an alert saying 'Heap is empty!'
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="extractMax()"]')
    ]);
    expect(dialog.message()).toBe('Heap is empty!');
    await dialog.accept();
  });

  test('Visual structure: heap nodes have left/right classes when children exist', async ({ page }) => {
    // This tests that nodes that have children receive appropriate classes.
    // Use a relatively populated heap (initial state should be fine)
    const nodeLocator = page.locator('.heap-node');
    const count = await nodeLocator.count();
    expect(count).toBeGreaterThan(2); // ensure some nodes have children

    // For each node, check if it should have left/right based on its index in the array
    const values = await getArrayValues(page);
    for (let i = 0; i < values.length; i++) {
      const node = nodeLocator.nth(i);
      const leftIndex = 2 * i + 1;
      const rightIndex = 2 * i + 2;
      if (leftIndex < values.length) {
        await expect(node).toHaveClass(/left/);
      }
      if (rightIndex < values.length) {
        await expect(node).toHaveClass(/right/);
      }
    }
  });

  test('Console and runtime: no ReferenceError/SyntaxError/TypeError thrown during interactions', async ({ page }) => {
    // This test programmatically performs several interactions and asserts no runtime errors are emitted.
    // Interactions performed: insert, extract, random, clear
    await page.fill('#insertValue', '55');
    await page.click('button[onclick="insertValue()"]');

    const dialogPromise = page.waitForEvent('dialog');
    await page.click('button[onclick="extractMax()"]');
    const dialog = await dialogPromise;
    await dialog.accept();

    await page.click('button[onclick="generateRandomHeap()"]');
    await page.click('button[onclick="clearHeap()"]');

    // After interactions, ensure no uncaught page errors and no console errors
    const errors = pageErrors;
    expect(errors.length).toBe(0);

    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});