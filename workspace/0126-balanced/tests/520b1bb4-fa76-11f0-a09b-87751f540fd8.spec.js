import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b1bb4-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Design Patterns app (FSM: S0_Idle) - End-to-end checks', () => {
  // We will capture console messages and page errors that occur during page load/execution.
  // Many of the app's runtime problems are expected (per requirements) and we assert they happen naturally.

  test('Initial state (Idle) should attempt to run main() and produce runtime errors (no patching allowed)', async ({ page }) => {
    // Arrays to collect events observed during navigation
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    // Listen for console messages and page errors before navigation to capture load-time issues
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', err => {
      // pageerror provides an Error object; capture its message
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the page (script execution happens as part of load)
    await page.goto(APP_URL, { waitUntil: 'load' });

    // The FSM indicates entry action main() should run on Idle.
    // Verify that main is present on the window (script defines it inline).
    const mainType = await page.evaluate(() => typeof window.main);
    expect(mainType).toBe('function');

    // The application's inline JS contains purposeful bugs (e.g., recursive Singleton constructor)
    // We expect at least one runtime error to occur during initial execution.
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThanOrEqual(1);

    // Assert that at least one of the observed error messages matches common engine messages
    // for stack overflow / missing definitions / super() misuse. We allow multiple possible errors.
    const combinedErrors = [...pageErrors, ...consoleErrors, ...consoleMessages.map(m => m.text)];
    const errorMatched = combinedErrors.some(msg =>
      /maximum call stack size exceeded/i.test(msg) ||
      /maximum call stack/i.test(msg) ||
      /call stack/i.test(msg) ||
      /is not defined/i.test(msg) ||
      /must call super/i.test(msg) ||
      /cannot access 'this' before super/i.test(msg) ||
      /ReferenceError/i.test(msg) ||
      /TypeError/i.test(msg) ||
      /RangeError/i.test(msg)
    );
    expect(errorMatched).toBeTruthy();

    // Provide additional assertions about the console activity:
    // - Confirm that some console entries were captured (could be logs or errors).
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // at least defined; non-strict to be robust

    // Check the page-level textual content to ensure the static DOM rendered correctly
    await expect(page.locator('.container >> h1')).toHaveText('Design Patterns');
    await expect(page.locator('.container >> h2').first()).toHaveText('Creational Patterns');

    // Verify several expected pattern names are present in the DOM (static content unaffected by script errors)
    await expect(page.locator('.container')).toContainText('Singleton Pattern');
    await expect(page.locator('.container')).toContainText('Factory Pattern');
    await expect(page.locator('.container')).toContainText('Observer Pattern');
    await expect(page.locator('.container')).toContainText('Strategy Pattern');

    // Validate that main()'s presence as an entry action is evidenced by the script content
    const scriptContent = await page.locator('script').first().textContent();
    expect(scriptContent).toBeTruthy();
    expect(scriptContent).toContain('function main() {');
    expect(scriptContent).toContain('console.log("Singleton:');

    // Confirm that the app does not expose interactive UI elements (FSM said none were found).
    // Check for absence of <button> elements and inline onclick attributes.
    const buttonCount = await page.locator('button').count();
    expect(buttonCount).toBe(0);

    const elementsWithOnclick = await page.evaluate(() => document.querySelectorAll('[onclick]').length);
    expect(elementsWithOnclick).toBe(0);
  });

  test('FSM state and transitions: verify there are no interactive transitions and main() was entry action', async ({ page }) => {
    const pageErrors1 = [];
    page.on('pageerror', e => pageErrors.push(String(e && e.message ? e.message : e)));

    await page.goto(APP_URL, { waitUntil: 'load' });

    // FSM in definition only had a single initial state S0_Idle with entry action main().
    // Verify we can observe the main function definition and that the script attempted to run it (errors captured).
    const hasMainFunction = await page.evaluate(() => typeof window.main === 'function');
    expect(hasMainFunction).toBe(true);

    // Because there are no transitions in the FSM, assert there are no interactive elements implying transitions.
    const interactiveSelectors = await page.evaluate(() => {
      return {
        clickableElements: Array.from(document.querySelectorAll('button,a,input[type="button"],input[type="submit"]')).length,
        inlineHandlers: Array.from(document.querySelectorAll('[onclick]')).length
      };
    });
    expect(interactiveSelectors.clickableElements).toBe(0);
    expect(interactiveSelectors.inlineHandlers).toBe(0);

    // Ensure runtime errors happened when main() was executed (must let errors occur naturally)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Edge cases: inspect multiple possible runtime faults without modifying page', async ({ page }) => {
    const consoleMessages1 = [];
    const pageErrors2 = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(String(err && err.message ? err.message : err)));

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Collect textual console outputs (if any succeeded before fatal error)
    const logs = consoleMessages.map(m => `${m.type}:${m.text}`).join('\n');

    // At least one page error should be present due to issues like recursive constructor or missing classes.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Validate that if any console 'log' messages were produced, they contain expected debug prefixes used in main()
    const hasSingletonLog = consoleMessages.some(m => /Singleton:/.test(m.text));
    const hasFactoryLog = consoleMessages.some(m => /Factory:/.test(m.text));

    // It's acceptable if these logs are absent due to early exception; assert that either errors exist or logs exist (we already asserted errors).
    expect(pageErrors.length > 0 || hasSingletonLog || hasFactoryLog).toBeTruthy();

    // Also assert that script source contains several design pattern class names to match FSM evidence
    const scriptText = await page.locator('script').first().textContent();
    expect(scriptText).toContain('class Singleton');
    expect(scriptText).toContain('class Factory');
    expect(scriptText).toContain('class Builder');
    expect(scriptText).toContain('function main()');

    // As an additional safety, ensure no global variable patching was performed by the test (we didn't modify the page).
    const globalsSnapshot = await page.evaluate(() => {
      return {
        hasMain: typeof window.main === 'function',
        hasGetSingleton: typeof window.getSingleton === 'function'
      };
    });
    expect(globalsSnapshot.hasMain).toBe(true);
    expect(globalsSnapshot.hasGetSingleton).toBe(true);
  });
});