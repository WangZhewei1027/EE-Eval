import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8dc9b1-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the BFS visualization page
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('#container');
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.nodes = page.locator('#container .node');
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async goto() {
    // Navigate to the page under test
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async attachLogging() {
    // Collect console messages and page errors for assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async nodeCount() {
    return await this.nodes.count();
  }

  async getNodeTexts() {
    return await this.nodes.evaluateAll((els) => els.map((el) => el.textContent));
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async anyActiveCount() {
    return await this.page.locator('.node.active').count();
  }

  async exploredCount() {
    return await this.page.locator('.node.explored').count();
  }

  // Wait until at least one node is active (BFS Active state evidence)
  async waitForAnyActive(timeout = 1000) {
    await expect(this.page.locator('.node.active')).toHaveCount(1, { timeout });
  }

  // Wait until a node transitions from active -> explored (Node Explored transition)
  async waitForAtLeastOneExplored(timeout = 2000) {
    await expect(this.page.locator('.node.explored')).toHaveCountGreaterThan(0, { timeout });
  }

  // Wait until all nodes are explored (BFS Completed state)
  async waitForAllExplored(totalNodes, timeout = 12000) {
    await expect(this.page.locator('.node.explored')).toHaveCount(totalNodes, { timeout });
  }

  // Assert that there are no console errors or page errors
  assertNoConsoleErrors() {
    const consoleErrors = this.consoleMessages.filter(m => m.type === 'error');
    // Fail the test if errors exist
    expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(this.pageErrors.length, `Page errors: ${this.pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
  }
}

// Custom matcher helper for expect toHaveCountGreaterThan (since Playwright does not expose it directly)
expect.extend({
  async toHaveCountGreaterThan(locator, expected) {
    const count = await locator.count();
    const pass = count > expected;
    if (pass) {
      return {
        pass: true,
        message: () => `expected locator not to have count greater than ${expected}, but got ${count}`,
      };
    } else {
      return {
        pass: false,
        message: () => `expected locator to have count greater than ${expected}, but got ${count}`,
      };
    }
  },
});

test.describe('Breadth-First Search Visualization (ed8dc9b1-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Shared page and page object
  let bfsPage;

  test.beforeEach(async ({ page }) => {
    bfsPage = new BFSPage(page);
    await bfsPage.attachLogging();
    await bfsPage.goto();
  });

  test.afterEach(async () => {
    // After each test, assert there were no unexpected console or page errors.
    // This validates that event handlers and transitions did not trigger runtime errors.
    bfsPage.assertNoConsoleErrors();
  });

  test('Initial state (S0_Idle): createNodes() should produce the expected nodes in the container', async () => {
    // Validate initial Idle state: nodes created and present in DOM
    // According to the HTML grid, there should be 8 nodes with specific text content coordinates.
    const count = await bfsPage.nodeCount();
    expect(count).toBe(8); // createNodes should have added 8 nodes

    const texts = (await bfsPage.getNodeTexts()).map(t => t.trim());
    // Check that a sample of expected node coordinates exist
    const expectedCoordinates = ['0,1', '0,2', '1,2', '2,4', '3,1', '3,2', '3,3', '3,4'];
    for (const coord of expectedCoordinates) {
      expect(texts).toContain(coord);
    }

    // Ensure no node has active or explored classes initially
    expect(await bfsPage.anyActiveCount()).toBe(0);
    expect(await bfsPage.exploredCount()).toBe(0);
  });

  test('Start BFS (StartBFS event) transitions to BFS Active (S1_BFS_Active) and nodes become active then explored', async () => {
    // Start BFS and verify the first node becomes active (S1 entry action: bfs())
    await bfsPage.clickStart();

    // Evidence: currentNode.classList.add('active') should be visible quickly
    await bfsPage.waitForAnyActive(1500);

    // After the active state, node should transition to explored (Node Explored transition)
    // We wait for at least one explored node to appear
    await bfsPage.waitForAtLeastOneExplored(3000);

    // Finally wait for BFS to complete: all nodes become explored (S2_BFS_Completed)
    const totalNodes = await bfsPage.nodeCount();
    await bfsPage.waitForAllExplored(totalNodes, 12000);

    // Validate final classes: all nodes should have 'explored' class and none should have 'active'
    expect(await bfsPage.anyActiveCount()).toBe(0);
    expect(await bfsPage.exploredCount()).toBe(totalNodes);
  });

  test('Reset event clears active and explored classes from nodes', async () => {
    // Start BFS, let it run enough to mark at least one explored node
    await bfsPage.clickStart();
    await bfsPage.waitForAtLeastOneExplored(3000);

    // Ensure at least one explored exists
    expect(await bfsPage.exploredCount()).toBeGreaterThan(0);

    // Click reset and ensure all nodes have neither active nor explored classes
    await bfsPage.clickReset();

    // After reset, classes should be cleared
    await expect(bfsPage.page.locator('.node.active')).toHaveCount(0);
    await expect(bfsPage.page.locator('.node.explored')).toHaveCount(0);
  });

  test('Reset when idle does not throw and leaves nodes unchanged (edge case)', async () => {
    // Clicking reset in idle state should be harmless
    await bfsPage.clickReset();

    // Nodes should still be present and have no classes
    const total = await bfsPage.nodeCount();
    expect(total).toBe(8);

    expect(await bfsPage.anyActiveCount()).toBe(0);
    expect(await bfsPage.exploredCount()).toBe(0);
  });

  test('Multiple Start clicks (edge case) - no runtime errors and eventual completion', async () => {
    // Clicking start twice rapidly to see if multiple invocations cause errors or unexpected behavior
    await bfsPage.clickStart();
    // Click again quickly; implementation pushes nodes[0] again so it may cause duplicates but should not throw
    await bfsPage.clickStart();

    // Wait for "some" progress: at least one explored within a few seconds
    await bfsPage.waitForAtLeastOneExplored(4000);

    // Wait until the total explored count reaches the total nodes (it should eventually, even with duplicate queues)
    const totalNodes = await bfsPage.nodeCount();
    await bfsPage.waitForAllExplored(totalNodes, 15000);

    // Ensure no active class remains and all nodes are explored
    expect(await bfsPage.anyActiveCount()).toBe(0);
    expect(await bfsPage.exploredCount()).toBe(totalNodes);
  });

  test('Verify event handlers are wired: startBtn and resetBtn exist and are clickable', async () => {
    // Validate presence and interactivity of the controls as declared in components
    await expect(bfsPage.startBtn).toBeVisible();
    await expect(bfsPage.resetBtn).toBeVisible();

    // Clicking start triggers an active node quickly (evidence of event handler)
    await bfsPage.clickStart();
    await bfsPage.waitForAnyActive(1500);

    // Reset should clear classes
    await bfsPage.clickReset();
    await expect(bfsPage.page.locator('.node.active')).toHaveCount(0);
    await expect(bfsPage.page.locator('.node.explored')).toHaveCount(0);
  });

  test('Observing console and page errors during interactions (assert none occurred)', async () => {
    // This test explicitly exercises several interactions while collecting console/page errors
    // Start BFS
    await bfsPage.clickStart();
    await bfsPage.waitForAtLeastOneExplored(4000);

    // Reset mid-run
    await bfsPage.clickReset();

    // Start again and allow completion
    await bfsPage.clickStart();
    const totalNodes = await bfsPage.nodeCount();
    await bfsPage.waitForAllExplored(totalNodes, 12000);

    // At the end, assert there were no console errors or page errors captured
    bfsPage.assertNoConsoleErrors();
  });
});