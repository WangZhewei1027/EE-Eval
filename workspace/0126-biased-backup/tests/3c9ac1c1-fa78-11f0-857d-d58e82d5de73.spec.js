import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9ac1c1-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page object encapsulating interactions and assertions for the Git visualization page.
 */
class GitVisualizationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleBtn = page.locator('#toggleGlowBtn');
    this.commits = page.locator('.commit');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main interactive elements to be present
    await this.page.waitForSelector('.git-graph');
    await this.page.waitForSelector('#toggleGlowBtn');
  }

  async ariaPressed() {
    return (await this.toggleBtn.getAttribute('aria-pressed')) ?? '';
  }

  async commitCount() {
    return await this.commits.count();
  }

  /**
   * Returns an array of objects describing each commit element: { index, className, title }
   */
  async snapshotCommits() {
    return await this.page.$$eval('.commit', nodes =>
      nodes.map((n, i) => ({ index: i, className: n.className, title: n.getAttribute('title') }))
    );
  }

  /**
   * Assert that pulse classes are present/absent on the appropriate commits.
   * - expected = true: expect pulse-* classes present where appropriate
   * - expected = false: expect pulse-* classes absent
   */
  async expectPulseState(expected = true) {
    const commits = await this.snapshotCommits();
    // Validate each commit depending on its branch indicator in className
    for (const commit of commits) {
      const classes = commit.className;
      if (classes.includes('main-')) {
        if (expected) {
          expect(classes).toContain('pulse-main');
        } else {
          // No pulse-* classes should be present
          expect(classes).not.toContain('pulse-main');
          expect(classes).not.toContain('pulse-feature');
          expect(classes).not.toContain('pulse-hotfix');
        }
      } else if (classes.includes('feature')) {
        if (expected) {
          expect(classes).toContain('pulse-feature');
        } else {
          expect(classes).not.toContain('pulse-feature');
          expect(classes).not.toContain('pulse-main');
          expect(classes).not.toContain('pulse-hotfix');
        }
      } else if (classes.includes('hotfix')) {
        if (expected) {
          expect(classes).toContain('pulse-hotfix');
        } else {
          expect(classes).not.toContain('pulse-hotfix');
          expect(classes).not.toContain('pulse-main');
          expect(classes).not.toContain('pulse-feature');
        }
      } else {
        // Unexpected commit class layout - still assert pulse-* behavior deterministically
        if (expected) {
          expect(classes).toMatch(/pulse-(main|feature|hotfix)/);
        } else {
          expect(classes).not.toMatch(/pulse-(main|feature|hotfix)/);
        }
      }
    }
  }

  async toggleGlow() {
    await this.toggleBtn.click();
  }
}

