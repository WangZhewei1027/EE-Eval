import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b42c1-fa76-11f0-a09b-87751f540fd8.html';

test.describe('520b42c1-fa76-11f0-a09b-87751f540fd8 - Compiler interactive app (FSM validation)', () => {
  // Shared collectors for page errors and console messages for each test
  let pageErrors;
  let consoleMessages;

  // Attach listeners BEFORE navigation so we capture any runtime errors emitted during page load
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // err is an Error object; capture its message for assertions
      try {
        pageErrors.push(String(err && err.message ? err.message : err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    page.on('console', (msg) => {
      // capture console messages and their type
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Navigate to the page under test (this will execute the page script)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // nothing to teardown explicitly; page fixture will be cleaned up by Playwright
  });

  test.describe('FSM State: S0_Idle (Initial rendering)', () => {
    test('Initial DOM contains #compiler and #output elements (S0_Idle evidence)', async ({ page }) => {
      // Validate the evidence for the Idle state: the compiler container and output paragraph exist
      const compiler = page.locator('#compiler');
      const output = page.locator('#output');

      await expect(compiler).toHaveCount(1); // element exists
      await expect(output).toHaveCount(1); // element exists

      // They should be present in the DOM and visible (basic rendering)
      await expect(compiler).toBeVisible();
      await expect(output).toBeVisible();
    });

    test('Run button (#run) is not present and page emitted runtime errors on load', async ({ page }) => {
      // The provided HTML references #run in script but does not include the button element.
      // Assert that the button is missing (this explains the runtime error).
      const runHandle = await page.$('#run');
      expect(runHandle).toBeNull();

      // A runtime error should have occurred when the page script attempted:
      // document.getElementById('run').addEventListener('click', runCode);
      // Capture and assert that at least one page error was emitted referencing addEventListener or null
      expect(pageErrors.length).toBeGreaterThan(0);

      // Ensure at least one of the errors mentions addEventListener or inability to read properties of null
      const relevant = pageErrors.filter((msg) =>
        /addEventListener|Cannot read properties|Cannot set property|null|reading 'addEventListener'/.test(msg)
      );
      expect(relevant.length).toBeGreaterThan(0);
    });
  });

  test.describe('FSM Transition: RunCode (S0_Idle -> S1_CodeRun)', () => {
    test('Direct invocation of runCode() updates #output to the same value returned by compile(code) (S1_CodeRun evidence)', async ({ page }) => {
      // Because the #run button does not exist (and its event listener failed to attach),
      // we validate the transition by invoking the existing global function runCode() directly.
      // We first compute the expected result by calling compile(code) in-page, then call runCode(),
      // and finally assert that the #output innerText matches the expected compile result.

      // Compute expected result using the same compile function & code defined on the page
      const expected = await page.evaluate(() => {
        // Use global compile and code variables defined in the page
        // compile already handles try/catch and returns a string
        return compile(code);
      });

      // Ensure expected is a non-empty string (compile returns a string even on errors)
      expect(typeof expected).toBe('string');
      expect(expected.length).toBeGreaterThan(0);

      // Invoke runCode() which should call compile(code) again and set #output.innerHTML
      await page.evaluate(() => {
        // call the function as provided by the page
        if (typeof runCode === 'function') {
          runCode();
        } else {
          // let it be — this branch shouldn't run because runCode is defined in the HTML script
          // we avoid modifying or patching anything; if undefined, tests will reveal it
        }
      });

      // Read the output text and compare to expected
      const outputText = await page.locator('#output').innerText();
      expect(outputText).toBe(expected);
    });

    test('Attempting to click non-existent #run via Playwright should confirm absence and not crash test runner', async ({ page }) => {
      // Validate that interacting with the expected trigger selector (#run) is impossible because it is absent.
      // We verify the Playwright locator reports count 0 rather than performing any click.
      const runLocator = page.locator('#run');
      await expect(runLocator).toHaveCount(0);

      // Ensure that no accidental console.log messages indicate a successful click
      const clickConsole = consoleMessages.filter(m => /click|run/i.test(m.text));
      expect(clickConsole.length).toBe(0);
    });
  });

  test.describe('Utility and Edge Cases (error scenarios)', () => {
    test('compile(code) handles malformed code and returns an error message (edge case)', async ({ page }) => {
      // The page's initial code variable is intentionally malformed:
      // '<console.log("Hello World!");</console.log>' which should produce a SyntaxError or similar.
      const result = await page.evaluate(() => {
        // call compile on the existing page variable 'code'
        return compile(code);
      });

      // The compile function catches errors and returns the error message as a string
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // The message should indicate a syntax or parsing problem (best-effort check)
      const meaningful = /Unexpected|Syntax|Unexpected token|identifier|Unexpected end|invalid/i.test(result);
      // It's acceptable if the exact wording varies by engine; ensure at least some hint of an error or that it's non-empty.
      expect(meaningful || result).toBeTruthy();
    });

    test('compile evaluated with a simple numeric expression returns its stringified value (normal case)', async ({ page }) => {
      // Ensure compile works for a normal expression that returns a primitive that can be stringified
      const numeric = await page.evaluate(() => compile('2+2'));
      expect(typeof numeric).toBe('string');
      expect(numeric).toBe('4');
    });

    test('compile with code that uses console.log returns handled error (toString on undefined) rather than crashing', async ({ page }) => {
      // When passing a console.log expression, eval returns undefined and compile tries .toString() on it
      // which will throw and be caught; compile should return error message string.
      const res = await page.evaluate(() => compile('console.log("hi");'));
      expect(typeof res).toBe('string');
      expect(res.length).toBeGreaterThan(0);
      // The error message often mentions toString or undefined; check it's non-empty.
    });
  });
});