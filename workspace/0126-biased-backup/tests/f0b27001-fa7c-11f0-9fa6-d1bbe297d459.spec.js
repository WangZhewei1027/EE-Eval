import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b27001-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the DFS visualization page
class DFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getVisualizeButton() {
    return this.page.$('#visualize-btn');
  }

  async clickVisualizeButton() {
    const btn = await this.getVisualizeButton();
    await btn.click();
  }

  async getVisualizationContainer() {
    return this.page.$('#dfs-visualization');
  }

  // Returns the inner text of the visualization container
  async getVisualizationText() {
    const container = await this.getVisualizationContainer();
    return this.page.evaluate((el) => el ? el.textContent : null, container);
  }

  // Returns number of appended step <div> elements (the script appends divs for steps)
  async countStepDivs() {
    // The visualization container has an <h3> header and multiple <div> children for steps.
    return this.page.evaluate(() => {
      const container = document.getElementById('dfs-visualization');
      if (!container) return 0;
      // Count direct child div elements (these are the step nodes)
      return Array.from(container.children).filter(el => el.tagName.toLowerCase() === 'div').length;
    });
  }

  // Returns array of step texts
  async getStepTexts() {
    return this.page.evaluate(() => {
      const container = document.getElementById('dfs-visualization');
      if (!container) return [];
      return Array.from(container.children)
        .filter(el => el.tagName.toLowerCase() === 'div')
        .map(d => d.textContent.trim());
    });
  }

  // Returns array of background colors for step divs (computed style)
  async getStepBackgroundColors() {
    return this.page.evaluate(() => {
      const container = document.getElementById('dfs-visualization');
      if (!container) return [];
      return Array.from(container.children)
        .filter(el => el.tagName.toLowerCase() === 'div')
        .map(d => window.getComputedStyle(d).backgroundColor);
    });
  }
}

