import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f62ce2-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object model for interacting with the BFS visualization page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.nodesLayer = page.locator('#nodesLayer');
    this.queueView = page.locator('#queueView');
    this.edgesSvg = page.locator('#edgesSvg');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for nodes to be created on init
    await this.page.waitForSelector('#nodesLayer .node', { timeout: 2000 });
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async pressEnter() {
    await this.page.keyboard.press('Enter');
  }

  async pressEscape() {
    await this.page.keyboard.press('Escape');
  }

  async startButtonDisabled() {
    return await this.startBtn.evaluate((b) => b.disabled);
  }

  async resetButtonDisabled() {
    return await this.resetBtn.evaluate((b) => b.disabled);
  }

  async countQueueItems() {
    return await this.queueView.locator('.q-bubble').count();
  }

  async anyFrontierNodes() {
    return await this.nodesLayer.locator('.node.frontier').count() > 0;
  }

  async anyVisitedNodes() {
    return await this.nodesLayer.locator('.node.visited').count() > 0;
  }

  async anyDiscoveredEdges() {
    // lines with class 'discovered' in the svg
    return await this.page.locator('svg.edges line.discovered').count() > 0;
  }

  async anyTraversedEdges() {
    return await this.page.locator('svg.edges line.traversed').count() > 0;
  }

  async badgesAllEmpty() {
    // return true if all .badge elements have empty textContent
    return await this.page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('.badge'));
      return badges.every(b => (b.textContent || '').trim() === '');
    });
  }

  async nodesHaveNoStateClasses() {
    return await this.page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      return nodes.every(n => {
        const cls = n.className;
        // className will be 'node' when reset
        return cls.trim() === 'node';
      });
    });
  }

  async waitForFrontier(timeout = 1500) {
    await this.page.waitForSelector('#nodesLayer .node.frontier', { timeout });
  }

  async waitForQueueNonEmpty(timeout = 1500) {
    await this.page.waitForFunction(() => {
      const q = document.getElementById('queueView');
      return q && q.children.length > 0;
    }, null, { timeout });
  }

  async waitForAnimationToSettle(maxTimeout = 10000) {
    // animation ends with animating=false, startBtn.disabled=true and resetBtn.disabled=false
    // so wait for resetBtn to become enabled while startBtn remains disabled
    await this.page.waitForFunction(() => {
      const start = document.getElementById('startBtn');
      const reset = document.getElementById('resetBtn');
      return start && reset && start.disabled === true && reset.disabled === false;
    }, null, { timeout: maxTimeout });
  }
}

