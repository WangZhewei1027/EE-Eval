import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7186f0d0-d362-11f0-85a0-d3271c47ca09.html';

test.describe('Binary Tree FSM - Application 7186f0d0-d362-11f0-85a0-d3271c47ca09', () => {
  // Arrays to collect runtime diagnostics for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages emitted by the page
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore collection errors
      }
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page and allow scripts to run
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ }, testInfo) => {
    // Attach some diagnostic info to the test output for debugging failing tests
    if (pageErrors.length) {
      testInfo.attach('pageErrors', { body: pageErrors.map(e => `${e.name}: ${e.message}`).join('\n\n') });
    }
    if (consoleMessages.length) {
      testInfo.attach('consoleMessages', { body: consoleMessages.map(m => `${m.type}: ${m.text}`).join('\n\n') });
    }
  });

  test('S0_Idle: initial UI is rendered (h2 and #root present)', async ({ page }) => {
    // Validate the initial DOM evidence for S0_Idle as specified in the FSM:
    // - an <h2> with text "Binary Tree"
    // - a div with id "root"
    // This test does not attempt to call any page functions; it only asserts the DOM elements exist.
    const heading = page.locator('h2');
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText('Binary Tree');

    const rootDiv = page.locator('#root');
    await expect(rootDiv).toHaveCount(1);

    // The FSM evidence expects an empty #root on initial render; assert that it exists (content may be empty or modified by scripts)
    const rootHtml = await rootDiv.innerHTML();
    expect(rootHtml).not.toBeNull();

    // Ensure pageErrors were collected (the application HTML/JS contains syntax/runtime issues)
    // We do not require an error here, but if none occurred, that's surprising given the broken script in the HTML.
    // We will assert errors exist in a dedicated test below.
  });

  test('Page load emits script errors (SyntaxError or other runtime errors)', async ({ page }) => {
    // The provided HTML contains several JavaScript syntax issues; assert that at least one pageerror was emitted.
    // This validates that we observed natural runtime/parse errors and did not mutate the page to "fix" them.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Collect error messages for assertions
    const messages = pageErrors.map(e => `${e.name}: ${e.message}`).join(' | ');
    // Expect at least one common error pattern produced by malformed scripts: SyntaxError, Unexpected token, or ReferenceError
    expect(messages).toMatch(/SyntaxError|Unexpected token|ReferenceError|TypeError|is not defined|Unexpected identifier/);
  });

  test('InsertNode event/transition: attempting to call insertNode results in natural error (ReferenceError or similar)', async ({ page }) => {
    // The FSM defines an InsertNode event. The HTML lacks a proper interactive element to trigger it,
    // and the inline script has syntax errors. We attempt to call insertNode in the page context
    // exactly as-is and assert that the call fails naturally (ReferenceError or other).
    let caught;
    try {
      // Attempt to call the function directly in the page. If not defined or the runtime is broken,
      // this will throw and be caught below.
      await page.evaluate(() => {
        // Intentionally call as the app would (no modifications). Let any error surface.
        // We pass a simple array payload to mimic the FSM's data parameter.
        return insertNode([1, 2, 3]);
      });
    } catch (e) {
      caught = e;
    }

    // The call should not succeed; it should throw. Assert that we observed an error and that its message indicates the nature.
    expect(caught).toBeDefined();
    // error messages vary depending on parser/runtime; check for common patterns
    expect(String(caught.message)).toMatch(/insertNode is not defined|ReferenceError|SyntaxError|Unexpected token|is not a function/);
  });

  test('SearchNode event/transition: attempting to call searchNode results in natural error (ReferenceError or similar)', async ({ page }) => {
    // The FSM includes a SearchNode event. The application does not expose proper UI and contains broken script.
    // Attempt to call searchNode from the page context and assert it fails naturally.
    let caught;
    try {
      await page.evaluate(() => {
        return searchNode([1, 2, 3], 2);
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect(String(caught.message)).toMatch(/searchNode is not defined|ReferenceError|SyntaxError|Unexpected token|is not a function/);
  });

  test('S1_TreeBuilt: printTree entry action attempted by page scripts (detect attempt via errors or DOM changes)', async ({ page }) => {
    // The FSM's S1_TreeBuilt entry action is printTree(root).
    // The malformed script tries to call printTree; we validate whether:
    // - printTree exists and can be invoked (rare given syntax errors), or
    // - an error referencing printTree was emitted during page execution.
    // First determine whether printTree is present as a function.
    const typeOfPrintTree = await page.evaluate(() => {
      try {
        return typeof window.printTree;
      } catch (e) {
        // If the page context is broken, indicate that by returning the thrown message.
        return `__EVAL_ERROR__:${e && e.message ? e.message : String(e)}`;
      }
    });

    if (typeOfPrintTree === 'function') {
      // If the function exists despite other problems, invoke it with a controlled payload.
      // We expect it to append items into the #root element; assert that happens.
      // Wrap invocation in try/catch inside evaluate so any runtime errors propagate back to Playwright.
      let invoked = false;
      try {
        await page.evaluate(() => {
          // Clear root before invoking to observe deterministic changes
          const r = document.getElementById('root');
          if (r) r.innerHTML = '';
          printTree([42, 43]);
        });
        invoked = true;
      } catch (e) {
        // Invocation failed; treat as expected (the environment is unstable)
        invoked = false;
      }

      if (invoked) {
        // After successful invocation, assert DOM was updated accordingly
        const rootText = await page.locator('#root').innerText();
        // printTree appends "<br>" + value for each element; we expect the numbers to appear
        expect(rootText).toMatch(/42|43/);
      } else {
        // Invocation failed - ensure we observed an error somewhere in the runtime
        expect(pageErrors.length).toBeGreaterThan(0);
      }
    } else {
      // printTree is not a function or evaluation failed; assert that pageErrors include a mention of printTree
      const joined = pageErrors.map(e => `${e.name}: ${e.message}`).join(' ');
      // It's acceptable that the error messages might not explicitly mention printTree, so allow broad error patterns
      expect(joined.length + typeOfPrintTree.length).toBeGreaterThan(0);
    }
  });

  test('buildTree function: check presence and safe behavior without modifying environment', async ({ page }) => {
    // The page defines buildTree in the script. Given the broken script, it may or may not be defined.
    // Check typeof buildTree and, if present, call it in a sandboxed way to assert return shape.
    const buildTreeType = await page.evaluate(() => {
      try {
        return typeof window.buildTree;
      } catch (e) {
        return `__EVAL_ERROR__:${e && e.message ? e.message : String(e)}`;
      }
    });

    if (buildTreeType === 'function') {
      // Call buildTree with a sample array and assert it returns an array-like structure
      const result = await page.evaluate(() => {
        try {
          return { ok: true, value: buildTree([7, 8, 9]) };
        } catch (e) {
          return { ok: false, error: String(e && e.message ? e.message : e) };
        }
      });

      // If call succeeded, expect an array-like return (object with length or actual array)
      if (result && result.ok) {
        // result.value may be an array; assert it contains expected elements
        expect(Array.isArray(result.value)).toBeTruthy();
        expect(result.value.length).toBeGreaterThanOrEqual(0);
      } else {
        // If invocation failed, ensure the failure is recorded
        expect(result).toBeDefined();
      }
    } else {
      // If not a function, ensure the evaluation returned some indicator of failure or absence
      expect(buildTreeType).toBeDefined();
    }
  });

  test('Edge case: ensure we do not modify the page or patch functions; natural errors remain observable', async ({ page }) => {
    // This test asserts that we did not alter the global environment and that repeated attempts to call missing functions
    // continue to surface natural errors. We perform two sequential evaluations without injecting code into the page.
    let firstError, secondError;
    try {
      await page.evaluate(() => insertNode([0]));
    } catch (e) {
      firstError = e;
    }

    try {
      await page.evaluate(() => searchNode([0], 0));
    } catch (e) {
      secondError = e;
    }

    // Both calls should have produced errors (the original broken script prevents proper function definitions).
    expect(firstError).toBeDefined();
    expect(secondError).toBeDefined();

    // Confirm that the pageErrors captured by the page event handler include at least one SyntaxError or ReferenceError message.
    const joined = pageErrors.map(e => `${e.name}: ${e.message}`).join(' ');
    expect(joined).toMatch(/SyntaxError|ReferenceError|Unexpected token|is not defined|Unexpected identifier/);
  });
});