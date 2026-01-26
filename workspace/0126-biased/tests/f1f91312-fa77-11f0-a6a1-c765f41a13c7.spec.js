import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f91312-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Linear Regression — Visual Concept (f1f91312...) FSM tests', () => {
  // Shared collectors for console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the exact HTML page under test
    await page.goto(APP_URL);
    // Wait for main interactive controls to be present
    await page.waitForSelector('#playBtn');
    await page.waitForSelector('#resBtn');
    await page.waitForSelector('#viz');
  });

  test.afterEach(async () => {
    // After each test, ensure there are no uncaught page errors
    // and no console messages of type "error".
    // These assertions surface runtime issues like ReferenceError/TypeError if they occur.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('States (FSM) - verify onEnter rendering and Idle state', () => {
    test('Idle state: initial render shows controls, points, and computed stats', async ({ page }) => {
      // Validate initial Idle state UI elements and attributes
      // 1) Play and Residuals buttons exist and have aria-pressed="false"
      const playAria = await page.getAttribute('#playBtn', 'aria-pressed');
      const resAria = await page.getAttribute('#resBtn', 'aria-pressed');
      expect(playAria).toBe('false');
      expect(resAria).toBe('false');

      // 2) Buttons contain expected text
      const playText = (await page.textContent('#playBtn')) || '';
      const resText = (await page.textContent('#resBtn')) || '';
      expect(playText.trim()).toMatch(/Play|Animating/); // initial should show Play
      expect(resText.trim()).toBe('Residuals');

      // 3) Points are rendered into the SVG (#points) and have the expected count (>= 18)
      const pointsCount = await page.$eval('#points', (el) => el.children.length);
      expect(pointsCount).toBeGreaterThanOrEqual(18);

      // 4) Residuals group is empty initially
      const residualsCount = await page.$eval('#residuals', (el) => el.children.length);
      expect(residualsCount).toBe(0);

      // 5) Statistics are computed on load — slope, intercept, and R² should not be the placeholder '—'
      const slopeText = (await page.textContent('#slopeVal')) || '';
      const interceptText = (await page.textContent('#interceptVal')) || '';
      const r2Text = (await page.textContent('#r2Val')) || '';
      // At least slope, intercept, or r2 should display a numeric value (not all placeholders)
      const allPlaceholders = slopeText.trim() === '—' && interceptText.trim() === '—' && r2Text.trim() === '—';
      expect(allPlaceholders).toBe(false);
    });
  });

  test.describe('Transitions (FSM events) - PlayAnimation and ToggleResiduals', () => {
    test('PlayAnimation: clicking Play starts animation and returns to Idle', async ({ page }) => {
      // Capture the initial fit line endpoints for later comparison
      const initialLine = await page.$eval('#fitLine', (line) => ({
        x1: line.getAttribute('x1'),
        y1: line.getAttribute('y1'),
        x2: line.getAttribute('x2'),
        y2: line.getAttribute('y2'),
      }));

      // Click Play to trigger animation (transition S0_Idle -> S1_Animating)
      await page.click('#playBtn');

      // Immediately after click, the Play button should be disabled and reflect animating state
      const disabledDuring = await page.$eval('#playBtn', (b) => ({ disabled: b.disabled, text: b.innerText, aria: b.getAttribute('aria-pressed') }));
      expect(disabledDuring.disabled).toBe(true);
      expect(disabledDuring.text).toMatch(/Animat/i);
      // During animation, stats are reset to placeholders — slope is expected to be '—' while animating
      const slopeWhileAnimating = (await page.textContent('#slopeVal')) || '';
      expect(slopeWhileAnimating.trim()).toBe('—');

      // Wait for the animation to complete: the code enables the playBtn at the end.
      // Use waitForFunction to detect when the button becomes enabled again.
      await page.waitForFunction(() => {
        const b = document.getElementById('playBtn');
        return b && b.disabled === false;
      }, null, { timeout: 6000 });

      // After animation finishes, validate the button is back and aria-pressed reset
      const finalBtnState = await page.$eval('#playBtn', (b) => ({ disabled: b.disabled, text: b.innerText, aria: b.getAttribute('aria-pressed') }));
      expect(finalBtnState.disabled).toBe(false);
      expect(finalBtnState.text).toMatch(/Play/);
      expect(finalBtnState.aria).toBe('false');

      // Stats should now reflect numeric results (not placeholders)
      const slopeAfter = (await page.textContent('#slopeVal')) || '';
      const interceptAfter = (await page.textContent('#interceptVal')) || '';
      const r2After = (await page.textContent('#r2Val')) || '';
      expect(slopeAfter.trim()).not.toBe('—');
      expect(interceptAfter.trim()).not.toBe('—');
      expect(r2After.trim()).not.toBe('—');

      // Fit line endpoints should have changed from initial to final (or be updated to solution)
      const finalLine = await page.$eval('#fitLine', (line) => ({
        x1: line.getAttribute('x1'),
        y1: line.getAttribute('y1'),
        x2: line.getAttribute('x2'),
        y2: line.getAttribute('y2'),
      }));
      // At minimum, y1 or y2 should differ (line moved)
      const lineMoved = initialLine.y1 !== finalLine.y1 || initialLine.y2 !== finalLine.y2;
      expect(lineMoved).toBe(true);
    });

    test('ToggleResiduals: show residuals then hide them, then show again (S0 -> S2 -> S3 -> S2)', async ({ page }) => {
      // Ensure residuals are absent at start
      const initialResiduals = await page.$eval('#residuals', (el) => el.children.length);
      expect(initialResiduals).toBe(0);

      // Click Residuals to show (S0_Idle -> S2_ResidualsVisible)
      await page.click('#resBtn');

      // The button aria-pressed and class should reflect active state
      await page.waitForFunction(() => document.getElementById('resBtn').getAttribute('aria-pressed') === 'true');
      const resBtnState = await page.$eval('#resBtn', (b) => ({ aria: b.getAttribute('aria-pressed'), classes: b.className }));
      expect(resBtnState.aria).toBe('true');
      expect(resBtnState.classes.includes('primary')).toBe(true);

      // Residual lines are animated in; wait until the residuals group has children
      await page.waitForFunction(() => document.getElementById('residuals').children.length > 0, null, { timeout: 3000 });
      const showedCount = await page.$eval('#residuals', (el) => el.children.length);
      expect(showedCount).toBeGreaterThan(0);

      // Click Residuals again to hide (S2_ResidualsVisible -> S3_ResidualsHidden)
      await page.click('#resBtn');
      await page.waitForFunction(() => document.getElementById('resBtn').getAttribute('aria-pressed') === 'false');
      const resBtnStateAfterHide = await page.$eval('#resBtn', (b) => ({ aria: b.getAttribute('aria-pressed'), classes: b.className }));
      expect(resBtnStateAfterHide.aria).toBe('false');
      // Residuals are removed after a fade-out timeout (420ms); wait a bit longer then assert empty
      await page.waitForTimeout(600);
      const residualsAfterHide = await page.$eval('#residuals', (el) => el.children.length);
      expect(residualsAfterHide).toBe(0);

      // Click Residuals once more to re-show (S3_ResidualsHidden -> S2_ResidualsVisible)
      await page.click('#resBtn');
      await page.waitForFunction(() => document.getElementById('resBtn').getAttribute('aria-pressed') === 'true');
      await page.waitForFunction(() => document.getElementById('residuals').children.length > 0, null, { timeout: 3000 });
      const residualsAfterReshow = await page.$eval('#residuals', (el) => el.children.length);
      expect(residualsAfterReshow).toBeGreaterThan(0);
    });
  });

  test.describe('Edge cases & interactions', () => {
    test('Rapid residual toggles and resize should not throw and should leave consistent state', async ({ page }) => {
      // Rapidly toggle residuals multiple times
      for (let i = 0; i < 4; i++) {
        await page.click('#resBtn');
        // small delay to simulate quick user toggles
        await page.waitForTimeout(80);
      }

      // Allow animations/residual cleanup to settle
      await page.waitForTimeout(600);

      // Trigger a window resize to exercise resize handler which re-renders points and line
      await page.evaluate(() => {
        // Resize by dispatching the resize event (do not modify global objects)
        window.dispatchEvent(new Event('resize'));
      });

      // Wait a brief moment for re-render
      await page.waitForTimeout(300);

      // Validate that points and fit line still exist after resize
      const pointsCountAfter = await page.$eval('#points', (el) => el.children.length);
      expect(pointsCountAfter).toBeGreaterThanOrEqual(18);

      const fitLineAttrs = await page.$eval('#fitLine', (line) => ({
        x1: line.getAttribute('x1'),
        y1: line.getAttribute('y1'),
        x2: line.getAttribute('x2'),
        y2: line.getAttribute('y2'),
      }));
      // Attributes should be present and numeric-ish
      expect(fitLineAttrs.x1).toBeDefined();
      expect(fitLineAttrs.y1).toBeDefined();
      expect(fitLineAttrs.x2).toBeDefined();
      expect(fitLineAttrs.y2).toBeDefined();

      // Finally ensure no runtime errors were emitted (pageErrors asserted in afterEach)
    });

    test('Clicking Play while animating does not cause unhandled errors', async ({ page }) => {
      // Start animation
      await page.click('#playBtn');

      // Immediately attempt to click Play again while it should be disabled.
      // Use try/catch: the click might be ignored or fail; we assert no page errors are raised.
      try {
        await page.click('#playBtn', { timeout: 500 }).catch(() => { /* ignore click errors during disabled state */ });
      } catch (e) {
        // Do not rethrow: we expect clicks on a disabled control to be ignored
      }

      // Wait until animation finishes and Play is re-enabled
      await page.waitForFunction(() => {
        const b = document.getElementById('playBtn');
        return b && b.disabled === false;
      }, null, { timeout: 6000 });

      // Ensure play button is back to normal and no page errors occurred (checked in afterEach)
      const btn = await page.$eval('#playBtn', (b) => ({ disabled: b.disabled, text: b.innerText }));
      expect(btn.disabled).toBe(false);
      expect(btn.text).toMatch(/Play/);
    });
  });

});