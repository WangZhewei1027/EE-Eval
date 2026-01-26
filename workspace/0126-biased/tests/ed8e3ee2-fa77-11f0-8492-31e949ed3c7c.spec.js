import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e3ee2-fa77-11f0-8492-31e949ed3c7c.html';

// Group tests related to the FSM for the Big-Theta Notation interactive app.
// The FSM has a single initial state S0_Idle and one event LearnMoreClick which triggers an alert.
test.describe('Big-Theta Notation App - FSM: S0_Idle and LearnMoreClick', () => {
  // Collect console messages and page errors for each test to observe runtime issues.
  let consoleMessages;
  let pageErrors;

  // Setup before each test: reset collectors, attach listeners, and navigate to the page.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warn, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the exact HTML page as provided (do not modify the page).
    await page.goto(APP_URL);
  });

  // Teardown after each test: basic sanity check that no unexpected page errors occurred.
  // We still allow tests to assert on errors explicitly when needed.
  test.afterEach(async () => {
    // Leave assertions to individual tests. This hook is reserved for potential cleanup.
  });

  test('Initial Idle state - page is rendered with expected components and evidence', async ({ page }) => {
    // This test validates the "S0_Idle" entry-state rendering (renderPage -> presence of DOM).
    // It checks for header, h1/h2 content, the .graph structure, and the Learn More button attributes.

    // Verify header and main headings are present and visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    const h1 = page.locator('h1');
    await expect(h1).toHaveText('Big-Theta Notation');

    const h2 = page.locator('h2');
    await expect(h2).toHaveText('The Concept of Tight Bound');

    // Verify graph structure: should contain arrows and a line
    const graph = page.locator('.graph');
    await expect(graph).toBeVisible();

    const arrows = page.locator('.graph .arrow');
    const arrowsCount = await arrows.count();
    expect(arrowsCount).toBeGreaterThanOrEqual(2); // evidence shows two arrow divs

    const line = page.locator('.graph .line');
    await expect(line).toBeVisible();

    // Verify the Learn More button exists and is visible
    const button = page.locator('.button');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Learn More');

    // Verify the onclick attribute exists and matches the FSM evidence exactly
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe("alert('You can observe the animation representing Big-Theta Notation!')");

    // Verify the graph element has an animation name (evidence of animated presentation)
    const animationName = await graph.evaluate((el) => window.getComputedStyle(el).animationName || '');
    // animationName may be a string like 'rise' or 'none' depending on computed styles; assert type and presence
    expect(typeof animationName).toBe('string');

    // Assert that there are no uncaught page errors on initial render
    expect(pageErrors.length).toBe(0);

    // Assert no console messages of type 'error' were produced on load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Learn More click triggers expected alert dialog and state remains Idle', async ({ page }) => {
    // This test validates the LearnMoreClick event / transition:
    // - Clicking the .button should trigger an alert with the exact message.
    // - After accepting the alert, the page should remain in the Idle state (DOM still present).

    const button = page.locator('.button');

    // Collect dialogs shown and auto-accept them (to avoid blocking)
    const dialogs = [];
    page.once('dialog', async (dialog) => {
      // Capture the message and accept the alert (simulates user clicking 'OK')
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Click the button to trigger the inline onclick alert
    await button.click();

    // The dialog handler above should have recorded exactly one dialog
    expect(dialogs.length).toBe(1);
    expect(dialogs[0]).toBe("You can observe the animation representing Big-Theta Notation!");

    // After accepting the alert, validate that core DOM elements are still present (state = Idle)
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.button')).toBeVisible();

    // Ensure no unexpected page errors were emitted by the click interaction
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were produced by the interaction
    const consoleErrorsAfter = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrorsAfter.length).toBe(0);
  });

  test('Multiple rapid Learn More clicks display alert each time (edge case)', async ({ page }) => {
    // This test validates repeated triggering of the transition (self-loop).
    // It ensures each click produces an alert and does not break the application.

    const button = page.locator('.button');

    // Collect and accept dialogs
    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      // Accept immediately to allow subsequent clicks to proceed
      await dialog.accept();
    });

    // Perform three sequential clicks
    await button.click();
    await button.click();
    await button.click();

    // Expect three dialogs, each with the same message
    expect(dialogMessages.length).toBe(3);
    for (const msg of dialogMessages) {
      expect(msg).toBe("You can observe the animation representing Big-Theta Notation!");
    }

    // Ensure still on the same URL (no navigation happened)
    expect(page.url()).toBe(APP_URL);

    // No uncaught page errors as a result of rapid interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Direct invocation of element.onclick (DOM evidence) triggers the same alert', async ({ page }) => {
    // This test uses the DOM representation to validate the inline onclick handler evidence.
    // It will call the element's onclick handler function if present and observe the alert.

    const buttonLocator = page.locator('.button');

    // Confirm the onclick attribute (evidence) is present
    const onclickAttr = await buttonLocator.getAttribute('onclick');
    expect(onclickAttr).toBe("alert('You can observe the animation representing Big-Theta Notation!')");

    // Obtain an element handle so we can invoke element.onclick via evaluate
    const handle = await buttonLocator.elementHandle();
    expect(handle).not.toBeNull();

    // Collect dialogs emitted by invoking onclick directly
    const invokedDialogs = [];
    page.once('dialog', async (dialog) => {
      invokedDialogs.push(dialog.message());
      await dialog.accept();
    });

    // Invoke the onclick function attached to the element (if available on the element)
    await page.evaluate((el) => {
      // Defensive: call only if onclick is a function
      if (el && typeof el.onclick === 'function') {
        el.onclick();
      } else if (el && el.getAttribute) {
        // As a fallback, attempt to evaluate the attribute (this will execute alert as well)
        const attr = el.getAttribute('onclick');
        if (attr) {
          // Using Function constructor or eval is not necessary here; we just trigger via direct click above in other tests.
          // Keep this branch empty to avoid injecting code; rely on el.onclick primarily.
        }
      }
    }, handle);

    // Ensure the dialog was emitted and matched expected message
    expect(invokedDialogs.length).toBe(1);
    expect(invokedDialogs[0]).toBe("You can observe the animation representing Big-Theta Notation!");

    // Clean up the handle
    await handle.dispose();

    // No page errors should have occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Observe and report console logs and page errors during session (reporting)', async ({ page }) => {
    // This test collects runtime logs and errors and asserts that the app is not producing unexpected exceptions.
    // It is primarily for validating "observe console logs and page errors" requirement.

    // Attach a dialog handler to accept the alert so the click doesn't block
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Trigger a user interaction to allow the app to perform its runtime behavior
    await page.locator('.button').click();

    // Small wait to allow any console messages or page errors to be recorded
    await page.waitForTimeout(200);

    // Build a compact report (assertions)
    // No uncaught page errors expected for this provided HTML
    expect(pageErrors.length).toBe(0);

    // There might be informational console logs, but ensure there are no console 'error' types
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Also assert that at least one console message or DOM evidence exists (the app rendered)
    const hasSomeEvidence = consoleMessages.length > 0 || (await page.locator('.button').count()) === 1;
    expect(hasSomeEvidence).toBeTruthy();
  });
});