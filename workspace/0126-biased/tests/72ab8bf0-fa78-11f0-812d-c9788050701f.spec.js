import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab8bf0-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Thread Symphony app
class ThreadSymphonyPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.threadLocator = page.locator('.thread');
    this.nodeLocator = page.locator('.thread-node');
    this.infoLocator = page.locator('.thread-info');
    this.animateBtn = page.locator('#animate-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.floatingThreadLocator = page.locator('.floating-thread');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async countNodes() {
    return await this.nodeLocator.count();
  }

  async countFloatingThreads() {
    return await this.floatingThreadLocator.count();
  }

  async clickAnimate() {
    await this.animateBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async hoverNode(index = 0) {
    const count = await this.nodeLocator.count();
    if (index < 0 || index >= count) throw new Error('Node index out of range in hoverNode');
    await this.nodeLocator.nth(index).hover();
  }

  // Read inline style property for the thread element
  async getThreadInlineStyleProperty(propName) {
    return await this.page.evaluate(
      (selector, prop) => document.querySelector(selector)?.style?.getPropertyValue(prop) || document.querySelector(selector)?.style?.transform || '',
      '.thread',
      propName
    );
  }

  async getThreadInlineStyleTransform() {
    return await this.page.evaluate(() => document.querySelector('.thread')?.style?.transform || '');
  }

  async getThreadInlineStyleBackground() {
    return await this.page.evaluate(() => document.querySelector('.thread')?.style?.background || '');
  }

  async getNodeInlineTransform(index = 0) {
    return await this.page.evaluate(i => {
      const el = document.querySelectorAll('.thread-node')[i];
      return el ? el.style.transform : null;
    }, index);
  }

  async nodeHasActive(index = 0) {
    return await this.page.evaluate(i => {
      const el = document.querySelectorAll('.thread-node')[i];
      return el ? el.classList.contains('active') : false;
    }, index);
  }

  async getInfoOpacityForNode(index = 0) {
    return await this.page.evaluate(i => {
      const nodes = document.querySelectorAll('.thread-node');
      const node = nodes[i];
      if (!node) return null;
      const info = node.nextElementSibling;
      if (!info || !info.classList.contains('thread-info')) return null;
      const cs = window.getComputedStyle(info);
      return cs.opacity;
    }, index);
  }
}

