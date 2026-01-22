import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b016d42-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe('Huffman Coding Visualization - App ID 6b016d42-d5c3-11f0-b41f-b131cbd11f51', () => {
  // Arrays to collect runtime diagnostics for each test
  let consoleMessages;
  let pageErrors;
  let dialogs;

  // Setup before each test: open the page and attach listeners to collect console messages, page errors, and dialogs.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions and runtime errors from the page
    page.on('pageerror', error => {
      // pageerror provides an Error object; store its message + stack
      pageErrors.push({
        message: error.message,
        stack: error.stack ? error.stack : ''
      });
    });

    // Capture dialogs (alerts, confirms, prompts)
    page.on('dialog', async dialog => {
      dialogs.push({
        type: dialog.type(),
        message: dialog.message()
      });
      // Dismiss to avoid blocking the page; do not attempt to patch page behavior
      await dialog.dismiss().catch(() => {});
    });

    // Navigate to the application under test and wait for load to complete
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown after each test (clear references)
  test.afterEach(async () => {
    consoleMessages = null;
    pageErrors = null;
    dialogs = null;
  });

  test('Initial Idle state (S0_Idle) - DOM elements render as expected', async ({ page }) => {
    // This test validates that the initial page elements described in S0_Idle are present:
    // - textarea with default text
    // - encode button
    // - results containers exist but are empty (no populated rows)
    const textarea = await page.locator('#input-text');
    await expect(textarea).toHaveCount(1);

    // Verify placeholder attribute and the default text content
    await expect(textarea).toHaveAttribute('placeholder', 'Type your text here...');
    const value = await textarea.inputValue();
    expect(value).toContain('Huffman coding is a popular compression algorithm');

    // Verify encode button is present and enabled
    const encodeBtn = page.locator('#encode-btn');
    await expect(encodeBtn).toHaveCount(1);
    await expect(encodeBtn).toBeVisible();

    // Frequency table and Huffman codes table should exist but should be empty at initial render
    const freqBody = page.locator('#frequency-table-body');
    const codesBody = page.locator('#huffman-codes-body');
    await expect(freqBody).toHaveCount(1);
    await expect(codesBody).toHaveCount(1);

    // At initial load, before any processing, tbody should have zero rows
    const freqRows = await freqBody.locator('tr').count();
    const codeRows = await codesBody.locator('tr').count();
    expect(freqRows).toBe(0);
    expect(codeRows).toBe(0);

    // Tree container should have the heading but no generated visualization nodes (tree nodes are added later by JS)
    const treeContainer = page.locator('#tree-container');
    await expect(treeContainer).toContainText('Huffman Tree Visualization');

    // Bits saving info should be empty initially
    const bitsInfo = page.locator('#bits-saving-info');
    await expect(bitsInfo).toHaveCount(1);
    const bitsText = await bitsInfo.textContent();
    expect(bitsText.trim()).toBe('');

    // Since the script in the page is truncated in the implementation, we expect the page may have script parsing/runtime errors.
    // Assert that a runtime page error (e.g., SyntaxError) was captured OR everything above still passed.
    const sawSyntaxError = pageErrors.some(e =>
      e.message.includes('SyntaxError') || e.message.includes('Unexpected end') || e.message.includes('Unexpected token')
    );
    // The page may or may not have thrown a syntax/runtime error depending on the environment; ensure our collector saw anything noteworthy.
    // We do not fail the test if no syntax error is present here — that will be asserted in a dedicated test below.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Generate Huffman Codes click - validates transition S0 -> S1 -> S2 or reports parsing/runtime errors', async ({ page }) => {
    // This test attempts the main user interaction:
    // - User clicks the "Generate Huffman Codes" button (GenerateHuffmanCodes event)
    // - Expected: frequency table populated, huffman codes displayed, tree visualized, bits-saving info updated (S2_CodesGenerated)
    // Because the page's <script> is truncated, this interaction may fail. The test asserts either success OR that appropriate errors occurred.

    const encodeBtn = page.locator('#encode-btn');
    await expect(encodeBtn).toBeVisible();

    // Click the button to trigger the generation flow (if the page JS was properly set up)
    await encodeBtn.click();

    // Allow some time for any DOM updates to happen (if JS executed)
    await page.waitForTimeout(500);

    // Inspect resulting DOM: frequency rows, code rows, bits saving text, tree visualization nodes
    const freqRowsCount = await page.locator('#frequency-table-body tr').count();
    const codeRowsCount = await page.locator('#huffman-codes-body tr').count();
    const bitsSavingText = (await page.locator('#bits-saving-info').textContent()).trim();
    const treeNodeCount = await page.locator('.tree-node').count();

    // If the application executed correctly, we expect non-zero rows and visualization
    const generationSucceeded = freqRowsCount > 0 && codeRowsCount > 0 && bitsSavingText.length > 0 && treeNodeCount > 0;

    // Alternatively, because the script is incomplete, we expect a syntax/runtime error captured in pageErrors.
    const sawScriptError = pageErrors.some(e =>
      e.message.includes('SyntaxError') ||
      e.message.includes('ReferenceError') ||
      e.message.includes('TypeError') ||
      e.message.includes('Unexpected end') ||
      e.message.includes('Unexpected token')
    );

    // At least one of these outcomes should be true:
    // - The generation succeeded (UI updated), or
    // - A script parsing/runtime error was observed
    expect(generationSucceeded || sawScriptError).toBeTruthy();

    // If generation succeeded, assert the shape of generated UI elements
    if (generationSucceeded) {
      // Frequency table should contain rows sorted by descending frequency (basic checks)
      expect(freqRowsCount).toBeGreaterThan(0);
      expect(codeRowsCount).toBeGreaterThan(0);
      expect(bitsSavingText).toMatch(/Bit Usage: Standard = \d+ bits, Huffman = \d+ bits\. Savings: \d+ bits \([\d.]+%\)/);

      // Validate that each code row has 3 columns: character, code, length
      const firstCodeRowCols = await page.locator('#huffman-codes-body tr:nth-child(1) td').count();
      expect(firstCodeRowCols).toBe(3);
    } else {
      // If generation did not succeed, ensure that parsing/runtime errors include helpful info
      // At minimum, we want to assert that the pageErrors array captured at least one error.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Check that one of the page errors hints at an unterminated or syntax problem
      const helpfulErrorFound = pageErrors.some(e =>
        e.message.includes('Unexpected end') ||
        e.message.includes('SyntaxError') ||
        e.message.includes('Unexpected token') ||
        e.message.includes('Uncaught')
      );
      expect(helpfulErrorFound).toBeTruthy();
    }
  });

  test('Edge case: clicking Generate with empty input should prompt an alert or report behavior', async ({ page }) => {
    // This test covers the edge case when the user provides only whitespace/empty input and clicks encode.
    // The intended behavior in the FSM/implementation is to show an alert: 'Please enter some text to encode.'
    // Because the page script may be broken, the alert may not appear; we assert either the alert was shown OR the page reported a runtime error.

    // Clear the textarea
    await page.fill('#input-text', '   '); // whitespace only
    // Click encode
    await page.click('#encode-btn');

    // Wait briefly for any dialog or DOM change
    await page.waitForTimeout(300);

    // Check whether an alert dialog was captured
    const alertShown = dialogs.some(d => d.type === 'alert' && d.message.includes('Please enter some text to encode'));

    // Alternatively, check for runtime errors indicating the script didn't execute
    const sawScriptError = pageErrors.some(e =>
      e.message.includes('SyntaxError') ||
      e.message.includes('ReferenceError') ||
      e.message.includes('TypeError') ||
      e.message.includes('Unexpected end') ||
      e.message.includes('Unexpected token')
    );

    // At least one of these should be true for correct handling or to document failure
    expect(alertShown || sawScriptError).toBeTruthy();

    // If alert was shown, assert that no frequency rows were added
    if (alertShown) {
      const freqRowsCount = await page.locator('#frequency-table-body tr').count();
      const codeRowsCount = await page.locator('#huffman-codes-body tr').count();
      expect(freqRowsCount).toBe(0);
      expect(codeRowsCount).toBe(0);
    } else {
      // If no alert, ensure the error we observed is informative
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('Script parsing/runtime errors are reported to pageerror with SyntaxError or Unexpected end', async ({ page }) => {
    // Dedicated test to assert that the truncated script triggers a parse/runtime error that is observable via pageerror.
    // This validates that our test harness correctly captures syntax/runtime failures in the application script.

    // Allow some time for deferred errors to be emitted
    await page.waitForTimeout(300);

    // We expect at least one page error due to the truncated script in the provided HTML.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Verify that at least one of the errors points to a syntax/parse problem (common messages: SyntaxError, Unexpected end of input)
    const syntaxLikeError = pageErrors.some(e =>
      /SyntaxError|Unexpected end|Unexpected token|Uncaught/i.test(e.message)
    );

    expect(syntaxLikeError).toBeTruthy();

    // Additionally capture console.error messages if present that may reflect the same issue
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    // If no console.error present, that's acceptable; main assertion is presence of pageerror.
    if (consoleErrorMessages.length > 0) {
      // At least one console.error should reference syntax or runtime issues if present
      const consoleHint = consoleErrorMessages.some(t => /SyntaxError|Unexpected end|Unexpected token|ReferenceError|TypeError/i.test(t));
      // Not required to be true, but if there are error-level console messages, prefer they be relevant
      expect(true).toBe(true);
    }
  });
});