import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b185a1-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the BST demo page
class BSTDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.output = page.locator('#demoOutput');
    // Arrays to capture console messages and page errors
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Attach listeners to capture console and page errors
  attachLogging() {
    this.page.on('console', msg => {
      // Capture console messages with their type and text
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', error => {
      // Capture unhandled exceptions from the page
      this.pageErrors.push(error);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure the DOM is ready and locate elements
    await expect(this.button).toBeVisible({ timeout: 2000 });
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async isOutputInitiallyHidden() {
    // Check inline style attribute or computed style
    const inlineStyle = await this.output.getAttribute('style');
    const computedDisplay = await this.page.evaluate(el => getComputedStyle(el).display, await this.output.elementHandle());
    return { inlineStyle, computedDisplay };
  }

  async clickDemoButton() {
    await this.button.click();
  }

  async getOutputText() {
    return await this.output.textContent();
  }

  async isOutputVisible() {
    return await this.output.isVisible();
  }

  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

// Group related tests for clarity
test.describe('FSM: BST traversal demo (Application ID: f0b185a1-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Each test will have its own page and page object
  test.describe.configure({ mode: 'parallel' });

  test('S0_Idle: Page renders initial state with button visible and output hidden', async ({ page }) => {
    // Setup page object and attach logging early to capture any early console/page errors
    const demo = new BSTDemoPage(page);
    demo.attachLogging();

    // Navigate to the app
    await demo.goto();

    // Validate the demo button exists and has the expected label (entry action renderPage() observable)
    const buttonText = await demo.getButtonText();
    expect(buttonText).toBeTruthy();
    expect(buttonText.trim()).toBe('Show In-order Traversal');

    // Validate output container is present and initially hidden as per FSM evidence (style="display: none;")
    const { inlineStyle, computedDisplay } = await demo.isOutputInitiallyHidden();
    // Inline style should include display: none; as implemented in HTML
    expect(inlineStyle).toMatch(/display:\s*none\s*;?/i);
    // Computed display should be 'none'
    expect(computedDisplay).toBe('none');

    // Ensure no uncaught page errors occurred during initial render
    expect(demo.getPageErrors()).toHaveLength(0);

    // Ensure there are no console error messages
    const errorConsoleMessages = demo.getConsoleMessages().filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition ShowTraversal: clicking #demoButton displays traversal and updates DOM (S0 -> S1)', async ({ page }) => {
    // This test validates the transition from Idle to TraversalShown,
    // including display style change and correct traversal text.
    const demo = new BSTDemoPage(page);
    demo.attachLogging();

    await demo.goto();

    // Click the button to trigger inOrder traversal rendering
    await demo.clickDemoButton();

    // After click, output container should be visible
    await expect(demo.output).toBeVisible({ timeout: 2000 });
    const visible = await demo.isOutputVisible();
    expect(visible).toBe(true);

    // Verify inline style now reflects 'display: block' or computed style shows block
    const inlineStyleAfter = await demo.output.getAttribute('style');
    const computedDisplayAfter = await page.evaluate(el => getComputedStyle(el).display, await demo.output.elementHandle());
    // Inline style should either include display: block or computed display should be 'block'
    expect(
      (inlineStyleAfter && /display:\s*block\s*;?/i.test(inlineStyleAfter)) || computedDisplayAfter === 'block'
    ).toBe(true);

    // Validate the displayed traversal text matches the expected in-order sequence
    const outputText = await demo.getOutputText();
    expect(outputText).toBeTruthy();

    // The script sets: 'In-order traversal:\n' + traversal.join(' → ')
    // Expected traversal for the provided tree:
    const expectedSequence = '1 → 3 → 4 → 6 → 7 → 8 → 10 → 13 → 14';
    // Assert that the prefix and sequence are present and correctly formatted (with newline after colon)
    expect(outputText.startsWith('In-order traversal:')).toBe(true);
    expect(outputText).toContain(expectedSequence);

    // Ensure no uncaught exceptions occurred during the click and rendering
    expect(demo.getPageErrors()).toHaveLength(0);

    // Assert there are no console error messages emitted as part of the click action
    const errorConsoleMessages = demo.getConsoleMessages().filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Idempotency and repeated interactions: multiple clicks do not break traversal output', async ({ page }) => {
    // This test clicks the demo button multiple times to ensure the app is resilient
    // to repeated events and does not throw errors or produce incorrect output.
    const demo = new BSTDemoPage(page);
    demo.attachLogging();

    await demo.goto();

    // Click multiple times
    await demo.clickDemoButton();
    await demo.clickDemoButton();
    await demo.clickDemoButton();

    // Output should remain visible and contain the correct traversal
    await expect(demo.output).toBeVisible();
    const outputText = await demo.getOutputText();
    const expectedSequence = '1 → 3 → 4 → 6 → 7 → 8 → 10 → 13 → 14';
    expect(outputText).toContain(expectedSequence);

    // No unexpected pageerrors
    expect(demo.getPageErrors()).toHaveLength(0);

    // No console error messages
    const consoleErr = demo.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErr.length).toBe(0);
  });

  test('Edge case: clicking a non-existent element selector should raise an actionable Playwright error', async ({ page }) => {
    // This test intentionally triggers a Playwright interaction error by attempting to click
    // an element that does not exist. We assert that Playwright rejects the action.
    const demo = new BSTDemoPage(page);
    demo.attachLogging();

    await demo.goto();

    // Attempt to click a missing selector; expect the promise to be rejected
    const missingSelector = '#nonExistentDemoButton';
    // Use expect(...).rejects to assert that the click fails
    await expect(page.click(missingSelector)).rejects.toThrow();

    // Ensure that this user-side error did not produce uncaught page errors
    // (Playwright's click rejection occurs client-side in the test runner, not as a page runtime error)
    expect(demo.getPageErrors()).toHaveLength(0);
  });

  test('Behavioral check: output content formatting (newline and arrow separators)', async ({ page }) => {
    // Validate exact formatting: there should be a newline after the colon, and arrows should be ' → '
    const demo = new BSTDemoPage(page);
    demo.attachLogging();

    await demo.goto();
    await demo.clickDemoButton();

    const outputText = await demo.getOutputText();
    // The text should have a newline after 'In-order traversal:'
    expect(outputText).toMatch(/^In-order traversal:\s*\n/);

    // Ensure arrow separators are used between numbers and match the expected count (8 arrows for 9 elements)
    const arrows = outputText.match(/→/g) || [];
    expect(arrows.length).toBe(8);

    // Verify no trailing arrow at the end
    expect(outputText.trim().endsWith('14')).toBe(true);
  });

  test('Observe console messages and pageerrors throughout lifecycle', async ({ page }) => {
    // This test specifically demonstrates collection of console messages and pageerrors.
    // It asserts that no unhandled exceptions are present and logs any console output for visibility.
    const demo = new BSTDemoPage(page);
    demo.attachLogging();

    await demo.goto();
    // Before interaction, capture any console messages already recorded
    const beforeMsgs = demo.getConsoleMessages().slice();

    // Perform the traversal interaction
    await demo.clickDemoButton();

    // After interaction, capture additional messages
    const allMsgs = demo.getConsoleMessages();

    // For transparency, assert that any messages captured are valid strings
    for (const msg of allMsgs) {
      expect(typeof msg.type).toBe('string');
      expect(typeof msg.text).toBe('string');
    }

    // Assert there are no page-level uncaught errors
    expect(demo.getPageErrors()).toHaveLength(0);

    // Optionally, verify that console did not emit error-level messages
    const errorLogs = allMsgs.filter(m => m.type === 'error');
    expect(errorLogs.length).toBe(0);
  });
});