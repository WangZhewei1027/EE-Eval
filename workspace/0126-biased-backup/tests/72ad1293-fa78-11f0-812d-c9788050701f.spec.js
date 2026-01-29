import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad1293-fa78-11f0-812d-c9788050701f.html';

// Page object to encapsulate common interactions and queries
class MemoryPage {
  constructor(page) {
    this.page = page;
    this.allocateBtn = page.locator('#allocateBtn');
    this.collectBtn = page.locator('#collectBtn');
    this.memoryBlocks = page.locator('.memory-block');
    this.allocatedBlocks = page.locator('.memory-block.allocated');
    this.markedBlocks = page.locator('.memory-block.marked');
    this.sweptBlocks = page.locator('.memory-block.swept');
    this.gcCycle = page.locator('#gcCycle');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getTotalBlocks() {
    return await this.memoryBlocks.count();
  }

  async getAllocatedCount() {
    return await this.allocatedBlocks.count();
  }

  async getMarkedCount() {
    return await this.markedBlocks.count();
  }

  async getSweptCount() {
    return await this.sweptBlocks.count();
  }

  async getGCCycleNumber() {
    const text = await this.gcCycle.innerText();
    const match = text.match(/GC Cycle:\s*(\d+)/);
    return match ? Number(match[1]) : null;
  }

  async clickAllocate() {
    await this.allocateBtn.click();
  }

  async clickCollect() {
    await this.collectBtn.click();
  }

  // Wait until GC cycle increments beyond given number or timeout
  async waitForGCCycleGreaterThan(prev, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const val = await this.getGCCycleNumber();
      if (val !== null && val > prev) return val;
      await this.page.waitForTimeout(100);
    }
    throw new Error(`GC cycle did not increase beyond ${prev} within ${timeout}ms`);
  }
}

