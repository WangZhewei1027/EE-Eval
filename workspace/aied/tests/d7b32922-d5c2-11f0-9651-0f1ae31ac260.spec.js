import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b32922-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object Model for the Union-Find visualization page
class UnionFindPage {
  constructor(page) {
    this.page = page;
    this.operation = page.locator('#operation');
    this.element1 = page.locator('#element1');
    this.element2 = page.locator('#element2');
    this.performBtn = page.locator('#perform-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.logDiv = page.locator('#log');
    this.container = page.locator('#union-find');
    this.nodes = page.locator('.node');
  }

  async selectOperation(op) {
    await this.operation.selectOption(op);
    // Wait a tick for change handler to hide/show element2
    await this.page.waitForTimeout(50);
  }

  async selectElements(e1, e2 = null) {
    await this.element1.selectOption(String(e1));
    if (e2 !== null) {
      await this.element2.selectOption(String(e2));
    }
    // small wait for UI consistency
    await this.page.waitForTimeout(20);
  }

  async clickPerform() {
    await this.performBtn.click();
    // Wait for the click handler to run and render changes
    await this.page.waitForTimeout(100);
  }

  async clickReset() {
    await this.resetBtn.click();
    await this.page.waitForTimeout(100);
  }

  async getLogText() {
    return await this.logDiv.textContent();
  }

  async getNodeCount() {
    return await this.nodes.count();
  }

  async getNodeTitle(index) {
    return await this.page.locator(`.node[data-index="${index}"]`).getAttribute('title');
  }

  async getParentsArray() {
    // Read uf.parent from page context; do not modify it.
    return await this.page.evaluate(() => {
      if (typeof uf === 'undefined' || !uf.parent) return null;
      return uf.parent.slice();
    });
  }

  async getLogLines() {
    const txt = await this.getLogText();
    if (!txt) return [];
    return txt.trim().split('\n').filter(Boolean);
  }
}

test.describe('Union-Find Visualization - FSM and UI tests', () => {
  // Collect console messages and page errors during each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console events
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Capture the Error object or message
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Load the application page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing special to teardown; listeners attached to page are per test
  });

