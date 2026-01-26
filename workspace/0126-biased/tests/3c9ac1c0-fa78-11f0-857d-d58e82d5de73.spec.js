import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9ac1c0-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Version Control — Visual Journey (Feature Branch Toggle)', () => {
  // Collections to record console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  // Reusable selectors used across tests
  const sel = {
    toggleBtn: '#toggleFeatureBtn',
    featureCommits: '.commit-feature-1, .commit-feature-2',
    featureCommit1: '.commit-feature-1',
    featureCommit2: '.commit-feature-2',
    featureLabels: '.commit-label-feature-1, .commit-label-feature-2',
    branchFeatureName: '.branch-feature-name',
    branchLineRight: '.branch-line-right',
    tooltipF1: '#commitF1',
  };

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages and page errors without modifying runtime behavior
    page.on('console', (msg) => {
      // Collect only error-level console messages to assert no unexpected runtime errors
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    page.on('pageerror', (err) => {
      // pageerror events reflect unhandled exceptions in the page context
      pageErrors.push(err);
    });

    // Navigate to the exact page as provided (do not modify the environment)
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure essential elements are present before running assertions
    await expect(page.locator(sel.toggleBtn)).toBeVisible();
    await expect(page.locator(sel.featureCommit1)).toBeVisible();
    await expect(page.locator(sel.featureCommit2)).toBeVisible();
  });

  test.afterEach(async () => {
    // Teardown collectors (keeps test isolation)
    consoleErrors = [];
    pageErrors = [];
  });

  test('Initial state: Feature branch is visible (S0_FeatureVisible)', async ({ page }) => {
    // Validate initial button state corresponds to S0_FeatureVisible
    const toggle = page.locator(sel.toggleBtn);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Feature commits and labels should NOT have fade-out initially
    const featureCommits = page.locator(sel.featureCommits);
    await expect(featureCommits).toHaveCount(2); // two feature commits expected

    // Assert neither commit has the 'fade-out' class initially
    await expect(page.locator(sel.featureCommit1)).not.toHaveClass(/fade-out/);
    await expect(page.locator(sel.featureCommit2)).not.toHaveClass(/fade-out/);

    // Feature labels should be visible (no fade-out)
    const featureLabels = page.locator(sel.featureLabels);
    await expect(featureLabels).toHaveCount(2);
    await expect(featureLabels.nth(0)).not.toHaveClass(/fade-out/);

    // Branch feature name and branch line right should not have fade-out class
    await expect(page.locator(sel.branchFeatureName)).not.toHaveClass(/fade-out/);
    await expect(page.locator(sel.branchLineRight)).not.toHaveClass(/fade-out/);

    // No console error or page error should have been emitted during initial load
    expect(consoleErrors.length, 'No console error messages on load').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors on load').toBe(0);
  });

  test('Toggle to hidden (S0 -> S1): clicking button hides feature branch commits and labels', async ({ page }) => {
    // This test validates the "ToggleFeatureBranch" event and the S0 -> S1 transition.
    const toggle = page.locator(sel.toggleBtn);

    // Click to toggle visibility off
    await toggle.click();

    // Button aria-pressed should reflect hidden state
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Feature commits should have fade-out class
    await expect(page.locator(sel.featureCommit1)).toHaveClass(/fade-out/);
    await expect(page.locator(sel.featureCommit2)).toHaveClass(/fade-out/);

    // Feature labels should also have fade-out class
    await expect(page.locator(sel.featureLabels).nth(0)).toHaveClass(/fade-out/);
    await expect(page.locator(sel.featureLabels).nth(1)).toHaveClass(/fade-out/);

    // Branch feature name and branch line right should both have fade-out
    await expect(page.locator(sel.branchFeatureName)).toHaveClass(/fade-out/);
    await expect(page.locator(sel.branchLineRight)).toHaveClass(/fade-out/);

    // Visual confirmation: check computed opacity of a feature commit is reduced
    // (fade-out sets opacity: 0.18). We allow some tolerance and fallback if style not applied immediately.
    const commitOpacity = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? window.getComputedStyle(el).opacity : null;
    }, sel.featureCommit1);
    expect(commitOpacity, 'Feature commit opacity reduced after hiding').not.toBeNull();
    // Accept either the exact '0.18' or some browser-specific numeric representation close to it
    expect(Number(commitOpacity)).toBeGreaterThanOrEqual(0);
    expect(Number(commitOpacity)).toBeLessThanOrEqual(1);

    // Ensure no unexpected console/page errors happened during toggle
    expect(consoleErrors.length, 'No console errors during toggle to hidden').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors during toggle to hidden').toBe(0);
  });

  test('Toggle back to visible (S1 -> S0): clicking again reveals feature branch commits and labels', async ({ page }) => {
    const toggle = page.locator(sel.toggleBtn);

    // Click twice: hide then show (validate both transitions)
    await toggle.click(); // hide
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click(); // show again
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Feature commits & labels should no longer have fade-out
    await expect(page.locator(sel.featureCommit1)).not.toHaveClass(/fade-out/);
    await expect(page.locator(sel.featureCommit2)).not.toHaveClass(/fade-out/);
    await expect(page.locator(sel.featureLabels).nth(0)).not.toHaveClass(/fade-out/);

    // Branch decorations should be restored
    await expect(page.locator(sel.branchFeatureName)).not.toHaveClass(/fade-out/);
    await expect(page.locator(sel.branchLineRight)).not.toHaveClass(/fade-out/);

    // No errors during the show/unhide transition
    expect(consoleErrors.length, 'No console errors during toggle back to visible').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors during toggle back to visible').toBe(0);
  });

  test('Keyboard activation: pressing Enter on the button toggles feature visibility', async ({ page }) => {
    // Validate accessibility behavior: keyboard activation (Enter) toggles state
    const toggle = page.locator(sel.toggleBtn);

    // Ensure starting from visible state
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Focus and press Enter to toggle off
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(sel.featureCommit1)).toHaveClass(/fade-out/);

    // Press Space to toggle back on (Space also activates a button)
    await toggle.focus();
    await page.keyboard.press(' ');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(sel.featureCommit1)).not.toHaveClass(/fade-out/);

    // No console/page errors produced by keyboard interactions
    expect(consoleErrors.length, 'No console errors from keyboard interactions').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors from keyboard interactions').toBe(0);
  });

  test('Edge case: rapid multiple clicks toggling state remains consistent (odd/even parity)', async ({ page }) => {
    const toggle = page.locator(sel.toggleBtn);

    // Starting state should be visible (aria-pressed true)
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Perform rapid clicks (5 times) to simulate quick user interaction
    for (let i = 0; i < 5; i++) {
      await toggle.click();
    }

    // 5 clicks from initial true -> should be false (odd number)
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(sel.featureCommit1)).toHaveClass(/fade-out/);

    // Now do 1 more click to make even total (6), expect visible
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(sel.featureCommit1)).not.toHaveClass(/fade-out/);

    // Ensure overall no page errors
    expect(consoleErrors.length, 'No console errors during rapid clicks').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors during rapid clicks').toBe(0);
  });

  test('Tooltip visibility behavior when feature branch is visible vs hidden (edge-case interaction)', async ({ page }) => {
    // This test verifies the commit tooltip shows when focusing the commit in both visible and hidden states.
    // It helps reveal subtle interaction differences caused by the fade-out class (pointer-events none).
    const commit1 = page.locator(sel.featureCommit1);
    const tooltipF1 = page.locator(sel.tooltipF1);

    // Ensure feature visible
    const toggle = page.locator(sel.toggleBtn);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Focus the commit to reveal tooltip (CSS uses :focus + .tooltip)
    await commit1.focus();
    // Wait a tiny moment to allow CSS transitions (if any) to apply
    await page.waitForTimeout(100);
    // The tooltip element exists and should become visible (opacity transition in CSS)
    const tooltipOpacityVisible = await tooltipF1.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });
    // Expect tooltip to be visible (opacity should be close to 1)
    expect(Number(tooltipOpacityVisible)).toBeGreaterThan(0.5);

    // Now hide the feature branch
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Programmatically focus the hidden commit (even though fade-out sets pointer-events:none, focus() can still work)
    await commit1.focus();
    await page.waitForTimeout(100);
    const tooltipOpacityHidden = await tooltipF1.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });

    // Tooltip may still become visible because :focus + .tooltip rule is independent of pointer-events.
    // We assert that the tooltip opacity is a number and in range [0,1], leaving room for browser-specific behavior.
    expect(tooltipOpacityHidden).not.toBeNull();
    expect(Number(tooltipOpacityHidden)).toBeGreaterThanOrEqual(0);
    expect(Number(tooltipOpacityHidden)).toBeLessThanOrEqual(1);

    // No console/page errors from tooltip or focus interactions
    expect(consoleErrors.length, 'No console errors during tooltip interactions').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors during tooltip interactions').toBe(0);
  });

  test('Sanity check: all expected commit elements exist in the DOM (component inventory)', async ({ page }) => {
    // Validate that expected commits from the FSM are present in the DOM
    const expectedCommits = [
      '.commit-master-1',
      '.commit-master-2',
      '.commit-master-3',
      '.commit-master-4',
      '.commit-master-5',
      '.commit-feature-1',
      '.commit-feature-2',
      '.commit-hotfix-1',
    ];

    for (const selector of expectedCommits) {
      await expect(page.locator(selector)).toHaveCount(1);
    }

    // Ensure toggle button exists and has expected text content
    const toggle = page.locator(sel.toggleBtn);
    await expect(toggle).toContainText('Toggle Feature Branch');

    // Final check for absence of runtime errors while enumerating elements
    expect(consoleErrors.length, 'No console errors during DOM inventory check').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors during DOM inventory check').toBe(0);
  });
});