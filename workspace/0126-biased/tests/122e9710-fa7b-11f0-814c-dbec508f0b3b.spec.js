import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e9710-fa7b-11f0-814c-dbec508f0b3b.html';

/**
 * Page Object for the Digital Signatures page.
 * Encapsulates common interactions and captures console/page errors.
 */
class DigitalSignaturesPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleMessages = [];

    // Collect page errors and console messages for assertions.
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the top-level "Generate Signature" button (the initial Idle state's action).
  async clickTopGenerateButton() {
    const btn = this.page.locator('.button').first();
    await expect(btn).toBeVisible();
    await btn.click();
  }

  // Get representations of the children inside #input-field-container
  async getInputFieldContainerChildren() {
    return await this.page.evaluate(() => {
      const container = document.getElementById('input-field-container');
      if (!container) return null;
      return Array.from(container.children).map((el) => {
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          className: el.className || null,
          type: el.type || null,
          text: el.textContent ? el.textContent.trim() : ''
        };
      });
    });
  }

  // Set values into the generated password and text fields.
  async fillGeneratedInputs({ password = '', text = '' } = {}) {
    const passwordField = this.page.locator('#password-field');
    const textField = this.page.locator('#text-field');
    // Use fill only if elements exist; test will fail otherwise.
    await expect(passwordField).toBeVisible();
    await expect(textField).toBeVisible();
    await passwordField.fill(password);
    await textField.fill(text);
  }

  // Click the inner "Generate Signature" button created inside the input container.
  async clickInnerGenerateButton() {
    const innerBtn = this.page.locator('#input-field-container button');
    await expect(innerBtn).toBeVisible();
    await innerBtn.click();
  }

  // Attempt to call global sign() from page context. This will let any runtime errors happen naturally.
  async callSign() {
    return await this.page.evaluate(() => {
      // Intentionally call sign() in page context and allow any runtime error to propagate.
      return sign();
    });
  }

  // Attempt to call renderPage() from page context (FSM entry action referenced renderPage).
  async callRenderPage() {
    return await this.page.evaluate(() => {
      return renderPage();
    });
  }
}

