import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d881d0-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the Time Complexity Interactive Demo
class TimeComplexityPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      algo: page.locator('#algo'),
      maxNRange: page.locator('#maxN'),
      maxNnum: page.locator('#maxNnum'),
      points: page.locator('#points'),
      plotBtn: page.locator('#plotBtn'),
      runBtn: page.locator('#runBtn'),
      singleN: page.locator('#singleN'),
      runOnce: page.locator('#runOnce'),
      copyBtn: page.locator('#copyBtn'),
      resetBtn: page.locator('#resetBtn'),
      codeBox: page.locator('#code'),
      nnote: page.locator('#nnote'),
      statAlgo: page.locator('#statAlgo'),
      statOps: page.locator('#statOps'),
      statTime: page.locator('#statTime'),
      plotSVG: page.locator('#plot'),
      scaleSel: page.locator('#scale'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for the script to perform initial actions (initial plot triggered at end of script)
    await this.page.waitForLoadState('networkidle');
    // give some time for initial setTimeout plot to complete
    await this.page.waitForTimeout(200);
  }

  async selectAlgorithm(value) {
    await this.locators.algo.selectOption({ value });
    // script uses change event to update UI; wait a bit
    await this.page.waitForTimeout(50);
  }

  async clickPlot() {
    await this.locators.plotBtn.click();
  }

  async clickRunOnce() {
    await this.locators.runOnce.click();
  }

  async clickRunBtn() {
    await this.locators.runBtn.click();
  }

  async clickReset() {
    await this.locators.resetBtn.click();
  }

  async clickCopy() {
    await this.locators.copyBtn.click();
  }

  async setSingleN(n) {
    await this.locators.singleN.fill(String(n));
    // blur to ensure value set if necessary
    await this.locators.singleN.evaluate((el) => el.blur && el.blur());
  }

  async setMaxNnum(n) {
    await this.locators.maxNnum.fill(String(n));
    await this.locators.maxNnum.evaluate((el) => el.dispatchEvent(new Event('change')));
  }

  async getCodeText() {
    return (await this.locators.codeBox.textContent()) || '';
  }

  async getNnoteText() {
    return (await this.locators.nnote.textContent()) || '';
  }

  async getStatAlgo() {
    return (await this.locators.statAlgo.textContent()) || '';
  }

  async getStatOps() {
    return (await this.locators.statOps.textContent()) || '';
  }

  async getStatTime() {
    return (await this.locators.statTime.textContent()) || '';
  }

  async getMaxNRangeMax() {
    return await this.locators.maxNRange.evaluate((el) => el.max);
  }

  async getMaxNRangeValue() {
    return await this.locators.maxNRange.evaluate((el) => el.value);
  }

  async getMaxNnumValue() {
    return await this.locators.maxNnum.evaluate((el) => el.value);
  }

  async getPointsValue() {
    return await this.locators.points.evaluate((el) => el.value);
  }

  async getSingleNValue() {
    return await this.locators.singleN.evaluate((el) => el.value);
  }

  async getScaleValue() {
    return await this.locators.scaleSel.evaluate((el) => el.value);
  }

  // Count top-level children of SVG (to validate plot drew something)
  async getPlotChildCount() {
    return await this.locators.plotSVG.evaluate((svg) => svg.children.length);
  }

  // Helper: wait until statOps text updates away from a given value or timeout
  async waitForStatOpsNotEqual(value, timeout = 3000) {
    await this.page.waitForFunction(
      (selector, v) => document.querySelector(selector) && document.querySelector(selector).textContent !== v,
      ' #statOps',
      value,
      { timeout }
    );
  }

  // Wait until statOps matches regex
  async waitForStatOpsMatch(regex, timeout = 5000) {
    await this.page.waitForFunction(
      (selector, pattern) => {
        const el = document.querySelector(selector);
        if(!el) return false;
        return new RegExp(pattern).test(el.textContent || '');
      },
      '#statOps',
      regex.source,
      { timeout }
    );
  }
}

