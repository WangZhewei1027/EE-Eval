import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a87eb1-fa78-11f0-812d-c9788050701f.html';

// Page Object for interacting with the Circular Linked List demo
class CircularListPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait until DOMContentLoaded (the app attaches its setup to this event)
    await this.page.waitForLoadState('domcontentloaded');
  }

  traverseButton() {
    return this.page.locator('#traverse');
  }

  resetButton() {
    return this.page.locator('#reset');
  }

  visualizationContainer() {
    return this.page.locator('.visualization-container');
  }

  nodes() {
    return this.page.locator('.visualization-container .node');
  }

  connections() {
    return this.page.locator('.visualization-container .connection');
  }

  // Convenience to get class list of node at index
  async nodeHasHighlight(index) {
    const node = this.nodes().nth(index);
    return await node.evaluate((n) => n.classList.contains('highlight'));
  }

  // Clicks with a small built-in wait for stability
  async clickTraverse() {
    await this.traverseButton().click();
    // allow immediate DOM update
    await this.page.waitForTimeout(50);
  }

  async clickReset() {
    await this.resetButton().click();
    // allow immediate DOM update
    await this.page.waitForTimeout(50);
  }
}

test.describe('Circular Linked List | FSM and Visual Tests', () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect unhandled page errors
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners to be safe (Playwright will cleanup but keep explicit)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial render (S0_Idle) - nodes and connections are created on DOMContentLoaded', async ({ page }) => {
    // This test validates the S0_Idle entry action (renderPage via DOMContentLoaded)
    const app = new CircularListPage(page);
    await app.goto();

    // Verify container exists
    await expect(app.visualizationContainer()).toBeVisible();

    // Expect 5 nodes created as per implementation
    await expect(app.nodes()).toHaveCount(5);

    // Expect 5 connections (4 between sequential nodes + 1 final circular connection)
    await expect(app.connections()).toHaveCount(5);

    // Validate node labels are "1".."5" and elements have left/top styles set (basic positional sanity)
    for (let i = 0; i < 5; i++) {
      const node = app.nodes().nth(i);
      await expect(node).toHaveText(String(i + 1));
      const left = await node.evaluate((n) => n.style.left);
      const top = await node.evaluate((n) => n.style.top);
      // left/top should be non-empty strings like "123.45px"
      expect(typeof left).toBe('string');
      expect(left.length).toBeGreaterThan(0);
      expect(typeof top).toBe('string');
      expect(top.length).toBeGreaterThan(0);
    }

    // Assert there were no unhandled page errors during initial render
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Traversing on TraverseClick: traverse highlights nodes in sequence', async ({ page }) => {
    // This test validates that clicking the Traverse List button starts traversal (entry action: traverse())
    const app = new CircularListPage(page);
    await app.goto();

    // Reset any initial animation that may run after load to avoid timing interference
    await app.clickReset();

    // Click traverse -> first node should immediately get .highlight
    await app.clickTraverse();
    // Immediately check first node highlighted
    expect(await app.nodeHasHighlight(0)).toBe(true);

    // After ~1.1s the highlight should move to node 2 (index 1)
    await page.waitForTimeout(1100);
    expect(await app.nodeHasHighlight(0)).toBe(false);
    expect(await app.nodeHasHighlight(1)).toBe(true);

    // After another ~1.1s it should move to node 3 (index 2)
    await page.waitForTimeout(1100);
    expect(await app.nodeHasHighlight(1)).toBe(false);
    expect(await app.nodeHasHighlight(2)).toBe(true);

    // Clean up: reset animation and assert highlights cleared (this also validates exit action resetAnimation())
    await app.clickReset();
    for (let i = 0; i < 5; i++) {
      expect(await app.nodeHasHighlight(i)).toBe(false);
    }

    // Validate no page errors during traversal
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_Traversing -> S0_Idle on ResetClick: reset clears highlighting and stops animation', async ({ page }) => {
    // This test validates that Reset Animation returns the app to Idle (exit action invoked)
    const app = new CircularListPage(page);
    await app.goto();

    // Start traversal
    await app.clickTraverse();
    expect(await app.nodeHasHighlight(0)).toBe(true);

    // Wait for one tick to change to next node to ensure interval is running
    await page.waitForTimeout(1100);
    expect(await app.nodeHasHighlight(1)).toBe(true);

    // Now click reset - highlights should be removed immediately
    await app.clickReset();
    for (let i = 0; i < 5; i++) {
      expect(await app.nodeHasHighlight(i)).toBe(false);
    }

    // Wait additional time to ensure the interval truly stopped (if it hadn't, highlights would resume)
    await page.waitForTimeout(1500);
    for (let i = 0; i < 5; i++) {
      expect(await app.nodeHasHighlight(i)).toBe(false);
    }

    // Validate no page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Clicking Traverse multiple times rapidly should restart traversal cleanly', async ({ page }) => {
    // This ensures traverse() calls resetAnimation() internally and restarts without throwing errors
    const app = new CircularListPage(page);
    await app.goto();

    // Rapidly click traverse twice
    await app.traverseButton().click();
    await app.traverseButton().click();

    // Immediately the first node should be highlighted (because traverse resets then highlights)
    expect(await app.nodeHasHighlight(0)).toBe(true);

    // After 1.1s it should be at node 2 (index 1)
    await page.waitForTimeout(1100);
    expect(await app.nodeHasHighlight(1)).toBe(true);

    // Immediately click traverse again which should restart highlighting from node 0
    await app.traverseButton().click();
    // small wait for DOM update
    await page.waitForTimeout(60);
    expect(await app.nodeHasHighlight(0)).toBe(true);

    // Clean up
    await app.clickReset();

    // Assert there were no unhandled exceptions produced by rapid clicks
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Clicking Reset when idle should be a no-op and not throw', async ({ page }) => {
    // This validates that resetAnimation is safe to call even if no animation is running
    const app = new CircularListPage(page);
    await app.goto();

    // Ensure idle: reset to clear any queued animation
    await app.clickReset();

    // Click reset again while idle
    await app.clickReset();

    // Check nodes remain unhighlighted
    for (let i = 0; i < 5; i++) {
      expect(await app.nodeHasHighlight(i)).toBe(false);
    }

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console messages and page errors across interactions', async ({ page }) => {
    // This test demonstrates observation of console errors and page errors as required.
    const app = new CircularListPage(page);
    await app.goto();

    // Interact with the app in common ways
    await app.clickTraverse();
    await page.waitForTimeout(1100);
    await app.clickReset();

    // After interactions, we assert that there were no uncaught errors.
    // If there were errors, this assertion will fail and surface them.
    // We include the console contents in the assertion message for debugging.
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');

    expect(pageErrors.length, `Expected no unhandled page errors, found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(errorConsoleEntries.length, `Expected no console.error messages, found: ${errorConsoleEntries.map(e => e.text).join(' | ')}`).toBe(0);
  });
});