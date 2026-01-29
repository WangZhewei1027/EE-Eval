import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9a73a0-fa78-11f0-857d-d58e82d5de73.html';

// Page object for the routing visualization
class RoutingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // Collect console error messages and page errors for assertions
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null,
        });
      }
    });
    this.page.on('pageerror', (err) => {
      // pageerror will generally be Error objects
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure script initialization has run by waiting for nodes to be present
    await this.page.waitForSelector('.node');
  }

  // click Next button
  async clickNext(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.page.click('#nextBtn');
      // Wait a small amount for transitions / DOM updates (CSS transitions are present, but dataset updates are synchronous)
      await this.page.waitForTimeout(50);
    }
  }

  // click Previous button
  async clickPrev(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.page.click('#prevBtn');
      await this.page.waitForTimeout(50);
    }
  }

  // Returns active node id as number (based on data-id attribute)
  async getActiveNodeId() {
    const locator = this.page.locator('.node[data-active="true"]');
    const count = await locator.count();
    if (count === 0) return null;
    const id = await locator.first().getAttribute('data-id');
    return id === null ? null : Number(id);
  }

  // Returns whether the node with given id has data-active="true"
  async isNodeActive(id) {
    const node = this.page.locator(`.node[data-id="${id}"]`);
    const attr = await node.getAttribute('data-active');
    return attr === 'true';
  }

  // Returns aria-current attribute value for node id
  async getNodeAriaCurrent(id) {
    const node = this.page.locator(`.node[data-id="${id}"]`);
    return node.getAttribute('aria-current');
  }

  // Check connection element classes for a given connection index
  async getConnectionClasses(index) {
    const conn = this.page.locator(`.connection`).nth(index);
    const classAttr = await conn.getAttribute('class');
    return classAttr ?? '';
  }

  // Check whether route path at index has the route-highlight class
  async routeHasHighlight(index) {
    const path = this.page.locator('path.route-path').nth(index);
    const classAttr = await path.getAttribute('class');
    return classAttr ? classAttr.split(/\s+/).includes('route-highlight') : false;
  }

  // Utility: returns collected console error messages and page errors
  getConsoleErrors() {
    return this.consoleErrors;
  }

  getPageErrors() {
    return this.pageErrors;
  }

  // Check button accessibility attributes
  async getButtonAriaLabel(selector) {
    const btn = this.page.locator(selector);
    return btn.getAttribute('aria-label');
  }

  // Get text content of node id
  async getNodeText(id) {
    return this.page.locator(`.node[data-id="${id}"]`).innerText();
  }
}

