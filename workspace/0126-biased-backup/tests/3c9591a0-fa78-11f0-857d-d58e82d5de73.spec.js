import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9591a0-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page object for the Circular Linked List Visualization page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class VisualizationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nextSelector = '#btnNext';
    this.resetSelector = '#btnReset';
    this.nodeGroupSelector = '.node-group';
    this.arrowPathSelector = '.arrowed-path';
    this.svgSelector = '#visual-svg';
  }

  // Navigate to the page and wait for the SVG to be present
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    await this.page.waitForSelector(this.svgSelector, { state: 'visible', timeout: 5000 });
    // Wait until at least one node-group is present (app builds nodes on load)
    await this.page.waitForSelector(this.nodeGroupSelector, { state: 'attached', timeout: 5000 });
  }

  // Return the number of node elements rendered in the SVG
  async getNodeCount() {
    return await this.page.locator(this.nodeGroupSelector).count();
  }

  // Return the index (0-based) of the currently highlighted node (has class 'current').
  // If none found, returns -1.
  async getCurrentIndex() {
    return await this.page.evaluate((sel) => {
      const groups = Array.from(document.querySelectorAll(sel));
      for (let i = 0; i < groups.length; i++) {
        if (groups[i].classList.contains('current')) return i;
      }
      return -1;
    }, this.nodeGroupSelector);
  }

  // Return the displayed values (textContent) of node texts in order (for sanity)
  async getNodeValues() {
    return await this.page.evaluate((sel) => {
      return Array.from(document.querySelectorAll(sel)).map(g => {
        const t = g.querySelector('.node-text');
        return t ? t.textContent.trim() : null;
      });
    }, this.nodeGroupSelector);
  }

  // Click the Next button
  async clickNext() {
    await this.page.click(this.nextSelector);
  }

  // Click the Reset button
  async clickReset() {
    await this.page.click(this.resetSelector);
  }

  // Count arrowed paths (links)
  async getLinkCount() {
    return await this.page.locator(this.arrowPathSelector).count();
  }

  // Get computed fill style of the circle element inside the current node (if any)
  async getCurrentNodeCircleFill() {
    return await this.page.evaluate((sel) => {
      const groups = Array.from(document.querySelectorAll(sel));
      const current = groups.find(g => g.classList.contains('current'));
      if (!current) return null;
      const circle = current.querySelector('.node-circle');
      return circle ? window.getComputedStyle(circle).getPropertyValue('fill') : null;
    }, this.nodeGroupSelector);
  }
}

