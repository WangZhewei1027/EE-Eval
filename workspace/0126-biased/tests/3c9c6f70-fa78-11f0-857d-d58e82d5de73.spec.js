import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9c6f70-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Encryption - The Art of Secrets (interactive cipher)', () => {
  // Arrays to collect runtime issues for assertions
  let pageErrors = [];
  let consoleErrors = [];
  let consoleWarnings = [];
  let consoleInfos = [];

  // Setup before each test: navigate to page and attach listeners to observe page errors and console messages.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleWarnings = [];
    consoleInfos = [];

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // Collect PageErrors (uncaught exceptions)
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    // Capture console messages; classify by type
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleErrors.push(text);
      else if (type === 'warning') consoleWarnings.push(text);
      else consoleInfos.push({ type, text });
    });

    // Load the app and wait for load event to ensure scripts run
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: after each test assert no unexpected errors were collected (we assert zero page errors and zero console errors).
  test.afterEach(async () => {
    // As part of test requirements we observe console and page errors.
    // By default we expect no uncaught page errors or console.error messages.
    expect(pageErrors.length, `Page had uncaught errors: ${pageErrors.join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Console had error messages: ${consoleErrors.join('\n')}`).toBe(0);
  });

  // Page object helper functions
  function selectors() {
    return {
      ring: '.ring',
      textRing: '.text-ring',
      toggleBtn: '#toggleRing',
      core: '.core',
      coreStrong: '.core strong',
    };
  }

  // Test initial state (S0_Rotating)
  test('Initial state should be Rotating (S0_Rotating) with expected DOM elements present', async ({ page }) => {
    // Validate presence of main interactive elements
    const s = selectors();
    await expect(page.locator(s.ring)).toHaveCount(1);
    await expect(page.locator(s.textRing)).toHaveCount(1);
    await expect(page.locator(s.toggleBtn)).toHaveCount(1);
    await expect(page.locator(s.core)).toHaveCount(1);

    // Check button initial text content is "Pause Rotation"
    const btnText = await page.locator(s.toggleBtn).innerText();
    expect(btnText).toBe('Pause Rotation');

    // The ring animation should be running initially.
    // Check the computed style (animationPlayState) - CSS animation defaults to running.
    const computedState = await page.$eval(s.ring, (el) => {
      // Use getComputedStyle to read the runtime animationPlayState
      return window.getComputedStyle(el).animationPlayState;
    });
    expect(computedState).toBe('running');

    // Also the inline style should not have animationPlayState initially (empty string)
    const inlineState = await page.$eval(s.ring, (el) => el.style.animationPlayState || '');
    // Inline may be empty because animation comes from CSS; assert either empty or 'running'
    expect(['', 'running']).toContain(inlineState);

    // Verify the circular text is constructed and has inner spans
    const spanCount = await page.$eval(s.textRing, (el) => el.querySelectorAll('span').length);
    expect(spanCount).toBeGreaterThan(0);

    // Verify the core shows the expected label "SECURE"
    const coreText = await page.locator(s.coreStrong).innerText();
    expect(coreText.trim()).toBe('SECURE');

    // Verify accessibility attributes present
    const containerAria = await page.locator('.circle-container').getAttribute('aria-label');
    expect(containerAria).toBeTruthy();
    const coreAria = await page.locator('.core').getAttribute('aria-label');
    expect(coreAria).toBe('Lock symbolizing encryption');

    // Ensure text-ring is not interactive
    const pointerEvents = await page.$eval(s.textRing, el => window.getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe('none');
  });

  // Test transition: Rotating -> Paused (S0_Rotating to S1_Paused)
  test('Clicking toggle button pauses rotation (transition S0_Rotating -> S1_Paused)', async ({ page }) => {
    const s = selectors();

    // Precondition: initial computed animation state is running
    const beforeComputed = await page.$eval(s.ring, (el) => window.getComputedStyle(el).animationPlayState);
    expect(beforeComputed).toBe('running');

    // Click the toggle button to pause rotation
    await page.click(s.toggleBtn);

    // After clicking, the inline style on the ring should be set to 'paused'
    const inlineAfter = await page.$eval(s.ring, (el) => el.style.animationPlayState);
    expect(inlineAfter).toBe('paused');

    // The computed style should also reflect 'paused'
    const computedAfter = await page.$eval(s.ring, (el) => window.getComputedStyle(el).animationPlayState);
    // Some browsers may report 'paused' when inline is set; assert equals 'paused'
    expect(computedAfter).toBe('paused');

    // Button text should change to "Resume Rotation" as evidence of transition
    const btnTextAfter = await page.locator(s.toggleBtn).innerText();
    expect(btnTextAfter).toBe('Resume Rotation');
  });

  // Test transition: Paused -> Rotating (S1_Paused to S0_Rotating)
  test('Clicking toggle button while paused resumes rotation (transition S1_Paused -> S0_Rotating)', async ({ page }) => {
    const s = selectors();

    // Step 1: Pause first to reach S1_Paused
    await page.click(s.toggleBtn);

    // Verify paused
    const pausedInline = await page.$eval(s.ring, el => el.style.animationPlayState);
    expect(pausedInline).toBe('paused');
    const pausedBtnText = await page.locator(s.toggleBtn).innerText();
    expect(pausedBtnText).toBe('Resume Rotation');

    // Step 2: Click again to resume
    await page.click(s.toggleBtn);

    // After clicking, the inline style should be 'running' as the script sets it
    const resumedInline = await page.$eval(s.ring, el => el.style.animationPlayState);
    expect(resumedInline).toBe('running');

    // Computed style should reflect 'running'
    const resumedComputed = await page.$eval(s.ring, el => window.getComputedStyle(el).animationPlayState);
    expect(resumedComputed).toBe('running');

    // Button text should be back to "Pause Rotation"
    const resumedBtnText = await page.locator(s.toggleBtn).innerText();
    expect(resumedBtnText).toBe('Pause Rotation');
  });

  // Edge case tests: rapid multiple toggles and consistent final state
  test('Rapid toggles maintain consistent final state (odd -> paused, even -> running)', async ({ page }) => {
    const s = selectors();
    // Starting state is running
    // Rapidly click 5 times (odd)
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      await page.click(s.toggleBtn);
      // tiny delay to let event handler run; small but not blocking UI
      await page.waitForTimeout(20);
    }

    // After 5 clicks (odd), expect paused
    const inlineStateAfter = await page.$eval(s.ring, el => el.style.animationPlayState);
    expect(inlineStateAfter).toBe('paused');
    const btnTextAfter = await page.locator(s.toggleBtn).innerText();
    expect(btnTextAfter).toBe('Resume Rotation');

    // Now click once more to make even number of total clicks (6), should resume running
    await page.click(s.toggleBtn);
    const inlineAfterEven = await page.$eval(s.ring, el => el.style.animationPlayState);
    expect(inlineAfterEven).toBe('running');
    const btnTextAfterEven = await page.locator(s.toggleBtn).innerText();
    expect(btnTextAfterEven).toBe('Pause Rotation');
  });

  // Validate that the script-generated circular text has correct properties and that the number of characters is as expected
  test('Text ring is populated with spans and transforms are applied', async ({ page }) => {
    const s = selectors();
    // Count spans
    const spanCount = await page.$eval(s.textRing, (el) => el.querySelectorAll('span').length);
    expect(spanCount).toBeGreaterThan(0);

    // Sample a few spans to ensure transform style is present (rotation/translation)
    const transforms = await page.$$eval(`${s.textRing} span`, (els) => {
      // pick first 5 or fewer
      return Array.from(els).slice(0, 5).map(el => el.style.transform || window.getComputedStyle(el).transform);
    });
    // Every sampled element should have a transform string
    transforms.forEach(t => expect(typeof t === 'string' && t.length > 0).toBeTruthy());
  });

  // Validate accessibility & semantics - aria attributes and hidden text ring
  test('Accessibility checks: aria labels and hidden decorative elements', async ({ page }) => {
    // The circle container should have an aria-label describing the graphic
    const ccAria = await page.locator('.circle-container').getAttribute('aria-label');
    expect(ccAria).toBeTruthy();

    // The text-ring is aria-hidden and not focusable
    const trAriaHidden = await page.locator('.text-ring').getAttribute('aria-hidden');
    expect(trAriaHidden).toBe('true');

    // The core should have an aria-label describing the lock
    const coreAria = await page.locator('.core').getAttribute('aria-label');
    expect(coreAria).toBe('Lock symbolizing encryption');
  });

  // Negative / error scenario: attempting to query a non-existent selector should not throw in tests
  test('Querying a missing element returns null-ish value (graceful handling)', async ({ page }) => {
    // This test ensures that DOM queries handle missing selectors gracefully and we can assert their absence
    const missing = await page.$('.non-existent-selector-abc123');
    expect(missing).toBeNull();
  });

  // Final check: ensure no console errors/warnings of severity error were emitted during a full usage scenario
  test('No runtime errors during typical usage scenario', async ({ page }) => {
    const s = selectors();

    // Do a series of interactions to exercise code paths
    await page.click(s.toggleBtn); // pause
    await page.click(s.toggleBtn); // resume
    await page.click(s.toggleBtn); // pause

    // Small wait to let any asynchronous errors surface (script is synchronous, but be conservative)
    await page.waitForTimeout(100);

    // Assertions for runtime issues are in afterEach hook (pageErrors and consoleErrors)
    // We still assert here that we observed no pageErrors or consoleErrors in collected arrays
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);

    // Optionally ensure we did see informational console messages or warnings (not required)
    // This is not a failure condition; it's informative to keep reasoning about logs
  });
});