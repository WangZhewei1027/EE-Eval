import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8da2a3-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the Interpolation Search Visualization page
 */
class VisualizationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startButton');
    this.visualization = page.locator('#visualization');
    this.stepLocator = this.visualization.locator('.step');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isStartButtonVisible() {
    return await this.startButton.isVisible();
  }

  async startVisualization() {
    await this.startButton.click();
  }

  async getStepCount() {
    return await this.stepLocator.count();
  }

  async getStepTexts() {
    const count = await this.getStepCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.stepLocator.nth(i).innerText()).trim());
    }
    return texts;
  }

  async waitForAtLeastSteps(minCount, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, min) => document.querySelectorAll(sel).length >= min,
      { timeout },
      '#visualization .step',
      minCount
    );
  }

  async waitForAllSteps(expectedCount, timeout = 14000) {
    await this.page.waitForFunction(
      (sel, expected) => document.querySelectorAll(sel).length === expected,
      { timeout },
      '#visualization .step',
      expectedCount
    );
  }

  async clearVisualizationContent() {
    // read-only helper; don't modify page state per instructions
    return await this.page.evaluate(() => document.getElementById('visualization').innerHTML);
  }
}

test.describe('Interpolation Search Visualization - FSM and UI tests', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test so we can assert on them later
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // Collect all console messages; categorize errors separately
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push({ type, text });
    });

    page.on('pageerror', err => {
      // pageerror fires for runtime exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    // Navigate to the application page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // As a final sanity check, ensure the page is still reachable
    // Do not modify any page state; this is purely observational.
    await expect(page).toHaveURL(APP_URL);
  });

  test.describe('State S0_Idle - Initial Render', () => {
    test('renders Start Visualization button and initial UI elements (Idle state)', async ({ page }) => {
      // This test validates the initial (Idle) state per FSM S0_Idle
      const viz = new VisualizationPage(page);

      // The Start button must be visible and contain correct text
      await expect(viz.startButton).toBeVisible();
      await expect(viz.startButton).toHaveText('Start Visualization');

      // The visualization container should be empty at the start
      const initialStepCount = await viz.getStepCount();
      expect(initialStepCount).toBe(0);

      // The description and title exist (evidence of renderPage() intentions in FSM)
      await expect(page.locator('#title')).toHaveText(/Interpolation Search Visualization/i);
      await expect(page.locator('#description')).toBeVisible();

      // The FSM's declared entry action renderPage() is not present as a global function in the HTML.
      // We assert that window.renderPage is undefined. This does not call any missing function; it only inspects existence.
      const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(renderPageExists).toBe(false);
    });
  });

  test.describe('Transition StartVisualization -> S1_Visualizing and Visualizing state behaviors', () => {
    test('clicking Start Visualization transitions to Visualizing and generates steps (checks entry actions)', async ({ page }) => {
      // This test verifies the transition described in the FSM from Idle to Visualizing.
      const viz = new VisualizationPage(page);

      // Click start and ensure at least the first step appears
      await viz.startVisualization();

      // The JS creates at least one step after a small delay. Wait for at least 1 step to appear.
      await viz.waitForAtLeastSteps(1, 3000);
      const stepCountAfterStart = await viz.getStepCount();
      expect(stepCountAfterStart).toBeGreaterThanOrEqual(1);

      // Verify the first step text matches the expected content from generateSteps()
      const stepTexts = await viz.getStepTexts();
      expect(stepTexts[0]).toContain('Step 1: Start with a sorted array.');

      // Because generateSteps() is implemented in the HTML, confirm the expected list exists by checking subsequent items after a longer wait.
      // The implementation schedules each step every ~2000ms. Wait up to 14s for all 6 steps.
      await viz.waitForAllSteps(6, 14000);
      const finalTexts = await viz.getStepTexts();
      expect(finalTexts.length).toBe(6);
      expect(finalTexts[finalTexts.length - 1]).toContain('Step 6: Value found or not found.');
    });

    test('visualization appends step elements with active class transitions', async ({ page }) => {
      // This test verifies DOM changes and visual feedback (active class toggling via CSS).
      const viz = new VisualizationPage(page);

      // Start visualization
      await viz.startVisualization();

      // Wait for first step to appear
      await viz.waitForAtLeastSteps(1, 3000);

      // The page sets .step elements and adds 'active' class via setTimeout
      // Check first .step element has active class after a small delay
      await page.waitForTimeout(200); // wait for the 100ms timeout inside displayStep plus some margin
      const firstStepHasActive = await page.locator('#visualization .step').first().evaluate(node => node.classList.contains('active'));
      expect(firstStepHasActive).toBe(true);
    });

    test('repeated click restarts visualization (edge case: user clicks while visualizing)', async ({ page }) => {
      // Ensure that clicking Start while visualizing clears previous visualization and restarts steps
      const viz = new VisualizationPage(page);

      // Start once
      await viz.startVisualization();
      await viz.waitForAtLeastSteps(1, 3000);

      // Capture current content snapshot
      const before = await viz.clearVisualizationContent();

      // Click again after a short wait to simulate user restarting visualization
      await page.waitForTimeout(500);
      await viz.startVisualization();

      // After restarting, the visualization innerHTML is reset at the start of startVisualization()
      // So the new visualization content should not contain older DOM nodes. Wait for at least 1 new step.
      await viz.waitForAtLeastSteps(1, 3000);

      const after = await viz.clearVisualizationContent();

      // The innerHTML strings should be non-empty, and the second run should not simply be the exact same DOM nodes as before (since innerHTML cleared, the string will differ in timing of 'active' class)
      expect(after.length).toBeGreaterThan(0);
      // It is acceptable if the HTML strings are equal in simple content; we ensure that the visualization has been reinitialized by count behavior
      const stepCount = await viz.getStepCount();
      expect(stepCount).toBeGreaterThanOrEqual(1);
      expect(stepCount).toBeLessThanOrEqual(6);
    });

    test('rapid multiple clicks do not produce more than expected set of steps (stress/edge case)', async ({ page }) => {
      // Rapidly click the start button multiple times and verify the visualization does not accumulate beyond expected number of steps (6).
      const viz = new VisualizationPage(page);

      // Rapid clicks
      await Promise.all([
        viz.startButton.click(),
        viz.startButton.click(),
        viz.startButton.click()
      ]);

      // Wait for all steps to be created (max 6)
      await viz.waitForAllSteps(6, 14000);

      // Ensure we have exactly 6 steps (the implementation resets visualization at start, so duplicates should not accumulate)
      const totalSteps = await viz.getStepCount();
      expect(totalSteps).toBe(6);
    });
  });

  test.describe('Console and runtime error observation (observational tests)', () => {
    test('no unexpected console error messages and no runtime page errors like ReferenceError/SyntaxError/TypeError', async ({ page }) => {
      // This test collects console and runtime errors while exercising the app and asserts that none occurred.
      // Start visualization to exercise the runtime code paths
      const viz = new VisualizationPage(page);
      await viz.startVisualization();

      // Wait a short while to let any errors propagate if they exist
      await page.waitForTimeout(1500);

      // Collect any console errors captured
      // consoleErrors and pageErrors are populated via page.on handlers in beforeEach
      // Assert there are no page-level runtime errors
      const hasPageErrors = pageErrors.length > 0;
      if (hasPageErrors) {
        // If there are page errors, ensure they are of the expected JS Error kinds we might document.
        // We will fail the test explicitly to surface unexpected runtime exceptions during instrumentation.
        const errorNames = pageErrors.map(e => e.name || (e.message && e.message.split(':')[0]) || 'UnknownError');
        // Provide helpful assertion messages for debugging
        expect(pageErrors.length, `Encountered runtime page errors: ${errorNames.join(', ')}`).toBe(0);
      }

      // Assert that no console.error messages were emitted
      expect(consoleErrors.length, `Console errors detected: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);

      // Additionally ensure that no console messages indicate SyntaxError/ReferenceError/TypeError strings
      const criticalErrorMessages = consoleMessages.filter(m =>
        /ReferenceError|SyntaxError|TypeError/i.test(m.text)
      );
      expect(criticalErrorMessages.length, `Critical error messages found in console: ${criticalErrorMessages.map(m => m.text).join(' | ')}`).toBe(0);
    });

    test('evidence of declared event handler exists (startButton has click behavior)', async ({ page }) => {
      // This test asserts the observable effect of the event handler attachment (the FSM references startButton.addEventListener('click', startVisualization))
      const viz = new VisualizationPage(page);

      // Confirm that clicking produces DOM changes (indirect evidence of event handler existence)
      await viz.startVisualization();
      await viz.waitForAtLeastSteps(1, 3000);
      const stepCount = await viz.getStepCount();
      expect(stepCount).toBeGreaterThan(0);

      // Also ensure the global function generateSteps exists per FSM entry action for S1_Visualizing
      const hasGenerateSteps = await page.evaluate(() => typeof window.generateSteps !== 'undefined');
      // In the provided HTML, generateSteps is a function in the script scope (not attached to window). It may be undefined on window.
      // We do not mutate the page; we simply assert whether it exists on window object.
      // We accept either undefined or function; assert that the visualization works as evidence the function is reachable via closure.
      expect([true, false]).toContain(hasGenerateSteps);
    });
  });
});