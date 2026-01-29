import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b221e3-fa7c-11f0-9fa6-d1bbe297d459.html';

// Simple Page Object to encapsulate queries and interactions
class TimSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.visualizationLocator = page.locator('#visualization-steps');
    this.animateButtonLocator = page.locator('button[onclick="showVisualization()"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getVisualizationText() {
    return this.visualizationLocator.innerText();
  }

  async clickAnimate() {
    await this.animateButtonLocator.click();
  }

  async animateViaEvaluate() {
    // invoke the function directly in page context
    return this.page.evaluate(() => showVisualization());
  }

  async typeofOnWindow(name) {
    return this.page.evaluate((n) => typeof window[n], name);
  }
}

test.describe('FSM: Tim Sort Visualization (f0b221e3-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  let timSort;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and uncaught page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store text of console messages
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store the Error object thrown in the page
      pageErrors.push(err);
    });

    timSort = new TimSortPage(page);
    await timSort.goto();
  });

  test('Initial Idle state - page renders and Animate Steps button exists (S0_Idle)', async ({ page }) => {
    // This test verifies the Idle state rendering:
    // - The Animate Steps button is present and has the expected onclick attribute
    // - The initial visualization content is present
    // - No unexpected page errors occurred on load
    const btn = timSort.animateButtonLocator;
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Animate Steps');

    // Ensure the button has the required onclick attribute exactly as specified in FSM
    const onclickAttr = await btn.getAttribute('onclick');
    expect(onclickAttr).toBe('showVisualization()');

    // The page is expected to include initial visualization content prior to any user interaction
    await expect(timSort.visualizationLocator).toContainText('Initial array: [5, 2, 9, 1, 5, 6]');

    // Confirm the showVisualization function is present on window (entry action for S1)
    const typeofShowViz = await timSort.typeofOnWindow('showVisualization');
    expect(typeofShowViz).toBe('function');

    // The optional renderPage entry action mentioned in the FSM is NOT implemented in the HTML.
    // Verify that renderPage is undefined on the window (we do not call it here to avoid generating errors).
    const typeofRenderPage = await timSort.typeofOnWindow('renderPage');
    expect(typeofRenderPage).toBe('undefined');

    // No console errors or page errors should have been emitted during initial load of this well-formed HTML
    expect(consoleMessages.find(m => m.type === 'error')).toBeUndefined();
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Visualizing via button click displays visualization steps and final array', async ({ page }) => {
    // This test validates the main FSM transition:
    // - Clicking the Animate Steps button should invoke showVisualization()
    // - The visualization area should be updated to include step-by-step details and final sorted array
    const viz = timSort.visualizationLocator;
    // Sanity: initial content present
    await expect(viz).toContainText('Initial array: [5, 2, 9, 1, 5, 6]');

    // Trigger the transition by clicking the button
    await timSort.clickAnimate();

    // After click, the visualization content should be replaced with new content produced by showVisualization()
    await expect(viz).toContainText('Step 1: Identify natural runs');
    await expect(viz).toContainText('Final sorted array: [1, 2, 5, 5, 6, 9]');

    // Ensure no uncaught page errors occurred during the transition
    expect(pageErrors.length).toBe(0);

    // Ensure no console error messages were logged
    expect(consoleMessages.find(m => m.type === 'error')).toBeUndefined();
  });

  test('Direct invocation of showVisualization() via page.evaluate behaves like clicking the button', async ({ page }) => {
    // This test invokes the function directly in the page context to ensure the S1 entry action is executable.
    // It asserts that calling the function doesn't throw and produces the expected visualization content.
    // First, clear any previous visualization to be certain the function is executed now.
    await page.evaluate(() => {
      const steps = document.getElementById('visualization-steps');
      if (steps) {
        steps.innerHTML = '<p>placeholder</p>';
      }
    });

    // Call the function directly
    await timSort.animateViaEvaluate();

    // Validate the visualization area updated as expected
    await expect(timSort.visualizationLocator).toContainText('Final sorted array: [1, 2, 5, 5, 6, 9]');

    // No uncaught errors as this is a valid function call
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: invoking missing renderPage() causes ReferenceError and emits a pageerror event', async ({ page }) => {
    // This test purposely calls a non-existent function (renderPage) in the page context to exercise error handling.
    // According to the project's constraints, we must let ReferenceError happen naturally and assert it occurs.

    // The evaluate call is expected to reject due to ReferenceError in the page context.
    // Capture the rejection and assert it contains 'renderPage' in the message.
    await expect(page.evaluate(() => {
      // Intentionally call a function that is not defined in the page to trigger a ReferenceError
      // DO NOT catch here; letting the error bubble up ensures both the promise rejection and pageerror event occur.
      return renderPage();
    })).rejects.toThrow(/renderPage|is not defined|ReferenceError/);

    // The pageerror listener should have recorded at least one error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the captured page errors should mention 'renderPage' or 'is not defined'
    const matched = pageErrors.some(err => /renderPage|is not defined|ReferenceError/.test(String(err.message)));
    expect(matched).toBe(true);
  });

  test('Edge case: multiple rapid clicks on Animate Steps do not throw page errors and update visualization consistently', async ({ page }) => {
    // This test performs several rapid clicks on the Animate Steps button to ensure the UI is robust.
    // It asserts there are no uncaught page errors and that the final content is as expected.

    // Perform rapid clicks without awaiting long delays
    await Promise.all([
      timSort.clickAnimate(),
      timSort.clickAnimate(),
      timSort.clickAnimate()
    ]).catch(() => {
      // If any click triggers an error it would be surfaced via pageErrors; we don't reject the test here immediately,
      // we will assert below based on captured pageErrors.
    });

    // The visualization should still contain the complete final output
    await expect(timSort.visualizationLocator).toContainText('Final sorted array: [1, 2, 5, 5, 6, 9]');

    // There should be no uncaught page errors as showVisualization is robust
    expect(pageErrors.length).toBe(0);

    // And no console error messages
    expect(consoleMessages.find(m => m.type === 'error')).toBeUndefined();
  });

  test('Sanity: button element matches component selector from FSM and is clickable', async () => {
    // Validate that the component described in the FSM exists and is actionable.
    // This ensures the extracted component metadata aligns with the actual DOM.
    const btn = timSort.animateButtonLocator;
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();

    // Click and ensure the function ran (visualization updated)
    await btn.click();
    await expect(timSort.visualizationLocator).toContainText('Final sorted array: [1, 2, 5, 5, 6, 9]');
  });
});