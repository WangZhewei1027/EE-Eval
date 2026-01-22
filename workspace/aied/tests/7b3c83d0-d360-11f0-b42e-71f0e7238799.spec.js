import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3c83d0-d360-11f0-b42e-71f0e7238799.html';

// Page Object Model for the Huffman Coding Demo page
class HuffmanPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async inputText(text) {
    const textarea = await this.page.waitForSelector('#inputText');
    await textarea.fill(text);
  }

  async clickEncode() {
    const button = await this.page.waitForSelector('.button');
    await button.click();
  }

  async getOutputText() {
    const out = await this.page.waitForSelector('#output');
    return (await out.textContent()) ?? '';
  }

  async getButtonOnClickAttribute() {
    const button = await this.page.waitForSelector('.button');
    return await button.getAttribute('onclick');
  }

  async elementExists(selector) {
    return (await this.page.$(selector)) !== null;
  }
}

test.describe('Huffman Coding Demo - FSM states, transitions and behaviors', () => {
  // Containers to collect console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  // Setup listener for console and page errors before each test, and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, log, error, warning, etc.)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Some console messages can throw when serializing - record a fallback
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions in the page context
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });
  });

  // Teardown - ensure listeners don't leak between tests (Playwright isolates pages per test but be explicit)
  test.afterEach(async ({ page }) => {
    // Remove listeners by recreating page listeners to default; Playwright tests create fresh pages per test,
    // so no explicit removal is strictly necessary here. This is a placeholder for clarity.
    // (No operations needed.)
  });

  test('Initial Idle state (S0_Idle): page renders expected components and no runtime errors on load', async ({ page }) => {
    // This test validates the initial Idle state: UI elements exist, output is empty,
    // huffmanEncode function exists (entry action for S1), and renderPage (declared in FSM) is not present.
    const app = new HuffmanPage(page);
    await app.goto();

    // Verify components exist
    expect(await app.elementExists('#inputText')).toBeTruthy();
    expect(await app.elementExists('.button')).toBeTruthy();
    expect(await app.elementExists('#output')).toBeTruthy();

    // Output should be empty on initial render
    const initialOutput = await app.getOutputText();
    expect(initialOutput).toBe(''); // empty as implemented

    // The FSM mentioned an entry action "renderPage()" for S0_Idle, which is NOT present in the HTML/JS.
    // Assert that renderPage is undefined (do not call it).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // huffmanEncode must be defined (the S1 entry action). We assert it's a function.
    const huffmanEncodeType = await page.evaluate(() => typeof window.huffmanEncode);
    expect(huffmanEncodeType).toBe('function');

    // The encode button should have an onclick attribute that triggers huffmanEncode()
    const onclickAttr = await app.getButtonOnClickAttribute();
    expect(onclickAttr).toContain('huffmanEncode');

    // Assert no console errors or uncaught page errors occurred during load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Encoding: clicking Encode with empty input shows header only', async ({ page }) => {
    // This test validates the transition from Idle to Encoding on Encode click with empty input.
    // It also verifies the expected observable: "Output displayed in #output"
    const app = new HuffmanPage(page);
    await app.goto();

    // Ensure input is empty
    await app.inputText('');

    // Click encode to trigger huffmanEncode()
    await app.clickEncode();

    // Wait briefly for DOM update and then check output
    const out = await app.getOutputText();
    // For empty input, the implementation produces 'Huffman Codes:\n'
    expect(out.startsWith('Huffman Codes:')).toBeTruthy();
    // The output should at least contain the header line and newline
    expect(out).toBe('Huffman Codes:\n');

    // Confirm no console errors or page errors during encoding
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Encoding single unique character produces an entry for that character (edge case)', async ({ page }) => {
    // Edge case: when only one distinct character exists, Huffman code assigned may be an empty string.
    // Validate that the output includes the character with a colon and possibly an empty code.
    const app = new HuffmanPage(page);
    await app.goto();

    // Input a single distinct character repeated
    await app.inputText('aaaaa'); // only 'a' appears

    // Trigger encoding
    await app.clickEncode();

    // Get output and parse
    const out = await app.getOutputText();
    expect(out.startsWith('Huffman Codes:')).toBeTruthy();

    // Extract lines after header
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean); // removes empty trailing
    // First line might be header, ensure at least one mapping exists
    expect(lines.length).toBeGreaterThanOrEqual(1);

    // Find the line for 'a'
    const foundA = lines.some((line) => line.startsWith('a:'));
    expect(foundA).toBeTruthy();

    // Ensure no runtime errors occurred
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Encoding multiple characters produces codes for each distinct character and codes are unique', async ({ page }) => {
    // This test checks that for a non-trivial input, the output lists codes for each distinct character
    // and that the codes assigned are unique (Huffman property).
    const app = new HuffmanPage(page);
    await app.goto();

    const input = 'aaabbc'; // distinct characters: a, b, c
    await app.inputText(input);

    await app.clickEncode();

    const out = await app.getOutputText();
    expect(out.startsWith('Huffman Codes:')).toBeTruthy();

    // Parse mapping lines: skip header
    const mappingLines = out.split('\n').slice(1).filter((l) => l.trim().length > 0);
    // Expect entries for each distinct char
    const distinctChars = Array.from(new Set(input.split('')));
    expect(mappingLines.length).toBe(distinctChars.length);

    const codes = {};
    for (const line of mappingLines) {
      // line format: "<char>: <code>"
      const idx = line.indexOf(':');
      expect(idx).toBeGreaterThan(-1);
      const char = line.slice(0, idx).trim();
      const code = line.slice(idx + 1).trim();
      // record mapping
      codes[char] = code;
      // code may be empty in some edge cases, but must be a string
      expect(typeof code).toBe('string');
    }

    // Ensure every distinct char is present in mapping
    for (const ch of distinctChars) {
      expect(Object.prototype.hasOwnProperty.call(codes, ch)).toBeTruthy();
    }

    // Ensure codes are unique across characters
    const codeValues = Object.values(codes);
    const uniqueCodes = new Set(codeValues);
    expect(uniqueCodes.size).toBe(codeValues.length);

    // No console/page errors triggered
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Repeated Encode clicks (S1_Encoding -> S0_Idle -> S1_Encoding): consistent outputs on repeated encoding', async ({ page }) => {
    // This test validates the second transition in the FSM (S1 -> S0 on clicking again)
    // by clicking Encode multiple times and ensuring the application remains stable and deterministic.
    const app = new HuffmanPage(page);
    await app.goto();

    const input = 'abcabc';
    await app.inputText(input);

    await app.clickEncode();
    const out1 = await app.getOutputText();

    // Click again to simulate returning to Idle and encoding again (S1 -> S0 -> S1)
    await app.clickEncode();
    const out2 = await app.getOutputText();

    // For the same input, the implementation should produce the same textual output on subsequent runs.
    expect(out1).toBe(out2);

    // Ensure output includes expected header and at least one mapping
    expect(out1.startsWith('Huffman Codes:')).toBeTruthy();
    const mappingLines = out1.split('\n').slice(1).filter(Boolean);
    expect(mappingLines.length).toBeGreaterThan(0);

    // Ensure no runtime errors occurred during repeated invocations
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observe and assert console/page errors behavior explicitly', async ({ page }) => {
    // This test attaches to console and pageerror (done in beforeEach) and then performs interactions.
    // It then asserts that no unexpected console errors (ReferenceError, SyntaxError, TypeError) occurred.
    // If any such errors naturally occurred, the test will fail - as required by the constraints to observe errors.
    const app = new HuffmanPage(page);
    await app.goto();

    // Perform a sequence of interactions
    await app.inputText('testing errors');
    await app.clickEncode();
    await app.inputText('');
    await app.clickEncode();

    // Give a small delay to ensure any asynchronous page errors surface
    await page.waitForTimeout(100);

    // Collect console error messages (type === 'error')
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');

    // If there are any page errors or console errors, we will surface them in the assertion message
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Provide debugging information in the failure message
      const errMsgs = [
        ...pageErrors.map((m) => `pageerror: ${m}`),
        ...consoleErrors.map((m) => `console.${m.type}: ${m.text}`),
      ].join('\n---\n');
      // Fail the test with collected error messages
      expect(false, `Unexpected page/console errors detected:\n${errMsgs}`).toBeTruthy();
    } else {
      // If none, assert explicitly that there were no errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    }
  });
});