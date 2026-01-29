import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a224a2-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the semaphore demo page
class SemaphorePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.containerSelector = 'div.container';
    this.startButtonSelector = "button[onclick='demonstration()']";
  }

  async goto() {
    await this.page.goto(URL);
  }

  startButton() {
    return this.page.locator(this.startButtonSelector);
  }

  async clickStartAndCaptureDialog() {
    // Wait for the dialog (alert) and click the button to trigger it
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.startButton().click()
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  async getContainerInnerHTML() {
    return this.page.locator(this.containerSelector).innerHTML();
  }

  async isRenderPageDefined() {
    return this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }

  async isDemonstrationDefined() {
    return this.page.evaluate(() => typeof window.demonstration === 'function');
  }
}

test.describe('Understanding Semaphores - Interactive Application (FSM validation)', () => {
  let pageLogs = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors to assert on them later
    pageLogs = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console messages for inspection
      pageLogs.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // capture uncaught exceptions from the page context
      pageErrors.push(err);
    });

    // Navigate to the page under test
    const sp = new SemaphorePage(page);
    await sp.goto();
  });

  test.afterEach(async () => {
    // nothing to clean up explicitly; listeners will be disposed with page
  });

  test('S0_Idle: Initial Idle state - required UI elements are present and renderPage is not defined', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) evidence from the FSM:
    // - The "Start Simple Demonstration" button exists with the correct onclick attribute
    // - The FSM entry action renderPage() is not defined in the page (we assert its absence)
    // - No unexpected page errors were emitted during load

    const sp = new SemaphorePage(page);

    // Verify the start button exists, visible, and has correct text
    const startButton = sp.startButton();
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start Simple Demonstration');

    // Verify the onclick attribute is present on the button (evidence of FSM mapping)
    const onclickAttr = await startButton.getAttribute('onclick');
    expect(onclickAttr).toBe('demonstration()');

    // The FSM lists an onEnter action renderPage() for S0_Idle, but the HTML does not define it.
    // Check that renderPage is undefined on the window (we must not call it here).
    const renderPageDefined = await sp.isRenderPageDefined();
    expect(renderPageDefined).toBe(false);

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition StartDemonstration: clicking Start Simple Demonstration triggers alert (S0 -> S1)', async ({ page }) => {
    // This test validates the transition from Idle to Demonstration:
    // - Clicking the button triggers the demonstration() function
    // - demonstration() produces an alert with the expected message
    // - The demonstration function exists and is callable

    const sp = new SemaphorePage(page);

    // Make sure the demonstration function is present as expected by the FSM
    const demoDefined = await sp.isDemonstrationDefined();
    expect(demoDefined).toBe(true);

    // Click the button and capture the alert text
    const alertText = await sp.clickStartAndCaptureDialog();
    expect(alertText).toContain('This is a demonstration of semaphore behavior');

    // Verify the page did not emit any uncaught exceptions as a result of this interaction
    expect(pageErrors.length).toBe(0);

    // There should be no unexpected console errors; we allow other console messages but assert none are type 'error'
    const consoleErrors = pageLogs.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Demonstration: demonstration() can be invoked directly and produces an alert (multiple invocations)', async ({ page }) => {
    // This test ensures that the demonstration() function behaves consistently when invoked multiple times.
    // It simulates user invoking the demonstration via the UI twice in succession and ensures dialogs are shown each time.

    const sp = new SemaphorePage(page);

    // Capture initial container HTML to assert no DOM mutation occurs due to the demonstration alerts
    const beforeHTML = await sp.getContainerInnerHTML();

    // First click -> alert
    const dialog1Promise = page.waitForEvent('dialog');
    await sp.startButton().click();
    const dialog1 = await dialog1Promise;
    expect(dialog1.message()).toContain('semaphore behavior');
    await dialog1.accept();

    // Second click -> alert again
    const dialog2Promise = page.waitForEvent('dialog');
    await sp.startButton().click();
    const dialog2 = await dialog2Promise;
    expect(dialog2.message()).toContain('semaphore behavior');
    await dialog2.accept();

    // Ensure DOM did not change as a side-effect of alerts (no UI mutation expected)
    const afterHTML = await sp.getContainerInnerHTML();
    expect(afterHTML).toBe(beforeHTML);

    // No uncaught exceptions should have been emitted
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invoking missing renderPage() should produce a ReferenceError in the page context', async ({ page }) => {
    // This test intentionally calls renderPage() in the page context to validate the FSM's reference to it.
    // The HTML does not define renderPage(), so a ReferenceError should be emitted and captured as a pageerror event.
    // We intentionally trigger this to observe and assert the natural runtime error.

    // Prepare to wait for the pageerror event that should result from calling an undefined function
    const errorPromise = page.waitForEvent('pageerror');

    // Trigger the missing function in the page context; do not catch it in the page so that pageerror is emitted
    // The evaluate call will reject if the evaluation throws; to ensure the error is reported as a pageerror,
    // we perform the invocation in a setTimeout to avoid the evaluate rejecting in the test-runner context.
    // Using evaluate(() => setTimeout(() => renderPage(), 0)) will cause renderPage() to run asynchronously in the page.
    await page.evaluate(() => {
      setTimeout(() => {
        // This will throw ReferenceError: renderPage is not defined in the page context
        // We intentionally do not wrap it in try/catch so the runtime surfaces it as an uncaught exception.
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0);
    });

    // Await the pageerror event that corresponds to the ReferenceError
    const err = await errorPromise;

    // Validate that an error occurred and that it references renderPage
    expect(err).toBeTruthy();
    const msg = (err && err.message) ? err.message : '';
    // Ensure the message is non-empty and likely points to the missing identifier
    expect(msg.length).toBeGreaterThan(0);
    // Lowercase check to be robust across engines
    expect(msg.toLowerCase()).toContain('renderpage');

    // Confirm that this is indeed a ReferenceError (some runtimes include the name in message)
    // We check for the substring 'referenceerror' for robustness
    expect(msg.toLowerCase()).toContain('referenceerror');

    // The pageErrors array should have recorded at least this error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const found = pageErrors.some(e => (e.message || '').toLowerCase().includes('renderpage'));
    expect(found).toBe(true);
  });

  test('Robustness: repeated interactions do not produce unexpected pageerrors', async ({ page }) => {
    // This test simulates a user rapidly clicking the Start button multiple times and ensures the page
    // continues to behave (alerts shown) and does not emit unexpected runtime errors.

    const sp = new SemaphorePage(page);

    const clickCount = 5;
    const dialogMessages = [];

    for (let i = 0; i < clickCount; i++) {
      const dialog = await page.waitForEvent('dialog');
      await sp.startButton().click();
      dialogMessages.push(dialog.message());
      await dialog.accept();
    }

    // Ensure we received the expected number of alert dialogs/messages
    expect(dialogMessages.length).toBe(clickCount);
    dialogMessages.forEach(msg => expect(msg).toContain('semaphore behavior'));

    // Ensure no new uncaught page errors appeared as a result of rapid interactions
    expect(pageErrors.length).toBe(0);
  });
});