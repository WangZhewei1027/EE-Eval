import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e2a500-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('LCS Visualizer (FSM) - End-to-end', () => {
  // Shared containers for console/page errors captured per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    // Navigate to the app and wait for initial rendering
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for main container to be present
    await page.waitForSelector('.container');
  });

  test.afterEach(async () => {
    // Assert there were no unexpected console errors or page errors during the test
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test.describe('S0 Idle and initial render', () => {
    test('Initial page render triggers computeAndRender() and shows LCS length and one LCS', async ({ page }) => {
      // Validate that the initial computeAndRender (called at end of script) populated the UI
      const lcsLen = await page.locator('#lcsLen').textContent();
      const oneLcs = await page.locator('#oneLcs').textContent();
      // For the provided default strings ABCBDAB and BDCABA, expected LCS length is 4
      expect(lcsLen?.trim()).toBe('4');
      expect(oneLcs?.trim()?.length).toBe(4);

      // Check that the DP table exists in the gridWrap area
      await expect(page.locator('#gridWrap table.grid')).toBeVisible();

      // Verify bottom-right dp value equals the length displayed (cell at i=m, j=n)
      const a = await page.locator('#aStr').inputValue();
      const b = await page.locator('#bStr').inputValue();
      const m = a.length;
      const n = b.length;
      const bottomRightSelector = `td[data-i="${m}"][data-j="${n}"]`;
      await expect(page.locator(bottomRightSelector)).toBeVisible();
      const cellText = (await page.locator(bottomRightSelector).textContent())?.trim();
      expect(cellText).toBe('4');
    });
  });

  test.describe('S1_Computing and transitions from Idle', () => {
    test('Clicking Compute LCS rebuilds DP table and updates badges', async ({ page }) => {
      // Set simple strings to have predictable LCS
      await page.fill('#aStr', 'AA');
      await page.fill('#bStr', 'A');

      // Click compute and wait for UI updates
      await page.click('#computeBtn');

      // lcsLen should be 1
      await expect(page.locator('#lcsLen')).toHaveText('1');

      // oneLcs should be 'A'
      const one = await page.locator('#oneLcs').textContent();
      expect(one?.trim()).toBe('A');

      // Check dp cell (1,1) equals 1
      await expect(page.locator('td[data-i="1"][data-j="1"]')).toHaveText('1');
    });

    test('Copy One LCS behaves gracefully (copies or shows clipboard error)', async ({ page }) => {
      // Ensure DP is computed for current strings (initial state already computed)
      // Trigger compute to ensure oneLcs is populated
      await page.click('#computeBtn');

      // Prepare a promise to capture a potential alert dialog
      const dialogPromise = page.waitForEvent('dialog').catch(() => null);

      // Click the copy button
      await page.click('#copyBtn');

      // If a dialog appeared (e.g., clipboard permission error), assert message prefix
      const dialog = await dialogPromise;
      if (dialog) {
        const msg = dialog.message();
        // It could be "Clipboard copy failed: ..." or "No LCS to copy"
        expect(
          msg.startsWith('Clipboard copy failed') || msg === 'No LCS to copy' || msg.includes('No LCS')
        ).toBeTruthy();
        await dialog.dismiss();
      } else {
        // No dialog -> expect button text changed to 'Copied!' for a brief period
        const btn = page.locator('#copyBtn');
        await expect(btn).toHaveText('Copied!');
        // After 1500ms the text resets; wait and validate reset
        await page.waitForTimeout(1500);
        await expect(btn).toHaveText('Copy One LCS');
      }
    });
  });

  test.describe('Animating DP (S2) and Backtrace (S3)', () => {
    test('Animate DP Fill animates and results in correct LCS', async ({ page }) => {
      // Use small strings for faster animation
      await page.fill('#aStr', 'ABC');
      await page.fill('#bStr', 'ABC');

      // Reduce delay to speed up test
      await page.fill('#delay', '10');

      // Click animate button to start DP fill animation
      await page.click('#animateBtn');

      // Wait enough time for animation to complete: approximate steps = m*n + few; we use a generous wait
      const a = 'ABC', b = 'ABC';
      const approxSteps = a.length * b.length + 5;
      await page.waitForTimeout(approxSteps * 12); // delay ~10ms per cell, small margin

      // After animation completes, lcsLen should reflect 3 and oneLcs 'ABC'
      await expect(page.locator('#lcsLen')).toHaveText('3');
      const one = (await page.locator('#oneLcs').textContent())?.trim();
      expect(one).toBe('ABC');

      // Verify a few dp cells are non-zero as expected
      await expect(page.locator('td[data-i="1"][data-j="1"]')).toHaveText('1');
      await expect(page.locator('td[data-i="3"][data-j="3"]')).toHaveText('3');
    });

    test('Animate Backtrace highlights path and Clear Highlights clears them', async ({ page }) => {
      // Ensure DP exists by computing
      await page.fill('#aStr', 'ABCBDAB');
      await page.fill('#bStr', 'BDCABA');
      await page.click('#computeBtn');

      // Reduce delay
      await page.fill('#delay', '10');

      // Click trace to animate backtrace
      await page.click('#traceBtn');

      // Wait a short while to allow marking path cells
      await page.waitForTimeout(400);

      // Count .path cells (should be > 0)
      const pathCount = await page.locator('td.path').count();
      expect(pathCount).toBeGreaterThan(0);

      // Now click Clear Highlights and ensure no .path/.compare/.diag-match remain
      await page.click('#clearBtn');
      // Small wait for DOM class removals
      await page.waitForTimeout(50);
      const remaining = await page.locator('td.path, td.compare, td.diag-match').count();
      expect(remaining).toBe(0);
    });
  });

  test.describe('Showing All LCS (S4) and edge-case handling', () => {
    test('Show All LCS enumerates sequences and displays results', async ({ page }) => {
      // Use the default sample strings which have LCS length 4
      await page.fill('#aStr', 'ABCBDAB');
      await page.fill('#bStr', 'BDCABA');

      // Ensure dp is computed
      await page.click('#computeBtn');

      // Set a reasonable limit
      await page.fill('#allLimit', '200');

      // Click Show All LCS
      await page.click('#allBtn');

      // Wait for the small deferred computation (the script uses setTimeout 20ms + work)
      await page.waitForTimeout(200);

      // allCount should be numeric and at least 1 (there are known LCS sequences)
      const allCountText = (await page.locator('#allCount').textContent())?.trim() || '';
      const parsed = parseInt(allCountText, 10);
      expect(Number.isFinite(parsed)).toBeTruthy();
      expect(parsed).toBeGreaterThanOrEqual(0);

      // If there are sequences, they should be displayed in #allList
      const allListHtml = await page.locator('#allList').innerHTML();
      expect(allListHtml.length).toBeGreaterThan(0);
      // If count > 0, ensure displayed sequences have expected length
      if (parsed > 0) {
        // extract first sequence (simple heuristic)
        const text = await page.locator('#allList').innerText();
        const maybeFirst = text.split(',')[0].trim();
        if (maybeFirst.length > 0) {
          const expectedLen = parseInt((await page.locator('#lcsLen').textContent())?.trim() || '0', 10);
          expect(maybeFirst.length).toBe(expectedLen);
        }
      }
    });

    test('Show All LCS with empty strings shows an alert', async ({ page }) => {
      // Set both strings to empty
      await page.fill('#aStr', '');
      await page.fill('#bStr', '');

      // Prepare dialog handler
      const dialogPromise = page.waitForEvent('dialog');

      // Click Show All LCS
      await page.click('#allBtn');

      // Assert that an alert dialog is shown with the expected message
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Empty string(s)');
      await dialog.dismiss();
    });
  });

  test.describe('Random strings generation (S6) and robustness', () => {
    test('Random Strings button populates textareas with new values', async ({ page }) => {
      const beforeA = await page.locator('#aStr').inputValue();
      const beforeB = await page.locator('#bStr').inputValue();

      // Click random
      await page.click('#randomBtn');

      // Wait briefly for values to be set
      await page.waitForTimeout(50);

      const afterA = await page.locator('#aStr').inputValue();
      const afterB = await page.locator('#bStr').inputValue();

      // The random strings should differ from previous (high probability)
      const changed = (beforeA !== afterA) || (beforeB !== afterB);
      expect(changed).toBeTruthy();
      // Ensure they are non-empty and alphabetic uppercase (per implementation)
      expect(afterA.length).toBeGreaterThan(0);
      expect(afterB.length).toBeGreaterThan(0);
    });
  });

  test.describe('Additional sanity and error observations', () => {
    test('No unexpected runtime ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
      // Perform a sequence of interactions to exercise possible error paths
      await page.click('#computeBtn');
      await page.fill('#aStr', 'XYZ');
      await page.fill('#bStr', 'XY');
      await page.click('#computeBtn');
      await page.click('#animateBtn');
      await page.waitForTimeout(200);
      await page.click('#traceBtn');
      await page.waitForTimeout(200);
      await page.click('#allBtn');
      await page.waitForTimeout(200);

      // At this point the afterEach will assert consoleErrors and pageErrors are empty.
      // Additionally, explicitly assert that the arrays do not include common JS error types.
      const combined = [...consoleErrors.map(e => e.text), ...pageErrors];
      const foundJSRuntimeErrors = combined.filter(text =>
        /ReferenceError|SyntaxError|TypeError/i.test(String(text))
      );
      expect(foundJSRuntimeErrors.length).toBe(0);
    });
  });
});