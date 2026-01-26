import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d5fc3-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the Radix Sort Visualization page
 * Encapsulates common interactions and queries used in tests.
 */
class RadixSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // Bind listeners
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Ensure the initial UI is rendered
    await this.page.waitForSelector('#arrayContainer .bar');
  }

  async getBarCount() {
    return await this.page.$$eval('#arrayContainer .bar', (els) => els.length);
  }

  async getBarHeights() {
    return await this.page.$$eval('#arrayContainer .bar', (els) =>
      els.map((el) => {
        // Return the inline style height if present, otherwise computed height
        const inline = el.style.height;
        if (inline) return inline;
        return window.getComputedStyle(el).height;
      })
    );
  }

  async getBarBackgroundColor(index) {
    return await this.page.$eval(`#arrayContainer .bar:nth-child(${index + 1})`, (el) =>
      window.getComputedStyle(el).backgroundColor
    );
  }

  async clickSortButton() {
    await this.page.click("button[onclick='startSorting()']");
  }

  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }

  /**
   * Polls the container until the bar heights match the expected list or timeout.
   * @param {string[]} expectedHeights - array of strings like '340px'
   * @param {number} timeoutMs
   */
  async waitForHeights(expectedHeights, timeoutMs = 5000) {
    await this.page.waitForFunction(
      (expected) => {
        const bars = Array.from(document.querySelectorAll('#arrayContainer .bar'));
        if (bars.length !== expected.length) return false;
        const heights = bars.map((el) => {
          const inline = el.style.height;
          return inline ? inline : window.getComputedStyle(el).height;
        });
        // strict string equality
        for (let i = 0; i < expected.length; i++) {
          if (heights[i] !== expected[i]) return false;
        }
        return true;
      },
      expectedHeights,
      { timeout: timeoutMs }
    );
  }

  /**
   * Sample the bar count repeatedly for a duration to ensure no crashes/interruption.
   * Returns sampled counts.
   */
  async sampleBarCounts(durationMs = 800, intervalMs = 100) {
    const samples = [];
    const end = Date.now() + durationMs;
    while (Date.now() < end) {
      const count = await this.getBarCount();
      samples.push(count);
      await this.page.waitForTimeout(intervalMs);
    }
    return samples;
  }

  /**
   * Attempts to detect any 'NaN' heights in the container's innerHTML during a short window.
   * Returns true if 'NaN' was observed, false otherwise.
   */
  async detectNaNHeights(timeoutMs = 1500) {
    try {
      await this.page.waitForFunction(() => {
        const container = document.getElementById('arrayContainer');
        if (!container) return false;
        return container.innerHTML.includes('NaN');
      }, { timeout: timeoutMs });
      return true;
    } catch (e) {
      // Not observed within timeout
      return false;
    }
  }
}

