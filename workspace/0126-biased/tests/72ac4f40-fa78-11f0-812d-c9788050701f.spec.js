import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac4f40-fa78-11f0-812d-c9788050701f.html';

// Page Object Model for the Query Optimization Visualizer page
class QueryVisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(URL, { waitUntil: 'load' });
  }

  // Return document title
  async title() {
    return this.page.title();
  }

  // Get main header text (h1)
  async headerText() {
    return this.page.locator('h1').innerText();
  }

  // Get subtitle text
  async subtitleText() {
    return this.page.locator('.subtitle').innerText();
  }

  // Count the number of query-section blocks
  async querySectionCount() {
    return this.page.locator('.query-section').count();
  }

  // Get text of the first .section-title
  async firstSectionTitle() {
    const el = this.page.locator('.query-section').first().locator('.section-title');
    return el.innerText();
  }

  // Determine whether an unoptimized badge exists in the first query-section
  async firstSectionHasBadgeUnoptimized() {
    return this.page.locator('.query-section').first().locator('.badge-unoptimized').count().then(c => c > 0);
  }

  // Get metric values under the first query-section as an array of texts
  async firstSectionMetricValues() {
    const metrics = this.page.locator('.query-section').first().locator('.metric .metric-value');
    const n = await metrics.count();
    const results = [];
    for (let i = 0; i < n; i++) {
      results.push(await metrics.nth(i).innerText());
    }
    return results;
  }

  // Get execution plan node titles under the first query-section
  async firstSectionPlanNodeTitles() {
    const nodes = this.page.locator('.query-section').first().locator('.plan-node .plan-node-title');
    const n = await nodes.count();
    const titles = [];
    for (let i = 0; i < n; i++) {
      titles.push(await nodes.nth(i).innerText());
    }
    return titles;
  }

  // Count elements matching interactive selectors (buttons, inputs, anchors)
  async interactiveControlsCount() {
    return this.page.locator('button, input, select, textarea, a[href]').count();
  }

  // Check if renderPage is defined in page scope
  async isRenderPageDefined() {
    return this.page.evaluate(() => typeof window.renderPage !== 'undefined' && typeof window.renderPage === 'function');
  }
}

