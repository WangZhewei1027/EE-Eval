import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e933e9a2-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Linear Search Visualizer — FSM coverage (e933e9a2-d360-11f0-a097-ffdd56c22ef4)', () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a little to let the initialization run
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // Basic assertion: no uncaught exceptions during test run
    // We assert that pageErrors is an array (could be empty)
    expect(Array.isArray(pageErrors)).toBeTruthy();
    // For transparency, assert there were no uncaught page errors
    expect(pageErrors).toEqual([]);
    // Also assert there are no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors).toEqual([]);
    // Ensure page remains reachable
    await expect(page).toHaveURL(/e933e9a2-d360-11f0-a097-ffdd56c22ef4.html/);
  });

  test.describe('Initial state (S0_Idle) and UI basics', () => {
    test('Initial render: array visual, pseudocode highlight, status badges', async ({ page }) => {
      // Verify array visual rendered with default size (sizeInput default 10)
      const cells = await page.$$eval('#arrayVisual .cell', els => els.map(e => e.textContent.trim()));
      expect(cells.length).toBeGreaterThanOrEqual(1);
      // idx should be 0 initially
      const idxText = await page.locator('#idx').textContent();
      expect(idxText.trim()).toBe('0');
      // comparisons should be 0
      const compText = await page.locator('#comp').textContent();
      expect(compText.trim()).toBe('0');
      // pseudocode line 1 should be active
      const activeLine = await page.locator('#pseudocode .line.active').getAttribute('data-line');
      expect(activeLine).toBe('1');
      // target input should be pre-filled by init
      const targetVal = await page.locator('#targetInput').inputValue();
      // should be a numeric-ish string (can be negative/positive)
      expect(targetVal).not.toBe('');
      // result text should be empty initially (init did not call setTarget)
      const resultText = await page.locator('#resultText').textContent();
      expect(resultText.trim()).toBe('');
    });
  });

  test.describe('Array operations (S4_Array_Set, S7_Array_Shuffled, S8_Array_Generated)', () => {
    test('Set a custom array updates visual (S4_Array_Set)', async ({ page }) => {
      // Put a known array and set it
      await page.fill('#arrayInput', '10, 20, 30, 40');
      await page.click('#setArrayBtn');
      // After setting, arrayVisual should reflect 4 items
      await page.waitForTimeout(100);
      const cells = await page.$$eval('#arrayVisual .cell .val', els => els.map(e => e.textContent.trim()));
      expect(cells).toEqual(['10', '20', '30', '40']);
      // comparisons and idx reset
      expect((await page.locator('#comp').textContent()).trim()).toBe('0');
      expect((await page.locator('#idx').textContent()).trim()).toBe('0');
      // The first cell should have .current class
      const firstCellClass = await page.locator('#arrayVisual .cell').nth(0).getAttribute('class');
      expect(firstCellClass).toContain('current');
    });

    test('Shuffle array preserves multiset and keeps index reset (S7_Array_Shuffled)', async ({ page }) => {
      // Ensure we have a known array first
      await page.fill('#arrayInput', '1,2,3,4,5');
      await page.click('#setArrayBtn');
      await page.waitForTimeout(50);
      const before = await page.$$eval('#arrayVisual .cell .val', els => els.map(e => e.textContent.trim()));
      // Click shuffle
      await page.click('#shuffleBtn');
      await page.waitForTimeout(100);
      const after = await page.$$eval('#arrayVisual .cell .val', els => els.map(e => e.textContent.trim()));
      // Length should be the same
      expect(after.length).toBe(before.length);
      // Multiset equality: sort and compare
      const beforeSorted = before.slice().sort();
      const afterSorted = after.slice().sort();
      expect(afterSorted).toEqual(beforeSorted);
      // idx and comps reset
      expect((await page.locator('#idx').textContent()).trim()).toBe('0');
      expect((await page.locator('#comp').textContent()).trim()).toBe('0');
    });

    test('Generate random array updates textarea and visual (S8_Array_Generated)', async ({ page }) => {
      // Set size and min/max to controlled values
      await page.fill('#sizeInput', '6');
      await page.fill('#minVal', '5');
      await page.fill('#maxVal', '9');
      await page.click('#genBtn');
      // Wait for generation/render
      await page.waitForTimeout(100);
      const arrText = await page.locator('#arrayInput').inputValue();
      expect(arrText).not.toBe('');
      const parsed = arrText.split(',').map(s => s.trim()).filter(Boolean);
      expect(parsed.length).toBeGreaterThanOrEqual(1);
      // visual length matches parsed
      const visual = await page.$$eval('#arrayVisual .cell .val', els => els.map(e => e.textContent.trim()));
      expect(visual.length).toBe(parsed.length);
      // All values are within min/max bounds
      for (const v of parsed) {
        const num = Number(v);
        expect(num).toBeGreaterThanOrEqual(5);
        expect(num).toBeLessThanOrEqual(9);
      }
    });
  });

  test.describe('Target operations (S5_Target_Set, S6_Target_Cleared, S9_Random_Target_Set)', () => {
    test('Set target via input sets target and resets state (S5_Target_Set)', async ({ page }) => {
      // Make a small array for determinism
      await page.fill('#arrayInput', '100,200,300');
      await page.click('#setArrayBtn');
      await page.waitForTimeout(50);
      // Enter target and set
      await page.fill('#targetInput', '200');
      // Listen for any dialog (should not be one)
      const [dialogPromise] = await Promise.all([
        page.waitForEvent('dialog').catch(() => null),
        page.click('#setTargetBtn')
      ]);
      // No dialog expected
      expect(dialogPromise).toBeNull();
      // resultText should show 'Target set to 200.'
      await expect(page.locator('#resultText')).toHaveText(/Target set to 200\./);
      // idx and comparisons reset
      expect((await page.locator('#idx').textContent()).trim()).toBe('0');
      expect((await page.locator('#comp').textContent()).trim()).toBe('0');
      // targetInput shows 200
      expect(await page.locator('#targetInput').inputValue()).toBe('200');
    });

    test('Clear target clears input and result (S6_Target_Cleared)', async ({ page }) => {
      // Ensure some target exists
      await page.fill('#targetInput', '77');
      await page.click('#setTargetBtn');
      await page.waitForTimeout(50);
      // Now clear
      await page.click('#clearTargetBtn');
      await page.waitForTimeout(50);
      // targetInput should be empty
      expect((await page.locator('#targetInput').inputValue())).toBe('');
      // result text cleared
      expect((await page.locator('#resultText').textContent()).trim()).toBe('');
      // comparisons reset
      expect((await page.locator('#comp').textContent()).trim()).toBe('0');
    });

    test('Random target selects a value from array (S9_Random_Target_Set)', async ({ page }) => {
      // Ensure array exists
      await page.fill('#arrayInput', '7,8,9');
      await page.click('#setArrayBtn');
      await page.waitForTimeout(50);
      // Click random target
      await page.click('#randTargetBtn');
      await page.waitForTimeout(50);
      const targetVal = await page.locator('#targetInput').inputValue();
      expect(['7', '8', '9']).toContain(targetVal);
      await expect(page.locator('#resultText')).toHaveText(new RegExp(`Target set to ${targetVal}\\.`));
    });
  });

  test.describe('Search controls (S1_Stepping, S2_Playing, S3_Reset, SpeedChange)', () => {
    test('Step finds target at index 0 (S1_Stepping -> Found)', async ({ page }) => {
      // Set array and target at index 0
      await page.fill('#arrayInput', '42,43,44');
      await page.click('#setArrayBtn');
      await page.waitForTimeout(50);
      await page.fill('#targetInput', '42');
      await page.click('#setTargetBtn');
      await page.waitForTimeout(50);
      // Click step: should immediately find at index 0
      await page.click('#stepBtn');
      await page.waitForTimeout(100);
      // comparisons should be 1 and resultText should indicate found
      expect((await page.locator('#comp').textContent()).trim()).toBe('1');
      const firstCellClass = await page.locator('#arrayVisual .cell').nth(0).getAttribute('class');
      expect(firstCellClass).toContain('found');
      await expect(page.locator('#resultText')).toHaveText(/Found target 42 at index 0 \(comparisons: 1\)/);
    });

    test('Step through until not found updates comparisons and result (S1_Stepping -> NotFound)', async ({ page }) => {
      // Small array where target is not present
      await page.fill('#arrayInput', '1,2');
      await page.click('#setArrayBtn');
      await page.waitForTimeout(50);
      await page.fill('#targetInput', '99');
      await page.click('#setTargetBtn');
      await page.waitForTimeout(50);
      // Step twice to finish
      await page.click('#stepBtn'); // compares index 0
      await page.waitForTimeout(50);
      await page.click('#stepBtn'); // compares index 1 -> finish not found
      await page.waitForTimeout(100);
      expect((await page.locator('#comp').textContent()).trim()).toBe('2');
      await expect(page.locator('#resultText')).toHaveText(/not found/);
      // All cells should have visited class
      const classes = await page.$$eval('#arrayVisual .cell', els => els.map(e => e.className));
      for (const c of classes) {
        expect(c).toContain('visited');
      }
    });

    test('Play runs until found and can be paused/resumed (S2_Playing)', async ({ page }) => {
      // Prepare array where target is at last index to ensure multiple steps
      await page.fill('#arrayInput', '5,6,7,8,9');
      await page.click('#setArrayBtn');
      await page.waitForTimeout(50);
      await page.fill('#targetInput', '9');
      await page.click('#setTargetBtn');
      await page.waitForTimeout(50);
      // Speed up timer
      await page.fill('#speedRange', '150');
      await page.dispatchEvent('#speedRange', 'input');
      // Start playing
      await page.click('#playBtn');
      // Immediately playBtn shows Pause or may quickly revert when finished; wait for result
      await page.waitForSelector('#resultText', { state: 'visible', timeout: 5000 });
      // Eventually the result should indicate found at index 4
      await expect(page.locator('#resultText')).toHaveText(/Found target 9 at index 4/);
      // Ensure comparisons equals 5
      expect((await page.locator('#comp').textContent()).trim()).toBe('5');
      // Now click playBtn to toggle (if it hasn't already stopped). We ensure it is not throwing.
      await page.click('#playBtn');
      await page.waitForTimeout(100);
      // Play button text should be 'Play' at this point
      const playText = await page.locator('#playBtn').textContent();
      expect(playText.trim()).toBe('Play');
    });

    test('Reset clears search state but keeps array (S3_Reset)', async ({ page }) => {
      // Prepare array and do a step to change state
      await page.fill('#arrayInput', '11,12,13');
      await page.click('#setArrayBtn');
      await page.waitForTimeout(50);
      await page.fill('#targetInput', '500'); // not in array
      await page.click('#setTargetBtn');
      await page.waitForTimeout(50);
      await page.click('#stepBtn');
      await page.waitForTimeout(50);
      // Now reset
      await page.click('#resetBtn');
      await page.waitForTimeout(50);
      // comparisons reset and idx reset to 0 and result cleared
      expect((await page.locator('#comp').textContent()).trim()).toBe('0');
      expect((await page.locator('#idx').textContent()).trim()).toBe('0');
      expect((await page.locator('#resultText').textContent()).trim()).toBe('');
      // Array should remain intact
      const visual = await page.$$eval('#arrayVisual .cell .val', els => els.map(e => e.textContent.trim()));
      expect(visual).toEqual(['11', '12', '13']);
    });

    test('Changing speed updates label and restarts timer if playing (SpeedChange)', async ({ page }) => {
      // Setup an array where target is not at 0 so play runs
      await page.fill('#arrayInput', '21,22,23');
      await page.click('#setArrayBtn');
      await page.waitForTimeout(50);
      await page.fill('#targetInput', '23');
      await page.click('#setTargetBtn');
      await page.waitForTimeout(50);
      // Start playing
      await page.click('#playBtn');
      await page.waitForTimeout(50);
      // Change speed value
      await page.fill('#speedRange', '300');
      await page.dispatchEvent('#speedRange', 'input');
      // The speed label should update
      await expect(page.locator('#speedLabel')).toHaveText(/300ms/);
      // Wait for the search to finish
      await page.waitForFunction(() => {
        const rt = document.getElementById('resultText');
        return rt && rt.textContent && (rt.textContent.indexOf('Found') !== -1 || rt.textContent.indexOf('not found') !== -1);
      }, { timeout: 3000 });
      // Verify no errors occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking step without a target shows alert (edge case)', async ({ page }) => {
      // Clear targetInput
      await page.fill('#targetInput', '');
      // Intercept dialog
      const dialog = await page.waitForEvent('dialog', { timeout: 2000 }).catch(() => null);
      // Trigger step click and expect an alert
      const clickPromise = page.click('#stepBtn');
      // Wait for dialog to appear
      const dlg = await page.waitForEvent('dialog');
      expect(dlg).not.toBeNull();
      expect(dlg.message()).toContain('Set a target value first');
      await dlg.accept();
      await clickPromise;
    });

    test('Set array with invalid number shows alert (error scenario)', async ({ page }) => {
      // Fill invalid array input
      await page.fill('#arrayInput', '1, two, 3');
      // Listen for dialog and capture message
      const [dlg] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#setArrayBtn')
      ]);
      expect(dlg.message()).toContain('Invalid number in array: two');
      await dlg.accept();
      // Ensure array did not change to invalid content: arrayInput still contains our text but render did not proceed
      const arrVal = await page.locator('#arrayInput').inputValue();
      expect(arrVal).toBe('1, two, 3');
    });

    test('Set target with empty input shows alert (error scenario)', async ({ page }) => {
      await page.fill('#targetInput', '');
      const [dlg] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#setTargetBtn')
      ]);
      expect(dlg.message()).toContain('Enter a numeric target.');
      await dlg.accept();
    });
  });
});