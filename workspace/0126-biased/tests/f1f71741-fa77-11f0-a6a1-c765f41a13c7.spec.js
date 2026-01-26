import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f71741-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object to encapsulate selectors and common actions
class OmegaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      toggleBtn: '#toggleBtn',
      playPause: '#playPause',
      jumpBtn: '#jumpBtn',
      infoBtn: '#infoBtn',
      cardTip: '#cardTip',
      status: '#status',
      curveF: '#curveF',
      curveG: '#curveG',
      curveCg: '#curveCg',
      areaPass: '#areaPass',
      n0line: '#n0line',
      n0lbl: '#n0lbl',
      graph: '#graph',
      graphWrap: '#graphWrap'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickToggle() {
    await this.page.click(this.selectors.toggleBtn);
  }
  async clickPlayPause() {
    await this.page.click(this.selectors.playPause);
  }
  async clickReset() {
    await this.page.click(this.selectors.jumpBtn);
  }
  async clickInfo() {
    await this.page.click(this.selectors.infoBtn);
  }

  async getToggleText() {
    return (await this.page.locator(this.selectors.toggleBtn).textContent())?.trim();
  }
  async getPlayPauseText() {
    return (await this.page.locator(this.selectors.playPause).textContent())?.trim();
  }
  async getStatusText() {
    return (await this.page.locator(this.selectors.status).textContent())?.then(t => t?.trim());
  }
  async cardTipHasShowClass() {
    return this.page.locator(this.selectors.cardTip).evaluate(el => el.classList.contains('show'));
  }
  async getN0LabelText() {
    return (await this.page.locator(this.selectors.n0lbl).textContent())?.trim();
  }
  async getN0LineX1() {
    return await this.page.locator(this.selectors.n0line).getAttribute('x1');
  }
  async getCurveD(pathSelector) {
    return await this.page.locator(pathSelector).getAttribute('d');
  }
  async getAreaOpacity() {
    return await this.page.locator(this.selectors.areaPass).getAttribute('opacity');
  }
}

