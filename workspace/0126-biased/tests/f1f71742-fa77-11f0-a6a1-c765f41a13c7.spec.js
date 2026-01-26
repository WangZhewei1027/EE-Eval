import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f71742-fa77-11f0-a6a1-c765f41a13c7.html';

/**
 * Page object for the Time Complexity visualization page.
 * Encapsulates common selectors and tiny helpers for assertions.
 */
class TimeComplexityPage {
  constructor(page) {
    this.page = page;
    this.toggle = page.locator('#toggle');
    this.toggleLabel = page.locator('#toggleLabel');
    this.dot = page.locator('#toggle .dot');
    this.labelsBtn = page.locator('#labelsBtn');
    this.stage = page.locator('#stage');
    this.labelsRegion = page.locator('#labelsRegion');
    this.plots = page.locator('#plots');
    this.markers = page.locator('#markers');
  }

  // Returns number of rendered curve path elements inside #plots
  async curveCount() {
    return await this.page.locator('#plots .curve').count();
  }

  // Returns number of marker groups inside #markers
  async markerGroupCount() {
    return await this.page.locator('#markers .marker-group').count();
  }

  // Returns the 'd' attribute of the first path.curve if present, else empty string
  async firstCurvePathD() {
    const el = this.page.locator('#plots .curve').first();
    if (await el.count() === 0) return '';
    return await el.getAttribute('d');
  }

  // Returns computed style property value of a selector (useful for opacity/transform)
  async computedStyle(selector, property) {
    return await this.page.evaluate(
      ({ selector, property }) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return cs.getPropertyValue(property);
      },
      { selector, property }
    );
  }

  // Returns attribute value string
  async attr(selector, attribute) {
    return await this.page.evaluate(
      ({ selector, attribute }) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute(attribute) : null;
      },
      { selector, attribute }
    );
  }
}

