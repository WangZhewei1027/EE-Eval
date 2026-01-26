import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ccc1b0-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the DNS demo page
class DNSDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtnSelector = '#runDemoBtn';
    this.outputSelector = '#demoOutput';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getRunButton() {
    return this.page.locator(this.runBtnSelector);
  }

  async getOutput() {
    return this.page.locator(this.outputSelector);
  }

  async clickRun() {
    await this.page.click(this.runBtnSelector);
  }

  async outputText() {
    return this.page.locator(this.outputSelector).textContent();
  }
}

// Expected steps exactly as implemented in the page script
const expectedSteps = [
  '1. User types "www.example.com" in browser.',
  '2. Local cache checked — no entry found.',
  '3. Query sent to recursive DNS resolver.',
  '4. Recursive resolver queries Root DNS server: "Where is .com TLD?"',
  '5. Root server responds with addresses of .com TLD servers.',
  '6. Recursive resolver queries .com TLD server: "Where is example.com?"',
  '7. .com TLD server responds with authoritative servers for example.com.',
  '8. Recursive resolver queries authoritative server for example.com: "What is IP of www.example.com?"',
  '9. Authoritative server responds: "www.example.com is 93.184.216.34".',
  '10. Recursive resolver returns IP to the user\'s computer.',
  '11. User\'s computer connects to 93.184.216.34 to load the website.'
];
const expectedText = expectedSteps.join('\n');

