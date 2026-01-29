import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9c4861-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for interacting with the neural network visualization page
class NetworkPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#btn-start');
    this.resetButton = page.locator('#btn-reset');
    this.svg = page.locator('#network-viz');
  }

  // Navigate to the app URL and wait for SVG to initialize
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main SVG to be present
    await this.svg.waitFor({ state: 'visible', timeout: 5000 });
  }

  // Click the start button and wait a tick for UI changes
  async clickStart() {
    await this.startButton.click();
  }

  // Click the reset button and wait a tick for UI changes
  async clickReset() {
    await this.resetButton.click();
  }

  // Get the visible text of the start button
  async getStartButtonText() {
    return await this.startButton.innerText();
  }

  // Get aria-pressed attribute value of the start button
  async getStartAriaPressed() {
    return await this.startButton.getAttribute('aria-pressed');
  }

  // Return number of elements currently with .highlight class
  async countHighlights() {
    return await this.page.locator('.highlight').count();
  }

  // Wait for any of the specified selectors to gain the .highlight class
  // Useful to detect animation progress (arrows/neuron highlights)
  async waitForAnyHighlight(selectors, opts = { timeout: 5000 }) {
    const promises = selectors.map(s => this.page.locator(s + '.highlight').waitFor({ state: 'visible', timeout: opts.timeout }).then(() => s).catch(() => null));
    const results = await Promise.all(promises);
    return results.find(r => r !== null) || null;
  }

  // Check that a path element has a non-empty 'd' attribute (initialized arrow)
  async getPathD(pathSelector) {
    return await this.page.locator(pathSelector).getAttribute('d');
  }

  // Helper to wait until highlights have been cleared (no .highlight)
  async waitForNoHighlights(timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const count = await this.countHighlights();
      if (count === 0) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }
}

