import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8fc581-fa77-11f0-8492-31e949ed3c7c.html';
const EXPECTED_ALERT_TEXT = "Explore feature coming soon!";

/**
 * Page Object for the Design Patterns Showcase page.
 * Encapsulates common interactions and queries for clearer tests.
 */
class DesignPatternsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      headerTitle: 'div.header h1',
      headerSubtitle: 'div.header p',
      patternBoxes: '.pattern-box',
      exploreButton: '.explore-button',
      body: 'body'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeaderTitleText() {
    return this.page.locator(this.selectors.headerTitle).innerText();
  }

  async getHeaderSubtitleText() {
    return this.page.locator(this.selectors.headerSubtitle).innerText();
  }

  async countPatternBoxes() {
    return this.page.locator(this.selectors.patternBoxes).count();
  }

  async exploreButton() {
    return this.page.locator(this.selectors.exploreButton);
  }

  async exploreButtonText() {
    return this.exploreButton().innerText();
  }

  async exploreButtonOnclickAttr() {
    return this.exploreButton().getAttribute('onclick');
  }

  async clickExploreButton() {
    // Use the Playwright click to trigger the inline onclick alert naturally.
    await this.exploreButton().click();
  }

  async focusExploreButton() {
    await this.exploreButton().focus();
  }

  async clickBody(x = 10, y = 10) {
    await this.page.mouse.click(x, y);
  }
}

/**
 * Utility to classify and assert on runtime page errors collected.
 * Ensures we don't silently ignore ReferenceError/TypeError/SyntaxError if they happen.
 */
function assertNoCriticalRuntimeErrors(pageErrors) {
  // Gather string representations of errors for assertions
  const messages = pageErrors.map(err => (err && err.message) ? err.message : String(err));
  // Assert that none of the common critical JS errors occurred
  for (const msg of messages) {
    expect(msg).not.toContain('ReferenceError');
    expect(msg).not.toContain('TypeError');
    expect(msg).not.toContain('SyntaxError');
  }
}

test.describe('Design Patterns Showcase - FSM S0_Idle and ExploreMoreClick', () => {
  // Containers for console messages and page errors observed during a test.
  let consoleMessages;
  let pageErrors;
  let dpPage;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught exceptions and page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    dpPage = new DesignPatternsPage(page);
    // Navigate to the page exactly as-is
    await dpPage.goto();
  });

  test.afterEach(async () => {
    // After each test we assert there were no unexpected critical runtime errors.
    // The application should not produce ReferenceError/TypeError/SyntaxError during normal use.
    assertNoCriticalRuntimeErrors(pageErrors);
  });

  test('Initial Idle state renders correctly (entry action: renderPage())', async ({ page }) => {
    // This test validates the Idle state entry: the page must render expected elements.
    // We check header text, subtitle, pattern boxes count, and Explore button presence.
    const title = await dpPage.getHeaderTitleText();
    expect(title).toBe('Design Patterns');

    const subtitle = await dpPage.getHeaderSubtitleText();
    expect(subtitle).toContain('Explore and appreciate the beauty of design principles.');

    const boxCount = await dpPage.countPatternBoxes();
    expect(boxCount).toBeGreaterThanOrEqual(4); // Expect the four pattern boxes rendered

    const exploreText = await dpPage.exploreButtonText();
    expect(exploreText).toBe('Explore More');

    const onclickAttr = await dpPage.exploreButtonOnclickAttr();
    // Verify the inline onclick handler is present and contains the alert message (evidence in FSM)
    expect(onclickAttr).toContain("alert('Explore feature coming soon!')");

    // Ensure no console errors were logged during initial render (smoke check).
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  test('Clicking "Explore More" triggers an alert with expected message (ExploreMoreClick event)', async ({ page }) => {
    // This test validates the FSM transition: clicking the button triggers the alert action.
    // Listen for the dialog event and assert its message contents exactly match expectation.
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      dpPage.clickExploreButton()
    ]);

    try {
      expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
    } finally {
      await dialog.accept();
    }

    // Ensure no uncaught page errors occurred during the interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking the Explore button multiple times displays multiple alerts sequentially (edge case)', async ({ page }) => {
    // Validate that repeated activations produce repeated dialogs and the page remains stable.
    // First click
    const firstDialogPromise = page.waitForEvent('dialog');
    await dpPage.clickExploreButton();
    const firstDialog = await firstDialogPromise;
    expect(firstDialog.message()).toBe(EXPECTED_ALERT_TEXT);
    await firstDialog.accept();

    // Second click immediately after
    const secondDialogPromise = page.waitForEvent('dialog');
    await dpPage.clickExploreButton();
    const secondDialog = await secondDialogPromise;
    expect(secondDialog.message()).toBe(EXPECTED_ALERT_TEXT);
    await secondDialog.accept();

    // No page errors from repeated quick interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard activation (Enter) on the Explore button triggers the same alert (accessibility scenario)', async ({ page }) => {
    // Focus the button and press Enter to simulate keyboard activation.
    await dpPage.focusExploreButton();

    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.keyboard.press('Enter')
    ]);

    expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
    await dialog.accept();

    // Confirm console has no unexpected errors
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  test('Clicking outside interactive controls does not trigger the ExploreMoreClick event (negative scenario)', async ({ page }) => {
    // Ensure clicking near the top-left of the page (outside the button) does not produce an alert.
    let dialogOccurred = false;
    const onDialog = () => { dialogOccurred = true; };
    page.on('dialog', onDialog);

    // Click coordinates (10, 10) should be within the body/background area, not the button
    await dpPage.clickBody(10, 10);
    // Give the page a short moment to react if any dialog would appear.
    await page.waitForTimeout(400);

    page.off('dialog', onDialog);

    expect(dialogOccurred).toBe(false);

    // Ensure again no page errors from this interaction
    expect(pageErrors.length).toBe(0);
  });

  test('DOM evidence: verify fade-in classes and visual structure exist (visual feedback)', async ({ page }) => {
    // Check that fade-in class is applied to header and content containers as in the HTML
    const headerHasFade = await page.locator('div.header').evaluate(node => node.classList.contains('fade-in'));
    const contentHasFade = await page.locator('div.content').evaluate(node => node.classList.contains('fade-in'));
    const buttonContainerHasFade = await page.locator('div.button-container').evaluate(node => node.classList.contains('fade-in'));

    expect(headerHasFade).toBe(true);
    expect(contentHasFade).toBe(true);
    expect(buttonContainerHasFade).toBe(true);

    // Verify pattern headers have expected names (spot-check)
    const firstPatternHeader = await page.locator('.pattern-box >> .pattern-header').first().innerText();
    expect(firstPatternHeader).toBe('Singleton');

    // No console errors reported
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  test('Runtime error observation: report any uncaught JavaScript errors (observability test)', async ({ page }) => {
    // This test is designed to assert on whether any ReferenceError/TypeError/SyntaxError occurred during page lifecycle.
    // We don't inject or modify the runtime; we merely assert the observed pageErrors array.
    if (pageErrors.length === 0) {
      // If there are no errors, that's acceptable; assert that we observed none.
      expect(pageErrors.length).toBe(0);
    } else {
      // If errors were observed, ensure they are surfaced and check their types/messages do not include critical keywords.
      // (We still fail the test if they include ReferenceError/TypeError/SyntaxError.)
      assertNoCriticalRuntimeErrors(pageErrors);
    }
  });
});