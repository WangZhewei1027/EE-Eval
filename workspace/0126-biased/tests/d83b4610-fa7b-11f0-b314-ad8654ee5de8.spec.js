import { test, expect } from '@playwright/test';

// Page object for the tiny KNN demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtnSelector = '#runDemo';
    this.resultSelector = '#demoResult';
  }

  async goto() {
    // Load the exact page under test (do not modify or patch the page)
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/d83b4610-fa7b-11f0-b314-ad8654ee5de8.html', { waitUntil: 'load' });
  }

  // Get the run demo button element handle
  async getRunButton() {
    return await this.page.waitForSelector(this.runBtnSelector, { state: 'attached' });
  }

  // Get the result container
  async getResult() {
    return await this.page.waitForSelector(this.resultSelector, { state: 'attached' });
  }

  // Click the Run simple demo button (native click - obeys disabled state)
  async clickRunDemo() {
    const btn = await this.getRunButton();
    await btn.click();
  }

  // Read the innerHTML of the result container
  async getResultHTML() {
    const el = await this.getResult();
    return await el.evaluate(node => node.innerHTML);
  }

  // Read the computed style display property of result
  async isResultVisible() {
    const el = await this.getResult();
    return await el.evaluate(node => {
      const style = window.getComputedStyle(node);
      return style && style.display !== 'none';
    });
  }

  async getButtonText() {
    const btn = await this.getRunButton();
    return await btn.evaluate(b => b.textContent);
  }

  async isButtonDisabled() {
    const btn = await this.getRunButton();
    return await btn.evaluate(b => b.disabled === true);
  }
}

