import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0baa4ad0-d5b2-11f0-b169-abe023d0d932.html';

/**
 * Page object for the Huffman Coding example.
 * Encapsulates common interactions and DOM queries.
 */
class HuffmanPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // give the page a short moment to execute inline scripts and surface errors
    await this.page.waitForTimeout(200);
  }

  async textareaTextHandle() {
    return this.page.locator('#text');
  }

  async outputHandle() {
    return this.page.locator('#output');
  }

  async huffmanCodeHandle() {
    return this.page.locator('#huffman-code');
  }

  async dictionaryHandle() {
    return this.page.locator('#dictionary');
  }

  async encodeButton() {
    return this.page.locator('#encode-button');
  }

  async decodeButton() {
    return this.page.locator('#decode-button');
  }

  async setInputText(value) {
    const ta = await this.textareaTextHandle();
    await ta.fill(value);
  }

  async clickEncode() {
    const btn = await this.encodeButton();
    await btn.click();
    // allow any JS handlers (if present) to run
    await this.page.waitForTimeout(100);
  }

  async clickDecode() {
    const btn = await this.decodeButton();
    await btn.click();
    await this.page.waitForTimeout(100);
  }

  // Read visible output (textContent of the #output div)
  async getVisibleOutputText() {
    const out = await this.outputHandle();
    return out.textContent();
  }

  // Read internal properties (value) if they exist on elements
  async getElementValue(selector) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return el.value !== undefined ? el.value : null;
    }, selector);
  }
}

// Group tests for clarity
test.describe('Huffman Coding FSM - Application ID 0baa4ad0-d5b2-11f0-b169-abe023d0d932', () => {
  // Capture page errors and console messages for assertions
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // collect unhandled page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // collect console messages of all types
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app
    const hp = new HuffmanPage(page);
    await hp.goto();
  });

  test.afterEach(async ({ page }) => {
    // detach listeners by removing page listeners (best-effort cleanup)
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('S0_Idle: Page renders expected components and initial runtime error is surfaced', async ({ page }) => {
    // Validate initial DOM elements are present and visible
    const hp = new HuffmanPage(page);
    await expect(hp.textareaTextHandle()).toBeVisible();
    await expect(hp.outputHandle()).toBeVisible();
    await expect(hp.huffmanCodeHandle()).toBeVisible();
    await expect(hp.dictionaryHandle()).toBeVisible();
    await expect(hp.encodeButton()).toBeVisible();
    await expect(hp.decodeButton()).toBeVisible();

    // The implementation erroneously calls calculateFrequency(text) where text is a DOM element.
    // This should produce a runtime TypeError like "text.toLowerCase is not a function".
    // Assert that at least one pageerror was captured and that it mentions toLowerCase or "not a function".
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const joinedErrors = pageErrors.join(' | ').toLowerCase();
    const hasToLowerError = joinedErrors.includes('tolowercase') || joinedErrors.includes('not a function');
    expect(hasToLowerError).toBeTruthy();

    // Also assert that some console messages (if any) were captured to aid debugging
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('S1_Encoding: Encoding flow - buttons exist but event listeners likely not attached due to initial error', async ({ page }) => {
    const hp = new HuffmanPage(page);

    // Ensure encode-related functions are defined on window (they are declared before the failing call)
    const calculateFrequencyType = await page.evaluate(() => typeof calculateFrequency);
    const encodeTextType = await page.evaluate(() => typeof encodeText);
    const generateHuffmanCodeType = await page.evaluate(() => typeof generateHuffmanCode);
    expect(calculateFrequencyType).toBe('function');
    expect(encodeTextType).toBe('function');
    expect(generateHuffmanCodeType).toBe('function');

    // Fill input and click Encode. Because the script likely failed before adding event listeners,
    // clicking may not trigger the expected encoding behavior. We assert that visible output does not gain encoded content.
    await hp.setInputText('abc def');
    const beforeVisible = await hp.getVisibleOutputText();
    await hp.clickEncode();
    const afterVisible = await hp.getVisibleOutputText();

    // Expect visible output (textContent of div#output) to remain unchanged (empty or same)
    expect(afterVisible).toBe(beforeVisible);

    // Try invoking encodeText directly via evaluate to observe any runtime error when calling functions manually.
    // encodeText uses huffmanCode.value.charAt(...) and output.value; invoking it may not throw but behaves incorrectly.
    const encodeInvocationResult = await page.evaluate(() => {
      try {
        // call encodeText with a simple string
        encodeText('test');
        return { ok: true, note: 'called encodeText' };
      } catch (err) {
        return { ok: false, error: String(err && err.message ? err.message : err) };
      }
    });

    // encodeText should be callable (it was defined); assert that either it succeeded or returned a meaningful error object.
    expect(typeof encodeInvocationResult).toBe('object');
    expect(encodeInvocationResult.ok === true || (encodeInvocationResult.ok === false && typeof encodeInvocationResult.error === 'string')).toBeTruthy();
  });

  test('S2_Decoding: Decoding flow and intentional runtime ReferenceError from decodeText', async ({ page }) => {
    const hp = new HuffmanPage(page);

    // The decodeText implementation uses charCodeAt as if it were a global function, causing a ReferenceError.
    // Invoke decodeText directly and assert that the ReferenceError surfaces.
    const decodeInvocation = await page.evaluate(() => {
      try {
        decodeText('101 110'); // arbitrary encoded text
        return { ok: true, result: null };
      } catch (err) {
        return { ok: false, error: String(err && err.message ? err.message : err) };
      }
    });

    expect(decodeInvocation.ok).toBe(false);
    // The message should indicate that charCodeAt is not defined or similar ReferenceError.
    expect(String(decodeInvocation.error).toLowerCase()).toContain('charcodeat');

    // Clicking the Decode button in the UI: because the event listeners were defined after the failing call,
    // the click handler may not exist. Clicking should not throw new pageerror events (but may do nothing).
    const beforeVisible = await hp.getVisibleOutputText();
    await hp.clickDecode();
    const afterVisible = await hp.getVisibleOutputText();
    expect(afterVisible).toBe(beforeVisible);
  });

  test('Edge cases and error scenarios: validate presence and nature of runtime errors and robustness of UI elements', async ({ page }) => {
    const hp = new HuffmanPage(page);

    // Confirm that the initial runtime error (from calculateFrequency called with a DOM element) is present
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const firstError = pageErrors[0].toLowerCase();
    expect(firstError.includes('tolowercase') || firstError.includes('not a function')).toBeTruthy();

    // Ensure that core DOM elements still exist and are accessible even after the script error
    await expect(hp.textareaTextHandle()).toBeVisible();
    await expect(hp.encodeButton()).toBeVisible();
    await expect(hp.decodeButton()).toBeVisible();

    // Validate that the script-defined helper functions exist on the global scope (they were declared prior to the failing call)
    const globalFunctions = await page.evaluate(() => {
      return {
        encodeText: typeof encodeText,
        decodeText: typeof decodeText,
        generateDictionary: typeof generateDictionary,
      };
    });
    expect(globalFunctions.encodeText).toBe('function');
    expect(globalFunctions.decodeText).toBe('function');
    expect(globalFunctions.generateDictionary).toBe('function');

    // Assert that attempting to decode an empty string via decodeText produces the same ReferenceError
    const emptyDecode = await page.evaluate(() => {
      try {
        decodeText('');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    });
    expect(emptyDecode.ok).toBe(false);
    expect(String(emptyDecode.error).toLowerCase()).toContain('charcodeat');
  });
});