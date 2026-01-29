import { test, expect } from '@playwright/test';

test.setTimeout(60000); // Allow extra time for the synchronous training computation

// Page Object for the Backpropagation Demo page
class BackpropPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/32501ee3-fa73-11f0-a9d0-d7a1991987c6.html';
    this.trainButtonSelector = 'button[onclick="train()"]';
    this.outputSelector = '#output';
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Start listening to console and page errors so tests can assert on them
  async startLogging() {
    this.page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(this.url);
    // Ensure main UI elements are present
    await Promise.all([
      this.page.waitForSelector(this.trainButtonSelector),
      this.page.waitForSelector(this.outputSelector)
    ]);
  }

  async clickTrain() {
    await this.page.click(this.trainButtonSelector);
  }

  async getOutputHTML() {
    const el = await this.page.$(this.outputSelector);
    if (!el) return '';
    return (await el.innerHTML()).trim();
  }

  async getOutputText() {
    const el = await this.page.$(this.outputSelector);
    if (!el) return '';
    return (await el.innerText()).trim();
  }
}

test.describe('Backpropagation Demo - FSM validation', () => {
  // Validate initial Idle state rendering and components
  test('Idle state: page renders with Train button and empty output', async ({ page }) => {
    const demo = new BackpropPage(page);
    await demo.startLogging();

    // Load the page (S0_Idle entry action should correspond to render)
    await demo.goto();

    // Verify Train button exists and is visible (evidence for S0_Idle)
    const trainButton = await page.$(demo.trainButtonSelector);
    expect(trainButton).not.toBeNull();
    expect(await trainButton.isVisible()).toBeTruthy();

    // Verify output area exists and is initially empty (Idle evidence)
    const outputHTML = await demo.getOutputHTML();
    expect(outputHTML).toBe('').or.toBeFalsy();

    // Ensure no runtime errors occurred during initial render
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  // Validate transition: clicking Train moves to Training state and eventually back (S0 -> S1 -> S0)
  test('Training transition: clicking Train executes train() and displayResults() updates output', async ({ page }) => {
    const demo = new BackpropPage(page);
    await demo.startLogging();
    await demo.goto();

    // Click the Train button to trigger train() (event: TrainButtonClick)
    // The training is synchronous and heavy; wait for results to appear in the DOM
    await demo.clickTrain();

    // After training completes, displayResults() should populate the output div
    // Wait for expected text "Weights after training:" to appear
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.innerText.includes('Weights after training:');
    }, demo.outputSelector, { timeout: 45000 });

    const outputText = await demo.getOutputText();

    // Check that the output contains the expected evidence strings
    expect(outputText).toContain('Weights after training:');
    expect(outputText).toContain('Hidden Weights:');
    expect(outputText).toContain('Output Weights:');

    // Check that numeric weights are present in the output (basic regex)
    expect(outputText).toMatch(/\[([-+]?\d*\.?\d+(e[-+]?\d+)?)(,\s*[-+]?\d*\.?\d+(e[-+]?\d+)?)*\]/);

    // No uncaught page errors or console.error messages should have occurred during training
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  // Edge case: multiple sequential clicks should run training each time without throwing errors
  test('Repeated training: multiple clicks produce valid outputs and no runtime exceptions', async ({ page }) => {
    const demo = new BackpropPage(page);
    await demo.startLogging();
    await demo.goto();

    // Perform training twice sequentially to ensure idempotency and lack of errors
    for (let i = 0; i < 2; i++) {
      await demo.clickTrain();

      // Wait for the output to be populated each time
      await page.waitForFunction(selector => {
        const el = document.querySelector(selector);
        return el && el.innerText.includes('Weights after training:');
      }, demo.outputSelector, { timeout: 45000 });

      const outputText = await demo.getOutputText();
      expect(outputText).toContain('Weights after training:');
    }

    // Ensure the application did not log runtime errors across repeated runs
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  // Validate that the displayResults() function writes the expected formatted HTML (onExit action of Training)
  test('displayResults: verifies HTML formatting of results (onExit action)', async ({ page }) => {
    const demo = new BackpropPage(page);
    await demo.startLogging();
    await demo.goto();

    await demo.clickTrain();

    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.innerHTML.includes('Hidden Weights:') && el.innerHTML.includes('Output Weights:');
    }, demo.outputSelector, { timeout: 45000 });

    const outputHTML = await demo.getOutputHTML();

    // Verify that line breaks (<br>) are used in the innerHTML as per implementation
    expect(outputHTML).toContain('Weights after training:');
    expect(outputHTML).toContain('<br>');
    expect(outputHTML).toContain('Hidden Weights:');
    expect(outputHTML).toContain('Output Weights:');

    // No errors expected in this scenario
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  // Negative/observability test: capture any console logs/errors and page errors and surface them if present
  test('Observability: capture console and page errors (assert none for this implementation)', async ({ page }) => {
    const demo = new BackpropPage(page);
    await demo.startLogging();
    await demo.goto();

    // Do a training run to maximize the chance of triggers
    await demo.clickTrain();

    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.innerText.includes('Weights after training:');
    }, demo.outputSelector, { timeout: 45000 });

    // Report captured console messages (helpful if a failure occurs)
    // Assert that there were no page errors or console.error events
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);

    // As an extra check, ensure at least the Train button and output area exist after training
    const trainButton = await page.$(demo.trainButtonSelector);
    expect(trainButton).not.toBeNull();
    expect(await (await page.$(demo.outputSelector)).isVisible()).toBeTruthy();
  });
});