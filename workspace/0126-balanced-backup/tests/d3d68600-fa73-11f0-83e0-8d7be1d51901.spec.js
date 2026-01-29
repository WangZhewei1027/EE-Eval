import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d68600-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object Model for the Radix Sort Visualizer page
class RadixPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.size = page.locator('#size');
    this.maxval = page.locator('#maxval');
    this.base = page.locator('#base');
    this.speed = page.locator('#speed');
    this.speedVal = page.locator('#speedVal');
    this.generateBtn = page.locator('#generate');
    this.startBtn = page.locator('#start');
    this.stepBtn = page.locator('#step');
    this.resetBtn = page.locator('#reset');
    this.explainToggle = page.locator('#explainToggle');

    // Visual elements
    this.arrayRow = page.locator('#arrayRow');
    this.buckets = page.locator('#buckets');
    this.passEl = page.locator('#pass');
    this.totalPassesEl = page.locator('#totalPasses');
    this.digitIndexEl = page.locator('#digitIndex');
    this.currentBaseEl = page.locator('#currentBase');
    this.details = page.locator('#details');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setSize(value) {
    await this.size.fill(String(value));
  }

  async setMaxVal(value) {
    await this.maxval.fill(String(value));
  }

  // Change base select and ensure change event fires
  async setBase(value) {
    await this.base.selectOption(String(value));
  }

  // Set speed range input and dispatch input event to update UI
  async setSpeed(value) {
    await this.page.evaluate(
      ({ v }) => {
        const el = document.getElementById('speed');
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      { v: String(value) }
    );
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickExplainToggle() {
    await this.explainToggle.click();
  }

  async arrayCount() {
    return await this.arrayRow.locator('.item').count();
  }

  async bucketsCount() {
    return await this.buckets.locator('.bucket').count();
  }

  async bucketItemsCount(bucketIndex) {
    const bucket = this.buckets.locator(`.bucket[data-bucket="${bucketIndex}"]`);
    return await bucket.locator('.bucket-list .item').count();
  }

  async getPass() {
    return (await this.passEl.textContent()).trim();
  }

  async getTotalPasses() {
    return (await this.totalPassesEl.textContent()).trim();
  }

  async getDigitIndex() {
    return (await this.digitIndexEl.textContent()).trim();
  }

  async getCurrentBase() {
    return (await this.currentBaseEl.textContent()).trim();
  }

  async getSpeedVal() {
    return (await this.speedVal.textContent()).trim();
  }

  async getStartBtnText() {
    return (await this.startBtn.textContent()).trim();
  }

  async getDetailsDisplay() {
    return await this.page.evaluate(() => {
      const d = document.getElementById('details');
      return d ? d.style.display || window.getComputedStyle(d).display : '';
    });
  }

  // Utility to wait until pass count becomes > 0 (used to observe progress)
  async waitForPassesGreaterThan(count, timeout = 5000) {
    await expect.poll(async () => {
      const val = parseInt(await this.getPass(), 10);
      return isNaN(val) ? 0 : val;
    }, { timeout }).toBeGreaterThan(count);
  }

  // Utility to wait until total passes is a number > 0
  async waitForTotalPasses(timeout = 2000) {
    await expect.poll(async () => {
      const t = await this.getTotalPasses();
      const n = parseInt(t, 10);
      return isNaN(n) ? 0 : n;
    }, { timeout }).toBeGreaterThan(0);
  }
}

test.describe('Radix Sort Visualizer (LSD) - FSM states & interactions', () => {
  // Collect console errors and page errors for each test case
  test.beforeEach(async ({ page }) => {
    // attach listeners early to capture errors during load
    page['_consoleErrors'] = [];
    page['_pageErrors'] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        page['_consoleErrors'].push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      page['_pageErrors'].push(err && err.message ? err.message : String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert that no console errors or page errors occurred during the test
    // This validates that the application runs without uncaught runtime errors
    const consoleErrors = page['_consoleErrors'] || [];
    const pageErrors = page['_pageErrors'] || [];

    // Provide helpful diagnostics in failures
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('Initial load renders an array and buckets (S0_Idle -> S1_Generated on init)', async ({ page }) => {
    // This test checks initial render that should create an array and buckets.
    const rp = new RadixPage(page);
    await rp.goto();

    // Confirm array is rendered (default size 12)
    const arrCount = await rp.arrayCount();
    expect(arrCount).toBeGreaterThanOrEqual(2); // at least 2 as minimum
    expect(arrCount).toBeLessThanOrEqual(40); // within the defined max

    // Buckets should be rendered according to current base (default is 10)
    const bucketsCount = await rp.bucketsCount();
    expect(bucketsCount).toBeGreaterThanOrEqual(2);
    expect(bucketsCount).toBe(10);

    // Metadata should show base and total passes (digits)
    await rp.waitForTotalPasses();
    const baseText = await rp.getCurrentBase();
    expect(baseText).toBe('10');
    const totalPassesText = await rp.getTotalPasses();
    expect(Number(totalPassesText)).toBeGreaterThan(0);
  });

  test('Generate button creates a new array respecting size bounds and renders buckets (S0_Idle -> S1_Generated)', async ({ page }) => {
    // This test verifies Generate event handling, including clamping of invalid size inputs.
    const rp = new RadixPage(page);
    await rp.goto();

    // Edge case: set size below minimum -> generate should clamp to 2
    await rp.setSize('1'); // invalid low
    await rp.setMaxVal('50');
    await rp.clickGenerate();

    const arrCount = await rp.arrayCount();
    expect(arrCount).toBeGreaterThanOrEqual(2);

    // Now set a reasonable size and generate
    await rp.setSize('6');
    await rp.setMaxVal('99');
    await rp.clickGenerate();
    const arrCount2 = await rp.arrayCount();
    expect(arrCount2).toBe(6);

    // Buckets reflect current base (default 10)
    const bucketsCount = await rp.bucketsCount();
    expect(bucketsCount).toBe(10);
  });

  test('Start button toggles running/paused states and auto-progresses (S1_Generated <-> S2_Running <-> S3_Paused)', async ({ page }) => {
    // This test toggles Start to begin automatic stepping and verifies progress (pass count increments),
    // then toggles again to pause.
    const rp = new RadixPage(page);
    await rp.goto();

    // Use small array and fast speed to observe progress quickly
    await rp.setSize('6');
    await rp.setMaxVal('31'); // keep small so total digits not huge
    await rp.setBase('2'); // binary -> likely more digits but small maxval keeps it reasonable
    await rp.setSpeed(100);
    await rp.clickGenerate();

    // Ensure generate produced expected counts
    expect(await rp.arrayCount()).toBe(6);
    expect(await rp.bucketsCount()).toBe(2);
    expect(await rp.getCurrentBase()).toBe('2');

    // Start the auto animation
    await rp.clickStart();
    // start button text should change to Pause when running
    await expect.poll(async () => await rp.getStartBtnText(), { timeout: 2000 }).toBe('Pause');

    // Wait until at least one pass is completed (progress)
    await rp.waitForPassesGreaterThan(0, 5000);

    // Pause the animation
    await rp.clickStart();
    await expect.poll(async () => await rp.getStartBtnText(), { timeout: 2000 }).toBe('Start');
  });

  test('Step button advances sorting small steps and can reach Done (S2_Running -> S4_Collecting -> S5_Done)', async ({ page }) => {
    // This test uses Step clicks to drive the algorithm to completion for a small dataset.
    const rp = new RadixPage(page);
    await rp.goto();

    // Small data for deterministic step-through
    await rp.setSize('5');
    await rp.setMaxVal('15'); // max 15 keeps digits small (in base 2 or 10)
    await rp.setBase('2');
    await rp.setSpeed(100);
    await rp.clickGenerate();

    // Fetch the total number of passes we need to complete (digits)
    const totalPassesText = await rp.getTotalPasses();
    const totalPasses = parseInt(totalPassesText, 10);
    expect(totalPasses).toBeGreaterThanOrEqual(1);

    // Perform repeated steps until passesCompleted equals totalPasses OR timeout
    const maxSteps = 500; // generous upper bound
    let completed = false;
    for (let i = 0; i < maxSteps; i++) {
      await rp.clickStep();
      // small delay to allow UI to update
      await page.waitForTimeout(20);

      // If done, digitIndex shows '-' per implementation; also passEl equals totalPasses
      const pass = parseInt(await rp.getPass(), 10);
      const digitIndex = await rp.getDigitIndex();
      if (!isNaN(pass) && pass >= totalPasses && (digitIndex === '-' || digitIndex === String(totalPasses))) {
        completed = true;
        break;
      }
    }

    expect(completed, 'Expected sorting to reach Done via repeated Step clicks').toBeTruthy();

    // After completion, ensure Start button text is 'Start' (implementation sets it)
    expect(await rp.getStartBtnText()).toBe('Start');

    // Final array should have same number of items as initial size
    expect(await rp.arrayCount()).toBe(5);
  });

  test('Reset returns to initial prepared state after partial work (Reset event)', async ({ page }) => {
    // This test performs some steps, then resets and verifies state resets but array remains same length.
    const rp = new RadixPage(page);
    await rp.goto();

    await rp.setSize('6');
    await rp.setMaxVal('50');
    await rp.setBase('10');
    await rp.setSpeed(200);
    await rp.clickGenerate();

    // Do a few steps
    for (let i = 0; i < 3; i++) {
      await rp.clickStep();
      await page.waitForTimeout(30);
    }

    // Now reset
    await rp.clickReset();

    // After reset, pass should be 0 and array restored to initial length
    expect(await rp.getPass()).toBe('0');
    const arrCount = await rp.arrayCount();
    expect(arrCount).toBe(6);

    // Buckets re-rendered and exist (count equals base)
    const bucketsCount = await rp.bucketsCount();
    expect(bucketsCount).toBe(10);
  });

  test('Changing speed updates display and restarts auto-timer when running (ChangeSpeed event)', async ({ page }) => {
    // This test ensures the speed control updates the UI value and that when running the auto-timer adapts.
    const rp = new RadixPage(page);
    await rp.goto();

    await rp.setSize('5');
    await rp.setMaxVal('20');
    await rp.setBase('10');
    await rp.clickGenerate();

    // Start the auto-run
    await rp.setSpeed(700);
    await rp.clickStart();
    await expect.poll(async () => await rp.getStartBtnText(), { timeout: 2000 }).toBe('Pause');

    // Change speed - this should update speed display and restart the interval if running
    await rp.setSpeed(300);
    expect(await rp.getSpeedVal()).toContain('300ms');

    // Give a short amount of time to let the interval tick with new speed
    await page.waitForTimeout(600);

    // Pause back
    await rp.clickStart();
    expect(await rp.getStartBtnText()).toBe('Start');
  });

  test('Changing base repopulates buckets (ChangeBase event) and updates metadata', async ({ page }) => {
    // This test changes the radix base and verifies that buckets and metadata update accordingly.
    const rp = new RadixPage(page);
    await rp.goto();

    await rp.setSize('6');
    await rp.setMaxVal('255');
    await rp.setBase('10');
    await rp.clickGenerate();

    // Change base to 16 (hex)
    await rp.setBase('16');

    // currentBase should reflect new value
    expect(await rp.getCurrentBase()).toBe('16');

    // buckets count should now equal 16
    const bucketsCount = await rp.bucketsCount();
    expect(bucketsCount).toBe(16);

    // Verify that pseudocode and details are still present (smoke check)
    expect(await rp.getTotalPasses()).toMatch(/\d+/);
  });

  test('Toggle Explanation shows and hides details (ToggleExplanation event)', async ({ page }) => {
    // This test verifies the explanation details area toggles display state.
    const rp = new RadixPage(page);
    await rp.goto();

    // Initially details are visible (no inline style or display block)
    const initialDisplay = await rp.getDetailsDisplay();
    // Toggle once -> should hide (set to 'none')
    await rp.clickExplainToggle();
    const afterHide = await rp.getDetailsDisplay();
    expect(afterHide).toBe('none');

    // Toggle again -> should show (style.block or empty string depending on computed style)
    await rp.clickExplainToggle();
    const afterShow = await rp.getDetailsDisplay();
    // Accept either 'block' or '' (empty) since computed style could be returned
    expect(['block', '', 'inline', 'initial']).toContain(afterShow || '');
  });
});