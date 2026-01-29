import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d16874-fa79-11f0-8075-e54a10595dde.html';

/**
 * 99d16874-fa79-11f0-8075-e54a10595dde.spec.js
 *
 * Tests for the "Digital Signature Demo" interactive application.
 *
 * The tests validate all FSM states and transitions described in the FSM:
 *  - S0_Idle (initial)
 *  - S1_DocumentLoaded
 *  - S2_KeysGenerated
 *  - S3_DocumentSigned
 *  - S4_SignatureVerified
 *
 * They exercise all events:
 *  - LoadDocument (click)
 *  - GenerateKeyPair (click)
 *  - SignDocument (click)
 *  - VerifySignature (click)
 *  - ChangeKeySize (change)
 *
 * The tests capture dialogs (alerts), DOM updates, and page errors / console messages.
 *
 * Note: The tests load the page exactly as-is and do not attempt to patch or modify in-page functions.
 */

/**
 * Helper to compute expected browser btoa() for ASCII/UTF-8 strings.
 * Node's Buffer is compatible for these test inputs.
 */
function base64Encode(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

test.describe('Digital Signature Demo - basic flows', () => {
  // Arrays to capture runtime issues for inspection in tests
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions and console messages
    page.on('pageerror', (err) => {
      // store stringified error for assertions and debugging
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Load the page exactly as provided
    await page.goto(APP_URL);
    // ensure initial DOM is visible before interactions
    await expect(page.locator('h2', { hasText: 'Digital Signature Demo' })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // no teardown modifications required; Playwright closes pages automatically per test
  });

  test('S0 -> S1: Load Document shows alert with the document text', async ({ page }) => {
    // This verifies the LoadDocument event and transition to DocumentLoaded (S1)
    const docText = 'Test document for load';

    // Prepare to capture the alert triggered by loadDocument()
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.fill('#documentInput', docText),
      page.click('button[onclick="loadDocument()"]'),
    ]);

    // Assert alert message matches expected pattern
    expect(dialog.message()).toBe('Document Loaded: ' + docText);
    await dialog.accept();
  });

  test('S0 -> S2: Generate Key Pair populates keys and shows alert', async ({ page }) => {
    // Verify GenerateKeyPair event transitions to KeysGenerated (S2)
    // Default key size is 2048 per HTML
    const expectedSize = '2048';
    const expectedPublic = 'MockPublicKey_' + expectedSize;
    const expectedPrivate = 'MockPrivateKey_' + expectedSize;

    // Capture the alert, then check DOM values
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="generateKeys()"]'),
    ]);

    expect(dialog.message()).toBe('Key Pair Generated');
    await dialog.accept();

    // Check that public/private key textareas received the expected strings
    const publicVal = await page.locator('#publicKey').inputValue();
    const privateVal = await page.locator('#privateKey').inputValue();

    expect(publicVal).toBe(expectedPublic);
    expect(privateVal).toBe(expectedPrivate);
  });

  test('ChangeKeySize updates display and subsequent key generation uses new size', async ({ page }) => {
    // Change key size (ChangeKeySize event) and ensure keySizeDisplay updates
    const newSize = '3072';
    // Set the range value and dispatch a change event inside the browser context
    await page.$eval('#keyChange', (el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, newSize);

    // The page updates #keySizeDisplay textContent
    const display = await page.locator('#keySizeDisplay').textContent();
    expect(display.trim()).toBe(newSize);

    // Now generate keys and verify key strings include the new size
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="generateKeys()"]'),
    ]);
    expect(dialog.message()).toBe('Key Pair Generated');
    await dialog.accept();

    const publicVal = await page.locator('#publicKey').inputValue();
    const privateVal = await page.locator('#privateKey').inputValue();
    expect(publicVal).toBe('MockPublicKey_' + newSize);
    expect(privateVal).toBe('MockPrivateKey_' + newSize);
  });

  test('S1 -> S3: Sign Document after loading document and generating keys results in signature and alert', async ({ page }) => {
    // Prepare document and keys
    const docText = 'Document to be signed';
    await page.fill('#documentInput', docText);

    // Generate keys first
    const [genDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="generateKeys()"]'),
    ]);
    expect(genDialog.message()).toBe('Key Pair Generated');
    await genDialog.accept();

    // Now sign the document
    const [signDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="signDocument()"]'),
    ]);
    expect(signDialog.message()).toBe('Document Signed');
    await signDialog.accept();

    // Verify signature textarea contains expected "Signature_" + btoa(documentText)
    const expectedSignature = 'Signature_' + base64Encode(docText);
    const signatureVal = await page.locator('#signature').inputValue();
    expect(signatureVal).toBe(expectedSignature);
  });

  test('S3 -> S4: Verify Signature validates correct and incorrect signatures', async ({ page }) => {
    const docText = 'Verify this signature';
    await page.fill('#documentInput', docText);

    // Generate keys
    const [genDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="generateKeys()"]'),
    ]);
    expect(genDialog.message()).toBe('Key Pair Generated');
    await genDialog.accept();

    // Sign
    const [signDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="signDocument()"]'),
    ]);
    expect(signDialog.message()).toBe('Document Signed');
    await signDialog.accept();

    // Read produced signature and place it into input for verification (valid case)
    const producedSignature = await page.locator('#signature').inputValue();
    await page.fill('#signatureInput', producedSignature);
    // Click verify (no alert expected) and then check #verificationResult text
    await page.click('button[onclick="verifySignature()"]');
    await expect(page.locator('#verificationResult')).toHaveText('Signature Valid');

    // Now test invalid signature
    await page.fill('#signatureInput', producedSignature + '_tampered');
    await page.click('button[onclick="verifySignature()"]');
    await expect(page.locator('#verificationResult')).toHaveText('Signature Invalid');
  });
});

