import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c967c03-fa78-11f0-857d-d58e82d5de73.html';

// Page object encapsulating interactions and queries for the Trie visualization page
class TriePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleErrors = [];
  }

  // Initialize listeners to capture runtime errors and console error messages
  async initListeners() {
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
  }

  // Navigate to the app and wait for initial render
  async goto() {
    await this.page.goto(APP_URL);
    // Wait until the svg element is present in DOM
    await this.page.waitForSelector('#trie-container svg', { timeout: 5000 });
    // Give a small time for initial animations/intervals to start
    await this.page.waitForTimeout(250);
  }

  // Get references to control elements
  toggleAnimationLocator() {
    return this.page.locator('#toggleAnimation');
  }
  highlightLeavesLocator() {
    return this.page.locator('#highlightLeaves');
  }
  tooltipLocator() {
    return this.page.locator('#tooltip');
  }
  svgLocator() {
    return this.page.locator('#trie-container svg');
  }

  // Get number of rendered node groups (g.node-group)
  async getNodeGroupCount() {
    return await this.page.evaluate(() => {
      const svg = document.querySelector('#trie-container svg');
      if (!svg) return 0;
      return svg.querySelectorAll('g.node-group').length;
    });
  }

  // Return first N node group's text content array
  async getNodeTexts() {
    return await this.page.evaluate(() => {
      const svg = document.querySelector('#trie-container svg');
      if (!svg) return [];
      return Array.from(svg.querySelectorAll('g.node-group')).map(g => {
        const t = g.querySelector('text.node-text');
        return t ? t.textContent.trim() : '';
      });
    });
  }

  // Return details of the first circle element for assertions (inline style and classes)
  async getFirstCircleInfo() {
    return await this.page.evaluate(() => {
      const c = document.querySelector('#trie-container svg circle.node-circle');
      if (!c) return null;
      return {
        classList: Array.from(c.classList),
        inlineStyle: c.getAttribute('style') || '',
        computedFill: window.getComputedStyle(c).getPropertyValue('fill'),
        computedFilter: window.getComputedStyle(c).getPropertyValue('filter'),
      };
    });
  }

  // Return inline styles of leaf circles (circle.node-leaf)
  async getLeafCirclesInlineStyles() {
    return await this.page.evaluate(() => {
      const svg = document.querySelector('#trie-container svg');
      if (!svg) return [];
      return Array.from(svg.querySelectorAll('circle.node-leaf')).map(c => ({
        inlineStyle: c.getAttribute('style') || '',
        classList: Array.from(c.classList),
        computedFill: window.getComputedStyle(c).getPropertyValue('fill'),
      }));
    });
  }

  // Click toggle animation button
  async clickToggleAnimation() {
    await this.toggleAnimationLocator().click();
    // allow DOM updates (start/stop animation)
    await this.page.waitForTimeout(100);
  }

  // Click highlight leaves button
  async clickHighlightLeaves() {
    await this.highlightLeavesLocator().click();
    // allow DOM updates
    await this.page.waitForTimeout(100);
  }

  // Hover over a node-group by index (0-based)
  async hoverNodeGroupAt(index = 0) {
    const groupHandle = await this.page.$(`#trie-container svg g.node-group:nth-of-type(${index + 1})`);
    if (!groupHandle) throw new Error('Node group not found for hover');
    await groupHandle.hover();
    // allow tooltip handlers to run and position update via mousemove handler (small timeout)
    await this.page.waitForTimeout(120);
  }

  // Access captured page errors
  getPageErrors() {
    return this.pageErrors;
  }
  getConsoleErrors() {
    return this.consoleErrors;
  }
}

