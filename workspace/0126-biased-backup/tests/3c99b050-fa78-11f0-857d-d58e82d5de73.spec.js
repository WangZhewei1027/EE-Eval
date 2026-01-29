import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c99b050-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the B-Tree visualization page.
 * Encapsulates common selectors and operations so tests read more clearly.
 */
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.resetBtn = page.locator('#resetBtn');
    this.highlightBtn = page.locator('#highlightBtn');
    this.treeContainer = page.locator('.tree-container');
    this.connectors = page.locator('svg.connector');
    this.level0Nodes = page.locator('.level0 > .node');
    this.level1Nodes = page.locator('.level1 > .node');
    this.level2Nodes = page.locator('.level2 > .node');
    // convenience combined levels for easier scanning
    this.allNodes = page.locator('.node');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for the main pieces to be present
    await this.page.waitForSelector('.tree-container');
    await this.page.waitForSelector('svg.connector');
    await this.page.waitForSelector('#highlightBtn');
    await this.page.waitForSelector('#resetBtn');
  }

  // Click the highlight button (mouse)
  async clickHighlight() {
    await this.highlightBtn.click();
  }

  // Click the reset button (mouse)
  async clickReset() {
    await this.resetBtn.click();
  }

  // Trigger keyboard "Enter" on the highlight button
  async keyboardActivateHighlight() {
    await this.highlightBtn.focus();
    await this.page.keyboard.press('Enter');
  }

  // Trigger keyboard "Enter" on the reset button
  async keyboardActivateReset() {
    await this.resetBtn.focus();
    await this.page.keyboard.press('Enter');
  }

  // Return number of path elements (SVG children)
  async connectorPathCount() {
    const svgHandle = await this.connectors.elementHandle();
    if (!svgHandle) return 0;
    return await svgHandle.evaluate((svg) => svg.childElementCount);
  }

  // Get inline style.borderColor for a node element handle
  async nodeInlineBorderColor(nodeLocator) {
    const handle = await nodeLocator.elementHandle();
    if (!handle) return null;
    return await handle.evaluate(el => el.style.borderColor);
  }

  // Get inline style.boxShadow for a node element handle
  async nodeInlineBoxShadow(nodeLocator) {
    const handle = await nodeLocator.elementHandle();
    if (!handle) return null;
    return await handle.evaluate(el => el.style.boxShadow);
  }

  // Get styles for first key inside a node (if multiple keys exist, returns array)
  async keysInlineStyles(nodeLocator) {
    const handle = await nodeLocator.elementHandle();
    if (!handle) return [];
    return await handle.evaluate(() => {
      const keys = Array.from(document.querySelectorAll('.node')).flatMap(n => {
        /* intentionally not used here - this evaluate runs on the node handle,
           but for simplicity we'll gather styles from the node argument below in the caller.
           We will instead return styles for keys relative to the passed node. */
        return [];
      });
    }).catch(async () => {
      // Fallback approach: evaluate on provided node to get its keys' styles
      return await nodeLocator.evaluate(node => {
        const ks = Array.from(node.querySelectorAll('.key'));
        return ks.map(k => ({
          background: k.style.background,
          boxShadow: k.style.boxShadow,
          transform: k.style.transform
        }));
      });
    });
  }

  // Get key styles specifically for a given selector (useful to avoid the above evaluate complexity)
  async keyStylesForNodeIndex(levelLocator, index) {
    const item = levelLocator.nth(index);
    const handle = await item.elementHandle();
    if (!handle) return [];
    return await handle.evaluate(node => {
      const keys = Array.from(node.querySelectorAll('.key'));
      return keys.map(k => ({ background: k.style.background, boxShadow: k.style.boxShadow, transform: k.style.transform, text: k.textContent?.trim() }));
    });
  }
}

