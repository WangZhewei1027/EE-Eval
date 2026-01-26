import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b57d42-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Digital Signatures Demo FSM (f0b57d42-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Collect console messages and page errors for each test to assert runtime health.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors exactly as they occur in the page.
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the page as-is. Do not modify or patch the environment.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No special teardown required beyond Playwright's default, but keep hooks for clarity.
  });

  test('Initial Idle state: page renders button and hidden demo output (S0_Idle)', async ({ page }) => {
    // This test validates the S0_Idle state from the FSM:
    // - The "Run Demonstration" button exists and is visible.
    // - The demo output element exists but is hidden (display: none) before interaction.
    // - No runtime errors or console.error messages occurred during initial render.
    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');

    // Button should be present and visible.
    await expect(demoButton).toHaveCount(1);
    await expect(demoButton).toBeVisible();

    // Output should be present but hidden initially according to the HTML/CSS (display: none).
    await expect(demoOutput).toHaveCount(1);
    await expect(demoOutput).toBeHidden();

    // The demo-output should start empty (no innerHTML content).
    const initialOutputHTML = await demoOutput.innerHTML();
    expect(initialOutputHTML.trim()).toBe('');

    // Assert no uncaught page errors occurred during initial load.
    expect(pageErrors.length, `Expected no page errors on load, saw: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Assert there are no console messages of type "error".
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages on load, saw: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Transition RunDemonstration: clicking button renders demo and verifies signature (S0 -> S1)', async ({ page }) => {
    // This test validates the RunDemonstration event and S1_DemoRunning state:
    // - Clicking the #demo-button shows #demo-output and populates expected demonstration content.
    // - The demonstration shows private/public keys, original message, signature, verified message.
    // - The demonstration reports verification success ("✅ Signature is valid").
    // - Ensure no page errors or console.error messages are produced by running the demonstration.

    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');

    // Click the button to trigger the demonstration.
    await demoButton.click();

    // Wait for output to be visible (entry action runDemonstration() should set display = 'block').
    await expect(demoOutput).toBeVisible();

    // Read the text content for assertions.
    const text = await demoOutput.innerText();

    // Basic evidence of the demonstration being rendered.
    expect(text).toContain('Demonstration Results');

    // Verify the expected key values and message are present (as per the embedded script).
    expect(text).toContain('Private Key (d):');
    expect(text).toContain('27'); // Private exponent d is 27
    expect(text).toContain('Public Key (n, e):');
    expect(text).toContain('(55, 3)'); // n = 55, e = 3
    expect(text).toContain('Original Message:');
    expect(text).toContain('42'); // message is 42

    // The simple math in the demonstration (as implemented) should produce signature 48 and verified message 42.
    // Check for the signature and verified message numeric evidence.
    expect(text).toContain('Signature (message^d mod n):');
    expect(text).toContain('48'); // signature computed should be 48 with given parameters

    expect(text).toContain('Verified Message (signature^e mod n):');
    expect(text).toContain('42'); // verified message should be 42 (matches original)

    // Check for the human-friendly verification result (checkmark).
    expect(text).toContain('✅ Signature is valid');

    // Confirm the output region includes the explanatory note about insecure demo.
    expect(text).toContain('This is a highly simplified demonstration');

    // Assert no uncaught page errors occurred during the demonstration.
    expect(pageErrors.length, `Expected no page errors after demo run, saw: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Assert there are no console errors emitted during the demonstration.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages after demo run, saw: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Idempotent behavior: clicking the demonstration button multiple times overwrites output without errors', async ({ page }) => {
    // This test covers an edge case: clicking the Run Demonstration button repeatedly.
    // It ensures:
    // - Multiple invocations produce visible output.
    // - The output content remains consistent (overwritten each time).
    // - No additional runtime errors or console.error messages are produced on repeated runs.

    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');

    // First click
    await demoButton.click();
    await expect(demoOutput).toBeVisible();
    const firstText = await demoOutput.innerText();

    // Second click - the implementation overwrites innerHTML and sets display to block again.
    await demoButton.click();
    await expect(demoOutput).toBeVisible();
    const secondText = await demoOutput.innerText();

    // The content should be a non-empty string and should remain (at minimum) consistent in the core fields.
    expect(firstText.length).toBeGreaterThan(0);
    expect(secondText.length).toBeGreaterThan(0);

    // Core evidence should be present in both runs.
    expect(firstText).toContain('Demonstration Results');
    expect(secondText).toContain('Demonstration Results');
    expect(firstText).toContain('Private Key (d):');
    expect(secondText).toContain('Private Key (d):');

    // The signature and verification should remain consistent across runs.
    expect(firstText).toContain('48');
    expect(secondText).toContain('48');
    expect(firstText).toContain('✅ Signature is valid');
    expect(secondText).toContain('✅ Signature is valid');

    // Ensure no runtime errors occurred during repeated clicks.
    expect(pageErrors.length, `Expected no page errors after repeated demo runs, saw: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages after repeated demo runs, saw: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Edge case: interacting with DOM before page ready should not produce global errors', async ({ browser }) => {
    // This test intentionally opens a new context and navigates, capturing console/page errors
    // to ensure that even in alternative contexts the page does not throw uncaught errors during load.
    const context = await browser.newContext();
    const page = await context.newPage();

    const localConsoleMessages = [];
    const localPageErrors = [];

    page.on('console', msg => localConsoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => localPageErrors.push(err));

    // Navigate to the app and wait for load to finish.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Quick sanity checks: button exists and output exists (even if hidden).
    const demoButton = page.locator('#demo-button');
    const demoOutput = page.locator('#demo-output');
    await expect(demoButton).toBeVisible();
    await expect(demoOutput).toBeHidden();

    // Click to ensure runtime behavior remains stable.
    await demoButton.click();
    await expect(demoOutput).toBeVisible();

    // Assert no uncaught page errors occurred in this separate context.
    expect(localPageErrors.length, `Expected no page errors in separate context, saw: ${localPageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const localConsoleErrors = localConsoleMessages.filter(m => m.type === 'error');
    expect(localConsoleErrors.length, `Expected no console.error messages in separate context, saw: ${localConsoleErrors.map(e => e.text).join('; ')}`).toBe(0);

    await context.close();
  });
});