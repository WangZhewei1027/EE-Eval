import { test, expect } from '@playwright/test';

test.setTimeout(30000); // Increase timeout to allow the demonstration to run (~9s)

class DemoPage {
  /**
   * Page Object Model for the Sliding Window demonstration page.
   * Encapsulates common selectors and wait helpers used by tests.
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b30c42-fa7c-11f0-9fa6-d1bbe297d459.html';
    // Selectors derived from provided HTML
    this.selectors = {
      demoButton: '#demo-button',
      arrayDisplay: '#array-display',
      windowVisualization: '#window-visualization',
      resultDisplay: '#result-display',
      stepExplanation: '#step-explanation',
      arrayElements: '#array-display .array'
    };
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickRun() {
    await this.page.click(this.selectors.demoButton);
  }

  async getArrayDisplayHTML() {
    return this.page.locator(this.selectors.arrayDisplay).innerHTML();
  }

  async getArrayElementsCount() {
    return this.page.locator(this.selectors.arrayElements).count();
  }

  async getWindowVisualizationText() {
    return this.page.locator(this.selectors.windowVisualization).innerText();
  }

  async getResultText() {
    return this.page.locator(this.selectors.resultDisplay).innerText();
  }

  async getStepExplanationText() {
    return this.page.locator(this.selectors.stepExplanation).innerText();
  }

  async waitForArrayToBePopulated(timeout = 2000) {
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.children && el.children.length > 0;
      },
      this.selectors.arrayDisplay,
      { timeout }
    );
  }

  async waitForWindowVisualizationStart(timeout = 5000) {
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.innerText && el.innerText.trim().length > 0;
      },
      this.selectors.windowVisualization,
      { timeout }
    );
  }

  async waitForAlgorithmComplete(timeout = 20000) {
    // The demo uses timeouts to simulate steps; wait for final completion text
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.innerText.includes('Algorithm complete. Maximum sum found:');
      },
      this.selectors.stepExplanation,
      { timeout }
    );
  }

  async waitForStepExplanationContains(text, timeout = 5000) {
    await this.page.waitForFunction(
      (selector, text) => {
        const el = document.querySelector(selector);
        return el && el.innerText && el.innerText.includes(text);
      },
      this.selectors.stepExplanation,
      text,
      { timeout }
    );
  }
}

test.describe('Sliding Window Demonstration (FSM: f0b30c42-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  let demoPage;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors to observe runtime issues
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // pageerror fires for uncaught exceptions in the page context
      pageErrors.push(err);
    });

    demoPage = new DemoPage(page);
    await demoPage.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: tests should not introduce page errors by themselves
    // The application under test may or may not emit errors; assert below in individual tests.
  });

  test.describe('State S0_Idle (Initial State)', () => {
    test('S0_Idle: Page loads in Idle state with Run Demonstration button and empty visualization areas', async ({ page }) => {
      // Ensure the demo button exists (evidence of Idle state)
      const button = page.locator('#demo-button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Run Demonstration');

      // On initial load, array-display, window-visualization, result-display, and step-explanation should be empty
      await expect(page.locator('#array-display')).toBeEmpty();
      await expect(page.locator('#window-visualization')).toBeEmpty();
      await expect(page.locator('#result-display')).toBeEmpty();
      await expect(page.locator('#step-explanation')).toBeEmpty();

      // Observe console & page errors on initial load - expect none for a healthy initial state
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition S0_Idle -> S1_DemonstrationRunning (Run Demonstration event)', () => {
    test('Run Demonstration click initializes visualization: array displayed and visualization begins', async ({ page }) => {
      // Click the Run Demonstration button to trigger the transition
      await demoPage.clickRun();

      // Evidence: initializeVisualization() would populate the array display immediately
      // Wait for array-display to have elements (there should be 6 elements as per code)
      await demoPage.waitForArrayToBePopulated(3000);
      const count = await demoPage.getArrayElementsCount();
      expect(count).toBe(6); // The array [2,1,5,1,3,2] should create 6 span.array elements

      // The step explanation should quickly reflect initialization
      await demoPage.waitForStepExplanationContains('Initializing', 2000);
      const initText = await demoPage.getStepExplanationText();
      expect(initText).toContain('Initializing');

      // Wait for the window visualization to start (it starts after building the initial window)
      await demoPage.waitForWindowVisualizationStart(8000);
      const wizText = await demoPage.getWindowVisualizationText();
      expect(wizText).toContain('Current window');

      // No console errors or page errors should have been emitted so far
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition S1_DemonstrationRunning -> S2_AlgorithmComplete (AlgorithmComplete event)', () => {
    test('Algorithm completes and displays final result and step explanation', async ({ page }) => {
      // Start the demonstration
      await demoPage.clickRun();

      // Wait for algorithm to complete (this waits for the exact final step explanation text)
      await demoPage.waitForAlgorithmComplete(20000);

      // Verify final step explanation text matches expected evidence in FSM
      const finalStep = await demoPage.getStepExplanationText();
      expect(finalStep).toContain('Algorithm complete. Maximum sum found: 9');

      // The result display should have been updated at least once during the run
      const resultText = await demoPage.getResultText();
      // Code updates resultDisplay when a new maximum is found; expect the maximum found to be 9
      expect(resultText).toMatch(/9/);

      // Additionally verify window visualization contains the last windows' info (non-empty)
      const wizText = await demoPage.getWindowVisualizationText();
      expect(wizText.length).toBeGreaterThan(0);

      // Confirm no uncaught page errors occurred during the full run
      expect(pageErrors.length).toBe(0);

      // Console errors (if any) would indicate runtime issues; assert there are none
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('Clicking Run Demonstration multiple times during run should not throw errors and should reinitialize correctly', async ({ page }) => {
      // Start demonstration
      await demoPage.clickRun();

      // Shortly after starting, click the button again to simulate a user triggering it while running
      // This should clear previous visualization and start a new run (per implementation it clears on click)
      await page.waitForTimeout(300); // small delay to let initial click handler run
      await demoPage.clickRun();

      // After the second click, array should be repopulated and step explanation should contain 'Initializing'
      await demoPage.waitForArrayToBePopulated(2000);
      const count = await demoPage.getArrayElementsCount();
      expect(count).toBe(6);

      await demoPage.waitForStepExplanationContains('Initializing', 2000);
      const initText = await demoPage.getStepExplanationText();
      expect(initText).toContain('Initializing');

      // Wait for algorithm completion for whichever simulation finishes last
      await demoPage.waitForAlgorithmComplete(20000);
      const finalStep = await demoPage.getStepExplanationText();
      expect(finalStep).toContain('Algorithm complete. Maximum sum found: 9');

      // Ensure there were no page errors or console errors caused by multiple concurrent runs
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Verify element highlight changes during run (visual feedback)', async ({ page }) => {
      // Start the demo and check that the current element gets highlighted (background color changes)
      await demoPage.clickRun();

      // Wait until the first element is highlighted (after first simulateStep invocation it highlights current element)
      // The code highlights the current element by setting style.backgroundColor = '#ffeb3b'
      await page.waitForFunction(() => {
        const first = document.getElementById('elem-0');
        return first && first.style && (first.style.backgroundColor === 'rgb(255, 235, 59)' || first.style.backgroundColor === '#ffeb3b');
      }, null, { timeout: 3000 });

      // Check that highlight eventually returns to the default gray (#e0e0e0) after delay
      // Wait for the highlight reset (the code resets it after 1 second)
      await page.waitForFunction(() => {
        const first = document.getElementById('elem-0');
        // The reset uses '#e0e0e0' inline style
        return first && first.style && (first.style.backgroundColor === 'rgb(224, 224, 224)' || first.style.backgroundColor === '#e0e0e0');
      }, null, { timeout: 5000 });

      // Assert no runtime page errors occurred while toggling element styles
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('No unexpected global runtime errors (ReferenceError, TypeError, SyntaxError) observed during load and runs', async ({ page }) => {
      // Already listening for page errors and console errors in beforeEach
      // Perform a full run
      await demoPage.clickRun();
      await demoPage.waitForAlgorithmComplete(20000);

      // If any uncaught exceptions occurred they'd be collected in pageErrors
      // Assert none found. If the implementation had thrown errors, this assertion would fail and surface them.
      expect(pageErrors.length).toBe(0, `Expected no uncaught page errors but found: ${pageErrors.map(e => e.message).join('; ')}`);
      expect(consoleErrors.length).toBe(0, `Expected no console errors but found: ${consoleErrors.map(e => e.text).join('; ')}`);
    });
  });
});