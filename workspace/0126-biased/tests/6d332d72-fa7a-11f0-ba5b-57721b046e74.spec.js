import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d332d72-fa5b-57721b046e74.html';

test.describe('Application: Backpropagation (FSM: S0_Idle)', () => {
  // Collections to capture console messages and page errors that occur during navigation
  let consoleMessages;
  let pageErrors;
  let initialDOMSnapshot;

  // Setup: navigate to the page and attach listeners before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (log, error, warn, etc.)
    page.on('console', (msg) => {
      // Record level and text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object; store its message and name
      pageErrors.push({ name: err.name, message: err.message });
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give short time to allow inline scripts / errors to surface
    await page.waitForTimeout(200);

    // Snapshot the initial DOM (outerHTML) to allow comparison after interactions
    initialDOMSnapshot = await page.evaluate(() => document.documentElement.outerHTML);
  });

  test.afterEach(async ({ page }) => {
    // Allow any late errors to surface before finishing test
    await page.waitForTimeout(50);
    // Remove listeners by closing the page fixture in Playwright automatically handled.
    // No explicit teardown needed beyond this in the test context.
  });

  test('State S0_Idle: page renders and document title matches FSM evidence', async ({ page }) => {
    // This test validates the FSM evidence that the initial state renders a page titled "Backpropagation"

    // 1) Verify the document has the expected title evidence
    const title = await page.title();
    expect(title).toBe('Backpropagation');

    // 2) Verify that the page has some HTML content (not empty)
    const html = await page.content();
    expect(html.length).toBeGreaterThan(0);

    // 3) Assert that the initial DOM snapshot contains a <title> tag with the expected text as extra safeguard
    expect(initialDOMSnapshot).toContain('<title>Backpropagation</title>');
  });

  test('Entry action renderPage() should run (natural errors allowed) and be observable via page errors/console', async ({ page }) => {
    // The FSM declared an entry action: renderPage()
    // The implementation may or may not define renderPage(); we must observe console/page errors and assert they occur naturally.
    // This test asserts that the runtime reported at least one error related to missing functions or script problems,
    // and specifically checks for common patterns like ReferenceError or messages mentioning "renderPage".

    // Wait briefly to ensure collected errors reflect initial execution
    await page.waitForTimeout(100);

    // We expect at least one page error or console error/warning in this particular app (per the instructions).
    // Collect human-readable summaries from both sources
    const consoleTexts = consoleMessages.map((c) => `[${c.type}] ${c.text}`).join('\n');
    const pageErrorTexts = pageErrors.map((e) => `[${e.name}] ${e.message}`).join('\n');

    // Debugging aid: if assertions fail, include captured messages in the failure output by using expect with a condition.
    // Assert that there was at least one page error or at least one console error/warning
    const hasPageErrors = pageErrors.length > 0;
    const hasConsoleErrors = consoleMessages.some((m) => m.type === 'error' || m.type === 'warning');

    // At least one of these should be true for this application as per instructions (we assert that natural runtime errors occurred).
    expect(hasPageErrors || hasConsoleErrors).toBeTruthy();

    // If a page error exists, assert it is one of the expected error types commonly produced when functions are missing:
    if (hasPageErrors) {
      const names = pageErrors.map((e) => e.name);
      // Expect at least one ReferenceError, TypeError, or SyntaxError to have been thrown
      const matchesExpected = names.some((n) => n === 'ReferenceError' || n === 'TypeError' || n === 'SyntaxError');
      expect(matchesExpected).toBeTruthy();
    }

    // Additionally, check if any console or page error mentions "renderPage" which is the entry action from FSM
    const mentionsRenderPage =
      consoleMessages.some((m) => m.text.includes('renderPage')) ||
      pageErrors.some((e) => e.message.includes('renderPage'));

    // The implementation's entry action may attempt to call renderPage() and cause a ReferenceError; assert that this occurred naturally.
    // If it did not, the previous assertions already ensure there was some kind of error.
    expect(mentionsRenderPage || hasPageErrors).toBeTruthy();
  });

  test('Page contains no interactive elements (buttons, inputs, anchors) as reported by FSM extraction summary', async ({ page }) => {
    // The FSM notes that no interactive elements were found. Validate DOM queries to confirm this observation.

    const buttonCount = await page.$$eval('button', (els) => els.length);
    const inputCount = await page.$$eval('input', (els) => els.length);
    const linkCount = await page.$$eval('a', (els) => els.length);
    const formCount = await page.$$eval('form', (els) => els.length);
    const clickableCount = await page.$$eval('[role="button"]', (els) => els.length);

    // All these should be zero or very small as per extraction notes. We assert zero for strictness.
    expect(buttonCount).toBe(0);
    expect(inputCount).toBe(0);
    expect(linkCount).toBe(0);
    expect(formCount).toBe(0);
    expect(clickableCount).toBe(0);
  });

  test('Clicking and interacting should not change the DOM or create transitions (no interactive FSM transitions)', async ({ page }) => {
    // The FSM contains no transitions. Interacting with the page should not cause expected FSM transitions or major DOM changes.
    // This test clicks on the body and verifies the DOM remains substantially unchanged and no new errors are introduced.

    // Record errors count before interaction
    const errorsBefore = pageErrors.length;
    const consoleErrorsBefore = consoleMessages.filter((m) => m.type === 'error').length;

    // Perform interactions: click at viewport center and press keyboard keys
    await page.mouse.click(100, 100).catch(() => {});
    await page.keyboard.press('Tab').catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});

    // Allow any possible handlers/errors to run
    await page.waitForTimeout(200);

    // Record errors after interaction
    const errorsAfter = pageErrors.length;
    const consoleErrorsAfter = consoleMessages.filter((m) => m.type === 'error').length;

    // DOM snapshot after interactions
    const afterDOMSnapshot = await page.evaluate(() => document.documentElement.outerHTML);

    // Assert that the outerHTML remains exactly the same (no dynamic interactive changes expected)
    expect(afterDOMSnapshot).toBe(initialDOMSnapshot);

    // Assert that interactions did not introduce additional page errors beyond what initially happened
    expect(errorsAfter).toBeLessThanOrEqual(errorsBefore + 1); // allow one unexpected error at most, but generally shouldn't grow
    expect(consoleErrorsAfter).toBeLessThanOrEqual(consoleErrorsBefore + 1);
  });

  test('Edge case: reloading the page should re-trigger entry actions and surface the same kinds of console/page errors', async ({ page }) => {
    // Reload the page and observe that entry actions (if present) are invoked again and errors reappear naturally.
    // This validates robustness across reloads.

    // Clear previously collected errors/messages
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Reload and wait for load
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(200);

    // After reload, we expect at least one console or page error to be observed per the application's behavior
    const hasPageErrorsAfterReload = pageErrors.length > 0;
    const hasConsoleErrorsAfterReload = consoleMessages.some((m) => m.type === 'error' || m.type === 'warning');

    expect(hasPageErrorsAfterReload || hasConsoleErrorsAfterReload).toBeTruthy();

    // If errors exist, ensure they are of expected types or mention the entry action name
    if (hasPageErrorsAfterReload) {
      const matchesExpected = pageErrors.some(
        (e) =>
          e.name === 'ReferenceError' ||
          e.name === 'TypeError' ||
          e.name === 'SyntaxError' ||
          e.message.includes('renderPage')
      );
      expect(matchesExpected).toBeTruthy();
    }
  });

  test('Diagnostics: output captured console and page errors for visibility (assert non-empty output structures)', async ({ page }) => {
    // This test simply asserts that our diagnostic capture arrays are valid and contain structured data.
    // It helps ensure that earlier assertions referencing these arrays are not operating on undefined values.

    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // At minimum, the arrays should be defined; they may be empty if no errors were thrown,
    // but per the environment this test suite assumes there should be runtime messages/errors.
    // To avoid a brittle failure here, we only assert that the arrays exist and elements (if any) have the expected fields.
    for (const cm of consoleMessages) {
      expect(cm).toHaveProperty('type');
      expect(cm).toHaveProperty('text');
    }
    for (const pe of pageErrors) {
      expect(pe).toHaveProperty('name');
      expect(pe).toHaveProperty('message');
    }
  });
});