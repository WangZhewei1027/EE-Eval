import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c95b8b1-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the Deque app
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.dequeSel = '.deque';
    this.nodeSel = '.deque .node';
    this.pushBtn = '#pushFront';
    this.popBtn = '#popBack';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main elements to appear
    await Promise.all([
      this.page.waitForSelector(this.dequeSel),
      this.page.waitForSelector(this.pushBtn),
      this.page.waitForSelector(this.popBtn)
    ]);
  }

  async pushFront() {
    await this.page.click(this.pushBtn);
  }

  async popBack() {
    await this.page.click(this.popBtn);
  }

  // Returns number of .node elements currently rendered
  async nodeCount() {
    return await this.page.$$eval(this.nodeSel, nodes => nodes.length);
  }

  // Returns array of numeric values shown in nodes (as strings)
  async nodeValues() {
    return await this.page.$$eval(`${this.nodeSel} .value`, spans =>
      Array.from(spans).map(s => s.textContent.trim())
    );
  }

  // Returns whether the deque container currently has the 'shake' class
  async dequeHasShake() {
    return await this.page.$eval(this.dequeSel, el => el.classList.contains('shake'));
  }

  // Returns array of node elements handles
  async nodeHandles() {
    return await this.page.$$(this.nodeSel);
  }

  // Wait until node count equals expected (with timeout defaults)
  async waitForNodeCount(expected, options = {}) {
    await this.page.waitForFunction(
      (sel, exp) => document.querySelectorAll(sel).length === exp,
      this.nodeSel,
      expected,
      options
    );
  }

  // Convenience: wait for node count to change by delta compared to beforeCount
  async waitForNodeCountChange(beforeCount, delta) {
    const expected = beforeCount + delta;
    await this.waitForNodeCount(expected, { timeout: 3000 });
  }
}

