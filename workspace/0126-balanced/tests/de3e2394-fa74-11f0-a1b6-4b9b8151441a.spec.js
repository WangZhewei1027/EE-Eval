import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3e2394-fa74-11f0-a1b6-4b9b8151441a.html';

// Helper to compute a Caesar cipher expected result in the test (purely local, does not modify page)
function caesarCipher(input, shift) {
  const s = ((shift % 26) + 26) % 26;
  return Array.from(input).map((ch) => {
    const code = ch.charCodeAt(0);
    // A-Z
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + s) % 26) + 65);
    }
    // a-z
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + s) % 26) + 97);
    }
    // non-letter characters unchanged
    return ch;
  }).join('');
}

// Page object for the Caesar Cipher page
class CaesarPage {
  constructor(page) {
    this.page = page;
    this.textarea = page.locator('textarea');
    this.shiftInput = page.locator('input[type="number"]');
    this.button = page.locator('button');
    // common candidate selectors for an output element (implementation may vary)
    this.outputSelectors = [
      '#result',
      '.result',
      '#output',
      '.output',
      'pre',
      'code',
      'p.result',
      'div.result'
    ];
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isLoaded() {
    // basic evidence of S0_Idle: title and presence of components
    const title = await this.page.title();
    const textareaVisible = await this.textarea.count() > 0;
    const shiftVisible = await this.shiftInput.count() > 0;
    const buttonVisible = await this.button.count() > 0;
    return { title, textareaVisible, shiftVisible, buttonVisible };
  }

  async fillInput(text, shift) {
    // Accept numbers or strings for shift
    if (text !== undefined) {
      await this.textarea.fill(String(text));
    }
    if (shift !== undefined) {
      // clear and fill shift input
      await this.shiftInput.fill('');
      await this.shiftInput.type(String(shift));
    }
  }

  async clickEncrypt() {
    await this.button.click();
  }

  // Try to locate a likely output element and return its visible text, or null if not found
  async getOutputText() {
    for (const sel of this.outputSelectors) {
      const loc = this.page.locator(sel);
      if (await loc.count() > 0) {
        // return first visible one
        const first = loc.first();
        try {
          const text = await first.innerText();
          if (text && text.trim().length > 0) return text.trim();
        } catch (e) {
          // ignore and continue searching other selectors
        }
      }
    }
    // fallback: return the body visible text (may be large)
    try {
      const bodyText = await this.page.locator('body').innerText();
      return bodyText ? bodyText.trim() : null;
    } catch {
      return null;
    }
  }
}

test.describe('Caesar Cipher Encryption Demo - FSM and runtime error observation', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console error messages for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // store the Error object
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application page (S0_Idle)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // nothing to teardown beyond what Playwright provides
    // but keep hooks to satisfy requirement for setup/teardown presence
    await page.waitForTimeout(10);
  });

  test('Idle state: page loads with expected title and components (S0_Idle evidence)', async ({ page }) => {
    // Validate initial Idle state evidence: title and the three components exist
    const cp = new CaesarPage(page);
    const loaded = await cp.isLoaded();

    // Title evidence from FSM: <title>Caesar Cipher Encryption Demo</title>
    expect(loaded.title).toContain('Caesar Cipher Encryption Demo');

    // Ensure textarea, number input and button exist on the page
    expect(loaded.textareaVisible).toBeTruthy();
    expect(loaded.shiftVisible).toBeTruthy();
    expect(loaded.buttonVisible).toBeTruthy();

    // Validate button text content contains 'Encrypt' as indicated by FSM evidence
    const btnText = await cp.button.innerText();
    expect(btnText.toLowerCase()).toContain('encrypt');

    // At this point, we do not force any errors; record any accidental load-time page errors
    // This test does not assert that errors exist, just notes them for debugging output if present
    // (Other tests will assert on runtime errors triggered by interactions)
  });

  test('Transition S0_Idle -> S1_Encrypted: clicking "Encrypt" triggers encryption or raises expected runtime errors', async ({ page }) => {
    // This test performs the primary transition: user fills input and clicks the Encrypt button.
    // Per instructions, we must observe console/page errors naturally and assert they occur.
    const cp = new CaesarPage(page);

    // Fill with a sample ASCII mixed-case string and shift of 3
    const original = 'Abc XyZ! 123';
    const shift = 3;
    await cp.fillInput(original, shift);

    // Click the button to trigger encryptText() (expected by FSM)
    await cp.clickEncrypt();

    // Allow some time for scripts to run and potential errors to surface
    await page.waitForTimeout(300);

    // We MUST observe runtime errors (ReferenceError, TypeError, SyntaxError if present) as per instructions
    // Assert that at least one page error or console error of type 'error' occurred
    const totalErrors = pageErrors.length + consoleErrors.length;
    expect(totalErrors).toBeGreaterThan(0);

    // Prefer inspecting pageErrors (actual thrown errors) for specifics
    let matchedRelevantError = false;
    for (const err of pageErrors) {
      // err is typically an Error object (e.g., ReferenceError)
      const name = err.name || '';
      const message = String(err.message || '');
      if (/ReferenceError|TypeError|SyntaxError/i.test(name) || /encryptText|renderEncryptedText/i.test(message)) {
        matchedRelevantError = true;
        break;
      }
    }

    // If no pageErrors matched, try console errors text
    if (!matchedRelevantError) {
      for (const text of consoleErrors) {
        if (/encryptText|renderEncryptedText|ReferenceError|TypeError|SyntaxError/i.test(text)) {
          matchedRelevantError = true;
          break;
        }
      }
    }

    // According to the critical instruction, we must assert that such runtime errors occur
    expect(matchedRelevantError).toBeTruthy();

    // Additionally, if the page actually produced a visible encrypted result (i.e., implementation exists),
    // assert its correctness. We will compute expected cipher locally and search the page body for it.
    const visibleText = await cp.getOutputText();
    if (visibleText) {
      const expected = caesarCipher(original, shift);
      // The output may contain other text; assert that expected encrypted substring appears somewhere
      expect(visibleText.includes(expected)).toBeTruthy();
    } else {
      // If no visible output exists, that's acceptable here because we asserted runtime errors above.
      // This branch documents that no visible output was found.
      expect(true).toBeTruthy();
    }
  });

  test('Entry action check: clicking Encrypt should attempt renderEncryptedText() (assert ReferenceError mentioning renderEncryptedText)', async ({ page }) => {
    // Specifically validate whether the entry action renderEncryptedText() was attempted and caused an error
    const cp = new CaesarPage(page);
    await cp.fillInput('hello', 1);
    await cp.clickEncrypt();

    // Give scripts time to run
    await page.waitForTimeout(300);

    // Find an error that references renderEncryptedText or encryptText
    const found = pageErrors.some(err => /renderEncryptedText|encryptText/i.test(String(err.message || '')))
      || consoleErrors.some(txt => /renderEncryptedText|encryptText/i.test(txt));

    // According to the FSM, renderEncryptedText() is expected on entering S1_Encrypted.
    // The test asserts that the runtime attempted this (observable via errors that mention it).
    expect(found).toBeTruthy();
  });

  test('Edge case: clicking Encrypt with empty textarea should either render empty output or raise an error', async ({ page }) => {
    const cp = new CaesarPage(page);
    // Ensure empty
    await cp.fillInput('', 5);
    await cp.clickEncrypt();

    await page.waitForTimeout(300);

    // We expect at least some runtime error (per the required behavior)
    const totalErrors = pageErrors.length + consoleErrors.length;
    expect(totalErrors).toBeGreaterThan(0);

    // If an output exists, expect it to be either empty or a predictable transformation (empty -> empty)
    const out = await cp.getOutputText();
    if (out) {
      // if output contains non-whitespace, ensure it's consistent with encrypting empty string (which should be empty),
      // but since implementations vary, we just ensure no unexpected crash message replaced content.
      expect(typeof out).toBe('string');
    }
  });

  test('Edge case: large shift (27) and negative shift (-3) behavior — runtime errors expected or correct wrap-around', async ({ page }) => {
    const cp = new CaesarPage(page);

    // Test shift 27 (equivalent to 1)
    const original = 'abc';
    await cp.fillInput(original, 27);
    await cp.clickEncrypt();
    await page.waitForTimeout(250);

    // Per instructions, assert runtime errors happen naturally
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);

    // If the page produced visible text, verify wrap-around equivalence
    const out1 = await cp.getOutputText();
    if (out1) {
      expect(out1.includes(caesarCipher(original, 27))).toBeTruthy();
    }

    // Clear and test negative shift -3
    await cp.fillInput(original, -3);
    await cp.clickEncrypt();
    await page.waitForTimeout(250);

    // Again expect runtime errors (per critical instruction)
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);

    const out2 = await cp.getOutputText();
    if (out2) {
      expect(out2.includes(caesarCipher(original, -3))).toBeTruthy();
    }
  });

  test('Accessibility/robustness: multiple rapid clicks should not crash the test harness (observe errors)', async ({ page }) => {
    const cp = new CaesarPage(page);
    await cp.fillInput('MultipleClicks', 2);

    // Rapidly click the button several times to exercise event handlers
    for (let i = 0; i < 5; i++) {
      await cp.clickEncrypt();
    }

    await page.waitForTimeout(500);

    // Confirm that the app emitted errors rather than silently swallowed exceptions (per assignment)
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);

    // Ensure at least one of the errors is a JS runtime error (ReferenceError/TypeError/SyntaxError)
    const hasRuntimeError = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/i.test(e.name || ''))
      || consoleErrors.some(t => /ReferenceError|TypeError|SyntaxError/i.test(t));
    expect(hasRuntimeError).toBeTruthy();
  });
});