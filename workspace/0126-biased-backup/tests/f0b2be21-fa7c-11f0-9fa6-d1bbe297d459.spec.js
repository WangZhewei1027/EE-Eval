import { test, expect } from '@playwright/test';

// Test file for Application ID: f0b2be21-fa7c-11f0-9fa6-d1bbe297d459
// Location served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/f0b2be21-fa7c-11f0-9fa6-d1bbe297d459.html

// Page Object representing the relevant elements and interactions for the FSM
class AStarPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Selector accessors
  demoButton() {
    return this.page.locator('#demoButton');
  }

  demoOutput() {
    return this.page.locator('#demoOutput');
  }

  visualization() {
    return this.page.locator('#visualization');
  }

  // Actions
  async clickRunDemo() {
    await this.demoButton().click();
  }

  async getDemoOutputText() {
    return this.demoOutput().innerText();
  }

  async getDemoOutputHTML() {
    return this.demoOutput().innerHTML();
  }
}

test.describe('A* Search Interactive - FSM validation (f0b2be21-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Base URL for the page under test
  const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b2be21-fa7c-11f0-9fa6-d1bbe297d459.html';

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and categorize errors
    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type(); // e.g., 'log', 'error', 'warning'
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push({ type, text });
      }
    });

    // Collect uncaught page errors (unhandled exceptions)
    page.on('pageerror', (error) => {
      // error is an Error object
      pageErrors.push(error);
    });

    // Navigate to the page exactly as-is
    await page.goto(BASE_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to teardown that would modify the page. We simply allow each test's listeners to be garbage collected.
    // The captured consoleMessages, consoleErrors, and pageErrors are used within each test's assertions.
  });

  test('State S0_Idle: initial render shows Run Step-by-Step Demo button and empty demo output', async ({ page }) => {
    // This test validates the Idle state evidence: presence of #demoButton and empty #demoOutput.
    const app = new AStarPage(page);

    // Verify visualization container exists
    await expect(app.visualization()).toBeVisible();

    // Check that the demo button exists and has the correct text
    const btn = app.demoButton();
    await expect(btn).toHaveCount(1);
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run Step-by-Step Demo');

    // Check that demoOutput exists and is empty prior to interaction
    const output = app.demoOutput();
    await expect(output).toHaveCount(1);
    // innerText may be empty or whitespace - assert trimmed length is 0
    const text = (await output.innerText()).trim();
    expect(text).toBe('', 'Expected demoOutput to be empty in the Idle state (S0_Idle)');

    // Verify there are no uncaught page errors at initial load
    expect(pageErrors.length).toBe(0);
    // Ensure console has no error-level messages at initial load
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition RunDemo: clicking the demo button updates demoOutput (S0_Idle -> S1_DemoRunning)', async ({ page }) => {
    // This test validates the transition: click #demoButton and ensure demoOutput.innerHTML updated.
    const app = new AStarPage(page);

    // Precondition: Idle state (button present)
    await expect(app.demoButton()).toBeVisible();

    // Click the demo button to trigger DemoRunning state
    await app.clickRunDemo();

    // After click, demoOutput should be populated with the step-by-step HTML content shown in the implementation
    const html = await app.getDemoOutputHTML();

    // Check that the expected heading text exists in the innerHTML
    expect(html).toContain('Step-by-Step Demo Output', 'Expected demoOutput to contain the demo heading after clicking the button');

    // Check the demo narrative includes Final path and Total cost (as per implementation)
    expect(html).toContain('Final path:', 'Expected the demo output to describe the final path');
    expect(html).toContain('Total cost', 'Expected the demo output to show total cost');

    // Also assert that the demoOutput contains the path sequence presented in the implementation
    expect(html).toContain('(0,0) → (1,0) → (2,0) → (2,1) → (2,2)', 'Expected the final path to be present in the demo output');

    // Confirm no uncaught exceptions/errors occurred during the click and update
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_DemoRunning re-entry and idempotency: multiple clicks produce update but do not throw', async ({ page }) => {
    // This test validates that clicking the demo button multiple times updates the demoOutput each time
    // and does not produce runtime exceptions (idempotent behavior for this UI action).
    const app = new AStarPage(page);

    // First click
    await app.clickRunDemo();
    const firstHTML = await app.getDemoOutputHTML();
    expect(firstHTML.length).toBeGreaterThan(0, 'After first click, demoOutput should be non-empty');

    // Capture state of console and page errors after first click
    const errorsAfterFirst = pageErrors.length;
    const consoleErrAfterFirst = consoleErrors.length;

    // Second click - should replace innerHTML with same demo content (implementation uses assignment)
    await app.clickRunDemo();
    const secondHTML = await app.getDemoOutputHTML();
    expect(secondHTML.length).toBeGreaterThan(0, 'After second click, demoOutput should still be non-empty');

    // The HTML after second click should contain the same key markers
    expect(secondHTML).toContain('Step-by-Step Demo Output');
    expect(secondHTML).toContain('Final path:');

    // Ensure no new page errors or console errors were introduced by repeated interaction
    expect(pageErrors.length).toBe(errorsAfterFirst, 'No new uncaught page errors should be introduced by a repeated click');
    expect(consoleErrors.length).toBe(consoleErrAfterFirst, 'No new console error messages should be introduced by a repeated click');
  });

  test('FSM metadata verification and onEnter/onExit presence checks', async ({ page }) => {
    // This test inspects the global environment for functions/actions referenced in the FSM (e.g., renderPage)
    // Verify presence/absence rather than mutating or defining them.

    // The FSM listed an entry action "renderPage()" for S0_Idle.
    // The implementation does NOT define renderPage in the global scope; we assert its absence.
    const hasRenderPage = await page.evaluate(() => {
      // Do not create or modify renderPage; simply detect whether it exists on the window.
      return typeof window.renderPage !== 'undefined';
    });
    // We expect renderPage to be undefined in the provided implementation.
    expect(hasRenderPage).toBe(false);

    // Verify that the click handler performs demoOutput.innerHTML assignment (evidence)
    // We check that a click changes demoOutput from empty to containing known content.
    const app = new AStarPage(page);
    const before = (await app.demoOutput().innerText()).trim();
    expect(before).toBe('');

    await app.clickRunDemo();
    const after = (await app.demoOutput().innerText()).trim();
    expect(after.length).toBeGreaterThan(0);

    // Ensure no uncaught errors happened during this validation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: verify behavior if demoOutput already contains content before clicking (should be replaced)', async ({ page }) => {
    // This test ensures that the script's behavior (assignment to innerHTML) replaces pre-existing content.
    const app = new AStarPage(page);

    // Programmatically set some content into demoOutput using page.evaluate but do not modify global functions
    // This is allowed: we are interacting with the DOM as a user/test, not patching runtime JS behavior.
    await page.evaluate(() => {
      const out = document.getElementById('demoOutput');
      if (out) {
        out.innerHTML = '<p>PRE-EXISTING CONTENT</p>';
      }
    });

    // Confirm precondition
    const pre = (await app.demoOutput().innerText()).trim();
    expect(pre).toContain('PRE-EXISTING CONTENT');

    // Click run demo - implementation assigns demoOutput.innerHTML = `...` which should overwrite
    await app.clickRunDemo();

    const post = (await app.demoOutput().innerText()).trim();
    expect(post).not.toContain('PRE-EXISTING CONTENT', 'The demo click handler should replace existing demoOutput content');
    expect(post).toContain('Step-by-Step Demo Output');

    // Verify still no uncaught runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observation: capture and report any console messages and page errors (fail test if any uncaught errors exist)', async ({ page }) => {
    // This final test gathers the console and page error outputs and asserts they are empty,
    // while also making the captured data available in failure messages for debugging.
    const app = new AStarPage(page);

    // Trigger the demo to provoke any potential runtime issues
    await app.clickRunDemo();

    // Small wait to ensure any asynchronous errors would surface
    await page.waitForTimeout(100);

    // Build helpful diagnostics in the assertion messages
    const consoleDiagnostics = consoleMessages.map(m => `[${m.type}] ${m.text}`).join('\n') || '<none>';
    const pageErrorDiagnostics = pageErrors.map(e => `${e.name}: ${e.message}`).join('\n') || '<none>';

    // Assert that there are no uncaught page errors
    expect(pageErrors.length, `Expected no uncaught page errors. Found:\n${pageErrorDiagnostics}`).toBe(0);

    // Assert no console-level 'error' messages occurred
    expect(consoleErrors.length, `Expected no console.error messages. Console diagnostics:\n${consoleDiagnostics}`).toBe(0);

    // Also assert that console logs contain at least one informational message OR be empty; we don't require logs.
    // We include this just to surface what was logged.
    test.info().annotations.push({ type: 'diagnostic', description: `Console messages:\n${consoleDiagnostics}` });
  });
});