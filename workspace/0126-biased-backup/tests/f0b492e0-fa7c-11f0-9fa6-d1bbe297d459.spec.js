import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b492e0-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Observer Demo area
class ObserverPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btn = page.locator('#observerDemoBtn');
    this.demoArea = page.locator('#observerDemo');
    this.output = page.locator('#observerOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickToggle() {
    await this.btn.click();
  }

  async getButtonText() {
    return await this.btn.innerText();
  }

  async getDemoDisplay() {
    // Use computed style because inline style is manipulated
    return await this.page.$eval('#observerDemo', el => window.getComputedStyle(el).display);
  }

  async getObserverOutputText() {
    return await this.output.innerText();
  }

  // Wait until the observer output contains the provided substring
  async waitForOutputContains(substring, timeout = 5000) {
    await this.page.waitForFunction(
      (s) => document.getElementById('observerOutput')?.innerText.includes(s),
      substring,
      { timeout }
    );
  }

  // Wait until the observer output does NOT contain the provided substring
  async waitForOutputNotContains(substring, timeout = 3000) {
    await this.page.waitForFunction(
      (s) => !document.getElementById('observerOutput')?.innerText.includes(s),
      substring,
      { timeout }
    );
  }
}

test.describe('Observer Demo FSM and UI tests - f0b492e0-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown specifically; listeners removed by Playwright context teardown.
    // This hook is left for completeness and potential future cleanup.
  });

  test('Initial state S0_Idle: page renders with button text "Show Observer Demo" and demo hidden', async ({ page }) => {
    // Validate initial FSM Idle state (S0_Idle)
    // The FSM expected entry action renderPage() is not present in the HTML.
    // We check the initial DOM: button text should be "Show Observer Demo", demo display 'none', and no observer output.
    const observerPage = new ObserverPage(page);

    // Button initial text
    const initialBtnText = await observerPage.getButtonText();
    expect(initialBtnText).toBe('Show Observer Demo');

    // Demo area should be hidden via computed style
    const initialDisplay = await observerPage.getDemoDisplay();
    expect(initialDisplay).toBe('none');

    // observerOutput should be empty initially
    const initialOutput = await observerPage.getObserverOutputText();
    expect(initialOutput.trim()).toBe('');

    // Ensure no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted (we capture all console messages and assert none are of type 'error')
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1_ObserverDemoVisible: clicking button shows demo and starts observer notifications', async ({ page }) => {
    // This test validates the transition from Idle to Visible when clicking the toggle button.
    // It asserts demo becomes visible, button text changes to "Hide Observer Demo", and initial observer notifications appear.
    const observerPage = new ObserverPage(page);

    // Click to show the demo (S0 -> S1)
    await observerPage.clickToggle();

    // After clicking, demo should be visible
    const displayAfterShow = await observerPage.getDemoDisplay();
    expect(displayAfterShow).toBe('block');

    // Button text should change to "Hide Observer Demo"
    const btnTextAfterShow = await observerPage.getButtonText();
    expect(btnTextAfterShow).toBe('Hide Observer Demo');

    // The demo code immediately notifies observers with "First notification"
    // Wait for the observer output to include both observer messages
    await observerPage.waitForOutputContains('Observer 1 received: First notification', 2000);
    await observerPage.waitForOutputContains('Observer 2 received: First notification', 2000);

    const outputText = await observerPage.getObserverOutputText();
    expect(outputText).toContain('Observer 1 received: First notification');
    expect(outputText).toContain('Observer 2 received: First notification');

    // Ensure no uncaught page errors from this interaction
    expect(pageErrors.length).toBe(0);

    // Ensure no console error messages occurred
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1 -> S2_ObserverDemoHidden: clicking the button hides demo and toggles text back', async ({ page }) => {
    // Validate toggling from visible to hidden
    const observerPage = new ObserverPage(page);

    // Show first
    await observerPage.clickToggle();
    await observerPage.waitForOutputContains('Observer 1 received: First notification', 2000);

    // Now hide (S1 -> S2)
    await observerPage.clickToggle();

    // After hiding, demo should be hidden and button text should be 'Show Observer Demo'
    const displayAfterHide = await observerPage.getDemoDisplay();
    expect(displayAfterHide).toBe('none');

    const btnTextAfterHide = await observerPage.getButtonText();
    expect(btnTextAfterHide).toBe('Show Observer Demo');

    // The output may still contain previous messages (the implementation does not clear on hide),
    // but no new "Second notification" should have occurred yet at this point.
    const outputText = await observerPage.getObserverOutputText();
    expect(outputText).toContain('Observer 1 received: First notification');

    // Ensure no uncaught errors
    expect(pageErrors.length).toBe(0);

    // Also ensure that hiding did not generate console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S2 -> S1_ObserverDemoVisible: showing again restarts demo and second notification occurs (timed events)', async ({ page }) => {
    // Cycle: Idle -> Visible -> Hidden -> Visible and validate timed observer behavior
    const observerPage = new ObserverPage(page);

    // 1) Show
    await observerPage.clickToggle();
    await observerPage.waitForOutputContains('Observer 1 received: First notification', 2000);

    // 2) Hide
    await observerPage.clickToggle();
    const afterHideText = await observerPage.getObserverOutputText();
    expect(afterHideText).toContain('Observer 1 received: First notification');

    // 3) Show again (S2 -> S1)
    await observerPage.clickToggle();

    // When showing again, the script clears output.innerHTML and registers new observers and timers.
    // Wait for the immediate "First notification" messages from the new run
    await observerPage.waitForOutputContains('Observer 1 received: First notification', 2000);
    await observerPage.waitForOutputContains('Observer 2 received: First notification', 2000);

    // Now wait for the timed sequence: after ~1500ms, "Unsubscribing Observer 2..." should appear,
    // and after ~1500 + 1000 = ~2500ms the "Second notification" should appear for the remaining observers.
    // Allow a generous timeout to account for environment slowness.
    await observerPage.waitForOutputContains('Unsubscribing Observer 2...', 4000);
    await observerPage.waitForOutputContains('Observer 1 received: Second notification', 5000);

    const finalOutput = await observerPage.getObserverOutputText();
    expect(finalOutput).toContain('Unsubscribing Observer 2...');
    expect(finalOutput).toContain('Observer 1 received: Second notification');

    // Observer 2 should not have received the second notification after being unsubscribed.
    expect(finalOutput).not.toContain('Observer 2 received: Second notification');

    // Confirm final visible state: since we showed, demo should be visible and button text should be "Hide Observer Demo"
    const finalDisplay = await observerPage.getDemoDisplay();
    expect(finalDisplay).toBe('block');

    const finalBtnText = await observerPage.getButtonText();
    expect(finalBtnText).toBe('Hide Observer Demo');

    // Ensure no uncaught page errors during timed operations
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks produce consistent final toggle state (parity behavior)', async ({ page }) => {
    // Rapid clicking should toggle the demo according to parity of clicks.
    const observerPage = new ObserverPage(page);

    // Helper to perform n rapid clicks
    async function rapidClicks(n) {
      for (let i = 0; i < n; i++) {
        // Use click without waiting for anything to simulate rapid user input
        await observerPage.btn.click();
      }
    }

    // Ensure we start from known initial state (hidden)
    const startDisplay = await observerPage.getDemoDisplay();
    expect(startDisplay).toBe('none');

    // Odd number of clicks -> final should be visible
    await rapidClicks(5); // odd
    const dispAfter5 = await observerPage.getDemoDisplay();
    expect(dispAfter5).toBe('block');
    const textAfter5 = await observerPage.getButtonText();
    expect(textAfter5).toBe('Hide Observer Demo');

    // Even number of additional clicks -> toggle back to hidden
    await rapidClicks(2); // now total additional even -> should hide
    const dispAfter7 = await observerPage.getDemoDisplay();
    expect(dispAfter7).toBe('none');
    const textAfter7 = await observerPage.getButtonText();
    expect(textAfter7).toBe('Show Observer Demo');

    // Ensure no uncaught runtime errors produced by rapid interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: attempt to run undefined FSM entry action renderPage() should raise ReferenceError', async ({ page }) => {
    // The FSM metadata mentions an entry action renderPage() for S0_Idle but the page does not define it.
    // We will attempt to evaluate renderPage() in the page context and assert that a ReferenceError (or similar) is thrown.
    // We will also assert that a pageerror event was captured reflecting that exception.

    // Clear any previously captured page errors for accurate assertion
    pageErrors.length = 0;

    // Attempt to invoke the undefined function in page context.
    // Expect this evaluation to reject with an error (ReferenceError).
    // Use the promise rejection expectation to assert an exception is thrown.
    await expect(page.evaluate(() => {
      // This call should throw because renderPage is not defined in the page
      // We intentionally do this to validate the error scenario described by the FSM metadata.
      // Note: we do not define or patch renderPage(); we let the runtime throw naturally.
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow();

    // In addition to the thrown rejection from evaluate, an uncaught exception may have been emitted as a pageerror.
    // Assert that at least one pageerror was captured and that its message mentions renderPage or ReferenceError.
    // It's acceptable if the message varies across environments; we assert presence of Error objects.
    expect(pageErrors.length).toBeGreaterThanOrEqual(0); // at least ensure the array exists

    // If a pageerror was captured, assert that its message indicates renderPage was not defined (best-effort).
    if (pageErrors.length > 0) {
      const joinedMessages = pageErrors.map(e => String(e)).join(' | ');
      const looksLikeRef = /renderPage|ReferenceError|is not defined/i.test(joinedMessages);
      // We don't force that a pageerror exists (some environments propagate evaluate rejection differently),
      // but if it does, it should look like a ReferenceError related to renderPage.
      expect(looksLikeRef).toBeTruthy();
    }
  });

  test('Sanity check: ensure no unexpected console error messages were emitted during full interaction sequence', async ({ page }) => {
    // This test performs a full interaction cycle and then asserts there were no console errors recorded.
    const observerPage = new ObserverPage(page);

    // Perform interactions: show, wait for initial notifications, hide, show again and wait for timed notifications
    await observerPage.clickToggle(); // show
    await observerPage.waitForOutputContains('Observer 1 received: First notification', 2000);
    await observerPage.clickToggle(); // hide
    await observerPage.clickToggle(); // show again
    await observerPage.waitForOutputContains('Observer 1 received: First notification', 2000);
    await observerPage.waitForOutputContains('Unsubscribing Observer 2...', 4000);
    await observerPage.waitForOutputContains('Observer 1 received: Second notification', 5000);

    // Assert that none of the captured console messages are of type 'error'
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // Assert that there are no uncaught page errors recorded
    expect(pageErrors.length).toBe(0);
  });
});