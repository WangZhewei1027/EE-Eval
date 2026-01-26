import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b57d40-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demo page to encapsulate interactions and common assertions
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#demo-button');
    this.output = page.locator('#demo-output');
  }

  // Click the Run Demonstration button
  async clickRun() {
    await this.runButton.click();
  }

  // Wait for text snippet to appear inside the demo output
  async waitForOutputContains(text, timeout = 10000) {
    await expect(this.output).toContainText(text, { timeout });
  }

  // Get the raw innerHTML of the output (for some assertions)
  async getOutputHTML() {
    return await this.page.evaluate(() => document.getElementById('demo-output').innerHTML);
  }

  // Ensure the Run Demonstration button is visible and enabled
  async expectButtonVisible() {
    await expect(this.runButton).toBeVisible();
    await expect(this.runButton).toBeEnabled();
  }

  // Ensure the output is empty or only whitespace
  async expectOutputEmpty() {
    const html = (await this.getOutputHTML()) || '';
    expect(html.trim()).toBe('');
  }
}

test.describe('Asymmetric Cryptography Demo (FSM) - f0b57d40...', () => {
  // Capture page errors and console error messages for assertions
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect uncaught page errors (e.g., ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages of severity 'error' to detect runtime problems logged to console
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the exact page as provided
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test we will assert that no unexpected page errors occurred.
    // Tests below also assert expected behavior; this ensures we observe runtime exceptions if they happen.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Initial Idle state: page renders with Run Demonstration button and empty output', async ({ page }) => {
    // Validate initial state S0_Idle: the button must exist and the output empty
    const demo = new DemoPage(page);

    // Verify button presence and initial output
    await demo.expectButtonVisible();
    await demo.expectOutputEmpty();

    // The FSM's S0 entry action mentions renderPage(); we cannot call or modify it,
    // but we verify the DOM that renderPage would have produced (the button and empty output).
  });

  test('Full demonstration progresses through all FSM states to original message recovered', async ({ page }) => {
    // This test clicks the demo button and validates each state S1 through S9 sequentially,
    // including the exact textual evidence expected from the FSM definition.
    const demo = new DemoPage(page);

    // Start the demonstration
    await demo.clickRun();

    // S1: Demonstration Running
    await demo.waitForOutputContains('Running demonstration...', 3000);

    // S2: Choosing primes
    await demo.waitForOutputContains('1. Choosing small primes: p = 5, q = 11', 4000);

    // S3: Computing n and phi: phi should be 40
    await demo.waitForOutputContains('2. Compute n = p × q = 55 and φ(n) = (p-1)(q-1) = 40', 4000);

    // S4: Choosing e: e = 3
    await demo.waitForOutputContains('3. Choose e = 3 (must be coprime with 40)', 4000);

    // S5: Computing d: d = 27
    await demo.waitForOutputContains('4. Compute d = 27 (because 3 × 27 mod 40 = 1)', 4000);

    // S6: Showing keys
    await demo.waitForOutputContains('Public Key: (n=55, e=3)', 4000);
    await demo.waitForOutputContains('Private Key: (n=55, d=27)', 4000);

    // S7: Encrypting message: message 14 encrypted should be 49
    await demo.waitForOutputContains('Encrypting message 14: 14^3 mod 55 = 49', 5000);

    // S8: Decrypting message: decrypted should return 14
    await demo.waitForOutputContains('Decrypting ciphertext 49: 49^27 mod 55 = 14', 6000);

    // S9: Original message recovered strong success message
    await demo.waitForOutputContains('Original message (14) successfully recovered!', 3000);

    // Final sanity: ensure the full sequence of expected pieces all appear in the output HTML
    const outputHTML = await demo.getOutputHTML();
    const expectedPieces = [
      'Running demonstration...',
      '1. Choosing small primes: p = 5, q = 11',
      '2. Compute n = p × q = 55 and φ(n) = (p-1)(q-1) = 40',
      '3. Choose e = 3 (must be coprime with 40)',
      '4. Compute d = 27 (because 3 × 27 mod 40 = 1)',
      'Public Key: (n=55, e=3)',
      'Private Key: (n=55, d=27)',
      'Encrypting message 14: 14^3 mod 55 = 49',
      'Decrypting ciphertext 49: 49^27 mod 55 = 14',
      'Original message (14) successfully recovered!'
    ];
    for (const piece of expectedPieces) {
      expect(outputHTML).toContain(piece);
    }
  });

  test('Clicking the Run Demonstration button again during a run resets and restarts the demo without errors', async ({ page }) => {
    // Edge case: user clicks the button while the demonstration is already running.
    // The implementation sets output.innerHTML = '<p>Running demonstration...</p>'; on click,
    // effectively restarting. We assert that restart happens and the demo still completes.
    const demo = new DemoPage(page);

    // Start the first run
    await demo.clickRun();

    // Wait for the first step to appear
    await demo.waitForOutputContains('1. Choosing small primes: p = 5, q = 11', 4000);

    // Now click again while running to force a restart
    await demo.clickRun();

    // Immediately after second click output should contain (or start with) Running demonstration...
    // We wait briefly for the reset to take effect
    await demo.waitForOutputContains('Running demonstration...', 2000);

    // Then allow the restarted demonstration to complete
    await demo.waitForOutputContains('Original message (14) successfully recovered!', 8000);

    // Ensure no runtime errors arose from restarting mid-run
    // (Assertions in afterEach will check pageErrors and consoleErrors arrays are empty)
  });

  test('Multiple rapid clicks queue/restart behavior and final state is consistent', async ({ page }) => {
    // Rapidly click the button multiple times and ensure the application remains stable
    // and final recovered message is present without runtime errors.
    const demo = new DemoPage(page);

    // Rapid clicks
    await demo.clickRun();
    await demo.clickRun();
    await demo.clickRun();

    // The implementation will reset on each click, but ultimately should finish successfully.
    await demo.waitForOutputContains('Original message (14) successfully recovered!', 10000);

    // Confirm presence of final expected decrypted value and success message
    await demo.waitForOutputContains('Decrypting ciphertext 49: 49^27 mod 55 = 14', 4000);
    await demo.waitForOutputContains('Original message (14) successfully recovered!', 2000);
  });

  test('Sanity checks: <button> and #demo-output have expected accessibility and DOM structure', async ({ page }) => {
    // Verify the components mentioned in the FSM are present and accessible
    const demo = new DemoPage(page);

    // Button should have id demo-button and text content matching "Run Demonstration"
    await expect(demo.runButton).toHaveAttribute('id', 'demo-button');
    await expect(demo.runButton).toHaveText('Run Demonstration');

    // The output container should exist and be a div
    const tagName = await page.evaluate(() => document.getElementById('demo-output').tagName);
    expect(tagName.toLowerCase()).toBe('div');

    // Start and complete a single demonstration to ensure DOM updates happen as expected
    await demo.clickRun();
    await demo.waitForOutputContains('Running demonstration...', 3000);
    await demo.waitForOutputContains('Original message (14) successfully recovered!', 10000);
  });
});