import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c998940-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the application to encapsulate interactions & queries
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      btnToggle: '#btn-toggle-layout',
      main: 'main',
      svg: '#connections',
      paths: '#connections path',
      tableCards: 'article.table-card',
      pkItems: '.column-item.pk',
      fkItems: '.column-item.fk'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonAriaPressed() {
    return await this.page.getAttribute(this.selectors.btnToggle, 'aria-pressed');
  }

  async getButtonText() {
    return (await this.page.textContent(this.selectors.btnToggle))?.trim();
  }

  async clickToggle() {
    await this.page.click(this.selectors.btnToggle);
  }

  async getMainFlexDirection() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return window.getComputedStyle(el).flexDirection;
    }, this.selectors.main);
  }

  async countPathElements() {
    return await this.page.$$eval(this.selectors.paths, (els) => els.length);
  }

  // Count any SVG paths (some are given a class, some are not). Use generic path selector.
  async countAllSvgPaths() {
    return await this.page.$$eval('#connections svg, #connections path', (els) => {
      // In case #connections itself is an svg element and contains path children,
      // we want to count only path elements within #connections.
      // So filter to tagName === 'path'
      return Array.from(document.querySelectorAll('#connections path')).length;
    });
  }

  async waitForPathsCountAtLeast(n, timeout = 3000) {
    await this.page.waitForFunction(
      (n) => Array.from(document.querySelectorAll('#connections path')).length >= n,
      n,
      { timeout }
    );
  }

  async getPathDs() {
    return await this.page.$$eval('#connections path', (els) => els.map((p) => p.getAttribute('d')));
  }

  async countTableCards() {
    return await this.page.$$eval(this.selectors.tableCards, (els) => els.length);
  }

  async countPKs() {
    return await this.page.$$eval(this.selectors.pkItems, (els) => els.length);
  }

  async countFKs() {
    return await this.page.$$eval(this.selectors.fkItems, (els) => els.length);
  }
}

