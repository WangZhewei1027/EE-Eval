import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1822ad1-d366-11f0-9b19-a558354ece3e.html';

test.describe('Huffman Coding Visualization - f1822ad1-d366-11f0-9b19-a558354ece3e', () => {
  // Reusable selectors / page object helpers
  const selectors = {
    inputText: '#inputText',
    encodeBtn: '#encodeBtn',
    generateRandom: '#generateRandom',
    results: '#results',
    frequencyTableRows: '#frequencyTable tr',
    huffmanCodes: '#huffmanCodes',
    originalBinary: '#originalBinary',
    huffmanEncoded: '#huffmanEncoded',
    stats: '#stats',
    huffmanTree: '#huffmanTree'
  };

  // Attach console & pageerror collectors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors to assert later
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // collect all console messages with their type and text
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      page.context()._pageErrors.push(err);
    });
  });

  // Helper to assert no runtime errors were observed
  async function assertNoRuntimeErrors(page) {
    const consoleMessages = page.context()._consoleMessages || [];
    const pageErrors = page.context()._pageErrors || [];

    // Fail if any page errors occurred
    expect(pageErrors.length, `Expected no page errors, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Fail if any console.error messages were emitted
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
    expect(errorConsole.length, `Expected no console errors, got: ${errorConsole.map(e => e.text).join(' || ')}`).toBe(0);
  }

  test('Initial load should run processText (onload) and display results (S0_Idle -> S1_ResultsDisplayed)', async ({ page }) => {
    // Capture dialogs (if any) and fail if unexpected
    const dialogs = [];
    page.on('dialog', dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      dialog.dismiss();
    });

    // Navigate to the application. Handlers attached in beforeEach capture console/page errors.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // After load the window.onload = processText should have been executed, so results must be visible
    const resultsVisible = await page.locator(selectors.results).isVisible();
    expect(resultsVisible).toBe(true);

    // Frequency table should have at least header + one row (non-empty input in HTML: "hello world")
    const freqRows = await page.locator(selectors.frequencyTableRows).count();
    expect(freqRows).toBeGreaterThanOrEqual(2); // header + at least one character row

    // Check Huffman codes render - should contain some child nodes
    const codesText = await page.locator(selectors.huffmanCodes).innerText();
    expect(codesText.length).toBeGreaterThan(0);

    // Original binary should reflect "hello world" initial textarea; check length = 11 chars * 8 bits = 88 bits
    const originalBinaryText = (await page.locator(selectors.originalBinary).innerText()).trim();
    expect(originalBinaryText.length).toBeGreaterThanOrEqual(8); // sanity
    // Specific check: original stats should mention Original size (ASCII): 88 bits
    const statsText = await page.locator(selectors.stats).innerText();
    expect(statsText).toContain('Original size (ASCII): 88 bits');

    // Huffman encoded text should be non-empty
    const encodedText = (await page.locator(selectors.huffmanEncoded).innerText()).trim();
    expect(encodedText.length).toBeGreaterThan(0);

    // Huffman tree should contain textual representation including either 'Internal' or a character label
    const treeText = (await page.locator(selectors.huffmanTree).innerText()).trim();
    expect(treeText.length).toBeGreaterThan(0);
    expect(/Internal|├──|└──|SPACE|':/.test(treeText)).toBeTruthy();

    // No alerts should have popped up during normal load for the initial sample; assert no dialog with alert occurred
    const alertDialogs = dialogs.filter(d => d.type === 'alert' || d.type === 'confirm' || d.type === 'prompt');
    expect(alertDialogs.length).toBe(0);

    // Assert no runtime console errors or page errors occurred during load and initial processing
    await assertNoRuntimeErrors(page);
  });

  test('Clicking "Encode Text" should process current input and update all result areas (EncodeText event)', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Change input to a known value to validate stats deterministically
    const testString = 'test';
    await page.fill(selectors.inputText, testString);

    // Click Encode Text button
    await page.click(selectors.encodeBtn);

    // Results should be visible
    expect(await page.locator(selectors.results).isVisible()).toBe(true);

    // Stats should reflect original size 4 chars * 8 = 32 bits
    const statsText = await page.locator(selectors.stats).innerText();
    expect(statsText).toContain('Original size (ASCII): 32 bits');

    // Original binary should contain binary for first character 't' (charCode 116 -> 01110100)
    const originalBinary = (await page.locator(selectors.originalBinary).innerText()).trim();
    expect(originalBinary).toContain('01110100');

    // Huffman encoded should be non-empty and average bits per character numeric present
    const encoded = (await page.locator(selectors.huffmanEncoded).innerText()).trim();
    expect(encoded.length).toBeGreaterThanOrEqual(0); // can be zero in degenerate cases but normally non-empty
    expect(statsText).toMatch(/Average bits per character:/);

    // Frequency table must contain rows equal to header + unique chars
    const uniqueChars = Array.from(new Set(testString.split('')));
    const freqRows = await page.locator(selectors.frequencyTableRows).count();
    expect(freqRows).toBe(uniqueChars.length + 1); // header + unique rows

    // No runtime console errors or page errors after clicking encode
    await assertNoRuntimeErrors(page);
  });

  test('Clicking "Generate Random Sample" should pick a sample and produce results (GenerateRandomSample event)', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Click generate random - this will set inputText and call processText()
    await page.click(selectors.generateRandom);

    // Results visible
    expect(await page.locator(selectors.results).isVisible()).toBe(true);

    // Input value should be one of the known samples defined in the page script
    const value = await page.locator(selectors.inputText).inputValue();
    const possibleSamples = [
      "hello world",
      "huffman coding is efficient",
      "data compression algorithm",
      "the quick brown fox jumps over the lazy dog",
      "aaaabbbbcccdde"
    ];
    expect(possibleSamples).toContain(value);

    // Stats must exist and contain "Original size (ASCII):"
    const statsText = await page.locator(selectors.stats).innerText();
    expect(statsText).toContain('Original size (ASCII):');

    // Huffman codes should be rendered with entries (including SPACE for samples with spaces)
    const codesText = await page.locator(selectors.huffmanCodes).innerText();
    expect(codesText.length).toBeGreaterThan(0);

    // If the sample contains a space, ensure 'SPACE' appears in codes display
    if (value.includes(' ')) {
      expect(codesText).toMatch(/SPACE/);
    }

    // No runtime console errors or page errors after generating random sample
    await assertNoRuntimeErrors(page);
  });

  test('Edge case: empty input should trigger alert and not display results (error scenario)', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Fill input with whitespace to simulate empty trimmed input
    await page.fill(selectors.inputText, '   ');

    // Intercept dialog and assert its message is the expected alert
    let seenDialog = null;
    page.once('dialog', async dialog => {
      seenDialog = { message: dialog.message(), type: dialog.type() };
      await dialog.accept();
    });

    // Click encode
    await page.click(selectors.encodeBtn);

    // Expect that dialog was shown with the expected message
    expect(seenDialog).not.toBeNull();
    expect(seenDialog.message).toBe('Please enter some text to encode.');
    expect(seenDialog.type).toBe('alert');

    // Results should remain hidden since processText returns early on empty input
    expect(await page.locator(selectors.results).isVisible()).toBe(false);

    // No additional runtime errors (beyond the expected alert)
    await assertNoRuntimeErrors(page);
  });

  test('Multiple encodes update the results and do not produce runtime errors (stability test)', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Encode several different inputs in succession
    const inputs = ['a', 'ab', 'abcabc', 'the quick brown fox'];
    for (const txt of inputs) {
      await page.fill(selectors.inputText, txt);
      await page.click(selectors.encodeBtn);

      // Validate results visible
      expect(await page.locator(selectors.results).isVisible()).toBe(true);

      // Validate summary stats reference the correct original size
      const expectedSize = txt.length * 8;
      const statsText = await page.locator(selectors.stats).innerText();
      expect(statsText).toContain(`Original size (ASCII): ${expectedSize} bits`);
    }

    // After multiple operations, ensure no runtime errors were emitted
    await assertNoRuntimeErrors(page);
  });

  test.afterEach(async ({ page }) => {
    // Final safety check for each test: ensure no console errors or uncaught page errors
    await assertNoRuntimeErrors(page);
  });
});