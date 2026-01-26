import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cac5e2-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class PageRankDemo {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#runDemo');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    // Navigate to the exact URL provided by the environment
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async isButtonDisabled() {
    return this.button.isDisabled();
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async clickRun() {
    // Click the Run PageRank Demo button (normal click - will fail if disabled)
    await this.button.click();
  }

  async waitForCalculating() {
    // Wait until the output contains the initial 'Calculating PageRank...' text
    await this.page.waitForFunction(() => {
      const el = document.querySelector('#demoOutput');
      return el && el.textContent && el.textContent.includes('Calculating PageRank...');
    });
  }

  async waitForAtLeastOneIteration(timeout = 10000) {
    // Wait until the output contains "Iteration 1:" at minimum
    await this.page.waitForFunction(() => {
      const el = document.querySelector('#demoOutput');
      return el && el.textContent && /Iteration\s+1:/.test(el.textContent);
    }, { timeout });
  }

  async waitForConverged(timeout = 30000) {
    // Wait until the output contains the converged message
    await this.page.waitForFunction(() => {
      const el = document.querySelector('#demoOutput');
      return el && el.textContent && /Converged after \d+ iteration/.test(el.textContent);
    }, { timeout });
  }

  async parseConvergedIterationCount() {
    const text = await this.getOutputText();
    const m = text.match(/Converged after (\d+) iteration/);
    if (m) return Number(m[1]);
    return null;
  }

  async outputHasPRLines() {
    const text = await this.getOutputText();
    // Expect lines like "A: 0.33333"
    return /A:\s*\d+\.\d{5}/.test(text) && /B:\s*\d+\.\d{5}/.test(text) && /C:\s*\d+\.\d{5}/.test(text);
  }
}

test.describe('PageRank Demo FSM - 25cac5e2-fa7c-11f0-ba20-415c525382ea', () => {
  // Collect console messages and page errors for each test to assert on them later.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', error => {
      // store the full Error object for assertions
      pageErrors.push(error);
    });
  });

  test.describe('S0_Idle (Initial state) - renderPage() evidence', () => {
    test('Initial render shows Run PageRank Demo button and introductory output', async ({ page }) => {
      // Arrange
      const demo = new PageRankDemo(page);

      // Act
      await demo.goto();

      // Assert: Button exists and has correct text
      await expect(demo.button).toBeVisible();
      await expect(demo.button).toHaveText('Run PageRank Demo');

      // Assert: Button is enabled initially (Idle state)
      expect(await demo.isButtonDisabled()).toBe(false);

      // Assert: The output pre element exists and contains the initial prompt
      await expect(demo.output).toBeVisible();
      const initialText = await demo.getOutputText();
      expect(initialText).toContain('Press "Run PageRank Demo" to see PageRank values evolving across iterations.');

      // Assert: ARIA attributes present as in components evidence
      const ariaLive = await page.getAttribute('#demoOutput', 'aria-live');
      const ariaAtomic = await page.getAttribute('#demoOutput', 'aria-atomic');
      const tabindex = await page.getAttribute('#demoOutput', 'tabindex');
      expect(ariaLive).toBe('polite');
      expect(ariaAtomic).toBe('true');
      expect(tabindex).toBe('0');

      // Assert: No runtime page errors occurred during initial load
      expect(pageErrors.length, `Expected no page errors on initial load, but found: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);

      // Assert: There are no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Console errors were emitted: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });

  test.describe('S0 -> S1 Transition (RunDemoClick) and S1_Calculating behavior', () => {
    test('Clicking Run PageRank Demo disables the button and shows Calculating message', async ({ page }) => {
      // Arrange
      const demo = new PageRankDemo(page);
      await demo.goto();

      // Act: Click button to start demo
      await demo.clickRun();

      // Assert: Button should be disabled immediately after click (exit action evidence)
      await expect(demo.button).toBeDisabled();

      // Assert: Output should display "Calculating PageRank..."
      await demo.waitForCalculating();
      const afterClickText = await demo.getOutputText();
      expect(afterClickText).toContain('Calculating PageRank...');

      // Assert: No page errors were thrown during this transition
      expect(pageErrors.length, `Expected no page errors after clicking run, but found: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);

      // Assert: Clicking while disabled should not be possible (button remains disabled)
      expect(await demo.isButtonDisabled()).toBe(true);
      // Do not force clicks; ensure Playwright recognizes it's disabled
      // Attempt a normal click and make sure it throws/ is not actionable — but safer to just assert disabled state.
    });

    test('While calculating, the demo produces iteration lines (Iteration 1 and formatted PR lines)', async ({ page }) => {
      // Arrange
      const demo = new PageRankDemo(page);
      await demo.goto();

      // Act
      await demo.clickRun();

      // Assert: At least one iteration is produced in a reasonable time
      await demo.waitForAtLeastOneIteration(12000);

      const out = await demo.getOutputText();
      expect(out).toContain('Iteration 1:');

      // Assert: Output contains PR lines for A, B, and C with five decimal places
      const hasPR = await demo.outputHasPRLines();
      expect(hasPR, `Expected PR lines for A, B, C with five decimals in output:\n${out}`).toBe(true);

      // Assert: No page errors or console errors happened while producing iterations
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Console errors were emitted: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Page errors were thrown: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
    });
  });

  test.describe('S1 -> S2 Transition (Convergence) and onEnter/onExit actions', () => {
    test('Demo converges and re-enables the Run button, with correct converged message', async ({ page }) => {
      // Arrange
      const demo = new PageRankDemo(page);
      await demo.goto();

      // Act: Start demo
      await demo.clickRun();

      // Wait for convergence (the demo uses timeouts; allow up to 30s)
      await demo.waitForConverged(30000);

      // Assert: Converged message present and contains iteration count
      const outputText = await demo.getOutputText();
      const convergedMatch = outputText.match(/Converged after (\d+) iteration(s)?\./);
      expect(convergedMatch, `Expected converged message in output:\n${outputText}`).not.toBeNull();

      // Extract iteration number and confirm pluralization logic matches the actual message
      const iterationCount = await demo.parseConvergedIterationCount();
      expect(typeof iterationCount).toBe('number');
      if (iterationCount === 1) {
        expect(outputText).toContain('iteration.');
      } else {
        expect(outputText).toContain('iterations.') || expect(outputText).toContain('iteration' + 's.'); // defensive
      }

      // Assert: Button is re-enabled after convergence (exit action sets disabled = false)
      await expect(demo.button).toBeEnabled();

      // Assert: Output contains at least one Iteration line and formatted PR output
      expect(outputText).toMatch(/Iteration\s+\d+:/);
      expect(await demo.outputHasPRLines()).toBe(true);

      // Assert: No unexpected runtime errors occurred
      expect(pageErrors.length, `Page errors during convergence: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);

      // Assert: No console 'error' messages were emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Console errors were emitted: ${JSON.stringify(consoleErrors)}`).toBe(0);
    }, 35000); // increase test timeout for the convergence wait
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Attempting to start a second demo run while one is in progress does not produce page errors and button remains disabled', async ({ page }) => {
      // Arrange
      const demo = new PageRankDemo(page);
      await demo.goto();

      // Start first run
      await demo.clickRun();

      // Immediately try to click again (button is disabled: ensure state stays disabled)
      const isDisabled = await demo.isButtonDisabled();
      expect(isDisabled).toBe(true);

      // Optionally attempt a forced click to ensure the page's code isn't patched (we must not patch page)
      // We will not perform a forced click; instead we confirm the DOM disabled state prevents user interaction.
      // Assert no page errors occurred from the attempted (non-performed) second start
      expect(pageErrors.length, `Page errors after attempted second start: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Console errors after attempted second start: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });

    test('The demo output element respects ARIA attributes and is focusable as documented', async ({ page }) => {
      // Arrange
      const demo = new PageRankDemo(page);
      await demo.goto();

      // Assert ARIA attributes again (redundant but checks edge)
      const ariaLive = await page.getAttribute('#demoOutput', 'aria-live');
      const ariaAtomic = await page.getAttribute('#demoOutput', 'aria-atomic');
      const tabindex = await page.getAttribute('#demoOutput', 'tabindex');
      expect(ariaLive).toBe('polite');
      expect(ariaAtomic).toBe('true');
      expect(tabindex).toBe('0');

      // Try to focus the output element to ensure tabindex works (should not throw)
      await expect(demo.output).toBeVisible();
      await demo.output.focus();
      // Check activeElement is the output
      const activeTag = await page.evaluate(() => document.activeElement && document.activeElement.id);
      expect(activeTag).toBe('demoOutput');

      // No page errors caused by focusing
      expect(pageErrors.length, `Page errors caused by focusing output: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
    });
  });

  // Final assertion test to ensure no unhandled errors were emitted during any test body setup
  test('No unexpected ReferenceError/SyntaxError/TypeError occurred during test', async ({ page }) => {
    // This test intentionally checks the arrays collected in the beforeEach hook of the last executed test.
    // Because Playwright creates a new page per test, we check global behavior by navigating and ensuring no errors are produced on load.
    const demo = new PageRankDemo(page);
    await demo.goto();

    // No page errors expected on a fresh load
    expect(pageErrors.length, `Unexpected page errors on fresh load: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);

    // Ensure console messages do not include JS exceptions (type 'error')
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Unexpected console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });
});