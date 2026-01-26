import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a38432-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('Understanding Encryption - Caesar Cipher FSM (d5a38432-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Shared state for collecting console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (log, error, warn, etc.)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore if something unexpected happens while reading console
      }
    });

    // Collect unhandled page errors (ReferenceError, TypeError, SyntaxError, runtime errors)
    page.on('pageerror', error => {
      try {
        pageErrors.push({ message: error.message, stack: error.stack });
      } catch (e) {
        // ignore
      }
    });

    // Go to the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown modifications to the page; arrays reset in beforeEach
  });

  test('Initial Idle state: page renders, button present, renderPage onEnter absent', async ({ page }) => {
    // This test validates the Idle (S0_Idle) state:
    // - The page content loads
    // - The demo button exists and has the expected text and onclick attribute
    // - The FSM-specified entry action renderPage() is not defined in the global scope (verify absence)
    // - No unexpected runtime page errors were emitted during load

    // Button presence and attributes
    const demoButton = page.locator('.demo-button');
    await expect(demoButton).toHaveCount(1);
    await expect(demoButton).toHaveText('Encrypt a Word');

    // Check onclick attribute points to the expected handler name string (per the HTML)
    const onclickAttr = await demoButton.getAttribute('onclick');
    expect(onclickAttr).toBe('demonstrateCaesarCipher()');

    // Output element should exist and be empty initially
    const output = page.locator('#demo-output');
    await expect(output).toHaveCount(1);
    await expect(output).toHaveText('', { timeout: 1000 });

    // Verify the FSM entry action renderPage() is not defined on the window object
    // (the FSM mentioned renderPage(); since the page implements UI directly, the function may be absent)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Ensure there were no page errors (ReferenceError, TypeError, SyntaxError, etc.) upon initial load
    expect(pageErrors.length).toBe(0);

    // Also check that no console messages of type 'error' were logged
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S0 -> S1 -> S2: Clicking button triggers prompt and displays encrypted HELLO -> KHOOR', async ({ page }) => {
    // This test exercises the main happy path:
    // - Clicking the Encrypt button triggers a prompt (S1_Encrypting)
    // - Providing "HELLO" results in the encrypted text "KHOOR" shown in #demo-output (S2_Encrypted)
    let dialogFired = false;

    page.once('dialog', async dialog => {
      dialogFired = true;
      // Simulate user entering "HELLO" and accepting the prompt
      await dialog.accept('HELLO');
    });

    // Click the button to start the transition
    await page.click('.demo-button');

    // After accepting the prompt, DOM should update with encrypted result
    const output = page.locator('#demo-output');
    await expect(output).toHaveText('Encrypted word: KHOOR', { timeout: 2000 });

    // Verify we did get a dialog event (prompt)
    expect(dialogFired).toBe(true);

    // Ensure no runtime page errors occurred during the interaction
    expect(pageErrors.length).toBe(0);

    // Ensure console did not report errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Prompt dismissed: canceling prompt leaves output unchanged', async ({ page }) => {
    // This test covers the edge case where the user cancels the prompt (dialog.dismiss()).
    // Expected behavior: the function returns null and code path should not update #demo-output.

    // Ensure output starts empty
    const output = page.locator('#demo-output');
    await expect(output).toHaveText('', { timeout: 1000 });

    let dialogFired = false;
    page.once('dialog', async dialog => {
      dialogFired = true;
      // Simulate user cancelling the prompt
      await dialog.dismiss();
    });

    // Click the button and dismiss the prompt
    await page.click('.demo-button');

    // Wait a short while to let any potential DOM updates occur
    await page.waitForTimeout(300);

    // Output should remain empty because the implementation checks if (word) { ... }
    await expect(output).toHaveText('', { timeout: 1000 });

    expect(dialogFired).toBe(true);
    expect(pageErrors.length).toBe(0);
  });

  test('Empty string input: entering empty string does not update output', async ({ page }) => {
    // Edge case: user submits an empty string ("") in the prompt.
    // Since the code checks if (word), an empty string should not produce output.

    const output = page.locator('#demo-output');
    await expect(output).toHaveText('', { timeout: 1000 });

    let dialogFired = false;
    page.once('dialog', async dialog => {
      dialogFired = true;
      // Accept with an empty string
      await dialog.accept('');
    });

    await page.click('.demo-button');

    // Wait to ensure no DOM update occurs
    await page.waitForTimeout(300);

    await expect(output).toHaveText('', { timeout: 1000 });
    expect(dialogFired).toBe(true);
    expect(pageErrors.length).toBe(0);
  });

  test('Non-alphabet characters are preserved and case is preserved in encryption', async ({ page }) => {
    // Test mixed-case and non-alphabet characters: "Abc-Z" -> "Def-C"
    let dialogFired = false;
    page.once('dialog', async dialog => {
      dialogFired = true;
      await dialog.accept('Abc-Z');
    });

    await page.click('.demo-button');

    const output = page.locator('#demo-output');
    await expect(output).toHaveText('Encrypted word: Def-C', { timeout: 2000 });

    expect(dialogFired).toBe(true);
    expect(pageErrors.length).toBe(0);
  });

  test('Multiple sequential encryptions update the output correctly', async ({ page }) => {
    // This test validates that the output updates on subsequent encryptions.
    // First input: "hello" -> "khoor"
    // Second input: "XYZ" -> "ABC"

    // First click with "hello"
    page.once('dialog', async dialog => {
      await dialog.accept('hello');
    });
    await page.click('.demo-button');
    const output = page.locator('#demo-output');
    await expect(output).toHaveText('Encrypted word: khoor', { timeout: 2000 });

    // Second click with "XYZ"
    page.once('dialog', async dialog => {
      await dialog.accept('XYZ');
    });
    await page.click('.demo-button');
    await expect(output).toHaveText('Encrypted word: ABC', { timeout: 2000 });

    expect(pageErrors.length).toBe(0);
  });

  test('Verify event handler presence and that the prompt-based event was invoked (evidence of transitions)', async ({ page }) => {
    // This test checks structural evidence:
    // - The button has the onclick attribute pointing to demonstrateCaesarCipher()
    // - Clicking the button results in a prompt (evidence of S1_Encrypting)
    // - The output element updates (evidence of S2_Encrypted)

    const demoButton = page.locator('.demo-button');
    const attr = await demoButton.getAttribute('onclick');
    expect(attr).toBe('demonstrateCaesarCipher()');

    let dialogSeen = false;
    page.once('dialog', async dialog => {
      dialogSeen = true;
      await dialog.accept('TEST');
    });

    await page.click('.demo-button');
    await page.waitForTimeout(200);
    expect(dialogSeen).toBe(true);

    const output = page.locator('#demo-output');
    await expect(output).toHaveText('Encrypted word: WHVW', { timeout: 2000 });

    // Confirm no runtime page errors happened
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: No ReferenceError/TypeError/SyntaxError occurred during interactions', async ({ page }) => {
    // This test explicitly asserts that common runtime errors did NOT occur during prior interactions.
    // It inspects the collected pageErrors for indicative error types/messages.

    // We expect no page errors from previous interactions (pageErrors array constructed per test run).
    // Since this is in its own test, reload the page and perform a simple interaction to capture any runtime error.
    pageErrors = [];
    consoleMessages = [];

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Trigger the dialog and accept a simple input to ensure scripts execute
    page.once('dialog', async dialog => {
      await dialog.accept('A');
    });
    await page.click('.demo-button');
    await page.waitForTimeout(200);

    // If any page errors occurred, they would be captured
    const errorMessages = pageErrors.map(e => e.message).join('\n');
    // Assert that there were no runtime errors captured
    expect(pageErrors.length).toBe(0, `Expected no page errors, but got: ${errorMessages}`);

    // Also assert there are no console.error messages
    const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrorEntries.length).toBe(0);
  });
});