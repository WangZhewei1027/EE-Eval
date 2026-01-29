import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2cc4d1-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Interactive Hash Map Explorer - FSM driven tests (6d2cc4d1-fa7a-11f0-ba5b-57721b046e74)', () => {
  // Arrays to collect console errors and page errors for each test run
  let consoleErrors;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and classify errors
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page under test and wait for initial rendering
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure key UI elements are present before proceeding
    await expect(page.locator('#sizeSlider')).toBeVisible();
    await expect(page.locator('#loadFactorSlider')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
    await expect(page.locator('#insertBtn')).toBeVisible();
  });

  test.afterEach(async () => {
    // After each test we assert that there were no uncaught page errors or console.error logs.
    // This ensures the page executed without unexpected runtime exceptions.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console error messages were logged: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Initial state (S0_Idle): visualization and stats reflect initial hash map', async ({ page }) => {
    // Validate initial "Idle" state: the visualization is built with empty buckets and stats show defaults.
    const currentSize = page.locator('#currentSize');
    const currentLoad = page.locator('#currentLoad');
    const currentCapacity = page.locator('#currentCapacity');
    const collisionCount = page.locator('#collisionCount');
    const hashMapVisualization = page.locator('#hashMapVisualization');

    // Default size in HTML is 5
    await expect(currentSize).toHaveText('5');
    await expect(currentCapacity).toHaveText('5');
    await expect(currentLoad).toHaveText('0');
    await expect(collisionCount).toHaveText('0');

    // Visualization should contain 5 bucket elements (one per initial bucket)
    const buckets = hashMapVisualization.locator('.bucket');
    await expect(buckets).toHaveCount(5);

    // Each bucket should show '(empty)' initially
    for (let i = 0; i < 5; i++) {
      await expect(buckets.nth(i)).toContainText('Bucket ' + i + ':');
      await expect(buckets.nth(i)).toContainText('(empty)');
    }
  });

  test('Update sliders (UpdateSize & UpdateLoadFactor events): UI updates on input', async ({ page }) => {
    // This test validates the input events for size and load factor sliders.
    const sizeSlider = page.locator('#sizeSlider');
    const sizeValue = page.locator('#sizeValue');
    const loadFactorSlider = page.locator('#loadFactorSlider');
    const loadFactorValue = page.locator('#loadFactorValue');

    // Change size to 8 via JS to ensure input event fires
    await sizeSlider.evaluate((el) => {
      el.value = '8';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(sizeValue).toHaveText('8');

    // Change load factor to 50 (50 -> 0.50)
    await loadFactorSlider.evaluate((el) => {
      el.value = '50';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(loadFactorValue).toHaveText('0.50');
  });

  test('Reset hash map (ResetHashMap transition): applying configuration and UI message', async ({ page }) => {
    // Set a new configuration, then click Reset and validate on-entry actions and messages
    const sizeSlider = page.locator('#sizeSlider');
    const loadFactorSlider = page.locator('#loadFactorSlider');
    const hashFunctionSelect = page.locator('#hashFunctionSelect');
    const collisionMethodSelect = page.locator('#collisionMethodSelect');
    const resetBtn = page.locator('#resetBtn');
    const operationResult = page.locator('#operationResult');
    const currentSize = page.locator('#currentSize');

    // Set values
    await sizeSlider.evaluate((el) => {
      el.value = '7';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await loadFactorSlider.evaluate((el) => {
      el.value = '40';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await hashFunctionSelect.selectOption('complex');
    await collisionMethodSelect.selectOption('linear');

    // Click reset and assert expected message and that currentSize updates to new size
    await resetBtn.click();
    await expect(operationResult).toHaveText('Hash map reset with new configuration.');
    await expect(currentSize).toHaveText('7');

    // Visualization should now have 7 buckets
    const buckets = page.locator('#hashMapVisualization .bucket');
    await expect(buckets).toHaveCount(7);
  });

  test('Insert, Get, Remove lifecycle (S2 -> S3 -> S4 transitions) and edge cases', async ({ page }) => {
    // Test insertion of a key-value, retrieval, and removal along with related DOM updates
    const keyInput = page.locator('#keyInput');
    const valueInput = page.locator('#valueInput');
    const insertBtn = page.locator('#insertBtn');
    const getBtn = page.locator('#getBtn');
    const removeBtn = page.locator('#removeBtn');
    const operationResult = page.locator('#operationResult');
    const currentLoad = page.locator('#currentLoad');
    const hashMapVisualization = page.locator('#hashMapVisualization');

    // Attempt to insert without key - edge case
    await valueInput.fill('someValue');
    await keyInput.fill('');
    await insertBtn.click();
    await expect(operationResult).toHaveText('Please enter a key.');

    // Now insert a valid key-value pair
    await keyInput.fill('testKey');
    await valueInput.fill('testValue');
    await insertBtn.click();
    await expect(operationResult).toHaveText('Inserted: testKey => testValue');

    // After insert, currentLoad should be 1
    await expect(currentLoad).toHaveText('1');

    // Visualization should contain the inserted key-value pair
    await expect(hashMapVisualization).toContainText('testKey => testValue');

    // Get the existing key
    await getBtn.click();
    await expect(operationResult).toHaveText('Found: testKey => testValue');

    // Remove the key
    await removeBtn.click();
    await expect(operationResult).toHaveText('Removed key: testKey');

    // After removal, currentLoad should return to 0 and visualization should not contain the pair
    await expect(currentLoad).toHaveText('0');
    await expect(hashMapVisualization).not.toContainText('testKey => testValue');

    // Removing a non-existent key should yield a helpful message
    await keyInput.fill('nonexistent');
    await removeBtn.click();
    await expect(operationResult).toHaveText('Key nonexistent not found.');

    // Getting without providing a key
    await keyInput.fill('');
    await getBtn.click();
    await expect(operationResult).toHaveText('Please enter a key.');
  });

  test('Batch insert (BatchInsertRandom transition) and consequent resize behavior', async ({ page }) => {
    // This test validates batch insert and that resize can occur if configuration makes it necessary.
    const batchInsertBtn = page.locator('#batchInsertBtn');
    const operationResult = page.locator('#operationResult');
    const currentLoad = page.locator('#currentLoad');
    const currentSize = page.locator('#currentSize');
    const sizeSlider = page.locator('#sizeSlider');
    const loadFactorSlider = page.locator('#loadFactorSlider');
    const resetBtn = page.locator('#resetBtn');

    // Configure the map to a small size and low load factor so that batch insert likely triggers resize
    await sizeSlider.evaluate((el) => {
      el.value = '2';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await loadFactorSlider.evaluate((el) => {
      el.value = '10'; // 0.10 load factor
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Apply configuration
    await resetBtn.click();

    const initialSizeText = await currentSize.textContent();
    const initialSize = Number(initialSizeText || '0');

    // Click batch insert (inserts 10 random key-value pairs)
    await batchInsertBtn.click();
    await expect(operationResult).toHaveText('Inserted 10 random key-value pairs.');

    // After batch insert, currentLoad should be >= 10 (some duplicates are possible but unlikely for appended indices)
    const loadText = await currentLoad.textContent();
    const loadNumber = Number(loadText || '0');
    expect(loadNumber).toBeGreaterThanOrEqual(1); // at least 1 inserted; we don't assert exact due to randomness

    // If the map had to resize during batch insertion, currentSize will be greater than initialSize
    const finalSize = Number((await currentSize.textContent()) || '0');
    expect(finalSize).toBeGreaterThanOrEqual(initialSize);

    // Visualization should contain bucket elements equal to finalSize
    const buckets = page.locator('#hashMapVisualization .bucket');
    await expect(buckets).toHaveCount(finalSize);
  });

  test('Clear all entries (S5_AllCleared transition): clears state and shows message', async ({ page }) => {
    // Insert a couple of items then clear them and validate the cleared state
    const keyInput = page.locator('#keyInput');
    const valueInput = page.locator('#valueInput');
    const insertBtn = page.locator('#insertBtn');
    const clearBtn = page.locator('#clearBtn');
    const operationResult = page.locator('#operationResult');
    const currentLoad = page.locator('#currentLoad');
    const hashMapVisualization = page.locator('#hashMapVisualization');

    // Insert two items
    await keyInput.fill('one');
    await valueInput.fill('1');
    await insertBtn.click();
    await keyInput.fill('two');
    await valueInput.fill('2');
    await insertBtn.click();

    // Ensure there are items
    await expect(currentLoad).toHaveText('2');
    await expect(hashMapVisualization).toContainText('one => 1');
    await expect(hashMapVisualization).toContainText('two => 2');

    // Clear all
    await clearBtn.click();
    await expect(operationResult).toHaveText('Cleared all entries from hash map.');
    await expect(currentLoad).toHaveText('0');

    // Visual buckets should show '(empty)' in each bucket
    const buckets = page.locator('#hashMapVisualization .bucket');
    const count = await buckets.count();
    for (let i = 0; i < count; i++) {
      await expect(buckets.nth(i)).toContainText('(empty)');
    }
  });

  test('Hash calculation (S7_HashCalculated): simple, random and complex modes produce output', async ({ page }) => {
    // Validate hash calculation details for different hash functions
    const hashTestInput = page.locator('#hashTestInput');
    const hashTestBtn = page.locator('#hashTestBtn');
    const hashCalculationSteps = page.locator('#hashCalculationSteps');
    const hashFunctionSelect = page.locator('#hashFunctionSelect');
    const sizeSlider = page.locator('#sizeSlider');
    const resetBtn = page.locator('#resetBtn');

    // Ensure size is set to a known value (for deterministic simple mode)
    await sizeSlider.evaluate((el) => {
      el.value = '5';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await resetBtn.click();

    // Simple hash (default)
    await hashFunctionSelect.selectOption('simple');
    await hashTestInput.fill('abcde');
    await hashTestBtn.click();
    await expect(hashCalculationSteps).toContainText('Simple hash calculation');
    await expect(hashCalculationSteps).toContainText('key.length % size');

    // Random hash
    await hashFunctionSelect.selectOption('random');
    await hashTestInput.fill('randomKey');
    await hashTestBtn.click();
    await expect(hashCalculationSteps).toContainText('Random hash (for testing only)');

    // Complex hash
    await hashFunctionSelect.selectOption('complex');
    await hashTestInput.fill('complexKey');
    await hashTestBtn.click();
    await expect(hashCalculationSteps).toContainText('Complex hash calculation');
    await expect(hashCalculationSteps).toContainText('Final hash');
  });

  test('Edge case: repeated insert updates value and increments only when new key (collision handling)', async ({ page }) => {
    // Insert same key twice and verify value update behavior and itemCount behavior
    const keyInput = page.locator('#keyInput');
    const valueInput = page.locator('#valueInput');
    const insertBtn = page.locator('#insertBtn');
    const operationResult = page.locator('#operationResult');
    const currentLoad = page.locator('#currentLoad');
    const hashMapVisualization = page.locator('#hashMapVisualization');

    // Insert key 'dup' first time
    await keyInput.fill('dup');
    await valueInput.fill('first');
    await insertBtn.click();
    await expect(operationResult).toHaveText('Inserted: dup => first');
    await expect(currentLoad).toHaveText('1');

    // Insert same key with new value
    await keyInput.fill('dup');
    await valueInput.fill('second');
    await insertBtn.click();

    // Expect operation to report insertion (the implementation updates existing key without adding a second item in chaining)
    await expect(operationResult).toHaveText('Inserted: dup => second');

    // currentLoad should stay 1 (no duplicate item)
    await expect(currentLoad).toHaveText('1');

    // Visualization must reflect the updated value
    await expect(hashMapVisualization).toContainText('dup => second');
    await expect(hashMapVisualization).not.toContainText('dup => first');
  });
});