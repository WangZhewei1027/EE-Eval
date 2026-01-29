import { test, expect } from '@playwright/test';

// Test file: f5b390c1-fa7c-11f0-adc7-178f556b1ee0.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/f5b390c1-fa7c-11f0-adc7-178f556b1ee0.html

// Page object encapsulating interactions with the Interpreter demo page.
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      // Record the console type and text
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // pageerror receives Error objects; store the message
      this.pageErrors.push(String(err && err.message ? err.message : err));
    });
  }

  async navigate() {
    // Navigate to the static HTML page for the app under test
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/f5b390c1-fa7c-11f0-adc7-178f556b1ee0.html', {
      waitUntil: 'load',
      timeout: 10000
    });

    // Give the page a short moment to emit console/page errors if any
    // Use a small wait to allow synchronous parsing errors to surface.
    await this.page.waitForTimeout(200);
  }

  // Get the Run Interpreter Example button locator
  get runButton() {
    return this.page.locator('#interpreter-demo');
  }

  // Click the run button
  async clickRun() {
    await this.runButton.click();
    // Allow any click-handler errors/logs to appear
    await this.page.waitForTimeout(200);
  }

  // Utility to check whether any captured message matches a regex
  hasConsoleMatch(regex) {
    return this.consoleMessages.some(m => regex.test(m.text));
  }

  hasPageErrorMatch(regex) {
    return this.pageErrors.some(m => regex.test(m));
  }

  // Combined check across console and page errors
  hasAnyErrorMatching(regex) {
    return this.hasConsoleMatch(regex) || this.hasPageErrorMatch(regex);
  }
}

