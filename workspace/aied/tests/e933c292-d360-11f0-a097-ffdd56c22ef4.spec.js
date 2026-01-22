import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e933c292-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Heap Sort Visualizer — e933c292-d360-11f0-a097-ffdd56c22ef4', () => {
  // Shared state to capture console and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];

    page.on('console', msg => {
      // store console messages with type
      page['_consoleMessages'].push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      page['_pageErrors'].push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial render completed by waiting for primary elements
    await expect(page.locator('#playBtn')).toBeVisible();
    await expect(page.locator('#bars')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Sanity check: fail the test if there were uncaught page errors.
    // We intentionally observe and assert on page errors rather than suppressing them.
    const pageErrors = page['_pageErrors'] || [];
    if (pageErrors.length > 0) {
      // Attach details to the assertion error to help debugging
      throw new Error('Unhandled page errors detected: ' + pageErrors.map(e => e.stack || e.message || String(e)).join('\n---\n'));
    }
  });

  test('Initial state: Idle and initial UI elements render correctly', async ({ page }) => {
    // Validate the initial Idle phase, initial stats, and control labels
    const phase = page.locator('#phase');
    await expect(phase).toHaveText('idle');

    // Default size value
    const sizeVal = page.locator('#sizeVal');
    await expect(sizeVal).toHaveText(/\d+/);
    const sizeInput = page.locator('#size');
    const sizeValue = await sizeInput.getAttribute('value');
    expect(Number(sizeValue)).toBeGreaterThanOrEqual(8);

    // Speed value text
    await expect(page.locator('#speedVal')).toHaveText(/ms$/);

    // Stats are zero
    await expect(page.locator('#comp')).toHaveText('0');
    await expect(page.locator('#swaps')).toHaveText('0');
    await expect(page.locator('#steps')).toHaveText('0');

    // Bars rendered equal to size
    const bars = page.locator('#bars .bar');
    await expect(bars).toHaveCount(Number(sizeValue));

    // Play button shows Play initially
    await expect(page.locator('#playBtn')).toHaveText(/Play/i);

    // Confirm there were no fatal console errors during initial load
    const consoleMsgs = page['_consoleMessages'] || [];
    const errorMsgs = consoleMsgs.filter(m => m.type === 'error');
    expect(errorMsgs.length).toBe(0);
  });

  test('Step button: drives generator and transitions from building heap -> extracting -> finished', async ({ page }) => {
    // Reduce size to a small value to make stepping tractable
    await page.evaluate(() => {
      const el = document.getElementById('size');
      el.value = '8';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#sizeVal')).toHaveText('8');

    const stepBtn = page.locator('#stepBtn');
    const phase = page.locator('#phase');

    // Click step until we observe a phase indicating the extracting phase
    // We cap iterations to avoid infinite loops if something breaks
    let observedExtracting = false;
    for (let i = 0; i < 500; i++) {
      await stepBtn.click();
      // Give a tiny delay for DOM updates
      await page.waitForTimeout(5);
      const p = (await phase.textContent()) || '';
      if (p.toLowerCase().includes('extracting')) {
        observedExtracting = true;
        break;
      }
    }
    expect(observedExtracting).toBe(true);

    // Continue stepping until finished phase is reached
    let observedFinished = false;
    for (let i = 0; i < 2000; i++) {
      await stepBtn.click();
      await page.waitForTimeout(5);
      const p = (await phase.textContent()) || '';
      if (p.toLowerCase().includes('finished') || p.toLowerCase() === 'finished') {
        observedFinished = true;
        break;
      }
    }
    expect(observedFinished).toBe(true);

    // After completion, play button should revert to 'Play'
    await expect(page.locator('#playBtn')).toHaveText(/Play/i);

    // Steps, comparisons, swaps should be numbers and steps should be >= 1
    const steps = Number(await page.locator('#steps').textContent());
    expect(steps).toBeGreaterThanOrEqual(1);
    const comps = Number(await page.locator('#comp').textContent());
    const swaps = Number(await page.locator('#swaps').textContent());
    expect(comps).toBeGreaterThanOrEqual(0);
    expect(swaps).toBeGreaterThanOrEqual(0);
  });

  test('Play/Pause button and speed control: run to completion with fast speed', async ({ page }) => {
    // Make size small for a fast run
    await page.evaluate(() => {
      const el = document.getElementById('size');
      el.value = '8';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Set speed to very fast (minimum)
    await page.evaluate(() => {
      const speed = document.getElementById('speed');
      speed.value = '10';
      speed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#speedVal')).toHaveText('10ms');

    const playBtn = page.locator('#playBtn');
    const phase = page.locator('#phase');

    // Start animation
    await playBtn.click();
    await expect(playBtn).toHaveText(/Pause/i);

    // Wait until the algorithm finishes (play button text returns to Play)
    await page.waitForFunction(() => {
      const btn = document.getElementById('playBtn');
      return btn && btn.textContent && btn.textContent.toLowerCase().includes('play');
    }, { timeout: 10000 });

    // Phase should be 'finished' per the step() done handling
    const finalPhase = (await phase.textContent()) || '';
    expect(finalPhase.toLowerCase()).toContain('finished');

    // Play/Pause toggled back to Play
    await expect(playBtn).toHaveText(/Play/i);
  });

  test('Reset, Shuffle, Randomize controls produce expected resets and DOM changes', async ({ page }) => {
    // Set a small size to keep DOM small
    await page.evaluate(() => {
      const el = document.getElementById('size');
      el.value = '12';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#sizeVal')).toHaveText('12');

    // Capture initial values of bars (text contents)
    const getBarValues = async () => {
      return await page.$$eval('#bars .bar .val', nodes => nodes.map(n => n.textContent));
    };
    const initialValues = await getBarValues();

    // Shuffle: should change values or at least reorder
    await page.locator('#shuffleBtn').click();
    await page.waitForTimeout(50);
    const afterShuffle = await getBarValues();
    // After shuffle, array likely changed; it's acceptable if it's different or same due to randomness,
    // but we at least assert phase is set to 'idle' and stats reset.
    await expect(page.locator('#phase')).toHaveText('idle');
    await expect(page.locator('#steps')).toHaveText('0');
    // Randomize should change values to newly generated array
    await page.locator('#randomizeBtn').click();
    await page.waitForTimeout(50);
    const afterRandomize = await getBarValues();
    await expect(page.locator('#phase')).toHaveText('idle');
    await expect(page.locator('#steps')).toHaveText('0');

    // It's possible shuffle/randomize produce same sequence by chance; we assert that DOM changed length remains consistent
    expect(afterRandomize.length).toBe(initialValues.length);

    // Reset should reset stats and set phase to idle as well
    // But first trigger some steps so stats are non-zero
    await page.locator('#stepBtn').click();
    await page.waitForTimeout(10);
    const stepsBeforeReset = Number(await page.locator('#steps').textContent());
    expect(stepsBeforeReset).toBeGreaterThanOrEqual(1);
    await page.locator('#resetBtn').click();
    await page.waitForTimeout(20);
    await expect(page.locator('#phase')).toHaveText('idle');
    await expect(page.locator('#steps')).toHaveText('0');
    await expect(page.locator('#comp')).toHaveText('0');
    await expect(page.locator('#swaps')).toHaveText('0');
  });

  test('Keyboard controls: Space toggles play/pause, ArrowRight performs a single step', async ({ page }) => {
    // Make size small
    await page.evaluate(() => {
      const el = document.getElementById('size');
      el.value = '10';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const playBtn = page.locator('#playBtn');
    const stepsEl = page.locator('#steps');

    // Press Space to start play
    await page.keyboard.press('Space');
    // Play button should show Pause
    await expect(playBtn).toHaveText(/Pause/i);

    // Press Space again to pause
    await page.keyboard.press('Space');
    await expect(playBtn).toHaveText(/Play/i);

    // Record steps, then send ArrowRight to step once
    const beforeSteps = Number(await stepsEl.textContent());
    await page.keyboard.press('ArrowRight');
    // small wait for update
    await page.waitForTimeout(20);
    const afterSteps = Number(await stepsEl.textContent());
    expect(afterSteps).toBeGreaterThanOrEqual(beforeSteps + 1);
  });

  test('Change speed and size edge cases: min/max values update UI text appropriately', async ({ page }) => {
    // Speed min
    await page.evaluate(() => {
      const s = document.getElementById('speed');
      s.value = s.getAttribute('min') || '10';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const speedValMin = await page.locator('#speedVal').textContent();
    expect(speedValMin).toMatch(/ms$/);

    // Speed max
    await page.evaluate(() => {
      const s = document.getElementById('speed');
      s.value = s.getAttribute('max') || '1000';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const speedValMax = await page.locator('#speedVal').textContent();
    expect(speedValMax).toMatch(/ms$/);

    // Size min
    await page.evaluate(() => {
      const s = document.getElementById('size');
      s.value = s.getAttribute('min') || '8';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const sizeValMin = await page.locator('#sizeVal').textContent();
    expect(Number(sizeValMin)).toBeGreaterThanOrEqual(8);
    await expect(page.locator('#bars .bar')).toHaveCount(Number(sizeValMin));

    // Size max
    await page.evaluate(() => {
      const s = document.getElementById('size');
      s.value = s.getAttribute('max') || '80';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const sizeValMax = Number(await page.locator('#sizeVal').textContent());
    expect(sizeValMax).toBeGreaterThanOrEqual(Number(sizeValMin));
    await expect(page.locator('#bars .bar')).toHaveCount(sizeValMax);
  });

  test('Change order selector resets algorithm and keeps UI accessible', async ({ page }) => {
    const orderSel = page.locator('#order');
    // Change to descending
    await orderSel.selectOption('desc');
    await page.waitForTimeout(20);
    await expect(page.locator('#phase')).toHaveText('idle');
    // Change back to ascending
    await orderSel.selectOption('asc');
    await page.waitForTimeout(20);
    await expect(page.locator('#phase')).toHaveText('idle');
  });

  test('Edge-case behavior: repeatedly pressing step when generator is null does not throw', async ({ page }) => {
    const stepBtn = page.locator('#stepBtn');
    // Reset to ensure generator is null and state is idle
    await page.locator('#resetBtn').click();
    await expect(page.locator('#phase')).toHaveText('idle');

    // Rapidly press step multiple times; this should not crash the page
    for (let i = 0; i < 20; i++) {
      await stepBtn.click();
      // tiny pause for DOM processing
      await page.waitForTimeout(5);
    }
    // If page threw an error we'd have caught it in afterEach; ensure we still have a valid steps number
    const steps = Number(await page.locator('#steps').textContent());
    expect(Number.isFinite(steps)).toBe(true);
  });
});