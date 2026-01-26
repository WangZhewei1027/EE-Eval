import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f2944-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the TCP/IP Visual Concept page
class TcpIpPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.heading = page.locator('h1');
    this.paragraph = page.locator('p');
    this.graphic = page.locator('.graphic');
    this.server = page.locator('.graphic .server');
    this.client = page.locator('.graphic .client');
    this.button = page.locator('.button');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async getButtonInnerText() {
    return this.button.innerText();
  }

  async getHeadingText() {
    return this.heading.innerText();
  }

  async getParagraphText() {
    return this.paragraph.innerText();
  }

  async getButtonOnclickAttribute() {
    return this.page.evaluate(() => {
      const btn = document.querySelector('.button');
      return btn ? btn.getAttribute('onclick') : null;
    });
  }

  async clickLearnMore() {
    await this.button.click();
  }

  async focusButton() {
    await this.button.focus();
  }

  async isVisible(selector) {
    return this.page.locator(selector).isVisible();
  }
}

test.describe('TCP/IP Visual Concept - FSM: S0_Idle and LearnMoreClick', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages and page errors (do not modify page)
    page.on('console', (msg) => {
      // store severity, text and location for debugging assertions
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location ? msg.location() : null,
      });
    });

    page.on('pageerror', (error) => {
      // collect runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(BASE_URL);
  });

  test.afterEach(async ({ page }) => {
    // Allow any pending dialogs to be closed to avoid interference with subsequent tests
    // (Each test explicitly handles dialogs; this is a safety step)
    try {
      // no-op: just ensure the page remains available
      await page.evaluate(() => true);
    } catch (e) {
      // ignore any evaluate errors here
    }
  });

  test('Initial render corresponds to Idle state (S0_Idle) - DOM structure and evidence', async ({ page }) => {
    const model = new TcpIpPage(page);

    // Validate main structure is present
    await expect(model.container).toBeVisible();
    await expect(model.heading).toHaveText('Understanding TCP/IP');
    await expect(model.paragraph).toContainText('Transmission Control Protocol / Internet Protocol (TCP/IP)');
    await expect(model.graphic).toBeVisible();
    await expect(model.server).toBeVisible();
    await expect(model.client).toBeVisible();

    // Button assertions - existence and visible text
    await expect(model.button).toBeVisible();
    await expect(model.button).toHaveText('Learn More');

    // Verify evidence: inline onclick attribute exists per FSM extraction
    const onclickAttr = await model.getButtonOnclickAttribute();
    // Assert that the onclick attribute contains the expected alert call text
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert");
    expect(onclickAttr).toContain("Learn More Coming Soon!");

    // Ensure no runtime page errors were emitted during initial render
    // If the application had errors (ReferenceError, TypeError), they'd be captured in pageErrors
    expect(pageErrors.length).toBe(0);

    // Log any console messages for debugging; assert there are no console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking the Learn More button triggers an alert with expected message and remains in Idle state (S0_Idle -> S0_Idle)', async ({ page }) => {
    const model = new TcpIpPage(page);

    // Capture the pre-click DOM snapshot for comparison
    const preHeading = await model.getHeadingText();
    const preParagraph = await model.getParagraphText();
    const preOnclick = await model.getButtonOnclickAttribute();

    // Wait for the alert dialog event and click the button
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      model.clickLearnMore(), // triggers an alert('Learn More Coming Soon!')
    ]);

    // Validate the dialog properties as per FSM expected observable
    expect(dialog).toBeTruthy();
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Learn More Coming Soon!');

    // Accept the alert to continue
    await dialog.accept();

    // After the alert, verify the page remains effectively in the same Idle state:
    // the heading, paragraph and onclick attribute should be unchanged.
    const postHeading = await model.getHeadingText();
    const postParagraph = await model.getParagraphText();
    const postOnclick = await model.getButtonOnclickAttribute();

    expect(postHeading).toBe(preHeading);
    expect(postParagraph).toBe(preParagraph);
    expect(postOnclick).toBe(preOnclick);

    // Ensure no runtime errors were emitted as a result of clicking
    expect(pageErrors.length).toBe(0);

    // Confirm no console errors/warnings were produced during click
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid multiple clicks produce sequential alerts with the same message (edge case)', async ({ page }) => {
    const model = new TcpIpPage(page);

    // Click the button twice in sequence, waiting for each alert and accepting it.
    // Alerts are modal; Playwright needs to wait for them serially.
    const firstDialogPromise = page.waitForEvent('dialog');
    await model.clickLearnMore();
    const firstDialog = await firstDialogPromise;
    expect(firstDialog.type()).toBe('alert');
    expect(firstDialog.message()).toBe('Learn More Coming Soon!');
    await firstDialog.accept();

    const secondDialogPromise = page.waitForEvent('dialog');
    await model.clickLearnMore();
    const secondDialog = await secondDialogPromise;
    expect(secondDialog.type()).toBe('alert');
    expect(secondDialog.message()).toBe('Learn More Coming Soon!');
    await secondDialog.accept();

    // After successive alerts, verify button still exists and onclick still set
    await expect(model.button).toBeVisible();
    const onclickAttr = await model.getButtonOnclickAttribute();
    expect(onclickAttr).toContain("Learn More Coming Soon!");

    // No unexpected runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard activation (Enter) on focused Learn More button triggers the same alert', async ({ page }) => {
    const model = new TcpIpPage(page);

    // Focus the button and press Enter
    await model.focusButton();

    const dialogPromise = page.waitForEvent('dialog');
    await page.keyboard.press('Enter');
    const dialog = await dialogPromise;

    expect(dialog).toBeTruthy();
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Learn More Coming Soon!');
    await dialog.accept();

    // Ensure the DOM still reflects Idle state
    await expect(model.button).toBeVisible();
    expect((await model.getButtonOnclickAttribute())).toContain("alert");

    // No runtime errors or console error messages
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Sanity: verify clicking does not navigate away or remove onclick attribute (transition persistence)', async ({ page }) => {
    const model = new TcpIpPage(page);

    // Record URL before click
    const beforeUrl = page.url();

    // Trigger alert and accept
    const dialogPromise = page.waitForEvent('dialog');
    await model.clickLearnMore();
    const dialog = await dialogPromise;
    await dialog.accept();

    // Ensure URL unchanged (no navigation occurred)
    expect(page.url()).toBe(beforeUrl);

    // Ensure onclick attribute remains intact
    const onclickAttrAfter = await model.getButtonOnclickAttribute();
    expect(onclickAttrAfter).toBeTruthy();
    expect(onclickAttrAfter).toContain("Learn More Coming Soon!");

    // No runtime page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console and runtime errors: assert none occurred during full interaction flow', async ({ page }) => {
    const model = new TcpIpPage(page);

    // Perform a small interaction sequence: focus, click, accept
    const dialogPromise = page.waitForEvent('dialog');
    await model.clickLearnMore();
    const dialog = await dialogPromise;
    await dialog.accept();

    // At this point we've collected console messages and page errors via listeners
    // Assert that there were no uncaught runtime errors (ReferenceError, TypeError, SyntaxError etc.)
    expect(pageErrors.length).toBe(0);

    // Assert there are no console errors or warnings emitted during the interaction
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);

    // For transparency, ensure at least the button click happened (evidence of interaction)
    await expect(model.button).toBeVisible();
  });
});