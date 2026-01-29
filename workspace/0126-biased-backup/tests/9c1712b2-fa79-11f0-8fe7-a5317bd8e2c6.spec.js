import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c1712b2-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object for the playground to encapsulate common interactions
class PlaygroundPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors used across tests
    this.selectors = {
      stateDisplay: '#stateDisplay',
      keyInput: '#keyInput',
      importKeyBtn: '#importKeyBtn',
      genKeyBtn: '#genKeyBtn',
      exportKeyBtn: '#exportKeyBtn',
      showKeyBtn: '#showKeyBtn',
      keyInfo: '#keyInfo',
      algoSelect: '#algoSelect',
      keySize: '#keySize',
      plaintext: '#plaintext',
      plainEncoding: '#plainEncoding',
      ctEncoding: '#ctEncoding',
      encryptBtn: '#encryptBtn',
      decryptBtn: '#decryptBtn',
      ciphertextArea: '#ciphertext',
      decryptResult: '#decryptResult',
      ivInput: '#ivInput',
      genIvBtn: '#genIvBtn',
      mutateIvBtn: '#mutateIvBtn',
      ivInfo: '#ivInfo',
      tamperBtn: '#tamperBtn',
      showCtBtn: '#showCtBtn',
      downloadBtn: '#downloadBtn',
      bfStart: '#bfStart',
      bfStop: '#bfStop',
      bfInput: '#bfInput',
      bfKeySize: '#bfKeySize',
      bfLimit: '#bfLimit',
      bfFilter: '#bfFilter',
      bfResults: '#bfResults',
      resetBtn: '#resetBtn',
      clearLogBtn: '#clearLogBtn',
      logBox: '#log',
      benchBtn: '#benchBtn',
      benchResult: '#benchResult',
      dumpStateBtn: '#dumpStateBtn'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('domcontentloaded');
    // ensure initial phase 'idle' is set by script
    await expect(this.page.locator(this.selectors.stateDisplay)).toHaveText(/idle/);
  }

  async getPhase() {
    return (await this.page.locator(this.selectors.stateDisplay).innerText()).trim();
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async fill(selector, value) {
    await this.page.fill(selector, value);
  }

  async selectAlgo(value) {
    await this.page.selectOption(this.selectors.algoSelect, value);
    // wait a microtask so DOM/handlers update
    await this.page.waitForTimeout(50);
  }

  async importKey(text) {
    await this.fill(this.selectors.keyInput, text);
    await this.click(this.selectors.importKeyBtn);
  }

  async generateRandomKey() {
    await this.click(this.selectors.genKeyBtn);
  }

  async encrypt() {
    await this.click(this.selectors.encryptBtn);
  }

  async decrypt() {
    await this.click(this.selectors.decryptBtn);
  }

  async tamperCiphertext() {
    await this.click(this.selectors.tamperBtn);
  }

  async showCiphertext() {
    await this.click(this.selectors.showCtBtn);
  }

  async startBruteForce() {
    await this.click(this.selectors.bfStart);
  }

  async stopBruteForce() {
    await this.click(this.selectors.bfStop);
  }

  async resetAll() {
    await this.click(this.selectors.resetBtn);
  }

  async clearLog() {
    await this.click(this.selectors.clearLogBtn);
  }

  async dumpState() {
    await this.click(this.selectors.dumpStateBtn);
  }
}

