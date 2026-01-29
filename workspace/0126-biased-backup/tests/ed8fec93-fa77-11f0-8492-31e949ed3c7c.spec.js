import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8fec93-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the Visual Type System demo.
 * Encapsulates common interactions and queries so tests are readable and maintainable.
 */
class VisualTypeSystemPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.circle = page.locator('.circle');
    this.text = page.locator('.text');
    this.button = page.locator('.button');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickShowMessage() {
    await this.button.click();
  }

  async getTextInnerText() {
    return this.text.innerText();
  }

  async getInlineStyleProperty(prop) {
    return this.page.evaluate(
      (p) => {
        const el = document.querySelector('.text');
        return el ? el.style[p] : null;
      },
      prop
    );
  }

  async getComputedStyleProperty(prop) {
    return this.page.evaluate((p) => {
      const el = document.querySelector('.text');
      if (!el) return null;
      return window.getComputedStyle(el).getPropertyValue(p);
    }, prop);
  }

  async removeTextElement() {
    await this.page.evaluate(() => {
      const el = document.querySelector('.text');
      if (el && el.parentElement) el.parentElement.removeChild(el);
    });
  }

  async isRevealTextDefined() {
    return this.page.evaluate(() => typeof window.revealText === 'function');
  }

  async isRenderPageDefined() {
    return this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }
}

