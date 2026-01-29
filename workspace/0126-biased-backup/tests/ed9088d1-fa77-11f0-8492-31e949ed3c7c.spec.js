import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9088d1-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the Asymmetric Cryptography Visualization page
class AsymmetricPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      container: '.container',
      heading: 'h1',
      paragraph: 'div.container > p', // first matching paragraph after heading
      allParagraphs: '.container p',
      graphic: '.graphic',
      learnMoreButton: '.button',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.page.textContent(this.selectors.heading);
  }

  async getAllParagraphTexts() {
    return this.page.$$eval(this.selectors.allParagraphs, nodes => nodes.map(n => n.textContent?.trim() ?? ''));
  }

  async getGraphicBackgroundImage() {
    return this.page.$eval(this.selectors.graphic, el => {
      // computed style backgroundImage might be like 'url("...")'
      const style = window.getComputedStyle(el).backgroundImage;
      return style || '';
    });
  }

  async getLearnMoreButtonText() {
    return this.page.textContent(this.selectors.learnMoreButton);
  }

  async getLearnMoreOnclickAttr() {
    return this.page.getAttribute(this.selectors.learnMoreButton, 'onclick');
  }

  async clickLearnMore() {
    await this.page.click(this.selectors.learnMoreButton);
  }
}

test.describe('Asymmetric Cryptography Visualization - FSM and UI tests', () => {
  // Shared variables captured per test
  let pageModel;
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  // Setup: run before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Collect console messages and page errors for observation and assertions
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Collect dialogs (alerts) and automatically accept them while recording text
    page.on('dialog', async dialog => {
      try {
        dialogMessages.push({
          type: dialog.type(),
          message: dialog.message(),
        });
        await dialog.accept();
      } catch (e) {
        // If accepting the dialog throws for some reason, just record it as an error object
        pageErrors.push(e);
      }
    });

    pageModel = new AsymmetricPage(page);
    await pageModel.goto();
  });

  test.afterEach(async () => {
    // No explicit teardown necessary; fixtures will cleanup.
    // This hook exists to clearly indicate test lifecycle boundaries.
  });

  test('S0_Idle: Page renders initial content (entry action renderPage observed via DOM)', async ({ page }) => {
    // This test validates the Idle state (S0_Idle):
    // - The header and descriptive text are present.
    // - The graphic exists and has the expected background image.
    // - The "Learn More" button exists and has the onclick attribute pointing to showAlert().
    // - No uncaught page errors occurred during initial render.

    // Heading text verification
    const heading = await pageModel.getHeadingText();
    expect(heading?.trim()).toBe('Welcome to Asymmetric Cryptography');

    // Paragraphs: we expect at least two paragraphs (main description and call to action)
    const paragraphs = await pageModel.getAllParagraphTexts();
    // there are multiple paragraphs; ensure the descriptive paragraph includes expected phrase
    const hasDescription = paragraphs.some(p => p.includes('Discover the art of encryption where two keys are better than one'));
    expect(hasDescription).toBeTruthy();

    // Graphic background includes the GIF URL provided in the HTML
    const bg = await pageModel.getGraphicBackgroundImage();
    expect(bg).toContain('giphy.gif'); // ensure the background image reference is present

    // Button text and onclick attribute verification
    const buttonText = await pageModel.getLearnMoreButtonText();
    expect(buttonText?.trim()).toBe('Learn More');

    const onclickAttr = await pageModel.getLearnMoreOnclickAttr();
    // The HTML sets onclick="showAlert()", so the attribute should reflect that (exact string)
    expect(onclickAttr).toBe('showAlert()');

    // Verify we didn't observe any uncaught page errors during initial render
    expect(pageErrors.length).toBe(0);

    // No console errors emitted during load
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('LearnMore_Click transition: clicking Learn More triggers alert and moves to S1_AlertShown', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_AlertShown:
    // - Clicking the button triggers a browser alert with the correct message.
    // - The alert is captured via the dialog handler.
    // - No uncaught page errors during the interaction.

    // Ensure no dialogs have been captured yet
    expect(dialogMessages.length).toBe(0);

    // Click the button and ensure alert is shown with expected text
    await pageModel.clickLearnMore();

    // Wait for the dialog to be captured by the listener (we poll until the dialogMessages length is 1)
    await expect.poll(() => dialogMessages.length, { timeout: 3000 }).toBe(1);

    expect(dialogMessages[0].type).toBe('alert');
    expect(dialogMessages[0].message).toBe('Asymmetric cryptography involves a public and a private key for secure data transmission.');

    // After handling the alert, ensure no unexpected page errors
    expect(pageErrors.length).toBe(0);

    // No console error entries recorded during this interaction
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Edge case: multiple rapid clicks produce multiple alerts (dialogs)', async ({ page }) => {
    // This test validates an edge case where the user clicks the Learn More button multiple times rapidly.
    // We expect one alert per click; the page registers dialogs and we accept them automatically.

    const expectedClicks = 3;

    // Sanity: no dialogs before clicks
    expect(dialogMessages.length).toBe(0);

    // Rapidly click the button expectedClicks times
    for (let i = 0; i < expectedClicks; i++) {
      // Intentionally not awaiting any dialog here; the page.on('dialog') handler will accept them
      // This simulates rapid user clicks firing multiple alerts in quick succession.
      pageModel.clickLearnMore();
    }

    // Wait until the dialogMessages array size matches expectedClicks (polling).
    await expect.poll(() => dialogMessages.length, { timeout: 5000 }).toBe(expectedClicks);

    // Verify each captured dialog has the expected content
    for (let i = 0; i < expectedClicks; i++) {
      expect(dialogMessages[i].type).toBe('alert');
      expect(dialogMessages[i].message).toBe('Asymmetric cryptography involves a public and a private key for secure data transmission.');
    }

    // Ensure no uncaught page errors resulted from rapid interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: clicking a non-existent selector should raise a Playwright error', async ({ page }) => {
    // This test intentionally interacts with a non-existent selector to validate error handling:
    // - Attempting to click an element that does not exist should cause Playwright to throw.
    // - We assert that an error is thrown (i.e., the runtime signals the failure naturally).
    // - We do not modify page JS; we simply invoke a user-level action that fails.

    // Use a short timeout to fail quickly
    const actionPromise = page.click('.does-not-exist', { timeout: 1000 });

    // Expect the action to reject (throw)
    await expect(actionPromise).rejects.toThrow();

    // Ensure that the thrown error did not manifest as a page-level uncaught exception (it should be a Playwright action error)
    // Thus, pageErrors (uncaught exceptions during page runtime) should remain empty
    expect(pageErrors.length).toBe(0);
  });

  test('State evidence verification: DOM contains elements and attributes that correspond to FSM evidence', async ({ page }) => {
    // This test validates that the page contains the pieces of evidence the FSM expects:
    // - h1 content exactly matches evidence in S0_Idle
    // - paragraph content contains the expected descriptive sentence
    // - the button includes an onclick attribute that references showAlert()
    // - the page contains a .graphic element

    const heading = await pageModel.getHeadingText();
    expect(heading).toBe('Welcome to Asymmetric Cryptography');

    const paragraphs = await pageModel.getAllParagraphTexts();
    // Confirm one of the paragraphs includes the FSM's evidence text
    const hasFSMText = paragraphs.some(p => p.includes('Discover the art of encryption where two keys are better than one.'));
    expect(hasFSMText).toBeTruthy();

    const onclickAttr = await pageModel.getLearnMoreOnclickAttr();
    expect(onclickAttr).toBe('showAlert()');

    // Ensure graphic element exists in the DOM
    const graphicCount = await page.locator('.graphic').count();
    expect(graphicCount).toBeGreaterThanOrEqual(1);

    // Confirm no page runtime errors were logged during this verification
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: console output and pageerror observation works and produces expected shapes', async ({ page }) => {
    // This test verifies our instrumentation is functioning:
    // - consoleMessages is an array of objects with type and text
    // - pageErrors is an array (likely empty unless runtime errors occurred)
    // We will assert structural expectations, not exact console content (the app does not intentionally log).

    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(consoleMessages.every(m => 'type' in m && 'text' in m)).toBe(true);

    // The page as-provided should not emit uncaught runtime errors under normal circumstances
    expect(Array.isArray(pageErrors)).toBe(true);

    // If there are errors, surface them in the test output for debugging
    if (pageErrors.length > 0) {
      // fail the test intentionally with details if any uncaught page errors occurred
      const errorMessages = pageErrors.map(e => e.message).join('\n---\n');
      // Use expect to fail and report the errors
      expect(pageErrors.length, `Uncaught page errors detected:\n${errorMessages}`).toBe(0);
    }
  });
});