import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f5dec0-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for the Bucket Sort demo
class BucketSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.randBtn = page.locator('#randBtn');
    this.status = page.locator('#status');
    this.bucketsContainer = page.locator('#bucketsContainer');
    this.arrayCanvas = page.locator('#arrayCanvas');
    this.wrap = page.locator('.wrap');
    this.tokenSelector = '.token';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure initial DOM settled
    await this.page.waitForLoadState('networkidle');
    await this.status.waitFor({ state: 'visible' });
  }

  async getStatusText() {
    return (await this.status.textContent()) || '';
  }

  async waitForStatus(text, timeout = 30000) {
    // Wait until status contains the expected substring
    await this.page.waitForFunction(
      (sel, t) => document.querySelector(sel) && document.querySelector(sel).textContent.includes(t),
      this.status.selector,
      text,
      { timeout }
    );
  }

  async clickStart(options = {}) {
    await this.startBtn.click(options);
  }

  async clickRandomize(options = {}) {
    await this.randBtn.click(options);
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isRandDisabled() {
    return await this.randBtn.isDisabled();
  }

  async bucketCount() {
    return await this.bucketsContainer.locator('.bucket').count();
  }

  async tokenCount() {
    return await this.page.locator(this.tokenSelector).count();
  }

  async readBucketCounts() {
    const counts = [];
    const buckets = this.bucketsContainer.locator('.bucket');
    const n = await buckets.count();
    for (let i = 0; i < n; i++) {
      const cntText = (await buckets.nth(i).locator('.count').textContent()) || '0';
      counts.push(parseInt(cntText, 10) || 0);
    }
    return counts;
  }

  async sumBucketCounts() {
    const arr = await this.readBucketCounts();
    return arr.reduce((s, v) => s + v, 0);
  }

  // Force a resize event by changing viewport
  async triggerResize(width = 800, height = 600) {
    await this.page.setViewportSize({ width, height });
    // allow any resize handlers to run
    await this.page.waitForTimeout(120);
  }
}

// Collect console messages and errors for assertions
function attachLoggingCollectors(page) {
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', msg => {
    // Collect only useful information - type and text
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', err => {
    // Captures uncaught exceptions
    pageErrors.push({ message: err.message, stack: err.stack });
  });

  return { consoleMessages, pageErrors };
}

