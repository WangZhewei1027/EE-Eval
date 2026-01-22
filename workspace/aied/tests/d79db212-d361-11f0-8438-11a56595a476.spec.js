import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79db212-d361-11f0-8438-11a56595a476.html';

// Page Object for the Huffman demo page
class HuffmanPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputSelector = '#inputText';
    this.encodeBtnSelector = '#encodeBtn';
    this.resultsSelector = '#results';
    this.freqTableBody = '#freqTable tbody';
    this.codeTableBody = '#codeTable tbody';
    this.encodedOutputSelector = '#encodedOutput';
    this.treeSvgSelector = '#tree-svg';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInput(text) {
    await this.page.fill(this.inputSelector, text);
  }

  async clickEncode() {
    await this.page.click(this.encodeBtnSelector);
  }

  async isResultsVisible() {
    // Check computed style display property
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return window.getComputedStyle(el).display !== 'none';
    }, this.resultsSelector);
  }

  async getFreqRows() {
    return await this.page.$$(`${this.freqTableBody} > tr`);
  }

  async getCodeRows() {
    return await this.page.$$(`${this.codeTableBody} > tr`);
  }

  async getFreqData() {
    // return array of {char, freq}
    return await this.page.$$eval(`${this.freqTableBody} > tr`, (rows) =>
      rows.map((r) => {
        const cols = r.querySelectorAll('td');
        return {
          char: cols[0]?.textContent?.trim() ?? '',
          freq: cols[1]?.textContent?.trim() ?? ''
        };
      })
    );
  }

  async getCodeData() {
    // return array of {char, code}
    return await this.page.$$eval(`${this.codeTableBody} > tr`, (rows) =>
      rows.map((r) => {
        const cols = r.querySelectorAll('td');
        return {
          char: cols[0]?.textContent?.trim() ?? '',
          code: cols[1]?.textContent?.trim() ?? ''
        };
      })
    );
  }

  async getEncodedOutputValue() {
    return await this.page.$eval(this.encodedOutputSelector, (ta) => ta.value);
  }

  async getTreeSvgChildCount() {
    return await this.page.$eval(this.treeSvgSelector, (svg) => svg.childNodes.length);
  }

  async waitForResultsVisible(timeout = 2000) {
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return window.getComputedStyle(el).display === 'block';
      },
      this.resultsSelector,
      { timeout }
    );
  }
}

