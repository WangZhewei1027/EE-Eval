import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aceb82-fa78-11f0-812d-c9788050701f.html';

/**
 * Page Object for the Visualization Diagram page.
 * Encapsulates common selectors and interactions for clearer tests.
 */
class DiagramPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtn = page.locator('#animateBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.diagram = page.locator('#diagram');
    this.nodes = page.locator('.node');
    this.hero = page.locator('.hero');
    this.container = page.locator('.container');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for DOMContentLoaded handlers to run which populate the diagram
    await this.page.waitForSelector('#diagram .node', { timeout: 2000 });
  }

  async clickAnimate() {
    await this.animateBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  /**
   * Returns the inline style.transform of a node by id
   * @param {string} id
   */
  async getNodeInlineTransform(id) {
    return await this.page.evaluate((nodeId) => {
      const el = document.getElementById(nodeId);
      return el ? el.style.transform : null;
    }, id);
  }

  /**
   * Returns the inline style.boxShadow of a node by id
   * @param {string} id
   */
  async getNodeInlineBoxShadow(id) {
    return await this.page.evaluate((nodeId) => {
      const el = document.getElementById(nodeId);
      return el ? el.style.boxShadow : null;
    }, id);
  }

  /**
   * Returns array of node IDs currently present in the diagram
   */
  async getNodeIds() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('.node')).map(n => n.id);
    });
  }

  /**
   * Returns true if element exists matching selector
   * @param {string} selector
   */
  async exists(selector) {
    return await this.page.locator(selector).count().then(c => c > 0);
  }
}

