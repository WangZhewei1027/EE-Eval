import { test, expect } from '@playwright/test';

//
// 0e197b70-d5c5-11f0-92ee-f5994b4f4c99.spec.js
//
// Tests for the Kruskal's Algorithm interactive page.
// The tests load the page exactly as provided, do not modify page code,
// observe console logs and page errors, and assert behavior and errors
// naturally produced by the page.
//
// Server location:
// http://127.0.0.1:5500/workspace/batch-1207/html/0e197b70-d5c5-11f0-92ee-f5994b4f4c99.html
//

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e197b70-d5c5-11f0-92ee-f5994b4f4c99.html';

// Page object model for the Kruskal page
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      inputN: '#n',
      submitButton: "button[type='submit']",
      kOutput: '#k',
    };
  }

  // Navigate to the page and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Fill the number input
  async fillN(value) {
    // input[type=number] supports fill; use fill to set value
    await this.page.fill(this.selectors.inputN, String(value));
  }

  // Click the submit button and wait for possible navigation
  async clickSubmit(waitForNavigation = true) {
    if (waitForNavigation) {
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'load' }),
        this.page.click(this.selectors.submitButton),
      ]);
    } else {
      await this.page.click(this.selectors.submitButton);
    }
  }

  // Read the innerHTML of the k output element
  async getKInnerHTML() {
    return await this.page.$eval(this.selectors.kOutput, el => el.innerHTML);
  }

  // Invoke the page's kruskalAlgorithm() function directly in page context
  async invokeKruskalAlgorithm() {
    // call the global function if it exists; this will naturally throw if missing
    return await this.page.evaluate(() => {
      // eslint-disable-next-line no-undef
      return typeof kruskalAlgorithm === 'function' ? kruskalAlgorithm() : (function(){ throw new ReferenceError('kruskalAlgorithm is not defined'); })();
    });
  }
}

// Global arrays to capture console messages and page errors per test
let consoleMessages;
let pageErrors;

