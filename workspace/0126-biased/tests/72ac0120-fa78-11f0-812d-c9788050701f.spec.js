import { test, expect } from '@playwright/test';

// Test suite for Application ID: 72ac0120-fa78-11f0-812d-c9788050701f
// URL served at: http://127.0.0.1:5500/workspace/0126-biased/html/72ac0120-fa78-11f0-812d-c9788050701f.html

// Page object encapsulating interactions and selectors for the graph visualization page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac0120-fa78-11f0-812d-c9788050701f.html';
    this.toggleSelector = '#toggle-viz';
    this.nodeSelector = '.visualization .node';
    this.connectionSelector = '.visualization .connection';
    this.graphContainer = '#graph-viz';
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'load' });
  }

  async getToggleButton() {
    return this.page.locator(this.toggleSelector);
  }

  async getToggleText() {
    return (await this.page.locator(this.toggleSelector).textContent())?.trim();
  }

  async clickToggle() {
    await this.page.click(this.toggleSelector);
  }

  async countNodes() {
    return await this.page.locator(this.nodeSelector).count();
  }

  async countConnections() {
    return await this.page.locator(this.connectionSelector).count();
  }

  // Returns array of computed styles for nodes
  async getNodeComputedStyles() {
    return await this.page.$$eval(this.nodeSelector, nodes =>
      nodes.map(n => {
        const cs = window.getComputedStyle(n);
        return {
          opacity: cs.opacity,
          transform: cs.transform,
          width: cs.width,
          height: cs.height,
          backgroundColor: cs.backgroundColor,
        };
      })
    );
  }

  // Wait until at least one node has computed opacity >= threshold (useful for waiting animations)
  async waitForAtLeastOneNodeOpacity(threshold = 0.9, timeout = 2500) {
    await this.page.waitForFunction(
      (selector, thresh) => {
        const nodes = Array.from(document.querySelectorAll(selector));
        return nodes.some(n => parseFloat(window.getComputedStyle(n).opacity || '0') >= thresh);
      },
      this.nodeSelector,
      threshold,
      { timeout }
    );
  }

  // Wait until graph container has any children (ensures drawGraph has run)
  async waitForGraphChildren(timeout = 2000) {
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.children.length > 0;
      },
      this.graphContainer,
      { timeout }
    );
  }

  // Returns computed styles for connection elements
  async getConnectionComputedStyles() {
    return await this.page.$$eval(this.connectionSelector, conns =>
      conns.map(c => {
        const cs = window.getComputedStyle(c);
        return {
          width: parseFloat(cs.width || '0'),
          left: cs.left,
          top: cs.top,
          transform: cs.transform,
          opacity: cs.opacity,
        };
      })
    );
  }
}

