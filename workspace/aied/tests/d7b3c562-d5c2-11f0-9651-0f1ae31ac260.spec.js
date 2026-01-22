import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b3c562-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the DFS visualization page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console events and page errors for later assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // Collect thrown errors (ReferenceError, TypeError, etc.)
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main elements to be present
    await this.page.waitForSelector('#graph');
    await this.page.waitForSelector('#generateBtn');
    await this.page.waitForSelector('#startBtn');
    await this.page.waitForSelector('#resetBtn');
    await this.page.waitForSelector('#nodeCount');
    // Ensure initial graph nodes are rendered
    await this.page.waitForSelector('#graph .node');
  }

  // Read the number input value (as number)
  async getNodeCountValue() {
    return Number(await this.page.locator('#nodeCount').inputValue());
  }

  async setNodeCountValue(val) {
    const el = this.page.locator('#nodeCount');
    await el.fill(String(val));
    // trigger change by blurring/focusing out
    await el.evaluate((n) => n.dispatchEvent(new Event('change', { bubbles: true })));
  }

  async clickGenerate() {
    await this.page.click('#generateBtn');
    // Small wait to allow handlers and refreshHandlers timeout to attach
    await this.page.waitForTimeout(120);
    // Ensure nodes are re-rendered
    await this.page.waitForSelector('#graph .node');
  }

  async getNodeElements() {
    return this.page.locator('#graph .node');
  }

  async nodeCountInDOM() {
    return await this.page.locator('#graph .node').count();
  }

  // Select a node by its index (data-node-id)
  async selectNodeByIndex(index) {
    const sel = `#graph .node[data-node-id="${index}"]`;
    await this.page.waitForSelector(sel);
    await this.page.click(sel);
  }

  // Focus a node and press Enter/Space for keyboard selection
  async keySelectNodeByIndex(index, key = 'Enter') {
    const sel = `#graph .node[data-node-id="${index}"]`;
    const node = this.page.locator(sel);
    await node.focus();
    await this.page.keyboard.press(key);
  }

  async clickStart() {
    await this.page.click('#startBtn');
  }

  async clickReset() {
    await this.page.click('#resetBtn');
  }

  // Return current classes for a node element
  async getNodeClass(index) {
    const sel = `#graph .node[data-node-id="${index}"]`;
    await this.page.waitForSelector(sel);
    return this.page.locator(sel).evaluate((el) => el.className.baseVal);
  }

  // Return boolean disabled states
  async isStartDisabled() {
    return await this.page.locator('#startBtn').isDisabled();
  }
  async isGenerateDisabled() {
    return await this.page.locator('#generateBtn').isDisabled();
  }
  async isResetDisabled() {
    return await this.page.locator('#resetBtn').isDisabled();
  }
  async isNodeCountDisabled() {
    return await this.page.locator('#nodeCount').isDisabled();
  }

  // Read current log text
  async getLogText() {
    return await this.page.locator('#log').innerText();
  }

  // Wait until the log contains given text (with timeout)
  async waitForLogContains(text, timeout = 20000) {
    await this.page.waitForFunction(
      (t) => {
        const log = document.getElementById('log');
        return log && log.innerText.includes(t);
      },
      text,
      { timeout }
    );
  }

  // Wait until log is empty
  async waitForLogEmpty(timeout = 3000) {
    await this.page.waitForFunction(
      () => {
        const log = document.getElementById('log');
        return log && log.innerText.trim().length === 0;
      },
      { timeout }
    );
  }
}

