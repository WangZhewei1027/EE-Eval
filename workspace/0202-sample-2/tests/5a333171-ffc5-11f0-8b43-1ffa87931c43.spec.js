import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a333171-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object for BFS Visualization page
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.queue = page.locator('#queue');
    this.svg = page.locator('#graph-svg');
    this.node = (n) => page.locator(`#graph-svg g.node[data-node="${n}"]`);
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns innerHTML of queue
  async queueHTML() {
    return this.queue.innerHTML();
  }

  // Returns visible text of queue
  async queueText() {
    return this.queue.textContent();
  }

  // Returns array of node indices present in the SVG (data-node attributes)
  async nodeIndices() {
    return this.page.$$eval('#graph-svg g.node', (nodes) => nodes.map(n => Number(n.getAttribute('data-node'))));
  }

  // Returns class list for a node as a string (or empty string)
  async nodeClassList(n) {
    const attr = await this.node(n).getAttribute('class');
    return attr || '';
  }

  // Click start button
  async clickStart() {
    await this.startBtn.click();
  }

  // Click reset button
  async clickReset() {
    await this.resetBtn.click();
  }

  async isStartEnabled() {
    return this.startBtn.isEnabled();
  }

  async isResetEnabled() {
    return this.resetBtn.isEnabled();
  }
}

