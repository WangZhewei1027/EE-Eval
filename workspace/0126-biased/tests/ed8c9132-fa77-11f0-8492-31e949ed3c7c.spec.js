import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8c9132-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Queue Visualization page
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
    this.queueSelector = '.queue-container';
    this.elementSelector = '.queue-container .element';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForSelector(this.queueSelector);
  }

  async getElements() {
    return this.page.$$(this.elementSelector);
  }

  async getElementTexts() {
    const els = await this.getElements();
    const texts = [];
    for (const el of els) {
      texts.push((await el.textContent()).trim());
    }
    return texts;
  }

  async clickAdd() {
    await this.page.click(this.buttonSelector);
  }

  async getCountVariable() {
    // Read the global `count` declared in the page script
    return this.page.evaluate(() => {
      // Accessing window.count (let count is global in the page)
      // If not accessible, this will return undefined which we assert accordingly in tests
      return typeof window.count !== 'undefined' ? window.count : null;
    });
  }

  async getButtonOnClickAttribute() {
    return this.page.getAttribute(this.buttonSelector, 'onclick');
  }

  async elementCount() {
    return this.page.locator(this.elementSelector).count();
  }
}

test.describe('Queue Visualization - FSM states and transitions', () => {
  let queuePage;
  let consoleMessages;
  let pageErrors;

  // Setup: attach listeners to capture console and page errors, and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    queuePage = new QueuePage(page);
    await queuePage.goto();
  });

  test.afterEach(async () => {
    // No teardown actions required beyond the Playwright test runner's cleanup.
    // We keep this hook so we can add assertions about console/page errors per the requirements if desired.
  });

  test('Initial State: should render five initial queue elements (1..5)', async ({ page }) => {
    // This test validates the FSM S0_Initial evidence:
    // - There should be five .element nodes with texts 1,2,3,4,5 in order.

    // Verify the number of elements
    const initialCount = await queuePage.elementCount();
    expect(initialCount).toBe(5);

    // Verify the text values of the elements
    const texts = await queuePage.getElementTexts();
    expect(texts).toEqual(['1', '2', '3', '4', '5']);

    // Verify each element has the correct class and is visible
    const elements = await queuePage.getElements();
    for (const el of elements) {
      const className = await el.getAttribute('class');
      expect(className).toContain('element');
      expect(await el.isVisible()).toBeTruthy();
    }

    // Verify the Add Element button exists and has the onclick evidence
    const onclickAttr = await queuePage.getButtonOnClickAttribute();
    expect(onclickAttr).toBe('addElement()');

    // Assert that there are no runtime page errors at initial load
    // (We collect any pageerror events via the pageErrors array)
    expect(pageErrors.length, `Expected no runtime page errors on load, found: ${pageErrors.length}`).toBe(0);

    // Assert that there are no console.error messages at initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages on load, found: ${consoleErrors.length}`).toBe(0);

    // Cross-check the global `count` variable matches the last visible element (sanity check)
    const globalCount = await queuePage.getCountVariable();
    expect(globalCount).toBe(5);
    expect(texts[texts.length - 1]).toBe(String(globalCount));
  });

  test('Transition AddElement: clicking the Add Element button appends a new element with incremented count', async ({ page }) => {
    // This test validates the transition from S0_Initial -> S1_ElementAdded via event AddElement.
    // It asserts that clicking the .button triggers DOM changes that append a new .element
    // and that the new element's textContent equals ++count.

    // Initial assertions
    expect(await queuePage.elementCount()).toBe(5);
    expect(await queuePage.getCountVariable()).toBe(5);

    // Click once: should append '6'
    await queuePage.clickAdd();

    // Wait for new element to appear (new count = 6)
    await page.waitForSelector('.queue-container .element:nth-child(6)');

    // Verify count variable incremented
    const afterCount1 = await queuePage.getCountVariable();
    expect(afterCount1).toBe(6);

    // Verify there are now 6 elements and the last has text '6'
    expect(await queuePage.elementCount()).toBe(6);
    const textsAfter1 = await queuePage.getElementTexts();
    expect(textsAfter1[5]).toBe('6');

    // Click multiple times and validate sequential increments (edge case: rapid clicks)
    await queuePage.clickAdd(); // should be 7
    await queuePage.clickAdd(); // should be 8
    // Wait until we have 8 elements
    await page.waitForFunction(
      () => document.querySelectorAll('.queue-container .element').length === 8
    );

    const afterCount3 = await queuePage.getCountVariable();
    expect(afterCount3).toBe(8);

    const finalTexts = await queuePage.getElementTexts();
    expect(finalTexts.slice(-3)).toEqual(['6', '7', '8']);

    // Ensure the order is preserved (FIFO-like visualization: appended at the end)
    // First element should still be '1'
    expect(finalTexts[0]).toBe('1');

    // Ensure no console errors or page errors occurred during interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages during AddElement interactions, found: ${consoleErrors.length}`).toBe(0);
    expect(pageErrors.length, `Expected no page errors during AddElement interactions, found: ${pageErrors.length}`).toBe(0);
  });

  test('Edge case: perform many rapid additions and validate stability', async ({ page }) => {
    // This test rapidly clicks the Add Element button 20 times to detect race conditions
    // or issues when appending many elements. It verifies that count increments consistently
    // and that all appended elements exist.

    const startingCount = await queuePage.getCountVariable();
    expect(startingCount).toBeGreaterThanOrEqual(5); // sanity check

    const clicks = 20;
    // Rapidly perform clicks without waiting for each DOM update
    for (let i = 0; i < clicks; i++) {
      await queuePage.clickAdd();
    }

    // Wait until total elements equals starting + clicks
    const expectedTotal = startingCount + clicks;
    await page.waitForFunction(
      (sel, expected) => document.querySelectorAll(sel).length === expected,
      {},
      '.queue-container .element',
      expectedTotal
    );

    const finalCountVar = await queuePage.getCountVariable();
    expect(finalCountVar).toBe(expectedTotal);

    const totalElements = await queuePage.elementCount();
    expect(totalElements).toBe(expectedTotal);

    // Verify last element's text equals finalCountVar
    const texts = await queuePage.getElementTexts();
    expect(texts[texts.length - 1]).toBe(String(finalCountVar));

    // Ensure no unexpected errors were emitted during heavy interaction
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `No console.error messages expected during heavy interactions, found: ${consoleErrors.length}`).toBe(0);
    expect(pageErrors.length, `No page errors expected during heavy interactions, found: ${pageErrors.length}`).toBe(0);
  });

  test('Sanity check: verify DOM evidence strings from FSM exist in the HTML source and runtime', async ({ page }) => {
    // This test asserts that the static HTML evidence referenced by the FSM exists on the page.
    // It checks for the initial element markup and the onclick handler string in the button's attribute.

    // Check that the page source contains the expected static snippets by reading innerHTML of container
    const queueInnerHTML = await page.$eval('.queue-container', el => el.innerHTML);

    // Evidence should include a div with class "element" containing "1" through "5"
    expect(queueInnerHTML).toContain('<div class="element">1</div>');
    expect(queueInnerHTML).toContain('<div class="element">2</div>');
    expect(queueInnerHTML).toContain('<div class="element">3</div>');
    expect(queueInnerHTML).toContain('<div class="element">4</div>');
    expect(queueInnerHTML).toContain('<div class="element">5</div>');

    // The button attribute should match evidence "onclick=\"addElement()\""
    const onclickAttr = await queuePage.getButtonOnClickAttribute();
    // Playwright returns the attribute value without surrounding quotes
    expect(onclickAttr).toBe('addElement()');

    // No runtime errors expected while reading static evidence
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture and report any console or runtime errors (test asserts none occurred)', async ({ page }) => {
    // This test is dedicated to observing console and runtime errors while interacting with the page.
    // Per requirements we must observe console logs and page errors and assert the observed state.

    // Perform a few interactions to provide potential for errors
    await queuePage.clickAdd();
    await queuePage.clickAdd();

    // Short delay to allow any asynchronous errors to surface
    await page.waitForTimeout(200);

    // Collate console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');

    // Assert that no page-level runtime errors were thrown
    expect(pageErrors.length, `Expected zero page runtime errors, but found ${pageErrors.length}. Errors: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);

    // Assert that no console.error messages were emitted
    expect(consoleErrors.length, `Expected zero console.error messages, but found ${consoleErrors.length}. Messages: ${consoleErrors.map(m => m.text).join(' | ')}`).toBe(0);

    // For transparency, also assert that some console messages may exist but are not errors
    // (we don't fail on console.log/info by default)
    const nonErrorConsole = consoleMessages.filter(m => m.type !== 'error');
    // It's acceptable for this to be zero or greater; we simply assert the structure is present
    expect(Array.isArray(nonErrorConsole)).toBe(true);
  });

});