test.describe('Circular Linked List Visualization - FSM and UI behavior', () => {
  // Capture console.error messages and page errors for each test
  let consoleErrors;
  let pageErrors;
  let viz;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
    });

    viz = new VisualizationPage(page);
    await viz.goto();
  });

  test.afterEach(async () => {
    // Teardown is implicit; but assert no unexpected runtime errors occurred during the test.
    // These assertions ensure we observed console errors or page errors if they occur.
    // Most tests in this suite expect a clean runtime: no console.error and no uncaught page errors.
    expect(pageErrors, 'There should be no uncaught page errors').toEqual([]);
    expect(consoleErrors, 'There should be no console.error messages').toEqual([]);
  });

  test('Initial state S0_Idle: initial highlight is set to node 0 (entry action updateHighlight(0))', async () => {
    // Validate the number of nodes equals the expected NODE_COUNT (10)
    const nodeCount = await viz.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(1); // at least one
    expect(nodeCount).toBe(10); // per implementation NODE_COUNT === 10

    // Validate there are as many links as nodes (circular: last -> first)
    const linkCount = await viz.getLinkCount();
    expect(linkCount).toBe(nodeCount);

    // FSM S0 entry action updateHighlight(0) should mark node 0 as current
    const currentIndex = await viz.getCurrentIndex();
    expect(currentIndex).toBe(0);

    // Node values should be 1..10 as per implementation
    const values = await viz.getNodeValues();
    expect(values.length).toBe(nodeCount);
    expect(values[0]).toBe('1');
    expect(values[9]).toBe('10');
  });

  test('Transition S0 -> S1 (Next): clicking Next highlights next node (index 1)', async () => {
    // Click Next once and assert current index advances to 1
    await viz.clickNext();

    // Give animation & DOM changes a moment (small allowance)
    await viz.page.waitForTimeout(200);

    const currentIndex = await viz.getCurrentIndex();
    expect(currentIndex).toBe(1);
  });

  test('Transition S1 -> S1 (Next repeated): multiple Next clicks advance and wrap around', async () => {
    // Click Next to move to index 1
    await viz.clickNext();
    await viz.page.waitForTimeout(100);

    // Click Next 9 more times to go full circle (total 10 clicks from 0 -> should wrap to 0)
    for (let i = 0; i < 9; i++) {
      await viz.clickNext();
      await viz.page.waitForTimeout(60);
    }

    // After 10 Next clicks total, we should be back to index 0
    const currentIndexAfterFullCycle = await viz.getCurrentIndex();
    expect(currentIndexAfterFullCycle).toBe(0);

    // Click Next 1 more time -> index 1
    await viz.clickNext();
    await viz.page.waitForTimeout(100);
    expect(await viz.getCurrentIndex()).toBe(1);

    // Exercise wrap via additional clicks: click Next 11 times from current position (should land at index (1+11)%10 = 2)
    for (let i = 0; i < 11; i++) {
      await viz.clickNext();
    }
    await viz.page.waitForTimeout(200);
    expect(await viz.getCurrentIndex()).toBe(2);
  });

  test('Transition S0 -> S2 and S1 -> S2 (Reset): Reset brings highlight to first node (index 0)', async () => {
    // From initial state, click Reset -> should remain/return to 0
    await viz.clickReset();
    await viz.page.waitForTimeout(100);
    expect(await viz.getCurrentIndex()).toBe(0);

    // Move to index 3 by clicking Next 3 times
    for (let i = 0; i < 3; i++) await viz.clickNext();
    await viz.page.waitForTimeout(150);
    expect(await viz.getCurrentIndex()).toBe(3);

    // From S1 (highlighted state), clicking Reset should go to 0 as per FSM S1 -> S2
    await viz.clickReset();
    await viz.page.waitForTimeout(100);
    expect(await viz.getCurrentIndex()).toBe(0);
  });

  test('Transition S2 -> S1 (Next after Reset): Next after Reset highlights next node (index 1)', async () => {
    // Ensure we are at 0, then Reset explicitly and click Next
    await viz.clickReset();
    await viz.page.waitForTimeout(100);
    expect(await viz.getCurrentIndex()).toBe(0);

    // Click Next -> should go to index 1
    await viz.clickNext();
    await viz.page.waitForTimeout(150);
    expect(await viz.getCurrentIndex()).toBe(1);
  });

  test('Verify "current" class is applied to node group and node text remains visible', async () => {
    // Ensure initial is 0
    expect(await viz.getCurrentIndex()).toBe(0);

    // The current node-group should have class 'current' and contain a .node-text with the number
    const valuesBefore = await viz.getNodeValues();
    const currentIndex = await viz.getCurrentIndex();
    expect(valuesBefore[currentIndex]).toBe('1');

    // Click Next and assert class applied to new node-group
    await viz.clickNext();
    await viz.page.waitForTimeout(120);
    const newIndex = await viz.getCurrentIndex();
    expect(newIndex).toBe(1);
    const valuesAfter = await viz.getNodeValues();
    expect(valuesAfter[newIndex]).toBe('2');

    // Verify computed style exists for the node circle (we do not attempt to assert a specific color
    // because the stylesheet may use complex colors or contain subtle selector bugs; we only assert
    // that the element exists and has a computed 'fill' property)
    const fill = await viz.getCurrentNodeCircleFill();
    expect(fill).not.toBeNull();
    expect(typeof fill).toBe('string');
    expect(fill.length).toBeGreaterThan(0);
  });

  test('Edge case: excessive Next clicks wrap properly and Reset still lands at index 0', async () => {
    // Click Next 123 times to exercise large increments and modular arithmetic
    for (let i = 0; i < 123; i++) {
      await viz.clickNext();
    }
    await viz.page.waitForTimeout(200);

    // 123 % 10 = 3 -> from initial 0 should be index 3
    expect(await viz.getCurrentIndex()).toBe(3);

    // Now reset and confirm we are at 0
    await viz.clickReset();
    await viz.page.waitForTimeout(100);
    expect(await viz.getCurrentIndex()).toBe(0);
  });

  test('Robustness: ensure no unexpected TypeError/ReferenceError/SyntaxError were emitted to console or as page errors', async ({ page }) => {
    // This test explicitly verifies that no console.error or uncaught exceptions were captured.
    // (Listeners were attached in beforeEach and will be examined in afterEach).
    // We include a simple interaction to exercise typical flows.
    await viz.clickNext();
    await viz.page.waitForTimeout(80);
    await viz.clickNext();
    await viz.page.waitForTimeout(80);
    await viz.clickReset();
    await viz.page.waitForTimeout(80);

    // At this point, afterEach will assert that consoleErrors and pageErrors are empty.
    // We also include explicit local checks here for clarity.
    // (Accessing the arrays is only for assertion messages; actual assertions happen in afterEach)
    expect(true).toBe(true); // no-op; the meaningful assertions are in afterEach to fail if any errors found
  });
});