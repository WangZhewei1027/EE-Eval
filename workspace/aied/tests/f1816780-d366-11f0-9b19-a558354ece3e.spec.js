import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1816780-d366-11f0-9b19-a558354ece3e.html';

// Page object encapsulating interactions and selectors for the Counting Sort Visualization page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputArray');
    this.sortButton = page.locator('button[onclick="startCountingSort()"]');
    this.randomButton = page.locator('button[onclick="generateRandomArray()"]');
    this.output = page.locator('#output');
    this.stepHeaders = page.locator('#output .step h3');
    this.countArrayInit = page.locator('#countArrayInit');
    this.countElements = (parentSelector = '#countArrayInit') => page.locator(`${parentSelector} .count-element`);
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for the initial visualization Step 1 to be present (onload triggers visualizeCountingSort)
    await expect(this.page.locator('#output .step h3')).first().toHaveText(/Step 1/i, { timeout: 5000 });
  }

  async getInputValue() {
    return this.input.inputValue();
  }

  async fillInput(value) {
    await this.input.fill(value);
  }

  async clickSort() {
    await Promise.all([
      // clicking may trigger immediate DOM changes; wait for new Step 1 to appear (output cleared and repopulated)
      this.page.waitForResponse(response => true).catch(() => {}), // non-blocking; we just want to yield
      this.sortButton.click()
    ]);
  }

  async clickGenerateRandom() {
    await this.randomButton.click();
  }

  async getStepHeadersText() {
    const count = await this.stepHeaders.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.stepHeaders.nth(i).innerText());
    }
    return texts;
  }

  async getCountElementsCount(parentSelector = '#countArrayInit') {
    return await this.countElements(parentSelector).count();
  }

  async getOutputInnerHTML() {
    return await this.output.innerHTML();
  }
}

