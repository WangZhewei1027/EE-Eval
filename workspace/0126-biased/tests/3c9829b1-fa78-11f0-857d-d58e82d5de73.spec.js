import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9829b1-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the PageRank visualization page
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.animateBtnSelector = '#animate-btn';
    this.svgSelector = 'svg';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return the button locator
  animateBtn() {
    return this.page.locator(this.animateBtnSelector);
  }

  // Return locator for circle element of node i
  nodeCircle(i) {
    return this.page.locator(`#node-${i} circle.node`);
  }

  // Return locator for pagerank text element of node i
  nodePagerankText(i) {
    return this.page.locator(`#node-${i} text.pagerank`);
  }

  // Click animate button
  async clickAnimate() {
    await this.page.click(this.animateBtnSelector);
  }

  // Wait until animate button aria-pressed is 'true' (animation started)
  async waitForAnimationStart(timeout = 5000) {
    await this.page.waitForFunction(
      selector => document.querySelector(selector)?.getAttribute('aria-pressed') === 'true',
      this.animateBtnSelector,
      { timeout }
    );
  }

  // Wait until animate button aria-pressed is 'false' (animation ended)
  async waitForAnimationEnd(timeout = 60000) {
    await this.page.waitForFunction(
      selector => document.querySelector(selector)?.getAttribute('aria-pressed') === 'false',
      this.animateBtnSelector,
      { timeout }
    );
  }

  // Wait until animate button text contains substring (uses page textContent)
  async waitForButtonTextContains(substring, timeout = 3000) {
    await this.page.waitForFunction(
      (selector, sub) => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.includes(sub);
      },
      this.animateBtnSelector,
      substring,
      { timeout }
    );
  }
}

