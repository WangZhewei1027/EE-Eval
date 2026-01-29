import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c989ee1-fa78-11f0-857d-d58e82d5de73.html';

// Group tests related to the FSM and visual interaction of the Big-O visualization
test.describe('Big-O Notation Visualization (FSM) - 3c989ee1-fa78-11f0-857d-d58e82d5de73', () => {
  // Capture console messages and page errors for each test so we can assert on them
  test.beforeEach(async ({ page }) => {
    // Arrays on the page fixture scope are created per test by Playwright
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', msg => {
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      page._pageErrors.push(err);
    });
  });

  // Test the initial render (Idle state)
  test('Initial render: page shows Animate Curves button and starts in Idle state', async ({ page }) => {
    // Navigate to the page and ensure DOM is loaded.
    // The page itself schedules a gentle animation on load (500ms delay).
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });

    // Locate the Animate button; evidence for S0_Idle includes this button.
    const animateBtn = page.locator('#animateBtn');
    await expect(animateBtn).toHaveCount(1);

    // Immediately after DOMContentLoaded, before the auto-start animation delay, the button should be enabled
    // and aria-pressed should be "false" (Idle evidence).
    // We allow a short timeout in case the page script runs quickly but generally the initial animation starts at 500ms.
    await expect(animateBtn).toBeVisible();
    const ariaPressed = await animateBtn.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('false');

    // Button should not be disabled in Idle state
    expect(await animateBtn.isEnabled()).toBeTruthy();

    // Check that curve elements exist in the DOM (renderPage entry action evidence)
    const curves = page.locator('.curve');
    await expect(curves).toHaveCount(6);

    // Observe that there are no unexpected page errors at this point
    expect(page._pageErrors.length).toBe(0);
  });

  // Test transition: Idle -> Animating on user click; verify DOM updates reflect animating state
  test('Clicking Animate Curves triggers animation (Idle -> Animating) and returns to Idle after completion', async ({ page }) => {
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    const animateBtn = page.locator('#animateBtn');

    // The page triggers an initial animation on load after 500ms; wait until the button is enabled to ensure
    // we're in Idle before performing our explicit interaction.
    await expect(animateBtn).toBeEnabled({ timeout: 6000 });

    // Click to trigger the animation (FSM: AnimateCurves event)
    await animateBtn.click();

    // Immediately after clicking, the script sets isAnimating = true, disables the button and sets aria-pressed = true.
    // We can't access isAnimating (it's in closure), but we can validate expected DOM effects for S1_Animating.
    await expect(animateBtn).toBeDisabled();
    const pressedDuring = await animateBtn.getAttribute('aria-pressed');
    expect(pressedDuring).toBe('true');

    // Curves should have the 'animate' class applied during animation.
    // At least one curve should show the animation class; confirm presence.
    const animatedCurves = page.locator('.curve.animate');
    await expect(animatedCurves.first()).toBeVisible({ timeout: 1000 });

    // Wait for animation to complete (the implementation removes the 'animate' class after 2200ms).
    // Wait until the button is enabled again to ensure transition back to Idle.
    await expect(animateBtn).toBeEnabled({ timeout: 5000 });

    // After completion, aria-pressed should be reset to false and curves should no longer have the animate class.
    const pressedAfter = await animateBtn.getAttribute('aria-pressed');
    expect(pressedAfter).toBe('false');

    // No curves should have the animate class now
    const animatedCountAfter = await page.locator('.curve.animate').count();
    expect(animatedCountAfter).toBe(0);

    // The script sets style.strokeDashoffset = '0' at the end; verify at least one curve has that style applied
    const oneCurveHasZero = await page.locator('.curve').first().evaluate((el) => el.style.strokeDashoffset === '0');
    expect(oneCurveHasZero).toBeTruthy();

    // Ensure no runtime errors occurred during the interaction
    expect(page._pageErrors.length).toBe(0);
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Attempt to interact with the button while animation is running.
  test('Edge case: button is disabled during animation and further clicks are prevented', async ({ page }) => {
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    const animateBtn = page.locator('#animateBtn');

    // Ensure Idle before interaction
    await expect(animateBtn).toBeEnabled({ timeout: 6000 });

    // Click to start animation
    await animateBtn.click();

    // Immediately after click, it should be disabled. Trying to click again should not have an effect.
    // Playwright's click on a disabled element will throw, so we catch that and assert that the element was indeed disabled.
    await expect(animateBtn).toBeDisabled();

    let secondClickErrored = false;
    try {
      // Intentionally try to click while disabled to confirm it is disabled and that clicks are ignored.
      await animateBtn.click({ timeout: 1000 });
    } catch (err) {
      secondClickErrored = true;
      // Assert the thrown error indicates the element was disabled / not interactable.
      const msg = String(err?.message || '');
      expect(msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('not enabled') || msg.toLowerCase().includes('is not visible')).toBeTruthy();
    }
    expect(secondClickErrored).toBeTruthy();

    // Wait for animation completion and verify we return to Idle
    await expect(animateBtn).toBeEnabled({ timeout: 6000 });
    const pressedAfter = await animateBtn.getAttribute('aria-pressed');
    expect(pressedAfter).toBe('false');

    // Confirm no page runtime errors were produced by the attempted double interaction
    expect(page._pageErrors.length).toBe(0);
  });

  // Test repeated animations: ensure animating -> idle -> animating works repeatedly
  test('Repeated animations: multiple cycles function correctly', async ({ page }) => {
    await page.goto(PAGE_URL, { waitUntil: 'load' });

    const animateBtn = page.locator('#animateBtn');

    // Ensure Idle
    await expect(animateBtn).toBeEnabled({ timeout: 6000 });

    // Run two consecutive animations and ensure both cycles complete properly
    for (let i = 0; i < 2; i++) {
      await animateBtn.click();

      // During animation
      await expect(animateBtn).toBeDisabled();
      const pressedDuring = await animateBtn.getAttribute('aria-pressed');
      expect(pressedDuring).toBe('true');

      // Ensure there is at least one animated curve while animating
      await expect(page.locator('.curve.animate').first()).toBeVisible({ timeout: 1000 });

      // Wait until it finishes
      await expect(animateBtn).toBeEnabled({ timeout: 6000 });
      const pressedAfter = await animateBtn.getAttribute('aria-pressed');
      expect(pressedAfter).toBe('false');

      // Confirm no animate classes remain
      const animatedCountAfter = await page.locator('.curve.animate').count();
      expect(animatedCountAfter).toBe(0);
    }

    // After cycles, assert no page errors and no console errors
    expect(page._pageErrors.length).toBe(0);
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Observe console and runtime errors throughout navigation and interactions.
  // This test summarizes and asserts there were no uncaught runtime errors (ReferenceError/SyntaxError/TypeError).
  test('No uncaught ReferenceError, SyntaxError, or TypeError occurred during page lifecycle and interactions', async ({ page }) => {
    await page.goto(PAGE_URL, { waitUntil: 'load' });
    const animateBtn = page.locator('#animateBtn');

    // Allow any automatic load-time animation to finish
    await expect(animateBtn).toBeEnabled({ timeout: 6000 });

    // Perform one full animation cycle to exercise scripts
    await animateBtn.click();
    await expect(animateBtn).toBeEnabled({ timeout: 6000 });

    // Aggregate page errors and console error messages
    const pageErrors = page._pageErrors || [];
    const consoleErrors = (page._consoleMessages || []).filter(m => m.type === 'error');

    // If any page errors exist, ensure they are not ReferenceError/SyntaxError/TypeError.
    // Preferably there are zero errors; assert that now.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // For clarity in test output, if there had been errors, we would list them (left commented to avoid modifying runtime).
    // But per requirements, we observe them and assert none occurred.
  });
});