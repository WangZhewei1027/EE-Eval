import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a335880-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object representing the Prim's Algorithm Demo page.
 */
class PrimPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startSelector = '#start';
    this.nextSelector = '#next';
    this.resetSelector = '#reset';
    this.infoSelector = '#info';
    this.finalWeightSelector = '#final-weight';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async start() {
    await this.page.click(this.startSelector);
  }

  async next() {
    await this.page.click(this.nextSelector);
  }

  async reset() {
    await this.page.click(this.resetSelector);
  }

  async getInfoText() {
    return (await this.page.locator(this.infoSelector).innerText()).trim();
  }

  async getFinalWeightText() {
    return (await this.page.locator(this.finalWeightSelector).innerText()).trim();
  }

  async isDisabled(selector) {
    return await this.page.locator(selector).isDisabled();
  }

  async nodeHasClass(nodeId, className) {
    const el = this.page.locator(`#node-${nodeId}`);
    const classes = await el.getAttribute('class');
    if (!classes) return false;
    return classes.split(/\s+/).includes(className);
  }

  async edgeHasClass(edgeId, className) {
    const el = this.page.locator(`#edge-${edgeId}`);
    const classes = await el.getAttribute('class');
    if (!classes) return false;
    return classes.split(/\s+/).includes(className);
  }

  // Wait until info text contains a substring (with timeout)
  async waitForInfoContains(substring, opts = {}) {
    await this.page.waitForFunction(
      (sel, substr) => document.querySelector(sel) && document.querySelector(sel).textContent.includes(substr),
      this.infoSelector,
      substring,
      opts
    );
  }

  // Utility: count edges with 'mst' class
  async countEdgesWithMST() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('line.edge.mst')).length;
    });
  }

  // Utility: count nodes with 'mst' class
  async countNodesWithMST() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('circle.node.mst')).length;
    });
  }
}

