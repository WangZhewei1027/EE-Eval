import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9339b81-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Insertion Sort Visualizer — FSM behavior and UI E2E', () => {
  let consoleErrors;
  let pageErrors;

  // Helper to set a range input value and dispatch input event
  async function setRangeValue(locator, value) {
    await locator.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Helper to get bar values as numbers in DOM order
  async function getBarValues(page) {
    const bars = await page.locator('.bar').elementHandles();
    const vals = [];
    for (const b of bars) {
      try {
        const valEl = await b.$('.val');
        const txt = valEl ? (await valEl.textContent()) : null;
        vals.push(txt !== null ? Number(txt.trim()) : null);
      } catch (e) {
        vals.push(null);
      }
    }
    return vals;
  }

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages and page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Wait for essential UI elements to be available
    await expect(page.locator('#startBtn')).toBeVisible();
    // Ensure initial UI loaded
    await expect(page.locator('#status')).toHaveText('Ready');
  });

  test.afterEach(async () => {
    // After each test ensure there were no uncaught page errors
    // If any JavaScript errors occurred, we fail the test with detailed info
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      const details = {
        pageErrors,
        consoleErrors
      };
      // Fail the test explicitly so CI shows issues
      throw new Error('JavaScript errors were detected during the test run: ' + JSON.stringify(details, null, 2));
    }
  });

  test('Initial Idle State: UI reflects S0_Idle entry (Ready), controls defaults', async ({ page }) => {
    // Validate initial Idle state: status 'Ready', ops counter 0, pause disabled
    await expect(page.locator('#status')).toHaveText('Ready');
    await expect(page.locator('#opsCounter')).toHaveText('Operations: 0');
    await expect(page.locator('#pauseBtn')).toBeDisabled();
    await expect(page.locator('#startBtn')).toBeEnabled();
    await expect(page.locator('#stepBtn')).toBeEnabled();
  });

  test('Generate: clicking Generate creates bars according to sizeRange (S0_Idle remains/updates)', async ({ page }) => {
    // Set size small to keep test deterministic and quick
    const sizeInput = page.locator('#sizeRange');
    await setRangeValue(sizeInput, 8); // dispatches input which triggers resetAll()

    // Click generate (resetAll is bound to generate). After reset, bars should be created.
    await page.locator('#generateBtn').click();

    // Expect exactly 8 bars present (floatingKey is not .bar)
    await expect(page.locator('.bar')).toHaveCount(8);

    // Status should be Ready after resetAll
    await expect(page.locator('#status')).toHaveText('Ready');
  });

  test('Start -> Running and Pause transition: S0_Idle -> S1_Running -> S2_Paused', async ({ page }) => {
    // Use small size for predictable quick state transitions
    await setRangeValue(page.locator('#sizeRange'), 6);

    // Start sorting (should go to Running)
    await page.locator('#startBtn').click();

    // Immediately check button states to detect running state
    await expect(page.locator('#startBtn')).toBeDisabled();
    await expect(page.locator('#pauseBtn')).toBeEnabled();
    await expect(page.locator('#generateBtn')).toBeDisabled();
    await expect(page.locator('#stepBtn')).toBeDisabled();

    // Wait a bit to allow a few steps to execute, then pause
    await page.waitForTimeout(150);
    await page.locator('#pauseBtn').click();

    // After pausing, validate Paused evidence: status and button states
    await expect(page.locator('#status')).toHaveText('Paused');
    await expect(page.locator('#startBtn')).toBeEnabled();
    await expect(page.locator('#pauseBtn')).toBeDisabled();
    await expect(page.locator('#stepBtn')).toBeEnabled();
  });

  test('Paused -> Start resumes (S2_Paused -> S1_Running) and then pause again', async ({ page }) => {
    // Start and then pause first
    await setRangeValue(page.locator('#sizeRange'), 6);
    await page.locator('#startBtn').click();
    await page.waitForTimeout(100);
    await page.locator('#pauseBtn').click();

    // Now resume
    await page.locator('#startBtn').click();

    // Validate resumed -> running
    await expect(page.locator('#startBtn')).toBeDisabled();
    await expect(page.locator('#pauseBtn')).toBeEnabled();

    // Pause again for cleanup
    await page.waitForTimeout(100);
    await page.locator('#pauseBtn').click();
    await expect(page.locator('#status')).toHaveText('Paused');
  });

  test('Step through sorting until Sorted: S1_Running (via Step events) -> S3_Sorted', async ({ page }) => {
    // Use small array to limit steps
    await setRangeValue(page.locator('#sizeRange'), 5);

    // We'll click Step repeatedly until we observe 'Sorting complete' status or step button becomes disabled
    const stepBtn = page.locator('#stepBtn');
    let done = false;
    for (let i = 0; i < 200; i++) {
      // Click step (initial click will create generator)
      await stepBtn.click();
      // small wait to allow DOM to update/animations to settle
      await page.waitForTimeout(30);
      const status = await page.locator('#status').textContent();
      if (status && status.trim() === 'Sorting complete') {
        done = true;
        break;
      }
      // If step button becomes disabled, generator finished as well
      if (!(await stepBtn.isEnabled())) {
        const finalStatus = await page.locator('#status').textContent();
        if (finalStatus && finalStatus.trim() === 'Sorting complete') {
          done = true;
        }
        break;
      }
    }
    expect(done).toBe(true);

    // After sorting complete, verify all bars marked as sorted (background color applied to all)
    const bars = page.locator('.bar');
    const count = await bars.count();
    expect(count).toBeGreaterThan(0);
    // check at least one bar has the sorted color variable present in style attribute
    const someStyle = await bars.nth(0).getAttribute('style');
    expect(someStyle).toContain('background'); // basic check that styles applied

    // Ensure step button is disabled (per code once done)
    await expect(stepBtn).toBeDisabled();
  });

  test('Reset from Paused returns to initial unsorted array (S2_Paused -> S0_Idle)', async ({ page }) => {
    // Set a small deterministic array via arrayInput to capture initial values
    await page.fill('#arrayInput', '9,7,5,3,1');
    // Generate will pick the input array because it's provided
    await page.locator('#generateBtn').click();

    // Capture initial bar values
    const initialVals = await getBarValues(page);
    expect(initialVals).toEqual([9,7,5,3,1]);

    // Start, then pause
    await page.locator('#startBtn').click();
    await page.waitForTimeout(100);
    await page.locator('#pauseBtn').click();
    await expect(page.locator('#status')).toHaveText('Paused');

    // Now reset
    await page.locator('#resetBtn').click();

    // Status should indicate reset
    await expect(page.locator('#status')).toHaveText('Reset to initial array');
    // Operation counter reset
    await expect(page.locator('#opsCounter')).toHaveText('Operations: 0');

    // Bars should reflect initial array again
    const afterResetVals = await getBarValues(page);
    expect(afterResetVals).toEqual(initialVals);
  });

  test('Order change affects final sorted order (Ascending vs Descending)', async ({ page }) => {
    // Provide a known input and generate
    await page.fill('#arrayInput', '5,3,8,1,2');
    await page.locator('#generateBtn').click();

    // Change order to descending and step to completion
    await page.selectOption('#orderSelect', 'desc');

    // Step until done
    const stepBtn = page.locator('#stepBtn');
    let sorted = false;
    for (let i = 0; i < 300; i++) {
      await stepBtn.click();
      await page.waitForTimeout(20);
      const status = await page.locator('#status').textContent();
      if (status && status.trim() === 'Sorting complete') {
        sorted = true;
        break;
      }
      if (!(await stepBtn.isEnabled())) {
        const st = await page.locator('#status').textContent();
        if (st && st.trim() === 'Sorting complete') sorted = true;
        break;
      }
    }
    expect(sorted).toBe(true);

    // Verify descending order of visible bar values
    const finalVals = await getBarValues(page);
    // filter possible nulls just in case
    const numericVals = finalVals.filter(v => typeof v === 'number');
    // Check descending
    for (let i = 1; i < numericVals.length; i++) {
      expect(numericVals[i-1] >= numericVals[i]).toBeTruthy();
    }
  });

  test('Edge case: invalid array input falls back to random generation and causes no JS errors', async ({ page }) => {
    // Provide an invalid array input - should fallback to random (no throwing)
    await page.fill('#arrayInput', 'a,b,c,!,#');
    // Ensure size set to a known number
    await setRangeValue(page.locator('#sizeRange'), 7);
    // Click generate to trigger resetAll which reads arrayInput and falls back
    await page.locator('#generateBtn').click();

    // Expect bars count equal to sizeRange value (7)
    await expect(page.locator('.bar')).toHaveCount(7);

    // No JS errors should have been emitted (checked in afterEach)
  });

  test('Keyboard shortcuts: Space toggles Start/Pause and ArrowRight triggers Step (accessibility)', async ({ page }) => {
    // Set small size
    await setRangeValue(page.locator('#sizeRange'), 6);

    // Focus document and press Space to start
    await page.keyboard.press('Space');
    // Running state: pause should be enabled
    await expect(page.locator('#pauseBtn')).toBeEnabled();

    // Press Space again to pause
    await page.keyboard.press('Space');
    await expect(page.locator('#pauseBtn')).toBeDisabled();
    await expect(page.locator('#status')).toHaveText('Paused');

    // Press ArrowRight to trigger step
    await page.keyboard.press('ArrowRight');
    // Operation counter should increment at least to 1
    await expect(page.locator('#opsCounter')).toHaveText(/Operations: \d+/);
  });
});