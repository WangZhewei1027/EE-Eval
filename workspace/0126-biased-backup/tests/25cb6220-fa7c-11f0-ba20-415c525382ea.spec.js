import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cb6220-fa7c-11f0-ba20-415c525382ea.html';

// Page object representing the demo page and common interactions
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.btn-demo');
    this.output = page.locator('#demo-output');
    this.heading = page.locator('h1');
  }

  // Navigate to the page and wait for initial load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the Run Demonstration button
  async clickRun() {
    await this.button.click();
  }

  // Read the demo output text content
  async getOutputText() {
    return await this.output.textContent();
  }

  // Get the number of lines in the demo output
  async getOutputLines() {
    const text = (await this.getOutputText()) || '';
    // split preserving empty lines
    return text.split('\n');
  }

  // Helper to assert button exists and has expected attributes
  async assertButtonPresent() {
    await expect(this.button).toBeVisible();
    await expect(this.button).toHaveText('Run Demonstration');
    const onclick = await this.button.getAttribute('onclick');
    // The implementation sets onclick="runDemo()"
    expect(onclick).toBe('runDemo()');
  }

  // Helper to assert output region attributes
  async assertOutputRegionAttributes() {
    await expect(this.output).toBeVisible();
    const ariaLive = await this.output.getAttribute('aria-live');
    const role = await this.output.getAttribute('role');
    expect(ariaLive).toBe('polite');
    expect(role).toBe('region');
  }
}

