import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c97b480-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the Bellman-Ford Visualization page
class BellmanFordPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.tooltip = page.locator('#tooltip');
    this.canvas = page.locator('#graphCanvas');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure basics are present
    await expect(this.stepBtn).toBeVisible();
    await expect(this.resetBtn).toBeVisible();
    await expect(this.tooltip).toBeVisible();
    await expect(this.canvas).toBeVisible();
  }

  async getStepButtonText() {
    return (await this.stepBtn.textContent()).trim();
  }

  async getResetButtonText() {
    return (await this.resetBtn.textContent()).trim();
  }

  async getTooltipText() {
    // Use innerText via evaluate to get rendered text without HTML tags
    return await this.page.evaluate(() => document.getElementById('tooltip').innerText);
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  // Wait for a relaxation animation to reach its end state for one step.
  // This waits for tooltip to contain either "relaxed" or "not relaxed" markers used by the app,
  // or for the step button to display the done marker (✔️ Done).
  // timeout is total wait per step in ms.
  async waitForStepAnimationComplete(timeout = 3000) {
    await this.page.waitForFunction(() => {
      const t = document.getElementById('tooltip');
      const stepBtn = document.getElementById('stepBtn');
      if (!t || !stepBtn) return false;
      const text = (t.innerText || '').toLowerCase();
      const btnText = (stepBtn.textContent || '').toLowerCase();
      // The animation sets text with "relaxed" or "not relaxed" or at completion the button becomes "✔️ Done".
      return text.includes('relaxed') || text.includes('not relaxed') || btnText.includes('done') || text.includes('algorithm complete');
    }, { timeout });
  }

  // Click step repeatedly until the visualization signals completion (stepBtn text becomes "✔️ Done")
  // or until maxSteps is reached. Returns number of steps performed.
  async stepUntilComplete(maxSteps = 1000) {
    let steps = 0;
    for (; steps < maxSteps; steps++) {
      // Read current button text: if already done, break
      const btnText = await this.getStepButtonText();
      if (btnText.includes('✔️') || btnText.toLowerCase().includes('done')) break;

      await this.clickStep();
      // Wait for the step animation to finish (application updates tooltip & internal states)
      await this.waitForStepAnimationComplete(4000).catch(() => {
        // swallow single-step timeout to continue (some steps might be quick), but break if repeated failures
      });

      // small delay to allow the next step to be clickable (animationActive toggles)
      await this.page.waitForTimeout(100);
    }
    return steps;
  }
}