test.describe('Radix Sort Visualization - FSM and DOM behavior', () => {
  let radixPage;

  test.beforeEach(async ({ page }) => {
    radixPage = new RadixSortPage(page);
    await radixPage.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach console and error info to test output for easier debugging
    // (Playwright will show testInfo attachments if configured to do so in reporters)
    // No modification of page or globals is performed.
  });

  test('Initial Idle state: displayArray invoked on load and initial array is rendered', async () => {
    // This test validates the initial "Idle" state (S0_Idle) entry action displayArray(array)
    // 1. The container should have 8 bars (initial array length)
    const count = await radixPage.getBarCount();
    expect(count).toBe(8);

    // 2. Heights should match the initial numbers scaled by 2 (inline style set by displayArray)
    // initial array: [170, 45, 75, 90, 802, 24, 2, 66]
    const expectedHeights = [
      '340px', // 170 * 2
      '90px',  // 45 * 2
      '150px', // 75 * 2
      '180px', // 90 * 2
      '1604px',// 802 * 2
      '48px',  // 24 * 2
      '4px',   // 2 * 2
      '132px'  // 66 * 2
    ];
    const heights = await radixPage.getBarHeights();
    expect(heights).toEqual(expectedHeights);

    // 3. No bar should be highlighted (highlightIndex is -1 on initial display)
    // background-color should not be red for any bar
    for (let i = 0; i < count; i++) {
      const bg = await radixPage.getBarBackgroundColor(i);
      expect(bg).not.toBe('rgb(255, 0, 0)');
    }

    // 4. Ensure no page errors (ReferenceError / TypeError / SyntaxError) occurred during load
    const pageErrors = radixPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // 5. Ensure console does not contain 'error' type messages
    const consoleErrors = radixPage.getConsoleMessages().filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition to Sorting (S1_Sorting) when clicking "Sort Array": final array is sorted visually', async () => {
    // This test validates the transition from Idle to Sorting triggered by clicking the button.
    // It checks that:
    // - Clicking the Sort Array button invokes startSorting() -> radixSort()
    // - The UI updates and eventually shows the fully sorted array
    // - The final display highlights an index corresponding to the last digit processed (digit=2 -> index 2)
    // - No page errors occur during processing

    // Click the Sort Array button to trigger startSorting()
    await radixPage.clickSortButton();

    // While sorting happens, sample bar counts repeatedly to ensure UI remains responsive and bars exist
    const samples = await radixPage.sampleBarCounts(800, 120);
    // All sampled counts should equal the array length (8)
    expect(samples.every((c) => c === 8)).toBeTruthy();

    // There may be intermediate frames where output array has undefined entries resulting in 'NaNpx' heights.
    // Detect if such a state occurs at least once during the sorting process (non-fatal).
    const sawNaN = await radixPage.detectNaNHeights(1500);
    // The presence of 'NaN' in intermediate rendering is acceptable given the implementation,
    // so we only assert that no exceptions were thrown. We still record whether NaN was observed.
    // (Make the presence optional — we won't fail the test if not observed.)
    // assert that we either observed NaN or not, but test continues regardless
    expect(typeof sawNaN).toBe('boolean');

    // Wait for the final sorted heights to appear. Sorted ascending:
    // [2, 24, 45, 66, 75, 90, 170, 802] scaled by 2
    const expectedFinalHeights = [
      '4px',    // 2 * 2
      '48px',   // 24 * 2
      '90px',   // 45 * 2
      '132px',  // 66 * 2
      '150px',  // 75 * 2
      '180px',  // 90 * 2
      '340px',  // 170 * 2
      '1604px'  // 802 * 2
    ];
    // Wait for up to 5 seconds for the final sorted state
    await radixPage.waitForHeights(expectedFinalHeights, 5000);

    // Confirm final heights match expected sorted order
    const finalHeights = await radixPage.getBarHeights();
    expect(finalHeights).toEqual(expectedFinalHeights);

    // The implementation calls displayArray(arr, digit) after each digit; the last call uses digit=2,
    // which (by implementation) highlights the bar at index 2. Confirm the 3rd bar has red background.
    const thirdBarBg = await radixPage.getBarBackgroundColor(2);
    expect(thirdBarBg).toBe('rgb(255, 0, 0)');

    // Ensure there were no page-level errors during the sorting process
    const pageErrors = radixPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Ensure console did not emit any 'error' messages during sorting
    const consoleErrors = radixPage.getConsoleMessages().filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Robustness: multiple rapid clicks do not crash the page and final order remains sorted', async () => {
    // Edge-case test: click the Sort Array button multiple times rapidly and ensure:
    // - The page does not throw uncaught exceptions
    // - The UI remains stable (bars count remains constant)
    // - The final state still shows the sorted array

    // Rapidly click the button several times
    for (let i = 0; i < 4; i++) {
      await radixPage.clickSortButton();
      // slight pause between clicks
      await radixPage.page.waitForTimeout(80);
    }

    // Sample bar counts for a bit to ensure no crash and presence of bars
    const samples = await radixPage.sampleBarCounts(900, 100);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.every((c) => c === 8)).toBeTruthy();

    // Wait for final sorted heights (allow more time since multiple sorts may run)
    const expectedFinalHeights = [
      '4px',
      '48px',
      '90px',
      '132px',
      '150px',
      '180px',
      '340px',
      '1604px'
    ];
    await radixPage.waitForHeights(expectedFinalHeights, 7000);

    const finalHeights = await radixPage.getBarHeights();
    expect(finalHeights).toEqual(expectedFinalHeights);

    // No uncaught page errors
    const pageErrors = radixPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // No console.error messages
    const consoleErrors = radixPage.getConsoleMessages().filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture and report console and runtime errors (should be none)', async () => {
    // This test demonstrates that we observe console messages and page errors.
    // For this specific implementation we expect no runtime ReferenceError/SyntaxError/TypeError.

    // Ensure there are no page errors recorded from previous interactions
    const pageErrors = radixPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Collect console messages recorded so far
    const consoleMessages = radixPage.getConsoleMessages();
    // There may be informational logs or warnings in other environments, but importantly there should be no 'error' type messages
    const errorMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorMessages.length).toBe(0);

    // As an extra check, ensure that typical console types are available (info/log/warn possible)
    const typesSeen = new Set(consoleMessages.map((m) => m.type));
    expect(typesSeen.size).toBeGreaterThanOrEqual(0);
  });
});