// Top-level grouping for all tests related to this application
test.describe('Time Complexity — Visual Exploration (f1f71742...)', () => {
  let page;
  let app;
  let consoleErrors;
  let pageErrors;

  // Set up page and listeners before each test
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // capture console error messages and page errors
    consoleErrors = [];
    pageErrors = [];
    page.on('console', (msg) => {
      // capture console messages with type 'error'
      try {
        if (msg.type() === 'error') {
          const text = msg.text();
          consoleErrors.push({ text, location: msg.location() });
        }
      } catch (e) {
        // ignore any inspection errors
      }
    });
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(err.message);
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Navigate to the provided static HTML location
    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    app = new TimeComplexityPage(page);
  });

  // Close page after each test
  test.afterEach(async () => {
    await page.close();
  });

  // ---- Test: Initial state and render() on entry ----
  test('Initial state: Playing (S0_Playing) and Labels hidden (S3_LabelsHidden) with render() output', async () => {
    // Comments: Validate that on initial load the UI reflects "playing" true and labels hidden.
    // Also validate that render() produced SVG paths and markers (evidence of entry action).

    // Initial toggle label should be "Pause" (playing = true)
    await expect(app.toggleLabel).toHaveText('Pause');

    // aria-pressed attribute should be "true"
    const ariaPressed = await app.toggle.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');

    // The dot inside toggle should have visible opacity when playing (style set to 1)
    // Computed style returns values like '1' or '1.0'
    const dotOpacity = await app.computedStyle('#toggle .dot', 'opacity');
    expect(dotOpacity).toBeTruthy();
    // accept either '1' or values close to '1'
    expect(Number.parseFloat(dotOpacity) >= 0.9).toBe(true);

    // Labels region should be hidden initially (aria-hidden true and style opacity 0 set by JS)
    const labelsRegionAriaHidden = await app.attr('#labelsRegion', 'aria-hidden');
    expect(labelsRegionAriaHidden).toBe('true');

    // The stage should NOT have the 'show-labels' class initially
    const hasShowLabels = await page.evaluate(() => document.getElementById('stage').classList.contains('show-labels'));
    expect(hasShowLabels).toBe(false);

    // Ensure render() created curve paths and marker groups: expect at least 6 (one per family)
    const curves = await app.curveCount();
    expect(curves).toBeGreaterThanOrEqual(6);

    const markers = await app.markerGroupCount();
    expect(markers).toBeGreaterThanOrEqual(6);

    // The first path 'd' attribute should be non-empty (smooth path generated)
    const firstD = await app.firstCurvePathD();
    expect(firstD).toBeTruthy();
    expect(firstD.length).toBeGreaterThan(10);

    // No unexpected page errors or console errors during initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // ---- Test: Toggle Play/Pause transitions (S0 <-> S1) ----
  test('Toggle Play/Pause button transitions between Playing and Paused (TogglePlayPause event)', async () => {
    // Comments: Validate clicking the toggle button flips playing state, updates text, aria, and dot opacity.

    // Initial assumptions
    await expect(app.toggleLabel).toHaveText('Pause');
    expect(await app.toggle.getAttribute('aria-pressed')).toBe('true');

    // Click to pause
    await app.toggle.click();

    // After click, label should become 'Play'
    await expect(app.toggleLabel).toHaveText('Play');

    // aria-pressed should be 'false'
    expect(await app.toggle.getAttribute('aria-pressed')).toBe('false');

    // dot opacity should be reduced (code sets to 0.3 when paused)
    const dotOpacityPaused = await app.computedStyle('#toggle .dot', 'opacity');
    expect(Number.parseFloat(dotOpacityPaused)).toBeGreaterThanOrEqual(0.29);
    expect(Number.parseFloat(dotOpacityPaused)).toBeLessThanOrEqual(0.35);

    // Click again to resume playing
    await app.toggle.click();

    // Label returns to 'Pause'
    await expect(app.toggleLabel).toHaveText('Pause');

    // aria-pressed back to 'true'
    expect(await app.toggle.getAttribute('aria-pressed')).toBe('true');

    // dot opacity returns to ~1
    const dotOpacityPlaying = await app.computedStyle('#toggle .dot', 'opacity');
    expect(Number.parseFloat(dotOpacityPlaying)).toBeGreaterThanOrEqual(0.9);

    // Ensure no page runtime errors were thrown during the toggles
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // ---- Test: Toggle Labels transitions (S3 <-> S2) ----
  test('Toggle Labels button shows and hides labels and updates class (ToggleLabels event)', async () => {
    // Comments: Clicking labels button toggles showLabels and updates stage.classList, labelsRegion, and marker text opacity.

    // Initially labels hidden
    expect(await page.evaluate(() => document.getElementById('stage').classList.contains('show-labels'))).toBe(false);
    await expect(app.labelsBtn).toHaveText('Show labels');

    // Click to show labels
    await app.labelsBtn.click();

    // labelsBtn text should change to "Hide labels"
    await expect(app.labelsBtn).toHaveText('Hide labels');

    // aria-pressed should be set to 'true' by the handler
    expect(await app.labelsBtn.getAttribute('aria-pressed')).toBe('true');

    // stage should have show-labels class
    const showLabelsAfter = await page.evaluate(() => document.getElementById('stage').classList.contains('show-labels'));
    expect(showLabelsAfter).toBe(true);

    // The labelsRegion style should have been updated (opacity 1 and transform translateY(0))
    const labelsOpacity = await app.computedStyle('#labelsRegion', 'opacity');
    expect(Number.parseFloat(labelsOpacity)).toBeGreaterThan(0.9);

    const labelsTransform = await app.computedStyle('#labelsRegion', 'transform');
    // transform might be 'matrix(...)' or 'none'; ensure it's not the translateY(12px) state
    expect(labelsTransform).not.toBe('translateY(12px)');

    // Each marker's text tag .tag should have opacity 1 (they are toggled in JS)
    const firstTagOpacity = await app.computedStyle('#markers .marker-group .tag', 'opacity');
    expect(Number.parseFloat(firstTagOpacity)).toBeGreaterThan(0.9);

    // Click again to hide labels
    await app.labelsBtn.click();

    // labelsBtn text flips back
    await expect(app.labelsBtn).toHaveText('Show labels');

    // aria-pressed now either null or 'false' (code sets 'false'); check it
    expect(await app.labelsBtn.getAttribute('aria-pressed')).toBe('false');

    // stage should no longer have show-labels
    const showLabelsAfterHide = await page.evaluate(() => document.getElementById('stage').classList.contains('show-labels'));
    expect(showLabelsAfterHide).toBe(false);

    // labelsRegion opacity should have been set back near 0
    const labelsOpacityHidden = await app.computedStyle('#labelsRegion', 'opacity');
    expect(Number.parseFloat(labelsOpacityHidden)).toBeLessThan(0.5);

    // marker tag opacity should now be near 0
    const firstTagOpacityHidden = await app.computedStyle('#markers .marker-group .tag', 'opacity');
    expect(Number.parseFloat(firstTagOpacityHidden)).toBeLessThan(0.5);

    // Ensure no runtime page errors during label toggles
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // ---- Test: Repeated interactions and edge cases ----
  test('Rapid toggling of labels and play does not throw errors (edge case)', async () => {
    // Comments: Simulate rapid repeated clicks on controls to expose any race conditions or errors.

    // Perform rapid toggles
    for (let i = 0; i < 6; i++) {
      await app.toggle.click();
      await app.labelsBtn.click();
    }

    // After rapid toggles, the DOM should still be consistent:
    // - there should be at least 6 curves and marker groups
    expect(await app.curveCount()).toBeGreaterThanOrEqual(6);
    expect(await app.markerGroupCount()).toBeGreaterThanOrEqual(6);

    // One of the label button states must be a valid label string
    const labelText = await app.labelsBtn.textContent();
    expect(['Show labels', 'Hide labels']).toContain(labelText.trim());

    // One of the toggle label states must be valid
    const toggleText = await app.toggleLabel.textContent();
    expect(['Play', 'Pause']).toContain(toggleText.trim());

    // No page errors or console errors should have been produced by rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // ---- Test: Responsive resize triggers re-render (debounced) ----
  test('Window resize triggers re-render without errors', async () => {
    // Comments: The application listens to 'resize' with a debounce before calling render().
    // We assert that the plots area remains populated after a resize and that no page errors occur.

    // Capture first curve path 'd' attribute (presence)
    const beforeD = await app.firstCurvePathD();
    expect(beforeD).toBeTruthy();

    // Trigger resize event by changing viewport size and dispatching resize
    await page.setViewportSize({ width: 800, height: 900 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));

    // wait longer than the debounce (180ms) to allow render to run
    await page.waitForTimeout(300);

    // After resize, ensure curves still present
    const afterCurves = await app.curveCount();
    expect(afterCurves).toBeGreaterThanOrEqual(6);

    // The first curve path 'd' should still be present (may be identical or regenerated)
    const afterD = await app.firstCurvePathD();
    expect(afterD).toBeTruthy();

    // No runtime errors produced during resize/render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // ---- Test: Observe console and page error collection behavior ----
  test('Collects console and page errors (assert none are present)', async () => {
    // Comments: Ensure our listeners capture page console errors and page errors.
    // This test simply asserts that zero errors occurred during normal usage.
    // It also prints any collected errors to the test output if unexpected.

    // Perform a few benign interactions to exercise code paths
    await app.labelsBtn.click();
    await app.toggle.click();
    await app.toggle.click();
    await app.labelsBtn.click();

    // small wait to allow any asynchronous errors to be reported
    await page.waitForTimeout(200);

    // Assert that there were no pageerrors or console error messages
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // If there are errors, fail explicitly and include diagnostics
      console.log('Captured pageErrors:', pageErrors);
      console.log('Captured consoleErrors:', consoleErrors);
    }
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});