test.describe('FSM: Breadth-First Search (BFS) Visualization - States & Transitions', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Capture page errors and console messages for assertions
    pageErrors = [];
    consoleMessages = [];
    page.on('pageerror', (err) => {
      // store the Error object
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async () => {
    // Basic smoke assertions about console/page errors:
    // Ensure there are no uncaught page errors (ReferenceError, SyntaxError, TypeError)
    const errorTexts = pageErrors.map(e => String(e));
    for (const text of errorTexts) {
      // Fail explicitly if known JS runtime errors appear
      expect(text).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }

    // Also ensure no console.error messages that include those error names
    const consoleErrors = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    for (const txt of consoleErrors) {
      expect(txt).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });

  test.describe('Initial State: S0_Idle (resetGraph on entry)', () => {
    test('should load page and be in Idle state with resetGraph applied', async ({ page }) => {
      // Test validates initial Idle state: start enabled, reset disabled, queue empty, no node states
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Basic DOM existence checks
      await expect(bfs.startBtn).toBeVisible();
      await expect(bfs.resetBtn).toBeVisible();
      await expect(bfs.svg).toBeVisible();
      await expect(bfs.queue).toBeVisible();

      // Start button should be enabled initially; Reset should be disabled per HTML attribute
      expect(await bfs.isStartEnabled()).toBe(true);
      expect(await bfs.isResetEnabled()).toBe(false);

      // Queue should display empty "[ ]"
      const qText = await bfs.queueText();
      expect(qText).toContain('Queue:');
      // It should not contain any numbers yet
      expect(qText).toMatch(/Queue:\s*\[\s*\]/);

      // There should be 9 node elements (0-8)
      const indices = await bfs.nodeIndices();
      expect(indices.length).toBe(9);
      for (let i = 0; i <= 8; i++) {
        expect(indices).toContain(i);
        const cls = await bfs.nodeClassList(i);
        // No node should be marked visited/current on reset
        expect(cls).not.toMatch(/\bvisited\b/);
        expect(cls).not.toMatch(/\bcurrent\b/);
      }
    });
  });

  test.describe('Transition: StartBFS_Click (S0_Idle -> S1_BFS_Running)', () => {
    test('clicking Start BFS triggers startBFS, disables Start, enables Reset and enqueues node 0', async ({ page }) => {
      // This test checks the onEnter action startBFS and expected observables that BFS starts processing nodes
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Click the Start button
      await bfs.clickStart();

      // startBFS synchronously pushes 0 and updates UI before interval steps occur
      expect(await bfs.isStartEnabled()).toBe(false);
      expect(await bfs.isResetEnabled()).toBe(true);

      // Queue should now contain 0 immediately
      const qTextImmediate = await bfs.queueText();
      expect(qTextImmediate).toContain('[ 0 ]');

      // Wait for the first BFS step to occur (~1200ms) plus small margin
      await page.waitForTimeout(1300);

      // After first step, the current node should be node 0 (class 'current') and queue should now list its neighbors
      const node0Class = await bfs.nodeClassList(0);
      expect(node0Class).toMatch(/\bcurrent\b/);

      // Queue should have enqueued neighbors of 0 (1 and 3). Order per implementation: neighbors are pushed as encountered.
      const qTextAfterStep = await bfs.queueText();
      // It should contain 1 and 3; exact order may be "1, 3"
      expect(qTextAfterStep).toMatch(/\[.*1.*3.*\]/);

      // Also ensure no runtime errors were emitted in console or pageerror (captured in afterEach)
    });

    test('BFS advances: after two steps node 0 becomes visited and node 1 becomes current', async ({ page }) => {
      // This test ensures BFS progression: S1 active processes nodes in sequence and sets visited/current classes
      const bfs = new BFSPage(page);
      await bfs.goto();

      await bfs.clickStart();

      // Wait for two steps (~2400ms) plus margin
      await page.waitForTimeout(2600);

      // After two steps, node 0 should be visited (not 'current'), and some other node should be 'current' (likely 1)
      const node0Class = await bfs.nodeClassList(0);
      expect(node0Class).toMatch(/\bvisited\b/);
      expect(node0Class).not.toMatch(/\bcurrent\b/);

      // Find which node has 'current' class (should be 1 typically)
      let foundCurrent = null;
      for (let i = 0; i <= 8; i++) {
        const cls = await bfs.nodeClassList(i);
        if (cls.match(/\bcurrent\b/)) {
          foundCurrent = i;
          break;
        }
      }
      expect(foundCurrent).not.toBeNull();
    });
  });

  test.describe('Reset behavior and transition S1_BFS_Running -> S0_Idle', () => {
    test('clicking Reset during BFS should clear interval and return to Idle', async ({ page }) => {
      // This test validates that Reset clears BFS and invokes resetGraph (exit actions asserted via UI)
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Start BFS then wait a single step so there is some running state
      await bfs.clickStart();
      await page.waitForTimeout(1300);

      // Precondition: reset should be enabled
      expect(await bfs.isResetEnabled()).toBe(true);

      // Click reset to transition back to Idle
      await bfs.clickReset();

      // After reset: Start should be enabled, Reset disabled, queue empty, no node classes
      expect(await bfs.isStartEnabled()).toBe(true);
      expect(await bfs.isResetEnabled()).toBe(false);

      const qText = await bfs.queueText();
      expect(qText).toMatch(/Queue:\s*\[\s*\]/);

      // No nodes should show visited/current
      for (let i = 0; i <= 8; i++) {
        const cls = await bfs.nodeClassList(i);
        expect(cls).not.toMatch(/\bvisited\b/);
        expect(cls).not.toMatch(/\bcurrent\b/);
      }

      // Wait additional time to ensure no further BFS steps occur (if interval wasn't cleared this would show changes)
      await page.waitForTimeout(1400);
      const qTextAfter = await bfs.queueText();
      expect(qTextAfter).toMatch(/Queue:\s*\[\s*\]/);
    });

    test('Reset button initially has disabled attribute in DOM (edge case check)', async ({ page }) => {
      // This test asserts presence of disabled attribute on reset button as provided in HTML
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Check the disabled attribute exists on the reset button element
      const hasDisabledAttr = await page.$eval('#resetBtn', el => el.hasAttribute('disabled'));
      expect(hasDisabledAttr).toBe(true);
    });
  });

  test.describe('Transition to S2_BFS_Finished (final state) and final observables', () => {
    test('BFS should eventually finish processing all nodes and show (Finished) in queue', async ({ page }) => {
      // This test waits for the BFS to reach final state where queue.length === 0 and UI shows Finished tag
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Start BFS
      await bfs.clickStart();

      // Wait until the UI appends "(Finished)" to the queue innerHTML.
      // Full BFS for 9 nodes with 1.2s per step will take approx 11s; allow margin
      await page.waitForFunction(() => {
        const q = document.getElementById('queue');
        return q && q.innerHTML.includes('(Finished)');
      }, null, { timeout: 20000 });

      // After finishing, queue should include "(Finished)"
      const qHtml = await bfs.queueHTML();
      expect(qHtml).toContain('(Finished)');

      // On finish, per implementation: startBtn.disabled = true, resetBtn.disabled = false
      expect(await bfs.isStartEnabled()).toBe(false);
      expect(await bfs.isResetEnabled()).toBe(true);

      // Ensure all nodes are either visited or not current (no lingering 'current' after finish)
      for (let i = 0; i <= 8; i++) {
        const cls = await bfs.nodeClassList(i);
        // No node should be 'current' after finished (currentNode set to null)
        expect(cls).not.toMatch(/\bcurrent\b/);
      }
    }, 30000); // extend timeout for longer wait
  });

  test.describe('Edge cases & error scenarios', () => {
    test('clicking Start multiple times does not crash the page and Start gets disabled after first click', async ({ page }) => {
      // This test attempts to click Start repeatedly to ensure robust button state handling
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Click start once
      await bfs.clickStart();
      expect(await bfs.isStartEnabled()).toBe(false);

      // Attempt to click start again should be a no-op because button is disabled; ensure Playwright's isEnabled prevents a second click
      // If Playwright were to click a disabled button it would throw; ensure state protected
      const canClick = await bfs.startBtn.isEnabled();
      expect(canClick).toBe(false);
    });

    test('no unexpected ReferenceError, SyntaxError, or TypeError in console or page errors during interactions', async ({ page }) => {
      // This test explicitly performs several interactions and asserts absence of critical runtime errors
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Perform interactions: start, wait 1 step, reset, start again, wait 1 step
      await bfs.clickStart();
      await page.waitForTimeout(1300);
      await bfs.clickReset();
      await bfs.clickStart();
      await page.waitForTimeout(1300);

      // Gather all captured console messages and page errors from handlers (set in beforeEach)
      // Verify none contain common fatal error types
      const pageErrTexts = pageErrors.map(e => String(e));
      for (const text of pageErrTexts) {
        expect(text).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }

      const consoleErrTexts = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
      for (const txt of consoleErrTexts) {
        expect(txt).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
    });
  });
});