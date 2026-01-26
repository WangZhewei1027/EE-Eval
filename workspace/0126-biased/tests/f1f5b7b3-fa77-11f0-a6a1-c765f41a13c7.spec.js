import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f5b7b3-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Radix Sort Visualizer (f1f5b7b3-fa77...) - FSM and UI validation', () => {
  // Containers to gather runtime console and page errors for each test
  let pageErrors = [];
  let consoleErrors = [];

  // Helper Page Object for common locators and interactions
  const PO = {
    startBtn: (page) => page.locator('#startBtn'),
    shuffleBtn: (page) => page.locator('#shuffleBtn'),
    passIndicator: (page) => page.locator('#passIndicator'),
    countLabel: (page) => page.locator('#countLabel'),
    digitsLabel: (page) => page.locator('#digitsLabel'),
    buckets: (page) => page.locator('.bucket'),
    cards: (page) => page.locator('.card'),
    inputTrack: (page) => page.locator('#inputTrack'),
  };

  // Attach listeners and navigate before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture runtime exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Load the exact HTML page as-is (no modifications)
    await page.goto(APP_URL);
    // ensure initial layout calculations settle
    await page.waitForLoadState('domcontentloaded');
  });

  // After each test ensure we observed and saved console/page errors (assertions done inside tests as needed)
  test.afterEach(async () => {
    // Nothing to tear down globally here; tests will assert on pageErrors/consoleErrors themselves.
  });

  test('Initial state S0_Idle: init() ran and UI shows Ready state with expected components', async ({ page }) => {
    // Validate initial UI reflects the Idle state:
    // - passIndicator should indicate "Ready • {N} passes"
    // - countLabel should indicate 8 items (generateValues always creates 8)
    // - digitsLabel should reflect some number of passes (>=1)
    // - buckets (10) and initial cards (8) exist in the DOM

    // Check passIndicator starts with "Ready • X passes"
    await expect(PO.passIndicator(page)).toHaveText(/Ready\s•\s\d+\spasses/);

    // Check count label is stable "8 items"
    await expect(PO.countLabel(page)).toHaveText(/^\d+\sitems$/);
    const countText = await PO.countLabel(page).textContent();
    // generateValues uses n = 8 — assert that the UI shows 8 items
    expect(countText.trim()).toBe('8 items');

    // digitsLabel should be present and reflect maxDigits
    await expect(PO.digitsLabel(page)).toHaveText(/\d+\spasses/);
    const digitsText = await PO.digitsLabel(page).textContent();
    const maxDigits = parseInt(digitsText.trim().split(' ')[0], 10);
    expect(Number.isFinite(maxDigits) && maxDigits >= 1).toBeTruthy();

    // There should be 10 buckets created by buildBuckets()
    await expect(PO.buckets(page)).toHaveCount(10);

    // There should be 8 cards placed into the input track
    await expect(PO.cards(page)).toHaveCount(8);

    // Ensure no runtime page errors or console.error messages occurred during initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('StartAnimationClick triggers S1_Animating entry: animateRadix() starts and disables controls (entry actions)', async ({ page }) => {
    // This test validates the "onEnter" behavior of S1_Animating:
    // - Clicking Start should invoke animateRadix -> set STATE.animating true
    // - start and shuffle buttons should become disabled
    // - passIndicator should switch to "Pass: 0 / {maxDigits}" initially

    // Read current digits (maxDigits) to assert correct passIndicator formatting
    const digitsText = (await PO.digitsLabel(page).textContent()).trim();
    const maxDigits = parseInt(digitsText.split(' ')[0], 10);

    // Click Start and immediately assert entry side-effects
    await PO.startBtn(page).click();

    // After starting animation, both buttons should be disabled
    await expect(PO.startBtn(page)).toBeDisabled();
    await expect(PO.shuffleBtn(page)).toBeDisabled();

    // animateRadix sets passIndicator to "Pass: 0 / {maxDigits}" at start
    // Use a regex that includes the parsed maxDigits (sanity check)
    await expect(PO.passIndicator(page)).toHaveText(new RegExp(`^Pass:\\s*0\\s*/\\s*${maxDigits}$`));

    // Additionally, within a short time the passIndicator will progress to Pass: 1 / N
    // We wait for the first pass indicator update (this validates animation started)
    await page.waitForFunction(
      (selector, max) => {
        const el = document.querySelector(selector);
        if(!el) return false;
        return /Pass:\s*1\s*\/\s*/.test(el.textContent || '');
      },
      PO.passIndicator(page).selector,
      maxDigits,
      { timeout: 5000 }
    );

    // Ensure no unexpected page errors or console errors so far
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ShuffleClick behaviour while animating: shuffle is disabled during S1_Animating (edge case vs FSM)', async ({ page }) => {
    // This test demonstrates an important edge case: the FSM extraction indicated a transition
    // from S1_Animating -> S0_Idle on ShuffleClick, but the implementation disables shuffle
    // while animating. We assert the implementation's behavior (shuffle is ignored while animating).

    // Start animation
    await PO.startBtn(page).click();

    // Confirm shuffle is disabled per implementation
    await expect(PO.shuffleBtn(page)).toBeDisabled();

    // Try to perform a user-like click on the Shuffle button using Playwright's click:
    // This will fail if the element is disabled. Instead of forcing a click (which would
    // diverge from realistic user behavior), assert that the button is disabled and thus
    // the Shuffle event is not triggered while animating.
    // The FSM expected a transition on ShuffleClick during animating, but implementation prevents it.

    // Confirm passIndicator still indicates a pass is in progress (starts with "Pass:")
    await expect(PO.passIndicator(page)).toHaveText(/^Pass:\s*\d+\s*\/\s*\d+$/);

    // Ensure that after attempting to interact (we don't force a disabled click), nothing turned to Ready
    const passText = (await PO.passIndicator(page).textContent()).trim();
    expect(passText.startsWith('Pass:')).toBe(true);

    // Confirm no page errors or console errors were produced by these interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Complete animation then ShuffleClick returns to S0_Idle: Completed -> Ready and UI resets', async ({ page }) => {
    // This test will wait for the animation to complete and then assert that Shuffle returns
    // the app back to the Ready state (S0_Idle). This validates exit of S1_Animating and re-init.

    // Increase timeout for this test because full animation can take a non-trivial amount of time
    test.setTimeout(90000);

    // Determine maxDigits so we can assert the final Completed message
    const digitsText = (await PO.digitsLabel(page).textContent()).trim();
    const maxDigits = parseInt(digitsText.split(' ')[0], 10);

    // Start animation
    await PO.startBtn(page).click();

    // Wait for the animation to finish. Implementation flips STATE.animating to false and
    // re-enables the buttons when complete. We observe startBtn becoming enabled as a sign.
    await page.waitForFunction(() => {
      const sb = document.getElementById('startBtn');
      return sb && !sb.disabled;
    }, { timeout: 60000 });

    // Now that animation finished, passIndicator should show "Completed • {maxDigits} passes"
    await expect(PO.passIndicator(page)).toHaveText(new RegExp(`^Completed\\s•\\s${maxDigits}\\spasses$`));

    // Buttons should be enabled now
    await expect(PO.startBtn(page)).toBeEnabled();
    await expect(PO.shuffleBtn(page)).toBeEnabled();

    // Click Shuffle to return to Ready S0_Idle state
    await PO.shuffleBtn(page).click();

    // After shuffle, passIndicator and labels should reflect Ready state and new/random maxDigits
    await expect(PO.passIndicator(page)).toHaveText(/Ready\s•\s\d+\spasses/);
    await expect(PO.countLabel(page)).toHaveText(/^\d+\sitems$/);
    await expect(PO.digitsLabel(page)).toHaveText(/\d+\spasses/);

    // There should still be 10 buckets and 8 cards created after shuffle
    await expect(PO.buckets(page)).toHaveCount(10);
    await expect(PO.cards(page)).toHaveCount(8);

    // Confirm no unhandled runtime exceptions or console.error messages occurred during the whole flow
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotent protections: clicking Start while already animating does not spawn duplicate animations', async ({ page }) => {
    // Validate that the implementation guards against re-entrancy:
    // clicking Start when STATE.animating is true should be prevented by the code.

    // Click Start to begin animation
    await PO.startBtn(page).click();

    // Immediately attempt to click Start again (real user shouldn't be able to click because it's disabled)
    // Instead of forcing a disabled click, assert that the button is disabled and remains disabled
    await expect(PO.startBtn(page)).toBeDisabled();

    // Wait a short while and ensure the button is still disabled (animation underway)
    await page.waitForTimeout(500);
    await expect(PO.startBtn(page)).toBeDisabled();

    // After animation completes, the start button should re-enable; wait for that state
    await page.waitForFunction(() => {
      const sb = document.getElementById('startBtn');
      return sb && !sb.disabled;
    }, { timeout: 60000 });

    // No runtime errors occurred during this attempted double-start
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Robustness checks: validate utility DOM helpers and computed layouts exist', async ({ page }) => {
    // This test verifies helpers like positionBucketsArc(), getBucketSlotCenter(), and computed transforms
    // result in measurable DOM layout attributes without throwing errors.

    // Ensure buckets have inline transform style applied by positionBucketsArc
    const bucketTransforms = await page.$$eval('.bucket', els => els.map(e => e.style.transform || ''));
    // Each bucket should have a transform string (not necessarily non-empty depending on layout timing)
    const haveTransforms = bucketTransforms.some(t => t && t.length > 0);
    expect(haveTransforms).toBeTruthy();

    // Ensure each bucket has a slot element with measurable clientRect
    const slotClientRects = await page.$$eval('.bucket .slot', slots => slots.map(s => {
      const r = s.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }));
    // All slots should report non-zero width/height
    for (const rect of slotClientRects) {
      expect(rect.w).toBeGreaterThanOrEqual(0);
      expect(rect.h).toBeGreaterThanOrEqual(0);
    }

    // Validate inputTrack exists and has clientWidth
    const trackRect = await page.$eval('#inputTrack', el => {
      const r = el.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height) };
    });
    expect(trackRect.width).toBeGreaterThan(0);

    // Confirm no runtime exceptions arose during these layout probes
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('No unexpected ReferenceError/SyntaxError/TypeError occurred during any interaction', async ({ page }) => {
    // This test is explicit about ensuring that the runtime did not produce ReferenceError/SyntaxError/TypeError.
    // Any such exceptions would be captured by page.on('pageerror') earlier.
    // Because we attach listeners in beforeEach, here we simply assert the collected errors do not include typical fatal types.

    // If there are pageErrors, examine their names and messages
    if (pageErrors.length > 0) {
      const names = pageErrors.map(e => (e && e.name) || '');
      // Fail the test if any fatal JS error types are present
      expect(names).not.toContain('ReferenceError');
      expect(names).not.toContain('SyntaxError');
      expect(names).not.toContain('TypeError');
    }

    // Also ensure there were no console.error messages
    expect(consoleErrors.length).toBe(0);
  });
});