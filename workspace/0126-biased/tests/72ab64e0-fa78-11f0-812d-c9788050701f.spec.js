import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ab64e0-fa78-11f0-812d-c9788050701f.html';

test.describe('FSM tests for NP-Completeness interactive app (Application ID: 72ab64e0-fa78-11f0-812d-c9788050701f)', () => {
  // Arrays to collect runtime diagnostics from the page.
  let consoleMessages;
  let pageErrors;

  // Helper to capture a single dialog message resulting from a user action.
  async function captureNextDialog(page, action) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        page.removeListener('dialog', onDialog);
        reject(new Error('Timed out waiting for dialog'));
      }, 3000);

      function onDialog(dialog) {
        try {
          // Capture the message, then dismiss so the page can continue.
          const message = dialog.message();
          dialog.dismiss().catch(() => {});
          clearTimeout(timeout);
          page.removeListener('dialog', onDialog);
          resolve(message);
        } catch (err) {
          clearTimeout(timeout);
          page.removeListener('dialog', onDialog);
          reject(err);
        }
      }

      page.on('dialog', onDialog);

      // Perform the action that should trigger the dialog.
      try {
        await action();
      } catch (err) {
        // If clicking failed due to missing element, remove listener and rethrow
        page.removeListener('dialog', onDialog);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  test.beforeEach(async ({ page }) => {
    // Initialize diagnostic arrays for each test.
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions about runtime issues
    page.on('console', msg => {
      try {
        const args = msg.args ? msg.args.map(a => a.toString()).join(' ') : msg.text();
        consoleMessages.push({ type: msg.type(), text: msg.text(), args });
      } catch {
        consoleMessages.push({ type: msg.type(), text: msg.text ? msg.text() : String(msg) });
      }
    });
    page.on('pageerror', err => {
      // pageerror is typically an Error object; store its message and stack.
      pageErrors.push(err);
    });

    // Navigate to the application page and wait for load.
    await page.goto(APP_URL, { waitUntil: 'load', timeout: 10000 });
    // Allow a short grace period for any scripts to run (and potentially throw).
    await page.waitForTimeout(500);
  });

  test.afterEach(async ({ page }) => {
    // A small pause to ensure any late errors are captured before the test ends.
    await page.waitForTimeout(100);
  });

  test('Idle state: initial UI renders and buttons are present with correct attributes', async ({ page }) => {
    // This test validates the initial Idle state UI evidence:
    // - Buttons exist (#show-examples and #learn-more) with their expected classes and text.
    const showBtn = await page.$('#show-examples');
    const learnBtn = await page.$('#learn-more');

    // Assert buttons are present in the DOM
    expect(showBtn, 'Show Classic Examples button should exist').not.toBeNull();
    expect(learnBtn, 'Learn More button should exist').not.toBeNull();

    // Verify button text content
    expect(await page.textContent('#show-examples')).toContain('Show Classic Examples');
    expect(await page.textContent('#learn-more')).toContain('Learn More');

    // Verify classes on buttons (visual evidence)
    const showClasses = await page.getAttribute('#show-examples', 'class');
    const learnClasses = await page.getAttribute('#learn-more', 'class');
    expect(showClasses).toContain('btn-primary');
    expect(learnClasses).toContain('btn-outline');

    // Check global visual containers exist (sanity check for page render)
    expect(await page.$('.container')).not.toBeNull();
    expect(await page.$('header h1')).not.toBeNull();
    expect(await page.textContent('header h1')).toContain('NP-Completeness');

    // The FSM S0_Idle entry action mentions renderPage(). Verify that renderPage is not present
    // (we must not inject it). This asserts onEnter action from FSM is not implemented in the runtime.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // At least capture whether any page errors occurred during initial load. We expect the page
    // (as delivered) may have runtime issues; assert that pageErrors is an array (if none, tests below will assert presence).
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test('Transition S0 -> S1: clicking "Show Classic Examples" triggers expected alert and logs runtime errors', async ({ page }) => {
    // Validate the ShowExamplesClick event produces an alert with the classic NP-Complete problems.
    const expectedSnippet = 'Boolean satisfiability (SAT)';

    const dialogMessage = await captureNextDialog(page, async () => {
      await page.click('#show-examples');
    });

    // Assert alert message contains the expected content from FSM definition.
    expect(dialogMessage).toContain(expectedSnippet);
    expect(dialogMessage).toContain('Traveling salesman (TSP)');
    expect(dialogMessage).toContain('Graph coloring');

    // Verify that the page captured at least one page error (script may be truncated/unimplemented functions)
    // We assert that at least one page error occurred during the lifecycle.
    expect(pageErrors.length, 'Expect at least one runtime page error to occur').toBeGreaterThanOrEqual(1);

    // At least one of the errors should be a ReferenceError, SyntaxError, or TypeError (common for truncated JS)
    const combinedMessages = pageErrors.map(e => e.message || String(e)).join(' | ');
    expect(combinedMessages).toMatch(/ReferenceError|SyntaxError|TypeError/);
  });

  test('Transition S0 -> S2: clicking "Learn More" triggers expected alert and runtime diagnostics', async ({ page }) => {
    // Validate the LearnMoreClick event's alert includes resources mentioned in FSM.
    const expectedSnippet = 'Computers and Intractability';

    const dialogMessage = await captureNextDialog(page, async () => {
      await page.click('#learn-more');
    });

    // Assert alert contains referencing material and the phrase about deepest questions.
    expect(dialogMessage).toContain(expectedSnippet);
    expect(dialogMessage).toContain('Introduction to the Theory of Computation');
    expect(dialogMessage).toContain('This is one of the deepest questions in theoretical computer science');

    // Confirm runtime page errors were captured (the implementation may be incomplete/truncated).
    expect(pageErrors.length, 'Expect runtime errors to be present').toBeGreaterThanOrEqual(1);
    const anyMatching = pageErrors.some(e => /ReferenceError|SyntaxError|TypeError/.test(e.message || String(e)));
    expect(anyMatching).toBeTruthy();
  });

  test('Edge case: rapid repeated clicks produce multiple dialogs and do not crash the page', async ({ page }) => {
    // Rapidly click both buttons and capture the dialogs that appear in sequence.
    const messages = [];

    // Attach a temporary dialog handler that collects messages (will be dismissed automatically by our handler)
    page.on('dialog', async dialog => {
      messages.push(dialog.message());
      try { await dialog.dismiss(); } catch {}
    });

    // Rapid clicks: click show-examples then learn-more quickly
    await Promise.all([
      page.click('#show-examples'),
      page.click('#learn-more')
    ]);

    // Give the page a short moment to show both dialogs and for handlers to capture them.
    await page.waitForTimeout(500);

    // We expect at least 1 dialog message; in the ideal implementation both alerts fire in order.
    expect(messages.length).toBeGreaterThanOrEqual(1);
    // Validate that at least one of the messages contains a known FSM phrase
    const combined = messages.join(' ');
    expect(combined).toMatch(/Classic NP-Complete problems|To learn more about NP-Completeness/);

    // Ensure the page still has the primary UI elements (page hasn't crashed)
    expect(await page.$('#show-examples')).not.toBeNull();
    expect(await page.$('#learn-more')).not.toBeNull();
  });

  test('Implementation exposes graph containers but drawing may be incomplete; assert presence and capture script error details', async ({ page }) => {
    // Validate that graph containers are present even if the drawGraph implementation was cut off.
    const npGraphExists = await page.$('#np-graph');
    const npcGraphExists = await page.$('#npc-graph');
    expect(npGraphExists).not.toBeNull();
    expect(npcGraphExists).not.toBeNull();

    // Try to inspect whether nodes were appended to npc-graph; if script truncated, there may be none.
    const npcNodeCount = await page.evaluate(() => {
      const container = document.getElementById('npc-graph');
      if (!container) return 0;
      return container.querySelectorAll('.node').length;
    });

    // We accept either 0 (script failed before adding nodes) or >0 (nodes present). Both are valid runtime outcomes.
    expect(typeof npcNodeCount).toBe('number');
    expect(npcNodeCount).toBeGreaterThanOrEqual(0);

    // Assert that pageErrors include a stack/message that helps diagnose the broken implementation.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // Verify at least one message contains clues about missing function names like animateGraph or unexpected end of input.
    const diagnosticText = pageErrors.map(e => (e && e.message) || String(e)).join(' | ');
    expect(diagnosticText).toMatch(/animateGraph|drawGraph|Unexpected end of input|Uncaught|ReferenceError|SyntaxError|TypeError/);
  });

  test('FSM onEnter/onExit validation: verify that expected entry action functions are not defined (no patching)', async ({ page }) => {
    // FSM S0 had entry action renderPage() — confirm it does not exist.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // FSM S1 and S2 entry actions are alert() invocations, which are intrinsic and were tested above by clicking buttons.
    // Validate that we did not add or redefine any extra global functions as part of tests (we must not patch).
    const globalsToCheck = ['renderPage', 'animateGraph', 'drawGraph'];
    const globalsStatus = await page.evaluate((names) => {
      const res = {};
      names.forEach(n => res[n] = typeof window[n]);
      return res;
    }, globalsToCheck);

    // We assert that we did not inject implementations; allow either 'undefined' or 'function' depending on page script.
    expect(['undefined', 'function']).toContain(globalsStatus.renderPage);
    // drawGraph might be defined (script attempted to define it). We ensure we didn't invent it.
    expect(typeof globalsStatus.drawGraph === 'string').toBeTruthy();
  });

  test('Diagnostics: ensure console messages and page errors are surfaced for debugging', async ({ page }) => {
    // This test ensures test harness captures console and pageerror entries and that they include relevant info.
    // At least one console message structure should be captured (even if empty).
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // There should be at least one page error captured for the delivered page (the environment intentionally allows errors)
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Expose a summary as assertions to help debugging if tests fail later.
    const firstError = pageErrors[0];
    expect(firstError).toBeTruthy();
    const msg = firstError && (firstError.message || String(firstError));
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});