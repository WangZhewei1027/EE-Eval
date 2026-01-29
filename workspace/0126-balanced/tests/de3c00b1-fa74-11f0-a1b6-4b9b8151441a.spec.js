import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c00b1-fa74-11f0-a1b6-4b9b8151441a.html';

/**
 * Page Object for the Bellman-Ford visualization page.
 * Encapsulates common interactions and DOM queries used across tests.
 */
class BellmanFordPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initialization (window.onload calls init which attaches handlers)
    await this.page.waitForSelector('#run-algorithm');
  }

  async clickRun() {
    await this.page.click('#run-algorithm');
  }

  async clickReset() {
    await this.page.click('#reset');
  }

  async clickStep() {
    await this.page.click('#step');
  }

  async getStepsInfoText() {
    return this.page.locator('#steps-info').innerText();
  }

  async getResultHtml() {
    return this.page.locator('#result').innerHTML();
  }

  async getDistanceTableRows() {
    return this.page.locator('#distance-table tbody tr');
  }

  async getDistanceForVertex(vertex) {
    // Find row with first cell text matching vertex and return distance cell text
    const rows = this.page.locator('#distance-table tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const v = (await row.locator('td').first().innerText()).trim();
      if (v === vertex) {
        // distance is second cell
        return (await row.locator('td').nth(1).innerText()).trim();
      }
    }
    return null;
  }
}

