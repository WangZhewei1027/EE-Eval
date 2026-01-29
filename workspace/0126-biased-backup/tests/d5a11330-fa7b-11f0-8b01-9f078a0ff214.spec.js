import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a11330-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Tim Sort demo page
class TimSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showButtonSelector = 'button[onclick="showDemonstration()"]';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getShowButton() {
    return await this.page.$(this.showButtonSelector);
  }

  async clickShowButton() {
    // Use Playwright click to trigger the onclick alert
    await this.page.click(this.showButtonSelector);
  }

  async focusShowButton() {
    const btn = await this.getShowButton();
    if (!btn) throw new Error('Show Demonstration button not found to focus');
    await btn.focus();
  }
}

test.describe('Understanding Tim Sort - FSM and UI integration tests', () => {
  // These arrays will collect console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // Default navigation happens in each test explicitly via Page Object
    // No global setup required beyond this
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: ensure no lingering dialogs (Playwright auto-dismisses on navigation)
    // Nothing to do explicitly here
  });

  test('S0_Idle: Page loads and Idle state is present with Show Demonstration button', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) existence by checking the presence of the evidence element.
    const tim = new TimSortPage(page);

    // Capture console and page errors to assert none appear during load
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await tim.goto();

    // Assert that the page has loaded by checking title and heading text are present
    await expect(page).toHaveTitle(/Understanding Tim Sort/);
    await expect(page.locator('h1')).toHaveText('Understanding Tim Sort');

    // Verify the button exists with the exact onclick attribute as evidence of the Idle state's evidence
    const btn = await tim.getShowButton();
    expect(btn).not.toBeNull();
    const btnText = await page.locator(tim.showButtonSelector).innerText();
    expect(btnText).toBe('Show Demonstration');

    // There should be no console errors or page errors during normal load
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition ShowDemonstration: clicking the button triggers the DemonstrationShown entry action (alert)', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_DemonstrationShown by clicking the button
    // and asserting the alert (onEnter entry action) is shown with the expected message.
    const tim = new TimSortPage(page);

    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await tim.goto();

    // Listen for the dialog (alert) that should be produced as an entry action of S1_DemonstrationShown
    const dialogPromise = page.waitForEvent('dialog');

    // Trigger the event described in the FSM
    await tim.clickShowButton();

    // Wait for the alert and validate its message (verifies onEnter action)
    const dialog = await dialogPromise;
    try {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('This demonstration will display how Tim Sort organizes a small array!');
    } finally {
      // Must accept/dismiss the dialog so the page can continue
      await dialog.accept();
    }

    // After the alert, ensure the application remains in a usable state: the button still exists
    const btn = await tim.getShowButton();
    expect(btn).not.toBeNull();

    // Confirm no console errors or page errors occurred during the transition
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('DemonstrationShown state: multiple rapid clicks show repeated alerts (edge case)', async ({ page }) => {
    // This test validates behavior when the user clicks the button multiple times rapidly.
    // We expect multiple alerts with the same message to appear sequentially.
    const tim = new TimSortPage(page);
    await tim.goto();

    // We'll click the button three times and collect three dialogs
    const dialogs = [];
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Fire three clicks in quick succession
    await Promise.all([
      tim.clickShowButton(),
      tim.clickShowButton(),
      tim.clickShowButton()
    ]);

    // Wait briefly to ensure dialogs were processed
    await page.waitForTimeout(200);

    // Assert we received three alerts with expected message
    expect(dialogs.length).toBe(3);
    for (const d of dialogs) {
      expect(d.type).toBe('alert');
      expect(d.message).toBe('This demonstration will display how Tim Sort organizes a small array!');
    }
  });

  test('Transition via keyboard: focusing the button and pressing Enter triggers the same alert', async ({ page }) => {
    // This test checks an alternative user interaction (keyboard) to trigger the same transition/event.
    const tim = new TimSortPage(page);
    await tim.goto();

    // Prepare to capture the dialog
    const dialogPromise = page.waitForEvent('dialog');

    // Focus the button then press Enter to activate the onclick handler
    await tim.focusShowButton();
    await page.keyboard.press('Enter');

    const dialog = await dialogPromise;
    try {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('This demonstration will display how Tim Sort organizes a small array!');
    } finally {
      await dialog.accept();
    }
  });

  test('Negative case: clicking a non-existent selector should raise an error (edge/error scenario)', async ({ page }) => {
    // This test validates error handling when attempting to interact with an element that doesn't exist.
    // According to the instructions we must let errors happen naturally and assert that they occur.
    const tim = new TimSortPage(page);
    await tim.goto();

    // Attempt to click a selector that does not exist and assert Playwright throws
    // We expect the promise to be rejected.
    await expect(page.click('button#this-id-does-not-exist')).rejects.toThrow();
  });

  test('No unexpected runtime errors: observe console and pageerror across typical interactions', async ({ page }) => {
    // This test performs a normal interaction and asserts that no unexpected runtime errors (ReferenceError, TypeError, SyntaxError) appear.
    const tim = new TimSortPage(page);

    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await tim.goto();

    // Trigger the demonstration once
    const dialogPromise = page.waitForEvent('dialog');
    await tim.clickShowButton();
    const dialog = await dialogPromise;
    await dialog.accept();

    // After interactions, assert that there were no page errors (uncaught exceptions)
    expect(pageErrors.length).toBe(0);

    // Filter console messages for error types and also check for messages that indicate ReferenceError/TypeError/etc.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });
});