test.describe('Digital Signatures FSM - Interactive Tests', () => {
  let dsp; // DigitalSignaturesPage instance

  test.beforeEach(async ({ page }) => {
    dsp = new DigitalSignaturesPage(page);
    await dsp.goto();
  });

  test('Idle state: initial page shows a top-level "Generate Signature" button and no inputs', async ({ page }) => {
    // Validate Idle state: the page should render the main button and no input fields initially.
    const topButton = page.locator('.button').first();
    await expect(topButton).toBeVisible();
    await expect(topButton).toHaveText('Generate Signature');

    const containerChildren = await dsp.getInputFieldContainerChildren();
    // At idle there should be no children under #input-field-container (it's empty in the HTML)
    expect(containerChildren).toEqual([]); // strict empty array expected
  });

  test('Transition S0 -> S1: clicking top "Generate Signature" creates password and text inputs and an inner generate button', async ({ page }) => {
    // Clicking the top-level button should create two inputs and another button inside #input-field-container.
    await dsp.clickTopGenerateButton();

    // Verify main button class toggles as implementation does (ends with class 'disabled').
    const mainButton = page.locator('.button').first();
    await expect(mainButton).toHaveClass(/disabled/);

    // Inspect children created in input container.
    const children = await dsp.getInputFieldContainerChildren();
    // Expect three elements: password input, text input, and a button.
    expect(children.length).toBe(3);

    const [first, second, third] = children;
    // Validate types and ids for the inputs
    expect(first.tag).toBe('input');
    expect(first.id).toBe('password-field');
    expect(first.type).toBe('password');

    expect(second.tag).toBe('input');
    expect(second.id).toBe('text-field');
    expect(second.type).toBe('text');

    // The third element should be a button (inner generate button)
    expect(third.tag).toBe('button');
    expect(third.text).toBe('Generate Signature');
  });

  test('Edge case: clicking top-level Generate multiple times clears and re-creates input fields (no duplication)', async ({ page }) => {
    // Click twice and ensure the input container is cleared and has exactly one set of inputs after each click.
    await dsp.clickTopGenerateButton();
    const firstChildren = await dsp.getInputFieldContainerChildren();
    expect(firstChildren.length).toBe(3);

    // Click again - implementation calls inputFieldsContainer.innerHTML = '' before creating fields,
    // so after second click there should still be exactly 3 elements.
    await dsp.clickTopGenerateButton();
    const secondChildren = await dsp.getInputFieldContainerChildren();
    expect(secondChildren.length).toBe(3);

    // Verify ids/types again to ensure re-creation was consistent.
    expect(secondChildren[0].id).toBe('password-field');
    expect(secondChildren[1].id).toBe('text-field');
  });

  test('GenerateButtonClick event: clicking inner generate button leads to runtime crypto error (observed as page error)', async ({ page }) => {
    // This test validates the transition where the inner generate button is clicked.
    // The page code uses crypto.createSign which is not available in the browser environment.
    // We expect a runtime page error to be emitted naturally.
    await dsp.clickTopGenerateButton();

    // Fill inputs with sample data prior to clicking the inner generate button.
    await dsp.fillGeneratedInputs({ password: 'secret', text: 'hello' });

    // Wait for the pageerror event while performing the click.
    // The error could be 'crypto is not defined' or 'crypto.createSign is not a function' depending on the runtime.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      dsp.clickInnerGenerateButton()
    ]);

    // Ensure we captured an Error object and it has a message explaining the crypto/signature issue.
    expect(error).toBeTruthy();
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);

    // The message should reference crypto/createSign or otherwise indicate a runtime failure in signing.
    expect(
      /crypto|createSign|is not defined|is not a function|signature|update/i.test(error.message)
    ).toBeTruthy();
  });

  test('Calling sign() directly from page context throws due to invalid signature object (edge/error scenario)', async ({ page }) => {
    // The global `signature` variable is initialized to an empty string in the page script.
    // Calling sign() without a proper signature object should throw (signature.sign is not a function).
    let thrown = null;
    try {
      // This will execute sign() in the page context and is expected to throw.
      await dsp.callSign();
    } catch (err) {
      thrown = err;
    }

    // Validate that an error was thrown and its message indicates the missing/incompatible signature implementation.
    expect(thrown).toBeTruthy();
    // The error message could vary, but should reference 'signature' or 'is not a function' typical of calling .sign on a primitive.
    expect(/signature|is not a function|cannot read property|undefined/i.test(String(thrown.message))).toBeTruthy();
  });

  test('FSM entry action renderPage() is not defined in the implementation and calling it results in ReferenceError', async ({ page }) => {
    // The FSM mentions an entry action renderPage() for Idle. The HTML/JS doesn't define renderPage,
    // so attempting to call it in the page context should raise a ReferenceError (left to happen naturally).
    let thrown = null;
    try {
      await dsp.callRenderPage();
    } catch (err) {
      thrown = err;
    }

    // Confirm an error was thrown and matches the expected ReferenceError style
    expect(thrown).toBeTruthy();
    expect(/renderPage|not defined|ReferenceError/i.test(String(thrown.message))).toBeTruthy();
  });

  test('Console and page error collection: ensure pageErrors were recorded when runtime exceptions occurred', async ({ page }) => {
    // This test triggers runtime errors and then asserts that the page object captured them via its listeners.

    // Initially no page errors
    expect(dsp.pageErrors.length).toBe(0);

    // Trigger the inner generate button error
    await dsp.clickTopGenerateButton();
    await dsp.fillGeneratedInputs({ password: 'x', text: 'y' });

    // Wait for pageerror that will be emitted when clicking inner button
    await Promise.all([page.waitForEvent('pageerror'), dsp.clickInnerGenerateButton()]);

    // After the action, the pageErrors array should have at least one entry.
    expect(dsp.pageErrors.length).toBeGreaterThanOrEqual(1);
    const msg = dsp.pageErrors[0].message || '';
    expect(/crypto|createSign|is not defined|is not a function|signature/i.test(msg)).toBeTruthy();

    // Also assert that console messages (if any) were collected (the app does not intentionally log, but listener should work).
    expect(Array.isArray(dsp.consoleMessages)).toBeTruthy();
  });
});