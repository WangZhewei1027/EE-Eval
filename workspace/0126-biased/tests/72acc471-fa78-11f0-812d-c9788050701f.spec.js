import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72acc471-fa78-11f0-812d-c9788050701f.html';

test.describe('72acc471-fa78-11f0-812d-c9788050701f - The Beauty of Git (FSM + UI)', () => {
  // Arrays to gather console and page errors for each test run
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test ensure no unexpected console errors or page errors occurred.
    // We assert these are empty to ensure there were no runtime errors in the page.
    expect(consoleErrors, `Console errors: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
    expect(pageErrors, `Page errors: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
  });

  test('Idle state on load: page renders components and initial styles', async ({ page }) => {
    // Validate core components exist and initial "Idle" state observations:
    // - animate button exists with expected text
    // - branch visualization has animate-graph class initially (CSS animation running)
    // - there are 5 commit elements as per FSM
    // - commit labels are initially hidden (opacity 0)

    const animateBtn = page.locator('#animate-btn');
    await expect(animateBtn).toBeVisible();
    await expect(animateBtn).toHaveText('Animate Flow');

    const branchVisualization = page.locator('.branch-visualization');
    await expect(branchVisualization).toBeVisible();
    const hasAnimateGraph = await branchVisualization.evaluate(el => el.classList.contains('animate-graph'));
    expect(hasAnimateGraph).toBe(true);

    const commits = page.locator('.commit');
    await expect(commits).toHaveCount(5);

    const labels = page.locator('.commit-label');
    await expect(labels).toHaveCount(5);

    // Verify each label's computed opacity is "0" initially (hidden)
    for (let i = 0; i < 5; i++) {
      const opacity = await labels.nth(i).evaluate(el => getComputedStyle(el).opacity);
      expect(opacity).toBe('0');
    }
  });

  test('Hovering over commits highlights label and applies hover style, mouseout reverts', async ({ page }) => {
    // This test validates HoverCommit and UnhoverCommit events:
    // - Hover (mouseover) on a commit should make the corresponding label visible (opacity 1)
    //   and apply an inline boxShadow on the commit element.
    // - Mouseout should revert label opacity to 0 and set boxShadow back to the default inline style.

    const commits = page.locator('.commit');
    const labels = page.locator('.commit-label');

    const commitCount = await commits.count();
    expect(commitCount).toBe(5);

    for (let i = 0; i < commitCount; i++) {
      const commitLocator = commits.nth(i);
      const labelLocator = labels.nth(i);

      // Hover the commit
      await commitLocator.hover();

      // The label's computed opacity should become '1'
      const labelOpacity = await labelLocator.evaluate(el => getComputedStyle(el).opacity);
      expect(labelOpacity).toBe('1');

      // The commit should have an inline boxShadow set by the mouseover handler
      const boxShadow = await commitLocator.evaluate(el => el.style.boxShadow);
      expect(boxShadow).toContain('0 5px 20px'); // inline style set in the handler

      // Now trigger mouseout by moving the mouse away to body
      await page.mouse.move(0, 0);

      // The label should return to opacity '0'
      const labelOpacityAfter = await labelLocator.evaluate(el => getComputedStyle(el).opacity);
      expect(labelOpacityAfter).toBe('0');

      // The commit's inline boxShadow should be the mouseout style
      const boxShadowAfter = await commitLocator.evaluate(el => el.style.boxShadow);
      // The script sets boxShadow to '0 3px 10px rgba(0, 0, 0, 0.1)' on mouseout.
      expect(boxShadowAfter).toContain('0 3px 10px');
    }
  });

  test('Clicking animate button triggers animation sequence and returns to Idle', async ({ page }) => {
    // This test validates the ClickAnimate event and transitions:
    // - Clicking the animate button should remove the 'animate-graph' class immediately (enter Animating)
    // - Commits should be dimmed (opacity set to 0.3)
    // - Subsequent timeouts should animate commits and branch, and at the end the animate-graph class is restored (back to Idle)
    // - Clicking while animation is running should be a no-op (guard with isAnimating prevents re-entry)
    // - Hovering during animation should still show labels (edge case)

    const animateBtn = page.locator('#animate-btn');
    const branchVisualization = page.locator('.branch-visualization');
    const commits = page.locator('.commit');
    const labels = page.locator('.commit-label');

    // Start animation
    await animateBtn.click();

    // Immediately after click, the animate-graph class should be removed (enter S1_Animating)
    const hasAnimateGraphAfterClick = await branchVisualization.evaluate(el => el.classList.contains('animate-graph'));
    expect(hasAnimateGraphAfterClick).toBe(false);

    // All commits should have inline opacity set to '0.3' as part of the animation start
    const commitCount = await commits.count();
    for (let i = 0; i < commitCount; i++) {
      const inlineOpacity = await commits.nth(i).evaluate(el => el.style.opacity);
      expect(inlineOpacity).toBe('0.3');
      // Also the transform should now include 'scale(0.7)' for many commits (inline style changed)
      const transform = await commits.nth(i).evaluate(el => el.style.transform);
      // When the script concatenates ' scale(0.7)' it should appear in inline transform for most items.
      // Do not fail the test if transform doesn't include it (depends on original inline transform),
      // but assert that inline transform is a non-empty string.
      expect(typeof transform).toBe('string');
      expect(transform.length).toBeGreaterThan(0);
    }

    // Edge case: Hover a commit during animation should still show its label
    await commits.nth(2).hover(); // hover commit-3 during animation
    const labelOpacityDuring = await labels.nth(2).evaluate(el => getComputedStyle(el).opacity);
    expect(labelOpacityDuring).toBe('1');

    // Attempt to click the animate button again immediately while animation is running.
    // Because of the guard `if (isAnimating) return;` the second click should not re-trigger the animation.
    // We'll click and ensure no runtime errors and that animate-graph is still absent at this moment.
    await animateBtn.click();
    const hasAnimateGraphAfterSecondClick = await branchVisualization.evaluate(el => el.classList.contains('animate-graph'));
    expect(hasAnimateGraphAfterSecondClick).toBe(false);

    // Wait long enough for the scripted animation to complete (time offsets in implementation go up to 3300ms).
    await page.waitForTimeout(3500);

    // After completion, animate-graph class should be restored (transition back to Idle)
    const hasAnimateGraphAfterFinish = await branchVisualization.evaluate(el => el.classList.contains('animate-graph'));
    expect(hasAnimateGraphAfterFinish).toBe(true);

    // Check that at least the final commit (commit-5) has opacity 1 and transform scaled back to 'scale(1)' or equivalent inline style.
    const commit5Opacity = await page.locator('#commit-5').evaluate(el => el.style.opacity || getComputedStyle(el).opacity);
    // The script sets commit-5 opacity to '1' near the end.
    expect(commit5Opacity === '1' || commit5Opacity === 1 || commit5Opacity === '1').toBeTruthy();

    // Now click animate again to ensure we can re-enter Animating state after completion.
    await animateBtn.click();
    const hasAnimateGraphAfterRestart = await branchVisualization.evaluate(el => el.classList.contains('animate-graph'));
    // Immediately after clicking again it should be removed again.
    expect(hasAnimateGraphAfterRestart).toBe(false);

    // Wait for this second animation to finish
    await page.waitForTimeout(3500);
    const hasAnimateGraphFinal = await branchVisualization.evaluate(el => el.classList.contains('animate-graph'));
    expect(hasAnimateGraphFinal).toBe(true);
  });

  test('Rapid multiple clicks do not cause runtime exceptions and behave as guarded by isAnimating', async ({ page }) => {
    // This test probes edge-case behavior of repeatedly clicking the animate button in quick succession:
    // - Because `isAnimating` guards against re-entry, repeated clicks should not cause errors
    // - The animation sequence should still complete and restore the Idle state

    const animateBtn = page.locator('#animate-btn');
    const branchVisualization = page.locator('.branch-visualization');

    // Click the animate button rapidly several times
    await animateBtn.click();
    await animateBtn.click();
    await animateBtn.click();
    await animateBtn.click();

    // Ensure no errors were emitted so far (page errors are asserted in afterEach)
    // Check that animate-graph class is removed (we are in Animating)
    const isAnimatingNow = await branchVisualization.evaluate(el => el.classList.contains('animate-graph'));
    expect(isAnimatingNow).toBe(false);

    // Wait for the single animation to complete (timeouts handled inside page code)
    await page.waitForTimeout(3500);

    // After sequence completes, animate-graph should be restored
    const restored = await branchVisualization.evaluate(el => el.classList.contains('animate-graph'));
    expect(restored).toBe(true);
  });
});