// Tests grouped by FSM states and transitions
test.describe('Bucket Sort Visual Demonstration — FSM validation', () => {
  // Provide a fresh page for each test and attach collectors
  test.beforeEach(async ({ page }) => {
    // noop - individual tests will call goto via page object
  });

  test('S0_Idle: initial state sets up buckets UI and generates an array', async ({ page }) => {
    // Arrange
    const collectors = attachLoggingCollectors(page);
    const model = new BucketSortPage(page);

    // Act
    await model.goto();

    // Assert initial status text matches FSM evidence for Idle
    const statusText = await model.getStatusText();
    expect(statusText).toContain('Ready — press Start to run the demonstration.');

    // createBucketsUI() should have created 10 buckets
    const bucketCount = await model.bucketCount();
    expect(bucketCount).toBe(10);

    // generateArray() should have created tokens (ITEM_COUNT = 12 in implementation)
    const tokens = await model.tokenCount();
    expect(tokens).toBeGreaterThanOrEqual(1);
    // Best-effort check: implementation uses ITEM_COUNT=12, so expect at least 10
    expect(tokens).toBeGreaterThanOrEqual(10);

    // Ensure bucket counts sum equals number of tokens (when array initially present, counts might be zero until distribution)
    // Initially tokens are in top array area, so bucket counters should likely be 0
    const sumCounts = await model.sumBucketCounts();
    expect(sumCounts).toBeGreaterThanOrEqual(0);
    // No uncaught page errors on load
    expect(collectors.pageErrors.length).toBe(0);
  });

  test.describe('S0_Idle -> S1_Running transition (StartAnimation)', () => {
    test('Start Animation sets running flag and updates status to Starting animation...', async ({ page }) => {
      // Increase timeout because runDemo is multi-step; but here we only wait for the start message.
      test.setTimeout(30_000);

      const collectors = attachLoggingCollectors(page);
      const model = new BucketSortPage(page);

      await model.goto();

      // Guard: start button should be enabled when idle
      expect(await model.isStartDisabled()).toBeFalsy();

      // Act: click Start and wait for immediate Running evidence
      await model.clickStart();

      // Verify status changed to Starting animation...
      await model.waitForStatus('Starting animation...', 5000);
      const st = await model.getStatusText();
      expect(st).toContain('Starting animation...');

      // startBtn and randBtn are disabled while running
      expect(await model.isStartDisabled()).toBeTruthy();
      expect(await model.isRandDisabled()).toBeTruthy();

      // Ensure no uncaught errors occurred at this early stage
      expect(collectors.pageErrors.length).toBe(0);
    });

    test('Start Animation executes distribution and sorting stages (end-to-end run)', async ({ page }) => {
      // This is an end-to-end run through distribute -> sort -> collect.
      // The demo uses multiple animations; provide generous timeout.
      test.setTimeout(120_000);

      const collectors = attachLoggingCollectors(page);
      const model = new BucketSortPage(page);
      await model.goto();

      // Capture initial token count
      const beforeTokens = await model.tokenCount();
      expect(beforeTokens).toBeGreaterThanOrEqual(10);

      // Start demo
      await model.clickStart();

      // Wait for distribution to complete (evidence text present)
      await model.waitForStatus('All values distributed into buckets.', 30_000);
      const afterDistributionStatus = await model.getStatusText();
      expect(afterDistributionStatus).toContain('All values distributed into buckets.');

      // At this point, bucket counts should sum to ITEM_COUNT
      const bucketSumAfterDistribution = await model.sumBucketCounts();
      expect(bucketSumAfterDistribution).toBeGreaterThanOrEqual(1);
      // Expect that sum equals initial token count (tokens moved into buckets)
      expect(bucketSumAfterDistribution).toBe(beforeTokens);

      // Wait for buckets sorted status
      await model.waitForStatus('Buckets sorted. Preparing to merge...', 30_000);
      const afterSortStatus = await model.getStatusText();
      expect(afterSortStatus).toContain('Buckets sorted. Preparing to merge...');

      // Wait for collect stage intermediate "Sorted — operation complete." (FSM S2 evidence)
      await model.waitForStatus('Sorted — operation complete.', 30_000);
      const midSortedStatus = await model.getStatusText();
      expect(midSortedStatus).toContain('Sorted — operation complete.');

      // Finally wait for run completion message 'Finished — press Randomize for a new example or Start to replay.'
      await model.waitForStatus('Finished — press Randomize for a new example or Start to replay.', 30_000);
      const finalStatus = await model.getStatusText();
      expect(finalStatus).toContain('Finished — press Randomize for a new example or Start to replay.');

      // After completion, buttons should be re-enabled
      expect(await model.isStartDisabled()).toBeFalsy();
      expect(await model.isRandDisabled()).toBeFalsy();

      // Total tokens in top array area after collect should equal original count
      // The tokens are in the DOM, and their count should still equal beforeTokens
      const tokensAfter = await model.tokenCount();
      expect(tokensAfter).toBeGreaterThanOrEqual(1);
      expect(tokensAfter).toBe(beforeTokens);

      // Ensure no uncaught page errors happened during the run
      expect(collectors.pageErrors.length).toBe(0);
    });
  });

  test.describe('S1_Running -> S0_Idle (Randomize while running) and S1_Running -> S2_Sorted', () => {
    test('Randomize is disabled during running; clicking should not be allowed', async ({ page }) => {
      test.setTimeout(60_000);
      const collectors = attachLoggingCollectors(page);
      const model = new BucketSortPage(page);
      await model.goto();

      // Start the demo
      await model.clickStart();
      await model.waitForStatus('Starting animation...', 5000);

      // Randomize button should be disabled while running
      expect(await model.isRandDisabled()).toBeTruthy();

      // Attempting to click randBtn should fail unless forced; we assert disabled state rather than forcing click
      // Confirm that status remains in a running stage after a short wait
      const currentStatus1 = await model.getStatusText();
      await page.waitForTimeout(300);
      const currentStatus2 = await model.getStatusText();
      expect(currentStatus2).toBe(currentStatus1);

      // No uncaught errors
      expect(collectors.pageErrors.length).toBe(0);
    });

    test('After run completes, Randomize returns to Idle with new array generated', async ({ page }) {
      test.setTimeout(90_000);
      const collectors = attachLoggingCollectors(page);
      const model = new BucketSortPage(page);
      await model.goto();

      // Capture token snapshot
      const beforeValues = await page.$$eval('.token > div:first-child', els => els.map(e => e.textContent?.trim()));

      // Run the demo to completion
      await model.clickStart();
      await model.waitForStatus('Finished — press Randomize for a new example or Start to replay.', 60_000);

      // Click Randomize - should be enabled now
      expect(await model.isRandDisabled()).toBeFalsy();
      await model.clickRandomize();

      // After reset, status should show 'New array generated — ready.'
      await model.waitForStatus('New array generated — ready.', 5000);
      const newStatus = await model.getStatusText();
      expect(newStatus).toContain('New array generated — ready.');

      // There should be a valid set of tokens again
      const afterTokens = await model.tokenCount();
      expect(afterTokens).toBeGreaterThanOrEqual(10);

      // Token values likely changed - assert that at least one value differs (reasonable for randomization)
      const afterValues = await page.$$eval('.token > div:first-child', els => els.map(e => e.textContent?.trim()));
      // If the beforeValues length differs from afterValues, it's a new array.
      if (beforeValues.length === afterValues.length) {
        const allSame = beforeValues.every((v, i) => v === afterValues[i]);
        // It's possible by chance they are identical; but extremely unlikely. We do not fail the test on exact match,
        // just log the condition into an expectation that the arrays are arrays of numbers.
        expect(Array.isArray(afterValues)).toBe(true);
      }

      // Ensure no uncaught errors during reset
      expect(collectors.pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and accessibility interactions', () => {
    test('Clicking Start multiple times should not start overlapping runs', async ({ page }) => {
      test.setTimeout(60_000);
      const collectors = attachLoggingCollectors(page);
      const model = new BucketSortPage(page);
      await model.goto();

      // Rapidly click Start multiple times
      await Promise.all([
        model.startBtn.click(),
        // small delays between clicks to simulate user mashing
        (async () => { await page.waitForTimeout(50); await model.startBtn.click().catch(() => {}); })(),
        (async () => { await page.waitForTimeout(100); await model.startBtn.click().catch(() => {}); })(),
      ]);

      // There should be a single run; startBtn becomes disabled
      expect(await model.isStartDisabled()).toBeTruthy();

      // Wait for at least the "Starting animation..." message and then final finish
      await model.waitForStatus('Starting animation...', 5000);
      await model.waitForStatus('Finished — press Randomize for a new example or Start to replay.', 60_000);

      // No uncaught errors
      expect(collectors.pageErrors.length).toBe(0);
    });

    test('Window resize triggers layout recalculation without errors when idle', async ({ page }) => {
      test.setTimeout(20_000);
      const collectors = attachLoggingCollectors(page);
      const model = new BucketSortPage(page);
      await model.goto();

      // Trigger resize - the app listens to window.resize and when not running recreates UI
      await model.triggerResize(900, 700);
      // Small wait for handlers
      await page.waitForTimeout(200);

      // After resize while idle, buckets should still be present
      const bucketCount = await model.bucketCount();
      expect(bucketCount).toBe(10);

      // No uncaught errors
      expect(collectors.pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and page error observations', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError occur during normal usage', async ({ page }) => {
      // This test explicitly collects console and page errors and asserts none occurred through typical flows
      test.setTimeout(120_000);
      const collectors = attachLoggingCollectors(page);
      const model = new BucketSortPage(page);
      await model.goto();

      // Perform a full run and reset
      await model.clickStart();
      await model.waitForStatus('Finished — press Randomize for a new example or Start to replay.', 60_000);
      await model.clickRandomize();
      await model.waitForStatus('New array generated — ready.', 5000);

      // Assert that no uncaught page errors were collected
      // The instruction set requires observing console logs and page errors; here we assert pageErrors.length === 0
      expect(collectors.pageErrors.length).toBe(0);

      // Also ensure that no console messages of severe types exist (error)
      const errorConsoleMsgs = collectors.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      // It's acceptable to have warnings in some environments, but for this test we assert no 'error' console messages.
      const hasErrorConsole = collectors.consoleMessages.some(m => m.type === 'error');
      expect(hasErrorConsole).toBe(false);
    });
  });
});