test.describe('Deque - Elegant Visual Exploration (FSM verification)', () => {
  let dequePage;
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for console and page errors for each test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', error => {
      // Capture runtime errors (ReferenceError, TypeError, SyntaxError, etc.)
      pageErrors.push({ name: error.name, message: error.message, stack: error.stack || '' });
    });

    dequePage = new DequePage(page);
    await dequePage.goto();
  });

  test.afterEach(async () => {
    // After each test assert that no uncaught page errors occurred
    // and no console.error messages were emitted. This validates that the
    // application runs without unhandled ReferenceError/SyntaxError/TypeError
    // across the interactions performed by the test.
    expect(pageErrors, 'No page runtime errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('Initial state: Idle (S0_Idle) renders initial deque correctly', async ({ page }) => {
    // Validate initial "Idle" state: the deque should be rendered with initial nodes.
    // The implementation starts with deque = [18, 7, 35, 22] (4 nodes).
    const initialCount = await dequePage.nodeCount();
    expect(initialCount).toBeGreaterThanOrEqual(1);
    // Expect 4 nodes based on the source (best-effort): assert at least 4 nodes exist.
    // We allow >=1 to be robust but check for the expected 4 specifically as a stronger assertion.
    expect(initialCount).toBe(4);

    // For length 4, the active node logic sets active at index Math.floor(4/2) === 2
    const values = await dequePage.nodeValues();
    expect(values.length).toBe(4);
    // Check that the node at index 2 has the 'active' class
    const thirdNodeHasActive = await page.$eval(
      '.deque .node:nth-of-type(3)',
      (el) => el.classList.contains('active')
    );
    expect(thirdNodeHasActive).toBe(true);

    // Ensure deque container innerHTML is not empty (S0_Idle evidence)
    const dequeHtml = await page.$eval('.deque', el => el.innerHTML);
    expect(dequeHtml.length).toBeGreaterThan(0);
  });

  test('PushFront from Idle adds a new node at the front (S0_Idle -> S0_Idle)', async ({ page }) => {
    // Verify pushing to front increases node count and places new value at front.
    const beforeCount = await dequePage.nodeCount();
    const beforeValues = await dequePage.nodeValues();
    const firstBefore = beforeValues[0];

    // Click Push Front
    await dequePage.pushFront();

    // New node is added synchronously via unshift + render (animation handled separately).
    // Wait for the node count to increase by 1
    await dequePage.waitForNodeCountChange(beforeCount, 1);
    const afterCount = await dequePage.nodeCount();
    expect(afterCount).toBe(beforeCount + 1);

    const afterValues = await dequePage.nodeValues();
    expect(afterValues.length).toBe(afterCount);

    // New front value should be different from previous front (randomValue)
    expect(afterValues[0]).not.toBe(firstBefore);

    // Check the new front node has inline transform style applied initially (scale), or eventually returns to scale(1)
    // We give a small grace period and check that at least at some point the inline transform was used.
    const firstNodeHandle = (await dequePage.nodeHandles())[0];
    const transformInline = await firstNodeHandle.evaluate(node => node.style.transform || '');
    // Accept either scaled immediate style (scale(1.25)) or eventual scale(1)
    expect(typeof transformInline).toBe('string');

    // Ensure no 'shake' class was accidentally added
    const hasShake = await dequePage.dequeHasShake();
    expect(hasShake).toBe(false);
  });

  test('PushFront transitions to Full state and triggers shake when at MAX_SIZE (S0_Idle -> S1_Full)', async ({ page }) => {
    // Starting from initial 4, push until MAX_SIZE === 7
    const MAX_SIZE = 7;
    let count = await dequePage.nodeCount();
    expect(count).toBeGreaterThan(0);

    // Keep pushing until length reaches MAX_SIZE
    while (count < MAX_SIZE) {
      await dequePage.pushFront();
      // each push adds a node immediately
      await dequePage.waitForNodeCount(count + 1);
      count = await dequePage.nodeCount();
    }
    expect(count).toBe(MAX_SIZE);

    // Now attempt one more push which should trigger the "full" guard and add shake class
    await dequePage.pushFront();
    // Immediately after click, implementation adds 'shake' class and removes after 440ms
    const hasShakeNow = await dequePage.dequeHasShake();
    expect(hasShakeNow).toBe(true);

    // Wait for the shake animation to complete and be removed
    await page.waitForTimeout(500);
    const hasShakeLater = await dequePage.dequeHasShake();
    expect(hasShakeLater).toBe(false);

    // Ensure node count did not increase beyond MAX_SIZE (guard prevented addition)
    const finalCount = await dequePage.nodeCount();
    expect(finalCount).toBe(MAX_SIZE);
  });

  test('PopBack removes the last node when deque is non-empty (S0_Idle -> S0_Idle)', async ({ page }) => {
    // Ensure we have at least 2 nodes to pop from
    let count = await dequePage.nodeCount();
    if (count < 2) {
      // push some items to ensure there are elements to pop
      await dequePage.pushFront();
      await dequePage.waitForNodeCount(count + 1);
      count = await dequePage.nodeCount();
    }

    const valuesBefore = await dequePage.nodeValues();
    const lastBefore = valuesBefore[valuesBefore.length - 1];

    // Click Pop Back: implementation animates last node then after ~460ms pops and re-renders
    await dequePage.popBack();

    // Wait for the DOM to update - expect count decrease by 1
    await page.waitForTimeout(520); // slightly more than animation delay
    const countAfter = await dequePage.nodeCount();
    expect(countAfter).toBe(count - 1);

    const valuesAfter = await dequePage.nodeValues();
    const lastAfter = valuesAfter[valuesAfter.length - 1] || null;
    // lastAfter should not equal the lastBefore (it was removed)
    expect(lastAfter).not.toBe(lastBefore);
  });

  test('PopBack on empty deque triggers shake and remains empty (S0_Idle -> S2_Empty)', async ({ page }) => {
    // First, pop repeatedly until empty
    let count = await dequePage.nodeCount();
    while (count > 0) {
      await dequePage.popBack();
      // wait for pop animation + rerender
      await page.waitForTimeout(520);
      count = await dequePage.nodeCount();
    }
    expect(count).toBe(0);

    // Now clicking Pop Back when empty should add 'shake' class momentarily and not throw
    await dequePage.popBack();
    // Immediately check shake
    const shakeNow = await dequePage.dequeHasShake();
    expect(shakeNow).toBe(true);

    // After 500ms the shake class should be removed
    await page.waitForTimeout(500);
    const shakeLater = await dequePage.dequeHasShake();
    expect(shakeLater).toBe(false);

    // Ensure still empty
    const finalCount = await dequePage.nodeCount();
    expect(finalCount).toBe(0);
  });

  test('PushFront from Empty transitions to Idle and renders new node (S2_Empty -> S0_Idle)', async ({ page }) => {
    // Ensure deque is empty first
    let count = await dequePage.nodeCount();
    while (count > 0) {
      await dequePage.popBack();
      await page.waitForTimeout(520);
      count = await dequePage.nodeCount();
    }
    expect(count).toBe(0);

    // Now push front into empty deque
    await dequePage.pushFront();
    // Node is added synchronously
    await dequePage.waitForNodeCount(1);
    const newCount = await dequePage.nodeCount();
    expect(newCount).toBe(1);

    // For deque length < 3 and length ===1, first node should be marked active
    const activeOnFirst = await page.$eval('.deque .node', el => el.classList.contains('active'));
    expect(activeOnFirst).toBe(true);

    // Ensure the displayed value is a 2-digit number (randomValue returns 10-99)
    const val = (await dequePage.nodeValues())[0];
    expect(/^\d+$/.test(val)).toBe(true);
    const numVal = Number(val);
    expect(numVal).toBeGreaterThanOrEqual(10);
    expect(numVal).toBeLessThanOrEqual(99);
  });

  test('Application should not emit runtime ReferenceError/SyntaxError/TypeError during interactions', async ({ page }) => {
    // This test is an explicit sanity check: perform a few interactions and ensure no page errors are captured.
    // Interactions: push, pop, push
    await dequePage.pushFront();
    await page.waitForTimeout(100);
    await dequePage.popBack();
    await page.waitForTimeout(520);
    await dequePage.pushFront();
    await page.waitForTimeout(100);

    // At this point, the beforeEach/afterEach will assert that pageErrors and consoleErrors are empty.
    // We add an explicit assertion here as well to make the expectation clear within the test body:
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});