import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32e354-ffc5-11f0-8b43-1ffa87931c43.html';

class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    this._boundConsole = (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    };
    this._boundPageError = (err) => {
      // pageerror delivers Error objects
      this.pageErrors.push(err);
    };
  }

  async init() {
    // attach listeners before navigation to capture early errors
    this.page.on('console', this._boundConsole);
    this.page.on('pageerror', this._boundPageError);
    await this.page.goto(APP_URL);
    // wait for initial render: container has children
    await this.page.waitForSelector('#array .bar');
  }

  async dispose() {
    this.page.off('console', this._boundConsole);
    this.page.off('pageerror', this._boundPageError);
  }

  async clickGenerate() {
    await this.page.click('#generateBtn');
  }

  async clickStart() {
    await this.page.click('#startBtn');
  }

  async isGenerateDisabled() {
    return this.page.$eval('#generateBtn', (btn) => btn.disabled);
  }

  async isStartDisabled() {
    return this.page.$eval('#startBtn', (btn) => btn.disabled);
  }

  // returns array of numeric values shown in bars
  async getArrayValues() {
    return this.page.$$eval('#array .bar', (bars) =>
      bars.map((b) => Number(b.textContent.trim()))
    );
  }

  // returns array of inline background-color styles (may be empty string)
  async getBarsInlineBackgrounds() {
    return this.page.$$eval('#array .bar', (bars) =>
      bars.map((b) => b.style.backgroundColor || '')
    );
  }

  async getBarsComputedBackgrounds() {
    return this.page.$$eval('#array .bar', (bars) =>
      bars.map((b) => window.getComputedStyle(b).backgroundColor)
    );
  }

  async getBarsHeights() {
    return this.page.$$eval('#array .bar', (bars) =>
      bars.map((b) => b.style.height || '')
    );
  }

  // Wait until generate button becomes enabled again indicating sorting completion.
  // Use large timeout because visualization uses delays.
  async waitForSortingComplete(timeout = 180000) {
    await this.page.waitForFunction(
      () => {
        const btn = document.getElementById('generateBtn');
        return btn && btn.disabled === false;
      },
      { timeout }
    );
  }

  // Wait for any bar to have a computed background color matching provided rgb value
  async waitForAnyBarColor(rgbString, timeout = 5000) {
    // rgbString like "rgb(231, 76, 60)" or "rgb(39, 174, 96)"
    await this.page.waitForFunction(
      (rgb) => {
        const bars = Array.from(document.querySelectorAll('#array .bar'));
        return bars.some((b) => window.getComputedStyle(b).backgroundColor === rgb);
      },
      rgbString,
      { timeout }
    );
  }

  // check if array is sorted ascending
  static isSortedAscending(arr) {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i - 1] > arr[i]) return false;
    }
    return true;
  }
}