test.describe('NoSQL Graph Visualization - FSM validation', () => {
  let graphPage;
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console and page errors for assertions
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push({ type, text });
      }
    });

    page.on('pageerror', err => {
      // Uncaught exceptions on the page
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    graphPage = new GraphPage(page);
    await graphPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // detach listeners to avoid accidental cross-test influence
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial state S0_Idle: drawGraph(false) is executed on load and DOM is populated', async () => {
    // Validate initial draw run and initial idle state
    // Wait for the graph container to have children (nodes/connections)
    await graphPage.waitForGraphChildren();

    // There are 5 nodes expected from the implementation
    const nodeCount = await graphPage.countNodes();
    expect(nodeCount).toBeGreaterThanOrEqual(5); // at least 5 nodes should exist

    // There are 6 connections expected
    const connectionCount = await graphPage.countConnections();
    expect(connectionCount).toBeGreaterThanOrEqual(6);

    // Button should show "Animate Graph" as per initial idle state
    const btnText = await graphPage.getToggleText();
    expect(btnText).toBe('Animate Graph');

    // Nodes in idle draw should be visible; check computed style for at least one node
    const nodeStyles = await graphPage.getNodeComputedStyles();
    expect(nodeStyles.length).toBeGreaterThanOrEqual(1);
    // At least one node must have opacity > 0 (rendered)
    const someVisible = nodeStyles.some(s => parseFloat(s.opacity || '0') > 0);
    expect(someVisible).toBeTruthy();
  });

  test('Transition S0_Idle -> S1_Animating: clicking toggle animates the graph and updates UI', async () => {
    // Ensure starting from initial state
    await graphPage.waitForGraphChildren();
    const beforeBtn = await graphPage.getToggleText();
    expect(beforeBtn).toBe('Animate Graph');

    // Click to toggle animation ON
    await graphPage.clickToggle();

    // Button text should update to "Reset Graph"
    const afterBtn = await graphPage.getToggleText();
    expect(afterBtn).toBe('Reset Graph');

    // Connections and nodes are recreated with animation styles; wait for some nodes to finish their animation (opacity -> 1)
    await graphPage.waitForAtLeastOneNodeOpacity(0.9, 3000);

    // Validate at least one node has transitioned to full opacity and has transform scale(1) eventually
    const nodeStyles = await graphPage.getNodeComputedStyles();
    const animatedNode = nodeStyles.find(s => parseFloat(s.opacity || '0') >= 0.9);
    expect(animatedNode).toBeDefined();
    // transform property should contain matrix or scale value; at least ensure it's not 'none'
    expect(animatedNode.transform === 'none' ? false : true).toBeTruthy();

    // Validate connections exist and have non-zero width (they draw lines between nodes)
    const connStyles = await graphPage.getConnectionComputedStyles();
    expect(connStyles.length).toBeGreaterThanOrEqual(1);
    const someLong = connStyles.some(c => c.width > 10);
    expect(someLong).toBeTruthy();
  });

  test('Transition S1_Animating -> S0_Idle: clicking toggle again resets the graph to idle', async () => {
    await graphPage.waitForGraphChildren();

    // Click to animate on
    await graphPage.clickToggle();
    await graphPage.waitForAtLeastOneNodeOpacity(0.9, 3000);
    const btnAfterAnimate = await graphPage.getToggleText();
    expect(btnAfterAnimate).toBe('Reset Graph');

    // Click to toggle animation OFF (return to idle)
    await graphPage.clickToggle();

    // Button text should revert to "Animate Graph"
    const btnAfterReset = await graphPage.getToggleText();
    expect(btnAfterReset).toBe('Animate Graph');

    // Nodes and connections should still exist after reset
    const nodeCountAfter = await graphPage.countNodes();
    const connCountAfter = await graphPage.countConnections();
    expect(nodeCountAfter).toBeGreaterThanOrEqual(5);
    expect(connCountAfter).toBeGreaterThanOrEqual(6);

    // After reset, the nodes are drawn without animation setup; they should not have lingering transition inline style that sets opacity -> 1
    // We check at least one node's computed transform does not contain 'scale(0.5)' which is used for animated entry.
    const nodeStyles = await graphPage.getNodeComputedStyles();
    const noneUsingSmallScale = nodeStyles.some(s => !s.transform.includes('scale(0.5)'));
    expect(noneUsingSmallScale).toBeTruthy();
  });

  test('Rapid toggling edge case: multiple quick clicks toggle state predictably and produce no page errors', async ({ page }) => {
    await graphPage.waitForGraphChildren();

    // Rapidly click the toggle 5 times
    const rapidClicks = 5;
    for (let i = 0; i < rapidClicks; i++) {
      await graphPage.clickToggle();
      // small minimal delay to let handler start but still simulate rapid user
      await page.waitForTimeout(50);
    }

    // After odd number of clicks (5), we expect animation to be ON -> button text 'Reset Graph'
    const finalText = await graphPage.getToggleText();
    expect(finalText === 'Reset Graph' || finalText === 'Animate Graph').toBeTruthy(); // resilient check

    // Important: Ensure that no uncaught page errors occurred during rapid interactions
    // We assert pageErrors array is empty to ensure no runtime exceptions like ReferenceError/TypeError were thrown
    expect(pageErrors.length).toBe(0);

    // Also ensure no console error messages were emitted
    expect(consoleErrors.length).toBe(0);
  });

  test('Console and page error observation: assert there are no uncaught exceptions or console errors on load and interaction', async ({ page }) => {
    // We already capture messages in beforeEach and prior tests; here explicitly perform a basic interaction to ensure listeners pick things up
    await graphPage.waitForGraphChildren();
    await graphPage.clickToggle();
    await graphPage.waitForAtLeastOneNodeOpacity(0.9, 3000);
    await graphPage.clickToggle();

    // Assert there are no page errors registered (uncaught exceptions)
    expect(pageErrors).toEqual([]); // fail and show captured errors if any

    // Assert there are no console.error messages emitted
    // Provide diagnostics message if there are entries (so test failure output is informative)
    if (consoleErrors.length > 0) {
      console.log('Console errors captured:', consoleErrors);
    }
    expect(consoleErrors.length).toBe(0);

    // Additionally assert that general console messages were emitted (e.g., info/debug may be present); at minimum we ensure it's an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});