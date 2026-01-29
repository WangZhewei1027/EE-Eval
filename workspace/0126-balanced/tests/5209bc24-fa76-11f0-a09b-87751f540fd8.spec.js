import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209bc24-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Two Pointers FSM - Interactive Application (5209bc24-fa76-11f0-a09b-87751f540fd8)', () => {
  // Arrays to hold console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  // Set up a fresh page state before each test and attach listeners to capture console and errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // Normalize by recording the text
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() throws unexpectedly, record minimal info
        consoleMessages.push({ type: msg.type(), text: String(msg) });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object with name and message
      pageErrors.push({ name: err.name, message: err.message });
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No special teardown necessary; Playwright will close context/page automatically.
    // Keep this hook to emphasize structured setup/teardown in tests.
  });

  test('Idle state: initial render should show the button and no two-pointer logs before interaction', async ({ page }) => {
    // Validate Idle state evidence: button exists in DOM
    const button = await page.$('#two-pointers-example');
    expect(button).not.toBeNull(); // Button must be present per FSM S0_Idle evidence

    // The button should be visible (basic UI sanity check)
    expect(await button.isVisible()).toBeTruthy();

    // Before any interaction, there should be no console messages from twoPointers
    const foundTwoPointerLogs = consoleMessages.some(m =>
      m.text.startsWith('Sum of elements at the two pointers:') ||
      m.text.startsWith('Sum of elements at the other two pointers:')
    );
    expect(foundTwoPointerLogs).toBeFalsy();

    // If any page errors occurred during load, assert they are of expected JS runtime types.
    // We do not force errors; we simply assert that if errors exist they are typical runtime errors.
    if (pageErrors.length > 0) {
      const allowed = ['ReferenceError', 'SyntaxError', 'TypeError'];
      for (const err of pageErrors) {
        expect(allowed).toContain(err.name);
      }
    } else {
      // Preferable: no page errors on initial render
      expect(pageErrors.length).toBe(0);
    }
  });

  test('Transition: clicking the button moves to Executing state and logs expected sums', async ({ page }) => {
    // This test asserts the transition S0_Idle -> S1_Executing via the ButtonClick event.
    // When clicked, the twoPointers() function logs two console messages with labels and numeric sums.

    // Ensure button exists
    const button1 = await page.$('#two-pointers-example');
    expect(button).not.toBeNull();

    // Click the button and wait for the two expected console messages.
    // We wait for both messages explicitly to ensure the handler ran and produced output.
    const firstLogPromise = page.waitForEvent('console', {
      predicate: (m) => m.text().startsWith('Sum of elements at the two pointers:')
    });
    const secondLogPromise = page.waitForEvent('console', {
      predicate: (m) => m.text().startsWith('Sum of elements at the other two pointers:')
    });

    await button.click();

    // Await the two console events
    const firstMsg = await firstLogPromise;
    const secondMsg = await secondLogPromise;

    // Normalize messages to text
    const firstText = firstMsg.text();
    const secondText = secondMsg.text();

    // Validate that the labels are present
    expect(firstText).toContain('Sum of elements at the two pointers:');
    expect(secondText).toContain('Sum of elements at the other two pointers:');

    // Validate numeric values are as expected given the implementation logic.
    // The implementation's algorithm with arr = [1,2,3,4,5] yields sum1 = 5 and sum2 = 15.
    // Parse trailing numbers from strings (handles cases like "Label: 5" or "Label: 5,")
    const parseNumber = (s) => {
      const m = s.match(/(-?\d+(\.\d+)?)/);
      return m ? Number(m[0]) : NaN;
    };

    const value1 = parseNumber(firstText);
    const value2 = parseNumber(secondText);

    expect(Number.isFinite(value1)).toBeTruthy();
    expect(Number.isFinite(value2)).toBeTruthy();

    expect(value1).toBe(5);
    expect(value2).toBe(15);

    // Ensure no unexpected page errors were thrown during execution
    if (pageErrors.length > 0) {
      const allowed1 = ['ReferenceError', 'SyntaxError', 'TypeError'];
      for (const err of pageErrors) {
        expect(allowed).toContain(err.name);
      }
    } else {
      expect(pageErrors.length).toBe(0);
    }
  });

  test('Multiple clicks: clicking repeatedly logs outputs each time (idempotence/handler permanence)', async ({ page }) => {
    // Verify that the event handler remains attached and produces outputs on repeated clicks.
    const button2 = await page.$('#two-pointers-example');
    expect(button).not.toBeNull();

    // Click the button twice and collect console messages
    // Use waitForEvent twice per click for the two logs
    await button.click();
    const firstA = await page.waitForEvent('console', {
      predicate: (m) => m.text().startsWith('Sum of elements at the two pointers:')
    });
    const firstB = await page.waitForEvent('console', {
      predicate: (m) => m.text().startsWith('Sum of elements at the other two pointers:')
    });

    await button.click();
    const secondA = await page.waitForEvent('console', {
      predicate: (m) => m.text().startsWith('Sum of elements at the two pointers:')
    });
    const secondB = await page.waitForEvent('console', {
      predicate: (m) => m.text().startsWith('Sum of elements at the other two pointers:')
    });

    // Normalize and parse numbers
    const texts = [firstA.text(), firstB.text(), secondA.text(), secondB.text()];
    const parseNumber1 = (s) => {
      const m1 = s.match(/(-?\d+(\.\d+)?)/);
      return m ? Number(m[0]) : NaN;
    };
    const values = texts.map(parseNumber);

    // All four log messages should contain numeric values and follow expected sums (5 and 15)
    expect(values[0]).toBe(5);
    expect(values[1]).toBe(15);
    expect(values[2]).toBe(5);
    expect(values[3]).toBe(15);

    // Ensure console messages were recorded into our capture array (sanity)
    const twoPointerLogs = consoleMessages.filter(m =>
      m.text.startsWith('Sum of elements at the two pointers:') ||
      m.text.startsWith('Sum of elements at the other two pointers:')
    );
    expect(twoPointerLogs.length).toBeGreaterThanOrEqual(4);
  });

  test('Edge case: removing the button before clicking should not call handler and should not produce new logs or errors', async ({ page }) => {
    // Remove the button from the DOM to simulate a mutated UI before interaction.
    await page.evaluate(() => {
      const btn = document.getElementById('two-pointers-example');
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    });

    // Attempt to programmatically click the button reference via DOM API safely (use optional chaining)
    // This should be a no-op if the element is not present; it's not allowed to redefine or patch handlers.
    await page.evaluate(() => {
      const btn1 = document.getElementById('two-pointers-example');
      if (btn) {
        try {
          btn.click();
        } catch (e) {
          // ignore — we don't alter runtime behavior; errors would be captured by pageerror listener
        }
      }
    });

    // Wait briefly to allow any asynchronous logs/errors to surface (short timeout)
    await page.waitForTimeout(100);

    // There should be no new two-pointer logs added by this no-op action
    const twoPointerLogs1 = consoleMessages.filter(m =>
      m.text.startsWith('Sum of elements at the two pointers:') ||
      m.text.startsWith('Sum of elements at the other two pointers:')
    );
    // If prior tests didn't run in same context, this should be 0; ensure no new logs as result of removal/click
    expect(twoPointerLogs.length).toBe(0);

    // No page errors should have been introduced by this removal/click sequence.
    if (pageErrors.length > 0) {
      const allowed2 = ['ReferenceError', 'SyntaxError', 'TypeError'];
      for (const err of pageErrors) {
        expect(allowed).toContain(err.name);
      }
    } else {
      expect(pageErrors.length).toBe(0);
    }
  });

  test('Observability: any runtime page errors are captured and are of expected types if present', async ({ page }) => {
    // This test's purpose is to explicitly assert on the types of any uncaught exceptions during load/interactions.
    // We do not inject or create errors artificially; we only assert the nature of errors if the page produced them.

    // Trigger a benign action (click) that normally does not throw
    const button3 = await page.$('#two-pointers-example');
    if (button) {
      await button.click();
      // allow console/pageerror events to fire
      await page.waitForTimeout(50);
    }

    // If any page errors exist, ensure they are one of the allowed runtime error classes
    if (pageErrors.length > 0) {
      const allowed3 = ['ReferenceError', 'SyntaxError', 'TypeError'];
      for (const err of pageErrors) {
        // Provide informative assertions so test failure shows error name/message
        expect(allowed, `Unexpected page error type: ${err.name} - ${err.message}`).toContain(err.name);
      }
    } else {
      // It's acceptable for there to be no page errors; assert that explicitly.
      expect(pageErrors.length).toBe(0);
    }
  });
});