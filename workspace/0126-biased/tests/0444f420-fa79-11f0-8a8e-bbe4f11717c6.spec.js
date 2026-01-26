import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0444f420-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object to encapsulate page interactions and selectors
class LogisticRegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button1 = '#button1';
    this.button2 = '#button2';
    this.header = '.header h1';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickLearnMore() {
    await this.page.click(this.button1);
  }

  async clickViewCode() {
    await this.page.click(this.button2);
  }

  async getButtonText(selector) {
    return (await this.page.textContent(selector))?.trim();
  }

  async isHeaderVisible() {
    return this.page.isVisible(this.header);
  }
}

test.describe('Logistic Regression FSM and UI - Application ID 0444f420...', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;
  let pageModel;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Attach handlers to capture console messages and page errors
    consoleHandler = (msg) => {
      // Only capture text messages for easier assertions
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        // defensive: if msg.text() fails, push fallback
        consoleMessages.push(String(msg));
      }
    };
    pageErrorHandler = (err) => {
      // err is an Error object emitted by the page
      pageErrors.push(err.message || String(err));
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    pageModel = new LogisticRegressionPage(page);
    // Navigate to the page under test
    await pageModel.goto();

    // Wait a short while to allow any synchronous inline scripts (like the initial trainModel() call) to run.
    // We keep this minimal so tests are fast but stable.
    await page.waitForTimeout(50);
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leaking between tests
    try {
      page.off('console', consoleHandler);
      page.off('pageerror', pageErrorHandler);
    } catch (e) {
      // ignore if already removed
    }
  });

  test('Idle state (S0_Idle) - page renders and initial trainModel() runs on load', async ({ page }) => {
    // Validate that the page rendered expected structural elements (entry action renderPage)
    expect(await pageModel.isHeaderVisible()).toBeTruthy();
    expect(await pageModel.getButtonText(pageModel.button1)).toBe('Learn More');
    expect(await pageModel.getButtonText(pageModel.button2)).toBe('View Code');

    // The inline script calls trainModel() on load. Since model is null at load, we expect a console message:
    // "Model not trained yet."
    const foundInitialTrain = consoleMessages.some((m) =>
      m.includes('Model not trained yet.')
    );
    expect(foundInitialTrain).toBeTruthy();

    // No ReferenceError should have happened yet in the initial state (before any clicks)
    const hasReferenceError = pageErrors.some((e) =>
      /ReferenceError/i.test(e) || e.includes('not defined')
    );
    expect(hasReferenceError).toBeFalsy();
  });

  test('Learn More transition (S0 -> S1) triggers learnMore logs and causes ReferenceError due to missing LogisticRegression', async ({ page }) => {
    // Comments:
    // - Clicking #button1 should trigger two listeners: learnMore and trainModel.
    // - learnMore logs three informational messages, then attempts `new LogisticRegression()` which is undefined -> ReferenceError.
    // - trainModel (the second listener) should run and log "Model not trained yet." because model was never set.
    //
    // We will click the button and assert:
    // 1) The three learnMore informational messages are present.
    // 2) A ReferenceError mentioning LogisticRegression (or "not defined") is emitted as a pageerror.
    // 3) The trainModel log "Model not trained yet." is present after the click.

    // Perform the click
    const [pageErrorPromise] = await Promise.allSettled([
      // We expect an error event to be emitted; use waitForEvent to ensure we observe it.
      page.waitForEvent('pageerror', { timeout: 2000 }).catch((e) => e),
      pageModel.clickLearnMore()
    ]);

    // Allow console handlers to gather logs
    await page.waitForTimeout(50);

    // Assert the three expected learnMore logs appear
    const hasLog1 = consoleMessages.some((m) =>
      m.includes('Logistic Regression is a type of supervised learning algorithm used for binary classification problems.')
    );
    const hasLog2 = consoleMessages.some((m) =>
      m.includes('It is a linear model and is used to predict the probability of a binary outcome.')
    );
    const hasLog3 = consoleMessages.some((m) =>
      m.includes('The model uses the sigmoid function to compute the probability of the positive class.')
    );
    expect(hasLog1, 'expected first learnMore log').toBeTruthy();
    expect(hasLog2, 'expected second learnMore log').toBeTruthy();
    expect(hasLog3, 'expected third learnMore log').toBeTruthy();

    // Assert trainModel's "Model not trained yet." is present (trainModel is the second listener)
    const hasTrainModelLog = consoleMessages.filter((m) => m.includes('Model not trained yet.')).length >= 1;
    expect(hasTrainModelLog).toBeTruthy();

    // Assert a ReferenceError occurred regarding LogisticRegression
    // pageErrors array should contain at least one entry mentioning LogisticRegression or "not defined"
    const refError = pageErrors.find((e) => /LogisticRegression/i.test(e) || /not defined/i.test(e) || /ReferenceError/i.test(e));
    expect(refError, `expected ReferenceError mentioning LogisticRegression, errors: ${JSON.stringify(pageErrors)}`).toBeTruthy();
  });

  test('View Code transition (S0 -> S2) triggers viewCode logs and predict behavior when model is missing', async ({ page }) => {
    // Comments:
    // - Clicking #button2 triggers viewCode (which logs two messages) and predict (which should log "Model not trained yet." because model is null).
    // - No ReferenceError is expected for this action sequence (since viewCode doesn't reference LogisticRegression).
    //
    // We'll click the View Code button and assert expected console logs and absence of new ReferenceError events.

    // Click and wait briefly for console messages
    await pageModel.clickViewCode();
    await page.waitForTimeout(50);

    // Check for viewCode logs
    const hasViewLog1 = consoleMessages.some((m) => m.includes('Viewing the code for logistic regression...'));
    const hasViewLog2 = consoleMessages.some((m) => m.includes('You can view the code on GitHub or other online platforms.'));
    expect(hasViewLog1).toBeTruthy();
    expect(hasViewLog2).toBeTruthy();

    // predict() should have run as the second listener and logged "Model not trained yet."
    const hasPredictUntrained = consoleMessages.some((m) => m.includes('Model not trained yet.'));
    expect(hasPredictUntrained).toBeTruthy();

    // Ensure there is no ReferenceError caused by this click (fresh page per test ensures no prior ReferenceError)
    const hasReferenceError = pageErrors.some((e) => /ReferenceError/i.test(e) || e.includes('not defined'));
    expect(hasReferenceError).toBeFalsy();
  });

  test('Edge case: clicking Learn More multiple times emits multiple ReferenceErrors and does not create a working model', async ({ page }) => {
    // Comments:
    // - Each time learnMore is invoked, it will run the three logs and then throw a ReferenceError when attempting `new LogisticRegression()`.
    // - We expect repeated clicks to cause repeated ReferenceError pageerror events.
    //
    // We'll click the Learn More button twice and assert at least two ReferenceError occurrences are captured.

    // Click the button twice with small spacing
    await pageModel.clickLearnMore();
    // Wait to capture the first error/logs
    await page.waitForTimeout(50);
    await pageModel.clickLearnMore();
    await page.waitForTimeout(50);

    // Count how many ReferenceError-like messages were observed
    const refErrors = pageErrors.filter((e) => /ReferenceError/i.test(e) || /LogisticRegression/i.test(e) || /not defined/i.test(e));
    expect(refErrors.length).toBeGreaterThanOrEqual(2);

    // Confirm that despite multiple attempts, model remains unset: predict invoked via View Code should still report "Model not trained yet."
    await pageModel.clickViewCode();
    await page.waitForTimeout(50);
    const hasUntrained = consoleMessages.some((m) => m.includes('Model not trained yet.'));
    expect(hasUntrained).toBeTruthy();
  });

  test('Edge case: clicking View Code before Learn More shows predict untrained; then clicking Learn More still errors', async ({ page }) => {
    // Comments:
    // - Click view code first: expect viewCode messages and "Model not trained yet." from predict.
    // - Then click learn more: expect learnMore logs and a ReferenceError.
    //
    // This validates ordering and that failure to construct LogisticRegression leaves model null.

    // Click view code first
    await pageModel.clickViewCode();
    await page.waitForTimeout(50);

    // Assertions for viewCode + predict behavior
    expect(consoleMessages.some((m) => m.includes('Viewing the code for logistic regression...'))).toBeTruthy();
    expect(consoleMessages.some((m) => m.includes('Model not trained yet.'))).toBeTruthy();

    // Now click learn more and expect a ReferenceError
    await pageModel.clickLearnMore();

    // Wait for potential pageerror and console logs
    await page.waitForTimeout(50);

    const refError = pageErrors.find((e) => /LogisticRegression/i.test(e) || /not defined/i.test(e) || /ReferenceError/i.test(e));
    expect(refError).toBeTruthy();

    // And model should still be absent; predict again via view code should still say untrained
    await pageModel.clickViewCode();
    await page.waitForTimeout(50);
    const untrainedCount = consoleMessages.filter((m) => m.includes('Model not trained yet.')).length;
    // We expect at least one more occurrence; ensure >= 2 overall considering earlier logs
    expect(untrainedCount).toBeGreaterThanOrEqual(2);
  });
});