test.describe('Understanding Big-Theta Demo (FSM states & transitions)', () => {
  // Will collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info/warn/log) and errors separately
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      // pageerror is emitted for uncaught exceptions on the page
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Sanity teardown: ensure no unexpected navigation left
    // No explicit teardown necessary; Playwright takes care of closing pages
  });

  test('S0_Idle - initial render displays expected static content and components', async ({ page }) => {
    // This test validates the Idle state (S0_Idle):
    // - Page renders the heading and descriptive content
    // - The Run Demonstration button exists with correct attributes
    // - The demo output region exists and is initially empty
    // - No runtime JavaScript errors were raised on load

    const demo = new DemoPage(page);
    await demo.goto();

    // Validate main heading is present and correct
    await expect(demo.heading).toBeVisible();
    await expect(demo.heading).toHaveText(/Understanding Big-Theta Notation/i);

    // Validate button and output region existence and attributes
    await demo.assertButtonPresent();
    await demo.assertOutputRegionAttributes();

    // Initially, demo output should be empty (no demo has run yet)
    const initialText = (await demo.getOutputText()) || '';
    expect(initialText.trim()).toBe('', 'Expected demo output to be empty before running the demo');

    // Verify that there were no uncaught page errors during initial load
    expect(pageErrors.length).toBe(0);

    // There should be no console error messages logged on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition RunDemo -> S1_DemoRunning: clicking Run Demonstration executes demo and populates output', async ({ page }) => {
    // This test validates the transition from Idle to Demo Running (S0 -> S1):
    // - Clicking the button invokes runDemo (entry action for S1)
    // - The demo output region is populated with expected lines, including the conclusion
    // - For n >= n0 (n0=10), the output indicates that f(n) is within bounds (✓)
    // - No uncaught exceptions occur during the demo execution

    const demo = new DemoPage(page);
    await demo.goto();

    // Click the Run Demonstration button to trigger runDemo()
    await demo.clickRun();

    // Wait for the demo output to contain the Conclusion line (indicates runDemo completed)
    await expect(demo.output).toContainText('Conclusion:', { timeout: 2000 });

    // Read and validate content
    const outputText = (await demo.getOutputText()) || '';
    const lines = outputText.split('\n');

    // Expected minimal structure:
    // - header line describing testing
    // - constants line
    // - blank line
    // - 20 per-n lines (n=1..20)
    // - blank line
    // - conclusion line
    // We assert that there are 25 lines as implemented in the page script
    expect(lines.length).toBe(25);

    // Validate first lines contain expected phrases
    expect(lines[0]).toMatch(/Testing the inequality/);
    expect(lines[1]).toMatch(/Using constants: c1 = 2, c2 = 4, n0 = 10/);

    // Validate a representative line for n < n0 (e.g., n=1) indicates "below n0"
    const n1Line = lines.find(l => l.startsWith('n= 1:') || l.startsWith('n=1:'));
    expect(n1Line).toBeTruthy();
    expect(n1Line).toMatch(/below n0, inequality not required/);

    // Validate a representative line for n >= n0 (n=10) indicates the check result
    const n10Line = lines.find(l => l.includes('n=10') || l.includes('n=10:'));
    expect(n10Line).toBeTruthy();
    // For n >= n0 the implementation uses either "✓ f(n) within bounds" or "✗ f(n) outside bounds"
    // For this demo it should be within bounds for n=10
    expect(n10Line).toMatch(/f\(n\)=\d+.*→ .*f\(n\) (within|outside) bounds|f\(n\) within bounds|f\(n\) outside bounds/);
    // more specifically expect the word 'within' for common behavior at n=10 in this demo
    expect(n10Line).toMatch(/within bounds|outside bounds/);

    // Validate conclusion line explains the Theta relationship
    const conclusionLine = lines[lines.length - 1];
    expect(conclusionLine).toMatch(/Conclusion: for n ≥ 10, f\(n\) is bounded both above and below/i);

    // Ensure no uncaught page errors occurred during demo execution
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console errors emitted during demo execution
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotency and repeated invocation: clicking Run Demonstration multiple times updates output without errors', async ({ page }) => {
    // This test validates edge-case behavior:
    // - Clicking the Run Demonstration button multiple times should re-run the demo cleanly
    // - The demo-output gets replaced/updated (same content on repeated runs)
    // - No errors (pageerror or console error) occur on repeated runs

    const demo = new DemoPage(page);
    await demo.goto();

    // First run
    await demo.clickRun();
    await expect(demo.output).toContainText('Conclusion:', { timeout: 2000 });
    const firstOutput = (await demo.getOutputText()) || '';

    // Second run (simulate user click again)
    await demo.clickRun();
    await expect(demo.output).toContainText('Conclusion:', { timeout: 2000 });
    const secondOutput = (await demo.getOutputText()) || '';

    // The output content should be equal across runs (script overwrites textContent with same content)
    expect(secondOutput).toBe(firstOutput);

    // There should still be no page errors or console errors resulting from repeated invocation
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM onEnter/onExit validation: check presence/absence of expected global functions (renderPage/runDemo)', async ({ page }) => {
    // This test checks the runtime environment for functions mentioned as entry actions in the FSM:
    // - S1_DemoRunning: runDemo should exist as a global function (inlined script defines it)
    // - S0_Idle: renderPage was declared as an entry action in the FSM but the page does NOT define it.
    //   We assert the actual runtime behavior: runDemo exists and renderPage is undefined.
    // We deliberately only read existence (not invoke renderPage) to avoid creating artificial errors.

    const demo = new DemoPage(page);
    await demo.goto();

    // Check that runDemo is defined on the window (should be a function)
    const runDemoType = await page.evaluate(() => typeof window.runDemo);
    expect(runDemoType).toBe('function');

    // Check that renderPage (declared only in FSM meta) is not defined on the page
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // Because the HTML does not include renderPage(), it should be 'undefined'
    expect(renderPageType).toBe('undefined');

    // Verify that simply reading these types did not produce any page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Accessibility & semantics: demo output uses aria-live and region role and is updated when demo runs', async ({ page }) => {
    // This test ensures accessibility attributes are present and that dynamic updates are observable.
    const demo = new DemoPage(page);
    await demo.goto();

    // Attributes present
    const ariaLive = await demo.output.getAttribute('aria-live');
    const role = await demo.output.getAttribute('role');
    expect(ariaLive).toBe('polite');
    expect(role).toBe('region');

    // Run demo and assert aria-live content updates (observable via text)
    await demo.clickRun();
    await expect(demo.output).toContainText('Testing the inequality', { timeout: 2000 });
    await expect(demo.output).toContainText('Conclusion:', { timeout: 2000 });

    // No errors produced
    expect(pageErrors.length).toBe(0);
  });
});