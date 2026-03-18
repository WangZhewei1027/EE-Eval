import { test, expect } from '@playwright/test';

// Test file: 5a32e352-ffc5-11f0-8b43-1ffa87931c43.spec.js
// Application under test:
// http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32e352-ffc5-11f0-8b43-1ffa87931c43.html

// Page Object for the Selection Sort Visualization page
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32e352-ffc5-11f0-8b43-1ffa87931c43.html';
    this.arrayContainer = page.locator('#arrayContainer');
    this.generateBtn = page.locator('#generateBtn');
    this.startBtn = page.locator('#startBtn');
    this.sizeInput = page.locator('#sizeInput');
    this.speedInput = page.locator('#speedInput');
    this.speedLabel = page.locator('#speedLabel');
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
  }

  // Read numeric values shown inside each bar
  async getBarValues() {
    return await this.page.$$eval('#arrayContainer .bar', bars =>
      bars.map(b => parseInt(b.textContent.trim(), 10))
    );
  }

  // Count bars
  async getBarCount() {
    return await this.page.$$eval('#arrayContainer .bar', bars => bars.length);
  }

  // Get classes of bars (array of className strings)
  async getBarClasses() {
    return await this.page.$$eval('#arrayContainer .bar', bars => bars.map(b => b.className));
  }

  // Click generate button
  async clickGenerate() {
    await this.generateBtn.click();
  }

  // Click start button
  async clickStart() {
    await this.startBtn.click();
  }

  // Set size input (simulates user typing and blurring to trigger change)
  async setSize(value) {
    await this.sizeInput.fill(String(value));
    // Trigger change by pressing Enter and blurring
    await this.sizeInput.press('Enter');
    await this.page.evaluate(() => document.getElementById('sizeInput').dispatchEvent(new Event('change', { bubbles: true })));
  }

  // Set speed input (range) - using UI interaction and dispatch input event
  async setSpeed(value) {
    // Use evaluate to set value and dispatch input event (keeps realistic)
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedInput');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Read speed label text
  async getSpeedLabelText() {
    return (await this.speedLabel.textContent()).trim();
  }

  // Wait for sorting to start: startBtn becomes disabled and generateBtn disabled
  async waitForSortingToStart({ timeout = 5000 } = {}) {
    await expect(this.startBtn).toBeDisabled({ timeout });
    await expect(this.generateBtn).toBeDisabled({ timeout });
  }

  // Wait for sorting to finish: startBtn becomes enabled again
  async waitForSortingToFinish({ timeout = 30000 } = {}) {
    await expect(this.startBtn).toBeEnabled({ timeout });
    await expect(this.generateBtn).toBeEnabled({ timeout });
  }

  // Check whether all bars have 'sorted' class
  async allBarsSorted() {
    const classes = await this.getBarClasses();
    return classes.every(c => c.split(' ').includes('sorted'));
  }
}

