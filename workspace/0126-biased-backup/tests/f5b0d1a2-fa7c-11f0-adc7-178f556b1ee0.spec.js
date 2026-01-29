import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0d1a2-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Tim Sort demo page
class TimSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButtonSelector = '#demonstration-button';
  }

  // Navigate to the application
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return Playwright element handle for the demonstration button
  async demoButton() {
    return this.page.$(this.demoButtonSelector);
  }

  // Click the demonstration button
  async clickDemoButton() {
    await this.page.click(this.demoButtonSelector);
  }

  // Get visible text content of the demonstration button
  async demoButtonText() {
    const el = await this.demoButton();
    if (!el) return null;
    return el.innerText();
  }

  // Get full HTML snapshot of the body
  async bodyHTML() {
    return this.page.evaluate(() => document.body.innerHTML);
  }

  // Count immediate children of body (simple DOM change detection)
  async bodyChildrenCount() {
    return this.page.evaluate(() => document.body.children.length);
  }
}

test.describe('Tim Sort Interactive Application - FSM validation', () => {
  // Each test gets a fresh page fixture from Playwright
  test.beforeEach(async ({ page }) => {
    // Intentionally nothing else here; navigation will be done in each test via the page object
  });

  test.afterEach(async ({ page }) => {
    // Cleanup listeners or other things if needed (Playwright tears down the page fixture automatically)
  });

  test('S0_Idle: Page renders and Idle state shows Demonstrate Tim Sort button', async ({ page }) => {
    // This test validates the Idle state entry action (renderPage()) by checking the DOM presence
    // of the expected button and its label.
    const app = new TimSortPage(page);
    await app.goto();

    // Verify the button is present in the DOM
    const button = await app.demoButton();
    expect(button).not.toBeNull();

    // Verify the button is visible and has the expected text
    const text = await app.demoButtonText();
    expect(text).toBe('Demonstrate Tim Sort');

    // Verify that no demonstration artifacts exist before interaction (no extra dynamic content)
    const initialBodyHTML = await app.bodyHTML();
    expect(initialBodyHTML.length).toBeGreaterThan(0); // page has content
    // Ensure the button exists within the body snapshot
    expect(initialBodyHTML).toContain('demonstration-button');
  });

  test('Transition DemonstrateClick: clicking the button triggers the demonstration and results in a ReferenceError due to missing TimSort implementation', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Demonstrating by clicking the button.
    // The page implementation calls TimSort(...) which is not defined in the HTML. We must
    // observe and assert that the expected runtime error (ReferenceError) occurs and that
    // the code attempts to call TimSort (evidence: error message contains TimSort).
    const app = new TimSortPage(page);
    await app.goto();

    // Capture page errors and console messages
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => {
      // pageerror provides an Error object; capture message for assertions
      pageErrors.push(err.message);
    });

    page.on('console', (msg) => {
      // capture text and type for richer assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Snapshot the DOM before clicking
    const beforeHTML = await app.bodyHTML();
    const beforeChildren = await app.bodyChildrenCount();

    // Perform the click which should trigger the demonstration handler
    await app.clickDemoButton();

    // Wait a short while for the pageerror / console events to be emitted
    await page.waitForTimeout(200);

    // Assert that at least one page error occurred due to calling undefined TimSort
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // One of the errors should mention 'TimSort' and indicate it's not defined (ReferenceError)
    const combinedErrors = pageErrors.join(' | ');
    expect(combinedErrors.toLowerCase()).toContain('timsort');
    // It's possible different browsers show different wording; check for 'not defined' or 'is not defined'
    expect(combinedErrors.toLowerCase()).toMatch(/not defined|is not defined/);

    // Verify that no successful console.log of the sorted result occurred.
    // The implementation intended to console.log(sortedInput), but because TimSort is undefined,
    // that logging path should not have produced the expected sorted string.
    const loggedTexts = consoleMessages.filter(m => m.type === 'log').map(m => m.text);
    // Ensure none of the console.log outputs contain the input string (the code would log sortedInput)
    const suspicious = loggedTexts.filter(t => typeof t === 'string' && t.includes('The quick brown fox'));
    expect(suspicious.length).toBe(0);

    // Ensure DOM did not unexpectedly change as a result of the erroneous demonstration
    const afterHTML = await app.bodyHTML();
    const afterChildren = await app.bodyChildrenCount();
    expect(afterChildren).toBe(beforeChildren);
    expect(afterHTML).toBe(beforeHTML);
  });

  test('Multiple clicks produce repeated ReferenceErrors (robustness / edge case)', async ({ page }) => {
    // This test checks the behavior when the user repeatedly triggers the demonstration.
    // Each click should attempt to call the missing TimSort function and thus produce errors repeatedly.
    const app = new TimSortPage(page);
    await app.goto();

    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Click the button multiple times
    const clickCount = 3;
    for (let i = 0; i < clickCount; i++) {
      await app.clickDemoButton();
      // small pause to allow the error to be fired and captured
      await page.waitForTimeout(100);
    }

    // Expect at least as many errors as clicks (some environments may batch or deduplicate, so be lenient)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // But we expect repeated attempts in a typical environment: at least 2 errors for 3 clicks is reasonable
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);

    // Validate the error content mentions TimSort each time (or at least in one captured message)
    const combined = pageErrors.join(' | ');
    expect(combined.toLowerCase()).toContain('timsort');
  });

  test('Edge case: clicking a removed button should fail gracefully (simulate missing component)', async ({ page }) => {
    // This test simulates an edge case where the button is removed from the DOM before a user tries
    // to interact with it. We do not modify or patch app logic beyond DOM removal to simulate the scenario.
    const app = new TimSortPage(page);
    await app.goto();

    // Remove the button from the DOM to simulate a missing component (user navigated mid-load, etc.)
    await page.evaluate(() => {
      const btn = document.getElementById('demonstration-button');
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    });

    // Confirm the button is gone
    const btnAfterRemoval = await app.demoButton();
    expect(btnAfterRemoval).toBeNull();

    // Attempting to click the removed button via Playwright should throw an error; assert that behavior.
    let clickError = null;
    try {
      await app.clickDemoButton();
    } catch (err) {
      clickError = err;
    }
    expect(clickError).not.toBeNull();
    // The error message should indicate that the element was not found or not attached
    expect(String(clickError).toLowerCase()).toMatch(/no node found|element .* not found|not attached|failed to find/);
  });

  test('FSM evidence check: ensure click handler is wired (by observing error originates from event listener code)', async ({ page }) => {
    // This test tries to assert that an event listener exists by intercepting the stack trace from the pageerror
    // and confirming it originates from the inline script that references TimSort. We will capture the pageerror
    // and inspect the stack if available. We do not patch the page or functions.
    const app = new TimSortPage(page);
    await app.goto();

    let capturedError = null;
    page.on('pageerror', (err) => {
      // capture the first error object
      if (!capturedError) capturedError = err;
    });

    // Click to trigger the handler (which calls undefined TimSort)
    await app.clickDemoButton();

    // Wait briefly to ensure the error arrives
    await page.waitForTimeout(200);

    // There should be an error captured
    expect(capturedError).not.toBeNull();

    const msg = capturedError.message || '';
    // The error message should mention TimSort
    expect(msg.toLowerCase()).toContain('timsort');

    // If stack information is available, it should reference the HTML file or the inline script.
    // We don't require a specific format; we assert that either message or stack mentions the page file name or 'script'
    const stack = capturedError.stack || '';
    // Accept any of these being true as evidence the error came from the page's inline script:
    const stackEvidence = stack.toLowerCase().includes('f5b0d1a2-fa7c-11f0-adc7-178f556b1ee0') || stack.toLowerCase().includes('<anonymous>') || stack.toLowerCase().includes('script');
    expect(stackEvidence || msg.toLowerCase().includes('timsort')).toBeTruthy();
  });
});