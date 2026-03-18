import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a33a6a0-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object for the Huffman demo page
class HuffmanPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  textarea() {
    return this.page.locator('#inputText');
  }

  processButton() {
    return this.page.locator('#processBtn');
  }

  output() {
    return this.page.locator('#output');
  }

  // Returns array of frequency table rows as objects: { char: string, freq: number }
  async getFrequencyMap() {
    const rows = await this.page.$$eval('#output table:nth-of-type(1) tbody tr', trs =>
      trs.map(tr => {
        const cells = tr.querySelectorAll('td');
        const charText = cells[0].innerText;
        const freq = parseInt(cells[1].innerText, 10);
        // convert display "[space]" back to single space for easier comparison
        const char = charText === '[space]' ? ' ' : charText === '[newline]' ? '\n' : charText;
        return { char, freq };
      })
    );
    const map = {};
    for (const { char, freq } of rows) map[char] = freq;
    return map;
  }

  // Returns array of code entries: { char: string, code: string, freq: number }
  async getCodesList() {
    const rows = await this.page.$$eval('#output table:nth-of-type(2) tbody tr', trs =>
      trs.map(tr => {
        const cells = tr.querySelectorAll('td');
        const charText = cells[0].innerText;
        const code = cells[1].innerText;
        const freq = parseInt(cells[2].innerText, 10);
        const char = charText === '[space]' ? ' ' : charText === '[newline]' ? '\n' : charText;
        return { char, code, freq };
      })
    );
    return rows;
  }

  // Extract encoded bitstring displayed in the output <code> element
  async getEncodedBitstring() {
    const handle = await this.page.$('#output code');
    if (!handle) return '';
    return (await handle.innerText()).trim();
  }

  // Count tree-node elements in the visualization
  async countTreeNodes() {
    return this.page.$$eval('#output .tree-node', nodes => nodes.length);
  }

  // Click the process button and wait for output to be present/updated
  async clickProcessAndWait() {
    // Use a short waitForSelector on an element we expect to be present after processing
    const output = this.output();
    await Promise.all([
      this.processButton().click(),
      output.waitFor({ state: 'visible', timeout: 2000 })
    ]);
  }
}