test.describe('Thread Symphony - FSM and UI interactions (72ab8bf0-fa78-11f0-812d-c9788050701f)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];
  let page;
  let app;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // Create a new context/page per test to isolate console/pageerror listeners
    page = await browser.newPage();

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? String(err.message) : String(err));
    });

    // Capture console messages including errors
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    app = new ThreadSymphonyPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // ensure page closed to cleanup after each test
    await page.close();
  });

  test.describe('Initial State (S0_Idle) validations', () => {
    test('should create floating threads on DOMContentLoaded (verify count increases)', async () => {
      // Comment: Validates createFloatingThreads() entry action - initial header has 5 floating-thread elements
      // createFloatingThreads() appends 10 more, so expect >=15 total
      const count = await app.countFloatingThreads();
      expect(count).toBeGreaterThanOrEqual(15);
    });

    test('should have expected number of thread nodes present', async () => {
      // Comment: Ensure the expected thread nodes (M,1,2,R,D,N) exist in the DOM
      const nodes = await app.countNodes();
      expect(nodes).toBe(6);
    });

    test('no uncaught page errors or console errors immediately after load', async () => {
      // Comment: Observe runtime errors - the test asserts none occurred during load.
      // If the implementation had ReferenceError/SyntaxError/TypeError, they'd be captured in pageErrors or consoleErrors.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Hover Event (MouseEnterNode) and Info reveal', () => {
    test('hovering a node should add active class and reveal adjacent info (S0_Idle -> S0_Idle)', async () => {
      // Comment: Simulate hover over the 0th node (Main Thread) and verify class and info opacity
      await app.hoverNode(0);

      // Verify the node has class 'active'
      const hasActive = await app.nodeHasActive(0);
      expect(hasActive).toBe(true);

      // Verify the adjacent .thread-info becomes visible (opacity transitions to 1)
      // Allow a small time for the event handler and transition to have effect
      await page.waitForTimeout(100);
      const opacity = await app.getInfoOpacityForNode(0);
      expect(opacity).toBe('1');
    });

    test('hovering second node ensures previous active class removed and new active applied', async () => {
      // Comment: Ensure only one node is active at a time per event handler logic
      await app.hoverNode(0);
      await page.waitForTimeout(50);
      await app.hoverNode(2);
      await page.waitForTimeout(50);

      const firstActive = await app.nodeHasActive(0);
      const secondActive = await app.nodeHasActive(2);

      expect(firstActive).toBe(false);
      expect(secondActive).toBe(true);

      const infoOpacity = await app.getInfoOpacityForNode(2);
      expect(infoOpacity).toBe('1');
    });
  });

  test.describe('Animate and Reset transitions (S0_Idle <-> S1_Animating, S1_Animating -> S0_Idle)', () => {
    test('clicking Animate should scale the thread and change its background (transition to S1_Animating)', async () => {
      // Comment: Explicitly click the Animate button and inspect inline styles applied immediately.
      // Note: The page's script triggers an initial animate after 1s; this test triggers another explicit click.
      // Clear any previous style state by checking before click
      const beforeTransform = await app.getThreadInlineStyleTransform();
      const beforeBg = await app.getThreadInlineStyleBackground();

      await app.clickAnimate();

      // Immediately after click, the script sets transform and background inline styles
      const transformAfter = await app.getThreadInlineStyleTransform();
      const bgAfter = await app.getThreadInlineStyleBackground();

      // Expect the thread to be scaled up inline (scaleY(1.1))
      expect(transformAfter).toContain('scaleY(1.1)');

      // Expect background to reflect the animate gradient with the color code from FSM (#b392ac)
      expect(bgAfter.toLowerCase()).toContain('#b392ac');

      // Also verify at least one node receives a temporary scale transform shortly after click (staggered)
      // Wait for 300ms to allow the first node's setTimeout to run
      await page.waitForTimeout(350);
      const nodeTransform = await app.getNodeInlineTransform(0);
      // The animation sets node.style.transform = 'scale(1.3)' then later resets
      expect(nodeTransform).toBeDefined();
      expect(nodeTransform).toMatch(/scale\(1\.3\)|scale\(1\)/);
    });

    test('animate should eventually revert thread transform/background (onExit actions)', async () => {
      // Comment: After animate click, the application schedules revert after ~1500ms
      await app.clickAnimate();

      // Wait longer than the internal 1500ms to allow revert to run
      await page.waitForTimeout(1700);

      const transformAfter = await app.getThreadInlineStyleTransform();
      const bgAfter = await app.getThreadInlineStyleBackground();

      // After the scheduled revert, the inline transform should be reset to scaleY(1)
      // and the inline background should be the gradient using CSS variables (string match)
      expect(transformAfter).toContain('scaleY(1)');
      expect(bgAfter).toContain('var(--accent');
    });

    test('clicking Reset should immediately reset thread and nodes (S1_Animating -> S0_Idle)', async () => {
      // Comment: Ensure reset button resets the inline styles and clears active classes
      // First trigger animate to put it into animated state
      await app.clickAnimate();
      // Let some animations begin
      await page.waitForTimeout(300);

      // Now click reset
      await app.clickReset();
      await page.waitForTimeout(100);

      const transformAfterReset = await app.getThreadInlineStyleTransform();
      const bgAfterReset = await app.getThreadInlineStyleBackground();

      // Reset sets transform to scaleY(1) and background back to var(--accent)
      expect(transformAfterReset).toContain('scaleY(1)');
      expect(bgAfterReset).toContain('var(--accent');

      // Ensure all nodes have transform reset and active class removed
      const nodes = await app.countNodes();
      for (let i = 0; i < nodes; i++) {
        const nodeTransform = await app.getNodeInlineTransform(i);
        // Reset sets node.style.transform = 'scale(1)'
        expect(nodeTransform).toContain('scale(1)');
        const active = await app.nodeHasActive(i);
        expect(active).toBe(false);
      }
    });

    test('clicking Reset while idle should be idempotent and produce no errors', async () => {
      // Comment: Edge case - clicking reset when nothing is animated should not throw and should keep the UI stable
      await app.clickReset();
      await page.waitForTimeout(100);

      // Assert no page errors or console errors happened due to reset action
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // Thread should still have transform scaleY(1) inline or empty; ensure it's either not scaled up
      const transform = await app.getThreadInlineStyleTransform();
      expect(transform === '' || transform.includes('scaleY(1)')).toBeTruthy();
    });
  });

  test.describe('Observability: Console and pageerror monitoring (edge/error scenarios)', () => {
    test('should not produce uncaught ReferenceError/SyntaxError/TypeError during interactions', async () => {
      // Comment: Interact with the page comprehensively and ensure no unexpected runtime errors get thrown
      // Perform several interactions
      await app.hoverNode(1);
      await page.waitForTimeout(50);
      await app.clickAnimate();
      await page.waitForTimeout(200);
      await app.hoverNode(4);
      await page.waitForTimeout(50);
      await app.clickReset();
      await page.waitForTimeout(50);

      // Allow any asynchronous actions or timeouts to emit errors if there are issues
      await page.waitForTimeout(800);

      // Assert that no uncaught errors were captured
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // For transparency, also assert that we observed console messages (info/debug) but none were error-level
      // At minimum, the page auto-animation may have triggered console logs in other cases; we simply assert no 'error' type messages
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
    });

    test('if any runtime errors occurred they should be visible in pageerror/console error arrays (test will fail if present)', async () => {
      // Comment: This test intentionally asserts there are zero errors; if any ReferenceError/TypeError occurred,
      // it would be captured and this assertion would fail, surfacing the problem.
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });
});