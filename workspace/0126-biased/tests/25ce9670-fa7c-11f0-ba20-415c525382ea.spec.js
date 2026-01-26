import { test, expect } from '@playwright/test';
import { createHash } from 'crypto';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ce9670-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.hashBtn = page.locator('#hashBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickHashButton() {
    await this.hashBtn.click();
  }

  async getOutputText() {
    return await this.output.textContent();
  }

  async isButtonVisible() {
    return await this.hashBtn.isVisible();
  }

  async getAriaLive() {
    return await this.output.getAttribute('aria-live');
  }

  async getAriaAtomic() {
    return await this.output.getAttribute('aria-atomic');
  }
}

// Utility to compute expected SHA-256 hex digest for the sample password
function expectedSha256Hex(message) {
  return createHash('sha256').update(message, 'utf8').digest('hex');
}

// Group tests for the FSM and interactive demo
test.describe('Authentication Demo - FSM Validation and UI Behavior', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset captured messages before each test
    pageErrors = [];
    consoleMessages = [];

    // Observe console messages and uncaught page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Test initial idle state (S0_Idle): button is rendered and output is empty
  test('S0_Idle: initial render shows button and empty demo output', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Validate button exists and has correct text
    await expect(demo.hashBtn).toBeVisible();
    await expect(demo.hashBtn).toHaveText('Show Hash of Example Password');

    // Validate demo output exists and is initially empty
    await expect(demo.output).toBeVisible();
    const initialText = (await demo.getOutputText()) || '';
    expect(initialText.trim()).toBe('', 'Expected demo output to be empty in Idle state');

    // Accessibility attributes: aria-live and aria-atomic should be present as described in FSM components
    expect(await demo.getAriaLive()).toBe('polite');
    expect(await demo.getAriaAtomic()).toBe('true');

    // No uncaught page errors should have occurred on initial load
    expect(pageErrors.length).toBe(0);
    // There should be no console.error messages during initial render
    expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
  });

  // Test the transitions from S0 -> S1 (computing message) and S1 -> S0 (final hash) on button click
  test('ButtonClick transitions: displays computing message then final SHA-256 hash (S0 -> S1 -> S0)', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Compute expected hash locally for validation
    const expectedHash = expectedSha256Hex('P@ssw0rd123');

    // Click the button to trigger the hashing demo
    await demo.clickHashButton();

    // Immediately after click, the demo should display the "Computing..." message per S1_Hashing entry action
    // Use toContainText so small whitespace/format differences don't break the assertion
    await expect(demo.output).toContainText('Computing SHA-256 hash for password "P@ssw0rd123"...');

    // Wait for the final output containing the password and the SHA-256 Hash label
    await expect(demo.output).toContainText('Password: P@ssw0rd123', { timeout: 3000 });
    await expect(demo.output).toContainText('SHA-256 Hash:', { timeout: 3000 });

    // Extract the 64-character hex hash from the output and compare with expected
    const finalText = (await demo.getOutputText()) || '';
    const match = finalText.match(/[0-9a-f]{64}/i);
    expect(match, `Expected a 64-character hex SHA-256 hash in output, got: ${finalText}`).not.toBeNull();
    const actualHash = match ? match[0].toLowerCase() : '';
    expect(actualHash).toBe(expectedHash, 'The computed SHA-256 hash should match the expected value');

    // Ensure no uncaught page errors and no console.error messages during hashing
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
  });

  // Edge case: rapid double-clicks should still produce a valid final result and not crash the page
  test('Edge case: rapid repeated clicks produce a valid hash and no uncaught errors', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    const expectedHash = expectedSha256Hex('P@ssw0rd123');

    // Rapidly trigger two clicks
    await Promise.all([
      demo.hashBtn.click(),
      demo.hashBtn.click()
    ]);

    // The page may process both handlers; ultimately the output should contain the final hash
    await expect(demo.output).toContainText('SHA-256 Hash:', { timeout: 5000 });

    const finalText = (await demo.getOutputText()) || '';
    const match = finalText.match(/[0-9a-f]{64}/i);
    expect(match, 'Expected a 64-character hex SHA-256 hash after rapid clicks').not.toBeNull();
    const actualHash = match ? match[0].toLowerCase() : '';
    expect(actualHash).toBe(expectedHash);

    // Verify no uncaught page errors and no console.error messages occurred even under rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
  });

  // Test repeated full cycles: click twice sequentially and ensure transitions happen each time
  test('Repeated cycles: clicking again re-enters hashing state and returns to idle with same result', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    const expectedHash = expectedSha256Hex('P@ssw0rd123');

    // First cycle
    await demo.clickHashButton();
    await expect(demo.output).toContainText('Computing SHA-256 hash for password "P@ssw0rd123"...', { timeout: 2000 });
    await expect(demo.output).toContainText('SHA-256 Hash:', { timeout: 3000 });

    const afterFirst = (await demo.getOutputText()) || '';
    const match1 = afterFirst.match(/[0-9a-f]{64}/i);
    expect(match1).not.toBeNull();
    expect(match1[0].toLowerCase()).toBe(expectedHash);

    // Second cycle: click again to transition S0 -> S1 -> S0 once more
    await demo.clickHashButton();
    await expect(demo.output).toContainText('Computing SHA-256 hash for password "P@ssw0rd123"...', { timeout: 2000 });
    await expect(demo.output).toContainText('SHA-256 Hash:', { timeout: 3000 });

    const afterSecond = (await demo.getOutputText()) || '';
    const match2 = afterSecond.match(/[0-9a-f]{64}/i);
    expect(match2).not.toBeNull();
    expect(match2[0].toLowerCase()).toBe(expectedHash);

    // Ensure consistent behavior with no errors
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
  });

  // Final test to assert monitoring captured console messages and page errors overall (sanity)
  test('Monitoring: page should not emit uncaught errors or console.error during normal usage', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform a normal click to produce the normal output
    await demo.clickHashButton();
    await expect(demo.output).toContainText('SHA-256 Hash:', { timeout: 3000 });

    // Assert that no uncaught page errors were recorded during the test run
    expect(pageErrors.length).toBe(0);

    // Assert there were no console.error messages. Collect other console types for debugging if needed.
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0, `Found unexpected console.error messages: ${JSON.stringify(errorConsoleMessages)}`);
  });
});