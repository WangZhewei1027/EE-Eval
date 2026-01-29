import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad87c2-fa78-11f0-812d-c9788050701f.html';

// Simple Page Object for selectors and common actions
class ForestPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      growBtn: '#growBtn',
      highlightBtn: '#highlightBtn',
      forest: '#forest',
      particles: '#particles',
      tree: '.tree',
      treeLayer: '.tree-layer',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickGrow() {
    await this.page.click(this.selectors.growBtn);
  }

  async clickHighlight() {
    await this.page.click(this.selectors.highlightBtn);
  }

  async getParticleCount() {
    return await this.page.evaluate((sel) => {
      const container = document.querySelector(sel);
      return container ? container.children.length : 0;
    }, this.selectors.particles);
  }

  async getTreeCount() {
    return await this.page.evaluate((sel) => {
      const forest = document.querySelector(sel);
      return forest ? forest.children.length : 0;
    }, this.selectors.forest);
  }

  async firstTreeHasAnimation() {
    return await this.page.evaluate((sel) => {
      const tree = document.querySelector(sel);
      return tree ? tree.style.animation : '';
    }, this.selectors.tree);
  }

  async anyTreeTransformed() {
    return await this.page.evaluate(() => {
      const trees = Array.from(document.querySelectorAll('.tree'));
      return trees.some(t => {
        const tr = t.style.transform || window.getComputedStyle(t).transform;
        return tr && (tr.includes('translateY(-10px)') || tr.includes('translateY(0)'));
      });
    });
  }

  async anyLayerHighlighted() {
    return await this.page.evaluate(() => {
      const layers = Array.from(document.querySelectorAll('.tree-layer'));
      return layers.some(layer => {
        const bg = layer.style.background || window.getComputedStyle(layer).background;
        // Highlight color used in implementation: gradients containing f39c12 or f1c40f
        return (bg && (bg.includes('#f39c12') || bg.includes('#f1c40f') || bg.includes('f39c12') || bg.includes('f1c40f')));
      });
    });
  }

  async clearForest() {
    await this.page.evaluate((sel) => {
      const f = document.querySelector(sel);
      if (f) f.innerHTML = '';
    }, this.selectors.forest);
  }
}

test.describe('Random Forest Visualization - FSM states and transitions', () => {
  // We'll capture console errors and page errors for each test to inspect runtime issues.
  test.beforeEach(async ({ page }) => {
    // Ensure viewport is large enough to avoid responsive layout issues
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('S0_Idle: on load createParticles() and generateForest(5) should have run', async ({ page }) => {
    // Arrays to capture console messages and page errors
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      // pageerror provides Error object
      pageErrors.push(err);
    });

    const fp = new ForestPage(page);
    await fp.goto();

    // Validate particles were created (createParticles creates 30)
    const particleCount = await fp.getParticleCount();
    // Expect at least 25 to tolerate minor differences
    expect(particleCount).toBeGreaterThanOrEqual(25);

    // Validate initial forest was generated with 5 trees per implementation
    const treeCount = await fp.getTreeCount();
    expect(treeCount).toBe(5);

    // Validate that the generated trees have the fadeIn animation style set by generateForest
    const animationStyle = await fp.firstTreeHasAnimation();
    expect(animationStyle).toContain('fadeIn');

    // Validate there were no runtime errors during normal page load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_ForestGrown: clicking Grow Forest generates 10 trees and animateTrees runs', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('pageerror', (err) => pageErrors.push(err));

    const fp = new ForestPage(page);
    await fp.goto();

    // Click the Grow Forest button to trigger generateForest(10) and animateTrees()
    await fp.clickGrow();

    // Wait enough time for generation animation to be applied
    await page.waitForTimeout(600);

    // Verify forest now contains 10 trees (transition expected observable)
    const treeCount = await fp.getTreeCount();
    expect(treeCount).toBe(10);

    // animateTrees modifies transform on trees; wait a bit and assert at least one tree was transformed
    // animateTrees uses staggered timeouts. Give some time and poll
    await page.waitForTimeout(300);
    const anyTransformed = await fp.anyTreeTransformed();
    expect(anyTransformed).toBeTruthy();

    // No page errors expected for this valid transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_ForestGrown -> S2_PathHighlighted: clicking Highlight Decision Path highlights a random path', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('pageerror', (err) => pageErrors.push(err));

    const fp = new ForestPage(page);
    await fp.goto();

    // Ensure we are in S1 by growing the forest first (generateForest(10))
    await fp.clickGrow();
    await page.waitForTimeout(600);

    // Now click highlight to trigger highlightRandomPath()
    await fp.clickHighlight();

    // highlightRandomPath uses setTimeouts to apply highlights; wait for them to appear
    await page.waitForTimeout(300); // short wait for first layer highlight

    // At least one tree-layer should be in highlighted state (orange gradient)
    const anyHighlighted = await fp.anyLayerHighlighted();
    expect(anyHighlighted).toBeTruthy();

    // No page errors expected in the normal highlight flow
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case & error scenario: clicking Highlight Decision Path with no trees should produce a TypeError', async ({ page }) => {
    // This test intentionally triggers a runtime error in the page code:
    // highlightRandomPath assumes there is at least one tree; if forest is empty, it will attempt to call
    // querySelectorAll on undefined, causing a TypeError. We must not patch the page — we assert this behavior.

    /** Capture console and page errors */
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // store text for assertions
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // err is an Error object with name and message
      pageErrors.push(err);
    });

    const fp = new ForestPage(page);
    await fp.goto();

    // Clear forest to create the edge condition where there are no trees
    await fp.clearForest();

    // Sanity check: forest is empty
    const treeCountAfterClear = await fp.getTreeCount();
    expect(treeCountAfterClear).toBe(0);

    // Click highlight to trigger the error
    await fp.clickHighlight();

    // Wait a little to allow the JS error to propagate to the pageerror handler
    await page.waitForTimeout(200);

    // Expect at least one pageerror captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Inspect the captured error - should be a TypeError due to attempting to read of undefined
    const foundTypeError = pageErrors.some(err => {
      if (!err) return false;
      // err.name may be 'TypeError' or message might include 'Cannot read' depending on browser
      const nameMatches = err.name === 'TypeError';
      const messageMatches = typeof err.message === 'string' && (
        err.message.includes('Cannot read') ||
        err.message.includes('reading') ||
        err.message.includes('querySelectorAll') ||
        err.message.includes('of undefined')
      );
      return nameMatches || messageMatches;
    });

    expect(foundTypeError).toBeTruthy();

    // Also, console.error messages (if any) should reflect the error
    const consoleContainsErrorText = consoleErrors.some(text =>
      /Cannot read|TypeError|undefined|querySelectorAll/i.test(text)
    );

    // At least one console error is expected in some environments; it's acceptable if not present.
    // We assert that either pageErrors showed the TypeError (mandatory) or the console has matching text.
    expect(foundTypeError || consoleContainsErrorText).toBeTruthy();
  });

  test('Additional checks: repeated Grow clicks and stability', async ({ page }) => {
    // Verify that repeatedly clicking Grow produces the expected forest size (should replace content each time)
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err));

    const fp = new ForestPage(page);
    await fp.goto();

    // Click grow multiple times
    await fp.clickGrow();
    await page.waitForTimeout(400);
    expect(await fp.getTreeCount()).toBe(10);

    await fp.clickGrow();
    await page.waitForTimeout(400);
    // generateForest(10) replaces forest with 10 again -> still 10
    expect(await fp.getTreeCount()).toBe(10);

    // No runtime errors expected from repeated valid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Note: no explicit afterEach teardown required because Playwright provides isolated pages per test.
});