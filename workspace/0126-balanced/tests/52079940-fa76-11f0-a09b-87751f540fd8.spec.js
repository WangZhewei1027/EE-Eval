import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52079940-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Array Example page
class ArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // Attach listeners to collect runtime information
    this.page.on('console', (msg) => {
      // Save the text of the console message for later assertions
      try {
        this.consoleMessages.push(msg.text());
      } catch (e) {
        // Silently ignore any console extraction issues
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to the app URL
  async load() {
    await this.page.goto(APP_URL);
    // Wait for the main content to be present
    await this.page.waitForSelector('h1');
  }

  // Returns an array of captured console message texts
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Returns an array of page errors captured via pageerror event
  getPageErrors() {
    return this.pageErrors;
  }

  // Helper to read #output text content
  async getOutputText() {
    return (await this.page.$eval('#output', el => el.textContent || '')).trim();
  }

  // Helper to read the main header
  async getHeaderText() {
    return (await this.page.$eval('h1', el => el.textContent || '')).trim();
  }

  // Helper to check presence of any selectors (returns count)
  async countElements(selector) {
    return (await this.page.$$(selector)).length;
  }

  // Helper to evaluate global window property
  async evaluateWindowProp(propName) {
    return this.page.evaluate((p) => {
      // Access via window to avoid ReferenceError for script-scoped lets;
      // returns undefined if property not present
      return window[p];
    }, propName);
  }
}

test.describe('Array Example (Idle state) - 52079940-fa76-11f0-a09b-87751f540fd8', () => {
  // Each test will create its own page and ArrayPage wrapper via fixtures
  test.describe.configure({ mode: 'parallel' });

  // Validate that the page loads and emits the expected console logs from the script
  test('should load the page and emit array-related console logs (implementation logs observed)', async ({ page }) => {
    // Setup page object which attaches console and error listeners
    const app = new ArrayPage(page);

    // Load the page (listeners already attached)
    await app.load();

    // Grab console messages captured during load
    const logs = app.getConsoleMessages();

    // Verify that high-level logs are present. The implementation logs many labels; assert presence of key labels.
    // These assertions confirm the script executed and printed array manipulations to console.
    expect(logs.some(msg => msg.includes('Array of fruits:'))).toBeTruthy();
    expect(logs.some(msg => msg.includes('Array of colors:'))).toBeTruthy();
    expect(logs.some(msg => msg.includes('Fruit at index 2:'))).toBeTruthy();
    expect(logs.some(msg => msg.includes('Color at index 1:'))).toBeTruthy();

    // Ensure later modification logs appear
    expect(logs.some(msg => msg.includes('Fruits after modification:'))).toBeTruthy();
    expect(logs.some(msg => msg.includes('Colors after modification:'))).toBeTruthy();

    // Ensure update/add/remove logs exist
    expect(logs.some(msg => msg.includes('Fruits after addition:'))).toBeTruthy();
    expect(logs.some(msg => msg.includes('Colors after addition:'))).toBeTruthy();
    expect(logs.some(msg => msg.includes('Fruits after removal:'))).toBeTruthy();
    expect(logs.some(msg => msg.includes('Colors after removal:'))).toBeTruthy();
    expect(logs.some(msg => msg.includes('Fruits after update:'))).toBeTruthy();
    expect(logs.some(msg => msg.includes('Colors after update:'))).toBeTruthy();

    // Specifically assert that expected final updates include 'pineapple' and 'brown' — evidence of in-script modifications.
    const fruitsAfterUpdate = logs.find(msg => msg.includes('Fruits after update:')) || '';
    expect(fruitsAfterUpdate.includes('pineapple') || fruitsAfterUpdate.includes('"pineapple"') || fruitsAfterUpdate.includes("'pineapple'")).toBeTruthy();

    const colorsAfterUpdate = logs.find(msg => msg.includes('Colors after update:')) || '';
    expect(colorsAfterUpdate.includes('brown') || colorsAfterUpdate.includes('"brown"') || colorsAfterUpdate.includes("'brown'")).toBeTruthy();

    // Confirm there were no uncaught page errors during script execution
    const pageErrors = app.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  // FSM specified an entry action "Array Example Loaded" for the Idle state.
  // The implementation does not log this; assert that the expected FSM entry log is missing.
  test('should not emit FSM-declared entry action "Array Example Loaded" (verify onEnter mismatch)', async ({ page }) => {
    const app1 = new ArrayPage(page);
    await app.load();

    const logs1 = app.getConsoleMessages();

    // The FSM declared "console.log('Array Example Loaded')" as an entry action.
    // Verify that such a log is NOT present in the actual console output (indicating mismatch).
    const hasFsmEntryLog = logs.some(msg => msg.includes('Array Example Loaded'));
    expect(hasFsmEntryLog).toBeFalsy();
  });

  // Verify DOM elements and that the UI does not display any dynamic output (script does not set #output)
  test('should render static header and empty output placeholder', async ({ page }) => {
    const app2 = new ArrayPage(page);
    await app.load();

    // Validate header text
    const header = await app.getHeaderText();
    expect(header).toBe('Array Example');

    // The <p id="output"></p> is present but the implementation does not set textContent.
    const outputText = await app.getOutputText();
    expect(outputText).toBe(''); // Expect empty string as script does not write to #output
  });

  // Confirm there are no interactive elements on the page as noted in FSM extraction summary
  test('should have no interactive elements (buttons, inputs, anchors)', async ({ page }) => {
    const app3 = new ArrayPage(page);
    await app.load();

    const buttons = await app.countElements('button');
    const inputs = await app.countElements('input, textarea, select');
    const anchors = await app.countElements('a');

    expect(buttons).toBe(0);
    expect(inputs).toBe(0);
    // Anchors may be 0 as well; ensure no anchors used for interaction
    expect(anchors).toBe(0);
  });

  // Edge case tests: variables declared with let inside the page script are NOT attached to window.
  // Accessing them as bare identifiers in page context should cause ReferenceError; accessing via window should return undefined.
  test('should throw ReferenceError when referencing script-scoped identifier directly, and window property should be undefined', async ({ page }) => {
    const app4 = new ArrayPage(page);
    await app.load();

    // Accessing bare identifier 'fruitsArray' (declared with let in the page script) from page.evaluate should reject with ReferenceError.
    // We intentionally do not catch it so the promise rejects; assert that the rejection is due to ReferenceError / not defined.
    // Note: Different engine messages vary; assert against common substrings.
    await expect(page.evaluate(() => fruitsArray)).rejects.toThrow(/ReferenceError|is not defined/);

    // Access via window should return undefined (let/const do not create window properties)
    const winFruits = await app.evaluateWindowProp('fruitsArray');
    expect(winFruits).toBeUndefined();

    const winColors = await app.evaluateWindowProp('colorsArray');
    expect(winColors).toBeUndefined();
  });

  // Validate that console logs include array contents for "Array of fruits:" and that elements mutate as logged.
  test('should log array contents and show mutated elements according to the script logs', async ({ page }) => {
    const app5 = new ArrayPage(page);
    await app.load();

    const logs2 = app.getConsoleMessages();

    // Ensure the initial array log exists and contains initial fruit names (apple or mango depending on when logged)
    const initialFruitsLog = logs.find(msg => msg.includes('Array of fruits:')) || '';
    // The script initially spreads fruits and then modifies the first element later; the initial log should at least include 'apple' or 'mango'
    expect(initialFruitsLog.length).toBeGreaterThan(0);

    // Ensure that a log specifically states 'Fruit at index 2:' which indicates index access happened
    expect(logs.some(m => m.includes('Fruit at index 2:'))).toBeTruthy();

    // Ensure mutation logs demonstrate push/pop and updates stated by the script:
    expect(logs.some(m => m.includes('Fruits after addition:'))).toBeTruthy();
    expect(logs.some(m => m.includes('Fruits after removal:'))).toBeTruthy();
  });

  // Sanity check: ensure no unexpected runtime errors were emitted to the page error stream during normal load.
  // This is slightly redundant with earlier checks but explicitly asserts that pageerror remains empty after load.
  test('should not emit page errors during normal load (sanity check)', async ({ page }) => {
    const app6 = new ArrayPage(page);
    await app.load();

    const errors = app.getPageErrors();
    // If the environment had unhandled exceptions during load, they'd appear here.
    expect(errors.length).toBe(0);
  });
});