import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e1b0210-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Two Pointers Interactive Application (FSM: Idle state)', () => {
  let consoleErrors = [];
  let pageErrors = [];

  // Set up listeners before each test to capture console error messages and page errors.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error' to a list we can assert on.
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions on the page (pageerror).
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
    });

    // Navigate to the page, wait for load so the inline script runs.
    await page.goto(URL, { waitUntil: 'load' });
  });

  // Basic render check: verifies the Idle state's expected static content is present.
  test('renders static content for Idle state (heading and paragraph)', async ({ page }) => {
    // Validate the document title.
    await expect(page).toHaveTitle('Two Pointers');

    // Validate H1 content.
    const h1 = await page.locator('h1');
    await expect(h1).toHaveText('Two Pointers');

    // Validate paragraph content matches the FSM evidence string.
    const paragraph = await page.locator('p');
    await expect(paragraph).toHaveText('This is an example of two pointers: x = 5 and y = 7.');
  });

  // Validate the global JS variables that the page defines exist and have expected values.
  test('exposes global numeric variables x and y with expected values', async ({ page }) => {
    // Read the global variables from the page. This does not modify the page, only reads.
    const globals = await page.evaluate(() => {
      return {
        hasX: typeof window.x !== 'undefined',
        hasY: typeof window.y !== 'undefined',
        xType: typeof window.x,
        yType: typeof window.y,
        xValue: window.x,
        yValue: window.y
      };
    });

    // Assert that x and y exist and are numbers with expected values.
    expect(globals.hasX).toBe(true);
    expect(globals.hasY).toBe(true);
    expect(globals.xType).toBe('number');
    expect(globals.yType).toBe('number');
    expect(globals.xValue).toBe(5);
    expect(globals.yValue).toBe(7);
  });

  // The implementation loops attempt to write into elements with id 'x' and 'y' but none exist.
  // Verify there are no elements with those IDs and that the script therefore could not update them.
  test('does not create DOM elements with id "x" or "y" (script loops did not produce DOM updates)', async ({ page }) => {
    const xElem = await page.$('#x');
    const yElem = await page.$('#y');

    // Expect null because the HTML doesn't include elements with these IDs and the script's loops never executed to create them.
    expect(xElem).toBeNull();
    expect(yElem).toBeNull();
  });

  // Verify there are no interactive elements (buttons, inputs, links) as FSM extraction said none were found.
  test('contains no interactive controls (no buttons, inputs, selects, or anchors)', async ({ page }) => {
    const controlsCount = await page.evaluate(() => {
      return document.querySelectorAll('button,input,select,textarea,a[href]').length;
    });

    // Expect zero interactive controls based on the HTML provided.
    expect(controlsCount).toBe(0);
  });

  // Assert that the declared FSM entry action renderPage() is not present on the page.
  test('entry action renderPage() is not defined on the window (onEnter not present)', async ({ page }) => {
    const renderPageType = await page.evaluate(() => {
      return typeof window.renderPage;
    });

    // The FSM lists renderPage() as an entry action, but the implementation does not define it.
    expect(renderPageType).toBe('undefined');
  });

  // Ensure there were no runtime errors emitted to the console or as uncaught exceptions.
  // This validates that the page, despite having logic mistakes (like treating numbers as arrays),
  // did not throw during load in the current environment.
  test('no runtime console errors or uncaught page errors occurred during load', async () => {
    // Assert that no console errors were captured.
    expect(consoleErrors.length).toBe(0);

    // Assert that no uncaught page errors occurred.
    expect(pageErrors.length).toBe(0);
  });

  // Edge-case test: confirm the inline script's loops did not run (loop bounds were invalid),
  // which is inferred by verifying that no DOM updates for x/y occurred and no exceptions were thrown.
  test('script loops that reference result.x.length/result.y.length did not run and threw no exceptions', async ({ page }) => {
    // Re-check that there's still no element with id 'x' or 'y'.
    expect(await page.$('#x')).toBeNull();
    expect(await page.$('#y')).toBeNull();

    // Confirm still no console or page errors.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Additional sanity: verify the page contains only the two expected top-level elements (h1 and p)
  // and nothing else that would indicate dynamic rendering occurred.
  test('DOM has only the expected static content nodes at body level (h1 and p)', async ({ page }) => {
    const bodyChildren = await page.evaluate(() => {
      return Array.from(document.body.children).map(el => el.tagName.toLowerCase());
    });

    // Body had: h1, p, and the script tag. We're only checking for visible content elements h1 and p presence.
    expect(bodyChildren).toContain('h1');
    expect(bodyChildren).toContain('p');
  });
});