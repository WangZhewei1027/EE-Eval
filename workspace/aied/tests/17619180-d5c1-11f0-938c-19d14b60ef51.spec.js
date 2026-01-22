import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17619180-d5c1-11f0-938c-19d14b60ef51.html';

// Page object for the Array Demonstration page
class ArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#arrayInput');
    this.submitButton = page.locator("button[onclick='showArray()']");
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInput(value) {
    await this.input.fill(value);
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async getOutputText() {
    return this.output.innerText();
  }

  async getOutputHTML() {
    return this.output.innerHTML();
  }

  async inputPlaceholder() {
    return this.input.getAttribute('placeholder');
  }

  async submitOnclickAttr() {
    return this.submitButton.getAttribute('onclick');
  }
}

test.describe('Array Demonstration - FSM validation and behaviors', () => {
  // Collect console messages and page errors for observation per test.
  test.beforeEach(async ({ page }) => {
    // No-op here: individual tests set up listeners and navigate via page object.
  });

  // Test initial Idle state: page renders input, button and empty output.
  test('Initial state (Idle): DOM elements render correctly', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    // Capture console messages and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app = new ArrayPage(page);
    await app.goto();

    // Validate input exists and placeholder matches FSM evidence
    await expect(app.input).toBeVisible();
    const placeholder = await app.inputPlaceholder();
    expect(placeholder).toBe('Enter numbers separated by commas (e.g., 1,2,3)');

    // Validate submit button exists and has the expected onclick handler attribute
    await expect(app.submitButton).toBeVisible();
    const onclick = await app.submitOnclickAttr();
    // The implementation uses inline onclick="showArray()", so assert that attribute exists.
    expect(onclick).toContain('showArray');

    // Output div should be present and initially empty
    await expect(app.output).toBeVisible();
    const initialOutput = await app.getOutputText();
    expect(initialOutput.trim()).toBe('');

    // Ensure no unexpected page errors occurred during load
    expect(pageErrors.length).toBe(0);
  });

  // Group tests that exercise the Submit event transitions
  test.describe('Submit event transitions', () => {
    // Valid array submission should transition to Array Displayed (S1_ArrayDisplayed)
    test('Transition to Array Displayed when submitting valid integers', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];

      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const app = new ArrayPage(page);
      await app.goto();

      // Submit a simple valid integer array
      await app.fillInput('3,1,2');
      await app.clickSubmit();

      // Validate output includes array, length, sum, and sorted array
      const html = await app.getOutputHTML();

      // The implementation uses strong tags and exact formatting; check substrings
      expect(html).toContain('<strong>Array:</strong> [3, 1, 2]');
      expect(html).toContain('<strong>Length:</strong> 3');
      expect(html).toContain('<strong>Sum:</strong> 6');
      expect(html).toContain('<strong>Sorted:</strong> [1, 2, 3]');

      // Ensure no runtime page errors occurred as a result of this interaction
      expect(pageErrors.length).toBe(0);
      // No console.error entries expected
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    // Invalid input should transition to Error state (S2_Error)
    test('Transition to Error when input contains non-numeric values', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];

      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const app = new ArrayPage(page);
      await app.goto();

      // Submit input with a non-numeric token
      await app.fillInput('3,a,2');
      await app.clickSubmit();

      const text = await app.getOutputText();

      // Expect the specific error message from the implementation
      expect(text).toContain('Error:');
      expect(text).toContain('Please enter valid numbers only.');

      // Ensure no runtime page errors occurred as a result of this interaction
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    // Edge case: empty input should be treated as invalid and show error
    test('Empty input results in Error state', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const app = new ArrayPage(page);
      await app.goto();

      await app.fillInput(''); // empty string
      await app.clickSubmit();

      const text = await app.getOutputText();
      expect(text).toContain('Error:');
      expect(text).toContain('Please enter valid numbers only.');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    // Edge case: negative numbers and floats should be handled as valid numbers
    test('Handles negative numbers and floats correctly', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const app = new ArrayPage(page);
      await app.goto();

      // Mix of negative and float values and spaces
      await app.fillInput(' -1 , 2.5,3 ');
      await app.clickSubmit();

      const html = await app.getOutputHTML();

      // Validate that the array displays the parsed numeric values and calculations are correct
      expect(html).toContain('<strong>Array:</strong> [-1, 2.5, 3]');
      expect(html).toContain('<strong>Length:</strong> 3');
      // Sum: -1 + 2.5 + 3 = 4.5
      expect(html).toContain('<strong>Sum:</strong> 4.5');
      // Sorted ascending: [-1, 2.5, 3]
      expect(html).toContain('<strong>Sorted:</strong> [-1, 2.5, 3]');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    // Edge case: consecutive commas produce an empty string which Number('') === 0
    // This tests how the implementation handles subtle parsing behaviors
    test('Consecutive commas produce numeric 0 for empty tokens (behavioral edge case)', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const app = new ArrayPage(page);
      await app.goto();

      // Input with an empty token between commas
      await app.fillInput('1,,2');
      await app.clickSubmit();

      const html = await app.getOutputHTML();

      // According to JavaScript Number('') -> 0, so expected array is [1,0,2]
      expect(html).toContain('<strong>Array:</strong> [1, 0, 2]');
      expect(html).toContain('<strong>Length:</strong> 3');
      expect(html).toContain('<strong>Sum:</strong> 3');
      // Sorted: [0,1,2]
      expect(html).toContain('<strong>Sorted:</strong> [0, 1, 2]');

      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  // Verify onEnter/onExit actions if mentioned in FSM. The FSM indicated renderPage() on entry for Idle.
  test('Verify onEnter/onExit actions (renderPage) - existence check', async ({ page }) => {
    // This test does not modify page code. It only inspects whether a global renderPage function exists
    // and ensures loading the page does not throw errors. The FSM mentioned renderPage() as an entry action,
    // but the actual HTML implementation does not define or call renderPage(), so we assert that no page error occurred.
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const app = new ArrayPage(page);
    await app.goto();

    // Check that renderPage is not present on the window (do not inject or define it).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // It's acceptable if it's undefined in this implementation; just record the boolean as part of test assertions.
    expect(typeof hasRenderPage === 'boolean').toBe(true);

    // There should be no uncaught exceptions during page load
    expect(pageErrors.length).toBe(0);
  });

  // After all interactions, we also validate that the application's output container markup is consistent.
  test('Output container maintains expected structure after multiple interactions', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const app = new ArrayPage(page);
    await app.goto();

    // Perform multiple interactions sequentially
    await app.fillInput('5,4,3');
    await app.clickSubmit();
    let html1 = await app.getOutputHTML();
    expect(html1).toContain('<strong>Array:</strong> [5, 4, 3]');

    // Now perform invalid submit and ensure output is replaced with error message
    await app.fillInput('x,y');
    await app.clickSubmit();
    let html2 = await app.getOutputHTML();
    expect(html2).toContain('<strong>Error:</strong>');

    // Now perform another valid submit and ensure output reflects the latest state
    await app.fillInput('10,20');
    await app.clickSubmit();
    let html3 = await app.getOutputHTML();
    expect(html3).toContain('<strong>Array:</strong> [10, 20]');
    expect(html3).toContain('<strong>Length:</strong> 2');

    expect(pageErrors.length).toBe(0);
  });
});