test.describe('K-Nearest Neighbors demo (FSM states & transitions)', () => {
  // Collect runtime errors and console errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console.error messages
    page.on('console', msg => {
      // Collect only error-level console messages for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Listen for uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      // Capture the Error object
      pageErrors.push({ message: err.message, stack: err.stack });
    });
  });

  test.afterEach(async () => {
    // After each test we assert that no unexpected runtime errors were emitted.
    // This validates that loading and interacting with the page did not produce uncaught exceptions.
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
  });

  test('Idle state (S0_Idle) is rendered correctly on load', async ({ page }) => {
    // This test validates the Idle state's entry action renderPage() by checking DOM elements.
    const demo = new DemoPage(page);
    await demo.goto();

    // Verify the Run simple demo button exists, visible, enabled, and has correct attributes and text
    const btn = await demo.getRunButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('class', 'demo-btn');
    await expect(btn).toHaveAttribute('aria-controls', 'demoResult');
    await expect(btn).toHaveText('Run simple demo');

    // Verify the result container exists and is initially hidden (style display:none)
    const result = await demo.getResult();
    // The element is present but should be hidden visually
    const isVisible = await demo.isResultVisible();
    expect(isVisible).toBe(false);

    // Ensure the result container has role=status and aria-live attributes as per component definition
    await expect(result).toHaveAttribute('role', 'status');
    await expect(result).toHaveAttribute('aria-live', 'polite');
  });

  test('Transition RunDemo: clicking runs demo, computes distances, displays results and disables button (S0 -> S1, onExit)', async ({ page }) => {
    // This test validates the RunDemo event and the S1_DemoRunning->S0_Idle expected exit actions:
    // - computeDistances() is invoked (observed via produced HTML showing distances)
    // - displayResults() effects: result.style.display = 'block'
    // - btn.disabled = true and btn.textContent changed to 'Demo displayed'
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the button to run the simple demo (triggers the click handler in page JS)
    await demo.clickRunDemo();

    // After clicking, the result should become visible
    await expect.poll(async () => await demo.isResultVisible(), { timeout: 2000 }).toBe(true);

    // The button should be disabled and text changed to 'Demo displayed'
    await expect(await demo.isButtonDisabled()).toBe(true);
    await expect(await demo.getButtonText()).toBe('Demo displayed');

    // The result innerHTML should contain structured output including the distances table, selected neighbors, and predictions
    const html = await demo.getResultHTML();

    // Check that the distances table header appears
    expect(html).toContain('All distances (sorted smallest → largest)');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Point</th>');
    expect(html).toContain('<th>Distance</th>');

    // The computed first (smallest) distance should be point C ≈ 1.118 (formatted to 3 decimals)
    // Check that a table row exists for C with distance 1.118
    expect(html).toMatch(/<tr><td>C<\/td><td>Blue<\/td><td>1\.118<\/td><\/tr>/);

    // Verify the selected neighbors list (K=3) includes C, B, A in that order (as produced by the code)
    // The code builds a <ul> of neighbors with each entry like "C — Blue (distance: 1.118)"
    expect(html).toContain('Selected neighbors (K=3):');
    // Ensure each neighbor is present
    expect(html).toContain('C — Blue (distance: 1.118)');
    expect(html).toContain('B — Red (distance: 2.500)');
    expect(html).toContain('A — Red (distance: 2.693)');

    // Validate the unweighted majority prediction and weighted prediction are included and match expected values described in FSM/article
    expect(html).toContain('Unweighted majority prediction:</strong> Red');
    expect(html).toContain('Inverse-distance weighted prediction:</strong> Blue');

    // Extra assertion: ensure the result DIV's computed style is block (displayed)
    const resultHandle = await demo.getResult();
    const displayStyle = await resultHandle.evaluate(node => window.getComputedStyle(node).display);
    expect(displayStyle === 'block' || displayStyle === 'table' || displayStyle === 'flex' || displayStyle === 'grid').toBeTruthy();
  });

  test('Edge case: clicking the disabled button does not change DOM or cause runtime errors', async ({ page }) => {
    // This test ensures that after the demo is displayed and the button disabled,
    // attempting to click the disabled button (via Playwright) does not throw or change the result content.
    // Note: native clicks on disabled elements do nothing; Playwright will still send the click but the page's handler won't run.
    const demo = new DemoPage(page);
    await demo.goto();

    // Run the demo once
    await demo.clickRunDemo();
    await expect.poll(async () => await demo.isResultVisible(), { timeout: 2000 }).toBe(true);

    const initialHTML = await demo.getResultHTML();

    // Attempt to click the disabled button again (button is disabled so handler should not run)
    const btn = await demo.getRunButton();
    // Use page.click to attempt clicking the selector; since the button is disabled, this should not modify page state.
    await page.click('#runDemo').catch(() => {
      // Some browsers may reject interactions with disabled elements; ignore errors here since we assert later no page errors were emitted.
      // Do not modify the page's JS or behavior.
    });

    // Ensure the result remains unchanged
    const afterHTML = await demo.getResultHTML();
    expect(afterHTML).toBe(initialHTML);

    // Ensure no page errors or console.error messages were collected in this test run (checked in afterEach)
  });

  test('Reload resets to Idle state and demo can be run again', async ({ page }) => {
    // Validate that a full reload brings the page back to Idle (S0_Idle) and the demo can be run again,
    // verifying that state is not permanently stuck after first run.
    const demo = new DemoPage(page);
    await demo.goto();

    // Run demo
    await demo.clickRunDemo();
    await expect.poll(async () => await demo.isResultVisible(), { timeout: 2000 }).toBe(true);
    // Verify button disabled
    expect(await demo.isButtonDisabled()).toBe(true);

    // Reload the page to reset state
    await page.reload({ waitUntil: 'load' });

    // After reload, the idle UI should be back: button enabled and result hidden
    const btn = await demo.getRunButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run simple demo');
    expect(await demo.isButtonDisabled()).toBe(false);
    expect(await demo.isResultVisible()).toBe(false);

    // Run the demo again to ensure deterministic behavior is repeatable
    await demo.clickRunDemo();
    await expect.poll(async () => await demo.isResultVisible(), { timeout: 2000 }).toBe(true);
    // Confirm predictions are the same after reload/run
    const html = await demo.getResultHTML();
    expect(html).toContain('Unweighted majority prediction:</strong> Red');
    expect(html).toContain('Inverse-distance weighted prediction:</strong> Blue');
  });

  test('Observes console and runtime errors (if any) while loading and interacting', async ({ page }) => {
    // This test demonstrates explicit observation of console and page errors during interactions.
    // It does not assert that errors must occur; the afterEach asserts there are none. Here we explicitly perform actions to surface any issues.
    const demo = new DemoPage(page);

    // Navigate and interact
    await demo.goto();
    // Intentionally perform a few interactions to exercise the click handler and DOM writes
    await demo.clickRunDemo();

    // Wait briefly to allow any asynchronous console/page errors to surface
    await page.waitForTimeout(200);

    // The final assertions about console/page errors are performed in afterEach hook.
    // Here we still ensure the primary UI effects took place.
    expect(await demo.isResultVisible()).toBe(true);
    expect(await demo.isButtonDisabled()).toBe(true);
  });
});