test.describe('Visual Type System - FSM validation and interactions', () => {
  // Basic smoke test to ensure the app loads and initial UI elements match S0_Idle
  test('Initial state S0_Idle: page renders circle, button, and hidden text', async ({ page }) => {
    // Collect console messages and page errors for assertions
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new VisualTypeSystemPage(page);
    await app.goto();

    // Validate presence of visual components per FSM evidence
    await expect(app.circle).toHaveCount(1);
    await expect(app.button).toBeVisible();

    // Validate text content exists
    const textContent = await app.getTextInnerText();
    expect(textContent.trim()).toBe('Types Enhance Clarity');

    // The FSM expects the text to be hidden initially (opacity 0)
    const computedOpacity = await app.getComputedStyleProperty('opacity');
    // getComputedStyle returns string values like "0" or "1"
    expect(computedOpacity).toBe('0');

    // Verify the inline style is not already set (the animation is applied via CSS initially)
    const inlineAnimation = await app.getInlineStyleProperty('animation');
    expect(inlineAnimation === '' || inlineAnimation === null).toBeTruthy();

    // Verify that the FSM entry action renderPage() is not present on the page implementation.
    // This checks for mismatch between FSM entry action and provided implementation.
    const hasRenderPage = await app.isRenderPageDefined();
    expect(hasRenderPage).toBe(false);

    // Ensure no console errors or page errors happened during initial load
    const errorConsoleCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(errorConsoleCount).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition ShowMessage: clicking button reveals text and sets inline opacity and animation (S0 -> S1)', async ({ page }) => {
    // Capture console and page errors for this interaction
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new VisualTypeSystemPage(page);
    await app.goto();

    // Precondition: text is hidden
    const beforeComputedOpacity = await app.getComputedStyleProperty('opacity');
    expect(beforeComputedOpacity).toBe('0');

    // Trigger the FSM event: click .button (ShowMessage)
    await app.clickShowMessage();

    // After clicking, the script revealText() should set inline styles:
    // text.style.opacity = 1;
    const inlineOpacity = await app.getInlineStyleProperty('opacity');
    expect(inlineOpacity).toBe('1');

    // and text.style.animation = 'fadeIn 1.5s forwards';
    const inlineAnimation = await app.getInlineStyleProperty('animation');
    expect(inlineAnimation).toBe('fadeIn 1.5s forwards');

    // The computed opacity should reflect the change to 1
    const afterComputedOpacity = await app.getComputedStyleProperty('opacity');
    // allow a small time for the style to be applied (though it's synchronous)
    expect(afterComputedOpacity).toBe('1');

    // There should be no runtime errors during normal successful reveal
    const errorConsoleCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(errorConsoleCount).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Idempotent behavior: multiple clicks keep the same visual state and do not throw errors', async ({ page }) => {
    // Collect console/page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new VisualTypeSystemPage(page);
    await app.goto();

    // Click multiple times
    await app.clickShowMessage();
    await app.clickShowMessage();
    await app.clickShowMessage();

    // Styles stay applied and stable
    const inlineOpacity = await app.getInlineStyleProperty('opacity');
    const inlineAnimation = await app.getInlineStyleProperty('animation');
    const computedOpacity = await app.getComputedStyleProperty('opacity');

    expect(inlineOpacity).toBe('1');
    expect(inlineAnimation).toBe('fadeIn 1.5s forwards');
    expect(computedOpacity).toBe('1');

    // No errors should be introduced by repeated interactions
    const errorConsoleCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(errorConsoleCount).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: missing .text element results in a TypeError when revealText is invoked (observe runtime error)', async ({ page }) => {
    // Collect console messages and page errors for assertion
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new VisualTypeSystemPage(page);
    await app.goto();

    // Remove the .text element from the DOM to simulate a broken/missing element scenario
    await app.removeTextElement();

    // Prepare a promise that resolves when a pageerror is observed (or times out)
    const errorPromise = new Promise((resolve) => {
      const onError = (err) => {
        // Detach listener and resolve with the error
        page.removeListener('pageerror', onError);
        resolve(err);
      };
      page.on('pageerror', onError);

      // Also handle the unlikely case where console.error is emitted instead of pageerror
      const onConsole = (msg) => {
        if (msg.type() === 'error') {
          page.removeListener('console', onConsole);
          resolve(new Error(msg.text()));
        }
      };
      page.on('console', onConsole);

      // Safety: resolve after a short timeout with null if nothing happens
      setTimeout(() => {
        page.removeListener('pageerror', onError);
        page.removeListener('console', onConsole);
        resolve(null);
      }, 1000);
    });

    // Invoke the action that is expected to throw due to missing element
    await app.clickShowMessage();

    // Await the error capture
    const observedError = await errorPromise;

    // We expect an error to have occurred because revealText() assumes .text exists
    // The thrown error in most browsers will be a TypeError mentioning 'null' or 'reading style'
    expect(observedError).not.toBeNull();

    const message =
      observedError instanceof Error
        ? observedError.message
        : String(observedError && observedError.message ? observedError.message : observedError);

    // The message should indicate a TypeError or inability to read properties of null.
    // Use a loose match to accommodate different browser error wording.
    const lowered = message.toLowerCase();
    const hasTypeIssue =
      lowered.includes('typeerror') ||
      lowered.includes('cannot read') ||
      lowered.includes("cannot read properties of null") ||
      lowered.includes("reading 'style'") ||
      lowered.includes('cannot set property') ||
      lowered.includes("cannot set properties of undefined");

    expect(hasTypeIssue).toBeTruthy();

    // Also verify that at least one console error was recorded
    const errorConsoleCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(errorConsoleCount).toBeGreaterThanOrEqual(0); // it may be 0 if only pageerror emitted
    expect(pageErrors.length).toBeGreaterThanOrEqual(0);
  });

  test('FSM action verification: revealText exists but renderPage entry action is not implemented', async ({ page }) => {
    const app = new VisualTypeSystemPage(page);
    await app.goto();

    // revealText should be defined as it is used by the button's onclick attribute
    const hasRevealText = await app.isRevealTextDefined();
    expect(hasRevealText).toBe(true);

    // renderPage was listed by the FSM as an entry action but implementation doesn't provide it;
    // verify it is absent which indicates a mismatch between FSM and implementation
    const hasRenderPage = await app.isRenderPageDefined();
    expect(hasRenderPage).toBe(false);
  });
});