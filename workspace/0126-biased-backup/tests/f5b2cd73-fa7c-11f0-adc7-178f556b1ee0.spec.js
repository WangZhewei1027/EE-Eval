import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2cd73-fa7c-11f0-adc7-178f556b1ee0.html';

// Page object to encapsulate interactions with the HTTP Explanation page
class ExamplePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.viewButtonSelector = 'button[onclick="displayExample()"]';
    this.exampleSelector = '#example';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  viewButton() {
    return this.page.locator(this.viewButtonSelector);
  }

  example() {
    return this.page.locator(this.exampleSelector);
  }

  async clickViewExample() {
    await this.viewButton().click();
  }

  async getExampleText() {
    // innerText to preserve visible text formatting
    return (await this.example().innerText()).trim();
  }

  async getExampleHTML() {
    return (await this.example().innerHTML()).trim();
  }
}

test.describe('FSM: HTTP Explanation (f5b2cd73-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Capture runtime page errors and console messages for each test
  test.beforeEach(async ({ page }) => {
    // Attach empty handlers here; individual tests will wire up collections if they need to inspect them
    // (we keep this hook to demonstrate structured setup)
  });

  // Test initial Idle state S0_Idle: button present and example container empty
  test('S0_Idle: Page loads with "View Example" button and empty example container', async ({ page }) => {
    // Setup collectors for pageerrors and console messages
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const examplePage = new ExamplePage(page);
    await examplePage.goto();

    // Validate that the View Example button exists and has expected label
    const button = examplePage.viewButton();
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('View Example');

    // Validate that the #example container exists in the DOM but is initially empty (or whitespace)
    const exampleLocator = examplePage.example();
    await expect(exampleLocator).toHaveCount(1);
    const initialHTML = await exampleLocator.innerHTML();
    // The initial HTML should be empty or only whitespace
    expect(initialHTML.trim()).toBe('');

    // Ensure there are no uncaught page errors immediately after load
    expect(pageErrors.length).toBe(0);

    // No console error messages by default (we accept other console types but ensure 'error' is not present)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition: clicking the button triggers displayExample() and populates expected content
  test('Transition ViewExample -> S1_ExampleDisplayed: clicking "View Example" shows HTTP examples', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const examplePage = new ExamplePage(page);
    await examplePage.goto();

    // Click the button to trigger the transition / entry action
    await examplePage.clickViewExample();

    // Validate that the example container contains the expected example lines
    const text = await examplePage.getExampleText();

    // FSM expected observables (strings should be present somewhere in the displayed content)
    expect(text).toContain('Example: GET /path/to/resource HTTP/1.1');
    expect(text).toContain('Example: HTTP/1.1 200 OK');
    expect(text).toContain('Example: HTTP/1.1 301 Moved Permanently');

    // Also assert that the raw code snippets are displayed
    expect(text).toContain('GET /path/to/resource HTTP/1.1');
    expect(text).toContain('HTTP/1.1 200 OK');
    expect(text).toContain('HTTP/1.1 301 Moved Permanently');

    // Confirm no uncaught page errors occurred as a result of clicking the button
    expect(pageErrors.length).toBe(0);

    // Confirm no console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate the onEnter entry action for S1_ExampleDisplayed: displayExample() is the entry action
  test('S1_ExampleDisplayed entry action: invoking displayExample() directly produces the same output', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const examplePage = new ExamplePage(page);
    await examplePage.goto();

    // Call the global function displayExample() directly from page context (this is the FSM entry action)
    await page.evaluate(() => {
      // Call the function if it exists; this replicates the entry action displayExample()
      if (typeof window.displayExample === 'function') {
        window.displayExample();
      }
    });

    // After calling the entry action, verify the expected content appears
    const text = await examplePage.getExampleText();
    expect(text).toContain('Example: GET /path/to/resource HTTP/1.1');
    expect(text).toContain('Example: HTTP/1.1 200 OK');
    expect(text).toContain('Example: HTTP/1.1 301 Moved Permanently');

    // Ensure no uncaught errors occurred during the explicit call
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: calling an undefined function in page context should produce a ReferenceError naturally
  test('Edge case: calling an undefined function in page context should raise a ReferenceError', async ({ page }) => {
    await page.goto(APP_URL);

    // Calling a function that does not exist should reject with a ReferenceError
    // We intentionally call an undefined function to let the runtime produce the natural error
    await expect(page.evaluate(() => {
      // This function is intentionally undefined in the page scope
      // eslint-disable-next-line no-undef
      return missingFunc();
    })).rejects.toThrow(/missingFunc is not defined|ReferenceError/);
  });

  // Edge case: executing invalid JavaScript in page context produces a SyntaxError
  test('Edge case: evaluating invalid JavaScript source throws a SyntaxError', async ({ page }) => {
    await page.goto(APP_URL);

    // Evaluate an invalid JavaScript string (unclosed assignment) to trigger a SyntaxError
    // We expect the evaluation to reject with a syntax-related error
    await expect(page.evaluate("var invalid = ;")).rejects.toThrow(/Unexpected token|SyntaxError/);
  });

  // Edge case: remove the target element and then call displayExample() to provoke a TypeError
  test('Edge case: calling displayExample() after removing #example element should raise a TypeError', async ({ page }) => {
    await page.goto(APP_URL);

    // Remove the #example element and then call the function which will attempt to set innerHTML on null
    await expect(page.evaluate(() => {
      const el = document.getElementById('example');
      if (el) el.remove();
      // Now call the existing displayExample(), which should attempt to access the removed element
      return displayExample();
    })).rejects.toThrow(/Cannot set property 'innerHTML' of null|Cannot set properties of null|TypeError/);
  });

  // Repeated clicks should be safe and idempotent: clicking multiple times should not throw and content should be present
  test('Robustness: multiple clicks on "View Example" are safe and keep expected content', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    const examplePage = new ExamplePage(page);
    await examplePage.goto();

    // Click multiple times
    await examplePage.clickViewExample();
    await examplePage.clickViewExample(); // second click should replace content or re-render without error

    const text = await examplePage.getExampleText();
    expect(text).toContain('Example: GET /path/to/resource HTTP/1.1');
    expect(text).toContain('Example: HTTP/1.1 200 OK');
    expect(text).toContain('Example: HTTP/1.1 301 Moved Permanently');

    // Ensure repeated interactions did not produce uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure no console 'error' messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});