test.describe('Huffman Coding Interactive Demonstration (FSM tests)', () => {
  // We'll capture console messages and page errors for each test to assert on them
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test fails, include console messages and page errors to aid debugging (but do not alter behavior)
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.log('Console messages collected:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Page errors collected:', pageErrors);
    }
  });

  test('Initial Idle state: page renders input, button and results are hidden', async ({ page }) => {
    const app = new HuffmanPage(page);
    await app.goto();

    // Verify initial elements exist
    await expect(page.locator('#inputText')).toBeVisible();
    await expect(page.locator('#inputText')).toHaveAttribute('placeholder', 'Type or paste text here...');
    await expect(page.locator('#encodeBtn')).toBeVisible();
    await expect(page.locator('#encodeBtn')).toHaveText('Build Huffman Tree & Encode');

    // Results panel should be hidden initially (Idle state)
    const resultsVisible = await app.isResultsVisible();
    expect(resultsVisible).toBe(false);

    // No uncaught page errors should have occurred during initial render
    expect(pageErrors.length).toBe(0);

    // Console should not have fatal errors (we assert there are no 'error' console types)
    const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Edge case: clicking encode with empty input shows alert and stays in Idle', async ({ page }) => {
    const app = new HuffmanPage(page);
    await app.goto();

    // Prepare to capture the dialog
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Click encode with empty textarea
    await app.clickEncode();

    // Expect the alert dialog to have been shown with the specific message
    expect(dialogMessage).toBe('Please enter some text to encode.');

    // Results should remain hidden
    const visible = await app.isResultsVisible();
    expect(visible).toBe(false);

    // Ensure no tables or outputs are populated
    const freqRows = await app.getFreqRows();
    const codeRows = await app.getCodeRows();
    const encodedVal = await app.getEncodedOutputValue();
    const svgChildCount = await app.getTreeSvgChildCount();

    expect(freqRows.length).toBe(0);
    expect(codeRows.length).toBe(0);
    expect(encodedVal).toBe('');
    expect(svgChildCount).toBe(0);

    // No uncaught page errors should happen for this user error scenario
    expect(pageErrors.length).toBe(0);

    // Console should not show errors
    const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Transition: encoding a sample text moves to Results Visible and populates tables, encoded output and tree', async ({ page }) => {
    const app = new HuffmanPage(page);
    await app.goto();

    // Use a sample input with multiple characters
    const sample = 'aabbc';
    await app.fillInput(sample);

    // Click encode and wait for results to become visible
    await app.clickEncode();
    await app.waitForResultsVisible(3000); // wait until the results panel shows

    // Verify visible
    const visible = await app.isResultsVisible();
    expect(visible).toBe(true);

    // Frequency table should have 3 rows (a, b, c)
    const freqData = await app.getFreqData();
    expect(freqData.length).toBe(3);

    // Frequencies should include values 2,2,1 (order can vary)
    const freqs = freqData.map((r) => r.freq);
    expect(freqs.sort()).toEqual(['1', '2', '2']);

    // Code table should contain 3 entries and each code should be a non-empty string of 0/1
    const codeData = await app.getCodeData();
    expect(codeData.length).toBe(3);
    for (const entry of codeData) {
      expect(entry.code).toMatch(/^[01]+$/);
      expect(entry.code.length).toBeGreaterThan(0);
    }

    // Encoded output should be a non-empty binary string consisting only of 0s and 1s
    const encoded = await app.getEncodedOutputValue();
    expect(encoded).toMatch(/^[01]+$/);
    expect(encoded.length).toBeGreaterThan(0);

    // Tree SVG should contain node & line elements (child count > 0)
    const svgChildren = await app.getTreeSvgChildCount();
    expect(svgChildren).toBeGreaterThan(0);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);

    // No console.error occurrences
    const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Single-character input assigns code "0" and encoded output repeats "0"', async ({ page }) => {
    const app = new HuffmanPage(page);
    await app.goto();

    // Input only 'aaaa'
    await app.fillInput('aaaa');
    await app.clickEncode();
    await app.waitForResultsVisible(2000);

    // Code table should contain exactly one entry and the code should be '0'
    const codeData = await app.getCodeData();
    expect(codeData.length).toBe(1);
    expect(codeData[0].code).toBe('0');

    // Encoded output should be '0000'
    const encoded = await app.getEncodedOutputValue();
    expect(encoded).toBe('0'.repeat(4));

    // SVG should have at least one node (leaf)
    const svgChildren = await app.getTreeSvgChildCount();
    expect(svgChildren).toBeGreaterThan(0);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Re-encoding clears previous outputs (clearOutputs is invoked between transitions)', async ({ page }) => {
    const app = new HuffmanPage(page);
    await app.goto();

    // 1) Encode first input
    await app.fillInput('ab'); // two distinct chars
    await app.clickEncode();
    await app.waitForResultsVisible(2000);

    const firstFreq = await app.getFreqData();
    const firstCode = await app.getCodeData();
    const firstEncoded = await app.getEncodedOutputValue();

    expect(firstFreq.length).toBe(2);
    expect(firstCode.length).toBe(2);
    expect(firstEncoded.length).toBeGreaterThan(0);

    // 2) Change input to a different string and encode again
    // This should clear previous outputs and populate with new data
    await app.fillInput('ccc'); // single character repeated
    // Prepare to click again
    await app.clickEncode();
    await app.waitForResultsVisible(2000);

    // After second encode, frequency table should reflect new input only
    const secondFreq = await app.getFreqData();
    const secondCode = await app.getCodeData();
    const secondEncoded = await app.getEncodedOutputValue();

    // New freq table should have 1 row (only 'c' with freq 3)
    expect(secondFreq.length).toBe(1);
    expect(secondFreq[0].freq).toBe('3');

    // Code table should have 1 entry with code '0' (single character case)
    expect(secondCode.length).toBe(1);
    expect(secondCode[0].code).toBe('0');

    // Encoded output should be '000'
    expect(secondEncoded).toBe('0'.repeat(3));

    // Ensure outputs changed from first encode (i.e., old rows are not present)
    expect(secondEncoded).not.toBe(firstEncoded);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console logs and page errors across interactions', async ({ page }) => {
    const app = new HuffmanPage(page);
    await app.goto();

    // Interact: valid encoding to produce logs if any
    await app.fillInput('hello world');
    await app.clickEncode();
    await app.waitForResultsVisible(3000);

    // Ensure we captured console messages (can be zero) and that no uncaught errors were thrown
    // We assert that pageErrors remain empty (no runtime exceptions)
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console messages with type 'error' (would indicate runtime issues)
    const errors = consoleMessages.filter((m) => m.type === 'error');
    expect(errors.length).toBe(0);

    // Also assert console messages are strings and captured in an array (basic sanity)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});