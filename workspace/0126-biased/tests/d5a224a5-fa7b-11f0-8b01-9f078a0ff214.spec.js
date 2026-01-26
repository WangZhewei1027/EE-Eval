import { test, expect } from '@playwright/test';

// Test file: d5a224a5-fa7b-11f0-8b01-9f078a0ff214.spec.js
// Target URL (served externally by the test harness)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a224a5-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object representing the interactive parts of the page
class PagingAppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('button[onclick]');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickDemonstrationButtonAndAccept() {
    // Wait for the dialog to appear as a result of the click and accept it.
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.button.click()
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Paging Interactive App - FSM tests (d5a224a5-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Collect console messages and page errors to assert later.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages
    page.on('console', (msg) => {
      // Capture type and text for assertions and debugging
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Observe page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });
  });

  test('S0_Idle: Initial render shows header and Demonstration button (entry action renderPage() presence/absence)', async ({ page }) => {
    // This test validates that the initial state S0_Idle is rendered.
    // It also observes whether any page errors (e.g., ReferenceError for renderPage) occurred during page load.
    const app = new PagingAppPage(page);
    await app.goto();

    // Verify the main header is present and contains the expected title.
    await expect(app.header).toHaveText('Understanding Paging in Computer Systems');

    // The FSM's S0_Idle evidence expects a button with onclick alert; verify the button exists and has the expected label.
    await expect(app.button).toHaveCount(1);
    await expect(app.button).toHaveText('Demonstration');

    // No dialogs should be present automatically upon page load.
    // If the page had an unexpected alert on load, it would block; ensure none fired by making sure no 'dialog' events were emitted implicitly.
    // (We didn't attach a listener specifically for dialogs here; any unexpected dialogs would cause navigation/wait issues or appear in subsequent interactions.)
    // Assert there are no uncaught page errors (e.g., renderPage not found). This validates that the environment didn't throw a ReferenceError for missing entry actions.
    expect(pageErrors.length, `Expected no uncaught page errors on load, found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Ensure console did not emit error-level messages on load.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages on load, found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);

    // Confirm that no console message mentions 'renderPage' (FSM lists renderPage() as an entry action for S0_Idle;
    // the HTML does not implement such a function, so if a ReferenceError occurred it would have shown up in pageErrors).
    const mentionsRenderPage = consoleMessages.some(m => m.text.includes('renderPage'));
    expect(mentionsRenderPage).toBe(false);
  });

  test('Transition: Clicking Demonstration button triggers alert (S0_Idle -> S1_Demonstration) and alert message matches expected', async ({ page }) => {
    // This test validates the FSM transition from S0_Idle to S1_Demonstration by clicking the button
    // and checking the alert dialog message (S1 entry action is an alert).
    const app = new PagingAppPage(page);
    await app.goto();

    // Click the button and capture the alert message.
    const dialogMessage = await app.clickDemonstrationButtonAndAccept();

    // The FSM expected observable is: alert('This is a simple demonstration of paging concept!')
    expect(dialogMessage).toBe("This is a simple demonstration of paging concept!");

    // After handling the dialog, assert there were no uncaught page errors triggered by the click.
    expect(pageErrors.length, `Expected no uncaught page errors after clicking button, found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Also ensure no console.error messages were emitted as a result of the interaction.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages after clicking button, found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Edge case: Repeated clicks produce repeated alerts and are handled sequentially', async ({ page }) => {
    // This test validates repeated transitions S0_Idle -> S1_Demonstration for multiple clicks.
    // It checks the application consistently triggers the expected alert each time.
    const app = new PagingAppPage(page);
    await app.goto();

    // Perform three sequential clicks, ensuring each produces the alert and that the message matches.
    for (let i = 0; i < 3; i++) {
      const message = await app.clickDemonstrationButtonAndAccept();
      expect(message).toBe("This is a simple demonstration of paging concept!");
    }

    // Ensure no uncaught page errors resulted from repeated interactions.
    expect(pageErrors.length, `Expected no uncaught page errors after repeated clicks, found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  test('Edge case: Verify clicking non-target elements does not trigger FSM transition or errors', async ({ page }) => {
    // This test checks that clicking an unrelated element (e.g., a paragraph) does not trigger the demonstration alert
    // and that no errors are thrown when interacting with content.
    const app = new PagingAppPage(page);
    await app.goto();

    // Click on a safe non-button area: the main section paragraph
    const paragraph = page.locator('section p').first();
    await paragraph.click();

    // No dialog should appear; ensure that a dialog does not appear within a short timeout.
    // We attempt to wait for a dialog for a short time - if none appears, the wait will timeout and we proceed.
    let dialogAppeared = false;
    const dialogPromise = page.waitForEvent('dialog', { timeout: 500 }).then(() => { dialogAppeared = true; }).catch(() => { /* no dialog */ });
    await dialogPromise;

    expect(dialogAppeared).toBe(false);

    // Also ensure no page errors were introduced by interacting with non-interactive content.
    expect(pageErrors.length, `Expected no uncaught page errors after clicking paragraph, found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  test('Observability: Console and pageerror streams are captured correctly (no unexpected runtime errors)', async ({ page }) => {
    // This test demonstrates that console and pageerror listeners are working and asserts overall health of the page.
    const app = new PagingAppPage(page);
    await app.goto();

    // Perform one valid action to ensure listeners capture activity.
    const msg = await app.clickDemonstrationButtonAndAccept();
    expect(msg).toContain('simple demonstration');

    // Validate that console message capturing works (there may be informational logs)
    // We assert that no console error-level messages were captured.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);

    // Validate that there are no uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    // If any such errors occurred naturally while loading or interacting with the page, they would be in pageErrors.
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Additional safety: log captured console messages and page errors to help debugging if tests fail.
    if (pageErrors.length > 0) {
      // Print to test runner logs; do not modify page environment.
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors.map(e => e.message).join(' | '));
    }
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    if (errorConsoleMsgs.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Captured console.error messages:', errorConsoleMsgs.map(m => m.text).join(' | '));
    }
  });
});