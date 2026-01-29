import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b1c373-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object for the Topological Sort page
class TopoPage {
  constructor(page) {
    this.page = page;
    this.startBtn = '#startBtn';
    this.resetBtn = '#resetBtn';
    this.graphInput = '#graphInput';
    this.message = '#message';
    this.order = '#order';
    this.svg = '#svg';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getTextareaValue() {
    return this.page.locator(this.graphInput).inputValue();
  }

  async setTextareaValue(value) {
    await this.page.fill(this.graphInput, value);
  }

  async clickStart() {
    await this.page.click(this.startBtn);
  }

  async clickReset() {
    await this.page.click(this.resetBtn);
  }

  async getMessageText() {
    return this.page.locator(this.message).innerText();
  }

  async getOrderText() {
    return this.page.locator(this.order).innerText();
  }

  async isStartDisabled() {
    return this.page.$eval(this.startBtn, b => b.disabled === true);
  }

  async isResetDisabled() {
    return this.page.$eval(this.resetBtn, b => b.disabled === true);
  }

  async isTextareaDisabled() {
    return this.page.$eval(this.graphInput, ta => ta.disabled === true);
  }

  async nodeExists(id) {
    return (await this.page.$(`#node-${id}`)) !== null;
  }

  async edgeExists(from, to) {
    return (await this.page.$(`#edge-${from}->${to}`)) !== null;
  }

  async nodeHasClass(id, className) {
    const el = await this.page.$(`#node-${id}`);
    if (!el) return false;
    return await el.evaluate((n, c) => n.classList.contains(c), className);
  }

  async edgeHasClass(from, to, className) {
    const el = await this.page.$(`#edge-${from}->${to}`);
    if (!el) return false;
    return await el.evaluate((e, c) => e.classList.contains(c), className);
  }
}

// Global test configuration for longer running test that waits for full animation
test.describe('Topological Sort Visualization - FSM tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // capture unhandled exceptions thrown in the page context
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  // Test initial Idle state: parseInput() and drawGraph() executed on load.
  test('Initial Idle state: graph drawn and initial UI state (S0_Idle)', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Validate that graph nodes from the default textarea are drawn
    // Expected nodes from the provided default input: A, B, C, D, E, F
    const expectedNodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const n of expectedNodes) {
      const exists = await topo.nodeExists(n);
      expect(exists, `Expected node ${n} to be present after initial draw`).toBeTruthy();
    }

    // Validate a few edges exist
    expect(await topo.edgeExists('A', 'C')).toBeTruthy();
    expect(await topo.edgeExists('B', 'C')).toBeTruthy();
    expect(await topo.edgeExists('F', 'E')).toBeTruthy();

    // Order and message should be empty initially
    expect(await topo.getOrderText()).toBe('');
    expect(await topo.getMessageText()).toBe('');

    // Reset button should be disabled in initial state
    expect(await topo.isResetDisabled()).toBe(true);

    // No fatal page errors or console errors on load
    expect(pageErrors, 'No unhandled page errors on initial load').toEqual([]);
    // Allow console errors array but assert none are reference/syntax/type errors
    for (const msg of consoleErrors) {
      expect(msg).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  // Test StartSort transition: clicking start moves to Sorting state (S1_Sorting)
  test('StartTopologicalSort: transition to Sorting and UI locks (StartSort event)', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Click start and validate immediate behavior (candidates should be shown)
    await topo.clickStart();

    // Immediately after clicking, the script runs one step that yields candidates.
    // The message should list nodes with indegree 0. For the default graph those are A and B.
    await page.waitForFunction(() => document.getElementById('message').innerText.includes('Nodes with in-degree 0'), { timeout: 3000 });

    const msg = await topo.getMessageText();
    expect(msg).toContain('Nodes with in-degree 0');
    // Check it lists A and B
    expect(msg).toContain('A');
    expect(msg).toContain('B');

    // UI should be locked: startBtn disabled, textarea disabled, reset enabled
    expect(await topo.isStartDisabled()).toBeTruthy();
    expect(await topo.isTextareaDisabled()).toBeTruthy();
    expect(await topo.isResetDisabled()).toBeFalsy();

    // Candidates should be visually highlighted with 'current' class (A and B)
    // There might be a small timing window; retry a couple times
    await page.waitForTimeout(50);
    expect(await topo.nodeHasClass('A', 'current')).toBeTruthy();
    expect(await topo.nodeHasClass('B', 'current')).toBeTruthy();

    // No unhandled page errors during start
    expect(pageErrors).toEqual([]);
    for (const e of consoleErrors) {
      expect(e).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  // Test Completed state: let animation run to completion and verify final order and messages (S2_Completed)
  test('Complete topological sort reaches Completed state and shows final order (S2_Completed)', async ({ page }) => {
    // This test can take time because the animation advances on an interval.
    test.setTimeout(120000); // allow up to 2 minutes

    const topo = new TopoPage(page);
    await topo.goto();

    await topo.clickStart();

    // Wait until the message indicates completion
    await page.waitForFunction(() => document.getElementById('message').innerText.includes('Topological sort completed!'), { timeout: 90000 });

    const finalMsg = await topo.getMessageText();
    expect(finalMsg).toBe('Topological sort completed!');

    // Expected deterministic order for the given input (based on Kahn's algorithm used):
    // A, B, C, F, D, E (joined with " → ")
    const expectedOrder = 'A → B → C → F → D → E';
    const observedOrder = await topo.getOrderText();
    expect(observedOrder).toBe(expectedOrder);

    // All node elements should have class 'done'
    const nodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const n of nodes) {
      expect(await topo.nodeHasClass(n, 'done'), `Node ${n} should be marked as done`).toBeTruthy();
    }

    // After completion interface should be unlocked: start enabled, textarea enabled, reset disabled (reset is toggled by disableInterface(false))
    expect(await topo.isStartDisabled()).toBeFalsy();
    expect(await topo.isTextareaDisabled()).toBeFalsy();
    // The code sets resetBtn.disabled = !disabled in disableInterface(false) so resetBtn becomes true (disabled)
    expect(await topo.isResetDisabled()).toBeTruthy();

    // No unhandled page errors in the whole process
    expect(pageErrors).toEqual([]);
    for (const e of consoleErrors) {
      expect(e).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  // Test ResetGraph transition: clicking reset should bring UI back to Idle (S0_Idle)
  test('ResetGraph: clicking reset returns to Idle state (S1_Sorting -> S0_Idle)', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Start and let it perform at least the initial steps so reset button becomes enabled
    await topo.clickStart();

    // Wait until reset is enabled (should be quickly after start)
    await page.waitForFunction(() => !document.getElementById('resetBtn').disabled, { timeout: 3000 });

    // Click reset
    await topo.clickReset();

    // After reset: message and order cleared
    await page.waitForTimeout(100); // brief wait for DOM updates
    expect(await topo.getMessageText()).toBe('');
    expect(await topo.getOrderText()).toBe('');

    // start should be enabled and reset disabled (back to idle)
    expect(await topo.isStartDisabled()).toBeFalsy();
    expect(await topo.isResetDisabled()).toBeTruthy();

    // Graph should still be drawn (drawGraph is called on reset handler)
    // Verify that expected nodes exist again
    const expectedNodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const n of expectedNodes) {
      expect(await topo.nodeExists(n)).toBeTruthy();
    }

    // According to implementation, reset does NOT clear the textarea input; assert that it remains unchanged from initial
    const txt = await topo.getTextareaValue();
    expect(txt.trim().length).toBeGreaterThan(0);

    // No unhandled page errors
    expect(pageErrors).toEqual([]);
    for (const e of consoleErrors) {
      expect(e).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  // Test CycleDetected transition: submit a cyclic graph and verify cycle detection message (S3_CycleDetected)
  test('Cycle detection: detects cycles and shows message (CycleDetected -> S3_CycleDetected)', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Provide a cyclic graph: A -> B -> C -> A
    await topo.setTextareaValue('A B\nB C\nC A');

    // Click start
    await topo.clickStart();

    // For a cycle, the generator yields cycleDetected on the first run; wait for message to update
    await page.waitForFunction(() => document.getElementById('message').innerText.includes('Cycle detected'), { timeout: 3000 });

    const msg = await topo.getMessageText();
    expect(msg).toContain('Cycle detected');

    // After cycle detected, animation stops and interface should be unlocked (startBtn enabled)
    expect(await topo.isStartDisabled()).toBeFalsy();
    // resetBtn becomes disabled due to disableInterface(false) being called inside cycleDetected handling
    expect(await topo.isResetDisabled()).toBeTruthy();

    // Order should remain empty
    expect(await topo.getOrderText()).toBe('');

    // No unhandled page errors observed
    expect(pageErrors).toEqual([]);
    for (const e of consoleErrors) {
      expect(e).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  // Edge case: empty input should show a helpful message and not crash
  test('Edge case: empty input shows "No nodes detected" message and does not crash', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Clear textarea
    await topo.setTextareaValue('');
    await topo.clickStart();

    // Should immediately show a helpful message about no nodes
    await page.waitForFunction(() => document.getElementById('message').innerText.includes('No nodes detected'), { timeout: 3000 });

    const msg = await topo.getMessageText();
    expect(msg).toContain('No nodes detected');

    // start should remain enabled and reset remains disabled
    expect(await topo.isStartDisabled()).toBeFalsy();
    expect(await topo.isResetDisabled()).toBeTruthy();

    // No exceptions thrown to page error handlers
    expect(pageErrors).toEqual([]);
    for (const e of consoleErrors) {
      expect(e).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });
});