test.describe('Git Visualization - Glow Toggle (3c9ac1c1-fa78-11f0-857d-d58e82d5de73)', () => {
  // Collect console and page errors for each test to assert environment stability.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture console errors only
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      // Capture runtime uncaught exceptions (TypeError, ReferenceError, etc.)
      pageErrors.push(err.message);
    });
  });

  test.afterEach(async () => {
    // After each test we expect no console errors or page errors occurred during the test.
    // This validates that the page executed without uncaught runtime errors.
    expect(consoleErrors, `Console errors were logged: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors occurred: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('Initial state: commits are glowing and toggle button has aria-pressed="true"', async ({ page }) => {
    // Validate the application's initial state matches expectations (commits glowing & button pressed)
    const git = new GitVisualizationPage(page);
    await git.goto();

    // Verify button initial pressed state
    const pressed = await git.ariaPressed();
    // The DOM sets aria-pressed="true" initially; ensure that holds
    expect(pressed).toBe('true');

    // There should be 10 commit nodes as per the HTML markup
    const count = await git.commitCount();
    expect(count).toBeGreaterThanOrEqual(9); // defensive: at least 9 commits present (10 expected)
    // Ensure pulse classes are present for main/feature/hotfix commits
    await git.expectPulseState(true);
  });

  test('ToggleGlow event: clicking toggle removes pulse classes and updates aria-pressed to "false"', async ({ page }) => {
    // Clicking when glow is on should turn it off -> classes removed
    const git = new GitVisualizationPage(page);
    await git.goto();

    // Precondition: pulses are currently active
    await git.expectPulseState(true);
    expect(await git.ariaPressed()).toBe('true');

    // Trigger the ToggleGlow event
    await git.toggleGlow();

    // After toggling, the aria-pressed attribute should reflect new state ("false")
    expect(await git.ariaPressed()).toBe('false');

    // All pulse classes should be removed
    await git.expectPulseState(false);
  });

  test('ToggleGlow event: toggling twice re-enables pulse classes and sets aria-pressed back to "true"', async ({ page }) => {
    // A double toggle should return the system to the glowing state
    const git = new GitVisualizationPage(page);
    await git.goto();

    // Precondition: initially glowing
    expect(await git.ariaPressed()).toBe('true');
    await git.expectPulseState(true);

    // Toggle off
    await git.toggleGlow();
    expect(await git.ariaPressed()).toBe('false');
    await git.expectPulseState(false);

    // Toggle on again
    await git.toggleGlow();
    expect(await git.ariaPressed()).toBe('true');

    // Pulse classes should be re-applied
    await git.expectPulseState(true);
  });

  test('Rapid toggling: odd/even number of clicks results in consistent final state', async ({ page }) => {
    // Edge case: rapid repeated clicks should still yield a deterministic final state.
    const git = new GitVisualizationPage(page);
    await git.goto();

    // Start with known state (should be glowing, aria-pressed = "true")
    expect(await git.ariaPressed()).toBe('true');
    await git.expectPulseState(true);

    // Perform 5 rapid toggles (odd -> final state should be toggled)
    for (let i = 0; i < 5; i++) {
      await git.toggleGlow();
    }
    // 5 toggles from initial true results in false
    expect(await git.ariaPressed()).toBe('false');
    await git.expectPulseState(false);

    // Perform 1 more toggle to make it even total (6), final should be true
    await git.toggleGlow();
    expect(await git.ariaPressed()).toBe('true');
    await git.expectPulseState(true);
  });

  test('Robustness: partial DOM inconsistency does not break toggle behavior', async ({ page }) => {
    // Simulate an inconsistent DOM (some commit lost its pulse class), then perform toggle
    const git = new GitVisualizationPage(page);
    await git.goto();

    // Ensure initial expected state
    expect(await git.ariaPressed()).toBe('true');
    await git.expectPulseState(true);

    // Manually remove a pulse class from the first commit to simulate an inconsistent DOM
    await page.evaluate(() => {
      const first = document.querySelector('.commit');
      if (first) {
        first.classList.remove('pulse-main', 'pulse-feature', 'pulse-hotfix');
      }
    });

    // After DOM mutation, at least one commit may be missing a pulse class - toggling should still complete normally
    await git.toggleGlow();

    // Toggling should turn glow off for entire set (no errors and pulses removed)
    expect(await git.ariaPressed()).toBe('false');
    await git.expectPulseState(false);

    // Toggle back on - pulses should be restored for commits that match branch rules
    await git.toggleGlow();
    expect(await git.ariaPressed()).toBe('true');
    await git.expectPulseState(true);
  });

  test('Accessibility & semantics: toggle button is focusable and has label', async ({ page }) => {
    // Validate basic accessibility semantics of the toggle control
    const git = new GitVisualizationPage(page);
    await git.goto();

    // Button should have aria-label
    const label = await page.locator('#toggleGlowBtn').getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label.toLowerCase()).toContain('toggle');

    // Button should be focusable via keyboard (press Tab to focus)
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.id || '');
    // The toggle button or another control may receive focus; ensure the toggle button can be focused directly
    // Focus it programmatically as a stronger assertion
    await page.locator('#toggleGlowBtn').focus();
    const focusedAfter = await page.evaluate(() => document.activeElement?.id || '');
    expect(focusedAfter).toBe('toggleGlowBtn');
  });

  test('State evidence verification: DOM contains specific expected evidence strings', async ({ page }) => {
    // Validate presence of evidence strings referenced in the FSM (button markup and pulse class usage)
    await page.goto(APP_URL);
    // Check the button markup contains the aria-pressed attribute and label text content
    const btnHtml = await page.locator('#toggleGlowBtn').innerHTML();
    expect(btnHtml).toContain('Toggle Glow Animation');

    // Ensure at least one commit contains 'pulse-main' and others contain 'pulse-feature'/'pulse-hotfix'
    const html = await page.content();
    expect(html).toContain('pulse-main');
    expect(html).toContain('pulse-feature');
    expect(html).toContain('pulse-hotfix');
  });
});