import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209e334-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the NP-Completeness example page
class NPPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string[]} consoleMessages - shared array collecting console messages
   */
  constructor(page, consoleMessages) {
    this.page = page;
    this.consoleMessages = consoleMessages;
  }

  // Return the text of the main heading
  async getHeadingText() {
    return this.page.textContent('h1');
  }

  // Return an array of text contents of all paragraphs
  async getParagraphsText() {
    return this.page.$$eval('p', nodes => nodes.map(n => n.textContent));
  }

  // Count typical interactive elements: buttons, inputs, links, forms
  async countInteractiveElements() {
    const counts = await this.page.evaluate(() => {
      return {
        buttons: document.querySelectorAll('button').length,
        inputs: document.querySelectorAll('input, textarea, select').length,
        links: document.querySelectorAll('a[href]').length,
        forms: document.querySelectorAll('form').length
      };
    });
    return counts;
  }

  // Check whether a global function renderPage exists
  async isRenderPageDefined() {
    return this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }

  // Call the page's haltingProblem with a program that returns a specified value
  // programReturnValue can be a primitive (number/string) or cause throwing logic
  async callHaltingProblemWithReturn(programReturnValue) {
    return this.page.evaluate((val) => {
      // define a program that returns val for any input
      const program = (_input) => val;
      return haltingProblem(program, 'test-input');
    }, programReturnValue);
  }

  // Call the page's haltingProblem with a program that throws to test error handling
  async callHaltingProblemWithThrowingProgram() {
    return this.page.evaluate(() => {
      const program1 = () => { throw new Error('program1-threw'); };
      return haltingProblem(program, 'test-input');
    });
  }

  // Retrieve the captured console messages
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  // Check for presence of inline onclick attributes or elements that may imply event handlers
  async hasInlineEventAttributes() {
    return this.page.evaluate(() => {
      const attrs = ['onclick', 'onchange', 'oninput', 'onsubmit'];
      for (const attr of attrs) {
        if (document.querySelector('[' + attr + ']')) return true;
      }
      return false;
    });
  }
}

test.describe('NP-Completeness Example - FSM S0_Idle validation', () => {
  // Collect console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // reset collectors
    consoleMessages = [];
    pageErrors = [];

    // capture console messages
    page.on('console', msg => {
      // Only collect text representations for ease of assertions
      try {
        consoleMessages.push(msg.text());
      } catch {
        consoleMessages.push(String(msg));
      }
    });

    // collect page errors (runtime exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the exact URL provided (load the page as-is)
    await page.goto(APP_URL);
  });

  test('Initial state S0_Idle: page renders evidence (heading and paragraphs)', async ({ page }) => {
    // This test verifies the page content matches the FSM evidence for the Idle state.
    const npPage = new NPPage(page, consoleMessages);

    // Check the main heading text
    const heading = await npPage.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toEqual('NP-Completeness Example');

    // Check paragraphs include expected substrings from the FSM evidence
    const paragraphs = await npPage.getParagraphsText();
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(paragraphs[0]).toContain('NP-Completeness is a concept in computer science');
    expect(paragraphs[1]).toContain('Halting Problem');
  });

  test('There are no interactive elements or transitions present (as extracted)', async ({ page }) => {
    // This test asserts that the page contains no interactive elements (buttons, inputs, links, forms),
    // matching the FSM extraction that detected no event handlers or interactive components.
    const npPage1 = new NPPage(page, consoleMessages);

    const counts1 = await npPage.countInteractiveElements();
    expect(counts.buttons).toBe(0);
    expect(counts.inputs).toBe(0);
    expect(counts.links).toBe(0);
    expect(counts.forms).toBe(0);

    // Also check for inline event attributes (onclick, onchange, etc.)
    const hasInlineEvents = await npPage.hasInlineEventAttributes();
    expect(hasInlineEvents).toBe(false);
  });

  test('Entry action renderPage: verify it is not defined on the page', async ({ page }) => {
    // FSM entry action mentions renderPage(). The implementation does not define it.
    // We verify that renderPage is not present (so the entry action is not executed by the page).
    const npPage2 = new NPPage(page, consoleMessages);
    const defined = await npPage.isRenderPageDefined();
    expect(defined).toBe(false);
  });

  test('haltingProblem behavior: returns true for program outputs 0 and 1, false otherwise', async ({ page }) => {
    // This validates the haltingProblem function logic as implemented in the page script.
    const npPage3 = new NPPage(page, consoleMessages);

    // Program that returns number 0 -> should return true
    const res0 = await npPage.callHaltingProblemWithReturn(0);
    expect(res0).toBe(true);

    // Program that returns number 1 -> should return true
    const res1 = await npPage.callHaltingProblemWithReturn(1);
    expect(res1).toBe(true);

    // Program that returns number 2 -> should return false
    const res2 = await npPage.callHaltingProblemWithReturn(2);
    expect(res2).toBe(false);

    // Program that returns string '0' -> not strictly equal to number 0, should return false
    const resStr0 = await npPage.callHaltingProblemWithReturn('0');
    expect(resStr0).toBe(false);

    // Program that returns boolean true -> should return false (not 0 or 1)
    const resBool = await npPage.callHaltingProblemWithReturn(true);
    expect(resBool).toBe(false);
  });

  test('Console output from the example usage should include "true"', async ({ page }) => {
    // The inline script in the page logs the result of haltingProblem(program, input) for a program that returns 0.
    // Verify that a console.log with "true" was emitted during page load.
    const npPage4 = new NPPage(page, consoleMessages);
    const messages = npPage.getConsoleMessages();

    // There may be other console messages, but we expect at least one 'true' message as a string.
    const hasTrue = messages.some(msg => msg.trim() === 'true' || msg.trim() === 'true\n');
    expect(hasTrue).toBe(true);
  });

  test('Runtime errors: page should not have thrown any unexpected runtime errors on load', async ({ page }) => {
    // Validate that no page errors were emitted during load (the script uses console.log and should not throw).
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: haltingProblem should propagate exceptions when program throws', async ({ page }) => {
    // Ensure that if the provided program throws, haltingProblem invocation results in an exception.
    // This is an error scenario test to confirm the function does not swallow exceptions.
    const npPage5 = new NPPage(page, consoleMessages);

    // Expect the evaluate that triggers a thrown error to reject
    let threw = false;
    try {
      await npPage.callHaltingProblemWithThrowingProgram();
    } catch (err) {
      threw = true;
      // The error should carry the thrown message from the program
      expect(String(err)).toContain('program-threw');
    }
    expect(threw).toBe(true);
  });

  test('Consistency check: extraction summary expectation (no detected components/handlers)', async ({ page }) => {
    // This test asserts that the page structure aligns with the FSM extraction summary:
    // no components, no detected event handlers.
    const npPage6 = new NPPage(page, consoleMessages);

    const counts2 = await npPage.countInteractiveElements();
    const hasInlineEvents1 = await npPage.hasInlineEventAttributes();

    // All interactive counts should be zero and no inline events present
    expect(counts.buttons + counts.inputs + counts.links + counts.forms).toBe(0);
    expect(hasInlineEvents).toBe(false);
  });
});