// Global test hooks to capture console and page errors for each test
test.describe('Query Optimization Visualizer - End-to-End', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset arrays
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors (from console.error and other console types)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Collect message text and location if available
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // No teardown modification of the page allowed. We simply ensure listeners do not leak.
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Idle state: page loads and displays the visual header and subtitle', async ({ page }) => {
    // This test validates the "Idle" state rendering described in the FSM: title, header and subtitle are present.
    const model = new QueryVisualizerPage(page);
    await model.goto();

    // The FSM evidence included the <title> value. Verify it matches.
    const title = await model.title();
    expect(title).toBe('Query Optimization Visualizer');

    // Verify main header text is visible and correct
    const header = await model.headerText();
    expect(header).toContain('Query Optimization Visualizer');

    // Verify subtitle text exists and is non-empty
    const subtitle = await model.subtitleText();
    expect(subtitle.length).toBeGreaterThan(10);

    // Assert that no console.error or page errors were emitted during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Visual content: Unoptimized query section, metrics, and execution plan exist and have expected values', async ({ page }) => {
    // This test checks DOM content under the "Original Query" (unoptimized) block
    const model = new QueryVisualizerPage(page);
    await model.goto();

    // There should be at least one query-section
    const sections = await model.querySectionCount();
    expect(sections).toBeGreaterThanOrEqual(1);

    // First section title should indicate "Original Query"
    const firstTitle = await model.firstSectionTitle();
    expect(firstTitle).toMatch(/Original Query/i);

    // The unoptimized badge should exist in the first section
    const hasBadge = await model.firstSectionHasBadgeUnoptimized();
    expect(hasBadge).toBe(true);

    // Performance metrics: expect known values present in the page for the unoptimized query
    const metricValues = await model.firstSectionMetricValues();
    // We expect three metrics and known textual values
    expect(metricValues.length).toBeGreaterThanOrEqual(3);
    // The first metric should contain a time like "1.24s"
    expect(metricValues[0]).toContain('1.24');
    // The second metric should contain the scanned rows count formatting
    expect(metricValues[1]).toContain('24,812');
    // The third metric should indicate "High"
    expect(metricValues[2]).toMatch(/High/i);

    // Execution plan node titles
    const planTitles = await model.firstSectionPlanNodeTitles();
    // The document includes three nodes in the first plan block
    expect(planTitles.length).toBeGreaterThanOrEqual(3);
    // Validate expected node titles exist in the array
    expect(planTitles).toEqual(expect.arrayContaining([
      expect.stringMatching(/Full Table Scan/i),
      expect.stringMatching(/Sort Operation/i)
    ]));

    // Assert again no runtime errors occurred while inspecting content
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Page contains no interactive controls (page is visual-only per FSM extraction summary)', async ({ page }) => {
    // The FSM extraction summary noted "No interactive elements or event handlers". Verify there are no interactive controls.
    const model = new QueryVisualizerPage(page);
    await model.goto();

    const interactiveCount = await model.interactiveControlsCount();
    // We expect a visual-only page; interactive controls like <button>, <input>, <a href> should be absent or minimal.
    // Accept 0 as the expected strict case.
    expect(interactiveCount).toBe(0);

    // No console/page errors on this check
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action check: verify whether renderPage() exists in global scope', async ({ page }) => {
    // FSM specified entry action "renderPage()". Here we verify whether a renderPage function exists on window.
    const model = new QueryVisualizerPage(page);
    await model.goto();

    // Evaluate whether renderPage is defined; we do NOT attempt to call it per instructions.
    const isDefined = await model.isRenderPageDefined();

    // The real page does not include JS that defines renderPage, so this should be false.
    // We assert the value and include it as a verification of the onEnter action presence/absence.
    expect(isDefined).toBe(false);

    // If the page had attempted to call renderPage but it was undefined, we would expect to see a ReferenceError captured.
    // Verify that no ReferenceError was captured; if one exists, surface details to help debug.
    const refErrors = pageErrors.filter(e => /ReferenceError/i.test(e.name) || /ReferenceError/i.test(e.message));
    expect(refErrors.length).toBe(0);
  });

  test('Console and runtime error reporting: capture any console.error or page errors and assert types', async ({ page }) => {
    // This test demonstrates observing console messages and page errors; it does not modify page behavior.
    // We capture messages during navigation and then assert expectations about them.

    const model = new QueryVisualizerPage(page);
    await model.goto();

    // If there are any page errors, ensure they are of known JS error types
    if (pageErrors.length > 0) {
      // If errors occurred, at least one should be a ReferenceError, SyntaxError, or TypeError (per instruction: let them happen naturally)
      const hasKnownJS = pageErrors.some(err => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(err.name));
      expect(hasKnownJS).toBe(true);
      // Provide additional assertions about stack/message presence
      for (const err of pageErrors) {
        expect(err.message.length).toBeGreaterThan(0);
      }
    } else {
      // No page errors: assert that the arrays are empty
      expect(pageErrors.length).toBe(0);
    }

    // For console errors, if any were logged, they should have text and location info
    if (consoleErrors.length > 0) {
      for (const c of consoleErrors) {
        expect(typeof c.text).toBe('string');
        // Location may be empty depending on browser; ensure the field exists
        expect(c).toHaveProperty('location');
      }
    } else {
      expect(consoleErrors.length).toBe(0);
    }
  });

  test('Edge case: truncated HTML should not cause fatal layout or block basic selectors', async ({ page }) => {
    // The provided HTML (as served) appears truncated in the source description. This test verifies that basic DOM queries still function without crashing.
    const model = new QueryVisualizerPage(page);
    await model.goto();

    // Try querying several common selectors to ensure no catastrophic parse error
    const selectorsToTest = [
      'header',
      '.visualization-container',
      '.comparison-grid',
      '.optimization-tips',
      'footer'
    ];

    for (const sel of selectorsToTest) {
      const count = await page.locator(sel).count();
      // At least header and visualization-container should exist; others may be absent if truncated.
      expect(typeof count).toBe('number');
    }

    // Ensure the page still has a body element and minimal text content
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);

    // Confirm no fatal page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Smoke: Validate key visual styles/classes exist for accessibility to DOM-driven styling', async ({ page }) => {
    // Validate that key CSS classes that drive the visualization exist in DOM elements (e.g., .badge-optimized, .badge-unoptimized, .plan-node)
    const model = new QueryVisualizerPage(page);
    await model.goto();

    // Check that at least one .badge-optimized or .badge-unoptimized exists
    const optimizedBadges = await page.locator('.badge-optimized').count();
    const unoptimizedBadges = await page.locator('.badge-unoptimized').count();
    expect(optimizedBadges + unoptimizedBadges).toBeGreaterThanOrEqual(1);

    // Ensure plan-node class exists and has children
    const planNodeCount = await page.locator('.plan-node').count();
    expect(planNodeCount).toBeGreaterThanOrEqual(1);

    // No runtime errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});