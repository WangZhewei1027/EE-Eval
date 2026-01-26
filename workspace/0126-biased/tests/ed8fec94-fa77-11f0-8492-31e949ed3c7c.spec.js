import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8fec94-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page object representing the Static Typing Showcase page.
 * Encapsulates selectors and common interactions for the tests below.
 */
class StaticTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick="toggleDescription()"]';
    this.extraInfoSelector = '#extraInfo';
    this.containerSelector = '.container';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure main interactive elements are present before proceeding
    await Promise.all([
      this.page.waitForSelector(this.buttonSelector, { state: 'visible' }),
      this.page.waitForSelector(this.extraInfoSelector),
      this.page.waitForSelector(this.containerSelector, { state: 'visible' }),
    ]);
  }

  async clickLearnMore() {
    await this.page.click(this.buttonSelector);
  }

  async getExtraInfoDisplay() {
    // Return the inline style.display value, not computed style, to match FSM expectations.
    return await this.page.$eval(this.extraInfoSelector, el => el.style.display);
  }

  async getExtraInfoText() {
    return await this.page.$eval(this.extraInfoSelector, el => el.textContent.trim());
  }

  async containerIsVisible() {
    return await this.page.isVisible(this.containerSelector);
  }

  async renderPagePresent() {
    // Check presence of a global renderPage function (FSM entry_action mentions it)
    return await this.page.evaluate(() => typeof window.renderPage === 'function');
  }
}

test.describe('Static Typing Showcase - FSM validation (ed8fec94-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection (including errors logged via console.error)
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught exceptions and page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Helpful debug info if a test fails - keep assertions consistent across tests
    // Note: We do not modify the page or application - only observe.
    if (pageErrors.length > 0) {
      // Log page errors to the test output to aid debugging
      for (const err of pageErrors) {
        console.error('Captured pageerror:', err && err.message ? err.message : err);
      }
    }

    if (consoleMessages.length > 0) {
      for (const msg of consoleMessages) {
        console.log(`Captured console [${msg.type}]: ${msg.text}`);
      }
    }
  });

  test('Initial state S0_Idle - page loads and extra info is hidden', async ({ page }) => {
    // This test validates the initial FSM state S0_Idle:
    // - renderPage() entry action is mentioned in FSM but not present in the implementation (we will assert absence)
    // - extraInfo should be hidden (style.display === 'none')
    // - the Learn More button should exist and be visible
    const ui = new StaticTypingPage(page);
    await ui.goto();

    // Validate container visibility
    expect(await ui.containerIsVisible()).toBeTruthy();

    // Validate the Learn More button is present and visible
    const buttonVisible = await page.isVisible(ui.buttonSelector);
    expect(buttonVisible).toBe(true);

    // Validate extra info initial inline display state is 'none'
    const display = await ui.getExtraInfoDisplay();
    expect(display).toBe('none');

    // Validate the extra info text matches the FSM's content
    const text = await ui.getExtraInfoText();
    expect(text).toContain('In static typing, variables are bound to a specific type');

    // Verify that a global renderPage function (FSM entry action) is NOT present in the runtime.
    // FSM mentions renderPage() as an entry_action for S0_Idle. The implementation does not define it,
    // so our expectation is that it is absent. We explicitly check this as part of "Verify onEnter/onExit actions if mentioned".
    const hasRenderPage = await ui.renderPagePresent();
    expect(hasRenderPage).toBe(false);

    // Ensure no uncaught page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error or type 'error' messages were emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1: clicking Learn More shows the description', async ({ page }) => {
    // This test validates the ToggleDescription event transitions from S0_Idle to S1_DescriptionVisible:
    // - Clicking the button should set extraInfo.style.display = 'block'
    // - The content should remain correct
    const ui = new StaticTypingPage(page);
    await ui.goto();

    // Click the button to show the description
    await ui.clickLearnMore();

    // Wait for the inline style to reflect the expected state
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.style && el.style.display === 'block';
    }, ui.extraInfoSelector);

    // Assert the extra info display inline style is 'block'
    const display = await ui.getExtraInfoDisplay();
    expect(display).toBe('block');

    // Assert the element text matches expected paragraph content
    const text = await ui.getExtraInfoText();
    expect(text).toContain('This contrasts with dynamic typing');

    // Ensure no runtime errors were produced by the toggle handler
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Transition S1 -> S0: clicking Learn More again hides the description', async ({ page }) => {
    // This test validates the ToggleDescription event transitions back from S1_DescriptionVisible to S0_Idle:
    // - Clicking the button when description visible should hide it (style.display = 'none')
    const ui = new StaticTypingPage(page);
    await ui.goto();

    // Show first
    await ui.clickLearnMore();
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.style && el.style.display === 'block';
    }, ui.extraInfoSelector);

    // Click again to hide
    await ui.clickLearnMore();
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.style && el.style.display === 'none';
    }, ui.extraInfoSelector);

    // Assert hidden
    const displayAfter = await ui.getExtraInfoDisplay();
    expect(displayAfter).toBe('none');

    // Ensure no errors were emitted during show/hide cycle
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Repeated rapid toggles produce consistent visibility state (edge case)', async ({ page }) => {
    // Edge case validation:
    // - Rapidly clicking the toggle button multiple times should still result in a deterministic final state
    // - We verify the element toggles between 'none' and 'block' after each click, and final state matches parity of clicks.
    const ui = new StaticTypingPage(page);
    await ui.goto();

    const clickCount = 7; // odd number -> final state should be visible ('block')
    for (let i = 0; i < clickCount; i++) {
      await ui.clickLearnMore();
      // Small delay to allow inline style change to apply; not waiting for animations since FSM uses inline display toggles
      await page.waitForTimeout(30);
    }

    const finalDisplay = await ui.getExtraInfoDisplay();
    expect(finalDisplay).toBe('block'); // 7 toggles from initial 'none' => visible

    // Now perform one more to make it even (8)
    await ui.clickLearnMore();
    await page.waitForTimeout(30);
    const finalDisplay2 = await ui.getExtraInfoDisplay();
    expect(finalDisplay2).toBe('none'); // even toggles -> hidden

    // Ensure no uncaught exceptions occurred during rapid interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Observability: no ReferenceError, SyntaxError, or TypeError logged to console or as page errors', async ({ page }) => {
    // This test explicitly checks for the absence of specific runtime error classes.
    // The instructions require observing console logs and page errors and letting errors happen naturally.
    // Here we assert that none of these error classes were recorded during normal usage (page load + a toggle).
    const ui = new StaticTypingPage(page);
    await ui.goto();

    // Perform an interaction to exercise the toggle handler
    await ui.clickLearnMore();
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.style && el.style.display === 'block';
    }, ui.extraInfoSelector);

    // Collect any console messages that mention common error class names
    const errorClassMessages = consoleMessages.filter(m =>
      /ReferenceError|SyntaxError|TypeError/i.test(m.text) || m.type === 'error'
    );

    // Also inspect pageErrors for messages containing those names
    const pageErrorMatches = pageErrors.filter(err =>
      /ReferenceError|SyntaxError|TypeError/i.test(err && err.message ? err.message : '')
    );

    // Assert none of those critical error types were recorded
    expect(errorClassMessages.length).toBe(0);
    expect(pageErrorMatches.length).toBe(0);

    // Also assert overall no page errors
    expect(pageErrors.length).toBe(0);
  });
});