// Group tests
test.describe('Trie Data Structure – Visual Journey (FSM-driven tests)', () => {
  let trie;

  test.beforeEach(async ({ page }) => {
    trie = new TriePage(page);
    await trie.initListeners();
    await trie.goto();
  });

  test.afterEach(async ({ page }) => {
    // no explicit teardown required; Playwright closes page automatically between tests in many setups
    // but keep a tiny pause for intervals to clear if any
    await page.waitForTimeout(50);
  });

  // Validate S0_Idle: resetTrie() should run on load and produce DOM nodes
  test('Initial state: resetTrie() creates SVG nodes and links (S0_Idle evidence)', async ({ page }) => {
    // This test validates that the initial entry action resetTrie() was executed by checking presence of nodes
    const nodeCount = await trie.getNodeGroupCount();
    expect(nodeCount).toBeGreaterThan(0);
    // Also assert svg exists and contains circle elements
    const firstCircleInfo = await trie.getFirstCircleInfo();
    expect(firstCircleInfo).not.toBeNull();
    expect(firstCircleInfo.classList).toContain('node-circle');
    // Ensure no unhandled page errors were captured during initial load
    expect(trie.getPageErrors().length).toBe(0);
  });

  test.describe('Animation toggle (S1_AnimationActive <-> S2_AnimationPaused transitions)', () => {
    // S1_AnimationActive entry invokes startAnimation(), S2_AnimationPaused entry invokes stopAnimation()

    test('Toggle animation: clicking toggleAnimation transitions to paused and stops animations (S1 -> S2)', async ({ page }) => {
      // Click to toggle animation (initial script has animationActive true, button click toggles)
      const toggleBtn = trie.toggleAnimationLocator();
      // Capture initial button text
      const beforeText = await toggleBtn.innerText();
      await trie.clickToggleAnimation();

      // After clicking, the button text should reflect paused state ("Play Animation")
      const afterText = await toggleBtn.innerText();
      expect(afterText.toLowerCase()).toContain('play'); // expecting "Play Animation"

      // stopAnimation() should clear inline filter styles for circles and reset transforms
      const firstCircle = await trie.getFirstCircleInfo();
      // The implementation clears filter style inline; check inline style does not contain a 'drop-shadow' entry
      expect(firstCircle.inlineStyle).not.toMatch(/drop-shadow/i);

      // text opacity should be reset to 1 (stopAnimation sets n.text.style.opacity = 1)
      // find first text node content and ensure style opacity is either empty or "1"
      const firstTextOpacity = await page.evaluate(() => {
        const t = document.querySelector('#trie-container svg g.node-group text.node-text');
        return t ? (t.getAttribute('style') || '') : '';
      });
      expect(firstTextOpacity === '' || firstTextOpacity.includes('opacity: 1')).toBeTruthy();

      // No unhandled page errors occurred during toggle
      expect(trie.getPageErrors().length).toBe(0);
    });

    test('Toggle animation twice: pause then resume (S2 -> S1) starts animation loop', async ({ page }) => {
      // Pause first (to ensure a known starting point)
      await trie.clickToggleAnimation();
      // Now click again to resume
      await trie.clickToggleAnimation();

      // Button text should indicate paused state when animation is active => "Pause Animation"
      const toggleBtn = trie.toggleAnimationLocator();
      const txt = await toggleBtn.innerText();
      expect(txt.toLowerCase()).toContain('pause');

      // Wait enough time for one animation tick (interval set to 1300ms in app)
      await page.waitForTimeout(1400);

      // Now at least one node should have inline styles applied by animation (filter or transform)
      const anyAnimated = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('#trie-container svg g.node-group'));
        return nodes.some(g => {
          const circle = g.querySelector('circle.node-circle');
          if (circle && circle.getAttribute('style')) {
            return /drop-shadow/i.test(circle.getAttribute('style'));
          }
          const style = g.getAttribute('style') || '';
          return /transform/i.test(style) && /scale\(/i.test(style);
        });
      });
      expect(anyAnimated).toBeTruthy();

      // No console errors were emitted while starting animation
      expect(trie.getConsoleErrors().length).toBe(0);
      expect(trie.getPageErrors().length).toBe(0);
    });

    test('Rapid toggling of animation button does not produce unhandled exceptions (edge case)', async ({ page }) => {
      // Rapidly click the toggle several times
      const toggleBtn = trie.toggleAnimationLocator();
      for (let i = 0; i < 6; i++) {
        await toggleBtn.click();
      }
      // Allow any pending handlers to run
      await page.waitForTimeout(300);

      // Ensure there are no unhandled page errors after rapid interactions
      expect(trie.getPageErrors().length).toBe(0);
      // Console error messages also should be empty
      expect(trie.getConsoleErrors().length).toBe(0);
    });
  });

  test.describe('Highlight leaves (S3_LeavesHighlighted <-> S4_LeavesUnhighlighted transitions)', () => {
    test('Click highlightLeaves toggles leaf styles to highlighted (S4 -> S3)', async ({ page }) => {
      // Initially leavesHighlighted is false; clicking should highlight leaves and set aria-pressed true
      const highlightBtn = trie.highlightLeavesLocator();
      const beforeAttr = await highlightBtn.getAttribute('aria-pressed');
      await trie.clickHighlightLeaves();

      const afterAttr = await highlightBtn.getAttribute('aria-pressed');
      expect(afterAttr).toBe('true');

      // All leaf circles should have inline fill set to var(--accent-primary)
      const leafStyles = await trie.getLeafCirclesInlineStyles();
      // There should be at least one leaf
      expect(leafStyles.length).toBeGreaterThan(0);
      // Every leaf inline style must include the accented fill set by JS
      const allHighlighted = leafStyles.every(ls => /fill:\s*var\(--accent-primary\)/i.test(ls.inlineStyle));
      expect(allHighlighted).toBeTruthy();

      // Button text should have changed to "Unhighlight Leaves"
      const text = await highlightBtn.innerText();
      expect(text.toLowerCase()).toContain('unhighlight');

      // No page errors produced
      expect(trie.getPageErrors().length).toBe(0);
    });

    test('Click highlightLeaves again toggles leaves back to unhighlighted (S3 -> S4)', async ({ page }) => {
      // Toggle twice to return to previous state
      await trie.clickHighlightLeaves(); // highlight
      await trie.clickHighlightLeaves(); // unhighlight

      const highlightBtn = trie.highlightLeavesLocator();
      const afterAttr = await highlightBtn.getAttribute('aria-pressed');
      expect(afterAttr).toBe('false');

      // Now each leaf inline style should be set back to var(--accent-secondary) by JS
      const leafStyles = await trie.getLeafCirclesInlineStyles();
      const allUnhighlighted = leafStyles.every(ls => /fill:\s*var\(--accent-secondary\)/i.test(ls.inlineStyle));
      expect(allUnhighlighted).toBeTruthy();

      // Button text should include "Highlight Leaves" again
      const text = await highlightBtn.innerText();
      expect(text.toLowerCase()).toContain('highlight');

      // Confirm no runtime errors
      expect(trie.getPageErrors().length).toBe(0);
    });

    test('Rapid toggling of highlight leaves button is stable (edge case)', async ({ page }) => {
      const highlightBtn = trie.highlightLeavesLocator();
      for (let i = 0; i < 8; i++) {
        await highlightBtn.click();
      }
      await page.waitForTimeout(200);

      // Ensure no unhandled exceptions in page
      expect(trie.getPageErrors().length).toBe(0);
      expect(trie.getConsoleErrors().length).toBe(0);
    });
  });

  test.describe('Tooltip interactions and accessibility checks', () => {
    test('Hovering a node shows tooltip with correct aria-hidden and content', async ({ page }) => {
      // Hover the first node group to trigger tooltip
      await trie.hoverNodeGroupAt(0);

      // Tooltip should be visible (aria-hidden=false and opacity 1)
      const tooltip = trie.tooltipLocator();
      await expect(tooltip).toBeVisible();
      const ariaHidden = await tooltip.getAttribute('aria-hidden');
      expect(ariaHidden).toBe('false');

      // Tooltip text should indicate node label (ends with "node")
      const text = await tooltip.textContent();
      expect(text).toBeTruthy();
      expect(text.trim().toLowerCase()).toMatch(/[A-Z]*\s*node/i);

      // Move mouse away to hide tooltip and verify aria-hidden toggles back to true
      await page.mouse.move(0, 0);
      await page.waitForTimeout(120);
      const ariaHiddenAfter = await tooltip.getAttribute('aria-hidden');
      expect(ariaHiddenAfter).toBe('true');

      // No page errors
      expect(trie.getPageErrors().length).toBe(0);
    });
  });

  test.describe('FSM coverage summary and error observation', () => {
    test('All FSM events (ToggleAnimation, HighlightLeaves) are exercized and no unexpected runtime errors', async ({ page }) => {
      // Exercise ToggleAnimation
      await trie.clickToggleAnimation();
      await trie.clickToggleAnimation();

      // Exercise HighlightLeaves
      await trie.clickHighlightLeaves();
      await trie.clickHighlightLeaves();

      // Sanity check: node groups still present
      const nodeCount = await trie.getNodeGroupCount();
      expect(nodeCount).toBeGreaterThan(0);

      // Assert that no uncaught page errors were observed during the above interactions
      const pageErrors = trie.getPageErrors();
      const consoleErrors = trie.getConsoleErrors();

      // In the context of these tests we expect the app to be robust: assert zero page errors and console errors.
      // If the app naturally produces runtime exceptions, then this assertion will surface them for diagnosis.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});