test.describe('Backpropagation Visualization - FSM and UI tests', () => {
  let page;
  let network;
  // Collect console error-level messages and page errors
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of level 'error' for assertion
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // ignore capturing errors in listener itself
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    network = new NetworkPage(page);
    await network.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial state (S0_Idle): buttons, highlights, and arrows initialized', async () => {
    // Validate the start button shows "Start Animation" and aria-pressed="false"
    const startText = await network.getStartButtonText();
    expect(startText).toContain('Start Animation');

    const ariaPressed = await network.getStartAriaPressed();
    expect(ariaPressed).toBe('false');

    // On entry to Idle, resetHighlighting() should have been called.
    // Verify that no elements are highlighted initially.
    const highlightCount = await network.countHighlights();
    expect(highlightCount).toBe(0);

    // Validate that several arrow paths have a syntactically valid d attribute after initialization
    const samplePaths = [
      '#f-i1-h1',
      '#f-h1-o1',
      '#b-o1-h1',
      '#b-h1-i1'
    ];
    for (const sel of samplePaths) {
      const d = await network.getPathD(sel);
      // The path 'd' should be a non-empty string starting with 'M'
      expect(typeof d).toBe('string');
      expect(d.length).toBeGreaterThan(0);
      expect(d.trim().charAt(0)).toBe('M');
    }

    // Ensure no console errors or uncaught page errors occurred during load/initialization
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('StartAnimation event transitions Idle -> Animating (S0 -> S1) and produces visual highlights', async () => {
    // Click start to enter Animating state
    await network.clickStart();

    // Button text should change to "Stop Animation" and aria-pressed become "true"
    await expect(network.startButton).toHaveText(/Stop Animation/i);
    expect(await network.getStartAriaPressed()).toBe('true');

    // The animation sequence highlights input neurons first, and forward arrows/connections later.
    // Wait for any known forward arrow to be highlighted as evidence of animation running.
    const forwardArrowSelectors = [
      '#f-i1-h1', '#f-i2-h2', '#f-h1-o1', '#f-h3-o1'
    ];
    const highlighted = await network.waitForAnyHighlight(forwardArrowSelectors, { timeout: 6000 });
    // At least one forward arrow should have been highlighted during the run
    expect(highlighted, 'Expected at least one forward arrow to be highlighted during animation').not.toBeNull();

    // Also expect some neuron highlight (input or hidden) during forward phase
    const neuronHighlightFound = await network.waitForAnyHighlight(['#n-input-1', '#n-hidden-1', '#n-output-1'], { timeout: 3000 });
    expect(neuronHighlightFound, 'Expected a neuron to be highlighted during forward/backward sequence').not.toBeNull();

    // Ensure no uncaught exceptions were emitted during the start/initial animation period
    expect(consoleErrors.length, `console.error messages during start: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors during start: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Toggling Start while animating stops animation (S1 -> S0) and cleans up highlights', async () => {
    // Start animation
    await network.clickStart();
    await expect(network.startButton).toHaveText(/Stop Animation/i);

    // Let animation start and highlight something
    await network.waitForAnyHighlight(['#f-i1-h1', '#n-input-1'], { timeout: 5000 });

    // Click start again to stop (transition S1 -> S0 via StartAnimation event)
    await network.clickStart();

    // The button should reflect we are back in Idle
    await expect(network.startButton).toHaveText(/Start Animation/i);
    expect(await network.getStartAriaPressed()).toBe('false');

    // ResetHighlighting should have run as part of stopAnimation(), check no .highlight elements exist
    const noHighlights = await network.waitForNoHighlights(3000);
    expect(noHighlights, 'Expected highlights to be cleared after stopping animation').toBe(true);

    // Validate no errors in console or uncaught page errors
    expect(consoleErrors.length, `console.error messages after stop: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after stop: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('ResetAnimation event stops animation and resets all highlights and button state (S1 -> S0 via Reset)', async () => {
    // Start animation and wait for activity
    await network.clickStart();
    await expect(network.startButton).toHaveText(/Stop Animation/i);
    await network.waitForAnyHighlight(['#f-h1-o1', '#n-hidden-1'], { timeout: 6000 });

    // Now click Reset while animating
    await network.clickReset();

    // The Start button should be reset to initial state
    await expect(network.startButton).toHaveText(/Start Animation/i);
    expect(await network.getStartAriaPressed()).toBe('false');

    // All highlights should be cleared immediately by resetHighlighting()
    const noHighlights = await network.waitForNoHighlights(2000);
    expect(noHighlights).toBe(true);

    // Validate no console errors or page exceptions resulted from reset
    expect(consoleErrors.length, `console.error messages after reset: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after reset: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Reset while idle is a no-op (edge case) and does not produce errors', async () => {
    // Ensure idle
    const startText = await network.getStartButtonText();
    expect(startText).toContain('Start Animation');

    // Click reset in Idle state
    await network.clickReset();

    // Start button remains in idle state
    await expect(network.startButton).toHaveText(/Start Animation/i);
    expect(await network.getStartAriaPressed()).toBe('false');

    // No highlights should exist
    const highlightCount = await network.countHighlights();
    expect(highlightCount).toBe(0);

    // Ensure no console errors or page errors
    expect(consoleErrors.length, `console.error messages after idle reset: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors after idle reset: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Rapid toggling and repeated events do not crash the page (robustness / edge-case testing)', async () => {
    // Rapidly toggle start/stop multiple times
    await network.clickStart(); // start
    // small waits to simulate aggressive user
    await new Promise(r => setTimeout(r, 120));
    await network.clickStart(); // stop
    await new Promise(r => setTimeout(r, 120));
    await network.clickStart(); // start
    await new Promise(r => setTimeout(r, 250));
    await network.clickStart(); // stop

    // After rapid toggles ensure page is responsive and buttons reflect deterministic state
    const text = await network.getStartButtonText();
    // After an even number of toggles we expect to be back to Start Animation
    expect(text).toMatch(/Start Animation/i);

    // Try starting again to ensure animation can be resumed after rapid toggles
    await network.clickStart();
    await expect(network.startButton).toHaveText(/Stop Animation/i);

    // Finally reset to bring back to idle
    await network.clickReset();
    await expect(network.startButton).toHaveText(/Start Animation/i);

    // Confirm no console or uncaught page errors occurred during rapid interactions
    expect(consoleErrors.length, `console.error messages during rapid toggles: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors during rapid toggles: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Verify onEnter/onExit actions implied in FSM: resetHighlighting() on Idle entry and stopAnimation() on exit', async () => {
    // At load we are in Idle; verify resetHighlighting left no highlights
    expect(await network.countHighlights()).toBe(0);

    // Start animation -> we should see highlights appear (entry to Animating runs animationSequence)
    await network.clickStart();
    await expect(network.startButton).toHaveText(/Stop Animation/i);
    await network.waitForAnyHighlight(['#n-input-1', '#f-i1-h1'], { timeout: 6000 });

    // Stop animation using the Start button to trigger stopAnimation (exit_actions)
    await network.clickStart();

    // After stopAnimation, resetHighlighting() is also invoked and should clear highlights
    const cleared = await network.waitForNoHighlights(3000);
    expect(cleared).toBe(true);

    // Sanity: Ensure Start button state reflect Idle
    expect(await network.getStartAriaPressed()).toBe('false');

    // No runtime errors should have been emitted
    expect(consoleErrors.length, `console.error messages for onEnter/onExit test: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors for onEnter/onExit test: ${JSON.stringify(pageErrors)}`).toBe(0);
  });
});