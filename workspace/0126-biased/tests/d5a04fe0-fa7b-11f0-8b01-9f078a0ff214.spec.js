import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a04fe0-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('FSM: Understanding Sets in Mathematics (Application ID: d5a04fe0-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Arrays to collect runtime console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Attach listeners before each test to capture console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') consoleErrors.push(entry);
    });

    page.on('pageerror', error => {
      // pageerror events are thrown exceptions in page context
      pageErrors.push({ message: error.message, stack: error.stack });
    });

    // Navigate to the exact page as provided; do not modify page contents
    await page.goto(PAGE_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No special teardown required; Playwright handles closing pages/contexts
  });

  test('S0_Idle: Initial Idle state - UI renders button and demo-output is hidden', async ({ page }) => {
    // This test validates the S0_Idle state's evidence:
    // - The "Show Set Operations Example" button is present
    // - The #demo-output element exists and is hidden (style display:none)
    const showButton = page.locator('#show-demo');
    const demoOutput = page.locator('#demo-output');

    // Verify the button exists and has expected text
    await expect(showButton).toHaveCount(1);
    await expect(showButton).toBeVisible(); // button is visible initially
    await expect(showButton).toHaveText('Show Set Operations Example');

    // Verify demo-output exists but is not visible (entry state's evidence)
    await expect(demoOutput).toHaveCount(1);
    await expect(demoOutput).not.toBeVisible();

    // Explicitly check inline style display is 'none' as given in HTML
    const displayStyle = await demoOutput.evaluate(el => el.style.display);
    expect(displayStyle).toBe('none');

    // Verify there are no unexpected console errors or page errors on initial load
    expect(consoleErrors.length, 'No console.error on initial load').toBe(0);
    expect(pageErrors.length, 'No runtime page errors on initial load').toBe(0);
  });

  test('Transition ShowDemo: clicking the button updates demo-output textContent and displays it (S0_Idle -> S1_DemoShown)', async ({ page }) => {
    // This test validates the ShowDemo event and the transition to S1_DemoShown:
    // - Clicking #show-demo sets #demo-output.textContent to demo text
    // - #demo-output.style.display becomes 'block' and element becomes visible
    const showButton = page.locator('#show-demo');
    const demoOutput = page.locator('#demo-output');

    // Ensure initial conditions are as expected
    await expect(demoOutput).not.toBeVisible();

    // Click the button to trigger the transition
    await showButton.click();

    // After clicking, demo-output should be visible
    await expect(demoOutput).toBeVisible();

    // The inline style should be updated to 'block'
    const displayStyle = await demoOutput.evaluate(el => el.style.display);
    expect(displayStyle).toBe('block');

    // The textContent should include expected demonstration content (Union, Intersection, Difference)
    const text = await demoOutput.textContent();
    expect(text, 'demo-output should include Union').toContain('Union');
    expect(text, 'demo-output should include Intersection').toContain('Intersection');
    expect(text, 'demo-output should include Difference').toContain('Difference');

    // Double-check a couple of exact substrings present (guarding against accidental empty text)
    expect(text).toContain('A = {1, 2, 3}');
    expect(text).toContain('B = {3, 4, 5}');

    // Verify that no console.error or pageerror occurred as a result of the click
    expect(consoleErrors.length, 'No console.error after clicking show-demo').toBe(0);
    expect(pageErrors.length, 'No runtime page errors after clicking show-demo').toBe(0);
  });

  test('Idempotency and repeated interactions: multiple clicks do not duplicate content unexpectedly', async ({ page }) => {
    // This test checks edge behavior when user clicks the demo button multiple times quickly.
    // We assert that the textContent remains stable (not appended multiple times).
    const showButton = page.locator('#show-demo');
    const demoOutput = page.locator('#demo-output');

    // Click once, capture text
    await showButton.click();
    await expect(demoOutput).toBeVisible();
    const firstText = (await demoOutput.textContent()) || '';

    // Click second time quickly
    await showButton.click();
    await expect(demoOutput).toBeVisible();
    const secondText = (await demoOutput.textContent()) || '';

    // The content should remain the same (since implementation sets textContent, not append)
    expect(secondText).toBe(firstText);

    // Click multiple times in sequence
    await Promise.all([showButton.click(), showButton.click(), showButton.click()]);

    // Ensure still visible and text unchanged
    const finalText = (await demoOutput.textContent()) || '';
    expect(finalText).toBe(firstText);

    // Ensure no page errors were triggered by repeated clicks
    expect(pageErrors.length, 'No runtime page errors after repeated clicks').toBe(0);
    expect(consoleErrors.length, 'No console.error after repeated clicks').toBe(0);
  });

  test('Verify onEnter/onExit actions presence: renderPage() entry action from FSM is NOT defined on window', async ({ page }) => {
    // The FSM lists an entry action "renderPage()". The HTML/JS implementation does not define this.
    // We validate the environment: renderPage should not be defined (we do NOT call it).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // Expect 'undefined' because the page does not define renderPage function
    expect(renderPageType).toBe('undefined');

    // Document the fact that since renderPage is absent, no ReferenceError or other runtime error
    // should arise merely from its non-existence (we did not invoke it).
    expect(pageErrors.length, 'No runtime page errors from missing renderPage invocation').toBe(0);
    expect(consoleErrors.length, 'No console.error related to renderPage absence').toBe(0);
  });

  test('Edge case: ensure clicking the button does not throw ReferenceError/SyntaxError/TypeError (observe any thrown errors)', async ({ page }) => {
    // This test ensures we observe and record any runtime exceptions that may occur during interaction.
    // We will click the button and then assert that no ReferenceError, SyntaxError, or TypeError was emitted.
    const showButton = page.locator('#show-demo');

    // Click to trigger the demo
    await showButton.click();

    // Wait briefly to let any asynchronous exceptions appear in pageerror
    await page.waitForTimeout(250);

    // Inspect collected page errors for specific JavaScript error types
    const pageErrorMessages = pageErrors.map(e => e.message).join('\n||\n');

    // Assert that none of the common fatal error types are present in the page errors
    expect(
      pageErrorMessages.includes('ReferenceError'),
      'No ReferenceError occurred during interaction'
    ).toBe(false);

    expect(
      pageErrorMessages.includes('SyntaxError'),
      'No SyntaxError occurred during interaction'
    ).toBe(false);

    expect(
      pageErrorMessages.includes('TypeError'),
      'No TypeError occurred during interaction'
    ).toBe(false);

    // Also ensure console.error was not invoked with those names
    const consoleErrorTexts = consoleErrors.map(e => e.text).join('\n||\n');
    expect(consoleErrorTexts.includes('ReferenceError')).toBe(false);
    expect(consoleErrorTexts.includes('SyntaxError')).toBe(false);
    expect(consoleErrorTexts.includes('TypeError')).toBe(false);
  });

  test('Accessibility check: button has accessible name and demo-output remains reachable in DOM', async ({ page }) => {
    // Validate that interactive component has an accessible name and that the demo output is present in DOM.
    const showButton = page.locator('#show-demo');
    const demoOutput = page.locator('#demo-output');

    // Accessible name - using button text as label
    const accessibleName = await showButton.getAttribute('aria-label') || (await showButton.textContent());
    expect(accessibleName).toBeTruthy();

    // demo-output should be in DOM regardless of visibility
    const isAttached = await demoOutput.evaluate(el => !!el && el.nodeType === Node.ELEMENT_NODE);
    expect(isAttached).toBe(true);

    // No runtime errors from these checks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: log and error capture sanity check - record console history for debugging', async ({ page }) => {
    // This final test ensures our console and pageerror collectors are functioning.
    // We will not assert any errors here beyond verifying that the collectors are arrays and present.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(consoleErrors)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // The page is not expected to log console.error messages under normal operation.
    // If there are console errors or page errors, include them in the assertion failure message for debugging.
    expect(consoleErrors.length, `Console errors captured: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors captured: ${JSON.stringify(pageErrors)}`).toBe(0);
  });
});