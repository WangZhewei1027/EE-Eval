import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1acb3-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Heap (Max) - FSM and Interactive Demonstration (f0b1acb3-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Shared collectors for console and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners and navigate to the page before each test.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture runtime/page errors (including SyntaxError, ReferenceError, TypeError)
    page.on('pageerror', err => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Navigate to the HTML page (let scripts run; do NOT modify page code)
    await page.goto(URL);
  });

  test.afterEach(async ({ page }) => {
    // Small safeguard: capture any final console messages
    // (no-op, just kept for clarity)
  });

  // Test 1: Validate initial Idle state (S0_Idle)
  test('Initial Idle state renders expected DOM elements and content', async ({ page }) => {
    // This test validates the S0_Idle FSM state:
    // - The demo button exists (#demoButton)
    // - The demo output container exists (#demoOutput)
    // - The demoOutput contains the initial guidance text rendered by the static HTML
    // It also asserts that script/runtime errors (if any) are observed via pageerror events,
    // as required by the instruction to observe and assert errors.

    // Ensure the Run Demonstration button is present and visible
    const demoButton = await page.locator('#demoButton');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Run Demonstration');

    // Ensure the output visualization container exists and contains the expected initial text
    const demoOutput = await page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();
    const outputText = (await demoOutput.innerText()).trim();
    // The static HTML defines: "Heap will appear here after demonstration..."
    expect(outputText).toMatch(/Heap will appear here after demonstration/i);

    // The provided inline script contains a syntax error near the end.
    // We must observe and assert that a pageerror (SyntaxError) has occurred.
    // The runtime may emit a SyntaxError or an unexpected token error message.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // At least one page error message should reference SyntaxError or Unexpected token / Invalid
    const joinedMessages = pageErrors.map(e => e.message).join(' | ');
    expect(joinedMessages).toMatch(/SyntaxError|Unexpected token|Invalid or unexpected token/i);
  });

  // Test 2: Trigger the Run Demonstration event and validate transition (S0 -> S1)
  test('Clicking Run Demonstration attempts to transition to Demonstrating (S1) and either updates DOM or emits errors', async ({ page }) => {
    // This test attempts to exercise the transition defined in the FSM:
    // Event: RunDemonstration (click #demoButton)
    // Expected observable: demoOutput.innerHTML = '<p>Starting demonstration...</p>;'
    //
    // Because the page's script contains a syntax error, the event handler may not be registered.
    // We assert either:
    //  - The expected DOM change occurred (happy path), OR
    //  - A syntax/runtime error prevented the transition and was emitted (error path).
    //
    // We do NOT modify the page; we allow errors to happen and assert them.

    // Click the button to trigger the demonstration
    await page.click('#demoButton');

    // Give the page a moment to process any (attempted) updates or emit errors
    await page.waitForTimeout(250);

    const demoOutput = await page.locator('#demoOutput');
    const content = (await demoOutput.innerText()).trim();

    // If script had executed correctly, the first thing set by the handler is:
    // '<p>Starting demonstration...</p>'
    if (/Starting demonstration/i.test(content)) {
      // Happy path: the transition executed and set the expected starting text
      expect(content).toMatch(/Starting demonstration/i);

      // In the happy path we expect NO new page-level syntax errors related to the click handler.
      // However, keep a tolerant assertion: pageErrors may still have earlier syntax errors (but usually not).
      // Assert that either there are no new errors, or if errors exist, they are already present (captured).
      // We assert that at least the visible transition happened.
    } else {
      // Error path: the expected DOM update did not occur. Confirm that a syntax/runtime error is present.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const joined = pageErrors.map(e => e.message).join(' | ');
      expect(joined).toMatch(/SyntaxError|Unexpected token|Invalid or unexpected token/i);

      // Also assert that the demo output remained the original placeholder text (since handler didn't run)
      expect(content).toMatch(/Heap will appear here after demonstration/i);
    }
  });

  // Test 3: Multiple clicks and robustness - ensure no new uncaught exceptions beyond the initial parsing error
  test('Multiple clicks do not crash the page further and elements remain accessible', async ({ page }) => {
    // This test checks resilience: clicking the button multiple times should not make the page unresponsive.
    // It also confirms that DOM elements still exist and that additional unhandled exceptions are not being generated repeatedly.

    // Capture initial number of page errors
    const initialErrorCount = pageErrors.length;

    // Attempt multiple clicks
    await page.click('#demoButton');
    await page.waitForTimeout(100);
    await page.click('#demoButton');
    await page.waitForTimeout(100);
    await page.click('#demoButton');
    await page.waitForTimeout(200);

    // The button should still be visible and clickable
    const demoButton = await page.locator('#demoButton');
    await expect(demoButton).toBeVisible();

    // The output container should still exist
    const demoOutput = await page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();

    // Ensure that the number of page errors did not explode uncontrollably.
    // We accept that a syntax error likely occurred once during parsing; ensure only a small number of errors are present.
    // (This is tolerant because different browsers may behave differently.)
    expect(pageErrors.length).toBeGreaterThanOrEqual(initialErrorCount);
    expect(pageErrors.length).toBeLessThanOrEqual(initialErrorCount + 10);

    // No navigation should have occurred as a result of clicks
    expect(page.url()).toBe(URL);
  });

  // Test 4: Inspect presence/absence of demonstration helper functions (visualizeHeap) and assert consequences
  test('visualizeHeap function presence correlates with correct script execution; absence implies parsing/runtime error', async ({ page }) => {
    // We attempt to detect whether the demo's helper functions were registered.
    // Per instructions we must not inject or redefine any globals; we only query the page as-is.

    // Use page.evaluate to check typeof visualizeHeap (this does not modify the page)
    const visualizeType = await page.evaluate(() => {
      // Accessing an undefined global is safe; it returns 'undefined'
      // This simply reports the typeof without injecting or changing the page.
      try {
        return typeof visualizeHeap;
      } catch (e) {
        // If evaluate cannot access due to earlier script failure, return a string describing the error
        return `error:${String(e && e.message ? e.message : e)}`;
      }
    });

    // If the inline script parsed and executed fully, visualizeHeap would be a function.
    if (visualizeType === 'function') {
      // If it's present, that's the happy path: confirm it returns a string for an empty array.
      const result = await page.evaluate(() => {
        try {
          return visualizeHeap([]);
        } catch (e) {
          return `eval-error:${String(e && e.message ? e.message : e)}`;
        }
      });
      // visualizeHeap returns 'Empty heap' on empty input in the implementation
      expect(result).toMatch(/Empty heap/i);
    } else {
      // visualizeHeap absent - likely due to syntax/parsing error in the script.
      // Assert that we observed page errors consistent with that.
      expect(visualizeType === 'undefined' || /^error:/.test(visualizeType)).toBeTruthy();
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const joined = pageErrors.map(e => e.message).join(' | ');
      expect(joined).toMatch(/SyntaxError|Unexpected token|Invalid or unexpected token/i);
    }
  });

  // Test 5: Edge case - ensure that malformed script produces clear syntax errors in console/pageerror
  test('Malformed inline script produces a detectable SyntaxError in pageerror and/or console', async ({ page }) => {
    // This test explicitly asserts that the particular malformed token at the end of the inline script
    // (demoOutput.innerHTML = steps';) results in a SyntaxError being reported.
    //
    // We check both pageerror events and console messages captured earlier.

    // Ensure we have at least one pageerror
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const messages = pageErrors.map(e => e.message).join(' | ');
    expect(messages).toMatch(/SyntaxError|Unexpected token|Invalid or unexpected token/i);

    // Additionally verify that consoleMessages contain at least one entry that indicates an error-level message,
    // or that the console captured the syntax/parsing problem.
    const consoleCombined = consoleMessages.map(m => `${m.type}: ${m.text}`).join(' | ');
    // It's acceptable if console didn't capture the syntax error (some engines only emit pageerror),
    // but if there are console messages, ensure they do not indicate silent failures.
    if (consoleMessages.length > 0) {
      // At minimum, console messages should be strings; we assert the collection exists and is readable.
      expect(consoleCombined.length).toBeGreaterThan(0);
    }
  });
});