test.describe('Merge Sort Visualization FSM (5a32e354-ffc5-11f0-8b43-1ffa87931c43)', () => {
  // Each test will create its own page and MergeSortPage instance
  test('Initial Idle state (S0_Idle): page loads and initial array is rendered', async ({ page }) => {
    const msPage = new MergeSortPage(page);
    await msPage.init();

    // Comments: Validate the initial setup (S0_Idle)
    // - array is created on load and rendered
    // - there are ARRAY_SIZE bars (15)
    // - no obvious console or page errors occurred during load
    const bars = await page.$$('#array .bar');
    expect(bars.length).toBe(15);

    const values = await msPage.getArrayValues();
    expect(values.length).toBe(15);
    // Each bar's height should equal value * 3 px (as per implementation)
    const heights = await msPage.getBarsHeights();
    for (let i = 0; i < values.length; i++) {
      const expected = `${values[i] * 3}px`;
      expect(heights[i]).toBe(expected);
    }

    // Assert no JS errors were thrown during initial load
    expect(msPage.pageErrors.length).toBe(0);
    expect(msPage.consoleErrors.length).toBe(0);

    await msPage.dispose();
  });

  test('Generate Array event (S0_Idle -> S1_ArrayGenerated): clicking Generate creates and displays a new array', async ({ page }) => {
    const msPage = new MergeSortPage(page);
    await msPage.init();

    // Capture current values
    const beforeValues = await msPage.getArrayValues();

    // Click Generate Array
    await msPage.clickGenerate();

    // After generating, confirm array is re-rendered and still has 15 bars
    await page.waitForSelector('#array .bar');
    const afterValues = await msPage.getArrayValues();
    expect(afterValues.length).toBe(15);

    // It's possible (rarely) to generate identical arrays; assert that at least something valid happened:
    // - values are numbers and within expected range (>=5)
    expect(afterValues.every((v) => typeof v === 'number' && v >= 5)).toBeTruthy();

    // The Start button should be enabled after generating (implementation sets startBtn.disabled = false)
    const startDisabled = await msPage.isStartDisabled();
    expect(startDisabled).toBe(false);

    // No errors on console or page
    expect(msPage.pageErrors.length).toBe(0);
    expect(msPage.consoleErrors.length).toBe(0);

    await msPage.dispose();
  });

  test('Start Merge Sort event & transitions (S1_ArrayGenerated -> S2_Sorting -> S3_Sorted): sorting disables buttons and results in sorted array', async ({ page }) => {
    // This test may take longer because the visualization intentionally delays steps.
    test.setTimeout(180000); // extend timeout to 3 minutes

    const msPage = new MergeSortPage(page);
    await msPage.init();

    // Ensure we have an array generated state (S1). Click generate to explicitly enter S1.
    await msPage.clickGenerate();

    // Click Start to begin sorting (transition to S2)
    await msPage.clickStart();

    // Immediately after clicking Start, both buttons should be disabled (exit actions from S1 -> S2)
    const [generateDisabledDuring, startDisabledDuring] = await Promise.all([
      msPage.isGenerateDisabled(),
      msPage.isStartDisabled(),
    ]);
    expect(generateDisabledDuring).toBe(true);
    expect(startDisabledDuring).toBe(true);

    // While sorting, visual cues should appear:
    // red highlight for comparing (#e74c3c -> rgb(231, 76, 60))
    // or green highlight for merge (#27ae60 -> rgb(39, 174, 96))
    // Wait for at least one of these colors to appear on any bar within a reasonable time.
    const sawRed = await (async () => {
      try {
        await msPage.waitForAnyBarColor('rgb(231, 76, 60)', 8000);
        return true;
      } catch {
        return false;
      }
    })();
    const sawGreen = await (async () => {
      try {
        await msPage.waitForAnyBarColor('rgb(39, 174, 96)', 8000);
        return true;
      } catch {
        return false;
      }
    })();

    // It's acceptable to see at least one of these visual highlights during sorting.
    expect(sawRed || sawGreen).toBeTruthy();

    // Wait for sorting to complete by observing generateBtn becomes enabled again (S3 entry renders final array)
    await msPage.waitForSortingComplete(150000); // allow up to 150s for full visualization in worst cases

    // After sorting completes (S3), generateBtn should be enabled, startBtn should stay disabled (until generate is clicked)
    const generateDisabledAfter = await msPage.isGenerateDisabled();
    const startDisabledAfter = await msPage.isStartDisabled();
    expect(generateDisabledAfter).toBe(false);
    // Implementation sets startBtn.disabled = true when sorting starts and does NOT re-enable startBtn; expect true
    expect(startDisabledAfter).toBe(true);

    // Validate final array is sorted ascending
    const finalValues = await msPage.getArrayValues();
    const sorted = MergeSortPage.isSortedAscending(finalValues);
    expect(sorted).toBe(true);

    // Validate DOM has proper rendering: each bar's height still equals value * 3 px
    const heights = await msPage.getBarsHeights();
    for (let i = 0; i < finalValues.length; i++) {
      const expected = `${finalValues[i] * 3}px`;
      expect(heights[i]).toBe(expected);
    }

    // No errors occurred during the sorting run
    expect(msPage.pageErrors.length).toBe(0);
    expect(msPage.consoleErrors.length).toBe(0);

    await msPage.dispose();
  });

  test('Edge case: Clicking Start without explicit Generate (S0_Idle -> S2_Sorting) should begin sorting the initial array', async ({ page }) => {
    // This test may also need extra time to wait for completion
    test.setTimeout(120000);

    const msPage = new MergeSortPage(page);
    await msPage.init();

    // At initial load the page has already created an array. Try starting directly.
    await msPage.clickStart();

    // Buttons should become disabled immediately
    expect(await msPage.isGenerateDisabled()).toBe(true);
    expect(await msPage.isStartDisabled()).toBe(true);

    // Wait for sorting to complete (observe generateBtn re-enabled)
    await msPage.waitForSortingComplete(120000);

    // After sorting, ensure array is sorted
    const finalValues = await msPage.getArrayValues();
    expect(MergeSortPage.isSortedAscending(finalValues)).toBe(true);

    // No page or console errors
    expect(msPage.pageErrors.length).toBe(0);
    expect(msPage.consoleErrors.length).toBe(0);

    await msPage.dispose();
  });

  test('During Sorting buttons remain disabled and Generate cannot be triggered (S2 behavior)', async ({ page }) => {
    test.setTimeout(120000);

    const msPage = new MergeSortPage(page);
    await msPage.init();

    // Start sorting
    await msPage.clickGenerate(); // ensure fresh array
    await msPage.clickStart();

    // Confirm they are disabled
    expect(await msPage.isGenerateDisabled()).toBe(true);
    expect(await msPage.isStartDisabled()).toBe(true);

    // Attempt to click Generate while disabled - Playwright will throw if we try to click a disabled button normally.
    // Instead, verify that the element has disabled attribute and cannot be clicked by trying to call click via DOM (but we must not inject code).
    // So we assert the disabled attribute exists and remains true during sorting, and that clicking via Playwright is rejected.
    const generateHandle = await page.$('#generateBtn');
    const disabledAttr = await generateHandle.getAttribute('disabled');
    // The attribute may be null since disabled property might be true but attribute removed; therefore assert property state
    expect(await msPage.isGenerateDisabled()).toBe(true);

    // Confirm that while sorting, the bars continue to change (i.e., visualization is active) by sampling a bar's height
    const beforeHeights = await msPage.getBarsHeights();
    // Wait a short time and sample again to ensure animation/updates happening
    await page.waitForTimeout(1500);
    const afterHeights = await msPage.getBarsHeights();

    // At least one bar's height should have changed during active sorting (unless sorting finished extremely fast)
    const anyChange = beforeHeights.some((h, i) => h !== afterHeights[i]);
    expect(anyChange).toBe(true);

    // Wait for completion to clean up
    await msPage.waitForSortingComplete(120000);

    // No errors
    expect(msPage.pageErrors.length).toBe(0);
    expect(msPage.consoleErrors.length).toBe(0);

    await msPage.dispose();
  });

  test('Console and page error observation: assert that no unexpected runtime errors occur during typical flows', async ({ page }) => {
    const msPage = new MergeSortPage(page);
    await msPage.init();

    // Perform a typical flow: generate -> start -> wait complete
    await msPage.clickGenerate();
    await msPage.clickStart();

    // Wait for start to disable and then completion
    await msPage.waitForFunction(
      () => document.getElementById('generateBtn') && document.getElementById('generateBtn').disabled === false,
      {},
      // use a generous timeout in case visualization is long
      { timeout: 150000 }
    ).catch(() => {}); // ignore timeout here, we'll still assert errors below

    // Assert that no page.error events (unhandled exceptions) were emitted
    // and that no console.error messages were logged.
    expect(msPage.pageErrors.length).toBe(0);
    expect(msPage.consoleErrors.length).toBe(0);

    await msPage.dispose();
  });
});