import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0f343-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page object for the Dynamic Typing Demonstration app.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.textInput = page.locator('#textInput');
    this.numberInput = page.locator('#numberInput');
    this.boolInput = page.locator('#boolInput');
    this.stringButton = page.locator('#stringButton');
    this.arrayButton = page.locator('#arrayButton');
    this.objectButton = page.locator('#objectButton');
    this.dateButton = page.locator('#dateButton');
    this.customObjectButton = page.locator('#customObjectButton');
    this.outputDisplay = page.locator('#outputDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helpers to interact
  async fillText(value) {
    await this.textInput.fill(value);
    // oninput triggers updateOutput automatically
  }

  async fillNumber(value) {
    await this.numberInput.fill(String(value));
    // oninput triggers updateOutput automatically
  }

  async selectBool(value) {
    await this.boolInput.selectOption(String(value));
    // onchange triggers updateOutput automatically
  }

  async clickStringButton() {
    await this.stringButton.click();
  }

  async clickArrayButton() {
    await this.arrayButton.click();
  }

  async clickObjectButton() {
    await this.objectButton.click();
  }

  async clickDateButton() {
    await this.dateButton.click();
  }

  async clickCustomObjectButton() {
    await this.customObjectButton.click();
  }

  async callUpdateOutput() {
    // Calls updateOutput defined on the page
    await this.page.evaluate(() => updateOutput());
  }

  async getOutputRaw() {
    // returns the raw textContent of the pre element
    const txt = await this.outputDisplay.textContent();
    return txt === null ? '' : txt.trim();
  }

  async getOutputParsed() {
    const raw = await this.getOutputRaw();
    if (!raw) return null;
    // The app uses JSON.stringify(currentOutput, null, 2) for display
    // So parse the JSON text; it may represent an object, array, string, etc.
    try {
      return JSON.parse(raw);
    } catch (e) {
      // If JSON.parse fails, return the raw text for inspection
      return raw;
    }
  }
}

