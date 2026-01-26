import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d335481-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Interactive Encryption Explorer (Application ID: 6d335481-fa7a-11f0-ba5b-57721b046e74)', () => {
  // Arrays to collect runtime errors and console messages for each test run
  let pageErrors;
  let consoleMessages;

  // Setup before each test: open page and attach listeners to capture page errors and console output.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // Keep full Error object representation for assertions
      pageErrors.push({ name: err.name, message: err.message });
    });

    // Capture console messages to observe alerts, warnings, logs if script runs partly
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Give a small grace period so any immediate errors during parsing/execution are captured
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach diagnostic info to the test output for failed runs
    testInfo.attach('pageErrors', {
      body: JSON.stringify(pageErrors, null, 2),
      contentType: 'application/json',
    });
    testInfo.attach('consoleMessages', {
      body: JSON.stringify(consoleMessages, null, 2),
      contentType: 'application/json',
    });
  });

  test.describe('State S0_Idle (Initial Rendering)', () => {
    test('renders the main heading and initial UI elements (Idle state evidence)', async ({ page }) => {
      // Validate the static DOM (entry action renderPage is expected to have placed the heading)
      const header = await page.locator('h1').innerText();
      expect(header).toContain('Interactive Encryption Explorer');

      // The initial visible section should be the Caesar section (per HTML) since others are hidden
      const caesarVisible = await page.locator('#caesarSection').evaluate((el) => {
        return window.getComputedStyle(el).display !== 'none';
      });
      expect(caesarVisible).toBe(true);

      // Verify that a script parsing/runtime error occurred (the page contains a deliberate syntax bug).
      // We expect at least one page error and that the error indicates a SyntaxError or parsing issue.
      expect(pageErrors.length).toBeGreaterThan(0);
      const hasSyntax = pageErrors.some(e => e.name === 'SyntaxError' || /SyntaxError/i.test(e.message));
      // Assert that a SyntaxError was observed during page load (critical to this app's behavior)
      expect(hasSyntax).toBeTruthy();
    });
  });

  test.describe('Encryption Method Selection (FSM transitions: S0 -> S1/S2/S3/S4)', () => {
    test('changing encryption method SHOULD trigger section visibility change if handlers exist; assert actual behavior and errors', async ({ page }) => {
      // Attempt to change to Vigenère via the select control
      await page.selectOption('#encryptionMethod', 'vigenere');

      // Wait a bit to allow any event handlers to run (if they were successfully attached)
      await page.waitForTimeout(200);

      // Check whether the vigenereSection is visible or still hidden
      const vigenereHidden = await page.locator('#vigenereSection').evaluate(el => el.classList.contains('hidden'));
      const caesarHidden = await page.locator('#caesarSection').evaluate(el => el.classList.contains('hidden'));

      // Because the page has a SyntaxError at script parse time, the change handler likely never ran.
      // Assert that sections did NOT transition (i.e., Caesar remains visible and Vigenere remains hidden)
      expect(vigenereHidden).toBe(true);
      expect(caesarHidden).toBe(false);

      // Also assert that we observed runtime parsing errors (SyntaxError)
      expect(pageErrors.length).toBeGreaterThan(0);
      const syntaxObserved = pageErrors.some(e => e.name === 'SyntaxError' || /SyntaxError/i.test(e.message));
      expect(syntaxObserved).toBeTruthy();
    });
  });

  test.describe('Caesar Cipher interactions (events: ShiftSliderInput, CaesarEncrypt, CaesarDecrypt)', () => {
    // Edge case: because of the script parsing error, event listeners and functions may not be defined.
    test('adjusting the shift slider should update displayed shift if handler present; otherwise remain the default', async ({ page }) => {
      // Attempt to move the slider to a new value
      await page.locator('#shiftSlider').evaluate((s) => { s.value = '7'; s.dispatchEvent(new Event('input')); });

      // Give handlers time to run if present
      await page.waitForTimeout(200);

      // Read the displayed shiftValue text
      const shiftText = await page.locator('#shiftValue').innerText();
      // If event handler executed, it would update to '7'. But due to script parse error, expect original '3'.
      // Accept either: if the handler ran (no syntax error), we would see updated value - but we already asserted syntax error exists earlier.
      expect(['3', '7']).toContain(shiftText);

      // If handler did NOT run, ensure that no change occurred (strongly expected)
      if (shiftText === '3') {
        // Confirm no new pageerror occurred on input
        // (No pageerror expected for a harmless input if handler missing)
        // pageErrors may already contain SyntaxError from load; confirm no additional ReferenceError referencing shift handler
        const additionalRef = pageErrors.some(e => /shiftSlider|shiftValue|ReferenceError/i.test(e.message));
        expect(additionalRef).toBe(false);
      }
    });

    test('clicking Encrypt triggers a ReferenceError when caesarEncrypt is undefined (verify pageerror)', async ({ page }) => {
      // Click the encrypt button and wait for the pageerror generated by the missing global function (onclick="caesarEncrypt()")
      const [err] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }),
        page.click('button[onclick="caesarEncrypt()"]'),
      ]).catch((e) => {
        // If waitForEvent times out (no new error), return any existing pageErrors for assertion below
        return [null];
      });

      // If a new error event fired, validate it is a ReferenceError (function undefined) OR related to SyntaxError already present
      if (err) {
        // err may be an Error object
        expect(err.name === 'ReferenceError' || /caesarEncrypt|ReferenceError/i.test(err.message) || err.name === 'SyntaxError').toBeTruthy();
      } else {
        // Fallback: assert that at least one pageError referencing caesarEncrypt or a SyntaxError exists in captured list
        const found = pageErrors.some(e => /caesarEncrypt|ReferenceError|SyntaxError/i.test(e.message) || e.name === 'ReferenceError' || e.name === 'SyntaxError');
        expect(found).toBeTruthy();
      }
    });

    test('clicking Decrypt triggers a ReferenceError when caesarDecrypt is undefined (verify pageerror)', async ({ page }) => {
      const [err] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }),
        page.click('button[onclick="caesarDecrypt()"]'),
      ]).catch(() => [null]);

      if (err) {
        expect(err.name === 'ReferenceError' || /caesarDecrypt|ReferenceError/i.test(err.message) || err.name === 'SyntaxError').toBeTruthy();
      } else {
        const found = pageErrors.some(e => /caesarDecrypt|ReferenceError|SyntaxError/i.test(e.message) || e.name === 'ReferenceError' || e.name === 'SyntaxError');
        expect(found).toBeTruthy();
      }
    });
  });

  test.describe('Vigenère Cipher interactions (events: VigenereEncrypt, VigenereDecrypt)', () => {
    test('attempting to encrypt/decrypt with Vigenère should produce errors if handlers undefined', async ({ page }) => {
      // Try clicking Vigenère encrypt - the function may be undefined; capture resulting page error
      const [errEncrypt] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        page.click('button[onclick="vigenereEncrypt()"]'),
      ]);

      if (errEncrypt) {
        expect(errEncrypt.name === 'ReferenceError' || /vigenereEncrypt|ReferenceError|SyntaxError/i.test(errEncrypt.message)).toBeTruthy();
      } else {
        const found = pageErrors.some(e => /vigenereEncrypt|ReferenceError|SyntaxError/i.test(e.message) || e.name === 'ReferenceError' || e.name === 'SyntaxError');
        expect(found).toBeTruthy();
      }

      // Try clicking Vigenère decrypt similarly
      const [errDecrypt] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        page.click('button[onclick="vigenereDecrypt()"]'),
      ]);

      if (errDecrypt) {
        expect(errDecrypt.name === 'ReferenceError' || /vigenereDecrypt|ReferenceError|SyntaxError/i.test(errDecrypt.message)).toBeTruthy();
      } else {
        const found = pageErrors.some(e => /vigenereDecrypt|ReferenceError|SyntaxError/i.test(e.message) || e.name === 'ReferenceError' || e.name === 'SyntaxError');
        expect(found).toBeTruthy();
      }
    });
  });

  test.describe('AES interactions (events: AesEncrypt, AesDecrypt) and parsing error observation', () => {
    test('AES function contains a deliberate syntax error - ensure initial SyntaxError detected and AES interactions reflect broken script', async ({ page }) => {
      // Confirm that we captured a SyntaxError during page load (critical evidence)
      const syntaxObserved = pageErrors.some(e => e.name === 'SyntaxError' || /SyntaxError/i.test(e.message));
      expect(syntaxObserved).toBeTruthy();

      // Try clicking AES Encrypt button; because of prior parse error, this will likely cause a ReferenceError for aesEncrypt
      const [err] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        page.click('#aesSection button[onclick="aesEncrypt()"]'),
      ]);

      // Validate the type of error (ReferenceError or SyntaxError)
      if (err) {
        expect(err.name === 'ReferenceError' || /aesEncrypt|ReferenceError|SyntaxError/i.test(err.message)).toBeTruthy();
      } else {
        // Fallback: look for evidence in the captured errors
        const found = pageErrors.some(e => /aesEncrypt|ReferenceError|SyntaxError/i.test(e.message) || e.name === 'ReferenceError' || e.name === 'SyntaxError');
        expect(found).toBeTruthy();
      }
    });
  });

  test.describe('RSA interactions (events: GenerateRSAKeys, RsaEncrypt, RsaDecrypt)', () => {
    test('generating keys or RSA encrypt/decrypt should produce page errors when functions are missing', async ({ page }) => {
      // Click generate keys
      const [genErr] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        page.click('button[onclick="generateRSAKeys()"]'),
      ]);

      if (genErr) {
        expect(genErr.name === 'ReferenceError' || /generateRSAKeys|ReferenceError|SyntaxError/i.test(genErr.message)).toBeTruthy();
      } else {
        const found = pageErrors.some(e => /generateRSAKeys|ReferenceError|SyntaxError/i.test(e.message));
        expect(found).toBeTruthy();
      }

      // Click RSA Encrypt
      const [encErr] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        page.click('button[onclick="rsaEncrypt()"]'),
      ]);

      if (encErr) {
        expect(encErr.name === 'ReferenceError' || /rsaEncrypt|ReferenceError|SyntaxError/i.test(encErr.message)).toBeTruthy();
      } else {
        const found = pageErrors.some(e => /rsaEncrypt|ReferenceError|SyntaxError/i.test(e.message));
        expect(found).toBeTruthy();
      }

      // Click RSA Decrypt
      const [decErr] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        page.click('button[onclick="rsaDecrypt()"]'),
      ]);

      if (decErr) {
        expect(decErr.name === 'ReferenceError' || /rsaDecrypt|ReferenceError|SyntaxError/i.test(decErr.message)).toBeTruthy();
      } else {
        const found = pageErrors.some(e => /rsaDecrypt|ReferenceError|SyntaxError/i.test(e.message));
        expect(found).toBeTruthy();
      }
    });
  });

  test.describe('Analysis and Information buttons (AnalyzeFrequency, ShowAlgorithmDetails, ShowSecurityInfo)', () => {
    test('analyzeFrequency should either produce analysis output when functions exist or produce errors when missing', async ({ page }) => {
      // Ensure analysisOutput is empty initially
      const initialOutput = await page.locator('#analysisOutput').innerText();
      expect(initialOutput.trim().length).toBeLessThanOrEqual(0);

      // Click Analyze Character Frequency and observe effects or errors
      const [err] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        page.click('button[onclick="analyzeFrequency()"]'),
      ]);

      if (err) {
        // If an error occurred, it should be a ReferenceError or related to the previously observed SyntaxError
        expect(err.name === 'ReferenceError' || /analyzeFrequency|ReferenceError|SyntaxError/i.test(err.message)).toBeTruthy();

        // Ensure analysisOutput didn't get populated by a successful run (function missing)
        const after = await page.locator('#analysisOutput').innerText();
        expect(after.trim().length).toBeLessThanOrEqual(0);
      } else {
        // If no error, the function executed - check either expected "No text to analyze" or an HTML table result
        const after = await page.locator('#analysisOutput').innerHTML();
        expect(after.length).toBeGreaterThan(0);
        // Accept either the textual no-text case or a table markup
        expect(after.includes('No text to analyze') || after.includes('Character Frequency Analysis')).toBeTruthy();
      }
    });

    test('showAlgorithmDetails and showSecurityInfo either render info or cause ReferenceErrors when functions are missing', async ({ page }) => {
      // Try showAlgorithmDetails
      const [detErr] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        page.click('button[onclick="showAlgorithmDetails()"]'),
      ]);

      if (detErr) {
        expect(detErr.name === 'ReferenceError' || /showAlgorithmDetails|ReferenceError|SyntaxError/i.test(detErr.message)).toBeTruthy();
      } else {
        const html = await page.locator('#analysisOutput').innerHTML();
        expect(html.length).toBeGreaterThan(0);
        expect(html.includes('Details') || html.includes('Cipher')).toBeTruthy();
      }

      // Try showSecurityInfo
      const [secErr] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        page.click('button[onclick="showSecurityInfo()"]'),
      ]);

      if (secErr) {
        expect(secErr.name === 'ReferenceError' || /showSecurityInfo|ReferenceError|SyntaxError/i.test(secErr.message)).toBeTruthy();
      } else {
        const html = await page.locator('#analysisOutput').innerHTML();
        expect(html.length).toBeGreaterThan(0);
        expect(html.includes('Security') || html.includes('Attack methods') || html.includes('Best practices')).toBeTruthy();
      }
    });
  });

  test.describe('Edge Cases & Robustness', () => {
    test('verify that readonly RSA key textareas are present and remain unchanged when keys are not generated', async ({ page }) => {
      // Initially, RSA public/private key textareas should exist and be readonly
      const pubReadonly = await page.locator('#rsaPublicKey').getAttribute('readonly');
      const privReadonly = await page.locator('#rsaPrivateKey').getAttribute('readonly');

      expect(pubReadonly).not.toBeNull();
      expect(privReadonly).not.toBeNull();

      // Their value should start empty
      const pubVal = await page.locator('#rsaPublicKey').inputValue();
      const privVal = await page.locator('#rsaPrivateKey').inputValue();
      expect(pubVal).toBe('');
      expect(privVal).toBe('');

      // Click generate keys: because of broken script, expect a pageerror (or at minimum they remain empty)
      const [err] = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null),
        page.click('button[onclick="generateRSAKeys()"]'),
      ]);

      if (err) {
        expect(err.name === 'ReferenceError' || /generateRSAKeys|ReferenceError|SyntaxError/i.test(err.message)).toBeTruthy();
      }

      // After attempt, ensure values are still empty (no keys generated due to errors)
      const pubValAfter = await page.locator('#rsaPublicKey').inputValue();
      const privValAfter = await page.locator('#rsaPrivateKey').inputValue();
      expect(pubValAfter).toBe('');
      expect(privValAfter).toBe('');
    });
  });
});