import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e7002-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Symmetric Cryptography - FSM End-to-End Tests', () => {
  // Keep track of uncaught page errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught exceptions and console output
    page.on('pageerror', (err) => {
      // store the Error object for assertions
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application before each test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic invariant: no unexpected runtime errors (ReferenceError, SyntaxError, TypeError) occurred
    // If any of these occurred, include their names in the assertion failure message
    const criticalNames = ['ReferenceError', 'SyntaxError', 'TypeError'];
    const foundCritical = pageErrors.filter(e => criticalNames.includes(e.name));
    expect(foundCritical.length, `Expected no ReferenceError/SyntaxError/TypeError, found: ${foundCritical.map(e => e.name).join(', ')}`).toBe(0);
  });

  test.describe('S0_Idle (Initial Page Rendering)', () => {
    test('renders title, description, and default UI elements (Idle state)', async ({ page }) => {
      // Validate the page shows expected Idle state evidence
      await expect(page.locator('h1')).toHaveText('Symmetric Cryptography');
      await expect(page.locator('p')).toHaveText('Learn how to create symmetric encryption algorithms using Python.');

      // Output should initially be empty
      const outputText = await page.locator('#output').innerText();
      expect(outputText).toBe('');

      // Progress bar should not have inline width style initially
      const progressStyle = await page.$eval('#progress-bar', el => el.style.width || '');
      expect(progressStyle).toBe('');

      // Ensure no page errors or console errors logged during initial render
      const errors = pageErrors.map(e => `${e.name}: ${e.message}`).join('\n');
      expect(pageErrors.length).toBe(0, `Page errors were present on load: ${errors}`);
    });
  });

  test.describe('S1_Encrypting (EncryptEvent)', () => {
    test('clicking Encrypt prompts for key and updates output and progress bar', async ({ page }) => {
      // When encrypt is called without a message argument, message will be undefined.
      // The code prompts for a key. We accept the prompt with a test key.
      const acceptKey = 'KEY123';

      // Wait for the prompt dialog and accept it with a key, while clicking the button
      const [prompt] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#encrypt-btn')
      ]);

      expect(prompt.type()).toBe('prompt');
      await prompt.accept(acceptKey);

      // Output should show concatenation of undefined + key (because message parameter was not provided)
      const output = await page.locator('#output').innerText();
      expect(output).toBe('undefined' + acceptKey);

      // Progress bar inline width should be set to "20%"
      const width = await page.$eval('#progress-bar', el => el.style.width);
      expect(width).toBe('20%');

      // Validate no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('user cancels Encrypt prompt -> shows alert and does not change output or progress bar', async ({ page }) => {
      // Prepopulate output with sentinel value to ensure it does not change when user cancels
      await page.evaluate(() => { document.getElementById('output').innerHTML = 'SENTINEL'; document.getElementById('progress-bar').style.width = '5%'; });

      // Click encrypt and dismiss the prompt
      const [prompt] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#encrypt-btn')
      ]);
      expect(prompt.type()).toBe('prompt');
      // Dismiss the prompt (simulate clicking Cancel)
      await prompt.dismiss();

      // After dismiss, application triggers an alert("Please enter a key."); wait for and accept it
      const alertDialog = await page.waitForEvent('dialog');
      expect(alertDialog.type()).toBe('alert');
      await alertDialog.accept();

      // Output should remain unchanged
      const output = await page.locator('#output').innerText();
      expect(output).toBe('SENTINEL');

      // Progress bar should remain unchanged
      const width = await page.$eval('#progress-bar', el => el.style.width);
      expect(width).toBe('5%');

      // Confirm no uncaught exceptions occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S2_Decrypting (DecryptEvent)', () => {
    test('clicking Decrypt prompts for key and updates output and progress bar', async ({ page }) => {
      const acceptKey = 'DEC-KEY';

      const [prompt] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#decrypt-btn')
      ]);
      expect(prompt.type()).toBe('prompt');
      await prompt.accept(acceptKey);

      // Output should show concatenation of undefined + key (message was not provided)
      const output = await page.locator('#output').innerText();
      expect(output).toBe('undefined' + acceptKey);

      // Progress bar should be set to "40%"
      const width = await page.$eval('#progress-bar', el => el.style.width);
      expect(width).toBe('40%');

      expect(pageErrors.length).toBe(0);
    });

    test('user cancels Decrypt prompt -> alert shown and no changes applied', async ({ page }) => {
      await page.evaluate(() => { document.getElementById('output').innerHTML = 'DEC-SENTINEL'; document.getElementById('progress-bar').style.width = '10%'; });

      const [prompt] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#decrypt-btn')
      ]);
      expect(prompt.type()).toBe('prompt');
      await prompt.dismiss();

      const alertDialog = await page.waitForEvent('dialog');
      expect(alertDialog.type()).toBe('alert');
      await alertDialog.accept();

      const output = await page.locator('#output').innerText();
      expect(output).toBe('DEC-SENTINEL');

      const width = await page.$eval('#progress-bar', el => el.style.width);
      expect(width).toBe('10%');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S3_KeyGenerating (GenerateKeyEvent)', () => {
    test('clicking Generate Key prompts, updates output with key and sets progress to 50%', async ({ page }) => {
      const generatedKey = 'MY_GENERATED_KEY';

      const [prompt] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#generate-btn')
      ]);
      expect(prompt.type()).toBe('prompt');
      await prompt.accept(generatedKey);

      // generateKey sets progress to 20% then to 50%; final inline style should be "50%"
      const width = await page.$eval('#progress-bar', el => el.style.width);
      expect(width).toBe('50%');

      // Output should contain the key exactly
      const output = await page.locator('#output').innerText();
      expect(output).toBe(generatedKey);

      expect(pageErrors.length).toBe(0);
    });

    test('user cancels Generate Key prompt -> alert shown and no output/progress change', async ({ page }) => {
      await page.evaluate(() => { document.getElementById('output').innerHTML = 'GEN-SENTINEL'; document.getElementById('progress-bar').style.width = '15%'; });

      const [prompt] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#generate-btn')
      ]);
      expect(prompt.type()).toBe('prompt');
      await prompt.dismiss();

      const alertDialog = await page.waitForEvent('dialog');
      expect(alertDialog.type()).toBe('alert');
      await alertDialog.accept();

      const output = await page.locator('#output').innerText();
      expect(output).toBe('GEN-SENTINEL');

      const width = await page.$eval('#progress-bar', el => el.style.width);
      expect(width).toBe('15%');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S4_Clearing (ClearEvent)', () => {
    test('clicking Clear empties the output and sets progress bar width to 0%', async ({ page }) => {
      // Seed output and progress before clearing
      await page.evaluate(() => { document.getElementById('output').innerHTML = 'TO BE CLEARED'; document.getElementById('progress-bar').style.width = '50%'; });

      await page.click('#clear-btn');

      const output = await page.locator('#output').innerText();
      expect(output).toBe(''); // cleared

      const width = await page.$eval('#progress-bar', el => el.style.width);
      // The code sets width to 0 + "%" so style.width should be "0%"
      expect(width).toBe('0%');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Additional UI & Edge Cases', () => {
    test('dispatching a change event on progress bar triggers alert with message in code', async ({ page }) => {
      // The progress bar is a div with no value property. The change handler compares value >= 100.
      // We trigger a change event; code will call alert("Encryption and decryption in progress.") due to undefined >= 100 being false.
      // Handle the alert dialog.
      const changeEventPromise = page.waitForEvent('dialog');
      await page.$eval('#progress-bar', (el) => {
        const evt = new Event('change', { bubbles: true, cancelable: true });
        el.dispatchEvent(evt);
      });

      const alertDialog = await changeEventPromise;
      expect(alertDialog.type()).toBe('alert');
      // Accept the alert to allow script to continue
      await alertDialog.accept();

      // No changes expected on output or progress bar
      const output = await page.locator('#output').innerText();
      expect(output).toBe(''); // should still be empty unless earlier tests ran; tests isolate per beforeEach navigation

      expect(pageErrors.length).toBe(0);
    });

    test('verify console messages captured (no console.error with ReferenceError/SyntaxError/TypeError)', async ({ page }) => {
      // This test just verifies we have captured console messages and none are critical error types
      // (console messages themselves are not errors unless they indicate runtime issues).
      // Ensure captured console messages do not include obvious JS errors.
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      // If any console.error exists, ensure they do not reference the critical names
      const forbidden = ['ReferenceError', 'SyntaxError', 'TypeError'];
      for (const msg of errorConsoleMsgs) {
        for (const f of forbidden) {
          expect(msg.text.includes(f)).toBeFalsy();
        }
      }
      // Also ensure there were no uncaught page errors (already enforced in afterEach)
      expect(pageErrors.length).toBe(0);
    });
  });
});