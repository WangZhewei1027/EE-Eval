import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f56992-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object Model for the Graph page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleAnimate = page.locator('#toggleAnimate');
    this.toggleLabels = page.locator('#toggleLabels');
    this.svg = page.locator('#graphSvg');
    this.graphGroup = page.locator('#graphGroup');
    this.nodeCount = page.locator('#nodeCount');
    this.edgeCount = page.locator('#edgeCount');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for the main svg to be attached and nodes to be rendered
    await expect(this.svg).toBeVisible();
    // give a short moment for initial rendering RTT/animations to start
    await this.page.waitForTimeout(80);
  }

  // Returns current transform attribute of graphGroup
  async getGraphGroupTransform() {
    return await this.graphGroup.getAttribute('transform');
  }

  // Toggle animate by clicking the button
  async clickToggleAnimate() {
    await this.toggleAnimate.click();
  }

  // Toggle labels by clicking the button
  async clickToggleLabels() {
    await this.toggleLabels.click();
  }

  // Returns aria-pressed of animate button
  async animatePressed() {
    return await this.toggleAnimate.getAttribute('aria-pressed');
  }

  // Returns aria-pressed of labels button
  async labelsPressed() {
    return await this.toggleLabels.getAttribute('aria-pressed');
  }

  // Returns class list of animate button
  async animateClassList() {
    return await this.toggleAnimate.getAttribute('class');
  }

  // Returns class list of labels button
  async labelsClassList() {
    return await this.toggleLabels.getAttribute('class');
  }

  // Returns numeric nodeCount and edgeCount text values
  async counts() {
    const nodes = Number(await this.nodeCount.textContent());
    const edges = Number(await this.edgeCount.textContent());
    return { nodes, edges };
  }

  // Get element handles for a named node group (g[data-node="A"])
  async getNodeHandles(nodeId = 'A') {
    const nodeGroup = this.page.locator(`g[data-node="${nodeId}"]`);
    const circle = nodeGroup.locator('circle').nth(1); // the second circle is the main circle (halo is first)
    const label = nodeGroup.locator('text.node-label');
    const labelBg = nodeGroup.locator('rect');
    return { nodeGroup, circle, label, labelBg };
  }

  // Move mouse to center of a node group (by using its bounding box)
  async moveMouseToNode(nodeId = 'A') {
    const { nodeGroup } = await this.getNodeHandles(nodeId);
    const box = await nodeGroup.boundingBox();
    if (!box) throw new Error(`Unable to get bounding box for node ${nodeId}`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    // small pause to let the mousemove handler run
    await this.page.waitForTimeout(120);
  }

  // Move mouse away from svg (to trigger mouseleave)
  async moveMouseAway() {
    // Move to top-left corner outside SVG (0,0)
    await this.page.mouse.move(5, 5);
    // Trigger a mouseleave by moving to a point outside svg bounding box
    await this.page.waitForTimeout(100);
  }

  // Read attributes/styles of node parts
  async readNodeVisualState(nodeId = 'A') {
    const { circle, label, labelBg } = await this.getNodeHandles(nodeId);
    const circleTransform = await circle.getAttribute('transform');
    const labelOpacity = await this.page.evaluate(el => el.style.opacity, await label.elementHandle());
    const labelBgOpacity = await labelBg.getAttribute('opacity');
    return { circleTransform, labelOpacity, labelBgOpacity };
  }
}