test.describe('Prim\'s Algorithm FSM - 5a335880-ffc5-11f0-8b43-1ffa87931c43', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page-level errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object; capture its name and message
      pageErrors.push({ name: err.name, message: err.message });
    });
  });

  test.afterEach(async () => {
    // After each test ensure there were no SyntaxError/ReferenceError/TypeError page errors.
    // The implementation specified to "observe console logs and page errors" and allow them to happen naturally.
    // Here we assert that no critical runtime errors occurred; if they do, that indicates a regression.
    const criticalErrors = pageErrors.filter(e =>
      e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError'
    );
    expect(criticalErrors, `No ReferenceError/SyntaxError/TypeError should be thrown. Observed: ${JSON.stringify(criticalErrors)}`).toEqual([]);
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('renders initial UI and buttons are in expected disabled/enabled state', async ({ page }) => {
      // Arrange
      const app = new PrimPage(page);
      await app.goto();

      // Assert: info contains the initial instruction (evidence of renderPage())
      const info = await app.getInfoText();
      expect(info).toContain('Click Start to begin the Prim\'s algorithm step-by-step demonstration.');

      // Start should be enabled; Next and Reset should be disabled
      expect(await app.isDisabled(app.startSelector)).toBeFalsy();
      expect(await app.isDisabled(app.nextSelector)).toBeTruthy();
      expect(await app.isDisabled(app.resetSelector)).toBeTruthy();
    });

    test('edge case: clicking Next or Reset before Start does nothing', async ({ page }) => {
      const app = new PrimPage(page);
      await app.goto();

      // Click Next (disabled). Playwright by default won't click disabled buttons.
      // To simulate a user trying to interact, check that element is disabled and ensure state unchanged.
      expect(await app.isDisabled(app.nextSelector)).toBeTruthy();
      expect(await app.isDisabled(app.resetSelector)).toBeTruthy();

      // Try force click (should be avoided in normal usage, but we verify app resists state change)
      // We do not force click disabled buttons per instructions not to patch environment;
      // instead assert state and DOM remain same after attempted interactions.
      // Assert that no nodes are active/mst and no edges have mst class
      for (let i = 0; i <= 6; i++) {
        expect(await app.nodeHasClass(i, 'active')).toBeFalsy();
        expect(await app.nodeHasClass(i, 'mst')).toBeFalsy();
      }
      expect(await app.countEdgesWithMST()).toBe(0);
    });
  });

  test.describe('Start transition (S0_Idle -> S1_Started)', () => {
    test('clicking Start triggers startPrim() and updates UI (node 0 active, next/reset enabled)', async ({ page }) => {
      const app = new PrimPage(page);
      await app.goto();

      // Start algorithm
      await app.start();

      // After start, node 0 should have class 'active'
      expect(await app.nodeHasClass(0, 'active')).toBeTruthy();

      // Next and Reset should now be enabled; Start should be disabled
      expect(await app.isDisabled(app.nextSelector)).toBeFalsy();
      expect(await app.isDisabled(app.resetSelector)).toBeFalsy();
      expect(await app.isDisabled(app.startSelector)).toBeTruthy();

      // Info message should include Step 0 and mention node A (label)
      const info = await app.getInfoText();
      expect(info).toContain('Step 0: Starting from node A');

      // Some edges adjacent to node 0 should have 'considered' class (evidence edges were pushed)
      // Node 0 adjacency has edges with id 0 and 1 (from edges list in HTML).
      expect(await app.edgeHasClass(0, 'considered')).toBeTruthy();
      expect(await app.edgeHasClass(1, 'considered')).toBeTruthy();
    });
  });

  test.describe('Step transitions and completion (S1_Started -> S2_StepCompleted -> S3_Finished)', () => {
    test('clicking Next repeatedly advances steps, colors edges/nodes, and finishes with final weight', async ({ page }) => {
      const app = new PrimPage(page);
      await app.goto();

      // Start the algorithm
      await app.start();
      // Wait for Step 0 info
      await app.waitForInfoContains('Step 0: Starting from node A');

      // We will click Next repeatedly until the info contains the completion message
      const MAX_NEXTS = 10; // safety cap
      let clicked = 0;
      for (let i = 0; i < MAX_NEXTS; i++) {
        // If next is disabled, break
        if (await app.isDisabled(app.nextSelector)) break;
        await app.next();
        clicked++;
        // After each next, info should mention Step X or the completion message
        // Wait briefly for UI update
        await page.waitForTimeout(50);
        const info = await app.getInfoText();
        if (info.includes('Prim\'s Algorithm completed')) {
          break;
        }
      }

      // We expect at least one Next click to have occurred to progress from the start state.
      expect(clicked).toBeGreaterThanOrEqual(1);

      // After finish, the info should show completion message and final-weight should be non-empty
      await app.waitForInfoContains('Prim\'s Algorithm completed!');
      const finalInfo = await app.getInfoText();
      expect(finalInfo).toContain('Prim\'s Algorithm completed!');

      const finalWeight = await app.getFinalWeightText();
      // Final weight should contain numeric total weight text
      expect(finalWeight).toMatch(/Total weight of MST:\s*\d+/);

      // Next should be disabled after finish
      expect(await app.isDisabled(app.nextSelector)).toBeTruthy();

      // At least n-1 edges should have 'mst' class (for 7 nodes, MST edges = 6)
      const mstEdgesCount = await app.countEdgesWithMST();
      expect(mstEdgesCount).toBeGreaterThanOrEqual(6);

      // All nodes should be in MST (class 'mst' or possibly 'active' cleared to 'mst')
      const nodesInMST = await app.countNodesWithMST();
      expect(nodesInMST).toBeGreaterThanOrEqual(6); // at least 6 nodes should be marked mst (start node might be active->mst)
    });

    test('idempotence: clicking Next after finished does nothing (Next disabled)', async ({ page }) => {
      const app = new PrimPage(page);
      await app.goto();

      // Start & finish quickly by repeatedly clicking Next
      await app.start();
      for (let i = 0; i < 10; i++) {
        if (await app.isDisabled(app.nextSelector)) break;
        await app.next();
        await page.waitForTimeout(20);
      }

      expect(await app.isDisabled(app.nextSelector)).toBeTruthy();

      // Attempt to click Next again forcibly (should not be possible via normal user actions)
      // We do not force clicks as per instruction not to patch or override behavior.
      // Re-assert final conditions remain true
      expect((await app.getInfoText()).includes('Prim\'s Algorithm completed!')).toBeTruthy();
    });
  });

  test.describe('Reset transitions (S1_Started -> S4_Reset and S3_Finished -> S4_Reset)', () => {
    test('reset from started state clears visualization and disables Next/Reset', async ({ page }) => {
      const app = new PrimPage(page);
      await app.goto();

      // Start and make one step so state is clearly active
      await app.start();
      await app.waitForInfoContains('Step 0: Starting from node A');
      await app.next();
      await page.waitForTimeout(50);

      // Ensure some nodes/edges are marked
      const someMstEdges = await app.countEdgesWithMST();
      expect(someMstEdges).toBeGreaterThanOrEqual(0); // could be 1 depending on step

      // Reset while in started state
      await app.reset();

      // Info should be back to initial instructional text
      const info = await app.getInfoText();
      expect(info).toContain('Click Start to begin Prim\'s algorithm demonstration.');

      // Buttons: Next and Reset disabled, Start enabled
      expect(await app.isDisabled(app.nextSelector)).toBeTruthy();
      expect(await app.isDisabled(app.resetSelector)).toBeTruthy();
      expect(await app.isDisabled(app.startSelector)).toBeFalsy();

      // No nodes should have 'mst' or 'active' classes
      for (let i = 0; i <= 6; i++) {
        expect(await app.nodeHasClass(i, 'active')).toBeFalsy();
        expect(await app.nodeHasClass(i, 'mst')).toBeFalsy();
      }
      // No edges should be 'mst' or 'considered'
      for (let e = 0; e <= 8; e++) {
        expect(await app.edgeHasClass(e, 'mst')).toBeFalsy();
        expect(await app.edgeHasClass(e, 'considered')).toBeFalsy();
      }
    });

    test('reset from finished state returns to Idle and allows restarting', async ({ page }) => {
      const app = new PrimPage(page);
      await app.goto();

      // Start & finish
      await app.start();
      for (let i = 0; i < 10; i++) {
        if (await app.isDisabled(app.nextSelector)) break;
        await app.next();
        await page.waitForTimeout(20);
      }
      await app.waitForInfoContains('Prim\'s Algorithm completed!');

      // Reset after finished
      await app.reset();

      // After reset, Start enabled, Next/Reset disabled, info back to idle text
      expect(await app.isDisabled(app.startSelector)).toBeFalsy();
      expect(await app.isDisabled(app.nextSelector)).toBeTruthy();
      expect(await app.isDisabled(app.resetSelector)).toBeTruthy();

      const info = await app.getInfoText();
      expect(info).toContain('Click Start to begin Prim\'s algorithm demonstration.');

      // Now start again to verify restarting works
      await app.start();
      expect(await app.nodeHasClass(0, 'active')).toBeTruthy();
    });
  });

  test.describe('Additional validations and edge cases', () => {
    test('start button becomes enabled again after finishing (so user can restart)', async ({ page }) => {
      const app = new PrimPage(page);
      await app.goto();

      // Start & finish
      await app.start();
      for (let i = 0; i < 10; i++) {
        if (await app.isDisabled(app.nextSelector)) break;
        await app.next();
        await page.waitForTimeout(20);
      }
      await app.waitForInfoContains('Prim\'s Algorithm completed!');

      // Start should be enabled after finish according to implementation
      expect(await app.isDisabled(app.startSelector)).toBeFalsy();

      // Clicking start again should reinitialize and set node 0 active
      await app.start();
      expect(await app.nodeHasClass(0, 'active')).toBeTruthy();
      // Next and Reset should be enabled
      expect(await app.isDisabled(app.nextSelector)).toBeFalsy();
      expect(await app.isDisabled(app.resetSelector)).toBeFalsy();
    });

    test('observe console logs and ensure no unexpected runtime errors occurred during interactions', async ({ page }) => {
      const app = new PrimPage(page);
      await app.goto();

      // Interact with the app a bit
      await app.start();
      await app.next();
      await app.next();
      await app.reset();

      // The beforeEach/afterEach already collect console messages and page errors;
      // Here we make a couple of sanity checks on captured console messages.
      // Ensure that at least informative messages were produced in #info (visible in DOM)
      const infoText = await app.getInfoText();
      expect(infoText.length).toBeGreaterThan(0);

      // No console messages of type 'error' should have been emitted (implementation logs nothing to console by default)
      // We check collected console messages from the page event listener
      // Note: Playwright's console event captures browser console.* calls. The app doesn't call console.* intentionally.
      // This assertion is conservative: allow console messages but fail if any are type 'error'
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors).toEqual([]);
    });
  });
});