test.describe('Digital Signature Demo - edge cases and error scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('Signing with empty document triggers "Please load a document first."', async ({ page }) => {
    // Ensure document input is empty
    await page.fill('#documentInput', '');

    // Attempt to sign: should alert "Please load a document first."
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="signDocument()"]'),
    ]);
    expect(dialog.message()).toBe('Please load a document first.');
    await dialog.accept();
  });

  test('Signing with document but without keys triggers "Please generate a key pair first."', async ({ page }) => {
    // Fill the document to bypass the first guard
    await page.fill('#documentInput', 'Document present but no keys');

    // Ensure keys are not generated (clear any possible values)
    // The HTML doesn't provide a direct clear; but initially they are empty.
    // Attempt signing now -> should alert to generate keys first
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="signDocument()"]'),
    ]);
    expect(dialog.message()).toBe('Please generate a key pair first.');
    await dialog.accept();
  });
});

test.describe('Digital Signature Demo - console and page error observations', () => {
  test('Observe console messages and page errors while interacting with the app', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Do a sequence of interactions to capture potential runtime issues
    // 1) Load a document (alert)
    const docText = 'Error observation doc';
    const dialog1 = await Promise.all([
      page.waitForEvent('dialog'),
      page.fill('#documentInput', docText),
      page.click('button[onclick="loadDocument()"]'),
    ]);
    // accept
    (dialog1[0]) && await dialog1[0].accept();

    // 2) Generate keys (alert)
    const dialog2 = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="generateKeys()"]'),
    ]);
    (dialog2[0]) && await dialog2[0].accept();

    // 3) Sign document (alert)
    const dialog3 = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="signDocument()"]'),
    ]);
    (dialog3[0]) && await dialog3[0].accept();

    // 4) Verify signature
    const signature = await page.locator('#signature').inputValue();
    await page.fill('#signatureInput', signature);
    await page.click('button[onclick="verifySignature()"]');
    await expect(page.locator('#verificationResult')).toHaveText('Signature Valid');

    // 5) Change key size
    await page.$eval('#keyChange', (el) => {
      el.value = '2560';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const display = await page.locator('#keySizeDisplay').textContent();
    expect(display.trim()).toBe('2560');

    // After interactions, assert that there were no uncaught page errors.
    // The HTML/JS provided is expected to run without throwing ReferenceError/SyntaxError/TypeError.
    // If any such errors are present, list them to aid debugging.
    if (pageErrors.length > 0) {
      // Format messages for clearer test failure output
      const msgs = pageErrors.map((e) => `${e.name}: ${e.message}`).join('\n---\n');
      // Fail the test and include the collected errors
      throw new Error('Uncaught page errors detected:\n' + msgs);
    }

    // Additionally assert no console.error messages were emitted during the flow.
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});