test.describe('Symmetric Cryptography Interactive Playground - FSM and UI tests', () => {
  // Collect console messages, page errors, and dialog messages for assertions
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console output and errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture dialogs (alert/confirm/prompt)
    page.on('dialog', async (dialog) => {
      // store message for later assertions
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      // Default handling: accept prompts with reasonable defaults, accept/close alerts and confirms
      try {
        if (dialog.type() === 'prompt') {
          // Some prompts ask for key size or show content; provide safe defaults
          // For generateRandomKey XOR prompt -> provide '8'
          // For exportKeyHex prompt -> just accept (dialog will show hex but also expects accept)
          await dialog.accept('8');
        } else {
          await dialog.accept();
        }
      } catch (e) {
        // ignore dialog handling errors; allow natural test behavior
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test verify that there were no unexpected console error messages or uncaught exceptions.
    // Tests below will also assert specific expected dialogs / phases.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // We assert there are no uncaught page errors. If some exist, we surface them for test failure diagnostics.
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    // Also expect no console errors/warnings to keep runs clean (but allow other console logs)
    expect(errorConsoleMsgs, 'No console error/warning messages expected').toEqual([]);
  });

  test.describe('Key Management and Import/Generate flows', () => {
    test('ImportKey transitions to keyImported and updates key info', async ({ page }) => {
      // Validate that importing a hex key sets phase to keyImported and keyInfo updates
      const app = new PlaygroundPage(page);
      await app.goto();

      // Import a small hex key
      await app.importKey('0x0102030405');

      // Expect phase updated
      await expect(page.locator(app.selectors.stateDisplay)).toHaveText('keyImported');

      // Expect keyInfo to indicate bytes and hex preview
      const keyInfo = await page.locator(app.selectors.keyInfo).innerText();
      expect(keyInfo).toContain('Key:');
      expect(keyInfo).toContain('Hex preview:');
    });

    test('GenerateKey transitions to keyGenerated (AES) without prompts', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Ensure algorithm is AES (default)
      await app.selectAlgo('AES');

      // Click generate key
      await app.generateRandomKey();

      // Expect phase set to keyGenerated
      await expect(page.locator(app.selectors.stateDisplay)).toHaveText('keyGenerated');

      // keyInfo should show loaded key bytes
      const keyInfo = await page.locator(app.selectors.keyInfo).innerText();
      expect(keyInfo).toMatch(/Key:\s*\d+\s*bytes/);
    });

    test('GenerateKey for XOR prompts and sets keyGenerated', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Switch to XOR algorithm to trigger prompt in generateRandomKey
      await app.selectAlgo('XOR');

      // Click generate key -> prompt handler will supply '8' from beforeEach
      await app.generateRandomKey();

      // Expect phase set to keyGenerated
      await expect(page.locator(app.selectors.stateDisplay)).toHaveText('keyGenerated');

      // keyInfo should now show key bytes
      const keyInfo = await page.locator(app.selectors.keyInfo).innerText();
      expect(keyInfo).toMatch(/Key:\s*\d+\s*bytes/);
    });

    test('Derive Key (PBKDF2) sets keyDerived phase', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Enter password and click derive
      await page.fill('#pwInput', 'testpassword');
      await page.fill('#saltInput', '0x01');
      // Click derive button
      await page.click('#deriveBtn');

      // Derived should set phase to keyDerived (async crypto)
      await expect(page.locator('#stateDisplay')).toHaveText('keyDerived');

      // keyInfo should indicate key loaded
      const keyInfo = await page.locator('#keyInfo').innerText();
      expect(keyInfo).toContain('Key:');
    });
  });

  test.describe('IV Controls and mutation', () => {
    test('Generate IV updates ivInfo and sets ivGenerated phase', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Click generate IV
      await page.click('#genIvBtn');

      // Expect ivInfo to contain IV: 0x...
      await expect(page.locator('#ivInfo')).toContainText('IV: 0x');

      // stateDisplay should reflect ivGenerated phase
      await expect(page.locator('#stateDisplay')).toHaveText('ivGenerated');
    });

    test('Mutate IV when none exists triggers alert, then after generation mutating flips bit', async ({ page }) {
      const app = new PlaygroundPage(page);
      await page.goto();

      // If no IV, clicking mutate shows an alert which our dialog handler accepts
      await page.click('#mutateIvBtn');
      // The dialog was accepted; confirm that no crash occurred and state did not change to ivMutated
      const phase1 = await page.locator('#stateDisplay').innerText();
      // phase remains idle as mutation was blocked by alert
      expect(phase1).toMatch(/idle|ivGenerated/);

      // Generate IV then mutate again
      await page.click('#genIvBtn');
      await page.click('#mutateIvBtn');

      // After mutating expect ivMutated phase
      await expect(page.locator('#stateDisplay')).toHaveText('ivMutated');
      // ivInfo updated
      const ivInfo = await page.locator('#ivInfo').innerText();
      expect(ivInfo).toContain('IV: 0x');
    });
  });

  test.describe('Encryption and Decryption flows (AES and XOR)', () => {
    test('AES encrypt -> encrypted, AES decrypt -> decrypted (Roundtrip)', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Ensure AES
      await app.selectAlgo('AES');

      // Generate AES key
      await app.generateRandomKey();
      await expect(page.locator('#stateDisplay')).toHaveText('keyGenerated');

      // Ensure plaintext default exists
      await page.fill('#plaintext', 'Hello world');

      // Make sure auto IV is on (default)
      // Perform encrypt
      await app.encrypt();

      // Expect encrypted phase and ciphertextArea has content
      await expect(page.locator('#stateDisplay')).toHaveText('encrypted');
      const ct = await page.locator('#ciphertext').inputValue();
      expect(ct.length).toBeGreaterThan(0);

      // Decrypt now, expecting decrypted and plaintext back
      await app.decrypt();
      await expect(page.locator('#stateDisplay')).toHaveText('decrypted');
      const decryptRes = await page.locator('#decryptResult').innerText();
      expect(decryptRes).toContain('Hello world');
    });

    test('Tamper ciphertext after encrypt causes decrypt to fail and set decryptFailed', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // AES path
      await app.selectAlgo('AES');

      // Generate key and encrypt
      await app.generateRandomKey();
      await app.encrypt();
      await expect(page.locator('#stateDisplay')).toHaveText('encrypted');

      // Tamper stored ciphertext via the tamper button
      await app.tamperCiphertext();

      // Tampering should set ciphertextTampered phase
      await expect(page.locator('#stateDisplay')).toHaveText('ciphertextTampered');

      // Now attempt decrypt - should fail and set decryptFailed
      await app.decrypt();

      // decryptOperation sets decryptFailed when catch occurs
      await expect(page.locator('#stateDisplay')).toHaveText('decryptFailed');

      // decryptResult should contain failure message
      const dr = await page.locator('#decryptResult').innerText();
      expect(dr.toLowerCase()).toContain('decryption failed');
    });

    test('XOR encrypt/decrypt roundtrip with imported key', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Switch to XOR and import a small key
      await app.selectAlgo('XOR');
      await app.importKey('0x0f');

      await expect(page.locator('#stateDisplay')).toHaveText('keyImported');

      // Put plaintext and choose encodings appropriate
      await page.fill('#plaintext', 'ABC');
      await page.selectOption('#plainEncoding', 'utf8');
      await page.selectOption('#ctEncoding', 'hex');

      // Encrypt using XOR
      await app.encrypt();
      await expect(page.locator('#stateDisplay')).toHaveText('encrypted');

      // Tamper then decrypt to get different result; first decrypt normally
      await app.decrypt();
      await expect(page.locator('#stateDisplay')).toHaveText('decrypted');
      const dr = await page.locator('#decryptResult').innerText();
      expect(dr).toContain('Decrypted (UTF-8):');

      // Tamper ciphertext then decrypt - tampering sets ciphertextTampered
      await app.tamperCiphertext();
      await expect(page.locator('#stateDisplay')).toHaveText('ciphertextTampered');

      await app.decrypt();
      // After decrypt, phase should be decrypted because XOR decryption doesn't throw
      await expect(page.locator('#stateDisplay')).toHaveText('decrypted');
    });
  });

  test.describe('Brute-force and related controls', () => {
    test('Start brute-force on XOR algorithm sets bruteforce_running and Stop sets bruteforce_aborted', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Set algorithm to XOR and import a trivial key to allow quick BF demo
      await app.selectAlgo('XOR');
      await app.importKey('0x01'); // small key

      // Ensure there is ciphertext to target: encrypt something
      await page.fill('#plaintext', 'AAAA'); // simple pattern
      await page.selectOption('#ctEncoding', 'hex');
      await app.encrypt();
      await expect(page.locator('#stateDisplay')).toHaveText('encrypted');

      // Ensure bfInput has ciphertext
      const ctVal = await page.locator('#ciphertext').inputValue();
      await page.fill('#bfInput', ctVal);

      // Reduce bfLimit for speed
      await page.fill('#bfLimit', '100');

      // Start brute-force; because algorithm is XOR no confirm expected
      await app.startBruteForce();

      // Wait briefly and assert phase moved to bruteforce_running
      await expect(page.locator('#stateDisplay')).toHaveText('bruteforce_running');

      // Immediately click stop
      await app.stopBruteForce();

      // The handler for bfStop sets 'bruteforce_aborted'
      await expect(page.locator('#stateDisplay')).toHaveText('bruteforce_aborted');
    });
  });

  test.describe('Utility buttons and edge cases', () => {
    test('ShowStoredCiphertext without ciphertext shows alert', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Ensure no stored ciphertext
      await page.fill('#ciphertext', '');
      // Click show stored ciphertext - should trigger alert 'No stored ciphertext'
      await app.showCiphertext();

      // Expect dialog captured with that message
      const found = dialogMessages.find(d => d.message.includes('No stored ciphertext'));
      expect(found, 'Expected "No stored ciphertext" alert to be shown').toBeTruthy();
    });

    test('DownloadCiphertext without ciphertext triggers alert', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Ensure no stored ciphertext
      await page.fill('#ciphertext', '');
      // Click download -> should alert 'Nothing to download'
      await app.click('#downloadBtn');

      const found = dialogMessages.find(d => d.message.includes('Nothing to download'));
      expect(found, 'Expected "Nothing to download" alert to be shown').toBeTruthy();
    });

    test('ResetAll confirms and resets state to idle', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Import a key to change state
      await app.importKey('0x010203');

      await expect(page.locator('#stateDisplay')).toHaveText('keyImported');

      // Click reset - confirm dialog will be accepted by dialog handler
      await app.resetAll();

      // Expect phase reset to idle and keyInfo to show No key loaded
      await expect(page.locator('#stateDisplay')).toHaveText('idle');
      const keyInfo = await page.locator('#keyInfo').innerText();
      expect(keyInfo).toContain('No key loaded');
    });

    test('Clear log empties logBox', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Trigger some logs
      await app.generateRandomKey();
      await app.dumpState();

      // Ensure log contains content
      const before = await page.locator('#log').innerText();
      expect(before.length).toBeGreaterThan(0);

      // Click clear log
      await app.clearLog();

      // logBox should be empty
      const after = await page.locator('#log').innerText();
      expect(after).toBe('');
    });

    test('Benchmark requires a key; without key shows alert', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Ensure no key loaded by resetting state
      // Accept reset confirm
      await app.resetAll();

      // Click benchmark -> alert 'Load or generate a key first'
      await app.click('#benchBtn');

      // Dialog should have been captured
      const found = dialogMessages.find(d => d.message.includes('Load or generate a key first'));
      expect(found, 'Expected benchmark to require a key and show alert').toBeTruthy();
    });
  });

  test.describe('State dump and logging introspection', () => {
    test('Dump internal state shows JSON alert and does not throw', async ({ page }) => {
      const app = new PlaygroundPage(page);
      await app.goto();

      // Generate a key to have meaningful dump
      await app.generateRandomKey();

      // Click dump state -> alert with JSON will be shown (dialog handler accepts)
      await app.dumpState();

      // Ensure a dialog with JSON-like content was shown
      const jsonDialog = dialogMessages.find(d => {
        return d.type === 'alert' && d.message.trim().startsWith('{');
      });
      expect(jsonDialog, 'Expected dumpState to show JSON alert').toBeTruthy();
    });
  });
});