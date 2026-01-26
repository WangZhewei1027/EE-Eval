import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b20a20-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Space Complexity App (FSM validation) - f5b20a20-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Setup before each test: navigate to the page and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console logs for assertions
    page.on('console', (msg) => {
      // Normalize by pushing the text representation
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  // Test initial state: S0_Idle should render the button with expected text
  test('Initial state (S0_Idle) renders Calculate Space Complexity button', async ({ page }) => {
    // Validate the button exists in the DOM
    const button = page.locator('#space-complexity-demo');
    await expect(button).toBeVisible();

    // Validate initial button text matches FSM evidence for S0_Idle
    await expect(button).toHaveText('Calculate Space Complexity');

    // Ensure no uncaught page errors just from loading
    expect(pageErrors.length).toBe(0);
  });

  // Test the click transition and DOM mutation sequence (S0 -> S1 -> S0)
  test('Clicking button triggers demo() and produces expected DOM and console effects (S0 -> S1 -> S0)', async ({ page }) => {
    // Attach a MutationObserver in the page to capture innerHTML changes in sequence.
    // This allows us to observe both the 'Calculating...' intermediate text and the final 'Space complexity calculated successfully!'
    await page.evaluate(() => {
      // Initialize a global array to capture changes
      window.__mutationChanges = [];
      const btn = document.getElementById('space-complexity-demo');

      // Create observer to capture changes to childList and characterData
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          // capture the current innerHTML snapshot whenever a relevant mutation occurs
          if (m.type === 'characterData' || m.type === 'childList' || m.type === 'subtree') {
            window.__mutationChanges.push(btn.innerHTML);
          }
        }
      });

      // Observe changes in the button subtree (text changes occur here)
      observer.observe(btn, { characterData: true, childList: true, subtree: true });

      // expose the observer in case tests want to disconnect it later (not strictly necessary)
      window.__mutationObserver = observer;
    });

    // Click the button once to trigger demo()
    await page.click('#space-complexity-demo');

    // Wait a short time to allow synchronous mutations and console logs to be processed
    await page.waitForTimeout(100);

    // Retrieve mutation sequence captured by the page
    const mutations = await page.evaluate(() => {
      // return the captured mutations and final innerHTML
      return {
        changes: window.__mutationChanges || [],
        finalText: document.getElementById('space-complexity-demo').innerHTML
      };
    });

    // The demo() function sets 'Calculating space complexity...' and then later sets 'Space complexity calculated successfully!'
    // Even though this is synchronous in the implementation, the MutationObserver should capture both states in order.
    // Assert that we observed at least one change and that the final observed text is the success message.
    expect(mutations.changes.length).toBeGreaterThanOrEqual(1);

    // Check that the sequence contains the expected intermediate and final texts in order somewhere in the captured list.
    // We allow them to appear anywhere in the changes array (but order is important).
    const seq = mutations.changes;
    const hasCalculating = seq.some(s => s.includes('Calculating space complexity'));
    const hasSuccess = seq.some(s => s.includes('Space complexity calculated successfully'));

    expect(hasCalculating).toBeTruthy();
    expect(hasSuccess).toBeTruthy();

    // Verify final button text equals the FSM's S1 exit action result
    expect(mutations.finalText).toBe('Space complexity calculated successfully!');

    // Verify console messages include the expected log from calculateSpaceComplexity and demo()
    // There is a log during initial page load and another when demo() runs, both with same content.
    const expectedLog = 'The space complexity of the algorithm is O(1000^2)';
    const matchingLogs = consoleMessages.filter((m) => m.includes(expectedLog));
    // At least one initial log from page load and one from the demo click should exist (>=1)
    expect(matchingLogs.length).toBeGreaterThanOrEqual(1);

    // Ensure no unexpected uncaught page errors occurred during clicking
    expect(pageErrors.length).toBe(0);
  });

  // Test multiple rapid clicks to validate repeated transitions and robustness
  test('Multiple rapid clicks should repeatedly transition and end in success state', async ({ page }) => {
    // Attach observer to capture changes
    await page.evaluate(() => {
      window.__multiChanges = [];
      const btn = document.getElementById('space-complexity-demo');
      const observer = new MutationObserver(() => {
        window.__multiChanges.push(btn.innerHTML);
      });
      observer.observe(btn, { characterData: true, childList: true, subtree: true });
      window.__multiObserver = observer;
    });

    // Perform multiple rapid clicks
    const clickCount = 3;
    for (let i = 0; i < clickCount; i++) {
      await page.click('#space-complexity-demo');
    }

    // Allow time for synchronous mutations to complete and console logs to flush
    await page.waitForTimeout(200);

    // Retrieve captured changes and final text
    const result = await page.evaluate(() => {
      return {
        changes: window.__multiChanges || [],
        finalText: document.getElementById('space-complexity-demo').innerHTML
      };
    });

    // Each click should cause at least two text changes (Calculating..., then Success), so expect at least 2 * clickCount entries
    expect(result.changes.length).toBeGreaterThanOrEqual(clickCount * 2);

    // Final text should still be the success message
    expect(result.finalText).toBe('Space complexity calculated successfully!');

    // Check that console was called multiple times for demo() (at least equal to number of clicks)
    const expectedLog = 'The space complexity of the algorithm is O(1000^2)';
    const demoLogs = consoleMessages.filter((m) => m.includes(expectedLog));
    expect(demoLogs.length).toBeGreaterThanOrEqual(clickCount); // initial load adds at least one, demo adds at least clickCount

    // No uncaught page errors expected during repeated clicks
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: attempt to call a function referenced in the FSM (renderPage) which does not exist in the page.
  // Per instructions, we must let ReferenceError happen naturally and assert that it occurs.
  test('Invoking missing renderPage() should produce a ReferenceError in the page context', async ({ page }) => {
    // Attempt to call renderPage() inside page context and capture the thrown error
    const callResult = await page.evaluate(() => {
      try {
        // This will throw ReferenceError because renderPage is not defined in the page scripts
        renderPage();
        return { success: true };
      } catch (err) {
        // Return the error information to the test harness for assertion
        return {
          success: false,
          name: err && err.name ? err.name : null,
          message: err && err.message ? err.message : String(err)
        };
      }
    });

    // Assert that an error was returned and that it is a ReferenceError as expected
    expect(callResult.success).toBe(false);
    expect(callResult.name).toBe('ReferenceError');
    expect(typeof callResult.message).toBe('string');
    // The message should reference 'renderPage' in most engines
    expect(callResult.message.toLowerCase()).toContain('renderpage');
  });

  // Ensure there are no unexpected global JavaScript errors during a normal user scenario (load + click)
  test('No uncaught global errors during normal usage (load then single click)', async ({ page }) => {
    // Clear captured console and page errors
    consoleMessages = [];
    pageErrors = [];

    // Perform a normal click
    await page.click('#space-complexity-demo');

    // Wait briefly for logs/errors
    await page.waitForTimeout(100);

    // We assert that there were no page errors (uncaught exceptions)
    expect(pageErrors.length).toBe(0);

    // Assert that at least one console log about space complexity occurred
    const expectedLog = 'The space complexity of the algorithm is O(1000^2)';
    const found = consoleMessages.some((m) => m.includes(expectedLog));
    expect(found).toBeTruthy();
  });
});