test.describe('Routing – A Visual Journey (FSM verification)', () => {
  // Use a fresh page per test to isolate event and error captures
  test('Initial state: S0_Home is active and DOM is initialized correctly', async ({ page }) => {
    const app = new RoutingPage(page);
    await app.goto();

    // Validate initial active node according to the runtime script (setActive(0) is called)
    const activeId = await app.getActiveNodeId();
    // The script initializes activeIndex to 0 and calls setActive(0)
    expect(activeId).toBe(0);

    // Confirm node markup for Home
    expect(await app.isNodeActive(0)).toBe(true);
    expect(await app.getNodeAriaCurrent(0)).toBe('page');
    expect(await app.getNodeText(0)).toMatch(/Home/i);

    // All other nodes should be inactive and have aria-current='false'
    for (let id = 1; id <= 4; id++) {
      expect(await app.isNodeActive(id)).toBe(false);
      expect(await app.getNodeAriaCurrent(id)).toBe('false');
    }

    // Connections: according to the runtime logic, when activeIndex=0, there is no connection with index -1,
    // so all connections should have been set to 'inactive' class by setActive.
    for (let i = 0; i < 4; i++) {
      const cls = await app.getConnectionClasses(i);
      expect(cls.split(/\s+/)).toContain('inactive');
      expect(cls.split(/\s+/)).not.toContain('active');
    }

    // Routes: no route should have highlight (activeIndex - 1 == -1)
    for (let i = 0; i < 4; i++) {
      expect(await app.routeHasHighlight(i)).toBe(false);
    }

    // Buttons should exist and have accessible labels
    expect(await app.getButtonAriaLabel('#prevBtn')).toBe('Active route previous');
    expect(await app.getButtonAriaLabel('#nextBtn')).toBe('Active route next');

    // Ensure no uncaught page errors or console error messages were captured during load
    expect(app.getPageErrors()).toHaveLength(0);
    expect(app.getConsoleErrors()).toHaveLength(0);
  });

  test('Forward transitions via Next button: S0 -> S1 -> S2 -> S3 -> S4 -> S0 (wrap around)', async ({ page }) => {
    const app = new RoutingPage(page);
    await app.goto();

    // We'll iterate through expected sequence of active ids after each click
    const expectedSequence = [1, 2, 3, 4, 0];
    for (let step = 0; step < expectedSequence.length; step++) {
      await app.clickNext(1);
      const expectedId = expectedSequence[step];

      // Verify the node with expectedId is active
      const activeId = await app.getActiveNodeId();
      expect(activeId).toBe(expectedId);

      // aria-current should reflect active node
      expect(await app.getNodeAriaCurrent(expectedId)).toBe('page');

      // the node text should correspond to the known labels (best-effort check)
      const labelMap = {
        0: /Home/i,
        1: /About/i,
        2: /Srvcs|Services/i,
        3: /Port|Portfolio/i,
        4: /Cont|Contact/i,
      };
      expect(await app.getNodeText(expectedId)).toMatch(labelMap[expectedId]);

      // Connections: for activeIndex > 0, connection with index activeIndex - 1 should be 'active'
      // For expectedId === 0, no connection should be active (all inactive)
      for (let i = 0; i < 4; i++) {
        const cls = await app.getConnectionClasses(i);
        const classList = cls.split(/\s+/);
        if (expectedId > 0 && i === expectedId - 1) {
          expect(classList).toContain('active');
          expect(classList).not.toContain('inactive');
        } else {
          expect(classList).toContain('inactive');
          expect(classList).not.toContain('active');
        }
      }

      // Routes: route index activeIndex - 1 should be highlighted when expectedId > 0
      for (let i = 0; i < 4; i++) {
        const has = await app.routeHasHighlight(i);
        if (expectedId > 0 && i === expectedId - 1) {
          expect(has).toBe(true);
        } else {
          expect(has).toBe(false);
        }
      }
    }

    // No runtime page errors or console errors during these interactions
    expect(app.getPageErrors()).toHaveLength(0);
    expect(app.getConsoleErrors()).toHaveLength(0);
  });

  test('Backward transitions via Previous button: S0 -> S4 -> S3 -> S2 -> S1 -> S0 (wrap around backwards)', async ({ page }) => {
    const app = new RoutingPage(page);
    await app.goto();

    // From S0, a single Previous click should wrap to S4
    await app.clickPrev(1);
    expect(await app.getActiveNodeId()).toBe(4);
    expect(await app.getNodeAriaCurrent(4)).toBe('page');

    // Connections: when activeIndex=4, connection at index 3 (4-1) should be active
    for (let i = 0; i < 4; i++) {
      const classList = (await app.getConnectionClasses(i)).split(/\s+/);
      if (i === 3) {
        expect(classList).toContain('active');
        expect(classList).not.toContain('inactive');
      } else {
        expect(classList).toContain('inactive');
      }
    }

    // Continue stepping backwards: expected sequence [3,2,1,0]
    const expectedBack = [3, 2, 1, 0];
    for (const expected of expectedBack) {
      await app.clickPrev(1);
      expect(await app.getActiveNodeId()).toBe(expected);
      expect(await app.getNodeAriaCurrent(expected)).toBe('page');

      // Connection active check
      for (let i = 0; i < 4; i++) {
        const classList = (await app.getConnectionClasses(i)).split(/\s+/);
        if (expected > 0 && i === expected - 1) {
          expect(classList).toContain('active');
          expect(classList).not.toContain('inactive');
        } else {
          // For expected === 0: no active connection, all inactive
          expect(classList).toContain('inactive');
        }
      }
    }

    // Final sanity: ensure the DOM remains stable and no unexpected errors occurred
    expect(app.getPageErrors()).toHaveLength(0);
    expect(app.getConsoleErrors()).toHaveLength(0);
  });

  test('Rapid interactions and edge cases: multiple fast clicks maintain deterministic state and wrap correctly', async ({ page }) => {
    const app = new RoutingPage(page);
    await app.goto();

    // Rapidly click Next 7 times (should cycle multiple times)
    await app.clickNext(7);
    // 0 + 7 mod 5 == 2
    expect(await app.getActiveNodeId()).toBe(2);

    // Rapidly click Prev 9 times -> 2 - 9 mod 5 => (2 - 9) = -7 mod5 = 3
    await app.clickPrev(9);
    expect(await app.getActiveNodeId()).toBe(3);

    // Verify aria-current and node attributes are consistent after rapid interactions
    for (let id = 0; id <= 4; id++) {
      const isActive = await app.isNodeActive(id);
      const aria = await app.getNodeAriaCurrent(id);
      if (isActive) {
        expect(aria).toBe('page');
      } else {
        expect(aria).toBe('false');
      }
    }

    // No uncaught runtime errors
    expect(app.getPageErrors()).toHaveLength(0);
    expect(app.getConsoleErrors()).toHaveLength(0);
  });

  test('Accessibility and semantics: nodes and controls expose expected attributes', async ({ page }) => {
    const app = new RoutingPage(page);
    await app.goto();

    // Check that nodes have aria-labels that describe them
    for (let id = 0; id <= 4; id++) {
      const node = page.locator(`.node[data-id="${id}"]`);
      const ariaLabel = await node.getAttribute('aria-label');
      expect(typeof ariaLabel).toBe('string');
      expect(ariaLabel.length).toBeGreaterThan(0);
      // Basic content check: aria-label should contain words like 'route node'
      expect(ariaLabel.toLowerCase()).toContain('route');
    }

    // Controls region has role and aria-label
    const controlsRegion = page.locator('.controls[role="region"]');
    expect(await controlsRegion.getAttribute('aria-label')).toBe('Routing navigation controls');

    // Buttons should be clickable (ensure they are not disabled)
    const prevDisabled = await page.locator('#prevBtn').getAttribute('disabled');
    const nextDisabled = await page.locator('#nextBtn').getAttribute('disabled');
    expect(prevDisabled).toBeNull();
    expect(nextDisabled).toBeNull();

    // No runtime errors during these checks
    expect(app.getPageErrors()).toHaveLength(0);
    expect(app.getConsoleErrors()).toHaveLength(0);
  });

  test('Detect unexpected runtime errors (collect console and page errors during interactions)', async ({ page }) => {
    // This test explicitly demonstrates collection of console/page errors while performing actions.
    const app = new RoutingPage(page);
    await app.goto();

    // Perform a set of interactions that exercise the UI
    await app.clickNext(2);
    await app.clickPrev(3);
    await app.clickNext(1);

    // Evaluate collected errors. The application is expected to run without ReferenceError/SyntaxError/TypeError.
    // Assert that no page errors or console errors (type=error) have been emitted.
    const pageErrors = app.getPageErrors();
    const consoleErrors = app.getConsoleErrors();

    // If any errors occurred, include their messages in the assertion failure for debugging
    expect(pageErrors, 'No uncaught page errors (window.onerror) should have occurred').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should have been emitted during interactions').toHaveLength(0);
  });
});