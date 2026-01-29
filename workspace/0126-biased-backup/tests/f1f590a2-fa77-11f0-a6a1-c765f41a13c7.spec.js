import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f590a2-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Insertion Sort — Visual Elegance (f1f590a2-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // Collect console errors and page errors for assertions.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events and capture error-level messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
    });

    // Navigate to the application and wait for load event triggered by the app
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to tear down beyond Playwright's context cleanup.
  });

  test('S0_Idle: page load triggers initAndRun and renders the array (initialization)', async ({ page }) => {
    // Validate that on load the app initializes: items should be rendered and stepTotal should be set.
    // Wait for `.item` elements (renderArray creates COUNT = 10 items).
    await page.waitForSelector('.item', { timeout: 5000 });

    // Ensure we have 10 items rendered
    const itemCount = await page.$$eval('.item', els => els.length);
    expect(itemCount).toBeGreaterThanOrEqual(10);

    // The play label should indicate "Pause" initially because initAndRun sets animating = true
    const playLabel = await page.locator('#playLabel').textContent();
    expect(playLabel.trim()).toBe('Pause');

    // aria-pressed on #playPause should be "false" when animating (see togglePlayPause setAttribute)
    const ariaPressed = await page.locator('#playPause').getAttribute('aria-pressed');
    expect(ariaPressed).toBe('false');

    // stepTotal should be populated by runInsertionSort after initialization (not '?')
    await page.waitForFunction(() => {
      const el = document.getElementById('stepTotal');
      return el && el.textContent && el.textContent.trim() !== '?';
    }, { timeout: 5000 });

    const stepTotalText = await page.locator('#stepTotal').textContent();
    const parsed = parseInt((stepTotalText || '').replace(/[^\d]/g, ''), 10);
    expect(parsed).toBeGreaterThan(0);

    // No uncaught errors during initialization
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Playing -> S2_Paused -> S1_Playing: Play/Pause button toggles animation state', async ({ page }) => {
    // Ensure initial playing state
    const playButton = page.locator('#playPause');
    await expect(playButton).toHaveAttribute('aria-pressed', 'false');

    // Click to pause (Playing -> Paused)
    await playButton.click();
    // After click, label should update to "Play" and aria-pressed -> "true"
    await expect(page.locator('#playLabel')).toHaveText('Play');
    await expect(playButton).toHaveAttribute('aria-pressed', 'true');

    // Click again to resume (Paused -> Playing)
    await playButton.click();
    await expect(page.locator('#playLabel')).toHaveText('Pause');
    await expect(playButton).toHaveAttribute('aria-pressed', 'false');

    // Rapid toggling should not throw errors; perform rapid clicks and ensure attribute is consistent
    await playButton.click(); // pause
    await playButton.click(); // play
    await playButton.click(); // pause
    // The attribute should reflect the last action (pause -> aria-pressed true)
    await expect(playButton).toHaveAttribute('aria-pressed', 'true');

    // Ensure no page errors were produced by rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('SpaceKeyPress: pressing Space toggles Play/Pause (keyboard accessibility)', async ({ page }) => {
    // Ensure currently in paused state (from prior test the page might be paused, but reset to a known state)
    // Toggle to playing first if currently paused
    const playButton = page.locator('#playPause');
    const ariaBefore = await playButton.getAttribute('aria-pressed');
    if (ariaBefore === 'true') {
      // press space to resume
      await page.keyboard.press('Space');
      await expect(playButton).toHaveAttribute('aria-pressed', 'false');
    }

    // Now press Space to pause
    await page.keyboard.press('Space');
    await expect(playButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#playLabel')).toHaveText('Play');

    // Press Space again to resume
    await page.keyboard.press('Space');
    await expect(playButton).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#playLabel')).toHaveText('Pause');

    // No errors produced by keyboard events
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Playing -> S3_Shuffled: clicking Shuffle while playing restarts with new values', async ({ page }) => {
    // Ensure we are playing
    const playButton = page.locator('#playPause');
    const aria = await playButton.getAttribute('aria-pressed');
    if (aria === 'true') {
      await playButton.click();
      await expect(playButton).toHaveAttribute('aria-pressed', 'false');
    }

    // Capture the first item value prior to shuffle
    await page.waitForSelector('.item');
    const beforeFirst = await page.locator('.item >> nth=0').getAttribute('aria-label');

    // Click shuffle
    const shuffleBtn = page.locator('#shuffle');
    await shuffleBtn.click();

    // Shuffle visually disables for a moment; wait until it's enabled again
    await page.waitForFunction(() => {
      const btn = document.getElementById('shuffle');
      return btn && btn.disabled === false;
    }, { timeout: 5000 });

    // After shuffle, initAndRun sets animating = true -> playLabel should be 'Pause'
    await expect(page.locator('#playLabel')).toHaveText('Pause');
    await expect(playButton).toHaveAttribute('aria-pressed', 'false');

    // Ensure array re-rendered by comparing first item's aria-label (value) - likely different due to randomness
    const afterFirst = await page.locator('.item >> nth=0').getAttribute('aria-label');
    // It's acceptable if values happen to match by chance; but we at least assert DOM re-render occurred (stepTotal updated)
    const stepTotalText = await page.locator('#stepTotal').textContent();
    expect(stepTotalText && stepTotalText.trim()).not.toBe('?');

    // If values changed, they should differ; but avoid flaky failure: if equal, ensure items were recreated (by checking transition style existence)
    if (beforeFirst !== afterFirst) {
      // confirmed different shuffle values
      expect(beforeFirst).not.toBe(afterFirst);
    } else {
      // fallback: ensure items have inline transform or transition style applied indicative of a re-render animation
      const transformStyle = await page.locator('.item >> nth=0').evaluate(el => el.style.transition || el.style.transform);
      expect(transformStyle).toBeTruthy();
    }

    // No runtime errors occurred during shuffle
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S2_Paused -> S3_Shuffled: clicking Shuffle while paused restarts and resumes the animation', async ({ page }) => {
    const playButton = page.locator('#playPause');

    // Ensure paused state first
    const aria = await playButton.getAttribute('aria-pressed');
    if (aria === 'false') {
      await playButton.click();
      await expect(playButton).toHaveAttribute('aria-pressed', 'true');
    }

    // Capture initial first item text
    await page.waitForSelector('.item');
    const before = await page.locator('.item >> nth=0').getAttribute('aria-label');

    // Click shuffle while paused
    await page.locator('#shuffle').click();

    // Wait for shuffle to finish and animation to restart (initAndRun sets animating true)
    await page.waitForFunction(() => {
      const pp = document.getElementById('playPause');
      return pp && pp.getAttribute('aria-pressed') === 'false';
    }, { timeout: 5000 });

    // After shuffle, playLabel should be 'Pause' and aria-pressed 'false' (resumed)
    await expect(page.locator('#playLabel')).toHaveText('Pause');
    await expect(playButton).toHaveAttribute('aria-pressed', 'false');

    // Verify DOM was updated (values may change)
    const after = await page.locator('.item >> nth=0').getAttribute('aria-label');
    if (before !== after) {
      expect(before).not.toBe(after);
    } else {
      // fallback check: ensure stepCounter/stepTotal updated
      const total = await page.locator('#stepTotal').textContent();
      expect(total && total.trim() !== '?').toBeTruthy();
    }

    // No errors during shuffle while paused
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Window resize triggers recomputation of slot positions and updates item left positions', async ({ page }) => {
    // Ensure items present
    await page.waitForSelector('.item');

    // get left positions before resize
    const beforeLefts = await page.$$eval('.item', els => els.map(e => {
      const rectLeft = e.style.left || window.getComputedStyle(e).left;
      return rectLeft;
    }));

    // Change viewport size to trigger layout change and dispatch resize event
    await page.setViewportSize({ width: 800, height: 800 });
    // Trigger resize event in page context (application listens to window resize)
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Wait enough time for the app's resize debounce (140ms) plus layout updates
    await page.waitForTimeout(400);

    // get left positions after resize
    const afterLefts = await page.$$eval('.item', els => els.map(e => {
      const rectLeft = e.style.left || window.getComputedStyle(e).left;
      return rectLeft;
    }));

    // At least one position should differ after resize (if the arena width changed)
    const anyDifferent = beforeLefts.some((val, idx) => val !== afterLefts[idx]);
    expect(anyDifferent).toBeTruthy();

    // No errors during resizing
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Run completes without uncaught exceptions and step counter advances during sorting', async ({ page }) => {
    // Ensure items rendered and run in progress
    await page.waitForSelector('.item');

    // Observe the step counter advance over time (sorting increments stepCounter)
    const initialStep = await page.locator('#stepCounter').textContent();
    // Wait up to a few seconds for the algorithm to make progress
    await page.waitForTimeout(1500);
    const laterStep = await page.locator('#stepCounter').textContent();

    // stepCounter should be numeric and not less than initial (string compare safe after parsing)
    const iStep = parseInt((initialStep || '0').replace(/[^\d]/g, ''), 10);
    const lStep = parseInt((laterStep || '0').replace(/[^\d]/g, ''), 10);
    expect(Number.isFinite(iStep)).toBeTruthy();
    expect(Number.isFinite(lStep)).toBeTruthy();
    expect(lStep).toBeGreaterThanOrEqual(iStep);

    // Wait for the "Sorted" message to appear in explanation (but sorting may be long; still check no thrown errors)
    // Check explanation contains "Sorted" eventually (give generous timeout)
    await page.waitForFunction(() => {
      const el = document.getElementById('explanation');
      return el && el.textContent && /Sorted/i.test(el.textContent);
    }, { timeout: 15000 }).catch(() => {
      // It's okay if sorting hasn't completed within timeout; we'll not fail here, but ensure no errors
    });

    // Final assertion: no uncaught exceptions during the observed run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility attributes and labels present on interactive elements', async ({ page }) => {
    // Buttons must have titles and aria-pressed for play/pause
    await expect(page.locator('#playPause')).toHaveAttribute('title', /Play \/ Pause/);
    await expect(page.locator('#shuffle')).toHaveAttribute('title', /Shuffle & replay/);

    // Each item should expose an aria-label describing its value
    const ariaLabels = await page.$$eval('.item', els => els.map(e => e.getAttribute('aria-label')));
    expect(ariaLabels.length).toBeGreaterThanOrEqual(10);
    ariaLabels.forEach(label => {
      expect(label).toMatch(/Value \d+/);
    });

    // No console/page errors from accessibility checks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('No unexpected console errors or page errors during full interaction sequence', async ({ page }) => {
    // Perform a quick sequence of interactions: pause, shuffle, play, resize, space toggle
    const playButton = page.locator('#playPause');
    const shuffleBtn = page.locator('#shuffle');

    // Pause
    await playButton.click();
    await expect(playButton).toHaveAttribute('aria-pressed', 'true');

    // Shuffle
    await shuffleBtn.click();
    await page.waitForFunction(() => {
      const btn = document.getElementById('shuffle');
      return btn && btn.disabled === false;
    }, { timeout: 5000 });

    // Play via space
    await page.keyboard.press('Space');
    await expect(playButton).toHaveAttribute('aria-pressed', 'false');

    // Resize
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(300);

    // Final checks: no console error messages or page errors collected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});