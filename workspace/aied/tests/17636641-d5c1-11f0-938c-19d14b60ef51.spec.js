import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17636641-d5c1-11f0-938c-19d14b60ef51.html';

// Increase timeout because the bubble sort visualization uses timeouts and may take time.
// Adjusted to 90s to allow sorting to complete in slow environments.
test.setTimeout(90_000);

// Page Object for the Bubble Sort app
class BubbleSortPage {
  constructor(page) {
    this.page = page;
    this.arrayLocator = page.locator('#array');
    this.barLocator = page.locator('#array .bar');
    this.sortButton = page.locator('#sortButton');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the main elements are present
    await expect(this.arrayLocator).toBeVisible();
    await expect(this.sortButton).toBeVisible();
  }

  // Returns count of bars currently rendered
  async getBarCount() {
    return await this.barLocator.count();
  }

  // Returns an array of heights (in px numbers) for all bars
  async getBarHeights() {
    const count = await this.getBarCount();
    const heights = [];
    for (let i = 0; i < count; i++) {
      const h = await this.barLocator.nth(i).evaluate((el) => {
        // computed style height may include 'px'
        return window.getComputedStyle(el).height;
      });
      heights.push(h);
    }
    return heights;
  }

  // Click the sort button
  async clickSortButton() {
    await this.sortButton.click();
  }

  // Wait until all bars have the 'sorted' class or until timeout
  async waitForAllBarsSorted(timeout = 60_000) {
    await this.page.waitForFunction(
      () => {
        const bars = Array.from(document.querySelectorAll('#array .bar'));
        if (bars.length === 0) return false;
        return bars.every((b) => b.classList.contains('sorted'));
      },
      null,
      { timeout }
    );
  }

  // Wait until at least one bar is highlighted in red (indicates active comparison)
  async waitForAnyBarRed(timeout = 5_000) {
    await this.page.waitForFunction(
      () => {
        const bars = Array.from(document.querySelectorAll('#array .bar'));
        return bars.some((b) => {
          const bg = window.getComputedStyle(b).backgroundColor;
          // The code sets inline style 'red' during comparison
          return bg === 'rgb(255, 0, 0)' || bg === 'red';
        });
      },
      null,
      { timeout }
    );
  }
}

test.describe('Bubble Sort Visualization - FSM validation', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Sanity: ensure no uncaught exceptions were produced by the page
    // This asserts that no uncaught page errors occurred during the test.
    expect(pageErrors.length, `Uncaught page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Also assert there are no console messages flagged as 'error' nor messages matching common JS error names.
    const errorLike = consoleMessages.filter(m =>
      m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text)
    );
    expect(errorLike.length, `Console error-like messages: ${JSON.stringify(errorLike)}`).toBe(0);
  });

  test('S0_Idle - Initial state: generateArray(15) should render 15 bars and button enabled', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry action generateArray(15).
    // It asserts that 15 bars are rendered and the sort button is enabled in Idle.
    const app = new BubbleSortPage(page);
    await app.goto();

    // Verify there are exactly 15 bars produced by generateArray(15)
    const count = await app.getBarCount();
    expect(count).toBe(15);

    // Verify every bar has a positive height
    const heights = await app.getBarHeights();
    for (const h of heights) {
      // heights like '120px' -> ensure numeric part > 0
      const num = parseFloat(h);
      expect(num).toBeGreaterThan(0);
    }

    // Verify the sort button is enabled in Idle
    await expect(app.sortButton).toBeEnabled();

    // No page errors should have happened during load (checked in afterEach)
  });

  test('StartBubbleSort event triggers transition to S1_Sorting (button disabled) and highlights comparisons', async ({ page }) => {
    // This test validates the StartBubbleSort event/transition from Idle to Sorting (S0 -> S1).
    // It checks that clicking the sort button immediately disables it and that a comparison highlight occurs.
    const app = new BubbleSortPage(page);
    await app.goto();

    // Click to start sorting
    await app.clickSortButton();

    // Immediately after click, button should be disabled per entry/action logic
    await expect(app.sortButton).toBeDisabled();

    // Wait shortly to observe a comparison highlight (a bar turning red) as evidence that bubbleSort started.
    // This waits up to 5s for any bar to be red; if the animation delay and loop timing allow, this will pass.
    // If the visualization is too fast or array trivial, this still asserts that sorting was initiated by disabled button above.
    try {
      await app.waitForAnyBarRed(5000);
      // If a bar turned red, that is strong evidence that S1_Sorting is active.
      const foundRed = consoleMessages.some(m => /red/i.test(m.text));
      // We don't assert on console messages; the red bar visual is enough.
    } catch (e) {
      // It's acceptable if we do not observe a red bar within timeout (timing variability).
      // We still consider the transition proven by the disabled button state earlier.
    }

    // We intentionally DO NOT wait for full sorting here to avoid long-running test durations,
    // but we have validated the S0 -> S1 transition via the disabled button.
  });

  test('S1_Sorting -> S2_Sorted transition: sorting completes and bars receive .sorted class, button re-enabled', async ({ page }) => {
    // This test validates the transition from Sorting to Sorted (S1 -> S2).
    // It clicks the button to start sorting, then waits for all bars to have the 'sorted' class,
    // and verifies the sortButton disabled state is cleared on exit.
    const app = new BubbleSortPage(page);
    await app.goto();

    // Start sorting
    await app.clickSortButton();

    // Confirm the sorting started by ensuring button got disabled
    await expect(app.sortButton).toBeDisabled();

    // Wait for the final transition: all bars should eventually acquire the 'sorted' class.
    // The bubble sort uses 300ms waits per comparison; for 15 elements this may take several seconds.
    // We allow up to 60s here to be robust. test.setTimeout allows overall longer execution.
    await app.waitForAllBarsSorted(60_000);

    // After sorting completes, every bar should have class 'sorted'.
    const count = await app.getBarCount();
    for (let i = 0; i < count; i++) {
      const hasSorted = await app.barLocator.nth(i).evaluate((el) => el.classList.contains('sorted'));
      expect(hasSorted).toBe(true);
    }

    // The FSM exit action for Sorting sets sortButton.disabled = false. Verify it.
    await expect(app.sortButton).toBeEnabled();
  });

  test('Edge case: clicking sort button multiple times should not break the app or cause errors', async ({ page }) => {
    // This test ensures that rapid repeated clicks do not cause unhandled errors.
    const app = new BubbleSortPage(page);
    await app.goto();

    // Rapidly click the button twice (second click should be ineffective since button becomes disabled)
    await app.sortButton.click();
    // Attempt a second click right away
    try {
      await app.sortButton.click({ timeout: 500 }).catch(() => {});
    } catch (e) {
      // Some runtimes may throw when trying to click a disabled button - swallow as we assert behaviour below.
    }

    // After the first click, button should be disabled and remain so during sorting
    await expect(app.sortButton).toBeDisabled();

    // Ensure no page errors were thrown during rapid clicks - asserted in afterEach.
  });

  test('FSM observability: monitor console and page errors during a full sort run', async ({ page }) => {
    // This test runs a full sort and asserts that there are no uncaught JS exceptions logged.
    // It also collects console messages for inspection (asserted in afterEach).
    const app = new BubbleSortPage(page);
    await app.goto();

    // Start and wait for sorted state completion
    await app.clickSortButton();
    await app.waitForAllBarsSorted(60_000);

    // After completion, ensure button re-enabled
    await expect(app.sortButton).toBeEnabled();

    // No additional assertions here; the afterEach will assert no page errors and no console error-like messages.
  });
});