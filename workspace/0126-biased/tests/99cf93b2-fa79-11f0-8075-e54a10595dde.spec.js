import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf93b2-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Time Complexity Interactive Demo
class TimeComplexityPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      title: 'h1',
      algorithm: '#algorithm',
      inputSize: '#inputSize',
      repeat: '#repeat',
      runButton: '#run',
      output: '#output'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getTitleText() {
    return this.page.locator(this.selectors.title).textContent();
  }

  async getAlgorithmValue() {
    return this.page.locator(this.selectors.algorithm).inputValue();
  }

  async setAlgorithm(value) {
    await this.page.selectOption(this.selectors.algorithm, value);
  }

  async getInputSizeValue() {
    return this.page.locator(this.selectors.inputSize).inputValue();
  }

  // Use fill for numeric values; use evaluate to set arbitrary string when needed (edge case).
  async setInputSize(value) {
    const locator = this.page.locator(this.selectors.inputSize);
    if (typeof value === 'string' && /[^0-9\-]/.test(value)) {
      // For non-numeric strings, set via evaluate to ensure the value is assigned even on number input
      await this.page.evaluate((sel, v) => {
        document.querySelector(sel).value = v;
      }, this.selectors.inputSize, value);
    } else {
      await locator.fill(String(value));
    }
    // blur to ensure change is registered
    await locator.press('Tab');
  }

  async getRepeatValue() {
    return this.page.locator(this.selectors.repeat).inputValue();
  }

  async setRepeat(value) {
    const locator = this.page.locator(this.selectors.repeat);
    await locator.fill(String(value));
    await locator.press('Tab');
  }

  async clickRun() {
    await this.page.locator(this.selectors.runButton).click();
  }

  async getOutputText() {
    return this.page.locator(this.selectors.output).textContent();
  }
}

