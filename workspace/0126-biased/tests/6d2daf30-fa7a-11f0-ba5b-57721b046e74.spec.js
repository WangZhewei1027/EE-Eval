import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2daf30-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Interactive Bubble Sort - FSM and UI validation (Application ID: 6d2daf30-fa7a-11f0-ba5b-57721b046e74)', () => {
  // Collect console errors and page errors to assert runtime health during each test.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page fresh for each test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Make sure no unexpected runtime errors were emitted to console or as page errors.
    // These assertions ensure we observed and checked runtime issues as part of the testing contract.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.toString()).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(c => c.text).join(' | ')}`).toBe(0);
  });

  // Helper to set a range input's value and dispatch input event so page reacts.
  async function setRangeValue(page, selector, value) {
    await page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      { selector, value: String(value) }
    );
  }

  test.describe('State: Idle (S0_Idle) and basic UI presence', () => {
    test('Initial Idle state: status text, controls, and array rendered', async ({ page }) => {
      // Validate initial status text and controls are in the Idle state.
      const status = page.locator('#status');
      await expect(status).toHaveText('Status: Ready. Generate array or use custom array to begin.');

      const startBtn = page.locator('#start');
      const pauseBtn = page.locator('#pause');
      const stepBtn = page.locator('#step');

      // Start should be enabled, pause and step disabled initially
      await expect(startBtn).toBeEnabled();
      await expect(pauseBtn).toBeDisabled();
      await expect(stepBtn).toBeDisabled();

      // Array size control default value shown
      const arraySizeValue = page.locator('#arraySizeValue');
      await expect(arraySizeValue).toHaveText(/\d+/);

      // The array container should render 'array-bar' elements equal to the current array size value
      const sizeText = await arraySizeValue.textContent();
      const expectedCount = parseInt(sizeText || '15', 10);
      const bars = page.locator('.array-bar');
      await expect(bars).toHaveCount(expectedCount);
    });
  });

  test.describe('Events: GenerateNewArray, UseCustomArray, ResetSorting (transitions from Idle)', () => {
    test('Generate New Array updates status and re-renders array', async ({ page }) => {
      // Click Generate New Array and verify status update and array re-render
      const status = page.locator('#status');
      const generateBtn = page.locator('#generate');

      await generateBtn.click();
      await expect(status).toHaveText('New array generated. Ready to sort.');

      // After generating, array bars should match the selected size
      const sizeText = await page.locator('#arraySizeValue').textContent();
      const expectedCount = parseInt(sizeText || '15', 10);
      await expect(page.locator('.array-bar')).toHaveCount(expectedCount);
    });

    test('Use Custom Array: valid input loads array and updates UI', async ({ page }) => {
      // Provide valid custom array input and ensure it is loaded and UI updated
      const input = page.locator('#arrayInput');
      const useCustom = page.locator('#useCustom');
      const status = page.locator('#status');

      await input.fill('5,3,8,1,2');
      await useCustom.click();

      await expect(status).toHaveText('Custom array loaded. Ready to sort.');

      // Array container should have 5 bars and labels should show values (showValues is checked by default)
      await expect(page.locator('.array-bar')).toHaveCount(5);

      // Check that the first few bar labels contain the values given (order preserved)
      const firstBarLabel = await page.locator('.array-container .array-bar >> nth=0 >> div').textContent();
      const secondBarLabel = await page.locator('.array-container .array-bar >> nth=1 >> div').textContent();
      expect(firstBarLabel).toBeTruthy();
      expect(secondBarLabel).toBeTruthy();
      // labels correspond to numeric values because showValues is checked by default
      expect(['5', '3', '8', '1', '2']).toContain(firstBarLabel.trim());
    });

    test('Use Custom Array: invalid input shows error message', async ({ page }) => {
      // Provide invalid input that should trigger an error branch
      const input = page.locator('#arrayInput');
      const useCustom = page.locator('#useCustom');
      const status = page.locator('#status');

      await input.fill('a,b,10');
      await useCustom.click();

      await expect(status).toHaveText(/Error: Invalid number/);
    });

    test('Reset while Idle leaves page in Idle state', async ({ page }) => {
      const resetBtn = page.locator('#reset');
      const status = page.locator('#status');

      await resetBtn.click();
      await expect(status).toHaveText('Reset. Ready to sort.');

      // After reset ensure start enabled and pause/step disabled
      await expect(page.locator('#start')).toBeEnabled();
      await expect(page.locator('#pause')).toBeDisabled();
      await expect(page.locator('#step')).toBeDisabled();
    });
  });

  test.describe('Transitions: StartSort (S1_Sorting), Pause/Resume (S2_Paused), Step (StepSorting), Complete (S3_Completed)', () => {
    test('Start Sort enables sorting controls and changes status', async ({ page }) => {
      // Use a small custom array to keep operations deterministic
      await page.locator('#arrayInput').fill('4,3,2,1');
      await page.locator('#useCustom').click();

      // Speed up the interval to make tests run fast
      await setRangeValue(page, '#speed', 10);
      await page.locator('#start').click();

      // Verify start actions: status text and control states
      await expect(page.locator('#status')).toHaveText('Sorting in progress...');
      await expect(page.locator('#start')).toBeDisabled();
      await expect(page.locator('#pause')).toBeEnabled();
      await expect(page.locator('#step')).toBeEnabled();
      await expect(page.locator('#generate')).toBeDisabled();
      await expect(page.locator('#useCustom')).toBeDisabled();
    });

    test('Pause and Resume toggle (S1 -> S2 -> S1) updates status and button text', async ({ page }) => {
      // Setup and start sorting
      await page.locator('#arrayInput').fill('6,5,4,3');
      await page.locator('#useCustom').click();
      await setRangeValue(page, '#speed', 10);
      await page.locator('#start').click();

      const pauseBtn = page.locator('#pause');
      const status = page.locator('#status');

      // Pause sorting
      await pauseBtn.click();
      await expect(status).toHaveText('Sorting paused.');
      await expect(pauseBtn).toHaveText('Resume');

      // Resume sorting
      await pauseBtn.click();
      await expect(status).toHaveText('Sorting resumed...');
      await expect(pauseBtn).toHaveText('Pause');
    });

    test('Step while sorting performs at least one comparison and potential swap', async ({ page }) => {
      // Custom array where a swap is expected in ascending sort: [2,1]
      await page.locator('#arrayInput').fill('2,1');
      await page.locator('#useCustom').click();

      // Set speed high for quick timeouts
      await setRangeValue(page, '#speed', 10);

      // Start sorting (enables step)
      await page.locator('#start').click();

      // Click step to force a performStep call while the interval is also active
      await page.locator('#step').click();

      // Wait until status reports a swap (the code uses setTimeout to display 'Swapped elements...' after half interval)
      await page.waitForFunction(() => {
        const s = document.getElementById('status');
        return s && /Swapped elements at indices/.test(s.textContent || '');
      }, { timeout: 2000 });

      // Validate that bars reflect the swapped values: first bar label should now be '1'
      const firstLabel = await page.locator('.array-container .array-bar >> nth=0 >> div').textContent();
      const secondLabel = await page.locator('.array-container .array-bar >> nth=1 >> div').textContent();

      // After swap in ascending, array becomes [1,2]
      expect(firstLabel.trim()).toBe('1');
      expect(secondLabel.trim()).toBe('2');
    });

    test('Sorting completes (S1 -> S3) and marks all elements sorted', async ({ page }) => {
      // Use a small array to allow the sort to finish quickly
      await page.locator('#arrayInput').fill('3,2,1');
      await page.locator('#useCustom').click();
      await setRangeValue(page, '#speed', 10);

      await page.locator('#start').click();

      // Wait for completion message; bubble sort will finish in a small number of steps
      await page.waitForFunction(() => {
        const s = document.getElementById('status');
        return s && /Sorting complete! Total passes:/.test(s.textContent || '');
      }, { timeout: 5000 });

      // Verify final UI state: all bars have 'sorted' class
      const barsCount = await page.locator('.array-bar').count();
      let sortedCount = 0;
      for (let i = 0; i < barsCount; i++) {
        const cls = await page.locator(`.array-container .array-bar >> nth=${i}`).getAttribute('class');
        if (cls && cls.includes('sorted')) sortedCount++;
      }
      expect(sortedCount).toBe(barsCount);

      // Buttons should reflect completion: start enabled, pause/step disabled, generate/useCustom enabled
      await expect(page.locator('#start')).toBeEnabled();
      await expect(page.locator('#pause')).toBeDisabled();
      await expect(page.locator('#step')).toBeDisabled();
      await expect(page.locator('#generate')).toBeEnabled();
      await expect(page.locator('#useCustom')).toBeEnabled();

      // Status contains details about passes and swaps
      const statusText = await page.locator('#status').textContent();
      expect(statusText).toMatch(/Sorting complete! Total passes: \d+, total swaps: \d+/);
    });

    test('Reset after sorting returns UI to Idle (S3 -> S0)', async ({ page }) => {
      // Create a quick-to-complete scenario
      await page.locator('#arrayInput').fill('2,1');
      await page.locator('#useCustom').click();
      await setRangeValue(page, '#speed', 10);
      await page.locator('#start').click();

      // Wait for completion
      await page.waitForFunction(() => {
        const s = document.getElementById('status');
        return s && /Sorting complete! Total passes:/.test(s.textContent || '');
      }, { timeout: 5000 });

      // Click reset and verify Idle state
      await page.locator('#reset').click();
      await expect(page.locator('#status')).toHaveText('Reset. Ready to sort.');

      // Algorithm details should be reset
      await expect(page.locator('#currentPass')).toHaveText('0');
      await expect(page.locator('#currentComparison')).toHaveText('0');
      await expect(page.locator('#totalSwaps')).toHaveText('0');
    });
  });

  test.describe('Options and display toggles: direction, showValues, showIndices', () => {
    test('Change sorting direction to descending results in descending sorted array', async ({ page }) => {
      // Use ascending input array and request descending sort to validate direction handling
      await page.locator('#arrayInput').fill('1,2,3');
      await page.locator('#useCustom').click();

      // Set direction to descending
      await page.locator('input[name="direction"][value="desc"]').click();

      // Speed up and start
      await setRangeValue(page, '#speed', 10);
      await page.locator('#start').click();

      // Wait for completion
      await page.waitForFunction(() => {
        const s = document.getElementById('status');
        return s && /Sorting complete! Total passes:/.test(s.textContent || '');
      }, { timeout: 5000 });

      // After completion, assert that bars are in descending numeric order: ['3','2','1']
      const labels = [];
      const barsCount = await page.locator('.array-bar').count();
      for (let i = 0; i < barsCount; i++) {
        const txt = await page.locator(`.array-container .array-bar >> nth=${i} >> div`).textContent();
        labels.push(txt ? txt.trim().split(/\s/)[0] : '');
      }

      expect(labels.join(',')).toBe('3,2,1');
    });

    test('Toggle Show Values and Show Indices updates bar labels accordingly', async ({ page }) => {
      // Load a known custom array
      await page.locator('#arrayInput').fill('7,8,9');
      await page.locator('#useCustom').click();

      // By default showValues is checked and showIndices unchecked
      // Verify first label shows value "7"
      const firstLabel = await page.locator('.array-container .array-bar >> nth=0 >> div').textContent();
      expect(firstLabel.trim()).toContain('7');

      // Uncheck showValues - labels should become empty (unless showIndices is checked)
      await page.locator('#showValues').click();
      // After toggling, renderArray is called via change event; wait a tick for DOM update
      await page.waitForTimeout(100);

      const firstLabelAfterHide = await page.locator('.array-container .array-bar >> nth=0 >> div').textContent();
      expect(firstLabelAfterHide.trim()).toBe('');

      // Check showIndices - labels should now show indices (0,1,2)
      await page.locator('#showIndices').click();
      await page.waitForTimeout(100);
      const firstLabelIndex = await page.locator('.array-container .array-bar >> nth=0 >> div').textContent();
      expect(firstLabelIndex.trim()).toBe('0');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Attempt to Generate New Array while sorting should be prevented (generate button disabled during sort)', async ({ page }) => {
      // Start sorting to make generate btn disabled
      await page.locator('#arrayInput').fill('10,9,8,7,6');
      await page.locator('#useCustom').click();
      await setRangeValue(page, '#speed', 10);
      await page.locator('#start').click();

      // Generate button should be disabled while sorting is in progress
      await expect(page.locator('#generate')).toBeDisabled();

      // Try clicking generate (should have no effect); just ensure no errors thrown and status remains sorting/resumed/comparing
      await page.locator('#generate').click({ timeout: 100 }).catch(() => {});
      const statusText = await page.locator('#status').textContent();
      expect(statusText).toMatch(/Sorting (in progress|resumed|paused|complete)!?/i);
    });

    test('Use Custom Array with too few elements should show validation error', async ({ page }) => {
      // Provide custom array with only one element
      await page.locator('#arrayInput').fill('5');
      await page.locator('#useCustom').click();

      await expect(page.locator('#status')).toHaveText(/Error: Array must have at least 2 elements/);
    });
  });
});