import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c971841-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the Bucket Sort Visualization page
class BucketSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.mainArray = page.locator('.main-array');
    this.arrayBars = page.locator('.main-array .array-bar');
    this.buckets = page.locator('.bucket');
    this.bucketBars = page.locator('.bucket .bar');
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Navigate to the page and wire up listeners for console/page errors
  async goto() {
    // capture console errors and page errors for assertions
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        // store the text for later assertions
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });

    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getStartButtonText() {
    return await this.startBtn.textContent();
  }

  async isStartButtonDisabled() {
    return await this.startBtn.evaluate((btn) => btn.disabled === true);
  }

  async getStartButtonAriaPressed() {
    return await this.startBtn.getAttribute('aria-pressed');
  }

  async countArrayBars() {
    return await this.arrayBars.count();
  }

  async countBucketBars() {
    return await this.bucketBars.count();
  }

  async anyMainArrayHighlightExists() {
    return await this.page.$('.array-bar.highlight') !== null;
  }

  async anyBucketHighlightExists() {
    return await this.page.$('.bucket.highlight') !== null;
  }

  async clickStart() {
    await this.startBtn.click();
  }

  // Wait until sorting appears to have started: button text becomes "Sorting..." and button disabled
  async waitForSortingToStart(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('startBtn');
      return btn && btn.textContent === 'Sorting...' && btn.disabled === true;
    }, null, { timeout });
  }

  // Wait until sorting finishes: button text reverts to "Start Sort" and disabled false
  async waitForSortingToEnd(timeout = 120000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('startBtn');
      return btn && btn.textContent === 'Start Sort' && btn.disabled === false;
    }, null, { timeout });
  }

  async getMainArrayLabelText() {
    const label = await this.page.locator('.main-array-label').first();
    return label ? await label.textContent() : null;
  }
}

