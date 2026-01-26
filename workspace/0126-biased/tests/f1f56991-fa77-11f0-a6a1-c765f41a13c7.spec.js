import { test, expect } from '@playwright/test';

const APP = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f56991-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object for the graph demo
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  async goto() {
    // capture console error messages and page errors for assertions later
    this.page.on('console', (msg) => {
      // only record errors (type() returns 'error' for console.error)
      try {
        if (msg.type() === 'error') {
          this.consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // swallow any unexpected inspection errors here
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });

    await this.page.goto(APP, { waitUntil: 'load' });
    // give time for initial rendering/animations to start
    await this.page.waitForTimeout(200);
  }

  // DOM element selectors and helpers
  async toggleButton() {
    return this.page.locator('#toggleBtn');
  }
  async toggleLabelText() {
    return this.page.locator('#toggleLabel').textContent();
  }
  async playDotBackground() {
    return this.page.$eval('#playDot', (el) => el.style.background || window.getComputedStyle(el).background);
  }
  async cardHasPausedClass() {
    return this.page.$eval('#card', (el) => el.classList.contains('paused'));
  }
  async getPausedFlag() {
    // read the global paused variable from the page context
    return this.page.evaluate(() => typeof paused !== 'undefined' ? paused : null);
  }
  async clickToggle() {
    await this.page.click('#toggleBtn');
    // allow UI updates
    await this.page.waitForTimeout(120);
  }
  async pressSpace() {
    await this.page.keyboard.press('Space');
    await this.page.waitForTimeout(120);
  }

  async shuffleButton() {
    return this.page.locator('#shuffleBtn');
  }
  async clickShuffle() {
    await this.page.click('#shuffleBtn');
    // shuffle animation runs ~800ms, wait slightly longer for changes to apply
    await this.page.waitForTimeout(950);
  }

  async nodeGroupSelector(id) {
    return `#nodes .node-group[data-id="${id}"]`;
  }
  async nodeTransform(id) {
    return this.page.$eval(this.nodeGroupSelector(id), (g) => g.getAttribute('transform'));
  }
  async nodeCoreRadius(id) {
    // read the 'r' attribute of the core circle inside node-group
    return this.page.$eval(this.nodeGroupSelector(id), (g) => {
      const core = g.querySelector('.node-core');
      return core ? core.getAttribute('r') : null;
    });
  }

  async edgePaths() {
    // returns an array of objects {d, opacity, strokeWidth, dataIndex, source, target}
    return this.page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll('#edges .edge-wrap > .edge'));
      return paths.map((p) => {
        const parent = p.parentElement;
        const idx = p.getAttribute('data-i');
        const d = p.getAttribute('d');
        // inline style properties may be set; read computed style for strokeWidth and opacity to be robust
        const cs = window.getComputedStyle(p);
        return {
          index: idx !== null ? Number(idx) : null,
          d,
          opacityInline: p.style.opacity || null,
          opacityComputed: cs.opacity,
          strokeWidthInline: p.style.strokeWidth || null,
          strokeWidthComputed: cs.strokeWidth
        };
      });
    });
  }

  async edgePathStylesByIndex(idx) {
    return this.page.evaluate((i) => {
      const p = document.querySelector(`#edges .edge[data-i="${i}"]`);
      if (!p) return null;
      const cs = window.getComputedStyle(p);
      // prefer inline style values if available
      return {
        inlineOpacity: p.style.opacity || null,
        computedOpacity: cs.opacity,
        inlineStrokeWidth: p.style.strokeWidth || null,
        computedStrokeWidth: cs.strokeWidth
      };
    }, idx);
  }

  async hoverNode(id) {
    // hover the node group; ensure the element is visible
    const sel = this.nodeGroupSelector(id);
    await this.page.waitForSelector(sel);
    const box = await this.page.locator(sel).boundingBox();
    if (!box) {
      // fallback: hover center of svg
      await this.page.hover('#svgRoot');
    } else {
      // hover slightly inside the group
      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      // allow handlers to run
      await this.page.waitForTimeout(120);
    }
  }

  async unhover() {
    // move mouse outside canvas to trigger mouseout
    await this.page.mouse.move(0, 0);
    await this.page.waitForTimeout(120);
  }
}

