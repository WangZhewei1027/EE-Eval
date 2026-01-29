import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b35a63-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      demoButton: '.demo-button',
      demoOutput: '#demoOutput',
      demoSteps: '#demoSteps'
    };
  }

  async goto() {
    const response = await this.page.goto(APP_URL);
    // Return the response to allow tests to assert on it
    return response;
  }

  async demoButton() {
    return this.page.locator(this.selectors.demoButton);
  }

  async clickDemoButton() {
    await this.page.click(this.selectors.demoButton);
  }

  async isDemoOutputVisible() {
    return await this.page.isVisible(this.selectors.demoOutput);
  }

  async getDemoStepsCount() {
    return await this.page.locator(`${this.selectors.demoSteps} > p`).count();
  }

  async getDemoStepsText() {
    const paragraphs = await this.page.locator(`${this.selectors.demoSteps} > p`).allTextContents();
    return paragraphs;
  }

  async waitForStepsCount(count, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const container = document.querySelector(sel);
        if (!container) return false;
        return container.querySelectorAll('p').length === expected;
      },
      this.selectors.demoSteps,
      count,
      { timeout }
    );
  }

  async waitForAtLeastOneStep(timeout = 8000) {
    await this.page.waitForFunction(
      (sel) => {
        const container = document.querySelector(sel);
        if (!container) return false;
        return container.querySelectorAll('p').length > 0;
      },
      this.selectors.demoSteps,
      { timeout }
    );
  }

  async getDemoButtonOnclickAttribute() {
    return await this.page.getAttribute(this.selectors.demoButton, 'onclick');
  }

  async getDemoButtonText() {
    return await this.page.locator(this.selectors.demoButton).innerText();
  }

  async getDemoStepsInnerHTML() {
    return await this.page.locator(this.selectors.demoSteps).innerHTML();
  }
}

