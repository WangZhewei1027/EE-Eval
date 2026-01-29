import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d1071-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Indexing - Multiple Interactive Controls (Application ID: 122d1071-fa7b-11f0-814c-dbec508f0b3b)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Shared setup: navigate to the page and collect console messages and page errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the exact provided URL
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Basic sanity checks for initial rendering and presence of components from FSM "S0_Idle"
  test('renders initial elements expected by FSM S0_Idle', async ({ page }) => {
    // Verify presence of all buttons, select and input described in FSM
    await expect(page.locator('#button1')).toHaveCount(1);
    await expect(page.locator('#button2')).toHaveCount(1);
    await expect(page.locator('#button3')).toHaveCount(1);
    await expect(page.locator('#select1')).toHaveCount(1);
    await expect(page.locator('#input1')).toHaveCount(1);
    await expect(page.locator('#button4')).toHaveCount(1);

    // Check the input placeholder and type attribute
    const input = page.locator('#input1');
    await expect(input).toHaveAttribute('placeholder', 'Enter text here');
    await expect(input).toHaveAttribute('type', 'text');

    // Check select has the expected options mentioned in the HTML implementation
    const options = page.locator('#select1 option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveValue('option1');
    await expect(options.nth(1)).toHaveValue('option2');
    await expect(options.nth(2)).toHaveValue('option3');

    // Verify no uncaught page errors on initial render
    expect(pageErrors.length).toBe(0);
  });

  // Tests for the click-related events (Button1, Button2, Button3, Button4)
  test.describe('Button click events produce expected alerts', () => {
    test('Button 1 click triggers an alert "Button 1 clicked!"', async ({ page }) => {
      // Wait for the dialog that the page code will produce, then click
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#button1')
      ]);

      expect(dialog.message()).toBe('Button 1 clicked!');
      await dialog.accept();
    });

    test('Button 2 click triggers an alert "Button 2 clicked!"', async ({ page }) => {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#button2')
      ]);

      expect(dialog.message()).toBe('Button 2 clicked!');
      await dialog.accept();
    });

    test('Button 3 click triggers an alert "Button 3 clicked!"', async ({ page }) => {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#button3')
      ]);

      expect(dialog.message()).toBe('Button 3 clicked!');
      await dialog.accept();
    });

    test('Submit (Button 4) click triggers an alert "Submit button clicked!"', async ({ page }) => {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#button4')
      ]);

      expect(dialog.message()).toBe('Submit button clicked!');
      await dialog.accept();
    });
  });

  // Tests for select and input events
  test.describe('Select and Input events', () => {
    test('Changing select triggers alert with the selected value', async ({ page }) => {
      // change to option2
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.selectOption('#select1', 'option2')
      ]);

      expect(dialog.message()).toBe('Select changed to: option2');
      await dialog.accept();
    });

    test('Typing into input triggers input alerts for changes (edge: multiple alerts expected)', async ({ page }) => {
      // We'll type three characters and expect input event to fire and show alerts.
      // The page's input handler alerts the current value. We'll collect three dialogs.
      const typedText = 'abc';
      const dialogs = [];

      // Start typing character by character to produce multiple input events/dialogs.
      for (let i = 0; i < typedText.length; i++) {
        const partial = typedText.slice(0, i + 1);

        // wait for the dialog produced by typing the next character
        const eventPromise = page.waitForEvent('dialog');
        await page.type('#input1', typedText[i]);
        const dialog = await eventPromise;
        dialogs.push(dialog);
        // Assert the message matches the current partial value
        expect(dialog.message()).toBe(`Input field changed to: ${partial}`);
        await dialog.accept();
      }

      // Defensive assertion: ensure we captured as many dialogs as characters typed
      expect(dialogs.length).toBe(typedText.length);
    });
  });

  // Combined workflow: sequence of interactions and verifying the order and messages of dialogs
  test('sequence of interactions produces alerts in expected order', async ({ page }) => {
    // We'll perform: Button1 click -> select option3 -> type "ok" -> click Submit (button4)
    // Collect dialogs in order using waitForEvent sequentially to assert ordering and content.

    // 1) Button1
    const d1 = await Promise.all([page.waitForEvent('dialog'), page.click('#button1')]);
    expect(d1[0].message()).toBe('Button 1 clicked!');
    await d1[0].accept();

    // 2) select option3
    const d2 = await Promise.all([page.waitForEvent('dialog'), page.selectOption('#select1', 'option3')]);
    expect(d2[0].message()).toBe('Select changed to: option3');
    await d2[0].accept();

    // 3) type "ok" into input (two input events expected)
    const chars = ['o', 'k'];
    let current = '';
    for (const ch of chars) {
      current += ch;
      const ev = page.waitForEvent('dialog');
      await page.type('#input1', ch);
      const dlg = await ev;
      expect(dlg.message()).toBe(`Input field changed to: ${current}`);
      await dlg.accept();
    }

    // 4) click submit button4
    const d4 = await Promise.all([page.waitForEvent('dialog'), page.click('#button4')]);
    expect(d4[0].message()).toBe('Submit button clicked!');
    await d4[0].accept();
  });

  // Edge case and error scenario tests
  test.describe('Edge cases and error scenarios', () => {
    test('clicking a non-existent selector should reject (error scenario)', async ({ page }) => {
      // Attempting to click a selector that does not exist should throw an error from Playwright.
      // We assert that the promise is rejected.
      await expect(page.click('#no-such-element')).rejects.toThrow();
    });

    test('no uncaught page errors occurred during interactions', async ({ page }) => {
      // Perform a simple interaction set and assert pageErrors remains empty
      // (this verifies that there are no runtime exceptions thrown by the page handlers)
      const d = await Promise.all([page.waitForEvent('dialog'), page.click('#button2')]);
      expect(d[0].message()).toBe('Button 2 clicked!');
      await d[0].accept();

      // After the interaction, assert no page errors were recorded
      expect(pageErrors.length).toBe(0);
    });

    test('console messages captured (ensure no console.error messages emitted)', async ({ page }) => {
      // The page uses alerts rather than console logging. We assert that no console messages of type 'error' were emitted.
      // Click a button to ensure any potential console messages from event handlers would be captured.
      const d = await Promise.all([page.waitForEvent('dialog'), page.click('#button3')]);
      expect(d[0].message()).toBe('Button 3 clicked!');
      await d[0].accept();

      // Inspect captured console messages
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors.length).toBe(0);
    });
  });

  // Verify FSM entry action "renderPage()" by checking the DOM that should be present after entry.
  test('FSM entry action renderPage() has resulted in expected DOM (verify elements and content)', async ({ page }) => {
    // The FSM lists renderPage() on entry; the HTML has headings and content.
    await expect(page.locator('h1')).toHaveText('Indexing');
    await expect(page.locator('h2')).toContainText('Multiple Interactive Controls');
    // Check the example editor region exists
    await expect(page.locator('#example')).toContainText('This is an example text editor.');
  });
});