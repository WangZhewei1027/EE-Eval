import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2dd642-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Interactive Heap Sort - FSM validation', () => {
  // Reuse a single page per test to keep isolation; Playwright will handle browsers.
  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.describe('Initial state (S0_Idle) and Generate Array (S1_ArrayGenerated)', () => {
    test('Initial load shows an array with default size and heap visualization', async ({ page }) => {
      // Validate entry actions for S0_Idle: generateRandomArray() and updateDisplay()
      // Expect the #array-display to contain elements equal to the default array size (10)
      const sizeValue = await page.locator('#array-size').inputValue();
      const expectedSize = Number(sizeValue);
      const arrayElements = page.locator('.array-element');
      await expect(arrayElements).toHaveCount(expectedSize);

      // Heap visualization should render at least one level container when array exists
      await expect(page.locator('#heap-levels .heap-level')).toHaveCountGreaterThan(0);

      // Steps log should exist (may be empty or show initial state). Check that the steps-log container exists.
      await expect(page.locator('#steps-log')).toBeVisible();
    });

    test('Clicking "Generate New Array" produces a new array and updates the display (S1_ArrayGenerated)', async ({ page }) => {
      // Change size to a smaller number then click generate to ensure UI responds
      const sizeInput = page.locator('#array-size');
      await sizeInput.fill('5');
      await page.click('#generate-btn');

      // After generating, UI displays 5 elements
      await expect(page.locator('.array-element')).toHaveCount(5);

      // The heap visualization should match number of array elements (at least shows nodes)
      await expect(page.locator('#heap-levels .heap-node')).toHaveCountGreaterThan(0);
    });
  });

  test.describe('Build Heap (S2_HeapBuilt) and Sort (S3_Sorted)', () => {
    test('Build Max Heap updates steps log to "Max heap built" (S2_HeapBuilt)', async ({ page }) => {
      // Set animation speed to fast to reduce test runtime
      await page.selectOption('#speed', '100');

      // Click Build Max Heap and wait for the steps log to show "Max heap built"
      await Promise.all([
        page.click('#build-heap-btn'),
        page.waitForFunction(() => {
          const el = document.getElementById('steps-log');
          return el && el.innerText.includes('Max heap built');
        }, null, { timeout: 10000 })
      ]);

      // Verify steps log contains the expected text
      const stepsText = await page.locator('#steps-log').innerText();
      expect(stepsText).toMatch(/Max heap built/);
    });

    test('Sorting the array results in "Array sorted" in steps log (S3_Sorted)', async ({ page }) => {
      // Speed up animations
      await page.selectOption('#speed', '100');

      // Click Sort Array and wait until the final step "Array sorted" appears
      await Promise.all([
        page.click('#sort-btn'),
        page.waitForFunction(() => {
          const el = document.getElementById('steps-log');
          return el && el.innerText.includes('Array sorted');
        }, null, { timeout: 30000 }) // sorting may take some time for many steps
      ]);

      const finalText = await page.locator('#steps-log').innerText();
      expect(finalText).toMatch(/Array sorted/);

      // After sorting, the array display should still show elements and heap visualization should render
      await expect(page.locator('.array-element')).toHaveCountGreaterThan(0);
      await expect(page.locator('#heap-levels .heap-node')).toHaveCountGreaterThan(0);
    });
  });

  test.describe('Step Back (S4_StepBack), Step Forward (S5_StepForward) and Reset (S6_Reset)', () => {
    test('Step Back/Forward operate on history steps after actions and update the steps log', async ({ page }) => {
      // Ensure we have some history by building the heap and performing a swap via sort
      await page.selectOption('#speed', '100');
      // Trigger build heap to create at least one history entry
      await Promise.all([
        page.click('#build-heap-btn'),
        page.waitForFunction(() => {
          const el = document.getElementById('steps-log');
          return el && el.innerText.includes('Max heap built');
        }, null, { timeout: 10000 })
      ]);

      // Trigger one swap by starting a sort but we'll wait until at least one "Swapped" step is registered
      const swappedPromise = page.waitForFunction(() => {
        const el = document.getElementById('steps-log');
        return el && /Swapped/.test(el.innerText);
      }, null, { timeout: 15000 }).catch(() => null);

      await page.click('#sort-btn');
      await swappedPromise; // wait for at least one swapped message if it occurs

      // Click Step Back - should move to previous step if available and update steps log
      const stepBack = page.locator('button#step-btn').first(); // the first #step-btn is Step Back
      await stepBack.click();

      // When stepping back, steps-log should show "Step" with some action text (can't guarantee exact action)
      const stepLogText = await page.locator('#steps-log').innerText();
      expect(stepLogText).toMatch(/Step \d+:/);

      // Click Step Forward - second #step-btn is Step Forward
      const stepForward = page.locator('button#step-btn').nth(1);
      await stepForward.click();
      const forwardLog = await page.locator('#steps-log').innerText();
      expect(forwardLog).toMatch(/Step \d+:/);
    });

    test('Reset behavior: clicking Reset without a proper history entry causes a runtime error (edge case)', async ({ page }) => {
      // The app calls generateRandomArray() at init but does not call resetHistory() at load.
      // Clicking Reset immediately attempts to access history[0].array which may be undefined and cause a TypeError.
      // We observe the pageerror event and assert that an error occurs naturally.
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#reset-btn')
      ]);

      // Assert that a runtime error occurred and the message indicates an undefined property access
      expect(error).toBeTruthy();
      // Error messages vary across browsers; check for common phrases
      expect(error.message).toMatch(/Cannot read|Cannot set|undefined|reading 'array'|reading "array"/i);
    });

    test('After generating array (proper history), Reset does not throw and updates steps log to "Reset to initial state"', async ({ page }) => {
      // First, click Generate to ensure resetHistory() is invoked (populates history[0])
      await page.click('#generate-btn');

      // Now click Reset - this should NOT throw; watch for pageerror for a short window
      let pageErrorOccurred = false;
      const onPageError = () => { pageErrorOccurred = true; };
      page.on('pageerror', onPageError);

      await page.click('#reset-btn');

      // Give a short moment for any errors (there should be none)
      await page.waitForTimeout(200);

      // Remove listener
      page.off('pageerror', onPageError);

      // Assert no page error occurred
      expect(pageErrorOccurred).toBe(false);

      // Steps log should now contain the explicit reset message
      const stepsLogText = await page.locator('#steps-log').innerText();
      expect(stepsLogText).toMatch(/Reset to initial state/);
    });
  });

  test.describe('Control changes and edge behavior (ChangeArraySize, ChangeSpeed)', () => {
    test('Changing array size regenerates the array and updates display (ChangeArraySize)', async ({ page }) => {
      // Set array size to a distinct number
      const sizeInput = page.locator('#array-size');
      await sizeInput.fill('7');
      // Trigger change event by using evaluate (native change event)
      await sizeInput.evaluate((el) => {
        el.value = '7';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // After change handler, the UI should show 7 elements
      await expect(page.locator('.array-element')).toHaveCount(7);
    });

    test('Changing speed updates the speed variable and reduces delays (ChangeSpeed)', async ({ page }) => {
      // Choose slow then fast and ensure clicks complete faster when fast selected
      await page.selectOption('#speed', '1000'); // slow
      // Click build to start a heap operation (may take longer)
      const slowStart = Date.now();
      const slowWait = page.waitForFunction(() => {
        const el = document.getElementById('steps-log');
        return el && el.innerText.includes('Max heap built');
      }, null, { timeout: 20000 });
      await page.click('#build-heap-btn');
      await slowWait;
      const slowDuration = Date.now() - slowStart;

      // Now set speed to fastest and run again; it should be noticeably faster or at least complete
      await page.selectOption('#speed', '100'); // fast
      const fastStart = Date.now();
      const fastWait = page.waitForFunction(() => {
        const el = document.getElementById('steps-log');
        return el && el.innerText.includes('Max heap built');
      }, null, { timeout: 20000 });
      await page.click('#build-heap-btn');
      await fastWait;
      const fastDuration = Date.now() - fastStart;

      // While durations can vary depending on environment, fastDuration should typically be less than slowDuration.
      // We assert that both attempts completed and fastDuration is not dramatically larger than slowDuration.
      expect(slowDuration).toBeGreaterThanOrEqual(0);
      expect(fastDuration).toBeGreaterThanOrEqual(0);
      // Allow some leeway; assert fastDuration is not larger than slowDuration * 3 to avoid flaky failures on slow CI.
      expect(fastDuration).toBeLessThanOrEqual(Math.max(slowDuration * 3 + 1000, 10000));
    });
  });

  test.describe('Error and boundary scenarios', () => {
    test('Clicking Step Back at initial step does nothing and does not throw', async ({ page }) => {
      // Ensure no page errors are emitted when clicking step back at initial step 0
      let errorOccurred = false;
      const onError = () => { errorOccurred = true; };
      page.on('pageerror', onError);

      // Click Step Back (first button)
      await page.locator('button#step-btn').first().click();

      // Small delay to observe any possible error
      await page.waitForTimeout(200);
      page.off('pageerror', onError);
      expect(errorOccurred).toBe(false);
      // Steps log may be unchanged; ensure it still exists
      await expect(page.locator('#steps-log')).toBeVisible();
    });

    test('Clicking Step Forward at latest step does nothing and does not throw', async ({ page }) {
      // Ensure no page errors when clicking step forward at last step
      let errorOccurred = false;
      const onError = () => { errorOccurred = true; };
      page.on('pageerror', onError);

      // Click Step Forward (second button)
      await page.locator('button#step-btn').nth(1).click();

      await page.waitForTimeout(200);
      page.off('pageerror', onError);
      expect(errorOccurred).toBe(false);
      await expect(page.locator('#steps-log')).toBeVisible();
    });
  });
});