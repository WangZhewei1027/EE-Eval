import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b41db1-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Routing Demo FSM Tests - f0b41db1-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Arrays to collect console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info/warn/error) emitted by the page
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.type() or msg.text() throws, still capture raw
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', err => {
      // err is an Error object from the page context
      pageErrors.push(err.message);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Close page to ensure listeners are cleaned up between tests
    // (Playwright test runner will normally do this, but we include for clarity)
    try {
      await page.close();
    } catch (e) {
      // ignore errors closing page
    }
  });

  test('Initial Idle State (S0_Idle): button present and demo output hidden', async ({ page }) => {
    // This test validates the initial / Idle state of the FSM (S0_Idle)
    // - The "Run Routing Demonstration" button should exist
    // - The demo output element (#demoOutput) should be present but not visible (display: none)
    const runButton = page.locator('button[onclick="showRoutingDemo()"]');
    await expect(runButton).toHaveCount(1);
    await expect(runButton).toBeVisible();

    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toHaveCount(1);

    // Because #demoOutput defaults to display: none, Playwright's toBeVisible should fail,
    // so we assert it is not visible.
    await expect(demoOutput).not.toBeVisible();

    // Ensure no unexpected page errors have occurred during initial load.
    expect(pageErrors.length).toBe(0);

    // No console errors expected on load (but capture everything)
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Transition RunRoutingDemo -> S1_DemoRunning: clicking button displays output and updates routing table', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_DemoRunning:
    // - Clicking the "Run Routing Demonstration" button should display #demoOutput
    // - The output should contain the simulation title and updated routing table details

    const runButton = page.locator('button[onclick="showRoutingDemo()"]');
    const demoOutput = page.locator('#demoOutput');

    // Click the button to trigger the routing demo
    await runButton.click();

    // Wait for demoOutput to become visible
    await expect(demoOutput).toBeVisible();

    // Verify the demo output contains expected heading/title
    await expect(demoOutput).toContainText('Distance Vector Routing Update Simulation');

    // Verify the demo shows the "Updated Routing Table (Router A)"
    await expect(demoOutput).toContainText('Updated Routing Table (Router A)');

    // Verify that the specific learned route to D via B with cost 3 is present
    // We check for the presence of D, B and 3 in close proximity using the text content
    const content = (await demoOutput.textContent()) || '';
    expect(content).toMatch(/D\s+B\s+3|D[\s\S]*B[\s\S]*3/);

    // Validate expected observables from FSM:
    // - "#demoOutput is displayed" already asserted
    // - "Routing table is updated" asserted via presence of updated table text

    // Ensure clicking did not produce page-level unexpected errors
    const criticalPageErrors = pageErrors.filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));
    expect(criticalPageErrors.length).toBe(0);

    // Also ensure there are no console error messages after clicking
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Idempotent behavior: clicking the Run button multiple times keeps output visible and content stable', async ({ page }) => {
    // This test validates repeated interactions (edge case)
    // - Clicking the button again should not hide the output and should leave content consistent

    const runButton = page.locator('button[onclick="showRoutingDemo()"]');
    const demoOutput = page.locator('#demoOutput');

    // Click once and capture content
    await runButton.click();
    await expect(demoOutput).toBeVisible();
    const firstContent = await demoOutput.innerHTML();

    // Click again
    await runButton.click();
    await expect(demoOutput).toBeVisible();
    const secondContent = await demoOutput.innerHTML();

    // Content should be non-empty and stable across clicks
    expect(firstContent.length).toBeGreaterThan(0);
    expect(secondContent.length).toBeGreaterThan(0);
    expect(secondContent).toBe(firstContent);

    // No new page errors produced by repeated clicks
    const criticalPageErrors = pageErrors.filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));
    expect(criticalPageErrors.length).toBe(0);
  });

  test('Entry action renderPage() is referenced by FSM but not implemented on page => invoking it causes ReferenceError', async ({ page }) => {
    // The FSM mentions an entry action `renderPage()` for S0_Idle.
    // This test attempts to invoke renderPage() in the page context and verifies a ReferenceError occurs naturally.
    //
    // We do NOT modify the page or define renderPage(); we only attempt to call it and assert the resulting error.

    // Attempt to call the (non-existent) function renderPage() inside the page.
    // page.evaluate will reject if the function is not defined in the page context.
    await expect(page.evaluate(() => {
      // Intentionally call the missing function to let a ReferenceError occur naturally.
      // The thrown error should propagate back to the test context.
      return (window as any).renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);

    // The page may also have emitted a pageerror event for the ReferenceError; assert that we observed it.
    // Accept either a direct message mentioning renderPage or a generic ReferenceError message.
    const matchingPageErrors = pageErrors.filter(msg => /renderPage|ReferenceError/.test(msg));
    expect(matchingPageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Invoking an operation that causes a TypeError in page context yields a TypeError naturally', async ({ page }) => {
    // This test triggers a TypeError in the page context by attempting to call a property on null.
    // We assert the error is thrown and observed as a page error.

    await expect(page.evaluate(() => {
      // This will throw a TypeError: cannot read property 'f' of null (or similar)
      // It's executed in the page context and should not be caught here.
      return (null as any).f();
    })).rejects.toThrow(/TypeError/);

    const matchingPageErrors = pageErrors.filter(msg => /TypeError/.test(msg));
    expect(matchingPageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Attempting to interact with a non-existent selector results in an actionable error (edge case)', async ({ page }) => {
    // This test covers an edge case: trying to click a button that does not exist.
    // Playwright will throw an error (TimeoutError or similar). We assert the promise rejects.
    const missingSelector = 'button#nonExistentButton';

    // Use Playwright's click with a short timeout to make the test deterministic
    await expect(page.click(missingSelector, { timeout: 1000 })).rejects.toThrow();
  });

  test('Validate no unexpected console errors were emitted during a full interaction flow', async ({ page }) => {
    // This test performs the common flow and then asserts that only expected console activity occurred.
    // Steps:
    //  - Click the demo button
    //  - Confirm demo content present
    //  - Validate that console messages do not include errors (unless produced intentionally elsewhere)

    const runButton = page.locator('button[onclick="showRoutingDemo()"]');
    const demoOutput = page.locator('#demoOutput');

    await runButton.click();
    await expect(demoOutput).toBeVisible();
    await expect(demoOutput).toContainText('Initial Routing Table (Router A)');

    // Inspect collected console messages and ensure there are no error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Also ensure pageErrors does not contain unexpected critical errors
    const criticalPageErrors = pageErrors.filter(msg => /Uncaught|ReferenceError|SyntaxError|TypeError/.test(msg));
    // It's acceptable if previous intentional tests produced errors; in this isolated test run we expect none
    expect(criticalPageErrors.length).toBe(0);
  });

});