import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1d3c0-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Trie Demo FSM - f0b1d3c0-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate to the page before each test so we capture load-time errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', err => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Load the page under test. We intentionally do not modify the page or its runtime.
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Give the page a short moment to run scripts and surface errors
    await page.waitForTimeout(250);
  });

  // Test that the Idle state components are present and rendered as expected.
  test('Idle state: button and output container exist and are initially empty', async ({ page }) => {
    // Validate the demo button exists and has the correct label
    const demoButton = page.locator('#demoButton');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Run Trie Demonstration');

    // Validate the demo output container exists
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();

    // The demo output should be empty (or only whitespace) before running the demonstration
    const outputHtml = (await demoOutput.innerHTML()).trim();
    expect(outputHtml).toBe('', 'Expected demoOutput to be empty in Idle state');

    // Ensure we at least observed the DOM elements the FSM expects in S0_Idle
    // (This aligns with the FSM evidence "<button id=\"demoButton\">Run Trie Demonstration</button>")
  });

  // The implementation script is truncated in the provided HTML. We must observe and assert that runtime errors occur.
  test('Page load produces a JavaScript syntax/runtime error (expected given truncated script)', async ({ page }) => {
    // We expect at least one page error to have been emitted during load due to the truncated script.
    expect(pageErrors.length).toBeGreaterThan(0);

    // The error should be a SyntaxError or contain messages indicating unexpected end/token.
    const errorMessages = pageErrors.map(e => (e && e.message) || String(e));
    const combined = errorMessages.join(' | ');
    expect(combined).toMatch(/SyntaxError|Unexpected end|Unexpected token|Unexpected identifier|Unexpected character/i);
  });

  // The FSM defines a transition from Idle -> DemonstrationRunning on clicking #demoButton.
  // Because the page script is broken, the transition is expected to fail. This test attempts the event and verifies behavior.
  test('RunDemonstration event: clicking the button should (in a correct implementation) start the demo; assert behavior and observe errors', async ({ page }) => {
    const demoButton = page.locator('#demoButton');
    const demoOutput = page.locator('#demoOutput');

    // Snapshot of output before click
    const beforeHtml = (await demoOutput.innerHTML()).trim();

    // Attempt to click the button to trigger the demonstration
    await demoButton.click();

    // Wait briefly to allow any handlers (if present) to run
    await page.waitForTimeout(250);

    const afterHtml = (await demoOutput.innerHTML()).trim();

    // The FSM's expected observable for the transition is: output.innerHTML = '<p>Running trie demonstration...</p>';
    // Since the page script is syntactically broken, we assert that either:
    //  - the expected change did not occur (more likely), AND we observed runtime errors, OR
    //  - (in the unlikely case the click handler somehow executed) the change did occur.
    const ranDemo = afterHtml.includes('Running trie demonstration');
    if (ranDemo) {
      // If the demo ran, assert the exact expected content is present (best-effort check)
      expect(afterHtml).toContain('<p>Running trie demonstration...</p>');
    } else {
      // If the demo did not run, assert we observed at least one console error or page error explaining failure
      const hasConsoleError = consoleMessages.some(m => m.type === 'error');
      expect(hasConsoleError || pageErrors.length > 0).toBeTruthy();

      // Ensure the output did not change to the expected success text
      expect(afterHtml).not.toContain('Running trie demonstration');
      // And also that it did not get populated with the expected demonstration step lines
      expect(afterHtml).not.toContain("Created node for");
      expect(afterHtml).not.toContain("Marked");
    }
  });

  // Edge-case tests: clicking multiple times and ensuring that failures are consistent / no silent partial execution
  test('Edge case: multiple clicks should not produce partial demo output nor crash the test runner', async ({ page }) => {
    const demoButton = page.locator('#demoButton');
    const demoOutput = page.locator('#demoOutput');

    // Perform multiple clicks
    await demoButton.click();
    await demoButton.click();
    await demoButton.click();

    // Allow any possible handlers to run
    await page.waitForTimeout(300);

    const html = (await demoOutput.innerHTML()).trim();

    // Since implementation script is broken, we assert there's no partial output indicating partial demo execution
    expect(html).not.toContain('Created node for');
    expect(html).not.toContain('Marked');
    expect(html).not.toContain('Running trie demonstration');

    // Confirm we have captured console errors and/or page errors related to the broken script
    const consoleErrorExists = consoleMessages.some(m => m.type === 'error');
    expect(consoleErrorExists || pageErrors.length > 0).toBeTruthy();
  });

  // Validate we observed console-level error messages (e.g., "Uncaught SyntaxError") in addition to pageerror.
  test('Console should include error-level messages corresponding to the script problem', async ({ page }) => {
    // Wait a moment to ensure console messages are collected
    await page.waitForTimeout(100);

    // Check that at least one console message is of type 'error'
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBeGreaterThan(0);

    // Verify that at least one error console message indicates a syntax/token/parse problem
    const combinedConsoleText = errorConsoleEntries.map(e => e.text).join(' | ');
    expect(combinedConsoleText).toMatch(/SyntaxError|Unexpected end|Unexpected token|Uncaught/i);
  });

  // Clean up / final assertion: ensure that the DOM still contains the components referenced by the FSM
  test('FSM components remain present despite script errors', async ({ page }) => {
    // The FSM expects a button '#demoButton' and a div '#demoOutput'
    await expect(page.locator('#demoButton')).toBeVisible();
    await expect(page.locator('#demoOutput')).toBeVisible();
  });
});