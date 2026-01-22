import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b461a0-d5c2-11f0-9651-0f1ae31ac260.html';

/**
 * Page Object for the Huffman Coding Demonstration page.
 * Encapsulates common interactions and queries used by the tests.
 */
class HuffmanPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    // Capture console errors and page errors for assertions
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err.message);
    });

    // Element locators
    this.input = () => this.page.locator('#inputText');
    this.compressBtn = () => this.page.locator('#compressBtn');
    this.errorMsg = () => this.page.locator('#errorMsg');
    this.output = () => this.page.locator('#output');
    this.freqTableRows = () => this.page.locator('#freqTableBody tr');
    this.codesTableRows = () => this.page.locator('#codesTableBody tr');
    this.treeContainer = () => this.page.locator('#treeContainer');
    this.encoded = () => this.page.locator('#encodedString');
    this.decoded = () => this.page.locator('#decodedString');
  }

  async goto() {
    // Navigate to the application page
    await this.page.goto(BASE_URL, { waitUntil: 'load' });
  }

  async setInput(text) {
    await this.input().fill(text);
  }

  async clickEncode() {
    await this.compressBtn().click();
    // allow UI updates to complete
    await this.page.waitForTimeout(50);
  }

  async getErrorText() {
    return (await this.errorMsg().innerText()).trim();
  }

  async isOutputVisible() {
    const display = await this.output().evaluate((el) => window.getComputedStyle(el).display);
    return display !== 'none';
  }

  async getFreqEntries() {
    const rows = await this.freqTableRows().elementHandles();
    const result = [];
    for (const r of rows) {
      const tds = await r.$$('td');
      const charHtml = await tds[0].innerHTML();
      const freqText = await tds[1].innerText();
      result.push({ charHtml: charHtml.trim(), freq: Number(freqText.trim()) });
    }
    return result;
  }

  async getCodesEntries() {
    const rows = await this.codesTableRows().elementHandles();
    const result = [];
    for (const r of rows) {
      const tds = await r.$$('td');
      const charHtml = await tds[0].innerHTML();
      const codeText = await tds[1].innerText();
      result.push({ charHtml: charHtml.trim(), code: codeText.trim() });
    }
    return result;
  }

  async getTreeHtml() {
    return (await this.treeContainer().innerHTML()).trim();
  }

  async getEncodedTextRaw() {
    // Return the raw presented encoded string (may contain spaces/newlines)
    return (await this.encoded().innerText()).trim();
  }

  async getDecodedText() {
    return (await this.decoded().innerText()).trim();
  }

  getConsoleErrors() {
    return this.consoleErrors.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }
}

