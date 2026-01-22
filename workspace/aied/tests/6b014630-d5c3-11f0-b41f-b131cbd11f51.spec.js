import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b014630-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the Prim's Algorithm page to encapsulate common interactions and queries
class PrimPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generateGraph');
    this.startBtn = page.locator('#startAlgorithm');
    this.stepBtn = page.locator('#stepAlgorithm');
    this.resetBtn = page.locator('#resetAlgorithm');
    this.stepsContainer = page.locator('#stepsContainer');
    this.canvas = page.locator('#graphCanvas');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async isDisabled(locator) {
    return await locator.evaluate((el) => el.disabled === true);
  }

  async getStepsText() {
    return await this.stepsContainer.innerText();
  }

  async countStepMessagesContaining(text) {
    return await this.page.locator('#stepsContainer .step', { hasText: text }).count();
  }

  async waitForStepText(text, timeout = 5000) {
    return await this.page.waitForSelector(`#stepsContainer .step:text-is("${text}")`, { timeout });
  }
}

test.describe("Prim's Algorithm Visualization - FSM Tests (6b014630-d5c3-11f0-b41f-b131cbd11f51)", () => {
  // Collect console errors and page errors per test to assert no unexpected errors are thrown
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Collect unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Helper assertion to ensure there were no console or page errors during a test
  async function assertNoErrors() {
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${pageErrors.map(e => e.toString()).join('\n')}`).toBe(0);
  }

  test('Initial state S0_Idle: On page load generateRandomGraph() should have run (UI initial state)', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle), where generateRandomGraph() is executed on load.
    const prim = new PrimPage(page);
    await prim.goto();

    // Verify initial UI states (per HTML/JS defaults and generateRandomGraph side effects):
    // - "Next Step" and "Reset" should be disabled
    // - "Start Algorithm" should be enabled
    expect(await prim.isDisabled(prim.stepBtn)).toBeTruthy();
    expect(await prim.isDisabled(prim.resetBtn)).toBeTruthy();
    expect(await prim.isDisabled(prim.startBtn)).toBeFalsy();

    // Steps container should be empty (generateRandomGraph clears steps)
    const stepsText = await prim.getStepsText();
    expect(stepsText.trim()).toBe('');

    // Canvas should exist and have expected dimensions
    const width = await prim.canvas.getAttribute('width');
    const height = await prim.canvas.getAttribute('height');
    expect(width).toBe('800');
    expect(height).toBe('500');

    // Ensure no console/page errors occurred during initialization
    await assertNoErrors();
  });

  test('GenerateGraph event -> Graph Generated (S1_GraphGenerated): clicking Generate New Graph enables controls', async ({ page }) => {
    // This test validates the GenerateGraph event and transition to Graph Generated (S1_GraphGenerated).
    const prim = new PrimPage(page);
    await prim.goto();

    // Click Generate New Graph
    await prim.clickGenerate();

    // After generating a graph, Start, Step, and Reset should be enabled per event handler
    expect(await prim.isDisabled(prim.startBtn)).toBeFalsy();
    expect(await prim.isDisabled(prim.stepBtn)).toBeFalsy();
    expect(await prim.isDisabled(prim.resetBtn)).toBeFalsy();

    // Steps container should still be empty (generateRandomGraph resets steps)
    const stepsText = await prim.getStepsText();
    expect(stepsText.trim()).toBe('');

    // No console errors or page errors allowed
    await assertNoErrors();
  });

  test('StartAlgorithm event -> Algorithm Running (S2_AlgorithmRunning): clicking Start begins the algorithm and adds initial step', async ({ page }) => {
    // This test validates transition from Graph Generated to Algorithm Running (S2_AlgorithmRunning)
    // It asserts UI state changes and that the first step ("Started with node 0") appears.
    const prim = new PrimPage(page);
    await prim.goto();

    // Ensure we have a generated graph (generate if needed)
    await prim.clickGenerate();

    // Click Start Algorithm to begin automatic running
    await prim.clickStart();

    // After starting:
    // - Start should be disabled
    // - Next Step should be disabled (automatic mode)
    // - Reset should be enabled
    expect(await prim.isDisabled(prim.startBtn)).toBeTruthy();
    expect(await prim.isDisabled(prim.stepBtn)).toBeTruthy();
    expect(await prim.isDisabled(prim.resetBtn)).toBeFalsy();

    // The algorithm should add an initial step "Started with node 0"
    // Wait up to 5s for that step to appear (it's added synchronously in primsAlgorithm on first run)
    const startedLocator = page.locator('#stepsContainer .step', { hasText: 'Started with node 0' });
    await expect(startedLocator).toHaveCount(1, { timeout: 5000 });

    // No console/page errors should have occurred
    await assertNoErrors();
  });

  test('StepAlgorithm event -> stepping through algorithm to completion (S2_AlgorithmRunning -> S3_AlgorithmComplete)', async ({ page }) => {
    // This test validates stepping through the algorithm using the Next Step button.
    // It will click "Next Step" repeatedly until the completion message is observed.
    const prim = new PrimPage(page);
    await prim.goto();

    // Generate graph to enable step button
    await prim.clickGenerate();

    // Confirm step button enabled
    expect(await prim.isDisabled(prim.stepBtn)).toBeFalsy();

    // Repeatedly click Next Step until completion message appears or until max attempts reached.
    const completionMessage = 'Algorithm complete! Minimum spanning tree found.';
    let completed = false;
    const maxSteps = 20;

    for (let i = 0; i < maxSteps; i++) {
      // Click next step
      await prim.clickStep();

      // Allow a small time for DOM updates (primsAlgorithm and addStep are synchronous, but be resilient)
      await page.waitForTimeout(100);

      // Check for completion message
      const stepsText = await prim.getStepsText();
      if (stepsText.includes(completionMessage)) {
        completed = true;
        break;
      }
      // If step button becomes disabled (algorithm finished), break as well
      if (await prim.isDisabled(prim.stepBtn)) {
        // Check one more time for completion message
        const finalText = await prim.getStepsText();
        if (finalText.includes(completionMessage)) {
          completed = true;
        }
        break;
      }
    }

    expect(completed).toBeTruthy();

    // After completion, Next Step should be disabled
    expect(await prim.isDisabled(prim.stepBtn)).toBeTruthy();

    // No console/page errors throughout stepping
    await assertNoErrors();
  }, { timeout: 30000 });

  test('ResetAlgorithm event resets the algorithm and UI to post-generate state', async ({ page }) => {
    // This test validates that clicking Reset returns the UI to the expected state:
    // steps cleared, reset disabled, start & step enabled.
    const prim = new PrimPage(page);
    await prim.goto();

    // Generate graph and perform some steps
    await prim.clickGenerate();
    await prim.clickStep();
    await prim.clickStep();

    // Ensure there are step entries now
    let stepsText = await prim.getStepsText();
    expect(stepsText.trim().length).toBeGreaterThan(0);

    // Click Reset
    await prim.clickReset();

    // Steps container should be cleared
    stepsText = await prim.getStepsText();
    expect(stepsText.trim()).toBe('');

    // Reset should be disabled after reset
    expect(await prim.isDisabled(prim.resetBtn)).toBeTruthy();

    // Start and Step should be enabled again
    expect(await prim.isDisabled(prim.startBtn)).toBeFalsy();
    expect(await prim.isDisabled(prim.stepBtn)).toBeFalsy();

    // No console/page errors
    await assertNoErrors();
  });

  test('Edge case: clicking Start twice does not duplicate the initial "Started with node 0" step', async ({ page }) => {
    // This test ensures clicking Start twice (the second click is not possible via UI since the button becomes disabled)
    // does not cause duplicate initial steps. We assert the "Started with node 0" string appears exactly once.
    const prim = new PrimPage(page);
    await prim.goto();

    await prim.clickGenerate();

    // Click Start once
    await prim.clickStart();

    // Attempt a second click programmatically: because the button is disabled, it should not trigger another handler.
    // We still attempt it to simulate a misbehaving automation; DOM will prevent action.
    // Use JS to attempt .click() - in browsers, disabled buttons do not dispatch click events.
    await page.evaluate(() => {
      const btn = document.getElementById('startAlgorithm');
      try {
        btn.click();
      } catch (e) {
        // Intentionally swallow any exceptions here - we do not modify page behavior.
      }
    });

    // Allow a short time for any potential side-effects
    await page.waitForTimeout(200);

    // Count occurrences of the initial step message
    const initialCount = await prim.countStepMessagesContaining('Started with node 0');
    expect(initialCount).toBe(1);

    // No console/page errors
    await assertNoErrors();
  });

  test('Observe console and page errors during various interactions (must be none)', async ({ page }) => {
    // This test aggregates a sequence of interactions and ensures no console/page errors occur.
    const prim = new PrimPage(page);
    await prim.goto();

    // Rapid sequence of interactions to try surface errors:
    await prim.clickGenerate();
    await prim.clickStep();
    await prim.clickStep();
    await prim.clickReset();
    await prim.clickGenerate();
    await prim.clickStart();

    // Wait briefly for any async timeouts to schedule
    await page.waitForTimeout(500);

    // Ensure no console or page errors were recorded
    await assertNoErrors();
  });
});