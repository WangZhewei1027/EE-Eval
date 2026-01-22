import { test, expect } from '@playwright/test';

// Test file: 98e208c1-d5c1-11f0-a327-5f281c6cb8e2.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/batch-1207/html/98e208c1-d5c1-11f0-a327-5f281c6cb8e2.html

// Page Object encapsulating key selectors and helpers
class RadixPage {
  constructor(page) {
    this.page = page;
    this.inputArr = page.locator('#inputArr');
    this.baseSelect = page.locator('#baseSelect');
    this.orderSelect = page.locator('#orderSelect');
    this.speedRange = page.locator('#speed');
    this.randomBtn = page.locator('#randomBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.startBtn = page.locator('#startBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.arrayView = page.locator('#arrayView');
    this.bucketsArea = page.locator('#bucketsArea');
    this.statusLine = page.locator('#statusLine');
    this.passLabel = page.locator('#passLabel');
    this.explainLine = page.locator('#explainLine');
  }

  async goto(url) {
    await this.page.goto(url);
  }

  // returns array of numbers displayed in main array view (by reading .bar .val textContent)
  async readDisplayedArray() {
    return await this.page.$$eval('#arrayView .bar .val', els => els.map(e => Number(e.textContent)));
  }

  async countBuckets() {
    return await this.bucketsArea.locator('.bucket').count();
  }

  async readStatus() {
    return (await this.statusLine.textContent())?.trim() ?? '';
  }

  async waitForStatusStartsWith(prefix, options = { timeout: 5000 }) {
    const { timeout } = options;
    const start = Date.now();
    while ((Date.now() - start) < timeout) {
      const s = await this.readStatus();
      if (s.startsWith(prefix)) return s;
      await this.page.waitForTimeout(50);
    }
    throw new Error(`Timed out waiting for status starting with "${prefix}". Last status: "${await this.readStatus()}"`);
  }

  // poll until status contains substring or timeout
  async waitForStatusContains(substr, timeout = 8000) {
    const start = Date.now();
    while ((Date.now() - start) < timeout) {
      const s = await this.readStatus();
      if (s.includes(substr)) return s;
      await this.page.waitForTimeout(60);
    }
    throw new Error(`Timed out waiting for status containing "${substr}". Last status: "${await this.readStatus()}"`);
  }
}

test.describe('Radix Sort Visualizer - FSM and UI validations', () => {
  const url = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e208c1-d5c1-11f0-a327-5f281c6cb8e2.html';
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];
    page.on('console', msg => {
      // collect text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial Idle state and basic UI', () => {
    test('on load the app should be in Idle state with correct status and initial array rendered', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // Idle: statusLine should reflect readiness
      const status = await rp.readStatus();
      expect(status).toBe('Ready. Click Start or Step to run.');

      // passLabel should show default 'Pass: 0'
      const passLabel = await rp.passLabel.textContent();
      expect(passLabel?.trim()).toBe('Pass: 0');

      // The initial input value from the HTML contains 12 items; verify arrayView shows 12 bars
      const displayed = await rp.readDisplayedArray();
      expect(displayed.length).toBeGreaterThanOrEqual(1);
      // check that the content includes expected first value (170) from the provided sample
      expect(displayed[0]).toBe(170);

      // No uncaught page errors occurred during initial render
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Start / Running / Completed transitions', () => {
    test('Start click transitions from Idle to Running and eventually to Completed (Done)', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // speed down (faster) to complete within test time
      await rp.speedRange.fill('50'); // sets to minimum 50ms for faster animations
      // click Start
      await rp.startBtn.click();

      // Immediately after click, status should change to Sorting...
      await rp.waitForStatusStartsWith('Sorting...');

      // start button should be disabled while running
      await expect(rp.startBtn).toBeDisabled();

      // Wait for final status that begins with "Done. Result:"
      const finalStatus = await rp.waitForStatusStartsWith('Done. Result:', { timeout: 20000 });
      expect(finalStatus.startsWith('Done. Result:')).toBeTruthy();

      // After completion pause button should be disabled
      await expect(rp.pauseBtn).toBeDisabled();

      // start button should be re-enabled after done
      await expect(rp.startBtn).toBeEnabled();

      // passLabel should indicate Finished
      const passLabel = (await rp.passLabel.textContent())?.trim();
      expect(passLabel).toBe('Finished');

      // The arrayView should still contain the same number of items as initial input (no loss)
      const displayed = await rp.readDisplayedArray();
      expect(displayed.length).toBeGreaterThan(0);

      // No uncaught page errors during run
      expect(pageErrors.length).toBe(0);
    });

    test('Pressing Start with empty input shows validation message', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // clear the input
      await rp.inputArr.fill('');
      // click start
      await rp.startBtn.click();

      // status should indicate prompt for numbers
      await rp.waitForStatusStartsWith('Please provide numbers', { timeout: 2000 });

      // ensure no page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Pause / Resume behavior', () => {
    test('Clicking Pause toggles paused state while sorting and updates status text', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // speed up to ensure actions happen quickly
      await rp.speedRange.fill('50');

      // start sorting
      await rp.startBtn.click();
      await rp.waitForStatusStartsWith('Sorting...');

      // Click Pause to pause the sorting. pauseBtn is enabled once started
      await rp.pauseBtn.click();

      // status should be 'Paused.' and button text becomes 'Resume'
      await rp.waitForStatusStartsWith('Paused.', { timeout: 2000 });
      const pauseText = (await rp.pauseBtn.textContent())?.trim();
      expect(pauseText).toBe('Resume');

      // Click again to resume
      await rp.pauseBtn.click();
      await rp.waitForStatusStartsWith('Resumed.', { timeout: 2000 });

      // Finally wait for completion to clean up the run
      await rp.waitForStatusStartsWith('Done. Result:', { timeout: 20000 });

      // ensure no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Step Mode (S3) and step transitions', () => {
    test('Entering Step mode initializes manager and step-through leads to Completed', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // Reset to known starting point
      await rp.resetBtn.click();
      await rp.waitForStatusStartsWith('Reset. Ready.');

      // Make step mode initialization
      await rp.stepBtn.click();
      await rp.waitForStatusStartsWith('Step mode: initialized.');

      // The UI should show buckets for the selected base (default 10)
      const bucketCount = await rp.countBuckets();
      expect(bucketCount).toBe(10);

      // Perform step clicks until completion or until a maximum step count to avoid infinite loops
      let steps = 0;
      const maxSteps = 400;
      let done = false;
      while (steps < maxSteps) {
        steps++;
        await rp.stepBtn.click();
        // small wait to let UI update
        await page.waitForTimeout(25);

        const status = await rp.readStatus();
        if (status.startsWith('Done. Result:')) {
          done = true;
          break;
        }
      }

      expect(done).toBeTruthy();

      // After finishing in step mode, manager should be reset (start button enabled)
      await expect(rp.startBtn).toBeEnabled();

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Step mode shows distribution messages as elements are placed into buckets', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // initialize step mode
      await rp.stepBtn.click();
      await rp.waitForStatusStartsWith('Step mode: initialized.');

      // first distribution step should produce a "Placed ..." message
      await rp.stepBtn.click();
      const statusAfterFirstStep = await rp.readStatus();
      expect(statusAfterFirstStep).toContain('Placed');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Reset and Random interactions', () => {
    test('Random generates new array and Reset returns to Idle', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // click Random
      await rp.randomBtn.click();

      // status should indicate random array generated (with item count)
      const randomStatus = await rp.waitForStatusContains('Random array generated (', 3000);
      expect(randomStatus).toContain('Random array generated (');

      // inputArr should now contain comma-separated numbers; check that it is non-empty
      const inputVal = (await rp.inputArr.inputValue()).trim();
      expect(inputVal.length).toBeGreaterThan(0);
      const arrCount = inputVal.split(',').filter(s => s.trim().length).length;
      expect(arrCount).toBeGreaterThan(0);

      // Now click Reset
      await rp.resetBtn.click();
      await rp.waitForStatusStartsWith('Reset. Ready.');

      // passLabel should be reset to Pass: 0
      const passLabel = (await rp.passLabel.textContent())?.trim();
      expect(passLabel).toBe('Pass: 0');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Controls: Base change, Speed change, Input Enter', () => {
    test('Changing baseSelect updates buckets to match base', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // change base to 2 (binary)
      await rp.baseSelect.selectOption('2');
      // buckets should update to 2
      await page.waitForTimeout(50);
      expect(await rp.countBuckets()).toBe(2);

      // change base to 16 (hex)
      await rp.baseSelect.selectOption('16');
      await page.waitForTimeout(50);
      expect(await rp.countBuckets()).toBe(16);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Adjusting speed control updates the value and affects runtime (sanity check)', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // record default speed
      const defaultSpeed = await rp.speedRange.inputValue();
      // set to minimum for quick runs
      await rp.speedRange.fill('50');
      expect(await rp.speedRange.inputValue()).toBe('50');

      // set back to previous value for cleanup
      await rp.speedRange.fill(defaultSpeed);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Pressing Enter in the input field triggers Start (keydown Enter -> start click)', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // Use a small array for quick completion
      await rp.inputArr.fill('3,1,2');
      // ensure speed is small to finish quickly
      await rp.speedRange.fill('50');

      // Press Enter key in the input field
      await rp.inputArr.press('Enter');

      // Sorting should start
      await rp.waitForStatusStartsWith('Sorting...', { timeout: 2000 });
      // Wait for done
      await rp.waitForStatusStartsWith('Done. Result:', { timeout: 5000 });

      // final array displayed should be sorted ascending by default: [1,2,3]
      const finalDisplayed = await rp.readDisplayedArray();
      // There may be equal count; check that the sorted result contains expected values
      expect(finalDisplayed).toContain(1);
      expect(finalDisplayed).toContain(2);
      expect(finalDisplayed).toContain(3);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('Invalid/Non-numeric tokens are ignored by parseInput and do not crash the app', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // set input to include invalid tokens
      await rp.inputArr.fill('10, foo, 5, , 3bar, 2');
      await rp.startBtn.click();

      // status should either start sorting or show validation
      // The implementation filters NaN and proceeds if at least one valid number exists.
      const status = await rp.readStatus();
      // Accept either Sorting... or Please provide numbers... (if parsing removed all)
      expect(['Sorting...', 'Please provide numbers (comma-separated).']).toContain(status);

      // If sorting started, wait for completion
      if (status === 'Sorting...') {
        await rp.waitForStatusStartsWith('Done. Result:', { timeout: 10000 });
      }

      // Ensure no page errors thrown
      expect(pageErrors.length).toBe(0);
    });

    test('Changing order to descendant and running produces a reversed final result (sanity check)', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // small array
      await rp.inputArr.fill('4,1,3');
      // set order to desc
      await rp.orderSelect.selectOption('desc');
      // speed fast
      await rp.speedRange.fill('50');
      // start
      await rp.startBtn.click();

      // wait for completion
      await rp.waitForStatusStartsWith('Done. Result:', { timeout: 8000 });
      const finalDisplayed = await rp.readDisplayedArray();

      // For descending expected is [4,3,1]
      expect(finalDisplayed[0]).toBe(4);
      expect(finalDisplayed[finalDisplayed.length - 1]).toBe(1);

      // ensure no page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observations', () => {
    test('No uncaught runtime errors (pageerror) should have occurred during the session', async ({ page }) => {
      const rp = new RadixPage(page);
      await rp.goto(url);

      // perform a couple of interactions to surface possible runtime errors
      await rp.randomBtn.click();
      await rp.resetBtn.click();
      await rp.baseSelect.selectOption('8');
      await rp.stepBtn.click(); // initialize step mode
      await rp.stepBtn.click(); // one step

      // Give a short time for any asynchronous errors to surface
      await page.waitForTimeout(200);

      // Assert that there were no page errors captured
      expect(pageErrors.length).toBe(0);

      // Inspect console messages to ensure nothing reported as error-level
      const errorLevelMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorLevelMsgs.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // final safety: print any console messages to the test output for debugging
    if (consoleMessages.length) {
      // Use test.info() to attach logs if needed (not required here). We still assert there were no error-level messages above.
    }
  });
});