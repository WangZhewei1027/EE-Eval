import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d324312-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for interacting with the Garbage Collection demo
class GCDemoPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      memoryUsage: '#memory-usage',
      memoryLimit: '#memory-limit',
      limitValue: '#limit-value',
      createSmall: '#create-small',
      createMedium: '#create-medium',
      createLarge: '#create-large',
      customSize: '#custom-size',
      createCustom: '#create-custom',
      createReachable: '#create-reachable',
      createUnreachable: '#create-unreachable',
      fromObject: '#from-object',
      toObject: '#to-object',
      addReference: '#add-reference',
      removeRefSelect: '#remove-ref-select',
      removeReference: '#remove-reference',
      clearReferences: '#clear-references',
      runGc: '#run-gc',
      autoGc: '#auto-gc',
      autoGcStatus: '#auto-gc-status',
      gcInterval: '#gc-interval',
      reset: '#reset',
      fillMemory: '#fill-memory',
      createCycle: '#create-cycle',
      objectGraph: '#object-graph',
      log: '#log',
      memoryContainer: '#memory'
    };
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async getMemoryUsage() {
    const text = await this.page.textContent(this.selectors.memoryUsage);
    return parseInt(text || '0', 10);
  }

  async getLimitValue() {
    const text = await this.page.textContent(this.selectors.limitValue);
    return parseInt(text || '0', 10);
  }

  async lastLogContains(substring) {
    const logs = await this.page.textContent(this.selectors.log);
    return logs.includes(substring);
  }

  async getAllLogsText() {
    return this.page.textContent(this.selectors.log);
  }

  async createSmall() { await this.click(this.selectors.createSmall); }
  async createMedium() { await this.click(this.selectors.createMedium); }
  async createLarge() { await this.click(this.selectors.createLarge); }
  async setCustomSize(n) {
    await this.page.fill(this.selectors.customSize, String(n));
  }
  async createCustom() { await this.click(this.selectors.createCustom); }
  async createReachable() { await this.click(this.selectors.createReachable); }
  async createUnreachable() { await this.click(this.selectors.createUnreachable); }

  async addReference(fromId, toId) {
    await this.page.selectOption(this.selectors.fromObject, String(fromId));
    await this.page.selectOption(this.selectors.toObject, String(toId));
    await this.click(this.selectors.addReference);
  }

  async removeReferenceByOptionValue(optionValue) {
    await this.page.selectOption(this.selectors.removeRefSelect, String(optionValue));
    await this.click(this.selectors.removeReference);
  }

  async clearReferences() { await this.click(this.selectors.clearReferences); }
  async runGC() { await this.click(this.selectors.runGc); }
  async toggleAutoGC() { await this.click(this.selectors.autoGc); }
  async setGCInterval(ms) { await this.page.fill(this.selectors.gcInterval, String(ms)); await this.page.dispatchEvent(this.selectors.gcInterval, 'change'); }
  async resetMemory() { await this.click(this.selectors.reset); }
  async fillMemory() { await this.click(this.selectors.fillMemory); }
  async createCycle() { await this.click(this.selectors.createCycle); }

  async changeMemoryLimit(value) {
    // Set the range input's value and dispatch input event
    await this.page.$eval(this.selectors.memoryLimit, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
  }

  async getObjectGraphText() {
    return this.page.textContent(this.selectors.objectGraph);
  }

  async countMemoryBlocks() {
    return this.page.$$eval('.memory-block', els => els.length);
  }

  async getLastLogLine() {
    // Return last appended log line text
    const count = await this.page.$$eval('#log div', els => els.length);
    if (count === 0) return '';
    return this.page.textContent(`#log div:nth-child(${count})`);
  }

  async getRemoveRefOptions() {
    return this.page.$$eval('#remove-ref-select option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
  }
}

test.describe('Garbage Collection Interactive Demo - FSM and UI transitions', () => {
  let page;
  let gc;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Capture console messages and page errors to assert runtime health
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    gc = new GCDemoPage(page);
    await page.goto(APP_URL);
    // Ensure the app has initialized and DOM updated
    await page.waitForSelector('#log');
    // Wait a short time for initialization logs and UI population
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // Try to disable auto GC if left enabled to avoid background intervals affecting other tests
    try {
      const status = await page.textContent(gc.selectors.autoGcStatus);
      if (status && status.includes('(ON)')) {
        await gc.toggleAutoGC();
      }
    } catch (e) {
      // ignore
    }
    await page.close();
  });

  test('Initialization and Idle state (S0_Idle): app initializes and shows initial logs and memory usage', async () => {
    // The app should log an initialization message and memory usage should be 0
    const logs = await gc.getAllLogsText();
    expect(logs).toContain('Garbage Collection Interactive Demo initialized');
    const usage = await gc.getMemoryUsage();
    expect(usage).toBe(0);
    // No uncaught page errors should have occurred during initialization
    expect(pageErrors.length).toBe(0);
  });

  test('Create objects: small, medium, large, custom, reachable and unreachable - memory usage and logs update', async () => {
    // Create small object (1%)
    await gc.createSmall();
    await page.waitForTimeout(20);
    expect(await gc.getMemoryUsage()).toBeGreaterThanOrEqual(1);
    expect(await gc.lastLogContains('Created Object')).toBeTruthy();
    // Create medium (5%)
    await gc.createMedium();
    await page.waitForTimeout(20);
    // Expect cumulative usage >= 6
    expect(await gc.getMemoryUsage()).toBeGreaterThanOrEqual(6);
    // Create large (10%)
    await gc.createLarge();
    await page.waitForTimeout(20);
    expect(await gc.getMemoryUsage()).toBeGreaterThanOrEqual(16);
    // Custom size (set to 7)
    await gc.setCustomSize(7);
    await gc.createCustom();
    await page.waitForTimeout(20);
    expect(await gc.getMemoryUsage()).toBeGreaterThanOrEqual(23);
    // Create reachable and unreachable objects and assert logs mention reachable flag
    await gc.createReachable();
    await page.waitForTimeout(20);
    expect(await gc.lastLogContains('reachable: true')).toBeTruthy();
    await gc.createUnreachable();
    await page.waitForTimeout(20);
    expect(await gc.lastLogContains('reachable: false')).toBeTruthy();

    // Check that memory blocks are rendered in the visualization area
    const blockCount = await gc.countMemoryBlocks();
    expect(blockCount).toBeGreaterThanOrEqual(6); // at least the objects we created
  });

  test('References: add, remove, clear - object graph and logs update accordingly', async () => {
    // Reset to clean slate
    await gc.resetMemory();
    await page.waitForTimeout(20);
    // Create two objects
    await gc.createSmall(); // Obj 1
    await gc.createMedium(); // Obj 2
    await page.waitForTimeout(20);
    // Add reference from 1 -> 2
    await gc.addReference(1, 2);
    await page.waitForTimeout(20);
    expect(await gc.lastLogContains('Added reference: Object 1 → Object 2')).toBeTruthy();
    // Verify remove-ref-select has an option for the reference
    let options = await gc.getRemoveRefOptions();
    const refOption = options.find(o => o.value !== '' && o.text.includes('1 → 2'));
    expect(refOption).toBeTruthy();
    // Remove that reference using the option value
    await gc.removeReferenceByOptionValue(refOption.value);
    await page.waitForTimeout(20);
    expect(await gc.lastLogContains('Removed reference: Object 1 → Object 2')).toBeTruthy();
    // Attempt to remove reference when none selected (should log invalid reference ID)
    await gc.click(gc.selectors.removeReference);
    await page.waitForTimeout(20);
    expect(await gc.lastLogContains('Invalid reference ID')).toBeTruthy();
    // Re-add reference then clear all references
    await gc.addReference(1, 2);
    await page.waitForTimeout(20);
    await gc.clearReferences();
    await page.waitForTimeout(20);
    expect(await gc.lastLogContains('Cleared all references')).toBeTruthy();
    // The object graph should still list objects but without references
    const graphText = await gc.getObjectGraphText();
    expect(graphText).toContain('Roots:');
  });

  test('Garbage collection runs and collects unreachable objects', async () => {
    // Reset
    await gc.resetMemory();
    await page.waitForTimeout(20);
    // Create reachable object (id 1) and unreachable object (id 2)
    await gc.createReachable();   // reachable true
    await gc.createUnreachable(); // reachable false
    await page.waitForTimeout(20);
    // Run GC and expect the unreachable object to be collected
    await gc.runGC();
    await page.waitForTimeout(50);
    const logs = await gc.getAllLogsText();
    // There should be a "Collected Object" entry for the unreachable object (id 2)
    expect(logs).toMatch(/Collected Object \d+ \(size: \d+%\)/);
    expect(logs).toContain('Garbage collection complete. Collected');
    // Memory usage should have decreased or at least represent only reachable objects
    const usage = await gc.getMemoryUsage();
    expect(usage).toBeGreaterThanOrEqual(0);
  });

  test('Toggle Auto GC and update interval - status and logs update', async () => {
    // Ensure auto GC is off, then toggle on
    const initialStatus = await page.textContent(gc.selectors.autoGcStatus);
    expect(initialStatus).toBeTruthy();
    await gc.toggleAutoGC();
    await page.waitForTimeout(50); // allow log entry to append and interval to start
    expect(await page.textContent(gc.selectors.autoGcStatus)).toContain('(ON)');
    expect(await gc.lastLogContains('Auto GC enabled')).toBeTruthy();
    // Update GC interval while auto GC is enabled
    await gc.setGCInterval(500);
    await page.waitForTimeout(50);
    expect(await gc.lastLogContains('Auto GC interval updated to') || await gc.lastLogContains('Auto GC enabled')).toBeTruthy();
    // Toggle off
    await gc.toggleAutoGC();
    await page.waitForTimeout(20);
    expect(await page.textContent(gc.selectors.autoGcStatus)).toContain('(OFF)');
    expect(await gc.lastLogContains('Auto GC disabled')).toBeTruthy();
  });

  test('Reset memory clears objects and graph and logs the action', async () => {
    // Create some objects, then reset
    await gc.createSmall();
    await gc.createMedium();
    await page.waitForTimeout(20);
    await gc.resetMemory();
    await page.waitForTimeout(20);
    expect(await gc.getMemoryUsage()).toBe(0);
    const graphText = await gc.getObjectGraphText();
    expect(graphText).toContain('No objects in memory');
    expect(await gc.lastLogContains('Memory reset')).toBeTruthy();
  });

  test('Fill memory to limit and attempt creating object causing Memory Full (S1_Memory_Full)', async () => {
    // Set memory limit low so we can quickly fill it
    await gc.changeMemoryLimit(15); // limit at 15%
    await page.waitForTimeout(20);
    expect(await gc.getLimitValue()).toBe(15);
    // Click fill memory - function creates objects until limit reached
    await gc.fillMemory();
    // Wait a bit for the recursive timed fills to complete
    await page.waitForTimeout(600);
    const usage = await gc.getMemoryUsage();
    // Memory usage should now be >= limit or equal to it
    expect(usage).toBeGreaterThanOrEqual(15);
    // Now try to create a large object that exceeds the limit; should log memory limit exceeded
    await gc.createLarge(); // 10% - likely to exceed
    await page.waitForTimeout(50);
    const logs = await gc.getAllLogsText();
    expect(logs).toContain('Cannot create object: memory limit would be exceeded');
  });

  test('Create reference cycle and verify logs and select options updated', async () => {
    // Reset and create two objects
    await gc.resetMemory();
    await page.waitForTimeout(20);
    await gc.createSmall(); // id 1
    await gc.createMedium(); // id 2
    await page.waitForTimeout(20);
    // Create cycle between first and last (should add two references)
    await gc.createCycle();
    await page.waitForTimeout(50);
    const logs = await gc.getAllLogsText();
    expect(logs).toContain('Created reference cycle between Object 1 and Object 2');
    // remove-ref-select should have two options corresponding to the two references
    const options = await gc.getRemoveRefOptions();
    // Filter out the placeholder option
    const refOptions = options.filter(o => o.value !== '');
    expect(refOptions.length).toBeGreaterThanOrEqual(2);
  });

  test('Change memory limit via input updates displayed limit value', async () => {
    // Change memory limit to 40 via range input
    await gc.changeMemoryLimit(40);
    await page.waitForTimeout(20);
    expect(await gc.getLimitValue()).toBe(40);
    // Log is not expected for this action, but internal state should reflect change
    // Creating an object of size exceeding the new limit should be prevented
    await gc.resetMemory();
    await page.waitForTimeout(20);
    // Try to create an object larger than limit
    await gc.setCustomSize(50);
    await gc.createCustom();
    await page.waitForTimeout(20);
    // Since custom size input has max 20 in HTML, it clips? The app validates 1..20, so no creation occurs.
    // The log should not contain a Created Object line for size 50 (invalid)
    const logs = await gc.getAllLogsText();
    expect(logs).not.toContain('Created Object');
  });

  test('Edge cases: self-reference prevention and remove-reference with invalid ID', async () => {
    // Reset and create a single object
    await gc.resetMemory();
    await page.waitForTimeout(20);
    await gc.createSmall(); // id 1
    await page.waitForTimeout(20);
    // Attempt to add a self-reference (from 1 to 1)
    await gc.addReference(1, 1);
    await page.waitForTimeout(20);
    expect(await gc.lastLogContains('Cannot create self-reference (this would create a cycle)')).toBeTruthy();
    // Attempt to remove reference when no references exist should log invalid reference ID
    await gc.click(gc.selectors.removeReference);
    await page.waitForTimeout(20);
    expect(await gc.lastLogContains('Invalid reference ID')).toBeTruthy();
  });

  test('Runtime health: no uncaught page errors and console captured messages include expected init log', async () => {
    // Ensure there are no uncaught exceptions reported by the page
    expect(pageErrors.length).toBe(0);
    // The DOM log must contain initialization message; console messages may be empty because app uses DOM log
    const allLogs = await gc.getAllLogsText();
    expect(allLogs).toContain('Garbage Collection Interactive Demo initialized');
  });
});