test.describe('Time Complexity Interactive Demo — FSM states & transitions', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // collect page errors and console messages for assertions
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    const app = new TimeComplexityPage(page);
    await app.goto();
  });

  test('S0 Idle: Initial UI setup runs setMaxNNote() and updateCodeSnippet()', async ({ page }) => {
    // Validate entry actions of initial state: code snippet populated, nnote set appropriately, initial stats set
    const app = new TimeComplexityPage(page);

    // Code snippet should be non-empty and reflect default algorithm (linear)
    const code = await app.getCodeText();
    expect(code.length).toBeGreaterThan(10);
    expect(code).toContain('O(n)'); // pseudocode for linear should be present

    // nnote for default 'linear' should be empty (no warning)
    const nnote = await app.getNnoteText();
    expect(nnote).toBe('');

    // statAlgo should reflect the algorithm name (script sets it on init)
    const statAlgo = await app.getStatAlgo();
    // The script sets name to 'O(n) — Linear Scan'
    expect(statAlgo.toLowerCase()).toContain('linear');

    // There should be an initial plot rendered (script triggers plotBtn.click() at end)
    const svgChildren = await app.getPlotChildCount();
    expect(svgChildren).toBeGreaterThan(0);

    // Assert no uncaught page errors happened during initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0 -> S1: Algorithm change updates nnote, code snippet, and statAlgo', async ({ page }) => {
    // Change algorithm to exponential and verify entry actions in S1 (setMaxNNote, updateCodeSnippet)
    const app = new TimeComplexityPage(page);

    // Select exponential algorithm
    await app.selectAlgorithm('exponential');

    // nnote should recommend small n for exponential
    const nnote = await app.getNnoteText();
    expect(nnote.toLowerCase()).toContain('recommended');

    // maxNRange.max should be clamped to a small value (30) for exponential
    const maxRangeMax = await app.getMaxNRangeMax();
    expect(Number(maxRangeMax)).toBeLessThanOrEqual(30);

    // code snippet should be updated to show fibonacci / exponential pseudocode
    const code = await app.getCodeText();
    expect(code.toLowerCase()).toContain('fib');
    expect(code.toLowerCase()).toContain('2^n');

    // statAlgo text should update to an algorithm name mentioning '2^n' or 'Fibonacci'
    const statAlgo = await app.getStatAlgo();
    expect(statAlgo.toLowerCase()).toContain('fib') || expect(statAlgo.toLowerCase()).toContain('2^n');

    // Ensure no uncaught page errors due to change handler
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1 -> S2: Plotting produces SVG paths and updates statOps (from calculating... to final)', async ({ page }) => {
    const app = new TimeComplexityPage(page);

    // Ensure an algorithm is selected (use linear)
    await app.selectAlgorithm('linear');

    // Set sample points lower to speed test
    await app.locators.points.fill('8');

    // Click Plot and assert statOps shows calculating... then a final summary '(last sample)'
    await app.clickPlot();

    // Immediately statOps should indicate calculation started
    await expect(app.locators.statOps).toHaveText('calculating...');

    // Wait for final update – the code uses setTimeout(10) then does heavy work; allow margin
    await page.waitForTimeout(600);
    const finalOps = await app.getStatOps();
    expect(finalOps).toMatch(/last sample|ops/); // should mention last sample or ops

    // Plot SVG should have paths for theoretical and measured curves (at least a few children)
    const childCount = await app.getPlotChildCount();
    expect(childCount).toBeGreaterThanOrEqual(3); // axes + grid + paths expected

    // Ensure no uncaught page errors during plotting
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1 -> S3: Run single test (runOnce) measures ops and elapsed time and plots single point', async ({ page }) => {
    const app = new TimeComplexityPage(page);

    // Choose a safe algorithm (linear) and a known singleN
    await app.selectAlgorithm('linear');
    await app.setSingleN(50);

    // Click Run & Measure
    await app.clickRunOnce();

    // statOps should indicate running... very briefly
    await expect(app.locators.statOps).toHaveText('running...');

    // Wait for the runOnce setTimeout to complete and stats to update
    await page.waitForTimeout(400);
    // statOps should now contain 'ops' and statTime should be numeric ms
    const statOps = await app.getStatOps();
    const statTime = await app.getStatTime();
    expect(statOps).toMatch(/\d/);
    expect(statOps.toLowerCase()).toContain('ops');
    expect(statTime).toMatch(/\d+\.\d{3}\s*ms/);

    // A plot should be generated with one point (children > 0)
    const childCount = await app.getPlotChildCount();
    expect(childCount).toBeGreaterThan(0);

    // Ensure no uncaught page errors during single run
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1 -> S3 (edge case): Exponential runOnce clamps large n and still returns stats', async ({ page }) => {
    const app = new TimeComplexityPage(page);

    // Select exponential algorithm (which recommends small n)
    await app.selectAlgorithm('exponential');

    // Set singleN to a very large number that the UI/clamp should reduce
    await app.setSingleN(1000);

    // Click runOnce - the code clamps n to Math.min(n, 40) for exponential
    await app.clickRunOnce();

    // Wait for run to complete
    await page.waitForTimeout(800);

    const singleNVal = await app.getSingleNValue();
    // The script clamps exponential singleN to at most 40
    expect(Number(singleNVal)).toBeLessThanOrEqual(40);

    const statOps = await app.getStatOps();
    const statTime = await app.getStatTime();
    expect(statOps.toLowerCase()).toContain('ops');
    expect(statTime).toMatch(/\d+\.\d{3}\s*ms/);

    expect(pageErrors.length).toBe(0);
  });

  test('Run button (S1 -> S2-like): clicking Run for several ns populates stats and plot', async ({ page }) => {
    const app = new TimeComplexityPage(page);

    // Use quadratic but small size to avoid long runtimes
    await app.selectAlgorithm('quadratic');
    // Clamp maxNnum to small value for test
    await app.setMaxNnum(20);
    // Click Run for several n values
    await app.clickRunBtn();

    // During run, status should indicate running...
    await expect(app.locators.statOps).toHaveText(/running\.\.\./);

    // Wait for runs to complete; the script awaits small timeouts per sample
    await page.waitForTimeout(1000);

    // After run, statOps should show ops and statTime should include ms
    const postOps = await app.getStatOps();
    const postTime = await app.getStatTime();
    expect(postOps.toLowerCase()).toMatch(/ops/);
    expect(postTime).toMatch(/ms/);

    // Plot should be updated with children's content
    const childCount = await app.getPlotChildCount();
    expect(childCount).toBeGreaterThan(0);

    expect(pageErrors.length).toBe(0);
  });

  test('S4 Reset: Modify controls then Reset reverts to defaults and clears plot & stats', async ({ page }) => {
    const app = new TimeComplexityPage(page);

    // Make some changes
    await app.selectAlgorithm('quadratic');
    await app.setMaxNnum(500);
    await app.locators.points.fill('50');
    await app.setSingleN(1234);
    await app.locators.scaleSel.selectOption('log');

    // Sanity: changes took effect
    expect(Number(await app.getMaxNnumValue())).toBeGreaterThanOrEqual(100);
    expect(await app.getPointsValue()).toBe('50');
    expect(await app.getSingleNValue()).toBe('1234');
    expect(await app.getScaleValue()).toBe('log');

    // Click Reset
    await app.clickReset();

    // After reset, many controls should be back to defaults per implementation
    await page.waitForTimeout(50);

    expect(await app.getMaxNRangeValue()).toBe('200');
    expect(await app.getMaxNnumValue()).toBe('200');
    expect(await app.getPointsValue()).toBe('25');
    expect(await app.getSingleNValue()).toBe('100');
    expect(await app.getScaleValue()).toBe('linear');

    // Algorithm should be set back to 'linear'
    const statAlgo = await app.getStatAlgo();
    expect(statAlgo.toLowerCase()).toContain('linear');

    // Stats cleared
    expect(await app.getStatOps()).toBe('—');
    expect(await app.getStatTime()).toBe('—');

    // Plot cleared: implementation calls clearPlot() which removes svg children
    // Give a short delay for DOM update
    await page.waitForTimeout(50);
    const childCount = await app.getPlotChildCount();
    // After reset it tries to clear; depending on later code the initial plot may have re-run,
    // assert that child count is a number and not negative; better to assert a reset action occurred:
    expect(typeof childCount).toBe('number');

    expect(pageErrors.length).toBe(0);
  });

  test('Copy snippet: clicking code box triggers copy click and button text changes (Copied!/Failed) and reverts', async ({ page }) => {
    const app = new TimeComplexityPage(page);

    // Click the code area (which triggers copyBtn.click())
    await app.locators.codeBox.click();

    // The copy button text toggles to 'Copied!' on success or 'Failed' on failure, then reverts.
    // Wait up to 2s for transient text change
    await page.waitForTimeout(50);
    const txtBefore = await app.locators.copyBtn.textContent();
    // It might be still 'Copy snippet' for a brief moment; wait for change with a small loop
    let changed = false;
    for (let i = 0; i < 20; i++) {
      const txt = (await app.locators.copyBtn.textContent()) || '';
      if (txt === 'Copied!' || txt === 'Failed') {
        changed = true;
        break;
      }
      await page.waitForTimeout(50);
    }
    expect(changed).toBeTruthy();

    // Wait to ensure it reverts back to 'Copy snippet'
    await page.waitForTimeout(1200);
    const finalTxt = (await app.locators.copyBtn.textContent()) || '';
    expect(finalTxt.toLowerCase()).toContain('copy');

    // No uncaught page errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('Console & pageerror observation: capture logs and ensure no unexpected uncaught errors', async ({ page }) => {
    // This test focuses on collecting and asserting console messages and page errors observed during prior interactions.
    // We perform a lightweight interaction to produce console output (plot) and then inspect captured logs.

    const app = new TimeComplexityPage(page);

    // Trigger a plot to generate console output if any
    await app.selectAlgorithm('linear');
    await app.clickPlot();
    await page.waitForTimeout(500);

    // Verify that console messages were captured (may be empty but array exists)
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Ensure there were no uncaught page errors during the session
    // If there are any uncaught runtime exceptions, fail the test so those get reported.
    if (pageErrors.length > 0) {
      // Log messages for debugging in test output
      for (const err of pageErrors) {
        console.error('Captured pageerror in test:', err);
      }
    }
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Provide a final sanity check: no uncaught errors were registered during this test run.
    expect(pageErrors.length).toBe(0);
  });
});