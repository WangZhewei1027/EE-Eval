import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04447ef4-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for the Interpreter page
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#run-btn');
    this.codePre = page.locator('#code');
  }

  // Navigate to the application and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Returns true if an element with id 'output' exists in the DOM
  async hasOutputElement() {
    return await this.page.evaluate(() => !!document.getElementById('output'));
  }

  // Click the Run Code button
  async clickRun() {
    await this.runBtn.click();
  }

  // Call runInterpreter in page context with given codeStr
  async runInterpreter(codeStr) {
    return await this.page.evaluate((s) => {
      // Access existing function runInterpreter from the page
      // If it is not defined, this will throw and the caller will observe that.
      return runInterpreter(s);
    }, codeStr);
  }

  // Call runCode in page context with given codeStr
  async runCode(codeStr) {
    return await this.page.evaluate((s) => {
      return runCode(s);
    }, codeStr);
  }

  // Get the text content of the run button
  async getRunButtonText() {
    return await this.runBtn.innerText();
  }

  // Check whether runCode exists on the window
  async hasRunCodeFunction() {
    return await this.page.evaluate(() => typeof window.runCode === 'function');
  }

  // Check whether runInterpreter exists on the window
  async hasRunInterpreterFunction() {
    return await this.page.evaluate(() => typeof window.runInterpreter === 'function');
  }
}

test.describe('Interpreter FSM - 04447ef4-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Setup/teardown happens inside tests using the page fixture
  test.describe('Basic UI and Idle State', () => {
    test('Idle: page loads with Run Code button and code pre element (no output element)', async ({ page }) => {
      const ip = new InterpreterPage(page);
      await ip.goto();

      // Validate Run Code button exists and has expected text
      await expect(ip.runBtn).toBeVisible();
      expect(await ip.getRunButtonText()).toBe('Run Code');

      // Validate code pre element exists
      await expect(ip.codePre).toBeVisible();

      // The implementation does NOT include an #output element in the HTML.
      // Assert that the output element is indeed missing (this is important for later error behavior).
      const hasOutput = await ip.hasOutputElement();
      expect(hasOutput).toBe(false);

      // Validate that the core functions are present on the page (ensures entry actions may be wired)
      expect(await ip.hasRunCodeFunction()).toBe(true);
      expect(await ip.hasRunInterpreterFunction()).toBe(true);
    });
  });

  test.describe('Transitions: Run button click -> CodeRunning then Error due to missing output', () => {
    test('Clicking Run triggers event listener and results in an uncaught TypeError related to output.innerHTML', async ({ page }) => {
      const ip = new InterpreterPage(page);
      await ip.goto();

      // Capture page errors that are emitted (uncaught exceptions)
      const pageErrors = [];
      const onPageError = (err) => {
        pageErrors.push(err);
      };
      page.on('pageerror', onPageError);

      // Also capture console messages to ensure there are no misleading console outputs for success
      const consoleMessages = [];
      page.on('console', (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      // Click run. Given the HTML, there is no #output element, so attempts to set output.innerHTML will
      // cause a TypeError which will propagate as an uncaught pageerror event.
      await ip.clickRun();

      // Wait for at least one pageerror to occur. If none occurs within timeout, the test should fail.
      // We wait up to 2 seconds which is ample for the synchronous handler to execute.
      await page.waitForEvent('pageerror', { timeout: 2000 });

      // There should be at least one captured page error
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // The error message should indicate that innerHTML was attempted on a null element
      // Different engines have slightly different messages; assert a regex that covers common variants.
      const messages = pageErrors.map((e) => String(e.message || e.toString()).toLowerCase()).join(' | ');
      expect(messages).toMatch(/innerhtml|cannot set properties of null|cannot set property 'innerhtml'|null/);

      // Ensure console did not show a successful output assignment (we expect errors instead)
      // This is a soft check: ensure there is no console.log with the literal result string like "Condition is true"
      const hasSuccessConsole = consoleMessages.some((c) =>
        /Condition is true|Condition is false|Unknown code/.test(c.text)
      );
      expect(hasSuccessConsole).toBe(false);

      // Cleanup listener
      page.off('pageerror', onPageError);
    });
  });

  test.describe('Interpreter and runCode internal behavior (direct evaluation)', () => {
    test('runInterpreter handles "if true" and "if false" branches', async ({ page }) => {
      const ip = new InterpreterPage(page);
      await ip.goto();

      // Success case: if true
      const resTrue = await ip.runInterpreter('if true');
      expect(resTrue).toBe('Condition is true');

      // Success case: if false
      const resFalse = await ip.runInterpreter('if false');
      expect(resFalse).toBe('Condition is false');

      // Unknown code
      const resUnknown = await ip.runInterpreter('some random text');
      expect(resUnknown).toBe('Unknown code');
    });

    test('runInterpreter def branch returns function source for known globals (e.g., Array)', async ({ page }) => {
      const ip = new InterpreterPage(page);
      await ip.goto();

      // def Array should eval Array and return its toString
      const defArray = await ip.runInterpreter('def Array');
      // The exact formatting of native function toString can vary, but it should include 'function' or 'native code' or 'Array'
      expect(typeof defArray).toBe('string');
      expect(defArray.length).toBeGreaterThan(0);
      expect(/array|function|native code/i.test(defArray)).toBe(true);
    });

    test('runCode returns an "Error:" string when runInterpreter triggers an exception (def nonexistent)', async ({ page }) => {
      const ip = new InterpreterPage(page);
      await ip.goto();

      // Asking to def a nonexistent global will cause eval to throw inside runInterpreter.
      // runInterpreter catches and returns "Error: <message>", so runCode should return such a string.
      const result = await ip.runCode('def nonexistent_global_foo_bar_baz');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^Error:/);

      // The message should mention that the identifier is not defined or similar
      expect(result.toLowerCase()).toMatch(/not defined|undefined|error/i);
    });

    test('Edge case: calling runCode with undefined (simulates empty code pre.value) returns an Error string', async ({ page }) => {
      const ip = new InterpreterPage(page);
      await ip.goto();

      // In the click handler, code.value will be undefined because <pre> doesn't have a value property.
      // Simulate by calling runCode(undefined).
      const result = await ip.runCode(undefined);
      // runCode should catch and return an Error string (runInterpreter will try to access includes and throw, which runCode catches)
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^Error:/);
    });
  });

  test.describe('FSM expectations and onEnter/onExit observations', () => {
    test('runCode function exists and is invoked by clicking Run (observational check)', async ({ page }) => {
      // This test cannot modify page functions or install spies.
      // Instead we assert that runCode is defined and that clicking triggers an error path which implies the click handler attempted to use runCode + output.
      const ip = new InterpreterPage(page);
      await ip.goto();

      // Ensure runCode is defined
      expect(await ip.hasRunCodeFunction()).toBe(true);

      // Collect pageerrors when clicking Run
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(e));

      // Click Run — we expect the click handler to run and eventually result in the previously observed TypeError
      await ip.clickRun();
      await page.waitForEvent('pageerror', { timeout: 2000 });

      // At least one page error should be present which supports the assertion that the click handler executed
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Cleanup listeners implicitly by letting test end
    });
  });
});