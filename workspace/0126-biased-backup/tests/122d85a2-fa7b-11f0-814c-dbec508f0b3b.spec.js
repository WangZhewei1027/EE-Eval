import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d85a2-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Git interactive page
class GitPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Note: the HTML contains duplicate IDs: a DIV and an INPUT share the same id.
    // To reliably target the input elements we use input#input1 and input#input2.
    this.input1 = page.locator('input#input1');
    this.input2 = page.locator('input#input2');
    this.addButton = page.locator('#add');
    this.output1 = page.locator('#output1');
    this.output2 = page.locator('#output2');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async typeInput1(text) {
    await this.input1.fill(''); // clear first
    await this.input1.type(text);
  }

  async typeInput2(text) {
    await this.input2.fill('');
    await this.input2.type(text);
  }

  async clickAdd() {
    await this.addButton.click();
  }

  async getOutput1Text() {
    return (await this.output1.textContent()) || '';
  }

  async getOutput2Text() {
    return (await this.output2.textContent()) || '';
  }
}

test.describe('Git interactive FSM: states and transitions', () => {
  // Collect console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // Improve test stability: set default timeout for actions if needed
    page.on('console', (msg) => {
      // Forward console messages to test output for debugging
      // Note: do not modify page or inject anything
      // We only observe the console
      const type = msg.type();
      const text = msg.text();
      // Attach to test trace via console log (Playwright captures test stdout)
      // eslint-disable-next-line no-console
      console.log(`[PAGE CONSOLE ${type}] ${text}`);
    });
    page.on('pageerror', (err) => {
      // Log uncaught page errors so they are visible in test output
      // eslint-disable-next-line no-console
      console.log(`[PAGE ERROR] ${err && err.message ? err.message : String(err)}`);
    });
  });

  test.describe('Initial Idle state and DOM sanity', () => {
    test('Initial DOM elements exist and represent Idle state', async ({ page }) => {
      const git = new GitPage(page);
      await git.goto();

      // Validate that both input elements (actual <input> tags) are present
      await expect(git.input1).toBeVisible();
      await expect(git.input2).toBeVisible();

      // The outputs should initially be empty
      await expect(git.output1).toHaveText('');
      await expect(git.output2).toHaveText('');
    });
  });

  test.describe('Error states triggered by input events', () => {
    test('Input1Change transitions Idle -> Error1: updateError1() runs and output1 updated', async ({ page }) => {
      const git = new GitPage(page);
      await git.goto();

      // Type into input1 (use input#input1 to avoid the duplicate-div id)
      await git.typeInput1('trigger');

      // The updateError1 function should set errors[0] and update output1
      await expect(git.output1).toHaveText('Error 1: Error 1');

      // Output2 should remain untouched
      await expect(git.output2).toHaveText('');
    });

    test('Input2Change transitions Idle -> Error2: updateError2() runs and output2 updated', async ({ page }) => {
      const git = new GitPage(page);
      await git.goto();

      // Type into input2
      await git.typeInput2('trigger2');

      // The updateError2 function should set errors[1] and update output2
      await expect(git.output2).toHaveText('Error 2: Error 2');

      // Output1 should remain untouched
      await expect(git.output1).toHaveText('');
    });

    test('Updating both inputs results in both error outputs populated', async ({ page }) => {
      const git = new GitPage(page);
      await git.goto();

      await git.typeInput1('a');
      await git.typeInput2('b');

      await expect(git.output1).toHaveText('Error 1: Error 1');
      await expect(git.output2).toHaveText('Error 2: Error 2');
    });
  });

  test.describe('Add button transitions and alert behavior', () => {
    test('AddClick from fresh Idle (no errors) transitions to Success state and updates outputs', async ({ page }) => {
      const git = new GitPage(page);
      await git.goto();

      // Ensure no inputs have been changed yet
      await expect(git.output1).toHaveText('');
      await expect(git.output2).toHaveText('');

      // Click Add while errors.length === 0 -> push "Success" and update outputs
      await git.clickAdd();

      // Based on the implementation:
      // - output1 should become "Success: Success" (errors[0] === "Success")
      // - output2 will be "Success: " + errors[1] -> likely "Success: undefined"
      await expect(git.output1).toHaveText('Success: Success');
      await expect(git.output2).toHaveText('Success: undefined');
    });

    test('AddClick when already in Success state triggers alert with current error value', async ({ page }) => {
      const git = new GitPage(page);
      await git.goto();

      // First click to reach Success state
      await git.clickAdd();
      await expect(git.output1).toHaveText('Success: Success');

      // Second click should trigger alert("Error: " + errors[0])
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        git.clickAdd()
      ]);
      // The alert message should contain "Error: Success" because errors[0] === "Success"
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Error: Success');
      await dialog.accept();
    });

    test('Edge case: clicking Add after only one input changed (errors length > 0) triggers alert', async ({ page }) => {
      const git = new GitPage(page);
      await git.goto();

      // Trigger only input1 -> errors[0] exists, making errors.length >= 1
      await git.typeInput1('x');
      await expect(git.output1).toHaveText('Error 1: Error 1');

      // Click Add should result in alert("Error: " + errors[0])
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        git.clickAdd()
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Error: Error 1');
      await dialog.accept();
    });
  });

  test.describe('Entry/exit actions and additional edge cases', () => {
    test('Calling input handlers via clearing and retyping still triggers updateError functions', async ({ page }) => {
      const git = new GitPage(page);
      await git.goto();

      // Type then clear input1 to ensure oninput handlers fire on fill/clear
      await git.input1.fill('temp');
      await git.input1.fill(''); // fill('') will trigger input events
      // updateError1 sets output1 regardless of value, so expect Error1 message
      await expect(git.output1).toHaveText('Error 1: Error 1');
    });

    test('Multiple rapid interactions maintain consistent state transitions', async ({ page }) => {
      const git = new GitPage(page);
      await git.goto();

      // Rapidly trigger both inputs and clicks
      await git.typeInput1('1');
      await git.typeInput2('2');
      await expect(git.output1).toHaveText('Error 1: Error 1');
      await expect(git.output2).toHaveText('Error 2: Error 2');

      // Click Add - since errors array already has entries, should alert with errors[0]
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        git.clickAdd()
      ]);
      expect(dialog.message()).toContain('Error:');
      await dialog.accept();

      // After dismissing alert, ensure outputs still show error messages
      await expect(git.output1).toHaveText('Error 1: Error 1');
      await expect(git.output2).toHaveText('Error 2: Error 2');
    });
  });

  test.describe('Console and page error observation', () => {
    test('No unexpected ReferenceError/TypeError/SyntaxError should be emitted during normal interactions', async ({ page }) => {
      const git = new GitPage(page);

      const consoleMessages = [];
      const pageErrors = [];

      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      page.on('pageerror', err => {
        pageErrors.push(String(err && err.message ? err.message : err));
      });

      // Perform a set of interactions that exercise the app
      await git.goto();
      await git.typeInput1('alpha');
      await git.typeInput2('beta');
      // Click add to exercise success/alert branches
      // First click will alert because errors exist -> intercept and accept
      const dialogPromise = page.waitForEvent('dialog').then(d => d.message());
      await git.clickAdd();
      // Wait a brief moment for any potential console/page errors to be emitted
      let dialogMessage = null;
      try {
        dialogMessage = await dialogPromise;
      } catch (e) {
        // No dialog might occur in some runs; ignore
      }

      // Allow time for any asynchronous errors to surface (short wait)
      await page.waitForTimeout(200);

      // Inspect captured console messages and page errors for critical JS errors
      const pageErrorText = pageErrors.join('\n');
      const consoleText = consoleMessages.map(m => `${m.type}:${m.text}`).join('\n');

      // Fail the test if any pageerror mentions ReferenceError/TypeError/SyntaxError
      const hasCriticalPageError = /ReferenceError|TypeError|SyntaxError/.test(pageErrorText);
      const hasCriticalConsoleError = /ReferenceError|TypeError|SyntaxError/.test(consoleText);

      // Provide debugging output in assertion messages if failures occur
      expect(hasCriticalPageError, `Unexpected page errors found:\n${pageErrorText}`).toBe(false);
      expect(hasCriticalConsoleError, `Unexpected console errors found:\n${consoleText}`).toBe(false);

      // Additionally assert that any dialog observed was an alert about an error or success
      if (dialogMessage !== null) {
        expect(typeof dialogMessage).toBe('string');
        // Should contain either "Error:" or "Success" depending on state - at least ensure it's not empty
        expect(dialogMessage.length).toBeGreaterThan(0);
      }
    });
  });
});