test.describe('Selection Sort Visualization - FSM tests and UI behavior', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];
  let pageObj;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for assertions later
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions on the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    pageObj = new SelectionSortPage(page);
    await pageObj.goto();
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: no unexpected page errors
    // We assert no uncaught page errors occurred during each test (unless test explicitly expects one)
    expect(pageErrors.length).toBe(0);
    // No console errors
    expect(consoleErrors.length).toBe(0);
  });

  test('Idle state: initial render and controls (S0_Idle entry action -> renderArray())', async ({ page }) => {
    // Validate initial render; renderArray() should have been called on init producing bars
    // Expect at least one bar rendered and that its count equals the default size input value (20)
    const sizeValue = parseInt(await page.evaluate(() => document.getElementById('sizeInput').value), 10);
    const count = await pageObj.getBarCount();
    expect(count).toBe(sizeValue);

    // Buttons should be enabled in Idle state
    await expect(pageObj.generateBtn).toBeEnabled();
    await expect(pageObj.startBtn).toBeEnabled();

    // Speed label should reflect initial speed input value and be '300 ms'
    const speedLabel = await pageObj.getSpeedLabelText();
    expect(speedLabel).toMatch(/300\s*ms/);

    // No console errors were emitted during load (captured in afterEach)
    // Additionally ensure array container has child elements
    const hasChildren = await page.$('#arrayContainer .bar') !== null;
    expect(hasChildren).toBeTruthy();
  });

  test('GenerateArray event: clicking Generate New Array updates the DOM and respects array size (S0_Idle -> S0_Idle)', async ({ page }) => {
    // Comment: Validate GenerateArray action trigger and resulting DOM change.
    // Capture current bar values, change size to 10, click generate and ensure new array of requested size is rendered.

    const originalValues = await pageObj.getBarValues();
    await pageObj.setSize(10);
    // Click generate to create new array of size 10
    await pageObj.clickGenerate();

    // Verify bar count equals 10
    const newCount = await pageObj.getBarCount();
    expect(newCount).toBe(10);

    const newValues = await pageObj.getBarValues();
    // It's highly likely newValues differ from originalValues; assert at least they are not identical in length or content
    const same = originalValues.length === newValues.length && originalValues.every((v, i) => v === newValues[i]);
    expect(same).toBeFalsy();
  });

  test('StartSorting event: clicking Start begins sorting, disables controls and marks elements sorted on completion (S0_Idle -> S1_Sorting -> S0_Idle)', async ({ page }) => {
    // Comment: Validate selectionSort entry action selectionSort() is invoked on Start,
    // controls are disabled during sorting, and on exit all bars are marked sorted.

    // To make sorting fast and deterministic for test, set small size and fast speed
    await pageObj.setSize(5);
    await pageObj.setSpeed(10); // 10 ms delay
    // Generate array to ensure new size applies
    await pageObj.clickGenerate();

    // Start sorting
    const startPromise = pageObj.clickStart();

    // Wait for sorting to start: controls should be disabled
    await pageObj.waitForSortingToStart({ timeout: 5000 });

    // During sorting, some bars should get 'current-min' or 'highlight' classes at some point.
    // Wait for at least one element to have class 'current-min' or 'highlight' (timeout to avoid flakiness).
    const sawHighlight = await page.waitForFunction(() => {
      const bars = Array.from(document.querySelectorAll('#arrayContainer .bar'));
      return bars.some(b => b.classList.contains('current-min') || b.classList.contains('highlight'));
    }, null, { timeout: 5000 }).then(() => true).catch(() => false);

    expect(sawHighlight).toBeTruthy();

    // Wait for sorting to finish (Start button becomes enabled). Sorting on small array and fast speed should finish quickly.
    await pageObj.waitForSortingToFinish({ timeout: 20000 });

    // After sorting, all bars should have 'sorted' class (onExit rendering sortedIndices)
    const allSorted = await pageObj.allBarsSorted();
    expect(allSorted).toBeTruthy();

    // Controls are enabled again
    await expect(pageObj.generateBtn).toBeEnabled();
    await expect(pageObj.startBtn).toBeEnabled();
  });

  test('AdjustSpeed event: updating speed updates label in Idle; while sorting speed input is disabled (S0_Idle AdjustSpeed and S1_Sorting AdjustSpeed behavior)', async ({ page }) => {
    // Comment: Validate updateSpeedLabel() on input event when not sorting.
    // Also validate that when sorting, speed input becomes disabled (implementation disables it).

    // Idle: change speed and assert speedLabel updates
    await pageObj.setSpeed(150);
    expect(await pageObj.getSpeedLabelText()).toMatch(/150\s*ms/);

    // Now begin sorting with small array and slightly slower speed to allow time to check disabled state
    await pageObj.setSize(6);
    await pageObj.setSpeed(50);
    await pageObj.clickGenerate();
    await pageObj.clickStart();

    // Wait for sorting to start (controls disabled)
    await pageObj.waitForSortingToStart({ timeout: 5000 });

    // speedInput should be disabled during sorting according to implementation
    const speedDisabled = await page.$eval('#speedInput', el => el.disabled);
    expect(speedDisabled).toBe(true);

    // Try to change speed while disabled via user interaction: clicking and keyboard won't work.
    // We'll assert that dispatching a user-like event is not a normal user operation and the UI disables the control.
    // Confirm that speedLabel did not change simply by attempting to set the speed via user-level change (Playwright's fill on disabled will error),
    // so we assert disabled remains true and label remains previous value ('50 ms').
    expect(await pageObj.getSpeedLabelText()).toMatch(/50\s*ms/);

    // Wait for sorting to finish to restore enabled state
    await pageObj.waitForSortingToFinish({ timeout: 20000 });

    // After sorting, speed input should be enabled again
    const speedDisabledAfter = await page.$eval('#speedInput', el => el.disabled);
    expect(speedDisabledAfter).toBe(false);
  });

  test('ChangeArraySize and edge cases: invalid sizes prompt alert and size constraints enforced (ChangeArraySize transition and guards)', async ({ page }) => {
    // Comment: Validate that invalid sizes trigger an alert when generating a new array,
    // and that change event clamps values to the allowed range when not sorting.

    // Listen for dialogs
    let dialogMessage = null;
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Set invalid small size and attempt to generate -> expect alert to appear
    await pageObj.setSize(3); // below min 5
    await pageObj.clickGenerate();

    // Dialog should have fired with message about size; the code alerts 'Array size must be between 5 and 50'
    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toMatch(/Array size must be between 5 and 50/);

    // Now test large size clamp using change event (but not generate): set value > 50 and trigger change; value should clamp to 50
    await pageObj.setSize(60);
    const clampedValue = await page.evaluate(() => parseInt(document.getElementById('sizeInput').value, 10));
    expect(clampedValue).toBeLessThanOrEqual(50);
    expect(clampedValue).toBeGreaterThanOrEqual(5);

    // When sorting, change events should be ignored (sizeInput is disabled during sorting)
    await pageObj.setSize(5);
    await pageObj.setSpeed(5);
    await pageObj.clickGenerate();
    await pageObj.clickStart();

    // Wait for sorting start
    await pageObj.waitForSortingToStart({ timeout: 5000 });

    // Attempt to change value while sorting; since input is disabled user cannot change it - verify disabled state
    const sizeDisabledDuringSort = await page.$eval('#sizeInput', el => el.disabled);
    expect(sizeDisabledDuringSort).toBe(true);

    // Finish sort
    await pageObj.waitForSortingToFinish({ timeout: 20000 });
  });

  test('Console and runtime observations: observe console messages and page errors during interactions', async ({ page }) => {
    // Comment: This test explicitly checks that no unexpected console errors or uncaught page exceptions occurred
    // during a typical interaction sequence (generate -> start -> complete). If runtime errors occur they will be captured
    // by the pageerror and console listeners set up in beforeEach and asserted in afterEach.

    // Perform a basic interaction sequence: change size, generate, start sorting with small size and fast speed
    await pageObj.setSize(5);
    await pageObj.setSpeed(20);
    await pageObj.clickGenerate();
    await pageObj.clickStart();

    // Wait for sorting to start and finish
    await pageObj.waitForSortingToStart({ timeout: 5000 });
    await pageObj.waitForSortingToFinish({ timeout: 20000 });

    // Ensure we captured console messages (may be none), but no console errors should be present (checked in afterEach)
    // Additionally assert that no uncaught page errors were observed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Optionally, ensure some console messages or traces exist (not required). We'll allow zero messages.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});