test.describe('f1f56991 Graph (Directed) — Aesthetic Visualization (E2E)', () => {
  /** @type {GraphPage} */
  let gp;

  test.beforeEach(async ({ page }) => {
    gp = new GraphPage(page);
    await gp.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure there were no page-level errors or console error logs during the test run.
    // These assertions help surface runtime issues like ReferenceError/SyntaxError/TypeError
    // that should not be present for a healthy application.
    expect(gp.consoleErrors, 'No console.error messages should be emitted').toEqual([]);
    expect(gp.pageErrors, 'No uncaught page errors should occur').toEqual([]);
    // Additional small delay to allow background rAF loops to settle before teardown
    await page.waitForTimeout(50);
  });

  test('Initial state: should start animating (S1_Animating)', async ({ page }) => {
    // Validate that initial FSM state is "Animating"
    // - paused variable false
    // - card does NOT have 'paused' class
    // - toggle label reads "Pause"
    // - playDot background uses accent variables (initial inline style)
    const pausedFlag = await gp.getPausedFlag();
    expect(pausedFlag).toBe(false);

    const hasPausedClass = await gp.cardHasPausedClass();
    expect(hasPausedClass).toBe(false);

    const label = await gp.toggleLabelText();
    expect(label).toBe('Pause');

    const playDotBg = await gp.playDotBackground();
    // the inline style uses CSS variables; check that the inline text contains 'var(--accent-b)'
    expect(playDotBg).toContain('var(--accent-b)');
  });

  test('TogglePause: clicking toggleBtn pauses and resumes (S1_Animating <-> S0_Paused)', async ({ page }) => {
    // Click to pause
    await gp.clickToggle();

    // After pause:
    let paused = await gp.getPausedFlag();
    expect(paused).toBe(true);

    let hasPausedClass = await gp.cardHasPausedClass();
    expect(hasPausedClass).toBe(true);

    let label = await gp.toggleLabelText();
    expect(label).toBe('Resume');

    let playDotBg = await gp.playDotBackground();
    // playDot background is set to concrete colors on pause
    expect(playDotBg).toContain('#555');
    expect(playDotBg).toContain('#333');

    // Click again to resume
    await gp.clickToggle();

    paused = await gp.getPausedFlag();
    expect(paused).toBe(false);

    hasPausedClass = await gp.cardHasPausedClass();
    expect(hasPausedClass).toBe(false);

    label = await gp.toggleLabelText();
    expect(label).toBe('Pause');

    playDotBg = await gp.playDotBackground();
    expect(playDotBg).toContain('var(--accent-b)'); // restored to original inline CSS var usage
  });

  test('KeyboardToggle: pressing Space toggles pause state', async ({ page }) => {
    // Ensure pressing space triggers the same effect as clicking toggle button.
    const initialPaused = await gp.getPausedFlag();

    await gp.pressSpace();
    const afterPause = await gp.getPausedFlag();
    expect(afterPause).toBe(!initialPaused);

    // press again to restore
    await gp.pressSpace();
    const afterRestore = await gp.getPausedFlag();
    expect(afterRestore).toBe(initialPaused);
  });

  test('ShuffleNodes: clicking shuffle moves nodes (positions change)', async ({ page }) => {
    // Record transform (position) of a sample node ("A")
    const before = await gp.nodeTransform('A');

    await gp.clickShuffle();

    const after = await gp.nodeTransform('A');

    // transform strings should differ indicating nodes moved
    expect(before).not.toBe(after);
  });

  test('HoverNode / UnhoverNode: hovering highlights node and connected edges, mouseout restores', async ({ page }) => {
    // Get baseline core radius for node A
    const beforeR = await gp.nodeCoreRadius('A');
    expect(beforeR).toBe('22');

    // Get baseline edge styles
    const edgeStylesBefore = await gp.edgePaths();

    // Hover node A
    await gp.hoverNode('A');

    // After hover, the node core radius should be increased to "26" per implementation
    const hoveredR = await gp.nodeCoreRadius('A');
    expect(hoveredR).toBe('26');

    // Edges connected to A should have higher opacity/strokeWidth and others should be faded.
    // We know edgesData includes edges where source === 'A' at indices 0 and 9 (A->B, A->D)
    // We'll inspect a few paths via their data-i attribute to validate visual emphasis.

    // Collect a few edge style checks
    const edge0 = await gp.edgePathStylesByIndex(0); // A->B
    const edge9 = await gp.edgePathStylesByIndex(9); // A->D

    // The implementation sets style.opacity = 1 and style.strokeWidth = 4.2 for connected edges
    // It's possible computedStyle returns '1' or '1', and computed strokeWidth in pixels (e.g., '4.2px').
    expect(edge0).not.toBeNull();
    expect(edge9).not.toBeNull();

    const e0Opacity = parseFloat(edge0.computedOpacity);
    const e9Opacity = parseFloat(edge9.computedOpacity);
    expect(e0Opacity).toBeGreaterThanOrEqual(0.9);
    expect(e9Opacity).toBeGreaterThanOrEqual(0.9);

    const e0Stroke = parseFloat(edge0.computedStrokeWidth);
    const e9Stroke = parseFloat(edge9.computedStrokeWidth);
    // stroke width should increase from ~3.25 to around 4.2
    expect(e0Stroke).toBeGreaterThanOrEqual(3.8);
    expect(e9Stroke).toBeGreaterThanOrEqual(3.8);

    // Now unhover and assert restoration
    await gp.unhover();

    const afterR = await gp.nodeCoreRadius('A');
    expect(afterR).toBe('22');

    const edge0After = await gp.edgePathStylesByIndex(0);
    expect(edge0After).not.toBeNull();
    const e0StrokeAfter = parseFloat(edge0After.computedStrokeWidth);
    // Should be back to approx 3.25
    expect(e0StrokeAfter).toBeGreaterThanOrEqual(2.8);
    expect(e0StrokeAfter).toBeLessThanOrEqual(3.8);
  });

  test('Edge case: Shuffle while paused - nodes still reposition', async ({ page }) => {
    // Pause first
    await gp.clickToggle();
    const paused = await gp.getPausedFlag();
    expect(paused).toBe(true);

    // record transform of node B
    const beforeB = await gp.nodeTransform('B');

    // click shuffle while paused
    await gp.clickShuffle();

    const afterB = await gp.nodeTransform('B');

    // Even if animations are "paused" in ambient loop, the explicit shuffle/tween should reposition nodes.
    expect(beforeB).not.toBe(afterB);
  });

  test('Rapid Toggle: multiple quick toggles should flip label and class consistently', async ({ page }) => {
    // perform quick successive toggles
    const toggles = 5;
    for (let i = 0; i < toggles; i++) {
      await gp.clickToggle();
    }
    // If initial state was animating (paused=false), odd toggles result in paused=true
    const paused = await gp.getPausedFlag();
    const expectedPaused = (toggles % 2) === 1 ? true : false;
    expect(paused).toBe(expectedPaused);

    // Label should reflect current state
    const label = await gp.toggleLabelText();
    if (paused) {
      expect(label).toBe('Resume');
    } else {
      expect(label).toBe('Pause');
    }

    // Clean up: ensure state is returned to animating for subsequent tests
    if (paused) {
      await gp.clickToggle();
      const nowPaused = await gp.getPausedFlag();
      expect(nowPaused).toBe(false);
    }
  });

  test('Sanity: verify graph SVG root and key components exist', async ({ page }) => {
    // Ensure required components detected in FSM are present
    await expect(page.locator('#svgRoot')).toBeVisible();
    await expect(page.locator('#toggleBtn')).toBeVisible();
    await expect(page.locator('#shuffleBtn')).toBeVisible();

    // nodes and edges groups exist
    await expect(page.locator('#nodes')).toBeVisible();
    await expect(page.locator('#edges')).toBeVisible();
  });
});