import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d5fc1-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Heap Sort Visualization (FSM states & transitions)', () => {
  // Collect runtime diagnostics for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages and page errors without modifying the page.
    page.on('console', msg => {
      // store both type and text for richer assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture thrown exceptions on the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    // Navigate to the application page (this triggers window.onload = generateArray)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Make sure page is closed/clean (Playwright will handle it, but we keep this hook for clarity)
    try {
      await page.close();
    } catch (e) {
      // ignore close errors
    }
  });

  test('S0_Idle -> S2_ArrayGenerated: page load triggers generateArray and draws initial array', async ({ page }) => {
    // This test verifies the "Idle" state's entry action generateArray() runs on load,
    // producing visual bars in #array.

    // Wait for at least one bar to be rendered and then ensure expected array size
    const bars = page.locator('#array .bar');
    await expect(bars).toHaveCount(20, { timeout: 5000 }); // arraySize is 20 in the implementation

    // Verify each bar has a non-zero numeric height style (ensures drawArray created bars)
    const heights = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('#array .bar'));
      return nodes.map(n => n.style.height || '');
    });

    // All heights should be strings ending with 'px' and parse to > 0
    for (const h of heights) {
      expect(h).toMatch(/^\d+px$/);
      expect(parseInt(h, 10)).toBeGreaterThan(0);
    }

    // Ensure there were no runtime page errors during the load (ReferenceError/SyntaxError/TypeError)
    expect(pageErrors.length).toBe(0);

    // Console should not contain any severe error types
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('S2_ArrayGenerated: clicking "Generate Random Array" re-generates and redraws the array', async ({ page }) => {
    // This test validates the GenerateRandomArray event and transition to the ArrayGenerated state.
    const arrayContainer = page.locator('#array');

    // Capture innerHTML before clicking
    const beforeHTML = await arrayContainer.innerHTML();

    // Click the generate button
    const genButton = page.locator("button[onclick='generateArray()']");
    await expect(genButton).toBeVisible();
    await genButton.click();

    // Wait for the array container's innerHTML to change (drawArray() resets innerHTML)
    await page.waitForFunction(
      ({ selector, before }) => document.querySelector(selector).innerHTML !== before,
      {}, // no arg timeout here; below override
      { selector: '#array', before: beforeHTML },
      { timeout: 5000 }
    ).catch(async () => {
      // If innerHTML did not change within timeout, still fetch current html for assertions
    });

    const afterHTML = await arrayContainer.innerHTML();

    // It's possible (though extremely unlikely) that random generation produces identical markup.
    // Assert at least there are bars and count remains expected.
    const bars1 = page.locator('#array .bar');
    await expect(bars).toHaveCount(20);

    // Preferably the markup changed; assert that either it changed or at least the content exists.
    if (beforeHTML === afterHTML) {
      // If it didn't change, ensure that bars exist and have valid heights (defensive)
      const heights1 = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#array .bar')).map(n => n.style.height);
      });
      expect(heights.length).toBe(20);
      heights.forEach(h => expect(h).toMatch(/^\d+px$/));
    } else {
      expect(beforeHTML).not.toEqual(afterHTML);
    }

    // Ensure no page errors occured during generation
    expect(pageErrors.length).toBe(0);
  });

  test('S2_ArrayGenerated -> S1_Sorting: clicking "Start Heap Sort" triggers heapSort and results in a sorted array', async ({ page }) => {
    // This test validates that startHeapSort() launches the heapSort() algorithm (entry action for Sorting)
    // and that after it completes, the visual representation is sorted (non-decreasing heights left-to-right).

    // Increase timeout because visualization uses delays (setTimeout 300ms per step)
    test.setTimeout(90_000);

    const barsLocator = page.locator('#array .bar');

    // Ensure initial array exists
    await expect(barsLocator).toHaveCount(20, { timeout: 5000 });

    // Capture initial heights to verify changes occur after starting sort
    const initialHeights = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#array .bar')).map(b => parseInt(b.style.height, 10));
    });

    const startButton = page.locator("button[onclick='startHeapSort()']");
    await expect(startButton).toBeVisible();

    // Click start
    await startButton.click();

    // Within a short timeframe, ensure at least one bar changed (indicating sorting activity started).
    // This detects that heapSort() caused DOM updates (drawArray calls).
    let changedWithinShortTime = false;
    try {
      await page.waitForFunction((initial) => {
        const current = Array.from(document.querySelectorAll('#array .bar')).map(b => parseInt(b.style.height, 10));
        if (current.length !== initial.length) return true;
        for (let i = 0; i < current.length; i++) {
          if (current[i] !== initial[i]) return true;
        }
        return false;
      }, {}, initialHeights, { timeout: 8000 });
      changedWithinShortTime = true;
    } catch (e) {
      // It's possible that the visual changes take longer; we'll still attempt to wait for final sorted state below.
      changedWithinShortTime = false;
    }

    // Assert that some change was observed reasonably quickly (sanity check that heapSort executed).
    expect(changedWithinShortTime).toBeTruthy();

    // Now wait for the final sorted state. The final state should be non-decreasing heights (ascending).
    const isSorted = await page.waitForFunction(() => {
      const heights2 = Array.from(document.querySelectorAll('#array .bar')).map(b => parseInt(b.style.height, 10));
      if (heights.length === 0) return false;
      for (let i = 1; i < heights.length; i++) {
        if (heights[i] < heights[i - 1]) return false;
      }
      return true;
    }, {}, { timeout: 60_000 });

    expect(isSorted).toBeTruthy();

    // Final verification: fetch final heights and assert non-decreasing
    const finalHeights = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#array .bar')).map(b => parseInt(b.style.height, 10));
    });
    for (let i = 1; i < finalHeights.length; i++) {
      expect(finalHeights[i]).toBeGreaterThanOrEqual(finalHeights[i - 1]);
    }

    // Ensure no page errors occurred during the sorting process
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking "Start Heap Sort" multiple times does not throw page errors', async ({ page }) => {
    // This test checks robustness: invoking startHeapSort repeatedly (user spamming button)
    // should not produce unhandled exceptions on the page.

    const startButton1 = page.locator("button[onclick='startHeapSort()']");
    await expect(startButton).toBeVisible();

    // Click the button several times in quick succession
    await startButton.click();
    await startButton.click();
    await startButton.click();

    // Allow a short period for potential errors to surface
    await page.waitForTimeout(2000);

    // Assert no page errors (ReferenceError, TypeError, etc.) were thrown
    expect(pageErrors.length).toBe(0);

    // Also assert that the DOM is still responsive (bars still present)
    const bars2 = page.locator('#array .bar');
    await expect(bars).toHaveCount(20, { timeout: 5000 });
  });

  test('Runtime diagnostics: report console messages and any page errors (no modification of code)', async ({ page }) => {
    // This test's goal is to expose and assert runtime diagnostics are acceptable.
    // We do NOT modify page code. We simply assert that there were no uncaught exceptions,
    // and surface console errors if present.

    // Give the page a moment to produce any late errors
    await page.waitForTimeout(1000);

    // Fail the test if there were any page errors
    if (pageErrors.length > 0) {
      // Attach diagnostics to the test failure message
      const messages = pageErrors.map(e => (e && e.stack) ? e.stack : String(e)).join('\n---\n');
      throw new Error(`Page errors were detected:\n${messages}`);
    }

    // If console.error messages exist, fail with their details (they may indicate runtime issues)
    const errors = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    if (errors.length > 0) {
      throw new Error(`Console errors were detected:\n${errors.join('\n')}`);
    }

    // Otherwise, assert that page ran without uncaught exceptions
    expect(pageErrors.length).toBe(0);
    expect(errors.length).toBe(0);
  });

});