import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b55633-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object encapsulating interactions with the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  plaintextSelector() {
    return '#plaintext';
  }

  shiftSelector() {
    return '#shift';
  }

  encryptButtonSelector() {
    return "button[onclick='caesarEncrypt()']";
  }

  ciphertextSelector() {
    return '#ciphertext';
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getPlaintextValue() {
    return this.page.locator(this.plaintextSelector()).inputValue();
  }

  async setPlaintext(value) {
    await this.page.fill(this.plaintextSelector(), value);
  }

  async getShiftValue() {
    // inputValue returns string for number inputs too
    return this.page.locator(this.shiftSelector()).inputValue();
  }

  async setShiftValue(value) {
    await this.page.fill(this.shiftSelector(), String(value));
  }

  async clickEncrypt() {
    await this.page.click(this.encryptButtonSelector());
  }

  async getCiphertextInnerHTML() {
    return this.page.locator(this.ciphertextSelector()).innerHTML();
  }

  async getCiphertextText() {
    return this.page.locator(this.ciphertextSelector()).innerText();
  }

  async isEncryptButtonVisible() {
    return this.page.locator(this.encryptButtonSelector()).isVisible();
  }

  async isCiphertextEmpty() {
    const text = await this.getCiphertextText();
    return text.trim().length === 0;
  }
}

