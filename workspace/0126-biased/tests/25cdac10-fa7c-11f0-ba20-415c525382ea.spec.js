import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cdac10-fa7c-11f0-ba20-415c525382ea.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demo-button');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isButtonVisible() {
    return this.button.isVisible();
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async isButtonDisabled() {
    // Use getAttribute because "disabled" may be reflected as attribute when true
    const attr = await this.button.getAttribute('disabled');
    // Playwright also provides isDisabled() method:
    const disabledProp = await this.button.isDisabled();
    // Return boolean using the robust check
    return attr !== null || disabledProp === true;
  }

  async clickButton() {
    return this.button.click();
  }

  async waitForOutputVisible() {
    return this.page.waitForSelector('#demo-output', { state: 'visible' });
  }

  async isOutputVisible() {
    return this.output.isVisible();
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async getOutputStyleAttr() {
    return this.output.getAttribute('style');
  }

  async getOutputAriaAttributes() {
    return {
      'aria-live': await this.output.getAttribute('aria-live'),
      'aria-atomic': await this.output.getAttribute('aria-atomic'),
    };
  }
}

test.describe('Understanding Dynamic Typing demo - FSM validation (Application ID: 25cdac10-fa7c-11f0-ba20-415c525382ea)', () => {
  // Collect console messages and page errors for each test to assert on them.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize trackers
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events and collect them for assertions
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
      };
      consoleMessages.push(message);
      if (msg.type() === 'error') {
        consoleErrors.push(message);
      }
    });

    // Listen for unhandled errors on the page
    page.on('pageerror', error => {
      // pageerror events indicate uncaught exceptions thrown in the page context
      pageErrors.push(error);
    });

    // Navigate to the app under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic sanity: assert that no uncaught exceptions were emitted to the page
    // and no console 'error' messages were emitted. This checks for ReferenceError/SyntaxError/TypeError occurrences.
    // If there are errors, they will be surfaced by these assertions so we don't mask runtime problems.
    expect(pageErrors.length, `Expected no uncaught page errors, but got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, but got: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Initial state (S0_Idle): button present and demo output hidden', async ({ page }) => {
    // Validate initial Idle state for FSM:
    // - Demo button exists with expected text and aria-label
    // - Demo output exists but is hidden (display:none)
    const demo = new DemoPage(page);

    // Check button presence and properties
    await expect(demo.button).toBeVisible();
    const buttonText = await demo.getButtonText();
    expect(buttonText?.trim(), 'Initial button text should be "Show Demo"').toBe('Show Demo');

    const ariaLabel = await demo.button.getAttribute('aria-label');
    expect(ariaLabel, 'Button should have correct aria-label').toBe('Show dynamic typing demonstration output');

    // Button should not be disabled initially
    const disabled = await demo.isButtonDisabled();
    expect(disabled, 'Button should be enabled in Idle state').toBe(false);

    // Output should be present in the DOM but hidden
    await expect(demo.output).toBeHidden();
    const styleAttr = await demo.getOutputStyleAttr();
    // The FSM and implementation indicate style="display:none;"
    expect(styleAttr, 'Output should initially have display:none style attribute').toBeTruthy();
    expect(styleAttr).toContain('display:none');

    // Accessibility attributes should be set on the pre element per implementation
    const aria = await demo.getOutputAriaAttributes();
    expect(aria['aria-live']).toBe('polite');
    expect(aria['aria-atomic']).toBe('true');
  });

  test('Transition S0_Idle -> S1_DemoShown on click: output visible, content populated, button disabled and label changed', async ({ page }) => {
    // Validate behavior when user clicks the demo button:
    // - output becomes visible and text is set
    // - button is disabled and text changes to "Demo Shown"
    const demo = new DemoPage(page);

    // Click the button to trigger the demo
    await demo.clickButton();

    // Wait for output to become visible (transition action: output.style.display = 'block')
    await demo.waitForOutputVisible();
    expect(await demo.isOutputVisible()).toBe(true);

    // Output should have non-empty text content
    const outputText = (await demo.getOutputText()) || '';
    expect(outputText.length).toBeGreaterThan(0);

    // Check that output contains the expected demonstration lines from the JS implementation
    // These lines are derived from the script that pushes "x = 42;", 'typeof x === "number"' etc.
    expect(outputText).toContain('x = 42;');
    expect(outputText).toContain('typeof x === "number"');
    expect(outputText).toContain('x = "Dynamic typing!";');
    expect(outputText).toContain('typeof x === "string"');
    expect(outputText).toContain('x = true;');
    expect(outputText).toContain('typeof x === "boolean"');

    // Button should now be disabled and its text should be "Demo Shown"
    const disabledAfter = await demo.isButtonDisabled();
    expect(disabledAfter).toBe(true);

    const buttonTextAfter = (await demo.getButtonText())?.trim();
    expect(buttonTextAfter).toBe('Demo Shown');
  });

  test('Edge case: clicking an already-disabled button should not be allowed (Playwright will error) and no new errors thrown to the page', async ({ page }) => {
    // This test validates the FSM invariant that once the transition happened, further clicks are not permitted.
    const demo = new DemoPage(page);

    // Trigger the transition first
    await demo.clickButton();
    await demo.waitForOutputVisible();

    // Attempting to click via the regular API should fail because the element is disabled.
    // We assert that Playwright rejects the attempt to click due to disabled state.
    // This models the real-world behavior: user cannot interact with a disabled control.
    await expect(demo.button.click()).rejects.toThrow();

    // Ensure no additional uncaught page errors were emitted as a result of the attempted interaction.
    // The afterEach assertion will also verify no console.error or pageerror events occurred.
  });

  test('Content validation: output is deterministic and includes JSON-escaped string values', async ({ page }) => {
    // Ensure the output content formatting includes JSON.stringify for string values per implementation
    const demo = new DemoPage(page);

    await demo.clickButton();
    await demo.waitForOutputVisible();

    const outputText = (await demo.getOutputText()) || '';

    // The implementation uses JSON.stringify for the string value, so quotes should be included in the printed value
    expect(outputText).toContain('typeof x === "string" (value: "Dynamic typing!")');
  });

  test('FSM state assertions - re-check DOM reflects described transition actions', async ({ page }) => {
    // This test explicitly checks each action listed in the FSM transition:
    // actions: output.style.display = 'block'; output.textContent = ''; btn.disabled = true; btn.textContent = "Demo Shown";
    const demo = new DemoPage(page);

    // Before click, ensure output textContent is empty (per evidence initial)
    const initialOutputText = await demo.getOutputText();
    // In the DOM it's initially empty string
    expect(initialOutputText?.trim() ?? '').toBe('');

    // Click to trigger actions
    await demo.clickButton();
    await demo.waitForOutputVisible();

    // Confirm output.style.display is effectively 'block' by checking visibility
    expect(await demo.isOutputVisible()).toBe(true);

    // Ensure output.textContent was set by the handler (should not be empty anymore)
    const contentAfter = await demo.getOutputText();
    expect(contentAfter?.length).toBeGreaterThan(0);

    // Confirm button disabled and text changed
    const isBtnDisabled = await demo.isButtonDisabled();
    expect(isBtnDisabled).toBe(true);
    const btnText = (await demo.getButtonText())?.trim();
    expect(btnText).toBe('Demo Shown');
  });
});