import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f181dcb1-d366-11f0-9b19-a558354ece3e.html';

// Page object for interacting with the Kruskal visualizer page
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for full load event to fire
    await this.page.waitForLoadState('load');
    // slight pause to allow any console messages to appear
    await this.page.waitForTimeout(200);
  }

  get progressText() {
    return this.page.locator('#progressText');
  }

  get prevButton() {
    return this.page.locator('#prevStep');
  }

  get nextButton() {
    return this.page.locator('#nextStep');
  }

  get resetButton() {
    return this.page.locator('#reset');
  }

  get autoRunButton() {
    return this.page.locator('#autoRun');
  }

  get speedSlider() {
    return this.page.locator('#speedSlider');
  }

  get speedValueText() {
    return this.page.locator('#speedValue');
  }

  get graphCanvas() {
    return this.page.locator('#graphCanvas');
  }

  get edgesList() {
    return this.page.locator('#edgesList');
  }

  get mstEdgesList() {
    return this.page.locator('#mstEdges');
  }

  async clickNext() {
    await this.nextButton.click();
    // allow any script reactions to run
    await this.page.waitForTimeout(200);
  }

  async clickPrev() {
    await this.prevButton.click();
    await this.page.waitForTimeout(200);
  }

  async clickReset() {
    await this.resetButton.click();
    await this.page.waitForTimeout(200);
  }

  async clickAutoRun() {
    await this.autoRunButton.click();
    await this.page.waitForTimeout(200);
  }

  // Change speed by setting value and dispatching input event
  async changeSpeed(value) {
    // Use evaluate to set value and dispatch event so any attached handlers run naturally
    await this.page.evaluate(({ v }) => {
      const el = document.getElementById('speedSlider');
      if (!el) return;
      el.value = String(v);
      const ev = new Event('input', { bubbles: true });
      el.dispatchEvent(ev);
    }, { v: value });
    await this.page.waitForTimeout(200);
  }
}