test.describe('f0b35a63-fa7c-11f0-9fa6-d1bbe297d459 - Context Switch Demo FSM Tests', () => {
  // Arrays to capture console and page errors per test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset capture arrays
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors from the page
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', error => {
      // pageerror is typically an Error object
      pageErrors.push(String(error));
    });
  });

  test.describe('Initial (S0_Idle) state validations', () => {
    test('Idle: Page loads and initial DOM reflects Idle state (demo hidden, button present)', async ({ page }) => {
      // This test validates the S0_Idle state:
      // - The page loads successfully (renderPage)
      // - The Run Context Switch Demo button exists with correct text and onclick attribute
      // - The demo output is initially hidden and demoSteps is empty
      const demo = new DemoPage(page);
      const response = await demo.goto();
      expect(response && response.ok()).toBeTruthy();

      // Button exists and has the expected label and onclick attribute (evidence from FSM)
      const buttonText = await demo.getDemoButtonText();
      expect(buttonText).toContain('Run Context Switch Demo');

      const onclickAttr = await demo.getDemoButtonOnclickAttribute();
      // Verify the attribute exists and references runDemo() as declared in the HTML
      expect(onclickAttr).toBeTruthy();
      expect(onclickAttr).toContain('runDemo');

      // demoOutput should be hidden (display: none in CSS inline style)
      const isVisible = await demo.isDemoOutputVisible();
      expect(isVisible).toBeFalsy();

      // demoSteps should be empty initially
      const stepsCount = await demo.getDemoStepsCount();
      expect(stepsCount).toBe(0);

      // Assert no immediate page errors were emitted during load
      expect(pageErrors.length).toBe(0);
      // No console errors captured on initial load
      const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorEntries.length).toBe(0);
    });
  });

  test.describe('Transition: RunDemo event and S1_DemoRunning state', () => {
    test('Clicking Run Context Switch Demo transitions to Demo Running and shows demoOutput with cleared steps', async ({ page }) => {
      // This test validates the transition from S0_Idle -> S1_DemoRunning:
      // - Clicking the .demo-button triggers runDemo()
      // - demoOutput becomes visible
      // - demoSteps is cleared immediately on entry
      // - subsequent demo steps are appended over time
      const demo = new DemoPage(page);
      await demo.goto();

      // Click the demo button to trigger the RunDemo event
      await demo.clickDemoButton();

      // After runDemo() entry actions, demoOutput.style.display should be 'block' => visible
      const visible = await demo.isDemoOutputVisible();
      expect(visible).toBeTruthy();

      // demoSteps should have been cleared synchronously by runDemo()
      // It's possible that code clears innerHTML then schedules appends;
      // we assert it's empty immediately after click (onEnter evidence)
      const innerHTML = await demo.getDemoStepsInnerHTML();
      // innerHTML may be empty string; ensure trimmed length is zero
      expect(innerHTML.trim().length).toBe(0);

      // Now wait for the demo steps to be appended asynchronously.
      // The demo schedules 8 append operations spaced by 800ms starting at 0ms.
      // Wait up to 9 seconds for full completion.
      const expectedSteps = 8;
      await demo.waitForStepsCount(expectedSteps, 10000);

      const stepsCount = await demo.getDemoStepsCount();
      expect(stepsCount).toBe(expectedSteps);

      // Verify that the first and last steps' text match expected snippets from implementation
      const texts = await demo.getDemoStepsText();
      expect(texts[0]).toContain('1. Process A is running');
      expect(texts[texts.length - 1]).toContain('7. Process B runs until next context switch');

      // Ensure no uncaught page errors happened during the demo run
      expect(pageErrors.length).toBe(0);

      // Ensure no console.error messages were recorded during this flow
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Edge case: Clicking Run Context Switch Demo multiple times clears previous steps and restarts', async ({ page }) => {
      // This test validates behavior when the RunDemo button is clicked again
      // before the prior scheduled timeouts finish (edge case).
      // It expects runDemo() to clear demoSteps on each invocation and re-populate.
      const demo = new DemoPage(page);
      await demo.goto();

      // First click -> begin append sequence
      await demo.clickDemoButton();

      // Wait until at least one step appears (to simulate mid-run)
      await demo.waitForAtLeastOneStep(8000);
      const countAfterFirst = await demo.getDemoStepsCount();
      expect(countAfterFirst).toBeGreaterThan(0);

      // Click again to restart the demo while it's still appending
      await demo.clickDemoButton();

      // Immediately after the second click, demoSteps should be cleared again
      await page.waitForFunction(
        (sel) => {
          const container = document.querySelector(sel);
          if (!container) return false;
          return container.querySelectorAll('p').length === 0;
        },
        demo.selectors.demoSteps,
        { timeout: 2000 }
      );

      // After the restart, wait for the demo to fully repopulate (8 steps)
      const finalExpected = 8;
      await demo.waitForStepsCount(finalExpected, 10000);
      const finalCount = await demo.getDemoStepsCount();
      expect(finalCount).toBe(finalExpected);

      // Ensure demoOutput is visible after repeated clicks
      expect(await demo.isDemoOutputVisible()).toBeTruthy();

      // Ensure no uncaught page errors or console.errors happened
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No unexpected ReferenceError, SyntaxError, or TypeError on load and during demo run', async ({ page }) => {
      // This test is focused on capturing runtime exceptions or console errors.
      // It loads the page, runs the demo, and asserts there are no page errors or console.error entries.
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure no page error immediately after load
      expect(pageErrors.length).toBe(0);

      // Run the demo to exercise script paths
      await demo.clickDemoButton();

      // Wait a short while for potential runtime errors to surface (2 seconds)
      await page.waitForTimeout(2000);

      // There should be no page errors
      expect(pageErrors.length).toBe(0);

      // Filter console messages for error-level messages and for explicit JS error names
      const errorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
      expect(errorMessages.length).toBe(0);

      // Additionally assert that no console message contains common fatal error names
      const joined = consoleMessages.map(m => m.text).join('\n').toLowerCase();
      expect(joined).not.toContain('referenceerror');
      expect(joined).not.toContain('syntaxerror');
      expect(joined).not.toContain('typeerror');
    });

    test('If any pageerror or console.error occurs, tests will capture and report them', async ({ page }) => {
      // This test intentionally demonstrates capturing of page errors and console errors.
      // We load the page and assert that our capture arrays reflect reality (even if they are empty).
      const demo = new DemoPage(page);
      await demo.goto();

      // There may be zero or more captured messages; assert that our arrays are defined and iterable.
      expect(Array.isArray(consoleMessages)).toBeTruthy();
      expect(Array.isArray(consoleErrors)).toBeTruthy();
      expect(Array.isArray(pageErrors)).toBeTruthy();

      // If any pageErrors exist, fail the test with detailed diagnostic info to help debugging.
      if (pageErrors.length > 0) {
        // Provide details in failure to surface runtime errors (Playwright will show assertion message)
        throw new Error(`Unexpected page errors detected:\n${pageErrors.join('\n---\n')}`);
      }

      // If any console errors exist, fail and show messages
      if (consoleErrors.length > 0) {
        throw new Error(`Unexpected console.error messages detected:\n${consoleErrors.join('\n---\n')}`);
      }

      // Otherwise pass - the environment had no runtime page errors or console errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});