test.describe('PageRank Visualization - FSM states and transitions', () => {
  // Collect runtime console errors and page errors
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial Idle state (S0_Idle) and visuals', () => {
    test('should load and execute updateVisuals(p) on enter (Idle entry action)', async ({ page }) => {
      // This test validates that on page load updateVisuals(p) runs:
      // - pagerank text values are set to the initialized uniform vector (1/7 -> 0.143)
      // - node circle radii are set to the expected minRadius (since uniform values -> equal radii)
      // - no runtime console or page errors occurred during initialization
      const prPage = new PageRankPage(page);

      await prPage.goto();

      // Wait for SVG to be present and for updateVisuals to have applied (poll)
      await page.waitForSelector('svg');

      // The script initializes p uniformly and calls updateVisuals(p).
      // With 7 nodes the value is 1/7 => 0.142857... formatted to 3 decimals => '0.143'
      for (let i = 0; i < 7; i++) {
        const text = await prPage.nodePagerankText(i).textContent();
        expect(text.trim()).toBe('0.143');
      }

      // Since all values are equal, updateVisuals uses rangePR = 0 => fallback to 1
      // and sets radius to minRadius (29), formatted to one decimal place -> '29.0'
      for (let i = 0; i < 7; i++) {
        const r = await prPage.nodeCircle(i).getAttribute('r');
        expect(r).toBe('29.0');
      }

      // Check circle style filter was updated to include drop-shadow (visual glow)
      const style = await prPage.nodeCircle(0).getAttribute('style');
      expect(style).toBeTruthy();
      expect(style).toContain('drop-shadow(');

      // Verify link positions were adjusted: each line.link should have x1,y1,x2,y2 attributes
      const lines = await page.$$eval('line.link', nodes =>
        nodes.map(n => ({
          x1: n.getAttribute('x1'),
          y1: n.getAttribute('y1'),
          x2: n.getAttribute('x2'),
          y2: n.getAttribute('y2'),
        }))
      );
      // Ensure every line has numeric coordinates (non-null and not empty)
      for (const l of lines) {
        expect(l.x1).toBeTruthy();
        expect(l.y1).toBeTruthy();
        expect(l.x2).toBeTruthy();
        expect(l.y2).toBeTruthy();
      }

      // Ensure arrowhead marker exists and lines have marker-end attribute
      const hasMarker = await page.$eval('svg defs marker#arrowhead', () => true).catch(() => false);
      expect(hasMarker).toBeTruthy();
      const someLineHasMarker = await page.$eval('line.link', l => !!l.getAttribute('marker-end'));
      expect(someLineHasMarker).toBeTruthy();

      // Confirm there were no console errors or page errors during load
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Animating state (S1_Animating) and transitions', () => {
    test('clicking Animate Iterations transitions Idle -> Animating (aria-pressed true and button text change)', async ({ page }) => {
      // This test validates the transition from Idle to Animating on button click.
      // It asserts the animate button's aria-pressed toggles to true and the text updates.
      const prPage = new PageRankPage(page);

      await prPage.goto();
      await page.waitForSelector(prPage.animateBtnSelector);

      // Precondition: button should be in Idle state
      const initialAria = await prPage.animateBtn().getAttribute('aria-pressed');
      expect(initialAria).toBe('false');
      const initialText = (await prPage.animateBtn().textContent()).trim();
      expect(initialText).toBe('Animate Iterations');

      // Click the button to start animation
      await prPage.clickAnimate();

      // Wait for start indication (aria-pressed -> 'true') and text containing 'Animating'
      await prPage.waitForAnimationStart(5000);
      await prPage.waitForButtonTextContains('Animating', 3000);

      const ariaDuring = await prPage.animateBtn().getAttribute('aria-pressed');
      expect(ariaDuring).toBe('true');
      const textDuring = (await prPage.animateBtn().textContent()).trim();
      // The implementation uses the ellipsis char '…' so we check substring presence
      expect(textDuring).toContain('Animating');

      // Also ensure no console errors have occurred by this time
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('clicking Animate while already animating does not start a concurrent animation (idempotent click)', async ({ page }) => {
      // This test verifies that additional clicks while animating are ignored per implementation.
      // It triggers animation, attempts a rapid second click, and asserts the button stays in animating state.
      const prPage = new PageRankPage(page);

      await prPage.goto();
      await page.waitForSelector(prPage.animateBtnSelector);

      // Start animation
      await prPage.clickAnimate();
      await prPage.waitForAnimationStart(5000);

      // Try clicking again rapidly
      await prPage.clickAnimate();

      // Short delay to allow any unexpected behavior to surface
      await page.waitForTimeout(300);

      // Button should still indicate animating
      const ariaDuring = await prPage.animateBtn().getAttribute('aria-pressed');
      expect(ariaDuring).toBe('true');
      const textDuring = (await prPage.animateBtn().textContent()).trim();
      expect(textDuring).toContain('Animating');

      // No console or page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Let animation finish (may take time). Increase timeout for this test explicitly.
      test.setTimeout(90000);
      await prPage.waitForAnimationEnd(60000);

      // After completion, the button should return to Idle text and aria-pressed false
      const ariaAfter = await prPage.animateBtn().getAttribute('aria-pressed');
      expect(ariaAfter).toBe('false');
      const textAfter = (await prPage.animateBtn().textContent()).trim();
      expect(textAfter).toBe('Animate Iterations');

      // Confirm no runtime errors throughout
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('full animate flow ends and updates node visuals to converged PageRank values', async ({ page }) => {
      // This test covers the exit actions for S1_Animating -> S0_Idle:
      // - After animation completes, the button should have aria-pressed 'false' and original label restored.
      // - PageRank texts should reflect a final numeric value formatted to 3 decimals.
      const prPage = new PageRankPage(page);

      // Allow more time for a full animation to finish if needed
      test.setTimeout(90000);

      await prPage.goto();
      await page.waitForSelector(prPage.animateBtnSelector);

      // Start animation
      await prPage.clickAnimate();
      await prPage.waitForAnimationStart(5000);

      // Wait for animation to conclude (S1 -> S0)
      await prPage.waitForAnimationEnd(70000);

      // Verify button returned to Idle state
      const ariaAfter = await prPage.animateBtn().getAttribute('aria-pressed');
      expect(ariaAfter).toBe('false');
      const btnText = (await prPage.animateBtn().textContent()).trim();
      expect(btnText).toBe('Animate Iterations');

      // Verify pagerank texts are numeric strings with 3 decimals (e.g., '0.143', '0.220', etc.)
      for (let i = 0; i < 7; i++) {
        const txt = (await prPage.nodePagerankText(i).textContent()).trim();
        // Should match '0.' followed by 3 digits (simple validation)
        expect(txt).toMatch(/^0\.\d{3}$/);
      }

      // Verify radii reflect potentially different values (not all equal)
      const radii = [];
      for (let i = 0; i < 7; i++) {
        const r = await prPage.nodeCircle(i).getAttribute('r');
        radii.push(parseFloat(r));
      }
      // At least one radius should differ from 29.0 if algorithm caused redistribution
      const allSame = radii.every(val => Math.abs(val - radii[0]) < 1e-6);
      expect(allSame).toBe(false);

      // Confirm no runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Accessibility, focus interactions, and edge visuals', () => {
    test('focusing a node adds highlighted class to its circle and blurring removes it', async ({ page }) => {
      // This test validates accessibility-focused visual feedback: focus -> highlighted class toggled.
      const prPage = new PageRankPage(page);

      await prPage.goto();
      await page.waitForSelector('svg');

      // Focus node-2 (C)
      await page.focus('#node-2');
      // small delay to allow event handlers to run
      await page.waitForTimeout(200);

      // Circle under node-2 should have 'highlighted' class
      const hasHighlighted = await prPage.nodeCircle(2).evaluate(el => el.classList.contains('highlighted'));
      expect(hasHighlighted).toBe(true);

      // Blur the focused element by focusing body
      await page.focus('body');
      await page.waitForTimeout(100);
      const stillHighlighted = await prPage.nodeCircle(2).evaluate(el => el.classList.contains('highlighted'));
      expect(stillHighlighted).toBe(false);

      // No console or page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('link markers are present and link attributes are valid (visual integrity)', async ({ page }) => {
      // Verifies arrow markers exist and lines reference the marker; verifies attributes like data-from/data-to exist.
      const prPage = new PageRankPage(page);
      await prPage.goto();
      await page.waitForSelector('svg');

      // Verify each link has data-from and data-to and a marker-end attribute
      const links = await page.$$eval('line.link', nodes =>
        nodes.map(n => ({
          from: n.getAttribute('data-from'),
          to: n.getAttribute('data-to'),
          markerEnd: n.getAttribute('marker-end'),
        }))
      );

      expect(links.length).toBeGreaterThan(0);
      for (const l of links) {
        expect(l.from).toBeTruthy();
        expect(l.to).toBeTruthy();
        expect(l.markerEnd).toBeTruthy();
        // marker-end should reference '#arrowhead' in URL syntax; allow both url(#arrowhead) and url(#arrowhead)
        expect(l.markerEnd).toContain('arrowhead');
      }

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and robustness checks', () => {
    test('should not produce console errors or page errors during typical interactions', async ({ page }) => {
      // This test runs a series of interactions and asserts no runtime errors were emitted.
      const prPage = new PageRankPage(page);

      await prPage.goto();

      // Interactions: focus a node, start animation and stop when done
      await page.focus('#node-1');
      await page.waitForTimeout(100);
      await prPage.clickAnimate();
      await prPage.waitForAnimationStart(5000);

      // Try focusing another node while animating
      await page.focus('#node-4');
      await page.waitForTimeout(100);

      // Wait for animation end (allow generous timeout)
      test.setTimeout(90000);
      await prPage.waitForAnimationEnd(70000);

      // Check collected errors arrays
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});