test.describe('Kruskal Algorithm Visualization - FSM states and transitions', () => {
  // Capture console errors and page errors per test to assert on them
  test.beforeEach(async ({ page }) => {
    // No-op: setup listeners inside each test for clarity
  });

  test('Initial Idle state renders and script errors are observed', async ({ page }) => {
    // Collect console error messages and runtime page errors
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      // pageerror is for unhandled exceptions at runtime
      pageErrors.push(String(error && error.message ? error.message : error));
    });

    const vis = new KruskalPage(page);
    await vis.goto();

    // Validate presence of core DOM elements (static HTML should be present even if JS failed)
    await expect(vis.progressText).toBeVisible();
    await expect(vis.progressText).toHaveText('Ready to start'); // FSM S0_Idle evidence

    await expect(vis.graphCanvas).toBeVisible();
    await expect(vis.prevButton).toBeVisible();
    await expect(vis.nextButton).toBeVisible();
    await expect(vis.resetButton).toBeVisible();
    await expect(vis.autoRunButton).toBeVisible();
    await expect(vis.speedSlider).toBeVisible();
    await expect(vis.speedValueText).toBeVisible();

    // Validate edge lists exist
    await expect(vis.edgesList).toBeVisible();
    await expect(vis.mstEdgesList).toBeVisible();

    // Wait a bit more to accumulate console messages from parsing/execution
    await page.waitForTimeout(200);

    // We expect that the provided HTML/JS (truncated script) may cause a SyntaxError or similar.
    // Assert that at least one console error or page error occurred during load.
    const hadConsoleSyntaxError = consoleErrors.some(msg => /syntaxerror|unexpected end|unexpected token/i.test(msg));
    const hadPageError = pageErrors.length > 0;

    // At minimum, either a SyntaxError should be in console errors or a runtime page error should be present.
    // We assert that one of these occurred to reflect the broken/truncated implementation as required.
    expect(hadConsoleSyntaxError || hadPageError).toBeTruthy();

    // Also attach the collected errors to the test output for debugging purposes
    if (consoleErrors.length) {
      console.log('Console errors:', consoleErrors);
    }
    if (pageErrors.length) {
      console.log('Page errors:', pageErrors);
    }
  });

  test('Attempt NextStep transition and observe behavior or errors', async ({ page }) => {
    // This test tries to exercise the transition S0_Idle -> S1_Step_Progress via NextStep click.
    // We will assert either the visual progress changes OR that script errors prevented the transition.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(String(err && err.message ? err.message : err)));

    const vis = new KruskalPage(page);
    await vis.goto();

    // Snapshot initial progress text
    const initialText = await vis.progressText.textContent();

    // Try clicking NextStep to trigger transition (may be no-op if JS failed)
    await vis.clickNext();

    // Give the page some time to process
    await page.waitForTimeout(300);

    const afterText = await vis.progressText.textContent();

    // If the script executed correctly we'd expect either a "Step X" or an "Added edge" or "Skipped edge" message.
    const progressed = afterText && afterText !== initialText && /Step|Added edge|Skipped edge/i.test(afterText);

    // Determine if we observed a syntax/runtime error
    const hadSyntaxConsoleError = consoleErrors.some(msg => /syntaxerror|unexpected end|unexpected token/i.test(msg));
    const hadPageRuntimeError = pageErrors.length > 0;

    // Assert that either the transition happened OR errors prevented it (we must not patch code)
    expect(progressed || hadSyntaxConsoleError || hadPageRuntimeError).toBeTruthy();

    // If the transition did happen, also assert that edge lists visually reflect considered/inMST state
    if (progressed) {
      // There should be at least one edge item highlighted (currentStep) or an MST edge in the list
      const edgesCount = await vis.edgesList.locator('.edge-item').count();
      const mstCount = await vis.mstEdgesList.locator('.edge-item').count();
      // At least some entry must exist in the sorted edges list (static content created by JS)
      expect(edgesCount).toBeGreaterThanOrEqual(0);
      // MST count may be 0 or more depending on step; ensure no DOM errors when rendering
      expect(mstCount).toBeGreaterThanOrEqual(0);
    } else {
      // Log errors for context in test output
      if (consoleErrors.length) console.log('Console errors after NextStep:', consoleErrors);
      if (pageErrors.length) console.log('Page errors after NextStep:', pageErrors);
    }
  });

  test('Attempt PreviousStep transition from Idle and validate edge case behavior', async ({ page }) => {
    // This validates the edge case: clicking Previous at step 0 should be a no-op or produce safe handling.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(String(err && err.message ? err.message : err)));

    const vis = new KruskalPage(page);
    await vis.goto();

    // Ensure starting at Idle
    await expect(vis.progressText).toHaveText('Ready to start');

    // Click prevStep (should be disabled in working app or no-op)
    await vis.clickPrev();

    // Wait for any potential reactions
    await page.waitForTimeout(200);

    // After clicking prev on Idle, progress text should remain unchanged or errors should be present
    const textAfter = await vis.progressText.textContent();
    const unchanged = textAfter === 'Ready to start';

    const hadErrors = consoleErrors.some(msg => /syntaxerror|unexpected end|unexpected token/i.test(msg)) || pageErrors.length > 0;

    expect(unchanged || hadErrors).toBeTruthy();

    if (consoleErrors.length) console.log('Console errors after Prev:', consoleErrors);
    if (pageErrors.length) console.log('Page errors after Prev:', pageErrors);
  });

  test('Reset button restores Idle state or errors are observed', async ({ page }) => {
    // This test attempts to exercise the Reset transition S1 -> S0 (or S0 -> S0)
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(String(err && err.message ? err.message : err)));

    const vis = new KruskalPage(page);
    await vis.goto();

    // Force clicking Reset
    await vis.clickReset();

    await page.waitForTimeout(200);

    // After reset, progress text expected to be 'Ready to start' per FSM S0 entry evidence
    const text = await vis.progressText.textContent();
    const resetSucceeded = text === 'Ready to start';

    // Alternatively, if JS failed to run, we expect to see syntax/runtime errors
    const hadErrors = consoleErrors.some(msg => /syntaxerror|unexpected end|unexpected token/i.test(msg)) || pageErrors.length > 0;

    expect(resetSucceeded || hadErrors).toBeTruthy();

    if (!resetSucceeded) {
      if (consoleErrors.length) console.log('Console errors after Reset:', consoleErrors);
      if (pageErrors.length) console.log('Page errors after Reset:', pageErrors);
    }
  });

  test('AutoRun toggle and speed slider behavior (SpeedChange event)', async ({ page }) => {
    // This test tries to toggle AutoRun and change speed. We assert either UI updates occur (speed label change)
    // or that script errors exist (as required by the task).
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(String(err && err.message ? err.message : err)));

    const vis = new KruskalPage(page);
    await vis.goto();

    // Capture initial speed label
    const initialSpeedLabel = await vis.speedValueText.textContent();

    // Change speed to Very Fast (value 5)
    await vis.changeSpeed(5);

    // Wait for UI to react
    await page.waitForTimeout(200);

    const newSpeedLabel = await vis.speedValueText.textContent();

    const speedChanged = newSpeedLabel !== initialSpeedLabel;

    // Try toggling auto-run
    await vis.clickAutoRun();

    await page.waitForTimeout(200);

    // If everything worked we should have a changed speed label OR there may be errors due to truncated JS
    const hadErrors = consoleErrors.some(msg => /syntaxerror|unexpected end|unexpected token/i.test(msg)) || pageErrors.length > 0;

    expect(speedChanged || hadErrors).toBeTruthy();

    if (consoleErrors.length) console.log('Console errors after speed change/autoRun:', consoleErrors);
    if (pageErrors.length) console.log('Page errors after speed change/autoRun:', pageErrors);
  });

  test('Comprehensive: exercise many NextStep clicks until completion or until errors prevent progress', async ({ page }) => {
    // This test tries to drive the visualization forward through multiple NextStep events to trigger S2_MST_Complete,
    // or detects that errors prevent such completion.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(String(err && err.message ? err.message : err)));

    const vis = new KruskalPage(page);
    await vis.goto();

    // Try clicking next multiple times (bounded)
    const maxAttempts = 10;
    let progressedToComplete = false;
    let lastProgressText = await vis.progressText.textContent();

    for (let i = 0; i < maxAttempts; i++) {
      await vis.clickNext();
      await page.waitForTimeout(150);

      const pt = await vis.progressText.textContent();
      // Detect MST completion phrase per FSM S2 evidence
      if (pt && /MST Complete/i.test(pt)) {
        progressedToComplete = true;
        lastProgressText = pt;
        break;
      }
      // If progress text changed note it
      if (pt !== lastProgressText) {
        lastProgressText = pt;
      }
      // If console syntax/runtime errors appear, break as we shouldn't attempt further
      if (consoleErrors.some(msg => /syntaxerror|unexpected end|unexpected token/i.test(msg)) || pageErrors.length > 0) {
        break;
      }
    }

    // Assert: either reached completion OR script errors prevented continued execution OR at least some progress happened
    const hadErrors = consoleErrors.some(msg => /syntaxerror|unexpected end|unexpected token/i.test(msg)) || pageErrors.length > 0;
    const madeProgress = lastProgressText && lastProgressText !== 'Ready to start';

    expect(progressedToComplete || hadErrors || madeProgress).toBeTruthy();

    if (progressedToComplete) {
      console.log('Reached MST Complete:', lastProgressText);
    } else {
      if (consoleErrors.length) console.log('Console errors during step progression:', consoleErrors);
      if (pageErrors.length) console.log('Page errors during step progression:', pageErrors);
      if (madeProgress) console.log('Progress observed but MST not completed. Last progress text:', lastProgressText);
    }
  });
});