test.describe('Comprehensive Guide to Encryption - Caesar demo (FSM validation)', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Set up console and pageerror listeners before each test and navigate to the page.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
      };
      consoleMessages.push(entry);
      if (msg.type() === 'error') {
        consoleErrors.push(entry);
      }
    });

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page
      pageErrors.push(String(err));
    });

    // Navigate to the demo page (load as-is)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No special teardown required; listeners are tied to the page and cleared by Playwright
  });

  test.describe('State S0_Idle (initial render) validations', () => {
    test('UI elements are present with expected defaults (Idle state)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Validate presence of plaintext input and its default value per FSM/component
      const plaintextValue = await demo.getPlaintextValue();
      expect(plaintextValue).toBe('HELLO');

      // Validate presence of shift input and its default value per FSM/component
      const shiftValue = await demo.getShiftValue();
      expect(shiftValue).toBe('3');

      // Validate presence of Encrypt button
      const buttonVisible = await demo.isEncryptButtonVisible();
      expect(buttonVisible).toBe(true);

      // Validate ciphertext output area exists and is initially empty
      const ciphertextEmpty = await demo.isCiphertextEmpty();
      expect(ciphertextEmpty).toBe(true);

      // Observe console and page errors that may have occurred during initial render.
      // We assert that there are no uncaught page errors and no console errors.
      // This captures whether unexpected runtime errors (ReferenceError, SyntaxError, TypeError) happened.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('FSM entry action renderPage() is not causing an error (renderPage not invoked)', async ({ page }) => {
      // The FSM mentioned an entry action renderPage(), but the HTML does not call it.
      // We assert that the page did not throw a ReferenceError related to renderPage being undefined.
      // (If renderPage had been called accidentally, it would typically produce a ReferenceError).
      const foundRenderPageRefError = pageErrors.some(err => String(err).includes('renderPage')) ||
        consoleMessages.some(entry => entry.text.includes('renderPage'));
      expect(foundRenderPageRefError).toBe(false);
    });
  });

  test.describe('Transition CaesarEncrypt (S0_Idle -> S1_Encrypted)', () => {
    test('Clicking Encrypt with defaults produces expected ciphertext (HELLO, shift 3 -> KHOOR)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Ensure initial state is as expected
      expect(await demo.getPlaintextValue()).toBe('HELLO');
      expect(await demo.getShiftValue()).toBe('3');

      // Trigger the transition by clicking the Encrypt button
      await demo.clickEncrypt();

      // After the transition we expect the ciphertext output area to include the plaintext, shift and ciphertext
      const html = await demo.getCiphertextInnerHTML();

      // The implementation writes three <p> lines including the computed ciphertext KHOOR
      expect(html).toContain('<p><strong>Plaintext:</strong> HELLO</p>');
      expect(html).toContain('<p><strong>Shift value:</strong> 3</p>');
      expect(html).toContain('<p><strong>Ciphertext:</strong> KHOOR</p>');

      // Also verify the visible text contains KHOOR
      const visibleText = await demo.getCiphertextText();
      expect(visibleText).toMatch(/Ciphertext:\s*KHOOR/);

      // Assert that clicking the button did not cause any uncaught runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Wrap-around behavior: XYZ with shift 3 -> ABC', async ({ page }) => {
      const demo = new DemoPage(page);

      await demo.setPlaintext('XYZ');
      await demo.setShiftValue('3');
      await demo.clickEncrypt();

      const visibleText = await demo.getCiphertextText();
      expect(visibleText).toMatch(/Plaintext:\s*XYZ/);
      expect(visibleText).toMatch(/Shift value:\s*3/);
      expect(visibleText).toMatch(/Ciphertext:\s*ABC/);

      expect(pageErrors.length).toBe(0);
    });

    test('Non-alphabetic characters are preserved', async ({ page }) => {
      const demo = new DemoPage(page);

      await demo.setPlaintext('HELLO 123!');
      await demo.setShiftValue('5');
      await demo.clickEncrypt();

      const visibleText = await demo.getCiphertextText();
      // Letters shifted: HELLO -> MJQQT ; digits and punctuation preserved
      expect(visibleText).toMatch(/Plaintext:\s*HELLO 123!/);
      expect(visibleText).toMatch(/Shift value:\s*5/);
      expect(visibleText).toMatch(/Ciphertext:\s*MJQQT 123!/);

      expect(pageErrors.length).toBe(0);
    });

    test('Shift value 26 behaves as identity (mod 26) even if outside declared max', async ({ page }) => {
      const demo = new DemoPage(page);

      // The input has max=25 in HTML, but filling the input can still set 26.
      await demo.setPlaintext('ABCDEF');
      await demo.setShiftValue('26'); // 26 % 26 -> 0, so ciphertext should equal plaintext (uppercase)
      await demo.clickEncrypt();

      const visibleText = await demo.getCiphertextText();
      expect(visibleText).toMatch(/Ciphertext:\s*ABCDEF/);

      // No runtime errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Empty plaintext results in empty ciphertext area content for ciphertext string', async ({ page }) => {
      const demo = new DemoPage(page);

      await demo.setPlaintext('');
      await demo.setShiftValue('5');
      await demo.clickEncrypt();

      const visibleText = await demo.getCiphertextText();

      // The page will still render the three <p> tags; plaintext and ciphertext parts should be empty strings
      expect(visibleText).toMatch(/Plaintext:\s*/);
      expect(visibleText).toMatch(/Shift value:\s*5/);
      // Ciphertext should be empty (no letters)
      expect(visibleText).toMatch(/Ciphertext:\s*$/m);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Robustness and error observation', () => {
    test('No uncaught ReferenceError, SyntaxError, or TypeError occurred during interactions', async ({ page }) => {
      // This test explicitly inspects collected page errors and console errors for typical JS error types.
      // If the page had a ReferenceError/SyntaxError/TypeError it would be captured via page.on('pageerror') or console.
      const errorMsgs = [...pageErrors];

      // Also inspect console error messages for typical error type keywords
      for (const msg of consoleMessages) {
        if (msg.type === 'error') errorMsgs.push(msg.text);
      }

      // Collect any errors that mention common JS error classes
      const foundJSExceptions = errorMsgs.filter(text =>
        String(text).includes('ReferenceError') ||
        String(text).includes('SyntaxError') ||
        String(text).includes('TypeError')
      );

      // The expectation for this implementation: no such uncaught JS exceptions.
      // We assert that none occurred; if any do occur, this assertion will fail and surface those errors.
      expect(foundJSExceptions.length).toBe(0);
    });

    test('Capture and log any console messages for debugging (no assertions except capturing)', async ({ page }) => {
      // This test demonstrates that we observed console messages; it asserts their structure but does not require specific content.
      // It ensures that our listeners are correctly capturing console output.
      // We assert that consoleMessages is an array and contains objects with type and text.
      expect(Array.isArray(consoleMessages)).toBe(true);
      for (const entry of consoleMessages) {
        expect(entry).toHaveProperty('type');
        expect(entry).toHaveProperty('text');
      }
    });
  });
});