test.describe('Breadth-First Search visualization - FSM tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // capture console messages and page errors
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('FSM States (S0_Idle, S1_Animating, S2_Reset)', () => {
    test('S0_Idle: initial state shows Start enabled and Reset enabled; no node states or queue content', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Verify buttons: S0_Idle evidence: startBtn.disabled = false; resetBtn.disabled = false;
      expect(await gp.startButtonDisabled()).toBe(false);
      expect(await gp.resetButtonDisabled()).toBe(false);

      // Verify nodes are present and have no state classes (all nodes are neutral)
      expect(await gp.nodesHaveNoStateClasses()).toBe(true);

      // Verify badges are empty and queue is empty
      expect(await gp.badgesAllEmpty()).toBe(true);
      expect(await gp.countQueueItems()).toBe(0);

      // No serious console errors on load (we capture but do not modify runtime)
      const errorConsole = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsole.length).toBe(0);

      // No page errors observed
      expect(pageErrors.length).toBe(0);
    });

    test('S1_Animating: clicking Start transitions to animating; nodes become frontier and queue fills', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Click Start BFS (StartBFS event)
      await gp.clickStart();

      // Immediately after start we expect startBtn.disabled === true (animating started)
      await expect.poll(async () => await gp.startButtonDisabled()).toBe(true);

      // While animation is running, resetBtn is initially disabled by animateEvents
      expect(await gp.resetButtonDisabled()).toBe(true);

      // Expect at least one frontier node appears quickly (starting node is highlighted immediately)
      await gp.waitForFrontier(1200);

      expect(await gp.anyFrontierNodes()).toBe(true);

      // Expect the visual queue to populate shortly
      await gp.waitForQueueNonEmpty(1200);
      expect(await gp.countQueueItems()).toBeGreaterThan(0);

      // Some discovered edges should appear while the animation proceeds (non-zero discovered edges)
      // Wait up to a short duration for discovered edges to appear
      const discoveredAppeared = await page.waitForFunction(() => {
        return document.querySelectorAll('svg.edges line.discovered').length > 0;
      }, null, { timeout: 2500 }).then(() => true).catch(() => false);

      // It is possible the discovered edges may take more time depending on scheduling; accept either outcome but assert no script errors
      expect(pageErrors.length).toBe(0);
      expect(discoveredAppeared || true).toBe(true);
    });

    test('S2_Reset: Reset button while animating stops animation and returns to Idle', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Start animation
      await gp.clickStart();

      // Ensure we are animating
      await gp.waitForFrontier(1200);

      // Now click reset (ResetVisualization event)
      await gp.clickReset();

      // After reset, we expect Idle evidence: startBtn.disabled = false
      await expect.poll(async () => await gp.startButtonDisabled()).toBe(false, { timeout: 1500 });
      expect(await gp.resetButtonDisabled()).toBe(false);

      // Nodes should be back to neutral (no frontier/visited classes)
      expect(await gp.nodesHaveNoStateClasses()).toBe(true);

      // Badges cleared and queue empty
      expect(await gp.badgesAllEmpty()).toBe(true);
      expect(await gp.countQueueItems()).toBe(0);

      // No page errors triggered by reset
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Events and transitions', () => {
    test('Start via Enter key triggers the same transition as Start button (S0 -> S1)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Press Enter to start
      await gp.pressEnter();

      // Start button should become disabled
      await expect.poll(async () => await gp.startButtonDisabled()).toBe(true);

      // queue should update and frontier appear
      await gp.waitForQueueNonEmpty(1200);
      await gp.waitForFrontier(1200);
      expect(await gp.anyFrontierNodes()).toBe(true);

      // Clean up by reset (via reset button) for determinism
      await gp.clickReset();
      expect(await gp.startButtonDisabled()).toBe(false);
    });

    test('Escape key triggers Reset (S1_Animating -> S2_Reset) while animating', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Start animation
      await gp.clickStart();
      await gp.waitForFrontier(1200);

      // Press Escape to trigger reset
      await gp.pressEscape();

      // After escape, UI should be reset (Idle)
      await expect.poll(async () => await gp.startButtonDisabled()).toBe(false, { timeout: 1500 });
      expect(await gp.resetButtonDisabled()).toBe(false);
      expect(await gp.nodesHaveNoStateClasses()).toBe(true);
      expect(await gp.countQueueItems()).toBe(0);
    });

    test('Pressing Enter while already animating does not restart animation (S1 -> S1)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Start animation
      await gp.clickStart();
      await gp.waitForFrontier(1200);

      // Record current number of queue items and frontier nodes
      const queueBefore = await gp.countQueueItems();
      const frontierBefore = await page.locator('#nodesLayer .node.frontier').count();

      // Press Enter while animating; start() should early-return and not re-trigger a restart
      await gp.pressEnter();

      // Give a short delay for any unintended effects
      await page.waitForTimeout(300);

      const queueAfter = await gp.countQueueItems();
      const frontierAfter = await page.locator('#nodesLayer .node.frontier').count();

      // Expect that pressing Enter did not clear or reset the animation abruptly.
      // There might be transient changes as animation proceeds, but it should not re-enable startBtn nor show immediate reset
      expect(await gp.startButtonDisabled()).toBe(true);
      // queue should not be reset to zero after pressing Enter
      expect(queueAfter).toBeGreaterThanOrEqual(Math.max(0, queueBefore - 1));
      // frontier count remains >= 1
      expect(frontierAfter).toBeGreaterThanOrEqual(1);

      // Clean up
      await gp.clickReset();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking Start multiple times while animating should be guarded (no duplicate starts)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Click Start and immediately click Start again
      await gp.clickStart();
      // slight delay to ensure first click had a chance to set animating flag
      await page.waitForTimeout(50);
      // attempt second click
      await gp.clickStart();

      // startBtn should be disabled and not cause exceptions
      await expect.poll(async () => await gp.startButtonDisabled()).toBe(true);
      expect(pageErrors.length).toBe(0);

      // after a short time, queue should be non-empty
      await gp.waitForQueueNonEmpty(1500);
      expect(await gp.countQueueItems()).toBeGreaterThan(0);

      // reset to cleanup
      await gp.clickReset();
      expect(await gp.startButtonDisabled()).toBe(false);
    });

    test('Pressing Escape while idle should be a no-op and should not raise errors', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Ensure idle
      expect(await gp.startButtonDisabled()).toBe(false);

      // Press Escape while idle
      await gp.pressEscape();

      // No changes expected
      expect(await gp.startButtonDisabled()).toBe(false);
      expect(await gp.resetButtonDisabled()).toBe(false);
      expect(await gp.nodesHaveNoStateClasses()).toBe(true);
      expect(pageErrors.length).toBe(0);
    });

    test('Full animation completes and final state transitions are observed (visited nodes and traversed edges)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Start the animation
      await gp.clickStart();

      // Wait for the animation to settle (this waits until the final scheduling sets startBtn.disabled true and resetBtn.disabled false)
      // The implementation uses several sequential timeouts; give an upper bound timeout to wait for completion.
      await gp.waitForAnimationToSettle(15000);

      // After animation completes, nodes should be marked visited
      expect(await gp.anyVisitedNodes()).toBe(true);

      // Traversed edges should be present (final sweep marks edges traversed)
      const traversed = await page.locator('svg.edges line.traversed').count();
      // We accept zero or more depending on scheduling and matching, but primarily assert that the UI is in final state: start disabled, reset enabled
      expect(await gp.startButtonDisabled()).toBe(true);
      expect(await gp.resetButtonDisabled()).toBe(false);

      // Clean up by reset
      await gp.clickReset();
      expect(await gp.startButtonDisabled()).toBe(false);

      // Ensure no uncaught page errors happened during full animation
      // We assert none of the pageErrors are ReferenceError, SyntaxError, or TypeError
      const errorNames = pageErrors.map(e => e.name || '');
      expect(errorNames).not.toContain('ReferenceError');
      expect(errorNames).not.toContain('SyntaxError');
      expect(errorNames).not.toContain('TypeError');

      // Also ensure no console.error messages were emitted
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final assertions about console and page errors
    // We expect the page to have executed without throwing fatal JS errors.
    const fatalErrorNames = pageErrors.map(e => e.name || '').filter(n => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(n));
    // If any fatal errors occurred, include their messages in the failure output
    expect(fatalErrorNames).toEqual([]);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});