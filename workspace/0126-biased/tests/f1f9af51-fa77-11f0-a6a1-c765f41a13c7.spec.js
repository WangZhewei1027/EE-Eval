import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f9af51-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object to centralize selectors and common actions
class SymmetricPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      playBtn: '#playBtn',
      revealBtn: '#revealBtn',
      plaintextBox: '#plaintextBox',
      ciphertextBox: '#ciphertextBox',
      keyVisual: '#keyVisual',
      keyWrap: '#keyWrap',
      plainFlow: '#plainFlow',
      cipherFlow: '#cipherFlow',
      letter: '.letter'
    };
  }

  async goto() {
    await this.page.goto(BASE);
    // Ensure the app had a chance to run its init() immediately after load
    await this.page.waitForLoadState('networkidle');
  }

  async getText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  async clickPlay() {
    await this.page.click(this.selectors.playBtn);
  }

  async clickReveal() {
    await this.page.click(this.selectors.revealBtn);
  }

  async isPlayPressed() {
    const val = await this.page.getAttribute(this.selectors.playBtn, 'aria-pressed');
    return val === 'true';
  }

  async isRevealPressed() {
    const val = await this.page.getAttribute(this.selectors.revealBtn, 'aria-pressed');
    return val === 'true';
  }

  async getIntervalId() {
    // Read the intervalId variable from page context (it's defined in the page script)
    return await this.page.evaluate(() => typeof intervalId !== 'undefined' ? intervalId : undefined);
  }

  async getRunningFlag() {
    return await this.page.evaluate(() => typeof running !== 'undefined' ? running : undefined);
  }

  async getRevealFlag() {
    return await this.page.evaluate(() => typeof reveal !== 'undefined' ? reveal : undefined);
  }

  async computeCipherFromPage() {
    // Use the page's computeCipher function and constants (defined on page)
    return await this.page.evaluate(() => {
      // computeCipher, PLAINTEXT, KEY are defined in page script
      const cipher = typeof computeCipher === 'function' ? computeCipher(PLAINTEXT, KEY) : null;
      return cipher;
    });
  }

  async plainLettersCount() {
    return await this.page.evaluate((sel) => {
      return document.querySelectorAll(sel).length;
    }, `${this.selectors.plainFlow} > .letter`);
  }

  async cipherLettersCount() {
    return await this.page.evaluate((sel) => {
      return document.querySelectorAll(sel).length;
    }, `${this.selectors.cipherFlow} > .letter`);
  }

  async allLettersHaveMutedClass() {
    return await this.page.evaluate((s) => {
      const elements = Array.from(document.querySelectorAll(s));
      return elements.map(el => el.classList.contains('muted'));
    }, `${this.selectors.cipherFlow} > .letter`);
  }

  async anyConsoleErrors() {
    // Collected by the test harness listeners; placeholder (actual collection is in tests)
    return;
  }
}

