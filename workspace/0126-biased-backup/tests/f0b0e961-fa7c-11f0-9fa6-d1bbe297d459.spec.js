import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b0e961-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Comprehensive Guide to Linked Lists (Application f0b0e961-...459)', () => {
  // Shared variables for capturing console and page errors per test
  let consoleMessages;
  let pageErrors;
  /** @type {import('@playwright/test').Page} */
  let page;

  // Set up listeners before each test to observe console messages and uncaught page errors.
  test.beforeEach(async ({ page: p }) => {
    page = p;
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages from the page
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      } catch {
        // keep capturing even if some console message details throw
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err && err.name ? err.name : 'Error',
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : undefined,
      });
    });

    // Navigate to the application page (load as-is)
    await page.goto(APP_URL);
  });

  // Tear down after each test: ensure we clear listeners implicitly by closing page fixture
  test.afterEach(async () => {
    // Assert that no ReferenceError/SyntaxError/TypeError were thrown during the test run.
    // This follows the instruction to observe and assert on naturally occurring errors.
    const fatalNames = ['ReferenceError', 'SyntaxError', 'TypeError'];
    const fatalErrors = pageErrors.filter(e => fatalNames.includes(e.name));
    expect(fatalErrors, `No ReferenceError/SyntaxError/TypeError expected. Found: ${JSON.stringify(fatalErrors)}`).toHaveLength(0);
  });

  test('S0_Idle: initial page render shows Run Linked List Demo button and empty demoOutput', async () => {
    // Validate that the initial (Idle) state is rendered:
    // - Button exists with correct id and text
    // - demoOutput exists and is empty
    const demoButton = page.locator('#demoButton');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toBeEnabled();
    await expect(demoButton).toHaveText('Run Linked List Demo');

    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();

    // demoOutput should be empty on initial render (Idle state entry action renderPage() expected)
    const demoOutputText = (await demoOutput.textContent()) || '';
    expect(demoOutputText.trim(), 'demoOutput should be empty on initial load').toBe('');

    // Ensure no uncaught page errors were observed during load
    expect(pageErrors, 'No uncaught page errors should occur during initial render').toHaveLength(0);

    // Capture that no console.error messages were emitted on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, 'No console.error messages expected on initial load').toHaveLength(0);
  });

  test('Transition RunDemo: clicking demoButton moves to Demo Running and displays linked list operations', async () => {
    // This test validates the transition S0_Idle -> S1_DemoRunning when the RunDemo event (click) fires.
    // It confirms runDemo()/displayDemoOutput() behavior by checking DOM updates in #demoOutput.

    const demoButton = page.locator('#demoButton');
    const demoOutput = page.locator('#demoOutput');

    // Click the demo button to run the demo
    await demoButton.click();

    // After clicking, the demo output should contain 4 paragraphs describing each step.
    // Wait for paragraphs to appear and assert count and text content.
    await expect(page.locator('#demoOutput p')).toHaveCount(4);

    const p0 = await page.locator('#demoOutput p').nth(0).textContent();
    const p1 = await page.locator('#demoOutput p').nth(1).textContent();
    const p2 = await page.locator('#demoOutput p').nth(2).textContent();
    const p3 = await page.locator('#demoOutput p').nth(3).textContent();

    // Validate expected textual content for each stage
    expect(p0 && p0.includes('Initial list:'), 'Initial list paragraph should be present').toBe(true);
    expect(p0 && p0.includes('1') && p0.includes('2') && p0.includes('3'), 'Initial list should show 1 → 2 → 3').toBe(true);

    expect(p1 && p1.includes('After prepending 0:'), 'Prepended list paragraph should exist').toBe(true);
    expect(p1 && p1.includes('0') && p1.includes('1'), 'Prepended list should contain 0 → 1 ...').toBe(true);

    expect(p2 && p2.includes('After appending 4:'), 'Appended list paragraph should exist').toBe(true);
    expect(p2 && p2.includes('4'), 'Appended list should include 4 at tail').toBe(true);

    expect(p3 && p3.includes('After deleting 2:'), 'Deletion paragraph should exist').toBe(true);
    // After deleting 2, the sequence should not contain 2
    expect(p3 && !p3.includes('2'), 'Final list should not include 2 after deletion').toBe(true);

    // Ensure no uncaught page errors or console.error occurred while running the demo
    expect(pageErrors, 'No uncaught page errors should occur when running demo').toHaveLength(0);
    const consoleErrsDuringDemo = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrsDuringDemo, 'No console.error messages expected when running demo').toHaveLength(0);
  });

  test('Clicking multiple times resets demoOutput (idempotent) and does not accumulate content', async () => {
    // Validate idempotency: each click resets innerHTML at start, so repeated clicks should not accumulate paragraphs.
    const demoButton = page.locator('#demoButton');

    // First click
    await demoButton.click();
    await expect(page.locator('#demoOutput p')).toHaveCount(4);

    // Second click should reset and produce exactly 4 paragraphs again
    await demoButton.click();
    await expect(page.locator('#demoOutput p')).toHaveCount(4);

    // Verify that the final visible content matches the expected final demo state
    const finalTexts = await page.locator('#demoOutput p').allTextContents();
    expect(finalTexts.length).toBe(4);
    expect(finalTexts[0].includes('Initial list:'), 'First paragraph persists after repeated runs').toBe(true);

    // Confirm no uncaught errors during repeated execution
    expect(pageErrors, 'No uncaught page errors should occur during repeated demo runs').toHaveLength(0);
  });

  test('Rapid clicks do not produce runtime exceptions and final output matches one run', async () => {
    // Simulate several rapid clicks and ensure the demo remains stable (no uncaught exceptions)
    const demoButton = page.locator('#demoButton');

    // Rapidly click 5 times
    for (let i = 0; i < 5; i++) {
      await demoButton.click();
    }

    // After rapid clicks, the demoOutput should reflect the last run (4 paragraphs)
    await expect(page.locator('#demoOutput p')).toHaveCount(4);

    // No uncaught page errors should have been emitted
    expect(pageErrors, 'No uncaught page errors expected after rapid clicks').toHaveLength(0);

    // Also ensure no console.error messages
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs, 'No console.error messages expected after rapid clicks').toHaveLength(0);
  });

  test('Visual and accessibility checks: demoButton styling and accessibility', async () => {
    // Verify some visual feedback and accessibility basics for the button
    const demoButton = page.locator('#demoButton');

    // Computed background color should match the style in the page CSS (#3498db -> rgb(52, 152, 219))
    const bgColor = await page.evaluate(() => {
      const el = document.getElementById('demoButton');
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(bgColor).toBe('rgb(52, 152, 219)');

    // Ensure the button has an id and is focusable
    await demoButton.focus();
    const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(activeId).toBe('demoButton');

    // Sanity: button should have accessible text
    const accessibleName = await demoButton.textContent();
    expect(accessibleName && accessibleName.trim().length > 0, 'Button should have accessible text').toBe(true);

    // No errors emitted just for querying styles/accessibility
    expect(pageErrors, 'No page errors from accessibility/style checks').toHaveLength(0);
  });

  test('Observe console messages and assert absence of fatal JS errors (ReferenceError/SyntaxError/TypeError)', async () => {
    // This test explicitly inspects captured console messages and page errors and asserts
    // that no fatal JS errors (ReferenceError, SyntaxError, TypeError) were thrown.
    // It also records any console messages for debugging purposes (but does not fail on normal logs).

    // Click the demo to exercise script paths
    await page.locator('#demoButton').click();

    // Wait briefly to allow any asynchronous errors to surface (page scripts here are synchronous, but be safe)
    await page.waitForTimeout(150);

    // Collate any pageErrors of the fatal kinds
    const fatalNames = ['ReferenceError', 'SyntaxError', 'TypeError'];
    const fatalErrors = pageErrors.filter(e => fatalNames.includes(e.name));

    // Assert none occurred
    expect(fatalErrors, `Expected no fatal JS errors. Found: ${JSON.stringify(fatalErrors)}`).toHaveLength(0);

    // Assert no console.error messages either
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, `Expected no console.error messages. Found: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);

    // For transparency, ensure we did capture some console entries (there might be none; this is not a failing assertion)
    // This helps ensure console listener is active - not required to be non-empty.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});