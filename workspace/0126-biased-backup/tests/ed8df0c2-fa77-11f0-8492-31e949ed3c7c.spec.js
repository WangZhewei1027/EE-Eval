import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8df0c2-fa77-11f0-8492-31e949ed3c7c.html';

// Page object for the A* Search visualization page
class GridPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.gridLocator = page.locator('#grid');
    this.cellLocator = (index) => this.page.locator(`#grid .cell`).nth(index);
    this.visualizeButton = page.locator('button[onclick="startAnimation()"]');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the Visualize A* Search button
  async clickVisualize() {
    await this.visualizeButton.click();
  }

  // Return number of cells in the grid
  async getCellCount() {
    return await this.page.locator('#grid .cell').count();
  }

  // Get the class list of a grid cell by index
  async getCellClasses(index) {
    return await this.page.evaluate((i) => {
      const grid = document.getElementById('grid');
      if (!grid || !grid.children[i]) return null;
      return Array.from(grid.children[i].classList);
    }, index);
  }

  // Check whether a particular cell has the 'path' class
  async cellHasPathClass(index) {
    const classes = await this.getCellClasses(index);
    return classes ? classes.includes('path') : false;
  }

  // Wait until the animation sets the 'path' class on the specified cell index (or timeout)
  async waitForPathOnCell(index, timeout = 5000) {
    await this.page.waitForFunction(
      (i) => {
        const g = document.getElementById('grid');
        return !!(g && g.children[i] && g.children[i].classList.contains('path'));
      },
      index,
      { timeout }
    );
  }

  // Wait until the animation completes by checking that the last path index (99) has 'path'
  async waitForAnimationComplete(timeout = 7000) {
    // The provided path ends at cell 99, so wait for cell 99 to have 'path'
    await this.waitForPathOnCell(99, timeout);
  }
}

