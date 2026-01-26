import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2a662-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the ACID Properties demonstration page.
 * Encapsulates common operations and selectors used by tests.
 */
class AcidDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#demonstration-button';
    this.headerSelector = 'h1';
    this.preSelector = 'pre';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeaderText() {
    return this.page.textContent(this.headerSelector);
  }

  async getButtonText() {
    return this.page.textContent(this.buttonSelector);
  }

  async clickRunDemonstration() {
    await this.page.click(this.buttonSelector);
  }

  async preContains(text) {
    const content = await this.page.textContent(this.preSelector);
    return content && content.includes(text);
  }

  async isButtonVisible() {
    return await this.page.isVisible(this.buttonSelector);
  }
}

test.describe('ACID Properties Interactive Application (f5b2a662-...)', () => {
  let consoleMessages;
  let pageErrors;
  let demoPage;

  // Set up listeners and navigate to the page before each test.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions.
    page.on('console', msg => {
      // Record type and text for easier assertions.
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    demoPage = new AcidDemoPage(page);
    await demoPage.goto();
  });

  // Tear down: nothing special required; Playwright provides isolation.

  test('Idle state (S0_Idle): initial render and UI elements are present', async ({ page }) => {
    // This test validates the initial (Idle) state:
    // - The page loads,
    // - The main header and explanatory text are visible,
    // - The "Run the demonstration" button is present and visible,
    // - The sample algorithm code is present in the <pre> block.
    const headerText = await demoPage.getHeaderText();
    expect(headerText).toBeTruthy();
    expect(headerText).toContain('ACID Properties');

    const buttonVisible = await demoPage.isButtonVisible();
    expect(buttonVisible).toBe(true);

    const buttonText = await demoPage.getButtonText();
    expect(buttonText).toBe('Run the demonstration');

    // Verify that the code sample (pre tag) contains function names mentioned in the FSM
    expect(await demoPage.preContains('function depositMoney')).toBe(true);
    expect(await demoPage.preContains('function transferMoney')).toBe(true);
    expect(await demoPage.preContains('function buyProduct')).toBe(true);
    expect(await demoPage.preContains('function deliverPackage')).toBe(true);

    // On initial load, there should be no console messages from user interaction yet.
    // However, user agents might log unrelated messages; we assert that none of the expected log messages
    // from the demonstration were emitted proactively.
    const logTexts = consoleMessages.map(m => m.text);
    expect(logTexts.some(t => t.includes('Depositing') || t.includes('Transferring') || t.includes('Buying') || t.includes('Delivering'))).toBe(false);
  });

  test('Transition RunDemonstration (S0 -> S1): clicking the button logs a ReferenceError message via console.error', async ({ page }) => {
    // This test validates the transition triggered by clicking the demonstration button.
    // According to the provided HTML, the click handler calls functions that are not defined
    // in the global scope. Those calls will throw a ReferenceError which is caught and
    // logged via console.error(error.message). We must observe that error message.

    // Click the demonstration button once.
    await demoPage.clickRunDemonstration();

    // Wait for at least one console message to be recorded, with a timeout to avoid flakiness.
    await page.waitForTimeout(50); // short pause to allow console handlers to run

    // Find console.error messages captured
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning' || m.type === 'log' && m.text.toLowerCase().includes('error'));

    // We expect an error message that mentions the first missing function: depositMoney
    const containsDepositError = consoleMessages.some(m => m.text.includes('depositMoney'));
    expect(containsDepositError).toBe(true);

    // Ensure that because functions are missing, none of the expected demonstration console.log outputs are present.
    // Those would be strings like "Depositing $100", "Transferring $50", "Buying $200 product", "Delivering package".
    const hasDepositingLog = consoleMessages.some(m => /Depositing \$?100/i.test(m.text));
    const hasTransferringLog = consoleMessages.some(m => /Transferring \$?50/i.test(m.text) || /Transferring \$?/.test(m.text));
    const hasBuyingLog = consoleMessages.some(m => /Buying \$?200/i.test(m.text));
    const hasDeliveringLog = consoleMessages.some(m => /Delivering package/i.test(m.text));

    // All those should be false because the functions are not defined and thus those logs are never executed.
    expect(hasDepositingLog, 'Depositing log should not appear because depositMoney is undefined').toBe(false);
    expect(hasTransferringLog, 'Transferring log should not appear because transferMoney is undefined').toBe(false);
    expect(hasBuyingLog, 'Buying log should not appear because buyProduct is undefined').toBe(false);
    expect(hasDeliveringLog, 'Delivering log should not appear because deliverPackage is undefined').toBe(false);

    // Ensure the error message references depositMoney (the first missing function invoked).
    // The script catches the thrown ReferenceError and logs error.message, so we assert that the message string includes the function name.
    const consoleTextAggregate = consoleMessages.map(m => `${m.type}: ${m.text}`).join('\n');
    expect(consoleTextAggregate).toContain('depositMoney');

    // Also confirm that there were no uncaught page errors because the click handler wraps calls in try/catch.
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple clicks produce repeated error logs for the missing function', async ({ page }) => {
    // This test checks the behavior when the user repeatedly triggers the same transition.
    // Because the runtime functions are missing, each click should result in the same caught error being logged repeatedly.

    // Click the button three times in quick succession.
    await demoPage.clickRunDemonstration();
    await demoPage.clickRunDemonstration();
    await demoPage.clickRunDemonstration();

    // Allow a short time for console messages to be emitted.
    await page.waitForTimeout(100);

    // Count how many console messages mention depositMoney (our primary missing function)
    const depositMessages = consoleMessages.filter(m => m.text.includes('depositMoney'));
    expect(depositMessages.length).toBeGreaterThanOrEqual(3);

    // Confirm each of these is logged via console.error (or at least as a console message)
    depositMessages.forEach(msg => {
      // The page's script uses console.error(error.message) inside the catch block.
      // Different browsers may classify console.error as 'error' type; accept 'error' or 'log' as recorded by Playwright.
      expect(['error', 'warning', 'log']).toContain(msg.type);
      expect(msg.text).toContain('depositMoney');
    });

    // Despite repeated clicks, there should be no uncaught exceptions reported as page errors.
    expect(pageErrors.length).toBe(0);
  });

  test('Validation of FSM expectations: evidence elements and absence of successful transaction logs', async ({ page }) => {
    // This test explicitly maps observable behavior to FSM evidence:
    // - S0_Idle evidence: the demonstration button is present in the DOM
    // - Transition evidence: clicking is wired (we can click it) and results in console output indicating errors (no successful transaction logs)
    // It also asserts that the application did not silently run the demonstration (no successful transaction logs).

    // S0 evidence
    const buttonExists = await page.$('#demonstration-button');
    expect(buttonExists).not.toBeNull();

    // Trigger transition
    await demoPage.clickRunDemonstration();
    await page.waitForTimeout(50);

    // Transition evidence: the page's script contains an addEventListener for click (we cannot introspect the exact handler function,
    // but we can assert its effect — that clicking produced console output).
    const loggedError = consoleMessages.some(m => m.text.includes('depositMoney') || m.text.toLowerCase().includes('is not defined'));
    expect(loggedError).toBe(true);

    // Confirm none of the expected success observables ("console.log messages for each transaction") exist.
    const successMessages = consoleMessages.filter(m =>
      /Depositing|Transferring|Buying|Delivering/i.test(m.text)
    );
    expect(successMessages.length).toBe(0);
  });

  test('Robustness check: ensure the DOM remains intact after failed demonstration run', async ({ page }) => {
    // After the demonstration attempt (which fails because helper functions are undefined),
    // verify that the UI is still interactive and no unintended DOM changes occurred.

    // Click the demonstration button (causes caught error)
    await demoPage.clickRunDemonstration();
    await page.waitForTimeout(50);

    // The button should still be visible and clickable.
    expect(await demoPage.isButtonVisible()).toBe(true);
    await demoPage.clickRunDemonstration(); // second click should still work (log another error)
    await page.waitForTimeout(50);

    // Confirm that the header and content remain unchanged.
    const header = await demoPage.getHeaderText();
    expect(header).toContain('ACID Properties');

    // No uncaught page errors should have been raised; errors were logged via console.error as per script.
    expect(pageErrors.length).toBe(0);
  });

  test('Negative scenario: ensure the application reports meaningful error messages when functions are missing', async ({ page }) => {
    // This test ensures that the error logging provides a useful message to developers (the error.message is logged).
    await demoPage.clickRunDemonstration();
    await page.waitForTimeout(50);

    // Look for any console.error or console messages that are string messages (error.message)
    const errorMessages = consoleMessages
      .filter(m => m.type === 'error' || m.text.toLowerCase().includes('is not defined') || m.text.toLowerCase().includes('undefined'))
      .map(m => m.text);

    expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    // At least one of the error messages should explicitly mention the missing symbol depositMoney.
    expect(errorMessages.some(text => text.includes('depositMoney'))).toBe(true);
  });
});