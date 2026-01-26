import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b45410-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Backpropagation demo page
class BackpropPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    this._consoleListener = (msg) => {
      try {
        // capture the text representation of the console message
        this.consoleMessages.push(msg.text());
      } catch (e) {
        // ignore
      }
    };
    this._pageErrorListener = (err) => {
      try {
        this.pageErrors.push(err.message);
      } catch (e) {
        // ignore
      }
    };
  }

  // Attach listeners to capture console logs and uncaught page errors BEFORE navigation
  attachListeners() {
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  // Detach listeners (cleanup)
  detachListeners() {
    this.page.off('console', this._consoleListener);
    this.page.off('pageerror', this._pageErrorListener);
  }

  // Navigate to the app URL and wait for the page's load event.
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Get the demo button handle
  async getDemoButton() {
    return this.page.locator('#backpropagation-demo');
  }

  // Click the demo button
  async clickDemoButton() {
    const btn = await this.getDemoButton();
    await btn.click();
  }

  // Return collected console messages
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  // Return collected page errors
  getPageErrors() {
    return this.pageErrors.slice();
  }

  // Helper to count occurrences of a substring in console messages
  countConsoleOccurrences(substr) {
    return this.consoleMessages.reduce((count, msg) => count + (msg.includes(substr) ? 1 : 0), 0);
  }

  // Check whether the global function backpropagationDemo exists (read-only check)
  async hasGlobalBackpropFunction() {
    return this.page.evaluate(() => typeof window.backpropagationDemo === 'function');
  }
}

test.describe('Backpropagation Interactive Application (f5b45410-...)', () => {
  // Each test will create fresh listeners and navigate to the page.
  test('S0_Idle: Page renders and shows the "Click to Demonstrate Backpropagation" button', async ({ page }) => {
    // Arrange: prepare page object and attach listeners before navigation
    const app = new BackpropPage(page);
    app.attachListeners();

    // Act: navigate to the page
    await app.goto();

    // Assert: button is present and visible with correct text
    const button = await app.getDemoButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Click to Demonstrate Backpropagation');

    // Assert: the global function exists on the window (read-only check)
    const hasFunction = await app.hasGlobalBackpropFunction();
    // We assert it exists as the implementation defines it in the page's script tag
    expect(hasFunction).toBe(true);

    // Cleanup
    app.detachListeners();
  });

  test('S1_Demonstrating (automatic run on load): backpropagationDemo() runs on load and logs expected output', async ({ page }) => {
    // This test validates that backpropagationDemo is invoked during page load (it's called at the bottom of the HTML)
    // and that the console output contains "Final Weights:" and "Final Biases:" as evidence of the "Demonstrating" state.
    const app = new BackpropPage(page);

    // Capture console logs and page errors before navigation so we don't miss messages emitted during load.
    app.attachListeners();

    // Wait for the "Final Weights:" console output to appear (or timeout if not). The implementation does synchronous work,
    // so waiting for the console event is appropriate.
    const finalWeightsPromise = page.waitForEvent('console', {
      predicate: msg => msg.text().includes('Final Weights:'),
      timeout: 5000
    });

    // Navigate to the page (this triggers the immediate call to backpropagationDemo())
    await app.goto();

    // Wait for the expected console message to appear (ensures the demo completed its compute loop)
    const consoleEvent = await finalWeightsPromise;
    expect(consoleEvent.text()).toContain('Final Weights:');

    // After the "Final Weights:" line, implementation also logs arrays of weights and then "Final Biases:" and biases.
    // Ensure the captured console messages include both markers.
    const msgs = app.getConsoleMessages();

    // There should be at least one message that contains "Final Weights:" and one that contains "Final Biases:"
    const hasFinalWeights = msgs.some(m => m.includes('Final Weights:'));
    const hasFinalBiases = msgs.some(m => m.includes('Final Biases:'));
    expect(hasFinalWeights).toBe(true);
    expect(hasFinalBiases).toBe(true);

    // Additional assertion: biases were printed (the biases array should appear as another console message)
    const biasesMessages = msgs.filter(m => m.includes('Final Biases:') || m.match(/^\[.*\]$/m));
    expect(biasesMessages.length).toBeGreaterThanOrEqual(1);

    // Ensure no uncaught page errors were emitted during the run.
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Cleanup
    app.detachListeners();
  });

  test('Event: ClickBackpropagationDemo - clicking the button does not throw and does not necessarily trigger another demo run (no click handler attached)', async ({ page }) => {
    // This test validates the FSM event ClickBackpropagationDemo by interacting with the button.
    // The implementation calls backpropagationDemo() on load, but DOES NOT attach an explicit click handler to the button.
    // Therefore, we assert the button click does not crash the page and we observe whether another run happens (likely not).
    const app = new BackpropPage(page);
    app.attachListeners();

    // Navigate and wait for initial demo to finish (wait for Final Weights to ensure initial run completed)
    await page.waitForEvent('console', {
      predicate: msg => msg.text().includes('Final Weights:'),
      timeout: 5000
    });
    await app.goto();

    // Record counts of the evidence messages before clicking
    const beforeFinalWeightsCount = app.countConsoleOccurrences('Final Weights:');
    const beforeFinalBiasesCount = app.countConsoleOccurrences('Final Biases:');

    // Act: click the button (this simulates the FSM event trigger)
    await app.clickDemoButton();

    // Allow a brief moment to collect any console output that might result from the click
    await page.waitForTimeout(500);

    // Re-evaluate counts after clicking
    const afterFinalWeightsCount = app.countConsoleOccurrences('Final Weights:');
    const afterFinalBiasesCount = app.countConsoleOccurrences('Final Biases:');

    // Assert: clicking the button did not cause an uncaught exception
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Because no click handler is attached in the HTML, clicking should NOT have triggered an additional demonstration run.
    // Therefore counts should remain the same.
    expect(afterFinalWeightsCount).toBe(beforeFinalWeightsCount);
    expect(afterFinalBiasesCount).toBe(beforeFinalBiasesCount);

    // For completeness, assert the button remains visible and enabled after clicking
    const button = await app.getDemoButton();
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();

    app.detachListeners();
  });

  test('Edge cases & discrepancy detection: verify that the demo was executed automatically on load (transition without click) and that the page does not attach click listener', async ({ page }) => {
    // This test highlights the mismatch between the FSM (which expects click to initiate demo)
    // and the actual implementation (which invokes the demo at load time).
    const app = new BackpropPage(page);
    app.attachListeners();

    // Navigate and wait for the "Final Weights:" console output to ensure automatic run occurred
    await page.waitForEvent('console', {
      predicate: msg => msg.text().includes('Final Weights:'),
      timeout: 5000
    });
    await app.goto();

    // The presence of "Final Weights:" indicates that the "Demonstrating" state was entered without a user click.
    const autoRunCount = app.countConsoleOccurrences('Final Weights:');
    expect(autoRunCount).toBeGreaterThanOrEqual(1);

    // Check if a click handler is attached to the button by attempting to dispatch a click and observing if another run occurs.
    const before = app.countConsoleOccurrences('Final Weights:');
    await app.clickDemoButton();
    await page.waitForTimeout(400); // short wait for any possible console output

    const after = app.countConsoleOccurrences('Final Weights:');

    // If the implementation had wired a click handler that invokes the demo, `after` would > `before`.
    // The real implementation does not attach such a handler, so counts remain equal — we assert and document this as an observed discrepancy.
    expect(after).toBe(before);

    // Ensure no uncaught errors occurred during these interactions
    expect(app.getPageErrors().length).toBe(0);

    app.detachListeners();
  });
});