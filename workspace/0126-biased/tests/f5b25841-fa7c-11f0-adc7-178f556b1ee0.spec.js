import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b25841-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Semaphore FSM - Application f5b25841-fa7c-11f0-adc7-178f556b1ee0', () => {
  // We'll capture console messages and page errors for assertions in each test.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      try {
        // stringify arguments for richer assertions if needed
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page. We intentionally do this in beforeEach
    // to capture any errors that happen during script execution on load.
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure the page is closed/cleaned up after each test to isolate tests.
    await page.close();
  });

  test('Initial Idle state: renders UI elements (start button & canvas)', async ({ page }) => {
    // Validate presence of the Start Demonstration button and the canvas element.
    // This checks the Idle state's evidence in the FSM: button exists in DOM.
    const startButton = await page.$('#start-button');
    const canvas = await page.$('#semaphore-canvas');

    expect(startButton, 'Start button should be present in the DOM').not.toBeNull();
    expect(canvas, 'Semaphore canvas should be present in the DOM').not.toBeNull();

    // Verify attributes of the canvas (matching the HTML implementation)
    const width = await page.$eval('#semaphore-canvas', (c) => c.getAttribute('width'));
    const height = await page.$eval('#semaphore-canvas', (c) => c.getAttribute('height'));
    expect(width).toBe('400');
    expect(height).toBe('400');

    // The Idle state's FSM entry action mentions renderPage() but the provided HTML
    // does not define or call renderPage(). We therefore assert that there is no
    // console log indicating renderPage ran. We do not attempt to patch or define it.
    const hasRenderPageLog = consoleMessages.some((m) => m.text.includes('renderPage'));
    expect(hasRenderPageLog).toBe(false);
  });

  test('Page load should emit a ReferenceError due to missing Semaphore class', async ({ page }) => {
    // The HTML attempts to do: let semaphore = new Semaphore(3);
    // Since Semaphore is not defined in the provided implementation, we expect
    // a ReferenceError to occur on page load. Verify that at least one page error occurred
    // and that its message references Semaphore not being defined.
    expect(pageErrors.length).toBeGreaterThan(0);
    const messages = pageErrors.map((e) => String(e.message || e));
    const foundSemaphoreError = messages.some((m) => m.includes('Semaphore is not defined') || m.includes('Semaphore'));
    expect(foundSemaphoreError, `Expected a page error mentioning 'Semaphore' but got: ${messages.join(' | ')}`).toBe(true);

    // Also ensure console captured at least the page error or related info
    const consoleHasReference = consoleMessages.some((m) =>
      /ReferenceError|Semaphore is not defined|Semaphore/.test(m.text)
    );
    expect(consoleHasReference).toBe(true);
  });

  test('Attempting to call createThread should fail because script did not fully initialize', async ({ page }) => {
    // The FSM expects createThread to be defined and called on StartDemonstration.
    // Because the top-level script failed, createThread should be undefined.
    const typeOfCreateThread = await page.evaluate(() => typeof window.createThread);
    expect(typeOfCreateThread).toBe('undefined');

    // Attempt to invoke createThread via evaluate to observe the thrown error.
    // We do this to validate the "CreateThread" event cannot complete and to assert the
    // Evaluate call fails with an appropriate error message.
    let thrown;
    try {
      await page.evaluate(() => {
        // Attempting to call undefined global function will throw in the page context.
        // We let this error happen naturally and catch it in the test harness.
        // This is aligned with the requirement to observe runtime ReferenceError.
        // eslint-disable-next-line no-undef
        createThread(1);
      });
      thrown = false;
    } catch (err) {
      thrown = true;
      // The error message can vary across engines. Ensure it indicates that createThread is not defined.
      const msg = String(err.message || err);
      expect(msg).toMatch(/createThread|not defined|is not defined/);
    }
    expect(thrown, 'Calling createThread should throw because it is not defined').toBe(true);
  });

  test('Clicking Start Demonstration should not trigger threaded behavior due to initialization error', async ({ page }) => {
    // Ensure the start button is visible and clickable
    const startButton = page.locator('#start-button');
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeEnabled();

    // Clear any console messages captured so far for a focused check after click
    consoleMessages.length = 0;

    // Click the start button. Because the event listener was never attached (script execution stopped),
    // the click should not enqueue createThread calls. We click and then wait briefly.
    await startButton.click();
    await page.waitForTimeout(300); // small wait to allow any late handlers to run if present

    // After clicking, we expect that no new expected FSM evidence console messages exist
    // such as "Thread acquired slot and accessed resource." or "Thread completed work."
    const forbiddenPhrases = [
      'Thread acquired slot and accessed resource.',
      'Thread waited until slot became available.',
      'Thread completed work.',
      'Thread released slot and accessed resource.'
    ];
    const foundForbidden = consoleMessages.some((m) =>
      forbiddenPhrases.some((p) => m.text.includes(p))
    );
    expect(foundForbidden, 'No FSM runtime logs should appear because the script failed early').toBe(false);

    // Also verify that clicking did not attach a createThread function at runtime
    const typeOfCreateThread = await page.evaluate(() => typeof window.createThread);
    expect(typeOfCreateThread).toBe('undefined');
  });

  test('RequestAccess and ReleaseSlot functions are not callable - verify errors when invoked', async ({ page }) => {
    // The FSM lists requestAccess() and releaseSlot() as functions. Because the inline script
    // failed early, these should be undefined. We attempt to call them via evaluate and assert errors.

    // requestAccess
    let requestError;
    try {
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        requestAccess();
      });
      requestError = null;
    } catch (err) {
      requestError = String(err.message || err);
    }
    expect(requestError, 'Calling requestAccess should result in an error string')
      .toBeTruthy();
    expect(requestError).toMatch(/requestAccess|not defined|is not defined/);

    // releaseSlot
    let releaseError;
    try {
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        releaseSlot();
      });
      releaseError = null;
    } catch (err) {
      releaseError = String(err.message || err);
    }
    expect(releaseError, 'Calling releaseSlot should result in an error string')
      .toBeTruthy();
    expect(releaseError).toMatch(/releaseSlot|not defined|is not defined/);
  });

  test('FSM final state Work Completed should not be reached; no "Thread completed work." log', async ({ page }) => {
    // The FSM transition to Work Completed relies on setTimeout inside createThread,
    // which is only invoked if createThread and requestAccess exist. Since they are absent,
    // there should be no "Thread completed work." console log.
    const foundCompleted = consoleMessages.some((m) => m.text.includes('Thread completed work.'));
    expect(foundCompleted, 'Work Completed state evidence should not be present').toBe(false);
  });

  test('Edge case: ensure missing constructor errors cause no partial state transitions', async ({ page }) => {
    // If the Semaphore constructor were partially present, we might see partial logs.
    // Here we assert that there are no logs suggesting that semaphore.acquireSlot() ran.
    const foundAcquireLog = consoleMessages.some((m) => m.text.includes('acquired slot') || m.text.includes('acquireSlot'));
    expect(foundAcquireLog).toBe(false);

    // Confirm at least one page error exists and it's a ReferenceError (or similar)
    expect(pageErrors.length).toBeGreaterThan(0);
    const firstErrMsg = String(pageErrors[0].message || pageErrors[0]);
    expect(/ReferenceError|is not defined|Semaphore/i.test(firstErrMsg)).toBe(true);
  });
});