// Group tests relating to FSM: Idle state and ToggleLayout event/transition
test.describe('Relational Database — Visual Concept (FSM validation)', () => {
  // Will capture console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console entries and page errors for assertions later
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Detach listeners to avoid cross-test contamination (Playwright auto-cleans context between tests,
    // but being explicit is clearer)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial Idle state: drawConnections runs on load and draws relationship paths', async ({ page }) => {
    // This test validates the FSM entry action drawConnections() executed on window load (Idle state entry).
    const app = new AppPage(page);
    await app.goto();

    // Wait for drawConnections to create at least 1 path (we expect 3 relations)
    await app.waitForPathsCountAtLeast(3, 5000);

    // Check expected number of table cards exists
    expect(await app.countTableCards()).toBe(4);

    // Expect 4 primary keys (one per table)
    expect(await app.countPKs()).toBe(4);

    // Expect at least 2 foreign keys (Orders.CustomerID, OrderDetails has 2)
    expect(await app.countFKs()).toBeGreaterThanOrEqual(3);

    // Validate there are 3 path elements representing the 3 relationships
    const pathCount = await app.page.$$eval('#connections path', (els) => els.length);
    expect(pathCount).toBeGreaterThanOrEqual(3);

    // Validate path "d" attributes look like cubic-bezier path commands (contain "C" or "c")
    const dAttrs = await app.getPathDs();
    expect(dAttrs.length).toBeGreaterThanOrEqual(3);
    for (const d of dAttrs) {
      expect(d).toBeTruthy();
      // Should contain an 'C' or 'c' to indicate cubic bezier was used
      expect(/C|c/.test(d)).toBe(true);
    }

    // Validate initial button state (Idle evidence)
    expect(await app.getButtonAriaPressed()).toBe('false');
    expect(await app.getButtonText()).toBe('Toggle Vertical Layout');

    // Main layout should default to row (horizontal layout)
    const flexDir = await app.getMainFlexDirection();
    expect(flexDir).toBe('row');

    // Assert there were no uncaught page errors
    expect(pageErrors.length, `Expected no page errors, got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Assert no console.error messages emitted
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages, got: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('ToggleLayout event: clicking toggle updates aria-pressed, button text, flex direction, and redraws connections', async ({ page }) => {
    // This test validates the ToggleLayout event & transition: toggles verticalLayout, updates aria-pressed, updates main flexDirection,
    // updates button label, and calls drawConnections() again (connections remain present).
    const app = new AppPage(page);
    await app.goto();

    // Ensure initial paths drawn
    await app.waitForPathsCountAtLeast(3, 5000);
    const initialPaths = await app.getPathDs();
    expect(initialPaths.length).toBeGreaterThanOrEqual(3);

    // Click toggle -> switch to vertical layout
    await app.clickToggle();

    // After click, aria-pressed should be "true"
    expect(await app.getButtonAriaPressed()).toBe('true');

    // Button text should change to "Toggle Horizontal Layout"
    expect(await app.getButtonText()).toBe('Toggle Horizontal Layout');

    // Main should have flexDirection column for vertical layout
    const flexDirAfterFirst = await app.getMainFlexDirection();
    expect(flexDirAfterFirst).toBe('column');

    // drawConnections should have been called again. Ensure paths still exist and are cubic curves.
    await app.waitForPathsCountAtLeast(3, 3000);
    const pathsAfterToggle = await app.getPathDs();
    expect(pathsAfterToggle.length).toBeGreaterThanOrEqual(3);
    for (const d of pathsAfterToggle) {
      expect(/C|c/.test(d)).toBe(true);
    }

    // Click toggle again -> back to horizontal layout
    await app.clickToggle();

    // aria-pressed back to "false"
    expect(await app.getButtonAriaPressed()).toBe('false');

    // Button text resets
    expect(await app.getButtonText()).toBe('Toggle Vertical Layout');

    // Main flexDirection back to row
    const flexDirAfterSecond = await app.getMainFlexDirection();
    expect(flexDirAfterSecond).toBe('row');

    // Paths should still be present
    await app.waitForPathsCountAtLeast(3, 3000);
    const pathsAfterSecondToggle = await app.getPathDs();
    expect(pathsAfterSecondToggle.length).toBeGreaterThanOrEqual(3);

    // No uncaught page errors from toggling
    expect(pageErrors.length, `Unexpected page errors during toggle: ${pageErrors.map(String).join('; ')}`).toBe(0);

    // No console.error messages emitted during toggles
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, `Console errors found during toggle: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Resizing viewport triggers drawConnections and maintains drawn paths (edge case)', async ({ page }) => {
    // This test validates the window resize listener triggers drawConnections and that connections persist.
    const app = new AppPage(page);
    await app.goto();

    // Ensure initial draw
    await app.waitForPathsCountAtLeast(3, 5000);
    const beforeResize = await app.getPathDs();
    expect(beforeResize.length).toBeGreaterThanOrEqual(3);

    // Resize the viewport to simulate responsive change
    await page.setViewportSize({ width: 600, height: 800 });

    // Wait a moment for resize handler to run and redraw
    await page.waitForTimeout(300);

    // After resize, paths should still exist (redraw happened)
    await app.waitForPathsCountAtLeast(3, 3000);
    const afterResize = await app.getPathDs();
    expect(afterResize.length).toBeGreaterThanOrEqual(3);

    // Ensure every path still uses cubic bezier (sanity check)
    for (const d of afterResize) {
      expect(/C|c/.test(d)).toBe(true);
    }

    // Also verify no uncaught errors from resize
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Stability under rapid toggles: repeated toggles do not produce errors and preserve connections', async ({ page }) => {
    // This test simulates repeated user clicks to ensure state toggling is stable and idempotent across multiple transitions.
    const app = new AppPage(page);
    await app.goto();

    await app.waitForPathsCountAtLeast(3, 5000);

    // Rapidly toggle 6 times
    for (let i = 0; i < 6; i++) {
      await app.clickToggle();
      // small delay to allow redraw
      await page.waitForTimeout(100);
      // ensure connections still present
      const count = await app.countAllSvgPaths();
      expect(count).toBeGreaterThanOrEqual(3);
    }

    // Final assertions: button aria-pressed should reflect even/odd toggles (6 toggles -> back to initial false)
    expect(await app.getButtonAriaPressed()).toBe('false');

    // No page errors should have occurred during rapid toggles
    expect(pageErrors.length).toBe(0);

    // No console.error messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility & DOM integrity checks: expected elements and attributes exist (evidence assertions)', async ({ page }) => {
    // This test validates evidence mentioned in the FSM: button exists with aria-pressed attribute and table articles present.
    const app = new AppPage(page);
    await app.goto();

    // Button existence and attributes
    const btn = page.locator('#btn-toggle-layout');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('title', 'Toggle layout orientation');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');

    // Four table cards exist and have aria-describedby referencing descriptions
    const tables = page.locator('article.table-card');
    await expect(tables).toHaveCount(4);

    // Each table should have a tabindex and an aria-describedby
    const tableHandles = await page.$$('article.table-card');
    for (const t of tableHandles) {
      const tabindex = await t.getAttribute('tabindex');
      const described = await t.getAttribute('aria-describedby');
      expect(tabindex).not.toBeNull();
      expect(described).not.toBeNull();
    }

    // Ensure visually-hidden descriptions exist per table
    await expect(page.locator('#desc-customers')).toBeVisible({ timeout: 2000 }); // visible to assistive tech but visually hidden
    await expect(page.locator('#desc-orders')).toBeVisible();
    await expect(page.locator('#desc-products')).toBeVisible();
    await expect(page.locator('#desc-orderdetails')).toBeVisible();

    // No runtime errors during these checks
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});