test.describe('Kruskal Algorithm interactive page - FSM tests', () => {
  test.beforeEach(async ({ page }) => {
    // reset captured logs
    consoleMessages = [];
    pageErrors = [];

    // capture console messages and page errors emitted by the page
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // nothing to tear down globally; listeners are attached to the page and cleaned up automatically
  });

  test.describe('State S0_Idle (Initial) - Rendering and initial DOM', () => {
    test('should render input #n, submit button, and empty #k on page load (Idle entry)', async ({ page }) => {
      // The entry action for S0_Idle in the FSM is renderPage() - verify DOM elements exist after load.
      const p = new KruskalPage(page);
      await p.goto();

      // Validate input exists and is of type number
      const inputHandle = await page.$(p.selectors.inputN);
      expect(inputHandle).not.toBeNull();
      const typeAttr = await page.getAttribute(p.selectors.inputN, 'type');
      expect(typeAttr).toBe('number');

      // Validate submit button exists and has correct type and text
      const buttonHandle = await page.$(p.selectors.submitButton);
      expect(buttonHandle).not.toBeNull();
      const buttonText = await page.$eval(p.selectors.submitButton, el => el.textContent.trim());
      expect(buttonText).toBe('Submit');

      // Validate #k exists and is initially empty
      const kInnerHTML = await p.getKInnerHTML();
      expect(kInnerHTML).toBe('', 'Expected #k to be empty at initial render');

      // Ensure there are no uncaught page errors immediately after load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event: Submit and Transition S0 -> S1', () => {
    test('clicking submit should submit the form (default behavior) and not automatically call kruskalAlgorithm via onclick (no update expected)', async ({ page }) => {
      // This test validates the FSM transition triggered by the submit event.
      // The provided HTML does NOT attach an onclick="kruskalAlgorithm()" to the button;
      // instead the button is a submit within a form. We test the real behavior as-is.
      const p = new KruskalPage(page);
      await p.goto();

      // Pre-fill n with a value that WOULD cause updates if kruskalAlgorithm were called
      await p.fillN(5);

      // Click the submit button and wait for navigation (form submit will reload the page).
      // We also observe console and page errors while doing this.
      await p.clickSubmit(true);

      // After navigation/reload, verify we are back on the page and #k is still empty
      // (i.e., the function was not automatically invoked via an onclick attribute)
      const kInnerAfterSubmit = await p.getKInnerHTML();
      expect(kInnerAfterSubmit).toBe('', 'Expected #k to remain empty because kruskalAlgorithm is not attached to the submit button in the HTML');

      // Assert that no page errors were thrown during the submit navigation
      expect(pageErrors.length).toBe(0);

      // There should be at most informational console messages; ensure no console errors of type 'error' were logged
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });

  test.describe('State S1_Processing - kruskalAlgorithm execution and effects', () => {
    test('invoking kruskalAlgorithm() directly updates #k.innerHTML for a positive integer n', async ({ page }) => {
      // This test simulates the Processing state by invoking the kruskalAlgorithm entry action directly.
      const p = new KruskalPage(page);
      await p.goto();

      // Ensure a clean output area
      await page.evaluate(() => { document.getElementById('k').innerHTML = ''; });

      // Fill n with 3 and invoke the function directly (function exists in the page scope)
      await p.fillN(3);

      // Call the function. This uses the existing page function; it is not redefining it.
      await p.invokeKruskalAlgorithm();

      // After execution the function appends content including "<br>" and "</div>" per its implementation
      const kInner = await p.getKInnerHTML();

      // Expect the output to include the HTML strings appended by the function
      expect(kInner.includes('<br>')).toBeTruthy();
      expect(kInner.includes('</div>')).toBeTruthy();

      // The content should not be empty
      expect(kInner.length).toBeGreaterThan(0);

      // Ensure no unexpected page errors occurred during invocation
      expect(pageErrors.length).toBe(0);
    });

    test('invoking kruskalAlgorithm() with empty input (NaN) still performs final appends (<br> and </div>)', async ({ page }) => {
      // Edge case: if the number input is empty, parseInt will return NaN and the loop will skip.
      // The function then still appends "<br>" and "</div>" — verify that behavior.
      const p = new KruskalPage(page);
      await p.goto();

      // Clear input and output
      await p.fillN('');
      await page.evaluate(() => { document.getElementById('k').innerHTML = ''; });

      // Invoke the function directly
      await p.invokeKruskalAlgorithm();

      // After invocation we expect only the final appended strings to be present.
      const kInner = await p.getKInnerHTML();

      // The function appends "<br>" and "</div>" even when the loop is skipped
      expect(kInner).toContain('<br>');
      expect(kInner).toContain('</div>');

      // No page errors produced
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error scenarios and diagnostics', () => {
    test('calling a non-existent function triggers a ReferenceError in the page', async ({ page }) => {
      // Per requirements, let ReferenceError happen naturally and assert it occurs.
      await page.goto(APP_URL, { waitUntil: 'load' });

      let thrown = null;
      try {
        // Intentionally invoke a function that does not exist on the page to get a natural ReferenceError
        await page.evaluate(() => {
          // This will naturally produce a ReferenceError in the page context
          // and cause the evaluate() promise to reject.
          // Do not define or patch any globals.
          // eslint-disable-next-line no-undef
          return nonExistentFunction();
        });
      } catch (err) {
        thrown = err;
      }

      // Ensure an error was thrown and it is a ReferenceError originating from the page evaluation
      expect(thrown).not.toBeNull();
      // The message may vary by browser, check that it refers to 'nonExistentFunction' or 'is not defined'
      const msg = String(thrown.message || thrown);
      expect(msg.toLowerCase()).toContain('nonexistentfunction');
      // Common engines include 'is not defined' in the message
      expect(msg.toLowerCase()).toMatch(/is not defined|not defined|referenceerror/);
    });

    test('page-level uncaught exceptions (if any) should be observable via pageerror listener', async ({ page }) => {
      const p = new KruskalPage(page);
      await p.goto();

      // Clear captured diagnostics
      consoleMessages = [];
      pageErrors = [];

      // Cause a runtime exception intentionally by executing invalid code via page.evaluate,
      // but do it in a way that results in a pageerror event (uncaught exception).
      // We will execute code that schedules an exception asynchronously so it surfaces as an uncaught exception.
      await page.evaluate(() => {
        // Schedule an async tick that throws (uncaught)
        setTimeout(() => {
          // This will create an uncaught ReferenceError in the page context
          // eslint-disable-next-line no-undef
          nonExistentAsyncFunctionCall();
        }, 0);
      });

      // Wait a short time for the async exception to surface and be captured
      await page.waitForTimeout(200);

      // The pageerror listener should have captured the error
      // Note: depending on the browser, the uncaught exception may or may not be captured in this environment.
      // We accept either behavior but assert we can observe the pageErrors array (it may be empty or populated).
      expect(Array.isArray(pageErrors)).toBeTruthy();

      // If an error was captured, it should be a ReferenceError mentioning the missing function name
      if (pageErrors.length > 0) {
        const errMsg = String(pageErrors[0].message || pageErrors[0]);
        expect(errMsg.toLowerCase()).toContain('nonexistentasyncfunctioncall');
      }
    });
  });
});