import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a24bb3-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Application d5a24bb3-fa7b-11f0-8b01-9f078a0ff214 - Understanding Indexing (FSM verification)', () => {
  // Arrays to capture runtime diagnostics from the page
  let consoleMessages;
  let pageErrors;
  let dialogs;

  // Set up listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught page errors (e.g., ReferenceError, SyntaxError, TypeError)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
    });

    // Capture dialogs (alerts) that are presented by the page
    page.on('dialog', async (dialog) => {
      dialogs.push({
        type: dialog.type(),
        message: dialog.message(),
      });
      // Do not dismiss here; leave tests to accept/dismiss where needed.
      // Accepting to avoid blocking further interactions:
      await dialog.accept();
    });

    // Navigate to the application page (render the Idle state)
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Basic navigation sanity check
    await expect(page).toHaveURL(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, print captured diagnostics to aid debugging in CI logs
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.error('Captured console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors);
      // eslint-disable-next-line no-console
      console.error('Captured dialogs:', dialogs);
    }
  });

  test.describe('Idle State (S0_Idle) - initial render checks', () => {
    test('Idle state: page content renders and primary button exists with expected attributes', async ({ page }) => {
      // Validate main heading exists and contains expected text
      const h1 = page.locator('h1');
      await expect(h1).toHaveText('Understanding Indexing');

      // Validate presence of descriptive content paragraph
      const firstParagraph = page.locator('p').first();
      await expect(firstParagraph).toContainText('Indexing is a crucial concept');

      // Validate the demonstration button exists, has the correct class, text, and onclick attribute
      const demoButton = page.locator('button.button');
      await expect(demoButton).toBeVisible();
      await expect(demoButton).toHaveText('Show Indexing Demonstration');

      // Validate the inline onclick attribute evidence as specified by the FSM
      const onclickAttr = await demoButton.getAttribute('onclick');
      // The implementation uses an inline onclick attribute 'showDemonstration()'
      await expect(onclickAttr).toBe('showDemonstration()');

      // Verify that the showDemonstration function is defined on the window (entry action for Demonstration state)
      const showDemoType = await page.evaluate(() => typeof window.showDemonstration);
      await expect(showDemoType).toBe('function');

      // Verify that renderPage (an entry action expected in the FSM for the Idle state) is NOT defined in the page
      // This asserts that the declared FSM entry action 'renderPage()' does not exist in the implementation.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      await expect(renderPageType).toBe('undefined');

      // Ensure no alert/dialog was automatically shown on initial load (Idle should not trigger the Demonstration alert)
      // Since our dialog handler auto-accepts and records, we assert dialogs array is still empty after load.
      expect(dialogs.length).toBe(0);
    });
  });

  test.describe('Transition: ShowDemonstration event and Demonstration state (S1_Demonstration)', () => {
    test('Clicking "Show Indexing Demonstration" triggers an alert with the expected message', async ({ page }) => {
      // Ensure no prior dialogs
      expect(dialogs.length).toBe(0);

      // Click the demonstration button; the page's dialog handler will capture and auto-accept it
      const demoButton = page.locator('button.button');
      await demoButton.click();

      // After the click, we expect at least one dialog recorded with the exact message from the implementation
      expect(dialogs.length).toBeGreaterThanOrEqual(1);

      const lastDialog = dialogs[dialogs.length - 1];
      const expectedMessage = "This demonstration would typically show how indexing speeds up data retrieval. However, this interactive feature is intentionally simple to keep the focus on textual content.";
      expect(lastDialog.type).toBe('alert');
      expect(lastDialog.message).toBe(expectedMessage);

      // The FSM indicates S1_Demonstration has entry action showDemonstration(); we validated dialog presence which is the visible effect.
      // Verify that clicking again will produce another alert (transition can occur repeatedly)
      await demoButton.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(2);
      // Confirm the second dialog message matches as well
      const secondDialog = dialogs[dialogs.length - 1];
      expect(secondDialog.message).toBe(expectedMessage);
    });

    test('Multiple rapid clicks produce alerts each time (robustness / edge case)', async ({ page }) => {
      const demoButton = page.locator('button.button');

      // Clear any pre-existing dialogs recorded during prior tests in the same test run
      dialogs.length = 0;

      // Perform multiple clicks in quick succession
      await Promise.all([
        demoButton.click(),
        demoButton.click(),
        demoButton.click()
      ]);

      // The dialog handler accepts dialogs as they appear. We expect at least three dialogs captured.
      // Depending on timing and browser bundling, alerts are synchronous; Playwright's handler accepted them,
      // so we assert that at least 3 entries are present.
      expect(dialogs.length).toBeGreaterThanOrEqual(3);

      // Confirm all captured dialogs are the alert type with the expected message
      const expectedMessage = "This demonstration would typically show how indexing speeds up data retrieval. However, this interactive feature is intentionally simple to keep the focus on textual content.";
      for (const d of dialogs) {
        expect(d.type).toBe('alert');
        expect(d.message).toBe(expectedMessage);
      }
    });
  });

  test.describe('Error and console monitoring (observability and edge cases)', () => {
    test('No uncaught ReferenceError, SyntaxError, or TypeError should be present by default', async ({ page }) => {
      // Filter pageErrors for typical JS fatal types
      const fatalErrors = pageErrors.filter(e =>
        e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError'
      );

      // Assert that none of these fatal errors occurred during page load and interactions so far
      expect(fatalErrors.length).toBe(0);

      // Additionally assert that console did not report errors of those types (some frameworks log stack traces)
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
      // Ensure none of the error console messages include the names of these fatal error types
      for (const text of consoleErrorMessages) {
        expect(text).not.toContain('ReferenceError');
        expect(text).not.toContain('SyntaxError');
        expect(text).not.toContain('TypeError');
      }
    });

    test('If page errors do occur they are captured and accessible via pageErrors array', async ({ page }) => {
      // This test validates observability rather than forcing an error.
      // It asserts that the diagnostic arrays are accessible and contain structured data.
      expect(Array.isArray(pageErrors)).toBe(true);
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(dialogs)).toBe(true);

      // The test will pass even if there are zero errors; its goal is to ensure we can observe them when they occur.
      // For debugging purposes, assert shape when an error exists (non-fatal check)
      if (pageErrors.length > 0) {
        const sample = pageErrors[0];
        expect(sample).toHaveProperty('message');
        expect(sample).toHaveProperty('name');
      }
    });
  });

  test.describe('FSM evidence checks & content consistency', () => {
    test('Page contains evidence elements mentioned in FSM (button with onclick)', async ({ page }) => {
      // Verify the page's HTML contains the exact snippet/evidence the FSM documented (button with onclick)
      const demoButton = page.locator('button.button');
      await expect(demoButton).toBeVisible();

      const onclickAttr = await demoButton.getAttribute('onclick');
      await expect(onclickAttr).toBe('showDemonstration()');

      // Also verify that descriptive sections referenced in the FSM (various headings) are present
      await expect(page.locator('h2', { hasText: 'What is Indexing?' })).toBeVisible();
      await expect(page.locator('h2', { hasText: 'The Importance of Indexing' })).toBeVisible();
      await expect(page.locator('h2', { hasText: 'Types of Indexes' })).toBeVisible();
    });
  });
});