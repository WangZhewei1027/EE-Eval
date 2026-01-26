import { test, expect } from '@playwright/test';

test.describe('d838ae01-fa7b-11f0-b314-ad8654ee5de8 — OSI Model interactive examples', () => {
  // URL where the application is served
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d838ae01-fa7b-11f0-b314-ad8654ee5de8.html';

  // Collect runtime errors and console error messages during each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console events and collect any error-level messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          // stringify arguments for easier assertions and debugging
          const args = msg.args ? msg.args.map(a => a.toString()).join(' ') : msg.text();
          consoleErrors.push({ text: msg.text(), args, location: msg.location() });
        }
      } catch (e) {
        // If something goes wrong while collecting console messages, capture it too.
        consoleErrors.push({ text: 'error while collecting console message', error: String(e) });
      }
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test, assert that there were no unexpected runtime errors.
    // We specifically check for common JS runtime error families: ReferenceError, SyntaxError, TypeError.
    // If any such errors occurred during load or interaction they will be reported here and cause test failure.
    const errorTypesSeen = pageErrors.map(e => e && e.name ? e.name : (e && e.constructor && e.constructor.name) || 'UnknownError');

    // Build a descriptive message for debugging if failures occur
    if (consoleErrors.length || pageErrors.length) {
      const details = [
        `Console errors (${consoleErrors.length}):`,
        ...consoleErrors.map((c, i) => `${i + 1}. text=${c.text} args=${c.args} loc=${JSON.stringify(c.location)}`),
        `Page errors (${pageErrors.length}):`,
        ...pageErrors.map((e, i) => `${i + 1}. ${String(e && e.stack ? e.stack : e)}`)
      ].join('\n');
      // Use expect to surface a helpful failure message if any errors exist.
      expect({ consoleErrorsLength: consoleErrors.length, pageErrorsLength: pageErrors.length, errorTypesSeen }).toEqual({
        consoleErrorsLength: 0,
        pageErrorsLength: 0,
        errorTypesSeen: []
      }, { detail: details });
    } else {
      // No errors found; pass silently.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    }
  });

  test('Initial render: S0_Idle and S2_StackHidden (page structure and initial state)', async ({ page }) => {
    // This test verifies the initial page render and the Idle/Hidden stack state.
    // It checks for:
    // - presence of main container (evidence for S0_Idle)
    // - the stack area exists and is initially hidden (evidence for S2_StackHidden)
    // - the toggle button has the expected initial attributes and label
    const container = page.locator('.container[role="main"]');
    await expect(container).toHaveCount(1);

    const showButton = page.locator('#showStack');
    await expect(showButton).toBeVisible();
    await expect(showButton).toHaveAttribute('aria-expanded', 'false');
    await expect(showButton).toHaveText('Show example encapsulation stack');

    const stackArea = page.locator('#stackArea');
    await expect(stackArea).toHaveCount(1);

    // The implementation uses an inline style attribute for display. Confirm it's hidden initially.
    const styleAttr = await stackArea.getAttribute('style');
    expect(styleAttr).toBeTruthy();
    expect(styleAttr).toContain('display:none');

    // Also assert computed style for extra robustness
    const computedDisplay = await stackArea.evaluate(el => getComputedStyle(el).display);
    expect(computedDisplay).toBe('none');
  });

  test('Clicking the toggle button shows the encapsulation stack (S2_StackHidden -> S1_StackVisible)', async ({ page }) => {
    // This test validates the transition from hidden to visible when the button is clicked.
    const showButton = page.locator('#showStack');
    const stackArea = page.locator('#stackArea');

    // Precondition: ensure hidden
    await expect(showButton).toHaveAttribute('aria-expanded', 'false');
    await expect(stackArea.evaluate(el => getComputedStyle(el).display)).resolves.toBe('none');

    // Click the button once to show the stack
    await showButton.click();

    // After click: stack should be visible
    const styleAfter = await stackArea.getAttribute('style');
    expect(styleAfter).toBeTruthy();
    expect(styleAfter).toContain('display:block');

    const computedDisplayAfter = await stackArea.evaluate(el => getComputedStyle(el).display);
    expect(computedDisplayAfter).toBe('block');

    // Button should update aria-expanded and text content
    await expect(showButton).toHaveAttribute('aria-expanded', 'true');
    await expect(showButton).toHaveText('Hide example encapsulation stack');

    // Verify the stack boxes (visual content) are present: expect 5 boxes (Application, Transport, Network, Data Link, Physical)
    const boxes = page.locator('#stackArea .stack .box');
    await expect(boxes).toHaveCount(5);

    // Confirm inner text of first and last box to ensure correct content
    await expect(boxes.nth(0)).toContainText('Application (HTTP)');
    await expect(boxes.nth(4)).toContainText('Physical');
  });

  test('Clicking the toggle button twice hides the stack again (S1_StackVisible -> S2_StackHidden)', async ({ page }) => {
    // This test validates show -> hide transition by performing two clicks.
    const showButton = page.locator('#showStack');
    const stackArea = page.locator('#stackArea');

    // Click to show
    await showButton.click();
    await expect(showButton).toHaveAttribute('aria-expanded', 'true');
    await expect(stackArea.evaluate(el => getComputedStyle(el).display)).resolves.toBe('block');

    // Click again to hide
    await showButton.click();
    await expect(showButton).toHaveAttribute('aria-expanded', 'false');

    // Hidden again: check both attribute and computed style
    const styleAfterHide = await stackArea.getAttribute('style');
    expect(styleAfterHide).toBeTruthy();
    expect(styleAfterHide).toContain('display:none');

    const computedDisplayAfterHide = await stackArea.evaluate(el => getComputedStyle(el).display);
    expect(computedDisplayAfterHide).toBe('none');

    // Button label should be reset to initial text
    await expect(showButton).toHaveText('Show example encapsulation stack');
  });

  test('Repeated toggles keep aria-expanded and display in sync (accessibility check)', async ({ page }) => {
    // Rapidly toggle multiple times and assert the final consistency between aria-expanded and computed style
    const showButton = page.locator('#showStack');
    const stackArea = page.locator('#stackArea');

    // Perform an odd number of toggles (7) - final state should be visible
    const toggles = 7;
    for (let i = 0; i < toggles; i++) {
      await showButton.click();
      // small micro-wait to allow DOM updates (the implementation is synchronous but be tolerant)
      await page.waitForTimeout(10);
    }

    const expectedVisible = (toggles % 2) === 1;
    const ariaExpanded = await showButton.getAttribute('aria-expanded');
    const computedDisplay = await stackArea.evaluate(el => getComputedStyle(el).display);

    if (expectedVisible) {
      expect(ariaExpanded).toBe('true');
      expect(computedDisplay).toBe('block');
    } else {
      expect(ariaExpanded).toBe('false');
      expect(computedDisplay).toBe('none');
    }

    // Toggle once more to flip state and verify again
    await showButton.click();
    const ariaAfter = await showButton.getAttribute('aria-expanded');
    const displayAfter = await stackArea.evaluate(el => getComputedStyle(el).display);
    expect(ariaAfter).toBe(expectedVisible ? 'false' : 'true');
    expect(displayAfter).toBe(expectedVisible ? 'none' : 'block');
  });

  test('Edge case: rapid-fire clicks do not throw and result in a deterministic final state', async ({ page }) => {
    // Simulate very fast, successive clicks to detect any potential race conditions or errors.
    const showButton = page.locator('#showStack');
    const stackArea = page.locator('#stackArea');

    // Click 20 times in quick succession (without awaits between)
    // We use Promise.all on click promises to simulate concurrent rapid UI interactions.
    // Note: Playwright's click returns after the click is dispatched, still it's a fast sequence.
    const clicks = Array.from({ length: 20 }, () => showButton.click());
    await Promise.all(clicks);

    // The final visibility should match parity of number of clicks (20 -> even -> hidden)
    const expectedVisible = (20 % 2) === 1;
    const ariaExpanded = await showButton.getAttribute('aria-expanded');
    const computedDisplay = await stackArea.evaluate(el => getComputedStyle(el).display);

    if (expectedVisible) {
      expect(ariaExpanded).toBe('true');
      expect(computedDisplay).toBe('block');
    } else {
      expect(ariaExpanded).toBe('false');
      expect(computedDisplay).toBe('none');
    }

    // Ensure that no unhandled exceptions happened during these rapid interactions (checked in afterEach listener)
  });

  test('FSM state coverage: explicit checks for S0_Idle, S2_StackHidden, and S1_StackVisible', async ({ page }) => {
    // This test documents explicit assertions tied to the FSM states described in the specification.
    const showButton = page.locator('#showStack');
    const stackArea = page.locator('#stackArea');

    // S0_Idle evidence: .container exists and page rendered
    await expect(page.locator('.container[role="main"]')).toHaveCount(1);

    // S2_StackHidden evidence: stackArea style includes display:none (initial)
    const initialStyle = await stackArea.getAttribute('style');
    expect(initialStyle).toContain('display:none');

    // Transition to S1_StackVisible by clicking once
    await showButton.click();

    // S1_StackVisible evidence: style display:block
    const styleVisible = await stackArea.getAttribute('style');
    expect(styleVisible).toContain('display:block');

    // Transition back to S2_StackHidden by clicking again
    await showButton.click();
    const styleHiddenAgain = await stackArea.getAttribute('style');
    expect(styleHiddenAgain).toContain('display:none');
  });

  test('Verify textual content and explanatory note remain unchanged when toggling', async ({ page }) => {
    // Ensure that toggling does not remove or corrupt the explanatory note or other textual sections.
    const note = page.locator('.note');
    await expect(note).toBeVisible();
    await expect(note).toContainText('Mnemonic: "Please Do Not Throw Sausage Pizza Away"');

    const showButton = page.locator('#showStack');
    // Toggle show/hide a few times
    await showButton.click();
    await showButton.click();
    await showButton.click();

    // The note should still be present and unchanged
    await expect(note).toBeVisible();
    await expect(note).toContainText('Please Do Not Throw Sausage Pizza Away');
  });

  test('Observe console and page error streams for specific JS error types (ReferenceError, SyntaxError, TypeError)', async ({ page }) => {
    // This test intentionally inspects collected runtime errors.
    // The test infrastructure already collects console and page errors in beforeEach/afterEach.
    // Here we simply assert that we did not observe ReferenceError, SyntaxError, or TypeError during navigation/interaction.
    // Note: The afterEach will also fail the test if any errors were found, but this separate check provides a clearer assertion.
    // Trigger a benign interaction to ensure listeners are active
    const showButton = page.locator('#showStack');
    await showButton.click(); // should toggle without throwing

    // Re-evaluate the captured errors
    const hasReferenceError = pageErrors.some(e => (e && e.name === 'ReferenceError') || (String(e).includes('ReferenceError')));
    const hasSyntaxError = pageErrors.some(e => (e && e.name === 'SyntaxError') || (String(e).includes('SyntaxError')));
    const hasTypeError = pageErrors.some(e => (e && e.name === 'TypeError') || (String(e).includes('TypeError')));

    expect(hasReferenceError).toBe(false);
    expect(hasSyntaxError).toBe(false);
    expect(hasTypeError).toBe(false);

    // Also ensure no console.error messages contain these words
    const consoleText = consoleErrors.map(c => (c.text || '') + ' ' + (c.args || '')).join('\n');
    expect(consoleText.includes('ReferenceError')).toBe(false);
    expect(consoleText.includes('SyntaxError')).toBe(false);
    expect(consoleText.includes('TypeError')).toBe(false);
  });
});