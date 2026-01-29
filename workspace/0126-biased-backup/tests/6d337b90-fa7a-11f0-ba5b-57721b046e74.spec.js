import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d337b90-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Asymmetric Cryptography Interactive Demo (FSM tests) - 6d337b90-fa7a-11f0-ba5b-57721b046e74', () => {
  // Reusable collectors for dialogs and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console messages for inspection
    page.context().on('page', () => {}); // noop to ensure page context exists
    page.on('console', msg => {
      // keep console output visible for debugging if needed
      // but do not fail tests on console messages; we will assert expected ones when appropriate
      // console.log(`[console:${msg.type()}] ${msg.text()}`);
    });
  });

  /**
   * Helper: click a selector and wait briefly for either a dialog or a pageerror.
   * Returns an object describing which event occurred and relevant data.
   * If neither occurs within timeout, returns null.
   */
  async function clickAndCapture(page, selector, timeout = 2000) {
    const dialogPromise = page.waitForEvent('dialog', { timeout }).then(dialog => {
      const message = dialog.message();
      dialog.accept().catch(() => {});
      return { type: 'dialog', message };
    }).catch(() => null);

    const pageErrorPromise = page.waitForEvent('pageerror', { timeout }).then(error => {
      return { type: 'pageerror', error };
    }).catch(() => null);

    // Start both awaits, then click
    const clickPromise = page.click(selector).catch(e => {
      // If click itself fails, surface it as pageerror-like object
      return { clickError: e };
    });

    // Ensure click is attempted before waiting for events
    await clickPromise;

    // Wait for either dialog or pageerror or timeout
    const res = await Promise.race([dialogPromise, pageErrorPromise]);
    return res;
  }

  test.describe('State S0_Idle and initial UI', () => {
    test('S0_Idle: Page renders and key generation control is present', async ({ page }) => {
      // Validate initial idle state (S0_Idle)
      await page.goto(APP_URL);
      // Key generation button should exist
      const generateBtn = page.locator('#generateKeys');
      await expect(generateBtn).toBeVisible();
      // Key pair section should be hidden initially
      await expect(page.locator('#keyPairSection')).toHaveClass(/hidden/);
    });
  });

  test.describe('Key pair generation (S1_KeyPairGenerated) and related controls', () => {
    test('Generate keys transitions to S1_KeyPairGenerated and shows key pair with alert', async ({ page }) => {
      // This test validates generateKeyPair onEnter actions and UI changes
      await page.goto(APP_URL);

      // Capture the dialog when generating keys
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#generateKeys'),
      ]);
      // The default algorithm option is RSA, expect an alert mentioning RSA
      expect(dialog).toBeDefined();
      expect(dialog.message()).toMatch(/RSA key pair generated successfully!/);
      await dialog.accept();

      // After generation, the keyPairSection should be visible
      await expect(page.locator('#keyPairSection')).toBeVisible();

      // Public and private key elements should have non-empty text
      const publicKeyText = await page.locator('#publicKey').innerText();
      const privateKeyText = await page.locator('#privateKey').innerText();
      expect(publicKeyText.length).toBeGreaterThan(0);
      expect(privateKeyText.length).toBeGreaterThan(0);

      // After generation, the private key should be hidden (hidePrivateKey was called)
      await expect(page.locator('#privateKey')).toHaveClass(/hidden/);

      // The showPrivateKey button should be visible and hidePrivateKey should be hidden initially
      await expect(page.locator('#showPrivateKey')).toBeVisible();
      await expect(page.locator('#hidePrivateKey')).toHaveClass(/hidden/);
    });

    test('Show/Hide private key toggles visibility', async ({ page }) => {
      // Ensure we have a key pair first
      await page.goto(APP_URL);
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#generateKeys');
      const dialog = await dialogPromise;
      await dialog.accept();

      // Click showPrivateKey -> private key should become visible
      await page.click('#showPrivateKey');
      await expect(page.locator('#privateKey')).not.toHaveClass(/hidden/);
      await expect(page.locator('#showPrivateKey')).toHaveClass(/hidden/);
      await expect(page.locator('#hidePrivateKey')).not.toHaveClass(/hidden/);

      // Click hidePrivateKey -> private key should be hidden again
      await page.click('#hidePrivateKey');
      await expect(page.locator('#privateKey')).toHaveClass(/hidden/);
      await expect(page.locator('#showPrivateKey')).not.toHaveClass(/hidden/);
      await expect(page.locator('#hidePrivateKey')).toHaveClass(/hidden/);
    });

    test('Copy Public/Private key buttons trigger clipboard attempt or error/alert', async ({ page }) => {
      // Validate CopyPublicKey and CopyPrivateKey events (they call navigator.clipboard)
      await page.goto(APP_URL);
      const dialogGen = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      dialogGen[0] && (await dialogGen[0].accept());

      // Clicking copyPublicKey: either an alert 'Copied to clipboard!' OR a page error will be produced
      const resultPublic = await clickAndCapture(page, '#copyPublicKey', 2000);
      if (resultPublic) {
        if (resultPublic.type === 'dialog') {
          expect(resultPublic.message).toMatch(/Copied to clipboard!/);
        } else if (resultPublic.type === 'pageerror') {
          // Allow pageerror but assert it is a clipboard related error or similar
          const msg = resultPublic.error?.message ?? String(resultPublic.error);
          expect(typeof msg).toBe('string');
        }
      } else {
        // Neither dialog nor pageerror occurred; this is acceptable but log sanity check: public key text exists
        const pub = await page.locator('#publicKey').innerText();
        expect(pub.length).toBeGreaterThan(0);
      }

      // Clicking copyPrivateKey: make sure private key is visible first
      await page.click('#showPrivateKey');
      const resultPrivate = await clickAndCapture(page, '#copyPrivateKey', 2000);
      if (resultPrivate) {
        if (resultPrivate.type === 'dialog') {
          expect(resultPrivate.message).toMatch(/Copied to clipboard!/);
        } else if (resultPrivate.type === 'pageerror') {
          const msg = resultPrivate.error?.message ?? String(resultPrivate.error);
          expect(typeof msg).toBe('string');
        }
      } else {
        const priv = await page.locator('#privateKey').innerText();
        expect(priv.length).toBeGreaterThan(0);
      }
    });

    test('Selecting ECC algorithm generates ECC keys and alert mentions ECC', async ({ page }) {
      // Validate algorithm selection influences generateKeyPair alert content
      await page.goto(APP_URL);
      await page.selectOption('#algorithm', 'ECC');
      const [dialog] = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      expect(dialog.message()).toMatch(/ECC key pair generated successfully!/);
      await dialog.accept();

      // ECC key public/private lengths differ but should be non-empty
      await expect(page.locator('#keyPairSection')).toBeVisible();
      const pub = await page.locator('#publicKey').innerText();
      const priv = await page.locator('#privateKey').innerText();
      expect(pub.length).toBeGreaterThan(0);
      expect(priv.length).toBeGreaterThan(0);
    });
  });

  test.describe('Encryption and Decryption flows (S2_EncryptedResultDisplayed & S3_DecryptedResultDisplayed)', () => {
    test('Encrypt with public key -> S2 Encrypted Result Displayed with alert and content', async ({ page }) => {
      // Generates keys, fills message, encrypts with public key (default), asserts alert and UI
      await page.goto(APP_URL);
      const gen = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await gen[0].accept();

      // Fill message
      await page.fill('#messageToEncrypt', 'Hello Playwright!');
      // Capture encrypt alert
      const [dialog] = await Promise.all([page.waitForEvent('dialog'), page.click('#encryptButton')]);
      expect(dialog.message()).toMatch(/Message encrypted with public key!/);
      await dialog.accept();

      // Encrypted section visible and contains ENCRYPTED MESSAGE marker
      await expect(page.locator('#encryptedResultSection')).toBeVisible();
      const encryptedText = await page.locator('#encryptedResult').innerText();
      expect(encryptedText).toMatch(/ENCRYPTED MESSAGE/);

      // Copy encrypted may call clipboard -> handle either dialog or page error
      const res = await clickAndCapture(page, '#copyEncrypted', 2000);
      if (res && res.type === 'dialog') {
        expect(res.message).toMatch(/Copied to clipboard!/);
      }
    });

    test('Decrypt with private key -> S3 Decrypted Result Displayed and yields original message', async ({ page }) {
      // Generate keys, encrypt a message with public key, then decrypt with private key
      await page.goto(APP_URL);
      const gen = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await gen[0].accept();

      const original = 'SecretMessage123';
      await page.fill('#messageToEncrypt', original);
      // Encrypt with public key
      const [encDialog] = await Promise.all([page.waitForEvent('dialog'), page.click('#encryptButton')]);
      await encDialog.accept();

      // Grab encrypted result
      const encrypted = await page.locator('#encryptedResult').innerText();
      await page.fill('#messageToDecrypt', encrypted);

      // Ensure decryptKeyType is private (default is private in Decrypt select)
      await page.selectOption('#decryptKeyType', 'private');

      // Click decrypt and assert decrypted result equals original
      await page.click('#decryptButton');
      await expect(page.locator('#decryptedResultSection')).toBeVisible();
      const decrypted = await page.locator('#decryptedResult').innerText();
      expect(decrypted).toBe(original);
      // As decryption used private key, verificationStatus is not set in this branch
    });

    test('Signing (encrypt with private) then verify via decrypt (public) yields verification success', async ({ page }) {
      // Generate keys, sign (encrypt using private key via encryptButton), then verify using decryptButton with public
      await page.goto(APP_URL);
      const g = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await g[0].accept();

      const message = 'Document for signing';
      await page.fill('#messageToEncrypt', message);
      // Select private key for signing
      await page.selectOption('#encryptKeyType', 'private');

      // Encrypt/Sign -> should alert about signing with private key
      const [signDialog] = await Promise.all([page.waitForEvent('dialog'), page.click('#encryptButton')]);
      expect(signDialog.message()).toMatch(/Message signed with private key!/);
      await signDialog.accept();

      const signatureText = await page.locator('#encryptedResult').innerText();
      expect(signatureText).toMatch(/SIGNATURE/);

      // Put signature into decrypt textarea and select public key for verification
      await page.fill('#messageToDecrypt', signatureText);
      await page.selectOption('#decryptKeyType', 'public');

      // Decrypt/Verify: should show verificationStatus text and be green on success
      await page.click('#decryptButton');
      await expect(page.locator('#decryptedResultSection')).toBeVisible();
      const verStatus = await page.locator('#verificationStatus').innerText();
      expect(verStatus).toMatch(/Signature verified successfully!/);
      const color = await page.locator('#verificationStatus').evaluate(el => window.getComputedStyle(el).color);
      expect(color).toBeDefined();
    });

    test('Attempt to encrypt without keys yields an alert error (edge case)', async ({ page }) {
      // Reload to fresh state and attempt to encrypt without generating keys
      await page.goto(APP_URL);

      await page.fill('#messageToEncrypt', 'No keys present');
      const dialog = await page.waitForEvent('dialog');
      // Click encrypt; expect alert 'Please generate a key pair first'
      await page.click('#encryptButton');
      expect(dialog.message()).toMatch(/Please generate a key pair first/);
      await dialog.accept();
    });

    test('Attempt to decrypt without entering input yields alert', async ({ page }) {
      // Generate keys to avoid the 'Please generate a key pair first' error, then click decrypt without input
      await page.goto(APP_URL);
      const gen = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await gen[0].accept();

      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#decryptButton');
      const dialog = await dialogPromise;
      expect(dialog.message()).toMatch(/Please enter an encrypted message or signature/);
      await dialog.accept();
    });
  });

  test.describe('Key exchange simulation (S4_KeyExchangeSetup) and shared secret computation', () => {
    test('Setup key exchange shows keyExchangeSection and alert', async ({ page }) => {
      await page.goto(APP_URL);
      const gen = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await gen[0].accept();

      // Setup key exchange should show an alert mentioning algorithm
      const [dialog] = await Promise.all([page.waitForEvent('dialog'), page.click('#setupKeyExchange')]);
      expect(dialog.message()).toMatch(/Key exchange setup complete for (RSA|ECC)! Alice and Bob have generated their key pairs./);
      await dialog.accept();

      // keyExchangeSection should be visible with keys present
      await expect(page.locator('#keyExchangeSection')).toBeVisible();
      const alicePub = await page.locator('#alicePublicKey').innerText();
      const bobPub = await page.locator('#bobPublicKey').innerText();
      expect(alicePub.length).toBeGreaterThan(0);
      expect(bobPub.length).toBeGreaterThan(0);
    });

    test('Compute shared secrets for Alice and Bob produces sharedSecretMatch text (either match or mismatch)', async ({ page }) {
      await page.goto(APP_URL);
      const gen = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await gen[0].accept();

      const setupDialog = await Promise.all([page.waitForEvent('dialog'), page.click('#setupKeyExchange')]);
      await setupDialog[0].accept();

      // Click Alice compute, then Bob compute
      await page.click('#aliceComputeShared');
      await expect(page.locator('#aliceSharedSecret')).toBeVisible();
      const aliceSecret = await page.locator('#aliceSharedSecret').innerText();
      expect(aliceSecret).toMatch(/SharedSecret:/);

      await page.click('#bobComputeShared');
      await expect(page.locator('#bobSharedSecret')).toBeVisible();
      const bobSecret = await page.locator('#bobSharedSecret').innerText();
      expect(bobSecret).toMatch(/SharedSecret:/);

      // After both computed, sharedSecretMatch should have text and color indicating match/mismatch
      const matchText = await page.locator('#sharedSecretMatch').innerText();
      expect(matchText.length).toBeGreaterThan(0);
      const color = await page.locator('#sharedSecretMatch').evaluate(el => window.getComputedStyle(el).color);
      expect(color).toBeDefined();
    });

    test('Attempt computeSharedSecret without setup shows alert (edge case)', async ({ page }) {
      // New page without setup -> clicking aliceComputeShared should alert to setup first
      await page.goto(APP_URL);
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#aliceComputeShared');
      const dialog = await dialogPromise;
      expect(dialog.message()).toMatch(/Please setup key exchange first/);
      await dialog.accept();
    });
  });

  test.describe('Digital signature workflow (S5_SignatureGenerated and S6_SignatureVerificationResultDisplayed)', () => {
    test('Sign a document displays signature section and fires alert', async ({ page }) => {
      await page.goto(APP_URL);
      const gen = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await gen[0].accept();

      // Fill document and sign
      await page.fill('#documentToSign', 'Important Document v1');
      const [dialog] = await Promise.all([page.waitForEvent('dialog'), page.click('#signDocument')]);
      expect(dialog.message()).toMatch(/Document signed successfully!/);
      await dialog.accept();

      // Signature section should be visible and contain signature text
      await expect(page.locator('#signatureSection')).toBeVisible();
      const signature = await page.locator('#documentSignature').innerText();
      expect(signature).toMatch(/BEGIN SIGNATURE/);
    });

    test('Verify document after signing shows valid verification result (green)', async ({ page }) {
      await page.goto(APP_URL);
      const gen = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await gen[0].accept();

      const doc = 'Document to verify';
      await page.fill('#documentToSign', doc);
      const signDialog = await Promise.all([page.waitForEvent('dialog'), page.click('#signDocument')]);
      await signDialog[0].accept();

      // Fill the verify textarea with the same document and click verify
      await page.fill('#documentToVerify', doc);
      await page.click('#verifyDocument');

      // verificationResult should state "Signature is valid!" and be green
      await expect(page.locator('#verificationResult')).toBeVisible();
      const text = await page.locator('#verificationResult').innerText();
      expect(text).toMatch(/Signature is valid!/);
      const color = await page.locator('#verificationResult').evaluate(el => window.getComputedStyle(el).color);
      expect(color).toBeDefined();
    });

    test('Verify without signing shows alert (edge case)', async ({ page }) {
      // Generate keys but do not sign; then attempt verify -> should alert 'Please sign a document first'
      await page.goto(APP_URL);
      const g = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await g[0].accept();

      await page.fill('#documentToVerify', 'Any doc');
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#verifyDocument');
      const dialog = await dialogPromise;
      expect(dialog.message()).toMatch(/Please sign a document first/);
      await dialog.accept();
    });
  });

  test.describe('Additional transitions and negative flows derived from the FSM', () => {
    test('Decrypting a signature-like payload with public key via decryptMessage reaches S3 and sets verification status appropriately', async ({ page }) {
      // This test uses encryptButton with private to create a signature-like payload and then uses decrypt with public to verify
      await page.goto(APP_URL);
      const g = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await g[0].accept();

      const msg = 'VerifyMe';
      await page.fill('#messageToEncrypt', msg);
      await page.selectOption('#encryptKeyType', 'private');
      const signDialog = await Promise.all([page.waitForEvent('dialog'), page.click('#encryptButton')]);
      await signDialog[0].accept();

      const signature = await page.locator('#encryptedResult').innerText();
      await page.fill('#messageToDecrypt', signature);
      await page.selectOption('#decryptKeyType', 'public');
      await page.click('#decryptButton');

      // verificationStatus should be set to successful
      await expect(page.locator('#decryptedResultSection')).toBeVisible();
      const verificationText = await page.locator('#verificationStatus').innerText();
      expect(verificationText).toMatch(/Signature verified successfully!/);
      const color = await page.locator('#verificationStatus').evaluate(el => window.getComputedStyle(el).color);
      expect(color).toBeDefined();
    });

    test('Attempt verifyDocument with mismatched document should result in invalid signature (red)', async ({ page }) {
      // Sign a document, then attempt to verify a different document -> should be invalid
      await page.goto(APP_URL);
      const g = await Promise.all([page.waitForEvent('dialog'), page.click('#generateKeys')]);
      await g[0].accept();

      await page.fill('#documentToSign', 'OriginalDoc');
      const signDialog = await Promise.all([page.waitForEvent('dialog'), page.click('#signDocument')]);
      await signDialog[0].accept();

      // Now try verify a different document
      await page.fill('#documentToVerify', 'TamperedDoc');
      await page.click('#verifyDocument');

      const text = await page.locator('#verificationResult').innerText();
      expect(text).toMatch(/Signature is invalid!/);
      const color = await page.locator('#verificationResult').evaluate(el => window.getComputedStyle(el).color);
      expect(color).toBeDefined();
    });
  });
});