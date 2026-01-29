import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b45412-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Encryption Demo App - FSM validation (f5b45412-fa7c-11f0-adc7-178f556b1ee0)', () => {

  // Setup before each test: navigate to the page and ensure a clean state.
  test.beforeEach(async ({ page }) => {
    // Listen to console and page errors for diagnostics in tests
    page.on('console', msg => {
      // Intentionally do nothing here; tests will inspect arrays if needed.
    });
    await page.goto(APP_URL);
  });

  // Test: Initial Idle state - verify initial DOM matches FSM evidence
  test('Initial Idle state: demo button is present and no text container exists', async ({ page }) => {
    // This test validates the Idle state (S0_Idle)
    // - The demo button should exist with id #demo-button and text 'Demo'
    // - The .text-container element expected by the FSM's entry action should NOT exist in the provided HTML
    const demoButton = await page.locator('#demo-button');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Demo');

    // Verify there is no .text-container present in the initial DOM as implemented
    const textContainer = await page.locator('.text-container');
    // Expect the locator to not be attached to the DOM
    await expect(textContainer).toHaveCount(0);

    // Ensure there are no page errors before any interaction
    // We use waitForTimeout briefly to ensure no background errors fire immediately on load
    const errors: any[] = [];
    const handler = (err: Error) => errors.push(err);
    page.on('pageerror', handler);
    await page.waitForTimeout(200); // small pause to catch any immediate errors
    page.off('pageerror', handler);
    expect(errors.length).toBe(0);
  });

  // Test: Clicking the demo button triggers the ButtonClick event and leads to a runtime error
  test('ButtonClick event: clicking Demo triggers an error due to missing .text-container (expected TypeError)', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_DemoDisplayed as implemented in the page script
    // According to the implementation, clicking #demo-button runs code that assumes .text-container exists.
    // Because .text-container is missing in the HTML, the click handler should throw a runtime error (TypeError)
    // We assert the error occurs and that the sample text is NOT displayed.

    // Prepare to capture pageerror
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#demo-button')
    ]);

    // The thrown error should reference 'innerHTML' (attempt to set innerHTML on null)
    // Different Chromium versions produce slightly different messages; assert that 'innerHTML' appears.
    expect(pageError).toBeTruthy();
    expect(typeof pageError.message).toBe('string');
    expect(pageError.message).toContain('innerHTML');

    // After the failed transition, the .text-container should still not exist and no sample text should be present
    const textContainer = await page.locator('.text-container');
    await expect(textContainer).toHaveCount(0);

    // Also verify that the visible page content does not include the sample text string
    const pageContent = await page.content();
    expect(pageContent).not.toContain('This is some sample text for demonstration purposes only.');
  });

  // Test: Multiple clicks produce multiple errors - ensures event handler consistently throws when DOM is missing
  test('Repeated ButtonClick events produce repeated errors (edge case: repeated user clicks)', async ({ page }) => {
    // This test validates how the application behaves under repeated event triggers.
    // Each click should attempt the same DOM access and produce an error each time.
    const errorMessages = [];

    // Attach an event listener to collect page errors (for counting)
    const handler = (err: Error) => errorMessages.push(err.message);
    page.on('pageerror', handler);

    // Perform several clicks sequentially, awaiting the pageerror each time to ensure we capture it.
    const repeat = 3;
    for (let i = 0; i < repeat; i++) {
      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#demo-button')
      ]);
      // Push the observed message as well (redundant with handler, but explicit)
      errorMessages.push(err.message);
    }

    page.off('pageerror', handler);

    // Because we pushed duplicates, ensure at least 'repeat' occurrences mention innerHTML
    const innerHTMLCount = errorMessages.filter(msg => typeof msg === 'string' && msg.includes('innerHTML')).length;
    expect(innerHTMLCount).toBeGreaterThanOrEqual(repeat);

    // Ensure the sample text was never injected
    const pageContent = await page.content();
    expect(pageContent).not.toContain('This is some sample text for demonstration purposes only.');
  });

  // Test: Observing console messages and pageerrors during interaction
  test('Diagnostic: console and page errors observed when clicking Demo', async ({ page }) => {
    // This test collects console messages and page errors to validate developer-visible diagnostics
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      try {
        // Capture text for inspection
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // ignore potential inspect errors
      }
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    // Click the button and wait for error
    await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#demo-button')
    ]);

    // At least one page error should be recorded
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors[0]).toContain('innerHTML');

    // Console may or may not have messages; ensure the handler didn't throw and we safely captured entries (if any)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  // Test: Verify FSM expected observable (sample text) is not achieved due to runtime error (negative assertion)
  test('FSM Transition Observable: sample text is not displayed because onEnter action fails', async ({ page }) => {
    // This test explicitly links the FSM's expected observable ("Sample text is displayed in the text container.")
    // to the actual runtime outcome. Because the onEnter action references a missing element, the observable fails.
    // Click and assert that the expected observable is not present and an error was thrown.

    // Attempt the transition and capture the error
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#demo-button')
    ]);

    // Confirm error is consistent with missing element during onEnter action
    expect(err.message).toMatch(/innerHTML/);

    // Confirm the expected observable (the sample text) is absent
    const pageText = await page.locator('body').innerText();
    expect(pageText).not.toContain('This is some sample text for demonstration purposes only.');
  });

});