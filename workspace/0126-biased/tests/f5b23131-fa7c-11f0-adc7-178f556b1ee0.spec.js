import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b23131-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('FSM: Context Switching (Application f5b23131-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // We will capture console messages and page errors for assertions in tests.
  // Each test will create fresh arrays to avoid cross-test pollution.

  test.describe('State: S0_Idle (Initial / Idle state validations)', () => {
    test('Idle state: page structure and textual content are present', async ({ page }) => {
      // Arrays to capture runtime diagnostic info
      const consoleMessages = [];
      const pageErrors = [];

      // Collect console and page errors
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err && err.message ? err.message : String(err)));

      // Load the application page and wait for load events
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Verify the page title matches expected
      await expect(page).toHaveTitle('Context Switching');

      // Validate main heading exists and contains expected text
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText('Context Switching');

      // Validate that introductory paragraph exists and contains a known phrase
      const introParagraph = page.locator('p').first();
      await expect(introParagraph).toContainText('Context switching is a fundamental concept');

      // Validate presence of a subsection header
      const typesHeader = page.locator('h2', { hasText: 'Types of Context Switching' });
      await expect(typesHeader).toHaveCount(1);

      // Validate algorithms list contains the three expected items
      const listItemsText = await page.locator('ul >> li').allTextContents();
      // We expect at least the three algorithm items described in the FSM HTML
      expect(listItemsText.join('|')).toContain('Spinlock algorithm');
      expect(listItemsText.join('|')).toContain('Round-robin algorithm');
      expect(listItemsText.join('|')).toContain('Least Recently Used (LRU) algorithm');

      // Verify that the FSM-declared button (#button) is not present in the DOM as implemented
      const buttonLocator = page.locator('#button');
      await expect(buttonLocator).toHaveCount(0);

      // There should be no runtime console logs that match the FSM's transition logs yet
      const joinedConsole = consoleMessages.map(c => `${c.type}: ${c.text}`).join('\n');
      expect(joinedConsole).not.toContain('Current Process:');
      expect(joinedConsole).not.toContain('Next Process ID:');
      expect(joinedConsole).not.toContain('Next Memory:');

      // Page errors may exist due to script issues; we will not assert their absence here
      // This test focuses on DOM/state content only.
    });
  });

  test.describe('Events and Transitions (ButtonClick and associated actions)', () => {
    test('Missing #button causes a script TypeError during page load (expected runtime error)', async ({ page }) => {
      // Capture page errors emitted during load
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err && err.message ? err.message : String(err)));

      // Also capture console messages for inspection
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

      // Load page and allow scripts to execute and produce errors if any
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Wait a short moment for any asynchronous errors (scripts on load)
      await page.waitForTimeout(200);

      // We expect at least one page error because the script tries to call addEventListener on a null element.
      // Different browser engines may produce slightly different error messages; check for known patterns.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Ensure one of the page errors mentions addEventListener or that it is a TypeError about null
      const joinedErrors = pageErrors.join('\n');
      const hasAddEventListenerError = /addEventListener/.test(joinedErrors);
      const hasCannotReadPropertiesNull = /Cannot read properties of null/i.test(joinedErrors) || /Cannot read property 'addEventListener'/i.test(joinedErrors);
      const hasTypeError = /TypeError/.test(joinedErrors);

      expect(hasAddEventListenerError || hasCannotReadPropertiesNull || hasTypeError).toBeTruthy();

      // Also ensure that no "Current Process:" console logs (which would come from the transition action) were produced
      const hadProcessLogs = consoleMessages.some(m => /Current Process:/.test(m.text));
      expect(hadProcessLogs).toBeFalsy();
    });

    test('Attempting to interact with non-existent #button yields errors and cannot trigger FSM transition', async ({ page }) => {
      // We'll capture page errors and console output for assertions
      const pageErrors = [];
      const consoleMessages = [];
      page.on('pageerror', e => pageErrors.push(e && e.message ? e.message : String(e)));
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(100);

      // Confirm the DOM truly lacks the declared button
      const buttonCount = await page.locator('#button').count();
      expect(buttonCount).toBe(0);

      // Attempt to click the selector using Playwright's click method.
      // This should fail because the selector does not exist. We catch the error and assert it mentions the missing selector/timeout.
      let clickError = null;
      try {
        // Use a small timeout to avoid long waits in CI
        await page.click('#button', { timeout: 1000 });
      } catch (err) {
        clickError = err;
      }
      expect(clickError).toBeTruthy();
      // The message should indicate the selector couldn't be found or timed out waiting for it
      const clickErrMsg = String(clickError && clickError.message ? clickError.message : clickError);
      const indicatesMissing = /waiting for selector|No node found|Timeout|#button/.test(clickErrMsg);
      expect(indicatesMissing).toBeTruthy();

      // As an alternate, try a manual in-page evaluation that attempts to access the button and register a listener.
      // This will throw a TypeError inside the page context because getElementById returns null.
      // We catch the thrown evaluation error and assert its message refers to addEventListener/null.
      let evalError = null;
      try {
        await page.evaluate(() => {
          // This code purposely reproduces the runtime operation that the page script attempted.
          // It will throw in-page if the element is null; we do NOT modify global functions or create new globals.
          document.getElementById('button').addEventListener('click', () => {});
        });
      } catch (err) {
        // Playwright wraps evaluation errors; capture string form for assertions.
        evalError = err;
      }
      expect(evalError).toBeTruthy();
      const evalErrMsg = String(evalError && evalError.message ? evalError.message : evalError);
      // The evaluation error message should indicate attempting to read properties of null / addEventListener
      const evalIndicatesAddEventListener = /addEventListener/.test(evalErrMsg);
      const evalIndicatesNull = /Cannot read properties of null|Cannot read property 'addEventListener'/.test(evalErrMsg);
      expect(evalIndicatesAddEventListener || evalIndicatesNull).toBeTruthy();

      // Finally, ensure that because the listener never successfully registered, the transition actions (console.log lines)
      // were never executed (no "Current Process" or "Next Process" logs).
      const joinedConsole = consoleMessages.map(c => `${c.type}: ${c.text}`).join('\n');
      expect(joinedConsole).not.toContain('Current Process:');
      expect(joinedConsole).not.toContain('Next Process ID:');
    });

    test('Edge case: verify that no onEnter / onExit actions exist and none were triggered', async ({ page }) => {
      // In the FSM, there are no entry_actions or exit_actions defined for S0_Idle.
      // We validate that loading the page does not produce any special lifecycle console traces referring to onEnter/onExit.
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

      await page.goto(APP_URL, { waitUntil: 'load' });
      await page.waitForTimeout(100);

      // Combined console text should not mention onEnter or onExit
      const joinedConsole = consoleMessages.map(c => c.text).join('\n');
      expect(/onEnter|onExit/i.test(joinedConsole)).toBeFalsy();
    });
  });

  test.describe('Observability: Console and Page Error Monitoring', () => {
    test('Capture and assert the nature of page errors and ensure they are developer-actionable', async ({ page }) => {
      // This test emphasizes observing errors exactly as they occur without modifying the environment.
      const pageErrors = [];
      const consoleMessages = [];
      page.on('pageerror', e => pageErrors.push(e && e.message ? e.message : String(e)));
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

      await page.goto(APP_URL, { waitUntil: 'load' });

      // Wait briefly to ensure any synchronous script errors are fired and collected
      await page.waitForTimeout(200);

      // There should be at least one page error related to the missing #button interaction setup.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // The error messages should be informative: include TypeError or function name attempted (addEventListener)
      const errorsJoined = pageErrors.join('\n');
      const informative = /TypeError|addEventListener|Cannot read properties of null/.test(errorsJoined);
      expect(informative).toBeTruthy();

      // Console should not contain the expected FSM transition logs since transition couldn't be triggered
      const consoleJoined = consoleMessages.map(m => `[${m.type}] ${m.text}`).join('\n');
      expect(consoleJoined).not.toContain('Current Process:');
      expect(consoleJoined).not.toContain('Next Process:');
    });
  });
});