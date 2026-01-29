import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b20a21-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object representing the NP-Completeness page
class NPCompletePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#np-complete-button');
    this.missingTextSelector = '#np-complete-text';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return (await this.button.textContent()) || '';
  }

  async clickButton() {
    await this.button.click();
  }

  async missingTextElementCount() {
    return await this.page.locator(this.missingTextSelector).count();
  }

  async hasHeading(text) {
    return await this.page.locator(`h2`, { hasText: text }).count() > 0;
  }

  async getAllParagraphsText() {
    return await this.page.$$eval('.text-explanation p', nodes => nodes.map(n => n.textContent));
  }
}

test.describe('NP-Completeness interactive app - FSM validation (f5b20a21-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Ensure each test starts from a fresh page load
  test.beforeEach(async ({ page }) => {
    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test('S0_Idle: Initial render should display content and the "Learn More" button', async ({ page }) => {
    // Validate the initial state (S0_Idle) entry action renderPage() produced expected DOM
    const app = new NPCompletePage(page);

    // The main heading should be present as part of the rendered content
    expect(await app.hasHeading('NP-Completeness')).toBeTruthy();

    // There should be several explanatory paragraphs rendered
    const paragraphs = await app.getAllParagraphsText();
    expect(paragraphs.length).toBeGreaterThanOrEqual(4); // several paragraphs exist

    // The primary button must be visible and have the exact initial text expected in FSM
    await expect(page.locator('#np-complete-button')).toBeVisible();
    const initialButtonText = await app.getButtonText();
    expect(initialButtonText.trim()).toBe('Learn More About NP-Completeness');

    // The element that the script expects (#np-complete-text) is intentionally missing in the page.
    // Confirm that it is not present so subsequent tests can assert error behavior.
    const missingCount = await app.missingTextElementCount();
    expect(missingCount).toBe(0);
  });

  test('ButtonClick transition: clicking the button triggers a runtime error due to missing element and does NOT update button text', async ({ page }) => {
    // This test validates the ButtonClick event and the transition described in the FSM.
    // The transition attempts to read text from #np-complete-text which does not exist,
    // so we expect a page 'pageerror' to be emitted and no change to the button text.

    const app = new NPCompletePage(page);

    // Capture console messages for debugging and ensure we observe pageerror events
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Prepare to wait for the page error that the in-page script will throw when the button is clicked.
    const waitForError = page.waitForEvent('pageerror');

    // Click the button (this should trigger the script that references the missing element)
    await app.clickButton();

    // Await the thrown error from the page
    const pageError = await waitForError;
    // The pageError should be an Error object and its message should indicate the null dereference
    expect(pageError).toBeInstanceOf(Error);
    // Different browsers/engines have slightly different messages; match key substrings
    expect(pageError.message).toMatch(/textContent|Cannot read properties of null|Cannot read property 'textContent'/);

    // After the failing attempt to transition, the button text should remain unchanged (state did not update)
    const buttonTextAfterClick = await app.getButtonText();
    expect(buttonTextAfterClick.trim()).toBe('Learn More About NP-Completeness');

    // No element #np-complete-text should still exist
    expect(await app.missingTextElementCount()).toBe(0);

    // Ensure console did not log an additional informative message that contradicts the failure expectation
    // (We don't expect the page to silently handle the error.)
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // It's acceptable if there are no console error/warning messages, but record their presence for debugging.
    // We assert that pageerror was received (above); console errors are optional.
    expect(pageError).toBeTruthy();
  });

  test('Edge case: multiple clicks generate multiple page errors (consistent failing transition behavior)', async ({ page }) => {
    // Validate repeated invocations of the ButtonClick event produce consistent errors.
    const app = new NPCompletePage(page);

    // First click -> wait for first pageerror
    const p1 = page.waitForEvent('pageerror');
    await app.clickButton();
    const err1 = await p1;
    expect(err1).toBeInstanceOf(Error);
    expect(err1.message).toMatch(/textContent|Cannot read properties of null|Cannot read property 'textContent'/);

    // Second click -> wait for second pageerror
    const p2 = page.waitForEvent('pageerror');
    await app.clickButton();
    const err2 = await p2;
    expect(err2).toBeInstanceOf(Error);
    expect(err2.message).toMatch(/textContent|Cannot read properties of null|Cannot read property 'textContent'/);

    // The button text should remain the original after both failed attempts
    const finalButtonText = await app.getButtonText();
    expect(finalButtonText.trim()).toBe('Learn More About NP-Completeness');
  });

  test('S1_Updated state: cannot be reached because required DOM element is missing; assert transition failed', async ({ page }) => {
    // FSM's S1_Updated entry evidence is setting the button's text content to the content of #np-complete-text.
    // Because that source element is missing, the state cannot be reached. This test explicitly asserts that.
    const app = new NPCompletePage(page);

    // Precondition: #np-complete-text is absent
    expect(await app.missingTextElementCount()).toBe(0);

    // Attempt the transition and capture the page error
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      app.clickButton()
    ]);
    expect(pageError).toBeInstanceOf(Error);

    // Because S1_Updated would change the button text to some other value, verify that this did not happen
    const buttonText = await app.getButtonText();
    expect(buttonText.trim()).toBe('Learn More About NP-Completeness');

    // Also verify that evaluating the intended transition action in the page environment would return null for the missing element
    const missingElementHandle = await page.evaluate(() => document.getElementById('np-complete-text'));
    expect(missingElementHandle).toBeNull();
  });
});