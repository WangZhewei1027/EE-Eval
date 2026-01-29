import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b05c73-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the Graph Explanation page.
 * Encapsulates interactions and collects console/page errors for assertions.
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and uncaught page errors.
    this.page.on('console', msg => {
      try {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // Defensive: in rare cases msg.text() can throw; capture minimal info.
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    this.page.on('pageerror', err => {
      // Collect Error objects (uncaught exceptions on the page).
      this.pageErrors.push(err);
    });
  }

  // Navigate to the page. Listeners are already attached in constructor.
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return the button element handle for further assertions if needed.
  async getExploreButton() {
    return this.page.locator('#graph-button');
  }

  // Return the button text content.
  async getExploreButtonText() {
    const btn = await this.getExploreButton();
    return await btn.textContent();
  }

  // Click the explore button.
  async clickExplore() {
    await this.page.click('#graph-button');
  }

  // Wait for a single pageerror event and return it.
  async waitForPageError(timeout = 2000) {
    const err = await this.page.waitForEvent('pageerror', { timeout });
    // ensure it's tracked in the array as well (the listener also pushes it, but ensure coverage)
    this.pageErrors.push(err);
    return err;
  }

  // Wait for N pageerror events and return them as an array.
  async waitForMultiplePageErrors(n = 1, timeout = 2000) {
    const errs = [];
    for (let i = 0; i < n; i++) {
      const e = await this.page.waitForEvent('pageerror', { timeout });
      errs.push(e);
      this.pageErrors.push(e);
    }
    return errs;
  }

  // Convenience: get all console texts.
  getConsoleTexts() {
    return this.consoleMessages.map(m => m.text);
  }
}

/**
 * Test suite validating the FSM states and transitions for the Graph Explanation page.
 *
 * Notes:
 * - The application attempts to call "new Graph(...)" which is not defined in the provided HTML.
 *   According to requirements, we must let this ReferenceError occur naturally and assert that it happens.
 * - We validate the Idle state (presence of the button), the transition when clicking the button,
 *   and the error behavior that indicates an attempted graph generation.
 */
test.describe('Graph (Directed) Explanation - FSM tests', () => {
  // Use a per-test GraphPage instance. Attach listeners before navigation in each test.
  let gp;

  test.beforeEach(async ({ page }) => {
    gp = new GraphPage(page);
    // Navigate to the page (listeners already attached).
    await gp.goto();
  });

  test.afterEach(async ({ page }) => {
    // Clear page state if needed. Close any leftover dialogs/popups by reloading to a blank page.
    // This is defensive; not modifying the app behavior.
    await page.evaluate(() => {});
  });

  test('S0_Idle: Page loads and renders the Explore button (renderPage entry action implied)', async () => {
    // Validate Idle state: the Explore button should be present and visible.
    const btn = await gp.getExploreButton();
    await expect(btn).toBeVisible();
    const text = await gp.getExploreButtonText();
    // Verify the button text matches expected FSM evidence.
    expect(text && text.trim()).toBe('Explore a Simple Directed Graph');

    // There should be no uncaught page errors on initial load (script that causes error runs on click).
    expect(gp.pageErrors.length).toBe(0);

    // Console should contain no messages related to a generated graph on initial load.
    const consoleTexts = gp.getConsoleTexts();
    const suspicious = consoleTexts.filter(t => /nodes|edges|Graph|A,|B,|C,|D/.test(t));
    expect(suspicious.length).toBe(0);
  });

  test('Transition ExploreGraph_Click -> S1_GraphExplored: clicking triggers attempted graph generation and results in ReferenceError', async () => {
    // This test asserts the transition from Idle to Graph Explored.
    // The implementation calls new Graph(...) which is undefined -> expect a ReferenceError.
    // Attach an explicit wait for the pageerror event while clicking.
    const waitErr = gp.page.waitForEvent('pageerror');

    // Perform the user action: click the graph button.
    await gp.clickExplore();

    // Wait for the uncaught page error to surface.
    const err = await waitErr;
    // The pageerror should be a ReferenceError about Graph not being defined.
    expect(err).toBeTruthy();
    expect(err.message).toMatch(/Graph is not defined|ReferenceError/i);

    // Ensure our listener also captured the error in gp.pageErrors.
    expect(gp.pageErrors.length).toBeGreaterThanOrEqual(1);
    const firstMsg = gp.pageErrors[0].message || '';
    expect(firstMsg).toMatch(/Graph is not defined|ReferenceError/i);

    // Verify that the console did not successfully log a graph object (console.log(graph) should not have run).
    const consoleTexts = gp.getConsoleTexts();
    // If console.log(graph) had executed with a valid graph, we'd expect strings like "nodes" or "edges" or node names.
    const hadGraphLikeOutput = consoleTexts.some(t => /nodes|edges|A|B|C|D/.test(t));
    expect(hadGraphLikeOutput).toBe(false);
  });

  test('Edge case: multiple clicks produce repeated ReferenceErrors (idempotent failure behavior)', async () => {
    // Validate behavior when user clicks the button multiple times.
    // We expect each click to attempt new Graph(...) and thus produce another ReferenceError.
    // Use explicit waits for two pageerror events.
    const clicks = 2;
    // Kick off clicks with waits to ensure we capture both errors.
    const waits = [];
    for (let i = 0; i < clicks; i++) {
      waits.push(gp.page.waitForEvent('pageerror'));
      // Stagger clicks slightly to simulate a real user (but keep it simple).
      await gp.clickExplore();
    }

    // Await both errors.
    const errs = await Promise.all(waits);
    expect(errs.length).toBe(clicks);
    for (const e of errs) {
      expect(e.message).toMatch(/Graph is not defined|ReferenceError/i);
    }

    // Ensure our collected gp.pageErrors reflects at least the number of errors we waited for.
    expect(gp.pageErrors.length).toBeGreaterThanOrEqual(clicks);
  });

  test('State verification: after attempted generation, DOM remains intact (no unexpected removals)', async () => {
    // Ensure clicking the button (which errors) does not remove critical DOM elements like the button or the header.
    // Click and wait for the resulting pageerror.
    const waitErr = gp.page.waitForEvent('pageerror');
    await gp.clickExplore();
    await waitErr;

    // The button should still be present and visible.
    const btn = await gp.getExploreButton();
    await expect(btn).toBeVisible();

    // Header/title should remain.
    const header = gp.page.locator('h1');
    await expect(header).toHaveText('Graph (Directed) Explanation');
  });

  test('Console and pageerror observations: ensure we capture console messages and errors as evidence of S1 entry', async () => {
    // The FSM's S1 entry action is generateGraph(); the implementation attempts to use Graph constructor.
    // We click and then analyze both console messages and pageerrors to show evidence of the attempted generation.
    const pageErrorPromise = gp.page.waitForEvent('pageerror');
    await gp.clickExplore();
    const err = await pageErrorPromise;

    // The error message should reference Graph (evidence of attempted graph creation).
    expect(err.message).toMatch(/Graph/i);

    // Also assert that console messages array includes at least any message (even if unrelated).
    // This validates our ability to observe console outputs as "evidence" in the FSM.
    const consoleTexts = gp.getConsoleTexts();
    // It's acceptable if there are zero console logs; we assert that capturing works by checking type and shape.
    expect(Array.isArray(consoleTexts)).toBe(true);
  });
});