test.describe('Dynamic Typing Demonstration - FSM Validation', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright's automatic cleanup
  });

  test('Initial render: inputs and buttons are present and output is empty', async ({ page }) => {
    // Validate initial UI is rendered as expected (S0_Idle entry state)
    const demo = new DemoPage(page);

    // Check presence of inputs and buttons
    await expect(demo.textInput).toBeVisible();
    await expect(demo.numberInput).toBeVisible();
    await expect(demo.boolInput).toBeVisible();
    await expect(demo.stringButton).toBeVisible();
    await expect(demo.arrayButton).toBeVisible();
    await expect(demo.objectButton).toBeVisible();
    await expect(demo.dateButton).toBeVisible();
    await expect(demo.customObjectButton).toBeVisible();

    // At initial load, updateDisplay has not been called so output should be empty
    const raw = await demo.getOutputRaw();
    expect(raw).toBe('', 'Expected outputDisplay to be empty on initial render');

    // Ensure no console errors were emitted during normal load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // No uncaught page errors should have been recorded
    expect(pageErrors.length).toBe(0);
  });

  test('Text input event updates output (S1_TextInput)', async ({ page }) => {
    // This validates the TextInputChange transition and updateOutput action
    const demo = new DemoPage(page);

    // Input text into the text field - oninput should trigger updateOutput
    await demo.fillText('HelloPlaywright');

    // Read and parse the output JSON
    const parsed = await demo.getOutputParsed();
    expect(parsed).not.toBeNull();
    expect(parsed.string).toBe('HelloPlaywright');
    // Number was not provided -> should be null according to updateOutput logic
    expect(parsed.number).toBeNull();
    // The select default is "true"
    expect(parsed.boolean).toBe(true);

    // Ensure no uncaught page errors or console errors during this interaction
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Number input event updates output (S2_NumberInput) and edge numeric parsing', async ({ page }) => {
    // Validates NumberInputChange transition and numeric parsing
    const demo = new DemoPage(page);

    // Fill number input with an integer
    await demo.fillNumber(42);

    const parsed = await demo.getOutputParsed();
    expect(parsed).not.toBeNull();
    expect(parsed.number).toBe(42);
    // string should be empty by default
    expect(parsed.string).toBe('');
    expect(parsed.boolean).toBe(true);

    // Edge case: very large number
    await demo.fillNumber('9007199254740993'); // 2^53 + 1, demonstrates numeric boundaries
    const parsedLarge = await demo.getOutputParsed();
    // The app uses Number() so JavaScript number precision rules apply; ensure it returns a number
    expect(typeof parsedLarge.number).toBe('number');
    expect(pageErrors.length).toBe(0);
  });

  test('Boolean selection updates output (S3_BoolInput)', async ({ page }) => {
    // Validates BoolInputChange transition
    const demo = new DemoPage(page);

    // Change boolean select to "false"
    await demo.selectBool('false');

    const parsed = await demo.getOutputParsed();
    expect(parsed.boolean).toBe(false);
    // string and number defaults
    expect(parsed.string).toBe('');
    expect(parsed.number).toBeNull();

    expect(pageErrors.length).toBe(0);
  });

  test('Click Set String button updates output and text input is populated (S4_SetString)', async ({ page }) => {
    // Validates SetStringClick transition that sets text input and triggers update
    const demo = new DemoPage(page);

    await demo.clickStringButton();

    // After clicking, text input should be set and output updated
    await expect(demo.textInput).toHaveValue('Hello World');

    const parsed = await demo.getOutputParsed();
    expect(parsed.string).toBe('Hello World');
    expect(parsed.number).toBeNull();

    expect(pageErrors.length).toBe(0);
  });

  test('Click Set Array button updates output to an array (S5_SetArray)', async ({ page }) => {
    // Validates SetArrayClick transition which sets currentOutput to an array
    const demo = new DemoPage(page);

    await demo.clickArrayButton();

    const parsed = await demo.getOutputParsed();
    // Expect an array [1,2,3]
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([1, 2, 3]);

    expect(pageErrors.length).toBe(0);
  });

  test('Click Set Object button updates output to an object (S6_SetObject)', async ({ page }) => {
    // Validates SetObjectClick transition
    const demo = new DemoPage(page);

    await demo.clickObjectButton();

    const parsed = await demo.getOutputParsed();
    expect(parsed).toEqual({ name: 'John', age: 30 });

    expect(pageErrors.length).toBe(0);
  });

  test('Click Set Date button updates output to a date string (S7_SetDate)', async ({ page }) => {
    // Validates SetDateClick transition; output should be a string representation of the date
    const demo = new DemoPage(page);

    await demo.clickDateButton();

    const parsed = await demo.getOutputParsed();
    // The app stores a string produced by new Date().toString() and JSON.stringify wraps it as a JSON string
    expect(typeof parsed).toBe('string');
    expect(parsed.length).toBeGreaterThan(0);

    expect(pageErrors.length).toBe(0);
  });

  test('Click Set Custom Object button updates output to object with timestamp (S8_SetCustomObject)', async ({ page }) => {
    // Validates SetCustomObjectClick transition; timestamp should be serialized to a string
    const demo = new DemoPage(page);

    await demo.clickCustomObjectButton();

    const parsed = await demo.getOutputParsed();
    expect(parsed).toHaveProperty('info', 'This is a custom object');
    expect(parsed).toHaveProperty('timestamp');
    // timestamp should be a string after JSON serialization
    expect(typeof parsed.timestamp).toBe('string');
    expect(parsed.timestamp.length).toBeGreaterThan(0);

    expect(pageErrors.length).toBe(0);
  });

  test('Directly calling updateOutput works when inputs are set (explicit invocation)', async ({ page }) => {
    // This verifies that updateOutput() function exists and can be invoked programmatically.
    // It also tests the explicit call path for the same update logic.
    const demo = new DemoPage(page);

    // Set inputs but do not rely on oninput/onchange; call updateOutput explicitly
    await demo.textInput.fill('ManualCall');
    await demo.numberInput.fill('7');
    await demo.boolInput.selectOption('false');

    // Explicitly invoke updateOutput from the page context
    await demo.callUpdateOutput();

    const parsed = await demo.getOutputParsed();
    expect(parsed.string).toBe('ManualCall');
    expect(parsed.number).toBe(7);
    expect(parsed.boolean).toBe(false);

    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action "renderPage" is not defined: calling it triggers a ReferenceError (assert pageerror)', async ({ page }) => {
    // According to the FSM, S0_Idle has entry_actions: renderPage()
    // The HTML implementation does not define renderPage(), so invoking it should cause a ReferenceError.
    // We will invoke renderPage() in the page context and assert that a pageerror with ReferenceError is emitted.

    // Prepare to capture the next pageerror
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Attempt to call the missing function without catching in the page context so Playwright receives the pageerror
    // Wrap evaluate in try/catch to prevent the test from failing due to the thrown exception in the evaluate call;
    // the actual pageerror event is captured separately and asserted.
    let evalRejected = false;
    try {
      // This will throw in the page context and cause a pageerror
      await page.evaluate(() => {
        // Intentionally call the function that isn't defined on the page
        renderPage();
      });
    } catch (e) {
      // evaluate will reject because renderPage is not defined; note that a pageerror should also have been emitted
      evalRejected = true;
    }

    // Wait for the pageerror emitted by the page (uncaught exception)
    const pageErr = await pageErrorPromise;
    expect(pageErr).toBeTruthy();
    // The thrown error should be a ReferenceError relating to renderPage
    expect(pageErr.name).toBe('ReferenceError');
    expect(pageErr.message).toContain('renderPage');

    // Sanity: ensure the evaluate did reject as well
    expect(evalRejected).toBe(true);
  });

  test('Edge case: calling a non-existent function intentionally to observe & assert ReferenceError without swallowing it', async ({ page }) => {
    // This test duplicates the previous behavior but demonstrates we can observe multiple missing functions if present.
    // We'll call a clearly non-existent function and assert a ReferenceError pageerror occurs.

    const pageErrorPromise = page.waitForEvent('pageerror');

    let evalFailed = false;
    try {
      await page.evaluate(() => {
        // A different nonexistent function name
        definitelyNotDefinedFunctionForTest();
      });
    } catch (e) {
      evalFailed = true;
    }

    const pageErr = await pageErrorPromise;
    expect(pageErr).toBeTruthy();
    expect(pageErr.name).toBe('ReferenceError');
    // The error message should reference the missing function name
    expect(pageErr.message).toContain('definitelyNotDefinedFunctionForTest');
    expect(evalFailed).toBe(true);
  });

  test('No unexpected console.error messages during normal user interactions', async ({ page }) => {
    // Perform a sequence of normal interactions and assert that no console errors were produced during those actions.
    const demo = new DemoPage(page);

    // Reset any messages collected so far for clarity in this test
    consoleMessages = [];
    pageErrors = [];

    // Perform a series of valid interactions
    await demo.fillText('SeqTest');
    await demo.fillNumber(5);
    await demo.selectBool('true');
    await demo.clickArrayButton();
    await demo.clickObjectButton();
    await demo.clickDateButton();
    await demo.clickCustomObjectButton();

    // There should be no uncaught page errors during these normal interactions
    expect(pageErrors.length).toBe(0);

    // Also ensure no console.error logs occurred
    const errorLogs = consoleMessages.filter(m => m.type === 'error');
    expect(errorLogs.length).toBe(0);
  });
});