test.describe('DFS Visualization - FSM states and transitions', () => {
  // Arrays to capture console errors and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // initialize arrays
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore listener errors
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(err.message || String(err));
      } catch (e) {
        // ignore
      }
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally; Playwright handles page/browser lifecycle.
    // We assert collected errors inside individual tests as needed.
  });

  test('S0_Idle: Initial render shows button and placeholder (Idle state)', async ({ page }) => {
    // This test validates the Idle state entry action (renderPage()) by checking
    // that the main UI elements are present: the Start button and the visualization container with placeholder text.
    const dfs = new DFSPage(page);
    await dfs.goto();

    // Ensure the Start DFS Visualization button exists and is visible
    const btn = await dfs.getVisualizeButton();
    expect(btn, 'visualize button should be present').not.toBeNull();
    await expect(btn).toBeVisible();

    // Ensure the visualization container exists and contains the placeholder message
    const container = await dfs.getVisualizationContainer();
    expect(container, 'visualization container should be present').not.toBeNull();

    const text = await dfs.getVisualizationText();
    expect(text).toContain('Visualization will appear here when you click the button.');

    // Assert that no console.error or page errors occurred during initial render
    expect(consoleErrors.length, 'no console.error during initial render').toBe(0);
    expect(pageErrors.length, 'no uncaught page errors during initial render').toBe(0);
  });

  test('S1_Visualizing: Clicking button transitions to Visualizing state and appends steps', async ({ page }) => {
    // This test validates the transition from Idle to Visualizing: clicking the button should run startVisualization()
    // and the container should show a header and then progressively appended step divs.
    const dfs = new DFSPage(page);
    await dfs.goto();

    // Click the visualize button to trigger the visualization
    await dfs.clickVisualizeButton();

    // After click, the script sets innerHTML = '<h3>DFS Traversal Steps</h3>' immediately.
    // Wait for the header to appear in the container.
    await page.waitForSelector('#dfs-visualization h3', { timeout: 2000 });

    // Wait for a few steps to be appended (the script appends one step per 1000ms).
    // We'll wait until at least 3 step divs have been appended to assert progression.
    await page.waitForFunction(() => {
      const container = document.getElementById('dfs-visualization');
      if (!container) return false;
      // Count child divs appended as steps
      return Array.from(container.children).filter(el => el.tagName.toLowerCase() === 'div').length >= 3;
    }, { timeout: 7000 });

    // Verify step count and content
    const stepCount = await dfs.countStepDivs();
    expect(stepCount).toBeGreaterThanOrEqual(3);

    const stepTexts = await dfs.getStepTexts();
    expect(stepTexts[0]).toMatch(/^Step 1:/); // first step starts with "Step 1:"
    expect(stepTexts[1]).toMatch(/^Step 2:/);
    expect(stepTexts[2]).toMatch(/^Step 3:/);

    // Verify alternating background colors for the first three steps
    const bgColors = await dfs.getStepBackgroundColors();
    // The implementation alternates between '#f0f0f0' and '#ffffff' - computed colors likely 'rgb(240, 240, 240)' and 'rgb(255, 255, 255)'
    expect(bgColors.length).toBeGreaterThanOrEqual(3);
    expect([ 'rgb(240, 240, 240)', 'rgb(255, 255, 255)' ]).toContain(bgColors[0]);
    expect([ 'rgb(240, 240, 240)', 'rgb(255, 255, 255)' ]).toContain(bgColors[1]);
    expect([ 'rgb(240, 240, 240)', 'rgb(255, 255, 255)' ]).toContain(bgColors[2]);
    // Ensure they alternate (color0 != color1)
    expect(bgColors[0] === bgColors[1]).toBe(false);

    // Assert no console errors or uncaught page errors happened during visualization start
    expect(consoleErrors.length, 'no console.error during visualization start').toBe(0);
    expect(pageErrors.length, 'no uncaught page errors during visualization start').toBe(0);
  });

  test('Transition robustness: multiple rapid clicks (edge case) should not crash the page', async ({ page }) => {
    // Edge case: user clicks the Start button multiple times in quick succession.
    // The implementation resets innerHTML and starts a new interval each click.
    // We assert that overlapping intervals do not cause uncaught exceptions and that steps are appended.
    const dfs = new DFSPage(page);
    await dfs.goto();

    // Rapidly click the button twice
    await dfs.clickVisualizeButton();
    await dfs.clickVisualizeButton();

    // Wait for at least 2 step divs to appear (they may be produced by either interval)
    await page.waitForFunction(() => {
      const container = document.getElementById('dfs-visualization');
      if (!container) return false;
      return Array.from(container.children).filter(el => el.tagName.toLowerCase() === 'div').length >= 2;
    }, { timeout: 5000 });

    const stepTexts = await dfs.getStepTexts();
    expect(stepTexts.length).toBeGreaterThanOrEqual(2);
    // Ensure the text format is still "Step N: ..."
    for (let txt of stepTexts.slice(0, 3)) {
      expect(txt).toMatch(/^Step \d+:/);
    }

    // Important: assert that no console errors or uncaught page errors occurred
    expect(consoleErrors.length, 'no console.error when clicking multiple times').toBe(0);
    expect(pageErrors.length, 'no uncaught page errors when clicking multiple times').toBe(0);
  });

  test('Visualization completes all expected steps (wait until finish)', async ({ page }) => {
    // This test waits for the full sequence of DFS steps to be appended.
    // There are 13 steps in the implementation, each appended every 1 second, so allow sufficient time.
    const dfs = new DFSPage(page);
    await dfs.goto();

    // Increase the test timeout for this particular test to allow the visualization to finish
    test.setTimeout(30000);

    await dfs.clickVisualizeButton();

    // Wait until all 13 step divs are present
    await page.waitForFunction(() => {
      const container = document.getElementById('dfs-visualization');
      if (!container) return false;
      // Count direct child divs (the appended steps)
      return Array.from(container.children).filter(el => el.tagName.toLowerCase() === 'div').length === 13;
    }, { timeout: 20000 });

    const stepCount = await dfs.countStepDivs();
    expect(stepCount).toBe(13);

    const finalSteps = await dfs.getStepTexts();
    // Last step should contain the completion message with traversal order
    expect(finalSteps[finalSteps.length - 1]).toContain('DFS complete! Traversal order: A, B, D, E, C, F');

    // Even after completion, ensure the page did not produce errors
    expect(consoleErrors.length, 'no console.error after visualization finished').toBe(0);
    expect(pageErrors.length, 'no uncaught page errors after visualization finished').toBe(0);
  });

  test('Behavioral check: container content reset upon new visualization (onExit/onEnter semantics)', async ({ page }) => {
    // This test asserts that clicking the button resets the visualization container (onExit/onEnter)
    // The script sets container.innerHTML = '<h3>DFS Traversal Steps</h3>' on each click, thereby "entering" the Visualizing state fresh.
    const dfs = new DFSPage(page);
    await dfs.goto();

    // Start visualization and wait for at least 2 steps
    await dfs.clickVisualizeButton();
    await page.waitForFunction(() => {
      const container = document.getElementById('dfs-visualization');
      if (!container) return false;
      return Array.from(container.children).filter(el => el.tagName.toLowerCase() === 'div').length >= 2;
    }, { timeout: 7000 });

    // Capture current step texts
    const beforeClickSteps = await dfs.getStepTexts();
    expect(beforeClickSteps.length).toBeGreaterThanOrEqual(2);

    // Click again to "restart" visualization - container.innerHTML is reset immediately by the script
    await dfs.clickVisualizeButton();

    // After restart, the container should have header and soon start adding steps from Step 1 again.
    // Wait for the first step after the reset
    await page.waitForFunction(() => {
      const container = document.getElementById('dfs-visualization');
      if (!container) return false;
      // Look for a div whose text starts with 'Step 1'
      return Array.from(container.children)
        .filter(el => el.tagName.toLowerCase() === 'div')
        .some(d => /^Step 1:/.test(d.textContent.trim()));
    }, { timeout: 5000 });

    const afterClickSteps = await dfs.getStepTexts();
    // The new sequence should have 'Step 1' at the start
    expect(afterClickSteps[0]).toMatch(/^Step 1:/);

    // And ensure page did not produce any console errors on restart
    expect(consoleErrors.length, 'no console.error on restart').toBe(0);
    expect(pageErrors.length, 'no uncaught page errors on restart').toBe(0);
  });

  test('Console & runtime errors observation: page should not emit uncaught errors during normal usage', async ({ page }) => {
    // This test explicitly verifies that during normal flows (render, click, complete) there are no console errors or uncaught exceptions.
    const dfs = new DFSPage(page);
    await dfs.goto();

    // Perform actions: click start and wait for a small number of steps
    await dfs.clickVisualizeButton();

    await page.waitForFunction(() => {
      const c = document.getElementById('dfs-visualization');
      if (!c) return false;
      return Array.from(c.children).filter(el => el.tagName.toLowerCase() === 'div').length >= 1;
    }, { timeout: 5000 });

    // Assert that no console.error messages were captured
    // If there are any runtime errors, the arrays will contain entries and these assertions will fail,
    // thereby honoring the "observe console logs and page errors" requirement.
    expect(consoleErrors.length, 'no console.error messages observed').toBe(0);
    expect(pageErrors.length, 'no uncaught page errors observed').toBe(0);
  });
});