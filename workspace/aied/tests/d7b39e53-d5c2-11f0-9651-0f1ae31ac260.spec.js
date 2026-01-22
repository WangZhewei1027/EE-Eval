import { test, expect } from '@playwright/test';

// Test URL (served HTML)
const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b39e53-d5c2-11f0-9651-0f1ae31ac260.html';

// Utility helpers (page object pattern)
class RadixPage {
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.inputArray = page.locator('#inputArray');
    this.speedRange = page.locator('#speedRange');
    this.speedValue = page.locator('#speedValue');
    this.status = page.locator('#status');
    this.arrayContainer = page.locator('#arrayContainer');
    this.bucketsContainer = page.locator('#bucketsContainer');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setSpeed(value) {
    // Set range value and dispatch input event so the page updates animationDelay and speedValue
    await this.page.evaluate((val) => {
      const r = document.getElementById('speedRange');
      r.value = String(val);
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async readArrayElementsText() {
    return await this.page.locator('#arrayContainer .arrayElement').allTextContents();
  }

  async readBucketContents(bucketIndex) {
    const selector = `#bucket-${bucketIndex} .bucketElements .arrayElement`;
    return await this.page.locator(selector).allTextContents();
  }

  async setInputArray(value) {
    await this.inputArray.fill(value);
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }
}

// Group tests logically
test.describe('Radix Sort Visualization - FSM and UI behavior', () => {
  // Increase timeout for sorting flows to be robust on CI
  test.slow();

  // Each test will attach listeners to capture console and page errors.
  test('Initial Idle state: page renders expected components and no runtime errors on load', async ({ page }) => {
    // Collect console and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new RadixPage(page);
    await app.goto();

    // Validate core components are present and in the Idle expected state
    await expect(app.startBtn).toBeVisible();
    await expect(app.startBtn).toBeEnabled();
    await expect(app.inputArray).toHaveValue('170,45,75,90,802,24,2,66'); // default value per HTML
    await expect(app.status).toHaveText(''); // Idle state's status should be empty
    await expect(app.arrayContainer).toBeEmpty();
    await expect(app.bucketsContainer).toBeEmpty();
    await expect(app.speedValue).toHaveText('600 ms'); // default displayed speed

    // Ensure no uncaught page errors or console errors during initial load
    expect(pageErrors.length, `pageErrors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `consoleErrors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('StartSorting transition: clicking Start populates array, updates status on enter and exit actions, and sorts the array', async ({ page }) => {
    // Monitor console and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new RadixPage(page);
    await app.goto();

    // Speed up animation to keep test time reasonable
    await app.setSpeed(100);
    await expect(app.speedValue).toHaveText('100 ms');

    // Validate Idle -> Sorting: click start
    await expect(app.startBtn).toBeEnabled();
    const clickPromise = app.clickStart();

    // Immediately after click, per implementation startBtn is disabled while sorting
    await expect(app.startBtn).toBeDisabled();

    // The sorting function sets status to "Starting Radix Sort." at entry, so wait for that
    await expect(app.status).toHaveText('Starting Radix Sort.');

    // arrayContainer should be populated shortly after sort starts
    await page.waitForSelector('#arrayContainer .arrayElement');

    // Wait for sorting to complete. Final status should be "Sorting complete!"
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Sorting complete!');
    }, { timeout: 30000 });

    // After sorting completes, start button should be re-enabled
    await expect(app.startBtn).toBeEnabled();

    // Verify final sorted array content matches expected ascending sort (original default array)
    const finalArrayTexts = await app.readArrayElementsText();
    // The algorithm sorts numeric values; map to numbers for comparison
    const finalNums = finalArrayTexts.map(t => Number(t));
    expect(finalNums).toEqual([2, 24, 45, 66, 75, 90, 170, 802]);

    // Verify that buckets container is empty after completion (the implementation clears buckets)
    await expect(app.bucketsContainer).toBeEmpty();

    // Ensure entry/exit actions reflected in status text per FSM (entry was "Starting Radix Sort.", exit "Sorting complete!")
    const statusText = await app.status.textContent();
    expect(statusText).toContain('Sorting complete!');

    // No uncaught runtime errors during sorting
    expect(pageErrors.length, `pageErrors during sorting: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `consoleErrors during sorting: ${JSON.stringify(consoleErrors)}`).toBe(0);
  }, 30000); // extended timeout for this test

  test('AdjustSpeed transition: changing the speed range updates displayed speedValue (during idle and during sorting)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new RadixPage(page);
    await app.goto();

    // Adjust while idle
    await app.setSpeed(400);
    await expect(app.speedValue).toHaveText('400 ms');

    // Start sorting with a slightly longer animationDelay so we have time to adjust while sorting
    await app.setSpeed(500);
    await expect(app.speedValue).toHaveText('500 ms');

    // Begin sorting
    const dialogPromises = []; // not expecting dialogs for this input
    const dialogHandler = (dialog) => {
      dialogPromises.push(dialog.message());
      dialog.accept();
    };
    page.on('dialog', dialogHandler);

    await app.clickStart();
    await expect(app.startBtn).toBeDisabled();
    await expect(app.status).toHaveText('Starting Radix Sort.');

    // Wait briefly to ensure sorting is underway; then change speed
    await page.waitForTimeout(150); // small pause; sorting has async delays so this should fall between steps
    await app.setSpeed(1000);
    // speedValue should reflect the new speed
    await expect(app.speedValue).toHaveText('1000 ms');

    // Wait for sorting to finish
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Sorting complete!');
    }, { timeout: 30000 });

    // Cleanup dialog listener
    page.removeListener('dialog', dialogHandler);

    // Ensure no unexpected dialogs occurred
    expect(dialogPromises.length).toBe(0);

    // Verify no page errors or console errors occurred
    expect(pageErrors.length, `pageErrors during adjust speed: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `consoleErrors during adjust speed: ${JSON.stringify(consoleErrors)}`).toBe(0);
  }, 30000);

  test('Edge case: empty input should show alert and not crash, start button re-enabled', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new RadixPage(page);
    await app.goto();

    // Prepare to capture dialog
    let capturedDialogMessage = null;
    page.once('dialog', async dialog => {
      capturedDialogMessage = dialog.message();
      await dialog.accept();
    });

    // Clear input and click start
    await app.setInputArray('');
    await app.clickStart();

    // Dialog should have been shown with specific message
    expect(capturedDialogMessage).toBe('Please enter some integers separated by commas.');

    // Start button should be re-enabled after handling empty input per implementation
    await expect(app.startBtn).toBeEnabled();

    // No uncaught errors
    expect(pageErrors.length, `pageErrors for empty input: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `consoleErrors for empty input: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Edge case: invalid numbers in input should alert and not crash, start button re-enabled', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new RadixPage(page);
    await app.goto();

    // Prepare to capture dialog
    let capturedDialogMessage = null;
    page.once('dialog', async dialog => {
      capturedDialogMessage = dialog.message();
      await dialog.accept();
    });

    // Set invalid input and click start
    await app.setInputArray('1, 2, abc, 4');
    await app.clickStart();

    // Dialog should indicate invalid numbers
    expect(capturedDialogMessage).toBe('Input contains invalid number(s). Please enter only integers separated by commas.');

    // Start button should be re-enabled
    await expect(app.startBtn).toBeEnabled();

    // No uncaught errors
    expect(pageErrors.length, `pageErrors for invalid input: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `consoleErrors for invalid input: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Negative numbers handling: offsetting, sorting, reverting, and status annotation', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new RadixPage(page);
    await app.goto();

    // Use a small animation delay for speed
    await app.setSpeed(100);

    // Provide negative numbers input
    await app.setInputArray('-5,3,-2');

    // Start sorting
    await app.clickStart();

    // Wait for completion
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Sorting complete!');
    }, { timeout: 20000 });

    // After completion the code reverts offset and appends annotation to status
    const statusText = await app.status.textContent();
    expect(statusText).toContain('(Negative numbers handled by offset.)');

    // Final displayed array should be sorted with original negative values restored
    const finalArrayTexts = await app.readArrayElementsText();
    const finalNums = finalArrayTexts.map(t => Number(t));
    expect(finalNums).toEqual([-5, -2, 3]);

    // No uncaught runtime errors
    expect(pageErrors.length, `pageErrors for negative handling: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `consoleErrors for negative handling: ${JSON.stringify(consoleErrors)}`).toBe(0);
  }, 20000);
});