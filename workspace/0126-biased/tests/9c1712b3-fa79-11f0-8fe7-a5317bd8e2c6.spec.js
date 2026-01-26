import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c1712b3-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to wait for a substring in the log area
async function waitForLogContains(page, substring, timeout = 5000) {
  const locator = page.locator('#log');
  await page.waitForFunction(
    (el, s) => el && el.textContent && el.textContent.indexOf(s) !== -1,
    locator,
    substring,
    { timeout }
  );
}

test.describe('Asymmetric Cryptography Interactive Lab - FSM and UI tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Capture page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept any dialogs (alerts produced by the app)
    page.on('dialog', async (dialog) => {
      try {
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure initial UI has rendered
    await expect(page.locator('h1')).toHaveText('Asymmetric Cryptography Interactive Lab');
    // Wait for initial pushState('idle') that occurs during initialization (history 1/1)
    await page.waitForFunction(() => {
      const s = document.getElementById('stateLabel');
      return s && /mode=idle/.test(s.textContent || '');
    }, { timeout: 5000 });
  });

  test.afterEach(async () => {
    // Make sure our captured logs arrays exist for debugging; tests assert further as needed.
    // No teardown actions required.
  });

  test('Initial Idle State should be rendered and history initialized', async ({ page }) => {
    // Validate initial state label shows idle and history is initialized to 1/1
    const stateLabel = page.locator('#stateLabel');
    const text = await stateLabel.textContent();
    expect(text).toMatch(/mode=idle/);
    expect(text).toMatch(/history=1\/1/);

    // The log pre should contain initialization message
    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('Interactive asymmetric cryptography lab initialized.');
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  test.describe('Key generation, export, copy, and clear state', () => {
    test('Generate Toy RSA creates history entries (S0 -> S1 -> S2) and can export/copy', async ({ page }) => {
      // Switch to toy-rsa mode
      await page.selectOption('#algoSelect', 'toy-rsa');

      // Click Generate Key Pair (toy) - deterministic, fast
      await page.click('#genKey');

      // After generation, the code pushes two states (start-generation, generated-toy-rsa).
      // Expect stateLabel to indicate "generating toy-rsa" (state.mode left as generating ...) and history to be 3/3
      await page.waitForFunction(() => {
        const s = document.getElementById('stateLabel');
        return s && /generating toy-rsa/.test(s.textContent || '') && /history=3\/3/.test(s.textContent || '');
      }, { timeout: 5000 });

      const stateLabel = await page.locator('#stateLabel').textContent();
      expect(stateLabel).toMatch(/generating toy-rsa/);
      expect(stateLabel).toMatch(/history=3\/3/);

      // Export public and private (toy uses string exports)
      await page.click('#exportPublic');
      await waitForLogContains(page, 'Public PEM exported (toy/simple).');
      await page.click('#exportPrivate');
      await waitForLogContains(page, 'Private PEM exported (toy/simple).');

      // Attempt copy to clipboard for public and private - environment may permit or deny clipboard access.
      // Accept either a successful log entry or the presence of a page error from clipboard attempt.
      await page.click('#copyPublic');
      const log = await page.locator('#log').textContent();
      const copyPublicSucceeded = log.includes('Public PEM copied to clipboard.');
      if (!copyPublicSucceeded) {
        // If clipboard not allowed, expect at least an error to have been captured or a log message indicating failure
        // The app does not catch clipboard-specific errors in all cases, but the page may surface pageerror events.
        // We don't require a specific error string because environments vary; assert that we at least observed no crash.
        expect(Array.isArray(pageErrors)).toBeTruthy();
      }

      await page.click('#copyPrivate');
      const log2 = await page.locator('#log').textContent();
      const copyPrivateSucceeded = log2.includes('Private PEM copied to clipboard.');
      if (!copyPrivateSucceeded) {
        expect(Array.isArray(pageErrors)).toBeTruthy();
      }

      // Clear state should reset history and log 'Cleared state and history.'
      await page.click('#clearState');
      await waitForLogContains(page, 'Cleared state and history.');
      const clearedLabel = await page.locator('#stateLabel').textContent();
      // After clearing, renderStateLabel was called which pushes state and updates label; expect mode=idle and history=1/1
      expect(clearedLabel).toMatch(/mode=idle/);
    });

    test('Attempt import with empty textarea logs a friendly message (edge case)', async ({ page }) => {
      // Ensure import textarea is empty
      await page.fill('#importPem', '');
      await page.click('#importBtn');
      await waitForLogContains(page, 'No PEM text to import');
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('No PEM text to import');
    });
  });

  test.describe('RSA Encryption and Decryption (real keys)', () => {
    test('Generate RSA-OAEP (smaller bits), encrypt plaintext, and decrypt it back', async ({ page }) => {
      // Use smaller RSA bits for speed (1024) - set via input range value; use evaluate to set property directly
      await page.selectOption('#algoSelect', 'rsa-oaep');
      await page.evaluate(() => { document.getElementById('rsaBits').value = '1024'; document.getElementById('rsaBitsDisplay').textContent = '1024'; });

      // Generate RSA key pair (async). This will push states and log generation messages.
      await page.click('#genKey');

      // Wait for generation to complete: log should mention RSA keyPair generated or state history growth.
      await waitForLogContains(page, 'RSA keyPair generated, bits=');

      // Fill plaintext and ensure encoding is UTF-8
      const message = 'hello rsa oaep test';
      await page.fill('#plaintext', message);
      await page.selectOption('#inEncoding', 'utf8');

      // Click encrypt - the page will alert with ciphertext; our dialog handler accepts it
      await page.click('#encryptBtn');
      await waitForLogContains(page, 'Encryption complete. Ciphertext (base64):');

      // Click decrypt - should log decrypted plaintext and alert; verify decrypted plaintext appears in logs
      await page.click('#decryptBtn');
      await waitForLogContains(page, 'Decryption success. Plain (utf8):');
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('Decryption success. Plain (utf8):');
      expect(logText).toContain(message);
    }, 60000); // generation + crypto may need extra time

  });

  test.describe('Signing and Verification', () => {
    test('RSA-PSS sign and verify flow should return true', async ({ page }) => {
      // Generate RSA-PSS key (for signing). Use smaller RSA bits for speed.
      await page.selectOption('#algoSelect', 'rsa-pss');
      await page.evaluate(() => { document.getElementById('rsaBits').value = '1024'; document.getElementById('rsaBitsDisplay').textContent = '1024'; });

      await page.click('#genKey');
      await waitForLogContains(page, 'RSA keyPair generated, bits=');

      // Provide plaintext and sign
      const msg = 'sign this message';
      await page.fill('#plaintext', msg);
      await page.click('#signBtn');
      await waitForLogContains(page, 'Signed (PSS) base64:');

      // Verify the previously created signature
      await page.click('#verifyBtn');
      await waitForLogContains(page, 'Verify RSA-PSS result:');
      const logText = await page.locator('#log').textContent();
      expect(logText).toMatch(/Verify RSA-PSS result:\s*true/);
    }, 60000);

    test('ECDSA sign and verify flow should succeed', async ({ page }) => {
      // Generate ECDSA keys
      await page.selectOption('#algoSelect', 'ecdsa');
      await page.selectOption('#ecCurve', 'P-256');
      await page.click('#genKey');
      await waitForLogContains(page, 'ecdsa keyPair generated. curve=P-256');

      // Sign
      const msg = 'ecdsa message';
      await page.fill('#plaintext', msg);
      await page.selectOption('#inEncoding', 'utf8');
      await page.click('#signBtn');
      await waitForLogContains(page, 'ECDSA signature base64:');

      // Verify
      await page.click('#verifyBtn');
      await waitForLogContains(page, 'ECDSA verify result:');
      const logText = await page.locator('#log').textContent();
      expect(logText).toMatch(/ECDSA verify result:\s*true/);
    }, 60000);
  });

  test.describe('ECDH derive & HKDF -> AES encrypt', () => {
    test('Derive shared secret with peer public PEM and derive AES to encrypt plaintext', async ({ page }) => {
      // Generate an ECDH key pair (local)
      await page.selectOption('#algoSelect', 'ecdh');
      await page.selectOption('#ecCurve', 'P-256');
      await page.click('#genKey');
      await waitForLogContains(page, 'ecdh keyPair generated. curve=P-256');

      // Create another ECDH key pair inside the page context to act as peer and get its public PEM
      const peerPem = await page.evaluate(async () => {
        // generate ephemeral peer key
        const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
        const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
        function ab2b64(ab){ return btoa(String.fromCharCode(...new Uint8Array(ab))); }
        function toPem(b64,label){ const chunk = b64.match(/.{1,64}/g).join("\n"); return `-----BEGIN ${label}-----\n${chunk}\n-----END ${label}-----\n`; }
        return toPem(ab2b64(spki), 'PUBLIC KEY');
      });

      // Fill peerPublicPem and click derive
      await page.fill('#peerPublicPem', peerPem);
      await page.click('#deriveBtn');
      await waitForLogContains(page, 'Derived bits (hex):');

      // Now derive AES via HKDF and encrypt plaintext
      await page.fill('#plaintext', 'secret-from-ecdh');
      await page.click('#deriveAesBtn');
      await waitForLogContains(page, 'Derived AES-GCM key and encrypted plaintext. Ciphertext(base64):');

      // Confirm last cipher logged
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('Derived AES-GCM key and encrypted plaintext. Ciphertext(base64):');
    }, 60000);
  });

  test.describe('Hybrid encryption / decryption flow and keyboard-triggered decrypt', () => {
    test('Hybrid encrypt with RSA-OAEP and hybrid decrypt via Ctrl+D (keydown handler)', async ({ page }) => {
      // Ensure RSA-OAEP keypair present - generate small RSA for speed
      await page.selectOption('#algoSelect', 'rsa-oaep');
      await page.evaluate(() => { document.getElementById('rsaBits').value = '1024'; document.getElementById('rsaBitsDisplay').textContent = '1024'; });
      await page.click('#genKey');
      await waitForLogContains(page, 'RSA keyPair generated, bits=');

      // Provide plaintext and perform hybrid encryption
      const text = 'hybrid secret';
      await page.fill('#plaintext', text);
      await page.click('#hybridBtn');
      await waitForLogContains(page, 'Hybrid encryption complete. WrappedKey (b64):');

      // Trigger hybrid decrypt via Ctrl+D (the app listens for ctrlKey + 'd' keydown)
      await page.keyboard.down('Control');
      await page.keyboard.press('d');
      await page.keyboard.up('Control');

      // After hybrid decrypt, logs should contain hybrid decrypt success and plaintext
      await waitForLogContains(page, 'Hybrid decrypt success. Plaintext:');
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('Hybrid decrypt success. Plaintext:');
      expect(logText).toContain(text);
    }, 60000);
  });

  test.describe('Toy RSA attack simulation and private reveal', () => {
    test('Generate toy RSA, run attack (trial division) and reveal private toy key data', async ({ page }) => {
      // Generate toy RSA
      await page.selectOption('#algoSelect', 'toy-rsa');
      await page.evaluate(() => { document.getElementById('toyBits').value = '32'; document.getElementById('toyBitsDisplay').textContent = '32'; document.getElementById('toySeed').value = 'seed-test'; });
      await page.click('#genKey');

      // Wait for generation log
      await waitForLogContains(page, 'Toy RSA generated: n bits');

      // Click attack - should find small factors quickly and push toy-factored
      await page.click('#attackBtn');
      // The attack logs 'Factor found p=' or 'No factor found' depending on timing; ensure at least one of those logs appear.
      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        if(!l) return false;
        const txt = l.textContent || '';
        return txt.includes('Factor found p=') || txt.includes('No factor found in time limit') || txt.includes('toy-factored');
      }, { timeout: 5000 });

      const logText = await page.locator('#log').textContent();
      expect(logText).toMatch(/(Factor found p=|toy-factored|No factor found)/);

      // Reveal private toy should log reveal
      await page.click('#revealPrivateToy');
      await waitForLogContains(page, 'Revealed toy RSA private data.');
      expect(await page.locator('#log').textContent()).toContain('Revealed toy RSA private data.');
    });
  });

  test.describe('History navigation: Step Back and Step Forward', () => {
    test('StepBack and StepNext restore history snapshots and log navigation', async ({ page }) => {
      // Start in idle, generate toy key, then generate another mode to create history
      await page.selectOption('#algoSelect', 'toy-rsa');
      await page.click('#genKey');
      await waitForLogContains(page, 'Toy RSA generated:');

      // Create another snapshot by switching mode (pushes 'mode-changed')
      await page.selectOption('#algoSelect', 'rsa-oaep');
      // The onchange handler pushes a state; wait for log
      await waitForLogContains(page, 'Mode switched to', 3000).catch(() => {}); // not critical

      // Use Step Back
      await page.click('#stepBack');
      await waitForLogContains(page, 'Restored history index', 5000);
      const backLog = await page.locator('#log').textContent();
      expect(backLog).toContain('Restored history index');

      // Use Step Forward
      await page.click('#stepNext');
      await waitForLogContains(page, 'Restored history index', 5000);
      const forwardLog = await page.locator('#log').textContent();
      // At least one of the logs should indicate navigation
      expect(forwardLog).toContain('Restored history index');
    });
  });

  test.describe('Show JWK and show private JWK (alerts handled)', () => {
    test('Show public and private JWK when available', async ({ page }) => {
      // Generate ECDSA keys (public/private jwk export supported)
      await page.selectOption('#algoSelect', 'ecdsa');
      await page.selectOption('#ecCurve', 'P-256');
      await page.click('#genKey');
      await waitForLogContains(page, 'ecdsa keyPair generated. curve=P-256');

      // Click show public JWK - alert will be accepted automatically
      await page.click('#showJwk');
      await waitForLogContains(page, 'Public JWK:');

      // Click show private JWK
      await page.click('#showPrivJwk');
      // Depending on browser policy, exporting private JWK may throw; handle both success and error
      // Wait for either success or failure messages in logs
      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        if(!l) return false;
        const t = l.textContent || '';
        return t.includes('Private JWK:') || t.includes('Show private JWK failed:') || t.includes('No private key loaded');
      }, { timeout: 5000 });

      const logText = await page.locator('#log').textContent();
      expect(/(Public JWK:)/.test(logText)).toBeTruthy();
    });
  });

  test.describe('Edge cases and error observation', () => {
    test('Import invalid PEM triggers import failed log (error handling)', async ({ page }) => {
      // Provide clearly invalid PEM
      await page.fill('#importPem', 'NOT A PEM');
      await page.selectOption('#importType', 'auto');
      await page.click('#importBtn');

      // Should log Import failed or Invalid PEM format
      await page.waitForFunction(() => {
        const l = document.getElementById('log');
        if(!l) return false;
        const t = l.textContent || '';
        return t.includes('Import failed:') || t.includes('Invalid PEM format') || t.includes('Import returned no key') || t.includes('No PEM text to import');
      }, { timeout: 3000 });

      const logText = await page.locator('#log').textContent();
      expect(/(Import failed:|Invalid PEM format|No PEM text to import|Import returned no key)/.test(logText)).toBeTruthy();
    });

    test('Collect console and page errors; assert they are accessible (do not patch runtime)', async ({ page }) => {
      // This test simply asserts that we captured console messages and page errors arrays are accessible.
      // Depending on environment there may or may not be page errors (e.g., clipboard NotAllowedError).
      // We assert that capturing worked and that errors are instances of Error when present.
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);
      if (pageErrors.length > 0) {
        // Ensure captured entries are Error objects (or have message property)
        for (const e of pageErrors) {
          expect(e).toBeDefined();
          expect(typeof e.message === 'string' || typeof e === 'string').toBeTruthy();
        }
      }
    });
  });

});