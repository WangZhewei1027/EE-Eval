import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b45413-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Symmetric Cryptography (FSM tests) - f5b45413-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.describe('State S0_Idle (Initial / Idle state)', () => {
    test('Idle state: page renders explanatory content and the Generate Demonstration button exists', async ({ page }) => {
      // Verify page title
      await expect(page).toHaveTitle(/Symmetric Cryptography/);

      // Verify main heading
      const heading = page.locator('h1');
      await expect(heading).toHaveText('Symmetric Cryptography');

      // Verify explanatory text exists
      const explanation = page.locator('.text-explanation').first();
      await expect(explanation).toContainText('Symmetric cryptography is a method of encrypting and decrypting data');

      // Verify the button exists with the expected selector and label
      const button = page.locator('.button > button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Generate Demonstration');

      // Verify the onclick attribute is present (evidence in FSM)
      const onclickValue = await button.getAttribute('onclick');
      // The implementation sets onclick="generateDemonstration()"
      expect(onclickValue).toBe('generateDemonstration()');

      // Verify the generateDemonstration function is defined on the page (should be a function in the HTML)
      const genType = await page.evaluate(() => typeof generateDemonstration);
      expect(genType).toBe('function');
    });

    test('Entry action renderPage() from FSM is missing - calling it should produce ReferenceError in page context', async ({ page }) => {
      // The FSM mentions renderPage() as an entry action for S0_Idle.
      // The HTML does not define renderPage(), so invoking it should throw a ReferenceError.
      // We deliberately attempt to call it in-page and capture the thrown error to assert behavior.
      const result = await page.evaluate(() => {
        try {
          // Intentionally call the non-existent entry action to observe the natural ReferenceError
          renderPage();
          return { called: true };
        } catch (e) {
          // Return the error message and name so the test can assert it happened naturally
          return { errorMessage: e && e.message ? e.message : String(e), errorName: e && e.name ? e.name : 'Unknown' };
        }
      });

      // We expect an error result (renderPage is not defined)
      expect(result.errorMessage || '').toMatch(/renderPage|is not defined/i);
      // Ensure the error is a ReferenceError if possible
      expect(result.errorName).toMatch(/ReferenceError|Error/i);
    });
  });

  test.describe('State S1_Demonstrating (Generating demonstration)', () => {
    test('Clicking Generate Demonstration calls generateDemonstration() and the implementation attempts AES calls resulting in a ReferenceError', async ({ page }) => {
      // Collect console messages for inspection
      const consoleMessages = [];
      page.on('console', (msg) => {
        // Collect text for easier assertions below
        try {
          consoleMessages.push(msg.text());
        } catch {
          consoleMessages.push(String(msg));
        }
      });

      // Wait for a pageerror event caused by the AES reference being missing.
      // The page's generateDemonstration uses AES.encrypt and AES.decrypt, but AES is not defined in the HTML.
      // We expect a ReferenceError to surface as a pageerror when the button is clicked.
      const button = page.locator('.button > button');

      // Ensure the function string contains AES usage (evidence of intended behavior)
      const funcSource = await page.evaluate(() => generateDemonstration.toString());
      expect(funcSource).toMatch(/AES\.encrypt/);
      expect(funcSource).toMatch(/AES\.decrypt/);

      // Trigger the click and wait for the resulting pageerror
      const [pageError] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 3000 }),
        button.click(),
      ]);

      // The error message should indicate AES is not defined (ReferenceError)
      expect(String(pageError.message)).toMatch(/AES.*not defined|AES is not defined/i);

      // Because the error occurs before successful decryption, there should NOT be a console.log with the decrypted plaintext.
      // We wait briefly to allow any console messages to arrive (if any)
      await page.waitForTimeout(100); // small wait to capture console events
      const foundDecryptedLog = consoleMessages.some((m) => m.includes('Decrypted plaintext:'));
      expect(foundDecryptedLog).toBe(false);
    });

    test('Clicking the Generate Demonstration button multiple times produces multiple page errors (edge case)', async ({ page }) => {
      // This test verifies that repeated user interactions trigger the same observable errors repeatedly,
      // indicating consistent behavior for the Demonstrating state when required dependencies are missing.

      const pageErrors = [];
      page.on('pageerror', (err) => {
        try {
          pageErrors.push(err.message);
        } catch {
          pageErrors.push(String(err));
        }
      });

      const button = page.locator('.button > button');

      // Click multiple times in succession. Each click should attempt to run generateDemonstration and produce an error.
      await button.click();
      // small delay between clicks to allow the first error to be emitted
      await page.waitForTimeout(50);
      await button.click();

      // Give the page a moment to emit both errors
      await page.waitForTimeout(300);

      // Expect at least two errors captured
      expect(pageErrors.length).toBeGreaterThanOrEqual(2);

      // Each captured error should reference AES not being defined
      for (const errMsg of pageErrors) {
        expect(errMsg).toMatch(/AES.*not defined|AES is not defined/i);
      }
    });

    test('generateDemonstration function structure contains encryption/decryption steps (evidence of intended transition behavior)', async ({ page }) => {
      // Inspect the function source to assert that it follows the described steps:
      // - has a plaintext "Hello, World!"
      // - uses a key and blockSize
      // - iterates building encryptedPlaintext and decryptedPlaintext with AES.encrypt / AES.decrypt
      const funcSource = await page.evaluate(() => generateDemonstration.toString());

      // Check for the example plaintext from the FSM expected observables
      expect(funcSource).toMatch(/Hello, World!/);

      // Check for presence of key and blockSize variables
      expect(funcSource).toMatch(/let key = 256/);
      expect(funcSource).toMatch(/let blockSize = 128/);

      // Check loops that process plaintext/encryptedPlaintext and the AES calls are present
      expect(funcSource).toMatch(/for\s*\(\s*let i = 0; i < plaintext.length; i \+\+= blockSize/);
      expect(funcSource).toMatch(/AES\.encrypt/);
      expect(funcSource).toMatch(/AES\.decrypt/);
    });

    test('FSM expected observable "Decrypted plaintext: Hello, World!" is NOT produced due to missing AES (assert negative)', async ({ page }) => {
      // This test validates that the expected observable logged by the FSM does NOT appear because AES is missing.
      const consoleMessages = [];
      page.on('console', (msg) => {
        try {
          consoleMessages.push(msg.text());
        } catch {
          consoleMessages.push(String(msg));
        }
      });

      // Attempt to click the button and wait for a pageerror (expected)
      const button = page.locator('.button > button');
      await Promise.all([
        page.waitForEvent('pageerror', { timeout: 3000 }),
        button.click(),
      ]).catch(() => {
        // swallow - we assert below
      });

      // Wait briefly to ensure any console.log would have been captured
      await page.waitForTimeout(100);

      // The FSM expects "Decrypted plaintext: Hello, World!" in the console when the demonstration completes.
      // Because AES is missing, that log should not be present. Assert its absence explicitly.
      const hasExpectedLog = consoleMessages.some((m) => m.includes('Decrypted plaintext: Hello, World!'));
      expect(hasExpectedLog).toBe(false);
    });
  });
});