test.describe('B-Tree Index Visualization - FSM States and Transitions', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages and page errors but do NOT interfere with them.
    page.on('console', msg => {
      // capture only error-level console messages
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial state S0_Idle: page loads and clearHighlight() executed on entry', async ({ page }) => {
    // This test verifies the Idle state on page load:
    // - clearHighlight() should have been called (inline styles reset)
    // - keys should not have highlight styles
    const bt = new BTreePage(page);
    await bt.goto();

    // Ensure no runtime page errors happened during load
    // (We assert there are zero page errors — if any errors exist they are captured above)
    expect(pageErrors.length, 'No uncaught page errors on load').toBe(0);
    expect(consoleErrors.length, 'No console.error messages on load').toBe(0);

    // The root node (level0, index 0) should have its inline borderColor set by clearHighlight().
    const rootBorder = await bt.nodeInlineBorderColor(bt.level0Nodes.first());
    expect(rootBorder).toBe('var(--color-node-border)');

    // Many nodes exist: ensure a sampling are all reset to default border color and key backgrounds empty.
    const sampleNodes = [
      bt.level0Nodes.nth(0),
      bt.level1Nodes.nth(0),
      bt.level1Nodes.nth(1),
      bt.level2Nodes.nth(4) // the node that will later be highlighted
    ];

    for (const locator of sampleNodes) {
      const bc = await bt.nodeInlineBorderColor(locator);
      expect(bc).toBe('var(--color-node-border)');
      const bs = await bt.nodeInlineBoxShadow(locator);
      // Expect the inline boxShadow set by clearHighlight (string match)
      expect(bs).toContain('0 0 10px var(--color-shadow)');
      // Keys inside this node should have no inline background/transform/boxShadow after clear
      const keyStyles = await bt.keyStylesForNodeIndex(locator.locator('..'), 0).catch(() => []); // defensive
      // Instead, directly query keys for this node
      const directKeyStyles = await locator.evaluate(node => {
        return Array.from(node.querySelectorAll('.key')).map(k => ({ background: k.style.background, transform: k.style.transform, boxShadow: k.style.boxShadow, text: k.textContent?.trim() }));
      });
      for (const ks of directKeyStyles) {
        expect(ks.background).toBe('', 'Key background should be empty after clearHighlight()');
        expect(ks.transform).toBe('', 'Key transform should be empty after clearHighlight()');
        expect(ks.boxShadow).toBe('', 'Key boxShadow should be empty after clearHighlight()');
      }
    }
  });

  test('Transition S0_Idle -> S1_Highlighted: clicking Highlight Search Path calls highlightPath()', async ({ page }) => {
    // This test validates the transition triggered by clicking the "Highlight Search Path" button:
    // - Nodes on chosen path gain amber accent border and keys adopt amber gradient and scale transform
    const bt = new BTreePage(page);
    await bt.goto();

    // Click the highlight button
    await bt.clickHighlight();

    // The FSM's chosen path nodes (from script): level0[0], level1[1], level2[4]
    const pathNodes = [
      bt.level0Nodes.nth(0),
      bt.level1Nodes.nth(1),
      bt.level2Nodes.nth(4)
    ];

    // Verify each highlighted node has the amber border color inline style
    for (const nodeLocator of pathNodes) {
      const border = await bt.nodeInlineBorderColor(nodeLocator);
      expect(border).toBe('var(--color-accent)', 'Highlighted node must have borderColor var(--color-accent)');
      const bs = await bt.nodeInlineBoxShadow(nodeLocator);
      expect(bs).toContain('var(--color-accent)', 'Highlighted node boxShadow should include accent color');
      const keyStyles = await nodeLocator.evaluate(node => {
        return Array.from(node.querySelectorAll('.key')).map(k => ({ background: k.style.background, transform: k.style.transform, boxShadow: k.style.boxShadow, text: k.textContent?.trim() }));
      });
      // At least one key should have the amber gradient and scaled transform
      expect(keyStyles.length).toBeGreaterThan(0);
      for (const ks of keyStyles) {
        // background should reflect the inline linear-gradient set by highlightPath
        expect(ks.background).toContain('linear-gradient', 'Highlighted key should have a linear-gradient background');
        expect(ks.background).toContain('var(--color-accent)');
        expect(ks.transform).toBe('scale(1.1)', 'Highlighted key should be scaled up');
        expect(ks.boxShadow).toContain('var(--color-accent)', 'Highlighted key boxShadow should include accent');
      }
    }

    // Ensure nodes NOT in the chosen path retain the default border color set by clearHighlight
    // Pick some nodes outside path: level1[0], level1[2], level2[0]
    const nonPathNodes = [
      bt.level1Nodes.nth(0),
      bt.level1Nodes.nth(2),
      bt.level2Nodes.nth(0)
    ];
    for (const nodeLocator of nonPathNodes) {
      const border = await bt.nodeInlineBorderColor(nodeLocator);
      expect(border).toBe('var(--color-node-border)', 'Non-highlighted nodes should retain default border color');
      // keys of non-path nodes should not have a scaled transform
      const keyStyles = await nodeLocator.evaluate(node => {
        return Array.from(node.querySelectorAll('.key')).map(k => ({ background: k.style.background, transform: k.style.transform }));
      });
      for (const ks of keyStyles) {
        expect(ks.transform).toBe('', 'Non-highlighted keys should not be scaled');
      }
    }
  });

  test('Transition S1_Highlighted -> S0_Idle: clicking Reset Highlight calls clearHighlight()', async ({ page }) => {
    // This test validates resetting the highlight returns nodes to default appearance.
    const bt = new BTreePage(page);
    await bt.goto();

    // First highlight, then reset
    await bt.clickHighlight();

    // Confirm highlighted state applied
    const highlightedNode = bt.level1Nodes.nth(1);
    expect(await bt.nodeInlineBorderColor(highlightedNode)).toBe('var(--color-accent)');

    // Now click reset
    await bt.clickReset();

    // The previously highlighted nodes should have border reset and keys cleared
    const pathNodes = [
      bt.level0Nodes.nth(0),
      bt.level1Nodes.nth(1),
      bt.level2Nodes.nth(4)
    ];

    for (const nodeLocator of pathNodes) {
      const border = await bt.nodeInlineBorderColor(nodeLocator);
      expect(border).toBe('var(--color-node-border)', 'After reset, node border should be reset to var(--color-node-border)');
      const keyStyles = await nodeLocator.evaluate(node => {
        return Array.from(node.querySelectorAll('.key')).map(k => ({ background: k.style.background, transform: k.style.transform, boxShadow: k.style.boxShadow }));
      });
      for (const ks of keyStyles) {
        expect(ks.background).toBe('', 'After reset, key background should be empty');
        expect(ks.transform).toBe('', 'After reset, key transform should be empty');
        expect(ks.boxShadow).toBe('', 'After reset, key boxShadow should be empty');
      }
    }

    // Double-reset should be idempotent (edge case)
    await bt.clickReset();
    for (const nodeLocator of pathNodes) {
      const border = await bt.nodeInlineBorderColor(nodeLocator);
      expect(border).toBe('var(--color-node-border)', 'Double reset should keep default styles');
    }
  });

  test('Keyboard activation works for highlight and reset (accessibility)', async ({ page }) => {
    // This test ensures keyboard Enter activates both controls as script sets tabIndex and listeners.
    const bt = new BTreePage(page);
    await bt.goto();

    // Activate highlight via keyboard
    await bt.keyboardActivateHighlight();

    // Confirm highlight applied (sample check)
    const midLevelNode = bt.level1Nodes.nth(1);
    expect(await bt.nodeInlineBorderColor(midLevelNode)).toBe('var(--color-accent)');

    // Activate reset via keyboard
    await bt.keyboardActivateReset();

    // Confirm reset applied
    expect(await bt.nodeInlineBorderColor(midLevelNode)).toBe('var(--color-node-border)');
  });

  test('SVG connectors are drawn and persist after window resize (connectors drawing)', async ({ page }) => {
    // This test validates the connectors SVG contains the expected number of paths
    // and that a resize triggers a redraw maintaining the same number of edges.
    const bt = new BTreePage(page);
    await bt.goto();

    // The script defines 10 edges; ensure we have the expected number of path children
    const initialPaths = await bt.connectorPathCount();
    expect(initialPaths).toBeGreaterThanOrEqual(1);
    // The code's edges array has 10 entries; we expect at least 10 paths drawn
    // (depending on rendering timing, but the drawing runs synchronously on load)
    expect(initialPaths).toBe(10);

    // Trigger a resize event to force redrawConnections; do not modify page functions
    await page.setViewportSize({ width: 900, height: 800 });
    // Dispatch a resize event in the page context to mirror natural browser behavior
    await page.evaluate(() => { window.dispatchEvent(new Event('resize')); });

    // Wait a short moment for redraw to complete
    await page.waitForTimeout(120);

    const afterResizePaths = await bt.connectorPathCount();
    expect(afterResizePaths).toBe(10);
  });

  test('Edge case: clicking highlight multiple times does not produce errors and is idempotent', async ({ page }) => {
    // Clicking highlight repeatedly should not throw or produce console errors,
    // and the highlighted state remains consistent.
    const bt = new BTreePage(page);
    await bt.goto();

    // click highlight multiple times
    await bt.clickHighlight();
    await bt.clickHighlight();
    await bt.clickHighlight();

    // No console errors should have been emitted by these interactions
    expect(consoleErrors.length, 'No console.error messages after multiple highlight clicks').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors after multiple highlight clicks').toBe(0);

    // The highlighted node retains expected inline styles
    const midNode = bt.level1Nodes.nth(1);
    expect(await bt.nodeInlineBorderColor(midNode)).toBe('var(--color-accent)');
  });

  test('Console and runtime error observation - report captured errors (if any)', async ({ page }) => {
    // This test explicitly collects and asserts the state of console errors and page errors.
    // Per the instructions: we must observe console logs and page errors and assert their presence or absence.
    // The application is expected to run cleanly, so we assert zero console.error and zero page errors.
    const bt = new BTreePage(page);
    await bt.goto();

    // Provide a short wait to catch any deferred or asynchronous errors emitted immediately after load.
    await page.waitForTimeout(100);

    // Assert no console.error entries
    expect(consoleErrors.length, `Expected no console.error messages, found: ${consoleErrors.length}`).toBe(0);

    // Assert no unhandled page errors
    expect(pageErrors.length, `Expected no uncaught page errors, found: ${pageErrors.length}`).toBe(0);
  });
});