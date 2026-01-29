import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04425c10-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Radix Sort Interactive Application (FSM validation)', () => {
  // We'll capture console messages and page errors for assertions in tests.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // In case msg.text() throws, still record a basic entry
        consoleMessages.push({ type: msg.type(), text: '<unable to read console text>' });
      }
    });

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      // err may be an Error object; record its message/stack for assertions
      pageErrors.push({
        message: err?.message ?? String(err),
        stack: err?.stack ?? null
      });
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Basic cleanup: ensure listeners removed implicitly when page closed by Playwright.
    // Assert we didn't leak memory in test runtime; nothing else required here.
    await page.close();
  });

  test('Idle state (S0_Idle) - initial render shows expected components and evidence', async ({ page }) => {
    // Validate the page title and main container exist
    await expect(page).toHaveTitle(/Radix Sort/i);

    // Check for the two expected buttons as per FSM evidence
    const button10 = await page.locator(".button[onclick='sortNumbers(10)']");
    const button20 = await page.locator(".button[onclick='sortNumbers(20)']");

    await expect(button10).toHaveCount(1);
    await expect(button20).toHaveCount(1);

    // Validate button texts match the FSM evidence
    await expect(button10).toHaveText('Sort Numbers');
    await expect(button20).toHaveText('Sort Numbers (Again)');

    // Validate onclick attributes exactly as in the HTML / FSM evidence
    const onclick10 = await button10.getAttribute('onclick');
    const onclick20 = await button20.getAttribute('onclick');
    expect(onclick10).toBe('sortNumbers(10)');
    expect(onclick20).toBe('sortNumbers(20)');

    // Ensure no runtime errors were emitted during initial load (renderPage() is in FSM entry_actions,
    // but the HTML does not call it. We assert that no ReferenceError for renderPage occurred)
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: SortNumbers10 (S0_Idle -> S1_Sorting) - clicking Sort Numbers triggers sortNumbers(10) and logs', async ({ page }) => {
    // This test validates the click event, the invocation of sortNumbers(10) and the console output.
    const button10 = page.locator(".button[onclick='sortNumbers(10)']");

    // Wait for the specific console output that indicates sorting happened.
    const [consoleEvent] = await Promise.all([
      // Wait for the console event that starts with the expected prefix
      page.waitForEvent('console', {
        predicate: (m) => typeof m.text === 'function' && m.text().startsWith('Sorted 10 elements:')
      }),
      // Trigger the event by clicking the button
      button10.click()
    ]);

    // Record the message in our local array (page.on('console') should also have it)
    const messageText = consoleEvent.text();
    expect(messageText.startsWith('Sorted 10 elements:')).toBe(true);

    // Parse the serialized sorted array from the console message and assert length
    const payload = messageText.split(':').slice(1).join(':').trim(); // keep anything after the first colon
    // Some implementations may include brackets or not; split by comma and remove empty strings
    const items = payload.length === 0 ? [] : payload.split(',').map(s => s.trim()).filter(s => s.length > 0);
    // FSM expected that there are 10 elements sorted
    expect(items.length).toBe(10);

    // Because of the arithmetic in the implementation, division by zero leads to NaN elements.
    // Confirm at least one NaN is present in the output to capture the edge-case behavior.
    const hasNaN = items.some(x => x === 'NaN');
    expect(hasNaN).toBe(true);

    // Ensure no uncaught page errors were thrown during the transition
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: SortNumbers20 (S0_Idle -> S1_Sorting) - clicking Sort Numbers (Again) triggers sortNumbers(20) and logs', async ({ page }) => {
    // Validate the click event for 20 elements
    const button20 = page.locator(".button[onclick='sortNumbers(20)']");

    const [consoleEvent] = await Promise.all([
      page.waitForEvent('console', {
        predicate: (m) => typeof m.text === 'function' && m.text().startsWith('Sorted 20 elements:')
      }),
      button20.click()
    ]);

    const messageText = consoleEvent.text();
    expect(messageText.startsWith('Sorted 20 elements:')).toBe(true);

    const payload = messageText.split(':').slice(1).join(':').trim();
    const items = payload.length === 0 ? [] : payload.split(',').map(s => s.trim()).filter(s => s.length > 0);
    expect(items.length).toBe(20);

    // Due to the implementation math, check that NaN values are present for this case as well
    const hasNaN = items.some(x => x === 'NaN');
    expect(hasNaN).toBe(true);

    // No unexpected page errors during this transition
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid repeated clicks produce multiple console logs and consistent outputs', async ({ page }) => {
    // This test simulates quick repeated interactions to ensure repeated transitions are handled
    const button10 = page.locator(".button[onclick='sortNumbers(10)']");

    // Prepare to capture 3 console logs for 3 clicks
    const expectedCount = 3;
    const captured = [];

    // Use page.waitForEvent in a loop to capture multiple events triggered by clicks.
    const waitForNextConsole = () => page.waitForEvent('console', {
      predicate: m => typeof m.text === 'function' && m.text().startsWith('Sorted 10 elements:')
    });

    // Fire clicks quickly without awaiting intermediate console events
    await button10.click();
    await button10.click();
    await button10.click();

    for (let i = 0; i < expectedCount; i++) {
      // Wait for each console event sequentially
      const evt = await waitForNextConsole();
      captured.push(evt.text());
    }

    // Ensure we got the expected number of logs
    expect(captured.length).toBe(expectedCount);

    // Every log should indicate 10 elements and contain 10 comma-separated tokens
    for (const msg of captured) {
      expect(msg.startsWith('Sorted 10 elements:')).toBe(true);
      const payload = msg.split(':').slice(1).join(':').trim();
      const items = payload.length === 0 ? [] : payload.split(',').map(s => s.trim()).filter(s => s.length > 0);
      expect(items.length).toBe(10);
    }

    // No uncaught exceptions should have been thrown across rapid interactions
    expect(pageErrors.length).toBe(0);
  });

  test('FSM actions verification: ensure sortNumbers function exists and is callable from page context', async ({ page }) => {
    // The FSM mentions sortNumbers(num) as an entry action for S1_Sorting.
    // Verify the global function exists in the page context and is a function.
    const hasFunction = await page.evaluate(() => {
      // Do not modify or patch the environment; only check existence and type.
      return typeof window.sortNumbers === 'function';
    });
    expect(hasFunction).toBe(true);

    // Call the function directly for an edge-case value (1) and capture its console output.
    // This uses the page's own function; we are not defining anything new.
    const [evt] = await Promise.all([
      page.waitForEvent('console', { predicate: m => typeof m.text === 'function' && m.text().startsWith('Sorted 1 elements:') }),
      page.evaluate(() => {
        // Call the existing function from within the page
        // This is allowed because we are not introducing globals or patches.
        try {
          window.sortNumbers(1);
        } catch (e) {
          // Let any errors propagate naturally; we don't catch them here.
          throw e;
        }
      })
    ]);

    // Validate the console message for the single-element case
    const text = evt.text();
    expect(text.startsWith('Sorted 1 elements:')).toBe(true);

    // For num = 1, the implementation math will make step === 0 causing NaN behavior;
    // assert that the output item exists (length 1) and is likely 'NaN' or a numeric string.
    const payload = text.split(':').slice(1).join(':').trim();
    const items = payload.length === 0 ? [] : payload.split(',').map(s => s.trim()).filter(s => s.length > 0);
    expect(items.length).toBe(1);

    // It's acceptable for this to be 'NaN' given the code's arithmetic; just assert presence.
    expect(items[0].length).toBeGreaterThanOrEqual(1);

    // Ensure no uncaught page errors occurred as a result of calling the function directly
    expect(pageErrors.length).toBe(0);
  });

  test('Error observation: report any ReferenceError, TypeError, or SyntaxError if they occurred', async ({ page }) => {
    // This test collects pageErrors recorded during previous operations in the same test file execution.
    // We do not force errors; we simply assert whether any occurred and verify their types/messages if present.

    // If there are no errors, assert that explicitly.
    if (pageErrors.length === 0) {
      // It's valid for this application to have no uncaught exceptions.
      expect(pageErrors.length).toBe(0);
    } else {
      // If errors did occur, ensure they are of expected kinds and contain messages.
      for (const err of pageErrors) {
        expect(typeof err.message).toBe('string');
        // Check common JS error names inside message (not guaranteed, but likely)
        const hasKnownErrorName = /ReferenceError|TypeError|SyntaxError/.test(err.message);
        expect(hasKnownErrorName).toBe(true);
      }
    }
  });
});