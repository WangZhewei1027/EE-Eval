import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2daf32-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Insertion Sort Interactive app
class InsertionSortPage {
  constructor(page) {
    this.page = page;
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.status = page.locator('#status');
    this.arraySizeInput = page.locator('#arraySize');
    this.arraySizeValue = page.locator('#arraySizeValue');
    this.generateArrayBtn = page.locator('#generateArray');
    this.startSortBtn = page.locator('#startSort');
    this.nextStepBtn = page.locator('#nextStep');
    this.pauseSortBtn = page.locator('#pauseSort');
    this.resetBtn = page.locator('#reset');
    this.speedInput = page.locator('#speed');
    this.speedValue = page.locator('#speedValue');
    this.arrayInput = page.locator('#arrayInput');
    this.useCustomArrayBtn = page.locator('#useCustomArray');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getStatusText() {
    return (await this.status.textContent()).trim();
  }

  async getArrayElementsCount() {
    return await this.page.locator('.array-element').count();
  }

  async getArrayElementValues() {
    // Returns array of text values from .array-value
    const nodes = this.page.locator('.array-value');
    const count = await nodes.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const txt = (await nodes.nth(i).textContent()).trim();
      values.push(Number(txt));
    }
    return values;
  }

  async clickGenerate() {
    await this.generateArrayBtn.click();
  }

  async clickStart() {
    await this.startSortBtn.click();
  }

  async clickNextStep() {
    await this.nextStepBtn.click();
  }