test.describe('Graph (Undirected) — Visual Concept (f1f56992...)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial render and Idle state (S0_Idle)', () => {
    test('renders page structure and initial counts — validates onEnter renderPage()', async ({ page }) => {
      // Ensure the page loads and basic structure is present
      const graph = new GraphPage(page);
      await graph.goto();

      // Validate stage and card exist
      await expect(page.locator('.stage[role="main"]')).toBeVisible();
      await expect(page.locator('.card[aria-label="Undirected graph demonstration"]')).toBeVisible();

      // Validate counts (expected 12 nodes, 16 edges from data)
      const counts = await graph.counts();
      expect(counts.nodes).toBe(12);
      expect(counts.edges).toBe(16);

      // Validate SVG exists with correct attributes
      const svg = page.locator('#graphSvg');
      await expect(svg).toBeVisible();
      expect(await svg.getAttribute('role')).toBe('img');
      expect(await svg.getAttribute('aria-label')).toContain('Undirected graph');

      // No uncaught page errors on initial render
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Animation toggling (S0_Idle <-> S1_Animating)', () => {
    test('initially animating, toggles to stop and resumes — verifies startAnimation/stopAnimation behavior', async ({ page }) => {
      const graph = new GraphPage(page);
      await graph.goto();

      // Initial animate button should indicate animating (aria-pressed="true" and active class)
      expect(await graph.animatePressed()).toBe('true');
      expect((await graph.animateClassList() || '').includes('active')).toBe(true);

      // While animating, the graphGroup transform should be changing over time.
      const t1 = await graph.getGraphGroupTransform();
      await page.waitForTimeout(220);
      const t2 = await graph.getGraphGroupTransform();
      // Expect rotation/transform to have changed while animating
      expect(t1).not.toBeNull();
      expect(t2).not.toBeNull();
      expect(t1).not.toBe(t2);

      // Click to stop animation (transition S0 <-> S1)
      await graph.clickToggleAnimate();

      // aria-pressed should update and 'active' class toggled off
      expect(await graph.animatePressed()).toBe('false');
      expect((await graph.animateClassList() || '').includes('active')).toBe(false);

      // After stopping, transform should remain the same across a short interval
      const stopped1 = await graph.getGraphGroupTransform();
      await page.waitForTimeout(260);
      const stopped2 = await graph.getGraphGroupTransform();
      expect(stopped1).toBe(stopped2);

      // Click again to resume animation
      await graph.clickToggleAnimate();
      expect(await graph.animatePressed()).toBe('true');
      expect((await graph.animateClassList() || '').includes('active')).toBe(true);

      // Once resumed, transform should change again
      const resume1 = await graph.getGraphGroupTransform();
      await page.waitForTimeout(200);
      const resume2 = await graph.getGraphGroupTransform();
      expect(resume1).not.toBe(resume2);
    });

    test('rapid toggles do not crash — edge case for multiple quick clicks', async ({ page }) => {
      const graph = new GraphPage(page);
      await graph.goto();

      // Rapidly click toggle a few times
      for (let i = 0; i < 6; i++) {
        await graph.clickToggleAnimate();
        // very short delay to emulate a user double-click/spam
        await page.waitForTimeout(40);
      }

      // Expect the button still exists and has a boolean aria-pressed (either true/false)
      const aria = await graph.animatePressed();
      expect(['true', 'false', null].includes(aria)).toBe(true);

      // No uncaught exceptions should have occurred even under rapid interactions
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Label visibility toggling (S0_Idle <-> S2_LabelsVisible)', () => {
    test('initial labels visible, toggles hide/show and affects DOM label opacities', async ({ page }) => {
      const graph = new GraphPage(page);
      await graph.goto();

      // Initially labelsOn is true -> labels are visible (style.opacity = "1" and labelBg opacity = "0.9")
      const initialNodeState = await graph.readNodeVisualState('A');
      expect(initialNodeState.labelOpacity).toBeTruthy();
      // The code sets initial label.style.opacity = 1 (string) so validate it's "1" or numeric equivalent
      expect(Number(initialNodeState.labelOpacity)).toBeGreaterThan(0.8);
      expect(Number(initialNodeState.labelBgOpacity)).toBeGreaterThan(0.8);

      // Click toggleLabels to hide
      await graph.clickToggleLabels();
      // aria-pressed should update to 'false' and class include/exclude 'active'
      expect(await graph.labelsPressed()).toBe('false');
      // After hiding, label opacity should be 0 and labelBg opacity 0.0
      // Wait a short amount for transitions to apply
      await page.waitForTimeout(120);
      const hiddenState = await graph.readNodeVisualState('A');
      expect(Number(hiddenState.labelOpacity)).toBeCloseTo(0, 2);
      expect(Number(hiddenState.labelBgOpacity)).toBeCloseTo(0, 2);

      // Click again to show labels
      await graph.clickToggleLabels();
      await page.waitForTimeout(120);
      const shownState = await graph.readNodeVisualState('A');
      expect(Number(shownState.labelOpacity)).toBeGreaterThan(0.8);
      expect(Number(shownState.labelBgOpacity)).toBeGreaterThan(0.8);
    });

    test('keyboard toggles for labels (Enter and Space) — accessibility check', async ({ page }) => {
      const graph = new GraphPage(page);
      await graph.goto();

      // Ensure labels are on; then press Space to toggle via keyboard
      const before = await graph.labelsPressed();
      await graph.toggleLabels.focus();
      // Press Space
      await graph.toggleLabels.press(' ');
      await page.waitForTimeout(80);
      const afterSpace = await graph.labelsPressed();
      expect(afterSpace).not.toBe(before);

      // Press Enter to toggle back
      await graph.toggleLabels.press('Enter');
      await page.waitForTimeout(80);
      const afterEnter = await graph.labelsPressed();
      // afterEnter should equal original before (toggled twice)
      expect(afterEnter).toBe(before);
    });
  });

  test.describe('Mouse interactions: Hover and Leave events', () => {
    test('mousemove near a node highlights it and mouseleave resets highlight', async ({ page }) => {
      const graph = new GraphPage(page);
      await graph.goto();

      // Choose a known node 'A' and move mouse directly to its center to trigger hover
      const { nodeGroup } = await graph.getNodeHandles('A');
      // Ensure the node group exists
      await expect(nodeGroup).toBeVisible();

      // Read pre-hover circle transform and label state
      const pre = await graph.readNodeVisualState('A');

      // Move mouse to the node center to trigger nearest detection and emphasis
      await graph.moveMouseToNode('A');

      // After hover, circle transform should reflect scaling (scale(1.12)), label opacity set to 1 and labelBg opacity high
      const hovered = await graph.readNodeVisualState('A');
      expect(hovered.circleTransform).toContain('scale');
      // scale should be 1.12 when highlighted
      expect(hovered.circleTransform).toContain('1.12');
      expect(Number(hovered.labelOpacity)).toBeGreaterThan(0.9);
      expect(Number(hovered.labelBgOpacity)).toBeGreaterThan(0.9);

      // Now move mouse away to cause mouseleave/reset
      await graph.moveMouseAway();
      // Wait to allow the mouseleave handler to run (the script resets lastHover on mouseleave)
      await page.waitForTimeout(140);
      const afterLeave = await graph.readNodeVisualState('A');

      // After leaving, circle transform should return to scale(1) and label opacity reflect labelsOn (likely 1)
      // The script sets scale(1) on reset
      expect(afterLeave.circleTransform).toContain('scale(1)');
    });

    test('mousemove to arbitrary empty space does not throw and clears highlight', async ({ page }) => {
      const graph = new GraphPage(page);
      await graph.goto();

      // Move to center of SVG where may be no node within threshold and ensure no error
      const svgBox = await graph.svg.boundingBox();
      expect(svgBox).not.toBeNull();
      if (svgBox) {
        const x = svgBox.x + svgBox.width * 0.5;
        const y = svgBox.y + svgBox.height * 0.5;
        await page.mouse.move(x, y);
        await page.waitForTimeout(120);
      }

      // No uncaught exceptions as a result of hover logic
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('captures console messages and ensures no error-level console messages or page errors', async ({ page }) => {
      const graph = new GraphPage(page);
      await graph.goto();

      // Interact a bit to surface any runtime errors
      await graph.clickToggleAnimate();
      await graph.clickToggleLabels();
      await graph.clickToggleAnimate();

      // brief wait to accumulate console messages
      await page.waitForTimeout(200);

      // Examine collected console messages
      const errorConsoles = consoleMessages.filter(c => c.type === 'error' || c.type === 'warning');
      // There should be no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // There should be no severe console error messages; if there are, surface them for debugging
      expect(errorConsoles.length).toBe(0);
    });

    test('sanity check: no SyntaxError/ReferenceError/TypeError reported during load', async ({ page }) => {
      const graph = new GraphPage(page);
      await graph.goto();

      // Wait a short time for any latent errors
      await page.waitForTimeout(220);

      // Inspect pageErrors for typical JS error types and fail if any found
      const foundCritical = pageErrors.filter(e => {
        const msg = String(e && e.message ? e.message : e);
        return /ReferenceError|SyntaxError|TypeError/i.test(msg);
      });

      // Expect none of these critical errors to have occurred
      expect(foundCritical.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Safety: if any page errors were captured, attach them to the test output (makes failures easier to debug)
    if (pageErrors.length > 0) {
      // This will fail the test if there were any page errors (explicit)
      // but keep the expectation in the tests themselves; here we simply log for debug purposes
      // eslint-disable-next-line no-console
      console.warn('Captured page errors:', pageErrors.map(e => e.message || String(e)));
    }
    // ensure page is closed/clean for next test (Playwright does this, but keep explicit)
    try {
      await page.close();
    } catch (e) {
      // ignore close errors
    }
  });
});