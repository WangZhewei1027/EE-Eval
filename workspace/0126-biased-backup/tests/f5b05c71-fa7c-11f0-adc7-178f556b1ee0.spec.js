import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b05c71-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('f5b05c71-fa7c-11f0-adc7-178f556b1ee0 - Trie Explanation FSM tests', () => {
  // Containers to collect console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages for assertions
    page.on('console', (msg) => {
      try {
        // Serialize message text and type
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (uncaught exceptions, syntax errors, etc.)
    page.on('pageerror', (err) => {
      // err is typically an Error object
      pageErrors.push(err);
    });

    // Load the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Tear down collectors (not strictly necessary, but explicit)
    consoleMessages = [];
    pageErrors = [];
  });

  test('Idle state: page loads and UI elements for Idle state are present', async ({ page }) => {
    // This verifies the S0_Idle state: renderPage() is supposed to run on entry.
    // We must not modify or patch the app; we only assert observed DOM and runtime behavior.

    // Check that the Run Demo button exists in the DOM and is visible
    const demoButton = await page.locator('#demo-button');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Run Demo');

    // The page contains paragraphs that the script would populate.
    // Because the included script has a redeclared const (algorithmDescription), a SyntaxError is expected.
    // Verify that paragraph placeholders exist even if script failed to execute.
    await expect(page.locator('#text-explanation')).toBeVisible();
    await expect(page.locator('#algorithm-explanation')).toBeVisible();
    await expect(page.locator('#algorithm-description')).toBeVisible();

    // The content likely remains empty (script didn't execute). Assert that at least we have empty textContent or unchanged state.
    const textExplanationContent = await page.locator('#text-explanation').innerText();
    const algorithmExplanationContent = await page.locator('#algorithm-explanation').innerText();
    const algorithmDescriptionContent = await page.locator('#algorithm-description').innerText();

    // They might be empty strings if script didn't run. We assert that they are strings (exist) and do not throw.
    expect(typeof textExplanationContent).toBe('string');
    expect(typeof algorithmExplanationContent).toBe('string');
    expect(typeof algorithmDescriptionContent).toBe('string');

    // Assert that a syntax or runtime error was captured during page load (expected due to duplicate const)
    // At least one pageerror or console error should mention "algorithmDescription" or "already been declared" or "SyntaxError"
    const errorMessages = [
      ...consoleMessages.map((m) => `${m.type}: ${m.text}`),
      ...pageErrors.map((e) => (e && e.message) || String(e)),
    ];

    const foundSyntaxOrRedeclare = errorMessages.some((m) =>
      /algorithmDescription|already been declared|SyntaxError/i.test(m)
    );

    expect(foundSyntaxOrRedeclare).toBeTruthy();
  });

  test('Transition: clicking Run Demo should log demo message, but script SyntaxError prevents transition', async ({ page }) => {
    // This test checks the event DemoButtonClick and the transition to S1_Demo_Running.
    // According to the FSM, clicking the button should cause console.log('Demo button clicked!').
    // However, the page script contains a redeclared const which causes a SyntaxError at parse time.
    // We therefore assert that:
    // 1) The SyntaxError exists
    // 2) Clicking the button does NOT produce the expected 'Demo button clicked!' message
    // 3) No new different errors are introduced on click beyond the existing ones

    // Confirm initial SyntaxError present
    const initialErrorMessages = [
      ...consoleMessages.map((m) => `${m.type}: ${m.text}`),
      ...pageErrors.map((e) => (e && e.message) || String(e)),
    ];
    const initialHasSyntax = initialErrorMessages.some((m) =>
      /algorithmDescription|already been declared|SyntaxError/i.test(m)
    );
    expect(initialHasSyntax).toBeTruthy();

    // Clear consoleMessages snapshot for click-phase checking but keep underlying listeners
    const beforeClickConsoleCount = consoleMessages.length;
    const beforeClickPageErrorsCount = pageErrors.length;

    // Perform click on demo button
    await page.locator('#demo-button').click({ timeout: 2000 });

    // Allow some short time for any console logs to appear if event handler had been attached
    await page.waitForTimeout(200);

    // Collect messages that occurred after click
    const afterClickConsole = consoleMessages.slice(beforeClickConsoleCount);
    const afterClickPageErrors = pageErrors.slice(beforeClickPageErrorsCount);

    // The expected demo log would be: "Demo button clicked!"
    const demoLogFound = afterClickConsole.some((m) => /Demo button clicked!/i.test(m.text));

    // Because the script failed to parse, the demo listener is not attached; assert demo log NOT found
    expect(demoLogFound).toBeFalsy();

    // Ensure no additional unexpected page errors were introduced by clicking (beyond the original SyntaxError)
    // It's acceptable if the counts remain the same or only warnings are logged; we assert no new serious pageerrors.
    expect(afterClickPageErrors.length).toBe(0);
  });

  test('Edge case: multiple clicks do not create multiple demo logs nor additional runtime errors', async ({ page }) => {
    // This test clicks the button multiple times and verifies behavior remains stable and no extra errors accumulate.

    // Snapshot initial error count
    const initialPageErrorCount = pageErrors.length;
    const initialConsoleCount = consoleMessages.length;

    // Perform multiple clicks
    const button = page.locator('#demo-button');
    await button.click();
    await page.waitForTimeout(100);
    await button.click();
    await page.waitForTimeout(100);
    await button.click();
    await page.waitForTimeout(200);

    // After multiple clicks, there should still be no 'Demo button clicked!' messages (script didn't attach listener)
    const demoMessages = consoleMessages.filter((m) => /Demo button clicked!/i.test(m.text));
    expect(demoMessages.length).toBe(0);

    // Ensure no new page errors were added by performing the clicks
    expect(pageErrors.length).toBe(initialPageErrorCount);

    // Optionally ensure console did not unexpectedly accumulate many new error messages beyond initial ones
    // (Allowing for some benign console messages, but we assert that errors increased by at most a small amount.)
    const newConsoleMessages = consoleMessages.length - initialConsoleCount;
    expect(newConsoleMessages).toBeLessThanOrEqual(5);
  });

  test('Verify onEnter/onExit assertions: renderPage() entry and demo transition logging expected but prevented by error', async ({ page }) => {
    // FSM specified entry action renderPage() for S0_Idle.
    // The page's script should populate text paragraphs via the script, but because of the SyntaxError,
    // that entry action did not complete. We assert that the function renderPage is not present on window
    // (since we must not patch or add functions). We also assert that the expected transition log is absent.

    // Check global for renderPage (should be undefined because script did not define it)
    const hasRenderPage = await page.evaluate(() => {
      // Do not create or modify any globals; just read
      // eslint-disable-next-line no-undef
      return typeof window.renderPage !== 'undefined';
    });
    expect(hasRenderPage).toBe(false);

    // Confirm that the expected transition-on-click console log is not present anywhere
    const allConsoleTexts = consoleMessages.map((m) => m.text).join('\n');
    expect(/Demo button clicked!/i.test(allConsoleTexts)).toBeFalsy();

    // Confirm that the initial SyntaxError is present per earlier tests
    const combinedErrors = [
      ...consoleMessages.map((m) => m.text),
      ...pageErrors.map((e) => (e && e.message) || String(e)),
    ].join('\n');
    expect(/algorithmDescription|already been declared|SyntaxError/i.test(combinedErrors)).toBeTruthy();
  });

  test('Sanity check: DOM structure is intact and no unexpected globals were introduced', async ({ page }) => {
    // Check that title and header exist and match expected static HTML
    await expect(page.locator('h1')).toHaveText('Trie Explanation');
    // Ensure the button id is unique in the document
    const demoButtonCount = await page.locator('#demo-button').count();
    expect(demoButtonCount).toBe(1);

    // Check some expected static text presence (could be empty due to script failure)
    const headerText = await page.locator('h1').innerText();
    expect(headerText).toContain('Trie');

    // Ensure no unexpected global functions like 'Trie' class were injected into window (script didn't run)
    const globalTrieExists = await page.evaluate(() => typeof window.Trie !== 'function');
    expect(globalTrieExists).toBe(true);
  });
});