test.describe('Interpreter FSM - f5b390c1-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Each test gets a fresh page fixture from Playwright
  test.describe('State S0_Idle (Initial rendering)', () => {
    test('S0_Idle: Page renders and shows "Run Interpreter Example" button', async ({ page }) => {
      // This test validates the initial Idle state: the button must be present and visible.
      const app = new InterpreterPage(page);
      await app.navigate();

      // Assert that the button is present in the DOM and visible
      await expect(app.runButton).toBeVisible({ timeout: 2000 });
      await expect(app.runButton).toHaveText('Run Interpreter Example');

      // The FSM evidence for Idle is the presence of the button. We assert that exists.
      // Also assert that the page contains the heading 'Interpreter' to ensure the page loaded.
      await expect(page.locator('h1')).toHaveText('Interpreter');
    });

    test('S0_Idle: Page parsing may emit syntax errors on load (observe console/page errors)', async ({ page }) => {
      // This test intentionally observes runtime/parse errors produced by the page as-is.
      // According to instructions, do NOT modify page code; allow errors to happen naturally and assert they occur.
      const app = new InterpreterPage(page);
      await app.navigate();

      // Collect evidence from console and page errors captured during navigation.
      // Many JS parsing issues surface as SyntaxError or Unexpected token messages.
      const fatalErrorRegex = /(SyntaxError|ReferenceError|TypeError|Unexpected token|Unexpected identifier|Uncaught)/i;

      // We expect at least one error (syntax or runtime) during page load due to invalid JS in the HTML.
      const found = app.hasAnyErrorMatching(fatalErrorRegex);

      // Provide a clear assertion with diagnostics if it fails.
      expect(found, `Expected at least one console/page error matching ${fatalErrorRegex}. 
Captured console messages: ${JSON.stringify(app.consoleMessages, null, 2)}
Captured page errors: ${JSON.stringify(app.pageErrors, null, 2)}`).toBeTruthy();
    });
  });

  test.describe('Transition RunInterpreter -> S1_Interpreting (Click behavior and error scenarios)', () => {
    test('Transition: Clicking "Run Interpreter Example" triggers interpreter attempt (or produces errors)', async ({ page }) => {
      // This test attempts the FSM transition by clicking the button.
      // It asserts that either the interpreter runs and logs output OR that errors occur as a result of the broken implementation.
      const app = new InterpreterPage(page);
      await app.navigate();

      // Pre-click snapshot of existing console/page errors for differential checks.
      const preConsoleCount = app.consoleMessages.length;
      const prePageErrorCount = app.pageErrors.length;

      // Click the Run Interpreter Example button to trigger the transition.
      // The page's JS may be invalid, may not attach the handler, or may throw on click.
      await app.clickRun();

      // After click, capture messages and errors emitted.
      const postConsole = app.consoleMessages.slice(preConsoleCount);
      const postPageErrors = app.pageErrors.slice(prePageErrorCount);

      // We expect one of:
      // - The interpreter executes and console.logs an output value
      // - A ReferenceError/TypeError/SyntaxError occurs (interpreter undefined, or earlier parse errors)
      // Because the page implementation contains invalid JavaScript, a syntax error or reference error is likely.
      const errorRegex = /(SyntaxError|ReferenceError|TypeError|Uncaught|Unexpected token|Unexpected identifier)/i;
      const producedError = postConsole.some(m => errorRegex.test(m.text)) || postPageErrors.some(e => errorRegex.test(e));

      // Also check for potential successful output (unlikely given broken code).
      // The click handler, if executed, calls console.log(output). We look for any console messages that are not warnings/info and that may reflect output.
      const outputLike = postConsole.some(m => {
        // consider console.log messages that are plain strings or numbers
        if (m.type === 'log' || m.type === 'info') {
          // If it is 'undefined' or a number-like string or anything non-empty, treat as output evidence
          return m.text !== '' && /^(undefined|[-+]?\d+(\.\d+)?|".*"|'.*'|\[|{)/.test(m.text) || /\S/.test(m.text);
        }
        return false;
      });

      // Assert that at least one of the expected outcomes occurred: either error or output
      expect(producedError || outputLike, `After clicking run, expected either an error or some console output.
Post-click console messages: ${JSON.stringify(postConsole, null, 2)}
Post-click page errors: ${JSON.stringify(postPageErrors, null, 2)}`).toBeTruthy();

      // If an error was produced, assert it looks like a syntax/runtime error (important per instructions)
      if (producedError) {
        // Ensure that the error messages contain a meaningful diagnostic indicating broken code
        const allPostMessages = postConsole.map(m => m.text).concat(postPageErrors);
        const matchingMessages = allPostMessages.filter(msg => errorRegex.test(msg));
        expect(matchingMessages.length).toBeGreaterThan(0);
      } else {
        // If we observed output-like messages, ensure that the button click had some visible effect in DOM or console.
        expect(outputLike).toBeTruthy();
      }
    });

    test('Edge case: If the interpreter is missing due to parse error, clicking should not silently succeed (assert presence of parse/runtime errors)', async ({ page }) => {
      // This test emphasizes that the broken implementation must surface errors rather than silently failing.
      const app = new InterpreterPage(page);
      await app.navigate();

      // Click the run button to trigger any code path that may expose missing functions.
      await app.clickRun();

      // Combine all observed errors/messages
      const allMessages = app.consoleMessages.map(m => m.text).concat(app.pageErrors);

      // Search for evidence of critical failures (missing function, syntax error during parse, or runtime failure)
      const criticalRegex = /(interpreter is not defined|interpreter is not a function|SyntaxError|Unexpected token|ReferenceError|TypeError)/i;

      const hasCritical = allMessages.some(m => criticalRegex.test(m));

      // Assert that a critical error is present (per instructions, we must let errors happen and assert they occur)
      expect(hasCritical, `Expected a critical error (missing interpreter, syntax error, etc.). Captured messages:\n${allMessages.join('\n')}`).toBeTruthy();
    });
  });

  test.describe('FSM evidence checks and content assertions', () => {
    test('Verify evidence elements are present: pre blocks contain interpreter usage examples', async ({ page }) => {
      // This test ensures the static content/evidence referenced by the FSM is present in the DOM.
      const app = new InterpreterPage(page);
      await app.navigate();

      // There are multiple <pre> blocks in the HTML containing code examples and references to 'interpreter(program)'.
      const preBlocks = page.locator('pre');
      const count = await preBlocks.count();
      expect(count).toBeGreaterThanOrEqual(1);

      // At least one pre block should include the string 'interpreter(program)' or 'def interpreter(program)' as evidence.
      let found = false;
      for (let i = 0; i < count; i++) {
        const text = await preBlocks.nth(i).innerText();
        if (/interpreter\s*\(program\)|def interpreter\s*\(program\)/i.test(text)) {
          found = true;
          break;
        }
      }
      expect(found, 'Expected a <pre> block containing interpreter(program) example.').toBeTruthy();
    });

    test('Verify that clicking without a properly parsed script may not transition state (no DOM state change expected)', async ({ page }) => {
      // If the page script failed to parse, no on-click transition actions should change the DOM.
      // This test clicks the button and asserts that no new DOM nodes matching typical "output" patterns are injected.
      const app = new InterpreterPage(page);
      await app.navigate();

      // Snapshot DOM count for key elements before click
      const preCountBefore = await page.locator('pre').count();
      const buttonCountBefore = await page.locator('#interpreter-demo').count();

      // Click run
      await app.clickRun();

      // Re-measure
      const preCountAfter = await page.locator('pre').count();
      const buttonCountAfter = await page.locator('#interpreter-demo').count();

      // If the script parsed and ran correctly it could modify DOM; but with parse errors we expect no DOM addition.
      // We assert that the counts did not unexpectedly decrease (button removed) and that pre blocks count is stable.
      expect(buttonCountAfter).toBe(buttonCountBefore);
      expect(preCountAfter).toBe(preCountBefore);
    });
  });
});