test.describe('DNS Resolution Demo - FSM states and transitions', () => {
  // Arrays to collect runtime issues and console errors/messages
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console 'error' messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // If inspection of console message throws, record that too
        consoleErrors.push({ text: `console listener error: ${String(e)}` });
      }
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No special teardown necessary; Playwright will close pages automatically.
  });

  test('Initial (Idle) state: page renders expected components', async ({ page }) => {
    // This test validates the S0_Idle state entry action (renderPage()) by checking that
    // the button and the demo output region are present in the DOM with correct attributes.
    const demo = new DNSDemoPage(page);

    // Button exists and has correct text and aria-label
    const runBtn = await demo.getRunButton();
    await expect(runBtn).toBeVisible({ timeout: 2000 });
    await expect(runBtn).toHaveText('Show DNS Resolution Steps');
    await expect(runBtn).toHaveAttribute('aria-label', 'Run DNS resolution demonstration');

    // demoOutput exists, is empty initially, and has correct ARIA attributes
    const output = await demo.getOutput();
    await expect(output).toBeVisible();
    const text = (await output.textContent()) ?? '';
    expect(text.trim()).toBe('', 'demoOutput should be empty on initial render (Idle state)');
    await expect(output).toHaveAttribute('aria-live', 'polite');
    await expect(output).toHaveAttribute('aria-atomic', 'true');
    await expect(output).toHaveAttribute('role', 'region');

    // Verify that no runtime page errors (e.g., ReferenceError, TypeError, SyntaxError) fired during initial load
    expect(pageErrors.length).toBe(0);
    // Verify that no console.error messages were logged during initial load
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning: clicking button displays DNS steps', async ({ page }) => {
    // This test validates the ButtonClick event and that displayDemoSteps() entry action for S1_DemoRunning
    // updates demoOutput.textContent with the expected steps.
    const demo = new DNSDemoPage(page);

    // Precondition check: demoOutput is empty
    const outputBefore = await demo.outputText();
    expect((outputBefore ?? '').trim()).toBe('', 'demoOutput should begin empty before clicking');

    // Click the run button to trigger the transition
    await demo.clickRun();

    // After clicking, the demoOutput should be updated to include all expected steps
    // Use a retry to allow any microtask or rendering delays
    await expect(demo.getOutput()).toHaveText(expectedText, { timeout: 2000 });

    // Verify the number of lines is exactly the number of expected steps
    const outText = (await demo.outputText()) ?? '';
    const lines = outText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    expect(lines.length).toBe(expectedSteps.length);

    // Verify idempotency: clicking again should produce same content (not duplicate or clear)
    await demo.clickRun();
    const outText2 = (await demo.outputText()) ?? '';
    expect(outText2).toBe(outText, 'Clicking the Run button again should produce the same output content');

    // Verify no page errors during/after transition
    expect(pageErrors.length).toBe(0);

    // Verify no console errors were emitted during the click handling
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks and element stability', async ({ page }) => {
    // This test validates robustness against repeated user interactions and ensures DOM stability.
    const demo = new DNSDemoPage(page);

    // Perform multiple rapid clicks
    await Promise.all([
      demo.clickRun(),
      demo.clickRun(),
      demo.clickRun()
    ]);

    // Output must equal expectedText (not repeated concatenation)
    await expect(demo.getOutput()).toHaveText(expectedText, { timeout: 2000 });

    // The run button should remain enabled and visible after repeated clicks
    const runBtn = await demo.getRunButton();
    await expect(runBtn).toBeVisible();
    // If the implementation had disabled the button, this would catch that (it shouldn't be disabled)
    await expect(runBtn).toBeEnabled();

    // Confirm ARIA attributes still intact after interaction
    const output = await demo.getOutput();
    await expect(output).toHaveAttribute('aria-live', 'polite');
    await expect(output).toHaveAttribute('role', 'region');

    // No page errors or console errors resulting from rapid clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Behavioral assertions aligned with FSM evidence and observables', async ({ page }) => {
    // This test asserts specific pieces of evidence from the FSM:
    // - Presence of event listener code is represented by click responsiveness.
    // - demoOutput.textContent updates with joined lines (we check newline separation).
    const demo = new DNSDemoPage(page);

    // Confirm the button text contains expected words (verifies UI evidence)
    const runBtn = await demo.getRunButton();
    await expect(runBtn).toHaveText(/Show DNS Resolution Steps/);

    // Trigger the event and verify content includes subsections expected in FSM evidence
    await demo.clickRun();

    const outText = (await demo.outputText()) ?? '';

    // Check that lines contain some evidence fragments described in FSM
    expect(outText).toContain('Recursive resolver queries Root DNS server');
    expect(outText).toContain('Recursive resolver queries .com TLD server');
    expect(outText).toContain('Authoritative server responds');

    // Ensure newline join is present (i.e., steps joined by '\n')
    expect(outText.includes('\n')).toBe(true);

    // Ensure no runtime errors captured
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility & semantics: verify pre element styling attributes and role semantics', async ({ page }) => {
    // This test verifies that the demoOutput element is a pre element with expected semantics
    const demo = new DNSDemoPage(page);
    const output = demo.getOutput();

    await expect(output).toBeVisible();
    // Ensure element tagName is PRE (access via evaluate)
    const tagName = await (await output.elementHandle()).evaluate(el => el.tagName);
    expect(tagName.toLowerCase()).toBe('pre');

    // Validate ARIA attributes once more for accessibility guarantees
    await expect(output).toHaveAttribute('aria-live', 'polite');
    await expect(output).toHaveAttribute('aria-atomic', 'true');
    await expect(output).toHaveAttribute('role', 'region');

    // No runtime errors or console errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observing console and page errors: assert none of ReferenceError/TypeError/SyntaxError occurred', async ({ page }) => {
    // This explicit test captures whether any page errors (like ReferenceError, TypeError, SyntaxError)
    // occurred during navigation and interactions. According to the "only observe and assert" constraint,
    // we do not modify page behavior; we only report/verify what happened.
    const demo = new DNSDemoPage(page);

    // Trigger interaction to exercise scripts
    await demo.clickRun();

    // Wait briefly to ensure any asynchronous exceptions bubble up to pageerror
    await page.waitForTimeout(200);

    // Assert that no pageerrors of these types were captured
    const problematic = pageErrors.filter(pe =>
      pe.name === 'ReferenceError' || pe.name === 'TypeError' || pe.name === 'SyntaxError'
    );
    expect(problematic.length).toBe(0, `Expected no ReferenceError/TypeError/SyntaxError; found: ${JSON.stringify(problematic)}`);

    // Also assert that no console.error messages were emitted
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages; found: ${JSON.stringify(consoleErrors)}`);
  });
});