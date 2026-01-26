import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520bdf03-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Symmetric Cryptography Interactive - FSM validation and runtime error observation', () => {
  // Arrays to collect runtime diagnostics for each test
  let pageErrors;
  let consoleMessages;

  // Setup listeners and navigate to the page before each test to capture load-time errors.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // Store the Error object and its message for assertions
      pageErrors.push(err);
    });

    // Capture console messages (info, error, warning, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application and wait for load to complete so initial scripts run
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure page is closed/cleaned up (fixture will normally handle this)
    try {
      await page.close();
    } catch (e) {
      // ignore errors closing page in teardown
    }
  });

  test('S0_Idle: Initial Idle state - button exists and initial runtime errors are emitted on load', async ({ page }) => {
    // This test validates the Idle state: the button should be present with the expected onclick handler.
    // It also asserts that loading the page triggers runtime page errors caused by the provided script.

    // Button should be present and have the expected label
    const button = page.locator('button[onclick="symmetricCryptography()"]');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Symmetric Cryptography Example');

    // The onclick attribute should match the FSM evidence
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe('symmetricCryptography()');

    // Output container should be present
    const output = page.locator('#output');
    await expect(output).toHaveCount(1);

    // Because the page's script attempts to run broken crypto code at load time,
    // we expect at least one pageerror to have been emitted during navigation.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Each page error should have a non-empty message; capture messages for debugging/assertion
    const errorMessages = pageErrors.map(e => (e && e.message) ? e.message : String(e));
    errorMessages.forEach(msg => expect(msg.length).toBeGreaterThan(0));

    // The output is unlikely to be successfully populated due to runtime errors.
    // Verify that the output does not contain a valid "Encrypted:" label.
    const outputHtml = await output.innerHTML();
    expect(outputHtml).not.toMatch(/Encrypted:/);
  });

  test('S1_ExampleShown transition: Clicking the button triggers the example and emits runtime errors', async ({ page }) => {
    // This test simulates the user event that triggers the FSM transition:
    // clicking the "Symmetric Cryptography Example" button should attempt to show the example.
    // Because the implementation is broken, we expect additional runtime errors to occur on click.

    const button = page.locator('button[onclick="symmetricCryptography()"]');
    const output = page.locator('#output');

    // Record error count before clicking
    const errorsBefore = pageErrors.length;
    const consoleBefore = consoleMessages.length;

    // Click the button to trigger the symmetricCryptography() function
    await button.click();

    // Wait briefly to allow any async handlers and errors to surface
    await page.waitForTimeout(250);

    // We expect one or more additional page errors to have been emitted due to the faulty implementation
    expect(pageErrors.length).toBeGreaterThanOrEqual(errorsBefore + 1);

    // Verify that console also captured messages (often errors will be logged to console)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(consoleBefore);

    // The FSM expects the output to show Encrypted and Decrypted data on successful transition.
    // Given runtime errors, ensure that the output has not been successfully populated with that content.
    const outHtmlAfterClick = await output.innerHTML();
    expect(outHtmlAfterClick).not.toMatch(/Encrypted:/);
    expect(outHtmlAfterClick).not.toMatch(/Decrypted:/);
  });

  test('Edge case: Multiple clicks produce repeated runtime errors (robustness test)', async ({ page }) => {
    // This test validates that repeated triggering of the event (multiple clicks) continues to produce
    // runtime errors rather than silently succeeding, reflecting that the faulty code is consistently failing.

    const button = page.locator('button[onclick="symmetricCryptography()"]');

    // Baseline error count
    const baseline = pageErrors.length;

    // Click the button multiple times
    const clicks = 3;
    for (let i = 0; i < clicks; i++) {
      await button.click();
      // small delay between clicks
      await page.waitForTimeout(150);
    }

    // Expect that additional errors were emitted for these clicks (at least one per click is likely)
    expect(pageErrors.length).toBeGreaterThanOrEqual(baseline + 1);

    // Validate that at least one of the captured errors references likely problematic symbols used in the script
    const diagnosticTexts = [
      'randomBytes',
      'is not a function',
      'subtle',
      'encrypt',
      'TypeError',
      'ReferenceError'
    ];

    const joinedMessages = pageErrors.map(e => (e && e.message) ? e.message : String(e)).join(' | ').toLowerCase();

    // Assert that we detect at least one of the expected diagnostic tokens in the aggregated error messages.
    const foundDiagnostic = diagnosticTexts.some(token => joinedMessages.includes(token.toLowerCase()));
    expect(foundDiagnostic).toBeTruthy();
  });

  test('Diagnostics capture: console and pageerror messages include relevant substrings (sanity on observed errors)', async ({ page }) => {
    // This test asserts that the collected diagnostics contain meaningful information that corresponds to the broken API usage.

    // Ensure there is at least one page error captured during either load or interactions
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    const errorMessages = pageErrors.map(e => (e && e.message) ? e.message : '').filter(Boolean);
    // Also include console error texts for analysis
    const consoleErrorTexts = consoleMessages.filter(c => c.type === 'error').map(c => c.text);

    const allDiagnostics = [...errorMessages, ...consoleErrorTexts].join(' || ').toLowerCase();

    // Expect the diagnostics to reference either the missing randomBytes function or crypto.subtle usage
    const expectedTokens = ['randomb', 'randombytes', 'subtle', 'encrypt', 'is not a function', 'typeerror', 'referenceerror'];

    const matches = expectedTokens.filter(token => allDiagnostics.includes(token));
    // At least one token should match given the broken code uses randomBytes and crypto.subtle.encrypt incorrectly
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  test('FSM evidence verification: DOM contains the components and attributes declared in the FSM', async ({ page }) => {
    // This test verifies the static evidence asserted by the FSM: the button selector and text are present.
    // It checks the "evidence" for S0_Idle as provided in the FSM.

    const button = page.locator('button[onclick="symmetricCryptography()"]');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Symmetric Cryptography Example');

    // Validate that the page contains the expected <div id="output"> element for state S1_ExampleShown output
    const output = page.locator('#output');
    await expect(output).toHaveCount(1);

    // Because onEnter actions are attempted via script but fail due to errors, ensure we assert that the
    // page either attempted to perform them (observed as errors) or did not update the DOM.
    const outputHtml = await output.innerHTML();
    // Accept either empty (failed to set) or some content; but explicitly assert it does NOT contain a successful,
    // well-formed Encrypted/Decrypted markup (since runtime failures are expected).
    expect(outputHtml).not.toMatch(/Encrypted: <pre>.*<\/pre><br>Decrypted: <pre>.*<\/pre>/);
  });
});