test.describe('Design Patterns Visual Showcase - FSM interactions', () => {
  // Arrays to capture console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of level 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null
        });
      }
      // We still capture all console messages in case we want to debug
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No special teardown needed other than clearing captured arrays (automatically done)
  });

  test.describe('S0_Idle (Initial Render)', () => {
    test('renders hero and container and populates diagram nodes (entry action: renderPage)', async ({ page }) => {
      const pg = new DiagramPage(page);

      // Navigate and wait for nodes to be added by the page script
      await pg.goto();

      // Verify hero section exists and contains expected heading
      await expect(pg.hero).toBeVisible();
      await expect(pg.hero.locator('h1')).toHaveText(/Design Patterns/);

      // Verify container exists
      await expect(pg.container).toBeVisible();

      // Verify nodes are created (expected 6 nodes)
      const nodeIds = await pg.getNodeIds();
      expect(nodeIds.length).toBeGreaterThanOrEqual(6);
      expect(nodeIds).toEqual(expect.arrayContaining([
        'observer',
        'strategy',
        'singleton',
        'factory',
        'decorator',
        'adapter'
      ]));

      // Verify that the first node has inline left and top styles set (they're positioned)
      const observerLeft = await page.evaluate(() => {
        const el = document.getElementById('observer');
        return el ? el.style.left : null;
      });
      const observerTop = await page.evaluate(() => {
        const el = document.getElementById('observer');
        return el ? el.style.top : null;
      });
      expect(observerLeft).toBeTruthy();
      expect(observerTop).toBeTruthy();

      // Assert there are no console errors or page errors during initial render
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S1_Animating (AnimateClick) and S2_Reset (ResetClick) transitions', () => {
    test('Animate button triggers staggered scale animation on nodes and reverts (transition S0 -> S1)', async ({ page }) => {
      const pg = new DiagramPage(page);
      await pg.goto();

      // Ensure animate button is visible
      await expect(pg.animateBtn).toBeVisible();

      // Click animate
      await pg.clickAnimate();

      // The script applies scale(1.2) to nodes with staggered timeouts.
      // The 'observer' node is index 0 and should receive scale(1.2) immediately (index*200 ms).
      // Wait up to 1s for the inline style to be set.
      await page.waitForFunction(() => {
        const el = document.getElementById('observer');
        return el && el.style.transform === 'scale(1.2)';
      }, {}, { timeout: 1000 });

      // Verify the inline transform and box shadow were applied for the first node
      const transformAfterAnimate = await pg.getNodeInlineTransform('observer');
      const boxShadowAfterAnimate = await pg.getNodeInlineBoxShadow('observer');
      expect(transformAfterAnimate).toBe('scale(1.2)');
      expect(boxShadowAfterAnimate).toBe('0 15px 30px rgba(0,0,0,0.2)');

      // The animation reverts each node after 600ms from when it was scaled.
      // For the first node, allow up to 2s to observe revert to 'scale(1)' (script sets 'scale(1)')
      await page.waitForFunction(() => {
        const el = document.getElementById('observer');
        return el && el.style.transform === 'scale(1)';
      }, {}, { timeout: 2000 });

      const transformReverted = await pg.getNodeInlineTransform('observer');
      const boxShadowReverted = await pg.getNodeInlineBoxShadow('observer');
      expect(transformReverted).toBe('scale(1)');
      expect(boxShadowReverted).toBe('0 5px 15px rgba(0,0,0,0.1)');

      // Also spot-check a later node (adapter - last index) to ensure it receives the animate call after delay
      await page.waitForFunction(() => {
        const el = document.getElementById('adapter');
        return el && (el.style.transform === 'scale(1.2)' || el.style.transform === 'scale(1)');
      }, {}, { timeout: 3000 });

      // Assert no console/page errors occurred during animate/revert
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Reset button clears inline transforms and box shadows for all nodes (transition S1 -> S0)', async ({ page }) => {
      const pg = new DiagramPage(page);
      await pg.goto();

      // Edge-case: clicking reset before animate should not throw; assert no errors and nothing breaks
      await pg.clickReset();
      // small wait to allow any potential handlers to run
      await page.waitForTimeout(100);
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Now trigger animate so nodes get inline styles
      await pg.clickAnimate();

      // Wait for at least the first node to be in animated state
      await page.waitForFunction(() => {
        const el = document.getElementById('observer');
        return el && el.style.transform === 'scale(1.2)';
      }, {}, { timeout: 1000 });

      // Click reset to clear inline styles
      await pg.clickReset();

      // After reset, inline transform and boxShadow should be empty strings for all nodes.
      // Wait briefly and then assert.
      await page.waitForTimeout(200);

      const nodeIds = await pg.getNodeIds();
      for (const id of nodeIds) {
        const transform = await pg.getNodeInlineTransform(id);
        const boxShadow = await pg.getNodeInlineBoxShadow(id);

        // The page's reset handler sets style.transform = '' and style.boxShadow = ''
        expect(transform === '' || transform === null).toBeTruthy();
        expect(boxShadow === '' || boxShadow === null).toBeTruthy();
      }

      // Assert no console/page errors occurred during reset
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error observation', () => {
    test('multiple rapid animate clicks should not cause uncaught exceptions', async ({ page }) => {
      const pg = new DiagramPage(page);
      await pg.goto();

      // Rapidly click animate several times
      await Promise.all([
        pg.animateBtn.click(),
        pg.animateBtn.click(),
        pg.animateBtn.click()
      ]);

      // Wait for animations to proceed (but don't rely on exact timings)
      await page.waitForTimeout(1000);

      // Ensure there are no uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // Sanity check: at least one node should have received an inline transform at some point
      const anyTransformed = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.node')).some(n => n.style.transform && n.style.transform.length > 0);
      });
      expect(anyTransformed).toBeTruthy();
    });

    test('observes console and page errors if any are thrown (test will fail if unexpected errors exist)', async ({ page }) => {
      const pg = new DiagramPage(page);
      await pg.goto();

      // This test's purpose is to assert the presence/absence of captured errors.
      // The application is expected to run without throwing ReferenceError/SyntaxError/TypeError.
      // We assert that no page-level errors were captured.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // Log captured arrays sizes to the test output for debugging if needed
      // (We do not rely on console.log in the app — this is test-side only)
    });
  });
});