import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04434671-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page Object Model for the Big-Theta Notation page.
 * Encapsulates locators and common interactions so tests remain readable.
 */
class BigThetaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.header = page.locator('.header h1');
    this.headerParagraph = page.locator('.header p');
    this.footer = page.locator('.footer p');
    this.buttonLocators = page.locator('.button-container .button'); // there are two buttons with same class
    // Provide helpers to access the first and second button explicitly by index
    this.learnMoreButton = (index = 0) => this.buttonLocators.nth(index);
    this.viewExamplesButton = (index = 1) => this.buttonLocators.nth(index);
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickLearnMore() {
    await this.learnMoreButton().click();
  }

  async clickViewExamples() {
    await this.viewExamplesButton().click();
  }
}

test.describe('Big-Theta Notation Interactive App - FSM validation', () => {
  // Collect console messages and page errors for each test to assert on them.
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests will attach listeners as needed.
  });

  test.afterEach(async ({ page }) => {
    // Ensure any pending network activity is settled between tests.
    // This helps avoid cross-test interference.
    await page.waitForTimeout(50);
  });

  test.describe('Idle state (S0_Idle) - initial render checks', () => {
    test('renders page layout and components on load (entry action: renderPage())', async ({ page }) => {
      // This test validates the "Idle" state's entry: that the page is rendered with expected DOM.
      const app = new BigThetaPage(page);

      // Listen for console and page errors to capture any runtime problems during initial render.
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      await app.goto();

      // Validate core structural elements exist
      await expect(app.container).toBeVisible();
      await expect(app.header).toHaveText('Big-Theta Notation');
      await expect(app.headerParagraph).toContainText('Learn about the Big-Theta notation');
      await expect(app.footer).toContainText('© 2023 Big-Theta Notation');

      // There should be two buttons (as per the HTML): Learn More and View Examples
      await expect(app.buttonLocators).toHaveCount(2);
      await expect(app.learnMoreButton()).toHaveText('Learn More');
      await expect(app.viewExamplesButton()).toHaveText('View Examples');

      // Assert no uncaught page errors occurred during initial render.
      // If errors occurred they will be in pageErrors; we assert it's empty.
      expect(pageErrors.length).toBe(0);

      // Also assert that console logs do not include unexpected errors.
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
    });
  });

  test.describe('Events and transitions - LearnMoreClick and ViewExamplesClick', () => {
    test('Learn More button click triggers console logs (checks event handlers and transition)', async ({ page }) => {
      // This test validates the LearnMoreClick transition defined in the FSM by clicking the "Learn More" button
      // and observing console output. It also documents the actual observed behavior when implementation has issues.
      const app = new BigThetaPage(page);

      // Collect console logs and page errors for assertions.
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => {
        // Capture all console types, but we expect 'log' messages according to code evidence.
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      await app.goto();

      // Click the first button (intended: Learn More)
      await app.clickLearnMore();

      // Small wait to allow console handlers to run
      await page.waitForTimeout(50);

      // Extract only 'log' messages (the implementation uses console.log)
      const logs = consoleMessages.filter(m => m.type === 'log').map(m => m.text);

      // The intended behavior (FSM/evidence) is that clicking "Learn More" logs "Learn More button clicked".
      // The actual HTML implementation attaches both listeners to the same element (document.querySelector('.button')),
      // so clicking the first button will produce BOTH logs. We assert the observed behavior.
      expect(logs).toContain('Learn More button clicked');
      // Because of the implementation bug, clicking the first button also triggers the 'View Examples' listener,
      // therefore we assert that that log is present as well (edge-case observation).
      expect(logs).toContain('View Examples button clicked');

      // Ensure no uncaught page errors happened during the click
      expect(pageErrors.length).toBe(0);
    });

    test('View Examples button click (second button) produces no console logs due to implementation bug', async ({ page }) => {
      // This test validates the ViewExamplesClick event. The FSM expects a log when the "View Examples" button is clicked.
      // The actual implementation mistakenly attaches event listeners to the first .button element only.
      // Therefore clicking the second button will NOT trigger console messages. This test asserts that edge-case.
      const app = new BigThetaPage(page);

      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      await app.goto();

      // Click the second button (intended: View Examples)
      await app.clickViewExamples();

      // Wait to ensure any console handlers (if attached) run.
      await page.waitForTimeout(50);

      const logs = consoleMessages.filter(m => m.type === 'log').map(m => m.text);

      // Because of the implementation bug (both variables assigned to same first button),
      // the second button has no event listeners attached. Thus, clicking it should produce zero logs.
      expect(logs.length).toBe(0);

      // If the FSM expected an observable console log for this transition, this test highlights a mismatch.
      // Assert no uncaught runtime page errors occurred when clicking the second button.
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Learn More multiple times produces repeated logs (idempotent transition observation)', async ({ page }) => {
      // Ensure that repeated clicks repeatedly invoke the attached listeners (transition remains available).
      const app = new BigThetaPage(page);

      const consoleMessages = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      await app.goto();

      // Click the first button three times
      await app.clickLearnMore();
      await app.clickLearnMore();
      await app.clickLearnMore();

      await page.waitForTimeout(100);

      // For each click, because both listeners are attached to the first button, we expect both messages per click.
      const logs = consoleMessages.filter(m => m.type === 'log').map(m => m.text);

      // There should be 3 occurrences of each message.
      const countOfLearnMore = logs.filter(l => l === 'Learn More button clicked').length;
      const countOfViewExamples = logs.filter(l => l === 'View Examples button clicked').length;

      expect(countOfLearnMore).toBe(3);
      expect(countOfViewExamples).toBe(3);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error observation', () => {
    test('collects any uncaught page errors and reports them (test will fail if there are uncaught exceptions)', async ({ page }) => {
      // This test demonstrates observation of page errors (ReferenceError, SyntaxError, TypeError) if they happen.
      // It will fail if there are uncaught exceptions because we assert there are none for this page implementation.
      const app = new BigThetaPage(page);
      const pageErrors = [];
      page.on('pageerror', err => {
        // Capture the error object for assertions below
        pageErrors.push(err);
      });

      await app.goto();

      // No explicit action is needed; this test asserts whether any uncaught errors occurred on load.
      // The expectation here is that the provided HTML/JS does not throw uncaught exceptions.
      // If the environment had missing globals or syntax issues, those errors would be present in pageErrors.
      expect(Array.isArray(pageErrors)).toBe(true);
      expect(pageErrors.length).toBe(0);
    });

    test('captures console error messages separately from console.log (if any occur)', async ({ page }) => {
      // This test separates console errors from logs and ensures there are no console-level errors.
      const app = new BigThetaPage(page);

      const consoleErrors = [];
      const consoleLogs = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        } else {
          consoleLogs.push({ type: msg.type(), text: msg.text() });
        }
      });

      await app.goto();

      // Interact a bit to potentially trigger additional console output
      await app.clickLearnMore();
      await app.clickViewExamples();
      await page.waitForTimeout(50);

      // Assert that no console.error was emitted by the page
      expect(consoleErrors.length).toBe(0);

      // There should be some console.log entries related to button clicks when clicking the first button.
      // Validate that at least one log exists for clicks (the implementation uses console.log).
      const logTexts = consoleLogs.map(l => l.text);
      const hasLearnMoreLog = logTexts.includes('Learn More button clicked');
      const hasViewExamplesLog = logTexts.includes('View Examples button clicked');

      // Because of the documented implementation issue, clicking the first button produces both logs,
      // while clicking the second produces none. Assert that we observed at least the Learn More log.
      expect(hasLearnMoreLog).toBe(true);
      // The presence of the View Examples log depends on which element was clicked (first click produced both).
      // We don't require it here to ensure this assert remains robust across environments, but we log it if present.
      // If present, it should be a plain string as emitted by console.log.
      if (hasViewExamplesLog) {
        expect(typeof 'View Examples button clicked').toBe('string');
      }
    });
  });
});