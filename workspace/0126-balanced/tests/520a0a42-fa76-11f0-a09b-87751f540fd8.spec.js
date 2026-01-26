import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a0a42-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Process FSM - 520a0a42-fa76-11f0-a09b-87751f540fd8', () => {
  // Arrays to collect console messages and uncaught page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console logs (info/debug/log/warn/error) emitted by the page
    page.on('console', (msg) => {
      // Normalize: include type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions (pageerror)
    page.on('pageerror', (err) => {
      // err is an Error object; capture its message for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the application page exactly as provided
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Clear arrays to avoid cross-test leakage (though new arrays are created beforeEach)
    consoleMessages = [];
    pageErrors = [];
  });

  test('Idle state: output element exists and is initially empty', async ({ page }) => {
    // Validate presence of the evidence specified in the FSM for Idle state:
    // There should be an <h1 id="output"></h1> and its text content should be empty.
    const output = await page.locator('#output');
    await expect(output).toHaveCount(1);
    await expect(output).toHaveText(''); // empty string expected initially
  });

  test('Page script throws an error due to missing #input element (verify runtime error)', async () => {
    // The implementation attempts to do: const input = document.getElementById('input'); input.addEventListener(...)
    // Since #input is not present in the HTML, a TypeError should be thrown during script execution.
    // Assert that at least one pageerror was captured and its message indicates the missing element/addEventListener issue.
    // We allow for different engine messages, so test with a flexible regex.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Check that at least one error message mentions addEventListener or reading properties of null
    const matched = pageErrors.some((m) =>
      /addEventListener|Cannot read properties of null|Cannot read property 'addEventListener'|reading 'addEventListener'/i.test(m)
    );
    expect(matched).toBeTruthy();
  });

  test('Attempting to interact with the missing input element fails (InputData event cannot be triggered)', async ({ page }) => {
    // The FSM expects an InputData event via #input. Since #input is absent, interacting should fail.
    // Validate the DOM shows no such input and that programmatic fill throws.
    const inputLocator = page.locator('#input');
    await expect(inputLocator).toHaveCount(0);

    // Attempt to fill and assert an error occurred (fill should reject / throw).
    let fillError = null;
    try {
      await page.fill('#input', 'test');
    } catch (e) {
      fillError = e;
    }
    expect(fillError).toBeTruthy();
  });

  test('Processing(state S1) via direct process() call logs "Processing" and "Processing completed." for short inputs', async ({ page }) => {
    // Because the input handler is not attached (missing #input), we directly call the page's process function
    // to validate the S1_Processing entry action and transition to S3_Completed for data.length <= 10.
    // Capture console messages emitted during the call and assert expected logs appear.

    // Clear any earlier console messages
    consoleMessages = [];

    // Ensure process is defined on the page, then call it with a short string
    const hasProcess = await page.evaluate(() => typeof process === 'function');
    expect(hasProcess).toBeTruthy();

    // Call process('hello') which should log "Processing: hello" and "Processing completed."
    await page.evaluate(() => process('hello'));

    // A short wait to ensure console messages are received
    await page.waitForTimeout(50);

    // Find logs relevant to this invocation
    const texts = consoleMessages.map((c) => c.text);
    // Expect "Processing: hello" and "Processing completed." present
    const procLog = texts.find((t) => /Processing:\s*hello/i.test(t));
    const completedLog = texts.find((t) => /Processing completed\./i.test(t));
    expect(procLog).toBeTruthy();
    expect(completedLog).toBeTruthy();
  });

  test('Processing transitions to Too Long (S2) when data.length > 10 (direct process call)', async ({ page }) => {
    // Call process with a string longer than 10 characters and assert "Processing too long." is logged
    consoleMessages = [];

    // Use a string of length 11
    const longString = 'abcdefghijkl'; // length 12 to be safe

    await page.evaluate((s) => process(s), longString);

    await page.waitForTimeout(50);

    const texts = consoleMessages.map((c) => c.text);
    const processingLog = texts.find((t) => new RegExp(`Processing:\\s*${longString}`).test(t));
    const tooLongLog = texts.find((t) => /Processing too long\./i.test(t));
    const completedLog = texts.find((t) => /Processing completed\./i.test(t));

    // Verify that the process ran and logged "Processing: <data>"
    expect(processingLog).toBeTruthy();
    // Because length > 10, it should log "Processing too long."
    expect(tooLongLog).toBeTruthy();
    // And it should NOT log "Processing completed."
    expect(completedLog).toBeFalsy();
  });

  test('Processing transitions to Completed (S3) when data.length <= 10 (edge: length exactly 10)', async ({ page }) => {
    // For edge case where length == 10, guard says data.length <= 10 => Completed
    consoleMessages = [];

    const exact10 = '1234567890'; // length 10
    await page.evaluate((s) => process(s), exact10);

    await page.waitForTimeout(50);

    const texts = consoleMessages.map((c) => c.text);
    const procLog = texts.find((t) => /Processing:\s*1234567890/.test(t));
    const completedLog = texts.find((t) => /Processing completed\./i.test(t));
    const tooLongLog = texts.find((t) => /Processing too long\./i.test(t));

    expect(procLog).toBeTruthy();
    expect(completedLog).toBeTruthy();
    // Ensure "Too long" is not emitted for length == 10
    expect(tooLongLog).toBeFalsy();
  });

  test('Process does not modify the #output element (visual feedback remains empty)', async ({ page }) => {
    // The implementation logs to console but does not update the DOM output element.
    // Verify that after calling process, the output element still has no text content.
    const output = page.locator('#output');
    await expect(output).toHaveCount(1);

    // Call process with a short string
    await page.evaluate(() => process('visiblecheck'));

    // Wait briefly for any potential DOM changes (there should be none)
    await page.waitForTimeout(50);

    // Assert the h1#output remains empty as in the original HTML evidence
    await expect(output).toHaveText('');
  });

  test('Documented input handler message ("Please enter some data.") cannot be triggered because #input is missing', async ({ page }) => {
    // The implementation logs "Please enter some data." inside the input handler when empty input is given.
    // Because the input element is absent, that handler is not attached and the message should not appear in console logs.
    // We assert that among captured logs, there is no "Please enter some data." message.
    const found = consoleMessages.some((c) => /Please enter some data\./i.test(c.text));
    expect(found).toBeFalsy();
  });
});