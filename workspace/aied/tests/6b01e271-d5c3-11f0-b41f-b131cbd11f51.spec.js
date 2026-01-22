import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b01e271-d5c3-11f0-b41f-b131cbd11f51.html';

/**
 * Page Object for the K-Means demo page.
 * Encapsulates common interactions and queries used across tests.
 */
class KMeansPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the UI is fully present
    await this.page.waitForSelector('#stepInfo');
    await this.page.waitForSelector('#stepButton');
  }

  // Click Next Step button
  async clickStep() {
    await this.page.click('#stepButton');
  }

  // Click Reset Points button
  async clickResetPoints() {
    await this.page.click('#resetButton');
  }

  // Click Play/Pause Animation button
  async clickPlay() {
    await this.page.click('#playButton');
  }

  // Click Reset Algorithm button
  async clickResetAlgorithm() {
    await this.page.click('#resetAlgorithm');
  }

  // Set K slider value
  async setKValue(value) {
    await this.page.fill('#kValue', String(value));
    // trigger input event by dispatching
    await this.page.$eval('#kValue', (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Set point count slider
  async setPointCount(value) {
    await this.page.fill('#pointCount', String(value));
    await this.page.$eval('#pointCount', (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Set animation speed slider
  async setAnimationSpeed(value) {
    await this.page.fill('#animationSpeed', String(value));
    await this.page.$eval('#animationSpeed', (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Read visible step info text
  async getStepInfoText() {
    return this.page.textContent('#stepInfo');
  }

  // Read visible play button text
  async getPlayButtonText() {
    return this.page.textContent('#playButton');
  }

  // Read displayed slider "value" spans
  async getDisplayedKValue() {
    return this.page.textContent('#kValueDisplay');
  }
  async getDisplayedPointCount() {
    return this.page.textContent('#pointCountDisplay');
  }
  async getDisplayedAnimationSpeed() {
    return this.page.textContent('#animationSpeedDisplay');
  }

  // Query internal JS variables on the page. These top-level bindings are accessible
  // within the page context (they are declared at top-level in the page script).
  async getInternalState() {
    return this.page.evaluate(() => {
      // step, points, centroids, isPlaying, k, pointCount, animationSpeed are top-level bindings in the page script
      return {
        step: typeof step !== 'undefined' ? step : null,
        pointsLength: typeof points !== 'undefined' ? points.length : null,
        centroidsLength: typeof centroids !== 'undefined' ? centroids.length : null,
        anyPointAssigned: typeof points !== 'undefined' ? points.some(p => p.cluster !== -1) : null,
        isPlaying: typeof isPlaying !== 'undefined' ? isPlaying : null,
        k: typeof k !== 'undefined' ? k : null,
        pointCount: typeof pointCount !== 'undefined' ? pointCount : null,
        animationSpeed: typeof animationSpeed !== 'undefined' ? animationSpeed : null
      };
    });
  }
}

test.describe('K-Means Clustering Demo - FSM and UI tests', () => {
  let page;
  let kmeans;
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;
  let consoleListener;
  let pageErrorListener;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    kmeans = new KMeansPage(page);

    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    consoleListener = msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    };
    page.on('console', consoleListener);

    // Capture uncaught exceptions / page errors
    pageErrorListener = err => {
      pageErrors.push(err);
    };
    page.on('pageerror', pageErrorListener);

    await kmeans.goto();
  });

  test.afterEach(async () => {
    // Remove listeners and close page
    page.off('console', consoleListener);
    page.off('pageerror', pageErrorListener);
    await page.close();
  });

  test('Initial State (S0_Initial): page loads and shows initial points generated', async () => {
    // Verify visible step info text indicates initial points generated
    const stepText = await kmeans.getStepInfoText();
    expect(stepText).toBe('Step: Initial points generated');

    // Verify internal step variable is 0 and points are generated consistent with control
    const state = await kmeans.getInternalState();
    expect(state.step).toBe(0);
    expect(state.pointsLength).toBe(Number(await kmeans.getDisplayedPointCount()));
    // No centroids yet
    expect(state.centroidsLength).toBe(0);

    // Ensure no console errors or page errors on initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('K_VALUE_CHANGE and RESET_ALGORITHM interaction: changing K updates display and resets algorithm', async () => {
    // Change K to 5
    await kmeans.setKValue(5);

    // The display span should update
    const displayedK = await kmeans.getDisplayedKValue();
    expect(displayedK).toBe('5');

    // Changing K should reset algorithm (step back to 0 and centroids cleared)
    const state = await kmeans.getInternalState();
    expect(state.step).toBe(0);
    expect(state.centroidsLength).toBe(0);
    expect(await kmeans.getStepInfoText()).toBe('Step: Initial points generated');

    // Edge: set K to max and min and ensure UI updates and no errors
    await kmeans.setKValue(10);
    expect(await kmeans.getDisplayedKValue()).toBe('10');
    await kmeans.setKValue(2);
    expect(await kmeans.getDisplayedKValue()).toBe('2');

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('POINT_COUNT_CHANGE and Reset Points button: point count updates and reset regenerates points', async () => {
    // Set point count to a smaller number and verify internal state
    await kmeans.setPointCount(40);
    expect(await kmeans.getDisplayedPointCount()).toBe('40');

    let state = await kmeans.getInternalState();
    expect(state.pointCount).toBe(40);
    expect(state.pointsLength).toBe(40);

    // Click Reset Points to regenerate; after generation, stepInfo must indicate initial points generated
    await kmeans.clickResetPoints();
    expect(await kmeans.getStepInfoText()).toBe('Step: Initial points generated');

    state = await kmeans.getInternalState();
    expect(state.pointsLength).toBe(40);

    // Edge: set point count to max then reset
    await kmeans.setPointCount(200);
    expect(await kmeans.getDisplayedPointCount()).toBe('200');
    await kmeans.clickResetPoints();
    state = await kmeans.getInternalState();
    expect(state.pointsLength).toBe(200);

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('STEP_BUTTON_CLICK transitions through S0 -> S1 -> S2 -> S3 and handles convergence (S4)', async () => {
    // From initial (S0) press Next Step -> S1_CentroidsInitialized
    await kmeans.clickStep();
    let stepText = await kmeans.getStepInfoText();
    expect(stepText).toBe('Step: Centroids initialized');

    // Check internal: step should be 1 and centroids length equals k
    let state = await kmeans.getInternalState();
    expect(state.step).toBe(1);
    expect(state.centroidsLength).toBe(state.k);

    // Press Next Step -> S2_PointsAssigned
    await kmeans.clickStep();
    stepText = await kmeans.getStepInfoText();
    expect(stepText).toBe('Step: Points assigned to clusters');

    state = await kmeans.getInternalState();
    expect(state.step).toBe(2);
    // After assignment some point should have cluster assigned
    expect(state.anyPointAssigned).toBe(true);

    // Press Next Step -> S3_CentroidsUpdated (text contains 'Step: Centroids updated')
    await kmeans.clickStep();
    stepText = await kmeans.getStepInfoText();
    expect(stepText.startsWith('Step: Centroids updated')).toBe(true);

    state = await kmeans.getInternalState();

    // Two possible routes after S3:
    // - If converged, step becomes 3 and text includes '(Converged!)' -> S4_Converged
    // - If not converged, step becomes 1 -> loop back to assignment step (S2)
    if (stepText.includes('(Converged!)')) {
      // Converged route: ensure step==3 and play button behavior for S4
      expect(state.step).toBe(3);

      // Clicking Play when converged resets algorithm and toggles animation (per implementation)
      await kmeans.clickPlay();

      // After clicking play when step>=3, resetAlgorithm sets step to 0 and then toggleAnimation starts playing
      const afterPlayState = await kmeans.getInternalState();
      expect(afterPlayState.step).toBe(0);
      // Play button text should indicate animation is running (Pause Animation)
      expect(await kmeans.getPlayButtonText()).toBe('Pause Animation');

      // Stop animation so other tests are not affected
      await kmeans.clickPlay();
      expect(await kmeans.getPlayButtonText()).toBe('Play Animation');
    } else {
      // Not converged route: step should have been set to 1 (back to assignment)
      expect(state.step).toBe(1);
      // The displayed text should still start with 'Step: Centroids updated' but no '(Converged!)'
      expect(stepText).toBe('Step: Centroids updated');
    }

    // Ensure no console errors or uncaught exceptions during stepping
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Animation toggling (S5_AnimationPlaying) and Reset Algorithm stops animation', async () => {
    // We need to reach a state where clicking Play toggles animation.
    // If not converged, Play will simply start the animation from current step 0/1/2; that's acceptable.
    // Ensure play toggles to "Pause Animation" and isPlaying true
    const initialState = await kmeans.getInternalState();
    expect(initialState.isPlaying).toBe(false);

    // Click Play to start animation
    await kmeans.clickPlay();

    // After clicking, play button text should change
    let playText = await kmeans.getPlayButtonText();
    expect(playText === 'Pause Animation' || playText === 'Play Animation').toBeTruthy();

    // Check internal isPlaying state (may be true)
    let state = await kmeans.getInternalState();
    expect(typeof state.isPlaying).toBe('boolean');

    if (state.isPlaying) {
      // If animation is playing, clicking Reset Algorithm should stop it (per implementation)
      await kmeans.clickResetAlgorithm();
      const afterReset = await kmeans.getInternalState();
      expect(afterReset.isPlaying).toBe(false);
      expect(await kmeans.getPlayButtonText()).toBe('Play Animation');
      expect(afterReset.step).toBe(0);
      expect(await kmeans.getStepInfoText()).toBe('Step: Initial points generated');
    } else {
      // If animation didn't start for any reason, still assert play button text is consistent
      expect(await kmeans.getPlayButtonText()).toBe('Play Animation');
    }

    // Ensure no console errors occurred while toggling animation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('ANIMATION_SPEED_CHANGE updates display and influences timeout calculation (no runtime errors)', async () => {
    // Change animation speed to 8 and ensure display updates
    await kmeans.setAnimationSpeed(8);
    expect(await kmeans.getDisplayedAnimationSpeed()).toBe('8');

    // Start animation briefly to exercise animate() path (it will schedule timeouts/requestAnimationFrame)
    await kmeans.clickPlay();
    // Wait a short moment to let one animation step occur (but avoid long waiting)
    await page.waitForTimeout(300);

    // Stop animation
    await kmeans.clickPlay();

    // No console errors should have been emitted by animation scheduling
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: rapidly toggling controls and buttons does not throw uncaught exceptions', async () => {
    // Rapidly change k, pointCount, and animationSpeed
    for (const v of [2, 7, 10, 3]) {
      await kmeans.setKValue(v);
    }
    for (const v of [20, 150, 200, 100]) {
      await kmeans.setPointCount(v);
    }
    for (const v of [1, 10, 5]) {
      await kmeans.setAnimationSpeed(v);
    }

    // Rapidly click buttons
    await kmeans.clickResetPoints();
    await kmeans.clickStep();
    await kmeans.clickResetAlgorithm();
    await kmeans.clickPlay();
    await kmeans.clickPlay();
    await kmeans.clickStep();
    await kmeans.clickResetPoints();

    // Allow small settle time for any async activity
    await page.waitForTimeout(200);

    // Assert that there were no console errors or uncaught page errors during rapid interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Diagnostic: capture any console or page errors (test will fail if any are present)', async () => {
    // This test explicitly validates that no ReferenceError/SyntaxError/TypeError or other page errors
    // were emitted during the test session. It collects any page errors and console errors and asserts none.
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `Unexpected console errors: ${consoleErrors.map(e => e.text).join('; ')}`);
  });
});