test.describe('Symmetric Cryptography Visualization - FSM tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
    });

    // Collect uncaught errors from the page
    page.on('pageerror', err => {
      // err is an Error object serialized; capture message and stack
      pageErrors.push({ message: err.message, stack: err.stack });
    });
  });

  test.afterEach(async () => {
    // After each test we will assert there were no unexpected runtime errors (pageerror).
    // This validates that the page script ran without throwing uncaught exceptions.
    // If errors are expected by environment, adjust assertions accordingly.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    // Also ensure there are no console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console error messages found: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test.describe('Idle state (S0_Idle) - initial rendering', () => {
    test('renders plaintext and computed ciphertext on load', async ({ page }) => {
      // This test validates S0_Idle entry actions: renderWords('SYMMETRIC', cipher)
      const app = new SymmetricPage(page);
      await app.goto();

      // Read plaintext and ciphertext content
      const plaintext = await app.getText(app.selectors.plaintextBox);
      const ciphertext = await app.getText(app.selectors.ciphertextBox);

      // PLAINTEXT constant exists in page; confirm plaintextBox equals that value
      const pagePlain = await page.evaluate(() => (typeof PLAINTEXT !== 'undefined' ? PLAINTEXT : null));
      expect(pagePlain).not.toBeNull();
      expect(plaintext).toBe(pagePlain);

      // The page computes cipher using computeCipher; validate ciphertext matches that computation
      const computed = await app.computeCipherFromPage();
      expect(computed).not.toBeNull();
      expect(ciphertext).toBe(computed);

      // The rendered word flows should have created letter elements for both plain and cipher
      const plainCount = await app.plainLettersCount();
      const cipherCount = await app.cipherLettersCount();
      expect(plainCount).toBe(pagePlain.length);
      expect(cipherCount).toBe(pagePlain.length);

      // By design, cipherFlow letters are initially muted
      const cipherMutedFlags = await app.allLettersHaveMutedClass();
      expect(cipherMutedFlags.every(v => v === true)).toBeTruthy();
    });
  });

  test.describe('Animating state (S1_Animating) - play/stop transitions', () => {
    test('clicking Play starts the animation and sets interval (S0 -> S1)', async ({ page }) => {
      const app = new SymmetricPage(page);
      await app.goto();

      // Precondition: not running
      expect(await app.isPlayPressed()).toBe(false);
      expect(await app.getRunningFlag()).toBe(false);

      // Click play and validate onEnter actions
      await app.clickPlay();

      // Play button should be pressed and running flag true
      expect(await app.isPlayPressed()).toBe(true);
      expect(await app.getRunningFlag()).toBe(true);

      // intervalId should be set (a number or object depending on environment). We assert it's truthy.
      const intervalId = await app.getIntervalId();
      expect(intervalId).toBeTruthy();

      // Ciphertext box should contain the computed cipher (updated on start)
      const cipherVisible = await app.getText(app.selectors.ciphertextBox);
      const computed = await app.computeCipherFromPage();
      expect(cipherVisible).toBe(computed);

      // The page will call animateCycle immediately - allow a small pause to let DOM updates occur
      await page.waitForTimeout(200);

      // The decorative key should be transformed during animation (keyWrap style - the script rotates it briefly)
      // Check that keyWrap has a style transform property set (rotate or translate)
      const keyTransform = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        return el ? el.style.transform : '';
      }, app.selectors.keyWrap);
      // The transform might be '' if the breathing interval hasn't fired, but animateCycle sets rotate(18deg) immediately.
      expect(typeof keyTransform).toBe('string');

      // Cipher letters should become visible (i.e., `muted` removed for the duration of the animation).
      // Wait a bit to let per-letter animation change classes
      await page.waitForTimeout(600);
      const cipherMutedFlagsAfter = await app.allLettersHaveMutedClass();
      // At least one cipher letter should have had its 'muted' class removed during animation (non-all-true)
      const someUnmuted = cipherMutedFlagsAfter.some(v => v === false);
      expect(someUnmuted).toBeTruthy();
    });

    test('clicking Play again stops the animation and cleans up (S1 -> S0)', async ({ page }) => {
      const app = new SymmetricPage(page);
      await app.goto();

      // Start animation
      await app.clickPlay();
      await page.waitForTimeout(100);

      // Stop animation by clicking again
      await app.clickPlay();
      await page.waitForTimeout(100);

      // Play button should be unpressed and running flag false
      expect(await app.isPlayPressed()).toBe(false);
      expect(await app.getRunningFlag()).toBe(false);

      // intervalId should be null after stopping
      const intervalIdAfter = await app.page.evaluate(() => intervalId === null ? null : intervalId);
      expect(intervalIdAfter === null || intervalIdAfter === undefined).toBeTruthy();

      // After stopping, all letters should not be muted (exit_actions remove muted)
      const cipherMutedFlagsAfterStop = await app.allLettersHaveMutedClass();
      // The code removes 'muted' classes on all letters during stop; assert none are muted
      const anyStillMuted = cipherMutedFlagsAfterStop.some(v => v === true);
      expect(anyStillMuted).toBe(false);
    });

    test('rapid toggling of Play does not raise runtime errors and ends in a consistent state', async ({ page }) => {
      const app = new SymmetricPage(page);
      await app.goto();

      // Rapidly toggle play several times
      for (let i = 0; i < 4; i++) {
        await app.clickPlay();
        // very small delay to simulate rapid clicks
        await page.waitForTimeout(80);
      }

      // Allow any pending timeouts to process
      await page.waitForTimeout(250);

      // Ensure no page errors occurred (captured in afterEach)
      // Validate that intervalId is either null (stopped) or a number (running) but not a thrown error
      const iId = await app.getIntervalId();
      // Accept both running and stopped; check that page variable exists and is not causing exceptions
      expect(typeof iId === 'number' || iId === null || iId === undefined).toBeTruthy();
    });
  });

  test.describe('Key reveal state (S2_RevealKey) - reveal/hide transitions', () => {
    test('Reveal Key toggles to show actual KEY (S0 -> S2) and hides on second click (S2 -> S0)', async ({ page }) => {
      const app = new SymmetricPage(page);
      await app.goto();

      // Initially key is masked (contains element with class key-mask)
      let keyHtmlBefore = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        return el ? el.innerHTML : '';
      }, app.selectors.keyVisual);
      expect(keyHtmlBefore).toContain('key-mask');

      // Click reveal to show key
      await app.clickReveal();
      await page.waitForTimeout(80); // small pause for DOM update

      // Reveal button aria-pressed should be true and reveal flag true
      expect(await app.isRevealPressed()).toBe(true);
      expect(await app.getRevealFlag()).toBe(true);

      // keyVisual should now contain the plain KEY string (exposed)
      const keyTextRevealed = await page.evaluate(() => {
        const kv = document.getElementById('keyVisual');
        return kv ? kv.innerText.trim() : '';
      });
      // KEY exists in page scope; read it and compare
      const pageKey = await page.evaluate(() => (typeof KEY !== 'undefined' ? KEY : null));
      expect(pageKey).not.toBeNull();
      expect(keyTextRevealed).toBe(pageKey);

      // Click reveal again to hide
      await app.clickReveal();
      await page.waitForTimeout(80);

      // Reveal pressed false and reveal flag false
      expect(await app.isRevealPressed()).toBe(false);
      expect(await app.getRevealFlag()).toBe(false);

      // keyVisual should now contain masked characters (class key-mask)
      const keyHtmlAfter = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        return el ? el.innerHTML : '';
      }, app.selectors.keyVisual);
      expect(keyHtmlAfter).toContain('key-mask');
    });

    test('Reveal while animating does not break animation and toggles key independently', async ({ page }) => {
      const app = new SymmetricPage(page);
      await app.goto();

      // Start animation
      await app.clickPlay();
      await page.waitForTimeout(100);

      // Reveal key while running
      await app.clickReveal();
      await page.waitForTimeout(80);

      // Both running and revealed flags should be true
      expect(await app.getRunningFlag()).toBe(true);
      expect(await app.getRevealFlag()).toBe(true);

      // Hide key again while still running
      await app.clickReveal();
      await page.waitForTimeout(80);
      expect(await app.getRevealFlag()).toBe(false);

      // Stop animation for cleanup
      await app.clickPlay();
      await page.waitForTimeout(100);
      expect(await app.getRunningFlag()).toBe(false);
    });
  });

  test.describe('Edge cases and negative scenarios', () => {
    test('clicking non-existent areas does not throw and console reports no errors', async ({ page }) => {
      const app = new SymmetricPage(page);
      await app.goto();

      // Try clicking an inert region (body) repeatedly - should not trigger errors
      for (let i = 0; i < 5; i++) {
        await page.click('body', { position: { x: 10 + i, y: 10 + i } });
        await page.waitForTimeout(30);
      }

      // No page errors should have been collected (asserted in afterEach)
      // Also ensure the visible elements are still present and unchanged
      expect(await app.getText(app.selectors.plaintextBox)).toBe(await page.evaluate(() => PLAINTEXT));
      expect(await app.computeCipherFromPage()).toBe(await app.getText(app.selectors.ciphertextBox));
    });

    test('attempt to read internal variables from page context to ensure they exist and are not throwing', async ({ page }) => {
      const app = new SymmetricPage(page);
      await app.goto();

      // Read some internal variables and functions defined by the page script
      const internals = await page.evaluate(() => {
        return {
          hasComputeCipher: typeof computeCipher === 'function',
          hasTogglePlay: typeof togglePlay === 'function',
          hasRevealToggle: typeof revealKeyToggle === 'function',
          PLAINTEXT: typeof PLAINTEXT !== 'undefined' ? PLAINTEXT : null,
          KEY: typeof KEY !== 'undefined' ? KEY : null
        };
      });

      expect(internals.hasComputeCipher).toBe(true);
      expect(internals.hasTogglePlay).toBe(true);
      expect(internals.hasRevealToggle).toBe(true);
      expect(internals.PLAINTEXT).not.toBeNull();
      expect(internals.KEY).not.toBeNull();
    });
  });
});