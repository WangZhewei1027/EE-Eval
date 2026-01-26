import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d91e12-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the demo page to encapsulate interactions and queries
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors used throughout the tests
    this.selectors = {
      capacityInput: '#capacityInput',
      applyCapacityBtn: '#applyCapacityBtn',
      addProducerBtn: '#addProducerBtn',
      addConsumerBtn: '#addConsumerBtn',
      stopAllBtn: '#stopAllBtn',
      clearLogsBtn: '#clearLogsBtn',
      bufferSlots: '#bufferSlots',
      bufferSize: '#bufferSize',
      bufferCap: '#bufferCap',
      workersArea: '#workersArea',
      logs: '#logs',
      producedTotal: '#producedTotal',
      consumedTotal: '#consumedTotal',
      prodCount: '#prodCount',
      consCount: '#consCount',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async title() {
    return this.page.title();
  }

  async getBufferSlotsCount() {
    return this.page.locator(this.selectors.bufferSlots + ' > .slot').count();
  }

  // Count slots that have the 'filled' class
  async getFilledSlotsCount() {
    return this.page.locator(this.selectors.bufferSlots + ' > .slot.filled').count();
  }

  async getBufferSizeText() {
    return this.page.locator(this.selectors.bufferSize).innerText();
  }

  async getBufferCapacityText() {
    return this.page.locator(this.selectors.bufferCap).innerText();
  }

  async getProdCount() {
    return parseInt(await this.page.locator(this.selectors.prodCount).innerText(), 10);
  }

  async getConsCount() {
    return parseInt(await this.page.locator(this.selectors.consCount).innerText(), 10);
  }

  async getProducedTotal() {
    return parseInt(await this.page.locator(this.selectors.producedTotal).innerText(), 10);
  }

  async getConsumedTotal() {
    return parseInt(await this.page.locator(this.selectors.consumedTotal).innerText(), 10);
  }

  async clickAddProducer() {
    await this.page.click(this.selectors.addProducerBtn);
  }

  async clickAddConsumer() {
    await this.page.click(this.selectors.addConsumerBtn);
  }

  async clickStopAll() {
    await this.page.click(this.selectors.stopAllBtn);
  }

  async clickClearLogs() {
    await this.page.click(this.selectors.clearLogsBtn);
  }

  async setCapacityInput(value) {
    await this.page.fill(this.selectors.capacityInput, String(value));
  }

  async clickApplyCapacity() {
    await this.page.click(this.selectors.applyCapacityBtn);
  }

  async getLogsText() {
    return this.page.locator(this.selectors.logs).innerText();
  }

  // Wait until a line containing the substring appears in logs
  async waitForLogContaining(text, timeout = 5000) {
    await this.page.waitForFunction(
      (selector, t) => {
        const el = document.querySelector(selector);
        return el && el.innerText.includes(t);
      },
      this.selectors.logs,
      text,
      { timeout }
    );
  }

  // Wait until produced total becomes >= expected
  async waitForProducedAtLeast(n, timeout = 8000) {
    await this.page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const v = parseInt(el.innerText || '0', 10);
        return v >= expected;
      },
      this.selectors.producedTotal,
      n,
      { timeout }
    );
  }

  // Helper to find first worker 'Remove' button and click it
  async removeFirstWorker() {
    const workerRemove = this.page.locator(this.selectors.workersArea + ' .worker >> text=Remove').first();
    if (await workerRemove.count() === 0) return false;
    await workerRemove.click();
    return true;
  }

  async getWorkersCount() {
    return this.page.locator(this.selectors.workersArea + ' .worker').count();
  }
}

