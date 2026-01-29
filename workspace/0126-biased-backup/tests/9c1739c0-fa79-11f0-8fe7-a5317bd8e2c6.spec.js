import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c1739c0-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper: wait until stateText contains substring, with timeout
async function waitForStateContains(page, substring, options = {}) {
  const timeout = options.timeout ?? 5000;
  await page.waitForFunction(
    (s) => {
      const el = document.getElementById('stateText');
      return el && el.textContent && el.textContent.includes(s);
    },
    substring,
    { timeout }
  );
}

test.describe('Digital Signatures Playground - FSM states and transitions', () => {
  // Capture console and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors so tests can assert on them
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the provided HTML page
    await page.goto(APP_URL);
    // Ensure the app initialized to Idle - ready
    await waitForStateContains(page, 'Idle - ready');
  });

  test.afterEach(async ({ page }) => {
    // As a safety, capture any final console logs
    // No teardown action required; Playwright fixture will close pages automatically
  });

  test('Initial state is Idle - ready (S0_Idle entry action)', async ({ page }) => {
    // Validate initial state text set by entry action: "Idle - ready"
    const state = page.locator('#stateText');
    await expect(state).toHaveText('Idle - ready');

    // Ensure no synchronous page errors were raised on load (no uncaught exceptions)
    // We assert that there were no page errors of type ReferenceError/SyntaxError/TypeError
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length, 'No critical page errors on initial load').toBe(0);

    // Also assert there are no console.error messages indicating runtime issues
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length, 'No console.error messages on initial load').toBe(0);
  });

  test('GENERATE_KEY transition: generate RSA key and export public PEM (S0 -> S1 -> S0)', async ({ page }) => {
    // Click Generate Key (default algorithm is RSA)
    await page.click('#generateKey');

    // On click should enter 'Generating key...' quickly
    await waitForStateContains(page, 'Generating key...');
    // Wait for generation to finish and state to show Generated RSA key
    await waitForStateContains(page, 'Generated RSA key');

    // After key generation, export the public key to PEM
    await page.click('#exportPemPub');
    await waitForStateContains(page, 'Exported public key as PEM');

    // Inspect PEM area to ensure it contains a BEGIN PUBLIC KEY header
    const pemValue = await page.locator('#pemArea').inputValue();
    expect(pemValue).toContain('BEGIN PUBLIC KEY');

    // No severe page errors during generation/export
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);

    // No console.error messages emitted for this flow
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  test('SIGN_MESSAGE and VERIFY_SIGNATURE cycle with RSA (S0 -> S2 -> S0 and S0 -> S3 -> S0)', async ({ page }) => {
    // Ensure we have a fresh RSA key by generating one
    await page.click('#generateKey');
    await waitForStateContains(page, 'Generated RSA key');

    // Sign the default message
    await page.click('#signBtn');
    await waitForStateContains(page, 'Signing...');
    await waitForStateContains(page, 'Signed successfully');

    // Signature output area should be populated
    const sig = await page.locator('#sigArea').inputValue();
    expect(sig.length).toBeGreaterThan(0);

    // Verify the signature: click Verify
    await page.click('#verifyBtn');
    await waitForStateContains(page, 'Verifying...');
    // Wait for verification done - will indicate VALID or INVALID
    await waitForStateContains(page, 'Verification done:');

    // Check verification output reads VALID signature
    const verifyOutputText = await page.locator('#verifyOutput').textContent();
    // The test expects a valid signature immediately after signing and verifying with same keys
    expect(verifyOutputText).toMatch(/VALID|INVALID/);
    expect(verifyOutputText).toContain('VALID');

    // Ensure the state indicates VALID
    const stateText = await page.locator('#stateText').textContent();
    expect(stateText).toContain('Verification done: VALID');

    // Check no critical runtime errors occurred
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('HASHING (S0 -> S4 -> S0): compute hash and check outputs', async ({ page }) => {
    // Compute hash using default SHA-256
    await page.click('#hashBtn');
    await waitForStateContains(page, 'Hashing...');
    await waitForStateContains(page, 'Hash computed:');

    // The rawHex pre element should now contain hex digits and sigArea should contain base64 digest
    const rawHex = await page.locator('#rawHex').textContent();
    expect(rawHex.trim().length).toBeGreaterThan(0);
    // sigArea should also be populated
    const sigArea = await page.locator('#sigArea').inputValue();
    expect(sigArea.length).toBeGreaterThan(0);

    // Validate state message references the selected hash algorithm
    const stateText = await page.locator('#stateText').textContent();
    expect(stateText).toContain('Hash computed:');

    // No uncaught critical errors
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('HMAC compute flow (S0 -> S5 -> S0): generate HMAC key then compute HMAC', async ({ page }) => {
    // Select HMAC algorithm
    await page.selectOption('#algoSelect', 'HMAC');
    // Generate HMAC key
    await page.click('#generateKey');
    await waitForStateContains(page, 'Generated HMAC key');

    // Compute HMAC
    await page.click('#hmacBtn');
    await waitForStateContains(page, 'HMAC compute...');
    await waitForStateContains(page, 'HMAC computed');

    // sigArea must be populated with base64 HMAC value
    const mac = await page.locator('#sigArea').inputValue();
    expect(mac.length).toBeGreaterThan(0);

    // No page errors
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('EXPORT_PUBLIC_KEY and IMPORT_PEM flow (S6 and S7 transitions): export PEM then import as OTHER and verify with it', async ({ page }) => {
    // Ensure RSA key generated
    await page.selectOption('#algoSelect', 'RSASSA-PKCS1-v1_5');
    await page.click('#generateKey');
    await waitForStateContains(page, 'Generated RSA key');

    // Sign a message so we have a signature to verify later
    await page.click('#signBtn');
    await waitForStateContains(page, 'Signed successfully');
    const lastSig = await page.locator('#sigArea').inputValue();
    expect(lastSig.length).toBeGreaterThan(0);

    // Export public key to PEM
    await page.click('#exportPemPub');
    await waitForStateContains(page, 'Exported public key as PEM');
    const exportedPem = await page.locator('#pemArea').inputValue();
    expect(exportedPem).toContain('BEGIN PUBLIC KEY');

    // Now import that PEM as the "other" public key for verification
    await page.click('#importOtherFromPem');
    await waitForStateContains(page, 'Imported OTHER public key stored for verification');

    // Use other public key to verify last signature: use UI helper
    await page.click('#useOtherForVerify');
    await waitForStateContains(page, 'Using other key to verify last signature - click Verify to proceed');

    // Click Verify to perform verification
    await page.click('#verifyBtn');
    await waitForStateContains(page, 'Verification done:');
    const verifyOutputText = await page.locator('#verifyOutput').textContent();
    expect(verifyOutputText).toContain('VALID');

    // No runtime critical errors
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('Sign/Verify failure after tampering -> Verification should be INVALID', async ({ page }) => {
    // Generate RSA key, sign message
    await page.selectOption('#algoSelect', 'RSASSA-PKCS1-v1_5');
    await page.click('#generateKey');
    await waitForStateContains(page, 'Generated RSA key');
    await page.click('#signBtn');
    await waitForStateContains(page, 'Signed successfully');

    // Tamper with the message by flipping a byte
    await page.click('#flipByte');
    await waitForStateContains(page, 'Flipped first byte of message');

    // Attempt verify - should be invalid
    await page.click('#verifyBtn');
    await waitForStateContains(page, 'Verifying...');
    await waitForStateContains(page, 'Verification done:');

    const stateText = await page.locator('#stateText').textContent();
    // Expect INVALID result after tamper
    expect(stateText).toContain('Verification done: INVALID');

    // Also verify UI verifyOutput shows INVALID
    const verifyOutput = await page.locator('#verifyOutput').textContent();
    expect(verifyOutput).toContain('INVALID');

    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('Error edge-cases: sign without key and verify without signature produce informative errors', async ({ page }) => {
    // Reload page to ensure fresh state (no keys)
    await page.reload();
    await waitForStateContains(page, 'Idle - ready');

    // Try signing when no key exists - should set Sign error
    await page.click('#signBtn');
    // Wait for state update to include "Sign error"
    await waitForStateContains(page, 'Sign error:');
    const signState = await page.locator('#stateText').textContent();
    expect(signState).toMatch(/Sign error:/);

    // Try verifying when no signature is provided - should yield "No signature provided" state
    await page.click('#verifyBtn');
    await waitForStateContains(page, 'No signature provided');
    const verifyState = await page.locator('#stateText').textContent();
    expect(verifyState).toContain('No signature provided');

    // Try exporting public key when none exists -> should set Export public error
    await page.click('#exportPemPub');
    await waitForStateContains(page, 'Export public error:');
    const exportState = await page.locator('#stateText').textContent();
    expect(exportState).toMatch(/Export public error:/);

    // Confirm that these are reported as expected error messages and not uncaught exceptions
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('History: record, replay and clear functions update state and history area', async ({ page }) => {
    // Record current snapshot
    await page.click('#recordBtn');
    await waitForStateContains(page, 'Recorded snapshot');

    // Ensure historyArea shows a JSON array with at least 1 entry
    const historyText = await page.locator('#historyArea').textContent();
    expect(historyText.trim().length).toBeGreaterThan(2); // at least "[]"/non-empty

    // Replay - will iterate history and then finish
    await page.click('#replayBtn');
    await waitForStateContains(page, 'Replay finished', { timeout: 10000 });

    // Clear history
    await page.click('#clearHistory');
    await waitForStateContains(page, 'History cleared');
    const clearedHistory = await page.locator('#historyArea').textContent();
    expect(clearedHistory.trim()).toBe('[]');

    // Ensure no uncaught runtime errors happened during history operations
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('Conversion utilities: Text→Hex and Hex→Text produce expected state updates', async ({ page }) => {
    // Put known text into textToHexIn and convert
    await page.fill('#textToHexIn', 'abc');
    await page.click('#textToHexBtn');
    await waitForStateContains(page, 'Converted text to hex in PEM area');

    // The pemArea should contain hex for 'abc' -> 616263
    const pemVal = await page.locator('#pemArea').inputValue();
    expect(pemVal.toLowerCase()).toContain('616263');

    // Now test hex to text conversion: put hex into pemArea and click hexToTextBtn
    await page.fill('#pemArea', '68656c6c6f'); // "hello"
    await page.click('#hexToTextBtn');
    await waitForStateContains(page, 'Converted hex to text and placed in message');

    const messageContent = await page.locator('#message').inputValue();
    expect(messageContent).toContain('hello');

    // Confirm no runtime critical errors
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('Final assertion: no uncaught ReferenceError/SyntaxError/TypeError occurred during test (global check)', async ({ page }) => {
    // This final test just verifies the captured pageErrors and console errors do not include these critical exception types.
    const combined = [
      ...pageErrors.map(e => String(e)),
      ...consoleMessages.filter(m => m.type === 'error').map(m => m.text)
    ].join('\n\n');

    // Assert none of the known critical error names appear
    expect(combined).not.toMatch(/ReferenceError/);
    expect(combined).not.toMatch(/SyntaxError/);
    expect(combined).not.toMatch(/TypeError/);
  });
});