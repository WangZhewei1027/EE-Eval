import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d839bf70-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page Object Model for the Agile demo page.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class AgilePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container[role="main"]');
    this.headerH1 = page.locator('header h1');
    this.runSimBtn = page.locator('#runSimBtn');
    this.simOutput = page.locator('#simOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getSimOutputText() {
    // Use textContent to preserve the preformatted (pre-wrap) structure
    return (await this.simOutput.textContent()) ?? '';
  }

  async clickRunSimulation() {
    await this.runSimBtn.click();
  }
}

test.describe('Agile Methodology Demo - FSM validation and interactions', () => {
  let pageErrors = [];
  let consoleMessages = [];

  // Attach listeners and navigate before each test. Clean state for each test.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages (info, error, warning, log)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leakage between tests (Playwright Page reuses in some runners).
    page.removeAllListeners?.('pageerror');
    page.removeAllListeners?.('console');
  });

  test('S0_Idle: Page renders initial static content correctly', async ({ page }) => {
    // Validate the Idle state as described in the FSM:
    // - container exists with role=main
    // - header contains the specified H1 title
    // - simOutput has the initial explanatory text
    const app = new AgilePage(page);

    // Ensure main container is visible
    await expect(app.container).toBeVisible();

    // Header should contain the exact title
    await expect(app.headerH1).toHaveText('Agile Methodology — Comprehensive Educational Guide');

    // The Run Simulation button should be present and have the expected attributes
    await expect(app.runSimBtn).toBeVisible();
    await expect(app.runSimBtn).toHaveAttribute('aria-controls', 'simOutput');
    await expect(app.runSimBtn).toHaveClass(/simple/);

    // simOutput initial content - check that it contains the expected guidance text
    const initialText = await app.getSimOutputText();
    // This is the exact initial message from the HTML (pre-wrapped)
    await expect(initialText).toContain('Initial sprint: 10 days, 40 story points. Click "Run Simulation" to see a simple burndown example.');

    // Verify no uncaught page errors during initial render
    expect(pageErrors.length, `Unexpected page errors during initial load: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // There should be no console messages of type 'error' (clean initial state)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors were logged during initial load: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('RunSimulation event transitions Idle -> Simulation Ran and updates #simOutput', async ({ page }) => {
    // Validate the click event produces the burndown simulation text in #simOutput.
    // This corresponds to the FSM transition RunSimulation and entry action updating out.textContent.
    const app = new AgilePage(page);

    // Capture initial output for later comparison
    const before = await app.getSimOutputText();

    // Click the button to run the simulation
    await app.clickRunSimulation();

    // After clicking, the output should contain the simulation header
    await expect(app.simOutput).toContainText('Sprint burndown simulation (10 days, 40 points total):');

    // It should also include the textual table header used by the script
    await expect(app.simOutput).toContainText('Day | Completed (cumulative) | Remaining');

    // The output should have multiple lines including at least day 1 and day 10
    const after = await app.getSimOutputText();
    expect(after.length).toBeGreaterThan(before.length);

    // Check that day 1 and day 10 entries are present by matching "  1 |" and " 10 |" (padded)
    expect(after).toMatch(/\b1\s*\|\s*\d+/); // simple check: day 1 exists followed by a numeric cumulative
    expect(after).toMatch(/\b10\s*\|\s*\d+/); // check day 10 exists

    // Validate that the script appends explanatory notes at the end
    expect(after).toContain('Notes:');
    expect(after).toContain('Remaining(day) = initialTotalPoints − completedToDate');

    // Verify no uncaught page errors occurred during simulation run
    expect(pageErrors.length, `Unexpected page errors during simulation run: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // No console.error messages should have been emitted as part of normal operation
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors were logged during simulation run: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Edge case: clicking the Run Simulation button a second time - behavior observation', async ({ page }) => {
    // The page's implementation attaches the click handler with {once:true}, which means
    // the handler runs once and is removed. There is an if(ran){ out.textContent = 'Simulation already run...' }
    // inside the handler, but because the handler is removed after the first invocation the second click will
    // not run any code. This test documents and asserts the actual runtime behavior (no patching).
    const app = new AgilePage(page);

    // Run simulation once
    await app.clickRunSimulation();
    const afterFirst = await app.getSimOutputText();

    // Sanity check first run produced the burndown header
    expect(afterFirst).toContain('Sprint burndown simulation (10 days, 40 points total):');

    // Click the button a second time
    await app.clickRunSimulation();

    // After the second click we expect the content to remain unchanged (handler was registered with once:true)
    const afterSecond = await app.getSimOutputText();
    expect(afterSecond).toBe(afterFirst);

    // Specifically assert that the fallback message "Simulation already run. Refresh the page to run again."
    // is NOT present, because the second click does not execute the handler (it's removed after first run)
    expect(afterSecond).not.toContain('Simulation already run. Refresh the page to run again.');

    // Assert no page errors occurred during repeated clicking
    expect(pageErrors.length, `Unexpected page errors after repeated clicks: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Accessibility and DOM attributes: verify aria-controls relationship and semantic role', async ({ page }) => {
    // Ensure the button's aria-controls points to the simOutput element and that the simOutput is present.
    const app = new AgilePage(page);

    // Button should have aria-controls attribute linking to simOutput id
    const ariaControls = await app.runSimBtn.getAttribute('aria-controls');
    expect(ariaControls).toBe('simOutput');

    // The referenced element should exist and its id should match
    const simOutputElement = page.locator(`#${ariaControls}`);
    await expect(simOutputElement).toBeVisible();

    // The main container should have role=main for assistive tech
    const container = page.locator('.container[role="main"]');
    await expect(container).toBeVisible();

    // No page errors introduced by these checks
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture console messages and ensure no runtime Reference/Type/Syntax errors', async ({ page }) => {
    // This test explicitly inspects captured console messages and page errors for known JS runtime error types.
    // It does not attempt to modify the page or inject globals; it allows any errors to surface naturally.
    const app = new AgilePage(page);

    // Run the simulation to exercise the demo script
    await app.clickRunSimulation();

    // Give the page a moment to emit any console messages or errors (script is synchronous, but be conservative)
    await page.waitForTimeout(100);

    // Collect textual console messages of error severity
    const errorConsoleTexts = consoleMessages.filter(m => m.type === 'error').map(m => m.text);

    // If any page errors exist they will be instances with message property
    const pageErrorMessages = pageErrors.map(e => e.message);

    // Assert there were no uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    expect(pageErrorMessages.length, `Uncaught page errors: ${pageErrorMessages.join(' | ')}`).toBe(0);

    // Assert there were no console.error messages
    expect(errorConsoleTexts.length, `console.error messages: ${errorConsoleTexts.join(' | ')}`).toBe(0);

    // Additionally ensure none of the console messages contain "ReferenceError", "TypeError", or "SyntaxError"
    const anyCritical = consoleMessages.some(m =>
      /ReferenceError|TypeError|SyntaxError/.test(m.text)
    );
    expect(anyCritical, `Found critical error text in console: ${JSON.stringify(consoleMessages)}`).toBe(false);
  });
});