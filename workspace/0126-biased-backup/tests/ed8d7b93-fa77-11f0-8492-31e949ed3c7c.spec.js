import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d7b93-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Bucket Sort Visualization (FSM) - ed8d7b93-fa77-11f0-8492-31e949ed3c7c', () => {
  // Collect console messages and page errors per test to assert on them.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages from the page
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
    // Ensure the page loaded and main container exists
    await expect(page.locator('.container')).toHaveCount(1);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: no unexpected console error messages or uncaught exceptions
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/i.test(m.text));
    if (errorConsoleMessages.length > 0) {
      // Attach console output to the test failure message for debugging
      // This will not modify page behavior; just surfaces logs
      console.error('Console error messages observed:', errorConsoleMessages);
    }
    if (pageErrors.length > 0) {
      console.error('Page errors observed:', pageErrors.map(e => e.stack || String(e)));
    }
    // Assert no uncaught page errors by default
    expect(pageErrors.length, 'No uncaught page errors should occur').toBe(0);
  });

  test('S0_Idle state: Initial Idle state has Start button and ten hidden bars at 0%', async ({ page }) => {
    // Validate presence of Start Sorting button (evidence of Idle state)
    const startButton = page.locator('#startButton');
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start Sorting');

    // Validate there are 10 buckets and 10 bars rendered
    const buckets = page.locator('.bucket');
    const bars = page.locator('.bar');
    await expect(buckets).toHaveCount(10);
    await expect(bars).toHaveCount(10);

    // Every bar should initially be hidden and have inline style height: 0%;
    for (let i = 0; i < 10; i++) {
      const bar = bars.nth(i);
      // The implementation sets class "hidden" and style height "0%" initially
      await expect(bar).toHaveClass(/hidden/);
      const height = await bar.evaluate((el) => el.style.height);
      expect(height === '0%' || height === '' /* tolerates empty string if not set inline */, `bar ${i} initial height should be 0%`).toBeTruthy();
    }

    // Verify that the FSM-declared entry action renderPage() is NOT defined on the window.
    // The FSM mentions renderPage() as an entry action for S0_Idle, but implementation doesn't provide it.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType, 'renderPage should be undefined (not implemented)').toBe('undefined');

    // No page errors or console errors should have occurred up to this point.
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/i.test(m.text));
    expect(errorConsoleMessages.length, 'No console errors in Idle state').toBe(0);
    expect(pageErrors.length, 'No page errors in Idle state').toBe(0);
  });

  test('Transition StartSorting -> S1_Sorting: clicking Start Sorting animates buckets and updates bar heights and styles', async ({ page }) => {
    // Click the start button to trigger the StartSorting event/transition
    await page.locator('#startButton').click();

    // The animation uses setTimeout with index * 500 ms and the last index is 9.
    // Wait for the last expected concrete update (bar for value 50 -> bucketIndex 5 -> height 50%)
    // We specifically wait for bar index 5 to reach 50% as a reliable indicator the sequence completed.
    await page.waitForFunction(() => {
      const bars = Array.from(document.querySelectorAll('.bar'));
      // Defensive check
      if (!bars[5]) return false;
      return bars[5].style.height === '50%';
    }, null, { timeout: 8000 }); // allow up to 8s for all animations

    // After animation finished, verify the expected heights and visibility for each bucket bar.
    // Observed mapping logic in implementation:
    // sortedValues = [5,10,15,20,25,30,35,40,45,50]
    // bucketIndex = Math.floor(value / 10)
    // final heights per bucket index will be the last assigned value to that bucket.
    // Expected final heights:
    // index 0 -> 5%
    // index 1 -> 15%  (10 then 15 -> last is 15)
    // index 2 -> 25%  (20 then 25 -> last is 25)
    // index 3 -> 35%
    // index 4 -> 45%
    // index 5 -> 50%
    // indices 6-9 -> remain 0% and hidden
    const expectedHeights = ['5%', '15%', '25%', '35%', '45%', '50%', '0%', '0%', '0%', '0%'];
    const expectedVisible = [true, true, true, true, true, true, false, false, false, false];
    const expectedBg = ['#228B22', '#228B22', '#228B22', '#228B22', '#228B22', '#228B22', '', '', '', ''];

    const barHeights = await page.$$eval('.bar', (els) => els.map(el => el.style.height || '0%'));
    const barClasses = await page.$$eval('.bar', (els) => els.map(el => el.className));
    const barBackgrounds = await page.$$eval('.bar', (els) => els.map(el => el.style.background || ''));

    for (let i = 0; i < 10; i++) {
      // Height check - some empty might be considered '0%'
      const height = barHeights[i] || '0%';
      expect(height, `bar[${i}] height`).toBe(expectedHeights[i]);

      // Visibility/class check
      const isHidden = /hidden/.test(barClasses[i]);
      if (expectedVisible[i]) {
        expect(isHidden, `bar[${i}] should be visible (no hidden class)`).toBe(false);
      } else {
        expect(isHidden, `bar[${i}] should remain hidden`).toBe(true);
      }

      // Background color check -- only updated bars get the green #228B22 color
      if (expectedBg[i]) {
        // Normalize case since style might use rgb or hex; compare ending substring if hex used in style.
        const bg = barBackgrounds[i].trim().toLowerCase();
        // The implementation explicitly sets '#228B22' so expect that exact string.
        expect(bg === '#228b22' || bg === '#228B22', `bar[${i}] background should be green`).toBeTruthy();
      } else {
        // unchanged bars may have empty string or original color; ensure they are not the green color
        const bg = barBackgrounds[i].trim().toLowerCase();
        expect(bg !== '#228b22', `bar[${i}] should not be set to green`).toBeTruthy();
      }
    }

    // Confirm no uncaught page exceptions or console error messages were emitted during animation.
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/i.test(m.text));
    expect(errorConsoleMessages.length, 'No console error messages when performing StartSorting transition').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors when performing StartSorting transition').toBe(0);
  });

  test('Rapid/multiple clicks (edge case): multiple StartSorting events should not throw and should result in consistent final state', async ({ page }) => {
    const startButton = page.locator('#startButton');

    // Rapidly click the button multiple times to simulate stress / repeated events
    await startButton.click();
    await startButton.click();
    await startButton.click();

    // Wait for the same final condition as previous test: bar index 5 becomes 50%
    await page.waitForFunction(() => {
      const bars = Array.from(document.querySelectorAll('.bar'));
      if (!bars[5]) return false;
      return bars[5].style.height === '50%';
    }, null, { timeout: 10000 }); // give a bit more time under rapid re-triggering

    // Verify final heights are the same expected mapping after repeated triggers.
    const finalHeights = await page.$$eval('.bar', els => els.map(e => e.style.height || '0%'));
    const expectedFinalHeights = ['5%', '15%', '25%', '35%', '45%', '50%', '0%', '0%', '0%', '0%'];

    expect(finalHeights.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(finalHeights[i] || '0%').toBe(expectedFinalHeights[i]);
    }

    // Ensure no uncaught runtime errors occurred during rapid clicks
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/i.test(m.text));
    expect(errorConsoleMessages.length, 'No console errors on rapid multiple clicks').toBe(0);
    expect(pageErrors.length, 'No page errors on rapid multiple clicks').toBe(0);
  });

  test('bucketSort function validation: ensure the sorting result matches expected sorted values (internal function evidence)', async ({ page }) => {
    // Validate bucketSort is available and returns expected sorted array for the given values.
    const sorted = await page.evaluate(() => {
      // Accessing page's bucketSort and values as implemented in the page.
      // If bucketSort or values are not available, this may throw and be captured by page errors.
      if (typeof bucketSort !== 'function') return { error: 'bucketSort not defined' };
      return { result: bucketSort(values) };
    });

    expect(sorted.error, 'bucketSort should be defined on the page').toBeUndefined();
    expect(Array.isArray(sorted.result), 'bucketSort should return an array').toBeTruthy();
    // The expected sorted array for the provided values in the HTML
    const expected = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    expect(sorted.result).toEqual(expected);

    // No page errors should have been produced by directly invoking bucketSort in the page context.
    expect(pageErrors.length, 'No page errors when calling bucketSort').toBe(0);

    // Also ensure calling bucketSort returned the array used by animation; this gives confidence the transition uses it.
    // Trigger the animation and once complete, ensure bar heights reflect the sorted mapping (redundant but explicit)
    await page.locator('#startButton').click();
    await page.waitForFunction(() => {
      const bars = Array.from(document.querySelectorAll('.bar'));
      return bars[5] && bars[5].style.height === '50%';
    }, null, { timeout: 8000 });

    const finalHeights = await page.$$eval('.bar', els => els.map(e => e.style.height || '0%'));
    expect(finalHeights.slice(0, 6)).toEqual(['5%', '15%', '25%', '35%', '45%', '50%']);
  });
});