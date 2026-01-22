import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/176450a1-d5c1-11f0-938c-19d14b60ef51.html';

/**
 * Page Object for the Fibonacci app to encapsulate common operations.
 */
class FibonacciPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.numInput = page.locator('#num');
    this.generateButton = page.locator('button[onclick="generateFibonacci()"]');
    this.resultDiv = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the basic elements to be attached to the DOM
    await Promise.all([
      this.numInput.waitFor({ state: 'attached' }),
      this.generateButton.waitFor({ state: 'attached' }),
      this.resultDiv.waitFor({ state: 'attached' }),
    ]);
  }

  async setNumber(value) {
    // Use fill which works for input[type=number] as well
    await this.numInput.fill(String(value));
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async getResultInnerHTML() {
    return this.resultDiv.innerHTML();
  }

  async getResultText() {
    return this.resultDiv.innerText();
  }

  async getResultParagraph() {
    return this.resultDiv.locator('p');
  }

  async getResultHeader() {
    return this.resultDiv.locator('h2');
  }
}

test.describe('Fibonacci Sequence Generator - FSM states and transitions', () => {
  // Arrays to capture console and page errors/messages for each test
  let consoleErrors;
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors before navigating so load-time errors are captured
    consoleErrors = [];
    pageErrors = [];
    consoleMessages = [];

    page.on('console', (msg) => {
      // collect all console messages and specifically errors
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
  });

  test('Initial Idle state renders input, button and empty result', async ({ page }) => {
    // This test validates the S0_Idle state: elements exist and no initial result is shown
    const app = new FibonacciPage(page);
    await app.goto();

    // Check input exists and has correct attributes
    await expect(app.numInput).toBeVisible();
    await expect(app.numInput).toHaveAttribute('type', 'number');
    await expect(app.numInput).toHaveAttribute('placeholder', 'Enter a positive integer');
    await expect(app.numInput).toHaveAttribute('min', '1');

    // Check button exists and has expected onclick attribute
    await expect(app.generateButton).toBeVisible();
    await expect(app.generateButton).toHaveAttribute('onclick', 'generateFibonacci()');

    // Result div should be present but empty initially
    const initialHTML = await app.getResultInnerHTML();
    expect(initialHTML.trim()).toBe('', 'Result div should be empty on initial render');

    // Verify that generateFibonacci function is defined on window (S1 entry action exists in code)
    const generateType = await page.evaluate(() => typeof window.generateFibonacci);
    expect(generateType).toBe('function');

    // Verify renderPage (mentioned in FSM entry actions) is not defined in the global scope for this implementation
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // No console or page errors should have occurred while loading the page
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Valid Input transition: generates Fibonacci sequence for num=5 (S0 -> S1)', async ({ page }) => {
    // This test exercises the GenerateClick event with a valid input and validates S1_ValidInput entry actions/evidence
    const app = new FibonacciPage(page);
    await app.goto();

    // Enter '5' and click Generate
    await app.setNumber('5');
    await app.clickGenerate();

    // Validate header text
    const header = app.getResultHeader();
    await expect(header).toHaveText('Fibonacci Sequence up to 5:');

    // Validate paragraph contains the expected Fibonacci sequence for first 5 numbers
    const paragraph = app.getResultParagraph();
    await expect(paragraph).toBeVisible();
    await expect(paragraph).toHaveText('0, 1, 1, 2, 3');

    // Validate the innerHTML follows the expected template (presence of <h2> and <p>)
    const html = await app.getResultInnerHTML();
    expect(html).toContain('<h2>Fibonacci Sequence up to 5:</h2>');
    expect(html).toContain('<p>0, 1, 1, 2, 3</p>');

    // Confirm that calling generateFibonacci didn't produce console errors or page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: Decimal input (1.5) is parsed with parseInt -> treated as 1', async ({ page }) => {
    // This test validates that parseInt is used (as in implementation) and decimals are truncated
    const app = new FibonacciPage(page);
    await app.goto();

    await app.setNumber('1.5');
    await app.clickGenerate();

    // Expect sequence up to 1 -> only '0'
    const paragraph = app.getResultParagraph();
    await expect(paragraph).toHaveText('0');

    // No console or page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Invalid Input transition: empty input shows error message (S0 -> S2)', async ({ page }) => {
    // This test exercises the GenerateClick with no input and validates S2_InvalidInput evidence (error message and styling)
    const app = new FibonacciPage(page);
    await app.goto();

    // Ensure input is empty
    await app.setNumber('');
    await app.clickGenerate();

    // The result should show the red error paragraph with the exact message
    const paragraph = app.getResultParagraph();
    await expect(paragraph).toBeVisible();
    await expect(paragraph).toHaveText('Please enter a valid positive integer.');

    // Confirm the inline style includes 'color: red'
    const inner = await app.getResultInnerHTML();
    expect(inner).toContain('style="color: red;"');

    // Additionally, compute the computed color of the paragraph to be red (rgb(255, 0, 0))
    const computedColor = await app.page.evaluate(() => {
      const p = document.querySelector('#result p');
      return window.getComputedStyle(p).color;
    });
    // Some environments represent 'red' as 'rgb(255, 0, 0)'
    expect(computedColor).toContain('255');

    // No console or page errors should have been produced by this flow
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Invalid Input transition: zero and negative numbers show error message (S0 -> S2)', async ({ page }) => {
    // This test validates that inputs < 1 show the invalid-input path
    const app = new FibonacciPage(page);
    await app.goto();

    // Test zero
    await app.setNumber('0');
    await app.clickGenerate();
    await expect(app.getResultParagraph()).toHaveText('Please enter a valid positive integer.');

    // Test negative
    await app.setNumber('-3');
    await app.clickGenerate();
    await expect(app.getResultParagraph()).toHaveText('Please enter a valid positive integer.');

    // No console or page errors should have been produced by these flows
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Multiple interactions sequence: generate for 2, then invalid, then valid 4', async ({ page }) => {
    // This test runs a sequence of transitions to validate state behavior across multiple interactions
    const app = new FibonacciPage(page);
    await app.goto();

    // Generate for 2 -> expect '0, 1'
    await app.setNumber('2');
    await app.clickGenerate();
    await expect(app.getResultParagraph()).toHaveText('0, 1');

    // Invalid input ''
    await app.setNumber('');
    await app.clickGenerate();
    await expect(app.getResultParagraph()).toHaveText('Please enter a valid positive integer.');

    // Valid input 4 -> expect '0, 1, 1, 2'
    await app.setNumber('4');
    await app.clickGenerate();
    await expect(app.getResultHeader()).toHaveText('Fibonacci Sequence up to 4:');
    await expect(app.getResultParagraph()).toHaveText('0, 1, 1, 2');

    // Ensure no runtime console or page errors through all these interactions
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});