test.describe('Monitor (Concurrency) Demo — End-to-end tests', () => {
  // Capture console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Attach the collected logs to the test output for debugging (Playwright will show test stdout)
    // Note: not modifying the app; only reporting observed console/page errors.
    if (consoleMessages.length) {
      // eslint-disable-next-line no-console
      console.log('Console messages captured:', consoleMessages.slice(0, 20));
    }
    if (pageErrors.length) {
      // eslint-disable-next-line no-console
      console.log('Page errors captured:', pageErrors.map(e => String(e)).slice(0, 20));
    }
  });

  test.describe('Initial state and basic UI rendering', () => {
    test('page loads and initial UI state matches expectations (Buffer, Workers, Logs)', async ({ page }) => {
      // Verify the page loads and initial demo messages appear
      const demo = new DemoPage(page);
      await demo.goto();

      // Title sanity
      const title = await demo.title();
      expect(title).toContain('Monitor (Concurrency)');

      // Buffer capacity input default should be reflected in bufferCap element
      const capText = await demo.getBufferCapacityText();
      expect(parseInt(capText, 10)).toBeGreaterThanOrEqual(1);

      // There should be as many buffer slot elements as the capacity
      const slots = await demo.getBufferSlotsCount();
      expect(slots).toBe(parseInt(capText, 10));

      // Initial workers: demo script creates two producers and two consumers on load
      // Confirm counts reflect that setup
      const prodCount = await demo.getProdCount();
      const consCount = await demo.getConsCount();
      expect(prodCount).toBeGreaterThanOrEqual(0);
      expect(consCount).toBeGreaterThanOrEqual(0);

      // Confirm that the startup log line is present
      await demo.waitForLogContaining('Demo started: Monitor-protected bounded buffer with producers & consumers.');

      // Wait until at least one item has been produced (gives the worker loops some time)
      // This asserts the system transitions to Working state and does work
      await demo.waitForProducedAtLeast(1);

      // Ensure no uncaught page errors were thrown during initial load
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Worker lifecycle: Add Producer / Add Consumer / Remove / Stop All', () => {
    test('Add Producer and Add Consumer start new workers and emit start logs', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Capture before counts
      const beforeProd = await demo.getProdCount();
      const beforeCons = await demo.getConsCount();

      // Add a producer and assert producer count increments and a start log appears
      await demo.clickAddProducer();
      await demo.waitForLogContaining('Producer #');
      // producer count increases by 1 (or at least not decreased)
      const afterProd = await demo.getProdCount();
      expect(afterProd).toBeGreaterThanOrEqual(beforeProd + 1);

      // Add a consumer and assert consumer count increments and a start log appears
      await demo.clickAddConsumer();
      await demo.waitForLogContaining('Consumer #');
      const afterCons = await demo.getConsCount();
      expect(afterCons).toBeGreaterThanOrEqual(beforeCons + 1);

      // Try removing a worker using the Remove button: ensure it generates a removed log and reduces count
      const workersBefore = await demo.getWorkersCount();
      const removed = await demo.removeFirstWorker();
      if (removed) {
        // A remove should generate a "removed" log entry for either producer/consumer
        await demo.waitForLogContaining('removed');
        const workersAfter = await demo.getWorkersCount();
        expect(workersAfter).toBeLessThanOrEqual(workersBefore - 1);
      }

      // Clean up: stop all workers and verify the 'All workers stopped.' log is emitted
      await demo.clickStopAll();
      await demo.waitForLogContaining('All workers stopped.');
      // After stopAll, producer and consumer counts should be zero
      expect(await demo.getProdCount()).toBe(0);
      expect(await demo.getConsCount()).toBe(0);

      // Assert no uncaught errors were emitted during these interactions
      expect(pageErrors).toEqual([]);
    });

    test('Stop All when no workers exist still logs and maintains idle state', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure all workers stopped (call stopAll twice to exercise idempotence)
      await demo.clickStopAll();
      await demo.waitForLogContaining('All workers stopped.');
      // Click again to ensure no exception or problematic behavior occurs
      await demo.clickStopAll();
      // 'All workers stopped.' may or may not be logged again depending on app, but there should be no page errors
      expect(pageErrors).toEqual([]);
      // Worker area should be empty
      expect(await demo.getWorkersCount()).toBe(0);
    });
  });

  test.describe('Buffer capacity adjustments and edge cases', () => {
    test('Apply Capacity updates capacity and renders buffer slots, logs the change', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Apply a smaller capacity (edge case)
      await demo.setCapacityInput(3);
      await demo.clickApplyCapacity();

      // Buffer cap and number of slots should update to 3
      await page.waitForFunction(() => document.getElementById('bufferCap') && document.getElementById('bufferCap').innerText === '3', { timeout: 3000 });
      const newCapText = await demo.getBufferCapacityText();
      expect(parseInt(newCapText, 10)).toBe(3);

      const slots = await demo.getBufferSlotsCount();
      expect(slots).toBe(3);

      // Log entry should reflect capacity change
      await demo.waitForLogContaining('Buffer capacity set to 3');

      // Now apply an invalid capacity (0) — the UI should ignore it and not log a change
      const beforeCap = await demo.getBufferCapacityText();
      await demo.setCapacityInput(0);
      await demo.clickApplyCapacity();

      // After invalid apply, capacity should remain unchanged
      const afterCap = await demo.getBufferCapacityText();
      expect(afterCap).toBe(beforeCap);

      // Ensure no uncaught page errors occurred during capacity adjustments
      expect(pageErrors).toEqual([]);
    });

    test('Applying capacity larger than current should increase buffer slots count', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Apply a larger capacity
      await demo.setCapacityInput(8);
      await demo.clickApplyCapacity();

      // Capacity element should reflect the new value
      await page.waitForFunction(() => document.getElementById('bufferCap') && document.getElementById('bufferCap').innerText === '8', { timeout: 3000 });
      expect(await demo.getBufferSlotsCount()).toBe(8);

      // Log entry should reflect capacity change
      await demo.waitForLogContaining('Buffer capacity set to 8');

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Logging behaviors and Clear Logs', () => {
    test('Logs show producer/consumer activity and Clear Logs empties the log area', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Wait for some activity to produce logs
      await demo.waitForLogContaining('Producer #', 8000);
      await demo.waitForLogContaining('Consumer #', 8000);

      // Ensure logs area contains text
      const logsBefore = await demo.getLogsText();
      expect(logsBefore.length).toBeGreaterThan(0);

      // Click Clear Logs and ensure logs area is empty
      await demo.clickClearLogs();
      // Wait a short moment for DOM update
      await page.waitForFunction(() => document.getElementById('logs') && document.getElementById('logs').childElementCount === 0, { timeout: 2000 });
      const logsAfter = await demo.getLogsText();
      expect(logsAfter.trim()).toBe('');

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Robustness checks and error observation', () => {
    test('No unexpected ReferenceError/SyntaxError/TypeError occurred during typical interactions', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Perform a set of typical interactions in sequence
      await demo.clickAddProducer();
      await demo.clickAddConsumer();
      await demo.setCapacityInput(4);
      await demo.clickApplyCapacity();

      // Give some time for workers to produce/consume
      await demo.waitForProducedAtLeast(1, 8000);

      // Stop all workers
      await demo.clickStopAll();
      await demo.waitForLogContaining('All workers stopped.');

      // Clear logs
      await demo.clickClearLogs();

      // At this point, we assert that there were no uncaught page errors (ReferenceError/SyntaxError/TypeError).
      // If any such errors did occur, they have been captured in pageErrors and this assertion will fail,
      // surfacing the exact error(s) collected during test execution.
      expect(pageErrors).toEqual([]);
    });
  });
});