import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9013a0-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Dynamic Typing Showcase (ed9013a0-fa77-11f0-8492-31e949ed3c7c) - FSM validation', () => {
  // Arrays to collect runtime console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for later inspection (used to observe attribute changes from the page)
    page.on('console', (msg) => {
      try {
        // flatten args to string
        const text = msg.args().length ? msg.text() : msg.text();
        consoleMessages.push(text);
      } catch {
        consoleMessages.push(msg.text());
      }
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Small safety wait to ensure any async logs are captured before tear down
    await page.waitForTimeout(50);
    // No explicit teardown beyond Playwright's fixtures
  });

  test('S0_Idle: Page loads into Idle state and renders dynamic text (entry evidence)', async ({ page }) => {
    // This test validates the Idle state S0_Idle as described in the FSM:
    // - The dynamic-text element is rendered with the expected content.
    // - Initial computed animation includes the typing animation (from CSS).
    // - No unexpected page errors occurred during page load.
    // - The FSM mentions renderPage() as an entry action; verify whether such a function exists (it should not be defined in the page).
    const dynamicText = page.locator('.dynamic-text');
    const replayButton = page.locator('button[onclick="triggerAnimation()"]');

    // Element presence and content
    await expect(dynamicText).toBeVisible();
    await expect(dynamicText).toHaveText('Dynamic Typing in Action!');

    // The replay button should exist and be visible
    await expect(replayButton).toBeVisible();
    await expect(replayButton).toHaveText('Replay Animation');

    // Check computed style: animation-name should contain 'typing' (or both 'typing' and 'blink')
    const animationName = await page.evaluate(() => {
      const el = document.querySelector('.dynamic-text');
      return window.getComputedStyle(el).animationName;
    });
    // animationName might be 'typing, blink' or similar; assert the typing part exists
    expect(animationName).toBeTruthy();
    expect(animationName.toLowerCase()).toContain('typing');

    // Verify that the page did not emit any uncaught page errors on load
    expect(pageErrors.length, `Expected no page errors on load, got: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);

    // FSM mentioned an onEnter action renderPage(); ensure it is not present on window (we do NOT call it).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // The function that the button uses should exist: triggerAnimation
    const hasTriggerAnimation = await page.evaluate(() => typeof window.triggerAnimation === 'function');
    expect(hasTriggerAnimation).toBe(true);
  });

  test('S1_Animating: Clicking "Replay Animation" triggers animation reset (observe style changes)', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Animating via the ReplayAnimation event:
    // - Observe style changes applied by triggerAnimation(): inline style.animation toggles to 'none' and back to ''.
    // - Ensure the animation restarts (computed animation still contains 'typing').
    // - Ensure no uncaught exceptions occur during triggering.
    const dynamicTextSelector = '.dynamic-text';
    const replayButton = page.locator('button[onclick="triggerAnimation()"]');

    await expect(replayButton).toBeVisible();

    // Install a MutationObserver in-page that logs style.animation changes to the console with a marker.
    // We purposefully do not create global variables; the observer uses a closure-local variable and console.log to surface observations.
    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!el) return;
      // Observe attribute changes on the element and log the inline style.animation property on each change.
      const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === 'style') {
            // Log with a prefix so the test harness can filter these logs.
            // Example console message: "ANIM_OBS: none" or "ANIM_OBS: " (empty)
            console.log('ANIM_OBS:' + el.style.animation);
          }
        }
      });
      mo.observe(el, { attributes: true, attributeFilter: ['style'] });
      // Also log the initial inline style state for baseline
      console.log('ANIM_OBS_INIT:' + el.style.animation);
      // Note: we intentionally do not store the observer on window to avoid polluting globals.
    }, dynamicTextSelector);

    // Clear any previous console messages captured during setup to focus on events caused by click
    consoleMessages = [];

    // Click the button to trigger the animation replay
    await replayButton.click();

    // Wait a short while to give mutation observer a chance to emit console logs (this is synchronous in the page but logs can flush slightly delayed)
    await page.waitForTimeout(100);

    // Collect observed animation logs from consoleMessages
    const observedAnimLogs = consoleMessages.filter(msg => typeof msg === 'string' && (msg.startsWith('ANIM_OBS:') || msg.startsWith('ANIM_OBS_INIT:')));

    // We expect at least the initial inline style log and one or more subsequent style updates.
    expect(observedAnimLogs.length).toBeGreaterThanOrEqual(1);

    // There should be at least one observation where the inline style was set to 'none' as done by triggerAnimation()
    const sawNone = observedAnimLogs.some(m => m.includes('ANIM_OBS:') && m.toLowerCase().includes('none'));
    expect(sawNone, `Expected to observe style.animation set to 'none' in logs, got: ${observedAnimLogs.join('; ')}`).toBe(true);

    // After the function completes, the inline style.animation is set back to '' (empty string).
    // Verify the final inline style on the element is the empty string (meaning the CSS rule controls the animation again).
    const finalInlineAnimation = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      return el ? el.style.animation : null;
    }, dynamicTextSelector);
    expect(finalInlineAnimation === '' || finalInlineAnimation === null || finalInlineAnimation === undefined).toBeTruthy();

    // Ensure the computed animation still includes the typing animation after replay (animation restarted)
    const computedAnimationNameAfter = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      return el ? window.getComputedStyle(el).animationName : '';
    }, dynamicTextSelector);
    expect(computedAnimationNameAfter.toLowerCase()).toContain('typing');

    // No uncaught page errors should have occurred during the replay
    expect(pageErrors.length, `Expected no page errors during replay, got: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);
  });

  test('Edge cases: Rapid and repeated clicks do not produce errors and preserve DOM content', async ({ page }) => {
    // This test checks robustness of the ReplayAnimation action (S1_Animating & transition back to S0_Idle):
    // - Rapid multiple clicks (simulating user spam) should not throw uncaught exceptions.
    // - The text content and class remain stable.
    const dynamicText = page.locator('.dynamic-text');
    const replayButton = page.locator('button[onclick="triggerAnimation()"]');

    await expect(dynamicText).toBeVisible();
    await expect(replayButton).toBeVisible();

    // Capture baseline text
    const baselineText = await dynamicText.textContent();

    // Perform rapid clicks
    for (let i = 0; i < 6; i++) {
      await replayButton.click();
      // small delay to mimic a fast user but allow internal processing
      await page.waitForTimeout(30);
    }

    // Allow any async page logs/errors to surface
    await page.waitForTimeout(100);

    // Ensure no uncaught page errors occurred
    expect(pageErrors.length, `Expected no page errors after rapid clicks, got: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);

    // Ensure the dynamic text content is unchanged
    const finalText = await dynamicText.textContent();
    expect(finalText).toBe(baselineText);

    // Ensure the element still has the dynamic-text class
    const hasClass = await page.evaluate(() => {
      const el = document.querySelector('.dynamic-text');
      return el ? el.classList.contains('dynamic-text') : false;
    });
    expect(hasClass).toBe(true);
  });

  test('FSM transition roundtrip: clicking while animation is in-progress resets and replays (no errors)', async ({ page }) => {
    // This test simulates initiating the animation replay while it is already animating,
    // verifying no unhandled exceptions and that the computed animation restarts.
    const dynamicTextSelector = '.dynamic-text';
    const replayButton = page.locator('button[onclick="triggerAnimation()"]');

    // Ensure visible
    await expect(replayButton).toBeVisible();

    // Prepare to collect console observations for this test (mutation observer again)
    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!el) return;
      const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === 'style') {
            console.log('RT_ANIM_OBS:' + el.style.animation);
          }
        }
      });
      mo.observe(el, { attributes: true, attributeFilter: ['style'] });
    }, dynamicTextSelector);

    // Clear captured console messages before interaction
    consoleMessages = [];

    // Click once, then click again immediately to simulate a replay while animating
    await replayButton.click();
    await replayButton.click();

    // Give the page time to process and emit logs
    await page.waitForTimeout(150);

    // Ensure at least one observation occurred
    const rtLogs = consoleMessages.filter(m => typeof m === 'string' && m.startsWith('RT_ANIM_OBS:'));
    expect(rtLogs.length).toBeGreaterThanOrEqual(1);

    // Ensure none of the page interactions produced uncaught exceptions
    expect(pageErrors.length, `Expected no page errors during roundtrip replay, got: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);

    // Verify computed animation still contains typing after the roundtrip replays
    const computedName = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      return el ? window.getComputedStyle(el).animationName : '';
    }, dynamicTextSelector);
    expect(computedName.toLowerCase()).toContain('typing');
  });
});