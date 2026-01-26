import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f73e50-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('NP-Completeness — Visual Primer (f1f73e50-fa77-11f0-a6a1-c765f41a13c7)', () => {

  // Helper to attach console and pageerror listeners and return collectors
  async function attachErrorCollectors(page) {
    const consoleErrors = [];
    const consoleWarnings = [];
    const consoleLogs = [];
    const pageErrors = [];

    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') consoleErrors.push(msg.text());
      else if (type === 'warning') consoleWarnings.push(msg.text());
      else consoleLogs.push({ type, text: msg.text() });
    });

    page.on('pageerror', err => {
      // pageerror is emitted for unhandled exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    return { consoleErrors, consoleWarnings, consoleLogs, pageErrors };
  }

  test.beforeEach(async ({ page }) => {
    // Ensure tests start with a clean viewport
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('Initial state: animations playing and explanation hidden; basic DOM sanity', async ({ page }) => {
    // Attach collectors to observe runtime errors and console output
    const collectors = await attachErrorCollectors(page);

    // Load the page as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Verify the two control buttons exist and have expected initial labels and attributes
    const animateBtn = await page.locator('#animateBtn');
    const explainBtn = await page.locator('#explainBtn');

    await expect(animateBtn).toBeVisible();
    await expect(explainBtn).toBeVisible();

    // Initial animate button text per implementation should be "Pause"
    await expect(animateBtn).toHaveText('Pause');

    // The body should NOT have the 'paused' class in the initial playing state
    const bodyHasPaused = await page.$eval('body', b => b.classList.contains('paused'));
    expect(bodyHasPaused).toBe(false);

    // Initial explain button text should be "Explain"
    await expect(explainBtn).toHaveText('Explain');

    // Body should not have 'show-explain' initially
    const bodyHasShowExplain = await page.$eval('body', b => b.classList.contains('show-explain'));
    expect(bodyHasShowExplain).toBe(false);

    // The explanation div exists and originally has aria-hidden="true" in the HTML implementation
    const explainEl = await page.locator('#explain');
    await expect(explainEl).toBeVisible(); // element exists (may be hidden via CSS)
    const ariaHidden = await explainEl.getAttribute('aria-hidden');
    expect(ariaHidden).toBe('true');

    // The animate and explain buttons should have the expected title attributes
    await expect(animateBtn).toHaveAttribute('title', 'Pause or play the animations');
    await expect(explainBtn).toHaveAttribute('title', 'Reveal concise explanation');

    // Check that the initial inline transform for the first chip is not yet set immediately (entrance rAF runs shortly)
    const firstChipInlineTransform = await page.$eval('.chip', el => el.style.transform);
    // It may be empty initially; the rAF will set it shortly. Assert that it is a string (possibly empty).
    expect(typeof firstChipInlineTransform).toBe('string');

    // Wait a tick to allow the requestAnimationFrame callback to run and apply inline transforms to chips
    await page.waitForTimeout(60);
    const chipTransformAfterRAF = await page.$eval('.chip', el => el.style.transform);
    // The implementation sets it to 'translateX(0) scale(1)'
    expect(chipTransformAfterRAF).toBe('translateX(0) scale(1)');

    // Confirm there were no runtime page errors (ReferenceError, TypeError, SyntaxError) emitted during load
    // and no console 'error' messages. We assert that there are none.
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  test('Toggle Pause/Play via click updates body class and button text/style', async ({ page }) => {
    const collectors = await attachErrorCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    const animateBtn = page.locator('#animateBtn');

    // Ensure starting label is Pause
    await expect(animateBtn).toHaveText('Pause');

    // Click to pause animations
    await animateBtn.click();

    // After click: body should have 'paused' class and button text should be 'Play'
    const pausedClassAfter = await page.$eval('body', b => b.classList.contains('paused'));
    expect(pausedClassAfter).toBe(true);

    await expect(animateBtn).toHaveText('Play');

    // The script also sets an inline style color; verify the inline style string contains 'var(' since it sets var(--accent-1)
    const inlineColor = await page.$eval('#animateBtn', el => el.style.color);
    expect(inlineColor).toContain('var(--accent-1)');

    // Click again to resume animations
    await animateBtn.click();
    const pausedClassAfterResume = await page.$eval('body', b => b.classList.contains('paused'));
    expect(pausedClassAfterResume).toBe(false);
    await expect(animateBtn).toHaveText('Pause');

    // Rapid toggles: click three times quickly
    await animateBtn.click(); // pause
    await animateBtn.click(); // play
    await animateBtn.click(); // pause
    // Now should be paused
    const pausedNow = await page.$eval('body', b => b.classList.contains('paused'));
    expect(pausedNow).toBe(true);

    // Confirm no runtime page errors occurred while interacting
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  test('Toggle explanation panel via click updates body class and explain button attributes', async ({ page }) => {
    const collectors = await attachErrorCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    const explainBtn = page.locator('#explainBtn');
    const explainEl = page.locator('#explain');

    // Initially hidden
    await expect(explainBtn).toHaveText('Explain');
    const initialBodyHasShow = await page.$eval('body', b => b.classList.contains('show-explain'));
    expect(initialBodyHasShow).toBe(false);

    // Click to show explanation
    await explainBtn.click();

    // Body should gain 'show-explain' class and explainBtn text should become 'Hide'
    const bodyHasShowAfter = await page.$eval('body', b => b.classList.contains('show-explain'));
    expect(bodyHasShowAfter).toBe(true);

    await expect(explainBtn).toHaveText('Hide');

    // The implementation sets aria-pressed on the explain button when toggling; it should be 'true'
    await expect(explainBtn).toHaveAttribute('aria-pressed', 'true');

    // Note: The implementation does not change explain element's aria-hidden attribute; it remains as originally set.
    // We assert the implementation's actual behavior (not an ideal accessibility change).
    const explainAriaHidden = await explainEl.getAttribute('aria-hidden');
    expect(explainAriaHidden).toBe('true');

    // Click again to hide
    await explainBtn.click();
    const bodyHasShowAfterHide = await page.$eval('body', b => b.classList.contains('show-explain'));
    expect(bodyHasShowAfterHide).toBe(false);
    await expect(explainBtn).toHaveText('Explain');
    await expect(explainBtn).toHaveAttribute('aria-pressed', 'false');

    // Confirm no runtime exceptions occurred
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  test('Keyboard accessibility: Enter and Space toggles behave like click for both buttons', async ({ page }) => {
    const collectors = await attachErrorCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Focus animate button and press Enter to toggle
    await page.focus('#animateBtn');
    await page.keyboard.press('Enter');
    // After pressing Enter, the animateBtn should toggle to Play
    await expect(page.locator('#animateBtn')).toHaveText('Play');
    let pausedNow = await page.$eval('body', b => b.classList.contains('paused'));
    expect(pausedNow).toBe(true);

    // Press Space to toggle back to playing
    await page.focus('#animateBtn');
    await page.keyboard.press('Space');
    await expect(page.locator('#animateBtn')).toHaveText('Pause');
    pausedNow = await page.$eval('body', b => b.classList.contains('paused'));
    expect(pausedNow).toBe(false);

    // For explainBtn: Enter should reveal explanation
    await page.focus('#explainBtn');
    await page.keyboard.press('Enter');
    await expect(page.locator('#explainBtn')).toHaveText('Hide');
    const bodyHasShow = await page.$eval('body', b => b.classList.contains('show-explain'));
    expect(bodyHasShow).toBe(true);

    // Space should hide explanation
    await page.focus('#explainBtn');
    await page.keyboard.press('Space');
    await expect(page.locator('#explainBtn')).toHaveText('Explain');
    const bodyHasShowAfter = await page.$eval('body', b => b.classList.contains('show-explain'));
    expect(bodyHasShowAfter).toBe(false);

    // Confirm no runtime exceptions occurred during keyboard interactions
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  test('Prefers-reduced-motion environment sets paused state on load (emulation)', async ({ browser }) => {
    // Create a context that emulates reduced motion preference
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1200, height: 800 } });
    const page = await context.newPage();

    const collectors = await attachErrorCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // When prefers-reduced-motion matches, script adds body.classList.add('paused') and sets animateBtn.textContent = 'Play'
    const bodyHasPaused = await page.$eval('body', b => b.classList.contains('paused'));
    expect(bodyHasPaused).toBe(true);

    await expect(page.locator('#animateBtn')).toHaveText('Play');

    // Clean up
    await context.close();

    // Confirm no runtime exceptions occurred
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  test('Edge cases: interacting with non-visible controls, and ensuring no unexpected exceptions on rapid toggles', async ({ page }) => {
    const collectors = await attachErrorCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Interact with buttons even when controls container is aria-hidden="true"
    // The .controls wrapper has aria-hidden="true" in the HTML; ensure button clicks still function
    await expect(page.locator('.controls')).toHaveAttribute('aria-hidden', 'true');

    // Click explainBtn while controls are aria-hidden; should still toggle
    await page.click('#explainBtn');
    await expect(page.locator('body')).toHaveClass(/show-explain/);

    // Rapidly toggle both buttons multiple times to look for exceptions or inconsistencies
    const animateBtn = page.locator('#animateBtn');
    for (let i = 0; i < 6; i++) {
      await animateBtn.click();
    }
    // After even number of toggles initial state 'Pause' should be restored
    await expect(animateBtn).toHaveText('Pause');

    // Re-assert explain button toggled back to hidden after one more click
    await page.click('#explainBtn');
    await expect(page.locator('body')).not.toHaveClass(/show-explain/);

    // Ensure aria-pressed is consistent 'false' for explainBtn now
    await expect(page.locator('#explainBtn')).toHaveAttribute('aria-pressed', 'false');

    // Check that no page errors were emitted during rapid interactions
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);

    // Additionally assert there are no console warnings of major concern (optional)
    // Not failing test on warnings, just observe and capture count
    // (But assert that it's an array)
    expect(Array.isArray(collectors.consoleWarnings)).toBe(true);
  });

});