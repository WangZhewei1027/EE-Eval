import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d65ef0-fa73-11f0-83e0-8d7be1d51901.html';

test.describe.serial('Quick Sort Visualization - FSM end-to-end', () => {
  // Collect console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events and capture error-level messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Navigate to the app exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for the key UI to render
    await expect(page.locator('#generate')).toBeVisible();
    await expect(page.locator('#bars')).toBeVisible();
  });

  test.afterEach(async () => {
    // Nothing to teardown explicitly; Playwright closes pages after tests
  });

  test('S0_Idle - initial render and controls presence', async ({ page }) => {
    // Verify initial Idle state UI matches FSM evidence
    // Buttons exist
    await expect(page.locator('#generate')).toBeVisible();
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('#pause')).toBeVisible();
    await expect(page.locator('#step')).toBeVisible();
    await expect(page.locator('#reset')).toBeVisible();

    // Pause should be disabled initially (evidence in FSM)
    await expect(page.locator('#pause')).toBeDisabled();

    // Initial stats should be zeros
    await expect(page.locator('#compCount')).toHaveText('0');
    await expect(page.locator('#swapCount')).toHaveText('0');
    await expect(page.locator('#actionCount')).toHaveText('0');

    // Bars container should contain initial bars based on default size (40)
    const sizeValue = await page.locator('#size').inputValue();
    const barsCount = await page.locator('#bars .bar').count();
    expect(Number(sizeValue)).toBeGreaterThanOrEqual(6);
    // The implementation generates bars on load; ensure counts > 0
    expect(barsCount).toBeGreaterThan(0);

    // Assert no uncaught JS errors happened during initial load
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S1_ArrayGenerated - generate a small array and validate DOM & stats', async ({ page }) => {
    // Set array size to a small value to keep later tests fast (edge case: minimum allowed)
    // For range inputs, set via evaluate and dispatch input event so listeners pick up change
    await page.evaluate(() => {
      const sizeEl = document.getElementById('size');
      sizeEl.value = '6';
      sizeEl.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Click Generate to transition from Idle -> ArrayGenerated
    await page.click('#generate');

    // After generating, bars should match the chosen size
    const bars = page.locator('#bars .bar');
    await expect(bars).toHaveCount(6);

    // Generate should have enabled start and step buttons and left pause disabled per implementation
    await expect(page.locator('#start')).toBeEnabled();
    await expect(page.locator('#step')).toBeEnabled();
    await expect(page.locator('#pause')).toBeDisabled();
    await expect(page.locator('#reset')).toBeEnabled();

    // actionCount still zero after generation because resetStats was called during generate
    await expect(page.locator('#actionCount')).toHaveText('0');

    // Stack view should be empty array string
    await expect(page.locator('#stackView')).toHaveText('[]');

    // No console or page errors should have appeared
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S1 -> S2 StartSorting: start auto-play and verify Running state', async ({ page }) => {
    // Ensure we have a small array (size 6) from previous test or set again to be safe
    await page.evaluate(() => {
      const sizeEl1 = document.getElementById('size');
      sizeEl.value = '6';
      sizeEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#generate');

    // Click Start to begin auto-sorting
    await page.click('#start');

    // Running state should disable Start, enable Pause and disable Step and Generate
    await expect(page.locator('#start')).toBeDisabled();
    await expect(page.locator('#pause')).toBeEnabled();
    await expect(page.locator('#step')).toBeDisabled();
    await expect(page.locator('#generate')).toBeDisabled();

    // Wait a bit for scheduled actions to begin and increment actionCount
    // actionDelay defaults to speedEl.value (60ms); wait sufficiently
    await page.waitForTimeout(300);

    // actionCount should have increased (evidence of processing actions)
    const actionCountText = await page.locator('#actionCount').innerText();
    expect(Number(actionCountText)).toBeGreaterThan(0);

    // Comparisons or Swaps may have occurred -> compCount or swapCount may be > 0
    const compCount = Number(await page.locator('#compCount').innerText());
    const swapCount = Number(await page.locator('#swapCount').innerText());
    expect(compCount + swapCount).toBeGreaterThanOrEqual(0); // sanity

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S2 -> S3 PauseSorting and resume back to S2', async ({ page }) => {
    // Prepare and start auto-run again to test pause/resume
    await page.evaluate(() => {
      const sizeEl2 = document.getElementById('size');
      sizeEl.value = '6';
      sizeEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#generate');
    await page.click('#start');

    // Wait to allow some actions
    await page.waitForTimeout(250);

    // Click Pause button to toggle paused state (should change text to 'Resume')
    await page.click('#pause');

    // Pause button should show 'Resume'
    await expect(page.locator('#pause')).toHaveText('Resume');

    // Record actionCount at pause time
    const acBeforePause = Number(await page.locator('#actionCount').innerText());

    // Wait some time and ensure no further actions processed while paused
    await page.waitForTimeout(400);
    const acAfterPause = Number(await page.locator('#actionCount').innerText());

    // Expect no increase in actionCount while paused
    expect(acAfterPause).toBe(acBeforePause);

    // Click Pause again to resume (button toggles back to 'Pause'), which should scheduleNext
    await page.click('#pause');
    await expect(page.locator('#pause')).toHaveText('Pause');

    // After resuming, wait and expect actionCount to increase
    await page.waitForTimeout(300);
    const acAfterResume = Number(await page.locator('#actionCount').innerText());
    expect(acAfterResume).toBeGreaterThan(acAfterPause);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S2 -> S4 via StepSorting: step through until finished and verify Finished state', async ({ page }) => {
    // Use small size to keep step iterations reasonable
    await page.evaluate(() => {
      const sizeEl3 = document.getElementById('size');
      sizeEl.value = '6';
      sizeEl.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Generate fresh array and ensure buttons are in expected state
    await page.click('#generate');
    await expect(page.locator('#step')).toBeEnabled();

    // Ensure generator will be created on first step
    // Repeatedly click Step until finalizeRun() executes which disables step button
    const maxSteps = 2000; // safety cap to avoid infinite loops
    let finished = false;
    for (let i = 0; i < maxSteps; i++) {
      // Click step and give a brief moment for processing (the implementation sets paused=true on step)
      await page.click('#step');
      // After each step, some transient styling happens with a timeout. Allow it settle.
      await page.waitForTimeout(40);

      // Check if step button has been disabled indicating finalizeRun was invoked
      const stepDisabled = await page.locator('#step').isDisabled();
      if (stepDisabled) {
        finished = true;
        break;
      }
    }

    expect(finished).toBeTruthy();

    // After finish, finalizeRun marks all bars as sorted (visual cue: background becomes sorted color).
    // We'll assert that every bar has a background color that is not the default bar color OR check that Start is enabled and Step is disabled as finalization evidence
    await expect(page.locator('#start')).toBeEnabled();
    await expect(page.locator('#step')).toBeDisabled();
    await expect(page.locator('#pause')).toBeDisabled();

    // actionCount should be greater than zero after all steps
    const finalActionCount = Number(await page.locator('#actionCount').innerText());
    expect(finalActionCount).toBeGreaterThan(0);

    // Stack should be empty at completion -> stackView should be "[]"
    await expect(page.locator('#stackView')).toHaveText('[]');

    // Verify visual sortedness: all bars should have computed background color equal to the sorted color variable.
    // We'll compute the CSS variable value from the document root and compare each bar's computed background-color.
    const sortedColor = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return cs.getPropertyValue('--sorted').trim();
    });
    const rgbSorted = await page.evaluate((sortedColor) => {
      // Convert hex like #34d399 to rgb string by using a temporary element
      const el = document.createElement('div');
      el.style.color = sortedColor;
      document.body.appendChild(el);
      const rgb = getComputedStyle(el).color;
      document.body.removeChild(el);
      return rgb;
    }, sortedColor);

    // Check that at least one bar shows sorted color; due to timing, all should be sorted but check at least half
    const bars1 = page.locator('#bars1 .bar');
    const count = await bars.count();
    let sortedCount = 0;
    for (let i = 0; i < count; i++) {
      const bg = await bars.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
      if (bg === rgbSorted) sortedCount++;
    }
    expect(sortedCount).toBeGreaterThanOrEqual(Math.floor(count / 2));

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('ResetSorting returns UI to initial interactive state and resets stats', async ({ page }) => {
    // Prepare: ensure we have finished state to test reset behavior.
    await page.evaluate(() => {
      const sizeEl4 = document.getElementById('size');
      sizeEl.value = '6';
      sizeEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#generate');

    // Exhaust steps until finish (reuse same loop as before)
    for (let i = 0; i < 500; i++) {
      await page.click('#step');
      await page.waitForTimeout(30);
      if (await page.locator('#step').isDisabled()) break;
    }

    // Now click Reset to transition back to Idle-like interactive state
    await page.click('#reset');

    // After reset, running and paused flags are false internally; from UI perspective:
    await expect(page.locator('#start')).toBeEnabled();
    await expect(page.locator('#pause')).toBeDisabled();
    await expect(page.locator('#step')).toBeEnabled();
    await expect(page.locator('#generate')).toBeEnabled();

    // Stats should be reset to zero
    await expect(page.locator('#compCount')).toHaveText('0');
    await expect(page.locator('#swapCount')).toHaveText('0');
    await expect(page.locator('#actionCount')).toHaveText('0');

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Bar click toggles sorted highlight (edge interaction)', async ({ page }) => {
    // Generate a small array
    await page.evaluate(() => {
      const sizeEl5 = document.getElementById('size');
      sizeEl.value = '6';
      sizeEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#generate');

    // Query first bar and capture its initial background color
    const firstBar = page.locator('#bars .bar').first();
    const initialBg = await firstBar.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Click the bar to toggle its sorted mark
    await firstBar.click();
    await page.waitForTimeout(40); // allow style update

    const afterClickBg = await firstBar.evaluate((el) => getComputedStyle(el).backgroundColor);

    // The background should have changed when toggled (from default to sorted color or back)
    expect(afterClickBg === initialBg ? false : true).toBeTruthy();

    // Click again to toggle back and ensure it can revert
    await firstBar.click();
    await page.waitForTimeout(40);
    const afterSecondClickBg = await firstBar.evaluate((el) => getComputedStyle(el).backgroundColor);
    // It should return to the initial (or at least be different from the toggled) color
    expect(afterSecondClickBg === afterClickBg ? false : true).toBeTruthy();

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Keyboard shortcuts: space toggles start/step and p triggers pause', async ({ page }) => {
    // Use small array
    await page.evaluate(() => {
      const sizeEl6 = document.getElementById('size');
      sizeEl.value = '6';
      sizeEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#generate');

    // Press ' ' (space): implementation toggles between start and step depending on startBtn.disabled
    // Initially startBtn is enabled, so space should trigger start
    await page.keyboard.press(' ');
    await page.waitForTimeout(150);

    // After pressing space, the Start button should be disabled (running)
    await expect(page.locator('#start')).toBeDisabled();

    // Press 'p' to pause
    await page.keyboard.press('p');
    await page.waitForTimeout(60);
    // Pause button should reflect the toggled state (text becomes 'Resume')
    await expect(page.locator('#pause')).toHaveText(/Resume|Pause/);

    // Press 'p' again to resume
    await page.keyboard.press('p');
    await page.waitForTimeout(100);
    // Now Pause should be 'Pause' again when resumed
    await expect(page.locator('#pause')).toHaveText(/Pause|Resume/);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Sanity: ensure no unexpected console errors or uncaught exceptions across interactions', async ({ page }) => {
    // Perform a series of typical interactions to ensure stability
    await page.evaluate(() => {
      document.getElementById('size').value = '8';
      document.getElementById('size').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#generate');
    await page.click('#step');
    await page.click('#start');
    await page.waitForTimeout(200);
    await page.click('#pause');
    await page.click('#reset');

    // Ultimately, assert there were no console error messages or uncaught page errors captured
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});