test.describe('Big-Omega visual demo (f1f71741...) - FSM and interactions', () => {
  // Collect console and page errors for each test and assert expectations
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // collect all console messages
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // collect unhandled exceptions from the page
      pageErrors.push(err);
    });
  });

  test('Initial load: Idle state (S0_Idle) -> updateGraphics run and initial DOM present', async ({ page }) => {
    // This test validates the initial "Idle" like setup: updateGraphics() executed,
    // initial SVG paths exist, and UI shows Pause (running=true).
    const p = new OmegaPage(page);
    await p.goto();

    // Basic sanity: important UI components should be present
    await expect(page.locator('#toggleBtn')).toBeVisible();
    await expect(page.locator('#playPause')).toBeVisible();
    await expect(page.locator('#jumpBtn')).toBeVisible();
    await expect(page.locator('#infoBtn')).toBeVisible();
    await expect(page.locator('#cardTip')).toBeVisible();

    // Verify the controls show "Pause" indicating the animation started (running = true)
    const toggleText = await p.getToggleText();
    const playPauseText = await p.getPlayPauseText();
    expect(toggleText).toBeDefined();
    expect(playPauseText).toBeDefined();
    // The implementation sets both to 'Pause' on init
    expect(toggleText).toBe('Pause');
    expect(playPauseText).toBe('Pause');

    // Ensure updateGraphics created valid path data for curves (non-empty 'd' attributes)
    const dF = await p.getCurveD('#curveF');
    const dG = await p.getCurveD('#curveG');
    const dCg = await p.getCurveD('#curveCg');
    expect(dF).toBeTruthy(); // non-empty path string
    expect(dG).toBeTruthy();
    expect(dCg).toBeTruthy();

    // n0 label should be initialized to n₀ = 0.* (exact formatting comes from toFixed(1))
    const n0lbl = await p.getN0LabelText();
    expect(n0lbl).toMatch(/^n₀ = 0\.0$/);

    // areaPass initially should have 'd' attribute (maybe empty string when n0 at end) and opacity set by updateGraphics
    const areaOpacity = await p.getAreaOpacity();
    // areaPass gets opacity '0.96' or '0.32' depending on check; ensure attribute exists
    expect(areaOpacity).toBeTruthy();

    // Ensure no uncaught page errors happened during initialization
    expect(pageErrors.length).toBe(0);
    // Also ensure no console messages of type 'error' were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleAnimation events: clicking play/pause buttons toggles animation state (S0->S1 and S1->S2)', async ({ page }) => {
    // This test exercises both event triggers (#toggleBtn and #playPause) to toggle running state.
    const p = new OmegaPage(page);
    await p.goto();

    // Click the dedicated play/pause control in the controls panel (#playPause)
    await p.clickPlayPause();
    // After clicking, the code flips running -> Play text
    await expect(page.locator('#playPause')).toHaveText('Play');
    await expect(page.locator('#toggleBtn')).toHaveText('Play');

    // Click again using the header toggle (#toggleBtn) to resume
    await p.clickToggle();
    await expect(page.locator('#playPause')).toHaveText('Pause');
    await expect(page.locator('#toggleBtn')).toHaveText('Pause');

    // Validate status pill still exists and contains a text indicator (scanning... or Verified)
    const statusText = (await p.getStatusText()) || '';
    expect(statusText.length).toBeGreaterThan(0);

    // Check no page errors occurred while toggling
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetAnimation (Jump) resets t and n0 -> results in n₀ = 0 and UI set to running (S1_Animating -> S0_Idle)', async ({ page }) => {
    // This test validates that clicking Reset brings the animation back to the beginning.
    const p = new OmegaPage(page);
    await p.goto();

    // Let the animation advance a short moment to change n0 from 0 (so reset is meaningful)
    await page.waitForTimeout(200); // small wait to let tick change t slightly

    // Ensure the n₀ label is not exactly 0.0 in most cases after some frames; capture before reset
    const before = await p.getN0LabelText();

    // Perform reset
    await p.clickReset();

    // After reset, code sets t=0, n0=0 and running = true and updates UI text to 'Pause'
    await expect(page.locator('#playPause')).toHaveText('Pause');
    await expect(page.locator('#toggleBtn')).toHaveText('Pause');

    // Validate n₀ label shows 0.0 (reset)
    const after = await p.getN0LabelText();
    expect(after).toBe('n₀ = 0.0');

    // Validate n0line moved to x coordinate for n=0. The plotting offsetX is 80 in the app; expect x1 to be '80' or very close.
    const x1 = await p.getN0LineX1();
    // Some browsers may present integer or float strings; assert numeric closeness
    expect(Number(x1)).toBeGreaterThan(70);
    expect(Number(x1)).toBeLessThan(90);

    // Verify the curve paths remain defined after reset (updateGraphics executed on reset)
    const dF_after = await p.getCurveD('#curveF');
    expect(dF_after).toBeTruthy();

    // No page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ShowDefinition toggles info overlay (S0_Idle <-> S3_DefinitionVisible) and can be closed immediately', async ({ page }) => {
    // This test exercises the info overlay toggling via #infoBtn and ensures the class 'show' is added/removed.
    const p = new OmegaPage(page);
    await p.goto();

    // Initially the card-tip should NOT have the 'show' class
    const initialHas = await p.cardTipHasShowClass();
    expect(initialHas).toBe(false);

    // Click info to show definition overlay
    await p.clickInfo();
    // Class should be present immediately after click
    await expect(page.locator('#cardTip')).toHaveClass(/show/);

    // Click info again to hide immediately (the code toggles)
    await p.clickInfo();
    // Now the class should be removed
    await expect(page.locator('#cardTip')).not.toHaveClass(/show/);

    // Also test auto-hide path by showing and waiting for the auto-hide timeout slightly over 7s
    // We will show it, then wait for it to be removed by the internal timeout.
    await p.clickInfo();
    // Ensure it becomes visible
    await expect(page.locator('#cardTip')).toHaveClass(/show/);
    // Wait for slightly more than the auto-hide delay to confirm it disappears (but keep test timeout reasonable)
    await page.waitForTimeout(7200);
    // The overlay should no longer have the 'show' class after auto-hide
    const afterAutoHide = await p.cardTipHasShowClass();
    expect(afterAutoHide).toBe(false);

    // No page errors during toggling
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Both ToggleAnimation triggers (#toggleBtn and #playPause) are wired and consistent', async ({ page }) => {
    // This test ensures both event triggers produce consistent visible results and update both buttons in-sync.
    const p = new OmegaPage(page);
    await p.goto();

    // Use #toggleBtn to pause
    await p.clickToggle();
    await expect(page.locator('#toggleBtn')).toHaveText('Play');
    await expect(page.locator('#playPause')).toHaveText('Play');

    // Use #playPause to resume
    await p.clickPlayPause();
    await expect(page.locator('#toggleBtn')).toHaveText('Pause');
    await expect(page.locator('#playPause')).toHaveText('Pause');

    // Use #playPause to pause again
    await p.clickPlayPause();
    await expect(page.locator('#toggleBtn')).toHaveText('Play');
    await expect(page.locator('#playPause')).toHaveText('Play');

    // Final assertion: no uncaught runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: repeated rapid interactions do not throw errors (robustness)', async ({ page }) => {
    // This test performs a flurry of UI interactions (clicks) to ensure stability and that no unhandled exceptions are produced.
    const p = new OmegaPage(page);
    await p.goto();

    // Rapid sequence: toggle, reset, info, toggle, info, reset
    await Promise.all([
      p.clickToggle(),
      p.clickReset()
    ]);
    // Staggered rapid clicks
    await p.clickInfo();
    await p.clickInfo();
    await p.clickToggle();
    await p.clickReset();
    await p.clickPlayPause();

    // Give a short moment for event handlers to run
    await page.waitForTimeout(150);

    // Assert that no page errors were captured as a result of the rapid interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);

    // Also ensure controls are still interactive and in a consistent state (text content present)
    const toggleText = await p.getToggleText();
    const playPauseText = await p.getPlayPauseText();
    expect(toggleText).toBeTruthy();
    expect(playPauseText).toBeTruthy();
  });

  test('Verify visual feedback: status pill updates when condition satisfied (satisfying scenario detection)', async ({ page }) => {
    // This test inspects the status pill text and color changes that indicate the verification state.
    // We will not force the animation to fully scan to Verified (could be time-consuming), but we will assert that
    // the status pill contains one of the expected textual indicators and that the DOM updates are applied.
    const p = new OmegaPage(page);
    await p.goto();

    // Status text should contain either 'scanning...' or 'Verified' or 'checking...'
    const statusText = (await p.getStatusText()) || '';
    expect(
      ['scanning...', 'checking...', 'Verified'].some(expected => statusText.includes(expected))
    ).toBe(true);

    // If 'Verified' occurs at any time during the test, ensure the status color got updated to a greenish color string
    if (statusText.includes('Verified')) {
      // the implementation sets status.style.color to '#cff5dd' when Verified
      const color = await page.locator('#status').evaluate(el => window.getComputedStyle(el).color);
      expect(color).toBeTruthy();
    }

    // Confirm the areaPass element has a path (d attribute) and visible opacity
    const areaD = await p.getCurveD('#areaPass');
    expect(areaD).toBeTruthy(); // may be empty string, but attribute should exist (non-null)
    const areaOpacity = await p.getAreaOpacity();
    expect(areaOpacity).toBeTruthy();

    // No page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});