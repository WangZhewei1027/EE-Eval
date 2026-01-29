import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e17d4-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the visualization app
class VisualizationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startButton');
    this.nodesContainer = page.locator('#nodes');
    this.nodeLocator = page.locator('#nodes .node');
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async isStartButtonVisible() {
    return this.startButton.isVisible();
  }

  async clickStart() {
    await this.startButton.click();
  }

  async nodeCount() {
    return await this.nodeLocator.count();
  }

  async getNodeText(index) {
    return await this.nodeLocator.nth(index).innerText();
  }

  async nodeHasActiveClass(index) {
    return await this.nodeLocator.nth(index).evaluate((el) => el.classList.contains('active'));
  }

  async waitForNodeActive(index, timeout = 5000) {
    await this.page.waitForFunction(
      (idx) => {
        const nodes = document.querySelectorAll('#nodes .node');
        if (!nodes[idx]) return false;
        return nodes[idx].classList.contains('active');
      },
      index,
      { timeout }
    );
  }

  async waitForNodeNotActive(index, timeout = 5000) {
    await this.page.waitForFunction(
      (idx) => {
        const nodes = document.querySelectorAll('#nodes .node');
        if (!nodes[idx]) return true; // if node missing, consider not active
        return !nodes[idx].classList.contains('active');
      },
      index,
      { timeout }
    );
  }
}

test.describe('Branch and Bound Visualization - FSM validation', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console.error messages and page errors
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // If inspecting the console message fails, record the raw message
        consoleErrors.push(`(failed to read console message)`);
      }
    });

    page.on('pageerror', (err) => {
      // pageerror captures uncaught exceptions (ReferenceError, TypeError, SyntaxError at runtime)
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Assert that there were no unexpected runtime errors bubbled to the page or console.
    // This validates that the app loaded without uncaught ReferenceError, SyntaxError, TypeError, etc.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Idle state renders initial UI (S0_Idle)', async ({ page }) => {
    // Validate initial (Idle) state of the application:
    // - Start button is present and visible
    // - Nodes container exists and is initially empty
    const app = new VisualizationPage(page);

    // Ensure start button exists and is visible with expected label
    await expect(app.startButton).toBeVisible();
    await expect(app.startButton).toHaveText('Start Visualization');

    // Nodes container should be present
    await expect(app.nodesContainer).toBeVisible();

    // No nodes should exist initially (evidence for S0_Idle)
    const count = await app.nodeCount();
    expect(count).toBe(0);
  });

  test('StartVisualization event transitions to Visualizing state and creates nodes (S0 -> S1)', async ({ page }) => {
    // This test validates that clicking the start button:
    // - creates the expected number of nodes
    // - hides the start button (exit action of Idle)
    // - activates nodes according to the activation routine (entry actions of Visualizing)
    const app = new VisualizationPage(page);

    // Click start
    await expect(app.startButton).toBeVisible();
    await app.clickStart();

    // After clicking, start button should be hidden (display: none)
    await expect(app.startButton).toBeHidden();

    // Nodes should be created (nodeCount is expected to be 10 as per implementation)
    await page.waitForFunction(() => document.querySelectorAll('#nodes .node').length === 10, null, { timeout: 3000 });
    const count = await app.nodeCount();
    expect(count).toBe(10);

    // Validate each node has the class 'node' and contains sequential numbers 1..10 in creation order
    for (let i = 0; i < 10; i++) {
      const text = await app.getNodeText(i);
      expect(text).toBe(String(i + 1));
    }

    // Validate that the first node is active immediately (index 0 should have 'active' class)
    const firstActive = await app.nodeHasActiveClass(0);
    expect(firstActive).toBe(true);

    // Validate that only one node is active initially (activation logic toggles previous off)
    const activeCount = await page.evaluate(() => Array.from(document.querySelectorAll('#nodes .node')).filter(n => n.classList.contains('active')).length);
    expect(activeCount).toBe(1);
  });

  test('Activation sequence progresses over time (stepwise activation)', async ({ page }) => {
    // This test validates the sequential activation behavior implemented with timeouts:
    // node 0 -> active immediately
    // node 1 -> active at ~1000ms and node 0 removed
    // node 2 -> active at ~2000ms and node 1 removed
    // We'll assert the progression for the first three nodes to avoid long test times.
    const app = new VisualizationPage(page);

    // Start visualization
    await expect(app.startButton).toBeVisible();
    await app.clickStart();

    // Wait for nodes to be created
    await page.waitForFunction(() => document.querySelectorAll('#nodes .node').length === 10, null, { timeout: 3000 });

    // Step 0: node 0 should be active
    await app.waitForNodeActive(0, 1000);
    expect(await app.nodeHasActiveClass(0)).toBe(true);
    expect(await app.nodeHasActiveClass(1)).toBe(false);

    // Step 1: after ~1s, node 1 should be active and node 0 should no longer be active
    await app.waitForNodeActive(1, 2500); // allow some buffer
    expect(await app.nodeHasActiveClass(1)).toBe(true);
    expect(await app.nodeHasActiveClass(0)).toBe(false);

    // Step 2: after ~2s, node 2 should be active and node 1 should no longer be active
    await app.waitForNodeActive(2, 3500);
    expect(await app.nodeHasActiveClass(2)).toBe(true);
    expect(await app.nodeHasActiveClass(1)).toBe(false);
  }, { timeout: 10000 }); // increase test timeout to allow time-based checks

  test('Edge case: attempting to click Start Visualization after it is hidden should fail', async ({ page }) => {
    // This test attempts to click the start button a second time after it has been hidden.
    // We expect Playwright to reject the click because the element is not visible / not actionable.
    const app = new VisualizationPage(page);

    // Start once
    await expect(app.startButton).toBeVisible();
    await app.clickStart();

    // Ensure it's hidden
    await expect(app.startButton).toBeHidden();

    // Attempting to click should reject - verify the rejection occurs (ensures the element is not interactable).
    // We intentionally let Playwright produce the error and assert that it rejects.
    await expect(page.click('#startButton')).rejects.toThrow();
  });

  test('Observes console and page errors during load and interactions (should be none)', async ({ page }) => {
    // This test explicitly ensures that no console.error messages or page errors occurred
    // during the lifecycle up to this point. Collection happens in beforeEach; we also interact.
    const app = new VisualizationPage(page);

    // Minimal interaction to check for runtime exceptions:
    await expect(app.startButton).toBeVisible();
    await app.clickStart();

    // Wait for nodes creation to ensure any runtime errors during create/activate surface
    await page.waitForFunction(() => document.querySelectorAll('#nodes .node').length === 10, null, { timeout: 3000 });

    // At the end of this test the afterEach hook will assert that consoleErrors and pageErrors arrays are empty.
    // We also assert within the test for clarity.
    // Accessing the arrays is not possible directly here (scoped in outer hooks), but their emptiness will be enforced in afterEach.
    expect(true).toBe(true); // placeholder assertion to ensure test registers as checking the app UI
  });
});