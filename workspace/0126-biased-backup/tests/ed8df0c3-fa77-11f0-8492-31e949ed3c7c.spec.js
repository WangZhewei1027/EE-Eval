import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8df0c3-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the PageRank Visualization app.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startButton');
    this.graph = page.locator('#graph');
    this.nodeLocator = page.locator('.node');
    this.edgeLocator = page.locator('.edge');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isStartButtonVisible() {
    return this.startButton.isVisible();
  }

  async isStartButtonEnabled() {
    return this.startButton.isEnabled();
  }

  async clickStartButton(options) {
    await this.startButton.click(options);
  }

  async getNodeCount() {
    return this.nodeLocator.count();
  }

  async getEdgeCount() {
    return this.edgeLocator.count();
  }

  async getNodeStylesByIndex(index) {
    const nth = this.nodeLocator.nth(index);
    return {
      width: await nth.evaluate(el => el.style.width),
      height: await nth.evaluate(el => el.style.height),
      left: await nth.evaluate(el => el.style.left),
      top: await nth.evaluate(el => el.style.top),
      backgroundColor: await nth.evaluate(el => el.style.backgroundColor),
      text: await nth.evaluate(el => el.textContent)
    };
  }

  async getEdgeStylesByIndex(index) {
    const nth = this.edgeLocator.nth(index);
    return {
      left: await nth.evaluate(el => el.style.left),
      top: await nth.evaluate(el => el.style.top),
      width: await nth.evaluate(el => el.style.width),
      transform: await nth.evaluate(el => el.style.transform),
      opacity: await nth.evaluate(el => el.style.opacity)
    };
  }

  async getGraphChildCount() {
    return this.graph.evaluate(g => g.children.length);
  }
}

/**
 * Tests for the FSM states and transitions of the PageRank Visualization app.
 *
 * The FSM describes two states:
 *  - S0_Idle: initial state with a visible "Start Animation" button
 *  - S1_AnimationStarted: after clicking start, drawGraph() is called and the button is disabled
 *
 * These tests verify initial conditions, the click transition, DOM changes caused by drawGraph(),
 * expected element attributes/styles, and that no runtime errors are emitted during these interactions.
 */