test.describe('DFS Visualization - FSM and UI integration tests', () => {
  let graphPage;

  // Setup: navigate to the app before each test and capture console/page errors
  test.beforeEach(async ({ page }) => {
    graphPage = new GraphPage(page);
    await graphPage.goto();
  });

  // Teardown: after each test assert no unexpected severe JS errors happened
  test.afterEach(async () => {
    // Fail the test if there were uncaught page errors (ReferenceError, TypeError, etc.)
    // Provide diagnostics in the assertion message.
    if (graphPage.pageErrors.length > 0) {
      const msgs = graphPage.pageErrors.map((e) => e.stack || e.message || String(e)).join('\n\n---\n\n');
      // Use expect to produce a readable failure
      expect(graphPage.pageErrors.length, `Unexpected page errors:\n${msgs}`).toBe(0);
    }

    // Also ensure there are no console.error messages (they indicate runtime problems)
    const consoleErrors = graphPage.consoleMessages.filter((m) => m.type === 'error');
    if (consoleErrors.length > 0) {
      const msgs = consoleErrors.map((c) => `[${c.type}] ${c.text}`).join('\n');
      expect(consoleErrors.length, `Console errors detected:\n${msgs}`).toBe(0);
    }
  });

  test.describe('State S0 - Idle (Initial render)', () => {
    test('Initial controls and visualization are rendered correctly', async () => {
      // Validate Idle state: start and reset are disabled; generate enabled; nodeCount has default value
      expect(await graphPage.isStartDisabled(), 'startBtn should be disabled on load').toBe(true);
      expect(await graphPage.isResetDisabled(), 'resetBtn should be disabled on load').toBe(true);
      expect(await graphPage.isGenerateDisabled(), 'generateBtn should be enabled on load').toBe(false);

      // nodeCount default value should be 6 (per HTML attribute)
      expect(await graphPage.getNodeCountValue()).toBe(6);

      // Graph SVG should contain nodes equal to nodeCount
      const domNodeCount = await graphPage.nodeCountInDOM();
      expect(domNodeCount).toBeGreaterThanOrEqual(3); // ensure nodes rendered
      expect(domNodeCount).toBe(await graphPage.getNodeCountValue());

      // Log should be empty initially
      const initialLog = await graphPage.getLogText();
      expect(initialLog.trim()).toBe('');
    });
  });

  test.describe('Transition S0 -> S1 (GenerateGraph)', () => {
    test('Generating a new graph redraws nodes and keeps Start disabled until a start node is selected', async () => {
      // Change node count to a small number to make tests faster and deterministic
      await graphPage.setNodeCountValue(4);
      expect(await graphPage.getNodeCountValue()).toBe(4);

      // Click Generate and validate nodes redrawn
      await graphPage.clickGenerate();

      const nodeCountAfter = await graphPage.nodeCountInDOM();
      expect(nodeCountAfter).toBe(4);

      // According to implementation, startBtn remains disabled until a node is chosen
      expect(await graphPage.isStartDisabled()).toBe(true);
      // Reset remains disabled (no start node chosen yet)
      expect(await graphPage.isResetDisabled()).toBe(true);
      // Generate should still be enabled
      expect(await graphPage.isGenerateDisabled()).toBe(false);
    });
  });

  test.describe('Transition S1 -> S2 (NodeClick) and S2 behavior', () => {
    test('Clicking a node selects it as start node, enables Start, updates node visual, and logs selection', async () => {
      // Ensure a known smaller graph for deterministic behavior
      await graphPage.setNodeCountValue(3);
      await graphPage.clickGenerate();

      // Click node 0 to select as start
      await graphPage.selectNodeByIndex(0);

      // After selection, start button should be enabled
      expect(await graphPage.isStartDisabled()).toBe(false);

      // The clicked node should have class containing 'visiting' and aria-label indicating start node
      const nodeClass = await graphPage.getNodeClass(0);
      expect(nodeClass).toContain('visiting');

      // The log should have a "Start node selected" message
      const logText = await graphPage.getLogText();
      expect(logText).toMatch(/Start node selected: Node 0/);
    });

    test('Selecting a node via keyboard (Enter/Space) also selects start node and logs selection', async () => {
      // Use a fresh small graph
      await graphPage.setNodeCountValue(3);
      await graphPage.clickGenerate();

      // Use Enter key to select node 1
      await graphPage.keySelectNodeByIndex(1, 'Enter');

      expect(await graphPage.isStartDisabled()).toBe(false);
      const nodeClass = await graphPage.getNodeClass(1);
      expect(nodeClass).toContain('visiting');

      const logText = await graphPage.getLogText();
      expect(logText).toMatch(/Start node selected: Node 1/);
    });
  });

  test.describe('Transition S2 -> S3 -> S4 (StartDFS and DFS completion)', () => {
    test('Running DFS from a selected node performs traversal and reaches DFS Complete state', async () => {
      // Use minimum nodes (3) so traversal completes quickly
      await graphPage.setNodeCountValue(3);
      await graphPage.clickGenerate();

      // Select starting node 0
      await graphPage.selectNodeByIndex(0);

      // Start DFS
      await graphPage.clickStart();

      // Immediately after starting, start button should be disabled and generate/nodeCount disabled
      expect(await graphPage.isStartDisabled()).toBe(true);
      expect(await graphPage.isGenerateDisabled()).toBe(true);
      expect(await graphPage.isNodeCountDisabled()).toBe(true);
      // Reset should be enabled during/after run
      // Note: resetBtn is set to false at start of runDFS, so expect disabled === false
      expect(await graphPage.isResetDisabled()).toBe(false);

      // Wait for "Starting DFS" to appear in the log
      await graphPage.waitForLogContains('Starting DFS from node 0', 5000);

      // Finally wait until DFS finishes and 'DFS Complete.' appears
      await graphPage.waitForLogContains('DFS Complete.', 20000);

      // After completion, start should be disabled, generate and nodeCount should be enabled
      expect(await graphPage.isStartDisabled()).toBe(true);
      expect(await graphPage.isGenerateDisabled()).toBe(false);
      expect(await graphPage.isNodeCountDisabled()).toBe(false);

      // Log should contain both starting and complete messages
      const logText = await graphPage.getLogText();
      expect(logText).toMatch(/Starting DFS from node 0/);
      expect(logText).toMatch(/DFS Complete\./);

      // Inspect that at least one node was marked visited in logs
      expect(logText).toMatch(/Visited node/);

      // Visual check: at least one node element should have 'visited' class by end
      const nodeCount = await graphPage.nodeCountInDOM();
      let visitedFound = false;
      for (let i = 0; i < nodeCount; i++) {
        const cls = await graphPage.getNodeClass(i);
        if (cls.includes('visited')) {
          visitedFound = true;
          break;
        }
      }
      expect(visitedFound).toBe(true);
    }, 30000); // extended timeout for DFS delays
  });

  test.describe('Transition S4 -> S0 (ResetGraph) and reset behavior', () => {
    test('Reset clears state, disables Start and Reset, clears log and returns to Idle', async () => {
      // Start a small run to reach DFS complete
      await graphPage.setNodeCountValue(3);
      await graphPage.clickGenerate();
      await graphPage.selectNodeByIndex(0);
      await graphPage.clickStart();
      await graphPage.waitForLogContains('DFS Complete.', 20000);

      // Now click Reset to return to Idle
      await graphPage.clickReset();

      // After reset: start disabled, reset disabled, generate enabled
      expect(await graphPage.isStartDisabled()).toBe(true);
      expect(await graphPage.isResetDisabled()).toBe(true);
      expect(await graphPage.isGenerateDisabled()).toBe(false);

      // Log should be cleared by reset
      await graphPage.waitForLogEmpty(3000);
      const logText = await graphPage.getLogText();
      expect(logText.trim()).toBe('');

      // All nodes should be in unvisited state (class includes 'unvisited')
      const nodeCount = await graphPage.nodeCountInDOM();
      for (let i = 0; i < nodeCount; i++) {
        const cls = await graphPage.getNodeClass(i);
        expect(cls).toContain('unvisited');
      }
    }, 30000);
  });

  test.describe('Edge cases and input validation', () => {
    test('Node count input clamps values outside allowed range (min/max)', async () => {
      // Set to a value below min (2) -> should clamp to 3 on change
      await graphPage.setNodeCountValue(2);
      // Implementation triggers the change handler immediately, so read value
      expect(await graphPage.getNodeCountValue()).toBe(3);

      // Set to an extremely large value (20) -> clamps to max 10
      await graphPage.setNodeCountValue(20);
      expect(await graphPage.getNodeCountValue()).toBe(10);

      // Generate with clamped value to ensure DOM handles it
      await graphPage.clickGenerate();
      expect(await graphPage.nodeCountInDOM()).toBe(10);
    });

    test('Clicking other nodes while DFS is running does not change the start node (start locked during run)', async () => {
      // Prepare a small graph
      await graphPage.setNodeCountValue(4);
      await graphPage.clickGenerate();

      // Select node 0 and start DFS
      await graphPage.selectNodeByIndex(0);
      await graphPage.clickStart();

      // Wait for "Starting DFS" message to ensure run has started
      await graphPage.waitForLogContains('Starting DFS from node 0', 5000);

      // Attempt to click node 1 during run
      const attemptSelector = '#graph .node[data-node-id="1"]';
      await graphPage.page.waitForSelector(attemptSelector);
      await graphPage.page.click(attemptSelector);

      // The start node should remain node 0: check that node 0 still has visiting/visited class
      const class0 = await graphPage.getNodeClass(0);
      expect(class0).toMatch(/(visiting|visited|unvisited)/); // one of these exists
      // But node 1 should not have become the start node (i.e., aria-label should not contain '(start node)')
      const aria1 = await graphPage.page.locator('#graph .node[data-node-id="1"]').getAttribute('aria-label');
      expect(aria1).not.toMatch(/\(start node\)/);

      // Wait for completion to clean up
      await graphPage.waitForLogContains('DFS Complete.', 20000);
    }, 30000);
  });

  test.describe('Console and runtime errors observation', () => {
    test('No unexpected ReferenceError / TypeError / SyntaxError thrown during normal flows', async () => {
      // Perform several normal interactions to observe runtime stability
      await graphPage.setNodeCountValue(3);
      await graphPage.clickGenerate();
      await graphPage.selectNodeByIndex(0);
      await graphPage.clickStart();

      // Wait for completion
      await graphPage.waitForLogContains('DFS Complete.', 20000);

      // At this point, the afterEach hook will assert there were no page errors.
      // Additionally assert there are no console.error messages captured
      const errors = graphPage.consoleMessages.filter((m) => m.type === 'error');
      expect(errors.length, `console.error messages:\n${errors.map(e => e.text).join('\n')}`).toBe(0);
    }, 30000);
  });
});