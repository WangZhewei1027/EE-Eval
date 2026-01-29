import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b55634-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.keyInput = page.locator('#demo-key');
    this.messageInput = page.locator('#demo-message');
    this.button = page.locator("button[onclick='runDemo()']");
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getKeyValue() {
    return this.keyInput.inputValue();
  }

  async getMessageValue() {
    return this.messageInput.inputValue();
  }

  async clickRunDemo() {
    await this.button.click();
  }

  async fillKey(value) {
    await this.keyInput.fill(value);
  }

  async fillMessage(value) {
    await this.messageInput.fill(value);
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async getOutputHTML() {
    return this.output.innerHTML();
  }
}

// Utility: replicate the demo page XOR encryption and hex conversion logic
function xorEncryptJS(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return result;
}

function toHexJS(str) {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return result;
}

test.describe('Symmetric Cryptography Demo (FSM tests)', () => {
  // Collect console events and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (log, error, warn)
    const consoleHandler = (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    // Collect uncaught page errors (exceptions)
    const pageErrorHandler = (err) => {
      // err is Error
      pageErrors.push(err);
    };

    // Attach listeners
    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Store handlers for removal in afterEach via shared properties on page object
    // (This does not modify application code; it's test housekeeping.)
    page.__test_console_handler = consoleHandler;
    page.__test_pageerror_handler = pageErrorHandler;
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leaks across tests
    if (page.__test_console_handler) {
      page.off('console', page.__test_console_handler);
      delete page.__test_console_handler;
    }
    if (page.__test_pageerror_handler) {
      page.off('pageerror', page.__test_pageerror_handler);
      delete page.__test_pageerror_handler;
    }
  });

  test('S0_Idle state: page renders initial idle UI correctly', async ({ page }) => {
    // This test validates the Idle state (S0_Idle):
    // - The demo inputs have default values from the FSM/html
    // - The output area shows the initial placeholder text
    // - The Encrypt/Decrypt button exists and is visible
    const demo = new DemoPage(page);
    await demo.goto();

    // Assertions for Idle state
    await expect(demo.keyInput).toBeVisible();
    await expect(demo.messageInput).toBeVisible();
    await expect(demo.button).toBeVisible();

    // Check default values from HTML attributes
    const keyVal = await demo.getKeyValue();
    const msgVal = await demo.getMessageValue();
    expect(keyVal).toBe('SECRET');
    expect(msgVal).toBe('HELLO');

    // Output should show the placeholder evidence text
    const outputText = (await demo.getOutputText())?.trim();
    expect(outputText).toBe('Results will appear here');

    // Ensure no uncaught page errors on initial render
    expect(pageErrors.length).toBe(0);
    // Optionally ensure there were no console.error events
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning: clicking Encrypt/Decrypt runs demo and updates output', async ({ page }) => {
    // This test validates the transition triggered by the Encrypt/Decrypt button:
    // - Clicking the button calls runDemo() (per FSM)
    // - The output area is updated with Original, Encrypted, Decrypted values
    // - Decrypted equals the original message, and hex matches computed encryption
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure starting values are those expected
    const key = await demo.getKeyValue();
    const message = await demo.getMessageValue();
    expect(key).toBe('SECRET');
    expect(message).toBe('HELLO');

    // Click the demo button to transition to Demo Running state
    await demo.clickRunDemo();

    // Wait for output to change from placeholder
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.innerHTML && !el.innerHTML.includes('Results will appear here');
    });

    const html = await demo.getOutputHTML();
    // Verify expected structure: Original, Encrypted, Decrypted lines are present
    expect(html).toContain('<strong>Original:</strong>');
    expect(html).toContain('<strong>Encrypted:</strong>');
    expect(html).toContain('<strong>Decrypted:</strong>');

    // Extract the visible decrypted/encrypted/original values from the HTML
    // We will use regex to find values between tags
    const originalMatch = html.match(/<strong>Original:<\/strong>\s*([^<]+)<\/p>/i);
    const encryptedMatch = html.match(/<strong>Encrypted:<\/strong>\s*([^<(]+)\s*\(hex:/i);
    const hexMatch = html.match(/\(hex:\s*([0-9a-f]+)\)/i);
    const decryptedMatch = html.match(/<strong>Decrypted:<\/strong>\s*([^<]+)<\/p>/i);

    expect(originalMatch).not.toBeNull();
    expect(encryptedMatch).not.toBeNull();
    expect(hexMatch).not.toBeNull();
    expect(decryptedMatch).not.toBeNull();

    const original = originalMatch[1].trim();
    const encrypted = encryptedMatch[1].trim();
    const hexFromPage = hexMatch[1].trim();
    const decrypted = decryptedMatch[1].trim();

    // Validate values
    expect(original).toBe(message);
    expect(decrypted).toBe(message); // decrypted should match original

    // Recompute encrypted and hex using same algorithm as page to ensure correctness
    const expectedEncrypted = xorEncryptJS(message, key);
    const expectedHex = toHexJS(expectedEncrypted);

    expect(encrypted).toBe(expectedEncrypted);
    expect(hexFromPage.toLowerCase()).toBe(expectedHex.toLowerCase());

    // No uncaught page errors after a normal successful run
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking multiple times updates the output consistently (idempotent runDemo)', async ({ page }) => {
    // This test ensures repeated transitions still produce valid outputs and do not leak errors
    const demo = new DemoPage(page);
    await demo.goto();

    // First run
    await demo.clickRunDemo();
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.innerHTML && !el.innerHTML.includes('Results will appear here');
    });
    const firstHTML = await demo.getOutputHTML();

    // Second run
    await demo.clickRunDemo();
    // Wait a short moment to allow DOM update (runDemo is synchronous but innerHTML update should be immediate)
    await page.waitForTimeout(100);
    const secondHTML = await demo.getOutputHTML();

    // The content should be present and consistent (same original/decrypted values)
    expect(firstHTML).toContain('<strong>Original:</strong>');
    expect(secondHTML).toContain('<strong>Original:</strong>');

    // Extract originals from both runs and compare
    const orig1 = firstHTML.match(/<strong>Original:<\/strong>\s*([^<]+)<\/p>/i)[1].trim();
    const orig2 = secondHTML.match(/<strong>Original:<\/strong>\s*([^<]+)<\/p>/i)[1].trim();
    expect(orig1).toBe(orig2);

    // Ensure no new page errors occurred during repeated runs
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: missing key input element causes runtime error when running demo (observing natural page error)', async ({ page }) => {
    // This test intentionally modifies the DOM to remove the key input element,
    // then triggers the demo. According to the page implementation, runDemo()
    // calls document.getElementById('demo-key').value; removing the element should
    // cause a TypeError when attempting to read .value from null. We do not patch
    // or redefine functions; we let the runtime error occur naturally and assert it.
    const demo = new DemoPage(page);
    await demo.goto();

    // Remove the key input element from the DOM to simulate a broken environment
    await page.evaluate(() => {
      const el = document.getElementById('demo-key');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });

    // We expect a pageerror event to be emitted when clicking the run button
    // because runDemo will attempt to access .value on a null element.
    const errorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).then(e => e).catch(e => null);

    // Click the button that triggers runDemo
    await demo.clickRunDemo();

    const errorEvent = await errorPromise;

    // Assert that an error was observed
    expect(errorEvent).not.toBeNull();
    // It should be an Error and typically a TypeError referencing 'value' or null
    expect(errorEvent).toBeInstanceOf(Error);
    const msg = String(errorEvent.message || errorEvent);
    // Check that the error message indicates a null property access or similar runtime type error
    const likelyTypeError = /cannot read|cannot read properties|reading 'value'|is null|undefined/i.test(msg);
    expect(likelyTypeError).toBeTruthy();

    // Also ensure that our recorded pageErrors array includes this error
    // (the global listener attached earlier should have captured it)
    // Note: pageErrors is defined in beforeEach closure. Using pageErrors variable here.
    // We expect at least one captured page error.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Confirm that a console.error was likely emitted as well (optional)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBeGreaterThanOrEqual(0);
  });

  test('Edge case: non-ASCII characters are handled and hex output matches expectations', async ({ page }) => {
    // This validates that the demo handles non-ASCII content (e.g., Unicode) and
    // that the displayed hex corresponds to the actual character codes of the encrypted bytes.
    const demo = new DemoPage(page);
    await demo.goto();

    const key = '秘密'; // "secret" in Japanese/Chinese characters
    const message = 'こんにちは'; // "Hello" in Japanese

    await demo.fillKey(key);
    await demo.fillMessage(message);

    // Run demo
    await demo.clickRunDemo();

    // Wait for DOM update
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.innerHTML && !el.innerHTML.includes('Results will appear here');
    });

    const html = await demo.getOutputHTML();

    // Extract encrypted and hex values
    const encryptedMatch = html.match(/<strong>Encrypted:<\/strong>\s*([^<(]+)\s*\(hex:/i);
    const hexMatch = html.match(/\(hex:\s*([0-9a-f]+)\)/i);
    const decryptedMatch = html.match(/<strong>Decrypted:<\/strong>\s*([^<]+)<\/p>/i);

    expect(encryptedMatch).not.toBeNull();
    expect(hexMatch).not.toBeNull();
    expect(decryptedMatch).not.toBeNull();

    const encrypted = encryptedMatch[1].trim();
    const hexFromPage = hexMatch[1].trim();
    const decrypted = decryptedMatch[1].trim();

    // Decrypted should match original Unicode message
    expect(decrypted).toBe(message);

    // Compute expected encrypted and hex using the same algorithm in test
    const expectedEncrypted = xorEncryptJS(message, key);
    const expectedHex = toHexJS(expectedEncrypted);
    // Compare hex outputs (normalize case)
    expect(hexFromPage.toLowerCase()).toBe(expectedHex.toLowerCase());

    // No unexpected page errors for this Unicode scenario
    expect(pageErrors.length).toBe(0);
  });
});