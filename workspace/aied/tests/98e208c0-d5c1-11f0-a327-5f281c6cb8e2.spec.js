import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e208c0-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object for the Counting Sort demo
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.arrInput = page.locator('#arrInput');
    this.btnRandom = page.locator('#btnRandom');
    this.randLen = page.locator('#randLen');
    this.randMin = page.locator('#randMin');
    this.randMax = page.locator('#randMax');
    this.btnStart = page.locator('#btnStart');
    this.btnPause = page.locator('#btnPause');
    this.btnStep = page.locator('#btnStep');
    this.btnReset = page.locator('#btnReset');
    this.speed = page.locator('#speed');
    this.speedLabel = page.locator('#speedLabel');

    // Visual containers
    this.inputArrayBoxes = page.locator('#inputArray .box');
    this.countsIndicesBoxes = page.locator('#countsIndices .box.index');
    this.countsValuesBoxes = page.locator('#countsValues .box.small');
    this.outputArrayBoxes = page.locator('#outputArray .box');

    // Stats
    this.statN = page.locator('#statN');
    this.statMin = page.locator('#statMin');
    this.statMax = page.locator('#statMax');
    this.statRange = page.locator('#statRange');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Helper to read input array as string and parsed numbers
  async getInputValue() {
    return (await this.arrInput.inputValue()).trim();
  }

  async setInputValue(v) {
    await this.arrInput.fill(v);
  }

  async clickRandom() {
    await this.btnRandom.click();
  }

  async clickStart() {
    await this.btnStart.click();
  }

  async clickPause() {
    await this.btnPause.click();
  }

  async clickStep() {
    await this.btnStep.click();
  }

  async clickReset() {
    await this.btnReset.click();
  }

  async setSpeed(value) {
    await this.speed.evaluate((el, v) => (el.value = v), value);
    // trigger input event so UI updates label
    await this.speed.dispatchEvent('input');
  }

  // Returns array of input box texts (strings)
  async getInputArrayBoxes() {
    const count = await this.inputArrayBoxes.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push((await this.inputArrayBoxes.nth(i).textContent()).trim());
    }
    return out;
  }

  // Returns counts values as numbers (text may include 'idx' overlay; only numeric content kept)
  async getCountsValues() {
    const count = await this.countsValuesBoxes.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      const txt = (await this.countsValuesBoxes.nth(i).textContent()) || '';
      // text contains the number plus an 'idx' overlay text node; extract the numeric portion
      const numMatch = txt.trim().match(/-?\d+/);
      out.push(numMatch ? Number(numMatch[0]) : null);
    }
    return out;
  }

  // Returns output array as array of numbers or null for empty
  async getOutputValues() {
    const count = await this.outputArrayBoxes.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      const txt = (await this.outputArrayBoxes.nth(i).textContent()) || '';
      const cleaned = txt.trim();
      if (cleaned === '') out.push(null);
      else {
        const numMatch = cleaned.match(/-?\d+/);
        out.push(numMatch ? Number(numMatch[0]) : null);
      }
    }
    return out;
  }

  async getStats() {
    const n = (await this.statN.textContent()).trim();
    const min = (await this.statMin.textContent()).trim();
    const max = (await this.statMax.textContent()).trim();
    const range = (await this.statRange.textContent()).trim();
    return { n, min, max, range };
  }

  async getBtnStartText() {
    return (await this.btnStart.textContent()).trim();
  }

  async isBtnPauseDisabled() {
    return await this.btnPause.isDisabled();
  }

  async isBtnStartDisabled() {
    return await this.btnStart.isDisabled();
  }

  async isBtnStepDisabled() {
    return await this.btnStep.isDisabled();
  }
}

