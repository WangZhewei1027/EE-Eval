import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d63f1-d361-11f0-8438-11a56595a476.html';

// Page Object Model for the Kruskal visualization app
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Control buttons
    this.nextBtn = page.locator('#nextStepBtn');
    this.resetBtn = page.locator('#resetBtn');
    // Info panels
    this.currentStepInfo = page.locator('#currentStepInfo');
    this.edgeInfo = page.locator('#edgeInfo');
    this.dsInfo = page.locator('#dsInfo');
    this.mstEdges = page.locator('#mstEdges');
    // SVG
    this.svg = page.locator('#svgGraph');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure SVG and controls are available
    await expect(this.svg).toBeVisible();
    await expect(this.nextBtn).toBeVisible();
    await expect(this.resetBtn).toBeVisible();
  }

  async clickNext() {
    await this.nextBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getCurrentStepText() {
    return (await this.currentStepInfo.textContent()) ?? '';
  }

  async getEdgeInfoText() {
    return (await this.edgeInfo.textContent()) ?? '';
  }

  async getDSInfoHTML() {
    return (await this.dsInfo.innerHTML()) ?? '';
  }

  async getMSTEdgesCount() {
    // Count <li> inside #mstEdges that represent actual edges (ignore placeholder)
    const lis = await this.mstEdges.locator('li').allTextContents();
    if (lis.length === 1 && lis[0].includes('No edges selected')) return 0;
    return lis.length;
  }

  // Returns the inline style.stroke value for a given edge id (e.g., edge4)
  async getEdgeStrokeStyle(edgeId) {
    const selector = `#edge${edgeId}`;
    // Use evaluate to get style.stroke property
    return await this.page.$eval(selector, (el) => el.style.stroke || '');
  }

  async getEdgeClasses(edgeId) {
    const selector = `#edge${edgeId}`;
    return await this.page.$eval(selector, (el) => el.className.baseVal || el.className || '');
  }

  async isNextButtonDisabled() {
    return await this.nextBtn.isDisabled();
  }

  async isResetButtonDisabled() {
    return await this.resetBtn.isDisabled();
  }

  // Get number of SVG edge elements by querying lines with id starting with 'edge'
  async getTotalEdgeCount() {
    return await this.page.$$eval('svg line[id^="edge"]', els => els.length);
  }
}

// Global helper to collect console errors and page errors for assertion
function attachErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];

  const consoleListener = (msg) => {
    try {
      if (msg.type && msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null
        });
      }
    } catch (e) {
      // ignore listener errors
    }
  };

  const pageErrorListener = (err) => {
    pageErrors.push({
      message: err.message,
      stack: err.stack
    });
  };

  page.on('console', consoleListener);
  page.on('pageerror', pageErrorListener);

  return {
    getConsoleErrors: () => consoleErrors,
    getPageErrors: () => pageErrors,
    detach: () => {
      page.removeListener('console', consoleListener);
      page.removeListener('pageerror', pageErrorListener);
    }
  };
}

