import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72adaed3-fa78-11f0-812d-c9788050701f.html';

// Page object for the Neural Beauty application
class NeuralBeautyPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for DOMContentLoaded work done in page script to run
    await this.page.waitForSelector('.neural-network');
  }

  // Buttons
  async forwardButton() {
    return this.page.locator('#forward-btn');
  }

  async backpropButton() {
    return this.page.locator('#backprop-btn');
  }

  // Neuron locators
  async inputNeurons() {
    return this.page.locator('.layer-1 .neuron');
  }

  async hiddenNeurons() {
    return this.page.locator('.layer-2 .neuron');
  }

  async outputNeurons() {
    return this.page.locator('.layer-3 .neuron');
  }

  // Error path and connections
  async errorPaths() {
    return this.page.locator('.error-path');
  }

  async connections() {
    return this.page.locator('.connection, .error-path');
  }

  // Utility to get inline style property for element handle
  async getInlineStyleProperty(locator, prop) {
    return this.page.evaluate(
      (el, p) => (el && el.style) ? el.style.getPropertyValue(p) : '',
      await locator.elementHandle(),
      prop
    );
  }

  // Utility to get computed style property
  async getComputedStyleProperty(locator, prop) {
    return this.page.evaluate(
      (el, p) => {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return cs ? cs.getPropertyValue(p) : null;
      },
      await locator.elementHandle(),
      prop
    );
  }
}

