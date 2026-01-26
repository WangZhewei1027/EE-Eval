import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8372760-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the small demo area and controls.
// Encapsulates common selectors and interactions for clarity.
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleSelector = '#toggleDemo';
    this.demoAreaSelector = '#demoArea';
    this.demoTableBodySelector = '#demoTable';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main content to be present
    await this.page.waitForSelector('main[role="main"]');
  }

  async toggleButton() {
    return this.page.locator(this.toggleSelector);
  }

  async demoArea() {
    return this.page.locator(this.demoAreaSelector);
  }

  async demoTableBody() {
    return this.page.locator(this.demoTableBodySelector);
  }

  async isDemoVisible() {
    // Check computed style for display
    return await this.page.$eval(this.demoAreaSelector, el => {
      // If style attribute absent, compute style
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none';
    });
  }

  async ariaExpanded() {
    return await this.page.getAttribute(this.toggleSelector, 'aria-expanded');
  }

  async ariaControls() {
    return await this.page.getAttribute(this.toggleSelector, 'aria-controls');
  }

  async clickToggle() {
    await this.page.click(this.toggleSelector);
  }

  async tableRowCount() {
    return await this.page.$$eval(`${this.demoTableBodySelector} tr`, rows => rows.length);
  }

  // Returns an array of rows, each is array of cell textContent
  async tableRows() {
    return await this.page.$$eval(`${this.demoTableBodySelector} tr`, rows =>
      rows.map(r => Array.from(r.children).map(td => td.textContent.trim()))
    );
  }
}

