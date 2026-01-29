import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3f6a0-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Simple page object for the OSI Model interactive page.
 * Encapsulates common locators and helper assertions used across tests.
 */
class OSIPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.button');
    this.demo = page.locator('#demo');
  }

  async clickToggle() {
    await this.button.click();
  }

  async demoStyleDisplayAttribute() {
    // Returns the inline style value for display (e.g., "none" or "block")
    return this.demo.evaluate((node) => node.getAttribute('style') || node.style.display || '');
  }

  async demoStyleDisplayProperty() {
    // Returns the style.display property value from the DOM element
    return this.demo.evaluate((node) => node.style.display);
  }

  async demoComputedDisplay() {
    // Returns the computed style.display value (what is actually rendered)
    return this.demo.evaluate((node) => window.getComputedStyle(node).display);
  }

  async buttonOnClickAttribute() {
    return this.button.evaluate((btn) => btn.getAttribute('onclick'));
  }

  async demoInnerText() {
    return this.demo.innerText();
  }

  async isDemoVisibleByComputedStyle() {
    const display = await this.demoComputedDisplay();
    // 'none' -> hidden, any other -> visible (commonly 'block')
    return display !== 'none';
  }
}

test.describe('FSM-driven OSI Model interactive tests', () => {
  let page;
  let osi;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages for inspection
    consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors
    pageErrors = [];
    page.on('pageerror', (err) => {
      // err is an Error coming from the page's context
      pageErrors.push({
        name: err && err.name ? err.name : 'UnknownError',
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : undefined,
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });

    osi = new OSIPage(page);
  });

  test.afterEach(async () => {
    // Close page to free resources
    await page.close();
  });

  test('S0 Idle: initial state has toggle button and demo hidden', async () => {
    // Validate button exists and contains the expected text and onclick attribute
    await expect(osi.button).toBeVisible();
    await expect(osi.button).toHaveText('Show Encapsulation Example');

    const onclick = await osi.buttonOnClickAttribute();
    // The implementation attaches onclick="toggleDemo()"
    expect(onclick).toBeTruthy();
    expect(onclick).toContain('toggleDemo');

    // The demo DIV in the HTML initially has style "display: none;"
    const inlineStyle = await osi.demoStyleDisplayAttribute();
    // inline style could be "display: none;" or style attribute absent (but here it's present)
    expect(inlineStyle).toBeTruthy();
    expect(inlineStyle).toContain('display: none');

    // Check the style property also reports 'none'
    const propDisplay = await osi.demoStyleDisplayProperty();
    // style.display may be 'none' because inline style is present
    expect(propDisplay === 'none' || propDisplay === '').toBeTruthy();

    // Computed style must report 'none' (hidden)
    const computed = await osi.demoComputedDisplay();
    expect(computed).toBe('none');

    // No uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // No console errors reported initially
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1: clicking the button shows the demo (display block)', async () => {
    // Click once to show the demo
    await osi.clickToggle();

    // The inline style display property should now be 'block'
    const propDisplay = await osi.demoStyleDisplayProperty();
    expect(propDisplay).toBe('block');

    // Computed style should also indicate visible (commonly 'block')
    const computed = await osi.demoComputedDisplay();
    expect(computed === 'block' || computed === 'inline' || computed === 'flex').toBeTruthy();

    // Check demo content to ensure correct content is present
    const inner = await osi.demoInnerText();
    expect(inner).toContain('Example: Sending an Email');

    // Ensure no uncaught page errors happened as a result of the click
    expect(pageErrors.length).toBe(0);

    // Ensure no console error messages were emitted
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1 -> S2 -> S1: successive clicks toggle demo hidden/visible (cycle)', async () => {
    // Show
    await osi.clickToggle();
    let computed = await osi.demoComputedDisplay();
    expect(computed !== 'none').toBeTruthy();

    // Hide (click again)
    await osi.clickToggle();
    computed = await osi.demoComputedDisplay();
    expect(computed).toBe('none');

    // Show again
    await osi.clickToggle();
    computed = await osi.demoComputedDisplay();
    expect(computed !== 'none').toBeTruthy();

    // Verify parity: odd clicks -> visible, even clicks -> hidden
    // We'll perform 4 more clicks and assert final state is hidden (since we have already clicked 3 times)
    for (let i = 0; i < 4; i++) {
      await osi.clickToggle();
    }
    // 3 + 4 = 7 clicks => odd -> visible
    computed = await osi.demoComputedDisplay();
    // 7 is odd => visible
    expect(computed !== 'none').toBeTruthy();

    // No page errors produced during toggles
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks should still toggle correctly and not throw', async () => {
    // Rapidly click the toggle button 5 times
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      // Initiate the click without awaiting any animations (the page is simple)
      await osi.clickToggle();
    }

    // Starting from hidden -> after 5 clicks (odd) should be visible
    const computed = await osi.demoComputedDisplay();
    expect(computed !== 'none').toBeTruthy();

    // Confirm no console error messages occurred
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Confirm no uncaught page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenarios - calling non-existent functions in page context should produce ReferenceError when invoked', async () => {
    // Attempt to synchronously call a function that does not exist: renderPage()
    // We expect the evaluate to reject with an error (ReferenceError).
    let caught = null;
    try {
      await page.evaluate(() => {
        // This will throw a ReferenceError in the page context
        // We do not catch it so the evaluate promise rejects.
        // This mirrors an application bug where an expected function is missing.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeTruthy();
    // Playwright surfaces the error message from the page; ensure it's a reference to the missing identifier
    // The exact message may vary by browser engine, but usually contains 'renderPage is not defined' or 'renderPage is not defined'
    expect(String(caught.message).toLowerCase()).toContain('renderpage');

    // Trigger an uncaught ReferenceError that will emit a pageerror event
    // We schedule the throw asynchronously so it becomes an uncaught exception in the page environment.
    await page.evaluate(() => {
      setTimeout(() => {
        // eslint-disable-next-line no-undef
        nonExistentFunctionToTriggerPageError();
      }, 0);
    });

    // Wait for the pageerror to be captured (give short timeout)
    await page.waitForTimeout(100); // allow microtask/macrotask to run
    const refErrors = pageErrors.filter((e) => e.name === 'ReferenceError' || /not defined/i.test(e.message));
    expect(refErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Error scenarios - TypeError when treating a non-callable as a function', async () => {
    // Calling demo.style.display() should raise a TypeError because display is a string, not a function.
    let caught = null;
    try {
      await page.evaluate(() => {
        const demo = document.getElementById('demo');
        // This will attempt to call a string as a function in the page context -> TypeError
        // eslint-disable-next-line no-undef
        return demo.style.display();
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeTruthy();
    // The error message should indicate that something is not a function or not callable
    expect(
      String(caught.message).toLowerCase().includes('is not a function') ||
        String(caught.message).toLowerCase().includes('not a function') ||
        String(caught.message).toLowerCase().includes('is not callable') ||
        String(caught.message).toLowerCase().includes('typeerror')
    ).toBeTruthy();
  });

  test('Error scenarios - SyntaxError from evaluating malformed code via eval in page context', async () => {
    // Use eval in the page to create a SyntaxError
    let caught = null;
    try {
      await page.evaluate(() => {
        // This eval contains a syntax error and will throw a SyntaxError
        eval('function badSyntax( { ');
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeTruthy();
    // The message should reference 'SyntaxError' or be recognizable as a syntax issue
    expect(String(caught.message).toLowerCase()).toContain('syntax');
  });

  test('Sanity: page console and pageerror listeners recorded expected messages during error tests', async () => {
    // This test triggers a known error and confirms our listeners catch it
    // Clear previously collected arrays
    consoleMessages = [];
    pageErrors = [];

    // Trigger an uncaught ReferenceError on the page
    await page.evaluate(() => {
      setTimeout(() => {
        // eslint-disable-next-line no-undef
        definitelyDoesNotExist();
      }, 0);
    });

    // Allow time for the pageerror to be emitted
    await page.waitForTimeout(100);

    // Our pageErrors listener should have captured at least one entry
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const first = pageErrors[0];
    expect(first.message.toLowerCase()).toContain('is not defined');
    // Ensure that the console did not produce fatal messages beyond pageerror (consoleErrors could be empty or contain messages)
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    // We don't assert a strict count here because console behavior varies, but we assert our listeners are functional
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});