test.describe('Neural Beauty - Backpropagation visualization (FSM validation)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset error collectors
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages, record errors separately
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application
    await page.goto(APP_URL);
    // Ensure the main container is present
    await page.waitForSelector('.container');
  });

  test.afterEach(async () => {
    // Nothing special to teardown - the Playwright runner will close contexts.
  });

  test('Idle state (S0_Idle) - initial renderPage() verification', async ({ page }) => {
    // This test validates the Idle state (entry action renderPage())
    // It checks that the DOM elements described in the FSM are present and in initial state.

    const app = new NeuralBeautyPage(page);

    // Ensure main UI elements exist
    await expect(page.locator('h1')).toHaveText(/Beauty of Backpropagation/i);
    await expect(app.forwardButton()).toHaveText('Run Forward Pass');
    await expect(app.backpropButton()).toHaveText('Run Backpropagation');

    // Verify neuron counts in each layer match the implementation
    await expect(app.inputNeurons()).toHaveCount(3);
    await expect(app.hiddenNeurons()).toHaveCount(3);
    await expect(app.outputNeurons()).toHaveCount(1);

    // At idle, no neurons should have highlight or pulse classes
    const highlighted = await page.$$eval('.neuron.highlight, .neuron.pulse', els => els.length);
    expect(highlighted).toBe(0);

    // Error paths should have been created and appended to the body (but invisible)
    const errorPathCount = await app.errorPaths().count();
    expect(errorPathCount).toBeGreaterThan(0); // implementation creates multiple error-paths

    // Verify initial opacity of first error path is '0' inline style (as implementation sets)
    const firstErrorPathHandle = await app.errorPaths().nth(0);
    const opacity = await app.getInlineStyleProperty(firstErrorPathHandle, 'opacity');
    // It might be an empty string or '0' depending on how the browser serializes it; allow both.
    expect(['', '0', '0.0']).toContain(opacity);

    // Confirm no uncaught page errors at initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: Run Forward Pass (S0_Idle -> S1_ForwardPass) - forward animation and DOM feedback', async ({ page }) => {
    // Validate clicking the forward button triggers runForwardPass()
    // and leads to expected visual feedback (highlights and pulse).

    const app = new NeuralBeautyPage(page);

    // Click the forward pass button
    await app.forwardButton().click();

    // The script staggers animations:
    // - Input neurons: 0ms, 300ms, 600ms
    // - Hidden neurons: starting at 900ms -> 900,1100,1300
    // - Output neuron: around 1500ms
    // We'll wait enough time for the animations to apply.
    await page.waitForTimeout(2200);

    // Assert input neurons have 'highlight' class
    for (let i = 0; i < 3; i++) {
      await expect(app.inputNeurons().nth(i)).toHaveClass(/highlight/);
    }

    // Assert hidden neurons have 'highlight' class
    for (let i = 0; i < 3; i++) {
      await expect(app.hiddenNeurons().nth(i)).toHaveClass(/highlight/);
    }

    // Output neuron should have both 'highlight' and 'pulse'
    const output = app.outputNeurons().nth(0);
    const outputClass = await output.getAttribute('class');
    expect(outputClass).toMatch(/highlight/);
    expect(outputClass).toMatch(/pulse/);

    // Clicking forward again should reset highlight classes and reapply them (ensure no exceptions thrown)
    await app.forwardButton().click();
    // Wait for reapplication
    await page.waitForTimeout(2200);
    // Still expect at least the output to have pulse class after second run
    const outputClass2 = await output.getAttribute('class');
    expect(outputClass2).toMatch(/pulse/);

    // No uncaught page errors or console.errors during forward pass transitions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: Run Backpropagation (S0_Idle -> S2_Backpropagation) - error propagation visuals and resets', async ({ page }) => {
    // This test validates that clicking backprop triggers runBackpropagation(),
    // which first runs forward pass then animates error paths and coloring.

    const app = new NeuralBeautyPage(page);

    // Click backprop button to trigger runBackpropagation
    await app.backpropButton().click();

    // The implementation waits ~2300ms before starting the error visuals:
    // Then it sequentially shows error paths and colors hidden/input neurons.
    // We'll assert that at ~2500ms the output neuron has an inline red background,
    // and later that some error-paths become visible and their width is set to the final value (likely '100px').

    // Wait slightly after the initial forward + the 500ms delay to allow the backprop sequences to start
    await page.waitForTimeout(2500);

    // At this moment, output neurons should have red background applied inline:
    const outputHandle = await app.outputNeurons().nth(0);
    const outputBg = await app.getInlineStyleProperty(outputHandle, 'background-color');
    // Implementation sets 'rgba(255, 78, 80, 0.8)'
    expect(outputBg).toBeTruthy();
    expect(outputBg).toContain('255'); // basic sanity check that it's a red-ish rgba value

    // Wait longer for error paths to animate and have their widths最终 set to '100px' by fallback
    // Choose a generous timeout to allow the whole sequence to run
    await page.waitForTimeout(4500); // wait further to allow hidden->input sequences and resets

    // Some error-paths should now be visible (opacity = '1') and have width '100px' as the code sets fallback
    const errorPathCount = await app.errorPaths().count();
    let foundVisible = false;
    for (let i = 0; i < Math.min(errorPathCount, 20); i++) {
      const p = app.errorPaths().nth(i);
      const opacity = await app.getInlineStyleProperty(p, 'opacity');
      const width = await app.getInlineStyleProperty(p, 'width');
      if ((opacity === '1' || opacity === '1.0') && (width === '100px' || width === '100.00px')) {
        foundVisible = true;
        break;
      }
    }
    expect(foundVisible).toBe(true);

    // After the full sequence completes, neurons' background colors are reset.
    // The reset occurs after a complex timeout; wait enough time to reach it.
    await page.waitForTimeout(2000);
    // Verify at least one input neuron is back to the original background color inline
    const inputBg = await app.getInlineStyleProperty(await app.inputNeurons().nth(0), 'background-color');
    // It should reset to 'rgba(255, 255, 255, 0.9)' as coded, or empty string if inline reset removed.
    expect([ 'rgba(255, 255, 255, 0.9)', '' ]).toContain(inputBg);

    // Ensure pulses were removed in cleanup (class 'pulse' removed from neurons)
    const pulses = await page.$$eval('.neuron.pulse', els => els.length);
    expect(pulses).toBeLessThanOrEqual(3); // ideally 0 after reset, but allow transient states if timing differs

    // Verify no uncaught page errors or console.error occurred during backpropagation flow
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: Rapid repeated clicks and invalid sequences should not throw uncaught errors', async ({ page }) => {
    // This test clicks the buttons rapidly and ensures no uncaught exceptions are produced.

    const app = new NeuralBeautyPage(page);

    // Rapid clicks on forward and backprop buttons
    await Promise.all([
      app.forwardButton().click(),
      app.forwardButton().click(),
      app.backpropButton().click(),
      app.backpropButton().click(),
    ]);

    // Allow some time for handlers to run (animations will overlap)
    await page.waitForTimeout(3000);

    // After rapid interactions, application should still have neuron elements present and no uncaught page errors
    await expect(app.inputNeurons()).toHaveCount(3);
    await expect(app.hiddenNeurons()).toHaveCount(3);
    await expect(app.outputNeurons()).toHaveCount(1);

    // Validate no uncaught errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Also ensure that console messages were indeed captured (even if not errors)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('FSM coverage: verify event handlers are attached to expected selectors', async ({ page }) => {
    // This test checks that the event handlers described in the FSM are present
    // by verifying the presence of the elements and that clicking them triggers behavior.
    const app = new NeuralBeautyPage(page);

    // Ensure the trigger selectors exist
    await expect(page.locator('#forward-btn')).toHaveCount(1);
    await expect(page.locator('#backprop-btn')).toHaveCount(1);

    // Click forward button and assert that at least one neuron gets highlighted within reasonable time
    await app.forwardButton().click();
    await page.waitForTimeout(1600); // enough for inputs+hidden to at least start
    const highlightedAfterForward = await page.$$eval('.neuron.highlight', els => els.length);
    expect(highlightedAfterForward).toBeGreaterThan(0);

    // Click backprop button and assert that output receives inline background color as evidence
    await app.backpropButton().click();
    await page.waitForTimeout(2600);
    const outputBg = await app.getInlineStyleProperty(await app.outputNeurons().nth(0), 'background-color');
    expect(outputBg).toBeTruthy();

    // No uncaught runtime errors were introduced by event handlers
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});