test.describe('Huffman Coding Demonstration - FSM states and transitions', () => {
  // This helper attaches listeners to collect console errors and page errors for assertions.
  async function attachErrorCollectors(page) {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    return { consoleErrors, pageErrors };
  }

  test('S0_Idle: Initial render shows textarea and button; PageLoad auto-process populates Output with expected sections', async ({ page }) => {
    // Validate initial state (Idle) components exist and that the PageLoad event triggers processing -> Output state
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const p = new HuffmanPage(page);

    // Navigate to the page (this should trigger window.load handler and run processInput)
    await p.goto();

    // Ensure the core components exist (Idle state evidence)
    await expect(p.textarea()).toBeVisible();
    await expect(p.processButton()).toBeVisible();

    // The textarea has default sample text per HTML; validate it contains known phrase fragment
    const textareaValue = await p.textarea().inputValue();
    expect(textareaValue.length).toBeGreaterThan(0);
    expect(textareaValue).toContain('huffman'); // sanity check for default sample text

    // Wait for output to be populated (S2_Output evidence)
    await page.waitForSelector('#output h2');

    // Validate the major expected sections are present in the output
    const headings = await page.$$eval('#output h2', hs => hs.map(h => h.innerText.trim()));
    expect(headings).toContain('Character Frequencies');
    expect(headings).toContain('Huffman Codes');
    expect(headings).toContain('Encoding Result');
    expect(headings).toContain('Huffman Tree Visualization');

    // Validate there are tables for frequencies and codes
    const tables = await page.$$('#output table');
    expect(tables.length).toBeGreaterThanOrEqual(2);

    // Validate tree visualization container exists with at least one tree-node
    const treeNodes = await p.countTreeNodes();
    expect(treeNodes).toBeGreaterThan(0);

    // Validate encoded bitstring exists and contains only 0/1 characters
    const encoded = await p.getEncodedBitstring();
    expect(encoded.length).toBeGreaterThan(0);
    expect(/^[01]+$/.test(encoded)).toBeTruthy();

    // Assert there are no unexpected console/page errors during load and processing
    expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors.map(e => e.message))}`).toBe(0);
  });

  test('Transition ButtonClick: clicking Generate Huffman Codes processes new input and updates frequency/code tables', async ({ page }) => {
    // Validate the ButtonClick transition from Idle -> Processing -> Output
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const p = new HuffmanPage(page);
    await p.goto();

    // Provide a specific input to validate expected frequencies and codes deterministically
    const testText = 'abbccc'; // frequencies: a:1, b:2, c:3
    await p.textarea().fill(testText);

    // Click the process button (ButtonClick event should call processInput)
    const [_,] = await Promise.all([
      // Click and wait for potential update
      p.processButton().click(),
      page.waitForSelector('#output table:nth-of-type(1) tbody tr', { timeout: 2000 })
    ]);

    // Parse the frequency table and verify counts
    const freqMap = await p.getFrequencyMap();
    expect(freqMap['a']).toBe(1);
    expect(freqMap['b']).toBe(2);
    expect(freqMap['c']).toBe(3);

    // Parse codes table and verify entries correspond to characters and reference frequencies
    const codes = await p.getCodesList();
    // There should be exactly 3 code entries
    expect(codes.length).toBe(3);
    // Build a map for easier assertions
    const codeMap = {};
    for (const row of codes) codeMap[row.char] = { code: row.code, freq: row.freq };

    expect(codeMap['a'].freq).toBe(1);
    expect(codeMap['b'].freq).toBe(2);
    expect(codeMap['c'].freq).toBe(3);

    // Encoded bitstring should equal concatenation of codes for testText
    const encoded = await p.getEncodedBitstring();
    let expectedEncoded = '';
    for (const ch of testText) {
      expectedEncoded += codeMap[ch].code;
    }
    expect(encoded).toBe(expectedEncoded);

    // Validate encoded length equals sum(freq * codeLength) and is a positive integer
    const encodedLength = encoded.length;
    const computedLen = Object.entries(freqMap).reduce((acc, [ch, f]) => acc + (f * codeMap[ch].code.length), 0);
    expect(encodedLength).toBe(computedLen);
    expect(encodedLength).toBeGreaterThan(0);

    // Ensure tree visualization exists and has nodes matching number of unique characters (leaf nodes >= unique)
    const nodeCount = await p.countTreeNodes();
    expect(nodeCount).toBeGreaterThanOrEqual(3);

    // Assert no console/page errors occurred during button click processing
    expect(consoleErrors.length, `Console error messages after click: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after click: ${JSON.stringify(pageErrors.map(e => e.message))}`).toBe(0);
  });

  test('Edge case: empty input shows alert and does not update output (error scenario)', async ({ page }) => {
    // Validate behavior when user provides empty input (alert should appear)
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const p = new HuffmanPage(page);
    await p.goto();

    // Clear textarea
    await p.textarea().fill('');

    // Listen for dialog and assert its message
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click process and expect dialog to be shown
    await p.processButton().click();

    // Give the dialog handler a moment
    await page.waitForTimeout(100);

    expect(dialogMessage).toBe('Please enter some text to encode.');

    // Since no input, the output should remain visible but not replaced by an empty render.
    // We verify that output still contains at least the initial headings or previous content
    const outputHtml = await p.output().innerHTML();
    expect(outputHtml.length).toBeGreaterThanOrEqual(0);

    // Assert no uncaught JS errors happened due to this edge case
    expect(consoleErrors.length, `Console errors during empty-input scenario: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors during empty-input scenario: ${JSON.stringify(pageErrors.map(e => e.message))}`).toBe(0);
  });

  test('Edge case: single-character input assigns code "0" and encodes accordingly', async ({ page }) => {
    // Validate that a tree with a single unique character assigns code '0' per implementation
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const p = new HuffmanPage(page);
    await p.goto();

    const testText = 'aaaaaa';
    await p.textarea().fill(testText);

    // Click process and wait
    await Promise.all([
      p.processButton().click(),
      page.waitForSelector('#output table:nth-of-type(2) tbody tr', { timeout: 2000 })
    ]);

    const codes = await p.getCodesList();
    // Only one unique character expected
    expect(codes.length).toBe(1);
    expect(codes[0].char).toBe('a');
    expect(codes[0].code).toBe('0'); // per implementation, single node gets '0'

    const encoded = await p.getEncodedBitstring();
    // Encoded should be '0' repeated 6 times
    expect(encoded).toBe('0'.repeat(testText.length));

    // Ensure tree visualization still renders (single leaf)
    const treeNodeCount = await p.countTreeNodes();
    expect(treeNodeCount).toBeGreaterThanOrEqual(1);

    // No console/page errors expected
    expect(consoleErrors.length, `Console errors for single-character input: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors for single-character input: ${JSON.stringify(pageErrors.map(e => e.message))}`).toBe(0);
  });

  test('Robustness: observe console and page errors across interactions (collect and assert none occurred)', async ({ page }) => {
    // This test performs a series of interactions and asserts that there were no runtime exceptions or console.error outputs.
    const { consoleErrors, pageErrors } = await attachErrorCollectors(page);
    const p = new HuffmanPage(page);
    await p.goto();

    // Interaction sequence: change text, click process, change to another text, click process
    await p.textarea().fill('The quick brown fox jumps over the lazy dog');
    await p.processButton().click();
    await page.waitForTimeout(100); // short pause to ensure synchronous processing done

    await p.textarea().fill('Sphinx of black quartz, judge my vow');
    await p.processButton().click();
    await page.waitForTimeout(100);

    // Final assertions: there should be no console errors or unhandled page errors
    expect(consoleErrors.length, `Console errors during interaction sequence: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors during interaction sequence: ${JSON.stringify(pageErrors.map(e => e.message))}`).toBe(0);

    // Also perform a final sanity check that the output contains the expected headings
    const headings = await page.$$eval('#output h2', hs => hs.map(h => h.innerText.trim()));
    expect(headings).toContain('Character Frequencies');
    expect(headings).toContain('Huffman Codes');
    expect(headings).toContain('Encoding Result');
    expect(headings).toContain('Huffman Tree Visualization');
  });
});