test.describe('Counting Sort - Interactive Demo (FSM validation)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught exceptions from the page context
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages (we'll filter for errors)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Navigate to app
    const demo = new CountingSortPage(page);
    await demo.goto();
  });

  // Validate initial idle state S0_Idle: input field has example value and UI rendered
  test('S0_Idle: initial state shows example array and rendered visuals', async ({ page }) => {
    const demo = new CountingSortPage(page);

    // Verify arrInput.value matches expected initial example
    const inputVal = await demo.getInputValue();
    expect(inputVal).toBe('4, 2, -1, 3, 2, 4, 0, -1');

    // Verify stats reflect the array
    const stats = await demo.getStats();
    expect(stats.n).toBe('8');
    // min and max should reflect values in the input
    expect(stats.min).toBe('-1');
    expect(stats.max).toBe('4');
    expect(stats.range).toBe('6');

    // Input array should render 8 boxes
    const inputBoxes = await demo.getInputArrayBoxes();
    expect(inputBoxes.length).toBe(8);
    // First box should show '4', last shows '-1'
    expect(inputBoxes[0]).toContain('4');
    expect(inputBoxes[inputBoxes.length - 1]).toContain('-1');
  });

  // Random generation event: clicking btnRandom should update arrInput and render new visuals
  test('GenerateRandomArray event: btnRandom updates input and visuals', async ({ page }) => {
    const demo = new CountingSortPage(page);

    // Set parameters for deterministic-ish run: small len and range
    await demo.randLen.fill('5');
    await demo.randMin.fill('0');
    await demo.randMax.fill('3');

    // Click generate and assert arrInput updated and visuals updated
    await demo.clickRandom();

    const inputVal = await demo.getInputValue();
    // Should be comma separated numbers - at least one comma expected for len > 1
    expect(inputVal.split(/[\s,]+/).filter(Boolean).length).toBe(5);

    const stats = await demo.getStats();
    // n should be updated to 5
    expect(stats.n).toBe('5');
    // range should be <= (max-min+1) <= 4
    expect(Number(stats.range)).toBeGreaterThanOrEqual(1);
    expect(Number(stats.range)).toBeLessThanOrEqual(4);
  });

  // Speed change event: input event on #speed updates label
  test('ChangeSpeed event: speed input updates the speed label', async ({ page }) => {
    const demo = new CountingSortPage(page);

    // Set speed to min and check label
    await demo.setSpeed('10');
    expect((await demo.speedLabel.textContent()).trim()).toBe('10 ms');

    // Set speed to an intermediate value
    await demo.setSpeed('500');
    expect((await demo.speedLabel.textContent()).trim()).toBe('500 ms');
  });

  // Step through sorting: initialize generator and perform a single step, validating S3_Step behavior
  test('S3_Step: clicking Step initializes generator and applies a single step', async ({ page }) => {
    const demo = new CountingSortPage(page);

    // Ensure we are in idle: Step should initialize generator and perform first yielded step
    // Click Step
    await demo.clickStep();

    // After first step, counts array should have at least one non-zero after 'afterCount' stage, or counts incremented in subsequent step
    const counts = await demo.getCountsValues();
    // Since first step may be 'count' for value 4, expect at least some counts array of length > 0
    expect(counts.length).toBeGreaterThan(0);

    // Output array should still contain mostly nulls because only counting stage has occurred
    const output = await demo.getOutputValues();
    // Output length should equal initial array n (=8)
    expect(output.length).toBe(8);

    // Step again a few times to move into prefix and place phases and ensure visuals update without errors
    for (let i = 0; i < 5; i++) {
      await demo.clickStep();
      // small delay to allow DOM updates
      await page.waitForTimeout(20);
    }

    // Confirm no uncaught page errors during stepping
    expect(pageErrors.map(e => e.message)).toEqual([]);
  });

  // Run sorting from idle to running and finish (S0_Idle -> S1_Running -> S4_Done)
  test('S0 -> S1 -> S4: Run sorting completes and produces a sorted output array', async ({ page }) => {
    const demo = new CountingSortPage(page);

    // Speed down to minimal so it runs quickly
    await demo.setSpeed('10');

    // Capture the original input values and expected sorted order
    const originalStr = await demo.getInputValue();
    const originalVals = originalStr.split(/[\s,]+/).filter(Boolean).map(Number);
    const expected = originalVals.slice().sort((a, b) => a - b);

    // Start the run - it should progress automatically to done
    await demo.clickStart();

    // Wait until Run button returns to 'Run' text meaning running finished
    await page.waitForFunction(
      (selector) => document.querySelector(selector).textContent.trim() === 'Run',
      {},
      '#btnStart'
    );

    // Read the output array values
    const outputVals = (await demo.getOutputValues()).map(v => v === null ? null : Number(v));
    // All output positions should be filled by the end
    expect(outputVals.every(v => v !== null)).toBeTruthy();

    // Compare with expected sorted array
    expect(outputVals).toEqual(expected);
  });

  // Pause while running and resume (S1_Running <-> S2_Paused)
  test('S1_Running -> S2_Paused and resume back to S1_Running', async ({ page }) => {
    const demo = new CountingSortPage(page);

    // Use a reasonably large speed so we can click Pause while running
    await demo.setSpeed('400');

    // Start running
    await demo.clickStart();

    // Wait for running indicator (btnStart text becomes 'Running...')
    await page.waitForFunction(
      (selector) => document.querySelector(selector).textContent.trim().startsWith('Running'),
      {},
      '#btnStart'
    );

    // Click Pause to transition to paused state
    await demo.clickPause();

    // After pause, btnPause should be disabled and Start should be enabled
    expect(await demo.isBtnPauseDisabled()).toBeTruthy();
    expect(await demo.isBtnStartDisabled()).toBeFalsy();

    // Now resume by clicking Start (btnStart handler checks paused flag)
    // Click Start to resume; this will continue run to completion
    await demo.clickStart();

    // Wait until Run completes (btnStart text back to 'Run')
    await page.waitForFunction(
      (selector) => document.querySelector(selector).textContent.trim() === 'Run',
      {},
      '#btnStart'
    );

    // Ensure final output is sorted
    const outputVals = (await demo.getOutputValues()).map(v => v === null ? null : Number(v));
    const inputVals = (await demo.getInputValue()).split(/[\s,]+/).filter(Boolean).map(Number);
    const expected = inputVals.slice().sort((a, b) => a - b);
    expect(outputVals).toEqual(expected);
  }, { timeout: 60_000 });

  // Reset sorting should clear generator state and restore UI to prepared-from-input state
  test('ResetSorting event: btnReset restores initial visuals and disables running state', async ({ page }) => {
    const demo = new CountingSortPage(page);

    // Start a step to ensure generator is initialized
    await demo.clickStep();
    await page.waitForTimeout(20);

    // Click Reset
    await demo.clickReset();

    // After reset, generator should be null and visuals reflect arrInput
    const stats = await demo.getStats();
    expect(stats.n).toBe('8'); // initial demo array length restored

    // Buttons: Start should be enabled, Pause disabled, Step enabled
    expect(await demo.isBtnStartDisabled()).toBeFalsy();
    expect(await demo.isBtnPauseDisabled()).toBeTruthy();
    expect(await demo.isBtnStepDisabled()).toBeFalsy();
  });

  // Edge case: invalid non-integer input triggers alert
  test('InputArray invalid entry triggers alert and does not initialize generator', async ({ page }) => {
    const demo = new CountingSortPage(page);

    // Replace input with invalid tokens
    await demo.setInputValue('1, 2, foo, 4');

    // Expect an alert when attempting to Start or Step that would parse input
    const dialogPromise = page.waitForEvent('dialog');
    await demo.clickStart(); // Start attempts to parse and should alert
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Please enter only integers');
    await dialog.accept();

    // Ensure no page errors thrown
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: extremely large range should be prevented and alert shown
  test('Large range inputs should be rejected with an alert', async ({ page }) => {
    const demo = new CountingSortPage(page);

    // Provide array with very large min and max to create a range > MAX_RANGE (200)
    // e.g., numbers 0 and 1000 produce range 1001 > 200
    await demo.setInputValue('0 1000');

    // Attempt to Start; prepareFromParsed should return false leading to alert
    const dialogPromise = page.waitForEvent('dialog');
    await demo.clickStart();
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('too large for visualization');
    await dialog.accept();
  });

  // Edge case: randMax < randMin should produce an alert
  test('Generate random with randMax < randMin triggers alert', async ({ page }) => {
    const demo = new CountingSortPage(page);

    await demo.randLen.fill('5');
    await demo.randMin.fill('10');
    await demo.randMax.fill('2');

    const dialogPromise = page.waitForEvent('dialog');
    await demo.clickRandom();
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('randMax should be >= randMin');
    await dialog.accept();
  });

  // Final test: ensure no unexpected ReferenceError, SyntaxError, or TypeError were emitted during interaction sequence
  test('No uncaught ReferenceError / SyntaxError / TypeError observed in page errors or console', async ({ page }) => {
    // We rely on handlers registered in beforeEach which accumulated pageErrors and consoleErrors.
    // Assert there were no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure console errors do not include JS fatal error types
    const errorTexts = consoleErrors.map(e => e.text);
    for (const txt of errorTexts) {
      expect(txt).not.toContain('ReferenceError');
      expect(txt).not.toContain('SyntaxError');
      expect(txt).not.toContain('TypeError');
    }

    // Also assert there are no console error messages at all (defensive)
    expect(consoleErrors.length).toBe(0);
  });
});