test.describe('Time Complexity Interactive Demo - FSM and UI tests', () => {
  // Capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Ensure no stale listeners
    // Attach fresh listeners in each test via helper when needed.
  });

  // Test initial Idle state rendering and controls
  test('Idle state renders page and initial controls', async ({ page }) => {
    // Capture console and page errors produced during load
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new TimeComplexityPage(page);
    // Navigate to the application (S0_Idle entry action evidence: renderPage())
    await app.goto();

    // Validate visible title and that initial state is Idle
    const title = (await app.getTitleText())?.trim();
    expect(title).toBe('Time Complexity Interactive Demo');

    // Validate presence and default values of controls
    await expect(page.locator(app.selectors.algorithm)).toBeVisible();
    await expect(page.locator(app.selectors.inputSize)).toBeVisible();
    await expect(page.locator(app.selectors.repeat)).toBeVisible();
    await expect(page.locator(app.selectors.runButton)).toBeVisible();

    // Default values as in the HTML
    expect(await app.getInputSizeValue()).toBe('10');
    expect(await app.getRepeatValue()).toBe('1');
    expect(await app.getAlgorithmValue()).toBe('constant');

    // Ensure no runtime page errors of critical types were emitted during initial render
    // We assert that none of the captured page errors are ReferenceError/SyntaxError/TypeError
    for (const err of pageErrors) {
      const msg = String(err?.message || err);
      expect(msg).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
    // Also ensure no console.error messages were emitted
    expect(consoleErrors.length).toBe(0);
  });

  // Test transitions: clicking Run Simulation causes SimulationRunning and output update
  test.describe('Run Simulation transitions and output validation', () => {
    // Reuse patterns for different algorithm scenarios
    test('Run simulation for each algorithm produces expected Total Operations (constant, linear, quadratic)', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const app = new TimeComplexityPage(page);
      await app.goto();

      // Test data for algorithms: [algorithmValue, inputSize, repeats, expectedOperations]
      const scenarios = [
        ['constant', 123, 5, 5 * 1],
        ['linear', 7, 3, 3 * 7],
        ['quadratic', 4, 2, 2 * 4 * 4]
      ];

      for (const [algorithm, n, repeats, expected] of scenarios) {
        // Set controls
        await app.setAlgorithm(algorithm);
        await app.setInputSize(n);
        await app.setRepeat(repeats);

        // Click Run to trigger transition S0_Idle -> S1_SimulationRunning (entry action: runSimulation())
        await app.clickRun();

        // Validate output contains expected pieces of information
        const output = await app.getOutputText();
        expect(output).toContain(`Algorithm: ${algorithm}`);
        expect(output).toContain(`Input Size: ${n}`);
        expect(output).toContain(`Repeats: ${repeats}`);
        expect(output).toContain(`Total Operations: ${expected}`);

        // Minimal visual check: #output element is non-empty after running simulation
        expect(output.trim().length).toBeGreaterThan(0);
      }

      // Ensure no severe page errors (ReferenceError/SyntaxError/TypeError) occurred while running simulations
      for (const err of pageErrors) {
        const msg = String(err?.message || err);
        expect(msg).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
      expect(consoleErrors.length).toBe(0);
    });

    // Edge case: Non-numeric input for inputSize produces NaN in output (application does not validate input)
    test('Edge case: non-numeric input size yields NaN Total Operations', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const app = new TimeComplexityPage(page);
      await app.goto();

      // Set algorithm and non-numeric input size
      await app.setAlgorithm('linear');
      // Number input: set a non-numeric string via evaluate to ensure the value is assigned
      await app.setInputSize('not-a-number');
      await app.setRepeat(2);

      // Run the simulation
      await app.clickRun();

      // Expect output to indicate NaN for Total Operations
      const output = await app.getOutputText();
      expect(output).toContain('Algorithm: linear');
      expect(output).toContain('Repeats: 2');
      expect(output).toContain('Total Operations: NaN');

      // Confirm no page errors of the critical types occurred (the app simply produced NaN instead of throwing)
      for (const err of pageErrors) {
        const msg = String(err?.message || err);
        expect(msg).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
      expect(consoleErrors.length).toBe(0);
    });

    // Edge case: repeat set to 0 (below min) - numeric 0 should compute normally to 0 operations
    test('Edge case: repeat set to 0 yields zero total operations', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const app = new TimeComplexityPage(page);
      await app.goto();

      await app.setAlgorithm('linear');
      await app.setInputSize(50);
      // Although min is 1 in HTML, we intentionally set 0 to see application behavior
      await app.setRepeat(0);

      await app.clickRun();

      const output = await app.getOutputText();
      expect(output).toContain('Algorithm: linear');
      expect(output).toContain('Input Size: 50');
      expect(output).toContain('Repeats: 0');
      expect(output).toContain('Total Operations: 0'); // repeats * n = 0

      for (const err of pageErrors) {
        const msg = String(err?.message || err);
        expect(msg).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
      }
      expect(consoleErrors.length).toBe(0);
    });
  });

  // Observability test: ensure no unexpected runtime errors are emitted during typical user flows
  test('Observability: no ReferenceError/SyntaxError/TypeError emitted during user interactions', async ({ page }) => {
    // This test intentionally runs through a sequence of actions and asserts that severe runtime errors are not emitted.
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
    });

    const app = new TimeComplexityPage(page);
    await app.goto();

    // Walk through a few interactions
    await app.setAlgorithm('constant');
    await app.setInputSize(1);
    await app.setRepeat(1);
    await app.clickRun();

    await app.setAlgorithm('quadratic');
    await app.setInputSize(8);
    await app.setRepeat(2);
    await app.clickRun();

    // After interactions, assert no pageerror messages indicating JS runtime errors of critical types
    // If there are any page errors, ensure none are ReferenceError/SyntaxError/TypeError
    for (const err of pageErrors) {
      const msg = String(err?.message || err);
      // If a page error exists, it must not be one of the critical error types
      expect(msg).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }

    // Also assert that console.error was not emitted
    // If console.error messages exist, ensure they do not reference the critical error types
    for (const c of consoleErrors) {
      expect(c.text).not.toMatch(/ReferenceError|SyntaxError|TypeError/);
    }
  });
});