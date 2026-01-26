import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a04fe4-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Application: Understanding AVL Trees (FSM validation)', () => {
  // Hold console messages and page errors captured during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console events for inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // In case msg methods throw, store generic info
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions reported as page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page and wait for it to load its DOM
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Nothing to teardown explicitly; listeners are attached to the page instance which is cleaned by Playwright.
    // Keep this hook to illustrate explicit teardown spot if needed in future.
  });

  test('S0_Idle: Initial render - page content and button are present (entry state)', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) as extracted from the FSM:
    // - The initial content (title, description) should be rendered.
    // - The button with class ".button" and expected text should exist.
    // - The FSM mentioned an entry_action renderPage() — verify it is NOT present on the window (implementation doesn't define it).
    // - Observe that no uncaught page errors occurred during load.

    // Check main title is present and correct
    const title = await page.locator('h1').textContent();
    expect(title).toBeTruthy();
    expect(title.trim()).toBe('Understanding AVL Trees');

    // Check the presence of the expected button
    const button = page.locator('.button');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('See AVL Rotation Example');

    // Verify the onclick attribute references displayDemo()
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toContain('displayDemo()');

    // The FSM listed an entry action renderPage(); check whether such a function exists.
    // We do not inject or call anything — simply inspect the page global.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // The HTML provided does not define renderPage(), so we expect it to be false.
    expect(hasRenderPage).toBe(false);

    // Ensure there were no unexpected page errors during load
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition SeeAVLRotationExample: clicking button triggers displayDemo() and shows alert (S1_DemoDisplayed)', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_DemoDisplayed:
    // - Clicking the button should invoke displayDemo(), which triggers an alert dialog with a specific message.
    // - We accept the dialog and verify its text matches the expected evidence from the FSM/HTML.
    // - Confirm no page errors appeared as a result of the interaction.

    const expectedAlertText = 'This function would ideally demonstrate an AVL Tree rotation. However, it is simplified here to focus on reading the content!';

    // Prepare to capture the dialog
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    // Click the button to trigger the alert
    await page.click('.button');

    // Wait briefly to ensure dialog handler ran
    await page.waitForTimeout(100); // small pause to allow dialog event processing

    // Assert that a dialog appeared and its message matches expectation
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].type).toBe('alert');
    expect(dialogs[0].message).toBe(expectedAlertText);

    // After closing the alert, confirm the DOM remains consistent
    await expect(page.locator('.button')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Understanding AVL Trees');

    // Check for runtime page errors produced by the interaction
    expect(pageErrors.length).toBe(0);

    // Ensure no console-level errors during the click/alert sequence
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Clicking the See AVL Rotation Example button multiple times sequentially', async ({ page }) => {
    // This test checks robustness when a user clicks the demo button multiple times:
    // - Each click should produce an alert which we accept.
    // - We verify every alert's content and ensure no unexpected errors occur.

    const expectedAlertText = 'This function would ideally demonstrate an AVL Tree rotation. However, it is simplified here to focus on reading the content!';
    const clickCount = 3;
    const observedDialogs = [];

    page.on('dialog', async (dialog) => {
      observedDialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    const button = page.locator('.button');
    await expect(button).toBeVisible();

    // Sequential clicks — ensure each produces a dialog we capture
    for (let i = 0; i < clickCount; i++) {
      await button.click();
      // Wait a short time to let the dialog event handler run and be accepted
      await page.waitForTimeout(80);
    }

    expect(observedDialogs.length).toBe(clickCount);
    for (const d of observedDialogs) {
      expect(d.type).toBe('alert');
      expect(d.message).toBe(expectedAlertText);
    }

    // Verify that repeated interactions did not introduce page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence and implementation checks: DOM evidence and absence/presence of functions', async ({ page }) => {
    // This test cross-checks the FSM's extracted evidence against the concrete DOM and JS:
    // - The FSM enumerates the button as a component with onclick="displayDemo()"
    // - Confirm the DOM indeed contains that HTML snippet (attributes + text)
    // - Confirm displayDemo is implemented on the page as a function
    // - If displayDemo exists, calling it directly would open an alert; we will not call it directly,
    //   but we will check its existence and type safely.

    const button = page.locator('button.button');
    await expect(button).toHaveAttribute('onclick', 'displayDemo()');
    await expect(button).toHaveText('See AVL Rotation Example');

    // Check that displayDemo is defined as a function on the window
    const displayDemoType = await page.evaluate(() => typeof window.displayDemo);
    expect(displayDemoType).toBe('function');

    // Additionally confirm the onclick attribute string is exactly as expected in the markup
    const outerHTML = await button.evaluate((el) => el.outerHTML);
    expect(outerHTML).toContain('onclick="displayDemo()"');

    // Confirm no page errors from these inspections
    expect(pageErrors.length).toBe(0);
  });

  test('Error observation: assert no ReferenceError, SyntaxError, or TypeError occurred during tests', async ({ page }) => {
    // The developer instructions require observing console logs and page errors.
    // Here we assert that no uncaught ReferenceError, SyntaxError, or TypeError were produced.
    // We do not inject or modify the page environment.

    // Inspect pageErrors for specific JS error types
    const errorNames = pageErrors.map(err => err.name || '');
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');

    // Inspect console messages for text that includes those error names
    const consoleTexts = consoleMessages.map(c => c.text);
    const foundRef = consoleTexts.some(t => t.includes('ReferenceError'));
    const foundSyntax = consoleTexts.some(t => t.includes('SyntaxError'));
    const foundType = consoleTexts.some(t => t.includes('TypeError'));

    expect(foundRef).toBe(false);
    expect(foundSyntax).toBe(false);
    expect(foundType).toBe(false);
  });
});