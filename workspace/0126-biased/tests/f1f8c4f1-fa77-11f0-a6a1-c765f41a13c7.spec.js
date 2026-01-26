import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f8c4f1-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Refactoring — Visual Demo (FSM validation) - f1f8c4f1-fa77-11f0-a6a1-c765f41a13c7', () => {
  // Shared listeners state
  let consoleErrors;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions later
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a little for scripts registered on load to run (e.g., reset() & load animation registration)
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // nothing to teardown; page fixture is auto-closed by Playwright
  });

  test('Initial state S0_Idle on load: DOM and accessibility attributes reflect Idle (reset() ran)', async ({ page }) => {
    // This test validates onEnter of S0_Idle (reset()) and initial DOM expectations.

    const actionBtn = page.locator('#actionBtn');
    const btnText = page.locator('#btnText');
    const panel = page.locator('#panel');
    const beforePane = page.locator('#beforePane');
    const afterPane = page.locator('#afterPane');
    const beforeLines = page.locator('#beforeCode .line');
    const afterLines = page.locator('#afterCode .line');

    // Assertions for Idle state evidence
    await expect(btnText).toHaveText('Run Refactor');
    await expect(actionBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(panel).not.toHaveClass(/run/); // panel should not have 'run' class
    await expect(beforePane).toHaveAttribute('aria-label', /Before/);
    await expect(afterPane).toHaveAttribute('aria-label', /After/);

    // The implementation renders a fixed number of lines; assert expected counts
    await expect(beforeLines).toHaveCount(8); // beforeLines length in source is 8
    await expect(afterLines).toHaveCount(11); // afterLines length in source is 11

    // After reset() the after pane should be hidden and before visible
    await expect(afterPane).toHaveAttribute('aria-hidden', 'true');
    await expect(beforePane).toHaveAttribute('aria-hidden', 'false');

    // Ensure no uncaught page errors or console errors happened during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Running via click: clicking #actionBtn starts runRefactor()', async ({ page }) => {
    // This test validates the RunRefactor event (click) and S1 entry actions/evidence.

    const actionBtn = page.locator('#actionBtn');
    const btnText = page.locator('#btnText');
    const panel = page.locator('#panel');
    const firstBeforeLine = page.locator('#beforeCode .line').first();

    // Click to start refactor animation
    await actionBtn.click();

    // Immediately the UI should reflect running state evidence
    await expect(btnText).toHaveText('Refactoring…');
    await expect(actionBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(panel).toHaveClass(/run/);

    // Because before lines animate with a stagger, wait for the first to receive 'animate' class
    await page.waitForTimeout(140); // slightly more than the first stagger (0 *120 for first + slight)
    // First before line should have the animate class applied by JS
    await expect(firstBeforeLine).toHaveClass(/animate/);

    // No page errors should have occurred when starting animation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_Running -> S2_Done: animation completes and UI updates to Done', async ({ page }) => {
    // This test validates the "animation complete" transition and S2 evidence.

    const actionBtn = page.locator('#actionBtn');
    const btnText = page.locator('#btnText');
    const panel = page.locator('#panel');
    const beforePane = page.locator('#beforePane');
    const afterPane = page.locator('#afterPane');
    const afterLines = page.locator('#afterCode .line');

    // Trigger animation
    await actionBtn.click();

    // Wait for the final state to be set by the JS timeouts.
    // Calculation (from source): final setTimeout occurs at 1600 + beforeLines.length * 120
    // beforeLines.length = 8 => 1600 + 960 = 2560ms. We wait a little longer to be safe.
    await page.waitForFunction(() => {
      const btn = document.getElementById('btnText');
      return btn && btn.textContent === 'Reset';
    }, { timeout: 5000 });

    // Verify S2 (Done) evidence
    await expect(btnText).toHaveText('Reset');
    await expect(panel).not.toHaveClass(/run/); // panel class removed
    await expect(actionBtn).toHaveAttribute('aria-pressed', 'false');

    // Before pane lines should have been faded out to opacity 0 by the "done" step
    const beforeLineOpacities = await page.$$eval('#beforeCode .line', els => els.map(e => e.style.opacity || window.getComputedStyle(e).opacity));
    // All should be '0' after done
    for (const op of beforeLineOpacities) {
      expect(Number(op)).toBeCloseTo(0, 1);
    }

    // The after pane should be visible
    await expect(afterPane).toHaveAttribute('aria-hidden', 'false');

    // After lines should have animate class applied (they are revealed)
    const anyAfterAnimated = await page.$eval('#afterCode .line', el => el.classList.contains('animate'));
    expect(anyAfterAnimated).toBe(true);

    // No uncaught runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S2_Done -> S0_Idle via click Reset: Reset brings UI back to Idle', async ({ page }) => {
    // This test validates clicking Reset returns to initial S0_Idle state and runs reset().

    const actionBtn = page.locator('#actionBtn');
    const btnText = page.locator('#btnText');
    const panel = page.locator('#panel');
    const beforePane = page.locator('#beforePane');
    const afterPane = page.locator('#afterPane');
    const beforeLines = page.locator('#beforeCode .line');
    const afterLines = page.locator('#afterCode .line');

    // Move to Done first
    await actionBtn.click();
    await page.waitForFunction(() => document.getElementById('btnText').textContent === 'Reset', { timeout: 5000 });

    // Click Reset
    await actionBtn.click();

    // After reset() we expect Idle evidence restored
    await expect(btnText).toHaveText('Run Refactor');
    await expect(actionBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(panel).not.toHaveClass(/run/);

    // Both code panes should be reset: before visible, after hidden
    await expect(beforePane).toHaveAttribute('aria-hidden', 'false');
    await expect(afterPane).toHaveAttribute('aria-hidden', 'true');

    // Lines should be re-rendered and before lines visible again
    await expect(beforeLines).toHaveCount(8);
    const beforeOpacities = await page.$$eval('#beforeCode .line', els => els.map(e => window.getComputedStyle(e).opacity));
    beforeOpacities.forEach(op => expect(Number(op)).toBeGreaterThan(0));

    // After pane lines should be reset to hidden opacity (JS sets opacity 0)
    const afterOpacities = await page.$$eval('#afterCode .line', els => els.map(e => e.style.opacity || window.getComputedStyle(e).opacity));
    for (const op of afterOpacities) {
      expect(Number(op)).toBeCloseTo(0, 1);
    }

    // No page errors introduced by reset
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Keyboard activation: Enter and Space keys trigger the button action (KeyPress event)', async ({ page }) => {
    // This test validates KeyPress event handlers on the button: Enter and Space trigger click.

    const actionBtn = page.locator('#actionBtn');
    const btnText = page.locator('#btnText');

    // Focus the button and press Enter to start
    await actionBtn.focus();
    await page.keyboard.press('Enter');

    // Should go to running then done
    await expect(btnText).toHaveText('Refactoring…', { timeout: 500 });
    await page.waitForFunction(() => document.getElementById('btnText').textContent === 'Reset', { timeout: 5000 });
    await expect(btnText).toHaveText('Reset');

    // Now focus and press Space to trigger reset (Space key maps to ' ')
    await actionBtn.focus();
    // The keydown handler checks for ' ' string. Playwright uses ' ' for space.
    await page.keyboard.press(' ');
    await expect(btnText).toHaveText('Run Refactor', { timeout: 2000 });

    // Ensure no console/page errors from keyboard events
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking while running calls reset() and cancels animation', async ({ page }) => {
    // The app attaches click listener that calls runRefactor() when idle, else reset().
    // If we click quickly twice (start then immediate click), the second click should call reset()
    // and return to Idle. This test validates that timers are cleared and UI returns to Idle.

    const actionBtn = page.locator('#actionBtn');
    const btnText = page.locator('#btnText');
    const panel = page.locator('#panel');

    // Start run
    await actionBtn.click();

    // Immediately click again to trigger reset while state === 'running'
    // Use a very short delay to simulate a fast user double-click
    await page.waitForTimeout(40);
    await actionBtn.click();

    // After the quick second click, we expect the component to be reset to Idle
    // The reset() sets btnText back to 'Run Refactor'
    await expect(btnText).toHaveText('Run Refactor', { timeout: 2000 });

    // Panel should not have the 'run' classname
    await expect(panel).not.toHaveClass(/run/);

    // Wait longer than animation total time to ensure any stray timers would have fired if not cleared
    await page.waitForTimeout(3000);

    // Validate state remains Idle visual evidence
    await expect(btnText).toHaveText('Run Refactor');
    await expect(actionBtn).toHaveAttribute('aria-pressed', 'false');

    // No uncaught errors from this edge-case behavior
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Negative case: unrelated key does not trigger the action (robustness)', async ({ page }) => {
    // Press a random key (e.g., 'a') while button focused and assert it does not trigger the click.
    const actionBtn = page.locator('#actionBtn');
    const btnText = page.locator('#btnText');

    await actionBtn.focus();
    await page.keyboard.press('a');

    // Ensure UI remains Idle
    await expect(btnText).toHaveText('Run Refactor');

    // No errors introduced
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: collect and assert console and page error streams are clean', async ({ page }) => {
    // This test gathers console messages and page errors observed during page lifecycle (from beforeEach).
    // It verifies there were no console.error or uncaught page errors during normal operation.

    // For thoroughness, trigger a full run->done cycle as well to surface potential runtime errors
    const actionBtn = page.locator('#actionBtn');
    await actionBtn.click();
    await page.waitForFunction(() => document.getElementById('btnText').textContent === 'Reset', { timeout: 5000 });

    // Re-check collected errors
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors, but found: ${pageErrors.map(String).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages, but found: ${consoleErrors.join('; ')}`);

    // Optionally assert there were console.log messages (like debug), but not required.
    // We at least assert the consoleMessages array exists and is an array.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});