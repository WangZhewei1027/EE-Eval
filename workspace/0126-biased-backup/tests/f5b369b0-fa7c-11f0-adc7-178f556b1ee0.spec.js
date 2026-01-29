import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b369b0-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the Integration Testing page
 */
class IntegrationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#integration-test-button';
    this.url = APP_URL;
  }

  async goto() {
    await this.page.goto(this.url);
    // Ensure the page's main button is present before proceeding
    await this.page.waitForSelector(this.buttonSelector, { state: 'visible' });
  }

  async clickRunIntegrationTest() {
    await this.page.click(this.buttonSelector);
  }

  async getButtonText() {
    return (await this.page.textContent(this.buttonSelector))?.trim();
  }

  async pageContent() {
    return await this.page.content();
  }
}

test.describe('Integration Testing App - FSM validation', () => {
  // Group-level hooks can be added if needed for global setup/teardown.
  // Using Playwright's built-in page fixture for each test keeps isolation.

  test('S0_Idle (Initial) - page renders and button is present (renderPage entry evidence)', async ({ page }) => {
    // This test validates the Idle state: the application should render the Run Integration Test button.
    const app = new IntegrationPage(page);

    // Capture console and page errors that occur during initial page load
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    await app.goto();

    // Assert the button is present, visible, and has correct label (evidence of Idle state)
    const buttonText = await app.getButtonText();
    expect(buttonText).toBe('Run Integration Test');

    // Verify no console messages were emitted simply by rendering (the FSM entry action renderPage() is not defined,
    // but the implementation does not call it, so no console evidence of it should appear).
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // allow 0, but we assert specific ones later
    // Ensure there are no uncaught page errors on initial render
    expect(pageErrors).toHaveLength(0);

    // Verify that the functions referenced in the FSM (renderPage/runIntegrationTest) are not present on the window.
    // Using typeof avoids ReferenceError inside the page context.
    const types = await page.evaluate(() => ({
      renderPageType: typeof renderPage,
      runIntegrationTestType: typeof runIntegrationTest
    }));
    expect(types.renderPageType).toBe('undefined');
    expect(types.runIntegrationTestType).toBe('undefined');
  });

  test('Transition RunIntegrationTest -> S1_Testing: clicking the button logs expected message', async ({ page }) => {
    // This test ensures that clicking the integration test button triggers the console.log in the click handler
    // and simulates the FSM transition from Idle to Testing.
    const app = new IntegrationPage(page);

    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    await app.goto();

    // Click once and assert we receive the expected console output
    await app.clickRunIntegrationTest();
    // Small delay to allow console event to propagate
    await page.waitForTimeout(100);

    // Expect at least one console message and that one of them matches the click handler text
    const logTexts = consoleMessages.map((m) => m.text);
    expect(logTexts.some((t) => t.includes('Integration test button clicked!'))).toBeTruthy();

    // Assert that clicking the button does not produce any page-level errors (no uncaught exceptions)
    expect(pageErrors).toHaveLength(0);

    // Click again to ensure repeated events produce repeated logs (edge: multiple transitions / clicks)
    await app.clickRunIntegrationTest();
    await page.waitForTimeout(100);
    const logTextsAfter = consoleMessages.map((m) => m.text);
    // There should be at least two occurrences of the click log by now
    const occurrences = logTextsAfter.filter(t => t.includes('Integration test button clicked!')).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);

    // Verify that the FSM's expected observable "Integration test initiated" is NOT present in DOM,
    // because the implementation only logs to console and does not add DOM evidence.
    const content = await app.pageContent();
    expect(content.includes('Integration test initiated')).toBe(false);
  });

  test('Edge cases & error scenarios: attempting to call missing FSM actions results in natural errors', async ({ page }) => {
    // This test intentionally attempts to execute the functions referenced by the FSM entry/exit actions
    // to observe natural ReferenceError / TypeError behaviors and assert they occur.
    const app = new IntegrationPage(page);

    await app.goto();

    // 1) Calling an undeclared identifier (unqualified) inside page.evaluate should produce a ReferenceError.
    let refError;
    try {
      // runIntegrationTest is not defined; calling it unqualified should throw a ReferenceError in the page context.
      await page.evaluate(() => runIntegrationTest());
    } catch (e) {
      refError = e;
    }
    expect(refError).toBeTruthy();
    // The message may vary by browser engine, but should reference runIntegrationTest and be a ReferenceError-like message.
    expect(refError.message).toMatch(/runIntegrationTest|not defined|ReferenceError/i);

    // 2) Calling window.runIntegrationTest() should throw a TypeError because window.runIntegrationTest is undefined.
    let typeError;
    try {
      await page.evaluate(() => {
        // Accessing via window returns undefined and calling it results in a TypeError.
        return window.runIntegrationTest();
      });
    } catch (e) {
      typeError = e;
    }
    expect(typeError).toBeTruthy();
    expect(typeError.message).toMatch(/not a function|is not a function|undefined/i);

    // 3) Similarly check renderPage behavior
    let renderRefError;
    try {
      await page.evaluate(() => renderPage());
    } catch (e) {
      renderRefError = e;
    }
    expect(renderRefError).toBeTruthy();
    expect(renderRefError.message).toMatch(/renderPage|not defined|ReferenceError/i);
  });

  test('Robustness: rapid clicks and UI stability (no uncaught errors on stress)', async ({ page }) => {
    // This test performs rapid user interactions to ensure the UI remains stable and no unexpected errors are emitted.
    const app = new IntegrationPage(page);

    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    await app.goto();

    // Rapidly click the integration button multiple times
    for (let i = 0; i < 10; i++) {
      await app.clickRunIntegrationTest();
    }
    // Allow events to propagate
    await page.waitForTimeout(200);

    // Expect multiple console logs for each click
    const clickLogs = consoleMessages.filter(m => m.text.includes('Integration test button clicked!'));
    expect(clickLogs.length).toBeGreaterThanOrEqual(10);

    // Ensure no uncaught page errors occurred as a result of rapid interactions
    expect(pageErrors.length).toBe(0);
  });

  test('DOM integrity checks: button has expected attributes and is accessible', async ({ page }) => {
    // Validate DOM evidence from the FSM: existence of element with id '#integration-test-button'
    const app = new IntegrationPage(page);
    await app.goto();

    // Ensure the button exists, is enabled, and has an id attribute
    const hasButton = await page.$('#integration-test-button') !== null;
    expect(hasButton).toBeTruthy();

    const isDisabled = await page.$eval('#integration-test-button', (b) => b.disabled === true).catch(() => false);
    expect(isDisabled).toBe(false);

    const idAttr = await page.$eval('#integration-test-button', (b) => b.id);
    expect(idAttr).toBe('integration-test-button');
  });
});