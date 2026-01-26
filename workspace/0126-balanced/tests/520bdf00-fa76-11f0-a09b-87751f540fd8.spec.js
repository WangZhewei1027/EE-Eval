import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520bdf00-fa76-11f0-a09b-87751f540fd8.html';

test.describe('520bdf00-fa76-11f0-a09b-87751f540fd8 - Backpropagation FSM and runtime checks', () => {
  // Collectors for cross-test debugging (reset per test)
  let pageErrors;
  let consoleMessages;

  // Helper to attach listeners to a Playwright page that collects pageerrors and console messages
  async function attachCollectors(page) {
    pageErrors = [];
    consoleMessages = [];

    // Capture unhandled exceptions from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });

    // Capture console messages (logs, errors, warnings)
    page.on('console', (msg) => {
      // Save both the type and the text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  }

  test.beforeEach(async ({ page }) => {
    // Attach collectors before navigating to ensure we capture errors emitted during load/inline scripts
    await attachCollectors(page);
  });

  test('S0_Idle state: page loads and static content is present (initial state verification)', async ({ page }) => {
    // This test validates the Idle state existence by verifying DOM content present on initial load.
    // We attach collectors in beforeEach so runtime errors will still be captured but do not interfere with this assertion.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Verify the main heading is present and correct as evidence of Idle state's static UI.
    const heading = await page.locator('h1').textContent();
    expect(heading).toBe('Backpropagation');

    // Verify that descriptive paragraphs about backpropagation are present
    const paragraphs = await page.locator('p').allTextContents();
    expect(paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(paragraphs[0]).toContain('Backpropagation is an algorithm');
  });

  test('S1_Training state: main() is invoked and runtime errors occur during training (transition verification)', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Training by checking that the inline main() entry action executed
    // and produced runtime errors (as expected from the unmodified implementation).
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure at least one page error occurred due to the broken inline script (backprop/dotProduct misuse).
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the errors should be a TypeError originating from misuse of array APIs (e.g., calling reduce on a number).
    const hasTypeError = pageErrors.some(e => e && e.name === 'TypeError');
    expect(hasTypeError).toBeTruthy();

    // Check that the error message indicates an invalid operation like "reduce is not a function" or similar.
    // We accept a few variants to be robust across different engines.
    const joinedErrorMessages = pageErrors.map(e => e && (e.message || '')).join(' | ');
    const reduceRelated = /reduce|is not a function|not a function/i.test(joinedErrorMessages);
    expect(reduceRelated).toBeTruthy();
  });

  test('FSM transition and stack traces: ensure errors reference functions from the training flow (backpropagation, dotProduct, main)', async ({ page }) => {
    // This test asserts that the runtime error stack includes function names that indicate the training path ran:
    // e.g., backpropagation, dotProduct, main. Presence of these in the stack shows the transition to Training happened.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // There should be at least one error with a stack trace
    const errorWithStack = pageErrors.find(e => e && typeof e.stack === 'string');
    expect(errorWithStack).toBeDefined();

    const stack = (errorWithStack && errorWithStack.stack) || '';
    // We check for multiple possible function names that should appear in the stack if main -> backpropagation -> dotProduct ran.
    const expectedFrames = ['backpropagation', 'dotProduct', 'main'];
    const foundFrame = expectedFrames.some(frame => stack.includes(frame));
    // It's sufficient if at least one of these frames appears, indicating the training-related code executed before the error.
    expect(foundFrame).toBeTruthy();
  });

  test('No successful final output: "Final output:" should not be logged due to runtime error preventing completion', async ({ page }) => {
    // This test verifies that the intended console.log("Final output:", ...) is not produced because the script errors out.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Search console messages to confirm "Final output:" is not present.
    const finalOutputMessages = consoleMessages.filter(m => typeof m.text === 'string' && m.text.includes('Final output:'));
    expect(finalOutputMessages.length).toBe(0);
  });

  test('Edge case: multiple runtime errors are captured when training loop runs repeatedly', async ({ page }) => {
    // The implementation calls main() and then backpropagation many times; this test verifies that multiple errors
    // can occur and are captured (the page may emit a series of exceptions).
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Expect at least one error; on some engines there may be several similar errors emitted.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // All captured errors should be Error-like objects; ensure we can read name/message for each.
    for (const err of pageErrors) {
      expect(err).toHaveProperty('message');
      expect(err).toHaveProperty('name');
    }
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: navigate away to allow subsequent tests to start from a fresh page if needed.
    // This is not modifying the application, only ensuring a clean slate in the test runner.
    try {
      await page.goto('about:blank');
    } catch (e) {
      // ignore navigation errors during teardown
    }
  });
});