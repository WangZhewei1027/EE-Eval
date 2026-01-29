import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a33613-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Decision Tree demo page
class DecisionTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async title() {
    return this.page.title();
  }

  async getVisualizeButton() {
    return this.page.locator('button[onclick]');
  }

  async getVisualizeButtonText() {
    return this.getVisualizeButton().innerText();
  }

  async getVisualizeButtonOnclick() {
    return this.page.getAttribute('button[onclick]', 'onclick');
  }

  async clickVisualizeButton() {
    await this.getVisualizeButton().click();
  }

  async bodyInnerText() {
    return this.page.locator('body').innerText();
  }
}

test.describe('Application d5a33613-fa7b-11f0-8b01-9f078a0ff214 - Understanding Decision Trees', () => {
  // Containers to collect console messages, page errors, and dialogs observed per test
  let consoleEvents;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleEvents = [];
    pageErrors = [];
    dialogs = [];

    // Collect console events (type + text)
    page.on('console', (msg) => {
      consoleEvents.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions on the page (pageerror)
    page.on('pageerror', (err) => {
      // err is an Error object with name and message
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Collect dialog objects (alert, confirm, prompt)
    page.on('dialog', async (dialog) => {
      // store dialog info and then accept to avoid blocking the test
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Accept the alert so the page is not blocked; do not provide text for prompt intentionally
      try {
        await dialog.accept();
      } catch (e) {
        // if accept fails, just swallow - the page may be closed shortly after in a test
      }
    });
  });

  // Test initial Idle state: page loads and shows the Visualize Decision Tree button
  test('Initial state (S0_Idle): page loads and Visualize Decision Tree button is present', async ({ page }) => {
    const dtPage = new DecisionTreePage(page);

    // Navigate to the page and wait for it to load fully
    await dtPage.goto();

    // Assert the page title is as expected
    const title = await dtPage.title();
    expect(title).toContain('Understanding Decision Trees');

    // The page should contain exactly the button with attribute [onclick]
    const button = dtPage.getVisualizeButton();
    await expect(button).toHaveCount(1);

    // Verify the button text matches the FSM/component description
    const btnText = await dtPage.getVisualizeButtonText();
    expect(btnText.trim()).toBe('Visualize Decision Tree');

    // Verify that the button has an onclick attribute that triggers an alert
    const onclickAttr = await dtPage.getVisualizeButtonOnclick();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain('alert(');

    // Validate that loading the page did not emit any page-level runtime errors
    // (If the application attempted to call a missing renderPage() function on load, we'd see a ReferenceError here).
    expect(pageErrors).toEqual([]);

    // Ensure there were no console messages of type 'error' emitted during load
    const consoleErrors = consoleEvents.filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the VisualizeTree event/transition: clicking the button triggers an alert showing the tree
  test('Event VisualizeTree: clicking the button shows the decision tree alert (S0 -> S1 transition)', async ({ page }) => {
    const dtPage = new DecisionTreePage(page);

    // Navigate
    await dtPage.goto();

    // Capture body text snapshot before clicking to assert no DOM changes occur after clicking (visualization is via alert)
    const beforeBodyText = await dtPage.bodyInnerText();

    // Expected dialog text exactly as defined in the inline onclick alert
    const expectedDialog = "This is a simple decision tree representation.\n\n   Outlook\n   ├── Sunny\n   │   ├── Humidity\n   │   │   ├── High: No\n   │   │   └── Low: Yes\n   ├── Overcast: Yes\n   └── Rain\n       ├── Wind\n       │   ├── Strong: No\n       │   └── Weak: Yes";

    // Click the button and wait for the dialog to be emitted (the page.on('dialog') handler in beforeEach will accept it)
    // We also explicitly wait for the 'dialog' event from the page to ensure the alert was shown
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog', { timeout: 3000 }),
      dtPage.clickVisualizeButton()
    ]);

    // Validate the dialog content matches the expected decision tree representation
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe(expectedDialog);

    // Additionally assert that our page.on('dialog') collector received the same dialog message
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1].message).toBe(expectedDialog);

    // After the alert, the DOM should not have changed (this demo shows content via alert only)
    const afterBodyText = await dtPage.bodyInnerText();
    expect(afterBodyText).toBe(beforeBodyText);

    // Confirm there were no page runtime errors caused by clicking the button
    expect(pageErrors).toEqual([]);

    // Confirm there were no console errors logged as a result of clicking
    const consoleErrors = consoleEvents.filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test to assert FSM entry/exit actions where applicable and observe whether missing functions cause errors.
  test('FSM entry/exit actions observation: verify no unintended ReferenceError for missing renderPage() and that alert acts as S1 entry action', async ({ page }) => {
    const dtPage = new DecisionTreePage(page);

    // Navigate
    await dtPage.goto();

    // If the page attempted to invoke renderPage() on load, we'd have captured a ReferenceError in pageErrors.
    // The FSM mentions renderPage() as an entry action for S0_Idle, but the actual HTML does not call it.
    // Assert that no ReferenceError occurred (i.e., the environment did not try to call a missing function).
    const referenceErrors = pageErrors.filter((e) => e.name === 'ReferenceError' || /ReferenceError/.test(e.message));
    expect(referenceErrors.length).toBe(0);

    // Now trigger the S1 entry action by clicking the button (alert). We verify the alert occurred via dialog collector
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog', { timeout: 3000 }),
      dtPage.clickVisualizeButton()
    ]);

    // S1 entry action as per FSM is an alert showing the tree; ensure that the dialog text exists and is non-empty
    expect(dialog.type()).toBe('alert');
    expect(dialog.message().length).toBeGreaterThan(0);

    // Confirm again that no new page errors were spawned by this action
    expect(pageErrors).toEqual([]);
  });

  // Edge case: attempting to click a non-existent element should result in a Playwright error (client-side test error).
  test('Edge case: clicking a non-existent selector should throw an error from Playwright', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Attempt to click a button that does not exist and assert that Playwright throws
    // This simulates a user/test trying to trigger an event on a missing DOM node.
    await expect(page.click('button#does-not-exist', { timeout: 1000 })).rejects.toThrow();
  });

  // Edge case: ensure that the onclick attribute content matches the FSM's evidence string pattern
  test('Component verification: onclick attribute evidence matches expected snippet', async ({ page }) => {
    const dtPage = new DecisionTreePage(page);
    await dtPage.goto();

    const onclickAttr = await dtPage.getVisualizeButtonOnclick();
    // The FSM evidence shows "onclick=\"alert('This is a simple decision tree representation...')\""
    // We assert that the onclick attribute contains the prefix text used in the FSM evidence.
    expect(onclickAttr).toContain("This is a simple decision tree representation");
    expect(onclickAttr).toContain('alert(');
  });

  // Final check: ensure no unexpected console errors or page errors remained undetected across typical interactions
  test('Final sanity: no console errors or page errors after typical interactions', async ({ page }) => {
    const dtPage = new DecisionTreePage(page);
    await dtPage.goto();

    // perform the normal interaction once
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog', { timeout: 3000 }),
      dtPage.clickVisualizeButton()
    ]);

    // ensure the dialog occurred
    expect(dialog).toBeTruthy();

    // After interactions, assert there were no page-level runtime errors
    expect(pageErrors).toEqual([]);

    // And assert there are no console.error messages
    const consoleErrs = consoleEvents.filter((m) => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });
});