test.describe('Big-Omega Demo - FSM state and transitions (d8372760-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // We'll capture console messages and page errors to observe runtime issues.
  // These are initialized per-test in beforeEach and detached in afterEach.
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    consoleHandler = msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };
    pageErrorHandler = err => {
      // err is an Error object (uncaught exception on the page)
      pageErrors.push(err);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);
  });

  test.afterEach(async ({ page }) => {
    // detach handlers to avoid cross-test leakage
    if (consoleHandler) page.off('console', consoleHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);
  });

  test('Initial state S0_Idle: page renders, demo hidden, toggle button present and accessible', async ({ page }) => {
    // Arrange
    const demo = new DemoPage(page);

    // Act
    await demo.goto();

    // Assert: main content loaded
    await expect(page.locator('h1#title')).toHaveText(/Big-Omega \(Ω\) Notation/);

    // Assert: toggle button exists and has expected attributes in Idle state
    const toggle = await demo.toggleButton();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-controls', 'demoArea');
    await expect(toggle).toHaveAttribute('class', /demo/);

    // The FSM evidence expects aria-expanded="false" initially
    const ariaExpanded = await demo.ariaExpanded();
    expect(ariaExpanded).toBe('false');

    // The demo area should be hidden (inline style display:none)
    const demoArea = await demo.demoArea();
    await expect(demoArea).toBeHidden();

    // The FSM mentioned an on-enter action 'renderPage()' in S0_Idle.
    // Verify whether a global function named renderPage exists (we do not modify page).
    // This confirms whether that entry action was implemented or not.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
    // We assert that it is either undefined or defined; here we are verifying and logging.
    // Prefer to assert it is not required for the demo: the implementation below does not define it.
    expect(hasRenderPage).toBe(false);

    // Verify there were no console errors or uncaught page errors during initial load.
    // This validates that loading the page as-is does not throw runtime exceptions.
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${pageErrors.map(e => String(e))}`).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible via ToggleDemo: button click shows demo and populates table', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Precondition: demo hidden and table empty
    await expect(demo.demoArea()).toBeHidden();
    const initialRowCount = await demo.tableRowCount();
    expect(initialRowCount).toBe(0);

    // Act: click toggle to show demo (trigger ToggleDemo)
    await demo.clickToggle();

    // Assert: aria-expanded toggled to true and demo area is visible
    const ariaAfter = await demo.ariaExpanded();
    expect(ariaAfter).toBe('true');
    await expect(demo.demoArea()).toBeVisible();
    const visibleFlag = await demo.isDemoVisible();
    expect(visibleFlag).toBe(true);

    // The implementation populates rows for n=2..20 => 19 rows
    const rowCount = await demo.tableRowCount();
    expect(rowCount).toBe(19);

    // Inspect first and last row contents for correctness
    const rows = await demo.tableRows();
    // first row corresponds to n=2
    expect(rows[0][0]).toBe('2'); // n
    expect(rows[0][1]).toBe('2'); // n (again as f(n))
    // check log2(n) is provided and ratio is numeric-looking
    const log2First = parseFloat(rows[0][2]);
    const ratioFirst = parseFloat(rows[0][3]);
    expect(Number.isFinite(log2First)).toBe(true);
    expect(Number.isFinite(ratioFirst)).toBe(true);
    expect(ratioFirst).toBeGreaterThan(0);

    // last row corresponds to n=20
    const last = rows[rows.length - 1];
    expect(last[0]).toBe('20');
    expect(last[1]).toBe('20');
    const log2Last = parseFloat(last[2]);
    const ratioLast = parseFloat(last[3]);
    expect(Number.isFinite(log2Last)).toBe(true);
    expect(Number.isFinite(ratioLast)).toBe(true);
    expect(ratioLast).toBeGreaterThan(0);

    // Verify that the table is aria-live polite (the markup includes it on the table)
    const table = page.locator('table[aria-live="polite"]');
    await expect(table).toBeVisible();

    // Ensure no console errors or page errors were emitted during the interaction
    expect(consoleErrors.length, `console errors after show: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after show: ${pageErrors.map(e => String(e))}`).toBe(0);
  });

  test('Transition S1_DemoVisible -> S0_Idle via ToggleDemo: hiding the demo returns to Idle', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Show first
    await demo.clickToggle();
    await expect(demo.demoArea()).toBeVisible();

    // Act: click again to hide
    await demo.clickToggle();

    // Assert: aria-expanded toggled back to false and demo area is hidden
    const ariaAfterHide = await demo.ariaExpanded();
    expect(ariaAfterHide).toBe('false');
    await expect(demo.demoArea()).toBeHidden();

    // The table data should remain in DOM (rows exist) but the area is hidden.
    // Confirm that rows are still present in the DOM (script does not clear them)
    const rowCount = await demo.tableRowCount();
    // The script only populates when shown and does not clear when hidden,
    // so after showing then hiding, rowCount should still be 19.
    expect(rowCount).toBe(19);

    // Ensure no errors occurred during the hide transition
    expect(consoleErrors.length, `console errors after hide: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after hide: ${pageErrors.map(e => String(e))}`).toBe(0);
  });

  test('Idempotency and re-show behavior: table is populated only once and survives hide/show cycles', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Show (first time) -> populate
    await demo.clickToggle();
    await expect(demo.demoArea()).toBeVisible();
    const populatedCount = await demo.tableRowCount();
    expect(populatedCount).toBe(19);

    // Hide
    await demo.clickToggle();
    await expect(demo.demoArea()).toBeHidden();

    // Show again: should not repopulate (total rows should remain the same)
    await demo.clickToggle();
    await expect(demo.demoArea()).toBeVisible();
    const repopulatedCount = await demo.tableRowCount();
    expect(repopulatedCount).toBe(19);

    // Validate columns unchanged (sample a middle row)
    const rows = await demo.tableRows();
    const middle = rows[8]; // arbitrary middle row
    expect(middle.length).toBe(4); // n, n, log2(n), ratio

    // No runtime errors should have been emitted during these cycles
    expect(consoleErrors.length, `console errors during cycles: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors during cycles: ${pageErrors.map(e => String(e))}`).toBe(0);
  });

  test('Rapid toggling: multiple quick clicks result in consistent toggling with no errors', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Rapidly click the toggle 5 times (odd => visible). We simulate quick user actions.
    for (let i = 0; i < 5; i++) {
      // Fire clicks without awaiting long delays to simulate speed
      await demo.clickToggle();
    }

    // 5 toggles should leave it visible (started hidden -> odd toggles => visible)
    await expect(demo.demoArea()).toBeVisible();
    const ariaAfter = await demo.ariaExpanded();
    expect(ariaAfter).toBe('true');

    // Now do 4 quick toggles -> even -> should remain visible
    for (let i = 0; i < 4; i++) {
      await demo.clickToggle();
    }
    // 5 + 4 = 9 toggles total => odd => visible
    await expect(demo.demoArea()).toBeVisible();

    // Finally, do 1 more -> even total -> hidden
    await demo.clickToggle();
    await expect(demo.demoArea()).toBeHidden();
    const ariaFinal = await demo.ariaExpanded();
    expect(ariaFinal).toBe('false');

    // Ensure no errors were generated in rapid interactions
    expect(consoleErrors.length, `console errors during rapid toggling: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors during rapid toggling: ${pageErrors.map(e => String(e))}`).toBe(0);
  });

  test('Edge cases and accessibility checks: attributes and content structure', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // The button should have accessible name equal to its text content
    const toggleText = await demo.toggleButton().then(l => l.textContent());
    expect(toggleText.trim()).toBe('Show demonstration (n vs log2 n)');

    // aria-controls should point to an existing element
    const ariaControls = await demo.ariaControls();
    expect(ariaControls).toBe('demoArea');
    const controlledNodeExists = await page.$(`#${ariaControls}`) !== null;
    expect(controlledNodeExists).toBe(true);

    // Ensure the demoArea initially has the inline style that hides it (as per FSM evidence)
    const styleAttr = await page.getAttribute('#demoArea', 'style');
    expect(styleAttr).toContain('display:none');

    // Show demo and ensure table header has expected column names
    await demo.clickToggle();
    const headerText = await page.$$eval('table thead th', ths => ths.map(t => t.textContent.trim()));
    expect(headerText).toEqual(['n', 'n', 'log2(n)', 'ratio n/log2(n)']);

    // No console/page errors seen
    expect(consoleErrors.length, `console errors in accessibility checks: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors in accessibility checks: ${pageErrors.map(e => String(e))}`).toBe(0);
  });
});