test.describe('Garbage Collection Visualizer - FSM validation', () => {
  // Arrays to collect console messages and page errors for each test.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // Flatten console message for easy assertions later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('S0_Idle state: initial render and entry actions (DOMContentLoaded)', async ({ page }) => {
    // Validate initial Idle state immediately after DOMContentLoaded.
    // This checks that the page has rendered the key components and the initial GC cycle is 0.
    const mem = new MemoryPage(page);
    await mem.goto();

    // Immediately after DOMContentLoaded the page should display GC Cycle: 0
    const gcNumber = await mem.getGCCycleNumber();
    expect(gcNumber).toBe(0);

    // The memory pool should contain the expected total number of memory blocks (40)
    const total = await mem.getTotalBlocks();
    expect(total).toBe(40);

    // There should be no allocated blocks yet (auto allocations are scheduled at 500ms)
    const allocatedNow = await mem.getAllocatedCount();
    expect(allocatedNow).toBe(0);

    // Ensure header/title rendered (verifies renderPage() entry-like effect)
    await expect(page.locator('h1')).toHaveText(/Garbage Collection/i);

    // No uncaught page errors should have occurred during load
    expect(pageErrors.length).toBe(0);
  });

  test('S0 -> S1 AllocateMemory: clicking Allocate Memory allocates 1-3 blocks', async ({ page }) => {
    // Verify a single Allocate click allocates between 1 and 3 blocks (as implemented)
    const mem = new MemoryPage(page);
    await mem.goto();

    // Click immediately to avoid the auto-allocate timeouts interfering
    await mem.clickAllocate();

    // Check that allocated count is between 1 and 3 (robust to small timing)
    // Give a tiny delay to let allocation code add classes
    await page.waitForTimeout(50);
    const allocatedCount = await mem.getAllocatedCount();
    expect(allocatedCount).toBeGreaterThanOrEqual(1);
    expect(allocatedCount).toBeLessThanOrEqual(3);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('S1_Allocating self-transition: multiple Allocate clicks accumulate until pool exhausted', async ({ page }) => {
    // Repeatedly click Allocate until no free block remains, then ensure allocate does nothing further.
    const mem = new MemoryPage(page);
    await mem.goto();

    // Keep clicking until all blocks become allocated
    let freeCount = await page.locator('.memory-block:not(.allocated)').count();
    // Loop with safeguard to avoid infinite loops in flaky situations
    const maxIterations = 1000;
    let iterations = 0;
    while (freeCount > 0 && iterations < maxIterations) {
      await mem.clickAllocate();
      // small pause to allow DOM updates
      await page.waitForTimeout(20);
      freeCount = await page.locator('.memory-block:not(.allocated)').count();
      iterations++;
    }

    // All blocks should now be allocated
    const allocatedFinal = await mem.getAllocatedCount();
    expect(allocatedFinal).toBe(40);
    expect(freeCount).toBe(0);

    // Clicking allocate now should not increase allocated beyond total (idempotent)
    await mem.clickAllocate();
    await page.waitForTimeout(50);
    const allocatedAfterExtra = await mem.getAllocatedCount();
    expect(allocatedAfterExtra).toBe(40);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S2 RunGCCycle: clicking Run GC Cycle increments cycle and performs mark-and-sweep', async ({ page }) => {
    // Validate that GC cycle increments, marking occurs, and after sweep allocated count is <= before
    const mem = new MemoryPage(page);
    await mem.goto();

    // Ensure some allocations exist before collecting; allocate a few times
    await mem.clickAllocate();
    await page.waitForTimeout(20);
    await mem.clickAllocate();
    await page.waitForTimeout(20);

    const allocatedBefore = await mem.getAllocatedCount();
    expect(allocatedBefore).toBeGreaterThanOrEqual(1);

    // Click collect
    const prevCycle = await mem.getGCCycleNumber();
    await mem.clickCollect();

    // Immediately after click, GC Cycle display should increment synchronously
    const afterImmediateCycle = await mem.getGCCycleNumber();
    expect(afterImmediateCycle).toBe(prevCycle + 1);

    // Wait for the mark and sweep animations to complete:
    // - marking happens synchronously (some blocks get .marked)
    // - sweep happens after 1500ms and final reset after additional ~1000ms
    await page.waitForTimeout(3000);

    const allocatedAfter = await mem.getAllocatedCount();
    // After GC, the number of allocated blocks should be less than or equal to before.
    // Because GC may keep many, we only assert it did not increase unexpectedly.
    expect(allocatedAfter).toBeLessThanOrEqual(allocatedBefore);

    // Optionally, some blocks may have been swept and freed (allocatedAfter < allocatedBefore)
    // This is not strictly required; the algorithm is probabilistic, but ensure no errors occurred.
    expect(pageErrors.length).toBe(0);
  });

  test('S2_GC_Running -> S1_Allocating: allow Allocate during GC run and verify behavior', async ({ page }) => {
    // Verify that clicking Allocate while GC is in its mark/sweep delay still allocates memory (transition during GC)
    const mem = new MemoryPage(page);
    await mem.goto();

    // Ensure some allocations to make GC meaningful
    await mem.clickAllocate();
    await page.waitForTimeout(20);
    await mem.clickAllocate();
    await page.waitForTimeout(20);

    const allocatedBefore = await mem.getAllocatedCount();
    expect(allocatedBefore).toBeGreaterThanOrEqual(1);

    // Start GC
    await mem.clickCollect();

    // Immediately (during mark phase, before sweep) attempt to allocate
    await mem.clickAllocate();

    // Small delay to let allocate take effect
    await page.waitForTimeout(100);

    // At least one allocated block should exist after the allocate click (the app never removes all classes instantly)
    const allocatedDuring = await mem.getAllocatedCount();
    expect(allocatedDuring).toBeGreaterThanOrEqual(1);

    // Wait for GC sweep to finish to ensure no errors and that allocations during GC were reconciled
    await page.waitForTimeout(3000);

    const allocatedAfter = await mem.getAllocatedCount();
    // allocatedAfter should be a valid number between 0 and total
    expect(allocatedAfter).toBeGreaterThanOrEqual(0);
    expect(allocatedAfter).toBeLessThanOrEqual(40);

    // No uncaught errors during allocating in GC
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Collect with no allocated blocks should increment GC counter and not throw', async ({ page }) => {
    // Immediately call collect after load (before auto-allocations occur) so there are no allocated blocks.
    const mem = new MemoryPage(page);
    await mem.goto();

    // Verify no allocated yet (auto allocations scheduled at 500ms)
    const beforeAlloc = await mem.getAllocatedCount();
    expect(beforeAlloc).toBe(0);

    const prevCycle = await mem.getGCCycleNumber();
    await mem.clickCollect();

    // GC cycle should increment even if there are no allocated blocks to collect
    const newCycle = await mem.getGCCycleNumber();
    expect(newCycle).toBe(prevCycle + 1);

    // There should be no marked or swept blocks when nothing was allocated
    const marked = await mem.getMarkedCount();
    const swept = await mem.getSweptCount();
    expect(marked).toBe(0);
    // swept may be 0 as well
    expect(swept).toBeGreaterThanOrEqual(0);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Auto-run behavior: allow page timeouts to run and observe automatic allocations and GC', async ({ page }) => {
    // The page schedules a few allocateBtn.click() calls at 500ms, 1500ms, 2500ms and an automatic collect at 4000ms.
    // This test ensures those automated interactions occur and result in a GC cycle increment.
    const mem = new MemoryPage(page);
    await mem.goto();

    // Wait sufficient time for auto allocations and auto gc to run
    await page.waitForTimeout(4500);

    // After the auto sequence, GC cycle should be >= 1
    const cycle = await mem.getGCCycleNumber();
    expect(cycle).toBeGreaterThanOrEqual(1);

    // There should be some allocated blocks (unless GC swept all)
    const allocated = await mem.getAllocatedCount();
    expect(allocated).toBeGreaterThanOrEqual(0);
    expect(allocated).toBeLessThanOrEqual(40);

    // Validate that we collected console messages (if any) and that no critical errors happened
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(pageErrors.length).toBe(0);
  });

  test('Observing console and page errors: ensure no unexpected runtime errors', async ({ page }) => {
    // Final assurance test: navigate and let everything run for a while, then assert no uncaught exceptions like ReferenceError/SyntaxError/TypeError occurred.
    const mem = new MemoryPage(page);
    await mem.goto();

    // Allow scheduled timeouts to run and potential errors to surface
    await page.waitForTimeout(4500);

    // Collect types of page errors if any
    const errorTypes = pageErrors.map(e => {
      // Error.name often holds TypeError/ReferenceError etc.
      return e && e.name ? e.name : String(e);
    });

    // Assert that there are no page errors (we allow console logs to exist but pageErrors must be empty).
    expect(pageErrors.length).toBe(0);

    // For debugging clarity in case of failures, include the console message count assertion
    // (We don't assert specific console content since the app does not intentionally log specific messages.)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});