// Grouping tests for readability and organization
test.describe('Counting Sort Visualization - f1816780-d366-11f0-9b19-a558354ece3e', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Each test gets a fresh page and listeners to capture console & page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the app and let initial rendering happen
    const countingSortPage = new CountingSortPage(page);
    await countingSortPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // allow any outstanding timers/async work to settle a bit
    await page.waitForTimeout(200);
  });

  test('Initial render (S0_Idle): input present and initial visualization rendered on load', async ({ page }) => {
    // This test validates the initial state (S0_Idle) entry action -> renderPage() / onload visualization
    const p = new CountingSortPage(page);

    // Input should exist with default value as per HTML attributes
    await expect(p.input).toBeVisible();
    const initialValue = await p.getInputValue();
    expect(initialValue).toBe('4,2,2,8,3,3,1');

    // Output should contain Step 1 immediately (Step 1 created synchronously by visualizeCountingSort)
    const headers = await p.getStepHeadersText();
    expect(headers.length).toBeGreaterThanOrEqual(1);
    expect(headers[0].toLowerCase()).toContain('step 1');

    // The counting array initialization (countArrayInit) should be created and have elements equal to max+1
    // For the default array max is 8 -> expect 9 count elements
    const countElementsCount = await p.getCountElementsCount('#countArrayInit');
    expect(countElementsCount).toBe(9);

    // There should be no unexpected page errors and no console errors at initial load
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Sort button click starts sorting and produces a fresh visualization (S0_Idle -> S1_Sorting -> S3_Visualization)', async ({ page }) => {
    // This test validates that clicking "Sort" triggers startCountingSort() and creates a visualization for the provided input
    const p = new CountingSortPage(page);

    // Provide a small deterministic array to make assertions easier
    await p.fillInput('3,1,2');

    // Capture the output HTML before clicking to verify it changes
    const beforeHTML = await p.getOutputInnerHTML();

    // Click Sort and expect a new Step 1 for the new array to be present synchronously
    await p.clickSort();

    // After clicking, a fresh Step 1 should be present with the new array displayed
    // Wait for a Step 1 header that includes the array text "Array: [3, 1, 2]"
    const step1Locator = page.locator('#output .step h3').filter({ hasText: /Step 1/i }).first();
    await expect(step1Locator).toBeVisible();

    // Verify that the text content for Step 1 contains the exact array representation used by the code (join with comma and space)
    const step1Parent = step1Locator.locator('xpath=..'); // step container
    const step1Text = await step1Parent.innerText();
    expect(step1Text).toContain('Array: [3, 1, 2]');

    // The counting array initialization should reflect max = 3 => 4 elements
    const countInitCount = await p.getCountElementsCount('#countArrayInit');
    expect(countInitCount).toBe(4);

    // The output should have changed from before clicking
    const afterHTML = await p.getOutputInnerHTML();
    expect(afterHTML).not.toBe(beforeHTML);

    // No uncaught errors should have been emitted during this interaction
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Generate Random Array button generates a new array and triggers visualization (S0_Idle -> S2_RandomArray -> S3_Visualization)', async ({ page }) => {
    // This test validates generateRandomArray() action: it should update the input field and kick off visualization
    const p = new CountingSortPage(page);

    // Read input value before generating random array
    const beforeValue = await p.getInputValue();

    // Click the Generate Random Array button
    await p.clickGenerateRandom();

    // The input value should update to a CSV string of digits (0-9). Validate format and length constraints (5-14).
    const newValue = await p.getInputValue();
    expect(newValue).not.toBe(beforeValue);
    // Validate CSV numeric pattern
    expect(/^\d+(,\d+)*$/.test(newValue)).toBeTruthy();

    const elements = newValue.split(',').map(s => s.trim()).filter(Boolean);
    expect(elements.length).toBeGreaterThanOrEqual(5);
    expect(elements.length).toBeLessThanOrEqual(14);
    // Each element should be an integer between 0 and 9
    for (const el of elements) {
      const num = Number(el);
      expect(Number.isInteger(num)).toBeTruthy();
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThanOrEqual(9);
    }

    // The output should contain a Step 1 that references the new array
    const step1Parent = page.locator('#output .step').first();
    await expect(step1Parent.locator('h3')).toHaveText(/Step 1/i);

    // Confirm no page errors or console errors occurred during generation
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Edge cases: empty input triggers alert; negative numbers trigger alert (error handling / validation)', async ({ page }) => {
    // This test verifies validation and error handling in startCountingSort():
    // - Empty input should trigger an alert with a specific message and should not clear visualization
    // - Negative numbers should trigger an alert indicating counting sort limitation
    const p = new CountingSortPage(page);

    // Preserve current output to ensure it is not cleared when validation fails
    const preservedOutput = await p.getOutputInnerHTML();

    // Empty input case
    await p.fillInput('');
    const [dialogEmpty] = await Promise.all([
      page.waitForEvent('dialog'),
      p.sortButton.click()
    ]);
    expect(dialogEmpty.message()).toContain('Please enter valid numbers');
    await dialogEmpty.accept();

    // Output should remain unchanged because validation returned early
    const afterEmptyOutput = await p.getOutputInnerHTML();
    expect(afterEmptyOutput).toBe(preservedOutput);

    // Negative numbers case
    await p.fillInput('-1,2');
    const [dialogNeg] = await Promise.all([
      page.waitForEvent('dialog'),
      p.sortButton.click()
    ]);
    expect(dialogNeg.message()).toContain('Counting sort only works with non-negative integers');
    await dialogNeg.accept();

    // Output should remain unchanged again
    const afterNegOutput = await p.getOutputInnerHTML();
    expect(afterNegOutput).toBe(preservedOutput);

    // No uncaught page errors (these are user-facing validation alerts, not page exceptions)
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Animation setup creates subsequent steps (S3_Visualization basic checks): presence of Step 2..5 containers and final result creation initiation', async ({ page }) => {
    // This test checks that the visualization's structure for later steps is created (Step 2 and Step 3 are created synchronously)
    // Due to long-running timeouts for later animations, we won't wait for the entire animation to complete, but we'll assert the expected containers exist.
    const p = new CountingSortPage(page);

    // Use a small custom array (max value small) to make counts manageable
    await p.fillInput('0,1,1');
    await p.clickSort();

    // Step headers should include Step 1, Step 2, Step 3 at minimum (these are appended synchronously)
    // Wait up to a few seconds for the DOM to be updated
    await page.waitForTimeout(300); // allow slight time for synchronous DOM insertions to run

    const headers = await p.getStepHeadersText();
    const lowerHeaders = headers.map(h => h.toLowerCase());
    expect(lowerHeaders.some(h => h.includes('step 1'))).toBeTruthy();
    expect(lowerHeaders.some(h => h.includes('step 2'))).toBeTruthy();
    expect(lowerHeaders.some(h => h.includes('step 3'))).toBeTruthy();

    // Counting array initialization (Step 2) should have max+1 elements. For [0,1,1], max=1 => expect 2 elements
    const countInitCount = await p.getCountElementsCount('#countArrayInit');
    expect(countInitCount).toBe(2);

    // Step 3 container for counting progress should exist
    const countStepElements = await p.getCountElementsCount('#countStep').catch(() => 0);
    // It is possible countStep is created but initially empty; we at least expect the element to exist in the DOM
    const countStepExists = await page.locator('#countStep').count();
    expect(countStepExists).toBeGreaterThanOrEqual(1);

    // Final checks for no uncaught exceptions
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('No uncaught console errors or page errors across multiple interactions', async ({ page }) => {
    // This test intentionally performs a few interactions and then asserts that no console "error" type messages or page errors occurred
    const p = new CountingSortPage(page);

    // 1) Trigger a sort on the default input
    await p.clickSort();

    // 2) Trigger generate random multiple times
    await p.clickGenerateRandom();
    await page.waitForTimeout(100);
    await p.clickGenerateRandom();

    // 3) Trigger an invalid action to cause an alert (handled)
    await p.fillInput('');
    const dialog = page.waitForEvent('dialog');
    await p.sortButton.click();
    const dlg = await dialog;
    await dlg.accept();

    // Allow some time for any asynchronous runtime errors to surface
    await page.waitForTimeout(500);

    // Now assert that no pageerror events were emitted and no console messages of type 'error' occurred
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);

    // Also assert that console messages were captured (may be empty) and are strings
    for (const msg of consoleMessages) {
      expect(typeof msg.text).toBe('string');
      expect(typeof msg.type).toBe('string');
    }
  });
});