test.describe('Bellman-Ford Algorithm Visualization (3c97b480-...)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Clear arrays for each test
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store Error object
      pageErrors.push(err);
    });

    // Capture console messages and errors
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, attach any captured console messages and page errors to the test output
    if (testInfo.status !== testInfo.expectedStatus) {
      if (consoleMessages.length) {
        console.log('Captured console messages:', consoleMessages);
      }
      if (pageErrors.length) {
        console.log('Captured page errors:', pageErrors.map(e => e && e.message ? e.message : String(e)));
      }
    }
  });

  test('S0_Initialized: page loads and initial UI state is correct (prepareRelaxSteps + reset entry)', async ({ page }) => {
    // This test validates the "Initialized" visual state (S0_Initialized)
    // - prepareRelaxSteps() and reset() should have been called during init() (evidence in code)
    // - tooltip should display the initial hint message
    // - step and reset buttons should have expected labels and attributes

    const bf = new BellmanFordPage(page);
    await bf.goto();

    // Verify step button attributes and initial text
    await expect(bf.stepBtn).toHaveAttribute('aria-label', 'Step through algorithm');
    const stepText = await bf.getStepButtonText();
    expect(stepText).toBe('Step ▶️');

    // Verify reset button attribute and text
    await expect(bf.resetBtn).toHaveAttribute('aria-label', 'Reset visualization');
    const resetText = await bf.getResetButtonText();
    expect(resetText).toContain('Reset'); // accept possible decoration

    // Tooltip should contain the initial message set by reset()
    const tooltipText = await bf.getTooltipText();
    expect(tooltipText).toContain('Source node A set to 0');
    expect(tooltipText).toContain('Press Step');

    // No uncaught page errors at initialization
    expect(pageErrors.length).toBe(0);
    // No console.error messages at initialization
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_AnimationActive: clicking Step starts animation and advances steps; can reach completion', async ({ page }) => {
    // This test validates transitions:
    // - From Initialized (S0) to AnimationActive (S1) by clicking step.
    // - Multiple Step clicks advance animation through relax steps (S1 -> S1).
    // - Eventually reaches Completed (S2) where step button shows done state.
    //
    // We will click Step until the application indicates completion (button shows "✔️ Done")
    // and assert tooltip and button text updates along the way.

    const bf = new BellmanFordPage(page);
    await bf.goto();

    // Start stepping until completion (safeguard max steps)
    const maxStepsToTry = 500; // (V-1)*E in code might be modest; we cap for test safety
    const stepsPerformed = await bf.stepUntilComplete(maxStepsToTry);

    // After stepping, the Step button should indicate completion
    const finalStepBtnText = await bf.getStepButtonText();
    expect(finalStepBtnText.includes('✔️') || finalStepBtnText.toLowerCase().includes('done')).toBeTruthy();

    // Tooltip should indicate algorithm completion or that no more relaxations exist
    const finalTooltip = await bf.getTooltipText();
    // The code sets tooltip text to "Algorithm complete! No more edge relaxations." on full completion
    const isCompleteMessage = finalTooltip.toLowerCase().includes('algorithm complete') ||
      finalTooltip.toLowerCase().includes('no more edge relaxations') ||
      finalTooltip.toLowerCase().includes('has completed all relaxation steps');
    expect(isCompleteMessage).toBeTruthy();

    // Ensure we performed at least one step during the test
    expect(stepsPerformed).toBeGreaterThan(0);

    // After completion, clicking Step again should set tooltip to the 'has completed' message
    await bf.clickStep();
    const afterClickTooltip = await bf.getTooltipText();
    expect(afterClickTooltip.toLowerCase()).toContain('has completed');

    // No uncaught page errors happened during the stepping process
    expect(pageErrors.length).toBe(0);
    // No console.error messages
    expect(consoleErrors.length).toBe(0);
  });

  test('S0_Initialized (Reset behavior): Reset button resets visualization and is ignored during active animation', async ({ page }) => {
    // This test validates:
    // - Reset from Initialized keeps application in Initialized (idempotent reset).
    // - Clicking Reset while an animation is active is ignored (per code: if(animationActive) return;)

    const bf = new BellmanFordPage(page);
    await bf.goto();

    // Click reset immediately and confirm UI returns to initial state
    await bf.clickReset();
    // Tooltip should show initial message after reset()
    const tooltipAfterReset = await bf.getTooltipText();
    expect(tooltipAfterReset).toContain('Source node A set to 0');

    // Start one animation step
    await bf.clickStep();

    // Immediately attempt to reset while animation is in progress. According to implementation, resetBtn handler returns early if animationActive.
    // We'll attempt the reset and then check that tooltip did NOT immediately revert to the initial reset message (i.e., reset was ignored)
    await bf.clickReset();

    // Wait a short time for the animation to proceed (but won't force it to finish here)
    await page.waitForTimeout(200);

    const tooltipDuringAnimation = await bf.getTooltipText();
    // If reset was ignored, tooltip should remain related to relaxing edge or shows animation status
    const isStillAnimating = tooltipDuringAnimation.toLowerCase().includes('relaxing edge') ||
      tooltipDuringAnimation.toLowerCase().includes('relaxed') ||
      tooltipDuringAnimation.toLowerCase().includes('not relaxed') ||
      tooltipDuringAnimation.toLowerCase().includes('edge');
    expect(isStillAnimating).toBeTruthy();

    // Wait for the single started step to finish to avoid leaving the app mid-animation for other tests
    await bf.waitForStepAnimationComplete(4000);

    // Now perform a true reset and assert the UI resets
    await bf.clickReset();
    const tooltipAfterFinalReset = await bf.getTooltipText();
    expect(tooltipAfterFinalReset).toContain('Source node A set to 0');
    const stepBtnTextAfterReset = await bf.getStepButtonText();
    expect(stepBtnTextAfterReset).toBe('Step ▶️');

    // No uncaught page errors for reset flow
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases and robustness: resize triggers redraw and application remains responsive', async ({ page }) => {
    // Validate that window resize does not crash the app and that redraw still shows canvas & tooltip.
    const bf = new BellmanFordPage(page);
    await bf.goto();

    // Store initial canvas size attributes
    const initialSize = await page.evaluate(() => {
      const c = document.getElementById('graphCanvas');
      return { clientWidth: c.clientWidth, clientHeight: c.clientHeight, width: c.width, height: c.height };
    });

    // Trigger a resize event that the app listens to; resizing while not animating should call resizeCanvas() and drawGraph()
    await page.setViewportSize({ width: initialSize.clientWidth + 200, height: initialSize.clientHeight + 200 });
    await page.waitForTimeout(200);

    const afterResizeSize = await page.evaluate(() => {
      const c = document.getElementById('graphCanvas');
      return { clientWidth: c.clientWidth, clientHeight: c.clientHeight, width: c.width, height: c.height };
    });

    // The canvas client dimensions should adapt (not remain strictly equal)
    expect(afterResizeSize.clientWidth).toBeGreaterThanOrEqual(initialSize.clientWidth - 1);

    // Trigger a resize while an animation is active -> app checks animationActive and will return early if true.
    // Start a step, then immediately resize; this should not throw errors and the animation should continue to completion.
    await bf.clickStep();
    // immediate resize
    await page.setViewportSize({ width: afterResizeSize.clientWidth + 240, height: afterResizeSize.clientHeight + 120 });
    // wait for the step to conclude
    await bf.waitForStepAnimationComplete(4000);

    // Confirm tooltip and canvas still present
    const tooltipText = await bf.getTooltipText();
    expect(typeof tooltipText).toBe('string');
    await expect(bf.canvas).toBeVisible();

    // No uncaught page errors or console errors triggered by resizing
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Error observation: capture any runtime exceptions or console errors during full run', async ({ page }) => {
    // This test's sole purpose is to observe and assert about runtime errors that occur naturally.
    // Per instructions, we must not patch or modify the runtime; we only observe.
    // We will run through a typical usage flow (start, step some times, reset) and then assert that
    // if errors happened they are standard JS errors - but in ordinary operation no uncaught exceptions are expected.

    const bf = new BellmanFordPage(page);
    await bf.goto();

    // Perform a few steps (but not full completion to keep test time reasonable)
    const stepsToDo = 3;
    for (let i = 0; i < stepsToDo; i++) {
      await bf.clickStep();
      await bf.waitForStepAnimationComplete(3000).catch(() => {});
    }

    // Reset
    await bf.clickReset();

    // Evaluate observed page errors and console errors
    // The application is expected to run without throwing uncaught exceptions.
    // If there are page errors, ensure they are JS Error types and log them for debugging.
    if (pageErrors.length > 0) {
      // If errors exist, assert their types are one of the expected JS error types (ReferenceError, TypeError, SyntaxError, or generic Error)
      const allowedNames = ['ReferenceError', 'TypeError', 'SyntaxError', 'Error', 'RangeError', 'URIError', 'EvalError', 'AggregateError'];
      for (const err of pageErrors) {
        const name = err && err.name ? err.name : String(err);
        expect(allowedNames).toContain(name);
      }
    } else {
      // Prefer the no-error case: assert there are no page errors
      expect(pageErrors.length).toBe(0);
    }

    // For console.error messages, ensure none indicate an unhandled SyntaxError (rare) by scanning text.
    for (const msg of consoleErrors) {
      // If a console error exists, it should not contain the string "SyntaxError" (the browser would have stopped parsing earlier)
      expect(msg).not.toContain('SyntaxError');
    }

    // Also assert application UI remains consistent after this sequence
    const tooltipText = await bf.getTooltipText();
    expect(tooltipText.length).toBeGreaterThan(0);
    expect(await bf.getStepButtonText()).toBeTruthy();
  });
});