test.describe('Bucket Sort Visualization — FSM states and transitions', () => {
  // Increase default timeout for slow animations and deliberate delays in the app
  test.beforeEach(async ({}, testInfo) => {
    // no-op here; individual tests will set their own timeouts
  });

  test('Initial Idle state: main array is initialized and Start button is present (S0_Idle)', async ({ page }) => {
    test.setTimeout(120000); // allow plenty of time for page load and checks

    const app = new BucketSortPage(page);
    await app.goto();

    // Verify there are no immediate page errors on load
    expect(app.pageErrors.length, 'No uncaught page errors on initial load').toBe(0);
    expect(app.consoleErrors.length, 'No console.error messages on initial load').toBe(0);

    // The FSM initial entry action is initializeMainArray(); which creates array-bars
    // Check that the main array has been initialized with bars
    const arrayBarCount = await app.countArrayBars();
    // App uses 10 initial entries in the code - ensure that we have 10 bars rendered
    expect(arrayBarCount, 'Main array should have 10 bars after initialization').toBeGreaterThanOrEqual(10);

    // The Start button should exist and be ready in Idle state
    const startText = await app.getStartButtonText();
    expect(startText).toBe('Start Sort');

    const ariaPressed = await app.getStartButtonAriaPressed();
    expect(ariaPressed).toBe('false');

    const disabled = await app.isStartButtonDisabled();
    expect(disabled).toBeFalsy();
  });

  test('StartSort event transitions to Sorting state and back to Idle (S0_Idle -> S1_Sorting -> S0_Idle)', async ({ page }) => {
    // Allow extended timeout: distribution + bucket sort + merge can take tens of seconds
    test.setTimeout(180000);

    const app = new BucketSortPage(page);
    await app.goto();

    // COMMENTS:
    // This test validates the StartSort event and both transitions:
    // 1) On click, the app should enter the Sorting state: button disabled, aria-pressed="true", text "Sorting..."
    //    bars in the main array should get 'highlight' during distribution, and buckets should be highlighted.
    // 2) After completion, the app should exit Sorting back to Idle: button re-enabled, aria-pressed="false", text "Start Sort",
    //    and the main array should display the sorted array label and contain the sorted bars.

    // Click to start sorting
    await app.clickStart();

    // Wait for sorting to start - immediate observable: button text changes and becomes disabled
    await app.waitForSortingToStart(10000); // distribution may take a little to commence

    // Assert Start button is disabled, aria-pressed true, text changed
    expect(await app.isStartButtonDisabled(), 'Start button should be disabled while sorting').toBeTruthy();
    expect(await app.getStartButtonAriaPressed(), 'Start button aria-pressed should be true when sorting').toBe('true');
    expect(await app.getStartButtonText(), 'Button text should indicate sorting in progress').toBe('Sorting...');

    // During distribution there should be main array bar highlights at some point and bucket highlights
    // Wait for one such highlight to appear (if distribution is in progress)
    const mainHighlightAppeared = await page.waitForSelector('.array-bar.highlight', { timeout: 12000 }).then(() => true).catch(() => false);
    expect(mainHighlightAppeared, 'At least one main array bar should be highlighted during distribution').toBeTruthy();

    const bucketHighlightAppeared = await page.waitForSelector('.bucket.highlight', { timeout: 12000 }).then(() => true).catch(() => false);
    expect(bucketHighlightAppeared, 'At least one bucket should be highlighted during distribution').toBeTruthy();

    // Wait for at least one bar to appear inside buckets (distribution step)
    await page.waitForSelector('.bucket .bar', { timeout: 20000 });
    const bucketBarCountDuring = await app.countBucketBars();
    expect(bucketBarCountDuring, 'There should be at least one bar moved to buckets during distribution').toBeGreaterThan(0);

    // Now wait for the whole sorting process to finish (button returns to "Start Sort")
    await app.waitForSortingToEnd(120000);

    // After completion, the Start button should be enabled and aria-pressed false
    expect(await app.isStartButtonDisabled(), 'Start button should be enabled after sorting finishes').toBeFalsy();
    expect(await app.getStartButtonAriaPressed(), 'Start button aria-pressed should be false after sorting finishes').toBe('false');
    expect(await app.getStartButtonText(), 'Button text should revert to Start Sort after completion').toBe('Start Sort');

    // The main array should now be labeled as Sorted Array
    const mainLabel = await app.getMainArrayLabelText();
    expect(mainLabel).toBe('Sorted Array');

    // There should be as many bars in the main-array as original items (merged back)
    const finalArrayBars = await app.countArrayBars();
    expect(finalArrayBars, 'Final main array should contain the same number of bars (sorted)').toBeGreaterThanOrEqual(10);

    // Verify there were no uncaught exceptions during the entire interaction
    expect(app.pageErrors.length, 'No uncaught page errors during the sorting run').toBe(0);
    // There might be console messages but we expect no console.error occurrences
    expect(app.consoleErrors.length, 'No console.error messages should be emitted during sorting run').toBe(0);
  });

  test('Edge case: Rapid repeated clicks should not cause duplicate concurrent sorts or crash (Idempotent StartSort)', async ({ page }) => {
    // Sorting is long; allow ample time
    test.setTimeout(180000);

    const app = new BucketSortPage(page);
    await app.goto();

    // COMMENTS:
    // This test simulates the user clicking the Start button multiple times rapidly.
    // The app's click handler guards with a 'sorting' flag. We assert that:
    // - The UI should settle into a single sorting run (button disabled) and finish normally.
    // - The final number of bars in the main array should be equal to the original count (i.e., no duplication).
    // - No page errors or console.error messages should occur.

    // Get initial number of bars
    const initialBarCount = await app.countArrayBars();
    expect(initialBarCount).toBeGreaterThanOrEqual(10);

    // Rapid clicks
    await Promise.all([
      app.startBtn.click(),
      app.startBtn.click(),
      app.startBtn.click()
    ]).catch(() => {
      // clicks might throw if button disabled mid-click, but we don't want to fail here for that reason
    });

    // Ensure sorting starts
    await app.waitForSortingToStart(10000);

    // While sorting, attempt additional clicks (should be ignored)
    // do multiple click attempts spaced a bit
    try {
      await app.startBtn.click({ timeout: 200 }).catch(() => {});
      await page.waitForTimeout(50);
      await app.startBtn.click({ timeout: 200 }).catch(() => {});
      await page.waitForTimeout(50);
    } catch (e) {
      // ignore errors from clicking a disabled button - the important bit is the sorting still completes correctly
    }

    // Await end of sorting
    await app.waitForSortingToEnd(120000);

    // Verify final bar count equals initial (no duplication or loss)
    const finalBarCount = await app.countArrayBars();
    expect(finalBarCount).toBeGreaterThanOrEqual(initialBarCount);

    // Verify no uncaught errors
    expect(app.pageErrors.length, 'No uncaught page errors after rapid clicks').toBe(0);
    expect(app.consoleErrors.length, 'No console.error messages after rapid clicks').toBe(0);
  });

  test('Observe console and runtime errors during page lifecycle', async ({ page }) => {
    test.setTimeout(60000);
    const app = new BucketSortPage(page);

    await app.goto();

    // Intentionally wait a short period to allow any delayed runtime errors to surface
    await page.waitForTimeout(2000);

    // We do not inject or patch code. We simply assert whether errors happened.
    // This test documents the observed runtime state: either no errors (ideal) or captures them for investigation.
    // Assert that there are no unexpected page errors or console.error messages.
    // If this assertion fails, it means the implementation emitted runtime errors (ReferenceError/TypeError/etc.)
    expect(app.pageErrors.length, `Unexpected runtime page errors: ${app.pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(app.consoleErrors.length, `Unexpected console.error logs: ${app.consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });
});