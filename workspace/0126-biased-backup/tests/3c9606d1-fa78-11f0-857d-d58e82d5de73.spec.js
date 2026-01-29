import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9606d1-fa78-11f0-857d-d58e82d5de73.html';

// Page Object Model for the application under test
class SetVisualApp {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Returns locator for the theme toggle button
  toggleButton() {
    return this.page.locator('#toggleTheme');
  }

  // Click the toggle button
  async clickToggle() {
    await this.toggleButton().click();
  }

  // Get button text trimmed
  async getButtonText() {
    const text = await this.toggleButton().innerText();
    return text.trim();
  }

  // Get aria-pressed attribute value (as string)
  async getButtonAriaPressed() {
    return await this.toggleButton().getAttribute('aria-pressed');
  }

  // Returns whether body has altmode class
  async isAltMode() {
    return await this.page.evaluate(() => document.body.classList.contains('altmode'));
  }

  // Query circles and return their aria-labels and visible text
  async getCirclesInfo() {
    return await this.page.$$eval('.circle', (nodes) =>
      nodes.map((n) => {
        const label = n.getAttribute('aria-label');
        const textNode = n.querySelector('.circle-text');
        const text = textNode ? textNode.textContent.trim() : null;
        const hasIntersection = !!n.querySelector('.intersection');
        return { label, text, hasIntersection };
      })
    );
  }

  // Check that intersection element exists somewhere
  async intersectionExists() {
    return await this.page.$('.intersection') !== null;
  }

  // Return whether a global function by name is defined on window
  async isGlobalFunctionDefined(fnName) {
    return await this.page.evaluate((name) => typeof window[name] === 'function', fnName);
  }
}

