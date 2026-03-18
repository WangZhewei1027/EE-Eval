import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3719c10-ffc4-11f0-821c-7d25bc609266.html';

/**
 * Page Object for the Linear Regression demo page.
 * Encapsulates common operations and selectors used across tests.
 */
class RegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array} consoleMessages - external array to collect console messages
   * @param {Array} pageErrors - external array to collect page errors
   */
  constructor(page, consoleMessages = [], pageErrors = []) {
    this.page = page;
    this.consoleMessages = consoleMessages;
    this.pageErrors = pageErrors;
    // register listeners to capture console and page errors
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    // Navigate to the application URL
    await this.page.goto(APP_URL);
  }

  calcButton() {
    return this.page.locator('#calcButton');
  }

  demoOutput() {
    return this.page.locator('#demoOutput');
  }

  async clickCalculate() {
    await this.calcButton().click();
  }

  async outputText() {
    const text = await this.demoOutput().textContent();
    return text ?? '';
  }

  async ariaLive() {
    return (await this.demoOutput().getAttribute('aria-live'));
  }

  async buttonText() {
    return (await this.calcButton().textContent()) ?? '';
  }
}

test.describe('Linear Regression Demo - FSM (a3719c10-ffc4-11f0-821c-7d25bc609266)', () => {
  // Keep tests focused and isolated; each test will create its own page object and listeners.

  test('S0 Idle state: page renders initial UI (button present, output empty) and no page errors on load', async ({ page }) => {
    // This test validates the Idle state (S0) per FSM:
    // - Evidence: button with id #calcButton is present
    // - Entry action: renderPage() is conceptually represented by the static DOM being present
    // - We also observe console and page errors during load and assert there are none

    const consoleMessages = [];
    const pageErrors = [];
    const app = new RegressionPage(page, consoleMessages, pageErrors);

    // Navigate to the page (listeners are already registered in the Page Object constructor)
    await app.goto();

    // Assert: the Calculate button exists, is visible and enabled
    await expect(app.calcButton()).toBeVisible();
    await expect(app.calcButton()).toBeEnabled();
    const btnText = await app.buttonText();
    expect(btnText).toContain('Calculate Regression Coefficients');

    // Assert: demoOutput exists and is initially empty (Idle state has no output)
    await expect(app.demoOutput()).toBeVisible();
    const initialOutput = await app.outputText();
    expect(initialOutput.trim()).toBe(''); // initial output should be empty

    // Assert: aria-live attribute is present and polite for accessible updates
    const aria = await app.ariaLive();
    expect(aria).toBe('polite');

    // Assert: There were no uncaught page errors during page load
    expect(pageErrors.length).toBe(0);

    // Assert: No console messages of type 'error' were emitted during load
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition: CalculateCoefficients (click #calcButton) moves S0 -> S1 and displays coefficients', async ({ page }) => {
    // This test validates the click event and transition:
    // - Event: clicking #calcButton triggers calcCoefficients(data) and sets demoOutput.textContent
    // - Evidence for S1: demoOutput.textContent includes the step-by-step calculation and final equation
    // - We assert numeric coefficient values expected from the embedded dataset

    const consoleMessages = [];
    const pageErrors = [];
    const app = new RegressionPage(page, consoleMessages, pageErrors);

    await app.goto();

    // Pre-condition: output empty
    expect((await app.outputText()).trim()).toBe('');

    // Trigger the event: click the calculate button
    await app.clickCalculate();

    // Wait for the output to be populated (aria-live will update demoOutput)
    await expect(app.demoOutput()).toHaveText(/Resulting Regression Equation|Ŷ = β₀ \+ β₁X/, { timeout: 2000 });

    const outText = await app.outputText();

    // Validate content includes step labels and summary lines
    expect(outText).toContain('Step 1: Calculate means');
    expect(outText).toContain('Step 2: Calculate components for slope (β₁)');
    expect(outText).toContain('Step 3: Calculate intercept (β₀)');
    expect(outText).toContain('Resulting Regression Equation');

    // Validate computed numeric values match the expected coefficients for the dataset:
    // Data: (2,65),(4,70),(5,75),(7,85),(8,90)
    // Computation (by hand or pre-computed):
    // xMean = 5.20, yMean = 77.00
    // numerator = 98.00, denominator = 22.80
    // beta1 ≈ 4.2982456 -> rounded to 4 decimals: 4.2982
    // beta0 ≈ 54.6491228 -> rounded to 4 decimals: 54.6491
    expect(outText).toContain('Mean of X (𝑋̄) = 5.20');
    expect(outText).toContain('Mean of Y (Ȳ) = 77.00');

    // Confirm slope and intercept are present with the expected 4-decimal formatting
    expect(outText).toContain('= 4.2982'); // Slope line contains 4.2982
    expect(outText).toContain('= 54.6491'); // Intercept line contains 54.6491

    // Confirm final regression equation line with expected formatting
    expect(outText).toContain('Ŷ = β₀ + β₁X = 54.6491 + 4.2982');

    // Ensure no uncaught page errors occurred as part of this interaction
    expect(pageErrors.length).toBe(0);

    // Ensure no console error messages were emitted during click/compute
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Edge case: double-clicking the calculate button is idempotent and does not cause runtime errors', async ({ page }) => {
    // This test validates resilience: clicking the button multiple times should produce a stable, deterministic output
    // and should not result in JS runtime errors (no uncaught exceptions).

    const consoleMessages = [];
    const pageErrors = [];
    const app = new RegressionPage(page, consoleMessages, pageErrors);

    await app.goto();

    // Click twice rapidly
    await Promise.all([
      app.clickCalculate(),
      app.clickCalculate(),
    ]);

    // Wait until output contains final equation
    await expect(app.demoOutput()).toHaveText(/Resulting Regression Equation|Ŷ = β₀ \+ β₁X/, { timeout: 2000 });

    const firstOutput = await app.outputText();

    // Click a third time to make sure output remains stable
    await app.clickCalculate();
    await expect(app.demoOutput()).toHaveText(/Resulting Regression Equation|Ŷ = β₀ \+ β₁X/, { timeout: 2000 });

    const secondOutput = await app.outputText();

    // Outputs should be identical across repeated calculations
    expect(secondOutput).toBe(firstOutput);

    // No uncaught exceptions should have been thrown during repeated interactions
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Accessibility / DOM checks: ensure components from FSM are present and correctly attributed', async ({ page }) => {
    // This test asserts the FSM components are present in the DOM with the expected attributes:
    // - Button exists with the expected label
    // - demoOutput exists and has aria-live="polite"
    // - S0 and S1 observable evidence (button and output.textContent updates) are verifiable

    const consoleMessages = [];
    const pageErrors = [];
    const app = new RegressionPage(page, consoleMessages, pageErrors);

    await app.goto();

    // Button label check
    const label = await app.buttonText();
    expect(label.trim()).toBe('Calculate Regression Coefficients');

    // demoOutput attributes and empty state check
    const ariaLive = await app.ariaLive();
    expect(ariaLive).toBe('polite');

    const demoOutputHandle = app.demoOutput();
    await expect(demoOutputHandle).toBeVisible();

    // Trigger S1 to validate output.textContent observable evidence
    await app.clickCalculate();
    await expect(demoOutputHandle).toHaveText(/Resulting Regression Equation|Ŷ = β₀ \+ β₁X/);

    // Confirm that the output contains a human-readable interpretation line
    const outText = await app.outputText();
    expect(outText).toMatch(/Interpretation: Each additional hour studied predicts an increase of/);

    // Confirm again that no uncaught exceptions occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Observability: capture console logs and page errors during navigation and interaction', async ({ page }) => {
    // This test explicitly gathers console message types and page errors to demonstrate observability.
    // It's expected that a well-formed page will produce zero 'error' console messages and zero page errors.
    // We don't modify the page; we only observe and assert.

    const consoleMessages = [];
    const pageErrors = [];
    const app = new RegressionPage(page, consoleMessages, pageErrors);

    await app.goto();

    // Trigger interaction
    await app.clickCalculate();

    // Allow a short time for logs/errors to appear
    await page.waitForTimeout(200);

    // Log summary (kept as test-time assertions, not printed)
    const errors = pageErrors;
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    const warnings = consoleMessages.filter((m) => m.type === 'warning');

    // Assertions:
    // - No uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.) should be thrown on normal run.
    expect(errors.length).toBe(0);

    // - No console.error messages emitted by the page under normal operation
    expect(consoleErrors.length).toBe(0);

    // - Warnings are allowed (may be zero or more), so we don't fail on warnings, but we assert we collected console messages
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // Also ensure the output now contains the final regression equation as additional verification of successful execution
    const outText = await app.outputText();
    expect(outText).toContain('Resulting Regression Equation');
  });
});