test.describe('Huffman Coding Demonstration - FSM validation', () => {
  // Use a fresh page for each test to isolate listeners and DOM state.
  test.beforeEach(async ({ page }) => {
    // nothing global here; each test creates its own HuffmanPage
  });

  test('S0_Idle: Initial render shows title, textarea placeholder, no output visible', async ({ page }) => {
    // Validate initial Idle state (S0_Idle) entry actions (renderPage)
    const app = new HuffmanPage(page);
    await app.goto();

    // Verify the main heading exists
    await expect(page.locator('h1')).toHaveText('Huffman Coding Demonstration');

    // Verify textarea placeholder and that it is empty initially
    const textarea = page.locator('#inputText');
    await expect(textarea).toHaveAttribute('placeholder', 'Type your text here... (e.g. hello huffman)');
    await expect(textarea).toHaveValue('');

    // Error message should be empty
    await expect(page.locator('#errorMsg')).toHaveText('');

    // Output section should be hidden (display:none)
    const displayStyle = await page.locator('#output').evaluate((el) => window.getComputedStyle(el).display);
    expect(displayStyle).toBe('none');

    // Ensure no console errors or page errors during initial render
    expect(app.getConsoleErrors()).toEqual([]);
    expect(app.getPageErrors()).toEqual([]);
  });

  test('S0_Idle -> S1_Error: Clicking Encode with empty input shows expected error message', async ({ page }) => {
    // This test validates the transition triggered by CompressClick when input === ''
    const app = new HuffmanPage(page);
    await app.goto();

    // Ensure input is empty
    await app.setInput('');
    // Click the Encode and Decode button
    await app.clickEncode();

    // Expect the error message described in FSM transition to appear
    await expect(page.locator('#errorMsg')).toHaveText('Please input some text to encode.');

    // Output should remain hidden
    expect(await app.isOutputVisible()).toBe(false);

    // Confirm the implementation did not produce JS runtime errors during this flow
    expect(app.getConsoleErrors()).toEqual([]);
    expect(app.getPageErrors()).toEqual([]);
  });

  test('S0_Idle -> S2_OutputVisible: Valid input triggers rendering of frequencies, codes, tree, encoded and decoded output', async ({ page }) => {
    // This test validates the successful encoding/decoding transition and the onEnter actions for S2_OutputVisible
    const app = new HuffmanPage(page);
    await app.goto();

    const inputText = 'hello huffman';
    await app.setInput(inputText);
    await app.clickEncode();

    // After successful transition, output section should be visible
    expect(await app.isOutputVisible()).toBe(true);

    // Frequencies table should contain entries summing to input length
    const freqEntries = await app.getFreqEntries();
    const totalFreq = freqEntries.reduce((s, e) => s + e.freq, 0);
    expect(totalFreq).toBe(inputText.length);

    // Codes table should have one entry per unique character
    const uniqueChars = new Set(Array.from(inputText));
    const codesEntries = await app.getCodesEntries();
    expect(codesEntries.length).toBe(uniqueChars.size);

    // The tree container should have HTML content (visualization rendered)
    const treeHtml = await app.getTreeHtml();
    expect(treeHtml.length).toBeGreaterThan(0);

    // Encoded string should be non-empty
    const encodedPresented = await app.getEncodedTextRaw();
    expect(encodedPresented.length).toBeGreaterThan(0);

    // Decoded string must match the original input exactly (verifies encode+decode correctness)
    const decoded = await app.getDecodedText();
    expect(decoded).toBe(inputText);

    // Ensure special characters like spaces are represented with <i>space</i> in frequency table
    // Find if there is an entry for space
    const hasSpaceEntry = freqEntries.some((e) => e.charHtml.includes('space') || e.charHtml.includes('&nbsp;'));
    expect(hasSpaceEntry).toBe(true);

    // No runtime console or page errors should have occurred during this full flow
    expect(app.getConsoleErrors()).toEqual([]);
    expect(app.getPageErrors()).toEqual([]);
  });

  test('Edge case: Single-character input assigns code "0" and decodes correctly', async ({ page }) => {
    // This test checks the special-case handling in generateCodes where a single character gets code '0'
    const app = new HuffmanPage(page);
    await app.goto();

    const inputText = 'aaaaa'; // single unique character repeated
    await app.setInput(inputText);
    await app.clickEncode();

    // Output visible
    expect(await app.isOutputVisible()).toBe(true);

    // Codes table should have exactly 1 row with code '0'
    const codes = await app.getCodesEntries();
    expect(codes.length).toBe(1);
    expect(codes[0].code).toBe('0');

    // Encoded string should be sequence of '0's of same length (presented string may contain spaces/newlines)
    const encodedPresented = await app.getEncodedTextRaw();
    // Remove whitespace (spaces/newlines) from presented encoded string to inspect raw bits
    const encodedBits = encodedPresented.replace(/\s+/g, '');
    expect(encodedBits).toBe('0'.repeat(inputText.length));

    // Decoded equals original
    const decoded = await app.getDecodedText();
    expect(decoded).toBe(inputText);

    // No runtime errors
    expect(app.getConsoleErrors()).toEqual([]);
    expect(app.getPageErrors()).toEqual([]);
  });

  test('Special characters: space is displayed as italicized "space" label in tables', async ({ page }) => {
    // This test verifies the rendering/escaping logic for space characters described in the FSM evidence
    const app = new HuffmanPage(page);
    await app.goto();

    const inputText = 'a a'; // contains a space
    await app.setInput(inputText);
    await app.clickEncode();

    // Ensure output visible
    expect(await app.isOutputVisible()).toBe(true);

    // Frequency table should show an italic 'space' entry
    const freqEntries = await app.getFreqEntries();
    const spaceEntry = freqEntries.find((e) => e.charHtml.includes('<i>space</i>') || e.charHtml.includes('space'));
    expect(spaceEntry).toBeTruthy();
    // The frequency of space should be 1 for this input
    expect(spaceEntry.freq).toBe(1);

    // Codes table should also include 'space' representation
    const codesEntries = await app.getCodesEntries();
    const spaceCodeEntry = codesEntries.find((e) => e.charHtml.includes('<i>space</i>') || e.charHtml.includes('space'));
    expect(spaceCodeEntry).toBeTruthy();
    // Ensure the code for space is non-empty
    expect(spaceCodeEntry.code.length).toBeGreaterThan(0);

    // Decoded must exactly match original (spaces preserved)
    const decoded = await app.getDecodedText();
    expect(decoded).toBe(inputText);

    // No runtime errors
    expect(app.getConsoleErrors()).toEqual([]);
    expect(app.getPageErrors()).toEqual([]);
  });

  test('FSM guard unreachable scenario assertion: the implementation never produces "Input text does not contain valid characters."', async ({ page }) => {
    // The FSM lists a possible transition to S1_Error with message 'Input text does not contain valid characters.'
    // In this implementation buildFrequency will create entries for any characters, so freqMap.size === 0
    // only occurs for an empty string and that case is handled by the "Please input some text to encode." message.
    // This test asserts that the second error message is not produced in normal usage.
    const app = new HuffmanPage(page);
    await app.goto();

    // Case 1: empty input -> first error message
    await app.setInput('');
    await app.clickEncode();
    await expect(page.locator('#errorMsg')).toHaveText('Please input some text to encode.');

    // Clear input and set some content to attempt to trigger the other error path (which shouldn't occur)
    await app.setInput('abc');
    await app.clickEncode();

    // Ensure we do not see the other error message anywhere
    const errorText = await app.getErrorText();
    expect(errorText).not.toBe('Input text does not contain valid characters.');

    // Additionally ensure we actually rendered output for valid input
    expect(await app.isOutputVisible()).toBe(true);

    // No runtime errors occurred
    expect(app.getConsoleErrors()).toEqual([]);
    expect(app.getPageErrors()).toEqual([]);
  });
});