import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b0082e2-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe('Merge Sort Visualizer (FSM) - 6b0082e2-d5c3-11f0-b41f-b131cbd11f51', () => {
  // Capture console messages and page errors for each test so we can assert runtime health.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Gather console messages (all levels) and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // After each test we assert that no uncaught page errors happened
    // and no console errors were emitted. Tests are allowed to inspect logs,
    // but must not modify the page or patch errors.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Expect no uncaught page errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    // Expect no console error/warning
    expect(consoleErrors.length, `Console errors/warnings found: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Initial Idle state is rendered correctly on load', async ({ page }) => {
    // Validate initial UI elements and Idle-like readiness.
    // The implementation triggers generateNewArray() on load, so expect "New array generated. Ready to sort!"
    const status = page.locator('#status');
    await expect(status).toHaveText(/Ready to sort|New array generated/);

    // Validate size value display matches slider default
    const sizeValue = page.locator('#size-value');
    await expect(sizeValue).toHaveText(String(25));

    // Verify that array bars are rendered and count matches displayed size
    const bars = page.locator('#array-container .array-bar');
    await expect(bars).toHaveCount(25);

    // Pause button should be disabled initially due to resetVisualization -> disableControls(false) sets pause disabled
    const pauseBtn = page.locator('#pause');
    await expect(pauseBtn).toBeDisabled();

    // Generate and Sort buttons should be enabled
    await expect(page.locator('#generate')).toBeEnabled();
    await expect(page.locator('#sort')).toBeEnabled();
  });

  test('Generate New Array transition updates status and re-renders array', async ({ page }) => {
    // Click generate and assert the expected status and DOM update.
    const status = page.locator('#status');
    const generateBtn = page.locator('#generate');

    // Click the Generate New Array button
    await generateBtn.click();

    // Should update status text to "New array generated. Ready to sort!"
    await expect(status).toHaveText('New array generated. Ready to sort!');

    // Bars should be present and count equals current size value
    const sizeValueText = await page.locator('#size-value').textContent();
    const expectedCount = parseInt(sizeValueText || '25', 10);
    await expect(page.locator('#array-container .array-bar')).toHaveCount(expectedCount);

    // Buttons remain enabled as appropriate
    await expect(page.locator('#generate')).toBeEnabled();
    await expect(page.locator('#sort')).toBeEnabled();
  });

  test('Update array size (input event) updates UI and re-generates when not sorting', async ({ page }) => {
    // This tests the UpdateSize event; it should change displayed size and regenerate array when not sorting.
    const sizeSlider = page.locator('#size');
    const sizeValue = page.locator('#size-value');

    // Set the slider to a small value to limit animation complexity later
    // Use JavaScript dispatch to trigger 'input' event as user interaction
    await page.evaluate(() => {
      const s = document.getElementById('size');
      s.value = '10';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(sizeValue).toHaveText('10');
    await expect(page.locator('#array-container .array-bar')).toHaveCount(10);

    // Ensure status still indicates ready / new array generated message after regeneration
    const statusText = await page.locator('#status').textContent();
    expect(statusText).toMatch(/Ready to sort|New array generated|Visualization reset/);
  });

  test('Start sorting -> Pause -> Resume -> Reset transitions and statuses', async ({ page }) => {
    // This test validates StartSorting (S2), PauseSorting (S3) and ResetVisualization transitions.
    const sortBtn = page.locator('#sort');
    const pauseBtn = page.locator('#pause');
    const resetBtn = page.locator('#reset');
    const status = page.locator('#status');

    // Start sorting
    await sortBtn.click();
    await expect(status).toHaveText('Sorting in progress...');

    // After starting, controls should be disabled/enabled according to disableControls(true)
    await expect(page.locator('#generate')).toBeDisabled();
    await expect(page.locator('#sort')).toBeDisabled();
    // pauseBtn should be enabled when sorting
    await expect(pauseBtn).toBeEnabled();

    // Pause sorting
    await pauseBtn.click();
    // Now paused: status should reflect paused state and pause button text becomes "Resume"
    await expect(status).toHaveText('Sorting paused');
    await expect(pauseBtn).toHaveText('Resume');

    // Resume sorting
    await pauseBtn.click();
    await expect(status).toHaveText('Resuming sort...');
    await expect(pauseBtn).toHaveText('Pause');

    // Now reset visualization while sorting/resuming - reset should set status to "Visualization reset"
    await resetBtn.click();
    await expect(status).toHaveText('Visualization reset');

    // After reset, controls should be enabled back (pause becomes disabled by disableControls(false))
    await expect(page.locator('#generate')).toBeEnabled();
    await expect(page.locator('#sort')).toBeEnabled();
    await expect(pauseBtn).toBeDisabled();
  });

  test('Step forward repeatedly finishes sorting and enters Sorted state', async ({ page }) => {
    // This test uses the StepForward event to traverse animations until the algorithm finishes.
    // To keep the number of steps small we reduce the array size first.
    const sizeSlider = page.locator('#size');
    const sizeValue = page.locator('#size-value');
    const stepBtn = page.locator('#step');
    const generateBtn = page.locator('#generate');
    const status = page.locator('#status');

    // Set size to minimal allowed (5) to shorten animations
    await page.evaluate(() => {
      const s = document.getElementById('size');
      s.value = '5';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(sizeValue).toHaveText('5');

    // Re-generate the array to reflect new size
    await generateBtn.click();
    await expect(page.locator('#array-container .array-bar')).toHaveCount(5);

    // Repeatedly click Step Forward until status shows sorted (with a safety max attempts)
    const maxSteps = 500; // upper bound to avoid infinite loops
    let sorted = false;
    for (let i = 0; i < maxSteps; i++) {
      await stepBtn.click();
      // Small wait to allow DOM updates from the step action
      await page.waitForTimeout(5);

      const currentStatus = (await status.textContent()) || '';
      if (currentStatus.includes('Array sorted successfully')) {
        sorted = true;
        break;
      }
    }

    expect(sorted, 'Expected to reach the Sorted state via repeated Step Forward').toBeTruthy();

    // When sorted, all bars should have the 'sorted' class
    const barsCount = await page.locator('#array-container .array-bar').count();
    expect(barsCount).toBeGreaterThan(0);

    const sortedBars = await page.locator('#array-container .array-bar.sorted').count();
    expect(sortedBars).toBe(barsCount);

    // Final state status must exactly match implementation message
    await expect(status).toHaveText('Array sorted successfully!');
  });

  test('Update animation speed while sorting does not produce errors', async ({ page }) => {
    // This test validates UpdateSpeed event during sorting. We start sorting, then change speed slider.
    const sizeSlider = page.locator('#size');
    const speedSlider = page.locator('#speed');
    const speedValue = page.locator('#speed-value');
    const sortBtn = page.locator('#sort');
    const status = page.locator('#status');

    // Use a small array to keep runtime short
    await page.evaluate(() => {
      const s = document.getElementById('size');
      s.value = '8';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Start sorting
    await sortBtn.click();
    await expect(status).toHaveText('Sorting in progress...');

    // Change speed slider to faster (100) to force updateSpeed behavior while sorting
    await page.evaluate(() => {
      const sp = document.getElementById('speed');
      sp.value = '100';
      sp.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // speed-value should update
    await expect(speedValue).toHaveText('100');

    // Let the sorting run a short while then reset to stop animations and avoid test flakiness
    await page.waitForTimeout(50);
    await page.locator('#reset').click();
    await expect(page.locator('#status')).toHaveText('Visualization reset');
  });

  test('Edge case: clicking Step when already sorted should keep final state and not error', async ({ page }) => {
    // Prepare a sorted state first by stepping to completion on a small array
    await page.evaluate(() => {
      const s = document.getElementById('size');
      s.value = '6';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#generate').click();

    // Step until sorted
    let sorted = false;
    for (let i = 0; i < 400; i++) {
      await page.locator('#step').click();
      await page.waitForTimeout(5);
      const st = await page.locator('#status').textContent();
      if (st && st.includes('Array sorted successfully')) {
        sorted = true;
        break;
      }
    }
    expect(sorted).toBeTruthy();

    // Click step again when already sorted; it should not throw and status should remain sorted
    await page.locator('#step').click();
    await page.waitForTimeout(10);
    await expect(page.locator('#status')).toHaveText('Array sorted successfully!');
  });
});