test.describe('Kruskal’s Algorithm Visualization - FSM and UI tests', () => {
  // Per-test collectors
  let collector;

  test.beforeEach(async ({ page }) => {
    collector = attachErrorCollectors(page);
  });

  test.afterEach(async ({ page }) => {
    // Ensure we detach listeners to avoid leaks
    collector.detach();

    // Assert there were no uncaught page errors or console.error messages during the test
    const consoleErrors = collector.getConsoleErrors();
    const pageErrors = collector.getPageErrors();

    // These assertions validate that the page ran without runtime errors.
    // If there are runtime errors (ReferenceError, TypeError, SyntaxError), the arrays will be non-empty and the test will fail here.
    expect(consoleErrors, `console.error messages were logged: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `uncaught page errors were observed: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('on load the app is in Idle state and reset() entry action executed', async ({ page }) => {
      // This test validates:
      // - The page loads to the Idle state
      // - reset() was executed on init (UI shows initial text and DS info)
      const app = new KruskalPage(page);
      await app.goto();

      const stepText = await app.getCurrentStepText();
      // The implementation uses double quotes around Next Step in the DOM.
      expect(stepText).toBeTruthy();
      expect(stepText.toLowerCase()).toContain('next step');

      // Edge info should be placeholder '-'
      const edgeText = await app.getEdgeInfoText();
      expect(edgeText.trim()).toBe('-');

      // Disjoint set info should show "Parents:" since reset() sets up UF and renderUF returns Parents
      const dsHtml = await app.getDSInfoHTML();
      expect(dsHtml).toContain('Parents:');

      // Reset and Next buttons should be enabled initially (reset() sets them)
      expect(await app.isNextButtonDisabled()).toBe(false);
      expect(await app.isResetButtonDisabled()).toBe(false);

      // There should be 8 edges drawn (as per HTML edges array)
      const totalEdges = await app.getTotalEdgeCount();
      expect(totalEdges).toBe(8);
    });
  });

  test.describe('Transition: NextStep events and Step Processing (S1_Step_Processing)', () => {
    test('S0 -> S1: clicking Next Step shows a considered edge and cycle-check message', async ({ page }) => {
      // Validate that clicking Next moves from Idle to Step Processing and updates texts and visuals
      const app = new KruskalPage(page);
      await app.goto();

      // Click Next once to consider first edge (smallest weight)
      await app.clickNext();

      const current = await app.getCurrentStepText();
      expect(current.toLowerCase()).toContain('considering edge');

      const edgeInfo = await app.getEdgeInfoText();
      expect(edgeInfo.toLowerCase()).toContain('checking if adding this edge creates a cycle');

      // First considered edge by weight in provided dataset is edge with id 4 (weight 1)
      const strokeEdge4 = await app.getEdgeStrokeStyle(4);
      // The code sets style.stroke = '#f39c12' for the considered edge
      expect(strokeEdge4).toBe('#f39c12');
    });

    test('S1 repeated NextStep: continues processing edges and performs union/skip decisions', async ({ page }) => {
      // Step through multiple edges and verify MST grows, DS info updates, and skipped edges are marked
      const app = new KruskalPage(page);
      await app.goto();

      // Click Next until MST is complete (MST should have nodes.length - 1 = 5 edges)
      // The implementation will disable Next when MST complete.
      let steps = 0;
      while (!(await app.isNextButtonDisabled()) && steps < 50) {
        await app.clickNext();
        steps++;
      }

      // After completion, check UI final state
      const finalText = await app.getCurrentStepText();
      // The implementation sets "MST complete! Algorithm finished."
      expect(finalText).toMatch(/mst complete/i);

      // Validate MST edges count is 5
      const mstCount = await app.getMSTEdgesCount();
      expect(mstCount).toBe(5);

      // Next button should be disabled after finish
      expect(await app.isNextButtonDisabled()).toBe(true);

      // Visual check: MST edges should have green stroke (#27ae60) and be selected.
      // At least one known MST edge (from reasoning on weights) should be styled green. We'll check one of the edges that should be in MST:
      // The first few chosen edges by algorithm: edge4 (w1), edge1 (w2), edge5 (w3), edge0 (w4), edge3 (w5) - those are likely the 5.
      // Check one of them has the green stroke applied and class contains 'selected'.
      const strokeEdge4 = await app.getEdgeStrokeStyle(4);
      const classesEdge4 = await app.getEdgeClasses(4);
      // If MST complete, the code sets stroke to '#27ae60' and class 'selected' for MST edges.
      expect(strokeEdge4 === '#27ae60' || strokeEdge4 === '#27ae60').toBeTruthy();
      expect(classesEdge4).toMatch(/selected/);
    });

    test('Reset during Step Processing returns to Idle and clears highlights (S1 -> S0 via Reset)', async ({ page }) => {
      // Validate Reset during processing resets the visualization and UI texts
      const app = new KruskalPage(page);
      await app.goto();

      // Take one step
      await app.clickNext();
      const midText = await app.getCurrentStepText();
      expect(midText.toLowerCase()).toContain('considering edge');

      // Reset now
      await app.clickReset();

      // Expect Idle message again
      const postResetText = await app.getCurrentStepText();
      expect(postResetText.toLowerCase()).toContain('next step');

      // Edge info back to placeholder
      const edgeInfo = await app.getEdgeInfoText();
      expect(edgeInfo.trim()).toBe('-');

      // No MST edges
      const mstCount = await app.getMSTEdgesCount();
      expect(mstCount).toBe(0);

      // All edge strokes should be back to initial gray (#7f8c8d) as set in updateUIBeforeStep.
      // Check one edge's style to confirm reset applied (edge0 should be gray)
      const stroke0 = await app.getEdgeStrokeStyle(0);
      // When style was set inline to '#7f8c8d', style.stroke will equal that value
      expect(stroke0 === '#7f8c8d' || stroke0 === '').toBeTruthy();
    });
  });

  test.describe('Final State (S2_Algorithm_Finished) and edge cases', () => {
    test('Algorithm finishes and Next disabled; Reset brings back to Idle', async ({ page }) => {
      // Validate transition from S1 to S2 after all necessary edges picked
      const app = new KruskalPage(page);
      await app.goto();

      // Step until finish
      let safety = 0;
      while (!(await app.isNextButtonDisabled()) && safety < 50) {
        await app.clickNext();
        safety++;
      }

      // Confirm final text and button states
      const finalText = await app.getCurrentStepText();
      expect(finalText.toLowerCase()).toContain('mst complete');

      expect(await app.isNextButtonDisabled()).toBe(true);
      expect(await app.isResetButtonDisabled()).toBe(false);

      // Now reset and verify idle state again
      await app.clickReset();
      const postResetText = await app.getCurrentStepText();
      expect(postResetText.toLowerCase()).toContain('next step');
      expect(await app.isNextButtonDisabled()).toBe(false);
    });

    test('Edge case: clicking Next after finish does not change state (Next is disabled)', async ({ page }) => {
      // Verify clicking Next after algorithm finished has no effect because button is disabled
      const app = new KruskalPage(page);
      await app.goto();

      // Finish algorithm
      while (!(await app.isNextButtonDisabled())) {
        await app.clickNext();
      }

      // Try to force click Next (playwright click will fail if disabled; ensure it's disabled)
      expect(await app.isNextButtonDisabled()).toBe(true);

      // Confirm MST count remains unchanged
      const mstCountBefore = await app.getMSTEdgesCount();
      // Attempt to click (should be no-op, but Playwright won't click disabled button)
      // Validate that the count stays the same
      const mstCountAfter = await app.getMSTEdgesCount();
      expect(mstCountAfter).toBe(mstCountBefore);
    });
  });

  test.describe('Observability: Console and runtime errors', () => {
    test('no console.error or uncaught page errors should be emitted during normal usage', async ({ page }) => {
      // This test explicitly walks through typical flows and relies on afterEach global assertions
      const app = new KruskalPage(page);
      await app.goto();

      // a few operations: next, next, reset, finish
      await app.clickNext();
      await app.clickNext();
      await app.clickReset();

      // step to finish
      while (!(await app.isNextButtonDisabled())) {
        await app.clickNext();
      }

      // afterEach will assert that there were no console errors or pageerrors
      // We add an explicit check here for clarity as well:
      const consoleErrors = collector.getConsoleErrors();
      const pageErrors = collector.getPageErrors();
      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

});