test.describe('FSM: Interactive PageRank Visualization (ed8df0c3-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Holders for console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages, categorizing by type
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught errors from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app with listeners attached to catch load-time errors
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected navigation left-overs
    await page.close();
  });

  test.describe('State S0_Idle (Initial State)', () => {
    test('Start button is present and enabled, graph container is empty', async ({ page }) => {
      const app = new PageRankPage(page);

      // Validate start button exists and is enabled (Idle state evidence)
      await expect(app.startButton).toBeVisible({ timeout: 2000 });
      await expect(app.startButton).toHaveText('Start Animation');
      await expect(app.startButton).toBeEnabled();

      // Graph container should initially have no children (no nodes/edges drawn)
      const childCount = await app.getGraphChildCount();
      expect(childCount).toBe(0);

      // No runtime errors should have occurred during load
      expect(pageErrors.length).toBe(0);
      // No console messages of type 'error' should be emitted on load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: StartAnimation (click #startButton) -> S1_AnimationStarted', () => {
    test('Clicking start draws nodes and edges and disables the button', async ({ page }) => {
      const app = new PageRankPage(page);

      // Precondition: Idle state
      await expect(app.startButton).toBeEnabled();

      // Click the start button to trigger drawGraph()
      await app.clickStartButton();

      // After clicking, the start button should be disabled per implementation
      await expect(app.startButton).toBeDisabled();

      // drawGraph should have appended 4 nodes and 4 edges as defined in the source arrays
      await expect(app.nodeLocator).toHaveCount(4);
      await expect(app.edgeLocator).toHaveCount(4);

      // Validate node textual content and inline styles (width/height come from node.value px)
      // The nodes are defined with values: [10, 20, 40, 30] mapping to widths/heights.
      const expectedSizes = ['10px', '20px', '40px', '30px'];
      for (let i = 0; i < 4; i++) {
        const styles = await app.getNodeStylesByIndex(i);
        // Confirm the node shows its id as text content
        expect(styles.text?.trim()).toBe(String(i));
        // Inline style should reflect width/height in px as set in drawGraph()
        expect(styles.width).toBe(expectedSizes[i]);
        expect(styles.height).toBe(expectedSizes[i]);
        // Positioning is set using vmin units in left/top inline styles
        expect(styles.left).toContain('vmin');
        expect(styles.top).toContain('vmin');
        // Background color should be an HSL string as set (`hsl(${node.value * 5}, 70%, 50%)`)
        expect(styles.backgroundColor).toMatch(/^hsl\(/);
      }

      // Validate edges style attributes
      for (let i = 0; i < 4; i++) {
        const est = await app.getEdgeStylesByIndex(i);
        // left/top/width use 'vmin' unit strings
        expect(est.left).toContain('vmin');
        expect(est.top).toContain('vmin');
        expect(est.width).toContain('vmin');
        // transform uses rotate(...) in radians
        expect(est.transform).toContain('rotate(');
        expect(est.transform).toContain('rad');
        // opacity should be explicitly set to '0.5'
        expect(est.opacity).toBe('0.5');
      }

      // Graph child count should equal total nodes + edges (8)
      const totalChildren = await app.getGraphChildCount();
      expect(totalChildren).toBe(8);

      // Ensure no console 'error' messages or uncaught page errors occurred during the animation start
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Attempting a second start click does not add new nodes/edges (button disabled)', async ({ page }) => {
      const app = new PageRankPage(page);

      // Click once to enter S1_AnimationStarted
      await app.clickStartButton();
      await expect(app.startButton).toBeDisabled();
      await expect(app.nodeLocator).toHaveCount(4);
      await expect(app.edgeLocator).toHaveCount(4);

      // Attempting to click normally should be rejected by Playwright since the button is disabled.
      // We assert that a rejection occurs when trying to click a disabled button.
      await expect(page.click('#startButton')).rejects.toThrow();

      // Counts remain unchanged after the failed click attempt
      expect(await app.getNodeCount()).toBe(4);
      expect(await app.getEdgeCount()).toBe(4);

      // Verify still no page errors or console errors
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error observations', () => {
    test('The drawGraph function produces consistent geometry and no runtime errors on repeated navigation', async ({ page }) => {
      // This test ensures that navigating away and back to the page does not produce errors during re-render.
      // It also validates that calling drawGraph only once per click yields the same DOM structure each time.

      const app = new PageRankPage(page);

      // First run
      await app.clickStartButton();
      await expect(app.nodeLocator).toHaveCount(4);
      await expect(app.edgeLocator).toHaveCount(4);

      // Navigate away and come back to ensure fresh load has no errors and initial state resets
      await page.goto('about:blank');
      // Reset captured logs for clarity
      consoleMessages = [];
      pageErrors = [];

      // Navigate back to the app
      await page.goto(APP_URL);
      const app2 = new PageRankPage(page);

      // On fresh page load, Idle state should be observed again
      await expect(app2.startButton).toBeVisible();
      await expect(app2.startButton).toBeEnabled();
      expect(await app2.getGraphChildCount()).toBe(0);

      // Start again and validate the same DOM outcomes
      await app2.clickStartButton();
      await expect(app2.nodeLocator).toHaveCount(4);
      await expect(app2.edgeLocator).toHaveCount(4);

      // Validate node ids are correct after fresh start
      for (let i = 0; i < 4; i++) {
        const styles = await app2.getNodeStylesByIndex(i);
        expect(styles.text?.trim()).toBe(String(i));
      }

      // There should be no page errors or console errors during these operations
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('No unexpected console errors or uncaught exceptions during full interaction flow', async ({ page }) => {
      const app = new PageRankPage(page);

      // Perform the primary interaction
      await app.clickStartButton();

      // Ensure everything rendered
      await expect(app.nodeLocator).toHaveCount(4);
      await expect(app.edgeLocator).toHaveCount(4);

      // Summarize captured console messages for debugging (non-failing informational check)
      const infoMessages = consoleMessages.filter(m => m.type !== 'error');
      // It's acceptable for there to be zero or multiple informational console logs; verify none are 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // Ensure no page errors (uncaught exceptions)
      expect(pageErrors.length).toBe(0);

      // As an additional check: ensure that nodes and edges are direct children of the graph container
      const totalChildren = await app.getGraphChildCount();
      expect(totalChildren).toBe(8);
    });
  });
});