test.describe('SET Visual Application - FSM state & transitions tests', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events
    page.on('console', (msg) => {
      // capture console messages including their type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen for uncaught page errors
    page.on('pageerror', (err) => {
      // capture Error objects thrown in the page
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // If there were uncaught errors, make them available as test diagnostics
    if (pageErrors.length > 0) {
      // Log the errors to the Playwright test output for debugging
      // (We don't prevent tests from making assertions about them below.)
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors);
    }
    // also log console messages for debugging in case a failure occurs
    if (consoleMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.debug('Captured console messages:', consoleMessages);
    }
    // ensure navigation is finished before leaving the test
    await page.waitForTimeout(10);
  });

  test('Initial Idle state: elements render and initial attributes match FSM evidence', async ({ page }) => {
    // This test validates the S0_Idle state per FSM:
    // - The page renders the toggle button with initial aria-pressed=false and expected label text.
    // - The set circles are present with correct aria-labels and texts.
    const app = new SetVisualApp(page);
    await app.goto();

    // Verify no runtime page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Toggle button initial state
    const btn = app.toggleButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('id', 'toggleTheme');
    await expect(btn).toHaveAttribute('class', 'btn-toggle');
    // aria-pressed should be the string "false" as sample HTML sets it to "false"
    await expect(btn).toHaveAttribute('aria-pressed', 'false');

    // Initial button text should match FSM component: "Change Color Scheme"
    const initialText = await app.getButtonText();
    expect(initialText).toBe('Change Color Scheme');

    // Verify presence of three circle elements and their labels/texts
    const circles = await app.getCirclesInfo();
    // Expecting 3 circle elements
    expect(circles.length).toBeGreaterThanOrEqual(3);

    // Extract aria-labels to assert presence of Set A, B, C
    const labels = circles.map((c) => c.label);
    expect(labels).toContain('Set A - Elements 1 to 5');
    expect(labels).toContain('Set B - Elements 4 to 8');
    expect(labels).toContain('Set C - Elements 7 to 10');

    // Ensure circle-texts are present and correspond
    const texts = circles.map((c) => c.text);
    expect(texts).toContain('Set A');
    expect(texts).toContain('Set B');
    expect(texts).toContain('Set C');

    // Intersection element exists inside Set B (per markup)
    const hasIntersection = await app.intersectionExists();
    expect(hasIntersection).toBe(true);

    // Confirm no global errors surfaced in console as page loaded
    const severeConsole = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    // The page CSS imports or external links might log warnings, but we assert no runtime exceptions (pageerrors)
    expect(pageErrors.length).toBe(0);
    // It's acceptable for console warnings to exist; ensure there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleTheme transition: Idle -> Alternate Mode and back (click interactions)', async ({ page }) => {
    // This test validates the ToggleTheme event in FSM and both transitions:
    // - Clicking the toggle button toggles body.altmode
    // - Button aria-pressed and text update accordingly
    const app = new SetVisualApp(page);
    await app.goto();

    // Initial assertions (guard)
    expect(await app.isAltMode()).toBe(false);
    expect(await app.getButtonText()).toBe('Change Color Scheme');
    expect(await app.getButtonAriaPressed()).toBe('false');

    // Click once: should enter Alternate Mode (S1_AltMode)
    await app.clickToggle();

    // After click: body should have altmode class
    expect(await app.isAltMode()).toBe(true);

    // Button should reflect pressed state and updated text
    // aria-pressed was set to boolean in script; when read as attribute it becomes "true"
    expect(await app.getButtonAriaPressed()).toBe('true');
    expect(await app.getButtonText()).toBe('Restore Original Colors');

    // Click again: should exit Alternate Mode and return to Idle (S0_Idle)
    await app.clickToggle();

    // After second click: body should NOT have altmode class
    expect(await app.isAltMode()).toBe(false);

    // Button should reflect unpressed state and original text
    expect(await app.getButtonAriaPressed()).toBe('false');
    expect(await app.getButtonText()).toBe('Change Color Scheme');

    // Confirm no uncaught page errors happened during interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard accessibility: toggle button responds to Enter and Space keys', async ({ page }) => {
    // This test checks keyboard activation of the button (accessibility)
    const app = new SetVisualApp(page);
    await app.goto();

    const btnLocator = app.toggleButton();
    await btnLocator.focus();

    // Activate via Enter
    await page.keyboard.press('Enter');
    expect(await app.isAltMode()).toBe(true);
    expect(await app.getButtonAriaPressed()).toBe('true');

    // Activate via Space to toggle back
    await page.keyboard.press('Space');
    // Space causes a click event as well for a button
    expect(await app.isAltMode()).toBe(false);
    expect(await app.getButtonAriaPressed()).toBe('false');

    // Ensure no runtime exceptions occurred while using keyboard
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid repeated toggles remain consistent (idempotence & stability)', async ({ page }) => {
    // This test simulates rapid user clicks and validates that DOM and attributes remain consistent
    const app = new SetVisualApp(page);
    await app.goto();

    const toggles = 7; // odd number will end up with altmode true
    for (let i = 0; i < toggles; i++) {
      await app.clickToggle();
    }

    const expectedAlt = toggles % 2 === 1;
    expect(await app.isAltMode()).toBe(expectedAlt);
    expect(await app.getButtonAriaPressed()).toBe(expectedAlt ? 'true' : 'false');
    expect(await app.getButtonText()).toBe(expectedAlt ? 'Restore Original Colors' : 'Change Color Scheme');

    // Verify circles and intersection remain in DOM and unchanged
    const circles = await app.getCirclesInfo();
    expect(circles.length).toBeGreaterThanOrEqual(3);
    expect(circles.some((c) => c.hasIntersection)).toBe(true);

    // Ensure no uncaught page errors happened during rapid interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Verify FSM onEnter/onExit referenced functions are not present in page (expected implementation differences)', async ({ page }) => {
    // FSM referenced entry_actions like renderPage() and applyAltModeStyles() in extracted FSM,
    // but the provided implementation does not define these functions.
    // This test verifies their absence rather than attempting to call them,
    // because per instructions we must not modify or patch the runtime environment.
    const app = new SetVisualApp(page);
    await app.goto();

    // Check presence/absence of functions on window
    const renderPageDefined = await app.isGlobalFunctionDefined('renderPage');
    const applyAltDefined = await app.isGlobalFunctionDefined('applyAltModeStyles');

    // Assert they are not defined (the implementation doesn't provide them)
    expect(renderPageDefined).toBe(false);
    expect(applyAltDefined).toBe(false);

    // Confirm that there were no thrown page errors simply by checking these (typeof checks do not throw)
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: ensure referencing a missing selector returns null and does not throw', async ({ page }) => {
    // This test attempts to query a non-existent element (edge case).
    // Per instructions we will not attempt to call or patch anything; just verify the result is null.
    const app = new SetVisualApp(page);
    await app.goto();

    // Query a selector that does not exist
    const nonExistent = await page.$('#thisSelectorDoesNotExist');
    expect(nonExistent).toBeNull();

    // Make sure no page errors occurred as a result of querying a missing element
    expect(pageErrors.length).toBe(0);
  });

  test('Console and pageerror observations: capture messages and assert no uncaught exceptions', async ({ page }) => {
    // This test explicitly demonstrates that we observe console messages and page errors.
    // It asserts that there are no uncaught exceptions (pageerror) for the provided valid implementation.
    const app = new SetVisualApp(page);
    await app.goto();

    // Small sanity interactions to produce any additional console output
    await app.toggleButton().hover();
    await app.toggleButton().click();
    await app.toggleButton().click(); // toggle back

    // At this point, we collect and assert
    // There should be no uncaught exceptions thrown in the page's JS runtime
    expect(pageErrors.length).toBe(0);

    // Console messages may include informational logs, but we assert no console.error entries
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // If any console warnings exist, we still allow them but surface them in test output for debugging
    const consoleWarnings = consoleMessages.filter((m) => m.type === 'warning');
    // This assertion is permissive; there may or may not be warnings depending on environment,
    // so we just ensure we can read them without errors.
    expect(Array.isArray(consoleWarnings)).toBe(true);
  });
});