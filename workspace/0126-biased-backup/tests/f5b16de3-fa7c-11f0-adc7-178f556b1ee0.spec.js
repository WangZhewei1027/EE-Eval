import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b16de3-fa7c-11f0-adc7-178f556b1ee0.html';

// Simple Page Object for the A* Search demo page
class AStarPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateButton = page.locator("button[onclick='generateExample()']");
    this.heading = page.locator('h1');
    this.bodyText = page.locator('body');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async getButtonText() {
    return this.generateButton.innerText();
  }

  async getHeadingText() {
    return this.heading.innerText();
  }
}

test.describe('FSM: A* Search Interactive Application (f5b16de3-fa7c-11f0-adc7-178f556b1ee0)', () => {
  let consoleMessages;
  let pageErrors;

  // Set up listeners before each test to collect console messages and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages (type and text)
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() throws, store raw
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', (err) => {
      // Collect error objects from the page
      // err is an Error as created in the page context (name, message, stack)
      pageErrors.push(err);
    });
  });

  // Cleanup listeners after each test (Playwright will auto-clean page, but ensure arrays cleared)
  test.afterEach(async () => {
    consoleMessages = [];
    pageErrors = [];
  });

  test('Idle state: page renders and shows Generate Example button and explanatory content', async ({ page }) => {
    // Validates S0_Idle evidence: renderPage() is mentioned in FSM, but in this actual implementation
    // we only verify the presence of the UI elements that represent the Idle state.
    const app = new AStarPage(page);
    await app.goto();

    // Verify page heading and content exist
    const heading = await app.getHeadingText();
    expect(heading).toContain('A* Search');

    // Verify button exists and has expected label
    await expect(app.generateButton).toBeVisible();
    const btnText = await app.getButtonText();
    expect(btnText.trim()).toBe('Generate Example');

    // There should be no page errors immediately on load for this implementation
    expect(pageErrors.length).toBe(0);

    // Validate that informational content exists (a few keywords)
    const body = await app.bodyText.innerText();
    expect(body).toContain('A* Search is an algorithm');
    expect(body).toContain('Example: Finding the Shortest Path in a Grid');
  });

  test('Transition GenerateExample: clicking Generate Example triggers generateExample() and results in a ReferenceError (missing "target")', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_ExampleGenerated as implemented:
    // - It clicks the button that calls generateExample()
    // - The page's A* implementation is broken: it references `target` which is not defined,
    //   so we expect a ReferenceError to occur naturally.
    const app = new AStarPage(page);
    await app.goto();

    // Wait for any initial console messages (should be none relevant)
    await page.waitForLoadState('domcontentloaded');

    // Click and wait for the pageerror event that the broken implementation will raise.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'), // wait for the ReferenceError thrown inside generateExample()
      app.clickGenerate(), // trigger the broken algorithm
    ]);

    // Assert that a page error occurred and is a ReferenceError about "target"
    expect(error).toBeTruthy();
    // The error thrown by the page should be a ReferenceError (name may be set)
    // and its message should mention 'target' since the code references target[0]
    expect(error.name).toBe('ReferenceError');
    expect(error.message.toLowerCase()).toContain('target');

    // Ensure that no successful "Path:" or "Estimated Total Cost:" logs were emitted
    const texts = consoleMessages.map((m) => m.text);
    const containsPath = texts.some((t) => t.includes('Path:'));
    const containsCost = texts.some((t) => t.includes('Estimated Total Cost:'));
    expect(containsPath).toBe(false);
    expect(containsCost).toBe(false);

    // Confirm that an explanatory console message like "No path found." was also not emitted
    const containsNoPathFound = texts.some((t) => t.includes('No path found.'));
    expect(containsNoPathFound).toBe(false);

    // The button should still be present after the error (no DOM changes expected)
    await expect(app.generateButton).toBeVisible();
  });

  test('Edge case: multiple clicks produce repeated errors and do not produce successful outputs', async ({ page }) => {
    // This test exercises repeated event triggers (user clicking multiple times),
    // verifying that multiple errors occur naturally and are captured.
    const app = new AStarPage(page);
    await app.goto();

    // Click the button three times and collect the resulting pageerror events
    // We'll sequentially wait for errors to avoid race conditions
    const errors = [];
    for (let i = 0; i < 3; i++) {
      // Perform click and wait for an error each time
      const [err] = await Promise.all([page.waitForEvent('pageerror'), app.clickGenerate()]);
      errors.push(err);
    }

    // Expect three ReferenceErrors (or at least three page errors)
    expect(errors.length).toBe(3);
    for (const err of errors) {
      expect(err).toBeTruthy();
      expect(err.name).toBe('ReferenceError');
      expect(err.message.toLowerCase()).toContain('target');
    }

    // Verify console still does not contain the success logs
    const texts = consoleMessages.map((m) => m.text);
    expect(texts.some((t) => t.includes('Path:'))).toBe(false);
    expect(texts.some((t) => t.includes('Estimated Total Cost:'))).toBe(false);
  });

  test('FSM evidence check: button selector from FSM exists and is interactive', async ({ page }) => {
    // This test asserts the FSM component detection evidence:
    // - The FSM expects a button[onclick="generateExample()"], so ensure the selector exists,
    //   is clickable, and that clicking triggers some page-level error (showing the handler is wired).
    const app = new AStarPage(page);
    await app.goto();

    // Ensure selector matches exactly one element
    const count = await page.locator("button[onclick='generateExample()']").count();
    expect(count).toBe(1);

    // Click and assert we receive a pageerror (demonstrating the onclick handler is connected)
    const [err] = await Promise.all([page.waitForEvent('pageerror'), app.clickGenerate()]);
    expect(err).toBeTruthy();
    expect(err.name).toBe('ReferenceError');
  });

  test('Error details inspection: verify stack traces include generateExample and aStarSearch when available', async ({ page }) => {
    // This test inspects the pageerror stack to confirm it originates from the functions defined
    // in the page script (generateExample / aStarSearch). The stack may vary, but we assert that
    // at least the function name appears in the stack trace string where provided.
    const app = new AStarPage(page);
    await app.goto();

    const [err] = await Promise.all([page.waitForEvent('pageerror'), app.clickGenerate()]);
    expect(err).toBeTruthy();

    // Some environments include function names in the stack; check stack if present.
    if (err.stack) {
      // Convert to lowercase for robust matching
      const stackLower = err.stack.toLowerCase();
      // It's reasonable to expect 'generateexample' or 'astarsearch' as textual fragments
      const hasGenerate = stackLower.includes('generateexample') || stackLower.includes('generateexample()');
      const hasAStar = stackLower.includes('astarsearch') || stackLower.includes('aStarSearch'.toLowerCase());
      // At least one of these should be present in the stack trace for the error coming from our script
      expect(hasGenerate || hasAStar).toBe(true);
    } else {
      // If no stack available, ensure the message itself references the function context or variable
      expect(err.message.toLowerCase()).toContain('target');
    }
  });
});