  test('Initial Idle state - page initialized and UI elements present', async ({ page }) => {
    // Validate initial Idle state (S0_Idle) and init() entry action effects
    const ufPage = new UnionFindPage(page);

    // Verify select and buttons exist and are populated
    await expect(ufPage.operation).toBeVisible();
    await expect(ufPage.element1).toBeVisible();
    await expect(ufPage.element2).toBeVisible();
    await expect(ufPage.performBtn).toBeVisible();
    await expect(ufPage.resetBtn).toBeVisible();

    // There should be 10 nodes as the size constant in the implementation is 10
    const nodeCount = await ufPage.getNodeCount();
    expect(nodeCount).toBe(10);

    // The selects should have options for 0..9; check the selected value of element1 is '0' by default
    const elem1Value = await page.locator('#element1').inputValue();
    expect(elem1Value).toBe('0');

    // The log should be empty on initialization (init() didn't log anything)
    const initialLog = await ufPage.getLogText();
    expect(initialLog.trim()).toBe('');

    // Ensure no page errors occurred during initialization (we allow zero errors)
    expect(pageErrors.length).toBe(0);

    // There should be no console.error messages
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error' || c.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Perform Union operation transitions from Idle -> Union (S1_Union) and updates parents and log', async ({ page }) => {
    // This test validates the "PerformClick" event when operation is "union"
    const ufPage = new UnionFindPage(page);

    // Ensure operation is 'union' (default), select two different elements
    await ufPage.selectOperation('union');
    await ufPage.selectElements(1, 2);

    // Capture parents before union
    const parentsBefore = await ufPage.getParentsArray();
    expect(Array.isArray(parentsBefore)).toBeTruthy();
    // Initially, parent[i] === i for all
    expect(parentsBefore[1]).toBe(1);
    expect(parentsBefore[2]).toBe(2);

    // Perform union of 1 and 2
    await ufPage.clickPerform();

    // The log should contain a Union message
    const logText = await ufPage.getLogText();
    expect(logText).toMatch(/Union\(1,\s*2\):/);

    // Parents should reflect the union: either parent[2] === 1 or parent[1] === 2 depending on rank
    const parentsAfter = await ufPage.getParentsArray();
    expect(parentsAfter).not.toBeNull();
    // They should now be in the same set
    const root1 = await page.evaluate(() => uf.find(1));
    const root2 = await page.evaluate(() => uf.find(2));
    expect(root1).toBe(root2);

    // Confirm that at least one of parent pointers changed from initial identity mapping
    const changed = parentsAfter.some((p, idx) => p !== idx);
    expect(changed).toBeTruthy();

    // Ensure no uncaught page errors occurred during union
    expect(pageErrors.length).toBe(0);

    // No console errors or warnings should have been emitted for this flow
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error' || c.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Perform Find operation transitions from Idle -> Find (S2_Find) and logs root and shows alert', async ({ page }) => {
    // This test validates "PerformClick" when operation is "find"
    const ufPage = new UnionFindPage(page);

    // First create a union so that find will report a root that differs from element sometimes
    await ufPage.selectOperation('union');
    await ufPage.selectElements(3, 4);
    await ufPage.clickPerform();

    // Now switch to find operation
    await ufPage.selectOperation('find');
    await ufPage.selectElements(3);

    // Set up a dialog handler to capture the alert text emitted by the find operation
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Perform find and wait a bit
    await ufPage.clickPerform();

    // The log should contain a Find message for element 3
    const lines = await ufPage.getLogLines();
    const lastLine = lines[lines.length - 1] || '';
    expect(lastLine).toMatch(/Find\(3\): Root = \d+/);

    // The alert should have been shown with the root information and captured
    expect(dialogMessage).toMatch(/Root of element 3 is \d+/);

    // Verify that the root returned by uf.find matches what's in the alert and the log
    const rootFromPage = await page.evaluate(() => uf.find(3));
    expect(String(dialogMessage)).toContain(String(rootFromPage));
    expect(lastLine).toContain(String(rootFromPage));

    // Ensure no uncaught page errors occurred during the find operation
    expect(pageErrors.length).toBe(0);
  });

  test('Reset operation transitions Idle -> Reset (S3_Reset): clears log and restores initial parents', async ({ page }) => {
    // This test validates clicking Reset clears logs and re-initializes the UnionFind
    const ufPage = new UnionFindPage(page);

    // Make a few unions to change state
    await ufPage.selectOperation('union');
    await ufPage.selectElements(5, 6);
    await ufPage.clickPerform();

    await ufPage.selectElements(6, 7);
    await ufPage.clickPerform();

    // Confirm log has entries
    let logs = await ufPage.getLogLines();
    expect(logs.length).toBeGreaterThanOrEqual(2);

    // Capture parents before reset: should have changed
    const parentsBeforeReset = await ufPage.getParentsArray();
    const changedBefore = parentsBeforeReset.some((p, idx) => p !== idx);
    expect(changedBefore).toBeTruthy();

    // Click reset
    await ufPage.clickReset();

    // After reset the log should be cleared
    const logAfterReset = await ufPage.getLogText();
    expect(logAfterReset.trim()).toBe('');

    // Parents array should now be reset to identity mapping 0..9
    const parentsAfterReset = await ufPage.getParentsArray();
    expect(parentsAfterReset).not.toBeNull();
    for (let i = 0; i < parentsAfterReset.length; i++) {
      expect(parentsAfterReset[i]).toBe(i);
    }

    // Node titles should reflect parent equal to self
    const title0 = await ufPage.getNodeTitle(0);
    expect(title0).toContain('Parent: 0');

    // Ensure no uncaught page errors during reset
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: Attempting union with same element triggers alert and does not log', async ({ page }) => {
    // This test exercises the edge case where user tries to union an element with itself.
    const ufPage = new UnionFindPage(page);

    await ufPage.selectOperation('union');
    await ufPage.selectElements(2, 2);

    // Capture dialog text when clicking perform
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Perform and wait
    await ufPage.clickPerform();

    // Expect the alert text to mention cannot union same element
    expect(dialogMessage).toMatch(/Cannot union the same element/);

    // Log should NOT contain a Union entry for this invalid action
    const logs = await ufPage.getLogLines();
    // There might be previously existing logs; ensure none of the last lines contain a Union(2, 2):
    const containsInvalidUnion = logs.some((l) => /Union\(\s*2\s*,\s*2\s*\)/.test(l));
    expect(containsInvalidUnion).toBeFalsy();

    // No page errors should be present
    expect(pageErrors.length).toBe(0);
  });

  test('Invalid element selection would show alert - simulate by selecting out of range via script and letting page handle it', async ({ page }) => {
    // The UI itself prevents selecting invalid options, but the event handler checks for NaN/out-of-range.
    // We'll simulate by programmatically setting the select value to an invalid number and triggering perform.
    // NOTE: We do not modify application functions; we only drive the UI and set DOM values like a user might in a test harness.

    const ufPage = new UnionFindPage(page);

    // Force element1 select to an invalid value using page.evaluate (this mimics a user manipulating the DOM)
    await page.evaluate(() => {
      const s = document.getElementById('element1');
      // Intentionally set an invalid value out of range
      s.value = '999';
      // Also set element2 to a valid value to avoid union-specific same-element alert
      document.getElementById('element2').value = '1';
    });

    // Expect that when clicking perform there will be an alert about invalid element 1
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click perform (operation default is union). We choose union to hit the invalid element1 check first.
    await ufPage.clickPerform();

    expect(dialogMessage).toMatch(/Invalid element 1/);

    // Ensure no log entry was added for the invalid attempt
    const logs = await ufPage.getLogLines();
    const addedInvalidLogs = logs.filter(l => l.includes('Union') || l.includes('Find'));
    // None of the logs should reflect the invalid operation we just attempted
    // (they may contain earlier operations from other tests within same worker, but nothing new for this)
    // We assert that the last log entry does not mention element 999
    const last = logs[logs.length - 1] || '';
    expect(last).not.toContain('999');

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console and page errors across interactions (ensure none expected)', async ({ page }) => {
    // This test collects console and page errors over a sequence of normal interactions
    const ufPage = new UnionFindPage(page);

    // Perform a series of operations
    await ufPage.selectOperation('union');
    await ufPage.selectElements(0, 1);
    await ufPage.clickPerform();

    await ufPage.selectOperation('union');
    await ufPage.selectElements(2, 3);
    await ufPage.clickPerform();

    await ufPage.selectOperation('find');
    await ufPage.selectElements(0);
    // capture the dialog and accept it
    page.once('dialog', async (d) => { await d.accept(); });
    await ufPage.clickPerform();

    // After these interactions, assert that no uncaught page errors were emitted
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${JSON.stringify(pageErrors)}`);

    // Also assert that there were no console errors or warnings
    const consoleErrs = consoleMessages.filter(c => c.type === 'error' || c.type === 'warning');
    expect(consoleErrs.length).toBe(0);

    // Additionally verify that log contains entries corresponding to actions performed
    const logs = await ufPage.getLogText();
    expect(logs).toMatch(/Union\(0,\s*1\):/);
    expect(logs).toMatch(/Union\(2,\s*3\):/);
    expect(logs).toMatch(/Find\(0\): Root = \d+/);
  });
});