test.describe('A* Search Animation - FSM and DOM behavior', () => {
  // Capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  // Attach listeners before each test and navigate to the app
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and collect those with type 'error'
    page.on('console', (msg) => {
      const type = msg.type(); // 'log', 'error', etc.
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push({ type, text });
      }
    });

    // Listen for uncaught page errors
    page.on('pageerror', (error) => {
      // error is typically an Error object
      pageErrors.push(error);
    });

    // Create page object and navigate
    const gp = new GridPage(page);
    await gp.goto();

    // Sanity: wait a moment to allow initial scripts (createGrid) to run
    await page.waitForTimeout(50);
  });

  test('Initial state (S0_Idle): createGrid() should have run and grid should be populated', async ({ page }) => {
    const gp = new GridPage(page);

    // Validate the grid exists and has 100 cells as created by createGrid()
    // This checks the S0_Idle state's entry action createGrid()
    const cellCount = await gp.getCellCount();
    expect(cellCount).toBe(100);

    // Validate start and end classes applied at indices 0 and 99
    const startClasses = await gp.getCellClasses(0);
    const endClasses = await gp.getCellClasses(99);

    expect(startClasses).toContain('start');
    expect(endClasses).toContain('end');

    // Validate the Visualize button exists and has expected text content
    const btnText = await page.locator('button[onclick="startAnimation()"]').innerText();
    expect(btnText).toMatch(/Visualize A\* Search/);

    // Ensure no uncaught page errors or console errors occurred during load (observational)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 (VisualizeAStarSearch): clicking the button starts the animation and highlights path cells', async ({ page }) => {
    const gp = new GridPage(page);

    // Click the visualize button to trigger startAnimation() (enter S1_Animating)
    // This validates the "VisualizeAStarSearch" event and the transition to S1_Animating
    await gp.clickVisualize();

    // The animation highlights indices in a predefined path; wait for an intermediate step and final state.
    // Wait for a few early path indices to get marked in sequence. Because the implementation uses
    // a moving 'path' class (removes previous), we check that at some time a cell in the path has 'path',
    // and eventually the final cell 99 has 'path'.
    // Wait for any path to appear (should be quick)
    await gp.page.waitForFunction(() => {
      const g = document.getElementById('grid');
      if (!g) return false;
      return Array.from(g.children).some((c) => c.classList.contains('path'));
    }, { timeout: 2000 });

    // Assert at least one cell has 'path' at some point (observation of AnimationStep transition)
    const anyPathCell = await gp.page.evaluate(() => {
      const g = document.getElementById('grid');
      if (!g) return false;
      return Array.from(g.children).some((c) => c.classList.contains('path'));
    });
    expect(anyPathCell).toBe(true);

    // Wait for animation to complete (final destination index 99 should have 'path')
    await gp.waitForAnimationComplete(7000);
    const lastHasPath = await gp.cellHasPathClass(99);
    expect(lastHasPath).toBe(true);

    // Verify that the 'start' and 'end' classes remain present after animation
    expect((await gp.getCellClasses(0))).toContain('start');
    expect((await gp.getCellClasses(99))).toContain('end');

    // Ensure no uncaught page errors or console errors occurred during animation
    // (we observe the runtime for ReferenceError/SyntaxError/TypeError, but none should occur)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Animating repeated interactions and edge case: clicking the button multiple times rapidly', async ({ page }) => {
    const gp = new GridPage(page);

    // Click the button multiple times quickly to simulate a user spamming the control.
    // The implementation does not guard against multiple intervals; this checks stability and absence of uncaught errors.
    await gp.clickVisualize();
    await gp.page.waitForTimeout(50);
    await gp.clickVisualize();
    await gp.page.waitForTimeout(50);
    await gp.clickVisualize();

    // Wait for at least one path marking to appear after these interactions
    await gp.page.waitForFunction(() => {
      const g = document.getElementById('grid');
      if (!g) return false;
      return Array.from(g.children).some((c) => c.classList.contains('path'));
    }, { timeout: 2000 });

    // Wait for the eventual completion - since multiple intervals may overlap, allow generous timeout
    await gp.waitForAnimationComplete(8000);
    expect(await gp.cellHasPathClass(99)).toBe(true);

    // Validate no uncaught page errors or console errors occurred even under rapid interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Behavioral assertion: animation step semantics - only one cell has "path" during steady-state steps, final cell remains highlighted', async ({ page }) => {
    const gp = new GridPage(page);

    // Start animation
    await gp.clickVisualize();

    // During the animation, the implementation removes the previous 'path' and adds the new one.
    // We sample over a short duration to assert that exactly one cell has 'path' during the steady steps.
    // This confirms the FSM internal AnimationStep action: gridElement.children[path[index]].classList.add('path');
    // and the removal of previous path cell.
    const sampleCheck = await gp.page.evaluate(async () => {
      const results = [];
      // sample 10 times spaced by 120ms (slightly longer than the 100ms interval)
      for (let i = 0; i < 10; i++) {
        await new Promise((res) => setTimeout(res, 120));
        const g = document.getElementById('grid');
        if (!g) {
          results.push({ time: i, count: 0 });
          continue;
        }
        const count = Array.from(g.children).filter((c) => c.classList.contains('path')).length;
        results.push({ time: i, count });
      }
      return results;
    });

    // Expect that during sampling, the observed 'path' cell count is either 0 or 1 for steady-state sampling.
    // 0 may occur before the animation starts sampling; 1 is expected during the animation as implementation removes previous.
    for (const sample of sampleCheck) {
      expect(sample.count).toBeLessThanOrEqual(1);
    }

    // Finally wait for completion and confirm final cell has 'path'
    await gp.waitForAnimationComplete(7000);
    expect(await gp.cellHasPathClass(99)).toBe(true);

    // Confirm no page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observational test for runtime errors: collect any ReferenceError/SyntaxError/TypeError if they occur', async ({ page }) => {
    // This test's purpose is to ensure we observe runtime errors if they happen.
    // We do not modify the application; we only report and assert observed behavior.
    // Because the application is expected to run cleanly, we assert that none of these errors were thrown.
    const gp = new GridPage(page);

    // Trigger a standard interaction to exercise runtime code paths
    await gp.clickVisualize();
    await gp.waitForAnimationComplete(7000);

    // Check captured page errors and classify them
    const errorTypes = pageErrors.map((e) => (e && e.name) || (e && e.constructor && e.constructor.name) || 'UnknownError');

    // Assert that no ReferenceError, SyntaxError, or TypeError occurred during runtime
    for (const errName of errorTypes) {
      expect(errName).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }

    // Also ensure there were no console.error messages
    expect(consoleErrors.length).toBe(0);
  });
});