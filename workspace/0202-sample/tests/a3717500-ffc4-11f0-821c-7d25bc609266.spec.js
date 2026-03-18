import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3717500-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the Huffman demo page
class HuffmanDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoSelector = '#demo';
    this.buttonSelector = '#demoButton';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure basic elements are present
    await Promise.all([
      this.page.waitForSelector(this.buttonSelector, { state: 'visible' }),
      this.page.waitForSelector(this.demoSelector, { state: 'attached' })
    ]);
  }

  async getButton() {
    return this.page.locator(this.buttonSelector);
  }

  async getDemo() {
    return this.page.locator(this.demoSelector);
  }

  // Click the demo button and wait for demo area to be populated
  async clickRunAndWaitForOutput() {
    await this.page.click(this.buttonSelector);
    // The demo writes multiple lines; wait for a clear marker that demo ran
    await this.page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.includes('Step 1: Frequency count');
      },
      this.demoSelector
    );
  }

  async getDemoText() {
    return (await this.getDemo().innerText()).trim();
  }
}

test.describe('Huffman Coding Interactive Demo - FSM validation and UI checks', () => {
  // Collect console messages and page errors for each test to assert on them
  test.beforeEach(async ({ page }) => {
    // Nothing needed here; listeners are attached per test to capture only relevant events
  });

  // Test S0 Idle: initial render state
  test('S0_Idle: initial page render shows Run button and empty demo area (entry action observation)', async ({ page }) => {
    // Attach listeners to capture console and page errors during page load
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', err => pageErrors.push(err));

    const demoPage = new HuffmanDemoPage(page);
    await demoPage.goto();

    // Validate the button is present and contains expected text
    const button = await demoPage.getButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Run a Simple Huffman Coding Demo');

    // Validate the demo output area exists and is initially empty
    const demo = await demoPage.getDemo();
    const demoText = await demo.innerText();
    expect(demoText.trim()).toBe('', 'Expected demo area to be empty on initial render (Idle state)');

    // Accessibility check: demo element should have aria-live="polite"
    const ariaLive = await page.getAttribute('#demo', 'aria-live');
    expect(ariaLive).toBe('polite');

    // Verify on-entry/on-exit actions as described in FSM:
    // - renderPage() was listed as an entry action for Idle in the FSM but not implemented in the page.
    //   We assert that there is no global renderPage function (we must not inject or modify anything).
    const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(renderPageExists).toBe(false);

    // The runDemo function should exist on the page (it's used by the demo button)
    const runDemoExists = await page.evaluate(() => typeof window.runDemo === 'function');
    expect(runDemoExists).toBe(true);

    // Assert there are no console errors or page errors on initial load
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test the transition: clicking the button should run the demo and produce expected output
  test('ButtonClick event transitions S0_Idle -> S1_DemoRunning and produces demo output', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', err => pageErrors.push(err));

    const demoPage = new HuffmanDemoPage(page);
    await demoPage.goto();

    // Click the button and wait for the demo to output the expected content
    await demoPage.clickRunAndWaitForOutput();

    // Now assert demo content contains expected sections from the runDemo implementation
    const demoText = await demoPage.getDemoText();

    // Validate presence of the input string header
    expect(demoText).toContain('Input string:', 'Demo should show the input string heading');

    // Validate Step 1 frequency count
    expect(demoText).toContain('Step 1: Frequency count of characters:', 'Demo should show frequency count section');

    // Validate Step 4 codes listing
    expect(demoText).toContain('Step 4: Huffman Codes assigned to characters:', 'Demo should list generated Huffman codes');

    // Validate encoded binary string section exists
    expect(demoText).toContain('Encoded binary string:', 'Demo should show encoded binary string');

    // Validate that original and compressed lengths are present and numeric
    const originalMatch = demoText.match(/Original length:\s*([0-9]+)\s*bits/);
    const compressedMatch = demoText.match(/Compressed length:\s*([0-9]+)\s*bits/);
    expect(originalMatch).not.toBeNull();
    expect(compressedMatch).not.toBeNull();

    const originalBits = Number(originalMatch[1]);
    const compressedBits = Number(compressedMatch[1]);

    // The demo should produce some compression for the given input; compressedBits should be positive and less than or equal to originalBits
    expect(originalBits).toBeGreaterThan(0);
    expect(compressedBits).toBeGreaterThan(0);
    expect(compressedBits).toBeLessThanOrEqual(originalBits);

    // Confirm compression ratio line exists and contains a percent value
    const compressionMatch = demoText.match(/Compression ratio:\s*([0-9.]+)%\s*reduction/);
    expect(compressionMatch).not.toBeNull();

    // Ensure no page errors or console errors were emitted during the demo run
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: clicking the button multiple times should be safe and produce deterministic output
  test('Multiple clicks and rapid interactions do not cause errors and produce deterministic output', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', err => pageErrors.push(err));

    const demoPage = new HuffmanDemoPage(page);
    await demoPage.goto();

    // First click
    await demoPage.clickRunAndWaitForOutput();
    const firstOutput = await demoPage.getDemoText();

    // Second click (waiting again for output); output should be re-generated and deterministic
    await demoPage.clickRunAndWaitForOutput();
    const secondOutput = await demoPage.getDemoText();

    // The demo uses deterministic input and algorithm so repeated runs should produce identical textual output
    expect(secondOutput).toBe(firstOutput);

    // Now simulate rapid clicks to stress event handling (3 quick clicks)
    await Promise.all([
      page.click('#demoButton'),
      page.click('#demoButton'),
      page.click('#demoButton')
    ]);

    // Wait a short period for the demo to finish writing; we look for the same marker
    await page.waitForFunction(
      selector => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.includes('Step 1: Frequency count');
      },
      demoPage.demoSelector
    );

    const finalOutput = await demoPage.getDemoText();
    // Output should still be valid and contain the key sections
    expect(finalOutput).toContain('Step 1: Frequency count of characters:');
    expect(finalOutput).toContain('Step 4: Huffman Codes assigned to characters:');

    // Ensure no uncaught exceptions occurred during rapid interactions
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Verify binding evidence and event handler presence via behavior and function existence
  test('Event handler evidence and function presence: runDemo should be callable and demoButton bound', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push(msg));
    page.on('pageerror', err => pageErrors.push(err));

    const demoPage = new HuffmanDemoPage(page);
    await demoPage.goto();

    // Ensure runDemo exists on the window and is a function
    const runDemoType = await page.evaluate(() => typeof window.runDemo);
    expect(runDemoType).toBe('function');

    // Call runDemo directly through page.evaluate to ensure the function executes without throwing
    // We do not modify the function; just invoke it as the page could do
    await page.evaluate(() => {
      // Call runDemo and return true; errors thrown will surface as page errors
      window.runDemo();
      return true;
    });

    // After calling runDemo directly, the demo area should contain expected content
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.textContent && el.textContent.includes('Encoded binary string:');
    }, demoPage.demoSelector);

    // Confirm demo updated
    const demoText = await demoPage.getDemoText();
    expect(demoText).toContain('Encoded binary string:');

    // Confirm that the #demo has aria-live attribute for polite updates (visual feedback)
    const ariaLive = await page.getAttribute('#demo', 'aria-live');
    expect(ariaLive).toBe('polite');

    // Ensure no page errors or console errors after directly invoking runDemo
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Negative/observational test: ensure there are no ReferenceError/SyntaxError/TypeError emitted by the page
  test('No unexpected runtime errors (ReferenceError, SyntaxError, TypeError) should be thrown during load and interactions', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => consoleMessages.push(msg));

    const demoPage = new HuffmanDemoPage(page);
    await demoPage.goto();

    // interact once
    await demoPage.clickRunAndWaitForOutput();

    // Check pageErrors array for any ReferenceError/SyntaxError/TypeError instances
    const hasReferenceError = pageErrors.some(e => e.name === 'ReferenceError');
    const hasSyntaxError = pageErrors.some(e => e.name === 'SyntaxError');
    const hasTypeError = pageErrors.some(e => e.name === 'TypeError');

    expect(hasReferenceError).toBe(false);
    expect(hasSyntaxError).toBe(false);
    expect(hasTypeError).toBe(false);

    // Also assert there are no console messages of type 'error' indicating runtime issues
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});