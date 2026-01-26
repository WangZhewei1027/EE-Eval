import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d637e1-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Merge Sort Visualization (d3d637e1-fa73-11f0-83e0-8d7be1d51901) - FSM and UI behavior', () => {
  // arrays to collect console errors and uncaught page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test ensure no runtime page errors were thrown
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `Unexpected console error messages: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  test('Initial state: Idle and control defaults', async ({ page }) => {
    // Validate initial status text and initial control states (S0_Idle evidence)
    const status = page.locator('#status');
    await expect(status).toHaveText('Idle');

    const newBtn = page.locator('#newBtn');
    const shuffleBtn = page.locator('#shuffleBtn');
    const sortBtn = page.locator('#sortBtn');
    const pauseBtn = page.locator('#pauseBtn');
    const stepBtn = page.locator('#stepBtn');

    // Controls should be present
    await expect(newBtn).toBeVisible();
    await expect(shuffleBtn).toBeVisible();
    await expect(sortBtn).toBeVisible();
    await expect(pauseBtn).toBeVisible();
    await expect(stepBtn).toBeVisible();

    // Pause should be disabled initially
    await expect(pauseBtn).toBeDisabled();

    // Array area should be rendered with bars (initial array created on init)
    const bars = page.locator('#bars .bar');
    await expect(bars).toHaveCountGreaterThan(0);
  });

  test('New Array and Shuffle update status and render bars', async ({ page }) => {
    // Create snapshots of bar values to compare after shuffle
    const getBarValues = async () => {
      return page.$$eval('#bars .bar .val', nodes => nodes.map(n => n.textContent));
    };

    const prevValues = await getBarValues();

    // Click New Array - should render a new array and set status 'New array created'
    await page.click('#newBtn');
    await expect(page.locator('#status')).toHaveText('New array created');

    const afterNewValues = await getBarValues();
    await expect(afterNewValues.length).toBeGreaterThan(0);

    // Click Shuffle - should set status 'Shuffled'
    await page.click('#shuffleBtn');
    await expect(page.locator('#status')).toHaveText('Shuffled');

    // After shuffle, values should exist; we don't strongly assert difference because randomness could by chance produce same order,
    // but we assert still valid numeric text content and same length as before.
    const afterShuffleValues = await getBarValues();
    expect(afterShuffleValues.length).toEqual(afterNewValues.length);
    for (const v of afterShuffleValues) {
      expect(v).toBeTruthy();
    }
  });

  test('Start (Play) transitions to Playing... and finishes to Completed (fast speed & small size)', async ({ page }) => {
    // Reduce array size to a small value to keep action count low and set speed to 0ms for fast playback.
    // Use $eval to change range value and dispatch events as the page listens to 'input' and 'change'.
    await page.$eval('#sizeRange', (el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, '6');

    // Verify size change set status to 'Array size changed'
    await expect(page.locator('#status')).toHaveText('Array size changed');

    // Make playback instantaneous
    await page.$eval('#speedRange', (el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '0');

    // Click Start - should go to Playing...
    await page.click('#sortBtn');
    await expect(page.locator('#status')).toHaveText('Playing...');

    // Pause button should be enabled while playing
    await expect(page.locator('#pauseBtn')).toBeEnabled();

    // Wait for the algorithm to complete and status to become 'Completed'
    await expect(page.locator('#status')).toHaveText('Completed', { timeout: 5000 });

    // After completion, stopPlaying(true) in code sets sortBtn.disabled = true - assert it's disabled
    await expect(page.locator('#sortBtn')).toBeDisabled();

    // Ensure highlights were cleared on completion (no bar should have compare/write/range classes)
    const anyHighlighted = await page.$eval('#bars', bars => {
      return Array.from(bars.querySelectorAll('.bar')).some(b => b.classList.contains('compare') || b.classList.contains('write') || b.classList.contains('range'));
    });
    expect(anyHighlighted).toBeFalsy();
  });

  test('Step repeatedly until Completed (S4_Stepped -> S3_Completed evidence)', async ({ page }) => {
    // Ensure small array size again for manageable action count
    await page.$eval('#sizeRange', (el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, '6');

    // Confirm status changed to 'Array size changed'
    await expect(page.locator('#status')).toHaveText('Array size changed');

    // Step repeatedly until status becomes 'Completed' or we hit a max iteration guard
    const maxSteps = 200;
    let steps = 0;
    while (steps < maxSteps) {
      const currentStatus = await page.locator('#status').textContent();
      if (currentStatus === 'Completed') break;
      await page.click('#stepBtn');
      // small pause to let DOM update
      await page.waitForTimeout(10);
      steps++;
    }

    // Assert that we reached Completed within maxSteps
    await expect(page.locator('#status')).toHaveText('Completed');
  });

  test('Pause and Resume behavior and Reset View (S1_Playing <-> S2_Paused and S2 -> S0 Reset)', async ({ page }) => {
    // Ensure small size and fast speed to be able to start quickly
    await page.$eval('#sizeRange', (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, '6');
    await page.$eval('#speedRange', (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, '100');

    // Start playing
    await page.click('#sortBtn');
    await expect(page.locator('#status')).toHaveText('Playing...');

    // Let one action run then pause
    await page.waitForTimeout(120);
    await page.click('#pauseBtn');

    // Status should be Paused and buttons re-enabled appropriately
    await expect(page.locator('#status')).toHaveText('Paused');
    await expect(page.locator('#sortBtn')).toBeEnabled();
    await expect(page.locator('#pauseBtn')).toBeDisabled();

    // Now click Reset View; per implementation, resetView() pauses, clears actions and sets status 'Reset view'
    await page.click('#resetBtn');
    await expect(page.locator('#status')).toHaveText('Reset view');

    // After reset the bars should be re-rendered and no highlights exist
    const anyHighlightedAfterReset = await page.$eval('#bars', bars => {
      return Array.from(bars.querySelectorAll('.bar')).some(b => b.classList.contains('compare') || b.classList.contains('write') || b.classList.contains('range'));
    });
    expect(anyHighlightedAfterReset).toBeFalsy();
  });

  test('SizeChange while Paused transitions and updates status (S2_Paused -> S0_Idle expected behavior in code)', async ({ page }) => {
    // Start a play and then pause to reach Paused
    await page.$eval('#sizeRange', (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, '6');
    await page.$eval('#speedRange', (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, '200');

    await page.click('#sortBtn');
    await expect(page.locator('#status')).toHaveText('Playing...');
    await page.waitForTimeout(80);
    await page.click('#pauseBtn');
    await expect(page.locator('#status')).toHaveText('Paused');

    // Change size (dispatch 'change' event) - implementation listens and sets status 'Array size changed'
    await page.$eval('#sizeRange', (el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, '8');

    await expect(page.locator('#status')).toHaveText('Array size changed');

    // After size change, array should be recreated with new number of bars
    const newBarCount = await page.$$eval('#bars .bar', bars => bars.length);
    expect(newBarCount).toBeGreaterThanOrEqual(6); // because min is 6; we set to 8 so expect >=6
  });

  test('SpeedChange input updates display but does not throw errors (S2_Paused -> no explicit status change in code)', async ({ page }) => {
    // Start and then pause to reach Paused
    await page.$eval('#sizeRange', (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, '6');
    await page.click('#sortBtn');
    await page.waitForTimeout(60);
    await page.click('#pauseBtn');
    await expect(page.locator('#status')).toHaveText('Paused');

    // Change speed via input event - code will update #speedValue text
    await page.$eval('#speedRange', (el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '120');

    // Verify visible speed value updated to reflect '120ms'
    await expect(page.locator('#speedValue')).toHaveText('120ms');

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Explain Steps button displays alert with actions count (ExplainSteps event handler)', async ({ page }) => {
    // Ensure not playing so explain button will show alert
    await expect(page.locator('#status')).toHaveText(/Idle|Array size changed|Reset view|Completed|Stepped/);

    // Prepare to capture the dialog message
    let dialogMessage = '';
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click the explain button
    await page.click('#explainBtn');

    // Wait briefly for the dialog handler to run and be captured
    await page.waitForTimeout(50);

    // The dialog should contain the expected explanatory text
    expect(dialogMessage).toMatch(/This array will generate \d+ actions/);
  });

  test('Edge cases: clicking Pause when disabled does nothing and keyboard toggle works', async ({ page }) => {
    // Initially Pause is disabled; click attempt should not change state from Idle
    await expect(page.locator('#pauseBtn')).toBeDisabled();
    await page.click('#pauseBtn'); // click has no effect when disabled
    await expect(page.locator('#status')).toHaveText('Idle');

    // Press Space to toggle play -> keydown is handled by window event in page; pressing space should start playing
    await page.keyboard.press('Space');
    await expect(page.locator('#status')).toHaveText('Playing...');

    // Press Space again to pause
    await page.keyboard.press('Space');
    // Pause handler updates status to 'Paused'
    await expect(page.locator('#status')).toHaveText('Paused');

    // Cleanup: ensure we are paused then reset view
    await page.click('#resetBtn');
    await expect(page.locator('#status')).toHaveText('Reset view');
  });
});