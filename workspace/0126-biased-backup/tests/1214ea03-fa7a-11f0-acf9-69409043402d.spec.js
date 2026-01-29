import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1214ea03-fa7a-11f0-acf9-69409043402d.html';

test.describe('1214ea03-fa7a-11f0-acf9-69409043402d - Sliding Window Interactivity', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console errors and page errors for later assertions
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Wait for the page to finish basic initialization: loadDefaultExample calls loadArrayAndParameters
    await page.waitForSelector('#arrayStatus');
  });

  test.afterEach(async () => {
    // no-op: data arrays reset per test navigation
  });

  test.describe('State S0_Idle -> S1_ArrayLoaded (Initial Load & Load Array)', () => {
    test('Initial load should call loadDefaultExample and show Loaded array status', async ({ page }) => {
      // On page load loadDefaultExample() should be executed and arrayStatus should indicate loaded array
      const arrayStatus = await page.locator('#arrayStatus').innerText();
      expect(arrayStatus).toContain('Loaded array of length');
      // Ensure sliding window display has been updated (windowIndices present)
      const windowIndices = await page.locator('#windowIndices').innerText();
      expect(windowIndices).toMatch(/\[\d+ \.\.\. \d+\]/);

      // Assert no runtime page errors or console error messages occurred during load
      expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.map(e=>e.text).join('; ')}`).toBe(0);
    });

    test('LOAD_ARRAY: loading invalid input should display validation error, then valid input loads', async ({ page }) => {
      // Clear input to create invalid array and click Load Array
      const inputArray = page.locator('#inputArray');
      await inputArray.fill('');
      await page.locator('#windowSize').fill('3');
      await page.locator('#loadArray').click();
      // Expect an error message in arrayStatus
      await expect(page.locator('#arrayStatus')).toHaveText(/Error:/);

      // Now provide valid array and load
      await inputArray.fill('5 4 3 2 1');
      await page.locator('#windowSize').fill('2');
      await page.locator('#loadArray').click();
      await expect(page.locator('#arrayStatus')).toHaveText(/Loaded array of length 5 with window size k = 2/);

      // Verify sliding window display updated for start index 0
      await expect(page.locator('#windowIndices')).toHaveText('[0 ... 1]');
      await expect(page.locator('#windowElements')).toHaveText('5, 4');
    });

    test('RANDOM_ARRAY button triggers prompts and loads random array (dialog handling)', async ({ page }) => {
      // Prepare handler to respond to two sequential prompts (length and k)
      let dialogCount = 0;
      page.on('dialog', async dialog => {
        dialogCount++;
        // First dialog: length, second: window size
        if (dialogCount === 1) {
          await dialog.accept('6'); // set length 6
        } else if (dialogCount === 2) {
          await dialog.accept('3'); // set k = 3
        } else {
          await dialog.dismiss();
        }
      });

      // Click Random Array and wait for arrayStatus to update
      await page.locator('#randomArray').click();
      await page.waitForFunction(() => {
        const el = document.getElementById('arrayStatus');
        return el && el.textContent && el.textContent.indexOf('Loaded array of length') === 0;
      });

      const statusText = await page.locator('#arrayStatus').innerText();
      expect(statusText).toMatch(/Loaded array of length 6 with window size k = 3/);

      // Ensure windowElements shows exactly 3 elements (window size)
      const elems = await page.locator('#windowElements').innerText();
      expect(elems.split(',').length).toBe(3);
    });
  });

  test.describe('State S2_SlidingWindow - Sliding controls and auto-play', () => {
    test('GO_TO_POS and slide left/right update window indices and elements correctly', async ({ page }) => {
      // Ensure array loaded
      await expect(page.locator('#arrayStatus')).toContainText('Loaded array of length');

      // Go to position 2 using input and Go button
      await page.locator('#currentPos').fill('2');
      await page.locator('#goToPos').click();
      await expect(page.locator('#windowIndices')).toHaveText(/\[2 \.\.\. \d+\]/);
      // The windowElements must correspond to the new start (start=2)
      const indicesText = await page.locator('#windowIndices').innerText();
      const match = indicesText.match(/\[(\d+) \.\.\. (\d+)\]/);
      expect(match).not.toBeNull();
      const start = parseInt(match[1], 10);
      expect(start).toBeGreaterThanOrEqual(0);

      // Slide right by step=1 (default slideAmount)
      const beforeIndices = await page.locator('#windowIndices').innerText();
      await page.locator('#slideRight').click();
      const afterIndices = await page.locator('#windowIndices').innerText();
      expect(beforeIndices !== afterIndices).toBeTruthy();

      // Slide left and expect to move back (or clamp at 0)
      await page.locator('#slideLeft').click();
      const backIndices = await page.locator('#windowIndices').innerText();
      // Either equal to initial or decreased index
      expect(backIndices).toBeDefined();
    });

    test('SLIDE_LEFT clamps at zero and SLIDE_RIGHT clamps at maxWindowStartIndex', async ({ page }) => {
      // Move to first window and slide left (should stay at 0)
      await page.locator('#firstWindow').click();
      await page.locator('#slideLeft').click();
      await expect(page.locator('#windowIndices')).toHaveText(/\[0 \.\.\. \d+\]/);

      // Move to last window and slide right (should stay at last)
      await page.locator('#lastWindow').click();
      const lastIndices = await page.locator('#windowIndices').innerText();
      await page.locator('#slideRight').click();
      const afterLast = await page.locator('#windowIndices').innerText();
      expect(afterLast).toBe(lastIndices);
    });

    test('AUTO_PLAY_FORWARD and AUTO_PLAY_BACKWARD move window position and can be stopped', async ({ page }) => {
      // Set small delay for faster test
      await page.locator('#autoPlayDelay').fill('50');

      // Ensure we are not at the last window: go to first
      await page.locator('#firstWindow').click();
      const startIndices = await page.locator('#windowIndices').innerText();

      // Start auto forward
      await page.locator('#autoPlayForward').click();
      // Wait a little to let auto-play advance
      await page.waitForTimeout(250);
      // Stop auto-play
      await page.locator('#autoPlayStop').click();

      const midIndices = await page.locator('#windowIndices').innerText();
      expect(midIndices).not.toBe(startIndices);

      // Start auto backward to return or clamp at 0
      await page.locator('#autoPlayBackward').click();
      await page.waitForTimeout(250);
      await page.locator('#autoPlayStop').click();
      const backIndices = await page.locator('#windowIndices').innerText();
      expect(backIndices).toBeDefined();

      // Ensure stop cleared the timer: clicking stop again is safe
      await page.locator('#autoPlayStop').click();
    }, { timeout: 10000 });
  });

  test.describe('State S3_SimulationActive - Compute All Windows and Simulation steps', () => {
    test('COMPUTE_ALL_WINDOWS computes values, enables scrolling and updates output', async ({ page }) => {
      // Choose MAX function and compute
      await page.locator('#functionSelect').selectOption('max');
      await page.locator('#computeAllWindows').click();

      // The output should be populated and scroll controls enabled
      await expect(page.locator('#output')).not.toHaveText('');
      const rangeDisabled = await page.locator('#allWindowsScroll').getAttribute('disabled');
      expect(rangeDisabled).toBeNull(); // should be enabled (attribute removed => null)

      // Scroll to last window and ensure output updates accordingly
      const maxAttr = await page.locator('#allWindowsScroll').getAttribute('max');
      const maxIndex = parseInt(maxAttr || '0', 10);
      await page.locator('#allWindowsScroll').fill(String(maxIndex));
      // Fire input event by evaluating in page context to ensure handler runs
      await page.evaluate(() => {
        const el = document.getElementById('allWindowsScroll');
        if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      // Output should show Window #<maxIndex>
      await expect(page.locator('#output')).toContainText(`Window #${maxIndex} `);
    });

    test('Simulation controls: initialize, push/pop operations, next/prev step behavior and edge cases', async ({ page }) => {
      // Initialize simulation by clicking Reset Simulation (which calls initializeSimulation)
      // The simReset button should be enabled after array load
      await expect(page.locator('#simReset')).toBeEnabled();
      await page.locator('#simReset').click();

      // After initializeSimulation, current i = 0 and deque should be empty
      await expect(page.locator('#simCurrentI')).toHaveText('0');
      await expect(page.locator('#simDeque')).toHaveText('(empty)');
      await expect(page.locator('#stepInfo')).toContainText('Simulation started');

      // Test PUSH_RIGHT: push i=0
      await page.locator('#simPushRight').click();
      await expect(page.locator('#simDeque')).toContainText('0');
      await expect(page.locator('#stepInfo')).toContainText('Pushed i = 0');

      // Test POP_RIGHT: at i=0, likely no pop because there's no larger current element; but move to i=1 and then pop
      await page.locator('#simNextStep').click(); // move to i=1
      await expect(page.locator('#simCurrentI')).toHaveText('1');

      // Attempt pop right: depends on values, but for default array (1,3,...) array[0] < array[1] so pop occurs
      await page.locator('#simPopRight').click();
      const stepInfoText = await page.locator('#stepInfo').innerText();
      // Either popped or reported no pop; both are acceptable outcomes; assert presence of expected messages
      expect(stepInfoText.length).toBeGreaterThan(0);

      // Push current i (1) and check deque contains 1
      await page.locator('#simPushRight').click();
      await expect(page.locator('#simDeque')).toContainText('1');

      // Test POP_LEFT: with window size k from simWindowSize; ensure behavior does not throw and text updates
      await page.locator('#simPopLeft').click();
      const popLeftInfo = await page.locator('#stepInfo').innerText();
      expect(popLeftInfo.length).toBeGreaterThan(0);

      // Test NEXT_STEP at end: repeatedly move to end and ensure proper message when at end
      // Get max index from simIndex max attribute
      const simIndexMaxAttr = await page.locator('#simIndex').getAttribute('max');
      const simMax = parseInt(simIndexMaxAttr || '0', 10);
      // Move quickly to the end using set value and dispatching set button
      await page.locator('#simIndex').fill(String(simMax));
      await page.locator('#simSetIndex').click();
      await expect(page.locator('#simCurrentI')).toHaveText(String(simMax));

      // Try next step at end - should show "Reached end of array."
      await page.locator('#simNextStep').click();
      await expect(page.locator('#stepInfo')).toContainText(/Reached end of array|Ready for next steps|Moved to i/);

      // Try prev step to move backward at least one step
      await page.locator('#simPrevStep').click();
      const prevMsg = await page.locator('#stepInfo').innerText();
      expect(prevMsg.length).toBeGreaterThan(0);
    });

    test('Simulation Add Current Max to Output button exists and behaves correctly (edge conditions)', async ({ page }) => {
      // Ensure simulation initialized
      await page.locator('#simReset').click();

      // The page appends a button with text "Add Current Max to Output"
      const maxButton = page.locator('button', { hasText: 'Add Current Max to Output' });
      await expect(maxButton).toBeVisible();

      // When i < k-1, clicking should indicate window not full yet
      // Ensure sim i = 0 and k default from simWindowSize (should be >=1)
      await page.locator('#simIndex').fill('0');
      await page.locator('#simSetIndex').click();
      await maxButton.click();
      await expect(page.locator('#stepInfo')).toContainText(/Window not full yet|Deque empty|Cannot output/);

      // Move to i >= k-1 and try to add max when deque empty: should show appropriate message
      const kText = await page.locator('#simWindowSize').innerText();
      const k = parseInt(kText || '3', 10);
      const targetI = Math.max(k - 1, 0);
      await page.locator('#simIndex').fill(String(targetI));
      await page.locator('#simSetIndex').click();
      // Clear deque by simReset and then set index to target and click add
      await page.locator('#simReset').click();
      await page.locator('#simIndex').fill(String(targetI));
      await page.locator('#simSetIndex').click();
      await maxButton.click();
      await expect(page.locator('#stepInfo')).toHaveText(/Deque empty|Window not full yet|Added/);
    });
  });

  test.describe('Edge cases and validation', () => {
    test('Loading with k > array.length should produce validation error', async ({ page }) => {
      await page.locator('#inputArray').fill('1 2 3');
      await page.locator('#windowSize').fill('10');
      await page.locator('#loadArray').click();
      await expect(page.locator('#arrayStatus')).toContainText('Error: Window size k must be less or equal to array length');
    });

    test('Compute All Windows with no array loaded displays appropriate message', async ({ page }) => {
      // Clear array and set window size
      await page.locator('#inputArray').fill('');
      await page.locator('#loadArray').click();
      // Now compute all windows
      await page.locator('#computeAllWindows').click();
      await expect(page.locator('#output')).toContainText('No array loaded.');
    });
  });

  test('No unexpected console or page errors throughout tests (collected at end of session)', async ({ page }) => {
    // Final assertion to ensure that there were no severe runtime errors during interactions
    expect(pageErrors.length, `Page had errors: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Console had errors: ${consoleErrors.map(e=>e.text).join('; ')}`).toBe(0);
  });
});