test.describe('Bellman-Ford Algorithm Interactive App (de3c00b1-fa74-11f0-a1b6-4b9b8151441a)', () => {
  let page;
  let bfPage;
  let consoleMessages;
  let pageErrors;

  // Setup per test: create arrays to record console messages and page errors
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    bfPage = new BellmanFordPage(page);
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    await bfPage.goto();
  });

  test.afterEach(async () => {
    // Close page to cleanup
    await page.close();
  });

  test.describe('Initial state (S0_Idle) and rendering', () => {
    test('renders controls, initial text, and distance table on load', async () => {
      // This test validates the Idle state entry (renderPage/init) with expected UI.
      await expect(page.locator('#run-algorithm')).toBeVisible();
      await expect(page.locator('#reset')).toBeVisible();
      await expect(page.locator('#step')).toBeVisible();

      const stepsInfo = await bfPage.getStepsInfoText();
      expect(stepsInfo).toContain('Click "Run Algorithm" to start visualization.');

      const rows1 = await bfPage.getDistanceTableRows();
      // There should be one row per graph node (graph.nodes has 5 nodes)
      expect(await rows.count()).toBeGreaterThanOrEqual(5);

      // Source A should have distance 0 on initialization
      const distA = await bfPage.getDistanceForVertex('A');
      expect(distA).toBe('0');

      // Other nodes should be shown as infinity symbol '∞'
      const distB = await bfPage.getDistanceForVertex('B');
      expect(['∞', 'Infinity']).toContain(distB);

      // No uncaught page errors were produced during load
      expect(pageErrors.length).toBe(0);
      // No console.error messages during initialization
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Run, Step, and Reset interactions (transitions & states)', () => {
    test('Run Algorithm completes and displays final state (S1_Running -> S3_Completed)', async () => {
      // Click "Run Algorithm" — this should run to completion synchronously in page code
      await bfPage.clickRun();

      // Wait for either completed or negative-cycle text (we do not patch page; observe natural outcome)
      await page.waitForFunction(() => {
        const txt = document.getElementById('steps-info')?.innerText || '';
        return txt.includes('Algorithm completed successfully!') || txt.includes('Negative cycle detected!');
      }, { timeout: 5000 });

      const stepsText = await bfPage.getStepsInfoText();

      // The provided graph should complete normally in this implementation.
      // Validate that the UI reports completion and result contains shortest path info.
      if (stepsText.includes('Negative cycle detected')) {
        // If negative cycle is detected (edge-case), ensure result contains negative-cycle message
        const resultHtml = await bfPage.getResultHtml();
        expect(resultHtml).toContain('Negative weight cycle detected');
      } else {
        expect(stepsText).toContain('Algorithm completed successfully!');
        const resultHtml1 = await bfPage.getResultHtml();
        expect(resultHtml).toContain('Shortest paths calculated successfully');
      }

      // Distance for some nodes should be finite numbers after completion
      const distD = await bfPage.getDistanceForVertex('D');
      // Should not be infinity
      expect(distD).not.toBe('∞');

      // Verify that no unexpected console errors or uncaught page errors occurred during run
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Step Through algorithm increments progress and eventually completes (S2_Stepping -> S3_Completed)', async () => {
      // Reset to ensure clean state
      await bfPage.clickReset();
      const afterResetText = await bfPage.getStepsInfoText();
      expect(afterResetText).toContain('Algorithm reset');

      // We will click "Step Through" repeatedly until the algorithm reports completion.
      // Calculate a safe upper bound for clicks: edges * maxIterations + 5
      // From the page source: edges = 9, maxIterations = graph.nodes.length - 1 = 4 -> 9*4 = 36
      const maxClicks = 45;
      let completed = false;
      for (let i = 0; i < maxClicks; i++) {
        await bfPage.clickStep();
        // Small micro-wait to allow DOM updates (stepAlgorithm updates DOM synchronously, but be safe)
        const txt1 = await bfPage.getStepsInfoText();
        if (txt.includes('Algorithm completed successfully!') || txt.includes('Negative cycle detected!')) {
          completed = true;
          break;
        }

        // Also assert that step information is being updated — either relaxing edges or completing iterations
        const stepText = txt.toLowerCase();
        expect(
          stepText.includes('relaxing edge') ||
          stepText.includes('completed iteration') ||
          stepText.includes('starting iteration')
        ).toBeTruthy();
      }

      expect(completed).toBeTruthy();

      const finalStepsText = await bfPage.getStepsInfoText();
      if (finalStepsText.includes('Negative cycle detected')) {
        const resultHtml2 = await bfPage.getResultHtml();
        expect(resultHtml).toContain('Negative weight cycle detected');
      } else {
        expect(finalStepsText).toContain('Algorithm completed successfully!');
        const distE = await bfPage.getDistanceForVertex('E');
        expect(distE).not.toBe('∞');
      }

      // Clicking 'step' after completion should be a no-op: steps-info should remain with completed message
      await bfPage.clickStep();
      const afterExtraStep = await bfPage.getStepsInfoText();
      expect(afterExtraStep).toContain('Algorithm completed successfully!');

      // No console errors or uncaught page errors should have been emitted during stepping
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Reset algorithm from completed state returns to Idle (S3_Completed -> S0_Idle)', async () => {
      // Run to completion
      await bfPage.clickRun();
      await page.waitForFunction(() => {
        const txt2 = document.getElementById('steps-info')?.innerText || '';
        return txt.includes('Algorithm completed successfully!') || txt.includes('Negative cycle detected!');
      }, { timeout: 5000 });

      // Now click Reset and assert state is reset
      await bfPage.clickReset();
      const stepsText1 = await bfPage.getStepsInfoText();
      expect(stepsText).toContain('Algorithm reset');

      const resultHtml3 = await bfPage.getResultHtml();
      expect(resultHtml).toBe('');

      // Table should reflect initial distances: A=0, others ∞
      const distA1 = await bfPage.getDistanceForVertex('A');
      expect(distA).toBe('0');
      const distC = await bfPage.getDistanceForVertex('C');
      expect(['∞', 'Infinity']).toContain(distC);

      // No uncaught errors observed
      expect(pageErrors.length).toBe(0);
      const consoleErrs1 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking Run when already completed triggers reset behavior in implementation', async () => {
      // Run to completion
      await bfPage.clickRun();
      await page.waitForFunction(() => {
        const txt3 = document.getElementById('steps-info')?.innerText || '';
        return txt.includes('Algorithm completed successfully!') || txt.includes('Negative cycle detected!');
      }, { timeout: 5000 });

      // According to implementation, runAlgorithm checks if (state.completed) { resetAlgorithm(); }
      // So clicking Run again should reset and then run to completion again (since it loops while !state.completed)
      // We click again and wait for a completion message again (this verifies the onExit/onEnter behavior indirectly)
      await bfPage.clickRun();

      await page.waitForFunction(() => {
        const txt4 = document.getElementById('steps-info')?.innerText || '';
        return txt.includes('Algorithm completed successfully!') || txt.includes('Negative cycle detected!');
      }, { timeout: 5000 });

      const finalText = await bfPage.getStepsInfoText();
      expect(finalText.length).toBeGreaterThan(0);

      // No uncaught errors observed in this edge path
      expect(pageErrors.length).toBe(0);
      const consoleErrs2 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Ensure no ReferenceError/SyntaxError/TypeError were thrown during interactions', async () => {
      // Interact: step a few times, run, reset to exercise various code paths
      await bfPage.clickStep();
      await bfPage.clickStep();
      await bfPage.clickRun();
      await bfPage.clickReset();

      // Collect any page errors recorded
      const errs = pageErrors.map(e => e.toString()).join('\n');

      // Assert there are no page-level uncaught exceptions like ReferenceError/TypeError/SyntaxError.
      // This follows the requirement to observe console and page errors and assert expected absence here.
      // If the environment produced such errors naturally, this assertion will fail as intended.
      expect(pageErrors.length).toBe(0, `Unexpected page errors occurred:\n${errs}`);

      // Also assert there are no console.error messages
      const consoleErrs3 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });
});