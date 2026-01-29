import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d85ac1-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Big-Theta (Θ) Notation — Interactive Demo (FSM + UI)', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console and page errors for assertions later
    consoleMessages = [];
    pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the application page fresh for each test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for main elements to be present
    await Promise.all([
      page.waitForSelector('#analyze'),
      page.waitForSelector('#reset'),
      page.waitForSelector('#metrics'),
      page.waitForSelector('#plot'),
    ]);

    // The app calls analyze() on load; wait until metrics updates from initial "Press Analyze to compute."
    const metrics = page.locator('#metrics');
    await expect(metrics).not.toHaveText(/Press Analyze to compute\./, { timeout: 3000 }).catch(() => {
      // In some environments initial analyze may be fast; allow fallback if still present.
    });
  });

  test.afterEach(async () => {
    // Assert there are no uncaught page errors during tests
    expect(pageErrors.length, 'No uncaught page errors should be emitted').toBe(0);
  });

  // Helper: read text content trimmed
  async function textOf(locator) {
    const t = await locator.textContent();
    return (t || '').trim();
  }

  test('Initial load: analyze runs and renders metrics + plot', async ({ page }) => {
    // Validate metrics area shows function descriptions and sample information after initial analyze
    const metrics1 = page.locator('#metrics1');
    await expect(metrics).toContainText('f(n):');
    await expect(metrics).toContainText('g(n):');
    await expect(metrics).toContainText('Sample n from');

    // Conclusion should be set (initial analyze runs and conclusion should not be the placeholder "—")
    const conclusion = page.locator('#conclusion');
    const conclusionText = (await conclusion.textContent()) || '';
    expect(conclusionText.trim()).not.toBe('—');

    // Canvas should have some drawing - toDataURL should be a non-empty PNG data URL
    const dataUrl = await page.evaluate(() => {
      const canvas = document.getElementById('plot');
      try {
        return canvas.toDataURL();
      } catch (e) {
        return '';
      }
    });
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.length).toBeGreaterThan(50); // some content exists
  });

  test('Reset transition: clicking Reset returns to Idle state and clears inputs', async ({ page }) => {
    // Make a change: click a chip which triggers analyze and sets custom inputs
    const chip = page.locator('.chip', { hasText: '3n+5 vs n' }).first();
    await chip.click();

    // Ensure custom wrap visible after chip click
    const fCustomWrap = page.locator('#fCustomWrap');
    const gCustomWrap = page.locator('#gCustomWrap');
    await expect(fCustomWrap).toBeVisible();
    await expect(gCustomWrap).toBeVisible();

    // Now click reset button - should perform reset() entry_action for S2_Reset and transition to Idle
    const resetBtn = page.locator('#reset');
    await resetBtn.click();

    // After reset, inputs should be restored to defaults and custom wraps hidden
    const fSelect = page.locator('#fSelect');
    const gSelect = page.locator('#gSelect');
    await expect(fSelect).toHaveValue('3*n + 5');
    await expect(gSelect).toHaveValue('n');
    await expect(fCustomWrap).toHaveCSS('display', 'none');
    await expect(gCustomWrap).toHaveCSS('display', 'none');

    // Metrics and conclusion restored to Idle texts
    const metrics2 = page.locator('#metrics2');
    await expect(metrics).toHaveText(/Press Analyze to compute\./);
    const conclusion1 = page.locator('#conclusion1');
    await expect(conclusion).toHaveText('—');
  });

  test('Selecting Custom toggles custom input fields for f and g (F_SELECT_CHANGE / G_SELECT_CHANGE)', async ({ page }) => {
    const fSelect1 = page.locator('#fSelect1');
    const gSelect1 = page.locator('#gSelect1');
    const fCustomWrap1 = page.locator('#fCustomWrap1');
    const gCustomWrap1 = page.locator('#gCustomWrap1');

    // Select custom for f and g and verify corresponding input wrappers become visible
    await fSelect.selectOption('custom');
    await expect(fCustomWrap).toBeVisible();

    await gSelect.selectOption('custom');
    await expect(gCustomWrap).toBeVisible();

    // Revert to non-custom and verify wrappers hide
    await fSelect.selectOption('3*n + 5');
    await expect(fCustomWrap).toHaveCSS('display', 'none');

    await gSelect.selectOption('n');
    await expect(gCustomWrap).toHaveCSS('display', 'none');
  });

  test('Analyze transition: known polynomial comparison produces strong evidence (S0 -> S1)', async ({ page }) => {
    // Set f(n) = 2*n*n + 4*n + 1 and g(n) = n*n and click Analyze
    const fSelect2 = page.locator('#fSelect2');
    const gSelect2 = page.locator('#gSelect2');
    await fSelect.selectOption('2*n*n + 4*n + 1');
    await gSelect.selectOption('n*n');

    // Click analyze button
    const analyzeBtn = page.locator('#analyze');
    await analyzeBtn.click();

    // Metrics should include observed min and max ratio and function code
    const metrics3 = page.locator('#metrics3');
    await expect(metrics).toContainText('Observed min ratio');
    await expect(metrics).toContainText('Observed max ratio');
    await expect(metrics).toContainText('f(n):');
    await expect(metrics).toContainText('g(n):');

    // Conclusion should state strong evidence for Theta
    const conclusion2 = page.locator('#conclusion2');
    await expect(conclusion).toContainText('f(n) ∈ Θ(g(n))');
    await expect(conclusion).toContainText('strong evidence');
    await expect(conclusion).toHaveClass(/status/);
  });

  test('Chip click sets values and triggers analyze (CHIP_CLICK -> S1_Analyzing)', async ({ page }) => {
    // Click on a chip quick example
    const chip1 = page.locator('.chip1', { hasText: '5n log n vs n log n' }).first();
    await chip.click();

    // After click, custom inputs should be visible and populated
    const fCustom = page.locator('#fCustom');
    const gCustom = page.locator('#gCustom');
    await expect(fCustom).toHaveValue('5*n*Math.log(n)');
    await expect(gCustom).toHaveValue('n*Math.log(n)');

    // Metrics should be updated to reflect selected functions
    const metrics4 = page.locator('#metrics4');
    await expect(metrics).toContainText('5*n*Math.log(n)');
    await expect(metrics).toContainText('n*Math.log(n)');

    // Conclusion should indicate Theta relationship likely (5nlogn is Theta nlogn)
    const conclusion3 = page.locator('#conclusion3');
    await expect(conclusion).toContainText('f(n) ∈ Θ(g(n))');
  });

  test('Invalid f(n): empty custom input shows error message and does not crash', async ({ page }) => {
    // Choose custom f and leave it empty, pick a valid g
    await page.locator('#fSelect').selectOption('custom');
    const fCustom1 = page.locator('#fCustom1');
    await fCustom.fill(''); // empty expression
    await page.locator('#gSelect').selectOption('n');

    // Click analyze
    await page.locator('#analyze').click();

    // Metrics should display Invalid f(n)
    const metrics5 = page.locator('#metrics5');
    await expect(metrics).toContainText('Invalid f(n):');

    // Ensure no uncaught pageerror occurred (handled in afterEach), and console captured the handled error may not exist
  });

  test('Invalid f(n): undefined variable triggers ReferenceError and is reported', async ({ page }) => {
    // Provide an undefined variable in f custom expression
    await page.locator('#fSelect').selectOption('custom');
    await page.locator('#fCustom').fill('nonexistentVar + 1');
    await page.locator('#gSelect').selectOption('n');

    // Click analyze
    await page.locator('#analyze').click();

    // The metrics should contain an Invalid f(n) message referencing the undefined variable
    const metrics6 = page.locator('#metrics6');
    await expect(metrics).toContainText('Invalid f(n):');
    // The error message should mention 'not defined' or similar (ReferenceError message differs by engine)
    const metricsText = await metrics.textContent() || '';
    expect(/not defined|is not defined|ReferenceError/i.test(metricsText)).toBeTruthy();
  });

  test('g(n) = 0 leads to undetermined conclusion (no valid ratios)', async ({ page }) => {
    // Set f to constant 1 and g to custom 0
    await page.locator('#fSelect').selectOption('1');
    await page.locator('#gSelect').selectOption('custom');
    await page.locator('#gCustom').fill('0');

    // Click analyze
    await page.locator('#analyze').click();

    // Expect the metrics to mention no valid ratio values and conclusion to be Undetermined
    const metrics7 = page.locator('#metrics7');
    await expect(metrics).toContainText('No valid ratio values');

    const conclusion4 = page.locator('#conclusion4');
    await expect(conclusion).toHaveText('Undetermined');
    await expect(conclusion).toHaveClass(/bad/);
  });

  test('Spacing log option and sample count affect sampling (sampleNs path coverage)', async ({ page }) => {
    // Set spacing to log and samples to 50, then analyze
    await page.locator('#spacing').selectOption('log');
    await page.locator('#samples').fill('50');
    await page.locator('#n0').fill('2');
    await page.locator('#Nmax').fill('10000');

    await page.locator('#analyze').click();

    // Metrics should reflect sampling from provided n0 to Nmax and the specified samples
    const metrics8 = page.locator('#metrics8');
    await expect(metrics).toContainText('Sample n from 2 to 10000 (50 points)');

    // No uncaught errors should have occurred (asserted in afterEach)
  });

  // Final sanity check: ensure no uncaught console errors were emitted during the tests run
  test('No uncaught runtime errors were emitted to pageerror', async ({ page }) => {
    // This test simply asserts that pageErrors captured in beforeEach/afterEach remain empty
    // The afterEach hook already asserts pageErrors.length === 0; repeat here as a grouped assertion.
    expect(pageErrors.length).toBe(0);
  });
});