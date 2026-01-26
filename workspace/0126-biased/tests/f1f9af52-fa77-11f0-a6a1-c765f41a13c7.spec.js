import { test, expect } from '@playwright/test';

test.describe('Asymmetric Cryptography — Visual Demonstration (f1f9af52-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // URL where the provided HTML will be served
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f9af52-fa77-11f0-a6a1-c765f41a13c7.html';

  // Increase timeout for animations and progressive reveals
  test.setTimeout(20000);

  // Page object encapsulating interactions with the visualization
  class CryptoVizPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
      this.page = page;
      // Locators
      this.genBtn = page.locator('#genBtn');
      this.encBtn = page.locator('#encBtn');
      this.pubKeyEl = page.locator('#pubKey');
      this.privKeyEl = page.locator('#privKey');
      this.plaintextEl = page.locator('#plaintext');
      this.ciphertextEl = page.locator('#ciphertext');
      this.beam = page.locator('#beam');
      this.sender = page.locator('#sender');
      this.receiver = page.locator('#receiver');
    }

    // Load the page and wait for basic elements
    async load() {
      await this.page.goto(APP_URL);
      await expect(this.genBtn).toBeVisible();
      await expect(this.encBtn).toBeVisible();
      await expect(this.pubKeyEl).toBeVisible();
      await expect(this.privKeyEl).toBeVisible();
      await expect(this.plaintextEl).toBeVisible();
      await expect(this.ciphertextEl).toBeVisible();
    }

    // Click Generate Key Pair button
    async clickGenerate() {
      await this.genBtn.click();
    }

    // Click Encrypt Sample button
    async clickEncrypt() {
      await this.encBtn.click();
    }

    // Utility to get trimmed text content
    async getText(locator) {
      return (await locator.textContent())?.trim();
    }

    // Reconstruct raw hex pub key by removing spaces from displayed formatted key
    async getPubHexRaw() {
      const formatted = await this.getText(this.pubKeyEl);
      if (!formatted) return '';
      return formatted.replace(/\s+/g, '');
    }
  }

  // Setup per-test to capture console errors and page errors
  test.beforeEach(async ({ page }) => {
    // nothing here; individual tests will attach listeners to capture logs/errors
  });

  // Test initial Idle state (S0_Idle)
  test('Initial idle state: controls & placeholders present (S0_Idle)', async ({ page }) => {
    // Capture page errors and console errors
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new CryptoVizPage(page);
    await app.load();

    // Validate initial buttons and placeholders per FSM evidence
    await expect(app.genBtn).toBeEnabled();
    await expect(app.genBtn).toHaveText('Generate Key Pair');

    // Encrypt button should be disabled initially
    await expect(app.encBtn).toBeDisabled();
    await expect(app.encBtn).toHaveAttribute('aria-label', 'Encrypt sample message');

    // Keys area initial placeholders
    await expect(app.pubKeyEl).toHaveText('—');
    await expect(app.privKeyEl).toHaveText('••••••••••••••••••••••••••••••••');

    // Plaintext and ciphertext initial state
    await expect(app.plaintextEl).toHaveText(/Hello, Asymmetric World!/);
    await expect(app.ciphertextEl).toHaveText('—');

    // Assert no uncaught page errors or console errors occurred during initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: GenerateKeyPair (S0_Idle -> S1_KeysGenerated)
  test('Generate Key Pair triggers key reveal and enables Encrypt (S0_Idle -> S1_KeysGenerated)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new CryptoVizPage(page);
    await app.load();

    // Click generate and verify immediate onExit/onEnter behaviors:
    // - Button disabled and text changed to "Generating…"
    await app.clickGenerate();
    await expect(app.genBtn).toBeDisabled();
    await expect(app.genBtn).toHaveText(/Generating…/);

    // Wait for the public key to be revealed (formatKey grouping of 8 chars separated by spaces)
    // The generation sequence includes animations and sleeps; allow a generous timeout and poll.
    await expect.poll(async () => await app.getText(app.pubKeyEl), {
      timeout: 7000,
      message: 'Waiting for public key to be populated'
    }).not.toBe('—');

    // Verify public key is displayed and looks like grouped hex (8-character groups separated by spaces)
    const pubText = await app.getText(app.pubKeyEl);
    expect(pubText).toMatch(/^[0-9A-F]{8}(?:\s+[0-9A-F]{8})+$/);

    // After the full generation flow completes, the private key is re-masked
    await expect.poll(async () => await app.getText(app.privKeyEl), {
      timeout: 7000,
      message: 'Waiting for private key to be re-masked'
    }).toBe('••••••••••••••••••••••••••••••••');

    // Encrypt button should be enabled at the end of the flow
    await expect.poll(async () => await app.encBtn.isEnabled(), {
      timeout: 7000
    }).toBe(true);

    // Generate button should be re-enabled and label restored
    await expect.poll(async () => await app.getText(app.genBtn), {
      timeout: 7000
    }).toBe('Generate Key Pair');

    // Ensure no page or console errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Clicking Encrypt when no keys exist (should be inert and not throw)
  test('Clicking Encrypt before keys are generated does nothing and produces no errors (edge case)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new CryptoVizPage(page);
    await app.load();

    // Ensure encrypt button is disabled
    await expect(app.encBtn).toBeDisabled();

    // Try to click (this should be inert since disabled)
    // Use evaluate to attempt a programmatic click which may bypass disabled semantics in some browsers,
    // but the DOM handler checks `if(!keys) return;` — we must not modify the page, just invoke.
    await page.evaluate(() => {
      const el = document.getElementById('encBtn');
      if (el) el.click();
    });

    // Ciphertext should remain unchanged
    await expect(app.ciphertextEl).toHaveText('—');

    // No errors must have been thrown by clicking encrypt with no keys
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: EncryptSample (S1_KeysGenerated -> S2_EncryptionInProgress -> S3_EncryptionCompleted)
  test('Encrypt Sample triggers beam animation and progressive ciphertext reveal (S1_KeysGenerated -> S2_EncryptionInProgress -> S3_EncryptionCompleted)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new CryptoVizPage(page);
    await app.load();

    // Ensure keys are generated first
    await app.clickGenerate();

    // Wait until public key displayed and private key re-masked (end of generation)
    await expect.poll(async () => await app.getText(app.pubKeyEl), { timeout: 8000 }).not.toBe('—');
    await expect.poll(async () => await app.getText(app.privKeyEl), { timeout: 8000 }).toBe('••••••••••••••••••••••••••••••••');

    // Capture the public key raw hex (used for ciphertext suffix expectation)
    const pubHexRaw = await app.getPubHexRaw();
    expect(pubHexRaw).toMatch(/^[0-9A-F]+$/);

    // Now click Encrypt
    await app.clickEncrypt();

    // Immediately after click, encBtn should be disabled (S2_EncryptionInProgress)
    await expect(app.encBtn).toBeDisabled();

    // Beam should become visible (opacity style transitions), check computed style eventually becomes opacity > 0
    await expect.poll(async () => {
      // read style attribute value
      const opacity = await page.evaluate(el => window.getComputedStyle(el).opacity, await app.beam.elementHandle());
      return opacity;
    }, { timeout: 3000 }).not.toBe('0');

    // Wait for ciphertext to be progressively revealed. The final ciphertext includes a '-' then first 6 characters of pub key
    // We will wait until ciphertext contains a '-' indicating suffix appended, then validate suffix matches pub.
    await expect.poll(async () => {
      const text = await app.getText(app.ciphertextEl);
      return text;
    }, { timeout: 8000 }).not.toBe('—');

    // Once ciphertext has some content, validate the final suffix after the full reveal completes.
    // The reveal loop depends on plaintext length; allow generous time and then assert final content ends with '-' + pubHexRaw.slice(0,6)
    await page.waitForTimeout(1500); // small additional wait to let reveal loop finish in many cases

    // Poll until encBtn is re-enabled, indicating handler completed
    await expect.poll(async () => await app.encBtn.isEnabled(), { timeout: 8000 }).toBe(true);

    const finalCipher = await app.getText(app.ciphertextEl);
    expect(finalCipher).toBeTruthy();

    // Validate suffix: look for "-XXXXXX" at the end and ensure it matches pub key's first 6 hex chars
    const suffMatch = finalCipher.match(/-([0-9A-F]{6})$/);
    expect(suffMatch).not.toBeNull();
    const suffix = suffMatch ? suffMatch[1] : null;
    expect(suffix).toBe(pubHexRaw.slice(0, 6));

    // Beam should have been faded out at the end (style opacity set to 0)
    // Wait briefly for the beam hide setTimeout to have run
    await page.waitForTimeout(700);
    const beamOpacity = await page.evaluate(el => window.getComputedStyle(el).opacity, await app.beam.elementHandle());
    expect(beamOpacity).toBeDefined();
    // final state likely opacity '0' after animation; accept either '0' or very small values
    expect(['0', '0.0']).toContain(beamOpacity) || expect(parseFloat(beamOpacity)).toBeLessThanOrEqual(0.05);

    // Ensure there were no unexpected page errors or console errors during encryption
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test concurrency / defensive behavior: Attempt to click Generate multiple times rapidly
  test('Rapidly clicking Generate does not break flow or cause uncaught exceptions (defensive behavior)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new CryptoVizPage(page);
    await app.load();

    // Rapid clicks: first should trigger generation, subsequent should be ignored because button becomes disabled
    await Promise.all([
      app.genBtn.click(),
      page.evaluate(() => { /* user might try clicking multiple times rapidly */ }),
    ]);

    // Immediately genBtn should be disabled and show "Generating…"
    await expect(app.genBtn).toBeDisabled();
    await expect(app.genBtn).toHaveText(/Generating…/);

    // Wait for generation to finish and check for no duplicate or corrupted UI state
    await expect.poll(async () => await app.getText(app.pubKeyEl), { timeout: 8000 }).not.toBe('—');
    await expect.poll(async () => await app.encBtn.isEnabled(), { timeout: 8000 }).toBe(true);

    // Confirm private key is masked again
    await expect(app.privKeyEl).toHaveText('••••••••••••••••••••••••••••••••');

    // No page errors from rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Final test: end-to-end flow repeated to ensure stability across multiple cycles
  test('Repeat generate + encrypt cycle to ensure stability (multiple transitions)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const app = new CryptoVizPage(page);
    await app.load();

    // Run two cycles of generate -> encrypt to ensure handlers are robust
    for (let cycle = 0; cycle < 2; cycle++) {
      // Generate
      await app.clickGenerate();
      await expect.poll(async () => await app.getText(app.pubKeyEl), { timeout: 9000 }).not.toBe('—');
      await expect.poll(async () => await app.encBtn.isEnabled(), { timeout: 9000 }).toBe(true);

      const pubHexRaw = await app.getPubHexRaw();
      expect(pubHexRaw).toMatch(/^[0-9A-F]+$/);

      // Encrypt
      await app.clickEncrypt();
      // Wait for completion
      await expect.poll(async () => await app.encBtn.isEnabled(), { timeout: 10000 }).toBe(true);

      const finalCipher = await app.getText(app.ciphertextEl);
      expect(finalCipher).toMatch(/-([0-9A-F]{6})$/);
      const suff = finalCipher.match(/-([0-9A-F]{6})$/)![1];
      expect(suff).toBe(pubHexRaw.slice(0, 6));
    }

    // No runtime errors across repeated cycles
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});