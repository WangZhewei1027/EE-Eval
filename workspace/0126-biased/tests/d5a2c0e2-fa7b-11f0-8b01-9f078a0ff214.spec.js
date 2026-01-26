import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2c0e2-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Understanding REST API - FSM tests (d5a2c0e2-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Collect console messages and page errors to assert on them
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
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

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // noop - included to clearly mark teardown section if needed later
  });

  test.describe('Initial state: S0_Idle (Idle)', () => {
    test('renders the page and shows the "Show API Example" button with correct attributes', async ({ page }) => {
      // Validate the page title and heading to ensure page loaded
      await expect(page).toHaveTitle(/Understanding REST API/);

      // Button should be present
      const btn = await page.waitForSelector('.btn-demo', { state: 'visible' });
      const text = await btn.innerText();
      // Verify button text matches expected evidence in FSM
      expect(text.trim()).toBe('Show API Example');

      // Verify onclick attribute exists and references showDemo()
      const onclickAttr = await btn.getAttribute('onclick');
      expect(onclickAttr).toBe('showDemo()');

      // Verify the button is not marked inactive via CSS class
      const classAttr = await btn.getAttribute('class');
      expect(classAttr).toContain('btn-demo');
      expect(classAttr).not.toContain('button-inactive');

      // Verify showDemo function exists on the page (S0 entry/idle should not break)
      const showDemoType = await page.evaluate(() => typeof window.showDemo);
      expect(showDemoType).toBe('function');

      // Ensure there were no page errors during initial render
      expect(pageErrors.length).toBe(0);

      // No console errors/warnings expected for initial load in this implementation
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('entry action "renderPage()" is not present in DOM (verify no ReferenceError related to renderPage)', async ({ page }) => {
      // The FSM mentions an entry action renderPage(), but the HTML does not call it.
      // We assert that loading the page did not produce a ReferenceError for renderPage.
      const refErrors = pageErrors.filter(e => /renderPage/.test(String(e)));
      expect(refErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ShowDemo (S0_Idle -> S1_DemoShown)', () => {
    test('clicking the button triggers an alert with the expected message (single click)', async ({ page }) => {
      // Prepare to catch the dialog and assert its message (represents S1_DemoShown entry action)
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('.btn-demo') // event trigger selector from FSM
      ]);

      // Assert the alert text matches the FSM evidence
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('This would trigger a demo of accessing a REST API, such as fetching user data.');

      // Accept the dialog to allow test to continue
      await dialog.accept();

      // Ensure no page errors were emitted as a result of the click
      expect(pageErrors.length).toBe(0);

      // The button should still exist after the alert (no DOM removal)
      const btn = await page.$('.btn-demo');
      expect(btn).not.toBeNull();
    });

    test('clicking the button multiple times triggers multiple alerts (multiple transitions)', async ({ page }) => {
      // Click the button 3 times and handle each alert sequentially
      const messages = [];
      for (let i = 0; i < 3; i++) {
        // Wait for dialog that will be produced by the click
        const dialogPromise = page.waitForEvent('dialog');
        await page.click('.btn-demo');
        const dialog = await dialogPromise;
        messages.push(dialog.message());
        await dialog.accept();
      }

      // All dialogs should have the same expected message
      expect(messages.length).toBe(3);
      for (const msg of messages) {
        expect(msg).toBe('This would trigger a demo of accessing a REST API, such as fetching user data.');
      }

      // Ensure no page errors occurred during multiple transitions
      expect(pageErrors.length).toBe(0);
    });

    test('pressing Enter while the button is focused triggers the alert (keyboard activation)', async ({ page }) => {
      // Focus the button
      await page.focus('.btn-demo');

      // Wait for the dialog triggered by pressing Enter and then press Enter
      const dialogPromise = page.waitForEvent('dialog');
      await page.keyboard.press('Enter');
      const dialog = await dialogPromise;

      // Validate dialog content
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('This would trigger a demo of accessing a REST API, such as fetching user data.');

      await dialog.accept();

      // No pageerrors expected
      expect(pageErrors.length).toBe(0);
    });

    test('verify DOM evidence and attributes after transition (button remains intact)', async ({ page }) => {
      // Trigger transition
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('.btn-demo')
      ]);
      await dialog.accept();

      // After transition, verify the same evidence (onclick attribute) still present
      const onclickAttr = await page.getAttribute('.btn-demo', 'onclick');
      expect(onclickAttr).toBe('showDemo()');

      // Verify that the textual evidence is still present in DOM (button text)
      const buttonText = await page.innerText('.btn-demo');
      expect(buttonText.trim()).toBe('Show API Example');

      // No page errors introduced by the transition
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('attempt to call a non-existent function does not occur automatically (no ReferenceError emitted)', async ({ page }) => {
      // The FSM lists some entry actions like renderPage(); assert the page did not throw ReferenceError for missing functions
      const referenceErrors = pageErrors.filter(err => /ReferenceError/i.test(String(err)));
      expect(referenceErrors.length).toBe(0);
    });

    test('console and page error monitoring - ensure no unexpected console errors/warnings', async ({ page }) => {
      // Inspect console messages captured so far
      const errors = consoleMessages.filter(m => m.type === 'error');
      const warnings = consoleMessages.filter(m => m.type === 'warning');

      // This implementation should not produce console errors; assert none exist.
      expect(errors.length).toBe(0);

      // Warnings may be present in some environments, but we assert there were none here
      expect(warnings.length).toBe(0);

      // Additionally assert that there were no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('safeguard: ensure invoking showDemo programmatically triggers same dialog message', async ({ page }) => {
      // Call the function from page context, catch the dialog that appears
      const dialogPromise = page.waitForEvent('dialog');
      await page.evaluate(() => {
        // Call the function that should exist; do NOT redefine it if absent.
        if (typeof window.showDemo === 'function') {
          window.showDemo();
        }
      });
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('This would trigger a demo of accessing a REST API, such as fetching user data.');
      await dialog.accept();

      // Ensure no page errors occurred as a result
      expect(pageErrors.length).toBe(0);
    });
  });
});