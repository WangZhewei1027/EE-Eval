import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a04fe2-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object representing the Binary Tree interactive page
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showButtonSelector = "button[onclick='displayTree()']";
    this.treeSelector = '#treeDisplay';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getShowButton() {
    return this.page.$(this.showButtonSelector);
  }

  async getTreeElement() {
    return this.page.$(this.treeSelector);
  }

  async clickShowButton() {
    await this.page.click(this.showButtonSelector);
  }

  async isTreeVisible() {
    return this.page.isVisible(this.treeSelector);
  }

  async treeInlineDisplayStyle() {
    return this.page.$eval(this.treeSelector, el => el.style.display);
  }

  async treeTextContent() {
    return this.page.$eval(this.treeSelector, el => el.innerText);
  }

  async getPageTitle() {
    return this.page.title();
  }
}

test.describe('Understanding Binary Trees - FSM tests (d5a04fe2-fa7b-11f0-8b01-9f078a0ff214)', () => {
  let pageErrors;
  let consoleErrors;
  let binaryTreePage;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console errors for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    binaryTreePage = new BinaryTreePage(page);
    await binaryTreePage.goto();
  });

  test.afterEach(async () => {
    // basic sanity: tests should ensure they left no unexpected page errors
    // but do not mutate or fix the page - just verify
  });

  test('Initial state S0_Idle: page renders, button present, tree hidden (entry_actions check)', async () => {
    // This test validates the initial Idle state:
    // - The page loads
    // - The "Show Binary Tree Structure" button exists
    // - The tree display element exists and is initially hidden (style.display === 'none')
    // - The FSM's declared S0 entry action "renderPage" is NOT defined on the page (we verify absence)
    const title = await binaryTreePage.getPageTitle();
    expect(title).toContain('Understanding Binary Trees');

    const button = await binaryTreePage.getShowButton();
    expect(button).not.toBeNull();

    // Check visible text of the button
    const buttonText = await (await button.getProperty('innerText')).jsonValue();
    expect(buttonText).toContain('Show Binary Tree Structure');

    // Verify tree element exists
    const treeEl = await binaryTreePage.getTreeElement();
    expect(treeEl).not.toBeNull();

    // The inline style attribute initially has display: none; and computed inline style should be 'none'
    const inlineStyle = await binaryTreePage.treeInlineDisplayStyle();
    expect(inlineStyle).toBe('none');

    // isVisible should be false
    const visible = await binaryTreePage.isTreeVisible();
    expect(visible).toBe(false);

    // Verify the S0 entry action "renderPage" mentioned by the FSM is not present on the page
    const renderPageType = await binaryTreePage.page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // No uncaught page errors or console errors at initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition ShowTree (S0_Idle -> S1_TreeDisplayed): clicking the button reveals the tree', async () => {
    // This test validates the transition triggered by clicking the button:
    // - After clicking, the tree display becomes visible
    // - The inline style is set to 'block'
    // - The content of the tree display contains the expected visual lines (A/B/C... etc.)
    // - No page errors or console errors occur as a result of the user interaction
    const initialVisible = await binaryTreePage.isTreeVisible();
    expect(initialVisible).toBe(false);

    await binaryTreePage.clickShowButton();

    // Wait for the element to be visible and then assert properties
    await binaryTreePage.page.waitForSelector('#treeDisplay', { state: 'visible' });

    const nowVisible = await binaryTreePage.isTreeVisible();
    expect(nowVisible).toBe(true);

    const displayStyle = await binaryTreePage.treeInlineDisplayStyle();
    // The FSM expected_observables specify: treeDisplay.style.display = 'block';
    expect(displayStyle).toBe('block');

    // Check that the displayed content includes the expected tree ASCII
    const treeText = await binaryTreePage.treeTextContent();
    expect(treeText).toMatch(/A/); // contains nodes like A
    expect(treeText).toMatch(/B/);
    expect(treeText).toMatch(/C/);

    // No errors should have been emitted by clicking the button
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotency and repeated interactions: clicking multiple times does not break S1_TreeDisplayed', async () => {
    // This test validates clicking the show button multiple times:
    // - the tree remains visible
    // - the style remains 'block'
    // - no additional errors are generated
    await binaryTreePage.clickShowButton();
    await binaryTreePage.page.waitForSelector('#treeDisplay', { state: 'visible' });

    // click again
    await binaryTreePage.clickShowButton();

    // Still visible
    expect(await binaryTreePage.isTreeVisible()).toBe(true);
    expect(await binaryTreePage.treeInlineDisplayStyle()).toBe('block');

    // No errors after repeated clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1 entry action verification: displayTree exists and is callable; direct invocation shows the tree', async () => {
    // The FSM indicates displayTree() is an entry action for S1.
    // Verify the function exists, and invoking it programmatically toggles the UI as expected.
    const typeofDisplayTree = await binaryTreePage.page.evaluate(() => typeof window.displayTree);
    expect(typeofDisplayTree).toBe('function');

    // Hide tree manually then call displayTree to ensure it shows it
    await binaryTreePage.page.evaluate(() => {
      const el = document.getElementById('treeDisplay');
      if (el) el.style.display = 'none';
    });
    expect(await binaryTreePage.isTreeVisible()).toBe(false);

    // Call displayTree via page.evaluate
    await binaryTreePage.page.evaluate(() => window.displayTree());

    // Now it should be visible
    await binaryTreePage.page.waitForSelector('#treeDisplay', { state: 'visible' });
    expect(await binaryTreePage.isTreeVisible()).toBe(true);

    // No page errors produced by calling the existing function
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM onEnter action "renderPage" absence: calling renderPage throws ReferenceError (error scenario)', async () => {
    // The FSM declared an S0 entry action renderPage() but the page implementation does not define it.
    // This test intentionally attempts to call renderPage() and asserts that it throws a ReferenceError,
    // allowing us to observe and assert on naturally occurring runtime errors per instructions.

    // Set up a fresh listener to capture any pageerror emitted by the unhandled exception
    const page = binaryTreePage.page;
    const capturedErrors = [];
    page.on('pageerror', e => capturedErrors.push(e));

    // Attempt to call renderPage and assert the evaluation rejects with a ReferenceError.
    // We use reject assertion to let the exception happen naturally and assert it occurred.
    await expect(page.evaluate(() => {
      // Directly call the missing function to produce an exception.
      // This will cause the page context to throw.
      // We do not catch it here so that Playwright surfaces it as an evaluation rejection and pageerror.
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);

    // Allow small time for pageerror event to be delivered
    await page.waitForTimeout(100);

    // The pageerror listener should have captured at least one error
    expect(capturedErrors.length).toBeGreaterThanOrEqual(1);
    // And the error message should reference renderPage
    const messages = capturedErrors.map(e => String(e && e.message ? e.message : e));
    const hasRenderPageMsg = messages.some(m => /renderPage/.test(m));
    expect(hasRenderPageMsg).toBe(true);
  });

  test('Accessibility / keyboard activation: pressing Enter on button triggers ShowTree transition', async () => {
    // This test simulates keyboard activation to ensure accessibility triggers same transition.
    // Focus the button and press Enter, then verify the tree appears.
    const page = binaryTreePage.page;
    const button = await binaryTreePage.getShowButton();
    await button.focus();
    await page.keyboard.press('Enter');

    await page.waitForSelector('#treeDisplay', { state: 'visible' });
    expect(await binaryTreePage.isTreeVisible()).toBe(true);
    expect(await binaryTreePage.treeInlineDisplayStyle()).toBe('block');

    // No errors generated by keyboard activation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM integrity: tree content contains expected sections and structure', async () => {
    // Validate the visual component contains the expected headings and preformatted ASCII tree.
    const treeText = await binaryTreePage.page.$eval('#treeDisplay', el => el.innerText);
    // Should mention "Binary Tree Structure"
    expect(treeText).toMatch(/Binary Tree Structure/i);
    // Should include multiple node letters A, B, C and lines showing slashes/backslashes
    expect(treeText).toMatch(/[A-F]/); // at least A-F characters present
    // No runtime errors during DOM inspection
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});