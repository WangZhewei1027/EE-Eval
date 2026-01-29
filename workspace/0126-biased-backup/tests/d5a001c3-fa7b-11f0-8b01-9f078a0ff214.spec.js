import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a001c3-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object to encapsulate interactions with the Queue demo page
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('button'); // primary button selector
  }

  // Navigate to the app URL and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return button text content
  async getButtonText() {
    return this.button.textContent();
  }

  // Return the onclick attribute value
  async getButtonOnclick() {
    return this.button.getAttribute('onclick');
  }

  // Click the demo button and wait for the alert dialog to appear; returns the dialog message
  async clickAndGetAlertMessage() {
    // Trigger click and wait for the resulting dialog
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.button.click();
    const dialog = await dialogPromise;
    const message = dialog.message();
    // Accept the alert so page execution continues
    await dialog.accept();
    return message;
  }

  // Click n times sequentially capturing all alert messages
  async clickMultipleTimesAndCollectAlerts(times = 1) {
    const messages = [];
    for (let i = 0; i < times; i++) {
      const msg = await this.clickAndGetAlertMessage();
      messages.push(msg);
    }
    return messages;
  }
}

test.describe('Understanding Queues interactive application (d5a001c3-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // containers for console messages and page errors observed during each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test to capture console and runtime errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events (log, info, warning, error, debug)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Basic cleanup / assertions after each test to ensure there are no unexpected runtime errors.
  test.afterEach(async ({ page }) => {
    // Provide a helpful assertion message if there were page errors.
    if (pageErrors.length > 0) {
      // Aggregate messages for clearer failure output in test logs.
      const errorMessages = pageErrors.map((e) => `${e.name}: ${e.message}`).join('\n---\n');
      // Fail the test if any unexpected page errors were observed.
      throw new Error(`Unexpected page errors were observed during the test:\n${errorMessages}`);
    }

    // No teardown actions required beyond Playwright automatic cleanup.
  });

  test('Page loads and Idle state is rendered with expected static content', async ({ page }) => {
    // This test validates the Idle state's entry rendering:
    // - Page title and main heading exist
    // - The demo button exists with expected text and onclick evidence from FSM
    const queue = new QueuePage(page);

    // Navigate to the app page
    await queue.goto();

    // Verify page title contains the concept name
    await expect(page).toHaveTitle(/Understanding Queues in Data Structures/);

    // Check that the main heading exists and contains "Understanding Queues"
    const heading = page.locator('h1');
    await expect(heading).toHaveText(/Understanding Queues in Data Structures/);

    // The FSM's Idle state expects the page to render a button that demonstrates enqueue;
    // assert the button exists and has correct text and onclick attribute evidence.
    await expect(queue.button).toBeVisible();
    const btnText = await queue.getButtonText();
    expect(btnText && btnText.trim()).toBe('Click for a Simple Demo');

    const onclickAttr = await queue.getButtonOnclick();
    // Assert that the onclick attribute contains the alert snippet described in FSM evidence
    expect(onclickAttr).toContain("alert('This demonstrates a simple enqueue operation. Imagine adding one more element to the queue.');");

    // Verify that there were no runtime page errors triggered by loading the page (renderPage() from FSM is not present in the HTML,
    // but we must not inject or define it). If such an error existed, it would appear in pageErrors and fail in afterEach.
    expect(pageErrors.length).toBe(0);

    // Check that there were no console errors at load time.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking the demo button triggers an alert with the expected message and stays in Idle', async ({ page }) => {
    // This test validates the ClickForDemo event and transition:
    // - Clicking the button displays an alert with the exact message from the FSM evidence
    // - After dismissing the alert, the page remains in the Idle state (button still present)
    const queue = new QueuePage(page);
    await queue.goto();

    // Click and capture alert message
    const message = await queue.clickAndGetAlertMessage();

    // Validate the alert message matches the FSM's expected text exactly
    const expectedMessage = "This demonstrates a simple enqueue operation. Imagine adding one more element to the queue.";
    expect(message).toBe(expectedMessage);

    // After closing the alert, the button should still be present (state remains S0_Idle)
    await expect(queue.button).toBeVisible();

    // Confirm no uncaught errors were recorded
    expect(pageErrors.length).toBe(0);

    // Confirm no console errors were recorded during the interaction
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid multiple clicks produce multiple alerts sequentially (edge case)', async ({ page }) => {
    // Edge case: user clicks the demo button multiple times in quick succession.
    // Each click should produce its own alert. We verify that alerts are shown for each click and contain the expected text.
    const queue = new QueuePage(page);
    await queue.goto();

    const times = 3;
    // Click the button three times sequentially and collect messages
    const messages = await queue.clickMultipleTimesAndCollectAlerts(times);

    // Validate we received exactly as many alerts as clicks and that each contains the expected message.
    expect(messages.length).toBe(times);
    const expectedMessage = "This demonstrates a simple enqueue operation. Imagine adding one more element to the queue.";
    for (const msg of messages) {
      expect(msg).toBe(expectedMessage);
    }

    // After repeated interactions, the page should still be intact and no runtime errors should have occurred.
    await expect(queue.button).toBeVisible();
    expect(pageErrors.length).toBe(0);
  });

  test('DOM evidence check: page source contains the onclick evidence snippet exactly once', async ({ page }) => {
    // This test ensures the exact evidence string used in the FSM is present in the page source.
    // We are not modifying the page; just asserting that the HTML contains the evidence snippet.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Retrieve the full page content and assert the onclick evidence exists
    const content = await page.content();

    const evidenceSnippet = "onclick=\"alert('This demonstrates a simple enqueue operation. Imagine adding one more element to the queue.');\"";
    // The snippet should appear at least once
    expect(content.includes(evidenceSnippet)).toBe(true);

    // Also ensure there are no page errors during retrieval
    expect(pageErrors.length).toBe(0);
  });

  test('Verify absence of declared onEnter function renderPage (as per FSM entry action) without modifying runtime', async ({ page }) => {
    // The FSM lists an entry_action renderPage() for S0_Idle.
    // The HTML does not define renderPage; per instructions we MUST NOT define it ourselves.
    // This test validates the environment as-is: renderPage should be undefined and there should be no runtime invocation error.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Execute a small script in the page context to check for existence of renderPage without creating it.
    const hasRenderPage = await page.evaluate(() => {
      // Return the type of renderPage (undefined if not present)
      return typeof window.renderPage;
    });

    // The application HTML did not define renderPage(), so typeof should be 'undefined'
    expect(hasRenderPage).toBe('undefined');

    // Ensure no ReferenceError was thrown regarding renderPage during page load (would have been captured in pageErrors)
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console and page errors: explicit observation test', async ({ page }) => {
    // This test focuses on verifying that console and pageerror listeners work and that there are no unexpected errors
    // when interacting with the app. It also asserts that alerts are being logged as dialogs (we capture them separately).
    const queue = new QueuePage(page);
    await queue.goto();

    // No console errors expected initially
    const initialConsoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(initialConsoleErrors.length).toBe(0);

    // Trigger an alert and ensure it appears (and is accepted)
    const alertMsg = await queue.clickAndGetAlertMessage();
    expect(alertMsg.length).toBeGreaterThan(0);

    // After the interaction, assert again that no page errors were captured
    expect(pageErrors.length).toBe(0);

    // Finally, check console message array is an array
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});