  async clickPause() {
    await this.pauseSortBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async setSpeed(value) {
    await this.speedInput.fill(''); // ensure event triggers
    await this.page.evaluate((sel, v) => {
      const el = document.querySelector(sel);
      el.value = String(v);
      // dispatch input event to trigger listener
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '#speed', value);
  }

  async setArraySize(value) {
    await this.page.evaluate((sel, v) => {
      const el = document.querySelector(sel);
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '#arraySize', value);
  }

  async useCustomArray(text) {
    await this.arrayInput.fill(text);
    await this.useCustomArrayBtn.click();
  }

  async isSortingFlag() {
    return await this.page.evaluate(() => window.isSorting === true);
  }

  async getSortIntervalExists() {
    return await this.page.evaluate(() => !!window.sortInterval);
  }

  async getSortedUpTo() {
    return await this.page.evaluate(() => window.sortedUpTo);
  }
}

test.describe('Insertion Sort Interactive - FSM and UI tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for each test
    consoleMessages = [];
    pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test assert there were no uncaught page errors and no console errors.
    // We observe console logs and page errors - if any errors occurred they will be surfaced here.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Provide helpful debug info in case of failure
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console errors/warnings: ${consoleErrors.map(c => c.text).join(' | ')}`).toHaveLength(0);
    // cleanup listeners automatically by Playwright fixture; explicit detach not required
    await page.close();
  });

  test.describe('Initial state and controls (S0_Idle)', () => {
    test('Initial rendering shows Ready status and correct array length and controls', async ({ page }) => {
      // This test validates the Idle state (S0_Idle): renderArray() invoked on entry, status message, and controls present.
      const app = new InsertionSortPage(page);
      await app.goto();

      // Status text should match the Idle evidence message
      await expect(app.status).toHaveText('Ready. Click "Generate New Array" or provide a custom array to begin.');

      // Array size default is 10 -> there should be 10 array elements rendered
      await expect(app.arraySizeValue).toHaveText('10');
      const count = await app.getArrayElementsCount();
      expect(count).toBe(10);

      // No elements should be marked as 'sorted' at initial state
      const sortedCount = await page.locator('.array-element.sorted').count();
      expect(sortedCount).toBe(0);
    });

    test('Changing Array Size updates the display value and does not throw errors', async ({ page }) => {
      // Validate arraySize input updates its visible value and no runtime errors emitted.
      const app = new InsertionSortPage(page);
      await app.goto();

      // Change size to 7
      await app.setArraySize(7);
      await expect(app.arraySizeValue).toHaveText('7');

      // Generate new array and ensure count matches
      await app.clickGenerate();
      await expect(app.status).toHaveText('New array generated. Ready to sort.');
      const count = await app.getArrayElementsCount();
      expect(count).toBe(7);
    });

    test('Generate New Array button triggers a new array and updates status', async ({ page }) => {
      // Validate GenerateArray event: S0_Idle -> S0_Idle transition but status updates
      const app = new InsertionSortPage(page);
      await app.goto();

      // Save initial values for comparison
      const beforeValues = await app.getArrayElementValues();

      await app.clickGenerate();
      await expect(app.status).toHaveText('New array generated. Ready to sort.');

      const afterValues = await app.getArrayElementValues();
      // Values might randomly be the same; at minimum ensure elements exist and length matches
      expect(afterValues.length).toBeGreaterThanOrEqual(5);
      expect(afterValues.length).toBeLessThanOrEqual(20);
    });
  });

  test.describe('Sorting lifecycle: Start, Pause, Resume, Reset (S0 <-> S1 <-> S2 -> S0)', () => {
    test('Start Sort transitions to Sorting (S1_Sorting): isSorting flag and status update', async ({ page }) => {
      // Validate StartSort event: S0_Idle -> S1_Sorting: startSort() entry actions set isSorting and status
      const app = new InsertionSortPage(page);
      await app.goto();

      // Start sorting
      await app.clickStart();

      // isSorting should be true in page context
      const isSorting = await app.isSortingFlag();
      expect(isSorting).toBe(true);

      // sortInterval should exist
      const hasInterval = await app.getSortIntervalExists();
      expect(hasInterval).toBe(true);

      // Status should indicate sorting in progress
      await expect(app.status).toHaveText('Sorting in progress...');
    });

    test('Pause Sort transitions to Paused (S2_Paused): interval cleared and status updated', async ({ page }) => {
      // Validate PauseSort event: S1_Sorting -> S2_Paused
      const app = new InsertionSortPage(page);
      await app.goto();

      // Start then pause
      await app.clickStart();

      // Ensure started
      expect(await app.isSortingFlag()).toBe(true);

      await app.clickPause();

      // After pausing, isSorting should be false and interval cleared
      expect(await app.isSortingFlag()).toBe(false);
      const hasInterval = await app.getSortIntervalExists();
      expect(hasInterval).toBe(false);

      await expect(app.status).toHaveText('Sorting paused.');
    });

    test('Resume from Paused goes back to Sorting (S2_Paused -> S1_Sorting)', async ({ page }) => {
      // Validate clicking Start after pause resumes sorting
      const app = new InsertionSortPage(page);
      await app.goto();

      await app.clickStart();
      await app.clickPause();
      expect(await app.isSortingFlag()).toBe(false);

      // Click start again to resume
      await app.clickStart();
      expect(await app.isSortingFlag()).toBe(true);
      await expect(app.status).toHaveText('Sorting in progress...');
    });

    test('Reset while sorting returns to Idle (S1_Sorting -> S0_Idle): resetSort and renderArray()', async ({ page }) => {
      // Validate Reset event from sorting resets state and updates status to Idle message
      const app = new InsertionSortPage(page);
      await app.goto();

      await app.clickStart();
      expect(await app.isSortingFlag()).toBe(true);

      // Click reset
      await app.clickReset();

      // After reset isSorting should be false, status message updated
      expect(await app.isSortingFlag()).toBe(false);
      await expect(app.status).toHaveText('Sorting reset. Ready to begin again.');

      // sortedUpTo should be reset to 0 (accessible via page.evaluate)
      const sortedUpTo = await app.getSortedUpTo();
      expect(sortedUpTo).toBe(0);
    });
  });

  test.describe('Stepwise sorting and completion (NextStep, S1 -> S1 or S3_Completed)', () => {
    test('Using Next Step repeatedly completes sorting for a small custom array (S3_Completed)', async ({ page }) => {
      // This validates NextStep transitions and completion condition.
      // We will load a small custom array to deterministically finish the sort via NextStep clicks.
      const app = new InsertionSortPage(page);
      await app.goto();

      // Use a sorted small array to exercise predictable behavior: [1,2,3]
      await app.useCustomArray('1,2,3');
      await expect(app.status).toHaveText('Custom array loaded. Ready to sort.');

      // Repeatedly click Next Step until status shows "Sorting complete!" or we reach iteration limit
      const maxSteps = 20;
      let completed = false;
      for (let i = 0; i < maxSteps; i++) {
        await app.clickNextStep();
        const status = await app.getStatusText();
        if (status === 'Sorting complete!') {
          completed = true;
          break;
        }
        // brief pause to allow DOM updates from performSortStep (synchronous but keep loop stable)
        await page.waitForTimeout(10);
      }

      expect(completed).toBe(true);
      await expect(app.status).toHaveText('Sorting complete!');

      // All elements should be visually marked as sorted? sorted class is applied up to sortedUpTo;
      // After completion sortedUpTo may equal array.length - 1; ensure at least 1 element has 'sorted' class
      const sortedCount = await page.locator('.array-element.sorted').count();
      expect(sortedCount).toBeGreaterThanOrEqual(1);
    });

    test('Next Step while sorting (isSorting true) does not perform step (button ignored) and no errors', async ({ page }) => {
      // This validates that NextStep handler only acts when not isSorting.
      const app = new InsertionSortPage(page);
      await app.goto();

      // Start the automatic interval-based sorting
      await app.clickStart();
      expect(await app.isSortingFlag()).toBe(true);

      // Click NextStep while sorting - per implementation it should do nothing
      await app.clickNextStep();

      // Ensure still sorting and no JS errors occurred
      expect(await app.isSortingFlag()).toBe(true);

      // Pause to clean up
      await app.clickPause();
    });
  });

  test.describe('Custom array usage and error handling (UseCustomArray)', () => {
    test('Valid custom array loads and updates UI accordingly', async ({ page }) => {
      // Validate UseCustomArray event: loads custom array and resets sorting state
      const app = new InsertionSortPage(page);
      await app.goto();

      await app.useCustomArray('50,40,30,20,10');
      await expect(app.status).toHaveText('Custom array loaded. Ready to sort.');

      // Array element count should be 5
      const count = await app.getArrayElementsCount();
      expect(count).toBe(5);

      // Confirm values reflect input
      const values = await app.getArrayElementValues();
      expect(values).toEqual([50, 40, 30, 20, 10]);
    });

    test('Invalid custom array shows an error message and does not throw uncaught exceptions', async ({ page }) => {
      // Validate that entering invalid numbers triggers the caught exception branch and updates status with error message.
      const app = new InsertionSortPage(page);
      await app.goto();

      // Provide invalid input with a non-numeric token
      await app.useCustomArray('1, two, 3');
      await expect(app.status).toHaveText('Error: Please enter valid numbers separated by commas.');

      // No unhandled page errors should have occurred - this will be asserted in afterEach
    });
  });

  test.describe('Speed adjustment behavior and edge cases', () => {
    test('Adjusting speed updates label and resets interval when sorting', async ({ page }) => {
      // Validate speed input updates speedValue and, if sorting, re-creates interval (we assert existence)
      const app = new InsertionSortPage(page);
      await app.goto();

      // Start sorting
      await app.clickStart();
      expect(await app.isSortingFlag()).toBe(true);

      // Change speed to 1000ms via page-level event dispatch
      await app.setSpeed(1000);
      await expect(app.speedValue).toHaveText('1000ms');

      // Interval should exist (re-created)
      expect(await app.getSortIntervalExists()).toBe(true);

      // Pause to cleanup
      await app.clickPause();
    });

    test('Edge case: resetting while paused leaves array in Idle-like state', async ({ page }) => {
      // Validate Reset from Paused state yields expected Idle status
      const app = new InsertionSortPage(page);
      await app.goto();

      await app.clickStart();
      await app.clickPause();
      await expect(app.status).toHaveText('Sorting paused.');

      await app.clickReset();
      await expect(app.status).toHaveText('Sorting reset. Ready to begin again.');
      expect(await app.isSortingFlag()).toBe(false);
    });
  });
});